import { createHash, sign, verify } from 'node:crypto';
export const uuid = v => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  if (value === undefined || typeof value === 'number' && !Number.isFinite(value)) throw new Error('invalid_payload');
  return JSON.stringify(value);
}
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
export function validateOperation(c) {
  const p = c.payload;
  if (!p || Array.isArray(p) || typeof p !== 'object') throw new Error('invalid_payload');
  const exact = allowed => { if (Object.keys(p).some(k => !allowed.includes(k))) throw new Error('invalid_payload'); };
  const name = v => typeof v === 'string' && v === v.trim() && v.length > 0 && v.length <= 120;
  const version = n => Number.isSafeInteger(n) && n > 0;
  if (c.type === 'snapshot') { exact([]); if (c.expected_version !== null) throw new Error('invalid_version'); return; }
  if (c.type === 'operation.status') { exact(['operation_id']); if (!uuid(p.operation_id)) throw new Error('invalid_payload'); return; }
  if (c.type === 'list.export') { exact(['history_id']); if (!uuid(p.history_id) || !version(c.expected_version)) throw new Error('invalid_payload'); return; }
  if (c.type === 'list.restore') { exact(['product_ids']); if (!Array.isArray(p.product_ids) || p.product_ids.length > 100 || !p.product_ids.every(uuid) || new Set(p.product_ids).size !== p.product_ids.length || !version(c.expected_version)) throw new Error('invalid_payload'); return; }
  if (!['category.create','category.update','category.delete','product.create','product.update','product.delete','history.delete'].includes(c.type) || !uuid(p.id)) throw new Error('invalid_operation');
  const [entity, verb] = c.type.split('.');
  exact(verb === 'delete' ? ['id'] : entity === 'category' ? ['id','name','icon'] : ['id','category_id','name','checked','quantity','display_order']);
  if (verb === 'create' ? c.expected_version !== 0 : !version(c.expected_version)) throw new Error('invalid_version');
  if (verb === 'create' && (!name(p.name) || entity === 'product' && !uuid(p.category_id))) throw new Error('invalid_payload');
  if (verb === 'update' && Object.keys(p).length < 2) throw new Error('invalid_payload');
  if (p.name !== undefined && !name(p.name) || p.icon !== undefined && (typeof p.icon !== 'string' || !/^[a-z0-9-]{1,40}$/.test(p.icon)) ||
      p.category_id !== undefined && !uuid(p.category_id) || p.checked !== undefined && typeof p.checked !== 'boolean' ||
      p.quantity !== undefined && (!Number.isFinite(p.quantity) || p.quantity < 1 || p.quantity > 9999 || Math.round(p.quantity * 100) / 100 !== p.quantity) ||
      p.display_order !== undefined && p.display_order !== null && (!Number.isInteger(p.display_order) || p.display_order < 0 || p.display_order > 1000000)) throw new Error('invalid_payload');
}
