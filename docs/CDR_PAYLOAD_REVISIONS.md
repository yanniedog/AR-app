# CDR publication revisions

AR-local owns immutable payload publication. AR-app reads `dates-index.json`
from its existing `app-payload-latest` release. When `revision_protocol: 1` is
present, `revision_heads[latest_date]` selects the only edition that the app may
install. The head binds an immutable manifest URL and its raw SHA-256. The
manifest binds the generation, revision, bundle digest, and every asset's URL,
length, and SHA-256.

Tags have the form `app-payload-YYYY-MM-DD-r000001`. Same-day revision numbers
increase. An installed revision cannot be replaced by a lower revision, an
older date, or an unversioned fallback. Unavailable or inconsistent metadata
keeps the last verified cache and marks the refresh as failed/pending.

The complete manifest identity triggers refresh, including details-only and
optional-asset corrections. All listed assets are verified before the new
core/details edition is committed. Revision details and optional caches use
content hashes; assets from rolling, dated, or older editions are never merged
into a selected revision. Legacy releases remain readable before adoption.
The dormant v3 reader is not activated.

The app keeps the installed and preceding revision's cache assets. Unreferenced
staging files older than a day are cleaned after a successful commit, so daily
updates do not accumulate every historical details file on the device. This
does not affect the producer's immutable GitHub archives.

## Headless audit

From `mobile/`, with the repository's Node dependencies installed:

```sh
npm run audit:payload -- --output dist-audit/public-payload.json
npm run audit:payload -- --date 2026-09-11 --output dist-audit/2026-09-11.json
```

The CLI downloads the selected manifest and every listed asset, checks raw
hashes and lengths, and calls the same normalization and data-quality
validators used by the app. It writes JSON plus a companion Markdown report.
Exit codes are 0 for PASS/WARN, 2 for FAIL, and 3 for acquisition BLOCKED.
WARN is actionable evidence; it must not be reported as complete coverage.
Generated reports are ignored by Git.

Before publication, audit a private candidate directory containing its original
`manifest.json` and listed assets:

```sh
npm run audit:payload -- --directory /path/to/candidate --output dist-audit/candidate.json
```

This mode makes no network requests. It preserves manifest and asset hash
bindings and labels the report `acquisition: private_candidate` with
`publication_verified: false`. Public manifest/index evidence is null; a private
audit never proves that GitHub published or selected this candidate. Warnings
and failures remain visible with the same exit codes as a public audit.

Producer `coverage.payload_accounting` can explain explicit source exclusions
(for example, mortgage discount deltas) and products with no published rates.
The app validates the full accounting equation against loaded rows and exact
quarantine impacts before accepting an offset. Unknown or inconsistent
explanations fail reconciliation. Taxonomy and quarantine remain separate
checks. Ribbon totals use the producer's positive-rate scope; legitimate
zero-rate tiers still pass through rate-value checks and remain visible.
Rate integrity accepts finite negative values and values above 100%, as allowed
by the CDR [RateString definition](https://consumerdatastandardsaustralia.github.io/standards/#common-field-types).
Retained CommBank foreign currency account rows cover this historical case.

Run `cd mobile && npm run ci` before merging reader changes. The retained
2026-09-11 public fixture tests cover source exclusions, positive-only ribbons,
and preserving taxonomy/quarantine warnings; revision tests cover rollback,
mixed assets, details-only updates, and failed-download cache preservation.
