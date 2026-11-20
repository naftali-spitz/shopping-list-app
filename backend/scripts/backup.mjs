import pg from 'pg';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,renameSync,readdirSync,statSync,unlinkSync,openSync,closeSync,fsyncSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {loadConfig} from '../src/config.mjs';
import {encryptBackup,decryptBackup} from '../src/backup-format.mjs';
loadConfig();process.umask(0o077);
const adminPassword=readFileSync('.stage0-runtime/admin-password','utf8').trim();
const options={host:'127.0.0.1',port:55439,database:'shopping_stage0',user:'stage0_owner',password:adminPassword,max:1,connectionTimeoutMillis:5000};
const pool=new pg.Pool(options),key=readFileSync('.stage0-runtime/stage2-backup-key');assert.equal(key.length,32);
const directory='.stage0-runtime/backups-stage2';mkdirSync(directory,{recursive:true,mode:0o700});
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('PG')));env.PGPASSWORD=adminPassword;
const bin='/usr/lib/postgresql/17/bin';
const args=['-w','-h','127.0.0.1','-p','55439','-U','stage0_owner'];
const tables=['schema_migrations','principals','households','household_members','categories','products','shopping_history','household_invites','operations','result_outbox'];
async function fingerprint(db){
  const out={};for(const t of tables)out[t]=(await db.query(`SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text,'[]')) AS digest,count(*)::int AS rows FROM shopping.${t} t`)).rows[0];return out;
}
const runId=randomUUID();let restorePool;
try{
  const db=await pool.connect();let dump,expected;
  try{
    await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const snapshot=(await db.query('SELECT pg_export_snapshot() AS id')).rows[0].id;
    expected=await fingerprint(db);
    dump=execFileSync(`${bin}/pg_dump`,[...args,'-d','shopping_stage0','-Fc',`--snapshot=${snapshot}`],{env,maxBuffer:64*1024*1024,stdio:['ignore','pipe','pipe']});
    await db.query('COMMIT');
  }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
  const metadata={database:'shopping_stage0',port:55439,created_at:new Date().toISOString(),fingerprints:expected};
  const plain=Buffer.concat([Buffer.from(JSON.stringify(metadata)+'\n'),dump]);
  const encrypted=encryptBackup(plain,key);
  const name=`shopping-stage2-${new Date().toISOString().replace(/[:.]/g,'-')}-${runId}.s2enc`;
  const file=`${directory}/${name}`;
  writeFileSync(`${file}.partial`,encrypted,{mode:0o600,flag:'wx'});
  const fd=openSync(`${file}.partial`,'r');fsyncSync(fd);closeSync(fd);renameSync(`${file}.partial`,file);
  const dirFd=openSync(directory,'r');fsyncSync(dirFd);closeSync(dirFd);
  const result={status:'PASS',encrypted_backup:name,encryption:'AES-256-GCM authenticated before restore',source_database:'shopping_stage0',port:55439,
    retention:'7 encrypted local backups',off_host_copy:false,key_location:'owner-only co-located runtime; does not cover host/disk loss',actual_postgresql:true};
  if(process.argv.includes('--verify')){
    const corrupted=Buffer.from(encrypted);corrupted[corrupted.length-1]^=1;
    assert.throws(()=>decryptBackup(corrupted,key));assert.throws(()=>decryptBackup(encrypted,Buffer.alloc(32)));
    const decoded=decryptBackup(readFileSync(file),key),split=decoded.indexOf(10);
    const manifest=JSON.parse(decoded.subarray(0,split));assert.equal(manifest.database,'shopping_stage0');assert.equal(manifest.port,55439);
    const master=new pg.Pool({...options,database:'postgres'});
    try{
      const existing=await master.query("SELECT shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname='shopping_stage2_restore'");
      if(existing.rowCount){assert.equal(existing.rows[0].marker,'Shopping Stage2 disposable restore');await master.query('DROP DATABASE shopping_stage2_restore');}
      await master.query('CREATE DATABASE shopping_stage2_restore OWNER shopping_stage0_app');
      await master.query("COMMENT ON DATABASE shopping_stage2_restore IS 'Shopping Stage2 disposable restore'");
      await master.query('REVOKE CONNECT ON DATABASE shopping_stage2_restore FROM PUBLIC');
    }finally{await master.end();}
    execFileSync(`${bin}/pg_restore`,[...args,'-d','shopping_stage2_restore','--no-owner','--exit-on-error'],{env,input:decoded.subarray(split+1),maxBuffer:8*1024*1024,stdio:['pipe','pipe','pipe']});
    restorePool=new pg.Pool({...options,database:'shopping_stage2_restore'});
    const actual=await fingerprint(restorePool);assert.deepEqual(actual,manifest.fingerprints);
    result.restore_database='shopping_stage2_restore';result.fingerprints=actual;result.integrity_match=true;
    result.tampered_ciphertext_rejected_before_restore=true;result.wrong_key_rejected_before_restore=true;
    writeFileSync(`docs/stage2/attempts/backup-${runId}.json`,JSON.stringify(result,null,2)+'\n');
  }
  const backups=readdirSync(directory).filter(n=>/^shopping-stage2-.*\.s2enc$/.test(n)&&statSync(`${directory}/${n}`).isFile()).sort();
  for(const old of backups.slice(0,-7))unlinkSync(`${directory}/${old}`);
  console.log(JSON.stringify(result));
}catch(e){
  writeFileSync(`.stage0-runtime/stage2-backup-failure-${runId}.log`,String(e.stack),{mode:0o600});
  const result={status:'FAIL',run_id:runId,error_type:e.name,error_code:e.code};
  writeFileSync(`docs/stage2/attempts/backup-${runId}.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));process.exitCode=1;
}finally{await restorePool?.end();await pool.end();}
