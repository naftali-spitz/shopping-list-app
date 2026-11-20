import { Pool } from 'pg';
import assert from 'node:assert/strict';
import { readFileSync,writeFileSync,existsSync } from 'node:fs';
import { randomUUID,generateKeyPairSync } from 'node:crypto';
import { loadConfig } from '../src/config.mjs';
import { COMMAND_AUDIENCE } from '../../integration/stage3/protocol.mjs';
import { DEV_ISSUER,DEV_SUPABASE } from '../../integration/stage3/identity.mjs';
loadConfig();
const accounts=JSON.parse(readFileSync('.stage0-runtime/stage3-accounts.json'));
const state=JSON.parse(readFileSync('.stage0-runtime/stage3-auth-state.json'));
const {variables}=JSON.parse(readFileSync('.stage0-runtime/vercel-dev-input.json'));
assert.equal(variables.NEXT_PUBLIC_SUPABASE_URL,DEV_SUPABASE);
const pair=()=>{const p=generateKeyPairSync('ed25519');return {publicKey:p.publicKey.export({format:'pem',type:'spki'}),privateKey:p.privateKey.export({format:'pem',type:'pkcs8'})};};
if(!existsSync('.stage0-runtime/stage3-config.json')) {
  const transport=pair(),result=pair();
  // The listener never needs the Vercel private command key.
  writeFileSync('.stage0-runtime/stage3-vercel-keys.json',JSON.stringify({kid:'command-1',privateKey:transport.privateKey}),{mode:0o600,flag:'wx'});
  writeFileSync('.stage0-runtime/stage3-config.json',JSON.stringify({environment:'shopping-stage3-development',protocolVersion:2,
    audience:COMMAND_AUDIENCE,identity:{issuer:DEV_ISSUER},publishableKey:variables.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    commandKeys:{'command-1':transport.publicKey},resultPrivateKey:result.privateKey,resultPublicKey:result.publicKey,
    clientId:`naf-s3-listener-${randomUUID()}`}),{mode:0o600,flag:'wx'});
}
const pool=new Pool({host:'127.0.0.1',port:55439,database:'shopping_stage0',user:'stage0_owner',password:readFileSync('.stage0-runtime/admin-password','utf8').trim(),max:1});
try {
  const db=await pool.connect();
  try {
    await db.query('BEGIN');
    assert.equal((await db.query('SHOW port')).rows[0].port,'55439');
    for(const a of accounts)await db.query('INSERT INTO shopping.principals(id,issuer,subject) VALUES($1::uuid,$2,$1::text) ON CONFLICT DO NOTHING',[a.id,DEV_ISSUER]);
    for(const [i,h] of state.households.entries())await db.query('INSERT INTO shopping.households(id,name) VALUES($1,$2) ON CONFLICT DO NOTHING',[h,`Stage 3 development ${i+1}`]);
    for(const [h,u,role] of [[0,0,'owner'],[0,1,'member'],[1,2,'owner']])await db.query('INSERT INTO shopping.household_members(household_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[state.households[h],accounts[u].id,role]);
    await db.query('COMMIT');
  } catch(e){await db.query('ROLLBACK');throw e;} finally{db.release();}
  console.log(JSON.stringify({status:'PASS',database:'shopping_stage0',port:55439,principals:3,households:2,issuer:DEV_ISSUER}));
} finally {await pool.end();}
