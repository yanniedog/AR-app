# Android redesign: route, capability, state and copy inventory

Initial native/source discovery was recorded 14 October 2026 against
`79f274b583ecb76daa9573c744ecfdb93c84750c`. The production source inventory and
copy appendix were refreshed against reviewed PR source
`7e4caee4e4fbd1957449c372761aece5cf6a7e5b`, based on
`c8893a39c65eaf7984c408a225a9a7f6ed86ed9b`. This includes the intervening audit
overlay/capacity and readiness changes. These source revisions are distinct from
the installed APK revisions below; a subsequent app-source push requires another
inventory reconciliation.
This is the Phase 1 inventory for the [Android redesign contract](ANDROID_REDESIGN_CONTRACT.md). Target behavior below is a contract for later phases,
not a claim that the app has changed or that native acceptance has passed.

## Scope and classification

The approved plan requires Rates, Saved and Market; Profile, Settings and About in
the account menu; no mandatory setup before browsing; zero normal-use directories;
and no explanatory application prose. Existing rate identity, monetary meaning,
conditions, unknowns, privacy choices and user state remain constraints.

- **Keep**: retain a distinct useful task as a canonical surface or structured fact.
- **Merge**: consolidate duplicate implementations/entry points into one task.
- **Contextualise**: open a useful focused task from the rate/content it concerns.
- **Remove**: delete an unnecessary user-facing container/choice/implementation.

A compatibility adapter is not a retained hidden directory. It must translate
parameters into the canonical task, consume them once, and introduce no extra
choice. Removing navigation must not remove the underlying financial capability.

All paths below are repository-relative. The `app/` paths include `mobile/`.

## Baseline and evidence boundary

Source has **five tabs** and **20 menu entries in six groups**. Rates has
`PREVIEW_COUNT = 5`; Market has five directory rows; Tools has five directory
rows. Source: `mobile/src/lib/tabIcons.ts`, `appDestinations.ts` under the same
`mobile/src/lib/` directory, and `mobile/app/(tabs)/{browse,market,tools}.tsx`.

Native baseline evidence is committed in
[the baseline artifact set](evidence/android-baseline-2026-10-14/README.md), with
[per-capture SHA-256, bytes, package, version/build and APK source revision](evidence/android-baseline-2026-10-14/manifest.json).
Use that repository-relative location to retrieve the exact set from this commit;
the original operator folder name was `ar-app-ux-review`. Historical captures use
published universal v1.0.237/build 295, Android 16/API 36.1, x86_64,
1080 x 2400, 420 dpi, font scale 1.0. It is older than the source revision above.
Its retained [published APK manifest](evidence/android-baseline-2026-10-14/v1.0.237-b295/published-apk-manifest.json)
identifies package `com.eyex.australianrates`, APK source
`947884a4daf0323c30401453de38d579e75b193d`, SHA-256 and the versioned download.
Use `12-rates`, `13-product-top`, `14-product-middle`, `15-product-saved`,
`16-saved`, `17-market`, `19-tools-hub`, `24-rates-bottom`,
`26-before-press`, `28-search-results` PNG/XML captures, the unpaired
`27-held-button.png` and `baseline-motion.mp4`. `05-fresh-ready.xml` records the
onboarding choices.
`24-rates-bottom.xml` records “See all 6243 home loans”; that control is absent
from the initial viewport in `12-rates.xml`. `28-search-results.xml` records
6243 results. Adjacent Budget Home Loan rows expose the same two visible metadata
fields; this does not establish duplicate source data.

Capture filenames are not proof of app identity: `10-home-fresh.xml` contains an
external search page, so it is excluded from app assertions. `capture.ps1` records
capture mechanics, not a timestamped action log. The host had a System UI startup
ANR; no reliable baseline completion time or frame-time measurements exist.
Competitor screenshots do not establish live competitor animation timings.

The separate [v1.0.239/build 296 capture](evidence/android-baseline-2026-10-14/v1.0.239-b296/phase1-settled.png)
was produced after the operator verified that published APK; its
[release manifest](evidence/android-baseline-2026-10-14/v1.0.239-b296/published-apk-manifest.json)
identifies source `f756137cddcb9a0a360b13150424af6f2ccea9bc` and exact APK bytes.
It shows onboarding, despite the filename; no paired hierarchy was retained.
It does not replace the historical v1.0.237 friction ledger or establish native
acceptance of source `7e4caee`. No APK or competitor artwork is committed here.

### Friction ledger: verified actions and gaps

Verified counts use the exact sequence reported by the native baseline operator,
with hierarchy evidence where available. Source-derived minima are marked and
must not be presented as measured totals. A route change is counted separately
from an interaction. Data-entry/calculation completion is not implied.

| Trigger -> verified end | Interaction taps | App route changes | Other observed effort | Target / outstanding measurement |
| --- | ---: | ---: | --- | --- |
| Fresh onboarding, default “Check my rate” already selected -> Calculator | 1 CTA + 1 “Not now” privacy choice = 2 | 1 | Job/type choices appear before entry; no verified amount/bank entry | Browse launch requires 0 setup choices/taps; measure fresh-install loading/offline and optional-consent placement |
| Active app -> Rates preview | 1 tab tap | 1 | Initial viewport is a five-row preview | Rates arrival is the full list |
| Rates -> first visible Budget Home Loan detail | 1 | 1 | Product top/middle captured | Already minimal; preserve 1 tap and distinguish exact variants |
| Product -> same exact rate saved | 1 Save tap | 0 | Header adds controls/factual lines after save | Already minimal; preserve 1 tap and stable row/header geometry |
| Saved product detail -> Saved list containing 1 rate | 1 tab tap | 1 | `16-saved.xml` contains the saved rate | Preserve exact tier and direct return; verify state/offset restoration |
| Rates preview -> full Search with 6243 products | 1 “See all” tap | 1 | Downward scroll needed to reach below-preview gate; exact scroll count/distance unrecorded | Remove the gate; 0 navigation taps from launch/full Rates arrival |
| Market arrival | Unmeasured; source minimum 1 tab tap | Source minimum 1 | Five link rows and their descriptions captured; complete action sequence not recorded | Movements/RBA facts visible on arrival; contextual taps measured later |
| Tools arrival | Unmeasured; source minimum 1 tab tap | Source minimum 1 | Five link rows and their descriptions captured; complete action sequence not recorded | Remove destination/container |
| Search -> Filter/Sort -> correct constrained result | Unmeasured | Unmeasured | Source exposes toolbar filter, comparison toggle and sort chips | Open in 1 tap; choose/apply on one surface; record all selections, typing, waits, Cancel and recovery |
| Compare 2 visible rates -> comparison | Unmeasured | Unmeasured | Source minimum: activation + 2 selections + Compare = 4 interactions; this is not a native measured total | At most 4 interactions, no directory/detail detour; measure incorrect selections and recovery |
| Contextual Calculate -> correct result / projections | Unmeasured | Unmeasured | Calculator/projections captured; input task not verified complete | 1 entry action; only required inputs; saved known values reused |
| Back from detail / switch tabs / interrupted filtering | Unmeasured | Unmeasured | Source has mounted-tab return logic; preservation not fully measured | No re-entry or lost query/filter/sort/offset; record native Back and interruption outcomes |

Complete native journey timings, typed-field counts, scroll counts, first-attempt
success and unassisted usability remain Phase 2/5 measurements. Do not replace
these gaps with invented totals or claim the Phase 1 friction exit gate is complete.

## Every route and handler

The public route omits `(tabs)`; group-qualified legacy links must still work.

