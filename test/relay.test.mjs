import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { aggregateSnapshot, relayConfig, receiverScript, pushSnapshot } from '../deploy/mac-metrics-push.mjs';
import { launchAgent } from '../deploy/install-mac-relay.mjs';
import { parseMetricsSnapshot } from '../metrics-snapshot.mjs';
import { demoAccountData } from '../demo.mjs';

const now = new Date('2026-10-29T04:00:00Z');
test('relay exports aggregates only and preserves missing fields as unknown', () => {
  const data = demoAccountData(now);
  data.auth = { secret: 'synthetic-secret' };
  data.conversations = ['synthetic-private-text'];
  const snapshot = aggregateSnapshot(data, now);
  assert.deepEqual(Object.keys(snapshot).sort(), ['activity', 'capturedAt', 'quota', 'schemaVersion', 'tokensTotal']);
  assert.doesNotMatch(JSON.stringify(snapshot), /synthetic-secret|synthetic-private-text/);
  assert.equal(parseMetricsSnapshot(JSON.stringify(snapshot), now).tokensTotal, 1234567890);
  const missing = aggregateSnapshot({ rateLimits: data.rateLimits }, now);
  assert.equal(missing.tokensTotal, null);
  assert.ok(missing.activity.days.every(day => day.tokens === null));
});
test('relay accepts explicit SSH destinations and rejects option injection', () => {
  assert.equal(relayConfig({ PIXFORCE_SSH_KEY: '/tmp/key', PIXFORCE_SSH_TARGET: 'clock-user@ubuntu-host.local' }).target, 'clock-user@ubuntu-host.local');
  for (const target of ['-oProxyCommand=oops', '-clock@host', 'clock@host; echo bad', 'clock@host extra', 'clock@-oBad'])
    assert.throws(() => relayConfig({ PIXFORCE_SSH_KEY: '/tmp/key', PIXFORCE_SSH_TARGET: target }));
});
test('SSH transport uses strict existing trust, propagates receiver failure, and writes an atomic private snapshot', { timeout: 5000 }, async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pixforce-relay-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const dest = path.join(dir, 'receiver');
  await fs.mkdir(dest);
  let args;
  const runReceiver = (_command, argv, options) => {
    args = argv;
    // Keep the real receiver code and streaming transport; only its home-directory
    // destination is replaced so the test cannot touch an installed dashboard.
    const script = receiverScript.replace("pathlib.Path.home()/'.local/share/pixforce-dashboard'", `pathlib.Path(${JSON.stringify(dest)})`);
    return spawn('python3', ['-c', script], options);
  };
  const config = { key: '/tmp/test key', target: 'clock@ubuntu-host' };
  const snapshot = aggregateSnapshot(demoAccountData(now), now);
  await pushSnapshot(snapshot, config, { spawnProcess: runReceiver });
  assert.ok(args.includes('StrictHostKeyChecking=yes'));
  assert.ok(args.includes('BatchMode=yes'));
  assert.ok(args.includes('IdentitiesOnly=yes'));
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(dest, 'metrics-snapshot.json'), 'utf8')), snapshot);
  assert.equal((await fs.stat(path.join(dest, 'metrics-snapshot.json'))).mode & 0o777, 0o600);
  await assert.rejects(pushSnapshot({ schemaVersion: 2 }, config, { spawnProcess: runReceiver }), /transfer failed/);
  await assert.rejects(pushSnapshot({ schemaVersion: 1, oversized: 'x'.repeat(32769) }, config, { spawnProcess: runReceiver }), /transfer failed/);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(dest, 'metrics-snapshot.json'), 'utf8')), snapshot, 'failed input must preserve the previous valid file');
  assert.deepEqual(await fs.readdir(dest), ['metrics-snapshot.json']);
});
test('generated LaunchAgent preserves paths with spaces and XML characters', () => {
  const xml = launchAgent({ node: '/tmp/node & tools/node', runtime: '/tmp/relay <example>', codex: '/tmp/codex', key: '/tmp/key & more', target: 'clock@ubuntu-host', logs: '/tmp/relay logs' });
  const parsed = JSON.parse(execFileSync('python3', ['-c', 'import sys,plistlib,json; print(json.dumps(plistlib.loads(sys.stdin.buffer.read())))'], { input: xml, encoding: 'utf8' }));
  assert.equal(parsed.ProgramArguments[0], '/tmp/node & tools/node');
  assert.equal(parsed.ProgramArguments[1], '/tmp/relay <example>/deploy/mac-metrics-push.mjs');
  assert.equal(parsed.EnvironmentVariables.PIXFORCE_SSH_KEY, '/tmp/key & more');
  assert.equal(parsed.EnvironmentVariables.CODEX_BIN, '/tmp/codex');
  assert.equal(parsed.KeepAlive, true);
});
