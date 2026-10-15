# Android redesign contract

Approved 14 October 2026. This replaces the consumer design and navigation direction in the September Rate Ledger plan. It governs six implementation PRs; it does not claim the baseline app already complies.

## Product outcome

Optimise task effort, ease of use, sitemap depth and implementation complexity together. Financial correctness, privacy and accessibility are constraints. A smaller menu or a cleaner screenshot alone is insufficient.

The visual and interaction references are Airtasker's official Android screenshots and Play Store browsing patterns. The implementation uses the existing Expo/React Native stack and native controls. No new navigation framework, decorative dashboard template or native dependency is required.

## Capability and navigation budget

| Destination | Content on arrival | Direct actions |
| --- | --- | --- |
| Rates | Full searchable results; Home loans, Savings, Term deposits | Filter, Sort, Save, Compare, Calculate |
| Saved | Exact saved tiers and entered rates | Compare, alerts, edit, Calculate |
| Market | Cash rate, next decision and recent movements | History, Bank response, Outlook |

The account menu contains Profile, Settings and About. Legal documents and diagnostics remain under About. New users browse without onboarding, account creation, profile completion or optional permissions. Returning users retain their saved state.

Merge Home and Tools into the relevant tasks. Merge Matches and category drilling into filter facets. Bank search and products without listed rates are result facets; bank history remains contextual. Calculation and projection modes share actual entered inputs. Export and receipts are output actions, not directories. Legacy routes are thin adapters to canonical tasks, not hidden duplicates.

List to product is one tap. Save is one in-place tap. Filter/Sort open in one tap and one sheet layer. Compare two visible rates uses at most four total taps, counting selection mode and selections. Calculate opens directly beside the rate. Keyboard and sheets close before route Back; returning to results restores query, type, filters, sort and scroll offset.

## Text contract

UI text identifies an action, field, identity, result, status or necessary fact. Explanatory text is prohibited across every screen, sheet, dialog, tooltip, loading/empty/error state, accessibility hint and dynamic provider-text path. Remove the associated containers and spacing too.

Keep explicit advertised/comparison/ongoing/conditional metrics, conditions, LVR/term/balance bounds, fees, model assumptions, dates, and unknown/stale/partial/unavailable states as structured facts. Privacy consequences use factual rows beside the actual choice. Required legal/licence content is explicitly opened document content, not an exemption for instructional UI prose.

Remove description/helper/subtitle APIs from shared components. Ordinary text sinks accept controlled labels/statuses, identities, user values and verified fact renderers. Dynamic marketing descriptions never render directly. A TypeScript-based provenance guard checks JSX, aliases, templates, dialogs and accessibility text in canonical CI. Human review rejects explanatory registry additions; no length heuristic or grandfathered-prose baseline substitutes for that review.

## Native visual and motion contract

White and near-white surfaces, navy text, blue actions; a corresponding dark palette. Distinct success/caution/danger roles preserve meaning. Android uses system sans-serif/Roboto with real numeric weights. Initial sizes are 22 sp titles, 16 sp controls, 14 sp metadata and 32 sp prominent figures. Use 16 dp gutters and 8/12/16/24 dp spacing; avoid placing every section in a card.

Use dense single-line product rows across one screen width, without horizontal scrolling. Prefer recognisable symbols and icon actions to verbose list labels. Keep the selected metric explicitly identified, distinguish comparison/advertised/ongoing/conditional values, and represent tier distinctions truthfully. Full product identities, conditions, fees and unknowns remain available in the product and accessible row facts. Never invent a symbol meaning or squeeze text by disabling accessibility scaling. Save, selection and loading retain geometry; touchable bounds remain at least 48 by 48 dp and do not scale with animated content.

Icon bubbles contain one reviewed word only. A short press performs the action; holding an icon shows its label without performing that action. Use a gentle opacity transition, dismiss on Back/outside touch, and respect reduced motion. These labels do not permit explanatory prose in bubbles or elsewhere. This product-list direction was updated by the user on 15 October 2026; earlier multi-line screenshots remain historical evidence.

| Interaction | Initial target |
| --- | --- |
| Press | Immediate native ripple; 80 ms content compression to 0.97 |
| Release | Restrained 160–180 ms return |
| Chip/selection | Immediate state change; about 160 ms indicator feedback |
| Sheet | Interruptible 220–280 ms transition, native Back and keyboard support |
| Reduced motion | No scale/travel when enabled or unresolved; immediate state feedback |

These are project prototype targets, not measurements of competitor timings. Haptics require separate physical-device proof. Existing native libraries and caches are retained.

## Six PRs and verification

The [route, capability, state and copy inventory](ANDROID_REDESIGN_INVENTORY.md) records the baseline, migration decisions and unmeasured evidence gaps.

1. Inventory, capability migration, baseline friction ledger and contracts.
2. Native pilot: results, product, filter and shared interaction/design components.
3. Three-tab map, direct results, legacy adapters, state restoration and genuine audit-surface migration.
4. All remaining surfaces, no-prose component contracts and CI enforcement.
5. Android matrix and repairs; before/after friction evidence.
6. Acceptance harness, release checklist and final public-byte/native installation verification.

Every PR targets protected main. Multiple local commits are allowed; push coherent validated batches. Keep a genuine phase-6 draft containing acceptance work open while phases 1–5 progress, so existing queue-drain release automation can batch the public release. Do not alter required CI, stack feature-base PRs, or create empty release blockers. Repository-generated version/README PRs remain separate automation.

Run `cd mobile && npm run ci` before review-ready pushes. Build one compatible development client and reuse Metro for JS changes; rebuild for a changed native fingerprint. Required GitHub native compilation remains enabled. Resolve all substantive reviews and use the repository squash/delete-branch wrapper.

Record total taps, route changes, decisions, typed inputs, scroll detours, task completion, timing, mistakes and recovery. Never infer unmeasured results. Every core journey improves effort or is already at its usable minimum. Android matrix covers 360/411 dp widths, large fonts, light/dark, reduced motion, keyboard, gesture/button Back, loading/empty/offline/error and permissions. Strict audit steps remain at most 10,000 ms with real rendered readiness.

Representative-person studies are separately reported if participants are available; emulator evidence is not human-user validation. Public manifest/hash/version/source evidence, final emulator installation and physical-device acceptance are separate states.
