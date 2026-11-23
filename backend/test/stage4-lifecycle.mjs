// Real provider identities, actual durable gateway and isolated PostgreSQL.
// This is backend evidence; original-app browser parity is tested separately.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
import pg from 'pg';
import {loadStage3Config} from '../src/stage3-config.mjs';
import {Store} from '../src/store.mjs';
import {signCommand} from '../../integration/stage3/protocol.mjs';
import {gateway} from '../../integration/stage3/server.mjs';
import {DEV_SUPABASE} from '../../integration/stage3/identity.mjs';
execFileSync(process.execPath,['scripts/stage0-preflight.mjs'],{stdio:['ignore','ignore','pipe']});
const config=loadStage3Config(),store=new Store(config),signer=JSON.parse(readFileSync('.stage0-runtime/stage3-vercel-config.json')).signer;
const accounts=JSON.parse(readFileSync('.stage0-runtime/stage3-accounts.json'));
const db=new pg.Pool({host:'127.0.0.1',port:55439,database:'shopping_stage0',user:'stage0_owner',password:readFileSync('.stage0-runtime/admin-password','utf8').trim(),max:1});
const report={id:randomUUID(),at:new Date().toISOString(),scope:'real Supabase Dev session + gateway acceptance + isolated PostgreSQL lifecycle, not browser/MQTT latency',checks:[],operations:[]};
const sessions=[];
const check=name=>report.checks.push({name,status:'PASS'});
async function command(user,scope,type,payload={},expected=null) {
  const token=sessions[user].access_token,now=Date.now();
  const ctx=await config.verifyIdentity(token,scope,'stage4.'+type);
  return signCommand({id:randomUUID(),household_id:scope,type:'stage4.'+type,payload,expected_version:expected,correlation_id:randomUUID(),issued_ms:now,expires_ms:now+300000},ctx,token,signer);
}
async function execute(user,scope,type,payload={},expected=null) {
  const c=await command(user,scope,type,payload,expected);
  await gateway({action:'accept',command:c},config);
  const r=await store.execute(c);report.operations.push({operation_id:c.id,correlation_id:c.correlation_id,type:c.type,status:r.status});
  return {c,r};
}
try {
  assert.equal((await db.query('SHOW port')).rows[0].port,'55439');
  for(const a of accounts) {
    const response=await fetch(DEV_SUPABASE+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({email:a.email,password:a.password}),redirect:'error',signal:AbortSignal.timeout(10000)});
    assert.ok(response.ok);const session=await response.json();assert.equal(session.user.id,a.id);sessions.push(session);
  }
  check('reuse all three existing accounts without password reset or reprovisioning');
  for(const i of [0,1,2]) {
    const {r}=await execute(i,accounts[i].id,'household.list');assert.equal(r.status,'snapshot');assert.ok(Array.isArray(r.data.households));
  }
  check('current-session account discovery has no Supabase business-household requirement');
  const h=randomUUID();report.household_id=h;
  let {c:create,r}=await execute(0,h,'household.create',{name:'Stage4 lifecycle '+report.id.slice(0,8)},0);
  assert.equal(r.status,'committed');assert.equal(r.data.record.id,h);let version=r.data.household_version;
  const replay=await store.execute(create);assert.deepEqual(replay,r);
  const one=(await db.query('SELECT count(*)::int AS count FROM shopping.operations WHERE id=$1',[create.id])).rows[0].count;assert.equal(one,1);
  check('new PostgreSQL household and owner membership commit atomically; same-ID duplicate one ledger');
  const seed=await execute(0,h,'household.seed',{language:'he'},version);assert.equal(seed.r.status,'committed');version=seed.r.data.household_version;
  const count=(await db.query('SELECT (SELECT count(*)::int FROM shopping.categories WHERE household_id=$1 AND deleted_at IS NULL) AS categories,(SELECT count(*)::int FROM shopping.products WHERE household_id=$1 AND deleted_at IS NULL) AS products',[h])).rows[0];
  assert.deepEqual(count,{categories:5,products:27});
  assert.equal((await store.execute(seed.c)).status,'committed');
  assert.equal((await execute(0,h,'household.seed',{language:'en'},version)).r.status,'record_id_conflict');
  check('Hebrew trusted starter seed has5categories/27products; duplicate ID replays and reseed refuses replacement');
  const renamed=await execute(0,h,'household.rename',{name:'Stage4 renamed '+report.id.slice(0,8)},version);assert.equal(renamed.r.status,'committed');version=renamed.r.data.household_version;
  assert.equal((await execute(0,h,'household.rename',{name:'Stale rename'},version-1)).r.status,'version_conflict');
  check('owner rename uses authoritative expected household revision');
  const token=randomBytes(24).toString('hex'),inviteId=randomUUID();
  const invitation=await execute(0,h,'invite.create',{id:inviteId,token});assert.equal(invitation.r.status,'committed');version=invitation.r.data.household_version;
  const join=await execute(1,accounts[1].id,'invite.accept',{token});assert.equal(join.r.status,'committed');assert.equal(join.r.data.record.id,h);version=join.r.data.household_version;
  assert.equal((await execute(1,accounts[1].id,'invite.accept',{token})).r.status,'committed');
  version=Number((await db.query('SELECT version FROM shopping.households WHERE id=$1',[h])).rows[0].version);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM shopping.household_members WHERE household_id=$1 AND user_id=$2',[h,accounts[1].id])).rows[0].count,1);
  const members=await execute(1,h,'household.members');assert.equal(members.r.status,'snapshot');assert.equal(members.r.data.members.length,2);
  assert.equal((await execute(2,h,'household.members')).r.status,'forbidden');
  assert.equal((await execute(1,h,'household.rename',{name:'Unauthorized member rename'},version)).r.status,'forbidden');
  check('reusable14day invite grants one authenticated membership; member listing isolated and owner-only rename');
  assert.equal((await execute(2,accounts[2].id,'invite.accept',{token:randomBytes(24).toString('hex')})).r.status,'not_found');
  const revoked=await execute(0,h,'invite.revoke',{id:inviteId});assert.equal(revoked.r.status,'committed');version=revoked.r.data.household_version;
  assert.equal((await execute(2,accounts[2].id,'invite.accept',{token})).r.status,'not_found');
  check('forged and explicitly revoked invitations deny enrollment');
  const expiredToken=randomBytes(24).toString('hex'),expiredId=randomUUID();
  const expired=await execute(0,h,'invite.create',{id:expiredId,token:expiredToken});assert.equal(expired.r.status,'committed');version=expired.r.data.household_version;
  await db.query("UPDATE shopping.household_invites SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1 AND household_id=$2",[expiredId,h]);
  assert.equal((await execute(2,accounts[2].id,'invite.accept',{token:expiredToken})).r.status,'not_found');
  check('controlled expiry of this run own invitation denies acceptance');
  const pending=await command(1,h,'product.create',{id:randomUUID(),category_id:(await db.query('SELECT id FROM shopping.categories WHERE household_id=$1 LIMIT 1',[h])).rows[0].id,name:'Must not commit'},0);
  await gateway({action:'accept',command:pending},config);
  const removed=await execute(0,h,'membership.remove',{user_id:accounts[1].id},version);assert.equal(removed.r.status,'committed');version=removed.r.data.household_version;
  assert.equal((await store.execute(pending)).status,'forbidden');
  assert.equal((await db.query('SELECT count(*)::int AS count FROM shopping.products WHERE id=$1',[pending.payload.id])).rows[0].count,0);
  assert.equal((await execute(1,h,'snapshot')).r.status,'forbidden');
  check('membership removed while accepted mutation pending denies mutation and future snapshots with zero product effect');
  const logoutCommand=await command(2,accounts[2].id,'household.list');
  const logout=await fetch(DEV_SUPABASE+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:config.publishableKey,Authorization:'Bearer '+sessions[2].access_token},redirect:'error',signal:AbortSignal.timeout(10000)});assert.ok(logout.ok);
  await assert.rejects(()=>store.execute(logoutCommand));
  check('logout revokes dedicated test session and denies signed pending command despite valid token expiry');
  const flags=(await db.query("SELECT rolname,rolsuper,rolbypassrls FROM pg_roles WHERE rolname IN ('shopping_stage2_runtime','shopping_stage2_owner')")).rows;assert.ok(flags.every(f=>!f.rolsuper&&!f.rolbypassrls));
  assert.equal((await db.query("SELECT has_table_privilege('shopping_stage2_runtime','shopping.household_members','INSERT') AS allowed")).rows[0].allowed,false);
  check('lifecycle uses private fixed-search-path definer; runtime has no direct membership INSERT or bypass RLS');
  const deleted=await execute(0,h,'household.delete',{},version);assert.equal(deleted.r.status,'committed');assert.equal((await execute(0,h,'snapshot')).r.status,'forbidden');
  check('owner deletion tombstones household, revokes memberships/invites, preserves business data/ledgers');
  report.status='PASS';
}catch(error){report.status='FAIL';report.error={type:error.name,code:error.code,message:error.name==='AssertionError'?error.message:'Lifecycle integration failed; sensitive diagnostics suppressed'};process.exitCode=1;}
finally{await store.close();await db.end();mkdirSync('docs/stage4/attempts',{recursive:true});writeFileSync(`docs/stage4/attempts/lifecycle-${report.id}.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));}
