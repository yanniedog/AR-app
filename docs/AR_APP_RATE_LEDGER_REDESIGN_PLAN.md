# Australian Rates — Rate Ledger atomic redesign and app-health plan

Status: implemented downstream in AR-app
Repository: `yanniedog/AR-app` (`mobile/` remains the app root)
Producer dependency: `yanniedog/AR-local`
Language: Australian English

## 1. Outcome

Ship one coherent redesign called **Rate Ledger** across the installable Expo app, while fixing the visible SecureStore error and expanding the performance audit into an app-health audit that detects missing, misleading, partial and non-rendered data—not only slow interactions.

The finished app must:

- look authored for Australian rate comparison rather than assembled from generic AI-era dashboard patterns;
- preserve the exact meaning of advertised, comparison, base, bonus and ongoing rates;
- make freshness, source, coverage, failures and offline/sample state visible wherever data is used;
- remain useful with a saved payload and honest when data or an asset is unavailable;
- remain accessible at large text, narrow width, dark appearance and reduced motion;
- consume the final AR-local payload contract without changing or deploying the producer from this repository;
- pass the repository verification and native journey bar.

This is an atomic product migration. Temporary compatibility tokens and route redirects are allowed, but users must not receive a half-old/half-new navigation or contradictory data language in a release build.

## 2. Hard boundaries and concurrency gate

### Repository ownership

AR-app owns:

- Expo app code and bundled app assets;
- app-side payload parsing, validation, cache and display;
- APK build/release automation;
- app-health audit logic and presentation.

AR-app does **not** own:

- Pi services, systemd units or schedules;
- CDR ingest, payload builder or dashboard;
- producer release publication;
- AR-local deployment or recovery.

Do not SSH to or mutate any Pi as part of this plan.

### Concurrent AR-local work

Implementation note (3 September 2026): the user explicitly removed the wait-for-AR-local gate. The work therefore proceeded entirely inside an isolated AR-app worktree, retained the existing public v1 producer contract and URLs, and made no AR-local or Pi changes.

Thread `01a05d02-3ad8-7790-9e0e-3349948dcc1f` is simplifying/fixing AR-local concurrently. Preserve it as an upstream boundary:

1. do not cherry-pick, rewrite, deploy or otherwise interfere with its checkout;
2. finish independent design, component, diagnostic and compatibility work in AR-app;
3. keep the shipping v1 manifest and dates-index contract unless an independently authorised migration changes it;
4. compare it to AR-app fixtures/types with an explicit contract-diff checklist;
5. make only downstream-compatible consumer changes;
6. verify against the public payload independently of producer implementation work.

An unknown upstream state is not permission to invent fields, but it is not a blocker for app-owned implementation.

### Worktree and PR isolation

- Start from current `origin/main` in a dedicated AR-app worktree/topic branch.
- Inventory uncommitted files before every broad edit and preserve unrelated work.
- Keep the SecureStore hotfix, foundations, screen migration and audit changes in reviewable commits even if delivered through one final PR.
- Never merge/deploy/publish unless separately authorised.
- Do not flatten `mobile/`.

## 3. Baseline defects this plan resolves

### Invalid SecureStore key

The debug-log surface currently exposes:

> Invalid key provided to SecureStore. Keys must not be empty and contain only alphanumeric characters, ".", "-", and "_".

The invalid key contains unsupported characters. Replace it with the stable, production-valid key:

`ar.debug-log.public-upload-receipt.v1`

Requirements:

- define it once in a narrow key module;
- use the same key for read, write and delete;
- do not echo the key or a SecureStore exception above the normal debug log;
- preserve existing debug-log receipt behaviour;
- include a regression test that enforces `^[A-Za-z0-9._-]+$` and exercises the calling path;
- if a legacy invalid-key lookup is attempted for migration, contain the exception and never surface it to users. Because the old key was invalid, do not claim a value was successfully stored under it.

### Audit blind spot

The current “performance audit” can report responsive screens while the product is missing data, rendering blanks, using sample data or hiding producer failures. Replace the mental model with an **app-health audit** containing two independent result axes:

