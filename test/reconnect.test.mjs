import test from 'node:test';
import assert from 'node:assert/strict';
import { singleFlight, startReconnect } from '../reconnect.mjs';

test('reconnects only when enabled and disconnected', async (t) => {
  let enabled = true, connected = false, calls = 0;
  const retry = startReconnect({ shouldReconnect: () => enabled && !connected, connect: async () => { calls++; connected = true; } });
  t.after(() => retry.stop());
  await retry.check();
  await retry.check();
  assert.equal(calls, 1);
  connected = false;
  enabled = false;
  await retry.check();
  assert.equal(calls, 1, 'manual original-clock mode stays disabled');
  enabled = true;
  await retry.check();
  assert.equal(calls, 2);
});

test('an offline failure is handled and the next check retries', async (t) => {
  let calls = 0;
  const errors = [];
  const retry = startReconnect({ shouldReconnect: () => true, connect: async () => { if (++calls === 1) throw Error('offline'); }, onError: e => errors.push(e.message) });
  t.after(() => retry.stop());
  await retry.check();
  await retry.check();
  assert.equal(calls, 2);
  assert.deepEqual(errors, ['offline']);
});

test('slow connections never overlap, and stop prevents further attempts', async () => {
  let finish, calls = 0;
  const retry = startReconnect({ shouldReconnect: () => true, connect: () => { calls++; return new Promise(resolve => { finish = resolve; }); } });
  const pending = retry.check();
  await retry.check();
  assert.equal(calls, 1);
  retry.stop();
  finish();
  await pending;
  await retry.check();
  assert.equal(calls, 1);
});

test('manual and automatic activation share one request, including failures', async () => {
  let finish, calls = 0;
  const activate = singleFlight(() => { calls++; return new Promise((resolve, reject) => { finish = reject; }); });
  const a = activate(), b = activate();
  assert.equal(a, b);
  await Promise.resolve();
  assert.equal(calls, 1);
  const handled = assert.rejects(a, /offline/);
  finish(Error('offline'));
  await handled;
  await activate.wait();
  const next = activate();
  await Promise.resolve();
  assert.equal(calls, 2);
  const nextHandled = assert.rejects(next, /offline/);
  finish(Error('offline'));
  await nextHandled;
});

test('switching back to the original clock wins over an activation in flight', async () => {
  let finish, enabled = true;
  const activate = singleFlight(async () => { await new Promise(resolve => { finish = resolve; }); enabled = true; });
  const pending = activate();
  await Promise.resolve();
  const stop = (async () => { enabled = false; await activate.wait(); enabled = false; })();
  finish();
  await Promise.all([pending, stop]);
  assert.equal(enabled, false);
});
