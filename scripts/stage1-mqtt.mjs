import { createRequire } from 'node:module';
import { readFileSync, statSync, mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import { once } from 'node:events';
import { fork, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

// Synthetic transport experiment only. No Vercel API, application data or database.
const require = createRequire('/home/naf-w/.local/share/shopping-list-tools/package.json');
const mqtt = require('mqtt');
const credentialPath = '.stage0-runtime/flespi-dev.json';
assert.equal(statSync(credentialPath).mode & 0o777, 0o600);
const config = JSON.parse(readFileSync(credentialPath, 'utf8'));
assert.equal(config.broker_url, 'mqtts://mqtt.flespi.io:8883');
assert.equal(config.channel, 'naf-stage0-041d4f122bdd');
assert.equal(config.account_id, 2617576);
assert.ok(config.expire > Date.now() / 1000 + 600);
const base = `shopping-poc/${config.channel}`;
export const commands = `${base}/commands`, results = `${base}/results`;
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export const runId = process.env.SHOPPING_STAGE1_RUN_ID || randomUUID();
const self = fileURLToPath(import.meta.url);
const clients = new Set();
export const events = [];
let child;
const output = 'docs/stage1';
mkdirSync(output, { recursive: true });

export async function bounded(promise, label, ms = 15000) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label)), ms); })]); }
  finally { clearTimeout(timer); }
}

export async function connect(role, { clientId = `naf-s1-${role}-${randomUUID().slice(0, 10)}`, expiry = 0, beforeConnect } = {}) {
  const client = mqtt.connect(config.broker_url, { username: config[`${role}_token`],
    protocolVersion: 5, clientId, clean: expiry === 0, properties: { sessionExpiryInterval: expiry },
    keepalive: 15, connectTimeout: 10000, reconnectPeriod: 0, resubscribe: false, rejectUnauthorized: true,
  });
  clients.add(client);
  client.on('error', () => {});
  beforeConnect?.(client);
  const [packet] = await bounded(once(client, 'connect'), 'MQTT connect timed out');
  assert.equal(client.stream.authorized, true);
  events.push({ event: 'connect', role, client_id: clientId, tls: client.stream.getProtocol(), session_present: packet.sessionPresent, at: new Date().toISOString() });
  return { client, packet };
}

export async function end(client, expiry = 0, abrupt = false) {
  if (!clients.has(client)) return;
  if (abrupt) client.stream.destroy();
  else await bounded(client.endAsync(false, { properties: { sessionExpiryInterval: expiry } }), 'disconnect timed out', 3000);
  clients.delete(client);
  client.end(true);
}

export function publish(client, payload) {
  return bounded(client.publishAsync(commands, JSON.stringify(payload), { qos: 1, retain: false }), 'publish timed out');
}

export function sender(client, scenario, log) {
  const pending = new Map(), rows = [], duplicates = [], unknown = [];
  const onMessage = (topic, buffer) => {
    if (topic !== results) return;
    let response; try { response = JSON.parse(buffer.toString()); } catch { return; }
    if (response.run_id !== runId) return;
    const entry = pending.get(response.id);
    if (!entry) { (rows.some(row => row.id === response.id) ? duplicates : unknown).push(response.id); return; }
    pending.delete(response.id);
    const row = { scenario, run_id: runId, id: response.id, index: entry.index, sent_at: entry.sentAt,
      received_at: new Date().toISOString(), latency_ms: Number((performance.now() - entry.start).toFixed(2)),
      status: response.status, synthetic_quantity: response.quantity, database_commit: false };
    rows.push(row);
    if (log) appendFileSync(log, JSON.stringify(row) + '\n');
    entry.resolve(response);
  };
  client.on('message', onMessage);
  return { rows, pending, duplicates, unknown,
    prepare(index, extra = {}) {
      const id = extra.id || randomUUID();
      const packet = { kind: 'stage1-synthetic', run_id: runId, id, index, ...extra };
      let resolve;
      const reply = new Promise(done => { resolve = done; });
      pending.set(id, { start: performance.now(), sentAt: new Date().toISOString(), resolve, index });
      return { packet, reply };
    }, close() { client.off('message', onMessage); } };
}

function stats(rows) {
  const sorted = rows.map(row => row.latency_ms).sort((a, b) => a - b);
  const q = p => sorted.length ? sorted[Math.ceil((sorted.length - 1) * p)] : null;
  return { p50: q(.5), p95: q(.95), p99: q(.99), max: sorted.at(-1) ?? null };
}

