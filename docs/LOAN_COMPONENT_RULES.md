# Loan components (evaluator v5)

This bounded protocol dispatches through calculateLedger and shares exact decimal
interest, fees and source receipts. It does not activate any actual bank product.
V4 fee contracts remain accepted; pre-v5 declarations reject loan contracts.

## Scope and state

The contract binds product/account instance, cohort, offer, source version and
opening snapshot identity. Confirmed opening debt equals principal plus posted
interest, unposted interest, capitalized charges and other debt. Unposted opening
interest retains up to12 decimal places; opening costs are not new horizon costs.
LoanResult.outstandingDebt retains12 decimals only when componentStatus is known;
it is null for partial component state. knownComponentDebt and generic
closingBalance then report partial arithmetic, not exact outstanding debt.
Unknown decomposition has no computed totals.

Interest-bearing components, payment phase, accrued-interest settlement rounding,
allocation priority, advance timing and fee balance basis are explicit. Loan-only
InterestPolicy declarations prevent contradictory generic ordering. Posting
transfers unposted interest to posted debt; it does not incur interest again.
The engine checks exact component conservation after every day and allocation.

## Obligations and executions

Contract obligations are confirmed dated amounts or actual interest due measured
immediately before the payment phase. A due payment does not move money. Cleared
and projected executions are evaluated separately; projected receipts always
carry an assumption issue. Contract advances also declare cleared/projected status.
Payments bind the loan account and obligation; extra payments use explicit limits.
Missing or partial payment remains visible. Unknown allocation/timing/settlement
keeps the payment unresolved rather than inventing a principal reduction.

The supported settlement policy rounds accrued interest before each payment.
The supported reversal policy restores the original component allocations without
recalculating prior interest; other reversal policies remain unknown. Overpayments
are rejected. IO-to-P&I transitions can use confirmed replacement obligations;
no unconfirmed formula, monthly-rate approximation or remaining term is inferred.

## Funding and linked accounts

Every product-debited fee occurrence needs one funding instruction. Capitalization
adds a charge component, not principal. Redraw funding also consumes available
redraw atomically. External-account fees are paid separately and never add debt.
Independent redraw on a day with fee-funded redraw is currently rejected to avoid
unproven duplicate funding. Package completeness remains unsupported.

Offsets require the complete declared account/loan inventory and source-bound
cleared snapshots with allocations for every included loan. Allocations cannot
exceed cleared balance; interest basis is capped at zero. balanceHistory must
separately declare a complete effective step schedule before snapshots carry
forward. Observations alone never prove intervening or future balances. Missing
global ownership or balance-history coverage remains unverified.
No single-loan link establishes customer-wide portfolio ownership.

Product-account payment inflows and advance/redraw outflows are separate from
external fee costs. Debt is not cost. Receipt components report new accrued
interest, amounts paid/transferred, principal movement and unposted closure debt.
The exact identity is opening debt + advances + new accrual + rounding adjustments
+ capitalized fees - component payments = closing debt.

## Remaining holds

Unknown future rates produce null accrual rows, not a carried-forward observed
rate. Unknown balance dependencies taint percentage fees and payment allocation;
partial numeric totals are known components, not exact forecasts or bounds.
Actual bank adapters, offer/BSB applicability approval, full source graphs, formula
P&I generation, unconfirmed fixed-term caps/break costs and other unreviewed
policies remain unavailable. C006 remains in progress pending broader acceptance.
