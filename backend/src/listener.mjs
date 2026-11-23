import mqtt from 'mqtt';
import { startMonitoring } from './monitoring.mjs';
import pg from 'pg';
import { writeFileSync,renameSync,mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { sign } from 'node:crypto';
import { loadConfig,root } from './config.mjs';
import { canonical } from './protocol.mjs';
import { Store } from './store.mjs';
import { loadStage3Config } from './stage3-config.mjs';
import { deliverStage3,reconcileStage3,progressStage3 } from './stage3-delivery.mjs';
import { validateCommand } from '../../integration/stage3/protocol.mjs';
import { PassThrough } from 'node:stream';
import { faults,consumeFault } from './stage3-faults.mjs';
async function main(){
const config=process.env.SHOPPING_STAGE3_CONFIG==='1'?loadStage3Config():loadConfig(),store=new Store(config);
const monitoring=config.protocolVersion===2?startMonitoring(config):null;
config.monitoring=monitoring;
const dispatch=new pg.Pool({...config.db,...config.dispatcher,max:1,connectionTimeoutMillis:5000,statement_timeout:5000});
process.umask(0o077);
const health=resolve(config.healthFile);
if(!health.startsWith(`${root}/.stage0-runtime/`))throw new Error('Unsafe health path');
if(config.testing && !(process.env.SHOPPING_STAGE2_CONFIG??'').startsWith('.stage0-runtime/stage2-test-'))throw new Error('Test hook requires test config');
let connected=false,busy=false,stopping=false,processed=0;
const startWall=Date.now(),startMono=performance.now();
const healthyClock=()=>Math.abs(Date.now()-(startWall+performance.now()-startMono))<2000;
const client=mqtt.connect(config.mqtt.url,{username:config.mqtt.token,clientId:config.mqtt.clientId,protocolVersion:5,
  clean:false,properties:{sessionExpiryInterval:1800,maximumPacketSize:32768},reconnectPeriod:1500,connectTimeout:10000,keepalive:15,resubscribe:false,rejectUnauthorized:true});
const event=(name,fields={})=>{if(['stage3_received','stage3_outbox_delivery'].includes(name))return;console.log(JSON.stringify({at:new Date().toISOString(),event:name,...fields}));};
if(config.protocolVersion===2) {
  const builder=client.streamBuilder;
  client.streamBuilder=(...args)=>{
    if(!faults(config).mqttOffline)return builder(...args);
    const stream=new PassThrough();setImmediate(()=>stream.destroy(new Error('controlled_owned_stream_interruption')));return stream;
  };
}
client.on('error',()=>event('mqtt_error'));
client.on('close',()=>{connected=false;});
async function reply(result) {
  if(faults(config).callbackOffline)throw new Error('controlled_callback_unavailable');
  if(config.protocolVersion===2)return deliverStage3(result,config);
  const value={kind:'stage2-result',kid:'result-v1',...result};
  value.signature=sign(null,Buffer.from(canonical(value)),config.resultPrivateKey).toString('base64url');
  let timer;
  const ack=await Promise.race([client.publishAsync(config.mqtt.results,JSON.stringify(value),{qos:1,retain:false,properties:{messageExpiryInterval:300}}),
    new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Result acknowledgment timeout')),5000);})]).finally(()=>clearTimeout(timer));
  if(ack?.reasonCode>=128)throw new Error('Result publish refused');
}
client.on('connect',async packet=>{
  try {
    if(!client.stream.authorized)throw new Error('TLS');
    await client.subscribeAsync(config.mqtt.commands,{qos:1});connected=true;
    event('ready',{session_present:packet.sessionPresent});process.send?.({event:'ready',session_present:packet.sessionPresent});
  }catch{event('subscription_failed');client.stream.destroy();}
});
// MQTT.js invokes this after emitting message; only this hook processes commands.
// Its callback is delayed until commit/explicit rejection, never used as UI saved.
client.handleMessage=(packet,done)=>{
  if(stopping){client.stream.destroy();return;}
  (async()=>{
    const received=performance.now();let validated=received,progressed=received;
    let command;
    if(packet.payload.length>16384){event('oversized_command');done();return;}
    try {command=JSON.parse(packet.payload.toString());}catch{done();return;}
    if(packet.topic!==config.mqtt.commands || command.aud!==config.audience) {done();return;}
    if(!healthyClock() || config.mqtt.expire<=Date.now()/1000)throw new Error('Clock or credential health');
    let result;
    if(config.protocolVersion===2){
      try{validateCommand(command,config.commandKeys);}catch{event('invalid_command');done();return;}
      validated=performance.now();
      await progressStage3(command,'processing',config).catch(()=>event('progress_pending'));progressed=performance.now();
    }
    try {result=await store.execute(command,{beforeCommit:async()=>{
      if(consumeFault(config,'crashBeforeCommitId',command.id)){event('controlled_crash_before_commit',{operation_id:command.id,correlation_id:command.correlation_id});process.kill(process.pid,'SIGKILL');}
      if(consumeFault(config,'failTransactionId',command.id)){event('controlled_transaction_failure',{operation_id:command.id,correlation_id:command.correlation_id});const e=new Error('controlled_transaction_failure');e.code='P0001';throw e;}
    }});}
    catch(e) {
      if(e.code){if(config.protocolVersion===2)await progressStage3(command,'failed_retryable',config).catch(()=>{});throw e;}
      if(config.protocolVersion===2) {
        try {validateCommand(command,config.commandKeys);await progressStage3(command,'reconciliation_required',config).catch(()=>{});event('identity_unavailable_reconciliation_required',{operation_id:command.id,correlation_id:command.correlation_id});done();return;}
        catch {event('invalid_command');done();return;}
      } else {
      event('invalid_command');done();return;
      }
    }
    config.monitoring?.capture(command,{server_validation_ms:validated-received,gateway_progress_ms:progressed-validated,listener_processing_ms:performance.now()-received,mqtt_duplicate_count:packet.dup?1:0},[{stage:'server_validation',start_ms:0,duration_ms:validated-received},{stage:'gateway_progress',start_ms:validated-received,duration_ms:progressed-validated},{stage:'listener_processing',start_ms:0,duration_ms:performance.now()-received}]);
    processed++;
    if(!['snapshot','found','not_found'].includes(result.status))event('operation_result',{operation_id:result.operation_id,correlation_id:result.correlation_id,status:result.status,replayed:result.replayed??false});
    if((config.testing?.crashAfterCommitId===command.id || consumeFault(config,'crashAfterCommitId',command.id)) && result.status==='committed') {
      process.send?.({event:'committed_before_crash',operation_id:command.id});
      process.kill(process.pid,'SIGKILL');return;
    }
    // Stored mutation results also exist in the durable outbox. Direct replies
    // support status/snapshot/retry/denials; duplicates are safe by operation ID.
    // Release MQTT.js's incoming parser after commit before awaiting a response
    // PUBACK. Waiting here deadlocks that same parser's outgoing-ACK handling.
    if(consumeFault(config,'lostAckId',command.id)){event('controlled_lost_incoming_ack',{operation_id:command.id,correlation_id:command.correlation_id});client.stream.destroy();done();return;}
    done();setImmediate(()=>reply(result).catch(()=>{event('result_delivery_pending');if(config.protocolVersion!==2)client.stream.destroy();}));
  })().catch(()=>{event('processing_unavailable');client.stream.destroy();});
};
async function tick() {
  if(busy||stopping)return;busy=true;
  try {
    if(faults(config).mqttOffline && connected)client.stream.destroy();
    await store.pool.query('SELECT 1');
    const state={pid:process.pid,at:new Date().toISOString(),connected,clock_healthy:healthyClock(),database:'shopping_stage0',port:55439,processed};
    mkdirSync(resolve('.stage0-runtime'),{recursive:true,mode:0o700});
    writeFileSync(`${health}.partial`,JSON.stringify(state)+'\n',{mode:0o600});renameSync(`${health}.partial`,health);
    if((connected||config.protocolVersion===2)&&!config.testing?.holdOutbox) {
      const rows=(await dispatch.query("SELECT operation_id,result,attempts,created_at FROM shopping.result_outbox WHERE delivered_at IS NULL AND result->>'audience'=$1 ORDER BY created_at LIMIT 20",[config.audience])).rows;
      for(const row of rows) {
        await dispatch.query('UPDATE shopping.result_outbox SET attempts=attempts+1 WHERE operation_id=$1',[row.operation_id]);
        try{await reply(row.result);}finally{config.monitoring?.capture({id:row.operation_id,correlation_id:row.result.correlation_id,type:['snapshot','found','not_found'].includes(row.result.status)?'snapshot':'outbox'},{outbox_attempt_count:row.attempts+1});}
        await dispatch.query('UPDATE shopping.result_outbox SET delivered_at=now() WHERE operation_id=$1',[row.operation_id]);
      }
    }
  }catch{event('health_or_outbox_unavailable');}finally{busy=false;}
}
const timer=setInterval(tick,1000);await tick();
let reconciling=false;
const reconciliationTimer=config.protocolVersion===2?setInterval(async()=>{
  if(reconciling||stopping||faults(config).mqttOffline)return;reconciling=true;
  try {
    for(const {command} of await reconcileStage3(config)) {
      let result;
      try {result=await store.execute(command);}catch(error){if(error.code)throw error;validateCommand(command,config.commandKeys);event('identity_unavailable_reconciliation_required',{operation_id:command.id,correlation_id:command.correlation_id});continue;}
      await reply(result);
      event('reconciled',{operation_id:command.id,correlation_id:command.correlation_id,status:result.status});
    }
  }catch{event('reconciliation_pending');}finally{reconciling=false;}
},15000):null;
async function stop(){
  if(stopping)return;stopping=true;monitoring?.stop();clearInterval(timer);clearInterval(reconciliationTimer);
  // Preserve a long session for real service restart/offline queue recovery.
  await new Promise(resolve=>{
    const timer=setTimeout(()=>{client.end(true);resolve();},3000);
    client.endAsync(false,{properties:{sessionExpiryInterval:1800}}).then(()=>{clearTimeout(timer);resolve();}).catch(()=>{clearTimeout(timer);client.end(true);resolve();});
  });
  const until=Date.now()+7000;
  while(busy&&Date.now()<until)await new Promise(r=>setTimeout(r,20));
  await store.close();await dispatch.end();process.exit(0);
}
process.on('SIGTERM',()=>stop().catch(()=>process.exit(1)));process.on('SIGINT',()=>stop().catch(()=>process.exit(1)));
}
main().catch(()=>{console.error(JSON.stringify({event:'backend_startup_failed'}));process.exit(1);});
