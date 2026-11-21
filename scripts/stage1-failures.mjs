import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { connect, end, publish, sender, startWorker, stopWorker, sleep, bounded, runId, commands, results, events } from './stage1-mqtt.mjs';

execFileSync(process.execPath, ['scripts/stage0-preflight.mjs'], { stdio: ['ignore', 'ignore', 'pipe'] });
const checks = [], opened = new Set();
const log = 'docs/stage1/failure-operations.jsonl'; writeFileSync(log, '');
const check = (name, data) => checks.push({ test: name, observed_at: new Date().toISOString(), passed: true, ...data });
let report;
try {
  const listener = await startWorker();
  const { client } = await connect('publisher'); opened.add(client);
  await client.subscribeAsync(results, { qos: 1 });
  const record = sender(client, 'failure-matrix', log);

  const duplicate = record.prepare(0);
  await Promise.all(Array.from({ length: 10 }, () => publish(client, duplicate.packet)));
  const duplicateReply = await bounded(duplicate.reply, 'duplicate response');
  for (let i = 0; i < 40 && record.duplicates.length < 9; i++) await sleep(100);
  assert.equal(duplicateReply.quantity, 1);
  assert.equal(record.duplicates.length, 9);
  check('concurrent application duplicate requests', { sent: 10, unique_synthetic_effects: 1, duplicate_results: record.duplicates.length,
    mitigation: 'In-memory promise reserved before processing; production needs durable operation-ID uniqueness.' });

  const slow = record.prepare(1, { delay_ms: 500 }), fast = record.prepare(2, { delay_ms: 5 });
  await Promise.all([publish(client, slow.packet), publish(client, fast.packet)]);
  await bounded(Promise.all([slow.reply, fast.reply]), 'out-of-order results');
  const order = record.rows.filter(x => [slow.packet.id, fast.packet.id].includes(x.id)).map(x => x.index);
  assert.deepEqual(order, [2, 1]);
  check('out-of-order application completion', { received_order: order, correlation_ids_preserved: true,
    mitigation: 'Correlate operation IDs; use server versions/sequence rules for conflicting writes.' });

  const replay = record.prepare(3, { id: duplicate.packet.id });
  await publish(client, replay.packet);
  const replayReply = await bounded(replay.reply, 'replay reply');
  assert.equal(replayReply.quantity, duplicateReply.quantity);
  check('same-ID replay in one process lifetime', { prior_quantity: duplicateReply.quantity, replay_quantity: replayReply.quantity,
    limitation: 'Simulator returns prior result despite changed index; production must bind operation ID to canonical payload hash and reject conflicts.' });

  const lost = record.prepare(4, { drop_once: true });
  await publish(client, lost.packet);
  let timedOut = false;
  try { await bounded(lost.reply, 'expected lost application acknowledgement', 600); } catch { timedOut = true; }
  assert.equal(timedOut, true);
  await publish(client, lost.packet);
  const retried = await bounded(lost.reply, 'retry response');
  assert.equal(retried.quantity, 4);
  check('lost application acknowledgment and retry after timeout', { timeout_ms: 600, timed_out: true, same_id_retry_quantity: retried.quantity,
    broker_puback_was_successful: true, mitigation: 'Broker ACK did not confirm processing/result. Retry same durable ID with bounded backoff.' });

  const held = record.prepare(5, { hold: true });
  const processed = new Promise(resolve => {
    const handler = message => { if (message.event === 'processed' && message.id === held.packet.id) { listener.process.off('message', handler); resolve(message); } };
    listener.process.on('message', handler);
  });
  await publish(client, held.packet);
  const before = await bounded(processed, 'listener processing before crash');
  const killedPid = listener.process.pid;
  await stopWorker(120, 'SIGKILL'); // Only this harness's own forked synthetic listener.
  const restarted = await startWorker(listener.clientId);
  assert.equal(restarted.session_present, true);
  await publish(client, { ...held.packet, hold: false });
  const after = await bounded(held.reply, 'restarted listener retry');
  assert.equal(before.quantity, 5);
  assert.equal(after.quantity, 1);
  check('listener process crash after synthetic effect, before result', { own_child_pid: killedPid, signal: 'SIGKILL',
    broker_session_resumed: true, quantity_before_crash: before.quantity, quantity_after_restart_retry: after.quantity,
    volatile_state_lost: true, database_commit: false, mitigation: 'Transport recovers but in-memory dedup/effects do not survive. Stage2 must use transactional durable dedup/outbox.' });
  record.close();
  await stopWorker();

  // Withhold an actual MQTT PUBACK after first delivery, close only the owned
  // socket, then reconnect with the same persistent session to observe redelivery.
  const unackedId = randomUUID(), receiverId = `naf-s1-listener-${randomUUID()}`;
  const deliveries = [];
  let firstDelivered, secondDelivered, withheld = false;
  const first = new Promise(resolve => { firstDelivered = resolve; });
  const second = new Promise(resolve => { secondDelivered = resolve; });
  const { client: receiver } = await connect('listener', { clientId: receiverId, expiry: 60, beforeConnect(client) {
    client.on('message', (topic, buffer, packet) => {
      let data; try { data = JSON.parse(buffer.toString()); } catch { return; }
      if (topic === commands && data.id === unackedId) { deliveries.push({ duplicate_flag: packet.dup, message_id: packet.messageId }); firstDelivered(); }
    });
    client.handleMessage = (packet, done) => {
      let data; try { data = JSON.parse(packet.payload.toString()); } catch { done(); return; }
      if (data.id !== unackedId) { done(); return; }
      withheld = true;
      setImmediate(() => client.stream.destroy());
      // Deliberately omit callback to suppress this one incoming MQTT PUBACK.
    };
  } }); opened.add(receiver);
  await receiver.subscribeAsync(commands, { qos: 1 });
  const closed = once(receiver, 'close');
  await publish(client, { kind: 'stage1-synthetic', run_id: runId, id: unackedId, index: 6 });
  await bounded(first, 'first unacknowledged delivery');
  await bounded(closed, 'owned socket close');
  await end(receiver, 60, true);
  const resumed = await connect('listener', { clientId: receiverId, expiry: 60, beforeConnect(client) {
    client.on('message', (topic, buffer, packet) => {
      let data; try { data = JSON.parse(buffer.toString()); } catch { return; }
      if (topic === commands && data.id === unackedId) { deliveries.push({ duplicate_flag: packet.dup, message_id: packet.messageId }); secondDelivered(); }
    });
  } }); opened.add(resumed.client);
  assert.equal(resumed.packet.sessionPresent, true);
  await bounded(second, 'QoS1 broker redelivery after lost PUBACK');
  assert.equal(withheld, true);
  assert.equal(deliveries.length, 2);
  check('actual QoS1 redelivery after withheld MQTT PUBACK and socket loss', { session_present: true, deliveries,
    mitigation: 'At-least-once delivery can duplicate effects. Never use MQTT packet IDs as durable business operation IDs.' });
  await end(resumed.client);

  // Broker-initiated disconnect is exercised through takeover of an ID created
  // by this test; no shared session IDs or broker control APIs are touched.
  const takeoverId = `naf-s1-listener-${randomUUID()}`;
  const old = await connect('listener', { clientId: takeoverId, expiry: 60 }); opened.add(old.client);
  let brokerReason = null;
  old.client.on('disconnect', packet => { brokerReason = packet.reasonCode; });
  const oldClosed = once(old.client, 'close');
  const newer = await connect('listener', { clientId: takeoverId, expiry: 60 }); opened.add(newer.client);
  await bounded(oldClosed, 'broker session takeover disconnect');
  check('broker-initiated disconnect on owned client-ID takeover', { broker_reason: brokerReason, old_connection_closed: true,
    new_session_present: newer.packet.sessionPresent, mitigation: 'Unique stable listener ownership; reconnect backoff and alerts. Shared broker restart is not authorized or simulated.' });
  await end(old.client, 0, true); await end(newer.client);

  // Expire ONLY a newly created synthetic listener session and prove backlog is
  // lost, then use a positive control on the new subscription.
  const expiredId = `naf-s1-listener-${randomUUID()}`;
  const initial = await connect('listener', { clientId: expiredId, expiry: 2 }); opened.add(initial.client);
  await initial.client.subscribeAsync(commands, { qos: 1 });
  await end(initial.client, 2);
  const staleId = randomUUID();
  await publish(client, { kind: 'stage1-synthetic', run_id: runId, id: staleId, index: 7 });
  await sleep(3500);
  const seen = [];
  const fresh = await connect('listener', { clientId: expiredId, expiry: 2, beforeConnect(client) {
    client.on('message', (topic, buffer) => { try { seen.push(JSON.parse(buffer.toString()).id); } catch {} });
  } }); opened.add(fresh.client);
  const resumedPastExpiry = fresh.packet.sessionPresent;
  await fresh.client.subscribeAsync(commands, { qos: 1 });
  const controlId = randomUUID();
  await publish(client, { kind: 'stage1-synthetic', run_id: runId, id: controlId, index: 8 });
  for (let i = 0; i < 30 && !seen.includes(controlId); i++) await sleep(100);
  assert.ok(seen.includes(controlId));
  const expiryPassed = !resumedPastExpiry && !seen.includes(staleId);
  checks.push({ test: 'session expiry discards offline backlog', observed_at: new Date().toISOString(),
    passed: expiryPassed, expiry_seconds: 2, offline_ms: 3500, session_present: resumedPastExpiry,
    stale_message_delivered: seen.includes(staleId), positive_control_received: true,
    mitigation: 'Do not rely on broker session expiry as a security/work-validity deadline. Require verified application expiry/replay protection and clarify provider semantics before GO.' });
  assert.equal(expiryPassed, true);
  await end(fresh.client);
  report = { status: 'PASS', stage: 1, run_id: runId, tested_at: new Date().toISOString(), checks, connections: events,
    notes: ['PASS means failure behavior characterized with controls, not production reliability or durable database commit.',
      'Only own child processes, sockets, session IDs and synthetic messages affected. No shared broker restart, host reboot or network firewall change.',
      'Persistent-session100-message recovery is separately recorded in baseline.json.'] };
} catch (error) {
  report = { status: 'FAIL', stage: 1, run_id: runId, checks, connections: events, error_type: error.name, error_code: error.code,
    notes: 'Credential-bearing exception suppressed. Preserve completed checks and raw records; do not claim gate PASS.' };
  process.exitCode = 1;
} finally {
  await stopWorker().catch(() => {});
  for (const client of opened) await end(client).catch(() => client.end(true));
  writeFileSync('docs/stage1/failures.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
