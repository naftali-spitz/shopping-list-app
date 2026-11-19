import test from 'node:test';
import assert from 'node:assert/strict';
import { DEV_REF, validateEnvironment } from './stage0-preflight.mjs';

const branch = 'feature/flespi-home-backend';
const jwt = (role, ref = DEV_REF) => `header.${Buffer.from(JSON.stringify({ role, ref })).toString('base64url')}.signature`;
const dev = { NEXT_PUBLIC_SUPABASE_URL: `https://${DEV_REF}.supabase.co`, NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt('anon') };
test('known development target and anon key pass local checks', () => assert.deepEqual(validateEnvironment(dev, branch), []));
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
  ['shared system database', { DATABASE_URL: 'postgres://postgres:synthetic@127.0.0.1:5432/postgres' }],
]) test(`${label} is denied`, () => assert.ok(validateEnvironment({ ...dev, ...patch }, branch).length));
test('offline placeholder never passes as live readiness', () => {
  const env = { NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'stage0-build-placeholder' };
  assert.deepEqual(validateEnvironment(env, branch, true), []);
  assert.ok(validateEnvironment(env, branch).length);
  assert.ok(validateEnvironment(dev, branch, true).length);
});
