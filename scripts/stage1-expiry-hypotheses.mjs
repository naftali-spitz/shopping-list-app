// Stage 1: characterize expiry timing and CONNECT/DISCONNECT interpretation.
// Synthetic messages only. No application/database or shared-session mutations.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { readFileSync, statSync, mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { bounded, sleep } from './stage1-mqtt.mjs';

execFileSync(process.execPath, ['scripts/stage0-preflight.mjs'], { stdio: ['ignore', 'ignore', 'pipe'] });
assert.equal(JSON.parse(readFileSync('docs/stage0/gate.json')).decision, 'GO');
const require = createRequire('/home/naf-w/.local/share/shopping-list-tools/package.json');
const mqtt = require('mqtt');
assert.equal(statSync('.stage0-runtime/flespi-dev.json').mode & 0o777, 0o600);
const config = JSON.parse(readFileSync('.stage0-runtime/flespi-dev.json'));
assert.equal(config.account_id, 2617576);
assert.equal(config.broker_url, 'mqtts://mqtt.flespi.io:8883');
assert.equal(config.channel, 'naf-stage0-041d4f122bdd');
assert.ok(config.expire > Date.now() / 1000 + 900);
const topic = `shopping-poc/${config.channel}/commands`;
const runId = randomUUID(), output = `docs/stage1/attempts/expiry-hypotheses-${runId}`;
mkdirSync(output);
const report = { stage: 1, run_id: runId, source_head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  started_at: new Date().toISOString(), status: 'RUNNING', gate: 'NO-GO', cases: [], metadata: [],
  scope: 'Own newly generated development sessions only; all messages QoS1/retain=false; no database effects.' };
const opened = new Set(), owned = new Map();
let browser, page;
const save = () => writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2) + '\n');
function event(data) { appendFileSync(`${output}/events.jsonl`, JSON.stringify({ at: new Date().toISOString(), ...data }) + '\n'); }

