import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import pg from '../backend/node_modules/pg/lib/index.js';
import { PREVIEW, previewHeaders } from './stage3-preview-check.mjs';

// Real elapsed-time expiry, not a fake browser clock or modified intent. Only
// the owned browser goes offline; Debian/broker/callback services keep running.
execFileSync(process.execPath, ['scripts/stage0-preflight.mjs'], { stdio: ['ignore', 'pipe', 'pipe'] });
const require = createRequire('/home/naf-w/.local/share/shopping-list-tools/package.json');
const { chromium } = require('playwright-core');
const account = JSON.parse(readFileSync('.stage0-runtime/stage3-accounts.json'))[0];
const household = JSON.parse(readFileSync('.stage0-runtime/stage3-auth-state.json')).households[0];
const report = { id: randomUUID(), at: new Date().toISOString(), target: PREVIEW, local_harness_head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), scope: 'actual original app UI; real five-minute neveraccepted intent expiry during owned-browser offline only; no service faults or clock changes', checks: [], progress: [] };
const output = `docs/stage4/attempts/expiry-browser-${report.id}`;
mkdirSync(output, { recursive: true });
// Record deployed Git source independently of the local harness working tree.
const vercel = '/home/naf-w/.local/share/shopping-list-tools/node_modules/.bin/vercel';
const inspect = JSON.parse(execFileSync(vercel, ['inspect', PREVIEW, '--json', '--scope', '0012ab-5576s-projects', '--non-interactive'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
const deployed = JSON.parse(execFileSync(vercel, ['api', `/v13/deployments/${inspect.id}?teamId=team_h5ZyD1rMpbgnak6COakN03nD&withGitRepoInfo=true`, '--method', 'GET', '--scope', '0012ab-5576s-projects', '--non-interactive'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
assert.equal(deployed.projectId, 'prj_jsqk7AsPGuxLmvWqYEsqyFClV1cM');
assert.notEqual(deployed.target, 'production');
assert.equal(deployed.gitSource?.ref, 'feature/flespi-home-backend');
report.deployment = { id: deployed.id, url: deployed.url, sha: deployed.gitSource.sha, git_ref: deployed.gitSource.ref, state: deployed.readyState, target: deployed.target };

const db = new pg.Pool({ host: '127.0.0.1', port: 55439, database: 'shopping_stage0', user: 'stage0_owner', password: readFileSync('.stage0-runtime/admin-password', 'utf8').trim(), max: 1 });
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
let page;
const record = (name, detail = {}) => { report.checks.push({ name, status: 'PASS', ...detail }); console.log(JSON.stringify({ check: name, status: 'PASS' })); };
function persistReport() { writeFileSync(`${output}/progress.json`, JSON.stringify(report, null, 2) + '\n'); }
async function queueEntry(id) {
  return page.evaluate(id => Object.keys(localStorage).filter(key => key.endsWith(':stage4')).flatMap(key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return []; } }).find(p => p.intent.id === id), id);
}
try {
  await context.route(PREVIEW + '/**', async route => {
    try { await route.continue({ headers: { ...route.request().headers(), ...previewHeaders() } }); }
    catch (error) { if (!/Target page, context or browser has been closed|Route is already handled/.test(String(error.message))) throw error; }
  });
  await context.addInitScript(({ user, household }) => {
    localStorage.setItem('futurecart.appLanguage', 'en');
    localStorage.setItem('futurecart.soundOn', 'false');
    localStorage.setItem(`futurecart.activeHouseholdId:home:${user}`, household);
  }, { user: account.id, household });
  page = await context.newPage(); page.setDefaultTimeout(120000);
  await page.goto(PREVIEW + '/');
  await page.getByLabel('Email', { exact: true }).fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'New category', exact: true }).waitFor();
  report.browser_assets = await page.locator('script[src]').evaluateAll(nodes => nodes.map(node => new URL(node.src).pathname));
  const categoryName = 'Expiry ' + report.id.slice(0, 8), productName = 'Never committed ' + report.id.slice(0, 8);
  await page.getByRole('button', { name: 'New category', exact: true }).click();
  await page.getByPlaceholder('Category name', { exact: true }).fill(categoryName);
  const categoryRequest = page.waitForRequest(request => { try { const body = request.postDataJSON(); return request.url() === PREVIEW + '/api/stage3' && body.intent?.type === 'stage4.category.create' && body.intent.payload.name === categoryName; } catch { return false; } });
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  const categoryIntent = (await categoryRequest).postDataJSON().intent;
  await page.waitForFunction(id => Object.keys(localStorage).filter(key => key.endsWith(':stage4')).some(key => { try { return JSON.parse(localStorage.getItem(key)).some(p => p.intent.id === id && p.result?.status === 'committed'); } catch { return false; } }), categoryIntent.id);
  await page.getByRole('heading', { name: categoryName, exact: true, level: 3 }).click();
  const modal = page.getByRole('heading', { name: categoryName, exact: true, level: 2 }).locator('xpath=ancestor::div[contains(@class,"max-w-xl")][1]');
  await modal.getByPlaceholder('Add product', { exact: true }).fill(productName);
  await context.setOffline(true);
  await modal.getByRole('button', { name: 'Add', exact: true }).click();
  await page.waitForFunction(name => Object.keys(localStorage).filter(key => key.endsWith(':stage4')).some(key => { try { return JSON.parse(localStorage.getItem(key)).some(p => !p.result && p.intent.type === 'stage4.product.create' && p.intent.payload.name === name); } catch { return false; } }), productName);
  const pending = await page.evaluate(name => Object.keys(localStorage).filter(key => key.endsWith(':stage4')).flatMap(key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return []; } }).find(p => !p.result && p.intent.payload.name === name), productName);
  const original = pending.intent;
  report.operation_id = original.id; report.correlation_id = original.correlation_id; report.product_id = original.payload.id;
  report.intent_issued_ms = original.issued_ms; report.intent_expires_ms = original.expires_ms;
  assert.equal(original.expires_ms - original.issued_ms, 300000);
  const before = (await db.query('SELECT (SELECT count(*)::int FROM shopping.operations WHERE id=$1) AS ledger,(SELECT count(*)::int FROM shopping.products WHERE id=$2) AS products', [original.id, original.payload.id])).rows[0];
  assert.deepEqual(before, { ledger: 0, products: 0 });
  await modal.getByText(productName, { exact: true }).waitFor();
  await page.screenshot({ path: `${output}/offline-pending.png`, fullPage: true });
  record('offline product creation persists original immutable ID and renders pending before any acceptance', { counts: before });
  const offlineStart = Date.now();
  persistReport();
  while (Date.now() <= original.expires_ms + 1500) {
    const remaining = original.expires_ms + 1600 - Date.now();
    await new Promise(resolve => setTimeout(resolve, Math.min(50000, Math.max(1, remaining))));
    const current = await queueEntry(original.id);
    assert.ok(current); assert.equal(current.result, undefined); assert.deepEqual(current.intent, original);
    const point = { at: new Date().toISOString(), elapsed_offline_ms: Date.now() - offlineStart, state: current.state, saved: false };
    report.progress.push(point); persistReport(); console.log(JSON.stringify({ expiry_wait: point }));
  }
  report.elapsed_offline_ms = Date.now() - offlineStart;
  await context.setOffline(false);
  await page.waitForFunction(id => Object.keys(localStorage).filter(key => key.endsWith(':stage4')).some(key => { try { return JSON.parse(localStorage.getItem(key)).some(p => p.intent.id === id && p.result?.status === 'expired'); } catch { return false; } }), original.id);
  const failed = await queueEntry(original.id);
  assert.equal(failed.state, 'Failed'); assert.equal(failed.result.status, 'expired'); assert.deepEqual(failed.intent, original);
  const after = (await db.query('SELECT (SELECT count(*)::int FROM shopping.operations WHERE id=$1) AS ledger,(SELECT count(*)::int FROM shopping.result_outbox WHERE operation_id=$1) AS outbox,(SELECT count(*)::int FROM shopping.products WHERE id=$2) AS products', [original.id, original.payload.id])).rows[0];
  assert.deepEqual(after, { ledger: 0, outbox: 0, products: 0 });
  const reconciliation = (await db.query('SELECT id,result FROM shopping.operations WHERE id=$1', [failed.reconciliation.id])).rows[0];
  assert.equal(reconciliation.result.status, 'not_found');
  report.reconciliation = { id: reconciliation.id, status: reconciliation.result.status, counts: after };
  await page.screenshot({ path: `${output}/expired-failed.png`, fullPage: true });
  record('real deadline expiry is reconciled by authenticated PostgreSQL operation.status then shown Failed with zero effects', report.reconciliation);
  report.status = 'PASS';
} catch (error) {
  let message = String(error.message).split(account.password).join('[REDACTED]').replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED]');
  report.status = 'FAIL'; report.error = { name: error.name, message: message.slice(0, 2000) }; process.exitCode = 1;
  try { if (page) await page.screenshot({ path: `${output}/failure.png`, fullPage: true }); } catch {}
} finally {
  try { await context.close(); } catch { report.cleanup_warnings = (report.cleanup_warnings ?? 0) + 1; }
  try { await browser.close(); } catch { report.cleanup_warnings = (report.cleanup_warnings ?? 0) + 1; }
  try { await db.end(); } catch { report.cleanup_warnings = (report.cleanup_warnings ?? 0) + 1; }
  writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ id: report.id, status: report.status, report: `${output}/report.json`, checks: report.checks.length, error: report.error }));
}