- **interaction health**: readiness, response time, transition latency, long tasks, memory-sensitive work and timeout;
- **data/display health**: asset availability, freshness, coverage, row/point counts, content integrity, correct visible values, explicit empty/error states and gaps.

A fast blank screen fails. A fully populated but slow screen also fails. Neither result may mask the other.

### Generic visual system

The current screen set mixes Material dynamic colour, Ionicons/Material Symbols, white/navy card conventions and many rounded containers. Replace this with the Rate Ledger system in `docs/DESIGN_SYSTEM.md`: paper, ruled sections, editorial typography, tabular numbers, original mark/icons and evidence-first states.

## 4. Experience principles

1. **Evidence is part of the content.** A rate without observation date, source and coverage state is unfinished UI.
2. **One number never erases its conditions.** Fees, tiers, eligibility, terms and rate type stay attached.
3. **Quiet is not empty.** Missing and partial states are deliberately composed and plainly written.
4. **One dominant action.** A person should know the useful next step without scanning a wall of equal buttons.
5. **Progressive detail.** Lead with the decision, then let people open methodology, coverage and raw evidence.
6. **No manufactured urgency.** No countdown pressure, celebratory animation, “best ever” claims or financial-advice tone.
7. **The visual grammar earns its place.** Avoid gradients, glass, blobs, neon, card soup, generic hero copy and gratuitous illustration.

## 5. Target information architecture

### Primary destinations

The persistent bottom bar has four household-level destinations:

| Label | Canonical route | Job |
|---|---|---|
| Today | `/(tabs)` | What changed, what matters and current evidence |
| Explore | `/(tabs)/browse` | Browse/search products, banks and comparison tools |
| Changes | `/(tabs)/passthrough` | Bank responses, RBA context and rate-change research |
| My rates | `/(tabs)/watchlist` | Saved products, tracked rates and personal scenarios |

Search is a first-class action from Today and Explore but not a fifth tab.

### Utility destinations

Profile, Settings and About live in the navigation menu/stack. Terms, third-party notices, Debug log and App health audit live below About/Support. They are not primary product destinations.

### Route migration and compatibility

| Existing route | Target | Action |
|---|---|---|
| `/(tabs)/index` | Today | Retain canonical root; redesign |
| `/(tabs)/browse` | Explore | Retain route; change label/composition |
| `/(tabs)/passthrough` | Changes | Retain route; become Changes landing page |
| `/(tabs)/watchlist` | My rates | Retain route; change label/composition |
| `/(tabs)/trends` | `/research` | Move from tab group; keep redirect at `/trends` |
| `/(tabs)/settings` | `/settings` | Move from tab group; keep utility navigation/deep-link compatibility if required |
| `/search` | Search | Retain focused stack route |
| `/banks`, `/bank/[provider]` | Explore detail | Retain |
| `/product/[key]` | Explore detail | Retain |
| `/compare` | Compare tray/result | Retain |
| `/calculator`, `/projections`, `/rate-receipt` | Explore/My rates tools | Retain; update entry points |
| `/rba`, `/rba-response`, `/research` | Changes detail | Retain under Changes ownership |
| `/about`, `/terms` | Utility | Retain |
| `/third-party-notices` | Utility | Add |
| `/performance-audit` | App health audit | Keep path for compatibility; rename visible product language |
| `/debug-log` | Debug log | Retain; remove SecureStore error banner |

Do not delete a route until inbound links, stored router state, notifications and tests prove it is unused or redirected. The primary tab bar appears only on the four root destinations; focused tasks rely on stack back navigation.

## 6. Rate Ledger foundation

### Tokens

Implement and use:

- `mobile/src/theme/colors.ts`: semantic light/dark Rate Ledger palette plus compatibility map;
- `mobile/src/theme/layout.ts`: named spacing, measures, breakpoints, target sizes and radii;
- `mobile/src/theme/motion.ts`: 160 ms state / 240 ms navigation and reduced-motion helper;
- `mobile/src/theme/fonts.ts`: stable Commissioner/Newsreader family keys and pinned provenance;
- `mobile/src/theme/theme.ts`: `theme.ledger` and named space while preserving legacy callers.

Do not remove legacy theme keys until every existing screen and test has migrated. Dynamic Material colour must not override the authored Rate Ledger semantic palette on redesigned components.

