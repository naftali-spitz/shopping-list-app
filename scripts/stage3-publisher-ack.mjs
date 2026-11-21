import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import mqtt from 'mqtt';
import pg from '../backend/node_modules/pg/lib/index.js';
import {loadStage3Config} from '../backend/src/stage3-config.mjs';
import {gateway} from '../integration/stage3/server.mjs';
import {signCommand} from '../integration/stage3/protocol.mjs';
import {intent,api,confirmed} from './stage3-preview-check.mjs';
const config=loadStage3Config(),session=JSON.parse(readFileSync('.stage0-runtime/stage3-sessions.json'))[0];
const {households}=JSON.parse(readFileSync('.stage0-runtime/stage3-auth-state.json'));
const publisher=JSON.parse(readFileSync('.stage0-runtime/flespi-dev.json')).publisher_token;
const signer=JSON.parse(readFileSync('.stage0-runtime/stage3-vercel-keys.json'));
const op=intent(households[0],'category.create',{id:randomUUID(),name:'Publisher ACK loss proof',icon:'general'},0);
const report={id:randomUUID(),at:new Date().toISOString(),operation_id:op.id,correlation_id:op.correlation_id,scope:'controlled local publisher suppresses actual broker PUBACK; durable acceptance, real MQTT/DB/callback, hosted Preview same-ID retry. No hosted Vercel socket was manipulated.'};
let client;
try {
  const context=await config.verifyIdentity(session.access_token,households[0]);
  const command=signCommand(op,context,session.access_token,signer);await gateway({action:'accept',command},config);
  client=mqtt.connect(config.mqtt.url,{username:publisher,clientId:'naf-s3-ack-'+randomUUID(),protocolVersion:5,clean:true,properties:{sessionExpiryInterval:0},reconnectPeriod:0,connectTimeout:5000,rejectUnauthorized:true});
  client.on('error',()=>{});
  await new Promise((resolve,reject)=>{client.once('connect',resolve);client.once('error',reject);});
  assert.equal(client.stream.authorized,true);
  let dropped=false;
  // In the pinned MQTT.js handler, packetreceive is emitted before dispatch.
  // Reclassify just this owned client's ACK so its publish remains unresolved.
  client.on('packetreceive',packet=>{if(packet.cmd==='puback'){dropped=true;packet.cmd='controlled-dropped-puback';}});
  let timer;
  await assert.rejects(()=>Promise.race([client.publishAsync(config.mqtt.commands,JSON.stringify(command),{qos:1,retain:false,properties:{messageExpiryInterval:300}}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('controlled_puback_timeout')),3000);})]).finally(()=>clearTimeout(timer)),/controlled_puback_timeout/);
  assert.ok(dropped);client.end(true);
  assert.equal((await confirmed(op,session)).result.status,'committed');
  const retry=await api({action:'command',intent:op},session);assert.equal(retry.data.duplicate,true);assert.equal(retry.data.result.status,'committed');
  const db=new pg.Pool({host:'127.0.0.1',port:55439,database:'shopping_stage0',user:'stage0_owner',password:readFileSync('.stage0-runtime/admin-password','utf8').trim(),max:1});
  try {const r=(await db.query('select (select count(*)::int from shopping.operations where id=$1) as ledger,(select count(*)::int from shopping.categories where id=$2) as effect',[op.id,op.payload.id])).rows[0];assert.deepEqual(r,{ledger:1,effect:1});report.counts=r;}finally{await db.end();}
  report.broker_ack_observed_and_suppressed=true;report.hosted_same_id_retry='prior authoritative commit';report.status='PASS';
}catch(error){report.status='FAIL';report.error={type:error.name,message:'Publisher ACK loss assertion failed; credentials suppressed'};process.exitCode=1;}
finally{client?.end(true);writeFileSync(`docs/stage3/attempts/publisher-ack-${report.id}.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));}
