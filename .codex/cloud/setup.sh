#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$script_dir/lib.sh"

codex_cloud_init
codex_cloud_validate_node

cd "$mobile_dir"
npm ci --no-audit --no-fund

lock_hash="$(codex_cloud_dependency_hash)"
printf '%s\n' "$lock_hash" > "$marker"
echo "codex-cloud: dependencies ready for $lock_hash"
