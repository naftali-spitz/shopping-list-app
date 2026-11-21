import assert from 'node:assert/strict';
import { readFileSync,writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { loadStage3Config } from '../src/stage3-config.mjs';
import { Store } from '../src/store.mjs';
import { gateway } from '../../integration/stage3/server.mjs';
import { signCommand,signed,CALLBACK_ISSUER,CALLBACK_AUDIENCE } from '../../integration/stage3/protocol.mjs';
const config=loadStage3Config(),store=new Store(config);
const signer=JSON.parse(readFileSync('.stage0-runtime/stage3-vercel-keys.json'));
const sessions=JSON.parse(readFileSync('.stage0-runtime/stage3-sessions.json'));
const {households}=JSON.parse(readFileSync('.stage0-runtime/stage3-auth-state.json'));
const report={id:randomUUID(),at:new Date().toISOString(),scope:'actual provider identity + signed gateway + isolated PostgreSQL; direct execution, no MQTT/Vercel/browser claim',checks:[]};
const record=name=>report.checks.push({name,status:'PASS'});
const command=async(type,payload,version,userIndex=0,h=households[0])=>{
  const now=Date.now(),token=sessions[userIndex].access_token;
  const context=await config.verifyIdentity(token,h);
  return signCommand({id:randomUUID(),household_id:h,type,payload,expected_version:version,correlation_id:randomUUID(),issued_ms:now,expires_ms:now+300000},context,token,signer);
};
const callback=r=>signed({v:2,kind:'operation-result',kid:'callback-1',iss:CALLBACK_ISSUER,aud:CALLBACK_AUDIENCE,issued_ms:Date.now(),delivery_id:randomUUID(),result:r},config.resultPrivateKey);
try {
  const category=await command('category.create',{id:randomUUID(),name:'Contract evidence',icon:'general'},0);
  const accepted=await gateway({action:'accept',command:category},config);
  assert.equal(accepted.id,category.id);record('command durable acceptance before database execution');
  const result=await store.execute(category);assert.equal(result.status,'committed');record('PostgreSQL committed authenticated operation');
  assert.equal((await gateway({action:'callback',callback:callback(result)},config)).duplicate,false);
  record('real identity executes signed v2 command and stores durable authoritative callback');
  const duplicates=await Promise.all(Array.from({length:8},()=>store.execute(category)));
  assert.ok(duplicates.every(r=>r.status==='committed'&&r.replayed));record('eight simultaneous duplicate executions return one immutable result');
  assert.equal((await gateway({action:'callback',callback:callback(result)},config)).duplicate,true);record('duplicate callback idempotent');
  await assert.rejects(()=>gateway({action:'callback',callback:callback({...result,household_id:households[1]})},config));record('signed wrong-household callback denied');
  await assert.rejects(()=>gateway({action:'callback',callback:{...callback(result),signature:'invalid'}},config));record('forged callback denied');
  const status=await gateway({action:'status',id:category.id,household_id:households[0]},config,sessions[0].access_token);
  assert.equal(status.result.status,'committed');record('authoritative durable outcome retrievable by initiating identity');
  await assert.rejects(()=>gateway({action:'status',id:category.id,household_id:households[1]},config,sessions[0].access_token));record('wrong-household status lookup denied');
  const snapshot=await command('snapshot',{},null,1);await gateway({action:'accept',command:snapshot},config);
  const snap=await store.execute(snapshot);assert.ok(snap.data.categories.some(c=>c.id===category.payload.id));
  await gateway({action:'callback',callback:callback(snap)},config);record('second real user receives consistent household snapshot');
  report.operation_id=category.id;report.correlation_id=category.correlation_id;report.status='PASS';
}catch(error){report.status='FAIL';report.error={type:error.name,code:error.code||null,message:['unauthorized','store_unavailable','operation_conflict'].includes(error.message)?error.message:'Contract assertion failed; secret-bearing diagnostics suppressed'};process.exitCode=1;}
finally{await store.close();writeFileSync(`docs/stage3/attempts/contract-${report.id}.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));}
