# Diagnostics data handling

Crash reporting is opt-in and fail-closed. The app may send crash traces, device/build metadata, and fixed technical categories to Google Firebase Crashlytics only after the current consent choice is accepted. Session replay is disabled.

The optional Crashlytics-to-GitHub triage job remains in mock dry-run mode unless all of these controls are present:

- a private destination repository;
- a least-privilege issues-only token;
- Firebase credentials;
- `DIAGNOSTICS_PRIVACY_NOTICE_VERSION=2026-09-03` in the protected `diagnostics` environment.

When enabled, only redacted sample traces and allowlisted technical categories may be copied to the private issue tracker. Maintainer access must remain restricted. Close or delete a triage issue when it is no longer needed; do not copy raw debug logs, searches, saved rates, profile inputs, calculator inputs, or route history into it.
