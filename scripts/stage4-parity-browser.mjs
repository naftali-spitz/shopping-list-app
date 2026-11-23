import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import pg from '../backend/node_modules/pg/lib/index.js';
import { PREVIEW, previewHeaders } from './stage3-preview-check.mjs';

// Does not stop services, change fault controls, revoke another user's session,
// or use production. Intentional faults here affect only owned browser contexts.
execFileSync(process.execPath, ['scripts/stage0-preflight.mjs'], { stdio: ['ignore', 'pipe', 'pipe'] });
const require = createRequire('/home/naf-w/.local/share/shopping-list-tools/package.json');
const { chromium } = require('playwright-core');
const accounts = JSON.parse(readFileSync('.stage0-runtime/stage3-accounts.json'));
const { households } = JSON.parse(readFileSync('.stage0-runtime/stage3-auth-state.json'));
const report = { id: randomUUID(), at: new Date().toISOString(), sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), preview: PREVIEW, scope: 'actual original UI; browser-only offline, refresh, duplicate request, concurrent quantity, stale snapshot and logout tests; no Debian/service faults', checks: [], operations: [], requests: [] };
const crossTabOnly = process.argv.includes('--cross-tab-only');
report.focused_cross_tab_continuation = crossTabOnly;
const output = `docs/stage4/attempts/parity-browser-${report.id}`;
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
const contexts = [];
const guardedRoute = handler => async route => {
  try { await handler(route); }
  catch (error) {
    // Reload/unroute may dispose an already-intercepted request. This is a
    // Playwright control lifetime, never a business/network result.
    if (/Route is already handled|Target page, context or browser has been closed/.test(String(error.message))) report.route_lifecycle_cancellations = (report.route_lifecycle_cancellations ?? 0) + 1;
    else throw error;
  }
};
process.on('uncaughtExceptionMonitor', error => {
  writeFileSync(`${output}/crash.json`, JSON.stringify({ ...report, status: 'FAIL', error: { name: error.name, message: String(error.message).slice(0, 1000) } }, null, 2) + '\n', { flag: 'wx' });
});
const record = (name, evidence = {}) => { const check = { name, status: 'PASS', ...evidence }; report.checks.push(check); appendFileSync(`${output}/checks.jsonl`, JSON.stringify(check) + '\n'); writeFileSync(`${output}/progress.json`, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ check: name, status: 'PASS' })); };
const literal = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
let lastPage;

