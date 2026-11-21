// One live development suite. Faults affect only this run's MQTT socket factories.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { PassThrough } from 'node:stream';
import { get } from 'node:https';
import { once } from 'node:events';
import { bounded, sleep } from './stage1-mqtt.mjs';

execFileSync(process.execPath, ['scripts/stage0-preflight.mjs'], { stdio: ['ignore', 'ignore', 'pipe'] });
const require = createRequire('/home/naf-w/.local/share/shopping-list-tools/package.json');
const mqtt = require('mqtt');
const config = JSON.parse(readFileSync('.stage0-runtime/flespi-dev.json'));
assert.equal(config.account_id, 2617576);
assert.ok(config.expire > Date.now() / 1000 + 1800);
const topic = `shopping-poc/${config.channel}/commands`;
assert.equal(topic, 'shopping-poc/naf-stage0-041d4f122bdd/commands');
const runId = randomUUID(), dir = `docs/stage1/attempts/recovery-${runId}`;
const messageExpiry = Number(process.env.SHOPPING_POC_MESSAGE_EXPIRY_SECONDS ?? 300);
assert.ok(Number.isInteger(messageExpiry) && messageExpiry > 0 && messageExpiry <= 3600);
const sessionExpiry = 1800;
mkdirSync(dir);
const report = { status: 'RUNNING', run_id: runId, started_at: new Date().toISOString(),
  source_head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  session_expiry_seconds: sessionExpiry, message_expiry_seconds: messageExpiry, cases: [],
  fault: 'Owned TLS socket destroyed; MQTT.js automatic reconnect stream attempts fail locally during the bounded outage. Real flespi broker, no host firewall/ISP interruption.',
  database_commit: false };
