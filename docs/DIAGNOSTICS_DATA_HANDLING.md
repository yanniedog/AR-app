# Diagnostics data handling

Crash reporting is opt-in and fail-closed. The app may send crash traces, device/build metadata, and fixed technical categories to Google Firebase Crashlytics only after the current consent choice is accepted. Session replay is disabled.

The optional Crashlytics-to-GitHub triage job remains in mock dry-run mode unless all of these controls are present:

- a private destination repository;
- a least-privilege issues-only token;
- Firebase credentials;
- `DIAGNOSTICS_PRIVACY_NOTICE_VERSION=2026-09-03` in the protected `diagnostics` environment.

When enabled, only redacted sample traces and allowlisted technical categories may be copied to the private issue tracker. Maintainer access must remain restricted. Close or delete a triage issue when it is no longer needed; do not copy raw debug logs, searches, saved rates, profile inputs, calculator inputs, or route history into it.

Live triage also requires an event-level `ar_diagnostics_privacy_notice=2026-09-03` custom key written only after the native collector confirms the current in-app choice. The triage job reads every page of recent events for each issue, keeps only events carrying that exact marker, and derives the private GitHub title, subtitle, type, event count, versions, timestamps, trace, and allowlisted log excerpt from that filtered set. Mixed-consent report aggregates and analyzer signals are never copied. An issue is skipped when no current-consent event remains or when event verification cannot complete.
