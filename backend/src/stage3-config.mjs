import assert from 'node:assert/strict';
import { readFileSync, statSync, realpathSync } from 'node:fs';
import { loadConfig, root } from './config.mjs';
import { COMMAND_AUDIENCE } from '../../integration/stage3/protocol.mjs';
import { DEV_ISSUER, verifyDevelopmentIdentity } from '../../integration/stage3/identity.mjs';
export function loadStage3Config() {
  // Reuse and verify the existing database, broker and feature-worktree targets.
  const base = loadConfig();
  const path = realpathSync('.stage0-runtime/stage3-config.json');
  assert.ok(path.startsWith(`${root}/.stage0-runtime/`));
  assert.equal(statSync(path).mode & 0o777,0o600);
  const extra = JSON.parse(readFileSync(path));
  assert.equal(extra.environment,'shopping-stage3-development');
  assert.equal(extra.identity.issuer,DEV_ISSUER);
  assert.equal(extra.audience,COMMAND_AUDIENCE);
  assert.equal(extra.protocolVersion,2);
  assert.match(extra.clientId,/^naf-s3-listener-[a-f0-9-]+$/);
  assert.ok(Object.keys(extra.commandKeys).length>0);
  assert.ok(!JSON.stringify(extra.commandKeys).includes('PRIVATE KEY'));
  const config = { ...base, ...extra, db:base.db, dispatcher:base.dispatcher,
    mqtt:{...base.mqtt,clientId:extra.clientId}, healthFile:'.stage0-runtime/stage3-health.json' };
  config.verifyIdentity = (token,h) => verifyDevelopmentIdentity(token,h,{publishableKey:extra.publishableKey});
  return config;
}
