# Reported metrics and their limits

This dictionary describes the app consumer on the product-evidence audit branch
and the producer reference functions inspected on 14 September 2026. The audit
report's per-bank/per-product CSVs contain actual values and missing fields for
the selected publication. A supported field is not proof that every bank
supplies it. Formulae below apply to the named dataset and filter context only.

The verified baseline is `app-payload-2026-09-14-r000001`, bundle
`bc13e752b5d259ed9b519a425ad0da8a1494a0f17cf29815a1a4177892cb97a9`.
It contains 2,708 detail records and 2,569 products represented in 16,546 rate
rows. The 139 detail-only products are accounted for separately. Its manifest
declares 617,803 source product facts; none of the 2,708 shipped detail records
contains a `facts` array. That source count is not the number of digitised facts
currently delivered to the app. The provider inventory and failed-holder
accounting remain separate: 110 named inventory providers must not be described
as complete coverage of 117 attempted holders or seven invented bank names.

## Units, identity and time

| Parameter | Meaning | Missing or qualification |
|---|---|---|
| `provider`, `product_id`, `product_key`, `product_name` | Holder label, original product identifier where supplied, qualified product identity and published name. | Names are not stable identities. The product key groups rate tiers; `rate_index` distinguishes published rows. |
| `rate`, `ongoing_rate`, `comparison_rate` | Annual rate fractions, normally decimal strings: `0.0634` means 6.34%. Displayed percent = fraction × 100; a basis point = 0.0001 fraction. | The amended parser retains real zero rates. Empty, invalid or negative values are unknown. It retains legacy percent conversion for values greater than one. |
| `run_date` | Observation/publication date of this captured dataset. | Not the legal effective date of every rate or term. |
| `last_updated` | Upstream product last-update timestamp when supplied. | It is not an independent check that every linked document was unchanged. |
| `generated_at`, `schedule.next_due_utc` | Publication build timestamp and expected next producer update. | App freshness checks use the configured grace window; freshness is not completeness. |
| Publication revision, bundle/manifest/asset SHA-256 | Exact immutable generation and bytes selected by the app. | Same date and same core alone do not prove unchanged details or history. |
| Document `observed_at`, `effective_from`, `effective_to` | Evidence acquisition time and separately evidenced legal applicability dates. | Null effective dates remain unknown. New terms contracts do not backdate current terms into missing historical periods. |

Contracts: [types.ts](../mobile/src/types.ts),
[format.ts](../mobile/src/data/format.ts),
[payloadRevision.ts](../mobile/src/data/payloadRevision.ts).

## Product fields currently carried by the core and details

All fields are optional at the product level unless required for row identity.
Each bank can have multiple products, tiers, balances, loan purposes and terms;
the inventory report preserves those separate rows.

