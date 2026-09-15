# Mortgage confirmed-obligations implementation boundary

This additive consumer uses seven provisionally pinned mortgage schemas. It does not freeze a producer contract or approve a bank product. Frozen savings and eligibility schemas and v8 arithmetic remain unchanged. The lossless schema generator reconstructs all 20 source schemas.

## Supported period

One historical AUD loan account over the exact reviewed window (at most 366 days): constant confirmed rate; reviewed component basis/allocation and payment phase; complete calendar-month-end postings; monthly obligations from the original confirmed anchor and fixed amount. Cleared executions must be on the source due date/phase, with cumulative payments no greater than the obligation. Unpaid/partial obligations stay incomplete. Opening unposted interest preserves 12 decimal places; other opening components are cents. Opening total reconciles exactly, with explicit no-prior-arrears/default confirmation.

Fixed external fees retain source incurred date, due date and per-day order. Engine order is the stable global rank of (due date, source order), with no invented cross-day banking priority. Positive fees require exact cleared settlement account/date/amount. Zero fees retain their occurrence without a cash settlement: a deterministic noncash role satisfies the engine's debit shape, not a claimed bank account/payment.

Advances, offset, redraw, reversals, excess/late payments, variable rates, closure, capitalised fees and deferred/outside-period effects refuse. Required engine advance/balance-basis constants are inactive with empty advances/fixed external fees; reversal policy stays unknown and reversals are excluded.

## Trust and privacy

The consumer checks actual adopted core/details, immutable namespace/index/shard, exact selected product or current rate row, approved subject/authority graph, field/event coverage and current edition at execution/export. Product-target historical rates do not require an invented current row. Original source bytes, typed material revisions and source-store admission remain producer verification, separate from customer confirmations. No private historical archives are downloaded.

User-reported offer, opening components, payments and fee accounts remain local; scenario roles never fall back to profile values. Recorded criteria are independently evaluated, explicit selection required, and failures do not produce complete claims. The receipt retains both private inputs and source bindings. The UI labels account-only scope and excludes tax/full borrowing-cost claims.

## Focused evidence

19 oracle controls: 11 actual adapter arithmetic (including independent leap-month-end companion), five actual intended refusals, two original-anchor helper controls and one original no-posting leap direct-v8 control. Original 18-vector bytes remain unchanged. Daily loan rows expose accrued amount/date; daily component snapshots/basis are not exported and are not claimed as independently matched. Final components, debt, payments, external fees, interest, residue and conservation are asserted.

Nine admission/transport controls, two actual UI controls and four lossless-schema controls complete the current 34-test group. Full CI, exact committed runtime closure, actual producer source-store capture and activation remain separate gates.

Expanded-data guard: requested mortgage loading counts retained adopted core/details JSON plus exact inflated index/shard text against 24 MiB, with the remaining allowance passed to the inflater. It does not fetch unrelated capability shards. Producer verification separately checks original decoded snapshot bytes (including bytes removed by normalization); the consumer makes no original-byte size claim from normalized objects.
