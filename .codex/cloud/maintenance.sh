#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$script_dir/lib.sh"

codex_cloud_init
codex_cloud_validate_node

expected="$(codex_cloud_dependency_hash)"
actual="$(cat "$marker" 2>/dev/null || true)"

if [[ "$actual" == "$expected" ]] && [[ -d "$mobile_dir/node_modules" ]]; then
  echo "codex-cloud: cached dependencies are current ($expected)"
  exit 0
fi

echo "codex-cloud: dependency cache is stale; refreshing"
exec bash "$repo_root/.codex/cloud/setup.sh"
