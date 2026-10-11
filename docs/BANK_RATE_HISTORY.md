# Bank rate history

## Prepared data is the mobile contract

The app consumes `manifest.bank_rate_history_ready`. AR-local runs the pinned
app compiler before publication; the phone does not classify historical product
descriptions, merge raw tiers, or rebuild missing history from dated core files.
A publisher without this capability uses the signed app's prepared fallback.
Raw schema-2 and `ar-history-dag-v1` catalogues remain compatible producer/tooling
assets for older apps. They are not the new mobile preparation path.

The ready projection contains preclassified bank cohorts, sparse changes to exact
rate-frequency distributions, product-best rate spans, and original dated source
receipts. Cohorts preserve every structural profile dimension, broadly available
eligibility, unknown-evidence state, and curated feature predicate. Full rate
multiplicities preserve exact minimum, maximum, mean, median and count; cohort
means are never averaged. Savings excludes explicit term deposits. Required
features and broad availability fail closed when dated evidence is unknown.

The phone applies the user's filters to those cohorts and aggregates all banks
once. Bank selection reuses the result. Profile changes reuse the prepared input;
identical refreshes reuse the resulting chart model. Today's observations still
use original current-core rows and the live mandatory eligibility gate.

The verified fallback covers 134 observed dates across 137 calendar days, from
13 May to 26 September 2026. The build-time compiler reduces 44,044 tier
descriptors and 8,199 evidence records to 4,672 cohorts and 3,175 product series.
The prepared JSON is about 2.62 MB and its gzip about 280 KB. May 14, June 26 and
September 23 are gaps. Dates after the fallback's coverage also remain gaps until
verified prepared data supplies them; no rate is carried across a missing date.

## Producer and offline recovery

The URL-free capability is `{schema_version: 1, file: {name, bytes, sha256, enc?}}`.
The filename is `bank-rate-history-ready-YYYY-MM-DD-<sha12>.json.gz[.enc]`.
The app derives the delivery URL from its allowlisted repository and validated
release tag. The descriptor remains bound by canonical payload identity when a
release is retagged; it cannot borrow routing from another alias.

The outer gzip contains `{schema_version: 1, run_date, core_sha256, catalogue}`.
`catalogue` is `{sha256, bytes, gzip_base64}`. Its independently verified inner
JSON follows the contract in
[`mobile/contracts/history-ready/README.md`](../mobile/contracts/history-ready/README.md).
The outer asset is limited to 1 MiB, its decoded envelope to 2 MiB, and the inner
projection to 4 MiB. Invalid sizes, hashes, base64, dates, source receipts,
frequency conservation, semantic revision or compiler digest reject the asset.
The original authenticated transport bytes are cached separately from core data.

Producer observations keep their selected-contract or retained-export identity.
Public observations must match the independently selected publication revision.
The greatest known revision is retained per date; equal-revision conflicts remove
that date until resolved. A partial primary projection may use accepted public
observations from the signed fallback. Overlapping sources cannot double-count
a date. Product histories use the same prepared source masks and preserve their
independent provenance. A missing projection never triggers bulk dated-core
fetches, including during a local audit.

Verified public observations newer than the signed fallback are retained in a
separate bounded prepared checkpoint. This compacts classified frequency events
and product spans only; it never reopens raw descriptions or evidence. Partial
later payloads cannot erase those dates across restart. Superseded editions are
removed, revision high-water receipts survive compiler upgrades, and independent
producer observations never carry across core bindings. Unchanged checkpoints
reuse their validation receipt and are not re-encoded. A complete public source
retains the producer's exact verified compressed archive, avoiding another
compaction, serialization and compression pass on the phone. Partial sources
are compacted once with disjoint date masks. Capacity or write failure
preserves the previous file and records the recovery limitation.

## Startup and refresh

Preparation starts after the current screen paints. Native Android gzip and
history SHA-256 run off the JavaScript thread. Current-core content hashing uses
the native crypto implementation, preserving the exact JSON and UTF-8 digest.
Large JSON assets decode into bounded text chunks to avoid simultaneous complete
Java byte and character buffers. Verified optional assets are normalized once
and reused after installation. The remaining bounded work yields through
React Native's runtime scheduler; runtimes without it retain an asynchronous
timer fallback. Explicit paint, navigation and interaction waits are unchanged.
Capable browsers use DecompressionStream and WebCrypto; the bounded portable
codec remains available.