| Product parameter group | Fields or reported content | Interpretation |
|---|---|---|
| Headline pricing | Advertised `rate`; base/ongoing `ongoing_rate`; statutory published `comparison_rate`. | Comparison rate is a lender's standardised disclosure, not this customer's amortisation rate or an exhaustive personalised total. A separately published ongoing rate may be unavailable. |
| Loan category and structure | `category`, `rate_type`, `repayment_type`, `loan_purpose`, `security_purpose`; canonical ribbon repayment/rate-structure fields. | Encodes the reported mortgage cohort, such as owner-occupied, principal-and-interest or fixed/variable. |
| Loan limits and period | `lvr_tier`, `term`, `term_months`, `ribbon_fixed_term`, `balance_min`, `balance_max`. | Published tier/band and term; an unknown maturity is not automatically 12 months. These alone do not prove eligibility. |
| Deposits | `account_type`, `ribbon_deposit_kind`, `interest_payment`, term and balance bounds. | Identifies base, bonus or introductory cohorts and reported interest payment cadence. Conditions may still be free text. |
| Classification and grouping | `feature_set`, `account_class`, `taxonomy_path`, `ribbon_normalized`. | Drives hierarchy and standard/non-standard visibility. Taxonomy is an analysis classification, not a bank contract. |
| Exact tracking | `rate_index`, `exact_alert_eligible`. | Whether the published tier identity is safe for an exact saved-rate alert. An ambiguous tier may allow a product-wide save only. |
| Product description | `description`, details `last_updated`. | Source product description; full legal text is not implied. |
| Fees | Label/type, name, value and explanatory text; amount status; amount/currency; fixed amount; percentage of balance/transaction/accrued amount; cadence; variable minimum/maximum; caps and cap period; discounts and their conditions. | Fixed zero means zero. A variable zero placeholder means unknown. Rates, bounds, caps, waivers and eligibility are separate data. No fee array does not prove a fee-free product. |
| Eligibility and constraints | Every received label/name, value and source explanation in `eligibility` and `constraints`. | May include minimum/maximum age, residency, customer type, balance/amount and other conditions. A listed criterion is not a finding that the customer meets it. |
| Features | Every received feature label/name/value/explanation. | Feature presence may depend on a linked account, package, eligibility condition or fee. |
| Official references | Overview, eligibility, fees, terms and bundle URLs; additive scoped `sourceDocuments` references where emitted. | URLs establish a reference, not acquisition, extraction, interpretation or calculation completeness. Scoped references are optional and may instead be represented in the lazy document asset. |
| Normalised facts (supported, absent from this baseline) | Fact ID, group/parent ID, kind, canonical parameter key, original source type, typed value, range, unit, cadence, applicability and condition. | Primitive source facts and a reviewed executable rule are different things. The baseline supports legacy detail arrays, not 617,803 app-delivered fact records. |

Rendering and interpretation:
[feePresentation.ts](../mobile/src/data/feePresentation.ts),
[ProductDetailParts.tsx](../mobile/src/components/product/ProductDetailParts.tsx),
[productFacts.ts](../mobile/src/data/productFacts.ts).

The candidate comparison replaces fee-name filtering and two-item summaries
with full named disclosures for fees, eligibility, features and constraints.
The overview reports item counts; opening a group exposes all received items.
This repairs display loss without claiming missing source terms were recovered.
Rate badges say lowest/highest rate and do not certify total cost or eligibility.

## Current bank, section and hierarchy statistics

| Metric | Formula and denominator | Cohort / missing behaviour |
|---|---|---|
| Minimum / maximum | Smallest / largest included rate fraction. | Computed over included rate **rows**, not one equal vote per product or bank. No eligible rows yields null. |
| Mean | Sum of included rate fractions ÷ number of included rate rows. | Unweighted arithmetic mean of offers; not weighted by balances, customers, loan sizes or bank market share. |
| Median | Middle sorted row rate; average of the two central rates for an even row count. | Multiple tiers from the same product each affect this denominator. |
| Rate count | Number of included finite rate rows contributing to that statistic. | Differs from raw rows, source rates and product count after filtering or quarantine. |
| Product count | Distinct `product_key` values among included rows. | Excludes products with no contributing row in this specific statistic. |
| Provider count | Distinct provider labels among included rows. | Not the CDR Register holder denominator or proof that every attempted bank succeeded. |
| Provider summary | The same min/max/mean/median and row/product counts within a provider and section. | Cohort and metric must accompany a comparison between banks. |
| Selected ranked rate | Mortgage: advertised or published comparison rate according to preference; individual rows can fall back to advertised when comparison is absent. Savings: ongoing/base for bonus/intro rows in base mode; headline in max mode. TD: published rate. | A bonus row with no published ongoing rate has an unknown base ranking. A comparison-rate **ribbon** does not substitute advertised values for missing comparison statistics. |

Source functions:
[taxonomy.ts: `statsFor`](../mobile/src/data/taxonomy.ts),
[ribbonStats.ts: `resolveSectionRibbonStats`](../mobile/src/data/ribbonStats.ts),
[selectors.ts: `rankFraction`, `excludeTokenDepositRates`](../mobile/src/data/selectors.ts),
[config.ts](../mobile/src/config.ts).

