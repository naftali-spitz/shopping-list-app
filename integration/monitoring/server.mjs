import { developmentConfig } from '../stage3/server.mjs';
import { DEV_SUPABASE } from '../stage3/identity.mjs';
export async function handleMonitoring(request) {
  let config;try{config=developmentConfig();}catch{return Response.json({error:'disabled'},{status:404});}
  if(request.method!=='POST'||request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'denied'},{status:403});
  try {
    let size=0;const parts=[];const reader=request.body?.getReader();if(!reader)throw new Error();
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>128000){await reader.cancel();throw new Error();}parts.push(value);}
    const body=Buffer.concat(parts);
    const response=await fetch(DEV_SUPABASE+'/functions/v1/shopping-dev-monitoring',{method:'POST',headers:{apikey:config.publishableKey,Authorization:request.headers.get('authorization')||'','Content-Type':'application/json'},body,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
    return new Response(await response.text(),{status:response.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  }catch{return Response.json({error:'monitoring_unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
