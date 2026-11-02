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

Observation days use `Australia/Hobart`, independently of device timezone. When `coverage.observed_at` is a timestamp, retain its exact original bytes and compare its Hobart calendar day, not its UTC date prefix, with `observed_on`. For example, `2026-11-02T14:00:00Z` belongs to observation day `2026-11-03`. Timestamps require an explicit UTC/offset zone and a valid calendar date and clock; daylight saving is resolved through the IANA timezone. The legacy date-only alias remains a civil day. Never rewrite timestamps to make admission pass.

Affected providers must be nonempty, uniquely identified and registered with unknown membership. Source URLs are HTTPS without credentials or fragments; they are evidence references, not fetched by this parser. Current rate rows matching an affected provider ID or name reject the entire candidate, retaining the previous verified edition with its original date. Never merge old Wise rows into the new edition or advance dates on retained rows. Historical entries remain historical and Saved entries retain their existing publication provenance; neither is evidence of current availability.

The initial consumer contract is restricted to legacy core-row pricing. Any present `manifest.public_rate_catalogue` capability rejects a subset edition at refresh, cached-load and live/historical audit acquisition, including falsy malformed values. That capability can synthesize additional current offers absent from core rows, so it requires a separately agreed population reconciliation before support can be enabled. This does not remove that capability from existing complete publications.

## Consumer behavior

The shared core-normalization boundary validates downloaded and cached candidates. The root disclosure is non-dismissible and outside route scrolling, including Rates, Saved, Market, product, comparison and audit routes. It shows Partial, Observed products, observation date, published subset counts, Total population Unknown, Missing products Unknown and each affected registered provider's unknown membership. Provider success counts cannot override partial status. Search PDF/XLSX snapshots retain the typed assessment, with facts in Summary and Coverage. Health audits warn with unknown population metrics and retain exact provider/source evidence locally; public audit metrics keep scope/counts without publishing arbitrary provider evidence.

## Delivery compatibility — blocking prerequisite

Existing versionless and installed clients ignore unknown coverage fields and can label successful-provider counts Complete. `app_min_version` alone is insufficient. Do not put observed-subset bytes, head pointers or dates-index entries on any legacy URL, rolling tag, cache key or immutable tag that those clients can discover.

The candidate mechanism is implemented in `mobile/src/data/observedPopulationChannel.ts`. Its discovery function requires the exact capability `observed-population-v1`; absent, unknown and version-only values fail before issuing a request. The existing default app still uses the unchanged legacy channel. Candidate errors never retry a legacy URL. No redirect or fallback may cross from legacy to subset. Every optional asset and historical-index lookup must stay within its admitted edition; an HTTP cache must never share capability variants. A version header without a partitioned cache and complete route isolation is not sufficient.

This PR deliberately does not enable the capability or change any URL. Before activation, producer and consumer owners must agree exact URLs/negotiation and exchange one immutable candidate with verified manifest/core/details/hash evidence. Test versionless, old-version, unknown-capability, new-capability, offline cached, rollback, interrupted-download and mixed-edition cases. Confirm the old requests still resolve only the last verified complete legacy edition, while capable requests display the partial disclosure and exclude Wise from current rows. Preserve the original observation date of the legacy edition. Only then coordinate app release and feed activation; absent proof, publication remains blocked rather than manufacturing completeness.

## Concrete candidate discovery boundary

| Purpose | Exact identity |
| --- | --- |
| Repository | `yanniedog/AR-local` |
| Candidate index | `https://github.com/yanniedog/AR-local/releases/download/app-payload-observed-v1-candidate/dates-index.json` |
| Immutable edition tag | `app-payload-observed-v1-YYYY-MM-DD-rNNNNNN` |
| Immutable manifest/assets | `https://github.com/yanniedog/AR-local/releases/download/<immutable edition tag>/<asset name>` |
| Opened transport | `https://ar-app-data.jkokavec.workers.dev/v1/capabilities/observed-population-v1/release/<candidate or immutable tag>/<asset name>` |
| Candidate metadata cache key | `ar-rates:observed-population-v1/<immutable edition tag>/<raw manifest SHA256>` |

The mutable candidate tag serves only `dates-index.json`; there is no mutable candidate manifest alias. Immutable asset names use the existing JSON/gzip/encrypted-JSON naming grammar, no path traversal, query strings, fragments or credentials. The injected transport must enforce the supplied streaming byte ceiling, reject non-2xx and reject redirects. Discovery caps the index at 1 MiB and manifest at 4 MiB and checks the returned UTF-8 byte size too. It never decrypts using an app/device secret or writes to the legacy payload store.