| Current route / source under `mobile/app/` | Decision | Canonical user task / target | Compatibility and state contract |
| --- | --- | --- | --- |
| `/`; `index.tsx` | Merge | Launch directly into Rates | Wait for persisted hydration; remove `prefs.onboarded` browsing gate; do not clear stored choices |
| `/`; `(tabs)/index.tsx` | Remove | Home previews move to Saved/Market; Rates becomes landing | Thin legacy root adapter; no Home model/cards retained |
| `/browse`; `(tabs)/browse.tsx` | Merge | Full Rates results | Replace 5-row preview; legacy `section/path/request` consumed once as result scope, not pushed into a directory |
| `/search`; `search.tsx` | Merge | Same canonical Rates result implementation/state | Preserve `section,path,sort,scope,query,sub,compare`; repeated params use `scalarRouteParam`; subscription restore must be deterministic |
| `/watchlist`; `(tabs)/watchlist.tsx` | Keep | Saved exact tiers and entered rates | Retain saved/tracked identities, unavailable references, compare constraints, alerts, maturity/fixed-end editing and Undo |
| `/market`; `(tabs)/market.tsx` | Merge | RBA and actual dated movements on arrival | Replace directory; optional charts must not gate content shell or report fabricated readiness |
| `/tools`; `(tabs)/tools.tsx` | Remove | Contextual Calculate; account menu | Old link opens canonical Calculate/default section; no Tools overview |
| `/trends`; `(tabs)/trends.tsx` | Merge | Thin Market/research compatibility | Currently re-exports root `trends`; preserve group-qualified `focus=rba` |
| `/trends`; `trends.tsx` | Merge | Thin Outlook/Research adapter | Preserve current `focus=rba` semantics; avoid double redirect and extra stack entry |
| `/onboarding`; `onboarding.tsx` | Remove | Browse without a first-job/profile choice | Old link opens Rates; retain stored interests/consent; delete first-job UI, not privacy choices |
| `/matches`; `matches.tsx` | Merge | Profile needs and scenario constraints in Rates | Move valid eligibility/ranking/scenario-gap behavior before deleting duplicate results/hero; separate explicit scenario constraints from saved profile |
| `/categories`; `categories.tsx` | Merge | Facets on Rates list | Map section slug, dot path and request into facets/scope; empty path clears prior drill; never silently broaden unsupported taxonomy |
| `/node`; `node.tsx` | Merge | Same legacy-scope adapter | Currently key section + path -> slug/request -> Categories; collapse adapter chain to canonical Rates |
| `/banks`; `banks.tsx` | Merge | Provider search/facet | Retain provider matching and suitability; empty provider must clear previous scope; no lender directory |
| `/bank/[provider]`; `bank/[provider].tsx` | Contextualise | Bank facts/history from product or movement | Preserve opaque provider plus `date,section`; no bank-directory prerequisite |
| `/catalogue`; `catalogue.tsx` | Merge | Availability facet, including no listed rate | Search currently uses `RateRow[]`; details-only catalogue is a different source. Merge needs discriminated rows, real loading/eligibility and explicit unknown values; do not invent rates or rank nulls as zero |
| `/product/[key]`; `product/[key].tsx` | Keep | One rate/product detail | Preserve decoded opaque `key`, exact `ri`, fallback details-only products, eligibility gate, terms, facts, history, save and direct calculate/compare |
| `/compare`; `compare.tsx` | Keep | Focused comparison from selections | Preserve JSON `keys`, exact tier tokens, 2-4 same-category constraints, rates/fees/conditions; retain own controls on full-screen task |
| `/calculator`; `calculator.tsx` | Keep | Canonical calculation task | Preserve `section,intent`, required inputs, scenario-only LVR, secure storage status; contextual product selection must not silently overwrite entered current rate |
| `/projections`; `projections.tsx` | Merge | Projection mode within Calculate | Preserve `section,target,ri`, current/switch/target contracts, assumptions and chart models; thin legacy adapter; no duplicate scenario owner |
| `/calculation-receipt`; `calculation-receipt.tsx` | Contextualise | Open/recalculate/export a calculation receipt | Preserve unverified historical status, explicit source/scope choices, digest/current-source checks, bounds and no implicit profile writes |
| `/rate-receipt`; `rate-receipt.tsx` | Contextualise | Product/result receipt action | Preserve `key,ri`, known/unknown facts, current scenario and exact product identity |
| `/bank-rates`; `bank-rates.tsx` | Contextualise | Bank history from Market/bank | Reuse bank-rate history model; preserve section, metric, chart windows and real chart proof |
| `/passthrough`; `passthrough.tsx` | Merge | Movement feed in Market | Preserve decision `date`, completeness/status, exact event/bank links and native measured feed readiness |
| `/rba-response`; `rba-response.tsx` | Contextualise | Bank response from decision content | Preserve `date,section`, published decision/response semantics, include-non-standard scope and graphical evidence |
| `/rba`; `rba.tsx` | Contextualise | RBA detail/outlook from Market | Preserve decision dates, holds, unavailable/live-vs-cache distinctions, next meeting, forecast provenance |
| `/research`; `research.tsx` | Contextualise | Focused Market research/history | Preserve `focus`, chart mode/window/date and bank/economic/RBA models; avoid a second Market directory |
| `/profile`; `profile.tsx` | Keep | Optional needs/account preferences | One account-menu item; retain `prefs.profileFilters`; no profile-completion prerequisite or duplicate interest editor |
| `/settings`; `settings.tsx` | Keep | Appearance, permissions, privacy, updates, data/security | One account-menu item; preserve `focus,t` refresh intent; remove duplicate task-specific metric/interest configuration after canonical owner migration |
| `/about`; `about.tsx` | Keep | Version, sources/documents, diagnostics | One account-menu item; no feature/help directory substitutes for old menu |
| `/terms`; `terms.tsx` | Keep | Explicit legal/source document | Required source document boundary only; application intro/help prose still removed; privacy alias stays compatible |
| `/third-party-notices`; `third-party-notices.tsx` | Keep | Explicit licence documents | Notice text source boundary, identities/revisions/links; remove design-reference explanations and screen guidance |
| `/performance-audit`; `performance-audit.tsx` | Contextualise | Diagnostics under About | Preserve 10,000 ms step bound, user controls, raw+compact evidence and rollback; no diagnostic prose exception |
| `/debug-log`; `debug-log.tsx` | Contextualise | Diagnostic evidence under About | Preserve raw/export/upload/delete workflows and privacy choices; format UI statuses/rows separately from raw exported evidence |
| Unknown route; `+not-found.tsx` | Keep | Concise unavailable state + Rates recovery | Recovery targets actual Rates surface; do not keep `home.hub` expectation |
| Native intents; `+native-intent.tsx` | Keep | Bound/sanitize external links | Keep 2,048-char bound, `arrates` scheme, route allowlist, malformed/unsafe segment checks; product encoded slash exception; `/privacy` -> `/terms` |
| Root layout; `_layout.tsx` | Keep | One stack, tab shell, startup/privacy/update gates | Revise launch/back anchor, title, menu, breadcrumbs and overlay interactions together; preserve hydration, app lock, notifications, audit navigation snapshot and source readiness |
| Tab layout; `(tabs)/_layout.tsx` | Merge | Exactly three mounted roots | Initial tab becomes Rates; hide/remove compatibility routes from visible tabs; no duplicate root stack on tab navigation |

## Capability matrix beyond route names

