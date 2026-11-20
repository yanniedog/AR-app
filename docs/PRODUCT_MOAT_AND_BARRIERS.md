# Product moat and barriers

Evidence: code in `mobile/src` and `mobile/app`, and explorer run 44750639332 (build 1.0.327, 720x1600 emulator, screenshots in `explorer/run-44750639332`). Rubric scores and per-screen findings come from `ux-review.json` in each run (see `mobile/tools/app-explorer/ux-review.mjs`). Items marked "to verify" need a run that saves raw UI nodes (build after the UX review PR).

## What makes the app defensible

| Moat | Evidence | Strength |
| --- | --- | --- |
| Provenance and unknowns kept as facts | Rate and calculation receipts (`rate-receipt`, `calculation-receipt`), `Eligibility unverified`, `Unknown`, `Unverified` labels, `Missing observations` on history | High. Comparison sites hide uncertainty; this one shows it. Hard to copy without the same publisher pipeline. |
| Daily history compiled upstream | `docs/BANK_RATE_HISTORY.md`, `HISTORY_DERIVATION.md`; phone only filters prepared cohorts | High. The archive grows daily and cannot be rebuilt by a new entrant. |
| Per-product state on the device | Saved rows, per-rate alerts (`useRateAlertToggle`), private customer inputs (`docs/CUSTOMER_PROFILES.md`, SecureStore) | Medium. Switching cost exists only after a user saves or enters a profile. |
| Calculations on the user's own numbers | Calculate (rate check, projection), Compare, Matches | Medium. Useful, but each is commodity on its own. |
| Offline-capable verified cache | Payload validators, fallback data, signed prepared fallback | Medium. Reliability moat, invisible until the network fails. |
| Market context | RBA decisions and calendar, Trends, bank gap views | Low to medium. Available elsewhere; value is having it next to the rates. |

Weakest point: the defensible parts (history, provenance) sit behind taps, while the first screen is a rate list that any comparison site also shows.

## What stops a new user getting value

Ranked by how early they bite.

1. **Install.** Sideloaded APK from a QR or release link; no store listing. Every user must allow unknown-source installs before seeing anything. Not fixable in app code; fixable in distribution.
2. **Data unavailable on first launch.** In run 44750639332 the first five screens (Rates, Saved, Market, Tools, Trends) showed `Data unavailable` with `Server error 502` and a 25 s retry countdown for about eight minutes before rates loaded. A new user's first impression was an error card. The card has `Try again`, so recovery exists, but there is nothing to look at while waiting. `mobile/assets/sample` holds a sample payload but nothing in `mobile/src` loads it.
3. **Cold start time.** Launch to settled rates took 17.9 s on a fresh install (step 1 of the same run), 10.5 s on a cold relaunch. Over 10 s is the point most users stop waiting.
4. **Density and jargon on the first useful screen.** Rates shows ~25 controls and labels above the first row (tabs, search, five toolbar actions, filter chips, `Eligibility unverified · 857`). `LVR`, `Min/Mean/Median/Max`, `Principal & interest` and `Owner occupied` appear with no expansion. Lender names truncate (`Broken Hill Bank · Choice Ho…`). The chip row clips at the right edge (`Principal & int…`) with no scroll cue.
5. **Empty tools.** Calculate opens with blank fields and `K` suffixes; Compare opens with `Minimum 2 rates` and a `Choose products` button. Both are honest, but the user has to do work before any value appears. Prefilled defaults from the Rates filters would remove that.
6. **Permission prompt at the moment of commitment.** Alerts ask for notification permission when the user taps the first alert (`useRateAlertToggle`), which is the right moment, but a refusal ends in an `Alert` with no way back inside the flow.
7. **Hidden destinations.** The bottom bar has three items (Rates, Saved, Market). Tools, Trends, Compare, Calculate and Lenders are reached through the toolbar `More` or other screens. This matches the redesign contract; the cost is that users never find them (to verify with tap-depth metrics).

## Where engagement drops

- **Nothing changes visibly between visits.** No screen shows what moved since the last open (`grep` for last-visit or changed-since state in `mobile/src` finds none). The only return trigger is a push alert, and only for products the user saved.
- **Saving is the single retention hook** and it is a small star icon on each row (tap target under 48 dp in the sample, to verify in `ux-review.json`). Users who never find it have no state to come back to.
- **Market and Trends depend on the same data load** as Rates, so a bad first load empties every tab at once.
- **No habit loop for non-savers.** No weekly summary, no best-rate-today entry point, no widget.

## Ranked fixes

| # | Fix | Why | Size |
| --- | --- | --- | --- |
| 1 | Show a bundled or last-known rate snapshot, marked with its date, instead of an empty error card | Removes barrier 2 and most of 3 | Medium |
| 2 | Show cached rates immediately on every launch, refresh behind them | Cold start becomes a paint, not a download | Medium |
| 3 | Enlarge the Save star and filter/toolbar targets to 48 dp | Drives the only retention hook; accessibility | Small |
| 4 | Replace `LVR` and similar with plain labels; wrap lender names to two lines | Removes jargon and truncation on the main screen | Small |
| 5 | Add a `Changed since last visit` row on Rates (count of rate moves in Saved) | Gives a reason to return without prose | Medium |
| 6 | Prefill Calculate and Compare from the active Rates filters and top rows | Value before input | Small |
| 7 | Add a scroll cue (fade or peek) on the filter chip row | Stops clipped chips reading as broken | Small |
| 8 | Offer alerts for the top rate in the current filter after the first Save | Converts savers into returners | Medium |
| 9 | Add install QR and update status inside the app About screen | Eases reinstall and sharing | Small |

Fixes 3, 4 and 7 are the clearest from the current evidence and ship as separate small PRs.

## How this is measured

Every explorer run now computes: first value time and gate taps, taps from the first screen to key tasks, tap targets, contrast, truncation, jargon, prose, dead ends, displayed-rate accuracy and a nine-dimension rubric including frustration and abandonment risk. Re-score this document's table from `ux-review.json` after each of the fixes above lands.
