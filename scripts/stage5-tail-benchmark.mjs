// Balanced crossover: 100 actual UI operations per mode, two 50-operation cohorts.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync,spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {statistics} from '../integration/monitoring/contract.mjs';
const source=process.env.STAGE5_EXPECT_SHA||'4dd003e1ac2fb31813eb298c418c04eb5910e361';assert.match(source,/^[a-f0-9]{40}$/);
const report={id:randomUUID(),at:new Date().toISOString(),source,scope:'same actual UI workload, balanced OFF/MID/ON/ON/MID/OFF crossover, 50 operations/cohort; no faults or concurrent tests; n=100/mode minimum for mixed-workload P95, no P99',order:['OFF','MID','ON','ON','MID','OFF'],runs:[]};
const folder='docs/stage5/attempts/tail-'+report.id;mkdirSync(folder,{recursive:true});
function save(){writeFileSync(folder+'/report.json',JSON.stringify(report,null,2)+'\n');}
async function mode(value){const s=JSON.parse(readFileSync('.stage0-runtime/stage3-sessions.json'))[0],v=JSON.parse(readFileSync('.stage0-runtime/vercel-dev-input.json')).variables;assert.equal(v.NEXT_PUBLIC_SUPABASE_URL,'https://njomxqthjglqesxchlbm.supabase.co');const r=await fetch(v.NEXT_PUBLIC_SUPABASE_URL+'/functions/v1/shopping-dev-monitoring',{method:'POST',headers:{apikey:v.NEXT_PUBLIC_SUPABASE_ANON_KEY,Authorization:'Bearer '+s.access_token,'Content-Type':'application/json'},body:JSON.stringify({action:'mode',mode:value,household_id:s.user.id}),signal:AbortSignal.timeout(20000)});assert.ok(r.ok,'Mode change authorized');}
function resources(){return Object.fromEntries(execFileSync('systemctl',['--user','show','shopping-list-stage3-backend.service','-p','CPUUsageNSec','-p','MemoryCurrent'],{encoding:'utf8'}).trim().split('\n').map(s=>s.split('=')));}
try{
 assert.notEqual(JSON.parse(readFileSync('.stage0-runtime/stage3-config.json')).faultInjectionEnabled,true);
 for(const [index,m] of report.order.entries()){
  execFileSync(process.execPath,['scripts/stage3-refresh-sessions.mjs'],{stdio:['ignore','ignore','pipe']});await mode(m);await new Promise(r=>setTimeout(r,11000));const before=resources(),start=Date.now();
  console.log(JSON.stringify({phase:'cohort_started',cohort:index+1,mode:m}));
  await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['scripts/stage4-performance.mjs',`stage5-tail-${index+1}-${m}`],{env:{...process.env,STAGE4_PERF_SAMPLES:'12',STAGE5_EXPECT_SHA:source},stdio:['ignore','pipe','pipe']});let out='';child.stdout.on('data',s=>out+=s);child.stderr.on('data',()=>{});child.on('error',reject);child.on('close',code=>{if(code!==0)return reject(new Error('Cohort failed; raw Stage4-format report retained. No failed/slow samples excluded.'));const info=JSON.parse(out.trim().split('\n').at(-1));const raw=JSON.parse(readFileSync(info.folder+'/report.json'));assert.equal(raw.samples.length,50);report.runs.push({mode:m,cohort:index+1,folder:info.folder,elapsed_ms:Date.now()-start,resources_before:before,resources_after:resources(),...raw});save();console.log(JSON.stringify({phase:'cohort_finished',cohort:index+1,mode:m,n:raw.samples.length}));resolve();});});
 }
 report.comparison=['OFF','MID','ON'].map(m=>{const runs=report.runs.filter(r=>r.mode===m),samples=runs.flatMap(r=>r.samples);return {mode:m,n:samples.length,saved:statistics(samples.map(s=>s.tap_to_saved_ms)),feedback:statistics(samples.map(s=>s.tap_to_visible_feedback_ms)),outcome:'all measured operations committed; raw attempts retained',by_operation:Object.fromEntries([...new Set(samples.map(s=>s.kind))].map(kind=>[kind,statistics(samples.filter(s=>s.kind===kind).map(s=>s.tap_to_saved_ms))]))};});
 report.status='PASS';report.limitations=['Two cohorts per mode do not establish a causal 2% budget or general capacity.','P95 applies to this predefined mixed-operation workload, not individual operation types or the general population.','Cold function state, network/provider conditions, order, memory growth and V8 warm-up are uncontrolled.','Chrome metrics and listener counters are document/process wide; HTTP sizes omit MQTT/callback/TLS and no peak memory is claimed.'];
}catch(error){report.status='FAIL';report.error=error.message;process.exitCode=1;}
finally{await mode('MID').catch(()=>{});save();console.log(JSON.stringify({folder,status:report.status,cohorts:report.runs.length,error:report.error}));}
