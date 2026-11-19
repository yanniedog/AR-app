---
name: app-explorer
description: Run the latest (or any) released AR-app APK on a real Android emulator in GitHub Actions and inspect every screen - screenshots, visible UI, settle times, jank, memory, crashes and JS errors. Use to experience the app, check UX, verify a release or reproduce a bug.
---

# AR-app explorer

A cloud Android emulator (API 34, x86_64, KVM, 720x1600 @ 320dpi) runs the released `app-preview.apk` and drives it with adb. Every step records a screenshot, the visible UI as JSON, settle time, jank frames, memory and logcat errors. Results go to the orphan branch `explorer/run-<runId>`, fetched with plain git (Actions artifacts are not reachable from the Claude workspace; git and release assets are).

It runs automatically after every successful `mobile-android-apk` release (full route crawl, compared with the previous run), and on demand.

## Commands (repo root)

```bash
node scripts/app-explorer.mjs run                         # crawl every route on the latest release (~12-18 min)
node scripts/app-explorer.mjs run --routes /market,/rba   # crawl selected routes only
node scripts/app-explorer.mjs run --script steps.json     # scripted interaction
node scripts/app-explorer.mjs run --audit                  # full in-app live audit, as on a phone (30-120 min)
node scripts/app-explorer.mjs run --audit local            # local audit
node scripts/app-explorer.mjs run --tag app-v1.0.300      # a specific release
node scripts/app-explorer.mjs fetch latest                # newest results (e.g. the post-release crawl)
node scripts/app-explorer.mjs list                        # recent runs
```

`run` dispatches, waits, fetches into `.explorer/<runId>/` and prints `report.md`. Run it in the background (it takes 10-20 minutes) and do other work meanwhile. Add `--keep-data` to skip clearing app data; `--ref <branch>` runs the workflow file from another branch, but the APK always comes from a release.

## Reading results

- `report.md`: one row per step - settle ms (and change vs the previous run), jank frames, p90 frame ms, memory, crashes, errors.
- `ui/NNN-step.json`: visible labels with tap coordinates and flags (`tap`, `scroll`, `on`, `sel`, `off`). Read these first; they are cheap.
- `screens/NNN-step.png`: open with the Read tool when layout or visual quality matters.
- `logcat.txt`: ReactNativeJS and crash output per step.
- Audit mode: `audit-log.txt` is the exact log the app uploaded to public hosting (paste.rs or paste.c-net.org), fetched by the runner; `audit.json` has the URL, outcome and duration; `screens/*audit-N-min*` show progression once a minute and `*audit-result-N*` the final result screen top to bottom. The audit is started from About > Diagnostics > App health audit with Public upload on, exactly as on a phone.

## Script steps

JSON array. A `launch` step (cold: force-stop first; `"warm"`: Home then resume) is prepended if absent. Selectors are a string (exact text or accessibility label, case-insensitive) or an object `{ "text"|"desc"|"id"|"contains"|"label": ..., "index": n }`.

```json
[
  { "launch": true },
  { "launch": "warm" },
  { "open": "/bank-rates" },
  { "tap": "Saved" },
  { "tap": { "contains": "Fixed" }, "scroll": true },
  { "type": "4.5", "into": "Rate", "submit": true },
  { "scroll": "down", "times": 3 },
  { "longPress": "Commonwealth Bank" },
  { "waitFor": { "contains": "Updated" }, "timeout": 90000 },
  { "expect": "Compare" },
  { "rotate": "landscape" },
  { "back": true },
  { "key": 82 },
  { "wait": 2000 },
  { "audit": "live", "timeoutMin": 90 },
  { "shot": "final" }
]
```

Every step waits for the UI to settle (two identical hierarchy dumps, no progress indicator) before recording. Add `"name"` to any step for a readable label. Deep-linkable routes are those in `mobile/app/+native-intent.tsx`; screens such as the performance audit and debug log are reached by tapping.

## Iterating

1. Crawl or fetch the latest results, read `report.md` and the `ui/*.json` for the screens in question.
2. Write a script reproducing the flow, run it, read screenshots where needed.
3. After a fix merges and the APK releases, the automatic crawl runs; `fetch latest` and compare.

Local alternative with an attached device or emulator: `node mobile/tools/app-explorer/driver.mjs --mode script --script steps.json --out out` (needs `adb` and the app installed).
