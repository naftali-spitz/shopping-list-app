// Sequential actual-UI monitoring overhead cohort, not a capacity/soak benchmark.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync,spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {DEV_SUPABASE} from '../integration/stage3/identity.mjs';
import {statistics} from '../integration/monitoring/contract.mjs';
const {variables}=JSON.parse(readFileSync('.stage0-runtime/vercel-dev-input.json'));
assert.equal(variables.NEXT_PUBLIC_SUPABASE_URL,DEV_SUPABASE);
const session=JSON.parse(readFileSync('.stage0-runtime/stage3-sessions.json'))[0];
const {households}=JSON.parse(readFileSync('.stage0-runtime/stage3-auth-state.json'));
const report={id:randomUUID(),at:new Date().toISOString(),scope:'same real root UI workload, sequential OFF/MID/ON cohorts, synthetic households, no faults, no production',runs:[]};
async function mode(value){const r=await fetch(DEV_SUPABASE+'/functions/v1/shopping-dev-monitoring',{method:'POST',headers:{apikey:variables.NEXT_PUBLIC_SUPABASE_ANON_KEY,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({action:'mode',mode:value,household_id:households[0]}),signal:AbortSignal.timeout(20000)});assert.ok(r.ok);}
function resources(){return Object.fromEntries(execFileSync('systemctl',['--user','show','shopping-list-stage3-backend.service','-p','CPUUsageNSec','-p','MemoryCurrent'],{encoding:'utf8'}).trim().split('\n').map(s=>s.split('=')));}
try{
 for(const m of ['OFF','MID','ON']){
  await mode(m);await new Promise(r=>setTimeout(r,11000));
  const before=resources(),started=Date.now();
  await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['scripts/stage4-performance.mjs','stage5-monitoring-'+m],{env:{...process.env,STAGE4_PERF_SAMPLES:'3',STAGE5_EXPECT_SHA:process.env.STAGE5_EXPECT_SHA||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()},stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',s=>{output+=s;});child.stderr.on('data',()=>{});child.on('close',code=>{if(code===0){const info=JSON.parse(output.trim().split('\n').at(-1));report.runs.push({mode:m,folder:info.folder,elapsed_ms:Date.now()-started,resources_before:before,resources_after:resources(),...JSON.parse(readFileSync(info.folder+'/report.json'))});resolve();}else reject(new Error('Actual UI benchmark failed; inspect retained Stage4 attempt reports.'));});});
 }
 report.comparison=report.runs.map(run=>({mode:run.mode,by_operation:run.summary,all_saved:statistics(run.samples.map(s=>s.tap_to_saved_ms)),all_feedback:statistics(run.samples.map(s=>s.tap_to_visible_feedback_ms))}));
 report.limitations=['Small sequential cohorts, network/time effects uncontrolled. No P95/P99 or <2% conclusion.','Listener resource counters are process-wide and include normal reconciliation; no per-operation CPU attribution.','CDP CPU/task/heap and long tasks are document-wide; no per-operation CPU attribution or physical device/concurrent-user benchmark. Network sizes cover completed browser API requests, not MQTT/callback traffic. Database write volume needs separate history inspection.'];report.status='PASS';
}catch(error){report.status='FAIL';report.error=error.message;process.exitCode=1;}
finally{await mode('MID').catch(()=>{});mkdirSync('docs/stage5/attempts',{recursive:true});writeFileSync(`docs/stage5/attempts/overhead-${report.id}.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({id:report.id,status:report.status,runs:report.runs.map(r=>({mode:r.mode,folder:r.folder})),error:report.error}));}
