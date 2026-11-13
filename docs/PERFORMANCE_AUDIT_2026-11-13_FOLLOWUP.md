# Android audit follow-up, 13 November 2026

Evidence: user-supplied audit `audit-04eeefa6f059f4ab`, completed at
2026-11-13T10:35:39.554Z on Android 17 / Hermes, app 1.0.264 (320).
The compressed report was decoded locally and its declared byte length and
SHA-256 verified before analysis. Private aliases were not resolved or published.

## Observed result

The audit retained all 2,756 performance checks and 26 health checks. Combined
results: 233 pass, 2,483 warn, 51 fail, 15 justified availability skips. Duration
451.8 seconds; maximum event-loop delay 571.5 ms and frame gap 651.1 ms.

Compared with the preceding 1.0.261 report, unavailable responsiveness samples
fell from 126 to zero and journal omissions/truncation disappeared. This does
not establish a general performance improvement: timing failures persist and
two not-found-to-Rates journeys exceeded the unchanged 10,000 ms step limit.
Those two snapshots contain 20 committed rows but zero physically visible rows.

Market and Saved open quickly, but their first Back traverses Rates before the
second Back returns to the audit. The ~410–430 ms first-Back delay is included
in the journey, rather than discarded as audit overhead.

Cold Mortgage is not an equivalent-work comparison: the earlier report had
incomplete criteria and zero candidate rows; this report has completed criteria
and prepares 8,106 rows. Its 3,474.5 ms forward work still exceeds the unchanged
2,500 ms limit, but cannot be attributed to a regression from the old empty view.

## Repairs and verification

- Physical list visibility must publish independently measured visible cells
  even if a detached/recycled cell never calls its native measurement callback.
  An unmeasured target cannot pass. The reproducer failed before the repair.
- Audit surface registration must not force a second render of every mounted
  screen merely to store its registry handle. Registration and revocation remain
  tied to committed owners and capture generations. Replacing a probe ID removes
  the old probe rather than leaking it into subsequent readiness snapshots.
- Profile feature selection shares evidence evaluation only among tiers with
  the exact same product key and feature scope during one selection invocation.
  Changed evidence and selections are always re-evaluated on the next call;
  unknown, conflicting, conditional and missing evidence still fail closed.
- Profile option metadata is prepared once per catalogue/section identity.
  Selection edits retain absent saved values without rescanning every rate row.
- Product cards avoid redundant state updates when native width equals the
  expected list width. A wider rail keeps its existing fact nodes when their
  coordinates are unchanged; genuine geometry/font/fact changes still invalidate
  measured hit regions. Static row derivations are reused across layout updates.
- Mortgage index preparation shares the identical canonical comparison ordering
  instead of sorting it twice (three full sorts instead of four). Source-row
  traversal crosses an async boundary only at the existing 4 ms CPU-slice budget;
  cancellation and eligibility revision checks remain in place.

The audit-registration regression proves one screen render rather than two.
The lender-card profiler regression models 11 visible rows with separately
delivered native layout callbacks: one commit rather than 12. Narrow/wide width
corrections, invalid measurements, and existing font-scale/hit-region tests
remain covered. These are deterministic rendering tests, not device timings.

Focused Profile/eligibility verification: five suites, 24 tests passed. The
feature-matching benchmark used 12,000 synthetic rows, 500 products, 30 facts per
product, and 11 runs per implementation: median 24.02 ms before versus 8.85 ms
after, with the same 12,000 matching rows. This is a Node compute benchmark,
not a measurement of phone frame times or total audit duration.

After incorporating main's updated dependency lock and running `npm ci`, the
combined focused run passed 18 suites / 196 tests. TypeScript, changed-file
ESLint, the diagnostic-schema check and the UI-copy guard passed (zero copy
violations). Full mobile CI and release verification are separate remote gates.

## Acceptance boundaries

The 2,369 link warnings record untested HTTP reachability in local audit mode;
successful OS handler checks are not evidence that the websites responded.
Missing optional economics assets and incomplete projection inputs remain
explicitly unavailable. No source gaps are filled, timing thresholds relaxed,
network checks silently enabled, or missing physical measurements treated as
successful. A fresh physical-device audit is required to establish how much
lag remains after the released repairs.