async function connection(role, clientId, expiry, clean, seen = []) {
  const client = mqtt.connect(config.broker_url, { username: config[`${role}_token`], protocolVersion: 5,
    clientId, clean, properties: { sessionExpiryInterval: expiry }, reconnectPeriod: 0,
    resubscribe: false, keepalive: 15, connectTimeout: 10000, rejectUnauthorized: true });
  opened.add(client);
  client.on('error', () => {});
  // Whitelist only control fields. Never serialize username, token, or full packets.
  client.on('packetsend', p => {
    if (p.cmd === 'connect' || p.cmd === 'disconnect') event({ client_id: clientId, direction: 'send', cmd: p.cmd,
      clean_start: p.clean ?? null, session_expiry_seconds: p.properties?.sessionExpiryInterval ?? null,
      reason_code: p.reasonCode ?? null });
  });
  client.on('message', (receivedTopic, bytes) => {
    if (receivedTopic !== topic) return;
    try { const data = JSON.parse(bytes.toString()); if (data.run_id === runId) seen.push(data.id); } catch {}
  });
  const [packet] = await bounded(once(client, 'connect'), 'connect');
  assert.equal(client.stream.authorized, true);
  const summary = { session_present: packet.sessionPresent, reason_code: packet.reasonCode,
    server_expiry_override_seconds: packet.properties?.sessionExpiryInterval ?? null };
  event({ client_id: clientId, direction: 'receive', cmd: 'connack', ...summary });
  return { client, packet: summary, sessionId: Number(packet.properties?.userProperties?.session_id) };
}
async function close(client, expiry, abrupt = false) {
  if (!opened.has(client)) return;
  if (abrupt) {
    const closed = once(client, 'close'); client.stream.destroy(); await bounded(closed, 'socket close');
    client.end(true);
  } else {
    const options = expiry === null ? {} : { properties: { sessionExpiryInterval: expiry } };
    await bounded(client.endAsync(false, options), 'disconnect');
  }
  opened.delete(client);
}
async function send(sender, id) {
  await bounded(sender.publishAsync(topic, JSON.stringify({ kind: 'stage1-expiry-hypothesis', run_id: runId, id }),
    { qos: 1, retain: false }), 'publish');
}
async function metadata(probe) {
  if (!page || !Number.isSafeInteger(probe.sessionId)) return;
  assert.equal(owned.get(probe.clientId), probe.sessionId);
  try {
    const snapshot = await page.evaluate(async ({ id, expectedClient }) => {
      const raw = sessionStorage.getItem('currentLogin'); if (!raw) return { unavailable: true };
      let value;
      for (const input of [raw, raw.slice(raw.indexOf('{'))]) { try { value = JSON.parse(input); break; } catch {} }
      const token = typeof value === 'string' ? value : value?.token;
      if (!token) return { unavailable: true };
      const response = await fetch(`https://flespi.io/mqtt/sessions/${id}?fields=id,client_id,connected,expiry_interval,last_active,expires,bytes_out_queue`, {
        headers: { Authorization: token.startsWith('FlespiToken ') ? token : `FlespiToken ${token}` },
        signal: AbortSignal.timeout(10000),
      });
      const data = await response.json();
      const rows = (data.result ?? []).filter(row => row.id === id && row.client_id === expectedClient).map(row => ({
        id: row.id, client_id: row.client_id, connected: row.connected, expiry_interval: row.expiry_interval,
        last_active: row.last_active, expires: row.expires, bytes_out_queue: row.bytes_out_queue,
      }));
      return { http_status: response.status, rows };
    }, { id: probe.sessionId, expectedClient: probe.clientId });
    report.metadata.push({ case: probe.name, offline_ms: Math.round(performance.now() - probe.disconnected),
      observed_at: new Date().toISOString(), ...snapshot }); save();
  } catch { report.metadata.push({ case: probe.name, unavailable: true }); save(); }
}
async function prepare(sender, spec) {
  const clientId = `naf-s1-listener-${randomUUID()}`;
  const initial = await connection('listener', clientId, spec.connectExpiry, spec.clean ?? false);
  owned.set(clientId, initial.sessionId);
  await initial.client.subscribeAsync(topic, { qos: 1 });
  await close(initial.client, spec.disconnectExpiry, spec.abrupt);
  const probe = { ...spec, clientId, sessionId: initial.sessionId, disconnected: performance.now(),
    initial_connack: initial.packet, queuedId: randomUUID() };
  // Metadata observations are read-only and exclude the untouched twin.
  if (spec.observeMetadata) await metadata(probe);
  await send(sender, probe.queuedId);
  event({ event: 'probe_offline', name: spec.name, client_id: clientId, connect_expiry: spec.connectExpiry,
    disconnect_expiry: spec.disconnectExpiry, abrupt: spec.abrupt ?? false, wait_ms: spec.waitMs });
  return probe;
}
async function finish(sender, probe) {
  const seen = [];
  const actualWait = Math.round(performance.now() - probe.disconnected);
  // Reconnect with Clean Start=false, preserving the ability to detect old state.
  const resumed = await connection('listener', probe.clientId, 120, false, seen);
  await resumed.client.subscribeAsync(topic, { qos: 1 });
  const control = randomUUID(); await send(sender, control);
  await bounded((async () => { while (!seen.includes(control)) await sleep(20); })(), 'allowed control');
  await sleep(500);
  const row = { name: probe.name, requested_connect_expiry_seconds: probe.connectExpiry,
    requested_disconnect_expiry_seconds: probe.disconnectExpiry, abrupt_socket_loss: probe.abrupt ?? false,
    initial_clean_start: probe.clean ?? false, offline_ms: actualWait,
    initial_connack: probe.initial_connack, reconnect_connack: resumed.packet,
    queued_message_delivered: seen.includes(probe.queuedId), positive_control_delivered: true,
    expected_session_present: probe.expectPresent,
    expectation_passed: resumed.packet.session_present === probe.expectPresent && seen.includes(probe.queuedId) === probe.expectPresent };
  report.cases.push(row); save();
  console.log(JSON.stringify({ progress: 'case completed', ...row }));
  await close(resumed.client, 0);
}

