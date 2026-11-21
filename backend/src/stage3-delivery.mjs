import { spawn } from 'node:child_process';
import { readFileSync,existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { signed, CALLBACK_ISSUER, CALLBACK_AUDIENCE } from '../../integration/stage3/protocol.mjs';
import { DEV_SUPABASE } from '../../integration/stage3/identity.mjs';
const CLI='/home/naf-w/.local/share/shopping-list-tools/node_modules/.bin/vercel';
let refreshing;
async function previewToken(refresh=false) {
  const path='.stage0-runtime/stage3-callback.env';
  if(refresh) {
    if(!refreshing)refreshing=new Promise((resolve,reject)=>{
      const child=spawn(CLI,['env','pull',path,'--environment','preview','--git-branch','feature/flespi-home-backend','--project','prj_jsqk7AsPGuxLmvWqYEsqyFClV1cM','--scope','0012ab-5576s-projects','--yes','--non-interactive'],{stdio:['ignore','ignore','ignore']});
      const timer=setTimeout(()=>{child.kill();reject(new Error('preview_token_unavailable'));},20000);
      child.on('error',()=>{clearTimeout(timer);reject(new Error('preview_token_unavailable'));});
      child.on('close',code=>{clearTimeout(timer);if(code===0)resolve();else reject(new Error('preview_token_unavailable'));});
    }).finally(()=>{refreshing=null;});
    await refreshing;
  }
  const env=readFileSync(existsSync(path)?path:'.stage0-runtime/audit-feature-flespi-home-backend.env','utf8');
  const raw=env.split('\n').find(line=>line.startsWith('VERCEL_OIDC_TOKEN='))?.slice('VERCEL_OIDC_TOKEN='.length);
  if(!raw)throw new Error('preview_token_unavailable');
  return raw.startsWith('"')?JSON.parse(raw):raw;
}
export async function deliverStage3(result,config) {
  // Strip a transport-only replay marker: terminal business results are immutable.
  const {replayed:ignored,...authoritative}=result;
  void ignored;
  const callback=signed({v:2,kind:'operation-result',kid:config.resultKid??'callback-1',iss:CALLBACK_ISSUER,aud:CALLBACK_AUDIENCE,issued_ms:Date.now(),delivery_id:randomUUID(),result:authoritative},config.resultPrivateKey);
  const url=config.callbackUrl;
  if(url!=='https://shopping-list-app-git-feature-fles-b8db25-0012ab-5576s-projects.vercel.app/api/stage3')throw new Error('unsafe_callback_target');
  // Attach the short-lived token only to the exact verified Preview origin.
  // Refresh via the official CLI's feature Preview env pull on platform rejection;
  // this never changes protection settings or requests production access.
  for(let attempt=0;attempt<2;attempt++) {
    const token=await previewToken(attempt===1);
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','x-vercel-trusted-oidc-idp-token':token},body:JSON.stringify({action:'callback',callback}),redirect:'manual',signal:AbortSignal.timeout(10000)});
    const isJson=response.headers.get('content-type')?.includes('application/json');
    if(response.ok&&isJson&&(await response.json()).id===result.operation_id)return;
    if(isJson&&response.status!==401)break;
  }
  throw new Error('callback_unavailable');
}
export async function reconcileStage3(config) {
  const request=signed({v:2,kind:'reconcile',kid:config.resultKid??'callback-1',iss:CALLBACK_ISSUER,aud:CALLBACK_AUDIENCE,issued_ms:Date.now(),id:randomUUID()},config.resultPrivateKey);
  const r=await fetch(DEV_SUPABASE+'/functions/v1/shopping-stage3-gateway',{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({action:'reconcile',request}),redirect:'error',signal:AbortSignal.timeout(5000)});
  if(!r.ok)throw new Error('reconciliation_unavailable');
  return r.json();
}
export async function progressStage3(command,state,config) {
  const progress=signed({v:2,kind:'operation-progress',kid:config.resultKid??'callback-1',iss:CALLBACK_ISSUER,aud:CALLBACK_AUDIENCE,issued_ms:Date.now(),delivery_id:randomUUID(),operation_id:command.id,user_id:command.user_id,household_id:command.household_id,correlation_id:command.correlation_id,state},config.resultPrivateKey);
  const r=await fetch(DEV_SUPABASE+'/functions/v1/shopping-stage3-gateway',{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({action:'progress',progress}),redirect:'error',signal:AbortSignal.timeout(5000)});
  if(!r.ok)throw new Error('progress_unavailable');
}
