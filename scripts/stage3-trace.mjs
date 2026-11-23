import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {api,intent,confirmed,PREVIEW} from './stage3-preview-check.mjs';
const session=JSON.parse(readFileSync('.stage0-runtime/stage3-sessions.json'))[0];
const {households}=JSON.parse(readFileSync('.stage0-runtime/stage3-auth-state.json'));
const op=intent(households[0],'category.create',{id:randomUUID(),name:'Trace proof',icon:'general'},0);
const report={id:randomUUID(),at:new Date().toISOString(),operation_id:op.id,correlation_id:op.correlation_id,scope:'actual Vercel API/MQTT/PostgreSQL/callback trace and client status confirmation; browser paint latency is separate'};
const allowed=new Set(['event','at','operation_id','correlation_id','published_at_ms','received_ms','acceptance_ms','transport','duplicate','delivery_ms','authentication_ms','database_ms','mqtt_duplicate','remaining_message_expiry_seconds','attempt','age_since_result_ms','status','replayed','command_age_ms']);
function collect(raw) {
  const records=[];
  function visit(value,depth=0) {
    if(depth>8||value===null)return;
    if(typeof value==='string'){for(const line of value.split('\n'))try{visit(JSON.parse(line),depth+1);}catch{}return;}
    if(typeof value!=='object')return;
    if(value.operation_id===op.id && typeof value.event==='string')records.push(Object.fromEntries(Object.entries(value).filter(([k,v])=>allowed.has(k)&&['string','number','boolean'].includes(typeof v))));
    for(const v of Object.values(value))visit(v,depth+1);
  }
  for(const line of raw.split('\n'))try{visit(JSON.parse(line));}catch{}
  return [...new Map(records.map(r=>[JSON.stringify(r),r])).values()];
}
try {
  const start=Date.now(),accepted=await api({action:'command',intent:op},session);assert.equal(accepted.status,202);assert.equal(accepted.data.transport,'puback');report.api_acceptance_ms=Date.now()-start;
  assert.equal((await confirmed(op,session)).result.status,'committed');report.client_status_confirmation_ms=Date.now()-start;
  await new Promise(resolve=>setTimeout(resolve,5000));
  const local=execFileSync('journalctl',['--user','-u','shopping-list-stage3-backend.service','--since','10 minutes ago','--no-pager','-o','cat'],{encoding:'utf8',maxBuffer:2000000});
  const remote=execFileSync('/home/naf-w/.local/share/shopping-list-tools/node_modules/.bin/vercel',['logs','--deployment',PREVIEW,'--environment','preview','--project','prj_jsqk7AsPGuxLmvWqYEsqyFClV1cM','--scope','0012ab-5576s-projects','--since','10m','--limit','100','--query',op.id,'--json','--non-interactive'],{encoding:'utf8',timeout:30000,maxBuffer:2000000,stdio:['ignore','pipe','pipe']});
  report.debian_events=collect(local);report.vercel_events=collect(remote);
  // Credential-bearing provider diagnostics are never written to evidence.
  if(!report.vercel_events.length)writeFileSync('.stage0-runtime/stage3-trace-diagnostic.log',remote,{mode:0o600});
  assert.ok(report.vercel_events.some(r=>r.event==='stage3_accepted'));
  assert.ok(report.vercel_events.some(r=>r.event==='stage3_callback'));
  const send=report.vercel_events.find(r=>r.event==='stage3_publish'),receive=report.debian_events.find(r=>r.event==='stage3_received');
  assert.ok(send&&receive);report.observed_mqtt_transit_ms=receive.received_ms-send.published_at_ms;
  report.transit_clock_limit='Cross-host wall-clock delta, not a sub-millisecond latency claim. Database and local outbox durations use monotonic local timing.';
  assert.ok(report.debian_events.some(r=>r.event==='stage3_database_trace'));
  assert.ok(report.debian_events.some(r=>r.event==='operation_result'&&r.status==='committed'));
  report.status='PASS';
}catch(error){report.status='FAIL';report.error={type:error.name,message:'Trace or confirmation evidence check failed; provider diagnostics suppressed'};process.exitCode=1;}
finally{writeFileSync(`docs/stage3/attempts/trace-${report.id}.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));}
