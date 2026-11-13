# Bank response audit coverage

The Bank response screen's unknown change/timing values now have a declared
`bank-response-coverage` health check. It assesses every applicable provider and
Mortgage/Savings/TD pair across decision windows overlapping the published
history ledger, including holds. Applicability comes from a section series,
section event or current core product; a TD-only bank does not imply missing
Mortgage products. `Decision windows` counts unique decisions, while the row
denominator retains each applicable section/provider/window.

Source and selected-product evidence are separate. Removed events remain
filtered history even when a current daily aggregate survives. Event-only
providers retain their measured move/timing with unverified first-move evidence.
Missing baseline, missing days, quarantine and unavailable event ledgers remain
explicit. No recorded move requires complete daily observations, a prior-day
baseline and a validated event ledger. It does not invent a zero rate change.

Normalization records event-ledger completeness. Missing/malformed events and
legacy normalized caches cannot establish an absent move. Both cache writers
persist the normalized marker; valid source survives the cache roundtrip, and
an incomplete marker cannot be upgraded merely by reading the cache again.

Public diagnostics retain all row positions with deterministic bank aliases and
a closed schema. Malformed saved rows and contradictory completeness claims
invalidate coverage. Local details preserve provider names; no arbitrary nested
source text is forwarded publicly.

## Pinned source check

The 2026-11-13 r000001 bank-history and calendar assets were obtained through the
shipping delivery helper and matched their manifest sizes and SHA-256 values.
Bank-history normalization retained all 110 providers, 179 dates and 800 events,
with a complete event ledger. The ledger spans 2026-05-13 through 2026-11-13.

The raw Savings window beginning 2026-11-03 has 95 rows: 41 measured moves and
54 no-recorded-move rows. Evidence classifies 37 moves with complete first-move
history, three with daily gaps and one with a missing baseline. ANZ's source
contains a +0.25 percentage-point move after ten days, while the supplied screen
showed unknown. This establishes a source/display distinction; the screenshot
does not reveal enough preference state to reconstruct the phone's projection.

The changes audit and classify evidence already available to the app. They do
not repair upstream missing history or remove suitability safeguards. A fresh
physical-device audit remains necessary for rendering and timing acceptance;
no physical device was attached during this validation.