Hierarchy, query, provider and saved-profile filters define the current cohort.
Standard-only mode waits for the suitability index and does not substitute an
unfiltered producer ribbon when that gate is empty. Savings/TD list and ribbon
membership deliberately excludes headline/effective rates below **0.10% p.a.**
(`0.001` fraction). A zero base rate can still rank a visible conditional product
whose headline passes the floor. Retaining a genuine zero in a source/history
record does not disable this separate display filter. Historical producer
aggregates and today's preference-filtered aggregates are not interchangeable.

## Historical rate observations and bank events

| Metric | Definition | Window and limitations |
|---|---|---|
| Section daily `min`, `max`, `mean`, `median`, `count` | Precomputed aggregate of normalised rate rows for each captured date. | Only retained observations. The date index may have gaps. There is no claim of an observation on every calendar day. |
| Bank daily `median`, `best`, `count` | Median of accepted provider rate rows; best is minimum mortgage / maximum deposit rate; count is accepted rows. | Arrays align to `run_dates`; null means absent. These series have no per-product keys, so mixed current suitability cohorts cannot be historically separated on the device. |
| Product representative history | Section-best advertised rate among that product's tiers, by observation date. | Not a per-tier price ledger. The candidate cache retains all downloaded product catalogues and per-date immutable identities. Missing observations remain null; corrected snapshots replace superseded values, including removals. |
| Product recent change | Most recent unequal finite pair in the representative series; signed delta = `(new − old) × 10,000`, rounded to 0.1 bp. | Null gaps are skipped for change detection; the date is first observed change, not proven bank effective date. One point is tracking only. |
| Provider event `moved` | Number of matched products whose representative best rate changes by at least 5 bp. | Compared across successive retained producer snapshots. New/unmatched products do not count as rate changes. |
| Provider event `total` | Products with representative rates in both snapshots. | The denominator of “X of Y products”, not all products at the bank. |
| Provider event `dir` | All qualifying deltas positive = hike; all negative = cut; both signs = mixed. | “Cut” is a rate direction, favourable to mortgage borrowers but not depositors. |
| Provider event `avg_bps` | Arithmetic mean of qualifying moved-product deltas × 10,000, rounded to 0.1 bp. | Does not include unchanged products in this average. It is different from movement of the provider median. Producer event retention is capped at the latest 800 events. |
| Event median context | Last prior non-null provider median → median on event date; delta rounded to 0.1 bp. | Previous observation may not be the immediately preceding calendar day. |
| Top movers | Last observed provider median minus first observed median inside a trailing window (default 30 days), in bp. | Missing days are skipped. This is net median change, not sum of daily event averages or a stable matched-product basket. |
| Market pulse | Distinct providers with events, plus counts of cut/hike/mixed **events**, in the selected trailing window (default seven days). | Event counts can exceed bank count. Section filters apply. |
| Bank rewind snapshot | Last known best and median on/before the selected date; most recent best-rate change and observed date. | Intentionally a **last-known** snapshot: it may carry an earlier observation forward. It is not evidence of a new capture on the selected day. |
| Bank trend band | Span between that bank's best and median; line uses median (legacy fallback best). | This particular band is not the bank's full min/max range; “mean” chart plumbing must not be interpreted as a separately measured bank mean. |