### Assets and licensing

- Commissioner: pin `kosbarts/Commissioner@16865a9483b54bd633b5471b109792db44f7786e`.
- Newsreader: pin `productiontype/Newsreader@cfcb4f7af0e52c25e8df2a2431814c8e5fe2e155`.
- Bundle only required static weights; no runtime CDN.
- Preserve OFL-1.1 licences and record SHA-256/source path in the asset manifest.
- Add in-app Third-party notices.
- Rate Mark remains original local geometry; selected utility icon paths are adapted from the pinned MIT-licensed Iconoir source and attributed in-app.
- Record developer-only versus runtime dependencies separately; do not imply test tooling ships in the production bundle.

See `docs/DESIGN_PROVENANCE.md` for the complete intake and attribution contract.

### Shared primitives

Add and adopt in this order:

1. `RateMark`
2. `LedgerIcon`
3. `LedgerText`
4. `LedgerAction`
5. `LedgerSection` and `LedgerRow`
6. `LedgerTabs` and `LedgerField`
7. `LedgerSheet`
8. `RateFigure` and `ChangeIndicator`
9. `DataEvidenceLine`

Keep the primitives visually opinionated and behaviourally small. Business logic remains in data/view-model modules.

## 7. Canonical data evidence model

`mobile/src/data/displayEvidence.ts` maps store/asset truth to display truth. Every substantive screen passes its source, offline state, observation date, coverage object, asset state and explicit overdue threshold.

### Precedence

1. no usable data plus unavailable/error → `Data unavailable`;
2. sample source/state → `Sample data`;
3. coverage or asset incomplete → `Partial coverage`;
4. explicit scheduler deadline passed → `Update overdue`;
5. offline → `Offline` plus saved observation;
6. cache/error with last-known-good data → `Saved copy`;
7. verified remote observation → current/latest wording.

Only claim `full coverage` when explicit, non-zero attempted and succeeded counts are equal and there is no partial/failed evidence. Do not infer it from HTTP success or the absence of a banner. Do not infer overdue from age unless the producer/scheduler provides a threshold.

### Detail disclosure

The evidence line opens:

- source (verified remote, saved on-device, bundled sample);
- exact observed date;
- attempted/succeeded/partial/failed provider counts;
- named failure evidence when provided;
- producer limitations;
- asset-specific reason;
- expected update schedule.

Keep raw implementation errors in diagnostics. User-facing evidence translates them into factual, bounded language.

## 8. Screen-by-screen redesign

### Onboarding

- Open with Rate Mark, one plain promise and one example rate figure grounded in the bundled sample state.
- Explain that rates are general information and can be saved offline before asking preferences.
- Ask only information that changes the catalogue: interests, broad product preferences and optional scenario inputs.
- Put privacy text at the relevant choice; diagnostics remain opt-in.
- Dominant action names the outcome (“Set up my rate view”).
- If live data is not ready, say `Sample data`; never make the example look current.

### Today

- Header: compact Rate Mark/wordmark, Search and utility-menu actions.
- Lead: observation date, one useful market fact and its evidence line—not a greeting or generic hero paragraph.
- “Since the last update”: count and direction of meaningful moves with dates.
- “For you”: at most three rows derived from explicit preferences/saved rates; label why each row is included.
- RBA context: next decision/last move only when its independent asset is verified.
- Provide intentional states for no moves, no profile, no saved products, partial coverage and offline cache.

### Explore

- Start with search, followed by the four exact product families and bank index.
- Use ruled rows and aligned rate figures instead of a grid of rounded cards.
- Show comparison rate as the loan comparison metric when present while retaining advertised rate.
- Show deposit base/bonus/introductory/ongoing type explicitly.
- Keep broadly applicable products as the default; make expanded eligibility an explicit filter.
- A sticky compare tray appears only after a selection and says the count/outcome.

### Search

- Search bank and product names with section-aware results.
- Persist query while opening a result and returning.
- Announce result count, active filters and no-result recovery.
- Distinguish “no match in verified data” from “search index unavailable”.
- Use actual text match highlighting sparingly; never use colour alone.

### Compare

