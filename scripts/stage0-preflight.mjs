import { execFileSync, spawnSync } from 'node:child_process';
import { lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { isAbsolute, relative, resolve } from 'node:path';

const require = createRequire(import.meta.url);
export const DEV_REF = 'njomxqthjglqesxchlbm';
export const PROD_REF = 'inebdmynrfwmmxcyziyi';
export const DEV_URL = 'https://shopping-list-app-git-develop-0012ab-5576s-projects.vercel.app/';
export const PROD_URL = 'https://shopping-list-app-eta-ten.vercel.app/';
export const WORKTREE = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
export const BRANCH = 'feature/flespi-home-backend';
export const VERCEL_PROJECT_ID = 'prj_jsqk7AsPGuxLmvWqYEsqyFClV1cM';
export const VERCEL_TEAM_ID = 'team_h5ZyD1rMpbgnak6COakN03nD';
const REMOTES = ['git@github.com:naftali-spitz/shopping-list-app.git', 'https://github.com/naftali-spitz/shopping-list-app.git'];
const LOOPBACK = 'http://127.0.0.1:54321';
const APP_URL_KEYS = ['POC_APP_URL', 'APP_URL', 'NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_SITE_URL', 'SITE_URL', 'VERCEL_URL', 'VERCEL_BRANCH_URL', 'VERCEL_PROJECT_PRODUCTION_URL'];

// Labels only: never echo credential or connection-string values.
export function validateTargets(env) {
  const errors = [];
  if ([env.VERCEL_ENV, env.VERCEL_TARGET_ENV].some(v => v && !['preview', 'development'].includes(v))) errors.push('Production or unknown deployment context denied');
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string' && (value.includes(PROD_REF) || value.includes(new URL(PROD_URL).hostname))) errors.push(`Production resource denied: ${key}`);
    if (key.startsWith('NEXT_PUBLIC_') && /SECRET|PASSWORD|SERVICE_ROLE|FLESPI|MQTT|DATABASE/.test(key)) errors.push(`Privileged browser variable denied: ${key}`);
    if (/(?:DATABASE|POSTGRES|POSTGRESQL|DB).*URL(?:_|$)/.test(key) && value) {
      try {
        const db = new URL(value);
        if (!['postgres:', 'postgresql:'].includes(db.protocol) || db.hostname !== '127.0.0.1' || db.port !== '55439' || db.pathname !== '/shopping_stage0' || db.username !== 'shopping_stage0_app' || db.search || db.hash) errors.push(`Unverified PostgreSQL target or role: ${key}`);
      } catch { errors.push(`Invalid PostgreSQL configuration: ${key}`); }
    }
  }
  if (env.NEXT_PUBLIC_SUPABASE_URL && ![`https://${DEV_REF}.supabase.co`, LOOPBACK].includes(env.NEXT_PUBLIC_SUPABASE_URL)) errors.push('Wrong or unknown public Supabase target');
  if (env.NEXT_PUBLIC_SUPABASE_ANON_KEY && env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== 'stage0-build-placeholder' && !env.NEXT_PUBLIC_SUPABASE_ANON_KEY.startsWith('sb_publishable_')) {
    try {
      const claims = JSON.parse(Buffer.from(env.NEXT_PUBLIC_SUPABASE_ANON_KEY.split('.')[1], 'base64url'));
      if (claims.role !== 'anon' || claims.ref !== DEV_REF) errors.push('Browser key role/project denied');
    } catch { errors.push('Unrecognized browser key'); }
  }
  if (env.SUPABASE_URL && env.SUPABASE_URL !== `https://${DEV_REF}.supabase.co`) errors.push('Unverified server Supabase target');
  if (env.SUPABASE_PROJECT_ID && env.SUPABASE_PROJECT_ID !== DEV_REF) errors.push('Unverified Supabase project ID');
  for (const key of APP_URL_KEYS) {
    if (!env[key]) continue;
    try {
      const url = new URL(env[key].includes('://') ? env[key] : `https://${env[key]}`);
      if (url.href !== DEV_URL) errors.push(`Wrong or unknown Vercel/application URL: ${key}`);
    } catch { errors.push(`Invalid application URL: ${key}`); }
  }
  if (env.VERCEL_GIT_REPO_SLUG && env.VERCEL_GIT_REPO_SLUG !== 'shopping-list-app') errors.push('Wrong Vercel repository');
  if (env.VERCEL_GIT_REPO_OWNER && env.VERCEL_GIT_REPO_OWNER !== 'naftali-spitz') errors.push('Wrong Vercel repository owner');
  if (env.VERCEL_GIT_COMMIT_REF && !['develop', BRANCH].includes(env.VERCEL_GIT_COMMIT_REF)) errors.push('Wrong Vercel development branch');
  if (env.VERCEL_ORG_ID && env.VERCEL_ORG_ID !== 'team_h5ZyD1rMpbgnak6COakN03nD') errors.push('Wrong Vercel team');
  // Confirmed through the official CLI after account-owner device approval.
  if (env.VERCEL_PROJECT_ID && env.VERCEL_PROJECT_ID !== VERCEL_PROJECT_ID) errors.push('Wrong or unknown Vercel project ID');
  if (['PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGSERVICE', 'PGSERVICEFILE', 'PGHOSTADDR'].some(k => env[k])) {
    if (env.PGHOST !== '127.0.0.1' || env.PGPORT !== '55439' || env.PGDATABASE !== 'shopping_stage0' || env.PGUSER !== 'shopping_stage0_app' || env.PGSERVICE || env.PGSERVICEFILE || env.PGHOSTADDR) errors.push('Unverified libpq connection configuration');
  }
  return errors;
}

