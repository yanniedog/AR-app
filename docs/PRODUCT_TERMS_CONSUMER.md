# Product evidence consumer

The optional `files.terms_index` manifest descriptor selects a small immutable
index. Each indexed product points to its own hash- and size-bound evidence
asset in the same release. Product and comparison screens acquire it only when
the document disclosure opens. Rates remain usable when document analysis is
unavailable; the screen shows that limitation explicitly.

`mobile/src/data/productTerms.ts` matches the producer's version 1 public
document evidence contract. It validates document/clause/revision references,
scope, reviewed status, exact stage denominators and safe integer metadata.
Financial quantities remain decimal strings. The content identity is computed
from Unicode code-point-sorted JSON with `identity_sha256` omitted. Document
bytes and the full private extraction corpus are not included in the app.

`productTermsTransport.ts` verifies both transport and canonical content hashes.
It caps compressed and inflated bytes, rejects assets from other releases and
caches at most two indexes and sixteen product assets in memory. A changed
bundle/index/product identity forces acquisition. The disclosure drops late
results after its selected generation changes. The cache contains no customer
profile or model prompt.

Evidence is not an executable calculation contract. `validated` means the
producer reviewed a source-bound term; it does not prove a calculation pattern
or that a particular customer meets a rule. Null tier, package, cohort or
effective dates are unknown. Existing user scenarios remain unchanged.

Historical product cache version 3 retains every downloaded catalogue and its
per-date publication identity. It migrates old catalogue-restricted caches
progressively, one heavy core at a time, with durable checkpoints. It pins one
index during each sync, refetches corrected dates and refuses lower/equivocating
historical revisions. Newly fetched snapshots replace stale values even when a
former product is absent. Zero rates remain zero, and chart gaps remain unknown.
The series still represents each product's section-best published rate; it is
not a complete tier ledger or proof that the rate applied to a customer.

Comparison includes every reported fee, feature, eligibility item and constraint
behind named disclosures. Rich fee rendering retains amounts, rates, bounds,
caps, discounts and discount conditions. Reported counts do not establish
document completeness. The app health record-coverage check makes that scope
explicit. Actual retained Bankwest and The Mac fixtures verify disclosure
behavior; protocol-only fixtures test invalid references, hashes, scopes and
publication changes without claiming real bank analysis acceptance.

The legacy stay/switch monthly model retains entered and recognized fee amounts,
interest projections and known-cost subtotals. It cannot set costClaimsAvailable
until a reviewed adapter establishes complete material terms, customer
applicability and a supported evaluator. Six resolved fee inputs therefore do
not enable total-cost savings or break-even claims.