- Compare two to four products using shared field rows rather than independent cards.
- Freeze the label column where supported and retain readable stacked comparison at narrow width.
- Put comparison/advertised/ongoing rate, term/tier, fees, eligibility and observed date on separate labelled rows.
- Mark missing and unequal evidence explicitly; do not sort missing to zero.
- Dominant action is contextual (save, calculate or remove), never an application CTA.

### Product detail

- Start with provider/product, exact primary rate label and evidence.
- Follow with “What this rate means”, eligibility, fees, tiers/terms, change history and source details.
- Keep fees with variable/unpublished status rather than collapsing them into `$0`.
- Chart gaps remain visible and narrated.
- Put general-information disclosure near projection/calculation actions.

### Banks and bank detail

- Banks index shows observation coverage and product-family availability, not a decorative logo wall.
- Bank detail begins with the provider’s latest verified movement and coverage.
- Separate current rates, recent moves and response research.
- Do not imply an average describes every customer/product.

### Changes

- Changes landing replaces a dashboard collage with three chapters: latest bank moves, response to RBA decisions, and research history.
- Each move states direction, basis points, affected/attempted products and observation date.
- `up` and `down` are descriptive, not intrinsically good/bad.
- RBA event assets and bank payload assets disclose independently; one may be live while the other is saved/unavailable.

### Research, trends and RBA detail

- Research owns longer time windows, market distribution and methodology.
- Every chart names cohort, metric, unit, date range and missing-data treatment.
- Provide a written summary and accessible values for meaningful extrema/events.
- RBA pages distinguish official target decisions, scheduled meeting data and bank response observations.
- Never describe a future decision as certain.

### My rates

- Lead with saved/tracked products and their latest known change.
- Separate saved products, current-bank scenario and notifications.
- Empty state explains the useful action and links to Explore.
- A stale/missing saved match remains visible with explanation; do not silently drop it.
- Personal scenario inputs remain on device unless an existing explicit share action says otherwise.

### Calculator, projections and rate receipt

- Use persistent field labels, exact units and plain validation.
- State which rate type and assumptions feed every result.
- Results use ledger rows and tabular figures; no faux precision beyond inputs.
- Projection charts include written assumptions and accessible summaries.
- Rate receipts show dataset revision/source and retain user-editable notes separately from published evidence.

### Profile and Settings

- Profile contains only catalogue/scenario preferences with a concise explanation of effect.
- Settings groups appearance, data/update, privacy/diagnostics, security and About.
- Switch labels describe what is enabled; supporting copy describes consequence.
- Theme preview honours the authored palette; dynamic Material colour is not presented as part of Rate Ledger.

### About, Terms and third-party notices

- About states independence, version, data purpose and support links.
- Terms preserve general-information, CDR and diagnostics disclosures.
- Third-party notices list incorporated assets, exact licences and pinned revisions; studied-only references are clearly separated.
- Do not imply regulator, government, lender or CDR accreditation/endorsement.

### Debug log

- Remove the SecureStore error from the normal surface by fixing the key and containing storage exceptions.
- Keep raw diagnostic entries in system monospace; all surrounding UI uses Rate Ledger typography.
- Sharing/upload controls state exactly what is included, require confirmation and show a bounded receipt.
- Empty log, loading and failure states remain usable.

### App health audit

- Rename visible language from “Performance audit” to “App health audit” while preserving the route.
- Lead with a summary across interaction, data/display and accessibility/readiness.
- Let users expand route/asset evidence; do not dump internal trace data by default.
- Clearly separate **PASS**, **DEGRADED**, **FAIL**, **BLOCKED** and **NOT RUN**.

## 9. App-health audit specification

### Result model

Each route/surface result records:

- route key and render revision;
- action/probe identifier;
- result class (`PASS`, `DEGRADED`, `FAIL`, `BLOCKED`, `NOT_RUN`);
- duration/timeout where relevant;
- payload revision/source/offline state;
- asset state and observed date;
- expected and actual count/value/layout condition;
- bounded, non-sensitive reason;
- whether last-known-good content remained visible;
- remediation ownership (`app`, `producer`, `network`, `device`, `unknown`).