async function worker() {
  const clientId = process.env.SHOPPING_STAGE1_LISTENER_ID;
  assert.match(clientId, /^naf-s1-listener-[a-f0-9-]+$/);
  const processed = new Map();
  let quantity = 0;
  const { client, packet } = await connect('listener', { clientId, expiry: 120,
    beforeConnect(client) {
      client.on('message', (topic, buffer) => {
        if (topic !== commands) return;
        let command; try { command = JSON.parse(buffer.toString()); } catch { return; }
        if (command.kind !== 'stage1-synthetic' || command.run_id !== runId) return;
        let entry = processed.get(command.id);
        if (!entry) {
          quantity += 1;
          // Promise is stored before awaiting: concurrent duplicate simulation is deduplicated.
          entry = { reply: { run_id: runId, id: command.id, status: 'synthetic-ok', quantity }, dropped: false };
          processed.set(command.id, entry);
        }
        process.send?.({ event: 'processed', id: command.id, quantity: entry.reply.quantity });
        if (command.hold) return;
        if (command.drop_once && !entry.dropped) { entry.dropped = true; return; }
        const delay = command.delay_ms ?? 5;
        if (!Number.isInteger(delay) || delay < 0 || delay > 5000) return;
        sleep(delay).then(() => client.publishAsync(results, JSON.stringify(entry.reply), { qos: 1, retain: false }))
          .catch(() => process.send?.({ event: 'reply-error' }));
      });
    },
  });
  assert.equal((await client.subscribeAsync(commands, { qos: 1 }))[0].qos, 1);
  process.send?.({ event: 'ready', session_present: packet.sessionPresent });
  process.on('message', async message => {
    if (message.event === 'stop') { await end(client, message.expiry ?? 0); process.exit(0); }
  });
}

export async function startWorker(clientId = `naf-s1-listener-${randomUUID()}`) {
  child = fork(self, ['worker'], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], env: {
    PATH: process.env.PATH, HOME: process.env.HOME, SHOPPING_STAGE1_RUN_ID: runId,
    SHOPPING_STAGE1_LISTENER_ID: clientId,
  } });
  const ready = new Promise((resolve, reject) => {
    const handler = message => { if (message.event === 'ready') { child.off('message', handler); resolve(message); } };
    child.on('message', handler);
    child.once('exit', () => reject(new Error('Synthetic listener exited before ready')));
  });
  const result = await bounded(ready, 'listener startup timed out');
  return { process: child, clientId, ...result };
}

export async function stopWorker(expiry = 0, signal) {
  const current = child;
  if (!current || current.exitCode !== null || current.signalCode) return;
  const done = once(current, 'exit');
  if (signal) current.kill(signal); else current.send({ event: 'stop', expiry });
  await bounded(done, 'listener stop timed out', 5000);
  child = undefined;
}

async function baseline() {
  const log = `${output}/baseline-operations.jsonl`; writeFileSync(log, '');
  const listener = await startWorker();
  const { client } = await connect('publisher');
  await client.subscribeAsync(results, { qos: 1 });
  const recorder = sender(client, 'baseline', log);
  const replies = [], pubs = [];
  const began = performance.now();
  for (let i = 0; i < 600; i++) {
    const { packet, reply } = recorder.prepare(i);
    replies.push(reply); pubs.push(publish(client, packet));
    await sleep(25);
  }
  await Promise.all(pubs);
  await bounded(Promise.all(replies), 'baseline replies missing', 30000);
  const summary = { requested: 600, confirmed: recorder.rows.length, missing: recorder.pending.size,
    duplicate_results: recorder.duplicates.length, latency_ms: stats(recorder.rows),
    duration_seconds: Number(((performance.now() - began) / 1000).toFixed(2)),
    criteria: { confirmed: 600, missing: 0, p95_ms_lte: 1000 },
    historical_p95_ms: 662, historical_raw_logs_found: false,
    historical_equivalence: 'Fresh timing need not equal historical662ms; old credentials invalid, no saved raw logs found.',
  };
  summary.passed = summary.confirmed === 600 && summary.missing === 0 && summary.latency_ms.p95 <= 1000;
  recorder.close();
  // Establish and disconnect ONLY this run's own persistent listener, then queue100.
  await stopWorker(120);
  const offline = sender(client, 'offline-100', log);
  const queued = [];
  for (let i = 0; i < 100; i++) { const item = offline.prepare(i); queued.push(item.reply); await publish(client, item.packet); }
  await sleep(1000);
  assert.equal(offline.rows.length, 0);
  const resumed = await startWorker(listener.clientId);
  assert.equal(resumed.session_present, true);
  await bounded(Promise.all(queued), 'offline backlog missing', 30000);
  const recovery = { requested: 100, confirmed: offline.rows.length, missing: offline.pending.size,
    session_present: resumed.session_present, latency_ms_including_outage: stats(offline.rows), passed: offline.rows.length === 100 && offline.pending.size === 0 };
  offline.close();
  return { baseline: summary, offline: recovery, passed: summary.passed && recovery.passed };
}

