import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,statSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {loadStage3Config} from '../backend/src/stage3-config.mjs';
import {deliverStage3} from '../backend/src/stage3-delivery.mjs';
import {gateway} from '../integration/stage3/server.mjs';
const config=loadStage3Config(),session=JSON.parse(readFileSync('.stage0-runtime/stage3-sessions.json'))[0];
const {households}=JSON.parse(readFileSync('.stage0-runtime/stage3-auth-state.json'));
const report={id:randomUUID(),at:new Date().toISOString(),scope:'actual feature Preview access-token rejection and official CLI refresh; no protection settings changed'};
try {
  const original=await gateway({action:'status',id:'860fa6b5-f3db-49bf-a100-9e2fc6c98100',household_id:households[0]},config,session.access_token);
  assert.equal(original.result.status,'committed');
  writeFileSync('.stage0-runtime/stage3-callback.env','VERCEL_OIDC_TOKEN="expired-preview-token"\n',{mode:0o600});
  await deliverStage3(original.result,config);
  const updated=readFileSync('.stage0-runtime/stage3-callback.env','utf8');
  assert.ok(!updated.includes('expired-preview-token'));
  assert.equal(statSync('.stage0-runtime/stage3-callback.env').mode&0o777,0o600);
  assert.ok(!updated.includes('inebdmynrfwmmxcyziyi'));
  report.status='PASS';report.refreshed=true;report.callback='existing committed result delivered idempotently';report.private_file_mode='0600';
}catch(error){report.status='FAIL';report.error={type:error.name,message:'Protected Preview credential refresh check failed; credentials suppressed'};process.exitCode=1;}
finally{writeFileSync(`docs/stage3/attempts/token-refresh-${report.id}.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));}