| Capability / source | Decision and rationale | Target owner / necessary invariant |
| --- | --- | --- |
| Search, sort, provider/type/taxonomy/features/eligibility/fact facets; `search.tsx`, `FilterSheet.tsx`, `selectors.ts`, `searchFilterOptions.ts`, `productFacts.ts` | Merge; one discovery task | Rates; same eligibility, AND predicate semantics and query preparation; single sheet layer |
| No-rate product discovery; `detailsCatalogue.ts`, `useDetailsCatalogue.ts`, `DetailsOnlyProduct.tsx` | Merge; useful unknown facts | Rates availability facet + same Product; not `0%`, no synthetic `RateRow` |
| Profile matching and entered-rate gap; `matches.tsx`, `data/profile.ts`, `decisionInsights.ts`, `useUserRateScenario.ts` | Merge; duplicate ranking surface | Explicit Rates applied needs; Saved entered-rate result; calculator uses scenario constraints without mutating saved needs |
| Save/unsave, legacy favorites, exact tier alerts; `savedRates.ts`, `storeUser.ts`, `subscriptions.ts` | Keep; useful reversible action | Exact identity in Saved and in-place controls; retain migrated product-scope saves and unavailable tiers |
| Compare selections; `compareSelection.ts`, `compare.tsx`, `comparePresentation.ts` | Keep; distinct task | Shared token/selection contract; maximum four, same category, exact tier, zero confirmation for reversible selection |
| Search alerts/export; `notifications.ts`, `subscriptions.ts`, `SearchReportExport.tsx`, `filteredSearchSnapshot.ts`, `lib/exportSearchReport.ts` | Contextualise; preserve useful outputs | Explicit Alert / Export actions beside search; preserve published edition/basis and cancellation; no combined tools directory |
| Bank facts/history, exact product history; bank/product screens, `historySelectors.ts`, `productHistory.ts`, `productHistoryModel.ts`, history components | Contextualise; distinct evidence | Real chart data/render proof; no route detour to bank directory; date/window state preserved |
| RBA cash/holds/meeting calendar, movements, response; `rbaCalendar.ts`, `rbaOfficialLive.ts`, passthrough components | Merge/Contextualise; market value on arrival | Market feed + focused decision/response; dates, basis, coverage and unknown remain facts |
| Economic indicators and forecasts; `economicOutlook*.ts`, `rbaMarketOutlook*.ts`, `RbaOutlook.tsx`, economy/rba components | Contextualise; infrequent advanced research | One Market research task; preserve dataset/source/as-of distinctions; no provider narrative as interface copy |
| Mortgage buy/refinance, savings, term-deposit assumptions; calculator, `calc.ts`, `projectionScenario.ts`, scenario components | Keep/Merge; canonical calculation | One scenario owner; repeated known values reused; rates/fees/assumptions explicitly typed; example placeholders never actual inputs |
| Product-term eligibility and source verification; `EligibilityAssessment.tsx`, `EligibilityScenarioFields.tsx`, `ProductTermsRuntimeCheck.tsx`, eligibility/monetary/mortgage/activity contract adapters | Keep; correctness constraint | Structured assessment facts/status and reviewed scope; incomplete, unsupported, unknown and bank approval remain distinct |
| Savings activity/periods, fixed-deposit periods/comparison, mortgage periods/comparison; `product/{Activity*,Savings*,FixedDeposit*,Mortgage*}.tsx`, `productTermsEngine/*` | Contextualise; distinct calculations | Modes of canonical product/calculation task; preserve source applicability, required fields, dates, fees and no unsupported claims |
| Portfolio comparison/account allocation/negotiated terms; `Portfolio*.tsx`, `NegotiatedTermsEditor.tsx`, `CustomerProfilePanel.tsx`, portfolio/customer-profile data | Contextualise; distinct multi-account outcome | Canonical calculator advanced mode; secure local inputs, independent accounts/scopes, incomplete claims unavailable; no forced setup |
| Receipt replay/export; `receiptReplay/*`, `rateReceipt.ts`, receipt screens | Contextualise; reproducible output | Historical imported values unverified, explicit current-source re-evaluation, deterministic digest/bounds; no user text promoted to approved fact |
| Interest selection/order/default; Profile, Settings, onboarding, `interests.ts`, `storeTypes.ts` | Merge/Remove duplicate choices | Product types always directly reachable in Rates; retain persisted choices as optional defaults until migration decision; no separate required job/type setup |
| Advertised/comparison and ongoing/headline metric settings; Search, Settings, `selectors.ts`, `rateQualifier.ts` | Merge; one clear result basis choice | Rates Sort owns task basis; persisted preference remains single underlying value; never silently change financial meaning |
| Theme, notification threshold/subscriptions, wifi/update/cache, local data-key import, app lock; Settings and settings components | Keep; distinct preferences/control | Settings, with permissions at point of need; change harmless preferences directly; destructive/data loss choices remain explicit |
| Optional crash reports/session replay/log upload; root, `DiagnosticsConsentBanner.tsx`, `privacyPolicy.ts`, observability/debug sharing | Keep; privacy choices | Concise data/destination/visibility facts and actual choice; no optional gate before browsing; never infer consent from removing onboarding |
| APK download/install, update changelog, trusted external links/share QR | Contextualise/Keep; operational actions | Settings/update action, exact public/install target, origin confirmation and source version; retain error recovery and bytes state |
| Home, Tools, categories/lender/matches/no-rate directories; corresponding routes and `NavigationHub`, `HierarchyView`, `HomeHero`, `CategoryRow` | Remove containers after merges | Delete obsolete implementations/spacing/branches; adapters only; no 20-item overflow replacement |

## Current state owners and canonical migration

| State | Current exact owner | Migration rule |
| --- | --- | --- |
| Query, sort, filters, comparison mode/tokens | Local React state in `app/search.tsx`; restored subscription in `data/store.ts`/`subscriptions.ts` | One canonical Rates result controller, section-specific state; adapters send an entry intent; no second Search local model. Preserve query/sort/filter/offset across detail and tab returns |
| Prepared/filter-option models | `usePreparedSearchRows.ts`, `useSearchFilterOptions.ts`, `data/selectors.ts`; core/details/search index in store | Reuse, do not duplicate row filtering/ranking to make a preview; same-day SHA/suitability revision must invalidate current results |
| Filter draft/disclosure/provider query | Local `FilterSheet.tsx`: draft seeded on visible open, deferred result count | Cancel commits nothing; Apply commits once. External filter updates while sheet open must have explicit ownership rather than silently reset draft |
| Product family | Store `activeSection`, persisted `prefs.defaultSection/interests`; Search route param default Mortgage; Categories and Research also own local section | Rates canonical section can always select all types; Market local section must not move Rates; explicit link section overrides a default once |
| Profile needs | Persisted `prefs.profileFilters`; Profile/Settings/onboarding related choices | Optional saved defaults, one editor; session override distinguishable; a Calculate LVR does not rewrite profile |
| Save identity | Store `savedRates`; `data/savedRates.ts` exact/product scope; `trackedRates.ts` secure queue; migrated `favorites` | Do not replace product+rateIndex with product-only identity; retain unavailable references until explicit removal |
| Current rate/balance/bank/calculation inputs | Shared external-store `hooks/useUserRateScenario.ts` + secure `data/userRateScenario.ts`; product/portfolio profile data separately in `customerProfileStorage.ts` | Keep these authoritative sources; hydrate before edits, serialize saves, flush before task transitions, preserve user-vs-default/provenance; do not duplicate persisted scenario for new front end |
| Comparison scope | Local selection in Search/Saved; `data/compareSelection.ts`; JSON keys route | Canonical exact token contract; same-category/maximum guard; no comma-split keys; back restores selection |
| Publication/status/integrity/eligibility | `data/store.ts`, `storeEnsure.ts`, `storeRefresh.ts`, `suitabilityGate.ts`, `eligibilityGate.ts`, payload/contract adapters | Missing is unknown; standard/suitable filters fail honestly while details pending; core date/service state alone is not completeness |
| Market chart windows/lenses/rewind/date | Local state in Research/RBA/passthrough/history components; optional asset store state | Reuse canonical chart models, preserve each focused task state; optional chart loading cannot delay initial Market facts |
| Tab/Back history | Expo navigation state; `lib/primaryNavigation.ts` returns via `router.dismissTo`; root/tab `unstable_settings` | Preserve mounted navigator/key/nested state; no duplicate `(tabs)` route; sheet/keyboard Back first, actual caller next; cold links get real Rates/Market ancestry |
| Audit restoration/readiness | `performanceAuditNavigation.ts`, readiness hooks, `PerformanceAuditRunner.tsx` | Preserve complete hydrated outer `__root` snapshot; validate before restoring; never restore stale/replaced navigator |

### Retire onboarding completion without changing consent

`prefs.onboarded` currently mixes UI access, startup presentation, history scope
and audit preparation. Phase 3 retires its gating meaning atomically; changing
only the root redirect is insufficient. The flag is **not privacy consent**.

1. After persisted preferences hydrate, both fresh and existing users may access
   Rates/Saved/Market and the account controls. Navigation readiness derives from
   hydration, route/task presentation and actual data state, not `onboarded`.
2. Existing `interests`, `defaultSection`, profile filters, saved/subscription
   identities and entered scenarios survive unchanged. All three product types
   remain directly selectable; legacy interests become optional defaults, never
   access controls. Missing/invalid preferences use existing normalization; do
   not rewrite an existing user selection as part of the redirect.
3. Preserve `crashReportsEnabled`, session-replay settings, `privacyChoiceVersion`
   and explicit prior decisions. Fresh missing privacy choices remain undecided;
   never set consent/version, grant permissions or enable telemetry merely to
   remove onboarding. The actual optional choice remains accessible after the
   browse shell renders, without blocking results. App-lock choices survive too.
4. Stop new writes to `onboarded` and remove it from `DEFAULT_PREFS`/the active
   `Prefs` schema when the consumers below migrate. Old persisted objects may
   contain the obsolete field; hydration ignores it without resetting other
   preferences. `completeOnboarding` and the old first-job/setup mutations become
   removable implementation, while `/onboarding` remains a thin compatibility
   adapter. An audit fixture must not resurrect the retired flag as UI access.

Every current consumer must change in the same migration:

