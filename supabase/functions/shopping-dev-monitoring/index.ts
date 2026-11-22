import { verifyDevelopmentIdentity, DEV_SUPABASE } from '../../../integration/stage3/identity.mjs';
import { sanitizeRecord } from '../../../integration/monitoring/contract.mjs';
import { verifyMonitoring } from '../../../integration/monitoring/signature.mjs';
const keys={'callback-1':'-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAGX+fRSih6snwRf7CMu7uVmfiHzoUz/S8Ghb2ugRS/Ss=\n-----END PUBLIC KEY-----\n'};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
Deno.serve(async req=>{
 if(Deno.env.get('SUPABASE_URL')!==DEV_SUPABASE||req.method!=='POST')return json({error:'disabled'},404);
 try {
  let size=0;const chunks:Uint8Array[]=[];const reader=req.body?.getReader();if(!reader)throw new Error();
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>128000){await reader.cancel();return json({error:'too_large'},413);}chunks.push(value);}
  const body=JSON.parse(new TextDecoder().decode(new Uint8Array(chunks.flatMap(c=>Array.from(c)))));
  const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  async function rpc(action:string,actor:string|null,data:unknown={}) {
   const path=action==='cleanup'?'stage5_monitoring_cleanup_service':action==='analytics'?'stage5_monitoring_analytics_service':'stage5_monitoring_service';
   const response=await fetch(DEV_SUPABASE+'/rest/v1/rpc/'+path,{method:'POST',headers:{apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify(action==='cleanup'?{}:action==='analytics'?{p_actor:actor,p_body:data}:{p_action:action,p_actor:actor,p_body:data}),signal:AbortSignal.timeout(10000)});
   if(!response.ok){const failure=await response.json();throw new Error(failure.code==='42501'?'denied':'monitoring_unavailable');}return response.json();
  }
  if(body.action==='signed') {
   const envelope=verifyMonitoring(body.envelope,keys);
   if(!['config','sync','ingest','cleanup'].includes(envelope.action))throw new Error();
   if(envelope.action==='ingest')return json(await rpc('ingest',null,{records:envelope.records.map((r:unknown)=>sanitizeRecord(r,'debian'))}));
   return json(await rpc(envelope.action,null));
  }
  const token=(req.headers.get('authorization')||'').replace(/^Bearer /,'');
  const ctx=await verifyDevelopmentIdentity(token,body.household_id,{publishableKey:req.headers.get('apikey')||'',sessionOnly:true});
  if(!['config','mode','history','detail','analytics','ingest'].includes(body.action))throw new Error();
  if(body.action==='ingest') {
   if(!Array.isArray(body.records)||body.records.length>100)throw new Error();
   return json(await rpc('ingest',ctx.user_id,{records:body.records.map((r:unknown)=>sanitizeRecord(r,'browser'))}));
  }
  return json(await rpc(body.action,ctx.user_id,body));
 }catch(error){return json({error:error instanceof Error&&error.message==='monitoring_unavailable'?'monitoring_unavailable':'denied'},error instanceof Error&&error.message==='monitoring_unavailable'?503:403);}
});
