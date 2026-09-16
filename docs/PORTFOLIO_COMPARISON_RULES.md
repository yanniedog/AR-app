# Portfolio integration and comparison (v6)

calculatePortfolio and comparePortfolios evaluate the bound account contracts and
scenarios. They do not accept caller-supplied receipt hashes as comparison proof.
Existing calculateLedger uses the same resumable account runners without injected
movements. V1–v5 inputs remain supported, including v4 fees and v5 loans.

## Authority and execution

The frame binds AUD, identical civil-date horizons, one declared Australian time
zone, same-day settlement, opening net worth, external contribution/withdrawal
identities, valuation and comparison metric. Account IDs identify instances.
Source/dependency completeness and actual bank approval remain separate gates.

Each account advances through a start/end day port. Explicit transfer orders merge
with scenario event orders and reject collisions. Source fees retain their declared
before/after-event ordering; day-open percentage bases precede transfers. Directed
dependencies can apply to one date or every date. Opposite transfers on different
days work; same-day account cycles and intraday settlement remain unsupported.

Internal transfers require exact source and destination identities, amount/date,
settlement status and two observed legs. Generated TD payout references its actual
cashflow occurrence. Equal amounts or free text never establish a counterpart.
Missing legs prevent exact comparison. Account receipt identities bind the parent
portfolio, actual movements, routing and assumption authority; source dependencies
from the portfolio also invalidate exported child results.

Shared packages require identical obligations, complete dated membership and one
debtor. Fixed/percentage fees use that debtor's declared basis. Other members prove
the obligation but do not pay again. External fee funding can route to a named
portfolio cash account with an explicit cleared-payment instruction, or use the
frame's outside-account cost adjustment. Each fee affects wealth once.

TD lifecycle-owned break fees are distinct from general fees. The supported
composition routes general fees externally and the actual maturity/early-closure
payout to its linked account. General fee depletion of TD principal remains
unsupported without its interest-basis policy. Holding beyond a closure-bound TD
horizon, unequal maturities and unknown rollover rates are not silently resolved.

## Activity and offsets

Savings activity bindings identify each generated cashflow, fee or interest posting
and its explicit source-defined classification, date basis and settlement state.
Every relevant source row in the assessment window must match once; duplicates,
unmatched rows, unknown amounts and inconsistent balances invalidate coverage.
Complete source windows precede the applicable interest interval. The existing
savings evaluator applies declared inclusion/exclusion rules. Caller inputs stay
unchanged. Projected activity settlement remains unsupported.

Offset contracts must agree across the complete affected loan inventory. Declared
cleared balances must match the source account's actual portfolio step balance;
stale balances or unverified source dependencies make subsequent loan interest and
allocation unavailable. A source account must precede the affected loan in that
day's dependency graph. Observation-only balances never imply future balances.

## Completeness and comparison

Structured assumption classification originates when validating an acknowledged,
hash-bound projected execution/transfer schedule. Its issue remains visible.
Conditional completeness does not relabel a projection as cleared. A frame must
explicitly allow conditional comparison; legacy unacknowledged projections remain
incomplete. Projected external fee funding is not implemented. Unpriced future
rates and other material unknowns remain unavailable, not generic assumptions.

Holding valuation includes unposted asset interest and outstanding loan components.
Principal transfers cancel at the customer level; debt and repayments are not
cost. Net interest/fee cost reconciles opening wealth plus aligned external
contributions minus closing wealth, including paid external fees and rounding.
Incomplete receipts retain labeled known components without a rank or advantage.

Comparison names its reference and metric. Higher terminal net worth or lower
net interest/fee cost is better; ties share rank. Daily break-even distinguishes
initial equality, first positive advantage, a transient lead and a final sustained
interval only through the evaluated last day. Zero plateaus are reported; no
intraday crossing or beyond-horizon permanence is inferred.

## Work and output limits

Preflight limits are50,000 account-days per portfolio and100,000 across a comparison.
Incremental ledger/issue append checks cap100,000 rows/12MiB per portfolio and
150,000 rows/24MiB across alternatives. Days, transfers, final metadata and a
conservative envelope reserve also consume the byte budget. A budget failure
returns a compact unsupported receipt, never a truncated exact result.

Ledger accounting uses incremental cursors and snapshot/date indexes. The
engineering two-account thirty-year test fits this envelope. These are desktop
test results; native responsiveness is not yet verified.

No actual product adapter, producer activation, native acceptance, cheapest-product
catalogue claim or real-bank eligibility approval follows from these mechanics.

Final serialized UTF-8 envelopes are checked independently: each portfolio is limited to 12 MiB and 100,000 ledger rows even inside a comparison; the whole comparison is limited to 24 MiB with a shared 150,000-row emission budget. Incremental guards prevent oversized batches before final exact serialization. Rejection returns a compact unsupported result. Activity binding cannot relabel generated posted occurrences as pending. Negative interest postings remain explicitly unavailable for activity adjustment because activity v1 amounts are unsigned.

## Current app boundary

The portfolio evaluator is engine capability, not an enabled personal comparison
feature. No executable approved-product contract payload, source approval resolver,
or customer scenario assembly pipeline currently connects it to the compare route.
That route continues to rank published rates and explicitly discloses personal cost
comparison as unavailable. Full fees, conditions, applicable source scope and
customer inputs need verification before a later integration can enable it. No ready
branch, inferred adapter, or fabricated product contract is supplied by this change.