const save = () => writeFileSync(`${dir}/report.json`, JSON.stringify(report, null, 2) + '\n');
const log = row => appendFileSync(`${dir}/operations.jsonl`, JSON.stringify(row) + '\n');
const opened = new Set();
function auth(token) {
  return new Promise((resolve, reject) => {
    const request = get('https://flespi.io/auth/info', { headers: { Authorization: `FlespiToken ${token}` } }, response => {
      const bytes = []; response.on('data', b => bytes.push(b));
      response.on('end', () => { try { assert.equal(response.statusCode, 200); resolve(JSON.parse(Buffer.concat(bytes)).result[0]); } catch { reject(new Error('Auth metadata refused')); } });
    });
    request.on('error', reject); request.setTimeout(10000, () => request.destroy(new Error('Auth timeout')));
  });
}
function client(role, clientId) {
  const c = mqtt.connect(config.broker_url, { username: config[`${role}_token`], clientId,
    protocolVersion: 5, clean: false, properties: { sessionExpiryInterval: sessionExpiry },
    reconnectPeriod: 1000, connectTimeout: 4000, keepalive: 15, resubscribe: false, rejectUnauthorized: true });
  c.on('error', () => {}); opened.add(c); return c;
}
async function end(c) {
  c.options.reconnectPeriod = 0;
  await bounded(c.endAsync(false, { properties: { sessionExpiryInterval: 0 } }), 'cleanup', 4000).catch(() => c.end(true));
  opened.delete(c);
}
let publisher;
async function scenario(seconds, loseSession = false) {
  const name = loseSession ? 'lost-session-reconciliation' : `${seconds}s`;
  const c = client('listener', `naf-s1-listener-${randomUUID()}`);
  const messages = [], deliveries = [], rejected = [], ordering = [], initial = await bounded(once(c, 'connect'), 'initial listener');
  assert.ok((initial[0].properties?.sessionExpiryInterval ?? sessionExpiry) >= 900);
  assert.equal(c.stream.authorized, true);
  await c.subscribeAsync(topic, { qos: 1 });
  let blocked = false, attempts = 0, recoveryAt, reconnectPacket, resolveRecovered;
  const recovered = new Promise(resolve => { resolveRecovered = resolve; });
  const originalBuilder = c.streamBuilder;
  c.streamBuilder = (...args) => {
    attempts++;
    if (!blocked) return originalBuilder(...args);
    const stream = new PassThrough(); setImmediate(() => stream.destroy(new Error('Owned interruption'))); return stream;
  };
  c.on('message', (receivedTopic, bytes, packet) => {
    if (receivedTopic !== topic) return;
    let value; try { value = JSON.parse(bytes.toString()); } catch { return; }
    if (value.run_id !== runId || value.scenario !== name) return;
    const age = Date.now() - value.sent_ms;
    const row = { event: 'delivery', scenario: name, id: value.id, index: value.index,
      received_ms: Date.now(), age_ms: age, mqtt_dup: packet.dup,
      remaining_message_expiry_seconds: packet.properties?.messageExpiryInterval ?? null };
    if (age >= messageExpiry * 1000) rejected.push(row); else { deliveries.push(row); ordering.push(value.index); }
    log({ ...row, synthetic_applied: age < messageExpiry * 1000, database_commit: false });
  });
  c.on('connect', async packet => {
    if (blocked) return;
    try {
      assert.equal(c.stream.authorized, true);
      reconnectPacket = packet; recoveryAt = Date.now();
      if (!packet.sessionPresent) await c.subscribeAsync(topic, { qos: 1 });
      resolveRecovered();
    } catch { /* bounded recovery below records failure */ }
  });
  async function send(index, phase) {
    const value = { kind: 'stage1-recovery', run_id: runId, scenario: name, id: randomUUID(), index, phase, sent_ms: Date.now() };
    messages.push(value);
    const ack = await bounded(publisher.publishAsync(topic, JSON.stringify(value), { qos: 1, retain: false,
      properties: { messageExpiryInterval: messageExpiry } }), 'publish');
    assert.ok(!ack?.reasonCode || ack.reasonCode < 128);
    log({ event: 'publish', ...value, broker_puback_ms: Date.now(), database_commit: false });
  }
  const droppedAt = Date.now(); blocked = true;
  c.stream.destroy();
  for (let i = 0; i < 10; i++) await send(i, 'early');
  // A late publication is still valid after an outage longer than retention.
  await sleep(Math.max(0, seconds * 1000 - 1500 - (Date.now() - droppedAt)));
  await send(10, 'late'); await send(11, 'late');
  await sleep(Math.max(0, seconds * 1000 - (Date.now() - droppedAt)));
  if (loseSession) c.options.clean = true;
  const networkRestoredAt = Date.now(); blocked = false;
  await bounded(recovered, 'automatic recovery', 20000);
  await send(12, 'fresh-control');
  await bounded((async () => { while (!deliveries.some(row => row.id === messages.at(-1).id)) await sleep(20); })(), 'fresh control');
  await sleep(700);
  const expectedValid = messages.filter(m => recoveryAt - m.sent_ms < messageExpiry * 1000);
  const expectedExpired = messages.filter(m => recoveryAt - m.sent_ms >= messageExpiry * 1000);
  const unique = new Set(deliveries.map(d => d.id));
  const unresolved = expectedValid.filter(m => !unique.has(m.id));
  const expiredDelivered = rejected.length;
  const row = { duration_seconds: seconds, scenario: name, measured_outage_ms: networkRestoredAt - droppedAt,
    automatic_reconnect_attempts: attempts, session_present: reconnectPacket.sessionPresent,
    recovery_ms_from_network_restoration: recoveryAt - networkRestoredAt, published: messages.length,
    expected_valid: expectedValid.length, expected_expired: expectedExpired.length,
    valid_unique_delivered: unique.size, missing_valid_before_reconciliation: unresolved.map(m => m.id),
    duplicates: deliveries.length - unique.size, out_of_order: ordering.some((x, i) => i && x < ordering[i - 1]),
    expired_delivered_and_rejected: expiredDelivered, expired_synthetic_effects: 0,
    oldest_early_message_age_ms_at_reconnect: recoveryAt - messages[0].sent_ms,
    late_message_ages_ms_at_reconnect: messages.filter(m => m.phase === 'late').map(m => recoveryAt - m.sent_ms),
    fresh_control_received: true, missing_publisher_failure_notification: 'No per-message expiry notification observed/assumed; PUBACK is transport only.',
    reconciliation: { unresolved_ids: [...unresolved, ...expectedExpired].map(m => m.id),
      policy: 'Durable frontend/API pending-operation IDs; authenticated status lookup; compare canonical hash; retry SAME ID while valid; explicit renewal after not-found/expiry plus current-state/version check. Never mark saved on PUBACK.' } };
  if (loseSession) {
    assert.equal(reconnectPacket.sessionPresent, false);
    assert.equal(unresolved.length, 12);
    c.options.clean = false;
    for (const operation of unresolved) await publisher.publishAsync(topic, JSON.stringify(operation), { qos: 1, retain: false,
      properties: { messageExpiryInterval: Math.max(1, Math.floor(messageExpiry - (Date.now() - operation.sent_ms) / 1000)) } });
    await bounded((async () => { while (!unresolved.every(m => deliveries.some(d => d.id === m.id))) await sleep(20); })(), 'same ID reconciliation');
    row.same_id_reconciled = unresolved.length; row.passed = true;
  } else row.passed = unresolved.length === 0 && rejected.length === 0 && unique.size === expectedValid.length && reconnectPacket.sessionPresent;
  report.cases.push(row); save(); console.log(JSON.stringify({ progress: 'recovery complete', ...row }));
  await end(c);
}
try {
  for (const role of ['publisher', 'listener']) {
    const info = await auth(config[`${role}_token`]);
    assert.equal(info.id, config[`${role}_token_id`]); assert.equal(info.cid, 2617576);
    assert.equal(info.expire, config.expire); assert.equal(info.ttl, 0); assert.equal(info.enabled, true);
    assert.equal(info.access.type, 2);
    assert.deepEqual(info.access.acl, [
      { uri: 'mqtt', topic: `${topic.slice(0, -8)}${role === 'publisher' ? 'commands' : 'results'}`, actions: ['publish'], methods: [] },
      { uri: 'mqtt', topic: `${topic.slice(0, -8)}${role === 'publisher' ? 'results' : 'commands'}`, actions: ['subscribe'], methods: [] },
    ]);
  }
  publisher = client('publisher', `naf-s1-publisher-${randomUUID()}`);
  await bounded(once(publisher, 'connect'), 'publisher');
  const progress = setInterval(() => console.log(JSON.stringify({ progress: 'matrix running', completed: report.cases.map(x => x.duration_seconds), elapsed_s: Math.round((Date.now() - Date.parse(report.started_at)) / 1000) })), 30000);
  try {
    const outcomes = await Promise.allSettled([5, 15, 30, 60, 120, 240, 290, 310, 480].map(seconds => scenario(seconds)));
    assert.ok(outcomes.every(x => x.status === 'fulfilled'), 'A recovery case failed');
    await scenario(5, true);
  } finally { clearInterval(progress); }
  report.status = report.cases.length === 10 && report.cases.every(x => x.passed) && messageExpiry === 300 ? 'PASS' : 'FAIL';
} catch (error) { report.status = 'FAIL'; report.error_type = error.name; report.error_code = error.code; process.exitCode = 1; }
finally {
  for (const c of opened) await end(c);
  report.completed_at = new Date().toISOString(); save();
  if (report.status !== 'PASS') process.exitCode = 1;
  console.log(JSON.stringify({ output: dir, status: report.status, cases: report.cases.length }));
}
