import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {gateway} from '../integration/stage3/server.mjs';
import {signed,CALLBACK_ISSUER,CALLBACK_AUDIENCE} from '../integration/stage3/protocol.mjs';
import {loadStage3Config} from '../backend/src/stage3-config.mjs';
import {api} from './stage3-preview-check.mjs';
const config=loadStage3Config(),session=JSON.parse(readFileSync('.stage0-runtime/stage3-sessions.json'))[0];
const {households}=JSON.parse(readFileSync('.stage0-runtime/stage3-auth-state.json'));
const op='860fa6b5-f3db-49bf-a100-9e2fc6c98100';
const report={id:randomUUID(),at:new Date().toISOString(),scope:'actual protected Preview callback and durable metadata adapter; existing committed result only',checks:[]};
const record=name=>report.checks.push({name,status:'PASS'});
try {
  const original=await gateway({action:'status',id:op,household_id:households[0]},config,session.access_token);
  assert.equal(original.result.status,'committed');
  const body={v:2,kind:'operation-result',kid:'callback-1',iss:CALLBACK_ISSUER,aud:CALLBACK_AUDIENCE,issued_ms:Date.now(),delivery_id:randomUUID(),result:original.result};
  const duplicate=await api({action:'callback',callback:signed(body,config.resultPrivateKey)},session);
  assert.equal(duplicate.status,200);assert.equal(duplicate.data.duplicate,true);record('duplicate callback through actual Preview remains idempotent');
  await assert.rejects(()=>gateway({action:'callback',callback:signed({...body,result:{...body.result,status:'forbidden'}},config.resultPrivateKey)},config));
  record('later conflicting signed terminal result cannot overwrite committed result');
  const stale=await api({action:'callback',callback:signed({...body,issued_ms:Date.now()-61000},config.resultPrivateKey)},session);assert.ok(stale.status>=400);record('actual Preview rejects stale signed callback');
  const forged=await api({action:'callback',callback:{...signed(body,config.resultPrivateKey),signature:'forged'}},session);assert.ok(forged.status>=400);record('actual Preview rejects forged callback');
  const after=await gateway({action:'status',id:op,household_id:households[0]},config,session.access_token);assert.deepEqual(after.result,original.result);record('authoritative committed result unchanged after duplicate, stale and conflicting attempts');report.status='PASS';
}catch(error){report.status='FAIL';report.error={type:error.name,message:'Callback security assertion failed'};process.exitCode=1;}
finally{writeFileSync(`docs/stage3/attempts/callback-${report.id}.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));}
