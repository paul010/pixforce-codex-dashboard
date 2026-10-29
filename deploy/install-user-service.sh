#!/usr/bin/env bash
# Prepare the service without starting it or taking over the clock.
set -euo pipefail
[[ "$(uname -s)" == Linux ]] || { echo 'Run on the Ubuntu display host.' >&2; exit 1; }
[[ "$EUID" -ne 0 ]] || { echo 'Run as the intended service user, not root.' >&2; exit 1; }
project="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="${1:?Usage: bash deploy/install-user-service.sh /absolute/path/to/config.env}"
[[ -f "$env_file" ]] || { echo 'Configuration file is missing.' >&2; exit 1; }
node_bin="$(command -v node)"
"$node_bin" -e 'const [a,b]=process.versions.node.split(".").map(Number);if(a<22||(a===22&&b<21)){console.error("Node.js >=22.21 is required");process.exit(1)}'
"$node_bin" --env-file="$env_file" --input-type=module -e 'import {pathToFileURL} from "node:url";import {isAbsolute} from "node:path";const {loadConfig}=await import(pathToFileURL(process.argv[1]));const c=loadConfig(process.env,["--activate"]);if(!c.metricsFile||!isAbsolute(c.metricsFile)){throw Error("Set an absolute PIXFORCE_METRICS_FILE path for the Mac relay mode")}' "$project/config.mjs"
target="$HOME/.local/share/pixforce-dashboard"
unit="$HOME/.config/systemd/user/pixforce-dashboard.service"
command -v python3 >/dev/null
systemctl --user show-environment >/dev/null
files=(server.mjs account.mjs config.mjs c1.mjs cats.mjs demo.mjs index.html metrics.mjs metrics-snapshot.mjs mqtt.mjs reconnect.mjs render.mjs package.json LICENSE NOTICE.md)
for file in "${files[@]}" deploy/run-service.sh deploy/pixforce-dashboard.service; do
  [[ -f "$project/$file" ]] || { echo "Missing source: $file" >&2; exit 1; }
done
if [[ "${2:-}" == --check ]]; then
  echo 'Configuration, Node, Python, user systemd and runtime files checked; no files or services changed.'
  exit 0
fi
[[ ! -e "$target" && ! -e "$unit" ]] || { echo 'Existing installation found; stop and back it up before replacing it.' >&2; exit 1; }
umask 077
mkdir -p -- "$target" "$HOME/.config/systemd/user"
for file in "${files[@]}"; do
  install -m 644 -- "$project/$file" "$target/$file"
done
install -m 600 -- "$env_file" "$target/.env"
printf '%s\n' "$node_bin" > "$target/.node-bin"
install -m 755 -- "$project/deploy/run-service.sh" "$target/run-service.sh"
install -m 644 -- "$project/deploy/pixforce-dashboard.service" "$unit"
systemctl --user daemon-reload
echo 'Installed only. NOT enabled or started; the clock is unchanged.'
echo 'After stopping the previous sender: systemctl --user enable --now pixforce-dashboard.service'
linger="$(loginctl show-user "$(id -un)" -p Linger --value 2>/dev/null || true)"
[[ "$linger" == yes ]] || echo 'For boot/logout persistence, ask an administrator to enable linger for this service user.'
