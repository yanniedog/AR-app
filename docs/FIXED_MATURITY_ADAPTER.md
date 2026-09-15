# Fixed-maturity local adapter

The v7 fixed-aud-td-v1 adapter accepts only independently approved executable
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
eligibility tree. Other policies remain unavailable. Versions1–6 remain accepted
for their prior capabilities; fixed_maturity and local confirmation metadata require7.

The local form receives only source-defined customer questions. Scenario principal,
funding and maturity dates cannot be substituted by saved profile facts. Applicable
missing questions follow decisive eligibility branches; unavailable/not-applicable
answers remain unresolved and saved answers can be edited. Customer answers use
template-scoped keys and encrypted local storage. Amounts and dates remain local
form state. Nothing in this pipeline uploads customer inputs.

Confirmation is reported by the user, not verified bank evidence. Its timestamp,
amount, dates and withholding statement are bound into scenario and receipt under
localTdConfirmation. Source policy references remain separate. Results are always
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
not real product acceptance. The bridge records actual instantiated v7 inputs,
positive and refusal outputs, canonical hashes and executing source-file hashes.