Do not include searches, saved products, profile/calculator inputs, route values, raw stack traces, device model or stable installation identifiers in an upload summary.

### Interaction checks

- cold/warm app readiness;
- initial screen useful-content time, not merely first React render;
- tab/root navigation and stack back response;
- search typing/result update;
- filter apply/clear;
- compare add/remove/open;
- product/bank detail open;
- chart window/section change;
- save/unsave and scenario edit;
- refresh start/result;
- sheet/dialog open/close;
- no-op presses and repeated actions;
- JS/UI thread stalls and bounded memory-sensitive operations where measurable.

Budgets must be device/profile-specific and checked on a release-like native build. Test harness speed is not production proof.

### Data and display checks

For every independently loaded asset (core, details, search, daily history, bank history, spread history, RBA calendar, canonical v3/economic assets where enabled):

- schema/contract validation succeeded;
- manifest identity, run date and digest relationship are internally consistent;
- asset state is live/cached/sample/partial/unavailable/error and rendered accordingly;
- observation date is present and plausible;
- explicit producer coverage/failure truth is preserved;
- expected non-zero collections are non-zero;
- expected count versus parsed count versus visible count is reconciled;
- product keys/provider references resolve without unexplained orphaning;
- advertised/comparison/ongoing rate labels and values agree with the selected record;
- rate/tier/term/fee/eligibility fields are not silently discarded;
- search can find deterministic fixture records;
- saved keys still resolve or render a “no longer present” state;
- history date/point arrays align, are ordered and expose gaps;
- charts have finite domains and render a summary even with one point/no points;
- independent assets never inherit a false “live” state from core payload success;
- sample/cache/offline language appears on the actual surface;
- loading settles to content, explicit empty state or explicit failure—never a permanent blank;
- evidence lines are present and open their facts;
- failures expected by the fixture are visible in coverage details;
- privacy-sensitive screens remain excluded from interaction replay.

### Layout/readiness checks

- important content has measurable non-zero layout;
- primary figure, evidence and action are inside viewport/reachable by scroll;
- no clipping at 200% font scale;
- no horizontal body overflow at 320 dp;
- modal/sheet close action is reachable;
- focus/selected/disabled states are present;
- image/chart alternative content exists;
- reduced-motion state does not block completion callbacks.

### Required fixtures

Maintain deterministic fixtures for:

1. full remote coverage;
2. partial provider coverage with named failures;
3. saved cache while offline;
4. bundled sample data;
5. overdue update using an explicit deadline;
6. missing optional asset while core remains live;
7. asset error with last-known-good content;
8. empty-but-valid collection;
9. malformed/corrupt asset rejected before display;
10. history gaps and single-point chart;
11. missing comparison rate versus a published `0%` value;
12. saved product removed from the latest catalogue.

### Summary semantics

- **PASS**: required interaction and display evidence meet contract.
- **DEGRADED**: useful last-known-good/partial content is clearly disclosed and all safe actions work.
- **FAIL**: wrong/missing/blank/mislabelled data, broken action, inaccessible content or budget breach.
- **BLOCKED**: the audit cannot establish truth because an external prerequisite is unavailable; it must name the prerequisite.
- **NOT RUN**: intentionally skipped and never included in a pass percentage.

A route cannot be globally PASS when either its interaction or data/display axis fails.

## 10. File-by-file implementation map

### Foundations

- `mobile/src/theme/colors.ts` — add Rate Ledger roles; migrate compatibility palette.
- `mobile/src/theme/fonts.ts` — font family keys and provenance.
- `mobile/src/theme/layout.ts` — spacing, measures, radii and breakpoint helpers.
- `mobile/src/theme/motion.ts` — timing and reduced-motion behaviour.
- `mobile/src/theme/theme.ts` — expose `theme.ledger`/named space; retain old API.
- `mobile/src/components/RateMark.tsx` — original mark.
- `mobile/src/components/icons/LedgerIcon.tsx` — original semantic icon set.
- `mobile/src/components/ledger/*` — shared primitives.
- `mobile/src/data/displayEvidence.ts` — canonical data disclosure mapper.
- `mobile/src/content/thirdPartyNotices.ts` — licence/source content.
- `mobile/app/third-party-notices.tsx` — in-app notice.

