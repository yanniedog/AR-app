# Contract-owned fees (evaluator v4)

The ledger generates mandatory charges from a reviewed fee inventory and finite
dated or recurring schedules. A verified legacy feeCoverage flag alone cannot
establish completeness. Scenario fee events cannot override a contract schedule.
Account IDs identify customer account instances, not product catalogue IDs.

Each obligation has a stable charge identity, explicit trigger coverage, ordering,
debit location, pricing basis, applicability, waiver and discount policy. Percentage
bases use the declared balance snapshot or exact account/period AUD fact. Indexed
prices require a dated observation; gaps never use a nearby price. Monthly dates
use an explicit clamp or month-end convention. Unknown settlement/calendar policies
remain unresolved.

Fee conditions read only account- and period-scoped feeFacts selected by a
contract-owned assessment for the payable occurrence date. Global scenario facts
cannot waive recurring fees. Missing, duplicate or mismatched scoped facts remain
unknown. Receipt fee rows retain evaluation traces and assessment/clause evidence.
Multiple conditional triggers for the same fee on one date are rejected until
assessment binding includes individual trigger identity.
Discount precedence and rounding are explicit; unused rounding does not invalidate
a fee when every discount is false.

externalInflows, externalOutflows and externalCashflowNet describe the modeled
product account's cashflows. feesDebitedBalance affects that account's balance;
feesPaidExternal is separately paid from a nominated external account and never
capitalizes into a loan. feesCharged includes both and must not be substituted for
feesDebitedBalance in a product-account closing-balance reconciliation. Unknown
product debits taint subsequent balance-dependent interest and fees; displayed
numeric totals then describe known components, not bounds or complete results.

## Remaining limits

No actual bank fee adapter is approved by this implementation. Package arithmetic
charges only the named debtor, but portfolio allocation/completeness remains
unsupported. Structured savings activity requires separate fee reconciliation.
Incurred obligations payable after the horizon prevent complete cost claims.

TD lifecycle contracts currently cannot produce a complete v4 receipt: absent
general fee inventory is unresolved, and combining feeSchedule with tdLifecycle
is rejected until reviewed lifecycle/general-fee routing exists. The known TD
arithmetic remains available. This is an explicit C008/C009 integration gap.
