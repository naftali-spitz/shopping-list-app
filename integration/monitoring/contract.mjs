// Deliberately closed vocabulary: arbitrary labels, error messages and payloads cannot enter storage.
export const MODES=['OFF','MID','ON'];
export const STAGES=['optimistic_notification','client_queue','api_request','authentication','durable_gateway','mqtt','listener_authentication','database','callback','polling','reconciliation','saved_notification','render_frame'];
export function sanitizeRecord(r,source) {
  const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(x);
  const number=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=90*86400000;
  if(!r||!uuid(r.id)||!uuid(r.operation_id)||!uuid(r.correlation_id)||!['browser','debian'].includes(source)||!['MID','ON'].includes(r.mode))throw new Error('invalid_record');
  const metrics={};
  for(const [key,value] of Object.entries(r.metrics??{}))if([...STAGES.map(s=>s+'_ms'),'tap_saved_ms','retry_count','error_count','poll_count','long_task_ms','long_task_count'].includes(key)&&number(value))metrics[key]=Math.round(value*100)/100;
  const spans=[];
  if(r.mode==='ON')for(const span of (Array.isArray(r.spans)?r.spans:[]).slice(0,20)) {
    if(!STAGES.includes(span.stage)||!number(span.start_ms)||!number(span.duration_ms))throw new Error('invalid_span');
    spans.push({stage:span.stage,start_ms:span.start_ms,duration_ms:span.duration_ms});
  }
  return {id:r.id,operation_id:r.operation_id,correlation_id:r.correlation_id,mode:r.mode,source,metrics,spans,
    clock:r.clock==='monotonic'?'monotonic':'wall_estimate',complete:r.complete===true,
    version:typeof r.version==='string'&&/^[a-f0-9]{7,40}$/.test(r.version)?r.version:'unknown',
    device:['desktop','android','other'].includes(r.device)?r.device:'other',schema_version:1};
}
export function statistics(values) {
  const a=values.filter(Number.isFinite).sort((x,y)=>x-y),n=a.length;
  const percentile=p=>a[Math.max(0,Math.ceil(n*p)-1)];
  return {n,average:n?a.reduce((s,x)=>s+x,0)/n:null,p50:n?percentile(.5):null,p95:n>=100?percentile(.95):null,p99:n>=1000?percentile(.99):null};
}
