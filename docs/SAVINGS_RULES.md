# Savings rule primitives

The existing dated ledger now accepts version-2 savings schedules. This is one
calculation engine; flat contracts retain their original arithmetic. Version-1
flat contracts remain accepted, while new savings contracts must declare v2.
Older clients therefore reject the new contract rather than silently ignoring its
tiers. Calculation receipts identify the evaluator actually used.

## Supported behavior

- Explicit contiguous effective intervals, with named additive base, bonus and
  introductory components. Intro expiry requires a supplied successor.
- Marginal allocation across adjacent exact-cent upper boundaries, or one selected
  tier applied to the whole balance. A final unlimited tier explicitly defines
  above-cap treatment, including a declared zero rate.
- Daily rate rounding before multiplication, followed by explicitly selected
  aggregate or per-tier accrual rounding. Posting uses the existing ledger policy.
- Dated assessment facts tied to account, assessment window and the interval in
  which qualification affects interest. These windows are source-bound contract
  fields; scenario dates must match exactly. Unknown qualification differs from failure.
- Structured account activity generates qualifying deposit amounts, withdrawal
  counts, purchase counts and balance growth. Each metric declares date basis,
  settled/pending treatment, included/excluded classifications and source references.
  Growth explicitly includes/excludes interest credits, fees and withholding tax.
- Source-defined linked-account roles bind an explicit account set. Totals and
  purchase counts aggregate only those accounts, requiring complete coverage for
  every member. Duplicate event identities reject the input rather than double-count.
- Refund policies explicitly ignore refunds or exclude the linked refunded purchase.
  Missing policy when a refund occurs, or an unresolvable/out-of-window purchase
  reference, remains unknown. Multiple refunds do not subtract a purchase twice.

Complete declared account/window coverage and boundary balances are required for
derived metrics. Unknown transaction kinds, statuses or relevant classifications
do not become zero. Generated unknown fields replace any caller-supplied aggregate,
so a guessed deposit total cannot bypass missing activity evidence. Activity and
rule work, intervals and receipt contribution sizes are bounded; assessments are
cached within a run, not recomputed from transactions every day.
Input receipt hashes include the executing evaluator version, including when a
legacy flat contract is executed. No separate evaluator-result cache currently
exists in the app. Runtime diagnostics inherit v2 and add fixed marginal/whole-tier
and missing-fact self-checks without reading customer facts. These probes exercise
shared allocation/accrual and generic eligibility primitives, not end-to-end
savings assessment-window dispatch or customer-product qualification.

Each daily receipt includes components, tiers, allocated balances, evidence IDs,
qualification traces and derived-activity outcomes. Missing bonus accrual leaves
known components only, with an incomplete receipt; it is not a promised minimum.
Linked fees still require explicit evidenced fee events and charge identities.
No new schedule proves fee completeness or creates fee occurrences automatically.

## Source benchmarks and boundaries

`savings-patterns.json` records the captured Macquarie stepped-rate illustration
and its raw document hash. Its independent annual allocation is $102,750 on the
published $2.1 million example. The unrounded daily actual/365 amount is 20550/73.
Bank-specific posting-rounding stage and complete applicability remain unproven.

The Great Southern Bank Youth eSaver holdout and Heartland whole-balance example
were readable through the web reader, but raw capture returned HTTP 403. Their
fixture document hashes remain null. They exercise allocation arithmetic directly;
they are not accepted raw-evidence ledger contracts. The Heartland example tests
the rate discontinuity immediately above the whole-balance cap.

GSB's published processed-purchase and balance-growth exclusions inform supported
activity patterns. Test customer events, explicit refund-policy alternatives and
assessment-to-interest mappings are clearly developer models. They are not bank
account observations or proof of those banks' complete legal rules.

## Still unavailable for real customer claims

No product adapter is activated by this work. Complete source interpretation and
approval must supply current/historical applicability, classification taxonomies,
refund scope, cutoffs/date conventions, account dependencies, fee schedules and
benchmarks. Policies beyond the two explicit refund alternatives are unsupported;
unknown adjustments and missing effective successors are rejected. No arbitrary
transaction labels, average-month arithmetic or default refund assumptions fill
those gaps. Native Hermes/visual acceptance and real whole-product benchmark
coverage remain pending; C-007 is in progress, not accepted.
