import assert from 'node:assert/strict';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { Store } from '../src/store.mjs';
import { config,keys,user,member,foreignUser,household,foreignHousehold,make,resign } from './fixtures.mjs';
import { identityToken } from '../src/protocol.mjs';
const admin=new pg.Pool({host:'127.0.0.1',port:55439,database:'shopping_stage0',user:'stage0_owner',password:readFileSync('.stage0-runtime/admin-password','utf8').trim(),max:1});
const store=new Store(config),checks=[],runId=randomUUID();
mkdirSync('docs/stage2/attempts',{recursive:true});
let status='PASS',error;
async function check(name,fn) { await fn(); checks.push({test:name,passed:true,actual_postgresql:true}); console.log(JSON.stringify({test:name,passed:true})); }
const execute=(t,p,e)=>store.execute(make(t,p,e));
const snapshot=async(extra={})=>(await execute('snapshot',{},extra)).data;
let category,product,created;
try {
  await check('least-privilege runtime and database targets',async()=>{
    const c=await store.pool.connect();
    try {
      const row=(await c.query('SELECT current_user,current_database(),inet_server_port() AS port')).rows[0];
      assert.equal(row.current_user,'shopping_stage2_runtime');assert.equal(row.current_database,'shopping_stage0');assert.equal(row.port,55439);
      await assert.rejects(c.query('CREATE TABLE shopping.must_be_denied(id int)'));
      await assert.rejects(c.query('SET ROLE stage0_owner'));
      await assert.rejects(c.query('SET ROLE shopping_stage2_owner'));
      await assert.rejects(c.query("UPDATE shopping.operations SET result='{}'::jsonb"));
      await assert.rejects(c.query("UPDATE shopping.shopping_history SET items='[]'::jsonb"));
      assert.equal((await c.query('SELECT count(*) FROM shopping.products')).rows[0].count,'0');
    }finally{c.release();}
  });
  await check('normal category/product create, checked/quantity/order updates and snapshot',async()=>{
    category=randomUUID();product=randomUUID();
    assert.equal((await execute('category.create',{id:category,name:'Synthetic category',icon:'general'})).status,'committed');
    created=make('product.create',{id:product,name:'Synthetic milk',category_id:category,checked:true,quantity:2,display_order:3});
    assert.equal((await store.execute(created)).status,'committed');
    const row=(await snapshot()).products.find(p=>p.id===product);assert.equal(Number(row.quantity),2);assert.equal(row.checked,true);assert.equal(row.display_order,3);
  });
  await check('twenty concurrent duplicates cause exactly one durable effect/result/outbox',async()=>{
    const id=randomUUID(), command=make('product.create',{id,category_id:category,name:'Duplicate fixture'});
    const replies=await Promise.all(Array.from({length:20},()=>store.execute(command)));
    assert.ok(replies.every(r=>r.status==='committed'));assert.equal(replies.filter(r=>r.replayed).length,19);
    assert.equal((await admin.query('SELECT count(*) FROM shopping.products WHERE id=$1',[id])).rows[0].count,'1');
    for(const table of ['operations','result_outbox']) assert.equal((await admin.query(`SELECT count(*) FROM shopping.${table} WHERE ${table==='operations'?'id':'operation_id'}=$1`,[command.id])).rows[0].count,'1');
  });
  await check('lost response retry returns authoritative result; conflicting ID/payload rejected',async()=>{
    const a=await store.execute(created);assert.equal(a.replayed,true);
    const conflict=await store.execute(resign(created,{payload:{...created.payload,quantity:7}}));assert.equal(conflict.status,'operation_id_conflict');
    assert.equal(Number((await snapshot()).products.find(p=>p.id===product).quantity),2);
    const lookup=await execute('operation.status',{operation_id:created.id});assert.equal(lookup.status,'found');assert.deepEqual(lookup.data.data,a.data);
  });
  await check('out-of-order/stale writes rejected; concurrent different users cannot overwrite versions',async()=>{
    assert.equal((await execute('product.update',{id:product,quantity:7},{expected_version:1})).status,'committed');
    const stale=make('product.update',{id:product,quantity:1},{expected_version:1});
    assert.equal((await store.execute(stale)).status,'version_conflict');
    const replies=await Promise.all([execute('product.update',{id:product,quantity:8},{expected_version:2}),execute('product.update',{id:product,quantity:9},{expected_version:2,user_id:member})]);
    assert.deepEqual(replies.map(r=>r.status).sort(),['committed','version_conflict']);
    assert.equal(Number((await snapshot()).products.find(p=>p.id===product).version),3);
    const prior=await store.execute(stale);assert.equal(prior.replayed,true);assert.equal(prior.status,'version_conflict');
  });
  await check('current household permissions, foreign IDs, principal binding and revoked membership',async()=>{
    assert.equal((await execute('snapshot',{}, {household_id:foreignHousehold})).status,'forbidden');
    assert.equal((await execute('operation.status',{operation_id:created.id},{user_id:member})).status,'not_found');
    await admin.query('UPDATE shopping.household_members SET active=false WHERE household_id=$1 AND user_id=$2',[household,member]);
    try {assert.equal((await execute('snapshot',{}, {user_id:member})).status,'forbidden');}finally{await admin.query('UPDATE shopping.household_members SET active=true WHERE household_id=$1 AND user_id=$2',[household,member]);}
    const foreignCategory=randomUUID();assert.equal((await execute('category.create',{id:foreignCategory,name:'Foreign fixture'},{household_id:foreignHousehold,user_id:foreignUser})).status,'committed');
    assert.equal((await execute('product.update',{id:product,category_id:foreignCategory},{expected_version:3})).status,'not_found');
    await assert.rejects(store.execute(resign(created,{user_id:member})));
  });
  await check('signed invalid/expired commands and invalid/expired identity never mutate data',async()=>{
    const before=(await snapshot()).household.version;
    const expired=make('product.update',{id:product,quantity:15},{expected_version:3,issued_ms:Date.now()-4000,expires_ms:Date.now()-2000});
    assert.equal((await store.execute(expired)).status,'expired');
    await assert.rejects(store.execute(make('product.update',{id:product,quantity:-1},{expected_version:3})));
    await assert.rejects(store.execute({...created,signature:''}));
    await assert.rejects(store.execute(make('snapshot',{}, {identity:identityToken(user,keys.identityPrivateKey,config.identity.issuer,Date.now()-7200000)})));
    assert.equal((await snapshot()).household.version,before);
  });
  await check('membership revocation waits for an admitted transaction, then denies later access',async()=>{
    let release,entered;
    const hold=new Promise(r=>{release=r;}),admitted=new Promise(r=>{entered=r;});
    const command=make('product.create',{id:randomUUID(),name:'Revocation lock fixture',category_id:category},{user_id:member});
    const mutation=store.execute(command,{beforeCommit:async()=>{entered();await hold;}});
    await admitted;
    let revoked=false;
    const revoke=admin.query('UPDATE shopping.household_members SET active=false WHERE household_id=$1 AND user_id=$2',[household,member]).then(()=>{revoked=true;});
    try {
      await new Promise(r=>setTimeout(r,100));assert.equal(revoked,false);
      release();assert.equal((await mutation).status,'committed');await revoke;
      assert.equal((await execute('operation.status',{operation_id:command.id},{user_id:member})).status,'forbidden');
    }finally{release();await revoke;await admin.query('UPDATE shopping.household_members SET active=true WHERE household_id=$1 AND user_id=$2',[household,member]);}
  });
  await check('transaction failure rolls back business change, household version, ledger and outbox',async()=>{
    const id=randomUUID(), command=make('product.create',{id,name:'Must roll back',category_id:category});
    const before=(await snapshot()).household.version;
    await assert.rejects(store.execute(command,{beforeCommit:()=>{throw new Error('injected_before_commit');}}));
    assert.equal((await admin.query('SELECT count(*) FROM shopping.products WHERE id=$1',[id])).rows[0].count,'0');
    assert.equal((await admin.query('SELECT count(*) FROM shopping.operations WHERE id=$1',[command.id])).rows[0].count,'0');
    assert.equal((await snapshot()).household.version,before);
    assert.equal((await store.execute(command)).status,'committed');
  });
  await check('atomic export/history/restore and household-safe history usage counts',async()=>{
    let snap=await snapshot();const hid=randomUUID(), command=make('list.export',{history_id:hid},{expected_version:Number(snap.household.version)});
    assert.equal((await store.execute(command)).status,'committed');assert.equal((await store.execute(command)).replayed,true);
    snap=await snapshot();assert.equal(snap.shopping_history.filter(h=>h.id===hid).length,1);assert.equal(snap.products.find(p=>p.id===product).checked,false);
    assert.equal((await execute('list.restore',{product_ids:[product]},{expected_version:Number(snap.household.version)})).status,'committed');
    assert.equal((await execute('history.delete',{id:hid},{expected_version:1})).status,'committed');
    assert.equal((await snapshot()).products.find(p=>p.id===product).usage_count,0);
    const fakeHistory=randomUUID();
    await admin.query('INSERT INTO shopping.shopping_history(id,household_id,items) VALUES($1,$2,$3)',[fakeHistory,household,JSON.stringify([{id:randomUUID()}])]);
    assert.equal((await execute('history.delete',{id:fakeHistory},{expected_version:1})).status,'committed');
  });
  await check('record deletion uses tombstones; retries and stale IDs cannot recreate committed rows',async()=>{
    const row=(await snapshot()).products.find(p=>p.id===product);
    const command=make('product.delete',{id:product},{expected_version:Number(row.version)});
    assert.equal((await store.execute(command)).status,'committed');assert.equal((await store.execute(command)).replayed,true);
    assert.equal((await execute('product.create',{id:product,name:'Reused ID',category_id:category})).status,'record_id_conflict');
    assert.equal((await snapshot()).products.some(p=>p.id===product),false);
  });
  await check('business uniqueness failure rolls back partial export but durably records rejection',async()=>{
    const snap=await snapshot(),hid=snap.shopping_history[0]?.id??randomUUID();
    if(!snap.shopping_history.length)await admin.query('INSERT INTO shopping.shopping_history(id,household_id,items) VALUES($1,$2,$3)',[hid,household,'[]']);
    const before=(await snapshot()).products;
    const command=make('list.export',{history_id:hid},{expected_version:Number(snap.household.version)});
    const result=await store.execute(command);assert.equal(result.status,'record_id_conflict');
    assert.deepEqual((await snapshot()).products,before);assert.equal((await store.execute(command)).replayed,true);
    assert.equal((await admin.query('SELECT result->>\'status\' AS status FROM shopping.operations WHERE id=$1',[command.id])).rows[0].status,'record_id_conflict');
  });
} catch(e) {status='FAIL';error={type:e.name,code:e.code};writeFileSync(`.stage0-runtime/stage2-integration-${runId}.log`,String(e.stack),{mode:0o600});}
finally {
  await store.close();await admin.end();
  const report={status,run_id:runId,tested_at:new Date().toISOString(),database:'shopping_stage0',port:55439,actual_postgresql:true,identity:'Cryptographically verified synthetic issuer only; no real Google/browser sign-in.',checks,error};
  writeFileSync(`docs/stage2/attempts/integration-${runId}.json`,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));if(status!=='PASS')process.exitCode=1;
}
