#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
mobile_dir="$repo_root/mobile"

if [[ ! -f "$mobile_dir/package-lock.json" ]]; then
  echo "codex-cloud: mobile/package-lock.json is required" >&2
  exit 1
fi

node_major="$(node -p 'process.versions.node.split(".")[0]')"
if [[ "$node_major" != "24" ]]; then
  echo "codex-cloud: Node.js 24 is required; found $(node --version)" >&2
  exit 1
fi

cd "$mobile_dir"
npm ci --no-audit --no-fund

lock_hash="$(sha256sum package-lock.json | awk '{print $1}')"
printf '%s\n' "$lock_hash" > node_modules/.codex-package-lock.sha256
echo "codex-cloud: dependencies ready for $lock_hash"
