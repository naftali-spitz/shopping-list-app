import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import pg from '../backend/node_modules/pg/lib/index.js';
import { PREVIEW, previewHeaders, api, intent } from './stage3-preview-check.mjs';

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
const output = `docs/stage4/attempts/reliability-browser-${report.id}`;
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
async function browserSession(page) { return page.evaluate(() => JSON.parse(localStorage.getItem('sb-njomxqthjglqesxchlbm-auth-token'))); }
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

async function logout(page, categoryName) {
  const session = await browserSession(page);
  await page.getByRole('button', { name: 'Open menu and settings', exact: true }).click();
  await page.getByRole('button', { name: /^Logout/ }).click();
  await page.getByLabel('Email', { exact: true }).waitFor();
  if (categoryName) assert.equal(await page.getByRole('heading', { name: categoryName, exact: true }).count(), 0);
  const rejectedIntent = intent(randomUUID(), 'stage4.household.create', { name: 'Must not create after UI logout' }, 0);
  const denied = await api({ action: 'command', intent: rejectedIntent }, session);
  assert.equal(denied.status, 401);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM shopping.operations WHERE id=$1', [rejectedIntent.id])).rows[0].n, 0);
  await page.screenshot({ path: `${output}/logged-out.png`, fullPage: true });
  record('actual UI global logout clears household rendering, returns to login and invalidates prior authenticated API access', { prior_session_api_status: denied.status });
}

