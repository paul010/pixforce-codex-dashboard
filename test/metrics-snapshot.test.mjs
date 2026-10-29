import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMetricsSnapshot } from '../metrics-snapshot.mjs';
import { startDashboard } from '../server.mjs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { once } from 'node:events';

const now = new Date('2026-10-29T04:00:00Z');
const snapshot = { schemaVersion: 1, capturedAt: now.toISOString(), quota: { name: '7d', pct: 25, resets_at: '2026-11-01T00:00:00Z' }, tokensTotal: 123456, activity: { days: [{ date: '2026-10-29', tokens: 12 }] }, access_token: 'not-a-real-token' };
test('snapshot accepts aggregates only, preserves unknown dates and expires by source time', () => {
  const fresh = parseMetricsSnapshot(JSON.stringify(snapshot), now);
  assert.equal(fresh.tokensTotal, 123456);
  assert.equal(fresh.activity.knownDays, 1);
  assert.equal(fresh.activity.days[0].tokens, null);
  assert.equal(fresh.access_token, undefined);
  assert.equal(fresh.fresh, true);
  assert.equal(parseMetricsSnapshot(JSON.stringify(snapshot), new Date(+now + 181000)).fresh, false);
  assert.throws(() => parseMetricsSnapshot(JSON.stringify({ ...snapshot, capturedAt: '2027-01-01' }), now));
  assert.throws(() => parseMetricsSnapshot('{', now));
});
test('file-backed dashboard never logs into Codex; stale data cannot become fresh on reread', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pixforce-snapshot-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'snapshot.json');
  await fs.writeFile(file, JSON.stringify({ ...snapshot, capturedAt: new Date().toISOString(), quota: null }));
  const probe = net.createServer().listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const app = await startDashboard({ hardware: false, demo: false, httpPort: port, fps: 8, metricsFile: file }, { readAccount: () => { throw Error('Must not read an account'); } });
  t.after(() => app.stop());
  await app.refresh(); assert.equal(app.state.tokensTotal, 123456); assert.equal(app.state.tokensStale, false);
  const capturedAt = new Date(Date.now() - 181000).toISOString();
  await fs.writeFile(file, JSON.stringify({ ...snapshot, capturedAt, quota: null }));
  await app.refresh(); assert.equal(app.state.tokensStale, true); assert.equal(app.state.lastDataAt, capturedAt);
  assert.equal(app.state.enabled, true);
  assert.equal(app.state.dataSource, 'Mac aggregate snapshot');
});
