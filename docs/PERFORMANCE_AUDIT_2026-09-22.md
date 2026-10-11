# Performance audit repair — 22 September 2026

Source: https://paste.c-net.org/cffaf8b8-e94d-dff7-d189-1f071c1d12b6

The v1.0.206 / build 269 log contains two complete local audits. The second
records 145 failures: 142 completed interactions that exceeded performance
limits, two unsuccessful search journeys, and slow debug-log IO. The worst
continuous event-loop stall is 17.7 seconds. All eight data-integrity checks pass.

## Repairs

- Unchanged RBA calendar reconciliation returns the original integrity context.
  Previously it serialized and hashed the complete catalogue twice per check,
  even when the core object was unchanged. The original content digest remains
  intact, including detection of in-place tampering at calculation boundaries.
- Bank spread preparation reuses only a value verified by the same store action
  for the exact core hash, spread hash and date. The retained payload is frozen;
  replacement objects, changed hashes and forced refreshes still require validation.
- Bank logos and the update banner subscribe to the audit's active boolean.
  Individual progress events no longer re-render those components throughout
  the mounted navigation tree.
- Foreground refresh warms the current deep-search index when enabled. Local
  audits load only a matching cached index. Missing offline indexes produce a
  working basic-search route with explicit coverage metadata; deep-search-only
  actions remain unavailable until the index is present.
- Log redaction avoids unnecessary pattern scans. Export no longer redacts the
  full sidecar before compacting and redacting it again, and yields between
  parsing, compaction and serialization. Export-boundary redaction and Clear
  cancellation remain enforced.

## Local benchmark

Windows Node v24.12.0; five iterations; medians. These are not Android timings.
The catalogue was fetched through the app's delivery service and its compressed
bytes verified against the manifest SHA-256:
`72a15bfe34931035a630ca3f6b969bb15c605452a67b089b8bef71a731a6e240`.
It is the same core hash recorded in the supplied log: 16,679 rows and
11,330,693 uncompressed JSON bytes.

| Operation | Before | After |
| --- | ---: | ---: |
| Rebind unchanged catalogue integrity | 245.08 ms | <0.1 ms |
| Redact the supplied 1,484,378-byte log | 14.32 ms | 6.04 ms |

The old and new redactors produced identical output for the supplied log.
Regression coverage includes tamper detection, cache replacement/edition races,
offline search followed by online recovery, every redaction family, and 320
progress events without bank-logo renders.

`cd mobile && npm run ci` passed: 18 Expo Doctor checks, typecheck, lint
(existing warnings only), 129 script tests, 223 Jest suites / 2,187 tests,
Android/iOS/web exports and artifact size guards. Root PR automation verification
also passed. A read-only launch of the existing Android AVD remained offline;
only the emulator processes launched for this check were stopped.

## Acceptance boundaries

Native timings require a fresh Android audit after installation. Producer
partial-coverage warnings, uncached official economic sources, and initials
fallback for unavailable logos remain reported accurately. This app repair does
not alter upstream ingestion, the published catalogue, or offline network policy.
