// Stage 1 experiment ONLY: single-writer append-only synthetic effect ledger.
// No application routes, household authorization, SQL, or real inventory writes.
import { createHash, sign, verify } from 'node:crypto';
import { openSync, closeSync, readFileSync, writeSync, fsyncSync } from 'node:fs';

export const clockMarginMs = 250;
const keys = ['v', 'aud', 'id', 'issued_ms', 'expires_ms', 'body'];
function canonical(command) {
  if (!command || Object.keys(command).sort().join() !== [...keys, 'signature'].sort().join() ||
      command.v !== 1 || typeof command.aud !== 'string' ||
      typeof command.id !== 'string' || !/^[a-f0-9-]{36}$/.test(command.id) ||
      !Number.isSafeInteger(command.issued_ms) || !Number.isSafeInteger(command.expires_ms) ||
      command.expires_ms <= command.issued_ms || command.expires_ms - command.issued_ms > 30000 ||
      !command.body || Object.keys(command.body).join() !== 'delta' || command.body.delta !== 1 ||
      typeof command.signature !== 'string') throw new Error('schema');
  return Buffer.from(JSON.stringify(keys.map(key => command[key])));
}
export function signedCommand(privateKey, fields) {
  const command = { v: 1, ...fields, signature: '' };
  command.signature = sign(null, canonical(command), privateKey).toString('base64url');
  return command;
}
export function ledger(path, publicKey, audience, wall = Date.now) {
  const entries = new Map();
  let failed = false, lastTime = 0;
  const startWall = wall(), startMono = performance.now();
  const digest = command => {
    const bytes = canonical(command);
    if (command.aud !== audience) throw new Error('audience');
    if (!verify(null, bytes, publicKey, Buffer.from(command.signature, 'base64url'))) throw new Error('signature');
    return createHash('sha256').update(bytes).digest('hex');
  };
  const fd = openSync(path, 'a+', 0o600);
  try {
    const text = readFileSync(fd, 'utf8');
    if (text && !text.endsWith('\n')) throw new Error('torn-journal');
    for (const line of text.split('\n').filter(Boolean)) {
      const row = JSON.parse(line), hash = digest(row.command);
      if (entries.has(row.command.id) || row.quantity !== entries.size + 1 ||
          !Number.isSafeInteger(row.accepted_ms) || row.accepted_ms < lastTime ||
          row.accepted_ms + clockMarginMs >= row.command.expires_ms ||
          row.command.issued_ms > row.accepted_ms + clockMarginMs) throw new Error('invalid-journal');
      entries.set(row.command.id, { hash, quantity: row.quantity });
      lastTime = row.accepted_ms;
    }
  } catch { closeSync(fd); throw new Error('journal-unavailable'); }
  return {
    get quantity() { return entries.size; },
    close() { closeSync(fd); },
    accept(command) {
      if (failed) return { status: 'journal-unavailable', quantity: entries.size };
      let hash;
      try { hash = digest(command); } catch (error) { return { status: error.message, quantity: entries.size }; }
      const now = wall(), monotonicWall = startWall + performance.now() - startMono;
      if (now < lastTime || Math.abs(now - monotonicWall) > clockMarginMs) return { status: 'clock-unhealthy', quantity: entries.size };
      if (command.issued_ms > now + clockMarginMs) return { status: 'future', quantity: entries.size };
      // Conservative guard: no grace interval after the signed deadline.
      // Synchronous validation+append prevents an await gap before synthetic effect.
      if (now + clockMarginMs >= command.expires_ms) return { status: 'expired', quantity: entries.size };
      const previous = entries.get(command.id);
      if (previous) return { status: previous.hash === hash ? 'duplicate' : 'conflict', quantity: previous.quantity };
      const quantity = entries.size + 1;
      const buffer = Buffer.from(JSON.stringify({ command, quantity, accepted_ms: now }) + '\n');
      try {
        let offset = 0;
        while (offset < buffer.length) {
          const written = writeSync(fd, buffer, offset);
          if (written <= 0) throw new Error('short-write');
          offset += written;
        }
        fsyncSync(fd);
      } catch { failed = true; return { status: 'journal-unavailable', quantity: entries.size }; }
      // This ledger row IS the synthetic effect; never claim atomic external writes.
      entries.set(command.id, { hash, quantity }); lastTime = now;
      return { status: 'accepted', quantity };
    },
  };
}
