import { Pool } from 'pg';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { randomBytes, generateKeyPairSync, randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { root,loadConfig } from '../src/config.mjs';
assert.equal(process.cwd(), root);
execFileSync(process.execPath, ['scripts/stage0-preflight.mjs'], { stdio: ['ignore','ignore','pipe'] });
assert.equal(JSON.parse(readFileSync('docs/stage1/gate.json')).decision, 'CONDITIONAL GO');
process.umask(0o077); mkdirSync('docs/stage2', { recursive: true });
const privateDir = '.stage0-runtime', configPath = `${privateDir}/stage2-config.json`;
const pair = () => { const p = generateKeyPairSync('ed25519'); return { publicKey: p.publicKey.export({ type:'spki', format:'pem' }), privateKey:p.privateKey.export({ type:'pkcs8', format:'pem' }) }; };
if (!existsSync(configPath)) {
  const identity = pair(), transport = pair(), result = pair();
  const db = { host:'127.0.0.1', port:55439, database:'shopping_stage0', user:'shopping_stage2_runtime', password:randomBytes(32).toString('base64url') };
  const dev = JSON.parse(readFileSync(`${privateDir}/flespi-dev.json`));
  writeFileSync(`${privateDir}/stage2-fixture-keys.json`, JSON.stringify({ identityPrivateKey:identity.privateKey, transportPrivateKey:transport.privateKey,
    users:['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003'],
    households:['20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002'] }), { mode:0o600, flag:'wx' });
  writeFileSync(`${privateDir}/stage2-backup-key`, randomBytes(32), { mode:0o600, flag:'wx' });
  writeFileSync(configPath, JSON.stringify({ environment:'shopping-stage2-development', audience:'shopping-stage2-dev', db,
    dispatcher:{ user:'shopping_stage2_dispatcher', password:randomBytes(32).toString('base64url') },
    identity:{ issuer:'urn:shopping:dev-fixture-identity', publicKey:identity.publicKey }, transportPublicKey:transport.publicKey,
    resultPrivateKey:result.privateKey, resultPublicKey:result.publicKey,
    mqtt:{ url:dev.broker_url, token:dev.listener_token, expire:dev.expire, clientId:`naf-s2-listener-${randomUUID()}`,
      commands:`shopping-poc/${dev.channel}/commands`, results:`shopping-poc/${dev.channel}/results` }, healthFile:'.stage0-runtime/stage2-health.json' }), { mode:0o600, flag:'wx' });
}
const config = loadConfig(configPath);
const adminOptions = { host:'127.0.0.1', port:55439, database:'postgres', user:'stage0_owner', password:readFileSync(`${privateDir}/admin-password`,'utf8').trim(), max:1, connectionTimeoutMillis:5000 };
const admin = new Pool(adminOptions);
const database = process.argv.includes('--rebuild') ? 'shopping_stage2_rebuild' : 'shopping_stage0';
let target;
try {
  assert.equal((await admin.query('SHOW port')).rows[0].port, '55439');
  for (const [role,password] of [['shopping_stage2_runtime',config.db.password],['shopping_stage2_dispatcher',config.dispatcher.password],['shopping_stage2_owner',null]]) {
    if (!(await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount) {
      assert.ok(password === null || /^[A-Za-z0-9_-]{43}$/.test(password));
      await admin.query(`CREATE ROLE ${role} ${password ? `LOGIN PASSWORD '${password}' CONNECTION LIMIT ${role.endsWith('runtime') ? 6 : 2}` : 'NOLOGIN'} NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`);
    }
    const flags = (await admin.query('SELECT rolsuper,rolcreatedb,rolcreaterole,rolbypassrls FROM pg_roles WHERE rolname=$1',[role])).rows[0];
    assert.ok(Object.values(flags).every(x=>x===false));
  }
  if (database !== 'shopping_stage0') {
    const found = await admin.query("SELECT shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=$1",[database]);
    if (found.rowCount) { assert.equal(found.rows[0].marker,'Shopping Stage2 disposable rebuild'); await admin.query(`DROP DATABASE ${database}`); }
    await admin.query(`CREATE DATABASE ${database} OWNER shopping_stage0_app`);
    await admin.query(`COMMENT ON DATABASE ${database} IS 'Shopping Stage2 disposable rebuild'`);
  }
  target = new Pool({ ...adminOptions, database, max:1 });
  await target.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
  if (database === 'shopping_stage0') await target.query('GRANT CONNECT ON DATABASE shopping_stage0 TO shopping_stage2_runtime,shopping_stage2_dispatcher');
  else await target.query(`REVOKE CONNECT ON DATABASE ${database} FROM PUBLIC`);
  const migrations=[];
  for(const file of readdirSync('backend/migrations').filter(f=>/^\d{3}_.+\.sql$/.test(f)).sort()) {
    const version=Number(file.slice(0,3)),source=readFileSync(`backend/migrations/${file}`,'utf8');
    const checksum=createHash('sha256').update(source).digest('hex');
    const present=(await target.query("SELECT to_regclass('shopping.schema_migrations') AS table_name")).rows[0].table_name;
    const previous=present?(await target.query('SELECT checksum FROM shopping.schema_migrations WHERE version=$1',[version])).rows[0]:null;
    if(previous) assert.equal(previous.checksum,checksum);
    else {
      const c=await target.connect();
      try {await c.query('BEGIN');await c.query(source);await c.query('INSERT INTO shopping.schema_migrations VALUES($1,$2,now())',[version,checksum]);await c.query('COMMIT');}
      catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
    }
    migrations.push({version,file,checksum});
  }
  const fixtures = JSON.parse(readFileSync(`${privateDir}/stage2-fixture-keys.json`));
  for (const id of fixtures.users) await target.query('INSERT INTO shopping.principals(id,issuer,subject) VALUES($1::uuid,$2,$1::text) ON CONFLICT DO NOTHING',[id,config.identity.issuer]);
  for (const [i,id] of fixtures.households.entries()) await target.query('INSERT INTO shopping.households(id,name) VALUES($1,$2) ON CONFLICT DO NOTHING',[id,`Synthetic household ${i+1}`]);
  for (const [h,u,role] of [[0,0,'owner'],[0,1,'member'],[1,2,'owner']]) await target.query('INSERT INTO shopping.household_members(household_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[fixtures.households[h],fixtures.users[u],role]);
  const result = { status:'PASS',database,host:'127.0.0.1',port:55439,migrations,
    schema:(await target.query("SELECT tablename,rowsecurity FROM pg_tables WHERE schemaname='shopping' ORDER BY tablename")).rows,
    identity:'Only synthetic fixture issuer/principals. No production user data or browser sign-in.' };
  writeFileSync(`docs/stage2/${database === 'shopping_stage0' ? 'migration' : 'rebuild'}.json`,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({ status:'PASS',database,migrations:migrations.length }));
} catch(e) {
  writeFileSync(`${privateDir}/stage2-setup-failure.log`,String(e.stack),{mode:0o600});
  console.log(JSON.stringify({ status:'FAIL',code:e.code,type:e.name,detail:'Private setup failure log; no credentials displayed' })); process.exitCode=1;
} finally { await target?.end(); await admin.end(); }
