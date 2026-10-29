import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { readAccountData } from '../account.mjs';
import { accountMetrics } from '../metrics.mjs';

// Rebuild an allowlist; raw account data never crosses SSH.
export function aggregateSnapshot(data, now = new Date()) {
  const m = accountMetrics(data, now);
  return { schemaVersion: 1, capturedAt: now.toISOString(), quota: m.quota,
    tokensTotal: m.tokensTotal, activity: { days: m.activity.days } };
}

export function relayConfig(env = process.env) {
  if (!env.PIXFORCE_SSH_KEY || !/^[a-zA-Z0-9_][a-zA-Z0-9_-]*@[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(env.PIXFORCE_SSH_TARGET || ''))
    throw Error('Set PIXFORCE_SSH_KEY and PIXFORCE_SSH_TARGET=user@host');
  return { key: env.PIXFORCE_SSH_KEY, target: env.PIXFORCE_SSH_TARGET };
}

export const receiverScript = `import sys,json,os,tempfile,pathlib
raw=sys.stdin.buffer.read(32769)
if len(raw)>32768: raise SystemExit('Snapshot too large')
data=json.loads(raw)
if data.get('schemaVersion')!=1: raise SystemExit('Invalid snapshot')
root=pathlib.Path.home()/'.local/share/pixforce-dashboard'
fd,name=tempfile.mkstemp(prefix='.metrics-',dir=root)
try:
 with os.fdopen(fd,'w') as stream: json.dump(data,stream); stream.write(chr(10))
 os.chmod(name,0o600)
 os.replace(name,root/'metrics-snapshot.json')
finally:
 if os.path.exists(name): os.unlink(name)
`;
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";

export function pushSnapshot(snapshot, config, { spawnProcess = spawn } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnProcess('/usr/bin/ssh', ['-i', config.key, '-o', 'IdentitiesOnly=yes',
      '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=8',
      '-o', 'ServerAliveInterval=5', '-o', 'ServerAliveCountMax=2', config.target,
      'python3 -c ' + quote(receiverScript)], { stdio: ['pipe', 'ignore', 'pipe'] });
    const timer = setTimeout(() => { child.kill(); reject(Error('Snapshot transfer timeout')); }, 20000);
    child.stdin.on('error', () => {});
    child.once('error', () => { clearTimeout(timer); reject(Error('Cannot start SSH')); });
    // Do not print raw account responses, SSH diagnostics or credentials.
    child.stderr.resume();
    child.once('exit', code => { clearTimeout(timer); code === 0 ? resolve() : reject(Error('Snapshot SSH transfer failed')); });
    child.stdin.end(JSON.stringify(snapshot));
  });
}

async function main() {
  const config = relayConfig();
  let busy = false, stopping = false;
  const children = new Set();
  const spawnTracked = (...args) => {
    const child = spawn(...args);
    children.add(child);
    child.once('exit', () => children.delete(child));
    child.once('error', () => children.delete(child));
    return child;
  };
  async function push() {
    if (busy || stopping) return;
    busy = true;
    try {
      const snapshot = aggregateSnapshot(await readAccountData({ spawnProcess: spawnTracked }));
      if (stopping) return false;
      // A partial response remains explicit null/unknown rather than zero.
      await pushSnapshot(snapshot, config, { spawnProcess: spawnTracked });
      console.log(new Date().toISOString(), 'aggregate snapshot delivered');
      return true;
    } catch (e) { console.error(new Date().toISOString(), e.message); return false; }
    finally { busy = false; }
  }
  if (process.argv.includes('--once')) { if (!await push()) process.exitCode = 1; return; }
  const timer = setInterval(push, 60000);
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
    stopping = true; clearInterval(timer);
    for (const child of children) child.kill();
    process.exit(0);
  });
  await push();
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch(e => { console.error(e.message); process.exitCode = 1; });
