import assert from 'node:assert/strict';
import mqtt from 'mqtt';
import pg from 'pg';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID,verify } from 'node:crypto';
import { readFileSync,writeFileSync,openSync,closeSync } from 'node:fs';
import { config,make,resign,household } from './fixtures.mjs';
import { canonical } from '../src/protocol.mjs';
import { Store } from '../src/store.mjs';
const runId=randomUUID(),audience=`shopping-stage2-dev-${runId}`;
const configPath=`.stage0-runtime/stage2-test-${runId}.json`;
const testConfig={...config,audience,healthFile:`.stage0-runtime/stage2-test-health-${runId}.json`,mqtt:{...config.mqtt,clientId:`naf-s2-listener-${randomUUID()}`}};
const credential=JSON.parse(readFileSync('.stage0-runtime/flespi-dev.json'));
const publisher=mqtt.connect(credential.broker_url,{username:credential.publisher_token,clientId:`naf-s2-publisher-${randomUUID()}`,protocolVersion:5,clean:true,reconnectPeriod:0,rejectUnauthorized:true});
publisher.on('error',()=>{});
const replies=[],checks=[],readyPackets=[];
let child,status='PASS',error;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function bounded(promise,ms=15000,label='test_timeout'){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label)),ms);})]);}finally{clearTimeout(timer);}}
publisher.on('message',(topic,bytes)=>{
  if(topic!==config.mqtt.results)return;
  let r;try{r=JSON.parse(bytes.toString());}catch{return;}
  if(r.audience!==audience)return;
  const {signature,...body}=r;
  if(!verify(null,Buffer.from(canonical(body)),config.resultPublicKey,Buffer.from(signature,'base64url')))return;
  replies.push(r);
});
const store=new Store(config);
const admin=new pg.Pool({host:'127.0.0.1',port:55439,database:'shopping_stage0',user:'stage0_owner',password:readFileSync('.stage0-runtime/admin-password','utf8').trim(),max:1});
async function start(testing){
  writeFileSync(configPath,JSON.stringify({...testConfig,...(testing?{testing}:{})}),{mode:0o600});
  const fd=openSync(`.stage0-runtime/stage2-mqtt-child-${runId}.log`,'a',0o600);
  child=fork('backend/src/listener.mjs',[],{stdio:['ignore',fd,fd,'ipc'],env:{PATH:process.env.PATH,HOME:process.env.HOME,SHOPPING_STAGE2_CONFIG:configPath}});closeSync(fd);
  const ready=new Promise((resolve,reject)=>{child.on('message',m=>{if(m.event==='ready')resolve(m);});child.once('exit',()=>reject(new Error('listener_exit_before_ready')));});
  const packet=await bounded(ready);readyPackets.push(packet);return packet;
}
async function stop(){if(!child||child.exitCode!==null||child.signalCode)return;const done=once(child,'exit');child.kill('SIGTERM');await bounded(done,20000,'listener_stop_timeout');child=null;}
async function send(command){await publisher.publishAsync(config.mqtt.commands,JSON.stringify(command),{qos:1,retain:false,properties:{messageExpiryInterval:300}});}
async function result(id,predicate=()=>true){return bounded((async()=>{while(true){const r=replies.find(x=>x.operation_id===id&&predicate(x));if(r)return r;await pause(30);}})());}
async function check(test,fn){await fn();checks.push({test,passed:true,actual_postgresql:true,live_mqtt:true});console.log(JSON.stringify({test,passed:true}));}
try{
  await bounded(once(publisher,'connect'));await publisher.subscribeAsync(config.mqtt.results,{qos:1});
  const category=randomUUID();assert.equal((await store.execute(make('category.create',{id:category,name:'MQTT crash fixture'}))).status,'committed');
  const crashed=make('product.create',{id:randomUUID(),category_id:category,name:'Commit before crash'},{aud:audience});
  await check('actual SIGKILL after PostgreSQL commit before MQTT ACK/application reply',async()=>{
    await start({crashAfterCommitId:crashed.id,holdOutbox:true});
    const exit=once(child,'exit');await send(crashed);const [,signal]=await bounded(exit);assert.equal(signal,'SIGKILL');
    assert.equal((await admin.query('SELECT count(*) FROM shopping.products WHERE id=$1',[crashed.payload.id])).rows[0].count,'1');
    assert.equal((await admin.query('SELECT delivered_at FROM shopping.result_outbox WHERE operation_id=$1',[crashed.id])).rows[0].delivered_at,null);
    assert.equal(replies.some(r=>r.operation_id===crashed.id),false);
  });
  await check('restart redelivery returns committed result; durable outbox drains; effect remains once',async()=>{
    assert.equal((await start()).session_present,true);
    const r=await result(crashed.id);assert.equal(r.status,'committed');
    await bounded((async()=>{while(!(await admin.query('SELECT delivered_at FROM shopping.result_outbox WHERE operation_id=$1',[crashed.id])).rows[0].delivered_at)await pause(30);})());
    assert.equal((await admin.query('SELECT version FROM shopping.products WHERE id=$1',[crashed.payload.id])).rows[0].version,'1');
    await send(crashed);assert.equal((await result(crashed.id,r=>r.replayed===true)).status,'committed');
  });
  let queued;
  await check('graceful process restart recovers actual queued valid operations into PostgreSQL',async()=>{
    await stop();queued=[0,1].map(i=>make('product.create',{id:randomUUID(),category_id:category,name:`Queued database ${i}`},{aud:audience}));
    for(const c of queued)await send(c);
    await pause(1500);
    for(const c of queued)assert.equal((await admin.query('SELECT count(*) FROM shopping.operations WHERE id=$1',[c.id])).rows[0].count,'0');
    assert.equal((await start()).session_present,true);
    for(const c of queued)assert.equal((await result(c.id)).status,'committed');
    for(const c of queued)assert.equal((await admin.query('SELECT count(*) FROM shopping.products WHERE id=$1',[c.payload.id])).rows[0].count,'1');
  });
  await check('live same-ID conflict and signed status lookup after restart',async()=>{
    const conflict=resign(queued[0],{payload:{...queued[0].payload,quantity:6}});await send(conflict);
    assert.equal((await result(conflict.id,r=>r.status==='operation_id_conflict')).status,'operation_id_conflict');
    assert.equal(Number((await admin.query('SELECT quantity FROM shopping.products WHERE id=$1',[queued[0].payload.id])).rows[0].quantity),1);
    const statusCommand=make('operation.status',{operation_id:queued[0].id},{aud:audience});await send(statusCommand);
    const statusResult=await result(statusCommand.id);assert.equal(statusResult.status,'found');assert.equal(statusResult.data.status,'committed');
  });
  await check('live invalid signature cannot write PostgreSQL',async()=>{
    const invalid={...make('product.create',{id:randomUUID(),category_id:category,name:'Forbidden unsigned'},{aud:audience}),signature:''};
    await send(invalid);await pause(500);
    assert.equal((await admin.query('SELECT count(*) FROM shopping.operations WHERE id=$1',[invalid.id])).rows[0].count,'0');
    assert.equal((await admin.query('SELECT count(*) FROM shopping.products WHERE id=$1',[invalid.payload.id])).rows[0].count,'0');
  });
}catch(e){status='FAIL';error={type:e.name,code:e.code};writeFileSync(`.stage0-runtime/stage2-mqtt-failure-${runId}.log`,String(e.stack),{mode:0o600});}
finally{
  await stop().catch(()=>child?.kill('SIGKILL'));await store.close();await admin.end();
  await publisher.endAsync(false,{properties:{sessionExpiryInterval:0}}).catch(()=>publisher.end(true));
  const cleanup=mqtt.connect(config.mqtt.url,{username:config.mqtt.token,clientId:testConfig.mqtt.clientId,protocolVersion:5,clean:true,properties:{sessionExpiryInterval:0},reconnectPeriod:0,rejectUnauthorized:true});cleanup.on('error',()=>{});
  await bounded(once(cleanup,'connect')).then(()=>cleanup.endAsync(false,{properties:{sessionExpiryInterval:0}})).catch(()=>cleanup.end(true));
  const report={status,run_id:runId,tested_at:new Date().toISOString(),checks,error,ready_packets:readyPackets,household,scope:'Actual PostgreSQL and dedicated live MQTT; synthetic signed identities. No Vercel/browser path.'};
  writeFileSync(`docs/stage2/attempts/mqtt-${runId}.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(status!=='PASS')process.exitCode=1;
}
