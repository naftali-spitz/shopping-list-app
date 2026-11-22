'use client';
import { useEffect, useMemo, useState } from 'react';
import { monitoringApi } from '@/integration/monitoring/browser';
import { statistics } from '@/integration/monitoring/contract.mjs';
type RecordData={id:string;source:string;mode:string;clock:string;device:string;version:string;metrics:Record<string,number>;spans:{stage:string;start_ms:number;duration_ms:number}[]};
type Operation={operation_id:string;correlation_id:string;operation_type:string;outcome:string;started_at:string;accepted_at:string;ended_at:string|null;mode:string;backend_route:string;frontend_host:string;callback_count:number;trace_completeness:string;records:RecordData[]};
type History={operations:Operation[];mode:string;health:{last_sync:string;capacity_rejections:number;rejected_records:number}};
const metric=(op:Operation,key:string)=>{const values=op.records.filter(r=>r.source==='browser').map(r=>r.metrics[key]).filter(Number.isFinite);return values.length?Math.max(...values):null;};
const ms=(n:number|null)=>n===null?'—':`${Math.round(n)} ms`;
export function PerformanceInspector({householdId,hebrew}:{householdId:string;hebrew:boolean}) {
 const text=(en:string,he:string)=>hebrew?he:en;
 const [operator,setOperator]=useState(false),[opened,setOpened]=useState(false),[mode,setMode]=useState('OFF');
 const [history,setHistory]=useState<History|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [days,setDays]=useState('1'),[from,setFrom]=useState(''),[to,setTo]=useState('');
 const [route,setRoute]=useState('flespi'),[filterMode,setFilterMode]=useState(''),[outcome,setOutcome]=useState(''),[type,setType]=useState(''),[id,setId]=useState(''),[version,setVersion]=useState(''),[threshold,setThreshold]=useState('');
 const [offset,setOffset]=useState(0),[selected,setSelected]=useState<Operation|null>(null),[chartMetric,setChartMetric]=useState('tap_saved_ms');
 useEffect(()=>{let live=true;void monitoringApi({action:'config',household_id:householdId}).then(state=>{if(live){setOperator(state.operator);setMode(state.mode);}}).catch(()=>{});return ()=>{live=false;};},[householdId]);
 async function load(page=0){
  setBusy(true);setError('');
  try{
   const data=await monitoringApi({action:'history',household_id:householdId,from:days==='custom'&&from?new Date(from).toISOString():new Date(Date.now()-Number(days==='custom'?1:days)*86400000).toISOString(),to:days==='custom'&&to?new Date(to).toISOString():new Date().toISOString(),route,...(filterMode?{mode:filterMode}:{}),...(outcome?{outcome}:{}),...(type?{type}:{}),...(id?{id}:{}),offset:page});
   setHistory(data);setMode(data.mode);setOffset(page);
  }catch(e){setError(e instanceof Error?e.message:'Unavailable');}finally{setBusy(false);}
 }
 const operations=useMemo(()=>(history?.operations??[]).filter(op=>(!version||op.records.some(r=>r.version===version))&&(!threshold||((metric(op,'tap_saved_ms')??-1)>=Number(threshold)))),[history,version,threshold]);
 const timings=statistics(operations.map(op=>metric(op,'tap_saved_ms')).filter((x):x is number=>x!==null));
 const successful=operations.filter(op=>op.outcome==='committed').length;
 const retryOperations=operations.filter(op=>op.callback_count>1||op.records.some(r=>(r.metrics.retry_count??0)>0)).length;
 const buckets=new Map<string,number[]>();for(const op of operations){const value=metric(op,chartMetric)??(chartMetric==='database_ms'?op.records.find(r=>r.source==='debian')?.metrics.database_ms:null);if(value!=null){const day=op.accepted_at.slice(0,13);buckets.set(day,[...(buckets.get(day)??[]),value]);}}
 const points=[...buckets].sort(([a],[b])=>a.localeCompare(b)).map(([time,values])=>({time,value:statistics(values).p50??0,n:values.length}));
 const maximum=Math.max(...points.map(p=>p.value),1);
 function download(format:'json'|'csv'){
  const csv=(x:unknown)=>`"${String(x??'').replaceAll('"','""')}"`;
  const body=format==='json'?JSON.stringify({schema_version:1,scope:'current filtered page, at most 200 operations',operations},null,2):[['operation_id','correlation_id','type','outcome','route','mode','started_at','tap_saved_ms'],...operations.map(op=>[op.operation_id,op.correlation_id,op.operation_type,op.outcome,op.backend_route,op.mode,op.started_at,metric(op,'tap_saved_ms')])].map(row=>row.map(csv).join(',')).join('\n');
  const url=URL.createObjectURL(new Blob([body],{type:format==='json'?'application/json':'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`futurecart-performance.${format}`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 if(!operator)return null;
 return <details className="mt-3 rounded-xl border border-current/15 p-3 text-sm" dir={hebrew?'rtl':'ltr'} onToggle={event=>{const open=event.currentTarget.open;setOpened(open);if(open&&!history)void load();}}>
  <summary className="cursor-pointer font-medium">{text('Dev Performance','ביצועים בפיתוח')} · {mode}</summary>
  {opened&&<div className="mt-3 space-y-4">
   <p>{text('Private development history · your operations only · Vercel → flespi','היסטוריית פיתוח פרטית · פעולות שלך בלבד · Vercel ← flespi')}</p>
   <label>{text('Monitoring mode','מצב ניטור')} <select aria-label="Monitoring mode" className="rounded border p-2 bg-inherit" value={mode} disabled={busy} onChange={async e=>{setBusy(true);try{const state=await monitoringApi({action:'mode',household_id:householdId,mode:e.target.value});setMode(state.mode);}catch(e){setError(String(e));}finally{setBusy(false);}}}>{['OFF','MID','ON'].map(m=><option key={m}>{m}</option>)}</select></label>
   <p className="text-xs opacity-70">{text('Mode changes are server enforced. Collectors refresh within 10 seconds. OFF rejects ingestion immediately. Missing stages stay unknown.','שינוי מצב נאכף בשרת. האוספים מתעדכנים תוך 10 שניות. OFF דוחה קליטה מיד. שלבים חסרים נשארים לא ידועים.')}</p>
   <div className="flex flex-wrap gap-2">
    <select aria-label="Date range" className="rounded border p-2 bg-inherit" value={days} onChange={e=>setDays(e.target.value)}>{[['1','24h'],['7','7 days'],['30','30 days'],['90','90 days'],['custom',text('Custom','מותאם אישית')]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
    {days==='custom'&&<><input aria-label="From" type="datetime-local" className="rounded border p-2 bg-inherit" value={from} onChange={e=>setFrom(e.target.value)}/><input aria-label="To" type="datetime-local" className="rounded border p-2 bg-inherit" value={to} onChange={e=>setTo(e.target.value)}/></>}
    <select aria-label="Route" className="rounded border p-2 bg-inherit" value={route} onChange={e=>setRoute(e.target.value)}><option value="flespi">flespi</option><option value="direct_lan">Direct LAN · {text('future / unmeasured','עתידי / טרם נמדד')}</option></select>
    <select aria-label="Recorded mode" className="rounded border p-2 bg-inherit" value={filterMode} onChange={e=>setFilterMode(e.target.value)}><option value="">{text('All recorded modes','כל מצבי הניטור')}</option><option>MID</option><option>ON</option></select>
    <select aria-label="Outcome" className="rounded border p-2 bg-inherit" value={outcome} onChange={e=>setOutcome(e.target.value)}><option value="">{text('All outcomes','כל התוצאות')}</option>{['committed','pending','version_conflict','expired','forbidden','record_id_conflict'].map(o=><option key={o}>{o}</option>)}</select>
    <input aria-label="Operation type" placeholder={text('Operation type','סוג פעולה')} className="min-w-0 rounded border p-2 bg-inherit" value={type} onChange={e=>setType(e.target.value)}/>
    <input aria-label="Operation or correlation ID" placeholder="Operation / correlation UUID" className="min-w-0 rounded border p-2 bg-inherit" value={id} onChange={e=>setId(e.target.value)}/>
    <input aria-label="Deployment version" placeholder={text('Build SHA (page filter)','גרסת פריסה (מסנן עמוד)')} className="min-w-0 rounded border p-2 bg-inherit" value={version} onChange={e=>setVersion(e.target.value)}/>
    <input aria-label="Minimum latency" type="number" min="0" placeholder={text('Minimum ms (page filter)','משך מזערי (מסנן עמוד)')} className="min-w-0 rounded border p-2 bg-inherit" value={threshold} onChange={e=>setThreshold(e.target.value)}/>
    <button className="rounded border px-3 py-2" disabled={busy} onClick={()=>void load()}>{text('Apply / refresh','סינון / רענון')}</button>
   </div>
   {error&&<p role="alert">{error}</p>}
   {route==='direct_lan'?<p>{text('Direct LAN is not implemented. No measurements are available.','תקשורת LAN ישירה טרם מומשה. אין מדידות.')}</p>:<>
    <p className="text-xs opacity-70">{text('Statistics and exports cover this page only (up to 200); n counts observed browser completions. P95 requires 100, P99 requires 1,000.','הסטטיסטיקה והייצוא מתייחסים לעמוד זה בלבד (עד 200). n סופר אישורים שנמדדו בדפדפן. P95 דורש 100, P99 דורש 1,000.')}</p>
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[[text('Operations','פעולות'),operations.length],[text('Committed','הושלמו'),successful],[text('Pending','ממתינות'),operations.filter(op=>op.outcome==='pending').length],[text('Failed / conflict','כשלו / התנגשו'),operations.length-successful-operations.filter(op=>op.outcome==='pending').length],[text('Retried operations','פעולות עם ניסיונות חוזרים'),retryOperations],[`Tap → Saved · n=${timings.n}`,ms(timings.average)],['P50',ms(timings.p50)],['P95',ms(timings.p95)],['P99',ms(timings.p99)],['Optimistic notification',ms(statistics(operations.map(op=>metric(op,'optimistic_notification_ms')).filter((x):x is number=>x!==null)).p50)]].map(([label,value])=><div key={label} className="rounded-lg bg-current/5 p-2"><dt className="text-xs opacity-70">{label}</dt><dd className="font-semibold" dir="ltr">{value}</dd></div>)}</dl>
    <div><label>{text('Hourly median trend','מגמת חציון לשעה')} <select className="rounded border p-1 bg-inherit" value={chartMetric} onChange={e=>setChartMetric(e.target.value)}>{['tap_saved_ms','optimistic_notification_ms','client_queue_ms','authentication_ms','durable_gateway_ms','mqtt_ms','database_ms','callback_ms','polling_ms'].map(key=><option key={key}>{key}</option>)}</select></label>
     <div className="mt-2 flex h-32 items-end gap-1 overflow-x-auto" dir="ltr" aria-label="Latency trend">{points.length?points.map(p=><button key={p.time} title={`${p.time}: ${ms(p.value)}, n=${p.n}`} aria-label={`${p.time}: ${ms(p.value)}, n=${p.n}`} className="min-w-8 flex-1 rounded-t bg-indigo-500" style={{height:`${Math.max(5,p.value/maximum*100)}%`}} onClick={()=>{setFrom(p.time+':00');setTo(p.time+':59');setDays('custom');}}/>):<p>{text('No measured samples','אין מדידות')}</p>}</div>
    </div>
    <div className="flex flex-wrap gap-2"><button className="rounded border p-2" onClick={()=>download('json')}>JSON</button><button className="rounded border p-2" onClick={()=>download('csv')}>CSV</button><button className="rounded border p-2" disabled={busy||offset===0} onClick={()=>void load(Math.max(0,offset-200))}>{text('Previous','הקודם')}</button><button className="rounded border p-2" disabled={busy||(history?.operations.length??0)<200} onClick={()=>void load(offset+200)}>{text('Next','הבא')}</button><span>{offset+1}–{offset+(history?.operations.length??0)}</span></div>
    <ul className="max-h-80 space-y-2 overflow-auto">{operations.map(op=><li key={op.operation_id}><button className="w-full rounded-lg border p-2 text-start" onClick={()=>setSelected(op)}><span dir="ltr">{new Date(op.accepted_at).toLocaleString()} · {op.operation_type} · {op.outcome} · {ms(metric(op,'tap_saved_ms'))} · {op.mode}</span><br/><span className="break-all text-xs">{op.operation_id}</span></button></li>)}</ul>
    {selected&&<section aria-label="Operation details" className="space-y-2 rounded-lg border p-3"><button onClick={()=>setSelected(null)}>{text('Close details','סגירת פרטים')}</button><p className="break-all" dir="ltr">Operation: {selected.operation_id}<br/>Correlation: {selected.correlation_id}<br/>{selected.frontend_host} → {selected.backend_route} · {selected.mode} · {selected.outcome}</p>
     <p>{text('Trace: partial. Unmeasured: exact network transit, gateway internals, listener queue, outbox wait, durable result write, UI paint. Local spans can overlap and must not be added as total latency.','עקבה חלקית. לא נמדדו: תעבורת רשת מדויקת, פנימיות השער, תור השרת, המתנת outbox, כתיבת התוצאה וציור הממשק. שלבים מקומיים עשויים לחפוף ואין לסכום אותם כמשך כולל.')}</p>
     <p>{text('Database confirmation','אישור בסיס נתונים')}: {selected.outcome==='committed'?'committed':'unknown / not committed'} · Callback receipts: {selected.callback_count} · Browser confirmation: {metric(selected,'tap_saved_ms')===null?'unknown':'observed'}</p>
     {selected.records.map(record=><div key={record.id} className="space-y-1 border-t pt-2"><p dir="ltr">{record.source} · {record.clock} · {record.version}</p><dl className="grid grid-cols-2 gap-1">{Object.entries(record.metrics).map(([key,value])=><div key={key}><dt className="break-all text-xs">{key}</dt><dd>{key.endsWith('_ms')?ms(value):value}</dd></div>)}</dl>
      {record.spans.map((span,i)=><div key={i} dir="ltr"><p className="text-xs">{span.stage} · {ms(span.duration_ms)}</p><div className="h-2 rounded bg-indigo-500" style={{marginInlineStart:`${Math.min(80,span.start_ms/Math.max(...record.spans.map(s=>s.start_ms+s.duration_ms),1)*100)}%`,width:`${Math.max(1,span.duration_ms/Math.max(...record.spans.map(s=>s.start_ms+s.duration_ms),1)*100)}%`}}/></div>)}</div>)}
    </section>}
   </>}
   <p className="break-words text-xs opacity-70">{text('Collection health','בריאות איסוף')}: {history?.health.last_sync??'unknown'} · Capacity rejects: {history?.health.capacity_rejections??'—'} · Missing summaries: {history?.health.rejected_records??'—'}</p>
  </div>}
 </details>;
}
