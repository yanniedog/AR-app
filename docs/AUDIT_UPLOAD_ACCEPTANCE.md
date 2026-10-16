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
| Interrupted report-file write and Clear race | Newer complete canonical sidecar repairs an older/missing/corrupt dedicated copy before a later partial run; corrupt latest sidecars cannot hide a saved diagnosis; stale reads cannot overwrite a newer diagnosis; Clear waits for pending writes and invalidates in-flight reads | Passed |
| Privacy and failed preparation | Only the allowlisted body is submitted; oversize preparation cannot replay an earlier raw-log request | Passed |

These checks run in one low-priority Jest worker with no-cache. The focused
five-suite acceptance run passes 61 tests, including 19 rendered-screen
cases. Canonical mobile CI previously passed 378 suites / 4,303 tests,
438 script tests, all platform exports and size guards for the initial runtime patch.
The additional cold-screen/back/recovery and repair/race cases extend that coverage.

## Native and live-host boundaries

At the initial 2026-10-15 19:15 UTC target inspection, both connected AVDs belonged
to the active redesign acceptance owner and no physical device was connected.
That owner subsequently completed its work. A 19:52 UTC recheck could not connect
to ADB; approximately 64 MB of free host disk space still prevents provisioning
an isolated target or downloading a test APK. No existing device was installed, launched,
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

## 16 October cloud reconciliation

The branch is integrated with main `8e5c1cb84696be2728996b8789adf5c913086c1e`,
including the Settings large-text changes and install QR refresh. A rendered
lender-route test identified an audit action that could open a raw catalogue
tier absent from the displayed lender list. The action now uses the same
filtered, ranked, deduplicated rows as that list. Tests exercise the exact
rendered tier, a hidden sibling tier and a row excluded by mandatory eligibility.
This corrects journey evidence; it does not establish a device timing improvement.

The latest user-supplied audit is
`https://paste.c-net.org/450f3863-0af5-ab8e-8d24-e3c0855b9ad1`, app 1.0.242 /
build 299. It also predates this patch. Its supplied summary records 68 timing
failures and two missing `settings.app-update` observations. All 14 product-to-
lender openings stall, with a worst reported gap of 670.3 ms. All 2,723 check
records were saved, while 344/352 journeys were usable: six optional Economy
actions lack local data and two sampled lender moves were absent. Randomized
inputs prevent a controlled regression claim. The audit's normal font size
does not validate large-text behavior. Public paste retrieval, by itself, would
not establish automatic-upload completion. Direct retrieval returned HTTP 403
and the browser tool could not access the URL in this cloud session; these
figures are attributed to the supplied summary, not a fresh raw-log analysis.

The repeated full-row lookups and premature move-attribution work are covered
by the existing row-index and lender-route tests. Native chart, navigation and
layout costs remain possible contributors that these mocked tests cannot
measure. The current cloud target inspection found no `adb` executable or
Android SDK. The user's PC is offline. Physical-device timings, Android
process-death/background transport, large-text layout and a real upload receipt
remain separate acceptance gates. No public POST, device installation, ingest
change, release, draft promotion, remote push or PR merge was performed.

For this integrated tree, typecheck, lint (zero errors; eight existing warnings),
the zero-violation UI-copy check, prepared-history pins and both history
benchmarks passed. All 438 script tests passed with an isolated matching Java
compiler, including the native codec and headless-timer unit tests. All 378 Jest
suites / 4,316 tests passed, covering lifecycle, upload, storage, Settings and
lender behavior. Android, iOS and web exports passed, including the compiled
external-link and Android audit screen-awake guards; artifact-size guards passed.
An APK was not built. The canonical `npm run ci` command remains blocked at Expo
Doctor: 16/18 checks passed, while Expo schema and React Native Directory remote
metadata checks could not complete. The remaining canonical commands were run
directly without changing their checks or budgets.
