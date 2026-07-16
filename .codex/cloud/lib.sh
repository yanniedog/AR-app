#!/usr/bin/env bash

codex_cloud_init() {
  repo_root="$(git rev-parse --show-toplevel)"
  mobile_dir="$repo_root/mobile"
  marker="$mobile_dir/node_modules/.codex-dependency-inputs.sha256"

  if [[ ! -f "$mobile_dir/package-lock.json" ]]; then
    echo "codex-cloud: mobile/package-lock.json is required" >&2
    return 1
  fi
}

codex_cloud_validate_node() {
  if ! command -v node >/dev/null 2>&1; then
    echo "codex-cloud: Node.js 24 is required; node is not installed" >&2
    return 1
  fi

  local node_major
  node_major="$(node -p 'process.versions.node.split(".")[0]')"
  if [[ "$node_major" != "24" ]]; then
    echo "codex-cloud: Node.js 24 is required; found $(node --version)" >&2
    return 1
  fi
}

codex_cloud_dependency_hash() {
  local inputs=(
    "$mobile_dir/package.json"
    "$mobile_dir/package-lock.json"
    "$repo_root/.codex/cloud/lib.sh"
    "$repo_root/.codex/cloud/setup.sh"
    "$repo_root/.codex/cloud/maintenance.sh"
  )
  if [[ -f "$mobile_dir/.npmrc" ]]; then
    inputs+=("$mobile_dir/.npmrc")
  fi

  sha256sum "${inputs[@]}" | sha256sum | awk '{print $1}'
}
