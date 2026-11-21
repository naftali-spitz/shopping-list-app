import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { get } from 'node:https';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const require = createRequire('/home/naf-w/.local/share/shopping-list-tools/package.json');
const mqtt = require('mqtt');
execFileSync(process.execPath, ['scripts/stage0-preflight.mjs'], { stdio: ['ignore', 'ignore', 'pipe'] });
for (const name of ['flespi-dev.json', 'flespi-auditor.json']) assert.equal(statSync(`.stage0-runtime/${name}`).mode & 0o777, 0o600);
const dev = JSON.parse(readFileSync('.stage0-runtime/flespi-dev.json', 'utf8'));
const expired = JSON.parse(readFileSync('.stage0-runtime/flespi-auditor.json', 'utf8'));
assert.equal(dev.account_id, 2617576);
assert.equal(dev.broker_url, 'mqtts://mqtt.flespi.io:8883');
assert.ok(expired.expire < Date.now() / 1000);
function metadata(token, path = '/auth/info') {
  return new Promise((resolve, reject) => {
    const request = get(`https://flespi.io${path}`, { headers: { Authorization: `FlespiToken ${token}` } }, response => {
      const chunks = []; response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => { try { resolve({ status: response.statusCode, body: JSON.parse(Buffer.concat(chunks)) }); } catch { reject(new Error('Invalid metadata response')); } });
    });
    request.setTimeout(10000, () => request.destroy(new Error('Metadata timeout')));
    request.on('error', reject);
  });
}
function deniedConnect(token) {
  return new Promise(resolve => {
    const client = mqtt.connect('mqtts://mqtt.flespi.io:8883', { username: token, protocolVersion: 5,
      clientId: `naf-s1-denied-${randomUUID().slice(0, 12)}`, reconnectPeriod: 0, connectTimeout: 8000, rejectUnauthorized: true });
    let settled = false, reason;
    const finish = data => { if (settled) return; settled = true; clearTimeout(timer); client.end(true); resolve(data); };
    client.on('packetreceive', packet => { if (packet.cmd === 'connack') reason = packet.reasonCode; });
    client.on('connect', () => finish({ connected: true, reason }));
    client.on('error', error => finish({ connected: false, reason: reason ?? error.code ?? null }));
    const timer = setTimeout(() => finish({ connected: false, timed_out: true, reason: reason ?? null }), 10000);
  });
}
const checks = [];
let report;
try {
  for (const [kind, token] of [['invalid', 'a'.repeat(64)], ['expired-own-auditor', expired.token]]) {
    const http = await metadata(token);
    assert.ok([400, 401, 403].includes(http.status));
    const connection = await deniedConnect(token);
    assert.equal(connection.connected, false);
    assert.equal(connection.timed_out, undefined, 'An explicit broker refusal is required');
    checks.push({ test: `${kind} credential rejected`, http_status: http.status,
      provider_error_codes: http.body.errors?.map(x => x.code), mqtt: connection, passed: true });
  }
  for (const role of ['publisher', 'listener']) {
    const response = await metadata(dev[`${role}_token`]);
    assert.equal(response.status, 200);
    const info = response.body.result[0];
    assert.equal(info.cid, dev.account_id); assert.equal(info.access.type, 2);
    assert.equal(info.id, dev[`${role}_token_id`]); assert.equal(info.ttl, 0);
    assert.equal(info.enabled, true); assert.equal(info.blocked, 0);
    assert.equal(info.expire, dev.expire); assert.ok(info.expire > Date.now() / 1000);
    const base = `shopping-poc/${dev.channel}`;
    assert.deepEqual(info.access.acl, [
      { uri: 'mqtt', topic: `${base}/${role === 'publisher' ? 'commands' : 'results'}`, actions: ['publish'], methods: [] },
      { uri: 'mqtt', topic: `${base}/${role === 'publisher' ? 'results' : 'commands'}`, actions: ['subscribe'], methods: [] },
    ]);
    assert.equal((await metadata(dev[`${role}_token`], '/platform/customer')).status, 403);
    const browser = await fetch('https://flespi.io/auth/info', { headers: { Authorization: `FlespiToken ${dev[`${role}_token`]}`, Origin: 'https://example.invalid' }, signal: AbortSignal.timeout(10000) });
    assert.equal(browser.status, 403);
    checks.push({ test: `${role} exact ACL/account/expiry/admin/browser restriction`, token_id: info.id, expire: info.expire, ttl: 0, acl: info.access.acl, passed: true });
  }
  const prior = JSON.parse(readFileSync('docs/stage0/mqtt-preflight.json', 'utf8'));
  assert.equal(prior.status, 'PASS');
  assert.deepEqual(prior.auth.map(x => x.token_id), [dev.publisher_token_id, dev.listener_token_id]);
  report = { status: 'PASS', stage: 1, tested_at: new Date().toISOString(), checks,
    acl_delivery_evidence: { path: '../stage0/mqtt-preflight.json', tested_at: prior.tested_at,
      note: 'Same dedicated token IDs/ACL reconfirmed above. Independent foreign/wrong-direction delivery controls and publish reason135 were actually tested there; SUBACK alone is not authorization.' },
    tls: 'TLS certificate validation enabled on every connection; earlier positive connections negotiatedTLS1.3.',
    unresolved_design_requirements: ['MQTT transport credentials do not authenticate household identity.',
      'Use server-only signed envelopes, exact audience/body hash/timestamps and durable replay/idempotency records before application integration.',
      'Production payload collision and process-restart persistence must be rejected/resolved transactionally in Stage2.',
      'No client/browser credential, shared/master broker token, production secret reuse or secret logging.'] };
} catch (error) {
  report = { status: 'FAIL', stage: 1, checks, error_type: error.name, error_code: error.code, notes: 'Credential-bearing exception suppressed.' };
  process.exitCode = 1;
}
writeFileSync('docs/stage1/security.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