Newer requests supersede older owners without clearing a successor's loading
state or installing stale results. Identical verified assets share in-flight
work. Local audits read verified caches and the signed prepared fallback without
starting history downloads. Unavailable dates stay visibly unknown.

## Performance and verification

The acceptance budget is **five seconds of payload processing after asset bytes
are available**, including current-core verification, JSON decoding, optional
asset normalization, suitability classification, history preparation, profile
results, product history construction and cache byte conversion. Network latency
and persistent disk latency are recorded separately. A history-only measurement
does not satisfy the combined budget. A Node result is a regression proxy and must not
be presented as Android acceptance. Android acceptance uses a release Hermes
build with real observations and records input/progress responsiveness.

The 11 October 2026 release-Hermes test on an Android API 36 x86_64 emulator
processed the exact current immutable assets and prepared producer candidate
in **4.166 s**: 2.194 s for current core, details, optional assets and suitability,
plus 1.971 s for history, profile results, the complete product ledger and cache
serialization. Identical warm history reused the ledger in 48 ms. The candidate
preserves 144 original source receipts across a 152-day calendar and constructs
363,582 product observations. All seven current asset decodes used the native
codec; the 35 MB details document completed within the normal Java heap. The
largest observed JavaScript heartbeat gap was 326 ms.

These are emulator measurements, not physical ARM-device acceptance. They
exclude network, persistent disk I/O, module initialization, React rendering,
notification comparisons and delivery. The earlier 2.292 s history-only result
does not represent combined payload processing. The earlier combined decoder
repair measured 5.059 s and failed the budget; removing fixed processing waits
and duplicate suitability work produced the passing result above. Native
measurements must accompany future substantial changes in catalogue size or
the consumer's processing path.

Run the canonical app checks with `cd mobile && npm run ci`. They include:

- reproducible compiler and prepared fallback checks;
- real-data history benchmarks in native-browser-codec and portable modes;
- exact raw-versus-prepared parity for every curated feature and observed profile
  dimension, including distributions, missing dates and product series;
- transport binding, source supersession, cancellation, cache and local-audit tests;
- the normal app tests, platform exports and artifact budgets.

`npm run verify:prepared-history` checks the compiler bytes/source receipts and
rebuilds the fallback for comparison. To intentionally update them, run
`node scripts/export-history-ready-compiler.cjs` and then
`node scripts/bundle-ready-bank-history.cjs`. The raw fallback builder still
independently verifies every source manifest, core/details receipt, descriptor,
rate multiplicity and dated evidence before a new baseline can be compiled.

The public payload auditor checks ready, packed and legacy capabilities
independently. Passing a local candidate audit does not establish publication,
APK delivery or acceptance on the user's physical phone. App and producer must
use the same pinned compiler; compiler changes require coordinated publication
and app delivery.

## Cloudflare payload delivery

Canonical manifests, URLs and revision identities remain the AR-local GitHub
`app-payload-*` releases. The app maps validated canonical URLs to the fixed
Cloudflare service at `https://ar-app-data.jkokavec.workers.dev/v1/release/`.
The service opens ARE2 release transport and returns the original domain bytes;
the app still verifies their exact sizes, SHA-256, generation and revision binding.
Device decryption keys are not needed for managed delivery. Legacy ARE1 assets
are hashed first, then opened by the service using `X-AR-Legacy-SHA256` for that
verified ciphertext identity. An unopened service response fails closed.

The Worker allowlists declared app assets only, including URL-free
`bank_rate_history_ready.file` and `bank_rate_history_catalogue_packed.file`.
Their canonical URLs are derived from the selected immutable manifest tag.
It returns their gzip bytes unchanged, without HTTP Content-Encoding inflation.
Preservation archives, source evidence, logs and keys are not app assets.

Historical index entries remain provenance receipts for prepared history. The
app downloads the selected current edition without fetching every old core.
The service supports native and browser clients. Audits reject redirects from
the exact service route and record canonical, requested and final URLs separately.
Existing canonical publication continues updating the managed route; no separate
public GitHub branch or new delivery marker is required.

Release automation checks the exact index, rolling and immutable manifest
bindings plus current core/details byte lengths and SHA-256 before allocating a
version, building a public APK and publishing it. Failed readback holds release;
artifact-only builds remain available. These checks do not inflate historical
catalogues or alter the processing performance acceptance contract above.
