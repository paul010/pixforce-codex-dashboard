#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
IFS= read -r node_bin < .node-bin
export PATH="$(dirname -- "$node_bin"):$PATH"
exec "$node_bin" --env-file=.env server.mjs --activate
