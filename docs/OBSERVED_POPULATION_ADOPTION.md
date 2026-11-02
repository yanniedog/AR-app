# Candidate asset adoption and remaining release gates

The dormant `createNativeObservedPopulationAdoption(capability, set, get)` factory now connects installed Expo streaming transport, bounded native binary storage, exact asset validation, accounting, suitability and one store transaction. No shipping startup, refresh action, feed or release opts into it. Activation must route subsequent refresh, startup and audit actions through this same candidate owner; legacy actions must not run concurrently after activation.

## Completed consumer path

- Capability remains exactly `observed-population-v1`. Missing/unknown capability fails before I/O; app version is checked independently and cannot grant channel access.
- `expo/fetch` streams only the exact dedicated capability routes, rejects redirects/non-2xx/changed final URLs, limits received bytes, supports cancellation and has a 60-second deadline. No key access, decrypt fallback or legacy retry occurs.
- The current supported edition contains exactly `core` and `details`. Unsupported optional files, detached histories, executable capabilities, public pricing and domain encryption fail before acquisition. Future support requires explicit validators; it must not silently drop capabilities.
- Required ordinary manifest fields remain required: explicit-zone valid `generated_at`, structured `schedule` with nonempty `label` and valid `next_due_utc` when supplied, and supported `app_min_version`. Financial counts, population dates, affected-provider exclusion, details coverage and existing accounting equations are checked before persistence.
- The native directory is `<app documents>/observed-population-v1/`, separate from legacy `payload/`. Exact compressed domain bytes are persisted in `edition-N/core.bin` and `edition-N/details.bin`; `selection.json` retains the verified index and exact manifest text. Native handles use bounded binary chunks, without huge base64 copies.
- Two bounded alternating `head-0.json` / `head-1.json` records bind sequence, candidate cache identity and checksum. All asset/receipt writes are read back before the alternate commit record is written. A torn alternate write leaves the prior committed edition available. A valid committed record with corrupt/missing assets fails closed rather than silently selecting older data. Two committed editions are retained; cleanup touches only that owned candidate directory.
- Commit operations share a queue per storage adapter. The native adapter is a singleton. Date rollback is rejected even from an unrevisioned installed edition; revision rollback/equivocation is rejected within the existing manifest rules. Cancelled or superseded requests cannot publish to the store.
- Offline restoration revalidates the original manifest, every persisted asset hash/length, schema/date, counts and population facts. It does not trust decoded cache objects.
- Suitability is rebuilt from the exact validated core/details pair before one synchronous store update. Details provenance is bound to its descriptor hash. Legacy optional assets are cleared, user input/preferences/saved state are preserved, and partial/unknown coverage persists. Failed refresh leaves the usable edition intact.
- `auditSnapshot()` supplies the current candidate snapshot and explicit candidate source contract. `readLiveAudit()` acquires and validates without cache or store mutation. The default legacy audit contract continues to reject candidate tags; no default source is broadened.

## Authentic fixture: a second producer defect

Archive SHA256: `ed218cc09de20ea09b5950c5d890d58093eb0c5949cf355003829f2533c07bd1`.

The Hobart timestamp fix and private listed-asset verification still pass unchanged: 2,795 published products, 16,117 published rates, 103 providers. Existing accounting explains 156 excluded source rates and 135 source products without published rates. The original observation instant remains `2026-11-02T14:00:00Z`.

Full adoption now additionally checks the ordinary app manifest contract. The authentic `r000001` manifest has **no `generated_at` and no `schedule`**. The initial verifier deliberately covered listed-asset bytes and population facts, not complete installed-app readiness. The integration test now asserts rejection before asset downloads/cache writes or visible-state changes. Do not rewrite the original archive or invent its timestamps.

Producer action: supply a new immutable revision/index receipt with source-backed manifest generation time and actual schedule metadata, retaining the original rejected fixture and its hashes. Recompute exact manifest/head/bundle hashes as required. Any later prepared-history capability must use the current compiler pin and receive an explicit candidate validator before adoption supports it.

## Precisely required hosted proof

The producer owns route deployment and HTTP receipts. Its separately denied PR1060 correction push is not retried or worked around by this consumer task.

1. Candidate discovery endpoint: `https://ar-app-data.jkokavec.workers.dev/v1/capabilities/observed-population-v1/release/app-payload-observed-v1-candidate/dates-index.json`.
2. Candidate immutable endpoint pattern: `https://ar-app-data.jkokavec.workers.dev/v1/capabilities/observed-population-v1/release/app-payload-observed-v1-YYYY-MM-DD-rNNNNNN/<asset>`. Verify the new candidate's exact index, manifest, core and details bytes and hashes. Never mutate the already supplied immutable revision to fix metadata.
3. Legacy control endpoints: existing `/v1/release/app-payload-latest/manifest.json` and `/v1/release/app-payload-latest/dates-index.json`, plus selected legacy immutable assets. Versionless, old-version and version-header-only requests must retain the verified complete edition's exact body hash and original observation date.
4. Cross-channel/unknown-capability requests must reject: candidate tag through `/v1/release/`, legacy tag through the candidate capability route, and `/v1/capabilities/observed-population-v2/...`. No redirect may cross the boundary.
5. Required artifact: a producer-owned JSON HTTP receipt with deployed worker commit, UTC request time, request/final URL, status, redirect chain, capability/version headers, cache key or equivalent verifiable cache identity, response hash and edition date for every case. Exercise cold caches and warmed caches in both legacy-first and candidate-first order. Include the exact canonical legacy feed hashes before/after; those must be unchanged.

Consumer tests can and do finish without these endpoints: strict metadata and byte validation, fake-stream route/limit/cancellation cases, adapter path/chunk boundaries, interrupted writes, offline reads, rollback, competing requests, store/suitability adoption and candidate audit contracts. Mocked storage/network tests do not substitute for the hosted receipt or an installed Android run.

## Android/Hermes limit

Installed `hermesc.exe` advertises `-exec` in help but actually returns `hermesc does not support -exec`. It is a compiler, not an executable Hermes host. Compilation after the existing Expo/Babel Android transforms can establish syntax compatibility only. Native Android file handles, streaming fetch, Intl timezone behavior and full UI/runtime acceptance still require a supported installed Android runtime. No ADB retry or workaround was attempted for the previously recorded daemon socket error 10013; no security settings, software installations, visible apps or Pi state were changed.
