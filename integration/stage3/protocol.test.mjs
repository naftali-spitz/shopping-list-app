import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { authenticateCommand, signCommand, signed, validateCommand, verifyCallback, verifyProgress, logicalHash, COMMAND_AUDIENCE, CALLBACK_ISSUER, CALLBACK_AUDIENCE } from './protocol.mjs';
import { verifyDevelopmentIdentity, DEV_ISSUER } from './identity.mjs';
const transport = generateKeyPairSync('ed25519'), resultKey = generateKeyPairSync('ed25519');
const keys = { 'command-1': transport.publicKey }, callbackKeys = { 'callback-1': resultKey.publicKey };
const now = Date.now(), user = randomUUID(), household = randomUUID();
const context = { user_id:user, household_id:household };
const intent = () => ({ id:randomUUID(), household_id:household, type:'product.update', payload:{id:randomUUID(), quantity:2}, expected_version:1, correlation_id:randomUUID(), issued_ms:now, expires_ms:now+300000 });
const make = (i = intent(), ctx = context) => signCommand(i, ctx, 'real.provider.token', {kid:'command-1',privateKey:transport.privateKey});
const resign = c => { const body={...c};delete body.signature; return signed(body,transport.privateKey); };

test('signed intent binds every field; parser rejects tampering and unknown fields', () => {
  const command = make(); validateCommand(command,keys,now);
  for (const [field,value] of Object.entries({user_id:randomUUID(),household_id:randomUUID(),correlation_id:randomUUID(),payload:{id:command.payload.id,quantity:3},expires_ms:now+1000,identity:'forged'})) {
    assert.throws(() => validateCommand({...command,[field]:value},keys,now));
  }
  assert.throws(() => validateCommand(resign({...command,role:'owner'}),keys,now));
  assert.throws(() => signCommand({...intent(),user_id:randomUUID()},context,'a.b.c',{kid:'command-1',privateKey:transport.privateKey}));
});
test('expiry, audience, issuer, schema and payload checks cannot be bypassed with a valid signer', () => {
  const c = make();
  for (const patch of [{v:1},{aud:'production'},{iss:'fixture'},{issued_ms:now+5000},{expires_ms:now+300001},{expected_version:0},{type:'unsafe'},{payload:{id:c.payload.id,quantity:-1}},{payload:{id:c.payload.id,quantity:2,role:'owner'}}]) assert.throws(() => validateCommand(resign({...c,...patch}),keys,now));
  // Expired intents remain authenticatable for prior-result retrieval; the
  // transactional ledger, not signature parsing, enforces write admission.
  validateCommand(c,keys,now+400000);
});
test('key rotation preserves logical hash; removing old key revokes its signature', () => {
  const c = make(), next = generateKeyPairSync('ed25519');
  const rotated = {...c,kid:'command-2',identity:'renewed.provider.token'};
  const body={...rotated};delete body.signature;
  const newCommand=signed(body,next.privateKey);
  validateCommand(newCommand,{'command-2':next.publicKey},now);
  assert.equal(logicalHash(c),logicalHash(newCommand));
  assert.throws(() => validateCommand(c,{'command-2':next.publicKey},now));
  assert.notEqual(logicalHash(c),logicalHash({...c,payload:{...c.payload,quantity:3}}));
});
test('execution requires current identity and household verification, including revocation', async () => {
  const c=make(); let active=true,calls=0;
  const config={commandKeys:keys,verifyIdentity:async(token,h)=>{calls++; assert.equal(token,c.identity);assert.equal(h,household);if(!active)throw new Error('revoked');return context;}};
  assert.equal((await authenticateCommand(c,config,now)).context.user_id,user);
  active=false; await assert.rejects(()=>authenticateCommand(c,config,now)); assert.equal(calls,2);
  await assert.rejects(()=>authenticateCommand(c,{commandKeys:keys},now));
  await assert.rejects(()=>authenticateCommand(c,{commandKeys:keys,verifyIdentity:async()=>({...context,user_id:randomUUID()})},now));
});
test('callback identity is separate; callback tuple, timestamp and schema are verified', () => {
  const c=make(), r={operation_id:c.id,household_id:household,user_id:user,correlation_id:c.correlation_id,audience:COMMAND_AUDIENCE,status:'committed',data:{record:{id:c.payload.id,version:2,created_at:new Date(now)}}};
  const body={v:2,kind:'operation-result',kid:'callback-1',iss:CALLBACK_ISSUER,aud:CALLBACK_AUDIENCE,issued_ms:now,delivery_id:randomUUID(),result:r};
  const cb=signed(body,resultKey.privateKey);assert.deepEqual(verifyCallback(cb,callbackKeys,c,now),r);
  assert.equal(verifyCallback(JSON.parse(JSON.stringify(cb)),callbackKeys,c,now).data.record.created_at,new Date(now).toISOString());
  assert.throws(()=>verifyCallback(cb,keys,c,now));
  for(const patch of [{household_id:randomUUID()},{user_id:randomUUID()},{correlation_id:randomUUID()},{operation_id:randomUUID()},{status:'saved'}])assert.throws(()=>verifyCallback(signed({...body,result:{...r,...patch}},resultKey.privateKey),callbackKeys,c,now));
  for(const patch of [{aud:'production'},{iss:'vercel'},{issued_ms:now-60001},{issued_ms:now+1001}])assert.throws(()=>verifyCallback(signed({...body,...patch},resultKey.privateKey),callbackKeys,c,now));
});
test('provider adapter pins URLs and requires current session RPC as well as getUser', async () => {
  const sid=randomUUID(),urls=[];
  const fetcher=async(url,options)=>{urls.push(url);assert.equal(options.cache,'no-store');assert.equal(options.redirect,'error');return Response.json(url.endsWith('/user')?{id:user,is_anonymous:false,email_confirmed_at:'today'}:{...context,session_id:sid,issuer:DEV_ISSUER,role:'member'});};
  assert.equal((await verifyDevelopmentIdentity('a.b.c',household,{publishableKey:'sb_publishable_test',fetcher})).user_id,user);
  assert.equal(urls.length,2);assert.ok(urls.every(url=>url.startsWith('https://njomxqthjglqesxchlbm.supabase.co/')));
  await assert.rejects(()=>verifyDevelopmentIdentity('a.b.c',household,{publishableKey:'sb_publishable_test',fetcher:async()=>new Response(null,{status:401})}));
  await assert.rejects(()=>verifyDevelopmentIdentity('a.b.c',household,{publishableKey:'sb_publishable_test',fetcher:async url=>url.endsWith('/user')?Response.json({id:user,is_anonymous:false,email_confirmed_at:'today'}):new Response(null,{status:403})}));
});
test('diagnostic progress is separately signed, time bounded and cannot claim terminal success',()=>{
  const p={v:2,kind:'operation-progress',kid:'callback-1',iss:CALLBACK_ISSUER,aud:CALLBACK_AUDIENCE,issued_ms:now,delivery_id:randomUUID(),operation_id:randomUUID(),user_id:user,household_id:household,correlation_id:randomUUID(),state:'processing'};
  verifyProgress(signed(p,resultKey.privateKey),callbackKeys,now);
  for(const patch of [{state:'committed'},{aud:'production'},{issued_ms:now-60001},{user_id:'forged'}])assert.throws(()=>verifyProgress(signed({...p,...patch},resultKey.privateKey),callbackKeys,now));
  assert.throws(()=>verifyProgress(signed(p,transport.privateKey),callbackKeys,now));
});
test('Stage4 verifies the same live session but makes no provider business-membership claim',async()=>{
  const urls=[],sid=randomUUID();
  const fetcher=async url=>{urls.push(url);return Response.json(url.endsWith('/user')?{id:user,is_anonymous:false,email_confirmed_at:'today'}:{user_id:user,session_id:sid,issuer:DEV_ISSUER});};
  const verified=await verifyDevelopmentIdentity('a.b.c',household,{publishableKey:'sb_publishable_test',fetcher,sessionOnly:true});
  assert.equal(verified.household_id,household);assert.equal(verified.user_id,user);assert.equal(verified.role,undefined);
  assert.ok(urls[1].endsWith('/stage4_dev_session_context'));
  await assert.rejects(()=>verifyDevelopmentIdentity('a.b.c',household,{publishableKey:'sb_publishable_test',fetcher}));
  await assert.rejects(()=>verifyDevelopmentIdentity('a.b.c',household,{publishableKey:'sb_publishable_test',sessionOnly:true,fetcher:async url=>url.endsWith('/user')?fetcher(url):new Response(null,{status:403})}));
});
test('Stage4 operation prefix preserves strict legacy payload validation and signed identity dispatch',async()=>{
  const i={...intent(),type:'stage4.product.update'},c=make(i);validateCommand(c,keys,now);
  let seen;
  await authenticateCommand(c,{commandKeys:keys,verifyIdentity:async(t,h,type)=>{seen=type;return context;}},now);
  assert.equal(seen,'stage4.product.update');
  for(const patch of [{type:'stage4.stage4.product.update'},{type:'stage4.product.update',payload:{id:c.payload.id,quantity:-1}},{type:'stage4.household.create',payload:{name:'Good',user_id:user},expected_version:0}])assert.throws(()=>validateCommand(resign({...c,...patch}),keys,now));
});
