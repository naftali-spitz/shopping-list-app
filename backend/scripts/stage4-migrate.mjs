import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import pg from 'pg';
import {loadStage3Config} from '../src/stage3-config.mjs';
execFileSync(process.execPath,['scripts/stage0-preflight.mjs'],{stdio:['ignore','ignore','pipe']});
loadStage3Config();
const report={id:randomUUID(),at:new Date().toISOString(),scope:'additive isolated127.0.0.1:55439/shopping_stage0 migrations only; no fixture provisioning',migrations:[]};
const db=new pg.Client({host:'127.0.0.1',port:55439,database:'shopping_stage0',user:'stage0_owner',password:readFileSync('.stage0-runtime/admin-password','utf8').trim(),connectionTimeoutMillis:5000});
try {
  await db.connect();assert.equal((await db.query('SHOW port')).rows[0].port,'55439');
  assert.equal((await db.query('SELECT current_database() AS name')).rows[0].name,'shopping_stage0');
  for(const file of readdirSync('backend/migrations').filter(n=>/^\d{3}_.*\.sql$/.test(n)).sort()) {
    const version=Number(file.slice(0,3)),source=readFileSync('backend/migrations/'+file,'utf8'),checksum=createHash('sha256').update(source).digest('hex');
    const previous=(await db.query('SELECT checksum FROM shopping.schema_migrations WHERE version=$1',[version])).rows[0];
    if(previous){assert.equal(previous.checksum,checksum);continue;}
    assert.ok(version>=5,'Refuse to initialize or recreate earlier infrastructure');
    await db.query('BEGIN');
    try {await db.query(source);await db.query('INSERT INTO shopping.schema_migrations VALUES($1,$2,now())',[version,checksum]);await db.query('COMMIT');}
    catch(error){await db.query('ROLLBACK');throw error;}
    report.migrations.push({file,version,checksum});
  }
  report.status='PASS';
}catch(error){report.status='FAIL';report.error={code:error.code,type:error.name,message:'Additive migration failed; no secret diagnostics printed'};process.exitCode=1;}
finally{await db.end();mkdirSync('docs/stage4/attempts',{recursive:true});writeFileSync(`docs/stage4/attempts/migrations-${report.id}.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));}
