# Term-deposit lifecycle engine

The v3 evaluator adds a contract-owned, single-investment lifecycle to `calculateLedger`. Source review must bind the cohort, confirmed investment amount and fixed rate, funded date, nominal term/maturity, payment schedule and accepted closure instructions. Scenario events cannot substitute or omit those events, and a scenario cannot change the confirmed investment amount. v1 flat and v2 savings inputs remain supported; earlier evaluator declarations cannot carry a TD lifecycle. Receipt identity includes all contract inputs and the executing evaluator version.

Supported source patterns:

- Digital: daily fixed365 interest from funding, excluding maturity or accepted-notice day; no notice-period interest, no interim payment or rollover. Dates are explicitly bank-confirmed calendar dates; callers must obtain the applicable Sydney dates from the source/confirmation rather than converting an arbitrary local timestamp.
- Legacy: fixed365, explicit cleared/NPP accrual start; credited interest never compounds. A confirmed cadence anchor and month convention enforce complete monthly/quarterly/half-yearly/annual schedules. Interest can remain in the deposit or be paid to a nominated linked account. Posting/maturity shifts require complete holidays for the account's bank-allocated state calendar.
- Early legacy closure: an explicit charge decision applies25percent of accrued interest; retained/unpaid interest funds the fee first. Principal recovery needs its own confirmed decision when necessary. Closure date is bank-confirmed and must satisfy the notice period; requesting notice is not acceptance.

Unsupported or missing policy remains visible in an incomplete receipt. Unknown rounding, calendar, destination, fee/recovery decision or tax treatment leaves settlement totals null, with available daily arithmetic retained. Hardship timing conflicts, rollover/future rates, grace instructions, investment-platform variants, variable rates, extra deposits, and partial withdrawals are not silently approximated. Exact declared term units replace any generic12-month fallback.

Captured Macquarie Digital and legacy terms inform isolated modeled arithmetic tests with raw document hashes. These tests are not product benchmarks or bank-account confirmations. Actual Macquarie adapters remain disabled: current payload rate/amount applicability, cohort, complete source graph, rounding and customer confirmation still require independent approval. Broad C008 and native acceptance remain in progress.
