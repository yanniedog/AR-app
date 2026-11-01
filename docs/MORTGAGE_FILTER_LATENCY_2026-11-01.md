# Mortgage filtering on the current public payload

The user reported more than 30 seconds of skeleton rows after entering 650000,
72% LVR, Owner occupied, Principal & interest and Advertised rate. These are
reproduction inputs, not established personal financial facts. The screenshot
does not establish the installed build.

## Confirmed cause and change

Production source `7ffb7daf` (APK 1.0.257/build 313) only prepared the fast
mortgage index for a complete public-pricing catalogue. The verified October 31
payload has 8,113 mortgage rows and **no** `public_rate_catalogue` capability.
Consequently the fast path never ran for that publication. Changed inputs
rescanned every row; each sibling rate revalidated the whole product condition
envelope, including all source-pointer SHA-256 identities.

The index now also prepares fixed legacy core rows before filter selection.
Current amount/LVR predicates, source bounds, uncertainty, facets and sorting
still determine membership. A declared catalogue that is unavailable, loading,
failed or missing from an audit cache cannot use this legacy path. The path also
requires a present manifest, matching core integrity and an absent capability;
explicit malformed values (including null/false/zero/empty string) are rejected. Source,
context and eligibility replacement revoke the index immediately.

Cooperative preparation validates a product envelope once within a synchronous
batch while preserving every row's provenance check. It retains no validation
cache between batches, so subsequent mutations must pass validation again.
Preparation yields between product batches, and cancelled/obsolete work cannot
install its results. The ordinary cooperative fallback uses this preparation
too. No data URL, timing budget, financial admission rule or loading label was
weakened.

## Measured data-pipeline latency

Windows x64, Node 24.12.0, Jest/React Native test environment. These measurements
start with the verified core/details already parsed in memory. They exclude
download, app boot, the existing 200 ms typing debounce and graphical commit.
They are not Android/Hermes or physical-device measurements.

| Operation | Baseline | Fixed |
| --- | ---: | ---: |
| Cooperative scope plus filtering/sorting | 19,433 ms | 1,328 ms |
| Scope portion | 19,012 ms | 915 ms |
| Fresh derived index preparation | Unsupported | 1,794 ms |
| Prepared selection and filtering, 12 repeats | Unsupported | Median 22.0 ms; range 17.5–28.0 ms |

Both versions return 686 rows. The final indexed and cooperative results were
compared with the unchanged synchronous canonical scope/filter/sort oracle,
including exact row order and advertised rates. The ordered result hash is
`2c16ce7acfc55dbe3a8130c75067541847c68b5189ed3d16d808782b00d43f01`.
Raw samples, payload hashes, production-source hashes and the reproduction
harness are in [the evidence directory](evidence/mortgage-filter-2026-11-01).

Rendered workspace tests cover cold pending state, same-render warm edits,
rapid amount/LVR changes, no matches, no repeated details loads, valid rows
during refresh of the same source, and invalidation on source replacement.
Hook tests hold obsolete preparation until after the new source completes and
verify that it cannot overwrite the current index. Boundary/provenance tests
compare with the canonical pipeline and reject stale or corrupt evidence.

## Remaining limits

The subsequent user report identifies APK 1.0.257/build 313 and a completed audit
with 135 performance failures, including six step-limit failures. Four timeout
checks wait on mortgage scope/search readiness. It also records a pre-audit
32,052 ms cached-details read/validation stage; this is wall time, not a CPU
profile or a direct measurement of the screenshot's filter wait. The report's
34,438 ms bank-history preparation includes waiting for product details and must
not be added as an independent 34-second CPU cost.

The Android details reader previously performed Base64 conversion, strict UTF-8
validation and UTF-8 decoding for all 35 MB on JavaScript. New APKs use bounded
256 KiB native file/UTF-8 reads on the existing background module queue, avoiding
Base64 entirely. JavaScript still joins/parses the text and verifies its exact
content receipt. Old APKs retain their bounded reader; native errors never retry
the unbounded reader. Canonical app-private paths, byte limits, strict Unicode,
post-read file checks and assembled-content integrity remain enforced. Separate
read/parse/verify stages and per-chunk checkpoints now expose remaining costs.
The native host-JVM test preserves a 35,247,100-byte Unicode fixture under a
32 MiB heap with compact strings disabled, and covers 36 validation assertions.
This is implementation evidence, not an Android cold-start latency claim.

Cold preparation and the typing debounce remain real costs; this report does
not claim every cold result is instantaneous. No native timing, input-to-frame
or screenshot acceptance was obtained. Previously attempted Android app launches
timed out, and ADB startup failed with socket error 10013. No security/network
setting was changed. A new on-device audit is still needed to establish which
of the reported timing failures are resolved.
