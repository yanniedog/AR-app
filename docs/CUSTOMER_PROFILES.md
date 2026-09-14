# Private customer inputs

Profile and product document disclosures expose **Private customer inputs** in
the installed app. Values use the existing encrypted, device-only SecureStore
helper. The web surface does not read or write them. Customer values, negotiated
notes and legacy scenario snapshots are never sent to the terms transport,
telemetry or evaluator runtime diagnostics.

The versioned profile separates known typed answers from unknown, unavailable
and not-applicable answers. Known decimal zero and boolean false are preserved.
Each answer records user-input provenance; negotiated terms additionally require
the exact product reference and retain entered units, agreement notes and explicit
or unknown effective dates. Negotiated entries do not overwrite published terms
and do not authorize eligibility or complete-cost claims.

## Migration and recovery

The first successful load copies the exact previous scenario into the new
encrypted envelope, retaining the original storage record. Only documented fields
receive typed units. Legacy boolean defaults remain unknown because their original
intent cannot be recovered. Original timestamps are never invented. Existing
calculators continue to use their original scenario; subsequent edits are separate.

Migration and updates serialize operations and verify destination readback.
Corrupt, incomplete or future-version profiles fail closed without rewriting the
record. Customer reads explicitly disable the existing helper's destructive
incomplete-generation recovery. A failed write can be retried; negotiated-entry
IDs remain stable across uncertain-write retries. No automatic reset is offered.

## Reviewed question contracts

`customerInputRequirements` accepts explicit bounded AND/OR/NOT/comparison rules
and labelled, typed input definitions with declared decimal units, product binding,
effective dates and a revision identity. Unsupported syntax, missing definitions,
invalid types or scope produce **pending contract**, with no inferred questions.
Decisive OR/AND branches suppress irrelevant questions. Unavailable/not-applicable
answers remain unresolved, separately visible, and never become eligibility passes.
The assessment date is an explicit editable calendar day, initially the device's
local day; it does not infer a bank's assessment-window convention.

The reviewed adapter registry currently returns no contracts. Real products
therefore remain unassessed while private negotiated notes and saved-input review
work now. Neither terms acquisition status nor interpretation-stage flags can
populate this registry. Enabling an adapter requires separately reviewed complete
rule/input definitions and their source/benchmark binding. The UI's completed-input
message is not approval or an offer.

## Verification boundary

Focused migration, storage, rule and UI tests cover preservation, unsupported and
future versions, interrupted writes, zero/false, branch relevance, local dates,
draft retention and idempotent negotiated-term retry. Native encrypted persistence
and visual acceptance still require a newly built APK; the earlier d0a9b422 APK
does not contain this feature. C-003 stays in progress until those acceptance
checks and reviewed product-contract availability are established.
