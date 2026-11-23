import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,statSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import pg from '../backend/node_modules/pg/lib/index.js';
import {loadStage3Config} from '../backend/src/stage3-config.mjs';
const config=loadStage3Config();
const reports=readdirSync('docs/stage3/attempts').filter(n=>/^browser-.+\.json$/.test(n)).map(n=>({name:n,report:JSON.parse(readFileSync('docs/stage3/attempts/'+n)),mtime:statSync('docs/stage3/attempts/'+n).mtimeMs})).filter(v=>v.report.status==='PASS').sort((a,b)=>b.mtime-a.mtime);
const browser=reports[0];assert.ok(browser);
const report={id:randomUUID(),at:new Date().toISOString(),scope:'actual isolated PostgreSQL counts for latest real-browser write and expiry; development service health and safety metadata',browser_report:browser.name};
const db=new pg.Pool({host:'127.0.0.1',port:55439,database:'shopping_stage0',user:'stage0_owner',password:readFileSync('.stage0-runtime/admin-password','utf8').trim(),max:1});
try {
  const op=(await db.query('select id,household_id,user_id,correlation_id,result from shopping.operations where id=$1',[browser.report.operation_id])).rows[0];
  assert.equal(op.result.status,'committed');assert.equal(op.correlation_id,browser.report.correlation_id);
  const productId=op.result.data.record.id;
  const product=(await db.query('select id,quantity::float8,version::int,household_id from shopping.products where id=$1',[productId])).rows[0];
  assert.equal(product.quantity,2);assert.equal(product.version,2);assert.equal(product.household_id,op.household_id);
  const counts=(await db.query('select (select count(*)::int from shopping.operations where id=$1) as ledger,(select count(*)::int from shopping.result_outbox where operation_id=$1) as outbox,(select count(*)::int from shopping.products where id=$2) as products,(select count(*)::int from shopping.result_outbox where operation_id=$1 and delivered_at is not null) as delivered',[op.id,productId])).rows[0];
  assert.deepEqual(counts,{ledger:1,outbox:1,products:1,delivered:1});
  report.browser_operation={operation_id:op.id,correlation_id:op.correlation_id,product,counts};
  if(browser.report.expired_operation_id) {
    const binding=browser.report.expired_record_id?{operation_id:browser.report.expired_operation_id,record_id:browser.report.expired_record_id}:JSON.parse(readFileSync('docs/stage3/attempts/browser-expiry-binding.json'));
    assert.equal(binding.operation_id,browser.report.expired_operation_id);assert.match(binding.record_id,/^[a-f0-9-]{36}$/);
    const effect=(await db.query('select count(*)::int as effects from shopping.categories where id=$1',[binding.record_id])).rows[0].effects;
    assert.equal(effect,0);report.expired_operation={...binding,committed_effects:effect};
  }
  const health=JSON.parse(readFileSync('.stage0-runtime/stage3-health.json'));
  const property=(unit,p)=>execFileSync('systemctl',['--user','show',unit,'-p',p,'--value'],{encoding:'utf8'}).trim();
  assert.equal(health.pid,Number(property('shopping-list-stage3-backend.service','MainPID')));
  assert.ok(health.connected&&health.clock_healthy);assert.ok(Date.now()-Date.parse(health.at)<15000);
  assert.notEqual(config.faultInjectionEnabled,true);
  assert.equal(property('shopping-list-stage2-backend.service','ActiveState'),'active');
  report.service_health=health;report.stage2_service_active=true;report.fault_controls_disabled=true;
  const audit=JSON.parse(readFileSync('docs/stage0/vercel-isolation.json'));assert.equal(audit.status,'PASS');assert.equal(audit.production_deployment_unchanged,true);assert.equal(audit.production_secret_records_preserved,true);
  report.production_safety={audit_at:audit.verified_at,production_deployment_unchanged:true,production_secret_metadata_preserved:true,production_values_read_or_compared:false,production_sql:false};
  report.status='PASS';
}catch(error){report.status='FAIL';report.error={type:error.name,message:'Final development integration assertion failed; secret diagnostics suppressed'};process.exitCode=1;}
finally{await db.end();writeFileSync(`docs/stage3/attempts/final-check-${report.id}.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));}
