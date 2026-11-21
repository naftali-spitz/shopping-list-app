import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { mkdtempSync, appendFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ledger, signedCommand } from './stage1-validity.mjs';

test('signed deadlines, exact binding, durable replay and fail-closed recovery', () => {
  const dir = mkdtempSync(join(tmpdir(), 'shopping-stage1-'));
  const path = join(dir, 'ledger.jsonl');
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const aud = 'synthetic-only', now = Date.now();
  const make = (changes = {}) => signedCommand(privateKey, { aud, id: randomUUID(), issued_ms: now,
    expires_ms: now + 10000, body: { delta: 1 }, ...changes });
  let store = ledger(path, publicKey, aud);
  try {
    const valid = make();
    assert.equal(store.accept({ ...valid, expires_ms: now + 20000 }).status, 'signature');
    assert.equal(store.accept({ ...valid, body: { delta: 2 } }).status, 'schema');
    assert.equal(store.accept({ ...valid, signature: '' }).status, 'signature');
    assert.equal(store.accept(make({ aud: 'foreign' })).status, 'audience');
    assert.equal(store.accept(make({ issued_ms: now - 2000, expires_ms: now - 1 })).status, 'expired');
    assert.equal(store.accept(make({ expires_ms: now + 250 })).status, 'expired');
    assert.equal(store.accept(make({ issued_ms: now + 1000 })).status, 'future');
    assert.equal(store.quantity, 0);
    assert.deepEqual(store.accept(valid), { status: 'accepted', quantity: 1 });
    assert.deepEqual(store.accept(valid), { status: 'duplicate', quantity: 1 });
    assert.equal(store.accept(make({ id: valid.id, expires_ms: now + 15000 })).status, 'conflict');
    store.close(); store = ledger(path, publicKey, aud);
    assert.deepEqual(store.accept(valid), { status: 'duplicate', quantity: 1 });
    assert.equal(store.quantity, 1);
    store.close(); store = null;
    appendFileSync(path, '{');
    assert.throws(() => ledger(path, publicKey, aud), /journal-unavailable/);
  } finally { store?.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('clock steps fail closed; expiry precedes duplicate lookup', () => {
  const dir = mkdtempSync(join(tmpdir(), 'shopping-stage1-'));
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  let now = Date.now();
  const command = signedCommand(privateKey, { aud: 'test', id: randomUUID(), issued_ms: now,
    expires_ms: now + 2000, body: { delta: 1 } });
  const store = ledger(join(dir, 'ledger'), publicKey, 'test', () => now);
  try {
    assert.equal(store.accept(command).status, 'accepted');
    now -= 1000; assert.equal(store.accept(command).status, 'clock-unhealthy');
    now += 4000; assert.equal(store.accept(command).status, 'clock-unhealthy');
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});