export function validateEnvironment(env, branch, offline = false) {
  const errors = validateTargets(env);
  if (branch !== BRANCH) errors.push('Use the isolated POC feature branch');
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  if (url !== `https://${DEV_REF}.supabase.co` && !(offline && url === LOOPBACK)) errors.push('Unverified Supabase target');
  if (!offline && env.POC_APP_URL !== DEV_URL) errors.push('Explicit development POC_APP_URL required');
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (offline) {
    if (url !== LOOPBACK || key !== 'stage0-build-placeholder') errors.push('Offline builds require loopback placeholders');
  } else if (key.startsWith('sb_publishable_')) {
    // Ownership cannot be inferred from an opaque key. Live execution remains blocked.
  } else {
    try {
      const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url'));
      if (claims.role !== 'anon' || claims.ref !== DEV_REF) errors.push('Browser key role/project denied');
    } catch { errors.push('Missing or unrecognized development browser key'); }
  }
  return errors;
}

export function validateWorkspace(context) {
  const errors = [];
  if (context.cwd !== WORKTREE || context.root !== WORKTREE) errors.push('Run from the actual isolated worktree, never the original checkout');
  if (context.branch !== BRANCH) errors.push('Wrong working branch');
  if (context.upstream !== 'origin/develop' || !context.baseIsAncestor) errors.push('Verified origin/develop baseline required; main/dev denied');
  for (const key of ['fetchUrls', 'pushUrls']) {
    if (context[key]?.length !== 1 || !REMOTES.includes(context[key][0])) errors.push(`Wrong or unknown repository remote: ${key}`);
  }
  return errors;
}

export function validateCommand(command, offline) {
  if (!command.length) return [];
  const allowed = [JSON.stringify(['npm', 'run', 'build']), JSON.stringify(['npm', 'run', 'start', '--', '--hostname', '127.0.0.1', '--port', '55440'])];
  return allowed.includes(JSON.stringify(command)) ? [] : [`Only the documented ${offline ? 'offline' : 'verified development'} build or loopback smoke command is permitted; push/deploy/other commands denied`];
}

export function validateProviderEvidence(evidence, link, browserKey, now = Date.now()) {
  const errors = [];
  if (link.projectId !== VERCEL_PROJECT_ID || link.orgId !== VERCEL_TEAM_ID || link.projectName !== 'shopping-list-app') errors.push('Existing project linkage mismatch');
  if (evidence.status !== 'PASS' || evidence.project_id !== VERCEL_PROJECT_ID || evidence.team_id !== VERCEL_TEAM_ID || evidence.preview_url !== DEV_URL || evidence.repository !== 'naftali-spitz/shopping-list-app' || evidence.production_branch !== 'main' || evidence.development_base !== 'develop' || evidence.preview_defaults_isolated !== true || evidence.production_deployment_unchanged !== true || evidence.production_secret_fingerprints_unchanged !== true || JSON.stringify(evidence.bundle_supabase_hosts) !== JSON.stringify([`${DEV_REF}.supabase.co`])) errors.push('Provider isolation evidence missing or mismatched');
  const verifiedAt = Date.parse(evidence.verified_at);
  if (!Number.isFinite(verifiedAt) || verifiedAt > now || now - verifiedAt > 6 * 60 * 60 * 1000) errors.push('Provider isolation evidence expired; rerun the remote audit');
  if (createHash('sha256').update(browserKey || '').digest('hex') !== evidence.browser_key_sha256) errors.push('Browser key does not match verified dev provider key');
  return errors;
}

