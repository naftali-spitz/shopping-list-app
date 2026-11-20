import assert from 'node:assert/strict';
import { readFileSync,writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
export const PREVIEW='https://shopping-list-app-git-feature-fles-b8db25-0012ab-5576s-projects.vercel.app';
export function previewHeaders() {
  const env=readFileSync('.stage0-runtime/audit-feature-flespi-home-backend.env','utf8');
  const raw=env.split('\n').find(l=>l.startsWith('VERCEL_OIDC_TOKEN='))?.split('=').slice(1).join('=');
  assert.ok(raw,'Missing short-lived protected Preview token');
  const token=raw.startsWith('"')?JSON.parse(raw):raw;
  return {'x-vercel-trusted-oidc-idp-token':token};
}
export async function api(body,session) {
  const response=await fetch(PREVIEW+'/api/stage3',{method:'POST',headers:{...previewHeaders(),'Content-Type':'application/json',Authorization:'Bearer '+session.access_token,Origin:PREVIEW},body:JSON.stringify(body),redirect:'manual',signal:AbortSignal.timeout(30000)});
  if(!response.headers.get('content-type')?.includes('application/json'))throw new Error(`Preview protection or route HTTP ${response.status}`);
  return {status:response.status,data:await response.json()};
}
export function intent(h,type,payload,version) {
  const now=Date.now();return {id:randomUUID(),household_id:h,type,payload,expected_version:version,correlation_id:randomUUID(),issued_ms:now,expires_ms:now+300000};
}
export async function confirmed(i,s,timeout=60000,observed=[]) {
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){const response=await api({action:'status',id:i.id,household_id:i.household_id},s);observed.push(response.data.state||response.data.error);if(response.data.result)return response.data;await new Promise(resolve=>setTimeout(resolve,1000));}
  throw new Error('Authoritative confirmation timeout');
}
if(process.argv[1]?.endsWith('stage3-preview-check.mjs')) {
  const sessions=JSON.parse(readFileSync('.stage0-runtime/stage3-sessions.json'));
  const {households}=JSON.parse(readFileSync('.stage0-runtime/stage3-auth-state.json'));
  const report={id:randomUUID(),at:new Date().toISOString(),scope:'actual protected Vercel Preview API → flespi → Debian PostgreSQL → Vercel callback → durable status',checks:[]};
  try {
    const op=intent(households[0],'category.create',{id:randomUUID(),name:'Preview integration',icon:'general'},0);
    const start=Date.now(),accepted=await api({action:'command',intent:op},sessions[0]);
    report.acceptance=accepted;assert.equal(accepted.status,202);
    assert.equal(accepted.data.transport,'puback');report.acceptance_ms=Date.now()-start;
    report.checks.push({name:'Preview durably accepted then published to real broker',status:'PASS'});
    const result=await confirmed(op,sessions[0]);assert.equal(result.result.status,'committed');
    report.confirmation_ms=Date.now()-start;report.operation_id=op.id;report.correlation_id=op.correlation_id;
    report.checks.push({name:'authoritative PostgreSQL commit returned through independent HTTPS callback',status:'PASS'});
    const duplicate=await api({action:'command',intent:op},sessions[0]);assert.equal(duplicate.data.result.status,'committed');assert.equal(duplicate.data.duplicate,true);
    report.checks.push({name:'same stable operation retry returns existing durable commit',status:'PASS'});
    const denied=await api({action:'command',intent:{...op,id:randomUUID(),household_id:households[1]}},sessions[0]);assert.ok(denied.status>=400);
    report.checks.push({name:'wrong-household API command rejected',status:'PASS'});
    report.status='PASS';
  }catch(error){report.status='FAIL';report.error={type:error.name,message:error.message};process.exitCode=1;}
  finally {writeFileSync(`docs/stage3/attempts/preview-${report.id}.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));}
}
