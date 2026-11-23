// First-seen real provider subject rehearsal in the explicitly marked disposable
// rebuild database. The primary development database and existing accounts stay intact.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import pg from '../backend/node_modules/pg/lib/index.js';
import {loadStage3Config} from '../backend/src/stage3-config.mjs';
import {Store} from '../backend/src/store.mjs';
import {signCommand} from '../integration/stage3/protocol.mjs';
import {DEV_SUPABASE,DEV_ISSUER} from '../integration/stage3/identity.mjs';
execFileSync(process.execPath,['scripts/stage0-preflight.mjs'],{stdio:['ignore','ignore','pipe']});
const target='shopping_stage2_rebuild';
const config=loadStage3Config(),signer=JSON.parse(readFileSync('.stage0-runtime/stage3-vercel-config.json')).signer;
const account=JSON.parse(readFileSync('.stage0-runtime/stage3-accounts.json'))[2];
const report={id:randomUUID(),at:new Date().toISOString(),scope:'first-seen verified existing provider identity maps automatically in marked isolated disposable rebuild; not new-account or browser evidence',target:{host:'127.0.0.1',port:55439,database:target},checks:[],operations:[]};
const dir=`docs/stage4/attempts/identity-rehearsal-${report.id}`;mkdirSync(dir,{recursive:true});
const previous=existsSync('docs/stage2/rebuild.json')?readFileSync('docs/stage2/rebuild.json'):null;
const admin={host:'127.0.0.1',port:55439,user:'stage0_owner',password:readFileSync('.stage0-runtime/admin-password','utf8').trim(),max:1};
let db,store,session;
const check=(name,evidence={})=>report.checks.push({name,status:'PASS',...evidence});
try {
  // This existing guarded script recreates only the explicitly marked disposable
  // rebuild target; its established checks refuse an unmarked existing database.
  const setup=execFileSync(process.execPath,['backend/scripts/setup.mjs','--rebuild'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
  writeFileSync(dir+'/setup.log',setup);
  writeFileSync(dir+'/rebuild-schema.json',readFileSync('docs/stage2/rebuild.json'));
  db=new pg.Pool({...admin,database:target});
  const marker=(await db.query("SELECT current_database() AS database,inet_server_port() AS port,shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=current_database()")).rows[0];
  assert.equal(marker.database,target);assert.equal(marker.port,55439);assert.equal(marker.marker,'Shopping Stage2 disposable rebuild');
  // The rebuild setup deliberately removes PUBLIC CONNECT. Grant only the
  // existing restricted runtime role access to this one disposable database.
  await db.query('GRANT CONNECT ON DATABASE shopping_stage2_rebuild TO shopping_stage2_runtime');
  const before=(await db.query('SELECT count(*)::int AS count FROM shopping.principals WHERE id=$1',[account.id])).rows[0].count;assert.equal(before,0);
  check('marked disposable database verified; real provider principal initially absent',{marker,principal_count_before:before});
  const login=await fetch(DEV_SUPABASE+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({email:account.email,password:account.password}),redirect:'error',signal:AbortSignal.timeout(10000)});assert.ok(login.ok);session=await login.json();assert.equal(session.user.id,account.id);
  store=new Store({...config,db:{...config.db,database:target}});
  async function execute(scope,type,payload={},version=null) {
    const now=Date.now(),context=await config.verifyIdentity(session.access_token,scope,'stage4.'+type);
    const c=signCommand({id:randomUUID(),household_id:scope,type:'stage4.'+type,payload,expected_version:version,correlation_id:randomUUID(),issued_ms:now,expires_ms:now+300000},context,session.access_token,signer);
    const r=await store.execute(c);report.operations.push({operation_id:c.id,correlation_id:c.correlation_id,type:c.type,status:r.status});return {c,r};
  }
  const discovery=await execute(account.id,'household.list');assert.equal(discovery.r.status,'snapshot');assert.deepEqual(discovery.r.data.households,[]);
  const principal=(await db.query('SELECT id,issuer,subject,active FROM shopping.principals WHERE id=$1',[account.id])).rows[0];assert.equal(principal.issuer,DEV_ISSUER);assert.equal(principal.subject,account.id);assert.equal(principal.active,true);
  check('real verified provider discovery maps previously unseen issuer/subject without manual local provisioning',{principal});
  const h=randomUUID(),created=await execute(h,'household.create',{name:'Stage4 first principal '+report.id.slice(0,8)},0);assert.equal(created.r.status,'committed');assert.equal(created.r.data.record.id,h);
  const membership=(await db.query('SELECT user_id,role,active FROM shopping.household_members WHERE household_id=$1',[h])).rows;assert.deepEqual(membership,[{user_id:account.id,role:'owner',active:true}]);
  const replay=await store.execute(created.c);assert.deepEqual(replay,created.r);
  const counts=(await db.query('SELECT (SELECT count(*)::int FROM shopping.principals WHERE id=$1) AS principals,(SELECT count(*)::int FROM shopping.household_members WHERE household_id=$2) AS memberships,(SELECT count(*)::int FROM shopping.operations WHERE id=$3) AS ledger,(SELECT count(*)::int FROM shopping.result_outbox WHERE operation_id=$3) AS outbox',[account.id,h,created.c.id])).rows[0];assert.deepEqual(counts,{principals:1,memberships:1,ledger:1,outbox:1});
  check('first mapped identity creates household/owner atomically; duplicate same-ID has one mapping/membership/ledger/outbox',{household_id:h,counts});
  const listed=await execute(account.id,'household.list');assert.equal(listed.r.data.households.length,1);assert.equal(listed.r.data.households[0].id,h);check('new local household is discoverable without a Supabase business-household mirror');
  report.status='PASS';
} catch(error) {report.status='FAIL';report.error={type:error.name,code:error.code,message:error.name==='AssertionError'?error.message:'Isolated identity rehearsal failed; sensitive diagnostics suppressed'};process.exitCode=1;}
finally {
  await store?.close();await db?.end();
  // Scope local logout to the fresh session created here; no other test browser
  // or owner session is invalidated.
  if(session)await fetch(DEV_SUPABASE+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:config.publishableKey,Authorization:'Bearer '+session.access_token},redirect:'error',signal:AbortSignal.timeout(10000)}).catch(()=>{});
  if(previous)writeFileSync('docs/stage2/rebuild.json',previous);
  report.previous_stage2_evidence_preserved=previous!==null;
  writeFileSync(dir+'/report.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:report.status,checks:report.checks.length,evidence:dir+'/report.json'}));
}
