# Audit upload acceptance status

This records flow acceptance for draft PR #408. It does not certify Android
interaction, physical-device performance, or a live public-host write.

## Independent checks

The actual React screen and audit lifecycle are exercised with mocked native
components and transport. Storage tests use a file-system map; sharing tests use
the actual upload state machine with mocked POST, read-back and clipboard APIs.

| Case | Evidence | Status |
| --- | --- | --- |
| Public upload defaults on for local and live audit modes | Rendered controls and captured request choice | Passed |
| Preselection off, then upload after completion | Local run remains local; Upload report invokes the retained report | Passed |
| Back and screen remount | Diagnosis remains available; an in-flight upload stays visible and blocks duplicate controls | Passed |
| Restart with a saved diagnosis | Cold audit state restores the completed report and offers upload without publishing on mount | Passed |
| Restart with a verified receipt | Known URL is shown; restoration performs no POST, verification GET or clipboard write | Passed |
| Failed upload and retry | Completed measurement remains complete; ordinary retries use single flight | Passed |
| Ambiguous POST and restart | Another POST is blocked until explicit duplicate-risk acknowledgement | Passed |
| Known paste, verification/copy retry | Existing receipt is reused without another POST | Passed |
| Unsaved deletion receipt | Upload retry is blocked; recovery action opens Debug log without discarding the diagnosis | Passed |
| Cancel/Back during preflight | Deferred hydration cannot start an audit after the screen closes | Passed |
| Cancel/fail a later run | Prior completed diagnosis remains labelled Saved and dated; current upload status stays visible | Passed |
| Interrupted report-file write and Clear race | Complete canonical sidecar recovers an interrupted copy; Clear waits for pending writes | Passed |
| Privacy and failed preparation | Only the allowlisted body is submitted; oversize preparation cannot replay an earlier raw-log request | Passed |

These checks run in one low-priority Jest worker with no-cache. The focused
five-suite acceptance run passes 55 tests, including 19 rendered-screen
cases. Canonical mobile CI previously passed 378 suites / 4,303 tests,
438 script tests, all platform exports and size guards for the runtime patch.
The five additional cold-screen/back/recovery cases extend that coverage.

## Native and live-host boundaries

Both connected AVDs are reserved by the active redesign acceptance owner. No
physical device is connected, and host disk/CPU capacity does not safely support
another isolated native target. No existing device was installed, launched,
stopped, reconfigured or controlled for this audit task. Android layout, touch,
process-death persistence, background transport and physical Pixel latency remain
**not run**. The timing findings still need a new physical audit of this patch;
the 10-second limit and responsiveness thresholds are unchanged.

## Follow-up audit comparison

The supplied schema-7 follow-up is app 1.0.241 / build 298, compared with the
original app 1.0.240 / build 297. Neither contains this draft patch. Both used the
same published payload date/counts and release-mode Android configuration, but
the randomized six-product sample and primary journey products changed.

The follow-up records 71 performance failures versus 69, all timing-only with no
reported non-timing failure or runtime error in those checks. The worst frame gap
is 1,068.3 ms versus 657.3 ms; the largest event-loop lag is 1,038.1 ms versus
657.9 ms. Product-to-lender navigation remains a repeated hotspot; calculator
candidate selection also has a 784.8 ms frame gap. These observations do not
establish a controlled regression or confirm the row-index optimization.

The same two missing `settings.app-update` display checks remain in both released
audits. This patch corrects their local-mode accounting, with live-mode evidence
still required. All 2,723 planned check records are present exactly once, but
journey coverage is incomplete: 344/352 executed versus 346/352. The two additional
unavailable steps are lender-move actions with no rendered observed move; the six
existing optional economy actions still lack a local economic-signals cache.
Producer partial-coverage, optional-asset and artwork fallback observations
remain unresolved or unavailable evidence, not passed checks. No producer or
ingest change is included.

No synthetic fixture or new report was sent to a public host. A separately
reviewed live check would need a real completed on-device report transformed by
`buildDeidentifiedPerformanceAudit`: app/publication metadata, aggregate outcomes,
fixed checks and allowlisted numeric/boolean timings only. Raw diagnostics,
routes, product/profile values, device identifiers, session IDs and audit
timestamps are excluded. The public body is bounded to 2 MiB. Existing transport
uses `paste.rs` for bodies up to 384 KiB and `paste.c-net.org` for larger bodies
or a definite primary-service failure. A bounded live decision must identify the
exact reviewed body and chosen host, allow its POST and exact-body GET read-back,
and retain its secure deletion receipt. No such live write is required for the
flow checks above or has been performed here.
