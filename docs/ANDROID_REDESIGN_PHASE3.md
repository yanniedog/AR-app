# Phase 3: navigation and contextual calculations

Rates opens the complete searchable catalogue with no setup questions. Rates, Saved and Market are the only tabs. Profile, Settings and About sit in Account. Bank, category and matching views are facets of Rates. Existing inbound routes remain adapters; they wait for actual root-navigation readiness.

Each rate family keeps its query, path, filters, sort, selection and scroll in an ephemeral session. Filter and Sort cancel leave committed state alone. Contextual Calculate carries the opaque product key and exact rate index from a product or Saved row; Rate check and Projection share scenario inputs and one route. Missing or invalid targets never select a sibling. Exact targets wait for mandatory data admission; unrelated mortgage-profile loading does not block an already eligible deposit.

Selected-rate money calculations separately check numeric applicability. Verified exact-row source bounds take priority over normalized display tiers. Known outside-LVR/balance cases retain rate identity but suppress selected-target dollars and the stay/switch chart. Unparsed or ambiguous qualified alternatives remain unverified. This is a hypothetical comparison, not an eligibility decision. Supported negative comparisons stay negative. Existing calculation math, persistence and receipt contracts remain intact.

The native prototype exposed and fixed a cold-launch navigation failure and a wrapping Compare label. The toolbar now uses font-aware column wrapping with at least 48dp targets; its text remains full size.

## Evidence and scope

[Eight PNG/XML pairs and hashes](evidence/android-redesign-phase3/manifest.json) record fresh launch, ordinary and enlarged text, selected-product Calculate, mode handoff and Native Back. The package identifies source revisions, development-client version and limits. It is navigation evidence, not final release acceptance, a human study, physical-device testing or app performance measurement. The initial return case has an empty query; stronger populated-state journeys and the full Android matrix belong to Phase 5. Remaining explanatory copy belongs to Phase 4.

Canonical `cd mobile && npm run ci` passed on `5dc0f63`: Expo Doctor 18 checks, TypeScript, lint, repository script checks, 336 Jest suites / 3,805 tests, all-platform exports and artifact budgets. The subsequent qualified-alternative fix passed its three focused suites / 32 tests; the final PR head also runs canonical local and required GitHub checks before merge. Windows execution used the installed Git Bash on PATH for the repository's existing shell-script test; no checked-in shell, dependency or Gradle changes were needed.

Audit callbacks follow the new destinations and invoke the same actions as visible controls. Existing strict 10,000ms step limits and rendered-readiness checks remain in force. This phase does not claim a full native audit pass; Phase 5 records that separately.
