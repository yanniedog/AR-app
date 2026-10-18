# Public pricing reconciliation — 16 October 2026

PR #402 is prepared against app main `8e5c1cb84696be2728996b8789adf5c913086c1e`.
Rates, Saved and the shared Calculate workspaces own the pricing integration.
The old Home, Search and Projections routes retain main's canonical adapters.
The consumer copy guard, numeric input rules, exact selected-tier constraints,
mandatory feature gates and full-interval LVR matching remain in force.

Public offer facets retain inclusive minima and strict maxima, including
`lvr_>=80.01-<95%`. Unknown fees, unresolved rates, stale sources and partial
loading cannot establish a complete ranking or a verified customer rate.
Calculation fields remain blank until entered; model defaults are separately
reported as projection facts. Variable-rate projections require the explicit
held-rate assumption. A comparison window is labelled as a comparison period,
not the remaining loan term. Public notification text contains public scenario
facts; private adjustments, balances and entered rates remain local.

## Producer compatibility

The repository-accessible AR-local #934 head is
`6d33142ae1bac736ed738cf9182eaecec38e7893`. Its resolver golden JSON is deeply
equal to the app fixture (canonical sorted compact JSON SHA-256
`330be11ce30d00579f3da88d19085a0d5f5b1b7d3aee25d96a3ebc1c3673e0b6`).

Its retained history fixture carries compiler pin
`5f27f0b70b89efe7adf76d0d93a97b2c779e1953ff870efd018c14961fa17a6e`.
The old #402 artifact pins `c37ef778f7f6b1f140535319ae342073c30a340af9bcf48a020e6935ae710694`.
The reconciled app compiler pins
`51e28fd661d3c273ea9b07aefe7c04c2f90c53e16d48111b9a8814d8d9572ae7`.
All three values identify different compiler artifacts. Structural acceptance
does not establish compatibility with the app's required exact pin.

The original three published observation packets are retained upstream at
`tests/fixtures/bank_rate_catalogue_real_2026-05-19_2026-09-26.json`, SHA-256
`6b03da88fb9c49ed05f938ea88f9e3f7bb2a65bc34eefb1eb54d51b3354a8334`.
Repacking them through the app's existing catalogue builder and recompiling
reproduces every upstream prepared fact, product, count, calendar gap and source
receipt. Only the compiler pin changes. The paired fixtures and
`publicRateHistoryCompatibility.test.ts` prove the old pin is rejected and the
recompiled fixture is accepted. This is regeneration from the observations,
not replacement of a fixture's receipt field.

Before producer publication, copy the current standalone compiler and its
manifest together, regenerate the producer fixture, update its independently
reviewed shipping-consumer pin and rerun the producer suite against those exact
bytes. The reported locally prepared producer commit `dff86993` is unavailable
from GitHub in this environment, so its exact compiler/fixture must still be
checked. No producer code, live ingest configuration or source is changed here.

## Remaining gates

Both app PRs remain drafts and remote pushes are held. The matching producer
packet is a prepared handoff, not an activated producer or accepted publication.
Collection/publication flags stay disabled and the programme allowlist stays
empty. Three consecutive natural daily shadows, including an unchanged-source
cycle and independent public-source reproduction, precede the compatible app
release. Published APK/manifest/source/hash readback, installed native journeys,
physical-device acceptance and explicit operator/canary approval remain separate
pending gates. Fixture tests cannot satisfy them.

Run `cd mobile && npm run ci`. If an environment blocks Expo Doctor's remote
schema/directory reads, retain that failed result and report subsequent checks
individually. Do not weaken network, performance, copy, artifact or privacy
guards to reinterpret the canonical result as passed.
