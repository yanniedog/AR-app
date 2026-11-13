# Audit startup and remaining latency investigation

Source: https://paste.c-net.org/c2583b7e-853e-952b-dc6b-19e7c3662212

The envelope decoded to 8,758,852 bytes. Its SHA-256 matched
`618e297b00ae928163c99e5ad301a682872ce820970dc14c48d132fa3b0e516c`.
The report is Android app 1.0.268, build 324, local mode, audit
`audit-60b4c7d36bd8912c`. Collection and retained details are complete;
verified coverage is incomplete.

## Recorded problems

There are 2,760 performance checks and 26 passing health checks. All 41 failed
checks are timing failures: 11 navigation journeys, 10 lender actions, six
mortgage scope actions, six other Rates actions, four receipt actions, two
redirects, a Market action and a theme action. Maximum JS lag is 668 ms and
maximum JS animation gap is 680.1 ms. These are failures even when actions
eventually complete.

The 2,521 warnings comprise 148 journey latency/frame warnings and 2,373
unverified remote destinations. Warning thresholds remain unchanged.

Entry measurements are 69.2 ms for screen readiness, 52.9 ms for settings,
65.1 ms for accepting Start, 30 ms for visible Start feedback and 138.8 ms
from Start to the runner. Setup adds 214.5 ms for safety, 200.3 ms for payload
settlement, 552.3 ms for pinned inputs, 1,007.4 ms for link inventory and
30.7 ms for environment capture. Entry response does not include all setup.

## Repairs

- Mount saved results and history after navigation paint opportunities. Keep
  controls available first; suppress this work during preflight and active runs.
- Schedule disk recovery after interactions. Starting before that callback
  prevents recovery work, while already-started recovery still preserves the
  previous diagnosis without replacing a newer result. Retry recovery after a
  failed preflight or terminal run. Reuse a report already in memory.
- Sort checks and construct detail/failure rows only when their panels open.
- Extract admitted failure stages directly, without cloning every readiness
  probe and work item for a single field. Skip truncation regex allocation on
  strings without the truncation marker. Full exports retain their sanitization.
- Reuse source-condition hashes in a bounded 2,048-entry LRU, with a 1,024
  character limit per key. Every clause, source membership, edition and
  provenance check still executes. Hash reuse cannot admit mutated evidence.
  The regression requires only one digest for 100 identical requests.
- Memoize each mounted catalogue hook's edition key by its installed manifest.
  One hundred layout/selection rerenders perform no capability hashes; manifest
  replacement and imperative audit reads still recompute and verify the key.
- Display both the idle estimate and running estimate as minutes and seconds,
  rounded upward once. For example, 480,484 ms displays `08:01`; minutes continue
  beyond an hour. Paused and unknown states retain their explicit labels.

PR #480 separately owns catalogue/facet reuse, redundant settling, readiness
notifications, link progress and expanded metric history. This change does not
duplicate that branch. Both sets of changes need to be present in the next
comparable device run. Timing limits and required readiness remain unchanged.

## Coverage findings retained

The 2,373 remote destinations are unverified because this was a zero-network
local run; handler availability cannot establish HTTP reachability. Fifteen
availability skips remain explicit. The projection model lacks scenario inputs
in both cold and warm journeys. One cold product-history probe is still pending.
These are not converted into passes or populated with invented inputs.

History inspected 185 days, with zero reported processing mismatches and zero
chart-projection mismatches. Source dates are unavailable on 2026-05-14,
2026-06-26 and 2026-10-07 through 2026-10-10. Historical detail evidence is
unknown for four Savings records on 2026-08-21 and seven each on 2026-10-06 and
2026-11-09. The 2026-11-13 publication has 116 quarantined tiers. These are
source/evidence gaps, not proof that every historical product is complete.
This app-only repair does not change the producer or manufacture missing data.

## Acceptance

Focused regressions cover request/recovery races, disclosure laziness, clock
rollover, unchanged condition validation, bounded hash reuse and public-stage
admission. GitHub mobile-ci owns full CI and native compilation.

Only a fresh comparable Android audit can establish the new device latency and
remaining failure count. A passing unit test, merged PR or green release run is
not physical-device performance acceptance.
