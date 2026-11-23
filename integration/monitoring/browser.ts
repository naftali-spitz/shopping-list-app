'use client';
import { supabase } from '@/lib/supabase';
import { BatchBuffer } from './buffer.mjs';
import { sanitizeRecord } from './contract.mjs';
import type { Intent } from '@/integration/stage3/client';
type Mode = 'OFF' | 'MID' | 'ON';
type Span = {stage: string; start_ms: number; duration_ms: number};
type Timing = {boundary: 'home_action_entry' | 'operation_creation'; queued?: number; mode: Mode; start: number; origin: number; spans: Span[]; metrics: Record<string, number>; version?: string; optimisticQueued?: boolean; savedQueued?: boolean; finished?: number};
export async function monitoringApi(body: Record<string, unknown>, userId?: string) {
 const {data:{session}}=await supabase.auth.getSession();
 if(!session||userId&&session.user.id!==userId)throw new Error('Sign in again.');
 const response=await fetch('/api/dev-performance',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(15000),redirect:'error'});
 if(!response.ok)throw new Error('Development monitoring is unavailable or access is denied.');return response.json();
}
/** Best-effort bounded local delivery. Only authenticated server acknowledgements remove records. */
export class BrowserMonitoring {
 private readonly sessionId=crypto.randomUUID();
 private sequence=0;
 readonly buffer = new BatchBuffer({capacity:200,batchSize:50});
 private active = new Map<string, Timing>();
 private recent = new Map<string, Timing>();
 private timer: ReturnType<typeof setInterval>;
 private busy=false;
 private disposed=false;
 private readonly key: string;
 private lastConfig=0;
 private readonly online=()=>{void this.flush();};
 private readonly pagehide=()=>this.persistPending();
 constructor(private userId:string,private householdId:string) {
  this.key=`futurecart-telemetry-v1:${userId}:${householdId}:`;
  this.timer=setInterval(()=>{void this.flush();},5000);
  window.addEventListener('online',this.online);window.addEventListener('pagehide',this.pagehide);
  // Configuration and storage work start on an independent task after client construction.
  setTimeout(()=>{void this.flush();},0);
 }
 private load() {
  // Per-record keys prevent one tab from overwriting another tab's pending delivery.
  for(let i=0;i<localStorage.length&&this.buffer.items.length<this.buffer.capacity;i++){
   const key=localStorage.key(i);if(!key?.startsWith(this.key))continue;
   try{const item=JSON.parse(localStorage.getItem(key)||'null');
    if(!item||Date.now()-item.queued_at>86400000){localStorage.removeItem(key);this.buffer.dropped++;continue;}
    if(!this.buffer.items.some((r:{id:string})=>r.id===item.record.id))this.buffer.capture(item.record);
   }catch{this.buffer.failures++;}
  }
 }
 private persistPending(records=this.buffer.items,store?:Storage){
  if(this.buffer.mode==='OFF'||!records.length)return;
  try{const target=store??localStorage;for(const record of records)try{if(!target.getItem(this.key+record.id))target.setItem(this.key+record.id,JSON.stringify({queued_at:Date.now(),record}));}catch{this.buffer.failures++;}}catch{this.buffer.failures++;}
 }
 async flush() {
  if(this.disposed||this.busy)return;this.busy=true;
  try {
   if(navigator.onLine&&Date.now()-this.lastConfig>=10000){
    const state=await monitoringApi({action:'config',household_id:this.householdId},this.userId);
    const was=this.buffer.mode;this.buffer.setMode(state.mode);this.lastConfig=Date.now();
    if(state.mode==='OFF'){
     this.active.clear();this.recent.clear();
     const keys=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith(this.key))keys.push(key);}
     for(const key of keys)localStorage.removeItem(key);
    }else if(was==='OFF')this.load();
   }
   if(this.buffer.mode==='OFF')return;
   this.load();
   // Persist once per independent flush, never per timestamp.
   this.persistPending();
   if(!navigator.onLine)return;
   await this.buffer.flush(async (records: {id:string}[])=>{
    const ack=await monitoringApi({action:'ingest',household_id:this.householdId,records},this.userId);
    if(ack.persisted)for(const record of records)localStorage.removeItem(this.key+record.id);
    return ack;
   });
  }catch{this.buffer.failures++;}finally{this.busy=false;}
 }
 begin(intent:Intent,start=performance.now(),boundary:'home_action_entry'|'operation_creation'='operation_creation'){if(this.disposed||this.buffer.mode==='OFF')return;if(this.active.size>=200){this.buffer.dropped++;return;}this.active.set(intent.id,{boundary,mode:this.buffer.mode as Mode,start,origin:performance.timeOrigin,spans:[],metrics:{retry_count:0,error_count:0,poll_count:0}});}
 stage(id:string,stage:string,start:number,end=performance.now()){
  const t=this.active.get(id);if(!t||this.buffer.mode==='OFF')return;
  t.metrics[stage+'_ms']=(t.metrics[stage+'_ms']??0)+Math.max(0,end-start);
  if(t.mode==='ON'&&this.buffer.mode==='ON'&&t.spans.length<20)t.spans.push({stage,start_ms:Math.max(0,start-t.start),duration_ms:Math.max(0,end-start)});
 }
 queued(id:string){const t=this.active.get(id);if(t)t.queued=performance.now();}
 queueWait(id:string){const t=this.active.get(id);if(t&&t.queued!==undefined)this.stage(id,'client_queue',t.queued);}
 version(id:string,value:string){const t=this.active.get(id);if(t&&/^[a-f0-9]{7,40}$/.test(value))t.version=value;}
 metric(id:string,key:string,value:number){const t=this.active.get(id);if(t&&this.buffer.mode!=='OFF')t.metrics[key]=(t.metrics[key]??0)+value;}
 count(id:string,key:string){const t=this.active.get(id);if(t)t.metrics[key]=(t.metrics[key]??0)+1;}
 finish(intent:Intent,committed:boolean,status=committed?'committed':'failed'){
  const t=this.active.get(intent.id);if(!t||this.buffer.mode==='OFF')return;this.active.delete(intent.id);
  if(committed)t.metrics[t.boundary==='home_action_entry'?'action_saved_ms':'tap_saved_ms']=performance.now()-t.start;t.finished=performance.now();this.recent.set(intent.id,t);if(this.recent.size>30)this.recent.delete(this.recent.keys().next().value!);
  try{this.buffer.capture(sanitizeRecord({id:crypto.randomUUID(),session_id:this.sessionId,sequence:++this.sequence,operation_id:intent.id,correlation_id:intent.correlation_id,mode:t.mode,browser_state:committed||status==='snapshot'?'Saved':status==='version_conflict'?'Conflict':'Failed',start_boundary:t.boundary,metrics:t.metrics,spans:t.spans,clock:'monotonic',complete:false,version:t.version,device:/Android/i.test(navigator.userAgent)?'android':'desktop'},'browser'));}catch{this.buffer.dropped++;}
 }
 rendered(intent:Intent,saved:boolean){
  const t=this.active.get(intent.id)??this.recent.get(intent.id);if(!t||this.buffer.mode==='OFF'||typeof requestAnimationFrame==='undefined'||document.hidden)return;
  if(saved?t.savedQueued:t.optimisticQueued)return;if(saved)t.savedQueued=true;else t.optimisticQueued=true;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
   if(this.disposed||this.buffer.mode==='OFF'||document.hidden)return;
   const now=performance.now();
   if(!saved){t.metrics[t.boundary==='home_action_entry'?'action_optimistic_ms':'tap_optimistic_ms']=now-t.start;this.stage(intent.id,'optimistic_frame',t.start,now);return;}
   try{this.buffer.capture(sanitizeRecord({id:crypto.randomUUID(),session_id:this.sessionId,sequence:++this.sequence,operation_id:intent.id,correlation_id:intent.correlation_id,mode:t.mode,browser_state:'Saved',start_boundary:t.boundary,version:t.version,metrics:{[t.boundary==='home_action_entry'?'action_saved_render_ms':'tap_saved_render_ms']:now-t.start,render_frame_ms:now-(t.finished??now)},spans:[{stage:'render_frame',start_ms:(t.finished??now)-t.start,duration_ms:now-(t.finished??now)}],clock:'monotonic',complete:false},'browser'));}catch{this.buffer.dropped++;}
  }));
 }
 resume(intent:Intent){
  // A refresh breaks the monotonic timeline. Never subtract performance.now across documents.
  if(!this.active.has(intent.id)&&this.buffer.mode!=='OFF')this.begin(intent);
 }
 dispose(){if(this.disposed)return;this.disposed=true;try{const records=this.buffer.items.slice(),store=localStorage;if(records.length)setTimeout(()=>this.persistPending(records,store),0);}catch{this.buffer.failures++;}clearInterval(this.timer);window.removeEventListener('online',this.online);window.removeEventListener('pagehide',this.pagehide);this.active.clear();this.recent.clear();}
}
