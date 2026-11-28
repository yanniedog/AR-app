# App explorer: 1.0.398 (454)

**Real-use session FAIL vs 1.0.398: 6 broken, 16 friction, 8 slower**

- Broken: Nothing to read for 54.7 s on "open app"
- Broken: "inspect term deposit quote" failed: UI assertion failed: app hierarchy unavailable
- Broken: "inspect savings quote" failed: UI assertion failed: app hierarchy unavailable
- Broken: "open mortgage filter draft" failed: UI assertion failed: app hierarchy unavailable
- Broken: "start save from rates" failed: UI assertion failed: app hierarchy unavailable
- Broken: "start compare from rates" failed: UI assertion failed: app hierarchy unavailable
- Friction: No reaction for 3.9 s after "scroll rates 1"
- Friction: No reaction for 3.2 s after "scroll rates 2"
- Friction: No reaction for 3.1 s after "scroll product"
- Friction: No reaction for 7.8 s after "expand visible fees"
- Friction: No reaction for 3.1 s after "scroll product sources"
- Friction: No reaction for 4.8 s after "switch to savings"
- Friction: No reaction for 3.7 s after "switch to home loans"
- Friction: No reaction for 3.1 s after "open market"
- Friction: No reaction for 3.2 s after "scroll rba"
- Friction: No reaction for 3.3 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Friction: No reaction for 4.5 s after "start category switch"
- Friction: No reaction for 5.8 s after "open term deposits"
- Friction: No reaction for 3.4 s after "verify term deposit rates"
- Friction: No reaction for 4.1 s after "inspect term deposit quote"
- Friction: No reaction for 3.6 s after "inspect savings quote"
- Slower: "open app" content 71.2 s to 109.2 s
- Slower: Dropped frames 50% to 83% on "scroll product fees"
- Slower: "start category switch" content 0.0 s to 4.5 s
- Slower: "start search from rates" content 0.0 s to 2.3 s
- Slower: Dropped frames 47% to 67% on "open savings search"
- Slower: "start filter rollback" content 0.0 s to 2.4 s
- Slower: "start save from rates" content 0.0 s to 2.1 s
- Slower: "start compare from rates" content 0.0 s to 2.1 s

**Initial Rates readiness:** 119.7 s from JS start (at or above the 3 s target) · last blocker: rows

**Extended journeys**

- Product categories: 3 passed, 1 failed, 2 blocked
- Search and clear: 2 passed, 1 failed, 5 blocked
- Discard temporary filters: 1 passed, 1 failed, 4 blocked
- Saved rate lifecycle: 0 passed, 1 failed, 9 blocked
- Compare two rates: 0 passed, 1 failed, 5 blocked

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-29

