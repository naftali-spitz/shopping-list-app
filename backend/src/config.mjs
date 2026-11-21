import assert from 'node:assert/strict';
import { readFileSync, statSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
export const root = '/home/naf-w/projects/self/shopping-list-app/.worktrees/flespi-home-backend';
export function assertDatabaseTarget(c){
  assert.deepEqual(Object.keys(c.db).sort(),['database','host','password','port','user']);
  assert.deepEqual(Object.keys(c.dispatcher).sort(),['password','user']);
  assert.equal(c.db.host,'127.0.0.1');assert.equal(c.db.port,55439);
  assert.equal(c.db.database,'shopping_stage0');assert.equal(c.db.user,'shopping_stage2_runtime');
  assert.equal(c.dispatcher.user,'shopping_stage2_dispatcher');
}
export function loadConfig(path = process.env.SHOPPING_STAGE2_CONFIG ?? '.stage0-runtime/stage2-config.json') {
  try {
  assert.equal(process.cwd(), root);
  const git=args=>execFileSync('git',args,{encoding:'utf8'}).trim();
  assert.equal(git(['branch','--show-current']),'feature/flespi-home-backend');
  assert.equal(git(['rev-parse','--show-toplevel']),root);
  assert.equal(git(['rev-parse','--abbrev-ref','@{upstream}']),'origin/develop');
  assert.ok(['git@github.com:naftali-spitz/shopping-list-app.git','https://github.com/naftali-spitz/shopping-list-app.git'].includes(git(['remote','get-url','origin'])));
  assert.ok(['git@github.com:naftali-spitz/shopping-list-app.git','https://github.com/naftali-spitz/shopping-list-app.git'].includes(git(['remote','get-url','--push','--all','origin'])));
  git(['merge-base','--is-ancestor','origin/develop','HEAD']);
  const full = realpathSync(resolve(path));
  assert.equal(statSync('.stage0-runtime').mode & 0o777,0o700);
  assert.ok(full.startsWith(`${root}/.stage0-runtime/`));
  assert.equal(statSync(full).mode & 0o777, 0o600);
  assert.equal(statSync(full).uid,process.getuid());
  assert.equal(JSON.parse(readFileSync('docs/stage1/gate.json')).decision, 'CONDITIONAL GO');
  const c = JSON.parse(readFileSync(full));
  assertDatabaseTarget(c);
  assert.equal(c.environment, 'shopping-stage2-development');
  assert.equal(c.mqtt.url, 'mqtts://mqtt.flespi.io:8883');
  assert.equal(c.mqtt.commands, 'shopping-poc/naf-stage0-041d4f122bdd/commands');
  assert.equal(c.mqtt.results, 'shopping-poc/naf-stage0-041d4f122bdd/results');
  assert.match(c.mqtt.clientId, /^naf-s2-listener-[a-f0-9-]+$/);
  assert.match(c.audience, /^shopping-stage2-dev(?:-[a-f0-9-]+)?$/);
  assert.equal(c.identity.issuer, 'urn:shopping:dev-fixture-identity');
  assert.ok(c.mqtt.expire > Date.now() / 1000 + 60);
  return c;
  } catch { throw new Error('Development backend configuration unavailable or unsafe'); }
}
