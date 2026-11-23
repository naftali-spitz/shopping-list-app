import assert from 'node:assert/strict';
import { readFileSync,writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { loadStage3Config } from '../src/stage3-config.mjs';
import { Store } from '../src/store.mjs';
import { gateway } from '../../integration/stage3/server.mjs';
import { signCommand } from '../../integration/stage3/protocol.mjs';
const config=loadStage3Config(),store=new Store(config);
const mode=process.argv[2];assert.ok(['arm','revoked','expired'].includes(mode));
const path='.stage0-runtime/stage3-boundary-state.json';
const sessions=JSON.parse(readFileSync('.stage0-runtime/stage3-sessions.json'));
const {households}=JSON.parse(readFileSync('.stage0-runtime/stage3-auth-state.json'));
const signer=JSON.parse(readFileSync('.stage0-runtime/stage3-vercel-keys.json'));
const report={id:randomUUID(),at:new Date().toISOString(),mode,scope:'real provider/session/membership with controlled development SQL revocation or session expiry; no browser claim',checks:[]};
try {
  if(mode==='arm') {
    const token=sessions[1].access_token,ctx=await config.verifyIdentity(token,households[0]),now=Date.now();
    const command=signCommand({id:randomUUID(),household_id:households[0],type:'category.create',payload:{id:randomUUID(),name:'Must not commit'},expected_version:0,correlation_id:randomUUID(),issued_ms:now,expires_ms:now+300000},ctx,token,signer);
    await gateway({action:'accept',command},config);
    writeFileSync(path,JSON.stringify({command,session_id:ctx.session_id}),{mode:0o600});
    report.checks.push({name:'pending command durably accepted before controlled revocation',status:'PASS'});
    report.user_id=ctx.user_id;report.household_id=households[0];report.session_id=ctx.session_id;
  } else {
    const {command}=JSON.parse(readFileSync(path));
    await assert.rejects(()=>store.execute(command));
    await assert.rejects(()=>config.verifyIdentity(command.identity,command.household_id));
    const admin=new Pool({host:'127.0.0.1',port:55439,database:'shopping_stage0',user:'stage0_owner',password:readFileSync('.stage0-runtime/admin-password','utf8').trim(),max:1});
    try {
      const r=await admin.query('SELECT (SELECT count(*)::int FROM shopping.operations WHERE id=$1) AS ledger, (SELECT count(*)::int FROM shopping.categories WHERE id=$2) AS business',[command.id,command.payload.id]);
      assert.deepEqual(r.rows[0],{ledger:0,business:0});
    }finally{await admin.end();}
    report.checks.push({name:`${mode} real session/membership denies pending execution with no ledger or business effect`,status:'PASS'});
  }
  report.status='PASS';
}catch(error){report.status='FAIL';report.error={type:error.name,message:'Development identity boundary assertion failed'};process.exitCode=1;}
finally {await store.close();writeFileSync(`docs/stage3/attempts/auth-boundary-${report.id}.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));}