Mode session | 39 steps | crashes 0 | step failures 5 | settle timeouts 0 | steps with JS/native errors 1
Baseline 1.0.398

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 104450 | +51850 | 2004/2665 | 89 | 536 | 1 errors; start 4576ms |
| 2 | scroll rates 1 | 6585 | +5847 | 47/65 | 85 | 744 | boot js-start 83733, layout-mounted 84259, cache-read 84627, hydrated 85338, splash-hide 85338, manifest 87109, resolved 87946, core-fetched 100018, core-saved 101471, pricing-wait-suitability 101938, search-index-idle 101938, details-start 103065, details-fetched 124721, rows-prepared 143737, detail-filters-idle 143737, leading-requested 143737, last-pricing 143737, suitability-built 149287, post-refresh-wait 151499, leading-scoped 185687, leading-page 185687, refresh-done 194518, pricing-ready 203022, last-rows 203022, rates-ready 203463, pricing-starts 1, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 418, pricing-scope-ms 56272, filter-runs 2, filter-rows 37735, filter-yields 12, filter-ms 257, sort-runs 1, sort-rows 2150, sort-yields 2, sort-ms 55 |
| 3 | scroll rates 2 | 739 | +22 | 21/29 | 65 | 498 |  |
| 4 | scroll rates back | 730 | +56 |  |  | 533 |  |
| 5 | open product | 121 | +100 | 32/46 | 117 | 621 |  |
| 6 | scroll product | 766 | +63 | 32/54 | 85 | 674 |  |
| 7 | expand visible fees | 4513 | +2249 | 8/16 | 44 | 645 |  |
| 8 | expand product facts | 16 | -2 | 224/357 | 81 | 675 |  |
| 9 | scroll product fees | 781 | +96 | 24/29 | 85 | 634 |  |
| 10 | scroll product eligibility | 785 | -52 | 21/30 | 85 | 632 |  |
| 11 | expand eligibility | 16 | +16 | 206/275 | 85 | 645 |  |
| 12 | expand constraints | 54 | +37 | 9/14 | 73 | 637 |  |
| 13 | scroll product sources | 749 | +51 | 22/34 | 81 | 638 |  |
| 14 | back to rates | 45 | +22 | 13/22 | 69 | 644 |  |
| 15 | open lenders | 45 | +24 | 21/23 | 200 | 651 |  |
| 16 | scroll lenders | 911 | +203 | 20/22 | 150 | 644 |  |
| 17 | back from lenders | 40 | +21 | 7/8 | 150 | 642 |  |
| 18 | switch to savings | 44 | +24 | 56/78 | 93 | 654 |  |
| 19 | switch to home loans | 57 | +36 | 19/30 | 65 | 669 |  |
| 20 | open filters | 41 | +21 | 20/26 | 150 | 671 |  |
| 21 | close filters | 43 | +24 | 8/10 | 150 | 662 |  |
| 22 | open market | 42 | +23 | 17/30 | 81 | 664 |  |
| 23 | open rba | 2655 | +2635 | 47/61 | 69 | 681 |  |
| 24 | scroll rba | 798 | +112 | 31/52 | 73 | 674 |  |
| 25 | back from rba | 40 | +14 | 11/20 | 53 | 675 |  |
| 26 | scroll market | 818 | +135 | 29/40 | 77 | 674 |  |
| 27 | open saved | 44 | +7 | 15/23 | 61 | 677 |  |
| 28 | return to rates | 47 | +28 | 19/30 | 97 | 679 |  |
| 29 | start category switch | 14479 | +14456 | 12/15 | 32 | 683 |  |
| 30 | open term deposits | 72 | +52 | 88/120 | 81 | 704 |  |
| 31 | verify term deposit rates | 776 | +85 | 34/49 | 93 | 710 |  |
| 32 | inspect term deposit quote | 41 |  | 30/45 | 81 | 721 | UI assertion failed: app hierarchy unavailable |
| 33 | start search from rates | 57 | +36 | 15/24 | 73 | 722 |  |
| 34 | open savings search | 65 | +47 | 20/30 | 65 | 733 |  |
| 35 | inspect savings quote | 46 |  | 254/339 | 85 | 778 | UI assertion failed: app hierarchy unavailable |
| 36 | start filter rollback | 107 | +79 | 215/309 | 89 | 782 |  |
| 37 | open mortgage filter draft | 40 | +7 | 20/23 | 133 | 752 | UI assertion failed: app hierarchy unavailable |
| 38 | start save from rates | 50 | +27 | 0/1 | 8 | 754 | UI assertion failed: app hierarchy unavailable |
| 39 | start compare from rates | 50 | +20 |  |  | 753 | UI assertion failed: app hierarchy unavailable |

## Errors

### 1 open app
```
11-28 15:25:41.191 E/australianrates( 5062): Not starting debugger since process cannot load the jdwp agent.
```
**Rate evidence: findings** · Published edition app-payload-2026-11-29-r000001

| Category | Banks visible / published | Products visible / published |
| --- | ---: | ---: |
| Mortgage | 7 / 140 | 11 / 1893 |
| Savings | 6 / 100 | 6 / 740 |
| TD | 7 / 87 | 8 / 656 |

Visible tier observations: matched 48
List-to-detail quotes: Mortgage matched, Savings unverified, TD unverified
Historical changes: product best delta matches 8, best tier conditions changed 3, history unavailable 2
Direct bank CDR product checks: register brand unresolved 56, read 288, bank response unavailable 1
CDR values within rate type and published term: value present 3725, unmatched scope 5, source unit unverified 2, value absent 1
Retail website tables (Judo Bank personal TD and Australian Military Bank Income Plus / Investment Plus): rate and frequency match 18, payment frequency differs 2, unverified 24

- Retail page unavailable: https://www.judo.bank/term-deposits/personal-term-deposit/ (curl: (22) The requested URL returned error: 403)
- Income Plus, tier 2, 9 months: core 5.2500% at_maturity, retail {"monthly":"5.25"} (https://australianmilitarybank.com.au/bank-and-save/term-deposits/)
- verify Macquarie result: Checkpoint missing
- clear query and restore results: Checkpoint missing
- restore home loans: Checkpoint missing

