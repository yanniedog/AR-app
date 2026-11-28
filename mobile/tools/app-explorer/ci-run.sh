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
if [ -f session-baseline.json ]; then args+=(--session-baseline session-baseline.json); fi
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
  node mobile/tools/app-explorer/shots.mjs explorer-out/shots || { mkdir -p explorer-out/shots; echo failed > explorer-out/shots/shots-failed; }
fi
# Can the runner itself reach the official data sources? Separates a blocked network from an app defect.
mkdir -p explorer-out
: > explorer-out/source-reachability.txt
for url in \
  https://www.rba.gov.au/statistics/tables/csv/f17-forward-rates.csv \
  https://www.rba.gov.au/statistics/tables/csv/j1-cash-rate.csv \
  https://www.rba.gov.au/statistics/tables/csv/f1-data.csv \
  https://www.rba.gov.au/statistics/tables/csv/g1-data.csv \
  https://www.rba.gov.au/statistics/tables/csv/g3-data.csv \
  https://www.rba.gov.au/statistics/tables/csv/h4-data.csv \
  https://www.rba.gov.au/statistics/tables/csv/h5-data.csv \
  https://data.api.abs.gov.au/rest/data/ABS,CPI,2.0.0/3.10001.10.50.M?startPeriod=2015-01\&format=csv; do
  rc=0
  result=$(curl -sS -o /dev/null -m 20 -H 'Accept: text/csv' -w '%{http_code} %{time_total}s %{size_download}B' "$url" 2>/dev/null) || rc=$?
  # curl exit codes name the cause of a 000: 6 DNS, 7 connect, 28 timeout, 35/60 TLS, 56 reset.
  printf '%s | %s | curl-exit=%s\n' "${url%%\?*}" "${result:-no response}" "$rc" >> explorer-out/source-reachability.txt
done
# Certificate chain the runner sees for RBA, and the emulator's Android version and clock, to explain TLS failures in the app.
{
  echo "emulator android=$(adb shell getprop ro.build.version.release 2>/dev/null | tr -d '\r') api=$(adb shell getprop ro.build.version.sdk 2>/dev/null | tr -d '\r') date=$(adb shell date -u +%FT%TZ 2>/dev/null | tr -d '\r')"
  echo "runner date=$(date -u +%FT%TZ)"
  echo | timeout 20 openssl s_client -connect www.rba.gov.au:443 -servername www.rba.gov.au -showcerts 2>/dev/null | grep -E '^ *[0-9]+ s:|^ +i:|Verify return code' || echo "openssl chain unavailable"
} > explorer-out/rba-tls.txt 2>&1 || true
status=0
node mobile/tools/app-explorer/driver.mjs "${args[@]}" || status=$?
# UX rubric review of whatever the run captured, including after a crash.
ux_status=0
node mobile/tools/app-explorer/ux-review.mjs explorer-out || ux_status=$?
if [ "$ux_status" -ne 0 ]; then
  echo "ux-review failed with status $ux_status" >&2
  echo "$ux_status" > explorer-out/ux-review-failed
fi
case "${MODE:-crawl}" in
  session|full|audit)
    PYTHONDONTWRITEBYTECODE=1 python3 mobile/tools/app-explorer/test_rate_evidence.py
    python3 mobile/tools/app-explorer/rate_evidence.py explorer-out
    node mobile/tools/app-explorer/rate-summary.mjs explorer-out >> explorer-out/report.md
    ;;
esac
exit "$status"
