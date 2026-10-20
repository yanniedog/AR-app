# Shared audit diagnostics

Automatic audit uploads and retry/restore requests include `diagnosticLog`, the
complete retained canonical audit report, alongside the diagnostic summary.
This includes all checks, timing metrics, error messages, traces, coverage,
watchdog context and captured readiness evidence. Private inputs, identities,
routes and credentials are replaced with stable aliases or redaction markers;
local-only network violation records remain local. The application journal and
private input values are not needed to reconstruct the audit's check results.

New uploads use `ar-audit-dict-v1`. The payload contains its own encoding legend:

- `[n]` refers to `strings[n]`.
- `["a", ...items]` is an array.
- `["o", keyIndex, value, ...]` is an object with dictionary-indexed keys.
- `["r", n]` refers to `templates[n]`, a repeated object definition.

`decodeCompactDiagnosticJson` in `mobile/src/lib/compactDiagnosticJson.ts` restores
ordinary JSON and also accepts older plain JSON reports. No numeric rounding,
sampling, check removal or evidence truncation occurs in this encoding. Uploads
that exceed the byte limit are rejected rather than replaced with summaries.

New checks retain structured readiness probes and blocker codes separately from
the old bounded human-readable metric strings. `diagnostics.readinessCapturedChecks`
makes missing evidence in older saved reports explicit. Every probe retains
status, requiredness, counts, visible rows, fallback counts, empty/layout/summary
proof, revision-match outcomes and error presence. Diagnostic stages identify
whether a failure occurred before action invocation, during the action, path
transition, readiness wait or final settling.
The retained diagnostic log also carries registered/completed actions, probe
errors, blocker messages, and timing of readiness updates. The explicit
deidentified share option retains its stricter field allowlist.

The October 21 sample round-trips all 2,658 checks from 774,015 to 308,546
characters (60.1% smaller), before adding newly captured diagnostic evidence.
