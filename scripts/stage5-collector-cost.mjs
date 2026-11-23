// Isolated actual browser-collector CPU/serialization experiment in Node, not user latency.
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import ts from 'typescript';
import {statistics} from '../integration/monitoring/contract.mjs';
let source=readFileSync('integration/monitoring/browser.ts','utf8').replace("import { supabase } from '@/lib/supabase';",'const supabase={};');
for(const name of ['buffer','contract'])source=source.replace(`'./${name}.mjs'`,JSON.stringify(new URL(`../integration/monitoring/${name}.mjs`,import.meta.url).href));
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
globalThis.window={addEventListener(){},removeEventListener(){}};Object.defineProperty(globalThis,'navigator',{value:{onLine:false,userAgent:'Synthetic desktop'}});
const {BrowserMonitoring}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const intents=Array.from({length:5000},()=>({id:randomUUID(),correlation_id:randomUUID(),household_id:randomUUID(),type:'stage4.product.update',issued_ms:Date.now()}));
const report={at:new Date().toISOString(),scope:'actual BrowserMonitoring class, Node/V8 synthetic operation lifecycle, no UI/network/database, not tap-to-Saved overhead',runs:[]};
for(const mode of ['OFF','MID','ON']){
 const c=new BrowserMonitoring(randomUUID(),randomUUID());c.flush=async()=>{};c.buffer.setMode(mode);const before=process.cpuUsage(),heap=process.memoryUsage().heapUsed;const costs=[];let serializationMs=0,bytes=0,batches=0;
 for(const [index,intent] of intents.entries()){
  const start=performance.now();c.begin(intent,start);
  for(const stage of ['client_queue','api_request','polling','client_apply'])c.stage(intent.id,stage,performance.now());
  c.metric(intent.id,'authentication_ms',500);c.metric(intent.id,'durable_gateway_ms',700);c.finish(intent,true);costs.push((performance.now()-start)*1000);
  if((index+1)%50===0){await new Promise(resolve=>setImmediate(resolve));await c.buffer.flush(async records=>{const start=performance.now();const encoded=JSON.stringify(records);serializationMs+=performance.now()-start;bytes+=Buffer.byteLength(encoded);batches++;return {persisted:true};});}
 }
 const cpu=process.cpuUsage(before);report.runs.push({mode,n:intents.length,capture_microseconds:statistics(costs),serialization_ms:serializationMs,serialized_bytes:bytes,batches,cpu_ms:(cpu.user+cpu.system)/1000,heap_delta_bytes:process.memoryUsage().heapUsed-heap,health:c.buffer.health()});c.dispose();
}
report.limitations=['Node/V8 on Debian, not Chrome main thread or physical Android.','No business transactions, browser storage or network; not a user-visible overhead percentage.','Warm-up/GC/order effects remain; heap delta is not peak memory.'];
writeFileSync('docs/stage5/attempts/collector-cost.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
