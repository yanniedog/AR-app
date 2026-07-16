#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
mobile_dir="$repo_root/mobile"
marker="$mobile_dir/node_modules/.codex-package-lock.sha256"

if [[ ! -f "$mobile_dir/package-lock.json" ]]; then
  echo "codex-cloud: mobile/package-lock.json is required" >&2
  exit 1
fi

expected="$(sha256sum "$mobile_dir/package-lock.json" | awk '{print $1}')"
actual="$(cat "$marker" 2>/dev/null || true)"

if [[ "$actual" == "$expected" ]] && [[ -d "$mobile_dir/node_modules" ]]; then
  echo "codex-cloud: cached dependencies are current ($expected)"
  exit 0
fi

echo "codex-cloud: dependency cache is stale; refreshing"
exec bash "$repo_root/.codex/cloud/setup.sh"
