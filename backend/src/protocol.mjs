import { createHash, sign, verify } from 'node:crypto';
import {canonical,uuid} from "../../integration/shopping-contract.mjs";
export {canonical,uuid,validateOperation} from "../../integration/shopping-contract.mjs";
export function signEnvelope(command, privateKey) { return { ...command, signature: sign(null, Buffer.from(canonical(command)), privateKey).toString('base64url') }; }
export function identityToken(userId, privateKey, issuer, now = Date.now()) {
  const head = Buffer.from(JSON.stringify({ alg: 'EdDSA', typ: 'JWT', kid: 'fixture-identity-v1' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ iss: issuer, aud: 'shopping-home-dev', sub: userId, iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + 3600 })).toString('base64url');
  return `${head}.${body}.${sign(null, Buffer.from(`${head}.${body}`), privateKey).toString('base64url')}`;
}
const envelopeKeys = ['v','kid','aud','id','user_id','household_id','type','payload','expected_version','correlation_id','issued_ms','expires_ms','identity','signature'];
export function authenticate(input, config, now = Date.now()) {
  if (!input || Object.keys(input).sort().join() !== envelopeKeys.sort().join() || Buffer.byteLength(JSON.stringify(input)) > 16384) throw new Error('invalid_envelope');
  const { signature, ...unsigned } = input;
  if (input.v !== 1 || input.kid !== 'transport-v1' || input.aud !== config.audience ||
      !verify(null, Buffer.from(canonical(unsigned)), config.transportPublicKey, Buffer.from(signature, 'base64url'))) throw new Error('invalid_signature_or_audience');
  if (![input.id,input.user_id,input.household_id,input.correlation_id].every(uuid) ||
      !Number.isSafeInteger(input.issued_ms) || !Number.isSafeInteger(input.expires_ms) ||
      input.issued_ms > now + 1000 || input.expires_ms <= input.issued_ms || input.expires_ms - input.issued_ms > 300000) throw new Error('invalid_validity');
  const [head, body, jwtSig, extra] = String(input.identity).split('.');
  if (!head || !body || !jwtSig || extra) throw new Error('invalid_identity');
  const h = JSON.parse(Buffer.from(head, 'base64url')), claims = JSON.parse(Buffer.from(body, 'base64url'));
  if (h.alg !== 'EdDSA' || h.kid !== 'fixture-identity-v1' || h.typ !== 'JWT' ||
      !verify(null, Buffer.from(`${head}.${body}`), config.identity.publicKey, Buffer.from(jwtSig, 'base64url')) ||
      claims.iss !== config.identity.issuer || claims.aud !== 'shopping-home-dev' || claims.sub !== input.user_id ||
      !Number.isSafeInteger(claims.exp) || !Number.isSafeInteger(claims.iat) || claims.exp <= now / 1000 || claims.iat > now / 1000 + 1) throw new Error('invalid_identity');
  // Identity is renewable; logical operation timestamps and payload stay bound.
  const logical = Object.fromEntries(Object.entries(unsigned).filter(([key]) => !['identity','kid','aud'].includes(key)));
  return { command: input, hash: createHash('sha256').update(canonical(logical)).digest('hex') };
}