| Consumer | Atomic replacement |
| --- | --- |
| `app/index.tsx`, `app/onboarding.tsx`, `data/storeTypes.ts`, `data/storeUser.ts` | Hydration -> Rates for both flag values; retire default/schema/completion writes and mandatory setup |
| `components/AppTabBar.tsx`, `AppNavigationMenu.tsx`, `AppBreadcrumbBar.tsx`; `lib/tabRouting.ts`, `breadcrumbs.ts`; both layouts | Navigation available from hydrated browsing; retain only route-specific focused-task exclusions |
| Root branded-splash morph and `DiagnosticsConsentBanner` visibility in `app/_layout.tsx` | Startup/surface readiness and actual privacy-choice state independently; no onboarding prerequisite or inferred consent |
| `hooks/useBankRateHistory.ts`, `data/bankRateHistoryScope.ts`, `storeBankRateHistory.ts`, `components/passthrough/BankRatesPanel.tsx` | Explicit optional interest/section scope, with all product types reachable; preserve profile/eligibility semantics independently of completed setup |
| `components/PerformanceAuditRunner.tsx`, `lib/performanceAuditProfile.ts`, affected readiness/navigation/history tests | Hydrated canonical app readiness and explicit fixtures; restore interests/consent exactly; never enable privacy options as audit setup |

Acceptance covers fresh defaults; old persisted `onboarded=false` and `true`;
absent/invalid obsolete fields; explicit diagnostics acceptance/decline; and
undecided privacy state. Verify navigation, history scope, splash completion,
choice visibility and audit restoration for each case, with no profile reset or
automatic telemetry/notification activation.

### Compatibility acceptance matrix

Exercise both cold external entry and already-mounted navigation for `/`,
`/(tabs)`, `/tools`, `/(tabs)/tools`, `/search`, `/browse`, `/categories`, `/node`,
`/banks`, `/catalogue`, `/matches`, `/trends`, `/(tabs)/trends`, `/privacy`,
`/onboarding`,
product/receipt/bank/compare/calculator/projection and notification entries.

For both cold and mounted `/onboarding` entry, assert direct canonical Rates
arrival with no first-job/setup questions, no repeated redirect and no lost
navigation history. Stored interests, default section, profile/saved/scenario
state and explicit privacy choices survive; undecided consent remains undecided.
Repeat with old persisted `onboarded=false`, `true` and no flag. Back must recover
the canonical existing browsing context rather than reopen mandatory setup.

Include empty path/provider/query resets; section keys and slugs; repeated params;
invalid section/sort; hierarchy scope; current and unavailable subscriptions;
JSON compare keys with commas; product keys containing literal percent, comma and
encoded slash; exact `ri`; bank date/section; forecast focus; projection target;
malformed/oversized native input. Query/state adapters must not widen a rate tier,
drop a notification's saved scope, replace a receipt's source identity or fork state.

## Audit contracts to change atomically with navigation

Source: `lib/performanceAudit.ts`, `performanceAuditPlan.ts`,
`components/PerformanceAuditRunner.tsx`, `hooks/usePerformanceAuditReadiness.ts`.

| Current route / surface / action | Required migration evidence |
| --- | --- |
| `/` / `home.hub` / `home.open`, `home.rates.open`, `redirect.root.verify`, `not-found.home` | Retarget launch/recovery to actual Rates path+surface; remove obsolete Home journey |
| `/browse` / `rates.hub` / `rates.open`, `rates.categories.open` | Actual full result model, eligibility, native list layout/commit/measured visible rows and logos; remove category-directory journey |
| `/search` / `search.results` / query, sort, filters, comparison actions | Reuse `search.data/list/layout/filters/logos` probes on canonical Rates; legacy adapter must not register a phantom successful surface |
| `/tools` / `tools.hub` / `tools.open`, `tools.calculator.open` | Replace with contextual calculator action and real `calculator.results` probes |
| `/market` / `market.hub` / `market.open`, `market.outlook.open` | Real Market content data/layout/feed and optional graphics where mounted; hub's constant-ready model is insufficient |
| `/categories` / `browse.hierarchy`; `/banks` / `lenders.list`; `/matches` / `today.hero` | Reconcile migrated capability actions on Rates/Saved; delete obsolete path tests without dropping capability/eligibility checks |
| `/watchlist` / `saved.list`; `/product/[key]` / `product.details`; `/compare` / `compare.table`; `/rate-receipt` / `receipt.evidence` | Preserve data/exact identities/layout/visible content/logo/storage/graphic proof after visual change |
| `/calculator` / `calculator.results`; `/projections` / `projections.inputs`, `projections.lifecycle-chart` | Retain storage, input/model and chart evidence in canonical Calculate modes |
| `/passthrough` / `changes.feed`; bank history / `bank-rates.dashboard`; Research / `outlook.dashboard`, `outlook.economy`, `outlook.rba-response`; RBA / `rba.dashboard` | Keep real mounted feed/graphic prerequisites and truthful unavailable/skip classification; synchronize moved path/action ownership |
| Profile/Settings/About/Terms/log/audit local surfaces | No prose exception; same local hydration, privacy and rollback contracts |

Keep the strict **10,000 ms per step**. A registered control, route arrival,
layout callback or nonempty model alone cannot prove visible/native readiness.
Do not report deleted screens as exercised via immediate successful redirects.

Focused contract tests currently include `tabRouting`, `tabIcons`,
`primaryNavigation`, `appDestinations`, `appNavigationMenu`, `breadcrumbs`,
`nativeIntent`, `notifications`, `browseRoute`, `performanceAuditNavigation`,
`performanceAudit`, `performanceAuditPlan`, research-audit and Search/Saved/
product eligibility/readiness suites. Resolve their actual filenames before
execution. Canonical verification `cd mobile && npm run ci` passed on the phase-1
content on 14 October 2026: 322 Jest suites / 3,712 tests, 250 Node script tests,
typecheck, lint, Expo doctor (18/18), export and size checks for Android, iOS and web.
The Windows run used Git Bash on PATH for portable shell tests. GitHub `mobile-ci`
also passed. These checks establish repository verification; native redesign
acceptance and the final public APK remain later-phase requirements.

## Copy producer inventory and source boundaries

The final guard must cover visible and accessible output, including hidden/collapsed
content, empty/error/loading/offline/permission states, dialogs, chart labels,
exports and notifications. The inventory below identifies sources, not exemptions.
Allowed UI text is an action, field/result/state/identity label, user-entered value,
or necessary verified fact. Short sentences, split JSX, arbitrary factories/casts,
imported constants and dynamic producer strings are not safe merely because they
are short or outside a screen file.

