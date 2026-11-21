// Owner-authorized simple test login, using real development Supabase Auth.
// The short-lived provisioning function authenticates with an ephemeral public
// key; the Supabase admin secret stays inside its own Edge runtime.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomUUID, randomBytes, sign } from 'node:crypto';
import assert from 'node:assert/strict';
const path = '.stage0-runtime/stage3-accounts.json';
assert.equal(process.cwd(), '/home/naf-w/projects/self/shopping-list-app/.worktrees/flespi-home-backend');
assert.ok(!existsSync(path), 'Do not overwrite existing account credentials');
const key = readFileSync('.stage0-runtime/stage3-provision-key.pem');
const accounts = [];
writeFileSync(path, JSON.stringify(accounts), { mode: 0o600, flag: 'wx' });
for (let i = 0; i < 3; i++) {
  const credentials = { email: `stage3-${randomUUID()}@example.invalid`, password: randomBytes(36).toString('base64url') };
  const body = JSON.stringify(credentials);
  const response = await fetch('https://njomxqthjglqesxchlbm.supabase.co/functions/v1/shopping-stage3-provision', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-signature': sign(null, Buffer.from(body), key).toString('base64url') },
    body, signal: AbortSignal.timeout(20000), redirect: 'error',
  });
  assert.ok(response.ok, `Development account provisioning HTTP ${response.status}`);
  const { id } = await response.json();
  assert.match(id, /^[a-f0-9-]{36}$/);
  accounts.push({ ...credentials, id });
  writeFileSync(path, JSON.stringify(accounts), { mode: 0o600 });
}
console.log(JSON.stringify({ event: 'development_accounts_provisioned', count: accounts.length, ids: accounts.map(a => a.id), credentials: 'owner-only excluded runtime file' }));