### App shell and routes

- `mobile/app/_layout.tsx` — load verified fonts, register stack routes/titles and retain safe fallback until load completes.
- `mobile/app/(tabs)/_layout.tsx` — four canonical roots only; no duplicate tab chrome.
- `mobile/src/components/AppTabBar.tsx` — Rate Ledger tabs/icons, safe-area and large-text behaviour.
- `mobile/src/components/AppNavigationMenu.tsx` — utility-only grouping.
- `mobile/src/lib/appDestinations.ts` — utility destinations only.
- `mobile/src/lib/tabRouting.ts`, `mobile/src/lib/tabIcons.ts` — route ownership and labels.
- move Trends implementation to `mobile/app/research.tsx`; retain `mobile/app/trends.tsx` redirect.
- move Settings implementation to `mobile/app/settings.tsx`; remove duplicate visible tab destination and preserve compatible link behaviour.

### Screen migrations

- `mobile/app/onboarding.tsx`
- `mobile/app/(tabs)/index.tsx`
- `mobile/app/(tabs)/browse.tsx`
- `mobile/app/(tabs)/passthrough.tsx`
- `mobile/app/(tabs)/watchlist.tsx`
- `mobile/app/search.tsx`
- `mobile/app/compare.tsx`
- `mobile/app/product/[key].tsx`
- `mobile/app/banks.tsx`, `mobile/app/bank/[provider].tsx`
- `mobile/app/research.tsx`, `mobile/app/rba.tsx`, `mobile/app/rba-response.tsx`
- `mobile/app/calculator.tsx`, `mobile/app/projections.tsx`, `mobile/app/rate-receipt.tsx`
- `mobile/app/profile.tsx`, `mobile/app/settings.tsx`, `mobile/app/about.tsx`, `mobile/app/terms.tsx`
- `mobile/app/debug-log.tsx`, `mobile/app/performance-audit.tsx`

Migrate shared screen parts before duplicating style changes in routes: product parts, filters, charts, feedback states, settings rows, navigation, brand lockup and data-unavailable screens.

### SecureStore hotfix

- add one secure-key constant module using `ar.debug-log.public-upload-receipt.v1`;
- update debug receipt storage callers;
- add key/calling-path regression tests;
- verify debug-log UI no longer renders the exception.

### App-health audit

- preserve existing audit storage/privacy/rollback boundaries;
- version the report contract rather than mutating old persisted results in place;
- extend plan/surface probes for data integrity, counts, display and accessible state;
- add pure classifiers for result semantics;
- add deterministic fixture-driven route/asset checks;
- update presentation and export summary;
- update rollback/migration tests.

## 11. Delivery sequence

### Phase 0 — isolate and record baseline

- Fetch current `origin/main`, create isolated worktree/topic branch and record HEAD.
- Run `cd mobile && npm ci` if the worktree is not already installed.
- Run `npm run ci` and record baseline failures separately from new failures.
- Capture representative native screenshots and existing route/audit inventory.
- Confirm upstream AR-local work is untouched.

### Phase 1 — production-visible hotfix

- Fix the SecureStore key and its tests first.
- Verify read/write/delete and debug-log screen.
- Keep this commit independently revertible.

### Phase 2 — foundations and provenance

- Add verified fonts/licences/manifest.
- Add tokens, Rate Mark, icons, primitives, evidence mapper and notices.
- Add token contrast, evidence mapper and primitive behaviour tests.
- Verify both themes, 200% text and 320 dp width in a component harness/native screen.

### Phase 3 — shell and navigation atom

- Load fonts, replace brand/navigation chrome and establish four-root IA.
- Add redirects/moved routes and update route ownership tests in the same commit.
- Confirm deep links, Android back, iOS back gesture and restored router state.

### Phase 4 — core product surfaces

- Migrate Today, Explore, Search, Compare, Product, Banks and My rates.
- Wire `DataEvidenceLine` to each independently loaded asset.
- Replace generic cards with ruled composition; keep business selectors unchanged unless correctness requires a separate fix.

### Phase 5 — changes, tools and utility

