# Fixed-maturity local adapter

The current v8 fixed-aud-td-v1 adapter accepts only independently approved executable
assets bound to the adopted immutable edition and exact original TD core row.
The source generation comes from manifest.source_observation; a new packaging
revision is not a new source observation. An approval handle is created only by
verified index/shard transport. Every calculation rechecks the actual core object,
selected row and complete manifest identity; removed or changed approvals cannot
reuse a same-core result. No offline result is labelled current approval.

Source-neutral fixed_maturity supports AUD, ACT365fixed, explicit funded-inclusive
maturity-exclusive accrual, calendar-day maturity payout, no business adjustment,
noncompounding and independently reviewed complete-no-fees inventory. Present
published balance bounds must agree with reviewed principalBounds; those bounds
and their explicit inclusivity apply to the actual principal independently of the
eligibility tree. Other policies remain unavailable. Versions1–7 remain accepted for their prior engine capabilities. Historical v7
fixed_maturity input can replay its original confirmation shape. Current adapter
execution requires an independently approved v8 template; v7 is never upgraded
implicitly. Unknown future versions remain unsupported.

The local form receives only source-defined customer questions. Scenario principal,
funding and maturity dates cannot be substituted by saved profile facts. Applicable
missing questions follow decisive eligibility branches; unavailable/not-applicable
answers remain unresolved and saved answers can be edited. Customer answers use
template-scoped keys and encrypted local storage. Amounts, confirmed rates and dates remain local
form state. Nothing in this pipeline uploads customer inputs.

Confirmation is reported by the user, not verified bank evidence. Its timestamp,
amount, actual annual rate, dates and withholding statement are bound into scenario and receipt under
localTdConfirmation. The entered percent is converted with exact Decimal arithmetic
to a fraction (maximum12 decimal places); it must equal the selected template rate.
A differing bank-agreed rate refuses calculation, never changes the source template.
Source policy references remain separate. Results are always
before tax; no withholding must be explicitly confirmed for this bounded payout.
Early exit, rollover, variable rates, business-day adjustment, unknown fees/tax and
ambiguous templates are unavailable. Separate maturity results do not imply a
common full-horizon product ranking.

The product TD route loads approved assets only when opened. Missing assets expose
an unavailable state. Readable results and source references are progressive;
copying the full local receipt explicitly includes entered amounts/dates/relevant
answers. No engineering fixture is imported into the product flow, and no actual
bank template is activated by this implementation.

Technical fixture and cross-runtime bridge tests are protocol/arithmetic controls,
not real product acceptance. The bridge records actual instantiated v8 inputs,
positive and refusal outputs, canonical hashes and executing source-file hashes.


## Personal maturity comparison

The comparison route supplies the original selected TD rows to the same verified
transport and local input controls. Two to four approved offers can return separate
before-tax maturity results. Ranking requires every selected offer to be complete
and the same principal, funding date, maturity date, currency and reviewed tax/fee
scope. Differences use exact maturity payouts; tied returns share a rank. Unmatched
horizons stay unranked: no holding account or reinvestment rate is invented.

The comparison receipt binds adopted manifest, exact rows/templates, reference,
local confirmations, instantiated calculations and each child receipt hash. The
exported comparisonInputs is the exact canonical hash input: bounded edition
locators/hashes, original selected rows and scoped inputs; unrelated profile answers
are excluded. It is detached from later caller mutations. Changing a shared amount/date
clears confirmations; any input/profile/reference or adopted-edition change hides
previous results. Source clauses use the existing trusted external-link flow.
No current calculation template is available from an absent or historical-v7 asset.

This is a fixed-deposit comparison, not completion of the C010 portfolio user flow.
Mortgage, savings, package allocation and cross-account scenario assembly still
need approved executable product adapters and their own supported input flows.
No actual bank approval or real-data acceptance is conferred by technical tests.

The original v7 bridge fixture is byte-preserved. Replaying its v7 source contracts
under v8 preserves financial ledger, totals, eligibility, issues and old local
confirmation; the new execution receipt correctly uses the v8 runner identity
and a new input hash. It does not rewrite or claim byte identity with the old receipt.
