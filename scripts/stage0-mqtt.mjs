import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { get } from 'node:https';
import assert from 'node:assert/strict';

// Stage 0 preflight only. Sustained/load/offline/fault suites remain Stage 1.
const require = createRequire('/home/naf-w/.local/share/shopping-list-tools/package.json');
const mqtt = require('mqtt');
const path = '.stage0-runtime/flespi-dev.json';
assert.equal(statSync(path).mode & 0o777, 0o600, 'Private credential file required');
const config = JSON.parse(readFileSync(path, 'utf8'));
assert.equal(statSync('.stage0-runtime/flespi-auditor.json').mode & 0o777, 0o600, 'Private auditor file required');
const auditor = JSON.parse(readFileSync('.stage0-runtime/flespi-auditor.json', 'utf8'));
assert.ok(auditor.expire > Date.now() / 1000, 'A fresh narrowly scoped auditor is required before any broker traffic');
const request = JSON.parse(readFileSync('docs/stage0/flespi-authorization.json', 'utf8'));
assert.equal(config.channel, request.channel);
assert.equal(config.broker_url, 'mqtts://mqtt.flespi.io:8883');
const base = request.namespace;
const commands = `${base}/commands`, results = `${base}/results`;
const forbidden = `${base}-denied/probe`;
const clients = new Set();
const checks = [];
const connectEvidence = [];
const authEvidence = [];

function backendGet(url, token) {
  // Node fetch adds browser-style fetch headers. Backend-only tokens must use
  // a backend HTTPS request, not relax their browser-origin restriction.
  return bounded(new Promise((resolve, reject) => {
    const request = get(url, { headers: { Authorization: `FlespiToken ${token}` } }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        try { resolve({ status: response.statusCode, data: JSON.parse(Buffer.concat(chunks).toString()) }); }
        catch { reject(new Error('Unexpected provider response')); }
      });
      response.on('error', reject);
    });
    request.setTimeout(10000, () => request.destroy(new Error('Provider request timeout')));
    request.on('error', reject);
  }), 'backend token metadata');
}

