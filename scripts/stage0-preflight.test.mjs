import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { DEV_REF, DEV_URL, PROD_URL, WORKTREE, VERCEL_PROJECT_ID, VERCEL_TEAM_ID, validateEnvironment, validateWorkspace, validateCommand, validateProviderEvidence } from './stage0-preflight.mjs';

const branch = 'feature/flespi-home-backend';
const jwt = (role, ref = DEV_REF) => `header.${Buffer.from(JSON.stringify({ role, ref })).toString('base64url')}.signature`;
const dev = { POC_APP_URL: DEV_URL, NEXT_PUBLIC_SUPABASE_URL: `https://${DEV_REF}.supabase.co`, NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt('anon') };
test('known development target and anon key pass local checks', () => assert.deepEqual(validateEnvironment(dev, branch), []));
test('provider-verified existing project ID passes identity checks only', () => assert.deepEqual(validateEnvironment({ ...dev, VERCEL_PROJECT_ID }, branch), []));
for (const other of ['main', 'develop', '', 'feature/unverified']) {
  test(`branch ${other || 'detached'} is denied`, () => assert.ok(validateEnvironment(dev, other).length));
}
for (const [label, patch] of [
  ['production target despite DEV_MODE', { NEXT_PUBLIC_SUPABASE_URL: 'https://inebdmynrfwmmxcyziyi.supabase.co', NEXT_PUBLIC_DEV_MODE: 'true' }],
  ['unknown project', { NEXT_PUBLIC_SUPABASE_URL: 'https://unknown.supabase.co' }],
  ['service-role browser JWT', { NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt('service_role') }],
  ['key for another project', { NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt('anon', 'other') }],
  ['missing key', { NEXT_PUBLIC_SUPABASE_ANON_KEY: '' }],
  ['public broker token', { NEXT_PUBLIC_FLESPI_TOKEN: 'synthetic-test-value' }],
  ['production deployment', { VERCEL_ENV: 'production' }],
  ['production custom target', { VERCEL_TARGET_ENV: 'production' }],
  ['unknown custom target', { VERCEL_TARGET_ENV: 'unknown' }],
  ['production app URL', { POC_APP_URL: PROD_URL }],
  ['unknown app URL', { APP_URL: 'https://other.vercel.app/' }],
  ['missing explicit preview URL', { POC_APP_URL: '' }],
  ['production Vercel alias', { VERCEL_BRANCH_URL: new URL(PROD_URL).hostname }],
  ['wrong development Vercel path', { APP_URL: `${DEV_URL}other` }],
  ['wrong Vercel scheme', { APP_URL: DEV_URL.replace('https:', 'http:') }],
  ['unverified Vercel project ID', { VERCEL_PROJECT_ID: 'prj_unverified' }],
  ['wrong Vercel git base', { VERCEL_GIT_COMMIT_REF: 'dev' }],
  ['main Vercel git base', { VERCEL_GIT_COMMIT_REF: 'main' }],
  ['wrong Vercel team', { VERCEL_ORG_ID: 'team_other' }],
  ['wrong Vercel repo', { VERCEL_GIT_REPO_SLUG: 'other' }],
  ['wrong server Supabase URL', { SUPABASE_URL: 'https://unknown.supabase.co' }],
  ['production Supabase ID', { SUPABASE_PROJECT_ID: 'inebdmynrfwmmxcyziyi' }],
  ['libpq system port', { PGHOST: '127.0.0.1', PGPORT: '5432', PGDATABASE: 'shopping_stage0', PGUSER: 'shopping_stage0_app' }],
  ['libpq unknown service', { PGSERVICE: 'shared' }],
  ['DB URL override query', { DATABASE_URL: 'postgres://shopping_stage0_app:synthetic@127.0.0.1:55439/shopping_stage0?host=evil' }],
  ['alternate shared DB variable', { POSTGRES_URL_NON_POOLING: 'postgres://postgres:synthetic@127.0.0.1:5432/postgres' }],
  ['shared system database', { DATABASE_URL: 'postgres://postgres:synthetic@127.0.0.1:5432/postgres' }],
]) test(`${label} is denied`, () => assert.ok(validateEnvironment({ ...dev, ...patch }, branch).length));
test('offline placeholder never passes as live readiness', () => {
  const env = { NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'stage0-build-placeholder' };
  assert.deepEqual(validateEnvironment(env, branch, true), []);
  assert.ok(validateEnvironment(env, branch).length);
  assert.ok(validateEnvironment(dev, branch, true).length);
});

