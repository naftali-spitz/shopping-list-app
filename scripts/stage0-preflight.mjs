import { execFileSync, spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
export const DEV_REF = 'njomxqthjglqesxchlbm';
const PROD_REF = 'inebdmynrfwmmxcyziyi';
const LOOPBACK = 'http://127.0.0.1:54321';

// Deliberately returns labels only: never echo values from credentials or URLs.
export function validateEnvironment(env, branch, offline = false) {
  const errors = [];
  if (branch !== 'feature/flespi-home-backend') errors.push('Use the isolated POC feature branch');
  if ([env.VERCEL_ENV, env.VERCEL_TARGET_ENV].includes('production')) errors.push('Production deployment context denied');
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string' && value.includes(PROD_REF)) errors.push(`Production resource denied: ${key}`);
    if (key.startsWith('NEXT_PUBLIC_') && /SECRET|PASSWORD|SERVICE_ROLE|FLESPI|MQTT|DATABASE/.test(key)) errors.push(`Privileged browser variable denied: ${key}`);
  }
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  if (url !== `https://${DEV_REF}.supabase.co` && !(offline && url === LOOPBACK)) errors.push('Unverified Supabase target');
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (offline) {
    if (url !== LOOPBACK || key !== 'stage0-build-placeholder') errors.push('Offline builds require loopback placeholders');
  } else if (key.startsWith('sb_publishable_')) {
    // Opaque key ownership still requires provider evidence before live tests.
  } else {
    try {
      const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url'));
      if (claims.role !== 'anon' || claims.ref !== DEV_REF) errors.push('Browser key role/project denied');
    } catch { errors.push('Missing or unrecognized development browser key'); }
  }
  if (env.DATABASE_URL) {
    try {
      const db = new URL(env.DATABASE_URL);
      if (!['postgres:', 'postgresql:'].includes(db.protocol) || db.hostname !== '127.0.0.1' || db.port !== '55439' || db.pathname !== '/shopping_stage0' || db.username !== 'shopping_stage0_app') errors.push('Unverified PostgreSQL target or role');
    } catch { errors.push('Invalid PostgreSQL configuration'); }
  }
  return errors;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const offline = process.argv.includes('--offline-build');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const branch = execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim();
  const { loadEnvConfig } = require('@next/env');
  loadEnvConfig(root, false, { info() {}, error() {} });
  // Inspect real configuration before replacing it for an offline build.
  const configured = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const env = { ...process.env };
  if (offline && !configured) {
    env.NEXT_PUBLIC_SUPABASE_URL = LOOPBACK;
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'stage0-build-placeholder';
  }
  const errors = validateEnvironment(env, branch, offline);
  if (errors.length) {
    console.error(JSON.stringify({ status: 'BLOCKED', errors }));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({ status: 'PASS', scope: offline ? 'offline build only; no service readiness claim' : 'local configuration only; remote readiness unverified', branch }));
    const separator = process.argv.indexOf('--');
    if (separator !== -1) {
      const [command, ...args] = process.argv.slice(separator + 1);
      if (!command) throw new Error('Missing command after --');
      const child = spawnSync(command, args, { cwd: root, env, stdio: 'inherit' });
      process.exitCode = child.status ?? 1;
    }
  }
}