| Producer family | Exact source paths / sinks | Migration and retained facts |
| --- | --- | --- |
| Shared text/control props | `components/ui.tsx`, `ledger/{LedgerText,LedgerSection,LedgerRow,LedgerField,LedgerAction,LedgerTabs,LedgerSheet}.tsx`, `OptionCard.tsx`, `NavigationHub.tsx`, `controls.tsx`, `ToolbarIconButton.tsx`, `TouchTarget.tsx` | Remove description/subtitle/deck/helper/instructional hint APIs, not just callers. Names and factual metadata use narrow approved provenance; preserve 48dp bounds |
| Screen/layout static text | Every text-bearing route in the appendix; root/headers/menu/breadcrumbs | Labels, fields and state only; delete obsolete containers/spacing; no untranslated strings hiding in header options |
| Loading/error/empty/recovery | `feedbackPlaceholders.tsx`, `feedbackProgress.tsx`, `feedbackBanner.tsx`, `feedbackSnackbar.tsx`, `ErrorScreen.tsx`, `DataUnavailableScreen.tsx`, `ChartErrorBoundary.tsx`, `ScenarioRecoveryBanner.tsx`, `Snackbar.tsx`, `lib/{dataUnavailableCopy,savedEmptyState,productHistoryCopy,calculatorIssues}.ts` | No raw `Error.message`, arbitrary stored/server text or process explanations in interface; concise status+recovery action; preserve unavailable/stale/sample/partial/error distinctions |
| Provider identity/marketing/raw published wording | `types.ts` ProductDetail/fee/condition text; `data/{detailsCatalogue,detailSearch,detailsCacheText,feePresentation,rateConditions,productTerms}.ts`; `product/{DetailsOnlyProduct,ProductDetailParts,RateConditionsDisclosure,ProductTermsDisclosure}.tsx`; product/catalogue screens | Product/provider identity accepted independently; description/additionalInfo/additionalInfoUri cannot flow into ordinary UI. Conditions remain structured exact-scope facts; do not hide a material financial condition to remove prose |
| Rate, tier, date and ranking labels | `constants.ts`, `data/{format,ratePresentation,lvrTier,selectors,interests,profile,displayEvidence}.ts`, `lib/{rateQualifier,comparePresentation}.ts`, `ProductCard.tsx`, `product/ProductRateChangeLine.tsx`, `ledger/{RateFigure,DataEvidenceLine,ChangeIndicator}.tsx` | Preserve advertised/comparison/ongoing/conditional meaning, tier/term/balance/LVR/purpose, update date, comparison basis and unknowns |
| Calculations, evidence, issues and receipts | `data/{calc,decisionInsights,projectionScenario,rateReceipt,customerProfile,userRateScenario,canonicalTermsComparison}.ts`, `data/receiptReplay/*`, `data/*Contracts/{adapter,validation,facts,transport}*.ts`, `lib/productTermsEngine/*`, scenario/product/replay components | Structured assumptions, units, provenance, checked scope and incomplete/unsupported/unverified states. Receipt `resultSummary` and raw imported scalars are untrusted display sources; no general string pass-through |
| Notifications and subscription labels | `data/{notifications,subscriptions}.ts`, `SubscriptionRow.tsx`, Search/Product/Saved notification dialogs | Title/body are native app output; convert prose templates to dated rate/status facts; keep exact product/tier/search scope and optional permission decision |
| Native dialogs and OS handoff | Dialog file index below; `ExternalLinkConfirmation.tsx`, `ShareQrModal.tsx`, update/security components; platform share/install/notification/biometric APIs | App-supplied title/message/button/accessibility strings obey guard; OS-owned text recorded separately, not claimed as removable application copy. Preserve destination/origin, destructive action/data loss and permission facts |
| Privacy/consent/security | `lib/{privacyPolicy,observability,appLock,keyVault,debugLogSharing,diagnosticsEnvelope,trustedExternalUrl,installPermission}.ts`, root, `DiagnosticsConsentBanner.tsx`, `AppLockGate.tsx`, `settings/{AccountSecurityRows,DataKeyImport}.tsx` | Concise data/destination/visibility facts beside choice; no reassurance/helper prose; preserve versioned consent, encrypted storage and app lock recovery |
| Market/history/chart/economic text | `RbaOutlook.tsx`, `RbaCountdownCard.tsx`, `BankInsights.tsx`, `MarketSnapshot.tsx`, `Ribbon.tsx`, `charts*`, `viz/*`, `economy/*`, `rba/*`, `passthrough/*`; `data/{bankInsights,bankInsightsQuery,rbaCalendar,rbaMarketOutlook*,economicOutlook*,historySelectors,productHistory,productHistoryModel}.ts` | Structured axes/date/window/series/status/source labels; external forecast/releases/notes need curated factual display; raw provider narrative is not UI copy |
| App update and changelog | `AppUpdateBanner.tsx`, `settings/AppUpdateSection.tsx`, `lib/{appUpdate,appUpdateLogic,appUpdateDownload,appUpdateInstall,changelog,releaseTransport}.ts` | Version/bytes/progress/channel/status/action facts; remote release notes and raw errors cannot enter ordinary UI unchecked |
| Reports, share and exported receipts | `SearchReportExport.tsx`, `lib/{exportSearchReport,searchReportPdf,searchReportTables,searchReportWorkbook}.ts`, `data/{filteredSearchSnapshot,rateReceipt}.ts`, `data/receiptReplay/tdExport.ts` | Preserve factual output, data/source basis and export consent. App-generated text outside React/JSX remains in scope |
| Audit/log/diagnosis | `PerformanceAuditRunner.tsx`, `PerformanceAuditOverlay.tsx`, `AuditCatalogueCoverage.tsx`, `BackgroundWorkDiagnosis.tsx`, `DebugLogUploadStatus.tsx`, debug/audit screens, `lib/{debugLog,degradationLog,performanceAuditCapacity,performanceAuditTiming,performanceAudit*,passiveAudit*,appHealth*}.ts` | UI shows structured result/status/count/time facts. Overlay paused text, dynamic progress labels and estimate/capacity/error producers are explicitly in scope. Raw evidence stays complete in explicit export/document boundary; arbitrary log/server error rendered as prose is not an exemption |
| Legal/licence documents | `terms.tsx`, `third-party-notices.tsx`, `lib/privacyPolicy.ts`, `src/content/thirdPartyNotices.ts` | Narrow explicit legal/licence/source document boundary. No screen help, design-reference descriptions, decks or general app explanations accepted by location alone |

### Native dialog index

Current production `Alert.alert` producers found by source scan:

- `mobile/app/(tabs)/watchlist.tsx`: compare constraints, notifications, date validation.
- `mobile/app/search.tsx`: compare constraints, notifications/subscription state.
- `mobile/app/product/[key].tsx`: notification permission.
- `mobile/app/settings.tsx`: notifications, cache clearing, diagnostics/replay choices.
- `mobile/app/_layout.tsx`: cold-start privacy/crash-report choice.
- `mobile/app/debug-log.tsx`: clear/copy/share/upload/delete and exception messages.
- `mobile/app/performance-audit.tsx`: reports/share/upload and exception messages.
- `mobile/src/components/AppUpdateBanner.tsx`: update failures/installation confirmation.
- `mobile/src/components/settings/AppUpdateSection.tsx`: update/install failure/confirmation.
- `mobile/src/components/settings/AccountSecurityRows.tsx`: local security decisions.
- `mobile/src/components/SubscriptionRow.tsx`: subscription removal label/message.
- `mobile/src/components/SearchReportExport.tsx`: publication choice/export failure.
- `mobile/src/lib/appUpdateDownload.ts`: install/update native alert and dynamic failure text.

All app-owned Modal/Sheet messages and accessibility labels/hints are additionally
included in the appendix, even when not implemented with `Alert.alert`. The native
notification body originates in `data/notifications.ts`; clipboard/share/report
text is also an output sink. OS permission/install/share/biometric labels are not
authored here; test their placement and do not call them application-prose cleanup.

## Remaining evidence and implementation dependencies

1. Complete baseline/native pilot friction measures and unassisted usability;
   current captures do not quantify all task completion, time, typing or recovery.
2. Phase 2 pilot must establish native density, stable Save geometry, motion,
   reduced motion, 48dp targets, font scaling and fact clarity before expanding.
3. Merge details-only products into the canonical result discriminated model;
   `queryAndSort(RateRow[])` cannot provide the availability facet alone.
4. Specify section-specific result state and single-use scope-intent adapter;
   update routing, breadcrumbs, notifications and audit actions atomically.
5. Consolidate scenario/portfolio/product input modes without losing encrypted
   storage, source applicability or necessary fields; repeated inputs need a
   documented reuse/override rule.
6. The copy source scan is deliberately conservative. A complete transitive
   provenance guard and rendered/accessibility inspection are still required;
   listing a candidate is not proof every branch/value meets the policy.
7. Source revision and installed baseline APK differ. Reinstall exact pilot bytes
   for after-measurement; no claim of public release or physical haptic acceptance.

Reviewed perspectives: navigation/UX, front end, financial facts and data identity,
privacy, accessibility, compatibility, state ownership, maintainability, documentation
and native QA. No backend/Pi/ingest/systemd changes are part of this document.

## Source-scan appendix

The entries below are production candidates refreshed from reviewed source
`7e4caee4e4fbd1957449c372761aece5cf6a7e5b`, not the historical APK. The
JSX scan covers text components, common text-bearing/accessibility props and native
alerts. The dynamic scan additionally indexes TS producers of text/status/reason/
error/remote descriptions and diagnostic benchmarkEvidence. It is an inventory input, not a semantic allowlist.

### JSX/native text sink candidates