async function load() {
  const log = `${output}/load-operations.jsonl`; writeFileSync(log, '');
  await startWorker();
  const workers = [];
  for (let i = 0; i < 10; i++) {
    const { client } = await connect('publisher');
    await client.subscribeAsync(results, { qos: 1 });
    workers.push({ client, record: sender(client, 'sustained-concurrent', log) });
  }
  const duration = 300000, began = performance.now(), all = [];
  let batch = 0, responseTimeouts = 0;
  while (performance.now() - began < duration) {
    const publications = [];
    for (const [index, actor] of workers.entries()) {
      const item = actor.record.prepare(batch * 10 + index);
      all.push(bounded(item.reply, 'load response timeout', 12000).catch(() => { responseTimeouts++; }));
      publications.push(publish(actor.client, item.packet));
    }
    await Promise.all(publications);
    if (batch % 12 === 0) console.log(JSON.stringify({ progress: 'load', elapsed_s: Math.round((performance.now() - began) / 1000), sent: (batch + 1) * 10 }));
    batch++;
    await sleep(Math.max(0, batch * 2500 - (performance.now() - began)));
  }
  await Promise.all(all);
  const rows = workers.flatMap(x => x.record.rows);
  const summary = { requested: batch * 10, confirmed: rows.length, missing: workers.reduce((n, x) => n + x.record.pending.size, 0),
    duplicate_results: workers.reduce((n, x) => n + x.record.duplicates.length, 0), latency_ms: stats(rows),
    duration_seconds: Number(((performance.now() - began) / 1000).toFixed(2)),
    publisher_clients: 10, listener_clients: 1, response_timeouts: responseTimeouts, batch_size: 10, batch_interval_ms: 2500,
    criteria: { missing: 0, p95_ms_lte: 1000, p99_ms_lte: 2000, duration_seconds_gte: 300 },
    notes: '10 backend client simulators; all share one dev namespace. Result fanout is broker traffic, not household isolation or browser architecture.' };
  summary.passed = summary.missing === 0 && responseTimeouts === 0 && summary.latency_ms.p95 <= 1000 && summary.latency_ms.p99 <= 2000 && summary.duration_seconds >= 300;
  for (const x of workers) x.record.close();
  return summary;
}

async function main() {
  execFileSync(process.execPath, ['scripts/stage0-preflight.mjs'], { stdio: ['ignore', 'ignore', 'pipe'] });
  assert.equal(JSON.parse(readFileSync('docs/stage0/gate.json', 'utf8')).decision, 'GO');
  const mode = process.argv[2];
  assert.ok(['baseline', 'load'].includes(mode));
  let report;
  try {
    const result = await (mode === 'baseline' ? baseline() : load());
    report = { status: result.passed ? 'PASS' : 'FAIL', stage: 1, mode, run_id: runId,
      broker: config.broker_url, account_id: config.account_id, namespace: base,
      qos: 1, simulated_processing_ms: 5, database_commit: false,
      environment: { node: process.version, mqtt: require('mqtt/package.json').version, host: 'debian', same_host_processes: true },
      tested_at: new Date().toISOString(), result, connections: events,
      historical_source_sha256: createHash('sha256').update(readFileSync('/home/naf-w/projects/self/shopping-mqtt-poc/src/poc.mjs')).digest('hex'),
    };
    process.exitCode = result.passed ? 0 : 1;
  } catch (error) {
    report = { status: 'FAIL', stage: 1, mode, run_id: runId, error_type: error.name, error_code: error.code, notes: 'Credential-bearing exception suppressed; inspect raw operation records.' };
    process.exitCode = 1;
  } finally {
    await stopWorker().catch(() => { child?.kill('SIGKILL'); });
    for (const client of clients) await end(client).catch(() => client.end(true));
    writeFileSync(`${output}/${mode}.json`, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  }
}

if (process.argv[2] === 'worker') worker().catch(() => process.exit(1));
else if (process.argv[1] === self) await main();
