# Audit report delivery

Audits started in the app default to **Public upload**. Turning it off keeps that
run local. Measurements, rollback, report persistence and the final log flush
finish before network sharing starts; upload failure does not fail the audit.

The completed diagnosis stays available when leaving/reopening the screen and
when a later audit is cancelled or fails. A separate local completed-report file
survives restarts and is deleted by Debug log **Clear**. Older complete sidecars
can be reopened after an upgrade; partial sidecars are not promoted to completion.

**Upload report** is available after completion even if Public upload was off
before starting. The existing `paste.rs` / `paste.c-net.org` transport and exact
body verification remain in use. Public report bodies use
`buildDeidentifiedPerformanceAudit`, followed by a 2 MiB fail-closed limit.
They contain app/build/platform, coarse OS version, payload publication/counts,
aggregate outcomes, fixed check identities, and allowlisted numeric/boolean
measurements. They exclude raw logs, errors, traces, free-form messages, routes,
product keys, device identifiers/model, audit session IDs and audit timestamps.
The raw Debug log uploader remains a separate explicit action.

SecureStore keeps the returned URL, deletion capability, verification state and
a local SHA-256 of the sanitized body. Retries reuse a known paste for verification
or copying. A local intent journal is written before POST; an interrupted or
uncertain response blocks another copy until the user acknowledges duplicate
risk. A confirmed receipt clears that uncertainty. No deletion capability or
local content hash is added to the public body.

Local-mode update snapshots do not declare an unvisited live update surface as
missing. Live update journeys still require their actual data and measured layout.
Responsiveness thresholds and the 10-second step limit are unchanged. Shared
row-array indexes reduce repeated navigation scans; physical-device timing must
be measured again before claiming the reported stalls have been resolved.

Regression coverage includes default automatic publication, explicit local runs,
post-completion upload, failure/retry, concurrent duplicate requests, interrupted
POST/restart, verification/copy retry, deletion, manual-log/report switching,
Back/remount, cancellation, completed-report recovery and Clear/write races.