- Migrate Changes/Research/RBA, calculator/projections/receipt, onboarding, profile/settings/about/terms/notices and diagnostics.
- Verify every chart and empty/error state.

### Phase 6 — app-health audit

- Add the independent data/display axis and fixture matrix.
- Run against full, partial, cache, offline, sample, unavailable and corrupt cases.
- Confirm exported summary remains privacy-bounded.

### Phase 7 — upstream contract integration

- Obtain the final AR-local contract/release after its concurrent thread completes.
- Diff schema, manifests, asset names, coverage/failure fields, dates and freshness rules.
- Update downstream types/parsers/fixtures only.
- Validate real published rolling, versioned and dated payload identities separately.

### Phase 8 — verification and release evidence

- Run canonical CI.
- Run release-like Android and iOS journeys; web export remains a compatibility check, not native proof.
- Capture visual/accessibility matrix and app-health report.
- Build APK through existing release automation only when authorised.
- Verify downloaded APK/update manifest/digest and installed runtime separately before any production claim.

## 12. Test and verification matrix

### Deterministic repository checks

From `mobile/`:

```text
npm run typecheck
npm run lint
npm run test:scripts
npm run test -- --ci
npm run export
npm run size:report
```

Canonical combined command:

```text
npm run ci
```

Do not report CI green unless it was run against the final working-tree/head content. Classify pre-existing or concurrent failures with file/command evidence.

### Focused automated coverage

- semantic palette and WCAG contrast (including dark appearance);
- theme compatibility for existing callers;
- font keys and asset manifest/hash integrity;
- icon/mark accessible versus decorative modes;
- button target, busy/disabled state and outcome label;
- evidence precedence and strict full-coverage rules;
- date boundary/invalid date handling;
- partial/failure facts and limitation disclosure;
- rate type/zero/missing formatting;
- route ownership, redirects and tab visibility;
- SecureStore valid key/read-write-delete path;
- app-health result classification, counts and privacy redaction;
- full fixture matrix from section 9.

### Native manual journeys

Run on at least one Android phone/emulator and one iOS simulator/device where available:

1. fresh install → onboarding → Today;
2. four primary tabs and stack return;
3. search → filter → product → compare;
4. bank → movement/research → RBA context;
5. save product → My rates → edit scenario → calculator/projection/receipt;
6. online refresh to verified data;
7. relaunch offline with saved data;
8. forced partial fixture and missing optional asset;
9. sample-only first run;
10. Settings → About → notices/terms → App health → Debug log;
11. diagnostics consent/share confirmation and bounded receipt;
12. light/dark, reduced motion and screen reader.

### Visual matrix

Capture and review Today, Explore, Product, Compare, Changes, My rates, Settings, App health and Debug log at:

- 320 × 568, normal text;
- representative modern phone, normal text;
- representative phone, 200% text;
- tablet/wide window;
- light and dark appearance;
- remote-full, partial, offline-saved, sample and unavailable states.

Review for hierarchy, bespoke consistency, clipping, blank space caused by missing content, card regression, mixed icon families, unlabelled values and misleading status language.

## 13. Performance budgets

Set final numeric budgets from measured release-like baseline, then store them with device/profile context. At minimum enforce:

- useful content appears without an indefinite skeleton;
- tab/stack actions acknowledge immediately and settle within the recorded budget;
- search/filter/compare do not rescan the full catalogue on every render;
- charts do not parse/download data during render;
- inactive expensive tabs remain frozen or otherwise isolated;
- evidence mapping remains pure and O(provider failures/limitations), with detail truncation bounded;
- custom font/icon additions stay within the artifact-size guard;
- app-health probes do not materially distort the interaction they measure.

A budget breach is a result, not a reason to remove the probe. Keep correctness/data checks even when optimisation work is deferred.

## 14. Accessibility, privacy and financial-integrity gates

### Accessibility

- WCAG 2.2 AA contrast for text and controls;
- 48 dp targets;
- 200% font-scale reflow;
- named/role/state controls;
- screen-reader order and chart summaries;
- non-colour state cues;
- reduced motion;
- keyboard/focus support where available.

### Privacy