async function login(index) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); contexts.push(context);
  await context.route(PREVIEW + '/**', guardedRoute(route => route.continue({ headers: { ...route.request().headers(), ...previewHeaders() } })));
  await context.addInitScript(({ household, user }) => {
    localStorage.setItem('futurecart.appLanguage', 'en'); localStorage.setItem('futurecart.soundOn', 'false');
    localStorage.setItem(`futurecart.activeHouseholdId:home:${user}`, household);
  }, { household: households[0], user: accounts[index].id });
  const page = await context.newPage(); page.setDefaultTimeout(90000); lastPage = page;
  page.on('response', async response => {
    if (response.url() !== PREVIEW + '/api/stage3') return;
    try {
      const request = response.request().postDataJSON(), body = await response.json();
      report.requests.push({ at: new Date().toISOString(), account: index, action: request.action, type: request.intent?.type, status: response.status(), error: body.error, state: body.state, result: body.result?.status });
    } catch { /* No headers, tokens or raw bodies in evidence. */ }
  });
  await page.goto(PREVIEW + '/');
  await page.getByLabel('Email', { exact: true }).fill(accounts[index].email);
  await page.getByLabel('Password', { exact: true }).fill(accounts[index].password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'New category', exact: true }).waitFor();
  return { page, context };
}
async function persisted(page, id, state = 'committed') {
  await page.waitForFunction(({ id, state }) => Object.keys(localStorage).filter(key => key.startsWith('shopping-stage3-v2:') && key.endsWith(':stage4')).some(key => {
    try { return JSON.parse(localStorage.getItem(key)).some(pending => pending.intent.id === id && pending.result?.status === state); } catch { return false; }
  }), { id, state }, { timeout: 120000 });
}
async function operation(page, type, predicate, action, wait = true) {
  const requestPromise = page.waitForRequest(request => {
    if (request.url() !== PREVIEW + '/api/stage3') return false;
    try { const body = request.postDataJSON(); return body.action === 'command' && body.intent?.type === 'stage4.' + type && predicate(body.intent); } catch { return false; }
  });
  await action(); const intent = (await requestPromise).postDataJSON().intent;
  if (wait) await persisted(page, intent.id);
  report.operations.push({ id: intent.id, correlation_id: intent.correlation_id, type: intent.type, expected_version: intent.expected_version });
  return intent;
}
async function product(id) {
  return (await db.query('SELECT id,name,quantity::float8,checked,version::int,household_id,deleted_at FROM shopping.products WHERE id=$1', [id])).rows[0];
}
async function oneEffect(id) {
  const counts = (await db.query('SELECT (SELECT count(*)::int FROM shopping.operations WHERE id=$1) AS operations,(SELECT count(*)::int FROM shopping.result_outbox WHERE operation_id=$1) AS outbox', [id])).rows[0];
  assert.deepEqual(counts, { operations: 1, outbox: 1 }); return counts;
}
function drawerRow(page, name) { return page.getByRole('button', { name: 'Increase ' + name, exact: true }).filter({ visible: true }); }
function modal(page, name) { return page.getByRole('heading', { name, exact: true, level: 2 }).locator('xpath=ancestor::div[contains(@class,"max-w-xl")][1]'); }
async function openCategory(page, name) {
  const heading = page.getByRole('heading', { name, exact: true, level: 2 });
  if (!await heading.isVisible()) await page.getByRole('heading', { name, exact: true, level: 3 }).click();
  await heading.waitFor();
  return modal(page, name);
}
async function closeCategory(page, name) {
  const heading = page.getByRole('heading', { name, exact: true, level: 2 });
  await modal(page, name).getByRole('button', { name: 'Close', exact: true }).click();
  await heading.waitFor({ state: 'detached' });
}
async function visibleQuantity(page, name, quantity) {
  // The original drawer has separate hidden desktop/mobile render branches.
  const increase = drawerRow(page, name);
  await increase.waitFor();
  await page.waitForFunction(({ name, quantity }) => Array.from(document.querySelectorAll('button')).some(button => button.getAttribute('aria-label') === 'Increase ' + name && button.getBoundingClientRect().width > 0 && button.parentElement.textContent.includes(String(quantity))), { name, quantity });
}

