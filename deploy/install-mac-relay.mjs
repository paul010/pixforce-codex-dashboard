import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { relayConfig } from './mac-metrics-push.mjs';

export function launchAgent({ node, runtime, codex, key, target, logs }) {
  const xml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
  const string = value => `<string>${xml(value)}</string>`;
  const env = { PATH: [...new Set([path.dirname(node), path.dirname(codex), '/usr/bin', '/bin'])].join(':'), CODEX_BIN: codex, PIXFORCE_SSH_KEY: key, PIXFORCE_SSH_TARGET: target };
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key>${string('org.pixforce.metrics-relay')}
<key>ProgramArguments</key><array>${string(node)}${string(path.join(runtime, 'deploy/mac-metrics-push.mjs'))}</array>
<key>WorkingDirectory</key>${string(runtime)}
<key>EnvironmentVariables</key><dict>${Object.entries(env).map(([k,v]) => `<key>${xml(k)}</key>${string(v)}`).join('')}</dict>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>ThrottleInterval</key><integer>30</integer>
<key>StandardOutPath</key>${string(path.join(logs, 'metrics-push.log'))}
<key>StandardErrorPath</key>${string(path.join(logs, 'metrics-push-error.log'))}
</dict></plist>\n`;
}

function install() {
  if (process.platform !== 'darwin' || process.getuid() === 0) throw Error('Run as your macOS login user, not root');
  const { key, target } = relayConfig();
  const codex = process.env.CODEX_BIN;
  for (const [name, file] of [['CODEX_BIN', codex], ['PIXFORCE_SSH_KEY', key]]) {
    if (!file || !path.isAbsolute(file)) throw Error(`${name} must be an absolute path`);
    fs.accessSync(file, name === 'CODEX_BIN' ? fs.constants.X_OK : fs.constants.R_OK);
  }
  const project = fileURLToPath(new URL('../', import.meta.url));
  const runtime = path.join(os.homedir(), 'Library/Application Support/PixForceDashboardMetrics');
  const plist = path.join(os.homedir(), 'Library/LaunchAgents/org.pixforce.metrics-relay.plist');
  if (fs.existsSync(runtime) || fs.existsSync(plist)) throw Error('Existing relay found; stop and back it up before replacing it');
  fs.mkdirSync(path.join(runtime, 'deploy'), { recursive: true, mode: 0o700 });
  fs.mkdirSync(path.dirname(plist), { recursive: true });
  for (const file of ['account.mjs', 'metrics.mjs', 'deploy/mac-metrics-push.mjs'])
    fs.copyFileSync(path.join(project, file), path.join(runtime, file));
  fs.writeFileSync(plist, launchAgent({ node: process.execPath, runtime, codex, key, target, logs: runtime }), { mode: 0o600 });
  const domain = `gui/${process.getuid()}`;
  for (const args of [['enable', `${domain}/org.pixforce.metrics-relay`], ['bootstrap', domain, plist]]) {
    const r = spawnSync('/bin/launchctl', args, { stdio: 'inherit' });
    if (r.error || r.status !== 0) throw Error(`launchctl failed; inspect ${plist}`);
  }
  console.log(`Relay installed: ${plist}\nLogs: ${runtime}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  try { install(); } catch (e) { console.error(e.message); process.exitCode = 1; }
