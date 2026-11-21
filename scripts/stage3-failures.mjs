import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,appendFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import pg from '../backend/node_modules/pg/lib/index.js';
import {api,intent,confirmed} from './stage3-preview-check.mjs';
import {publishCommand} from '../integration/stage3/server.mjs';
import {signCommand,signed,CALLBACK_ISSUER,CALLBACK_AUDIENCE} from '../integration/stage3/protocol.mjs';
import {gateway} from '../integration/stage3/server.mjs';
import {loadStage3Config} from '../backend/src/stage3-config.mjs';
const mode=process.argv[2]||'quick';assert.ok(['quick','network'].includes(mode));
await import('./stage3-refresh-sessions.mjs');
const sessions=JSON.parse(readFileSync('.stage0-runtime/stage3-sessions.json'));
const {households}=JSON.parse(readFileSync('.stage0-runtime/stage3-auth-state.json'));
const configPath='.stage0-runtime/stage3-config.json',config=JSON.parse(readFileSync(configPath));
const report={id:randomUUID(),at:new Date().toISOString(),mode,scope:'actual Vercel API, live broker, Debian PostgreSQL, authenticated callback/status; controlled owned-process/stream fault injection, no ISP/router outage',cases:[]};
const events=`docs/stage3/attempts/failure-${report.id}.jsonl`;
const record=row=>{report.cases.push(row);appendFileSync(events,JSON.stringify(row)+'\n');console.log(JSON.stringify(row));};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const health=()=>JSON.parse(readFileSync('.stage0-runtime/stage3-health.json'));
const pgPid=()=>execFileSync('systemctl',['--user','show','shopping-list-stage0-postgres.service','-p','MainPID','--value'],{encoding:'utf8'}).trim();
const initialPg=pgPid();
const db=new pg.Pool({host:'127.0.0.1',port:55439,database:'shopping_stage0',user:'stage0_owner',password:readFileSync('.stage0-runtime/admin-password','utf8').trim(),max:1});
function fault(fields,ms=45000){writeFileSync('.stage0-runtime/stage3-fault.json',JSON.stringify({...fields,until:Date.now()+ms}),{mode:0o600});}
async function count(op){return (await db.query('SELECT (SELECT count(*)::int FROM shopping.operations WHERE id=$1) AS ledger,(SELECT count(*)::int FROM shopping.categories WHERE id=$2) AS effect,(SELECT attempts FROM shopping.result_outbox WHERE operation_id=$1) AS attempts',[op.id,op.payload.id])).rows[0];}
async function waitFor(predicate,timeout=45000){const until=Date.now()+timeout;while(Date.now()<until){if(await predicate())return;await sleep(200);}throw new Error('Bounded recovery timeout');}
const operation=()=>intent(households[0],'category.create',{id:randomUUID(),name:'Fault '+randomUUID().slice(0,8),icon:'general'},0);
async function submit(op){const a=await api({action:'command',intent:op},sessions[0]);assert.equal(a.status,202,JSON.stringify(a.data));return a;}
try {
  config.faultInjectionEnabled=true;writeFileSync(configPath,JSON.stringify(config),{mode:0o600});
  execFileSync('python3',['scripts/stage3-service.py','restart'],{stdio:['ignore','pipe','pipe']});
  if(mode==='quick') {
    const live=loadStage3Config(),signer=JSON.parse(readFileSync('.stage0-runtime/stage3-vercel-keys.json'));
    const badCredentialOperation=operation(),ctx=await live.verifyIdentity(sessions[0].access_token,households[0]);
    const c=signCommand(badCredentialOperation,ctx,sessions[0].access_token,signer);
    await assert.rejects(()=>publishCommand(c,{publisherToken:'invalid-development-token',topic:live.mqtt.commands}));
    assert.deepEqual((({ledger,effect})=>({ledger,effect}))(await count(badCredentialOperation)),{ledger:0,effect:0});
    record({name:'incorrect MQTT publisher credentials',status:'PASS',operation_id:badCredentialOperation.id,effect:0,classification:'actual broker authentication denial'});
    const dup=operation();const both=await Promise.all([api({action:'command',intent:dup},sessions[0]),api({action:'command',intent:dup},sessions[0])]);assert.ok(both.every(r=>[200,202].includes(r.status)));
    assert.equal((await confirmed(dup,sessions[0])).result.status,'committed');assert.equal((await count(dup)).effect,1);assert.equal((await count(dup)).ledger,1);
    record({name:'simultaneous duplicate API requests',status:'PASS',operation_id:dup.id,...await count(dup)});
    for(const [name,field] of [['lost MQTT acknowledgment','lostAckId'],['listener crash before commit','crashBeforeCommitId'],['listener crash after commit before callback','crashAfterCommitId'],['failed database transaction then safe retry','failTransactionId']]) {
      const op=operation(),before=health().pid;fault({[field]:op.id});const start=Date.now();await submit(op);
      const observed=[];const result=await confirmed(op,sessions[0],90000,observed);assert.equal(result.result.status,'committed');const counters=await count(op);assert.equal(counters.effect,1);assert.equal(counters.ledger,1);
      if(field.startsWith('crash'))assert.notEqual(health().pid,before);
      record({name,status:'PASS',operation_id:op.id,correlation_id:op.correlation_id,recovery_confirmation_ms:Date.now()-start,observed_states:[...new Set(observed)],...counters,classification:'controlled dedicated listener fault'});fault({});
    }
    const op=operation();fault({callbackOffline:true},22000);await submit(op);
    await waitFor(async()=>(await count(op)).ledger===1);
    const pending=await api({action:'status',id:op.id,household_id:op.household_id},sessions[0]);assert.equal(pending.data.result,null);
    assert.equal(pending.data.state,'processing');
    const progress=signed({v:2,kind:'operation-progress',kid:'callback-1',iss:CALLBACK_ISSUER,aud:CALLBACK_AUDIENCE,issued_ms:pending.data.progress_issued_ms-1,delivery_id:randomUUID(),operation_id:op.id,user_id:ctx.user_id,household_id:op.household_id,correlation_id:op.correlation_id,state:'failed_retryable'},live.resultPrivateKey);
    await gateway({action:'progress',progress},live);
    assert.equal((await api({action:'status',id:op.id,household_id:op.household_id},sessions[0])).data.state,'processing');
    const r=await confirmed(op,sessions[0]);assert.equal(r.result.status,'committed');assert.ok((await count(op)).attempts>1);
    record({name:'callback unavailable after database commit',status:'PASS',operation_id:op.id,durable_processing:true,older_progress_ignored:true,...await count(op),classification:'controlled outbound callback delivery refusal for22s; endpoint itself not taken down'});
    const expired=operation();expired.expires_ms=expired.issued_ms+15000;fault({mqttOffline:true,callbackOffline:true},22000);
    await waitFor(()=>!health().connected);await submit(expired);
    const outcome=await confirmed(expired,sessions[0],60000);assert.equal(outcome.result.status,'expired');assert.equal((await count(expired)).effect,0);
    record({name:'expired command cannot mutate database',status:'PASS',operation_id:expired.id,...await count(expired),classification:'controlled owned-stream interruption; real application deadline'});fault({});
  } else {
    for(const seconds of [5,60,290,480]) {
      fault({mqttOffline:true,callbackOffline:true},seconds*1000);
      await waitFor(()=>!health().connected);const started=Date.now(),early=operation();await submit(early);
      const pending=await api({action:'status',id:early.id,household_id:early.household_id},sessions[0]);assert.equal(pending.data.result,null);assert.equal((await count(early)).effect,0);
      let late;
      if(seconds===480){await sleep(Math.max(0,seconds*1000-15000-(Date.now()-started)));late=operation();await submit(late);}
      await sleep(Math.max(0,seconds*1000-(Date.now()-started)));
      const restored=Date.now(),result=await confirmed(early,sessions[0],90000),expected=seconds<300?'committed':'expired';
      assert.equal(result.result.status,expected);assert.equal((await count(early)).effect,seconds<300?1:0);
      if(late)assert.equal((await confirmed(late,sessions[0])).result.status,'committed');
      const control=operation();await submit(control);assert.equal((await confirmed(control,sessions[0])).result.status,'committed');
      record({name:`${seconds}s interruption`,status:'PASS',requested_seconds:seconds,measured_until_confirmation_ms:Date.now()-started,recovery_from_unblock_ms:Date.now()-restored,early_operation_id:early.id,early_status:result.result.status,early_effect:(await count(early)).effect,late_operation_id:late?.id,late_status:late?'committed':null,fresh_control:'committed',classification:'controlled owned MQTT TLS stream refusal plus paused HTTPS reconciliation/callback; real live broker and database, not ISP/router fault'});
      fault({});
    }
  }
  assert.equal(pgPid(),initialPg);report.postgres_pid_unchanged=true;report.status='PASS';
}catch(error){report.status='FAIL';report.error={type:error.name,message:error.message.slice(0,1000)};process.exitCode=1;}
finally {
  fault({});config.faultInjectionEnabled=false;writeFileSync(configPath,JSON.stringify(config),{mode:0o600});
  try{execFileSync('python3',['scripts/stage3-service.py','restart'],{stdio:['ignore','pipe','pipe']});}catch{report.cleanup_error='Dedicated service restart failed';report.status='FAIL';process.exitCode=1;}
  await db.end();writeFileSync(`docs/stage3/attempts/failure-${report.id}.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));
}
