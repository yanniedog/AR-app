# Legacy worker boundary evidence

`legacy-worker-boundary.json` records five zero-network calls to the unchanged exported `releaseRoute` function in `yanniedog/AR-local/services/app-data/worker.mjs`.

- Source checkout commit: `d2260ceb347926cfbe64a203f8357ff0514749aa`.
- Source Git blob: `91a11bef86c99fb2f48d798a2d95100938638af7`; working-tree `git hash-object` matched this blob and the path was clean.
- The SHA256 in the receipt describes the exact local file bytes, including local line endings.
- Requests used native Node `Request` objects. No fetch, service deployment, secret access or Pi operation occurred.
- Versionless, version-header and capability-header requests kept the same legacy tag/cache identity. Candidate tags through the legacy route and the as-yet-unimplemented capability route were rejected.

This establishes the existing source-level boundary, not a hosted-service attestation. The producer's candidate route and shared-cache HTTP behavior still need independent runtime verification before activation. App-side tests separately exercise the unmodified legacy URL matcher and index/revision validators.
