import { randomUUID } from 'node:crypto';
import mqtt from 'mqtt';
import { signCommand, validateCommand, verifyCallback } from './protocol.mjs';
import { verifyDevelopmentIdentity, DEV_SUPABASE } from './identity.mjs';
const GATEWAY = DEV_SUPABASE+'/functions/v1/shopping-stage3-gateway';
const json = (body,status=200) => Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export function developmentConfig(env = process.env) {
  if(env.SHOPPING_STAGE3_ENABLED!=='1' || env.VERCEL_ENV==='production' || env.NEXT_PUBLIC_SUPABASE_URL!==DEV_SUPABASE)throw new Error('disabled');
  const local=env.SHOPPING_STAGE3_LOCAL==='1' && !env.VERCEL;
  if(!local && (env.VERCEL_ENV!=='preview' || !['develop','feature/flespi-home-backend'].includes(env.VERCEL_GIT_COMMIT_REF) || env.VERCEL_GIT_REPO_OWNER!=='naftali-spitz' || env.VERCEL_GIT_REPO_SLUG!=='shopping-list-app'))throw new Error('disabled');
  const c=JSON.parse(env.SHOPPING_STAGE3_CONFIG || '{}');
  if(c.projectId!=='prj_jsqk7AsPGuxLmvWqYEsqyFClV1cM' || c.topic!=='shopping-poc/naf-stage0-041d4f122bdd/commands')throw new Error('disabled');
  return {...c,local,publishableKey:env.NEXT_PUBLIC_SUPABASE_ANON_KEY};
}
export function stage4Enabled(env=process.env) {
  try {
    const config=developmentConfig(env);
    return env.SHOPPING_STAGE4_ENABLED==='1' && (config.local || env.VERCEL_ENV==='preview' && env.VERCEL_GIT_COMMIT_REF==='feature/flespi-home-backend');
  } catch {return false;}
}
export async function gateway(action, config, token) {
  const r=await fetch(GATEWAY,{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(action),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
  const body=await r.json();
  if(!r.ok) {const error=new Error(body.error || 'store_unavailable');error.status=r.status;throw error;}
  return body;
}
export async function publishCommand(command,config) {
  const client=mqtt.connect('mqtts://mqtt.flespi.io:8883',{username:config.publisherToken,clientId:'naf-s3-api-'+randomUUID(),protocolVersion:5,clean:true,properties:{sessionExpiryInterval:0},reconnectPeriod:0,connectTimeout:5000,rejectUnauthorized:true});
  client.on('error',()=>{});
  let timeout;
  try {
    await Promise.race([(async()=>{
      await new Promise((resolve,reject)=>{client.once('connect',resolve);client.once('error',reject);});
      if(!client.stream.authorized)throw new Error('broker_tls');
      const ack=await client.publishAsync(config.topic,JSON.stringify(command),{qos:1,retain:false,properties:{messageExpiryInterval:Math.max(1,Math.floor((command.expires_ms-Date.now())/1000))}});
      if(ack?.reasonCode>=128)throw new Error('broker_refused');
    })(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('broker_timeout')),7000);})]);
  } finally {clearTimeout(timeout);client.end(true);}
}
async function readJson(request) {
  const reader=request.body?.getReader();if(!reader)throw new Error('invalid_request');let length=0;const parts=[];
  while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>280000){await reader.cancel();throw new Error('too_large');}parts.push(value);}
  return JSON.parse(Buffer.concat(parts).toString());
}
export async function handle(request) {
  let config;
  try {config=developmentConfig();}catch{return json({error:'disabled'},404);}
  const started=Date.now();
  try {
    const origin=request.headers.get('origin');
    if(origin && origin!==new URL(request.url).origin) return json({error:'origin_denied'},403);
    const body=await readJson(request);
    if(body.action==='callback') {
      // Verify here and again at the durable adapter. The accepted tuple is
      // checked in the adapter and its atomic result transaction.
      const r=body.callback?.result;
      verifyCallback(body.callback,config.callbackKeys,{id:r?.operation_id,user_id:r?.user_id,household_id:r?.household_id,correlation_id:r?.correlation_id});
      const stored=await gateway(body,config);
      console.log(JSON.stringify({event:'stage3_callback',operation_id:r.operation_id,correlation_id:r.correlation_id,duplicate:stored.duplicate,delivery_ms:Date.now()-body.callback.issued_ms}));
      return json(stored);
    }
    const token=(request.headers.get('authorization')||'').replace(/^Bearer /,'');
    if(body.action==='status')return json(await gateway(body,config,token));
    if(body.action!=='command')return json({error:'invalid_action'},400);
    if(typeof body.intent?.type==='string' && body.intent.type.startsWith('stage4.') && !stage4Enabled())return json({error:'disabled'},404);
    const context=await verifyDevelopmentIdentity(token,body.intent?.household_id,{publishableKey:config.publishableKey,sessionOnly:typeof body.intent?.type==='string'&&body.intent.type.startsWith('stage4.')});
    const command=signCommand(body.intent,context,token,config.signer);
    validateCommand(command,config.commandKeys);
    const accepted=await gateway({action:'accept',command},config);
    let transport='not_needed';
    if(!accepted.result && command.expires_ms>Date.now()) {
      console.log(JSON.stringify({event:'stage3_publish',operation_id:command.id,correlation_id:command.correlation_id,published_at_ms:Date.now()}));
      try {await publishCommand(command,config);transport='puback';}catch{transport='retry_pending';}
    }
    console.log(JSON.stringify({event:'stage3_accepted',operation_id:command.id,correlation_id:command.correlation_id,acceptance_ms:Date.now()-started,transport,duplicate:accepted.duplicate}));
    return json({...accepted,state:accepted.result?accepted.result.status:'accepted_pending',transport},accepted.result?200:202);
  } catch(error) {
    const known=['operation_conflict','rate_limited','too_large','invalid_action','store_unavailable'];
    const message=known.includes(error.message)?error.message:'request_rejected';
    return json({error:message},error.status || (error.message==='unauthorized'?401:message==='too_large'?413:message==='request_rejected'?400:503));
  }
}