function main() {
  const args = process.argv.slice(2);
  const separator = args.indexOf('--');
  const flags = separator < 0 ? args : args.slice(0, separator);
  if (flags.some(v => v !== '--offline-build')) throw new Error('Unknown preflight option');
  const offline = flags.includes('--offline-build');
  const command = separator < 0 ? [] : args.slice(separator + 1);
  if (separator >= 0 && !command.length) throw new Error('Missing command after --');
  const cwd = realpathSync(process.cwd());
  // Refuse BEFORE any env load or Git call in the original checkout.
  if (cwd !== WORKTREE) {
    console.error(JSON.stringify({ status: 'BLOCKED', errors: ['Run from the actual isolated worktree; original checkout denied'] }));
    process.exitCode = 1;
    return;
  }
  if (process.env.NODE_ENV === 'test') throw new Error('Test env load order cannot establish build/development configuration');
  const git = (...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  let baseIsAncestor = false;
  try { git('merge-base', '--is-ancestor', 'origin/develop', 'HEAD'); baseIsAncestor = true; } catch { /* Fail closed. */ }
  const context = { cwd, root: realpathSync(git('rev-parse', '--show-toplevel')), branch: git('branch', '--show-current'), upstream: git('rev-parse', '--abbrev-ref', '@{upstream}'), baseIsAncestor, fetchUrls: git('remote', 'get-url', '--all', 'origin').split('\n'), pushUrls: git('remote', 'get-url', '--push', '--all', 'origin').split('\n') };
  const errors = validateWorkspace(context);
  if (errors.length) throw new Error(errors.join('; '));
  const envFiles = readdirSync(cwd).filter(n => /^\.env(?:\.(?:local|development(?:\.local)?|production(?:\.local)?|test(?:\.local)?))?$/.test(n));
  for (const name of envFiles) {
    const resolved = realpathSync(resolve(cwd, name));
    const location = relative(cwd, resolved);
    if (location.startsWith('..') || isAbsolute(location) || !lstatSync(resolved).isFile()) throw new Error('External or invalid env file denied');
  }
  const { loadEnvConfig, resetEnv } = require('@next/env');
  const inherited = { ...process.env };
  // Audit both production/build and development load orders; do not let an
  // inherited safe URL hide a production URL in a lower-priority env file.
  for (const development of [false, true]) {
    resetEnv();
    const loaded = loadEnvConfig(cwd, development, { info() {}, error() { throw new Error('Environment parsing failed'); } }, true);
    for (const file of loaded.loadedEnvFiles) errors.push(...validateTargets(file.env));
    errors.push(...validateTargets(loaded.combinedEnv));
  }
  resetEnv();
  const env = { ...inherited };
  if (offline && !env.NEXT_PUBLIC_SUPABASE_URL && !env.NEXT_PUBLIC_SUPABASE_ANON_KEY && envFiles.length === 0) {
    env.NEXT_PUBLIC_SUPABASE_URL = LOOPBACK;
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'stage0-build-placeholder';
  } else if (envFiles.length) {
    Object.assign(env, loadEnvConfig(cwd, false, { info() {}, error() {} }, true).combinedEnv);
  }
  errors.push(...validateEnvironment(env, context.branch, offline), ...validateCommand(command, offline));
  if (!offline) {
    const link = JSON.parse(readFileSync(resolve(cwd, '.vercel/project.json'), 'utf8'));
    const provider = JSON.parse(readFileSync(resolve(cwd, 'docs/stage0/vercel-isolation.json'), 'utf8'));
    errors.push(...validateProviderEvidence(provider, link, env.NEXT_PUBLIC_SUPABASE_ANON_KEY));
  }
  const evidence = { cwd, branch: context.branch, head: git('rev-parse', 'HEAD'), base: git('rev-parse', 'origin/develop'), baseIsAncestor, upstream: context.upstream, repository: 'naftali-spitz/shopping-list-app', envFiles };
  if (errors.length) {
    console.error(JSON.stringify({ status: 'BLOCKED', errors: [...new Set(errors)], ...evidence }));
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify({ status: 'PASS', scope: `${offline ? 'offline placeholders' : 'verified dev configuration'} only; Stage 0 remains NO-GO until all prerequisites pass`, ...evidence }));
  if (command.length) {
    const child = spawnSync(command[0], command.slice(1), { cwd, env, stdio: 'inherit' });
    process.exitCode = child.status ?? 1;
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch { console.error(JSON.stringify({ status: 'BLOCKED', errors: ['Worktree, repository or environment inspection failed; no command executed'] })); process.exitCode = 1; }
}