| Source | First matching line |
| --- | ---: |
| mobile/app/_layout.tsx | 233 |
| mobile/app/(tabs)/browse.tsx | 77 |
| mobile/app/(tabs)/index.tsx | 70 |
| mobile/app/(tabs)/market.tsx | 13 |
| mobile/app/(tabs)/tools.tsx | 19 |
| mobile/app/(tabs)/watchlist.tsx | 228 |
| mobile/app/+not-found.tsx | 39 |
| mobile/app/about.tsx | 23 |
| mobile/app/bank/[provider].tsx | 70 |
| mobile/app/banks.tsx | 229 |
| mobile/app/calculation-receipt.tsx | 23 |
| mobile/app/calculator.tsx | 559 |
| mobile/app/catalogue.tsx | 18 |
| mobile/app/compare.tsx | 190 |
| mobile/app/debug-log.tsx | 133 |
| mobile/app/matches.tsx | 476 |
| mobile/app/onboarding.tsx | 217 |
| mobile/app/passthrough.tsx | 209 |
| mobile/app/performance-audit.tsx | 269 |
| mobile/app/product/[key].tsx | 513 |
| mobile/app/profile.tsx | 104 |
| mobile/app/projections.tsx | 129 |
| mobile/app/rate-receipt.tsx | 31 |
| mobile/app/rba-response.tsx | 79 |
| mobile/app/rba.tsx | 160 |
| mobile/app/research.tsx | 445 |
| mobile/app/search.tsx | 302 |
| mobile/app/settings.tsx | 182 |
| mobile/app/terms.tsx | 49 |
| mobile/app/third-party-notices.tsx | 12 |
| mobile/src/components/AppBreadcrumbBar.tsx | 104 |
| mobile/src/components/AppLockGate.tsx | 131 |
| mobile/src/components/AppNavigationMenu.tsx | 56 |
| mobile/src/components/AppTabBar.tsx | 69 |
| mobile/src/components/AppUpdateBanner.tsx | 153 |
| mobile/src/components/ArMarkLogo.tsx | 6 |
| mobile/src/components/AuditCatalogueCoverage.tsx | 26 |
| mobile/src/components/BackgroundWorkDiagnosis.tsx | 10 |
| mobile/src/components/BankAvatar.tsx | 112 |
| mobile/src/components/BankHistoryChart.tsx | 265 |
| mobile/src/components/BankInsights.tsx | 97 |
| mobile/src/components/BrandLockup.tsx | 97 |
| mobile/src/components/CategoryRow.tsx | 59 |
| mobile/src/components/ChartErrorBoundary.tsx | 30 |
| mobile/src/components/charts.tsx | 175 |
| mobile/src/components/charts/ChartSliceControls.tsx | 114 |
| mobile/src/components/charts/ChartText.tsx | 12 |
| mobile/src/components/controls.tsx | 96 |
| mobile/src/components/CustomerProfilePanel.tsx | 35 |
| mobile/src/components/DataUnavailableScreen.tsx | 57 |
| mobile/src/components/DebugLogUploadStatus.tsx | 27 |
| mobile/src/components/DiagnosticsConsentBanner.tsx | 34 |
| mobile/src/components/economy/EconomicChartFrame.tsx | 153 |
| mobile/src/components/economy/EconomicExplorer.tsx | 139 |
| mobile/src/components/economy/EconomicReleasesList.tsx | 56 |
| mobile/src/components/economy/MomentumChart.tsx | 39 |
| mobile/src/components/ErrorScreen.tsx | 39 |
| mobile/src/components/ExternalLinkConfirmation.tsx | 53 |
| mobile/src/components/feedbackBanner.tsx | 184 |
| mobile/src/components/feedbackPlaceholders.tsx | 29 |
| mobile/src/components/feedbackProgress.tsx | 83 |
| mobile/src/components/feedbackSnackbar.tsx | 110 |
| mobile/src/components/FilterSheet.tsx | 162 |
| mobile/src/components/HierarchyView.tsx | 286 |
| mobile/src/components/HomeHero.tsx | 99 |
| mobile/src/components/icons/LedgerIcon.tsx | 234 |
| mobile/src/components/ledger/ChangeIndicator.tsx | 35 |
| mobile/src/components/ledger/DataEvidenceLine.tsx | 52 |
| mobile/src/components/ledger/LedgerAction.tsx | 49 |
| mobile/src/components/ledger/LedgerField.tsx | 34 |
| mobile/src/components/ledger/LedgerRow.tsx | 41 |
| mobile/src/components/ledger/LedgerSection.tsx | 40 |
| mobile/src/components/ledger/LedgerSheet.tsx | 58 |
| mobile/src/components/ledger/LedgerTabs.tsx | 30 |
| mobile/src/components/ledger/LedgerText.tsx | 87 |
| mobile/src/components/ledger/RateFigure.tsx | 27 |
| mobile/src/components/MarketSnapshot.tsx | 41 |
| mobile/src/components/NavigationHub.tsx | 35 |
| mobile/src/components/NegotiatedTermsEditor.tsx | 31 |
| mobile/src/components/OptionCard.tsx | 35 |
| mobile/src/components/passthrough/BankPatternRow.tsx | 38 |
| mobile/src/components/passthrough/BankRateChart.tsx | 73 |
| mobile/src/components/passthrough/BankRatesPanel.tsx | 83 |
| mobile/src/components/passthrough/BankResponseDashboard.tsx | 30 |
| mobile/src/components/passthrough/MortgageSavingsSpreadChart.tsx | 40 |
| mobile/src/components/passthrough/ResponseComposition.tsx | 12 |
| mobile/src/components/passthrough/ResponseScatter.tsx | 84 |
| mobile/src/components/passthrough/ResponseWindowHeader.tsx | 29 |
| mobile/src/components/PerformanceAuditOverlay.tsx | 40 |
| mobile/src/components/product/ActivityEvents.tsx | 11 |
| mobile/src/components/product/ActivityPeriodCalculation.tsx | 24 |
| mobile/src/components/product/ActivityPeriodForm.tsx | 32 |
| mobile/src/components/product/CanonicalTermsComparison.tsx | 20 |
| mobile/src/components/product/ComparisonDisclosures.tsx | 25 |
| mobile/src/components/product/DepositCohorts.tsx | 21 |
| mobile/src/components/product/DepositCriteria.tsx | 10 |
| mobile/src/components/product/DepositInputFields.tsx | 31 |
| mobile/src/components/product/DepositSource.tsx | 11 |
| mobile/src/components/product/DetailsOnlyProduct.tsx | 19 |
| mobile/src/components/product/EligibilityAssessment.tsx | 29 |
| mobile/src/components/product/FixedDepositCalculation.tsx | 28 |
| mobile/src/components/product/FixedDepositComparison.tsx | 30 |
| mobile/src/components/product/MortgageComparison.tsx | 31 |
| mobile/src/components/product/MortgagePeriodCalculation.tsx | 24 |
| mobile/src/components/product/MortgagePeriodForm.tsx | 23 |
| mobile/src/components/product/PortfolioAccountEditor.tsx | 38 |
| mobile/src/components/product/PortfolioComparison.tsx | 18 |
| mobile/src/components/product/ProductDetailParts.tsx | 70 |
| mobile/src/components/product/ProductRateChangeLine.tsx | 81 |
| mobile/src/components/product/ProductTermsDisclosure.tsx | 28 |
| mobile/src/components/product/RateConditionsDisclosure.tsx | 12 |
| mobile/src/components/product/SavingsPeriodCalculation.tsx | 24 |
| mobile/src/components/product/SavingsPeriodForm.tsx | 26 |
| mobile/src/components/ProductCard.tsx | 156 |
| mobile/src/components/ProductTermsRuntimeCheck.tsx | 22 |
| mobile/src/components/ProfileEditor.tsx | 86 |
| mobile/src/components/projections/LifecycleChart.tsx | 225 |
| mobile/src/components/PulseDayMovers.tsx | 45 |
| mobile/src/components/RateMark.tsx | 28 |
| mobile/src/components/rba/RateOutlookChart.tsx | 70 |
| mobile/src/components/RbaCountdownCard.tsx | 69 |
| mobile/src/components/RbaOutlook.tsx | 83 |
| mobile/src/components/receiptReplay/ReplayAccount.tsx | 17 |
| mobile/src/components/Ribbon.tsx | 47 |
| mobile/src/components/scenario/CurrentBankPicker.tsx | 68 |
| mobile/src/components/scenario/ProjectionSummary.tsx | 35 |
| mobile/src/components/scenario/StaySwitchChart.tsx | 70 |
| mobile/src/components/scenario/SwitchCostEditor.tsx | 42 |
| mobile/src/components/ScenarioRecoveryBanner.tsx | 37 |
| mobile/src/components/SearchReportExport.tsx | 15 |
| mobile/src/components/settings/AccountSecurityRows.tsx | 17 |
| mobile/src/components/settings/AppUpdateSection.tsx | 117 |
| mobile/src/components/settings/DataKeyImport.tsx | 37 |
| mobile/src/components/settings/settingsUi.tsx | 13 |
| mobile/src/components/ShareQrModal.tsx | 89 |
| mobile/src/components/Snackbar.tsx | 47 |
| mobile/src/components/SubscriptionRow.tsx | 28 |
| mobile/src/components/SwipeableRow.tsx | 39 |
| mobile/src/components/ToolbarIconButton.tsx | 30 |
| mobile/src/components/ui.tsx | 50 |
| mobile/src/components/viz/HistoryExplorer.tsx | 127 |
| mobile/src/components/viz/LenderRaceChart.tsx | 123 |
| mobile/src/components/viz/MarketSeismograph.tsx | 81 |
| mobile/src/components/viz/RateHeatCalendar.tsx | 48 |
| mobile/src/components/viz/RbaResponseScatter.tsx | 56 |
| mobile/src/components/viz/SwitcherEdgeChart.tsx | 84 |