try {
  // Only use an existing, intended flespi page. No login or new browser required.
  try {
    browser = await require('playwright-core').chromium.connectOverCDP('http://127.0.0.1:55442');
    for (const context of browser.contexts()) {
      page = context.pages().find(p => { try { return new URL(p.url()).origin === 'https://flespi.io'; } catch { return false; } });
      if (page) break;
    }
  } catch { report.metadata_access = 'unavailable; MQTT probes continue'; }
  const { client: sender } = await connection('publisher', `naf-s1-publisher-${randomUUID()}`, 0, true);
  const delayed = [];
  for (const spec of [
    { name: 'cleanup-90s', waitMs: 90000, observeMetadata: true },
    { name: 'cleanup-360s-observed', waitMs: 360000, observeMetadata: true },
    { name: 'cleanup-360s-untouched', waitMs: 360000, observeMetadata: false },
  ]) delayed.push(await prepare(sender, { connectExpiry: 2, disconnectExpiry: 2, expectPresent: false, ...spec }));

  // Fixed, bounded matrix: positive retention and clean-session controls plus
  // omission, shortening, extension, zeroing, and abrupt loss. One suite only.
  for (const spec of [
    { name: 'clean-zero-control', connectExpiry: 0, disconnectExpiry: null, clean: true, expectPresent: false },
    { name: 'connect-2-disconnect-omitted', connectExpiry: 2, disconnectExpiry: null, expectPresent: false },
    { name: 'connect-2-disconnect-2', connectExpiry: 2, disconnectExpiry: 2, expectPresent: false },
    { name: 'connect-120-persistent-control', connectExpiry: 120, disconnectExpiry: null, expectPresent: true },
    { name: 'connect-120-disconnect-2', connectExpiry: 120, disconnectExpiry: 2, expectPresent: false },
    { name: 'connect-2-disconnect-120', connectExpiry: 2, disconnectExpiry: 120, expectPresent: true },
    { name: 'connect-120-disconnect-zero', connectExpiry: 120, disconnectExpiry: 0, expectPresent: false },
    { name: 'connect-2-abrupt-close', connectExpiry: 2, disconnectExpiry: null, abrupt: true, expectPresent: false },
  ]) {
    const probe = await prepare(sender, { waitMs: 5000, observeMetadata: true, ...spec });
    await sleep(Math.max(0, probe.waitMs - (performance.now() - probe.disconnected)));
    await metadata(probe); await finish(sender, probe);
  }
  let lastSample = performance.now();
  while (delayed.length) {
    for (let i = delayed.length - 1; i >= 0; i--) {
      const probe = delayed[i];
      if (performance.now() - probe.disconnected >= probe.waitMs) {
        if (probe.observeMetadata) await metadata(probe);
        await finish(sender, probe); delayed.splice(i, 1);
      }
    }
    if (!delayed.length) break;
    if (performance.now() - lastSample > 30000) {
      for (const probe of delayed) if (probe.observeMetadata) await metadata(probe);
      console.log(JSON.stringify({ progress: 'waiting for cleanup boundary', cases: delayed.map(p => ({
        name: p.name, offline_seconds: Math.round((performance.now() - p.disconnected) / 1000), target_seconds: p.waitMs / 1000,
      })) })); lastSample = performance.now();
    }
    await sleep(1000);
  }
  report.status = report.cases.every(row => row.expectation_passed) ? 'EXPECTATIONS_PASS' : 'EXPECTATION_FAILURES';
  report.completed_at = new Date().toISOString();
} catch (error) {
  report.status = 'HARNESS_FAIL'; report.error_type = error.name; report.error_code = error.code;
  process.exitCode = 1;
} finally {
  for (const client of opened) await close(client, 0).catch(() => client.end(true));
  // Clean Start=true only for IDs CREATED BY THIS RUN, to clear any offline
  // state left by an interrupted scenario. Never enumerate/delete shared IDs.
  for (const clientId of owned.keys()) {
    try { const fresh = await connection('listener', clientId, 0, true); await close(fresh.client, 0); }
    catch { report.cleanup_incomplete = true; }
  }
  await browser?.close().catch(() => {}); save();
  console.log(JSON.stringify({ output, status: report.status, gate: report.gate, cases: report.cases }));
}
