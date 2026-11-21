import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { loadConfig } from '../src/config.mjs';
import { signEnvelope, identityToken } from '../src/protocol.mjs';
export const config=loadConfig();
export const keys=JSON.parse(readFileSync('.stage0-runtime/stage2-fixture-keys.json'));
export const [user,member,foreignUser]=keys.users;
export const [household,foreignHousehold]=keys.households;
export function make(type,payload={},extra={}) {
  const now=Date.now(), userId=extra.user_id??user;
  return signEnvelope({ v:1,kid:'transport-v1',aud:config.audience,id:randomUUID(),user_id:userId,
    household_id:household,type,payload,expected_version:type.endsWith('.create')?0:null,
    correlation_id:randomUUID(),issued_ms:now,expires_ms:now+300000,
    identity:identityToken(userId,keys.identityPrivateKey,config.identity.issuer),...extra },keys.transportPrivateKey);
}
export function resign(command,patch) {
  const unsigned={...command,...patch}; delete unsigned.signature;
  return signEnvelope(unsigned,keys.transportPrivateKey);
}
