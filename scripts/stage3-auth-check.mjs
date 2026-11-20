import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { verifyDevelopmentIdentity, DEV_SUPABASE } from '../integration/stage3/identity.mjs';
assert.equal(process.cwd(), '/home/naf-w/projects/self/shopping-list-app/.worktrees/flespi-home-backend');
const { variables } = JSON.parse(readFileSync('.stage0-runtime/vercel-dev-input.json'));
assert.equal(variables.NEXT_PUBLIC_SUPABASE_URL, DEV_SUPABASE);
const key = variables.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const accounts = JSON.parse(readFileSync('.stage0-runtime/stage3-accounts.json'));
const report = { id: randomUUID(), at: new Date().toISOString(), scope: 'actual development Supabase Auth and session RPC; no Vercel/MQTT/browser claim', checks: [] };
const record = name => report.checks.push({ name, status: 'PASS' });
async function request(path, body, token = key) {
  const response = await fetch(DEV_SUPABASE + path, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(15000) });
  assert.ok(response.ok, `Development Auth/RPC HTTP ${response.status}`);
  return response.status === 204 ? null : response.json();
}
const login = a => request('/auth/v1/token?grant_type=password', { email: a.email, password: a.password });
const verify = (s, h) => verifyDevelopmentIdentity(s.access_token, h, { publishableKey: key });
let state;
try {
  const sessions = [];
  for (const a of accounts) sessions.push(await login(a));
  assert.deepEqual(sessions.map(s => s.user.id), accounts.map(a => a.id));
  record('three real password logins with provider-issued sessions');
  if (existsSync('.stage0-runtime/stage3-auth-state.json')) state = JSON.parse(readFileSync('.stage0-runtime/stage3-auth-state.json'));
  else {
    const existingA = await request('/rest/v1/rpc/list_my_households', {}, sessions[0].access_token);
    const existingC = await request('/rest/v1/rpc/list_my_households', {}, sessions[2].access_token);
    const a = existingA.length ? existingA : await request('/rest/v1/rpc/create_household', { p_name: 'Stage 3 integration A' }, sessions[0].access_token);
    const c = existingC.length ? existingC : await request('/rest/v1/rpc/create_household', { p_name: 'Stage 3 integration B' }, sessions[2].access_token);
    const invite = await request('/rest/v1/rpc/create_household_invite', { p_household_id: a[0].household_id }, sessions[0].access_token);
    // Invite shape is inspected locally; no invitation token is logged.
    const inviteToken = invite[0]?.invite_token;
    assert.equal(typeof inviteToken, 'string', 'Unexpected invite RPC contract');
    await request('/rest/v1/rpc/accept_household_invite', { p_token: inviteToken }, sessions[1].access_token);
    state = { households: [a[0].household_id, c[0].household_id] };
    writeFileSync('.stage0-runtime/stage3-auth-state.json', JSON.stringify(state), { mode: 0o600, flag: 'wx' });
  }
  for (const i of [0, 1]) assert.equal((await verify(sessions[i], state.households[0])).user_id, accounts[i].id);
  record('two actual users authorized for same household');
  await assert.rejects(() => verify(sessions[2], state.households[0]));
  await assert.rejects(() => verify(sessions[0], state.households[1]));
  record('cross-household reads denied both directions');
  await assert.rejects(() => verify({ access_token: sessions[0].access_token.slice(0, -5) + 'AAAAA' }, state.households[0]));
  record('tampered provider token denied');
  const refreshed = await request('/auth/v1/token?grant_type=refresh_token', { refresh_token: sessions[1].refresh_token });
  assert.equal((await verify(refreshed, state.households[0])).user_id, accounts[1].id);
  record('real session refresh preserves identity and membership');
  await request('/auth/v1/logout?scope=local', {}, refreshed.access_token);
  await assert.rejects(() => verify(refreshed, state.households[0]));
  record('logout revokes session: still-signed access token denied by current-session RPC');
  sessions[1] = await login(accounts[1]);
  assert.equal((await verify(sessions[1], state.households[0])).user_id, accounts[1].id);
  record('login after logout gets new authorized session');
  writeFileSync('.stage0-runtime/stage3-sessions.json', JSON.stringify(sessions), { mode: 0o600 });
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL'; report.error = { type: error.name, message: 'Auth check failed; no credential-bearing diagnostics published' };
  process.exitCode = 1;
} finally {
  writeFileSync(`docs/stage3/attempts/auth-${report.id}.json`, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(report));
}
