# Scoped operator report

Recorded from the retained 14 October 2026 native UX-review operator notes during
PR #398 evidence reconciliation. This is a **reported observation record**, not
an original instrumented input log, timestamped event trace or independently
verified complete task total. The operator explicitly confirmed that no original
instrumented input/timestamp log is available in the retained context.

The report concerns the historical v1.0.237/build 295 session identified in
[the evidence README](README.md) and [capture manifest](manifest.json).
PNG/XML captures prove rendered states; they do not prove every input event.

The retained sequence description is:

> Fresh onboarding: Check my rate was already the default selection; the Check
> my rate CTA opened the calculator. The crash-report opt-in appeared and Not
> now was chosen. Rates tab opened the preview; the first Budget Home Loan row
> opened the product. Top Save toggled the saved state; Saved tab displayed one
> rate. Below the Rates preview, See all opened full Search with 6243 products.

| Reported scoped interaction | Reported event count | Supporting rendered state | Boundaries |
| --- | ---: | --- | --- |
| Check my rate CTA | 1 | [Onboarding PNG/XML](v1.0.237-b295/05-fresh-ready.xml) | Default job was already selected; necessary financial input/completed calculation not observed in this report |
| Not now privacy choice | 1 | No retained permission-dialog capture | Operator report only; placement/order does not establish full startup effort |
| Rates tab | 1 | [Rates PNG/XML](v1.0.237-b295/12-rates.xml) | Entry action reported; complete journey count and prior context unmeasured |
| First Budget Home Loan row | 1 | [Product PNG/XML](v1.0.237-b295/13-product-top.xml) | Selected exact numeric tier identity is not recoverable from this record alone |
| Top Save | 1 | [Saved product PNG/XML](v1.0.237-b295/15-product-saved.xml) | Saved visual state reported; this is not an independent saved-identity audit |
| Saved tab | 1 | [Saved PNG/XML](v1.0.237-b295/16-saved.xml) | One saved rate rendered; total find/inspect/save effort unmeasured |
| See all | 1 | [Below-preview gate](v1.0.237-b295/24-rates-bottom.xml) and [Search results](v1.0.237-b295/28-search-results.xml) | Scrolling occurred; number/distance of scrolls, recovery and waits unmeasured |

These counts are scoped to the named reported actions. They exclude unknown
mistaken taps, setup/recovery, scrolling, waits and interactions outside the
description. They cannot establish complete measured journey totals, elapsed
time, first-attempt success, source-rate identity or causal performance.

Phase 5 must retain a fresh baseline and final-build instrumented action ledger:
app/package/version/source and dataset identity, trigger/end state, every action
and selection, route changes, typing, scroll/recovery/waits, timing, interruptions
and outcome. The before/after comparison must use those complete records, not
promote this scoped report into independent measured evidence.