async function bounded(promise, name, ms = 12000) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Timeout: ${name}`)), ms); })]);
  } finally { clearTimeout(timer); }
}

async function connect(role, clientId = `naf-s0-${role}-${randomUUID().slice(0, 8)}`, persistent = false) {
  const client = mqtt.connect(config.broker_url, {
    username: role === 'auditor' ? auditor.token : config[`${role}_token`], protocolVersion: 5, clientId,
    clean: !persistent, properties: { sessionExpiryInterval: persistent ? 60 : 0 },
    connectTimeout: 10000, reconnectPeriod: 0, resubscribe: false, rejectUnauthorized: true,
  });
  clients.add(client);
  client.on('error', () => {}); // Errors are handled by promises, never log options.
  const [packet] = await bounded(once(client, 'connect'), 'TLS MQTT connect');
  assert.equal(client.stream.authorized, true, 'TLS certificate verification must succeed');
  connectEvidence.push({ role, tls_verified: true, tls_protocol: client.stream.getProtocol(), session_present: packet.sessionPresent,
    maximum_qos: packet.properties?.maximumQoS, receive_maximum: packet.properties?.receiveMaximum });
  return { client, packet };
}

async function end(client, preserve = false) {
  if (!clients.has(client)) return;
  try { await bounded(client.endAsync(false, { properties: { sessionExpiryInterval: preserve ? 60 : 0 } }), 'disconnect', 3000); }
  finally { clients.delete(client); client.end(true); }
}

async function verifyToken(role) {
  const token = config[`${role}_token`];
  assert.match(token, /^[A-Za-z0-9_-]{64}$/);
  const response = await backendGet('https://flespi.io/auth/info', token);
  assert.equal(response.status, 200);
  const info = response.data.result[0];
  assert.equal(info.cid, config.account_id);
  assert.equal(info.id, config[`${role}_token_id`]);
  assert.equal(info.enabled, true);
  assert.equal(info.blocked, 0);
  assert.equal(info.access.type, 2);
  assert.equal(info.ttl, 0);
  assert.equal(info.expire, config.expire);
  assert.ok(info.expire > Date.now() / 1000 && info.expire <= Date.now() / 1000 + 7 * 86400 + 60);
  const publish = role === 'publisher' ? commands : results;
  const subscribe = role === 'publisher' ? results : commands;
  const expected = [{ uri: 'mqtt', topic: publish, actions: ['publish'], methods: [] }, { uri: 'mqtt', topic: subscribe, actions: ['subscribe'], methods: [] }];
  assert.deepEqual(info.access.acl, expected);
  const denied = await backendGet('https://flespi.io/platform/customer', token);
  assert.equal(denied.status, 403, 'MQTT credential must not grant account administration');
  const browserDenied = await fetch('https://flespi.io/auth/info', { headers: { Authorization: `FlespiToken ${token}`, Origin: 'https://example.invalid' }, signal: AbortSignal.timeout(12000) });
  assert.equal(browserDenied.status, 403, 'Browser-origin use must be denied');
  authEvidence.push({ role, token_id: info.id, account_id: info.cid, access_type: info.access.type, expire: info.expire, ttl: info.ttl, acl: info.access.acl, administration_denied: true, browser_origin_denied: true });
}

async function denyPublish(role, topic, label) {
  const { client } = await connect(role);
  try {
    let reason;
    try {
      await bounded(client.publishAsync(topic, JSON.stringify({ kind: 'stage0-denial-probe', id: randomUUID() }), { qos: 1, retain: false }), 'denied publish');
    } catch (error) { reason = error.code ?? error.packet?.granted?.[0] ?? error.packet?.reasonCode; }
    if (reason !== 135) checks.push({ test: label, role, action: 'publish', broker_reason: reason ?? null, passed: false });
    assert.equal(reason, 135, `${role} publish must receive explicit MQTT Not authorized`);
    checks.push({ test: label, role, action: 'publish', broker_reason: reason, passed: true });
  } finally { await end(client); }
}

function monitor(client) {
  const seen = new Map(), pending = new Map();
  const handler = (topic, buffer) => {
    let message; try { message = JSON.parse(buffer.toString()); } catch { return; }
    if (message.kind !== 'stage0-acl-probe') return;
    seen.set(message.id, topic);
    pending.get(message.id)?.();
  };
  client.on('message', handler);
  return { seen, wait(id) { return seen.has(id) ? Promise.resolve() : bounded(new Promise(resolve => pending.set(id, resolve)), 'ACL control delivery'); }, close() { client.off('message', handler); } };
}

async function verifyDeliveryBoundary(role, observer, observed) {
  const { client } = await connect(role);
  const received = monitor(client);
  const allowed = role === 'publisher' ? results : commands;
  const wrongDirection = role === 'publisher' ? commands : results;
  try {
    const grants = {};
    for (const topic of [forbidden, wrongDirection, allowed]) grants[topic] = (await client.subscribeAsync(topic, { qos: 1 }))[0].qos;
    const probes = [];
    // Forbidden probes precede the allowed control on the same publisher. An
    // allowed end-marker proves the role connection is alive and draining.
    for (const topic of [forbidden, wrongDirection, allowed]) {
      const id = randomUUID(); probes.push({ id, topic });
      await observer.publishAsync(topic, JSON.stringify({ id, kind: 'stage0-acl-probe' }), { qos: 1, retain: false });
      await observed.wait(id); // Independent least-privilege observer confirms publication.
      if (topic === allowed) await received.wait(id);
    }
    await new Promise(resolve => setTimeout(resolve, 1500));
    assert.equal(received.seen.get(probes[2].id), allowed);
    for (const probe of probes.slice(0, 2)) {
      const leaked = received.seen.has(probe.id);
      checks.push({ test: probe.topic === forbidden ? 'foreign namespace delivery filtered' : 'wrong direction delivery filtered', role,
        subscription_granted_qos: grants[probe.topic], independent_publication_confirmed: observed.seen.has(probe.id),
        allowed_control_received: true, unauthorized_deliveries: leaked ? 1 : 0, observation_after_control_ms: 1500, passed: !leaked });
      assert.equal(leaked, false, `${role} must not receive forbidden probes`);
    }
  } finally { received.close(); await end(client); }
}

let report;
try {
  await verifyToken('publisher');
  await verifyToken('listener');
  const { client: publisher } = await connect('publisher');
  const listenerId = `naf-s0-listener-${randomUUID().slice(0, 8)}`;
  let { client: listener } = await connect('listener', listenerId, true);
  assert.equal((await publisher.subscribeAsync(results, { qos: 1 }))[0].qos, 1);
  assert.equal((await listener.subscribeAsync(commands, { qos: 1 }))[0].qos, 1);
  const pending = new Map();
  let handlerFailure = false;
  publisher.on('message', (topic, buffer) => {
    if (topic !== results) return;
    const message = JSON.parse(buffer.toString());
    if (message.kind === 'stage0-transport-ack') pending.get(message.id)?.();
  });
  const attach = client => client.on('message', (topic, buffer) => {
    if (topic !== commands) return;
    const message = JSON.parse(buffer.toString());
    if (message.kind !== 'stage0-transport-probe') return;
    client.publishAsync(results, JSON.stringify({ id: message.id, kind: 'stage0-transport-ack' }), { qos: 1, retain: false }).catch(() => { handlerFailure = true; });
  });
  attach(listener);
  const latencies = [];
  async function exchange() {
    const id = randomUUID();
    const confirmed = new Promise(resolve => pending.set(id, resolve));
    const started = performance.now();
    await bounded(publisher.publishAsync(commands, JSON.stringify({ id, kind: 'stage0-transport-probe' }), { qos: 1, retain: false }), 'QoS1 acknowledgement');
    await bounded(confirmed, 'round-trip response');
    latencies.push(Math.round((performance.now() - started) * 10) / 10);
    pending.delete(id);
  }
  await exchange();
  await exchange();
  await end(listener, true);
  const resumed = await connect('listener', listenerId, true);
  listener = resumed.client;
  assert.equal(resumed.packet.sessionPresent, true, 'Same isolated listener session must resume');
  attach(listener);
  await exchange();
  assert.equal(handlerFailure, false);
  checks.push({ test: 'three synthetic QoS1 request/response exchanges', passed: true, latencies_ms: latencies, database_commit_claimed: false });
  checks.push({ test: 'planned reconnect resumes isolated session/subscription', passed: true });
  assert.equal(auditor.account_id, config.account_id);
  assert.ok(auditor.expire > Date.now() / 1000);
  const auditInfo = (await backendGet('https://flespi.io/auth/info', auditor.token)).data.result[0];
  assert.equal(auditInfo.access.type, 2);
  assert.equal(auditInfo.id, auditor.token_id);
  assert.deepEqual(auditInfo.access.acl, [commands, results, forbidden].map(topic => ({ uri: 'mqtt', topic, actions: ['publish', 'subscribe'], methods: [] })));
  const { client: observer } = await connect('auditor');
  for (const topic of [commands, results, forbidden]) assert.equal((await observer.subscribeAsync(topic, { qos: 1 }))[0].qos, 1);
  const observed = monitor(observer);
  for (const role of ['publisher', 'listener']) {
    await verifyDeliveryBoundary(role, observer, observed);
    await denyPublish(role, forbidden, 'foreign dev namespace publish denied');
    await denyPublish(role, role === 'publisher' ? results : commands, 'wrong direction publish denied');
  }
  observed.close();
  report = { status: 'PASS', stage: 0, account_id: config.account_id, namespace: base,
    broker: config.broker_url, mqtt_version: '5', qos: 1, response_timeout_ms: 12000,
    session_expiry_seconds_during_test: 60, auth: authEvidence, connections: connectEvidence, checks,
    auditor_token_id: auditor.token_id, auditor_expire: auditor.expire,
    notes: ['Synthetic transport only; no database writes or commit guarantee.', 'No load, offline backlog, replay or extended fault tests; those are Stage1.', 'Only new dev token IDs and unique client IDs used; no shared sessions/tokens changed.', 'Broker accepts forbidden topic subscriptions but ACL filters message delivery; positive independent publication and role controls verified.'],
    tested_at: new Date().toISOString() };
} catch (error) {
  report = { status: 'FAIL', stage: 0, completed_checks: checks, error_type: error.name, error_code: error.code,
    notes: ['Credential-bearing exception text suppressed. Stage0 remains NO-GO.'] };
  process.exitCode = 1;
} finally {
  for (const client of [...clients]) await end(client).catch(() => { client.end(true); });
}
writeFileSync('docs/stage0/mqtt-preflight.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
