import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { signed, CALLBACK_ISSUER, CALLBACK_AUDIENCE } from '../../integration/stage3/protocol.mjs';
import { DEV_SUPABASE } from '../../integration/stage3/identity.mjs';
const CLI='/home/naf-w/.local/share/shopping-list-tools/node_modules/.bin/vercel';
export async function deliverStage3(result,config) {
  // Strip a transport-only replay marker: terminal business results are immutable.
  const {replayed:ignored,...authoritative}=result;
  void ignored;
  const callback=signed({v:2,kind:'operation-result',kid:'callback-1',iss:CALLBACK_ISSUER,aud:CALLBACK_AUDIENCE,issued_ms:Date.now(),delivery_id:randomUUID(),result:authoritative},config.resultPrivateKey);
  const url=config.callbackUrl;
  if(url!=='https://shopping-list-app-git-feature-fles-b8db25-0012ab-5576s-projects.vercel.app/api/stage3')throw new Error('unsafe_callback_target');
  // Official CLI refreshes short-lived Preview access using the existing owner
  // login. It does not modify protection settings or request production access.
  await new Promise((resolve,reject)=>{
    const child=spawn(CLI,['curl',url,'--scope','0012ab-5576s-projects','--','--fail','--silent','--show-error','--max-time','15','--request','POST','--header','Content-Type: application/json','--data-binary','@-'],{stdio:['pipe','pipe','pipe']});
    const timer=setTimeout(()=>{child.kill();reject(new Error('callback_timeout'));},20000);
    let output='';child.stdout.on('data',chunk=>{output+=chunk;if(output.length>4096)child.kill();});child.stderr.resume();
    child.on('error',()=>{clearTimeout(timer);reject(new Error('callback_unavailable'));});
    child.on('close',code=>{clearTimeout(timer);if(code===0){try{const r=JSON.parse(output);if(r.id===result.operation_id){resolve();return;}}catch{}}reject(new Error('callback_unavailable'));});
    child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({action:'callback',callback}));
  });
}
export async function reconcileStage3(config) {
  const request=signed({v:2,kind:'reconcile',kid:'callback-1',iss:CALLBACK_ISSUER,aud:CALLBACK_AUDIENCE,issued_ms:Date.now(),id:randomUUID()},config.resultPrivateKey);
  const r=await fetch(DEV_SUPABASE+'/functions/v1/shopping-stage3-gateway',{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({action:'reconcile',request}),redirect:'error',signal:AbortSignal.timeout(5000)});
  if(!r.ok)throw new Error('reconciliation_unavailable');
  return r.json();
}
