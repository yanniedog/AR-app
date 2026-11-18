# Product criteria and document sources

The optional `product_criteria_index` and `product_criteria_shard_NNN` files augment
the selected immutable financial payload. Both carry matching schema version 1 or 2, scope
`product-filter-facets-v1`, run date and the financial generation/contract binding.
Every routed product and shard must validate before global filtering adopts the
catalogue. Acquisition is lazy, bounded, shared and cancelled when unused. Missing
or failed enrichment does not prevent the financial payload from loading.

Single-product navigation acquires only the bound index and that product's shard;
comparison acquires only its selected product shards. Acquired shard routes and
facts/documents validate completely, but other products are discarded. The index
and in-flight downloads are shared, with an eight-product completed LRU cache and
nine pending requests per immutable edition. Only an opened/active global filter
acquires the whole catalogue; its retained lookup keeps facts, discarding new
document arrays after validation. The independent headless audit retains and
counts documents across the complete declared inventory.

Version 2 shards pool object-field names and repeated strings with canonical
base36 dictionary references. Original route keys and decimal lexemes are
unchanged; tilde-prefixed literals are escaped. The shipping app and headless
audit share a decoder that rejects duplicate/oversized tables, malformed or
noncanonical references, hostile object keys, excessive depth and node growth.
Decoded objects use null prototypes; pooled strings are reused without expanding
them into duplicated JSON text. The existing 32 MiB aggregate decoded-wire,
16 MiB compressed and 4 MiB per-shard wire ceilings remain unchanged. Separate
semantic growth bounds are 500,000 nodes per shard and 4,000,000 per catalogue.

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
