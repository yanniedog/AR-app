# Exact-row rate-condition disclosure

`ProductDetail.rateConditions` is an optional v1 producer envelope containing original rate/tier wording, raw document SHA-256, stable pointer-derived IDs, family and one-based rate ordinals. The consumer validates the producer bounds, fixed source-pointer grammar, unique IDs, consistent ordinal/pointer mapping and one root. Text is displayed verbatim, never parsed into balance bands, eligibility or calculation policy.

Selection uses only the chosen original core row's family and rate index. It requires the exact core object and its integrity digest, matching manifest core/details digests and run dates, and a verified details object. It never selects by rate value, term or compact-fact ID. Missing older envelopes, invalid records, stale generations and missing indices show explicit unavailable status rather than an unconditional-rate claim.

Fresh verified downloads bind their details object to the verified transport asset hash. Cached objects need a separate digest of their exact stored plaintext bytes, matching the stored asset identity. Old caches without that identity can retain legacy display, but cannot supply scoped conditions until a verified refresh. A stale or edited valid-JSON file cannot acquire provenance merely from adjacent cache metadata.

The product route and rate receipt use the same selector. Progressive disclosure presents full selected-row wording. Copy/share bank-call text includes that wording or its unavailable reason; comparative rows remain explicitly unassessed. The receipt retains raw document identity and publication asset hashes. No customer data is uploaded, and no executable bank adapter is activated.

Tests include the captured eight Macquarie Digital TD rows and their exact raw-byte hash. The four same-term alternatives have different balance-condition text; selecting row5 must show only its over-one-million wording. This is source-display evidence, not a live account offer or eligibility assessment.
