// Read-only business-state checks plus an authenticated actual-app snapshot.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import pg from '../backend/node_modules/pg/lib/index.js';
import { PREVIEW, previewHeaders } from './stage3-preview-check.mjs';

execFileSync(process.execPath, ['scripts/stage0-preflight.mjs'], { stdio: 'pipe' });
const require = createRequire('/home/naf-w/.local/share/shopping-list-tools/package.json');
const { chromium } = require('playwright-core');
const cli = args => JSON.parse(execFileSync('/home/naf-w/.local/share/shopping-list-tools/node_modules/.bin/vercel', [...args, '--scope', '0012ab-5576s-projects', '--non-interactive'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
const report = { id: randomUUID(), at: new Date().toISOString(), scope: 'final exact-source CI/Preview, real root UI and retained rollback/expiry database outcomes; no new business mutations', sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), checks: [] };
const db = new pg.Pool({ host: '127.0.0.1', port: 55439, database: 'shopping_stage0', user: 'stage0_owner', password: readFileSync('.stage0-runtime/admin-password', 'utf8').trim(), max: 1 });
let browser, context;
const latest = prefix => readdirSync('docs/stage4/attempts').filter(name => name.startsWith(prefix)).flatMap(name => {
  try { const data = JSON.parse(readFileSync(`docs/stage4/attempts/${name}/report.json`)); return data.status === 'PASS' ? [{ name, data }] : []; } catch { return []; }
}).sort((a, b) => b.data.at.localeCompare(a.data.at))[0];
const record = (name, detail = {}) => report.checks.push({ name, status: 'PASS', ...detail });
try {
  const deployed = cli(['inspect', PREVIEW, '--json']);
  const source = cli(['api', `/v13/deployments/${deployed.id}?teamId=team_h5ZyD1rMpbgnak6COakN03nD`, '--method', 'GET']);
  assert.equal(source.projectId, 'prj_jsqk7AsPGuxLmvWqYEsqyFClV1cM');
  assert.equal(source.gitSource.ref, 'feature/flespi-home-backend');
  assert.equal(source.gitSource.sha, report.sha); assert.equal(source.readyState, 'READY'); assert.notEqual(source.target, 'production');
  report.deployment = { id: source.id, url: source.url, sha: source.gitSource.sha, ref: source.gitSource.ref };
  const pr = JSON.parse(execFileSync('gh', ['pr', 'view', '16', '--repo', 'naftali-spitz/shopping-list-app', '--json', 'headRefOid,baseRefName,isDraft'], { encoding: 'utf8' }));
  assert.equal(pr.headRefOid, report.sha); assert.equal(pr.baseRefName, 'develop'); assert.equal(pr.isDraft, true);
  const checks = execFileSync('gh', ['pr', 'checks', '16', '--repo', 'naftali-spitz/shopping-list-app'], { encoding: 'utf8' }).trim().split('\n').map(line => { const fields = line.split('\t'); return { name: fields[0], state: fields[1], link: fields[3] }; });
  assert.ok(checks.some(check => check.name === 'guard-and-build'));
  assert.ok(checks.some(check => check.name === 'Vercel'));
  assert.ok(checks.every(check => check.state === 'pass'));
  record('exact feature alias SHA, draft develop PR and relevant source checks verified', { checks });

  const session = JSON.parse(readFileSync('.stage0-runtime/stage3-sessions.json'))[0];
  const household = JSON.parse(readFileSync('.stage0-runtime/stage3-auth-state.json')).households[0];
  browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  await context.route(PREVIEW + '/**', async route => {
    try { await route.continue({ headers: { ...route.request().headers(), ...previewHeaders() } }); }
    catch (error) { if (!/closed|disposed|already handled/i.test(String(error))) report.route_error = String(error.message).slice(0, 200); }
  });
  await context.addInitScript(({ session, household }) => {
    localStorage.setItem('sb-njomxqthjglqesxchlbm-auth-token', JSON.stringify(session));
    localStorage.setItem(`futurecart.activeHouseholdId:home:${session.user.id}`, household);
    localStorage.setItem('futurecart.appLanguage', 'en'); localStorage.setItem('futurecart.soundOn', 'false');
  }, { session, household });
  const page = await context.newPage(); page.setDefaultTimeout(90000);
  await page.goto(PREVIEW + '/'); await page.locator('[data-backend="home"]').waitFor();
  await page.getByRole('button', { name: 'New category', exact: true }).waitFor();
  assert.equal(report.route_error, undefined);
  record('actual root app loads authenticated home backend at verified final source', { revision: await page.locator('[data-backend="home"]').getAttribute('data-revision') });

  const rollback = latest('rollback-'), expiry = latest('expiry-browser-'); assert.ok(rollback && expiry);
  const counts = (await db.query('SELECT (SELECT count(*)::int FROM shopping.operations WHERE id=$1) AS ledger,(SELECT count(*)::int FROM shopping.result_outbox WHERE operation_id=$1) AS outbox,(SELECT count(*)::int FROM shopping.products WHERE id=(SELECT (result->\'data\'->\'record\'->>\'id\')::uuid FROM shopping.operations WHERE id=$1)) AS products', [rollback.data.pending_operation_id])).rows[0];
  assert.deepEqual(counts, { ledger: 1, outbox: 1, products: 1 });
  const expired = (await db.query('SELECT (SELECT count(*)::int FROM shopping.operations WHERE id=$1) AS ledger,(SELECT count(*)::int FROM shopping.result_outbox WHERE operation_id=$1) AS outbox,(SELECT count(*)::int FROM shopping.products WHERE id=$2) AS products', [expiry.data.operation_id, expiry.data.product_id])).rows[0];
  assert.deepEqual(expired, { ledger: 0, outbox: 0, products: 0 });
  record('rollback commit retained exactly once; expired neveraccepted operation remains absent', { rollback_report: rollback.name, committed_counts: counts, expiry_report: expiry.name, expired_counts: expired });
  const health = JSON.parse(readFileSync('.stage0-runtime/stage3-health.json'));
  assert.ok(health.connected && health.clock_healthy && Date.now() - Date.parse(health.at) < 15000);
  assert.notEqual(JSON.parse(readFileSync('.stage0-runtime/stage3-config.json')).faultInjectionEnabled, true);
  for (const unit of ['shopping-list-stage0-postgres.service', 'shopping-list-stage2-backend.service', 'shopping-list-stage3-backend.service']) assert.equal(execFileSync('systemctl', ['--user', 'show', unit, '-p', 'ActiveState', '--value'], { encoding: 'utf8' }).trim(), 'active');
  const audit = JSON.parse(readFileSync('docs/stage0/vercel-isolation.json'));
  assert.equal(audit.status, 'PASS'); assert.ok(audit.production_deployment_unchanged && audit.production_secret_records_preserved);
  record('dedicated services healthy, faults disabled, production metadata audit passes', { audit_at: audit.verified_at });
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL'; report.error = { name: error.name, message: String(error.message).replace(/eyJ[A-Za-z0-9_.-]+/g, '[REDACTED]').slice(0, 1200) }; process.exitCode = 1;
} finally {
  try { await context?.close(); } catch { /* Evidence remains valid if already closed. */ }
  try { await browser?.close(); } catch { /* No shared browser is used. */ }
  await db.end();
  const path = `docs/stage4/attempts/final-check-${report.id}.json`;
  writeFileSync(path, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: report.status, path, checks: report.checks.length, error: report.error }));
}
