import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Compile the actual client without Next's alias loader, substituting only the
// external provider SDK. Protocol and persistence code remain unchanged.
const source = readFileSync(new URL('./client.ts', import.meta.url), 'utf8').replace("import { supabase } from '@/lib/supabase';", 'const supabase = globalThis.__shoppingAuth;');
const javascript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
let moduleSerial = 0;
const running = [];
const user = '11111111-1111-4111-8111-111111111111', household = '22222222-2222-4222-8222-222222222222';
const productId = '33333333-3333-4333-8333-333333333333', categoryId = '44444444-4444-4444-8444-444444444444';
function snapshot(version = 1, quantity = 1) {
  return { household: { id: household, name: 'Synthetic development household', version }, categories: [{ id: categoryId, household_id: household, name: 'Groceries', icon: 'general', version: 1, created_at: '2026-11-20T00:00:00Z' }], products: [{ id: productId, household_id: household, category_id: categoryId, name: 'Milk', checked: true, quantity, version, usage_count: 0, display_order: null, created_at: '2026-11-20T00:00:00Z' }], shopping_history: [] };
}
async function setup(fetcher = async () => Response.json({ state: 'accepted_pending' })) {
  const data = new Map();
  globalThis.localStorage = { get length() { return data.size; }, key: index => [...data.keys()][index] ?? null, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
  globalThis.__shoppingAuth = { auth: { getSession: async () => ({ data: { session: { user: { id: user }, access_token: 'synthetic-not-a-real-token' } } }) } };
  globalThis.fetch = fetcher;
  const clientModule = await import('data:text/javascript;base64,' + Buffer.from(javascript + `\n// instance ${moduleSerial++}`).toString('base64'));
  const client = new clientModule.ShoppingClient(user, household); running.push(client);
  return { clientModule, client, data };
}
afterEach(() => { for (const client of running.splice(0)) client.dispose(); });

test('intent and queue persist before optimistic rendering; PUBACK never means Saved', async () => {
  const { client, data } = await setup();
  client.snapshot = snapshot();
  const pending = client.mutateLatest('product.update', { id: productId, quantity: 2 });
  assert.equal(client.view().products[0].quantity, 2);
  assert.equal(client.current().products[0].quantity, 1);
  const operation = client.operations()[0];
  assert.equal(operation.intent.type, 'stage4.product.update');
  assert.equal(JSON.parse(data.get(client.storageKey))[0].intent.id, operation.intent.id);
  await client.process(operation);
  assert.equal(operation.state, 'Saving'); assert.equal(operation.result, undefined);
  client.settle(operation, { status: 'committed', data: { record: { ...snapshot(2, 2).products[0] }, household_version: 2 } });
  assert.equal((await pending).error, null); assert.equal(client.current().products[0].quantity, 2);
  assert.equal(operation.state, 'Saved');
});

test('rapid quantity intents reserve successive versions without changing IDs or payloads', async () => {
  const { client } = await setup(); client.snapshot = snapshot();
  const first = client.mutateLatest('product.update', { id: productId, quantity: 2 });
  const second = client.mutateLatest('product.update', { id: productId, quantity: 3 });
  const [a, b] = client.operations();
  assert.equal(a.intent.expected_version, 1); assert.equal(b.intent.expected_version, 2);
  assert.equal(client.view().products[0].quantity, 3);
  client.settle(a, { status: 'committed', data: { record: snapshot(2, 2).products[0], household_version: 2 } });
  assert.equal(client.view().products[0].quantity, 3);
  client.settle(b, { status: 'version_conflict', data: { current_version: 4 } });
  assert.equal((await first).error, null); assert.match((await second).error.message, /version_conflict/);
  assert.equal(client.current().products[0].quantity, 2);
});

test('stale snapshot and older commit cannot revert a newer authoritative record', async () => {
  const { client } = await setup(); client.snapshot = snapshot(4, 4);
  client.apply({ status: 'snapshot', data: snapshot(2, 2) }, {});
  client.apply({ status: 'committed', data: { record: snapshot(3, 3).products[0], household_version: 3 } }, { type: 'stage4.product.update' });
  assert.equal(client.current().products[0].quantity, 4);
  // A result can arrive after another user's commit; its partial patch establishes
  // a revision floor so a delayed full snapshot cannot regress that patch.
  client.apply({ status: 'committed', data: { record: snapshot(7, 7).products[0], household_version: 7 } }, { type: 'stage4.product.update' });
  client.apply({ status: 'snapshot', data: snapshot(6, 6) }, {});
  assert.equal(client.current().products[0].quantity, 7);
});

test('pending refresh retries precisely the original intent after verified missing status', async () => {
  const calls = [];
  const { clientModule, client } = await setup(async (_url, options) => {
    const body = JSON.parse(options.body); calls.push(body);
    return body.action === 'status' ? Response.json({ error: 'not_found' }, { status: 404 }) : Response.json({ state: 'accepted_pending' });
  });
  client.snapshot = snapshot(); void client.mutateLatest('product.update', { id: productId, quantity: 2 });
  const original = structuredClone(client.operations()[0].intent); client.dispose();
  const restored = new clientModule.ShoppingClient(user, household); running.push(restored);
  await restored.process(restored.operations()[0]);
  assert.deepEqual(calls.map(c => c.action), ['status', 'command']);
  assert.deepEqual(calls[1].intent, original);
});

test('expired uncommitted intent fails only after authenticated lane reconciliation', async () => {
  let checkId;
  const { client } = await setup(async (_url, options) => {
    const body = JSON.parse(options.body);
    if (body.action === 'command') { checkId = body.intent.id; assert.equal(body.intent.type, 'stage4.operation.status'); return Response.json({ state: 'accepted_pending' }); }
    assert.equal(body.id, checkId); return Response.json({ result: { status: 'not_found', data: null } });
  });
  client.snapshot = snapshot(); const promise = client.mutateLatest('product.update', { id: productId, quantity: 2 });
  const operation = client.operations()[0]; operation.intent.expires_ms = Date.now() - 1; localStorage.setItem(client.storageKey + ':operation:' + operation.intent.id, JSON.stringify(operation));
  assert.equal(operation.state, 'Saving');
  await client.process(operation);
  assert.equal(operation.state, 'Failed'); assert.match((await promise).error.message, /expired/);
});

test('storage failure refuses changes and logout preserves pending IDs without sending another identity', async () => {
  const { client, data } = await setup(); client.snapshot = snapshot();
  const originalSet = localStorage.setItem; localStorage.setItem = () => { throw new Error('quota'); };
  assert.match((await client.mutateLatest('product.update', { id: productId, quantity: 2 })).error.message, /persist/);
  assert.equal(client.operations().length, 0); localStorage.setItem = originalSet;
  const promise = client.mutateLatest('product.update', { id: productId, quantity: 2 });
  const id = client.operations()[0].intent.id; client.dispose();
  assert.match((await promise).error.message, /Session changed/);
  assert.equal(JSON.parse(data.get(client.storageKey))[0].intent.id, id);
  assert.equal(client.current(), null);
});

test('stage3 legacy and stage4 namespace share implementation without sharing queue writes', async () => {
  const { clientModule, client } = await setup();
  const old = new clientModule.ShoppingClient(user, household, 'stage3'); running.push(old);
  assert.equal(old.storageKey, `shopping-stage3-v2:${user}:${household}`);
  assert.notEqual(client.storageKey, old.storageKey);
  assert.equal(clientModule.createIntent(household, 'product.create', {}, 0, 'stage3').type, 'product.create');
});

test('lost command acknowledgement retries the original immutable ID after verified missing acceptance', async () => {
  const sent = [];
  const { client } = await setup(async (_url, request) => {
    const body = JSON.parse(request.body);
    if (body.action === 'status') return Response.json({ error: 'not_found' }, { status: 404 });
    sent.push(body.intent);
    if (sent.length === 1) throw new TypeError('temporary network loss');
    return Response.json({ result: { status: 'committed', data: { record: snapshot(2, 2).products[0], household_version: 2 } } });
  });
  client.snapshot = snapshot(); const pending = client.mutateLatest('product.update', { id: productId, quantity: 2 });
  const operation = client.operations()[0];
  await assert.rejects(client.process(operation), /network loss/);
  await client.process(operation);
  assert.deepEqual(sent[0], sent[1]); assert.equal((await pending).error, null);
});

test('expired unresolved intent fails only after authenticated database operation.status says not_found', async () => {
  const commands = [];
  const { client } = await setup(async (_url, request) => {
    const body = JSON.parse(request.body);
    if (body.action === 'command') { commands.push(body.intent); return Response.json({ state: 'accepted_pending' }); }
    return Response.json({ result: { status: 'not_found', data: null } });
  });
  client.snapshot = snapshot(); const pending = client.mutateLatest('product.update', { id: productId, quantity: 2 });
  const operation = client.operations()[0]; operation.intent.expires_ms = Date.now() - 1; localStorage.setItem(client.storageKey + ':operation:' + operation.intent.id, JSON.stringify(operation));
  await client.process(operation);
  assert.equal(commands.length, 1); assert.equal(commands[0].type, 'stage4.operation.status');
  assert.equal(commands[0].payload.operation_id, operation.intent.id);
  assert.equal(operation.state, 'Failed'); assert.match((await pending).error.message, /expired/);
});

test('changed provider identity cannot issue or reconcile another users pending command', async () => {
  let networkCalls = 0;
  const { client } = await setup(async () => { networkCalls++; return Response.json({}); });
  client.snapshot = snapshot(); const pending = client.mutateLatest('product.update', { id: productId, quantity: 2 });
  globalThis.__shoppingAuth.auth.getSession = async () => ({ data: { session: { user: { id: 'other-user' }, access_token: 'synthetic' } } });
  await assert.rejects(client.process(client.operations()[0]), /Sign in again/);
  assert.equal(networkCalls, 0); assert.equal(client.operations()[0].result, undefined);
  client.dispose(); await pending;
});

test('household-version operations reserve prior local mutations but read queries do not advance it', async () => {
  const { client } = await setup(); client.snapshot = snapshot(10, 1);
  const a = client.mutateLatest('product.update', { id: productId, quantity: 2 });
  const b = client.mutateLatest('category.create', { id: '55555555-5555-4555-8555-555555555555', name: 'New category' });
  const query = client.mutateLatest('household.members', {});
  const exported = client.mutateLatest('list.export', { history_id: '66666666-6666-4666-8666-666666666666' });
  const operations = client.operations();
  assert.equal(operations[3].intent.expected_version, 12);
  assert.equal(client.view().household.version, 13);
  // A snapshot that already contains an unresolved own write must not count
  // that write a second time when reserving the next household version.
  client.snapshot = snapshot(11, 2);
  assert.equal(client.view().household.version, 13);
  client.dispose(); await Promise.all([a, b, query, exported]);
});

test('list export never returns cached pre-export history while its full authoritative effect is missing', async () => {
  const { client } = await setup(); client.snapshot = snapshot();
  const exported = client.mutateLatest('list.export', { history_id: '66666666-6666-4666-8666-666666666666' });
  const operation = client.operations()[0];
  client.settle(operation, { status: 'committed', data: { record: [{ ...snapshot().products[0], checked: false }], household_version: 2 } });
  await exported;
  let resolved = false;
  const reading = client.read().then(value => { resolved = true; return value; });
  await Promise.resolve(); assert.equal(resolved, false);
  client.apply({ status: 'snapshot', data: snapshot(1) }, {});
  await Promise.resolve(); assert.equal(resolved, false);
  const authoritative = snapshot(2); authoritative.shopping_history = [{ id: operation.intent.payload.history_id, household_id: household, items: [{ id: productId, name: 'Milk', quantity: 1, category_id: categoryId }], exported_at: new Date().toISOString(), version: 1 }];
  client.apply({ status: 'snapshot', data: authoritative }, {});
  assert.equal((await reading).shopping_history.length, 1);
});

test('terminal snapshot denial clears authority and rejects initial or refresh readers', async () => {
  const { client } = await setup(async () => Response.json({ result: { status: 'forbidden', data: null } }));
  client.snapshot = snapshot();
  const reading = client.read({ refresh: true });
  const denial = assert.rejects(reading, /no longer authorized/);
  await assert.rejects(client.pollSnapshot(), /no longer authorized/);
  await denial;
  assert.equal(client.current(), null); assert.equal(client.view(), null);
  assert.match(client.error().message, /no longer authorized/);
});


test('same-user tabs preserve all unresolved IDs through interleaved writes and refresh', async () => {
  const { clientModule, client, data } = await setup();
  client.snapshot = snapshot();
  const other = new clientModule.ShoppingClient(user, household); running.push(other); other.snapshot = snapshot();
  const first = client.mutateLatest('product.update', { id: productId, quantity: 2 });
  const firstId = client.operations()[0].intent.id;
  const second = other.mutateLatest('category.update', { id: categoryId, name: 'Other tab category' });
  const secondId = other.operations().find(operation => operation.intent.id !== firstId).intent.id;
  // Reproduce each tab writing a stale index after the other already persisted.
  client.persist(); other.persist();
  const restored = new clientModule.ShoppingClient(user, household); running.push(restored);
  assert.deepEqual(new Set(restored.operations().map(operation => operation.intent.id)), new Set([firstId, secondId]));
  assert.ok(data.has(client.storageKey + ':operation:' + firstId));
  assert.ok(data.has(client.storageKey + ':operation:' + secondId));
  client.storage({ key: client.storageKey });
  assert.equal(client.operations().length, 2);
  client.dispose(); other.dispose(); await Promise.all([first, second]);
});

test('terminal storage event resolves another tabs waiter and cannot be overwritten by stale pending', async () => {
  const { clientModule, client } = await setup(); client.snapshot = snapshot();
  const promise = client.mutateLatest('product.update', { id: productId, quantity: 2 });
  const other = new clientModule.ShoppingClient(user, household); running.push(other); other.snapshot = snapshot();
  const pending = other.operations()[0];
  other.settle(pending, { status: 'committed', data: { record: snapshot(2, 2).products[0], household_version: 2 } });
  client.storage({ key: client.storageKey + ':operation:' + pending.intent.id });
  assert.equal((await promise).error, null);
  assert.equal(client.operations()[0].state, 'Saved');
  assert.equal(client.current().products[0].quantity, 2);
  client.persist();
  assert.equal(JSON.parse(localStorage.getItem(client.storageKey + ':operation:' + pending.intent.id)).result.status, 'committed');
});

test('changed per-operation storage intent fails closed and preserves the original index', async () => {
  const { client } = await setup(); client.snapshot = snapshot();
  const promise = client.mutateLatest('product.update', { id: productId, quantity: 2 });
  const pending = client.operations()[0], changed = structuredClone(pending);
  changed.intent.payload.quantity = 999;
  localStorage.setItem(client.storageKey + ':operation:' + pending.intent.id, JSON.stringify(changed));
  client.storage({ key: client.storageKey + ':operation:' + pending.intent.id });
  assert.match(client.error().message, /changed unexpectedly/);
  assert.equal(client.view().products[0].quantity, 2);
  assert.equal(JSON.parse(localStorage.getItem(client.storageKey))[0].intent.payload.quantity, 2);
  client.dispose(); await promise;
});


test('contiguous complete product and category results avoid unnecessary full snapshots', async () => {
  const { client } = await setup(); client.snapshot = snapshot(); client.snapshotDue = false;
  client.apply({ status: 'committed', data: { record: snapshot(2, 2).products[0], household_version: 2 } }, { type: 'stage4.product.update' });
  assert.equal(client.current().household.version, 2); assert.equal(client.current().products[0].quantity, 2);
  assert.equal(client.snapshotDue, false);
  client.apply({ status: 'committed', data: { record: { ...snapshot().categories[0], name: 'Renamed', version: 2 }, household_version: 3 } }, { type: 'stage4.category.update' });
  assert.equal(client.current().household.version, 3); assert.equal(client.current().categories[0].name, 'Renamed');
  assert.equal(client.snapshotDue, false);
  // Unknown remote work may include other records; a complete record is not a
  // complete household snapshot when revisions are noncontiguous.
  client.apply({ status: 'committed', data: { record: snapshot(4, 4).products[0], household_version: 5 } }, { type: 'stage4.product.update' });
  assert.equal(client.snapshotDue, true); assert.equal(client.current().household.version, 3);
});

test('history deletion and category cascade retain full refresh and explicit refresh is never cancelled', async () => {
  const { client } = await setup(); client.snapshot = snapshot(); client.snapshotDue = false;
  client.apply({ status: 'committed', data: { record: { id: categoryId, version: 2 }, household_version: 2 } }, { type: 'stage4.category.delete' });
  assert.equal(client.snapshotDue, true); assert.equal(client.current().products.length, 0);
  client.snapshot = snapshot(); client.snapshotDue = true;
  client.apply({ status: 'committed', data: { record: snapshot(2, 2).products[0], household_version: 2 } }, { type: 'stage4.product.update' });
  assert.equal(client.snapshotDue, true);
});