### Dynamic/constants/error/remote text producer candidates

Some candidates produce internal diagnostics or validation only. Their path to a visible/accessibility/notification/export sink must be traced before classification; never whitelist the entire source directory.

| Source | First matching line |
| --- | ---: |
| mobile/src/components/bannerState.ts | 9 |
| mobile/src/constants.ts | 5 |
| mobile/src/contracts/v3/canonicalCoreAdapter.ts | 173 |
| mobile/src/contracts/v3/contractPrimitives.ts | 11 |
| mobile/src/contracts/v3/validators.ts | 55 |
| mobile/src/data/access.ts | 38 |
| mobile/src/data/activityContracts/adapter.ts | 17 |
| mobile/src/data/activityContracts/transport.ts | 24 |
| mobile/src/data/activityContracts/validation.ts | 10 |
| mobile/src/data/assetState.ts | 13 |
| mobile/src/data/bankInsightsQuery.ts | 213 |
| mobile/src/data/bankRateHistorySync.ts | 146 |
| mobile/src/data/bankSpreadContentCache.ts | 83 |
| mobile/src/data/cache.ts | 62 |
| mobile/src/data/customerInputRequirements.ts | 15 |
| mobile/src/data/customerProfile.ts | 7 |
| mobile/src/data/customerProfileMigration.ts | 15 |
| mobile/src/data/customerProfileStorage.ts | 11 |
| mobile/src/data/datesIndex.ts | 29 |
| mobile/src/data/detachedHistoricalBankRateCatalogue.ts | 75 |
| mobile/src/data/detachedHistoricalBankRateReady.ts | 74 |
| mobile/src/data/detachedHistoricalCatalogueBytes.ts | 25 |
| mobile/src/data/detailsCacheText.ts | 14 |
| mobile/src/data/detailsCatalogue.ts | 18 |
| mobile/src/data/detailSearch.ts | 43 |
| mobile/src/data/displayEvidence.ts | 22 |
| mobile/src/data/economicModels.ts | 17 |
| mobile/src/data/economicOutlook.ts | 72 |
| mobile/src/data/economicOutlookParse.ts | 60 |
| mobile/src/data/economicOutlookSignal.ts | 29 |
| mobile/src/data/economicOutlookTypes.ts | 10 |
| mobile/src/data/eligibilityContracts/adapter.ts | 18 |
| mobile/src/data/eligibilityContracts/facts.ts | 10 |
| mobile/src/data/eligibilityContracts/schemaValidation.ts | 50 |
| mobile/src/data/eligibilityContracts/transport.ts | 22 |
| mobile/src/data/eligibilityContracts/types.ts | 6 |
| mobile/src/data/eligibilityContracts/validation.ts | 10 |
| mobile/src/data/executableContracts/depositComparison.ts | 18 |
| mobile/src/data/executableContracts/instantiate.ts | 13 |
| mobile/src/data/executableContracts/schemaValidation.ts | 42 |
| mobile/src/data/executableContracts/transport.ts | 16 |
| mobile/src/data/executableContracts/types.ts | 12 |
| mobile/src/data/executableContracts/validation.ts | 10 |
| mobile/src/data/feePresentation.ts | 104 |
| mobile/src/data/filteredSearchSnapshot.ts | 40 |
| mobile/src/data/historicalBankRateCatalogue.ts | 313 |
| mobile/src/data/historicalBankRateCatalogueCompression.ts | 66 |
| mobile/src/data/historicalBankRateCatalogueMerge.ts | 53 |
| mobile/src/data/historicalBankRateCataloguePacked.ts | 41 |
| mobile/src/data/historicalBankRateCatalogueSync.ts | 208 |
| mobile/src/data/historicalBankRateCatalogueWeb.ts | 16 |
| mobile/src/data/historicalBankRateCatalogueWire.ts | 81 |
| mobile/src/data/historicalBankRateReadyCompiler.ts | 12 |
| mobile/src/data/historicalBankRateReadyRetention.ts | 87 |
| mobile/src/data/historicalBankRateReadySync.ts | 30 |
| mobile/src/data/historicalPublication.ts | 18 |
| mobile/src/data/historyDaily.ts | 101 |
| mobile/src/data/historyIdentity.ts | 46 |
| mobile/src/data/historyPayload.ts | 117 |
| mobile/src/data/historySelectors.ts | 213 |
| mobile/src/data/ingestFinalized.ts | 157 |
| mobile/src/data/interests.ts | 35 |
| mobile/src/data/lvrTier.ts | 32 |
| mobile/src/data/missingPublicPayloadRecovery.ts | 13 |
| mobile/src/data/monetaryContracts/adapter.ts | 14 |
| mobile/src/data/monetaryContracts/authority.ts | 12 |
| mobile/src/data/monetaryContracts/coverage.ts | 4 |
| mobile/src/data/monetaryContracts/facts.ts | 14 |
| mobile/src/data/monetaryContracts/schemaValidation.ts | 54 |
| mobile/src/data/monetaryContracts/transport.ts | 20 |
| mobile/src/data/monetaryContracts/types.ts | 25 |
| mobile/src/data/monetaryContracts/validation.ts | 14 |
| mobile/src/data/mortgageContracts/adapter.ts | 13 |
| mobile/src/data/mortgageContracts/calendar.ts | 5 |
| mobile/src/data/mortgageContracts/facts.ts | 7 |
| mobile/src/data/mortgageContracts/inputs.ts | 12 |
| mobile/src/data/mortgageContracts/snapshotBudget.ts | 6 |
| mobile/src/data/mortgageContracts/transport.ts | 25 |
| mobile/src/data/mortgageContracts/types.ts | 6 |
| mobile/src/data/mortgageContracts/validation.ts | 13 |
| mobile/src/data/notifications.ts | 49 |
| mobile/src/data/passThroughModels.ts | 76 |
| mobile/src/data/payload.ts | 51 |
| mobile/src/data/payloadInflation.ts | 12 |
| mobile/src/data/payloadRevision.ts | 26 |
| mobile/src/data/portableBankRateHistory.ts | 75 |
| mobile/src/data/portfolioContracts/adapter.ts | 23 |
| mobile/src/data/portfolioContracts/mortgageAdapter.ts | 22 |
| mobile/src/data/productFacts.ts | 27 |
| mobile/src/data/productHistoryCatalogue.ts | 50 |
| mobile/src/data/productHistorySync.ts | 67 |
| mobile/src/data/productTerms.ts | 72 |
| mobile/src/data/productTermsTransport.ts | 38 |
| mobile/src/data/profile.ts | 150 |
| mobile/src/data/projections.ts | 32 |
| mobile/src/data/rateConditions.ts | 9 |
| mobile/src/data/rateHistoryCharts.ts | 13 |
| mobile/src/data/rateReceipt.ts | 28 |
| mobile/src/data/rbaCalendar.ts | 236 |
| mobile/src/data/rbaMarketOutlook.ts | 47 |
| mobile/src/data/rbaMarketOutlookParse.ts | 86 |
| mobile/src/data/rbaOfficialLive.ts | 162 |
| mobile/src/data/receiptReplay/bounds.ts | 5 |
| mobile/src/data/receiptReplay/parse.ts | 10 |
| mobile/src/data/receiptReplay/recalculate.ts | 27 |
| mobile/src/data/receiptReplay/resolve.ts | 10 |
| mobile/src/data/savedRates.ts | 41 |
| mobile/src/data/searchFilterOptions.ts | 16 |
| mobile/src/data/stagedOptionalAssets.ts | 19 |
| mobile/src/data/store.ts | 164 |
| mobile/src/data/storeBankRateHistory.ts | 90 |
| mobile/src/data/storeBootstrap.ts | 50 |
| mobile/src/data/storeEnsure.ts | 249 |
| mobile/src/data/storeRefresh.ts | 114 |
| mobile/src/data/storeTypes.ts | 164 |
| mobile/src/data/storeUser.ts | 36 |
| mobile/src/data/subscriptions.ts | 22 |
| mobile/src/data/suitabilityIndex.ts | 225 |
| mobile/src/data/taxonomy.ts | 185 |
| mobile/src/data/termsReferenceStore.ts | 49 |
| mobile/src/data/trackedRates.ts | 147 |
| mobile/src/data/userRateScenario.ts | 178 |
| mobile/src/data/v3GenerationCache.ts | 74 |
| mobile/src/data/v3Payload.ts | 81 |
| mobile/src/data/vizModels.ts | 37 |
| mobile/src/hooks/useCustomerProfile.ts | 5 |
| mobile/src/hooks/usePreparedSearchRows.ts | 23 |
| mobile/src/hooks/useSearchFilterOptions.ts | 28 |
| mobile/src/hooks/useUndoSnackbar.ts | 4 |
| mobile/src/hooks/useUserRateScenario.ts | 18 |
| mobile/src/lib/a11ySummaries.ts | 74 |
| mobile/src/lib/appDestinations.ts | 18 |
| mobile/src/lib/appHealth/catalogueCoverage.ts | 51 |
| mobile/src/lib/appHealth/dataQuality.ts | 21 |
| mobile/src/lib/appHealth/displayQuality.ts | 33 |
| mobile/src/lib/appHealth/networkPolicy.ts | 124 |
| mobile/src/lib/appHealth/report.ts | 116 |
| mobile/src/lib/appHealth/types.ts | 92 |
| mobile/src/lib/appHealthLiveSource.ts | 19 |
| mobile/src/lib/appHealthTransportGuard.ts | 173 |
| mobile/src/lib/appLock.ts | 28 |
| mobile/src/lib/appUpdate.ts | 98 |
| mobile/src/lib/appUpdateDownload.ts | 67 |
| mobile/src/lib/appUpdateDownloadLogic.ts | 27 |
| mobile/src/lib/appUpdateInstall.ts | 26 |
| mobile/src/lib/appUpdateLogic.ts | 45 |
| mobile/src/lib/backgroundPayloadWork.ts | 5 |
| mobile/src/lib/breadcrumbs.ts | 14 |
| mobile/src/lib/calculatorIssues.ts | 12 |
| mobile/src/lib/changelog.ts | 68 |
| mobile/src/lib/compactBreadcrumbs.ts | 28 |
| mobile/src/lib/comparePresentation.ts | 7 |
| mobile/src/lib/debugLog.ts | 21 |
| mobile/src/lib/debugLogSharing.ts | 20 |
| mobile/src/lib/degradationLog.ts | 45 |
| mobile/src/lib/diagnosticsEnvelope.ts | 88 |
| mobile/src/lib/exportSearchReport.ts | 18 |
| mobile/src/lib/externalLinkAudit.ts | 13 |
| mobile/src/lib/externalLinkInventory.ts | 7 |
| mobile/src/lib/feedRenderEvidence.ts | 13 |
| mobile/src/lib/installPermission.ts | 46 |
| mobile/src/lib/jsonContentHash.native.ts | 20 |
| mobile/src/lib/keyVault.ts | 12 |
| mobile/src/lib/nativeFileHash.ts | 18 |
| mobile/src/lib/nativeFileHash.web.ts | 3 |
| mobile/src/lib/observability.ts | 13 |
| mobile/src/lib/observabilityLoader.ts | 10 |
| mobile/src/lib/passiveAudit.ts | 183 |
| mobile/src/lib/passiveAuditCache.ts | 146 |
| mobile/src/lib/passiveAuditLinkQueue.ts | 49 |
| mobile/src/lib/passiveAuditLinks.ts | 135 |
| mobile/src/lib/payloadCrypto.ts | 37 |
| mobile/src/lib/performanceAudit.ts | 37 |
| mobile/src/lib/performanceAuditActionEvidence.ts | 21 |
| mobile/src/lib/performanceAuditCapacity.ts | 124 |
| mobile/src/lib/performanceAuditHealth.ts | 396 |
| mobile/src/lib/performanceAuditLinks.ts | 13 |
| mobile/src/lib/performanceAuditLog.ts | 118 |
| mobile/src/lib/performanceAuditNavigation.ts | 33 |
| mobile/src/lib/performanceAuditPlan.ts | 101 |
| mobile/src/lib/performanceAuditReadiness.ts | 93 |
| mobile/src/lib/performanceAuditRollback.ts | 128 |
| mobile/src/lib/performanceAuditSetup.ts | 19 |
| mobile/src/lib/performanceAuditTiming.ts | 5 |
| mobile/src/lib/performanceAuditWork.ts | 7 |
| mobile/src/lib/productTermsEngine/calendar.ts | 4 |
| mobile/src/lib/productTermsEngine/decimal.ts | 12 |
| mobile/src/lib/productTermsEngine/eligibility.ts | 6 |
| mobile/src/lib/productTermsEngine/evaluationBudget.ts | 10 |
| mobile/src/lib/productTermsEngine/feeLedger.ts | 28 |
| mobile/src/lib/productTermsEngine/feePricing.ts | 10 |
| mobile/src/lib/productTermsEngine/feeSchedule.ts | 9 |
| mobile/src/lib/productTermsEngine/feeTypes.ts | 8 |
| mobile/src/lib/productTermsEngine/feeValidation.ts | 26 |
| mobile/src/lib/productTermsEngine/ledger.ts | 43 |
| mobile/src/lib/productTermsEngine/loanComponents.ts | 8 |
| mobile/src/lib/productTermsEngine/loanLedger.ts | 57 |
| mobile/src/lib/productTermsEngine/loanValidation.ts | 14 |
| mobile/src/lib/productTermsEngine/portfolio.ts | 27 |
| mobile/src/lib/productTermsEngine/portfolioActivity.ts | 21 |
| mobile/src/lib/productTermsEngine/portfolioAuthority.ts | 10 |
| mobile/src/lib/productTermsEngine/portfolioComparison.ts | 24 |
| mobile/src/lib/productTermsEngine/portfolioFeeFunding.ts | 15 |
| mobile/src/lib/productTermsEngine/portfolioValidation.ts | 9 |
| mobile/src/lib/productTermsEngine/savingsActivity.ts | 7 |
| mobile/src/lib/productTermsEngine/savingsActivityAdmission.ts | 7 |
| mobile/src/lib/productTermsEngine/savingsActivityTypes.ts | 35 |
| mobile/src/lib/productTermsEngine/savingsActivityValidation.ts | 9 |
| mobile/src/lib/productTermsEngine/savingsValidation.ts | 13 |
| mobile/src/lib/productTermsEngine/tdLedger.ts | 37 |
| mobile/src/lib/productTermsEngine/tdSchedule.ts | 24 |
| mobile/src/lib/productTermsEngine/tdValidation.ts | 9 |
| mobile/src/lib/productTermsEngine/testSupport.ts | 32 |
| mobile/src/lib/productTermsEngine/types.ts | 26 |
| mobile/src/lib/productTermsEngine/validation.ts | 16 |
| mobile/src/lib/rateQualifier.ts | 44 |
| mobile/src/lib/releaseTransport.ts | 21 |
| mobile/src/lib/savedEmptyState.ts | 13 |
| mobile/src/lib/searchReportPdf.ts | 8 |
| mobile/src/lib/searchReportTables.ts | 27 |
| mobile/src/lib/searchReportWorkbook.ts | 23 |
| mobile/src/lib/secureStoreKey.ts | 19 |
| mobile/src/lib/secureStoreValue.ts | 118 |
| mobile/src/lib/trustedExternalUrl.ts | 12 |
| mobile/src/theme/colors.ts | 15 |
| mobile/src/theme/m3Palette.ts | 12 |
| mobile/src/theme/typography.ts | 8 |
| mobile/src/types.ts | 153 |

Scan totals at reviewed source 7e4caee: 146 JSX/native candidate files and 228 dynamic TS candidate files. First lines are locations for inspection, not the only relevant lines.
