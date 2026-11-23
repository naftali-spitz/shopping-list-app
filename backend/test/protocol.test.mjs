import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,randomUUID,randomBytes} from 'node:crypto';
import {authenticate,signEnvelope,identityToken,validateOperation} from '../src/protocol.mjs';
import {encryptBackup,decryptBackup} from '../src/backup-format.mjs';
import {assertDatabaseTarget} from '../src/config.mjs';
const identity=generateKeyPairSync('ed25519'),transport=generateKeyPairSync('ed25519');
const config={audience:'shopping-stage2-dev',transportPublicKey:transport.publicKey,identity:{issuer:'urn:shopping:dev-fixture-identity',publicKey:identity.publicKey}};
const user=randomUUID(),household=randomUUID();
function command(changes={}){const now=Date.now();return {v:1,kid:'transport-v1',aud:config.audience,id:randomUUID(),user_id:user,household_id:household,type:'product.create',payload:{id:randomUUID(),category_id:randomUUID(),name:'Fixture'},expected_version:0,correlation_id:randomUUID(),issued_ms:now,expires_ms:now+300000,identity:identityToken(user,identity.privateKey,config.identity.issuer),...changes};}
const sign=c=>signEnvelope(c,transport.privateKey);
test('canonical logical binding survives key ordering/identity refresh but detects changed intent',()=>{
  const c=command(),first=authenticate(sign(c),config);
  const reordered=Object.fromEntries(Object.entries(c).reverse());assert.equal(authenticate(sign(reordered),config).hash,first.hash);
  const renewed={...c,identity:identityToken(user,identity.privateKey,config.identity.issuer,Date.now()-1000)};
  assert.equal(authenticate(sign(renewed),config).hash,first.hash);
  assert.notEqual(authenticate(sign({...c,payload:{...c.payload,name:'Different'}}),config).hash,first.hash);
});
test('transport tampering, wrong audience, unknown key and identity substitution rejected',()=>{
  const c=command(),signed=sign(c);
  for(const altered of [{...signed,household_id:randomUUID()},{...signed,signature:''},sign({...c,aud:'foreign'}),sign({...c,kid:'unknown'}),sign({...c,user_id:randomUUID()})])assert.throws(()=>authenticate(altered,config));
  const unknown=generateKeyPairSync('ed25519');assert.throws(()=>authenticate(signEnvelope(c,unknown.privateKey),config));
});
test('identity issuer/audience/signature/expiry and operation validity bounds enforced',()=>{
  for(const changes of [{identity:identityToken(user,identity.privateKey,'foreign')},{identity:identityToken(user,identity.privateKey,config.identity.issuer,Date.now()-7200000)},{issued_ms:Date.now()+5000},{expires_ms:Date.now()+400000}])assert.throws(()=>authenticate(sign(command(changes)),config));
  const c=command();const jwt=c.identity.split('.');jwt[0]=Buffer.from(JSON.stringify({alg:'none',kid:'fixture-identity-v1',typ:'JWT'})).toString('base64url');assert.throws(()=>authenticate(sign({...c,identity:jwt.join('.')}),config));
});
test('typed payload rejects injection columns, invalid quantity and missing versions',()=>{
  const c=command();validateOperation(c);
  for(const changed of [{...c,payload:{...c.payload,'name=now()':'x'}},{...c,payload:{...c.payload,quantity:-2}},{...c,type:'product.update',expected_version:null},{...c,type:'unsupported'}])assert.throws(()=>validateOperation(changed));
});
test('encrypted backups authenticate ciphertext before returning any plaintext',()=>{
  const key=randomBytes(32),plain=Buffer.from('Synthetic database dump');const a=encryptBackup(plain,key),b=encryptBackup(plain,key);
  assert.deepEqual(decryptBackup(a,key),plain);assert.notDeepEqual(a,b);
  const changed=Buffer.from(a);changed[changed.length-1]^=1;
  assert.throws(()=>decryptBackup(changed,key));assert.throws(()=>decryptBackup(a,randomBytes(32)));assert.throws(()=>decryptBackup(Buffer.from('bad'),key));
});
test('database targets cannot be redirected through driver connection strings or dispatcher overrides',()=>{
  const safe={db:{host:'127.0.0.1',port:55439,database:'shopping_stage0',user:'shopping_stage2_runtime',password:'fixture'},dispatcher:{user:'shopping_stage2_dispatcher',password:'fixture'}};
  assertDatabaseTarget(safe);
  for(const db of [{...safe.db,host:'production.invalid'},{...safe.db,port:5432},{...safe.db,database:'postgres'},{...safe.db,connectionString:'postgres://production.invalid/db'}])assert.throws(()=>assertDatabaseTarget({...safe,db}));
  assert.throws(()=>assertDatabaseTarget({...safe,dispatcher:{...safe.dispatcher,host:'production.invalid'}}));
});
