#!/usr/bin/env bash
# Executed inside android-emulator-runner once the emulator has booted.
set -euo pipefail
adb wait-for-device
adb shell 'while [ "$(getprop sys.boot_completed)" != 1 ]; do sleep 1; done'
sleep 20
adb shell wm size 720x1600
adb shell wm density 320
adb install -r -g app.apk
args=(--mode "${MODE:-crawl}" --out explorer-out)
if [ "${FRESH:-true}" = true ]; then args+=(--fresh); fi
if [ -f baseline.json ]; then args+=(--baseline baseline.json); fi
if [ "${MODE:-crawl}" = audit ] || [ "${MODE:-crawl}" = full ]; then args+=(--audit "${AUDIT:-live}" --audit-timeout-min 120); fi
if [ -n "${ROUTES:-}" ]; then args+=(--routes "$ROUTES"); fi
if [ "${MODE:-crawl}" = script ]; then
  if [ -n "${SCRIPT_JSON:-}" ]; then
    printf '%s' "$SCRIPT_JSON" > explorer-script.json
  else
    cp mobile/tools/app-explorer/scripts/smoke.json explorer-script.json
  fi
  args+=(--script explorer-script.json)
fi
if [ "${MODE:-crawl}" = audit ] || [ "${MODE:-crawl}" = full ]; then
  # Targeted screenshots first so a later audit crash cannot lose them.
  node mobile/tools/app-explorer/shots.mjs explorer-out/shots || true
fi
node mobile/tools/app-explorer/driver.mjs "${args[@]}"
