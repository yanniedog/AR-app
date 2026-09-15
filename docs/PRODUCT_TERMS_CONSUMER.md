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
Both history caches retain `revision_high_water` independently of chart dates.
Cache readers migrate earlier verified source identities before trimming the
renderable axis. Failed refreshes, omitted index dates and a raised history
floor cannot erase this rollback barrier; only acquired revisions advance it.
The barrier alone never authorizes reuse of missing values or a current core.
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

## Scoped comparison and saved descriptive evidence

The actual comparison route lazily aligns canonical parameter keys only when unit
and all applicability dimensions match exactly. Unknown dimensions stay separate
per product; missing cells remain unknown. Multiple revisions in a cell are shown
without picking a price. Thirty groups are initially exposed, with explicit further
pages; every supplied revision remains reachable with its clause and source link.
This view performs no eligibility or fee calculation.

Successfully verified descriptive terms may be retained in two fixed 2 MiB slots
(maximum 4 MiB on disk), each containing at most sixteen records of at most 256 KiB.
Serialized replacement writes the inactive slot and checks readback, preserving the
previous complete slot through interruption. Reload revalidates the envelope digest,
terms schema and terms content digest. Oversized references are not retained; the
current verified view remains usable. These are local corruption checks, not signatures.

On unavailable acquisition the disclosure can show the saved matching bundle/index,
or an explicitly older publication, with exact edition and date. Saved data is labelled
as not reverified by that request. It is never returned by current executable transport,
never grants approval, and contains no customer inputs. Failed/corrupt replacements
do not destroy the previous valid descriptive reference.
