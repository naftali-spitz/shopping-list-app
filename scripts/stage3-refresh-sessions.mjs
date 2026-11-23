import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {DEV_SUPABASE} from '../integration/stage3/identity.mjs';
const accounts=JSON.parse(readFileSync('.stage0-runtime/stage3-accounts.json'));
const {variables}=JSON.parse(readFileSync('.stage0-runtime/vercel-dev-input.json'));
assert.equal(variables.NEXT_PUBLIC_SUPABASE_URL,DEV_SUPABASE);
const sessions=[];
for(const a of accounts){const r=await fetch(DEV_SUPABASE+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:variables.NEXT_PUBLIC_SUPABASE_ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:a.email,password:a.password}),signal:AbortSignal.timeout(10000)});assert.ok(r.ok);const s=await r.json();assert.equal(s.user.id,a.id);sessions.push(s);}
writeFileSync('.stage0-runtime/stage3-sessions.json',JSON.stringify(sessions),{mode:0o600});
console.log(JSON.stringify({status:'PASS',sessions:sessions.length,credentials:'excluded owner-only file'}));