const context = { cwd: WORKTREE, root: WORKTREE, branch, upstream: 'origin/develop', baseIsAncestor: true, fetchUrls: ['git@github.com:naftali-spitz/shopping-list-app.git'], pushUrls: ['git@github.com:naftali-spitz/shopping-list-app.git'] };
test('exact worktree/repository/develop ancestry passes local context only', () => assert.deepEqual(validateWorkspace(context), []));
for (const [label, patch] of [
  ['original working directory', { cwd: resolve(WORKTREE, '../..') }],
  ['wrong repository root', { root: '/tmp/other' }],
  ['main branch', { branch: 'main' }],
  ['dev upstream', { upstream: 'origin/dev' }],
  ['main upstream', { upstream: 'origin/main' }],
  ['non-develop ancestry', { baseIsAncestor: false }],
  ['wrong fetch repository', { fetchUrls: ['https://github.com/other/shopping-list-app.git'] }],
  ['wrong push repository', { pushUrls: ['https://github.com/other/shopping-list-app.git'] }],
  ['extra push destination', { pushUrls: [...context.pushUrls, 'https://github.com/other/repo.git'] }],
]) test(`${label} is denied by workspace checks`, () => assert.ok(validateWorkspace({ ...context, ...patch }).length));
test('development wrapper permits local build but never deployment/push', () => {
  assert.deepEqual(validateCommand(['npm', 'run', 'build'], false), []);
  assert.ok(validateCommand(['vercel', 'deploy'], false).length);
  assert.ok(validateCommand(['git', 'push'], false).length);
});
test('offline guard cannot wrap push, deployment or arbitrary commands', () => {
  for (const command of [['git', 'push'], ['vercel', 'deploy'], ['npm', 'run', 'dev'], ['node', '-e', 'process.exit(0)']]) assert.ok(validateCommand(command, true).length);
  assert.deepEqual(validateCommand(['npm', 'run', 'build'], true), []);
});
test('CLI rejects original checkout before loading its .env.local', () => {
  const result = spawnSync(process.execPath, [resolve(WORKTREE, 'scripts/stage0-preflight.mjs'), '--offline-build'], { cwd: resolve(WORKTREE, '../..'), encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /original checkout denied/);
});
const now = Date.now();
const link = { projectId: VERCEL_PROJECT_ID, orgId: VERCEL_TEAM_ID, projectName: 'shopping-list-app' };
const provider = { status: 'PASS', project_id: VERCEL_PROJECT_ID, team_id: VERCEL_TEAM_ID, preview_url: DEV_URL, repository: 'naftali-spitz/shopping-list-app', production_branch: 'main', development_base: 'develop', preview_defaults_isolated: true, production_deployment_unchanged: true, production_secret_records_preserved: true, production_secret_values_compared: false, bundle_supabase_hosts: [`${DEV_REF}.supabase.co`], verified_at: new Date(now).toISOString(), browser_key_sha256: createHash('sha256').update(dev.NEXT_PUBLIC_SUPABASE_ANON_KEY).digest('hex') };
test('fresh provider evidence and matching dev key pass scoped configuration checks', () => assert.deepEqual(validateProviderEvidence(provider, link, dev.NEXT_PUBLIC_SUPABASE_ANON_KEY, now), []));
for (const [label, patch] of [
  ['no evidence', {}],
  ['old audit', { ...provider, verified_at: new Date(now - 7 * 60 * 60 * 1000).toISOString() }],
  ['future audit', { ...provider, verified_at: new Date(now + 10000).toISOString() }],
  ['wrong alias', { ...provider, preview_url: PROD_URL }],
  ['production bundle', { ...provider, bundle_supabase_hosts: ['inebdmynrfwmmxcyziyi.supabase.co'] }],
  ['shared preview scopes', { ...provider, preview_defaults_isolated: false }],
  ['unsupported plaintext secret comparison claim', { ...provider, production_secret_values_compared: true }],
]) test(`${label} cannot authorize development execution`, () => assert.ok(validateProviderEvidence(patch, link, dev.NEXT_PUBLIC_SUPABASE_ANON_KEY, now).length));
test('wrong local project linkage and a different opaque key are denied', () => {
  assert.ok(validateProviderEvidence(provider, { ...link, projectId: 'prj_other' }, dev.NEXT_PUBLIC_SUPABASE_ANON_KEY, now).length);
  assert.ok(validateProviderEvidence(provider, link, 'sb_publishable_other', now).length);
});
