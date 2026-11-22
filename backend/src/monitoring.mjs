import { randomUUID } from 'node:crypto';
import { BatchBuffer } from '../../integration/monitoring/buffer.mjs';
import { sanitizeRecord } from '../../integration/monitoring/contract.mjs';
import { signed,CALLBACK_ISSUER,CALLBACK_AUDIENCE } from '../../integration/stage3/protocol.mjs';
import { DEV_SUPABASE } from '../../integration/stage3/identity.mjs';
/** Separate timer, bounded memory, no awaited telemetry in the shopping path. */
export function startMonitoring(config,{fetcher=fetch,interval=5000}={}) {
 const buffer=new BatchBuffer();let stopped=false,busy=false,lastCleanup=0;
 async function send(action,records=[]) {
  const envelope=signed({v:1,kind:'monitoring-batch',kid:config.resultKid??'callback-1',iss:CALLBACK_ISSUER,aud:CALLBACK_AUDIENCE,id:randomUUID(),issued_ms:Date.now(),action,records},config.resultPrivateKey);
  const r=await fetcher(DEV_SUPABASE+'/functions/v1/shopping-dev-monitoring',{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({action:'signed',envelope}),signal:AbortSignal.timeout(12000),redirect:'error'});
  if(!r.ok)throw new Error('monitoring_unavailable');return r.json();
 }
 async function tick(){
  if(stopped||busy)return;busy=true;
  try {
   const state=await send('sync');buffer.setMode(state.mode);
   await buffer.flush(records=>send('ingest',records));
   if(state.mode!=='OFF'&&Date.now()-lastCleanup>3600000){await send('cleanup');lastCleanup=Date.now();}
  }catch{buffer.failures++;}finally{busy=false;}
 }
 const timer=setInterval(tick,interval);timer.unref?.();void tick();
 return {buffer,capture(command,metrics,spans=[]) {
  if(buffer.mode==='OFF'||['snapshot','operation.status','stage4.snapshot','stage4.operation.status'].includes(command.type))return;
  try{buffer.capture(sanitizeRecord({id:randomUUID(),operation_id:command.id,correlation_id:command.correlation_id,mode:buffer.mode,metrics,spans,clock:'monotonic',complete:false},'debian'));}catch{buffer.dropped++;}
 },stop(){stopped=true;clearInterval(timer);},health:()=>buffer.health()};
}
