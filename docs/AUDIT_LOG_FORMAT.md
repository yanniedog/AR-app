# Shared audit diagnostics

Automatic audit uploads and retry/restore requests include `diagnosticLog`, the
complete retained canonical audit report, alongside the diagnostic summary.
This includes all checks, timing metrics, error messages, traces, coverage,
watchdog context and captured readiness evidence. Private inputs, identities,
routes and credentials are replaced with stable aliases or redaction markers;
all arbitrary runtime strings default to aliases, including errors and traces.
Structured error types and anonymous source-coordinate tuples remain readable.
Local-only network violation records remain local. The application journal and
private input values are not needed to reconstruct the audit's check results.

Each hosted file starts with a readable `audit` header containing the audit's
hashed reference, UTC finish timestamp, outcome, check counts and failure count
(including a separate timing-failure count). The decoded report's `completion`
contains the same identity and timestamp plus every failure's one-based result
position, source (`performance` or `health`), fixed check identity, diagnostic
stage and timing/functional classification. Positions are relative to each
source's check array. A copied, verified URL identifies these exact report bytes;
the timestamp describes the measurement's finish, not a later upload or copy.

`collectionComplete` means every declared result is retained. `coverageComplete`
additionally requires execution without skipped/unavailable/not-run checks,
unverified external links or pending required probes. `detailsComplete` requires a complete collection, valid
timestamps, structured readiness for attempted journeys and no detected legacy
evidence truncation. These are independent of
pass/fail: a fully collected audit can report failures. Missing coverage metadata
in older or interrupted runs yields incomplete status. `gaps`, `gapPositions`
and `missingPlannedChecks` expose missing, duplicate, unexpected, unavailable,
skipped, not-run, pending, missing readiness, absent schema-v7 health diagnosis
and truncated evidence without private input text.
Malformed optional coverage or health schemas in older recovery files are
reported as invalid evidence, without deleting or rewriting the original report.
Malformed health evidence stays in the hosted diagnostic log through the generic
privacy visitor; its typed public health summary is null. Both share and upload
retain the invalid-health/incomplete flags instead of failing preparation.
Unknown private check identities remain null while their positions survive.
Counts describe different overlapping facts and must not be added together.

Evidence processing has conservative capacity guards before retaining checks or
serializing reports. These guards do not truncate evidence. A capacity stop
records a failed position and explicitly incomplete detail; report preparation
rejects oversized input before creating encoded copies. A successful full report
therefore retains all of its evidence within these resource limits.

This is the complete retained application audit within its stated privacy and
instrumentation boundary. It does not claim native CPU/GPU profiler coverage,
include the general application journal, or publish raw private strings. The
`privacyBoundary` records these limits. Missing evidence and incomplete coverage
remain explicit; a verified upload proves byte integrity, not successful checks.

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
transition, data preparation, readiness wait, back navigation, recovery, origin
readiness or final settling.
The retained diagnostic log also carries registered/completed actions, probe
errors, blocker messages, and timing of readiness updates. The explicit
deidentified share option retains its stricter field allowlist.
Full readiness snapshots stay in the persisted report and upload; bounded
per-check journal lines omit those snapshots to avoid rollover work during a run.
New canonical checks retain full evidence before journal bounding. Existing saved
reports containing `…[truncated N chars]` remain recoverable, but their completion
metadata counts truncated fields and omitted characters before redaction hides
the original marker. Such reports cannot claim complete diagnostic detail.

The retained metric schema is generated from production audit emitters' numeric,
boolean and fixed-string types; arbitrary strings and private input fields stay
opaque. Regenerate with `node scripts/generate-audit-diagnostic-schema.cjs` after
changing emitters. Canonical CI checks that this schema is current. This keeps
new technical timing/count/status evidence from disappearing behind the narrower
operating-system share allowlist.

The October 21 sample round-trips all 2,658 checks from 774,015 to 308,546
characters (60.1% smaller), before adding newly captured diagnostic evidence.
