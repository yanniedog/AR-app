# Local audit controls and history

Open **Performance audit** in the app. **Run audit** uses local checks;
**Live audit** includes live-source checks. Both controls remain at the top
after completion. **Audit settings** contains the timeout and step options.
The existing **Public upload** choice still applies to the next run; turn it
off for a local-only run. Active audits, uploads and app updates continue to
block overlapping measurement runs.
The last run's upload choice is retained when the audit screen remounts within
the same app session, including after cancellation, failure and completion.

After a completed run, **Audit history** shows its recorded aggregate metrics.
Choose the audit mode and metric. **Recorded results** exposes the exact UTC
finish time, version/build, collection and coverage status, and measured value.
Repeated runs have distinct session IDs; saving the same run again does not
create another point. Missing measurements are gaps, not zeros. A single run
is one point, not an inferred trend. No older results are generated.

The app retains the newest 120 aggregate records locally in
`logs/ar-audit-metric-history.json`, alongside the existing completed report.
An existing completed report becomes available on upgrade and is preserved
when the next report is saved. Staged history writes are recoverable. A corrupt
history displays **History unavailable** with **Retry**, instead of silently
replacing the history. Diagnostic **Clear** also removes this history.

## Source issue

The supplied audit `audit-e00113d91cd91886` (Android/Hermes, build 312,
2026-10-31) reported missing chart evidence for `outlook.rba-response`.
The action completed before the newly opened chart's required probe committed;
later diagnostic snapshots showed the chart rendered. The local fix waits for
the probe commit before readiness sampling and still requires actual chart
render evidence. It does not relax timing budgets or certify the 131 timing
failures as resolved. That requires another real Android/Hermes run.

Bank avatars reuse the existing bundled, sourced artwork on consistent white
plates with borders and spacing. Initials remain the fallback; no replacement
logos were invented.

## Focused local checks

From `mobile/`:

```powershell
npm run typecheck
npm run check:ui-copy
npm test -- --runInBand --cacheDirectory=.jest-cache __tests__/auditMetricHistory.test.ts __tests__/auditMetricHistoryUI.test.tsx __tests__/performanceAuditReportStorage.test.ts __tests__/performanceAuditUploadControls.test.tsx __tests__/researchAuditNavigation.test.tsx __tests__/rbaChartPercentUnits.test.tsx __tests__/bankAvatarAuditSubscription.test.tsx __tests__/bankAvatarFrame.test.tsx
```

For device acceptance, inspect light/dark bank marks, run a local audit twice,
confirm both points and their exact timestamps, and confirm chart evidence in
the RBA check. Test empty history and storage failure using the focused tests;
do not erase real device diagnostics just to produce an empty screenshot.

## Audit entry path and estimate

Each run records three fixed checks from the interaction that started it:
`audit-entry-screen-open` (screen mounted to usable controls, `forwardWorkMs`),
`audit-entry-settings-open` (Audit settings toggle to painted content,
`maxFrameGapMs`) and `audit-entry-start-response` (press to accepted request
`actionMs`, press to next frame `maxFrameGapMs`, press to running runner
`forwardWorkMs`). They use the existing latency limits and metric names. A
phase without marks is declared unavailable, not failed.

The time estimate is one value: before a run, the last measured duration on the
device (9 min before any run); during a run, the adaptive remaining time.

Source audit `audit-6f8b3a65f8128f4f` (Android/Hermes, build 316, 2026-11-10)
reported 56 timing failures. Changes made from it: the completed report is read
and parsed once when the screen opens (it was parsed up to five times); lender
product ranking is cached per edition and lender; the no-listed-rate inventory
is built only when that view is used; physical list visibility is re-measured
after a returning navigation (`not-found.home` stalled for the full step limit
twice). Rates, Market and lender open stalls need another Android/Hermes run
before any claim that they are resolved.
