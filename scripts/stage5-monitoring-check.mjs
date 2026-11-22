// Real Dev Edge boundary tests. No faults or business payloads in reports.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {DEV_SUPABASE} from '../integration/stage3/identity.mjs';
const sessions=JSON.parse(readFileSync('.stage0-runtime/stage3-sessions.json'));
const {variables}=JSON.parse(readFileSync('.stage0-runtime/vercel-dev-input.json'));assert.equal(variables.NEXT_PUBLIC_SUPABASE_URL,DEV_SUPABASE);
const {households}=JSON.parse(readFileSync('.stage0-runtime/stage3-auth-state.json'));
const report={id:randomUUID(),at:new Date().toISOString(),scope:'FutureCart Dev monitoring Edge endpoint, real current provider sessions, no production requests',checks:[]};
async function call(body,session=sessions[0]){const r=await fetch(DEV_SUPABASE+'/functions/v1/shopping-dev-monitoring',{method:'POST',headers:{apikey:variables.NEXT_PUBLIC_SUPABASE_ANON_KEY,'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.access_token}:{})},body:JSON.stringify({household_id:households[0],...body}),signal:AbortSignal.timeout(20000)});return {status:r.status,body:await r.json()};}
try {
 const state=await call({action:'config'});assert.equal(state.status,200);assert.equal(state.body.operator,true);report.checks.push('current session + configured operator accepted');
 assert.equal((await call({action:'config'},null)).status,403);report.checks.push('missing session denied');
 assert.equal((await call({action:'mode',mode:'OFF'},sessions[2])).status,503);report.checks.push('non-operator control denied (generic RPC failure, no change)');
 for(const mode of ['OFF','MID','ON','MID']){const change=await call({action:'mode',mode});assert.equal(change.status,200);assert.equal((await call({action:'config'})).body.mode,mode);}report.checks.push('OFF/MID/ON changes persisted without redeployment; restored MID');
 const other=await call({action:'history',household_id:randomUUID()});assert.equal(other.status,200);assert.deepEqual(other.body.operations,[]);report.checks.push('different household query empty');
 const forged=await call({action:'signed',envelope:{}});assert.equal(forged.status,403);report.checks.push('forged Debian telemetry rejected');
 report.status='PASS';
}catch(error){report.status='FAIL';report.error={name:error.name,message:error.message};process.exitCode=1;}
finally{mkdirSync('docs/stage5/attempts',{recursive:true});writeFileSync(`docs/stage5/attempts/edge-${report.id}.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