- no analytics or audit upload without existing consent boundary;
- no raw search, saved product, scenario, profile, route value, device model or stable installation ID in audit summary;
- Clarity remains limited to approved public browsing surfaces;
- sensitive, diagnostic, security and personal scenario surfaces remain excluded/masked;
- on-device storage failures never cause secrets or diagnostic envelopes to render in normal UI.

### Financial/data integrity

- no invented or stale-as-current rate;
- comparison rate remains default loan comparison metric when published;
- published `0%` is not treated as missing;
- no tier/term/eligibility flattening;
- failure/partial/sample/cache state visible;
- every ranking names its cohort and evidence;
- general information, not financial advice;
- confirm current terms with the lender.

## 15. Rollback and compatibility

- Keep legacy theme fields until migration is complete; they map to Rate Ledger colours so old screens remain readable.
- Version persisted app-health reports and tolerate/label the prior version.
- Preserve valid cache and saved-rate formats unless a separately tested migration is necessary.
- Retain route redirects for moved Trends/Settings entry points.
- Font-load failure falls back to system rendering and records a bounded diagnostic; it must not hold the splash forever.
- A failed optional asset degrades its own section, not the entire core app.
- Reverting visual foundations must not revert the SecureStore hotfix or data-integrity improvements.

## 16. Pull request and ship bar

When implementation is ready and PR work is authorised:

1. push topic branch and open/update one scoped PR;
2. include before/after visual matrix, data-state evidence and exact test output;
3. wait for required `mobile-ci` and `bot-feedback-gate`;
4. read all review threads before replying;
5. post one feedback plan, implement valid findings in one set, reply with `implemented`, `deferred` or `declined` plus evidence, and resolve substantive threads;
6. rerun gates after the final push;
7. use the repository merge wrapper only when merge is authorised;
8. do not declare release/runtime success from a merged PR or local export alone.

## 17. Definition of done

The redesign is complete only when all statements below are evidenced:

- The SecureStore warning no longer appears and the valid key path is tested.
- The four-destination IA is coherent; moved routes and deep links behave correctly.
- All user-facing routes use the Rate Ledger palette, typography, mark/icon grammar and shared primitives, with no unintended legacy card/UI islands.
- Every substantive data surface exposes accurate source/freshness/coverage state.
- Full, partial, saved, overdue, sample, offline and unavailable states are tested and visually reviewed.
- The app-health audit fails fast blank/wrong/missing displays as well as slow actions and produces privacy-bounded evidence.
- Rate types, tiers, fees, eligibility, missing values and history gaps retain their meaning.
- Android/iOS native journeys pass at normal and large text; reduced motion, dark appearance and screen reader are checked.
- `cd mobile && npm run ci` passes on the final content.
- Third-party binaries have pinned provenance, SHA-256 and licences; original local artwork is documented.
- The final AR-local producer contract has been diffed and a real published payload has been validated downstream without modifying AR-local/Pi.
- Any blocked production/runtime claim is labelled **BLOCKED** rather than inferred from local tests.

## 18. Implementation checklist

- [x] Record isolated AR-app base and baseline checks.
- [x] Fix and test SecureStore key.
- [x] Verify/bundle font assets, hashes and licences.
- [x] Land Rate Ledger tokens, mark, icons and primitives.
- [x] Land evidence mapper and state fixtures.
- [x] Migrate app shell, four-tab IA and redirects atomically.
- [x] Apply Rate Ledger typography, palette, controls and evidence grammar to core rate/bank/search/compare surfaces.
- [x] Apply the same system to Changes/RBA/research and chart containers.
- [x] Apply the same system to My rates/scenario/tools.
- [x] Apply the same system to onboarding/profile/settings/about/legal/diagnostics.
- [x] Extend app-health audit interaction and data/display axes.
- [ ] Complete physical Android/iOS, screen-reader and large-text matrices. Deterministic checks, a 390 x 844 web visual pass, an Android release-emulator smoke test and the full live-source Android audit are complete; physical devices, iOS, screen-reader and large-text native passes remain.
- [x] Validate the currently published v1 AR-local manifest, dates index and hashed core payload without modifying AR-local. The user explicitly removed waiting for a later producer state.
- [ ] Complete PR feedback/ship bar. Final local CI is green; this item closes only after remote review gates and merge settle.
