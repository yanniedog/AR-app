# Product terms evaluator

This is a deterministic, source-bound clause and explicit-event evaluator. It does
not extract documents, approve products, generate payment schedules, or infer that
the whole catalogue has complete financial rules. The public terms evidence asset
is deliberately insufficient authorization for an executable `LedgerContract`.

`evaluateEligibility(rule, facts)` uses three-valued logic and exact decimal/date
comparisons. A clause result is not full-product eligibility. `calculateLedger`
requires separately reviewed source references, applicability to the exact cohort
and horizon, complete material/fee/rate coverage and a reviewed benchmark identity
before its `claimAvailable` can be true. Trusted producer validation must prove the
relationship between cited quotes and archived document bytes; local quote hashes
alone cannot establish that relationship or replace review.

Money uses decimal strings and internal BigInt rational arithmetic. Dates are
calendar dates, independent of the device time zone. Accrual includes `startDate`
and excludes `endDateExclusive`. Explicit events are processed by date and unique
order, then daily accrual, then explicitly scheduled interest posting. Posted
interest affects the next day's balance. Unknown event conventions, conflicting
applicability, unsupported clauses, missing fees and uncertain waivers prevent
complete cost/return claims. Repayment totals are not relabelled principal: the
principal allocation stays null and blocks complete repayment scenarios until a
reviewed allocation rule exists. Partial totals are evaluated known components; they
are not guaranteed lower or upper bounds.

Supported primitives include actual/365-fixed and actual/actual day counts,
explicit rate and offset changes, daily-rate rounding in explicitly specified
fraction/percentage units, daily or posting accrual rounding, fixed/percentage
fees with explicit rounding/caps and declarative waivers. A duplicate charge key
is rejected rather than charged twice or silently deduplicated. Shared-package
applicability and charge occurrence generation belong to a reviewed adapter.
Mortgage repayment generation, complex bonus/tier rules, maturity/rollover
generation, holidays, taxes and break-cost valuation remain unsupported until
their complete source-bound contracts and benchmarks exist. Calendar month helpers
require an explicit clamp or month-end convention; neither is inferred.

The fixture corpus records official-source byte hashes, exact short quote hashes,
locators and retrieval timestamps. Macquarie's published daily-interest example
is the arithmetic benchmark and its distinct offset example is a holdout. Ubank
age clauses test strict boundary/missing-information handling. These narrow clause
tests do not satisfy a whole-product benchmark or catalogue completion gate.

Ubank's retrieved home-loan terms describe rounding the daily percentage rate to
six decimal places, but their example of $528,000 at 2.89% producing $41.71 matches
rounding a fractional rate to six decimals. Literal percentage-unit rounding
produces $41.81. The fixture retains both and flags the interpretation conflict;
neither is silently promoted as the bank's validated ongoing-cost rule.

Run focused checks with `npx jest src/lib/productTermsEngine/__tests__ --runInBand`
from `mobile`, followed by repository mobile CI and native Hermes acceptance. Node
tests and TypeScript compilation alone do not establish actual APK execution.
