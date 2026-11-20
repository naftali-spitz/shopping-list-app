import { createHash, sign, verify } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { canonical, uuid, validateOperation } from '../shopping-contract.mjs';
export { canonical, uuid, validateOperation } from '../shopping-contract.mjs';
export const COMMAND_ISSUER = 'urn:shopping:stage3:vercel:development';
export const COMMAND_AUDIENCE = 'urn:shopping:stage3:debian:development';
export const CALLBACK_ISSUER = 'urn:shopping:stage3:debian:development';
export const CALLBACK_AUDIENCE = 'urn:shopping:stage3:vercel:development';
const fields = ['v','kid','iss','aud','id','user_id','household_id','type','payload','expected_version','correlation_id','issued_ms','expires_ms','identity','signature'];
function exact(object, keys) {
  if (!object || Array.isArray(object) || typeof object !== 'object' || Object.keys(object).sort().join() !== [...keys].sort().join()) throw new Error('invalid_contract');
}
export function signed(object, privateKey) {
  if ('signature' in object) throw new Error('already_signed');
  return { ...object, signature: sign(null, Buffer.from(canonical(object)), privateKey).toString('base64url') };
}
function checkSignature(object, keys) {
  const { signature, ...unsigned } = object;
  const key = Object.hasOwn(keys, object.kid) && keys[object.kid];
  if (!key || typeof signature !== 'string' || !/^[A-Za-z0-9_-]{86}$/.test(signature) ||
      !verify(null, Buffer.from(canonical(unsigned)), key, Buffer.from(signature, 'base64url'))) throw new Error('invalid_signature');
}
export function logicalHash(command) {
  // Identity refresh/transport-key rotation cannot change the logical intent.
  const logical = Object.fromEntries(Object.entries(command).filter(([k]) => !['identity','kid','signature'].includes(k)));
  return createHash('sha256').update(canonical(logical)).digest('hex');
}
export function validateCommand(command, commandKeys, now = Date.now()) {
  exact(command, fields);
  if (Buffer.byteLength(JSON.stringify(command)) > 16384 || command.v !== 2 ||
      command.iss !== COMMAND_ISSUER || command.aud !== COMMAND_AUDIENCE) throw new Error('invalid_environment');
  checkSignature(command, commandKeys);
  if (![command.id,command.user_id,command.household_id,command.correlation_id].every(uuid) ||
      !Number.isSafeInteger(command.issued_ms) || !Number.isSafeInteger(command.expires_ms) ||
      command.issued_ms > now + 1000 || command.expires_ms <= command.issued_ms ||
      command.expires_ms - command.issued_ms > 300000 || typeof command.identity !== 'string' || command.identity.length > 8192) throw new Error('invalid_validity');
  validateOperation(command);
  return { command, hash: logicalHash(command) };
}
export async function authenticateCommand(command, { commandKeys, verifyIdentity }, now = Date.now()) {
  const authenticated = validateCommand(command, commandKeys, now);
  if (typeof verifyIdentity !== 'function') throw new Error('identity_verifier_required');
  // Both Vercel and Debian call the provider adapter. No cached admission claim
  // or client user ID substitutes for current identity/session/membership checks.
  const context = await verifyIdentity(command.identity, command.household_id);
  if (context.user_id !== command.user_id || context.household_id !== command.household_id) throw new Error('identity_mismatch');
  return { ...authenticated, context };
}
export function signCommand(intent, context, token, { kid, privateKey }) {
  exact(intent, ['id','household_id','type','payload','expected_version','correlation_id','issued_ms','expires_ms']);
  if (context.household_id !== intent.household_id || !uuid(context.user_id)) throw new Error('forbidden');
  return signed({ ...intent, v:2, kid, iss:COMMAND_ISSUER, aud:COMMAND_AUDIENCE, user_id:context.user_id, identity:token }, privateKey);
}
export function verifyCallback(callback, callbackKeys, accepted, now = Date.now()) {
  exact(callback, ['v','kind','kid','iss','aud','issued_ms','delivery_id','result','signature']);
  if (Buffer.byteLength(JSON.stringify(callback)) > 262144 || callback.v !== 2 || callback.kind !== 'operation-result' ||
      callback.iss !== CALLBACK_ISSUER || callback.aud !== CALLBACK_AUDIENCE || !uuid(callback.delivery_id) ||
      !Number.isSafeInteger(callback.issued_ms) || callback.issued_ms > now+1000 || callback.issued_ms < now-60000) throw new Error('invalid_callback');
  checkSignature(callback, callbackKeys);
  const r = callback.result;
  exact(r, ['operation_id','household_id','user_id','correlation_id','audience','status','data']);
  if (!['committed','snapshot','found','version_conflict','record_id_conflict','operation_id_conflict','not_found','expired','forbidden'].includes(r.status) ||
      r.audience !== COMMAND_AUDIENCE || r.operation_id !== accepted.id || r.user_id !== accepted.user_id ||
      r.household_id !== accepted.household_id || r.correlation_id !== accepted.correlation_id) throw new Error('callback_binding_mismatch');
  return r;
}
export function verifyReconciliation(request, callbackKeys, now = Date.now()) {
  exact(request,['v','kind','kid','iss','aud','issued_ms','id','signature']);
  if(request.v!==2 || request.kind!=='reconcile' || request.iss!==CALLBACK_ISSUER || request.aud!==CALLBACK_AUDIENCE ||
    !uuid(request.id) || !Number.isSafeInteger(request.issued_ms) || request.issued_ms>now+1000 || request.issued_ms<now-60000)throw new Error('invalid_reconciliation');
  checkSignature(request,callbackKeys);
}
export function verifyProgress(progress,callbackKeys,now=Date.now()) {
  exact(progress,['v','kind','kid','iss','aud','issued_ms','delivery_id','operation_id','user_id','household_id','correlation_id','state','signature']);
  if(progress.v!==2 || progress.kind!=='operation-progress' || progress.iss!==CALLBACK_ISSUER || progress.aud!==CALLBACK_AUDIENCE ||
    ![progress.delivery_id,progress.operation_id,progress.user_id,progress.household_id,progress.correlation_id].every(uuid) ||
    !['processing','failed_retryable','reconciliation_required'].includes(progress.state) || !Number.isSafeInteger(progress.issued_ms) || progress.issued_ms>now+1000 || progress.issued_ms<now-60000)throw new Error('invalid_progress');
  checkSignature(progress,callbackKeys);
}