The candidate index has exactly `schema_version: 1`, `channel: "observed-population-v1"`, `revision_protocol: 1`, sorted unique `dates`, accurate `count`, `min_date`, `latest_date`, and `revision_heads`. Every listed day requires a head. Head fields retain the existing exact names: `revision`, `generation_id`, `manifest_url`, `manifest_sha256`, `bundle_sha256`; manifest URLs must use the candidate immutable namespace. Revisions are 1–999999. Legacy `parseDatesIndex`, default revision validation and `trustedPayloadReleaseUrl` reject these heads/tags without any app-version check.

Candidate manifests additionally require `consumer_contract: "observed-population-v1"`. Generate the existing canonical bundle digest after adding that field and rebasing all asset URLs; then bind the exact manifest bytes with the head SHA256. Admission recomputes the bundle digest, validates the raw manifest hash, date, revision, generation, required files, immutable asset URLs and detached history URL. Optional URL-free descriptors remain bound by the manifest hash/bundle digest. Existing legacy validator callers default to the legacy namespace; only the explicit candidate client supplies the candidate channel argument.

`observedPopulationCacheReceipt` / `restoreObservedPopulationSelection` preserve a separately keyed metadata receipt and revalidate hashes, marker, namespace and rollback on offline read. This is a discovery receipt, not permission to install unverified core/details bytes. Interrupted discovery has no storage mutation and leaves the installed selection untouched. The now-implemented `createNativeObservedPopulationAdoption` factory validates every supported required asset and population assessment, persists exact bytes in its isolated namespace and commits an alternate verified head before store adoption. Current app startup/config/refresh does not invoke it. See [candidate adoption and remaining gates](OBSERVED_POPULATION_ADOPTION.md) for the native adapter, audit integration, failure tests and strict capability limits.

### Producer-owned changes and proof

1. Build the candidate in the immutable namespace above; include the population assessment and consumer marker, omit affected-provider current rows, and recompute counts and both digests. Preserve source failures and accounting facts.
2. Add the dedicated capability transport path. Its allowlist accepts only candidate tags; the existing `/v1/release/` route must reject them. Unknown capability paths reject. Cache by the full capability path plus immutable tag/asset; do not select bytes by an app-version header or share a cache key with legacy routes.
3. Stage the immutable edition first and publish its candidate index last. If using GitHub releases, mark candidate releases as prereleases and do not mark them latest. Do not place candidate pointers in legacy manifest/index assets, immutable legacy tags, optional descriptors, redirects or generic latest aliases.
4. Supply raw manifest/core/details bytes, their exact digests, the candidate index and evidence of official register/provider identity mapping. Consumer tests then validate real bytes in addition to the synthetic protocol fixture.
5. Before activation, produce HTTP receipts for legacy/versionless requests, version-only requests, unknown capability requests and explicit candidate paths. Record final URL, status, redirect behavior, cache identity and body hash. Legacy requests must retain their old edition/hash/date; candidate requests must bind the new subset. Test a cold cache and an already populated shared proxy cache in both request orders.

The app-side compatibility matrix is executable in `observedPopulationChannel.test.ts`. It covers default legacy rejection, absent/version-only/unknown capabilities, exact URLs, index reconciliation, altered manifest bytes, cross-edition assets, consumer marker, bundle digest, offline receipt isolation, rollback, cancellation and no legacy fallback. These tests prove the consumer boundary; they do not prove a service route that has not yet been implemented or exercised.

For the producer's private fixture, run `cd mobile && node scripts/verify-observed-candidate.cjs <directory>`. The directory must contain `dates-index.json`, exact `manifest.json` bytes and every `manifest.files` asset using its declared filename. Supply service-opened domain bytes, not encrypted release transport; the verifier never reads credentials, decrypts, fetches, installs or publishes. It checks hashes/lengths, decoded dates, population assessment, affected-provider exclusion and details coverage. Its JSON receipt explicitly leaves publication, service isolation and runtime verification false. Detached optional capabilities still require their existing specialised validators before activation; this utility's success covers only the listed manifest files and candidate-discovery boundary.

## Remaining limits

This contract does not resolve Wise's contradictory source evidence or certify source membership. It does not fix the producer's publication by itself. The authentic November 3 candidate passes private listed-asset verification after correcting the Hobart observation-day comparison; its timestamp and all archive entries remain unchanged. Deeper adoption validation found missing required `generated_at` and `schedule` manifest fields, so full adoption rejects the original fixture. A corrected new immutable producer revision and hosted channel-isolation proof remain prerequisites. The consumer adoption implementation is dormant pending those gates. Android/Hermes runtime validation remains separate from focused tests; prior local ADB socket error 10013 has not been bypassed.
