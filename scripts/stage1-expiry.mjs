import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, appendFileSync, fsyncSync, openSync, closeSync } from 'node:fs';
import { fork, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { connect, end, publish, commands, runId, bounded, sleep } from './stage1-mqtt.mjs';
import { ledger, signedCommand } from './stage1-validity.mjs';

const self = fileURLToPath(import.meta.url);
const kind = 'stage1-validity';
async function worker() {
  const [init] = await once(process, 'message');
  const store = ledger(init.path, init.publicKey, init.audience);
  const { client, packet } = await connect('listener', { clientId: init.clientId, expiry: 2,
    beforeConnect(client) {
      client.on('message', (topic, buffer) => {
        let input; try { input = JSON.parse(buffer.toString()); } catch { return; }
        if (topic !== commands || input.kind !== kind || input.run_id !== runId) return;
        const decision = store.accept(input.command);
        process.send?.({ event: 'decision', id: input.command.id, ...decision,
          received_ms: Date.now(), expires_ms: input.command.expires_ms,
          application_reply_suppressed: input.command.id === init.holdId });
      });
    },
  });
  await client.subscribeAsync(commands, { qos: 1 });
  process.send?.({ event: 'ready', session_present: packet.sessionPresent, quantity: store.quantity });
  process.on('message', async message => {
    if (message.event === 'stop') { await end(client); store.close(); process.exit(0); }
  });
}

async function main() {
  execFileSync(process.execPath, ['scripts/stage0-preflight.mjs'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const output = `docs/stage1/attempts/expiry-${runId}`;
  mkdirSync(output, { recursive: false });
  const privateDir = `.stage0-runtime/validity-${runId}`;
  mkdirSync(privateDir, { mode: 0o700 });
  // New directory entry is durable before starting a crash/recovery experiment.
  for (const dir of ['.stage0-runtime', privateDir]) { const fd = openSync(dir, 'r'); fsyncSync(fd); closeSync(fd); }
  const path = `${privateDir}/synthetic-ledger.jsonl`;
  const fd = openSync(path, 'wx', 0o600); fsyncSync(fd); closeSync(fd);
  const dirFd = openSync(privateDir, 'r'); fsyncSync(dirFd); closeSync(dirFd);
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const audience = `${commands}/${runId}`;
  const checks = [], clients = [], decisions = [];
  let child, report;
  function check(test, data) { checks.push({ test, passed: true, ...data }); }
  function make(changes = {}) {
    const now = Date.now();
    return signedCommand(privateKey, { aud: audience, id: randomUUID(), issued_ms: now,
      expires_ms: now + 30000, body: { delta: 1 }, ...changes });
  }
  async function start(clientId, holdId) {
    child = fork(self, ['validity-worker'], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], env: {
      PATH: process.env.PATH, HOME: process.env.HOME, SHOPPING_STAGE1_RUN_ID: runId,
    } });
    child.on('message', message => {
      if (message.event === 'decision') { decisions.push(message); appendFileSync(`${output}/decisions.jsonl`, JSON.stringify(message) + '\n'); }
    });
    const ready = new Promise((resolve, reject) => {
      child.on('message', m => { if (m.event === 'ready') resolve(m); });
      child.once('exit', () => reject(new Error('Worker exited')));
    });
    child.send({ clientId, holdId, path, audience, publicKey: publicKey.export({ type: 'spki', format: 'pem' }) });
    return bounded(ready, 'worker ready');
  }
  async function stop(kill = false) {
    if (!child || child.exitCode !== null || child.signalCode) return;
    const done = once(child, 'exit');
    if (kill) child.kill('SIGKILL'); else child.send({ event: 'stop' });
    await bounded(done, 'worker stopped'); child = undefined;
  }
  async function send(sender, command, expected) {
    const offset = decisions.length;
    await publish(sender, { kind, run_id: runId, command });
    await bounded((async () => { while (!decisions.slice(offset).some(x => x.id === command.id)) await sleep(20); })(), 'decision');
    const result = decisions.slice(offset).find(x => x.id === command.id);
    assert.equal(result.status, expected); return result;
  }
  try {
    const { client: sender } = await connect('publisher'); clients.push(sender);
    // Direct controls distinguish session retention from MQTT message TTL. Every
    // session below is newly generated; no session administration API is used.
    for (const waitMs of [4000, 70000]) {
      const clientId = `naf-s1-listener-${randomUUID()}`;
      const first = await connect('listener', { clientId, expiry: 2 }); clients.push(first.client);
      const wire = [];
      first.client.on('packetsend', packet => { if (packet.cmd === 'disconnect') wire.push(packet.properties); });
      await first.client.subscribeAsync(commands, { qos: 1 });
      await end(first.client, 2);
      const stale = make({ expires_ms: Date.now() + 2000 });
      const ttlId = randomUUID();
      await publish(sender, { kind, run_id: runId, command: stale });
      await sender.publishAsync(commands, JSON.stringify({ kind, run_id: runId, ttl_id: ttlId }),
        { qos: 1, retain: false, properties: { messageExpiryInterval: 2 } });
      const began = performance.now();
      while (performance.now() - began < waitMs) {
        await sleep(Math.min(20000, waitMs - (performance.now() - began)));
        console.log(JSON.stringify({ progress: 'expiry offline observation', requested_wait_ms: waitMs, elapsed_ms: Math.round(performance.now() - began) }));
      }
      const seen = [];
      const resumed = await connect('listener', { clientId, expiry: 2, beforeConnect(client) {
        client.on('message', (topic, buffer) => {
          if (topic === commands) { try { const p = JSON.parse(buffer.toString()); if (p.run_id === runId) seen.push(p); } catch {} }
        });
      } }); clients.push(resumed.client);
      await resumed.client.subscribeAsync(commands, { qos: 1 });
      const control = make(); await publish(sender, { kind, run_id: runId, command: control });
      for (let i = 0; i < 100 && !seen.some(x => x.command?.id === control.id); i++) await sleep(20);
      assert.ok(seen.some(x => x.command?.id === control.id));
      const deliveredStale = seen.some(x => x.command?.id === stale.id);
      const deliveredTtl = seen.some(x => x.ttl_id === ttlId);
      const store = ledger(`${privateDir}/probe-${waitMs}`, publicKey, audience);
      const expiredDecision = store.accept(seen.find(x => x.command?.id === stale.id)?.command ?? stale);
      assert.equal(expiredDecision.status, 'expired');
      assert.equal(store.quantity, 0); store.close();
      check('session retention / message TTL / signed deadline', { requested_session_expiry_seconds: 2,
        disconnect_properties: wire, offline_ms: Math.round(performance.now() - began), session_present: resumed.packet.sessionPresent,
        stale_without_message_ttl_delivered: deliveredStale, mqtt_message_ttl_seconds: 2,
        message_with_ttl_delivered: deliveredTtl, positive_control_delivered: true,
        signed_deadline_decision: expiredDecision, broker_expiry_expectation_passed: !resumed.packet.sessionPresent && !deliveredStale,
        message_ttl_expectation_passed: !deliveredTtl });
      await end(resumed.client);
    }
    const clientId = `naf-s1-listener-${randomUUID()}`;
    const held = make();
    await start(clientId, held.id);
    const before = await send(sender, held, 'accepted');
    assert.equal(before.quantity, 1); assert.equal(before.application_reply_suppressed, true);
    await stop(true);
    const restarted = await start(clientId);
    assert.equal(restarted.quantity, 1);
    const replay = await send(sender, held, 'duplicate'); assert.equal(replay.quantity, 1);
    const conflict = signedCommand(privateKey, { ...held, expires_ms: held.expires_ms - 1 });
    await send(sender, conflict, 'conflict');
    check('SIGKILL after fsync before application reply, then same-ID replay/conflict', {
      before, restarted, replay, synthetic_effects: 1, database_commit: false });
    for (const [command, expected] of [
      [{ ...make(), signature: '' }, 'signature'],
      [make({ aud: 'foreign-synthetic-audience' }), 'audience'],
      [{ ...make(), expires_ms: Date.now() + 20000 }, 'signature'],
      [make({ issued_ms: Date.now() + 5000 }), 'future'],
      [make({ issued_ms: Date.now() - 3000, expires_ms: Date.now() - 1000 }), 'expired'],
    ]) { const decision = await send(sender, command, expected); assert.equal(decision.quantity, 1); check(`reject ${expected}`, { decision }); }
    // A real queue delay within the live worker must expire before execution.
    const short = make({ expires_ms: Date.now() + 1500 });
    await send(sender, short, 'accepted');
    await sleep(1800);
    const delayedReplay = await send(sender, short, 'expired'); assert.equal(delayedReplay.quantity, 2);
    const control = await send(sender, make(), 'accepted'); assert.equal(control.quantity, 3);
    check('expired retry rejected before cached result; fresh control accepted', { delayedReplay, control });
    report = { status: 'NO-GO', mitigation_status: 'PASS', stage: 1, run_id: runId, tested_at: new Date().toISOString(), checks,
      limitations: ['Synthetic single-writer ledger only: no PostgreSQL, inventory mutation, app API, household auth, or browser response path.',
        'Fsync+SIGKILL tests process recovery, not power loss/disk loss. Ledger is private; per-run signing private key is memory-only.',
        'Absolute deadlines require trusted synchronized time; step detection cannot prove initial clock accuracy. 250ms is a test margin, not a measured clock bound.',
        'Broker expiry expectation stays separately FAIL when observed; mitigation does not repair provider semantics.',
        'MQTT message TTL is defense in depth, never command authorization or database commit.'] };
  } catch (error) {
    report = { status: 'FAIL', stage: 1, run_id: runId, tested_at: new Date().toISOString(), checks,
      error_type: error.name, error_code: error.code, note: 'Credential-bearing exception suppressed.' }; process.exitCode = 1;
  } finally {
    await stop().catch(() => child?.kill('SIGKILL'));
    for (const client of clients) await end(client).catch(() => client.end(true));
    writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ ...report, output }));
  }
}
if (process.argv[2] === 'validity-worker') worker().catch(() => process.exit(1));
else await main();
