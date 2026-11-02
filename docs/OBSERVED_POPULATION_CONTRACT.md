# Observed population contract — proposed v1

Status: consumer preparation only. Canonical AR-local payload feed and AR-app release feed are unchanged. Producer agreement, delivery isolation and fixture reconciliation remain release prerequisites.

`coverage.population_assessment` is optional for legacy complete publications. When present it must be exactly:

```json
{
  "schema_version": 1,
  "scope": "observed-products",
  "observed_on": "2026-11-02",
  "total_population": null,
  "missing_product_count": null,
  "observed_counts": { "products": 123, "rates": 456, "providers": 12 },
  "affected_providers": [{
    "provider_id": "<exact canonical provider identity used by rate rows>",
    "provider_name": "<registered provider name>",
    "register_status": "registered",
    "membership_status": "unknown",
    "reason": "register-endpoint-conflict",
    "missing_product_count": null,
    "register_url": "https://<official-register-evidence>",
    "endpoint_url": "https://<bound-provider-endpoint>"
  }]
}
```

The counts above are illustrative, not observations. `provider_id` must be the exact `RateRow.provider` identity, not a newly invented ID. If register identity differs, producer resolves it to that established identity; `provider_name` preserves the official registered name. Both names are checked case-insensitively after Unicode normalization. Producer must prove there are no unlisted aliases carrying affected-provider rates.

All keys are required and unknown keys/versions fail closed. Explicit null is not field absence. Total population and missing-product counts must remain null, never zero. The observation date is a valid calendar day equal to the core run date (and coverage observation date when present). Nonnegative safe-integer observed counts reconcile exactly to raw published rate rows, distinct product keys and distinct provider identities before app quarantine. These are the published observed subset, not all source products, a registered-population denominator or a source-completeness percentage. Existing payload-accounting equations/exclusions remain independently required and unchanged.

Affected providers must be nonempty, uniquely identified and registered with unknown membership. Source URLs are HTTPS without credentials or fragments; they are evidence references, not fetched by this parser. Current rate rows matching an affected provider ID or name reject the entire candidate, retaining the previous verified edition with its original date. Never merge old Wise rows into the new edition or advance dates on retained rows. Historical entries remain historical and Saved entries retain their existing publication provenance; neither is evidence of current availability.

The initial consumer contract is restricted to legacy core-row pricing. Any present `manifest.public_rate_catalogue` capability rejects a subset edition at refresh, cached-load and live/historical audit acquisition, including falsy malformed values. That capability can synthesize additional current offers absent from core rows, so it requires a separately agreed population reconciliation before support can be enabled. This does not remove that capability from existing complete publications.

## Consumer behavior

The shared core-normalization boundary validates downloaded and cached candidates. The root disclosure is non-dismissible and outside route scrolling, including Rates, Saved, Market, product, comparison and audit routes. It shows Partial, Observed products, observation date, published subset counts, Total population Unknown, Missing products Unknown and each affected registered provider's unknown membership. Provider success counts cannot override partial status. Search PDF/XLSX snapshots retain the typed assessment, with facts in Summary and Coverage. Health audits warn with unknown population metrics and retain exact provider/source evidence locally; public audit metrics keep scope/counts without publishing arbitrary provider evidence.

## Delivery compatibility — blocking prerequisite

Existing versionless and installed clients ignore unknown coverage fields and can label successful-provider counts Complete. `app_min_version` alone is insufficient. Do not put observed-subset bytes, head pointers or dates-index entries on any legacy URL, rolling tag, cache key or immutable tag that those clients can discover.

Proposed rollout: producer publishes a separately named candidate channel, isolated head/index/manifest/assets and matching transport/cache namespace, gated on the explicit capability `observed-population-v1`. New consumer opt-in must select this channel explicitly and validate the same revision/hash/date bundle invariants. Missing, unrecognized or version-only capability requests use the unchanged legacy channel. No redirect or fallback may cross from legacy to subset. Every optional asset and historical-index lookup must stay within its admitted edition; an HTTP cache must never share capability variants. A version header without a partitioned cache and complete route isolation is not sufficient.

This PR deliberately does not enable the capability or change any URL. Before activation, producer and consumer owners must agree exact URLs/negotiation and exchange one immutable candidate with verified manifest/core/details/hash evidence. Test versionless, old-version, unknown-capability, new-capability, offline cached, rollback, interrupted-download and mixed-edition cases. Confirm the old requests still resolve only the last verified complete legacy edition, while capable requests display the partial disclosure and exclude Wise from current rows. Preserve the original observation date of the legacy edition. Only then coordinate app release and feed activation; absent proof, publication remains blocked rather than manufacturing completeness.

## Remaining limits

This contract does not resolve Wise's contradictory source evidence or certify source membership. It does not fix the producer's publication by itself. There is no candidate producer fixture or demonstrated channel isolation yet. Android/Hermes runtime validation remains separate from focused tests; prior local ADB socket error 10013 has not been bypassed.
