import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {loadStage3Config} from '../src/stage3-config.mjs';
import {Store} from '../src/store.mjs';
import {signCommand} from '../../integration/stage3/protocol.mjs';
import {gateway} from '../../integration/stage3/server.mjs';
import {DEV_SUPABASE} from '../../integration/stage3/identity.mjs';
import {getDefaultHouseholdTemplate} from '../../integration/stage4/template.mjs';
execFileSync(process.execPath,['scripts/stage0-preflight.mjs'],{stdio:['ignore','ignore','pipe']});
const config=loadStage3Config(),store=new Store(config),signer=JSON.parse(readFileSync('.stage0-runtime/stage3-vercel-config.json')).signer;
const accounts=JSON.parse(readFileSync('.stage0-runtime/stage3-accounts.json')),sessions=[];
const db=new pg.Pool({host:'127.0.0.1',port:55439,database:'shopping_stage0',user:'stage0_owner',password:readFileSync('.stage0-runtime/admin-password','utf8').trim(),max:1});
const report={id:randomUUID(),at:new Date().toISOString(),scope:'real development provider/gateway/DB account reconciliation and exact trusted starter ordering; no browser claim',checks:[],operations:[]};
const check=name=>report.checks.push({name,status:'PASS'});
async function execute(i,h,type,payload={},expected=null) {
  const now=Date.now(),token=sessions[i].access_token,ctx=await config.verifyIdentity(token,h,'stage4.'+type);
  const c=signCommand({id:randomUUID(),household_id:h,type:'stage4.'+type,payload,expected_version:expected,issued_ms:now,expires_ms:now+300000,correlation_id:randomUUID()},ctx,token,signer);
  await gateway({action:'accept',command:c},config);const r=await store.execute(c);
  report.operations.push({operation_id:c.id,correlation_id:c.correlation_id,type:c.type,status:r.status});return {c,r};
}
try {
  for(const a of accounts.slice(0,2)) {
    const response=await fetch(DEV_SUPABASE+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({email:a.email,password:a.password}),redirect:'error',signal:AbortSignal.timeout(10000)});
    assert.ok(response.ok);const s=await response.json();assert.equal(s.user.id,a.id);sessions.push(s);
  }
  const settings=await fetch(DEV_SUPABASE+'/auth/v1/settings',{headers:{apikey:config.publishableKey},redirect:'error',signal:AbortSignal.timeout(10000)});assert.ok(settings.ok);
  const providers=await settings.json();report.google_development_enabled=providers.external?.google===true;
  check('read actual development Auth provider setting without changing Google or test accounts');
  const h=randomUUID(),created=await execute(0,h,'household.create',{name:'Stage4 order '+report.id.slice(0,8)},0);assert.equal(created.r.status,'committed');
  const seeded=await execute(0,h,'household.seed',{language:'en'},created.r.data.household_version);assert.equal(seeded.r.status,'committed');
  const categories=(await db.query('SELECT id,name FROM shopping.categories WHERE household_id=$1 AND deleted_at IS NULL ORDER BY created_at,id',[h])).rows;
  const template=getDefaultHouseholdTemplate('en');assert.deepEqual(categories.map(c=>c.name),template.map(c=>c.name));
  for(let i=0;i<categories.length;i++) {
    const products=(await db.query('SELECT name FROM shopping.products WHERE household_id=$1 AND category_id=$2 ORDER BY display_order,id',[h,categories[i].id])).rows.map(p=>p.name);
    assert.deepEqual(products,template[i].products);
  }
  check('English starter category order and all27product display orders exactly match trusted template after atomic commit');
  const list=await execute(0,accounts[0].id,'household.list');assert.equal(list.r.status,'snapshot');
  const status=await execute(0,accounts[0].id,'operation.status',{operation_id:list.c.id});assert.equal(status.r.status,'found');assert.deepEqual(status.r.data,list.r);
  assert.deepEqual(await store.execute(status.c),status.r);
  check('account-scoped discovery status reconciles and same-ID status replay is immutable');
  const absent=randomUUID(),absentStatus=await execute(0,absent,'operation.status',{operation_id:randomUUID()});assert.equal(absentStatus.r.status,'not_found');
  assert.equal((await db.query('SELECT count(*)::int AS count FROM shopping.households WHERE id=$1',[absent])).rows[0].count,0);
  check('reconciliation in a never-created household scope returns authoritative not_found without manufacturing a household');
  const foreign=await execute(1,h,'operation.status',{operation_id:created.c.id});assert.equal(foreign.r.status,'not_found');assert.equal(foreign.r.data,null);
  check('another verified account cannot retrieve original actor immutable lifecycle result');
  const deleted=await execute(0,h,'household.delete',{},seeded.r.data.household_version);assert.equal(deleted.r.status,'committed');
  const recovered=await execute(0,h,'operation.status',{operation_id:created.c.id});assert.equal(recovered.r.status,'found');assert.deepEqual(recovered.r.data,created.r);
  assert.equal((await execute(0,h,'snapshot')).r.status,'forbidden');
  check('after membership deletion only own immutable historic outcome remains recoverable; fresh household snapshot denies');
  report.household_id=h;report.status='PASS';
}catch(error){report.status='FAIL';report.error={type:error.name,code:error.code,message:error.name==='AssertionError'?error.message:'Reconciliation integration failed; sensitive diagnostics suppressed'};process.exitCode=1;}
finally{await store.close();await db.end();mkdirSync('docs/stage4/attempts',{recursive:true});writeFileSync(`docs/stage4/attempts/reconciliation-${report.id}.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));}
