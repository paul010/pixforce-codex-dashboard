// Coalesce manual and automatic receiver activations.
export function singleFlight(connect) {
  let pending = null;
  const run = () => {
    if (!pending) pending = Promise.resolve().then(connect).finally(() => { pending = null; });
    return pending;
  };
  run.wait = () => pending?.catch(() => {}) ?? Promise.resolve();
  return run;
}

export function startReconnect({ shouldReconnect, connect, onError, intervalMs = 15000 }) {
  let busy = false, stopped = false;
  const check = async () => {
    if (stopped || busy || !shouldReconnect()) return;
    busy = true;
    try { await connect(); }
    catch (error) { if (!stopped) onError?.(error); }
    finally { busy = false; }
  };
  const timer = setInterval(check, intervalMs);
  timer.unref?.();
  return { check, stop() { stopped = true; clearInterval(timer); } };
}