Consumer sources:
[productHistory.ts](../mobile/src/data/productHistory.ts),
[historyDaily.ts](../mobile/src/data/historyDaily.ts),
[bankInsightsTypes.ts](../mobile/src/data/bankInsightsTypes.ts),
[bankInsights.ts](../mobile/src/data/bankInsights.ts),
[bankInsightsQuery.ts](../mobile/src/data/bankInsightsQuery.ts).
Producer reference:
[AR-local app_payload_mobile.py](https://github.com/yanniedog/AR-local/blob/main/app_payload_mobile.py),
`_history_point`, `_section_day`, `_provider_events`, `build_history_assets`.

## Mortgage–savings spread

The `bank_spread_history` method is
`mean_rate_rows_per_product_then_mean_products_per_provider`. First average
accepted rates within each product; then average those product means equally
within the bank. It is not the row-weighted mean above.

| Metric | Formula / population | Missing behaviour |
|---|---|---|
| `mortgage_mean` | Mean of product means for standard, owner-occupied, principal-and-interest, variable lending rows; excludes discount deltas. | Null if no eligible mortgage product. |
| `savings_mean` | Mean of product means for standard base/ongoing at-call deposit rows; excludes term deposits, bonus/intro/promotional/conditional cohorts. | Null if no eligible savings product. |
| `gap` | Mortgage mean minus savings mean as a rate fraction. Displayed percentage-point gap = fraction × 100. | Null unless both sides exist. It is not bank net interest margin or a customer cost/return calculation. |
| Counts | Eligible product count for each side. | Zero accompanies a missing side; counts are not row counts. |
| Membership hashes | Truncated SHA of sorted product identities for each side. | A change flags cohort membership changes; it does not establish stable product terms. |
| `quality` | Complete / missing mortgage / missing savings / missing both. | Consumer checks the label against means, counts, hashes and gap arithmetic. |

Sources: [bankSpreadHistory.ts](../mobile/src/data/bankSpreadHistory.ts),
[AR-local app_payload_bank_spread.py](https://github.com/yanniedog/AR-local/blob/main/app_payload_bank_spread.py).

## RBA response and pass-through metrics

RBA target rates are **percent**, whereas product rates are **fractions**.
Calendar entries include announcement date, outcome (hike/cut/hold), target,
delta in bp, and effective date where provided. Announcement-dated decisions
take precedence for response timing; legacy effective-date steps are fallback.
Holds remain decisions but have no meaningful ratio to a zero-sized rate move.

| Metric | Formula / denominator | Evidence boundary |
|---|---|---|
| App response window | Announcement through day before next rate-changing decision, or latest observed ledger day for an open window. | Latest window is open, not evidence of a completed non-response. |
| Baseline and final | Latest provider median at/on before announcement, and last median through window end; legacy best series only if no median exists. | Baseline/end coverage flags distinguish incomplete observations. A pre-ledger decision can have a partial baseline and remains unscored. |
| `netChangeBps` | `(final − baseline) × 10,000`, rounded to 0.1 bp. | May be opposite the RBA direction. It is not a sum of event averages. |
| `passedBps` | Net change when its sign matches the RBA decision, otherwise zero. | Zero alone is insufficient to infer a complete observed non-response. |
| `ratio` | `abs(passedBps) / abs(RBA bps)`, rounded to 0.001. | Null for missing baseline, no same-direction move or zero decision magnitude. |
| Status | None for zero/opposite; partial below full; full from ratio 0.999; over from 1.0001; unscored without baseline. | These are rate-movement classifications, not causal proof that the RBA caused a bank change. |
| Days to first move | Calendar days from announcement to first same-direction qualifying event, provided final net movement still follows that direction. | Missing timing stays null. Partial history timing is an observed upper bound. |
| End complete | Bank has a value on the last tracked ledger date within the response window. | An earlier last-known value cannot establish a fully observed closed window. |
| Response tendency | Same-direction closed windows ÷ all fully observed closed windows, rounded to whole percent. | Excludes open windows, partial decisions, missing baselines and missing window ends. Opposite and unchanged complete windows remain in denominator. |
| Median timing / pass percent | Median of available matching-response timings / ratios from those accepted windows. | Sample is responders with a usable value; null with no sample. |
| App tendency sample label | One-window below two; early at two; developing at four; established at six accepted windows. | A descriptive sample-size band, not statistical confidence bounds. |
| Compact response card | First provider event of any direction within each meeting interval; move in percentage points = event `avg_bps / 100`; announcement-to-event days. | Includes hold intervals and differs from final-net pass-through. Missing event remains null. |

Sources: [bankPassThrough.ts](../mobile/src/data/bankPassThrough.ts),
[passThroughModels.ts](../mobile/src/data/passThroughModels.ts),
[bankResponseModel.ts](../mobile/src/data/bankResponseModel.ts),
[rbaCalendar.ts](../mobile/src/data/rbaCalendar.ts).

The optional producer `behaviour` summary is a **different algorithm**: first
same-direction event within a default 60-day window capped before the next
decision. It reports responder `n`, median days, median absolute event bp and
median event/RBA ratio. Decisions before the ledger start are excluded; holds
and mixed events do not match. Its sample labels are insufficient below three,
early at three, emerging at six and established at ten. Do not substitute this
responder-only summary for the app's complete-window response rate.
Reference: [AR-local bank_behaviour.py](https://github.com/yanniedog/AR-local/blob/main/bank_behaviour.py).

## Eligibility and matching currently available

| Function / metric | What it actually does | What it cannot establish |
|---|---|---|
| Profile match | Matches selected product categories, purpose, repayment, rate type, LVR tier, deposit kind, interest cadence and required feature codes. Empty selection leaves that dimension unconstrained. | Customer age/residency/income/linked-account/cohort/legal eligibility is not fully evaluated. |
| Feature filter | Product lists every selected feature code. | No proof the feature is free or available to the customer. Missing details fails closed for selected required features. |
| Eligibility criterion filter | Product lists every selected eligibility type. | Presence of `MIN_AGE` does not mean the customer satisfies its age threshold. |
| Normalised fact filter | Canonical field predicates such as existence, equality and numeric bounds; AND across selected criteria. | Not an arbitrary compound legal rule interpreter; only supplied or legacy-derived facts are available. |
| Standard availability classification | Curated source classification/suitability index, including restricted and ambiguous tiers. | Not a lender approval, credit decision or comprehensive customer eligibility check. |
| LVR illustration | Loan ÷ property value × 100. For a purchase, applied deposit = max(0, savings − entered costs); loan = max(0, property value − applied deposit). | Existing `lvrTierForValue` selects the top available band when LVR exceeds all bands. It is a filter preference helper, not proof that the amount is within lender limits. |

Sources: [profile.ts](../mobile/src/data/profile.ts),
[eligibility.ts](../mobile/src/data/eligibility.ts),
[features.ts](../mobile/src/data/features.ts),
[productFacts.ts](../mobile/src/data/productFacts.ts),
[calc.ts](../mobile/src/data/calc.ts).

## Existing monetary illustrations

The existing app projections use nominal monthly approximations and declared
user assumptions. They have not been replaced with the new rule engine in this
candidate. An illustrative history reconstructed from user inputs is separate
from captured bank rate history.

| Metric | Formula / mechanics | Limitation |
|---|---|---|
| Mortgage payment | `P × i / (1 − (1+i)^−n)`, monthly `i = annual fraction / 12`; zero-rate special case `P/n`. | Nominal monthly annuity, not lender day-count/rounding. |
| Mortgage period interest | `max(0, opening balance − offset) × annual fraction / 12`. Payment is capped at balance plus interest; principal is reduction in loan balance. | Offset growth and payments occur at simulated monthly boundaries. Fees, daily balance changes and lender-specific allocation are not generally incorporated. |
| Savings period interest | Opening balance × active annual fraction / 12; interest then contribution less bounded withdrawal updates balance. | Monthly compounding; bonus qualification/rate transitions use entered scenario assumptions, not all bank conditions. |
| TD interest | Balance × active annual fraction / 12 accumulated until entered maturity; optionally reinvested; entered rollover rate is assumed. | No invented missing maturity, but this remains monthly simple accrual with illustrative maturity timing. Future renewal rates unknown. |
| Cash-flow conversion | Weekly × 52/12; fortnightly × 26/12; monthly unchanged. | Average monthly conversion, not actual dated payments. |
| Interest / principal ratios | Period or cumulative interest ÷ period or cumulative principal, only where principal denominator is positive. | Null when denominator is not positive; not APR or effective yield. |
| Total/end values | Cumulative interest, cumulative principal, end balance, payoff/maturity date and projected-only totals from simulated points. | No universal after-fee/after-tax return claim. Fixed-rate windows stop at their known/entered duration. |
| Loyalty rate gap | Mortgage `max(0,current−matched)`; deposits `max(0,matched−current)`; annual dollars = principal × gap; monthly = annual/12. | Simple interest illustration excluding tax, switching fees and future rate changes. |
| TD rate difference | Balance × (candidate rate − current rate) × term months / 12. | Simple difference over the known term, not full maturity cash-flow comparison. |

Sources: [projections.ts](../mobile/src/data/projections.ts),
[projectionScenario.ts](../mobile/src/data/projectionScenario.ts),
[decisionInsights.ts](../mobile/src/data/decisionInsights.ts),
[calc.ts](../mobile/src/data/calc.ts).

The existing stay/switch illustration uses six upfront fee buckets: current
bank exit, application, valuation, settlement, government/legal and other fees.
Explicit entered amounts take precedence; otherwise recognized fixed published
fees are summed. Gross fees minus entered cashback gives net switch cost.
Positive financed costs increase the new loan; cash funding reduces cash/offset.
Recognized periodic fees are divided by their month cadence. Each path uses the
advertised loan rate, the same remaining term and the disclosed household cash
allocation; comparison rate is not used to amortise the loan.

Its interest saving is stay interest minus switch interest. Known-cost
subtotals add recognized periodic fees to simulated interest, and add net
upfront costs on the switch path. These remain explicitly incomplete monthly
illustrations. The candidate keeps `totalCost`, `totalCostSaving`, cumulative
cost difference and break-even null: the legacy model has no reviewed adapter
that establishes complete material terms, customer applicability and a
supported calculation. Merely resolving all six fee buckets cannot enable them.

`feeInputsComplete` now records whether the recognized fee inputs are resolved;
`costClaimsAvailable` remains false for this legacy path. Conditional, variable,
capped, discounted or otherwise unpriced fees retain explicit reasons, plus the
independent unverified-terms limitation. The exact retained The Mac mortgage
fixture verifies that real fee records and official links alone cannot certify
exhaustive costs. Source:
[staySwitchProjection.ts](../mobile/src/data/staySwitchProjection.ts).

## New evidence and calculation foundations

The optional lazy terms asset is absent from the verified baseline. Its five
independent stages are discovery, acquisition, extraction, interpretation and
calculation. Each carries status, observed count and expected count. A null
denominator means unknown total. “Complete” requires a known exact denominator;
an acquired document alone does not establish interpreted clauses or usable
calculations. Source-bound term revisions preserve parameter, exact value/unit,
applicability, clause references, effective dates and observed time. Changes
distinguish source amendments from extraction corrections.

The candidate [productTermsEngine](../mobile/src/lib/productTermsEngine/README.md)
provides bounded, deterministic eligibility-clause and dated-ledger functions.
It is not a shipped all-product evaluator and is not automatically authorised
by a `validated` public term. No adapter currently proves complete product,
tier, customer-cohort and date applicability for the full catalogue. Supported
benchmarks and Node tests do not establish exhaustive fine-print coverage or
native-device execution. Unsupported or uncertain rules must retain incomplete
status and cannot produce an unqualified cheapest-product claim.

## Coverage metrics to read alongside every result

The audit inventories source observations, selected products/rate rows,
excluded rows and their reasons, detail-only products, failed/partial holders,
source fields, captured links, dates, duplicate/ambiguous keys, taxonomy gaps,
asset hashes, revisions, and consumer validation results. A provider attempt is
not the same as full successful product capture. Product record coverage is
`matched core product records / core products`; 100% does not certify that every
fee, clause, document or historical period is present. Public asset integrity
and document semantic completeness are separate acceptance measures.
