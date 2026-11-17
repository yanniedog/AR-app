# Product criteria and document sources

The optional `product_criteria_index` and `product_criteria_shard_NNN` files augment
the selected immutable financial payload. Both carry schema version 1, scope
`product-filter-facets-v1`, run date and the financial generation/contract binding.
Every routed product and shard must validate before global filtering adopts the
catalogue. Acquisition is lazy, bounded, shared and cancelled when unused. Missing
or failed enrichment does not prevent the financial payload from loading.

The compact scope contains product features, eligibility, constraints, fees,
bundles and conditions. Scoped rate/tier rows remain in the core detail and full
normalized source evidence; compact route completeness does not mean complete
legal extraction or complete source-field coverage.

Filters use canonical identities, exact decimal strings, units and fee cadence.
Conditional, conflicting, unavailable and incompatible evidence remains Unknown.
Comparison rows retain separate scopes and billing periods. Legacy curated feature
semantics remain authoritative; an identical optional copy may add only an original
source pointer. Compacted CDR pointers cannot match original-response references.

Document actions use product-specific source associations and retain independent
specificity, applicability, retrieval status and dates. Declared/captured links do
not establish verified applicability. Provider homepages are background evidence.
The document panel exposes URL filenames and paginated citation associations;
fact actions open their own matching page/source reference. Existing external URL
admission remains in force. Unsupported destinations remain visibly unavailable.

`audit-public-payload.cjs` reports optional criteria acquisition, current source,
route counts, facet kinds/evidence states and document classifications separately
from unchanged base-detail metrics. Legal completeness, source-field completeness
and rendered coverage remain unverified. Retained captured fixtures validate the
wire and consumer behavior; current public catalogue, runtime, APK and device
acceptance require separate evidence after producer rollout.
