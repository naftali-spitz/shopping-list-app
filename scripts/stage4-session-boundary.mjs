// Current-provider-session boundary using only a dedicated freshly created
// session of an existing Dev account. Never resets credentials or global sessions.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import pg from '../backend/node_modules/pg/lib/index.js';
import {loadStage3Config} from '../backend/src/stage3-config.mjs';
import {Store} from '../backend/src/store.mjs';
import {signCommand} from '../integration/stage3/protocol.mjs';
import {gateway} from '../integration/stage3/server.mjs';
import {DEV_SUPABASE} from '../integration/stage3/identity.mjs';
import {api,intent} from './stage3-preview-check.mjs';
execFileSync(process.execPath,['scripts/stage0-preflight.mjs'],{stdio:['ignore','pipe','pipe']});
const mode=process.argv[2];assert.ok(['logout','arm-expiry','check-expiry'].includes(mode));
const config=loadStage3Config(),signer=JSON.parse(readFileSync('.stage0-runtime/stage3-vercel-config.json')).signer;
const account=JSON.parse(readFileSync('.stage0-runtime/stage3-accounts.json'))[2];
const statePath='.stage0-runtime/stage4-session-boundary.json';
const report={id:randomUUID(),at:new Date().toISOString(),mode,scope:'dedicated current Dev provider session for existing account; no global logout, reset or production write',checks:[]};
const out='docs/stage4/attempts/session-boundary-'+report.id;mkdirSync(out,{recursive:true});
const store=new Store(config);const db=new pg.Pool({host:'127.0.0.1',port:55439,database:'shopping_stage0',user:'stage0_owner',password:readFileSync('.stage0-runtime/admin-password','utf8').trim(),max:1});
const record=(name,data={})=>report.checks.push({name,status:'PASS',...data});
async function login(){const r=await fetch(DEV_SUPABASE+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({email:account.email,password:account.password}),redirect:'error',signal:AbortSignal.timeout(10000)});assert.ok(r.ok);const s=await r.json();assert.equal(s.user.id,account.id);return s;}
async function deny(state){
 assert.ok(state.command.expires_ms>Date.now(),'Intent deadline must remain valid to isolate session denial');
 assert.ok(state.session.expires_at>Math.floor(Date.now()/1000),'Access token must not have naturally expired');
 await assert.rejects(()=>config.verifyIdentity(state.session.access_token,state.command.household_id,state.command.type));record('current session RPC rejects still-signed provider token');
 await assert.rejects(()=>store.execute(state.command));record('previously signed pending intent cannot execute after session invalidation');
 await assert.rejects(()=>gateway({action:'accept',command:state.command},config));record('durable gateway refuses new acceptance for invalidated session');
 const r=await api({action:'command',intent:state.intent},state.session);assert.equal(r.status,401);record('actual protected Vercel API rejects invalidated session',{http:r.status});
 const counts=(await db.query('SELECT (SELECT count(*)::int FROM shopping.households WHERE id=$1) AS households,(SELECT count(*)::int FROM shopping.operations WHERE id=$2) AS operations,(SELECT count(*)::int FROM shopping.result_outbox WHERE operation_id=$2) AS outbox',[state.command.household_id,state.command.id])).rows[0];assert.deepEqual(counts,{households:0,operations:0,outbox:0});record('invalidated-session request leaves zero PostgreSQL business/journal/outbox effects',{operation_id:state.command.id,correlation_id:state.command.correlation_id,counts});
}
try {
 if(mode==='check-expiry'){
  const state=JSON.parse(readFileSync(statePath));assert.equal(state.session.user.id,account.id);assert.ok(state.created_at_ms>Date.now()-240000,'Only fresh dedicated expiry state is accepted');
  await deny(state);report.session_id=state.session_id;report.controlled_expiry='Dedicated auth.sessions.not_after was advanced by exact ID+user in Dev only; no access token mutation.';
 }else{
  const session=await login(),i=intent(randomUUID(),'stage4.household.create',{name:'Session boundary '+report.id.slice(0,8)},0),ctx=await config.verifyIdentity(session.access_token,i.household_id,i.type),command=signCommand(i,ctx,session.access_token,signer);
  record('existing account fresh dedicated session verified before boundary',{session_id:ctx.session_id});
  const state={session,intent:i,command,session_id:ctx.session_id,created_at_ms:Date.now()};
  if(mode==='arm-expiry'){
   writeFileSync(statePath,JSON.stringify(state),{mode:0o600});report.session_id=ctx.session_id;report.user_id=account.id;report.arm='private pending intent prepared; no gateway acceptance or business write';
  }else{
   const r=await fetch(DEV_SUPABASE+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:config.publishableKey,Authorization:'Bearer '+session.access_token},redirect:'error',signal:AbortSignal.timeout(10000)});assert.ok(r.ok);record('only dedicated test session logged out with scope local');await deny(state);
  }
 }
 report.status='PASS';
}catch(error){report.status='FAIL';report.error={type:error.name,message:'Dedicated development session-boundary assertion failed; credential diagnostics suppressed'};process.exitCode=1;}
finally{await store.close();await db.end();writeFileSync(out+'/report.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));}