try {
  if (process.argv.includes('--logout-only')) {
    report.scope = 'focused actual UI logout; other feature browser tests idle';
    const account = await login(1);
    await logout(account.page);
  } else {
  const a = await login(0), b = await login(1);
  const suffix = report.id.slice(0, 8), categoryName = 'Reliability ' + suffix, name = 'Reliable product ' + suffix;
  await a.page.getByRole('button', { name: 'New category', exact: true }).click();
  await a.page.getByPlaceholder('Category name', { exact: true }).fill(categoryName);
  const category = await operation(a.page, 'category.create', i => i.payload.name === categoryName, () => a.page.getByRole('button', { name: 'Create', exact: true }).click());
  await openCategory(a.page, categoryName);
  const categoryDialog = modal(a.page, categoryName);
  await categoryDialog.getByPlaceholder('Add product', { exact: true }).fill(name);
  const created = await operation(a.page, 'product.create', i => i.payload.name === name, () => categoryDialog.getByRole('button', { name: 'Add', exact: true }).click());
  const productId = created.payload.id;
  const checked = await operation(a.page, 'product.update', i => i.payload.id === productId && i.payload.checked === true, () => categoryDialog.getByRole('button', { name: new RegExp('^' + literal(name) + '\\s*\\d+x$') }).evaluate(button => { button.click(); button.click(); button.click(); }));
  await closeCategory(a.page, categoryName);
  assert.equal((await product(productId)).checked, true); await oneEffect(checked.id);
  await b.page.getByRole('heading', { name: categoryName, exact: true, level: 3 }).waitFor();
  await visibleQuantity(b.page, name, 1);
  record('two authenticated original app views receive real created/checked product', { category_id: category.payload.id, product_id: productId });
  const checkedCount = (await db.query("SELECT count(*)::int AS count FROM shopping.operations WHERE result->'data'->'record'->>'id'=$1 AND operation_type='stage4.product.update' AND result->'data'->'record'->>'checked'='true'", [productId])).rows[0].count;
  assert.equal(checkedCount, 1);
  record('three immediate check taps preserve existing pending guard and produce one intended committed check', { operation_id: checked.id, committed_checked_updates: checkedCount });

  if (!crossTabOnly) {
  // A deliberate browser offline action is locally durable before any HTTP
  // acceptance. It must remain pending, with the same operation ID after reconnect.
  await a.context.setOffline(true);
  await drawerRow(a.page, name).click();
  await a.page.waitForFunction(productId => Object.keys(localStorage).filter(key => key.endsWith(':stage4')).some(key => { try { return JSON.parse(localStorage.getItem(key)).some(p => !p.result && p.intent.payload.id === productId); } catch { return false; } }), productId, { timeout: 15000 });
  const offline = await a.page.evaluate(productId => Object.keys(localStorage).filter(key => key.endsWith(':stage4')).flatMap(key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return []; } }).find(p => !p.result && p.intent.payload.id === productId), productId);
  assert.ok(offline); assert.equal(offline.result, undefined); assert.equal((await product(productId)).quantity, 1);
  await visibleQuantity(a.page, name, 2);
  await a.context.setOffline(false); await persisted(a.page, offline.intent.id);
  assert.equal((await product(productId)).quantity, 2); await oneEffect(offline.intent.id);
  await visibleQuantity(b.page, name, 2);
  report.operations.push({ id: offline.intent.id, correlation_id: offline.intent.correlation_id, type: offline.intent.type });
  record('offline quantity is optimistic and pending; reconnect commits original durable ID exactly once', { operation_id: offline.intent.id });

  // Re-send the exact recorded intent through the real Preview to exercise
  // duplicate acceptance/delivery semantics without issuing another UI intent.
  const session = await browserSession(a.page);
  const duplicate = await api({ action: 'command', intent: offline.intent }, session);
  assert.equal(duplicate.data.result.status, 'committed'); assert.equal(duplicate.data.duplicate, true);
  assert.equal((await product(productId)).quantity, 2); await oneEffect(offline.intent.id);
  record('same-ID retry after lost acknowledgement returns prior commit without another quantity increment', { operation_id: offline.intent.id });

  // Refresh while an actual committed result is delayed only at this browser's
  // response boundary. Server callbacks and Debian remain running normally.
  let delayedId;
  let resultHeld = true;
  await a.page.route(PREVIEW + '/api/stage3', guardedRoute(async route => {
    const body = route.request().postDataJSON();
    const response = await route.fetch({ headers: { ...route.request().headers(), ...previewHeaders() } });
    if (resultHeld && body.action === 'status' && body.id === delayedId) await route.fulfill({ response, json: { id: delayedId, state: 'accepted_pending' } });
    else await route.fulfill({ response });
  }));
  const refreshIntent = await operation(a.page, 'product.update', i => i.payload.id === productId && i.payload.quantity === 3, async () => {
    await drawerRow(a.page, name).click();
  }, false);
  delayedId = refreshIntent.id;
  // SQL verifies the commit independently while the UI is unable to retrieve it.
  const commitDeadline = Date.now() + 90000;
  while (Date.now() < commitDeadline && (await product(productId)).quantity !== 3) await new Promise(resolve => setTimeout(resolve, 300));
  assert.equal((await product(productId)).quantity, 3);
  await a.page.reload(); await a.page.getByRole('button', { name: 'New category', exact: true }).waitFor();
  const afterRefresh = await a.page.evaluate(id => Object.keys(localStorage).filter(key => key.endsWith(':stage4')).flatMap(key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return []; } }).find(p => p.intent.id === id), delayedId);
  assert.ok(afterRefresh); assert.equal(afterRefresh.result, undefined);
  resultHeld = false; await persisted(a.page, delayedId); await oneEffect(delayedId);
  await a.page.unrouteAll({ behavior: 'wait' }); await visibleQuantity(b.page, name, 3);
  record('refresh preserves pending ID while committed result is delayed; retrieval recovers Saved', { operation_id: delayedId, fault_scope: 'owned browser status response only; actual callback not delayed' });

  // Capture a full older authoritative snapshot, then ask both users to modify
  // the same current product revision before either can see the other's result.
  let staleSnapshot;
  const capture = async response => { try { if (response.url() === PREVIEW + '/api/stage3') { const body = await response.json(); if (body.result?.status === 'snapshot' && body.result.data?.products) staleSnapshot = body; } } catch {} };
  b.page.on('response', capture);
  const captureDeadline = Date.now() + 30000;
  while (!staleSnapshot && Date.now() < captureDeadline) await new Promise(resolve => setTimeout(resolve, 250));
  b.page.off('response', capture); assert.ok(staleSnapshot);
  const before = await product(productId);
  const updates = await Promise.all([
    operation(a.page, 'product.update', i => i.payload.id === productId && i.payload.quantity === 4, () => drawerRow(a.page, name).click(), false),
    operation(b.page, 'product.update', i => i.payload.id === productId && i.payload.quantity === 4, () => drawerRow(b.page, name).click(), false),
  ]);
  assert.equal(updates[0].expected_version, before.version); assert.equal(updates[1].expected_version, before.version);
  await Promise.all(updates.map((i, index) => (index ? b.page : a.page).waitForFunction(id => Object.keys(localStorage).filter(key => key.endsWith(':stage4')).some(key => { try { return JSON.parse(localStorage.getItem(key)).some(p => p.intent.id === id && p.result); } catch { return false; } }), i.id)));
  const outcomes = (await db.query('SELECT id,result FROM shopping.operations WHERE id=ANY($1::uuid[])', [updates.map(i => i.id)])).rows;
  assert.deepEqual(outcomes.map(row => row.result.status).sort(), ['committed', 'version_conflict']);
  assert.equal((await product(productId)).quantity, 4);
  await visibleQuantity(a.page, name, 4); await visibleQuantity(b.page, name, 4);
  record('two users at one product version produce one commit and one explicit conflict; views converge', { operations: outcomes.map(row => ({ id: row.id, status: row.result.status })), product: await product(productId) });

  let injected = false;
  const revisionBefore = Number(await b.page.locator('[data-backend="home"]').getAttribute('data-revision'));
  await b.page.route(PREVIEW + '/api/stage3', guardedRoute(async route => {
    const response = await route.fetch({ headers: { ...route.request().headers(), ...previewHeaders() } });
    let body; try { body = await response.json(); } catch { await route.fulfill({ response }); return; }
    if (!injected && body.result?.status === 'snapshot') { injected = true; await route.fulfill({ response, json: staleSnapshot }); }
    else await route.fulfill({ response });
  }));
  const injectionDeadline = Date.now() + 30000;
  while (!injected && Date.now() < injectionDeadline) await new Promise(resolve => setTimeout(resolve, 250));
  assert.ok(injected); await new Promise(resolve => setTimeout(resolve, 500));
  assert.ok(Number(await b.page.locator('[data-backend="home"]').getAttribute('data-revision')) >= revisionBefore);
  await visibleQuantity(b.page, name, 4);
  await b.page.unrouteAll({ behavior: 'wait' });
  record('delayed older full snapshot cannot revert newer authoritative household revision or quantity', { revision_before: revisionBefore, older_revision: staleSnapshot.result.data.household.version });

  // Rapid taps are intended absolute quantities reserved in local sequence,
  // independent of transport retries. Query their durable operation results.
  const rapid = [];
  const observeRapid = request => { try { const body = request.postDataJSON(); if (request.url() === PREVIEW + '/api/stage3' && body.action === 'command' && body.intent?.type === 'stage4.product.update' && body.intent.payload.id === productId) rapid.push(body.intent); } catch {} };
  a.page.on('request', observeRapid);
  await drawerRow(a.page, name).click(); await drawerRow(a.page, name).click(); await drawerRow(a.page, name).click();
  const rapidDeadline = Date.now() + 120000;
  while (Date.now() < rapidDeadline) {
    const terminal = rapid.length ? (await db.query('SELECT count(*)::int AS count FROM shopping.operations WHERE id=ANY($1::uuid[])', [rapid.map(i => i.id)])).rows[0].count : 0;
    if (rapid.length === 3 && terminal === 3) break;
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  a.page.off('request', observeRapid);
  assert.equal(rapid.length, 3);
  for (const intent of rapid) { await persisted(a.page, intent.id); await oneEffect(intent.id); }
  assert.deepEqual(rapid.map(i => i.payload.quantity), [5, 6, 7]);
  assert.equal((await product(productId)).quantity, 7);
  await visibleQuantity(b.page, name, 7);
  record('three rapid quantity taps reserve intended sequence and commit exactly once each', { operations: rapid.map(i => ({ id: i.id, quantity: i.payload.quantity, expected_version: i.expected_version })) });

  await openCategory(a.page, categoryName);
  const uncheckDialog = modal(a.page, categoryName);
  const unchecked = await operation(a.page, 'product.update', i => i.payload.id === productId && i.payload.checked === false, () => uncheckDialog.getByRole('button', { name: new RegExp('^' + literal(name) + '\\s*\\d+x$') }).evaluate(button => { button.click(); button.click(); button.click(); }));
  assert.equal((await product(productId)).checked, false); await oneEffect(unchecked.id);
  const rechecked = await operation(a.page, 'product.update', i => i.payload.id === productId && i.payload.checked === true, () => uncheckDialog.getByRole('button', { name: new RegExp('^' + literal(name) + '\\s*\\d+x$') }).click());
  assert.equal((await product(productId)).checked, true); await oneEffect(rechecked.id);
  await closeCategory(a.page, categoryName);
  record('rapid uncheck and subsequent deliberate recheck preserve quantity and one effect per intent', { unchecked_id: unchecked.id, rechecked_id: rechecked.id, product: await product(productId) });

  }
  const initialQuantity = crossTabOnly ? 1 : 7;

  // Two tabs share localStorage. Persist different owned records while both
  // browsers are offline, then close/reopen one tab to prove independent IDs
  // survive stale compatibility-index writes and converge after reconnect.
  const secondName = 'Tab product ' + suffix;
  await openCategory(a.page, categoryName);
  const tabDialog = modal(a.page, categoryName);
  await tabDialog.getByPlaceholder('Add product', { exact: true }).fill(secondName);
  const secondCreated = await operation(a.page, 'product.create', i => i.payload.name === secondName, () => tabDialog.getByRole('button', { name: 'Add', exact: true }).click());
  await operation(a.page, 'product.update', i => i.payload.id === secondCreated.payload.id && i.payload.checked === true, () => tabDialog.getByRole('button', { name: new RegExp('^' + literal(secondName) + '\\s*\\d+x$') }).click());
  await closeCategory(a.page, categoryName);
  const tab = await a.context.newPage(); tab.setDefaultTimeout(90000);
  await tab.goto(PREVIEW + '/'); await tab.getByRole('button', { name: 'New category', exact: true }).waitFor();
  await visibleQuantity(tab, secondName, 1);
  await a.context.setOffline(true);
  await drawerRow(a.page, name).click();
  await drawerRow(tab, secondName).click();
  await a.page.waitForFunction(ids => Object.keys(localStorage).filter(key => key.includes(':stage4:operation:')).filter(key => { try { const p = JSON.parse(localStorage.getItem(key)); return !p.result && ids.includes(p.intent.payload.id); } catch { return false; } }).length === 2, [productId, secondCreated.payload.id], { timeout: 15000 });
  const tabIntents = await a.page.evaluate(ids => Object.keys(localStorage).filter(key => key.includes(':stage4:operation:')).flatMap(key => {
    try { const pending = JSON.parse(localStorage.getItem(key)); return !pending.result && ids.includes(pending.intent.payload.id) ? [pending.intent] : []; } catch { return []; }
  }), [productId, secondCreated.payload.id]);
  assert.equal(tabIntents.length, 2); assert.equal(new Set(tabIntents.map(i => i.id)).size, 2);
  assert.equal((await product(productId)).quantity, initialQuantity); assert.equal((await product(secondCreated.payload.id)).quantity, 1);
  await tab.close();
  await a.context.setOffline(false);
  await a.page.reload(); await a.page.getByRole('button', { name: 'New category', exact: true }).waitFor();
  for (const intent of tabIntents) { await persisted(a.page, intent.id); await oneEffect(intent.id); }
  assert.equal((await product(productId)).quantity, initialQuantity + 1); assert.equal((await product(secondCreated.payload.id)).quantity, 2);
  await visibleQuantity(b.page, name, initialQuantity + 1); await visibleQuantity(b.page, secondName, 2);
  record('same-user tabs preserve independent offline operation IDs through interleaved storage, tab closure and refresh', { operations: tabIntents.map(i => ({ id: i.id, product_id: i.payload.id, quantity: i.payload.quantity })) });

  const screenshot = `${output}/desktop-reliability.png`; await a.page.screenshot({ path: screenshot, fullPage: true }); report.screenshot = screenshot;
  if (process.argv.includes('--include-logout')) {
    await logout(a.page, categoryName);
  } else report.deferred_checks = ['Global logout awaits coordination because it revokes other active test clients for the same account.'];
  }
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
