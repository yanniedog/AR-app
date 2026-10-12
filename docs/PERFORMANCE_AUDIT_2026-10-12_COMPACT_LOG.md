# Audit 1.0.229: navigation, local availability and compact exports

Source: https://paste.c-net.org/7cdc6cef-5d67-c5cc-b165-be3563156214

The Pixel 8 Pro / Android 17 / Hermes report (build 290) completed in
994,414.2 ms. It stored all 2,731 planned checks. No individual recorded check
exceeded 10 seconds. It reported 71 performance failures, one chart health
failure and 20 unexpected skipped journeys; these are distinct from a crash.

## Repairs

- Ten navigation failures compared an encoded `80%25 LVR` product href with
  the correct decoded `80% LVR` pathname. Decode expected hrefs once; compare
  captured pathnames literally, preserving distinct percent-encoded IDs.
  All 20 unexpected skips followed these false failures through scenario
  recovery. Exact logged route pairs and percent-identity regressions pass.
- Search keyed its FlashList by selection and filter-sheet state. Comparing
  one product unnecessarily remounted the entire list. Keep list/logo identity
  tied to results, while retaining selection updates and audit render evidence.
  A mount-count regression verifies selection and disclosure update in place.
- Independent audit scenarios replaced only the top route after earlier
  scenarios pushed product/bank screens. Capture the original audit navigation
  state and restore it between scenarios. Keep actual in-scenario back checks,
  the original route keys and nested tab state. Refuse restoration during a
  pending mutation or after the root navigator changes. Real StackRouter tests
  exercise six product/bank samples in both passes with bounded stack depth.
- Local audits attempted seven economic-source requests per mount, then
  reported absent cached observations as a chart-render failure. Use cached
  observations without changing source timestamps. Measure the rendered empty
  state and retain a distinct unavailable-data probe and skipped controls.
  Invalidate online responses that cross a local audit, including queued
  commits and responses completing after the audit has ended.

## Export contract

Default Copy, Share and automatic/manual uploads use `Compact diagnostic
export v1`. The retained native log and full audit sidecar remain unchanged.
Debug log also offers **Share full evidence**, using the original full export.
Public hosting consent, redaction, upload verification and deletion receipts
remain in the same export path.

The review export groups routine passes and validated local-only link warnings
with measured counts and timing totals. Every other check outcome is retained;
shared columns/metrics and repeated long evidence are encoded once. Failures
retain all their fields. Successful probe text on timing warnings and planned
step lists are summarized explicitly. Provider census tables preserve source
accounting and upstream failures, even when catalogue reconciliation passes.
Malformed/unknown log lines, incomplete-export notices, session/build identity,
last durable checkpoints and conflicting journal evidence remain visible.
Original-position markers retain the order of audit runs and interleaved raw
crash lines; anomaly check locations retain their source lines and timestamps.

On the supplied log, the formatter reduced UTF-8 bytes from **4,556,549 to
253,527 (94.44%)**. Independent decoding verified all 71 failed checks, all
eight producer failure records and all 277 provider census rows. This is an
export-size result; native formatting and UI timing require device acceptance.

## Evidence boundaries

The remaining 61 non-navigation performance failures comprise four round
trips, 13 first-pass actions and 44 repeat actions. Search remounting and
retained scenario screens are avoidable work; unit tests do not prove that
every physical-device stall is eliminated. Final native replay is owned by the
coordinated release task, together with the timing, catalogue-reuse and crash
recovery changes in the other PRs.

Some warnings are supported limitations, not fabricated failures to suppress:
offline logo initials; absent cached economic/update data; a first-pass
Mortgage card with no product matching the user's profile; and eight partial
producer captures. The latter include three failed product listings with
unknown populations and 15 known failed product details. A current published
payload does not prove complete upstream coverage. This app PR changes no Pi
process, ingest, scheduler or producer payload.
