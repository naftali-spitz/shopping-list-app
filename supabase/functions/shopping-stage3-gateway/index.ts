// Development-only durable adapter. The admin credential never leaves this
// runtime; each public action authenticates independently before any DB access.
import { authenticateCommand, verifyCallback, verifyReconciliation, uuid } from '../../../integration/stage3/protocol.mjs';
import { verifyDevelopmentIdentity, DEV_SUPABASE } from '../../../integration/stage3/identity.mjs';
const commandKeys = {'command-1':'-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAaA3cpm3ZA/Trm2meHSXGreP8lWMMsIhZ5q1uCifLQsI=\n-----END PUBLIC KEY-----\n'};
const callbackKeys = {'callback-1':'-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAGX+fRSih6snwRf7CMu7uVmfiHzoUz/S8Ghb2ugRS/Ss=\n-----END PUBLIC KEY-----\n'};
const json = (body: unknown,status=200) => Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
Deno.serve(async req => {
  if (Deno.env.get('SUPABASE_URL')!==DEV_SUPABASE || req.method!=='POST')return json({error:'disabled'},403);
  try {
    const reader=req.body?.getReader(); if(!reader)return json({error:'invalid_body'},400);
    let size=0;const chunks:Uint8Array[]=[];
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>280000){await reader.cancel();return json({error:'too_large'},413);}chunks.push(value);}
    const body=JSON.parse(new TextDecoder().decode(new Uint8Array(chunks.flatMap(c=>Array.from(c)))));
    const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    async function db(path:string,options:RequestInit={}) {
      const r=await fetch(DEV_SUPABASE+'/rest/v1/'+path,{...options,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},signal:AbortSignal.timeout(5000)});
      if(!r.ok){const e=await r.json();throw new Error(e.code==='54000'?'rate_limited':e.code==='23505'?'operation_conflict':'store_unavailable');}
      return r.status===204?null:r.json();
    }
    // Publishable key is not a privileged credential. Caller supplies it to
    // reach the pinned project's Auth API; provider verification remains mandatory.
    const publishableKey=req.headers.get('apikey') || '';
    const verifyIdentity=(token:string,h:string)=>verifyDevelopmentIdentity(token,h,{publishableKey});
    if(body.action==='accept') {
      const verified=await authenticateCommand(body.command,{commandKeys,verifyIdentity});
      return json(await db('rpc/stage3_dev_accept_service',{method:'POST',body:JSON.stringify({p_command:verified.command,p_hash:verified.hash})}));
    }
    if(body.action==='callback') {
      const id=body.callback?.result?.operation_id;if(!uuid(id))throw new Error('unauthorized');
      const rows=await db('stage3_dev_operations?id=eq.'+id+'&select=command');
      if(rows.length!==1)throw new Error('unauthorized');
      const result=verifyCallback(body.callback,callbackKeys,rows[0].command);
      return json(await db('rpc/stage3_dev_result_service',{method:'POST',body:JSON.stringify({p_result:result})}));
    }
    if(body.action==='reconcile') {
      verifyReconciliation(body.request,callbackKeys);
      return json(await db('stage3_dev_operations?result=is.null&select=command,accepted_at&order=accepted_at.asc&limit=20'));
    }
    if(body.action==='status' && uuid(body.id) && uuid(body.household_id)) {
      const token=(req.headers.get('authorization')||'').replace(/^Bearer /,'');
      const ctx=await verifyIdentity(token,body.household_id);
      const rows=await db('stage3_dev_operations?id=eq.'+body.id+'&household_id=eq.'+ctx.household_id+'&user_id=eq.'+ctx.user_id+'&select=id,accepted_at,result,confirmed_at,callback_count,command');
      if(!rows.length)return json({error:'not_found'},404);
      const {command,...status}=rows[0];
      return json({...status,state:status.result?status.result.status:Date.now()>command.expires_ms?'reconciliation_required':'accepted_pending'});
    }
    return json({error:'invalid_action'},400);
  } catch(error) {
    const name=error instanceof Error?error.message:'';
    console.log(JSON.stringify({event:'stage3_gateway_denied',reason:['invalid_contract','invalid_signature','invalid_callback','callback_binding_mismatch','invalid_environment','invalid_validity','unauthorized','rate_limited','operation_conflict','store_unavailable'].includes(name)?name:'internal_failure'}));
    return json({error:['rate_limited','operation_conflict','store_unavailable'].includes(name)?name:'unauthorized'},name==='rate_limited'?429:name==='operation_conflict'?409:name==='store_unavailable'?503:403);
  }
});
