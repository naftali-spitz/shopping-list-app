import { verify } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { canonical, uuid, CALLBACK_ISSUER, CALLBACK_AUDIENCE } from '../stage3/protocol.mjs';
export function verifyMonitoring(envelope,keys,now=Date.now()) {
  if(!envelope||envelope.kind!=='monitoring-batch'||envelope.v!==1||envelope.iss!==CALLBACK_ISSUER||envelope.aud!==CALLBACK_AUDIENCE||!uuid(envelope.id)||!Number.isSafeInteger(envelope.issued_ms)||Math.abs(now-envelope.issued_ms)>60000||!Array.isArray(envelope.records)||envelope.records.length>100)throw new Error('invalid_monitoring');
  const {signature,...unsigned}=envelope;
  if(typeof signature!=='string'||!Object.hasOwn(keys,envelope.kid)||!verify(null,Buffer.from(canonical(unsigned)),keys[envelope.kid],Buffer.from(signature,'base64url')))throw new Error('invalid_monitoring');
  return envelope;
}