try {
  report.scope = 'focused actual original UI search, missing product, quick add and custom drag ordering; development only';
  const a = await login(0), page = a.page;
  const suffix = report.id.slice(0, 8), categoryName = 'Parity ' + suffix;
  await page.getByRole('button', { name: 'New category', exact: true }).click();
  await page.getByPlaceholder('Category name', { exact: true }).fill(categoryName);
  const category = await operation(page, 'category.create', i => i.payload.name === categoryName, () => page.getByRole('button', { name: 'Create', exact: true }).click());
  await openCategory(page, categoryName);
  const dialog = modal(page, categoryName), names = ['Alpha ', 'Middle ', 'Zulu '].map(n => n + suffix), products = [];
  for (const name of names) {
    await dialog.getByPlaceholder('Add product', { exact: true }).fill(name);
    products.push(await operation(page, 'product.create', i => i.payload.name === name, () => dialog.getByRole('button', { name: 'Add', exact: true }).click()));
  }
  await dialog.getByPlaceholder('Search products', { exact: true }).fill(names[1]);
  await dialog.getByText(names[1], { exact: true }).waitFor();
  assert.equal(await dialog.getByText(names[0], { exact: true }).count(), 0);
  await dialog.getByPlaceholder('Search products', { exact: true }).fill('');
  await dialog.getByRole('combobox').selectOption('az');
  const labels = () => dialog.getByRole('button').filter({ hasText: new RegExp('^(Alpha|Middle|Zulu) ' + suffix) }).allTextContents();
  assert.deepEqual((await labels()).map(t => t.trim().split(/\s+/)[0]), ['Alpha', 'Middle', 'Zulu']);
  record('category-local search filters products and A-Z sorting preserves names');
  await dialog.getByRole('combobox').selectOption('custom');
  const handles = dialog.getByRole('button', { name: 'Reorder product', exact: true });
  await handles.nth(2).scrollIntoViewIfNeeded();
  const from = await handles.nth(2).boundingBox(), to = await handles.nth(0).boundingBox();
  assert.ok(from && to);
  const moved = await operation(page, 'product.update', i => i.payload.id === products[2].payload.id && i.payload.display_order !== undefined, async () => {
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2 - 15, { steps: 24 });
    await page.waitForTimeout(350);
    await page.mouse.up();
  });
  await oneEffect(moved.id);
  const ordered = (await db.query('SELECT name,display_order::float8 FROM shopping.products WHERE category_id=$1 AND deleted_at IS NULL ORDER BY display_order,name', [category.payload.id])).rows;
  assert.equal(ordered[0].name, names[2]);
  await closeCategory(page, categoryName);
  await page.reload(); await page.getByRole('button', { name: 'New category', exact: true }).waitFor();
  await openCategory(page, categoryName); await modal(page, categoryName).getByRole('combobox').selectOption('custom');
  const first = await modal(page, categoryName).getByRole('button').filter({ hasText: new RegExp('^(Alpha|Middle|Zulu) ' + suffix) }).first().textContent();
  assert.ok(first.includes(names[2]));
  await closeCategory(page, categoryName);
  record('actual custom drag persists PostgreSQL display order and survives reload', { operation_id: moved.id, ordered });
  const search = page.getByPlaceholder('Quick search to add to the list...', { exact: true });
  await search.fill(names[0]);
  const quick = await operation(page, 'product.update', i => i.payload.id === products[0].payload.id && i.payload.checked === true, () => page.getByRole('button', { name: new RegExp('^' + literal(names[0]) + '.*Add$') }).click());
  assert.equal((await product(products[0].payload.id)).checked, true);
  await oneEffect(quick.id);
  record('actual global search quick-add checks existing product with one authoritative effect', { operation_id: quick.id });
  const missing = 'Missing ' + suffix;
  await search.fill(missing);
  await page.getByRole('button', { name: new RegExp('Add.*' + literal(missing)) }).click();
  const missingDialog = page.getByRole('dialog', { name: 'הוספת מוצר חדש' });
  await missingDialog.getByRole('combobox').selectOption(category.payload.id);
  const added = await operation(page, 'product.create', i => i.payload.name === missing && i.payload.checked === true, () => missingDialog.getByRole('button', { name: 'הוסף לרשימה', exact: true }).click());
  assert.equal((await product(added.payload.id)).checked, true);
  await oneEffect(added.id);
  await visibleQuantity(page, missing, 1);
  record('actual unmatched global search creates checked product in selected category exactly once', { operation_id: added.id, category_id: category.payload.id });
  await page.screenshot({ path: `${output}/search-and-order.png`, fullPage: true });
  report.status = 'PASS';
} catch (error) {
  let message = String(error.message);
  for (const account of accounts) message = message.split(account.password).join('[REDACTED]');
  message = message.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED]');
  report.status = 'FAIL'; report.error = { name: error.name, message: message.slice(0, 2000) }; process.exitCode = 1;
  try { if (lastPage) await lastPage.screenshot({ path: `${output}/failure.png`, fullPage: true }); } catch {}
} finally {
  for (const context of contexts) { try { await context.close(); } catch { report.cleanup_warnings = (report.cleanup_warnings ?? 0) + 1; } }
  try { await browser.close(); } catch { report.cleanup_warnings = (report.cleanup_warnings ?? 0) + 1; }
  try { await db.end(); } catch { report.cleanup_warnings = (report.cleanup_warnings ?? 0) + 1; }
  writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ id: report.id, status: report.status, checks: report.checks.length, report: `${output}/report.json`, error: report.error }));
}
