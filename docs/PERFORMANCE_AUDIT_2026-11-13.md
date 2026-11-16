# November 13 audit remediation

The supplied Android 1.0.261/build 317 report finished at
2026-11-12T21:33:32.483Z. Its gzip envelope was decoded and verified against
SHA-256 `0f51877865569a8ea61b0c6dea74ba503cb7267626764aa8bdf619d6fc2c693e`
and the declared 9,411,089 decoded bytes. Raw diagnostic data stays outside the
repository. The published APK was built from `8ac0714e`, so the earlier
navigation and Mortgage-index fixes were already present in this report.

## Baseline

- 2,756 performance checks: 204 passes, 2,495 warnings, 40 failures, 17 skips.
  The combined summary adds 26 passing health checks.
- All 40 failures were completed actions exceeding timing limits. Maximum
  event-loop lag was 472.1 ms and maximum frame gap was 495.6 ms.
- Rates Savings/Term deposits and warm Mortgage entry took roughly 1.0–1.3 s
  of forward work. Mortgage scope actions blocked for roughly 287–441 ms;
  comparison-page preparation took about 866 ms.
- Repeated lender opens produced roughly 260–359 ms frame gaps. Market Back
  took about 315–326 ms.
- 126 deep steps lacked responsiveness samples. Eight target probe errors
  covered two incomplete projection scenarios and six uncached economics
  checks. All 26 local health checks passed.
- All 2,369 external destinations passed OS-handler checks. HTTP reachability
  was not attempted in local mode; these are unverified, not broken-link proof.
- The journal reported 30 truncated entries and 943 omitted entries. The
  canonical check inventory itself had no missing or duplicate checks.

## Changes and local evidence

Rates retains up to six prepared pricing/results editions across remounts,
with a 50,000 retained-row-slot budget per cache. Source owners count toward
the budget, old entries are evicted, and oversized outputs still display
without being retained for a later remount.
Reuse is tied to source, catalogue, scenario, eligibility, suitability,
financial-context identity and quote validity. Focused tests verify that warm
remounts start no pricing worker or filter/sort job, and changed evidence or
expired quotes cannot reuse a result. Cold filter scheduling removes 200 ms of
fixed delay while retaining cooperative work and a first-paint deferral.

Prepared Mortgage metadata now compiles numeric bounds and alternative source
bands once. A Node proxy using the checked-in 184-row sample and 15,000 queries
took 114.20 ms before and 85.60 ms after, with the same 473,400 row matches.
This is a local microbenchmark, not a device latency result.

Currency/count/publication-date formatters are reused. For 5,000 identical
formatting triples, local Node medians were 622.8 ms before and 26.1 ms after.
Unknowns, rounding, date-only UTC interpretation and timestamp local-zone
behavior have regression coverage. This approximately 24x improvement applies
only to formatting, not total application speed.

Market feed inputs remain stable across unrelated renders. Phone navigation
does not update navigator state for an undisplayed breadcrumb bar. Ordinary
Rates cell commits and scrolling retain exact visibility evidence without
rerendering the workspace for inactive diagnostics; audit activation publishes
the current evidence, and stale commit cleanup cannot revoke a newer owner.

Deep audit timing collects delayed timer/frame callbacks after the existing
settle and clips them to the exact action interval. Tests cover long synchronous
blocks, very short actions, missing callbacks and exact interval boundaries.
There is no added wait and no relaxed threshold. Missing callbacks remain
unknown. Journal checkpoints reference verbose canonical metric fields rather
than duplicating and truncating them; full retained checks remain unchanged.
A checkpoint replay from the public report, with all 2,756 checks and 477
retained non-check journal entries, occupies 1,920,907 bytes under the
2,097,152-byte journal limit. This uses the report's privacy-aliased evidence;
it is not a new device capture. Link checkpoints keep facet/attempt statuses
and explicitly reference canonical destination metadata.

## Acceptance boundaries

Focused tests cover modified caches, filtering, financial metadata, rendering,
navigation, formatting, responsiveness and journal behavior. Repository
typechecking, copy/schema guards, lint and GitHub `mobile-ci` remain required.

No Android device was attached during local validation. A new installed-build
audit is required to measure remaining frame gaps and confirm user-visible
speed. No claim of zero lag or elimination of all device warnings follows from
these local measurements.

Local-mode HTTP reachability, uncached economic sources, incomplete user
projection inputs and unavailable optional update/network checks remain honest
coverage boundaries. Historical source gaps on May 14, June 26 and October
7–10, 2026 remain upstream evidence; app changes do not manufacture missing
history or alter Pi ingest/publication.
