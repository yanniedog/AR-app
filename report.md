# App explorer: 1.0.398 (454)

**Real-use session FAIL vs 1.0.398: 12 broken, 11 friction, 7 slower**

- Broken: Spinner 50.4 s on "open app"
- Broken: "back to rates" failed: Rate change does not match the selected offer: Virgin Money Lite Home Loan, Virgin Money, Comparison rate 6.36%, Advertised rate 6.34% · Variable · Principal & interest · Owner occupied · Listed LVR >70.0%–80.0% · Conditions: Unverified, Tier #151, Best advertised ↑ 25 bps · 8 Nov 2026, Eligibility unverified, Freshness · Unknown
- Broken: "back from lenders" failed: Rate change does not match the selected offer: Virgin Money Lite Home Loan, Virgin Money, Comparison rate 6.36%, Advertised rate 6.34% · Variable · Principal & interest · Owner occupied · Listed LVR >70.0%–80.0% · Conditions: Unverified, Tier #151, Best advertised ↑ 25 bps · 8 Nov 2026, Eligibility unverified, Freshness · Unknown
- Broken: "switch to savings" failed: Rate change does not match the selected offer: Strong Start Saver, Bank First, Rate 5.90%, Ongoing · $0–$50k, Tier #1, Best advertised ↑ 25 bps · 3 days ago, Freshness · Unknown
- Broken: "switch to home loans" failed: Rate change does not match the selected offer: Discounted Great Rate Home Loan - Variable Owner Occupied, Greater Bank, Comparison rate 6.35%, Advertised rate 6.34% · Variable · Principal & interest · Owner occupied · Listed LVR ≤80.0% · Conditions: Unverified, Tier #1, Best advertised ↑ 25 bps · 13 Nov 2026, Eligibility unverified, Freshness · Unknown
- Broken: "close filters" failed: Rate change does not match the selected offer: Discounted Great Rate Home Loan - Variable Owner Occupied, Greater Bank, Comparison rate 6.35%, Advertised rate 6.34% · Variable · Principal & interest · Owner occupied · Listed LVR ≤80.0% · Conditions: Unverified, Tier #1, Best advertised ↑ 25 bps · 13 Nov 2026, Eligibility unverified, Freshness · Unknown
- Broken: "return to rates" failed: Rate change does not match the selected offer: Virgin Money Lite Home Loan, Virgin Money, Comparison rate 6.36%, Advertised rate 6.34% · Variable · Principal & interest · Owner occupied · Listed LVR >70.0%–80.0% · Conditions: Unverified, Tier #151, Best advertised ↑ 25 bps · 8 Nov 2026, Eligibility unverified, Freshness · Unknown
- Broken: "start category switch" failed: Rate change does not match the selected offer: Virgin Money Lite Home Loan, Virgin Money, Comparison rate 6.36%, Advertised rate 6.34% · Variable · Principal & interest · Owner occupied · Listed LVR >70.0%–80.0% · Conditions: Unverified, Tier #151, Best advertised ↑ 25 bps · 8 Nov 2026, Eligibility unverified, Freshness · Unknown
- Broken: "start search from rates" failed: Rate change does not match the selected offer: Virgin Money Lite Home Loan, Virgin Money, Comparison rate 6.36%, Advertised rate 6.34% · Variable · Principal & interest · Owner occupied · Listed LVR >70.0%–80.0% · Conditions: Unverified, Tier #151, Best advertised ↑ 25 bps · 8 Nov 2026, Eligibility unverified, Freshness · Unknown
- Broken: "start filter rollback" failed: Rate change does not match the selected offer: Virgin Money Lite Home Loan, Virgin Money, Comparison rate 6.36%, Advertised rate 6.34% · Variable · Principal & interest · Owner occupied · Listed LVR >70.0%–80.0% · Conditions: Unverified, Tier #151, Best advertised ↑ 25 bps · 8 Nov 2026, Eligibility unverified, Freshness · Unknown
- Broken: "start save from rates" failed: Rate change does not match the selected offer: Virgin Money Lite Home Loan, Virgin Money, Comparison rate 6.36%, Advertised rate 6.34% · Variable · Principal & interest · Owner occupied · Listed LVR >70.0%–80.0% · Conditions: Unverified, Tier #151, Best advertised ↑ 25 bps · 8 Nov 2026, Eligibility unverified, Freshness · Unknown
- Broken: "start compare from rates" failed: Rate change does not match the selected offer: Virgin Money Lite Home Loan, Virgin Money, Comparison rate 6.36%, Advertised rate 6.34% · Variable · Principal & interest · Owner occupied · Listed LVR >70.0%–80.0% · Conditions: Unverified, Tier #151, Best advertised ↑ 25 bps · 8 Nov 2026, Eligibility unverified, Freshness · Unknown
- Friction: No reaction for 3.9 s after "scroll rates 1"
- Friction: No reaction for 3.5 s after "scroll rates 2"
- Friction: No reaction for 3.7 s after "scroll product"
- Friction: No reaction for 3.1 s after "scroll product fees"
- Friction: No reaction for 3.3 s after "scroll product sources"
- Friction: No reaction for 5.3 s after "switch to savings"
- Friction: No reaction for 3.7 s after "switch to home loans"
- Friction: No reaction for 3.1 s after "open market"
- Friction: No reaction for 3.2 s after "scroll rba"
- Friction: No reaction for 3.2 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Slower: Dropped frames 58% to 73% on "scroll rates 2"
- Slower: Dropped frames 57% to 74% on "scroll product"
- Slower: Dropped frames 48% to 64% on "expand product facts"
- Slower: Dropped frames 50% to 69% on "scroll product fees"
- Slower: "expand eligibility" content 0.0 s to 2.4 s
- Slower: Dropped frames 50% to 67% on "back to rates"
- Slower: Dropped frames 66% to 82% on "open rba"

**Initial Rates readiness:** 127.6 s from JS start (at or above the 3 s target) · last blocker: rows

**Extended journeys**

- Product categories: 0 passed, 1 failed, 3 blocked
- Search and clear: 0 passed, 1 failed, 5 blocked
- Discard temporary filters: 0 passed, 1 failed, 5 blocked
- Saved rate lifecycle: 0 passed, 1 failed, 9 blocked
- Compare two rates: 0 passed, 1 failed, 5 blocked

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-29

Mode session | 33 steps | crashes 0 | step failures 11 | settle timeouts 0 | steps with JS/native errors 1
Baseline 1.0.398

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 99463 | +46863 | 2190/2906 | 89 | 545 | 1 errors; start 4560ms |
| 2 | scroll rates 1 | 4006 | +3268 | 37/51 | 77 | 635 | boot js-start 79285, layout-mounted 79678, cache-read 80074, hydrated 80754, splash-hide 80754, manifest 82788, resolved 83677, core-fetched 93048, core-saved 94597, pricing-wait-suitability 95234, search-index-idle 95234, details-start 96178, details-fetched 112060, rows-prepared 131551, detail-filters-idle 131551, leading-requested 131551, last-pricing 131551, suitability-built 136866, post-refresh-wait 140315, leading-scoped 190071, leading-page 190071, refresh-done 196273, pricing-ready 206318, last-rows 206318, rates-ready 206858, pricing-starts 1, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 450, pricing-scope-ms 71979, filter-runs 2, filter-rows 37735, filter-yields 15, filter-ms 366, sort-runs 1, sort-rows 2150, sort-yields 1, sort-ms 47 |
| 3 | scroll rates 2 | 758 | +41 | 22/30 | 93 | 481 |  |
| 4 | scroll rates back | 715 | +41 |  |  | 486 |  |
| 5 | open product | 35 | +14 |  |  | 561 |  |
| 6 | scroll product | 715 | +12 | 51/69 | 77 | 640 |  |
| 7 | expand visible fees | 0 | -2264 |  |  | 639 |  |
| 8 | expand product facts | 25 | +7 | 76/118 | 85 | 650 |  |
| 9 | scroll product fees | 728 | +43 | 20/29 | 77 | 632 |  |
| 10 | scroll product eligibility | 729 | -108 | 15/26 | 69 | 633 |  |
| 11 | expand eligibility | 22 | +22 | 9/13 | 61 | 627 |  |
| 12 | expand constraints | 26 | +9 | 10/14 | 65 | 628 |  |
| 13 | scroll product sources | 725 | +27 | 26/42 | 81 | 644 |  |
| 14 | back to rates | 38 | +15 | 14/21 | 77 | 628 | Rate change does not match the selected offer: Virgin Money Lite Home Loan, Virgin Money, Comparison rate 6.36%, Advertised rate 6.34% · Variable · Principal & interest · Owner occupied · Listed LVR >70.0%–80.0% · Conditions: Unverified, Tier #151, Best advertised ↑ 25 bps · 8 Nov 2026, Eligibility unverified, Freshness · Unknown |
| 15 | open lenders | 24 | +3 | 19/24 | 300 | 630 |  |
| 16 | scroll lenders | 711 | +3 | 21/22 | 150 | 629 |  |
| 17 | back from lenders | 26 | +7 | 5/6 | 150 | 633 | Rate change does not match the selected offer: Virgin Money Lite Home Loan, Virgin Money, Comparison rate 6.36%, Advertised rate 6.34% · Variable · Principal & interest · Owner occupied · Listed LVR >70.0%–80.0% · Conditions: Unverified, Tier #151, Best advertised ↑ 25 bps · 8 Nov 2026, Eligibility unverified, Freshness · Unknown |
| 18 | switch to savings | 29 | +9 | 71/99 | 89 | 643 | Rate change does not match the selected offer: Strong Start Saver, Bank First, Rate 5.90%, Ongoing · $0–$50k, Tier #1, Best advertised ↑ 25 bps · 3 days ago, Freshness · Unknown |
| 19 | switch to home loans | 24 | +3 | 19/30 | 65 | 654 | Rate change does not match the selected offer: Discounted Great Rate Home Loan - Variable Owner Occupied, Greater Bank, Comparison rate 6.35%, Advertised rate 6.34% · Variable · Principal & interest · Owner occupied · Listed LVR ≤80.0% · Conditions: Unverified, Tier #1, Best advertised ↑ 25 bps · 13 Nov 2026, Eligibility unverified, Freshness · Unknown |
| 20 | open filters | 27 | +7 | 23/28 | 150 | 650 |  |
| 21 | close filters | 23 | +4 | 8/9 | 200 | 651 | Rate change does not match the selected offer: Discounted Great Rate Home Loan - Variable Owner Occupied, Greater Bank, Comparison rate 6.35%, Advertised rate 6.34% · Variable · Principal & interest · Owner occupied · Listed LVR ≤80.0% · Conditions: Unverified, Tier #1, Best advertised ↑ 25 bps · 13 Nov 2026, Eligibility unverified, Freshness · Unknown |
| 22 | open market | 23 | +4 | 20/32 | 61 | 653 |  |
| 23 | open rba | 2775 | +2755 | 69/84 | 69 | 668 |  |
| 24 | scroll rba | 733 | +47 | 32/56 | 69 | 662 |  |
| 25 | back from rba | 24 | -2 | 10/19 | 57 | 663 |  |
| 26 | scroll market | 689 | +6 | 27/40 | 81 | 661 |  |
| 27 | open saved | 23 | -14 | 15/27 | 81 | 665 |  |
| 28 | return to rates | 25 | +6 | 17/32 | 77 | 667 | Rate change does not match the selected offer: Virgin Money Lite Home Loan, Virgin Money, Comparison rate 6.36%, Advertised rate 6.34% · Variable · Principal & interest · Owner occupied · Listed LVR >70.0%–80.0% · Conditions: Unverified, Tier #151, Best advertised ↑ 25 bps · 8 Nov 2026, Eligibility unverified, Freshness · Unknown |
| 29 | start category switch | 31 | +8 |  |  | 667 | Rate change does not match the selected offer: Virgin Money Lite Home Loan, Virgin Money, Comparison rate 6.36%, Advertised rate 6.34% · Variable · Principal & interest · Owner occupied · Listed LVR >70.0%–80.0% · Conditions: Unverified, Tier #151, Best advertised ↑ 25 bps · 8 Nov 2026, Eligibility unverified, Freshness · Unknown |
| 30 | start search from rates | 31 | +10 |  |  | 666 | Rate change does not match the selected offer: Virgin Money Lite Home Loan, Virgin Money, Comparison rate 6.36%, Advertised rate 6.34% · Variable · Principal & interest · Owner occupied · Listed LVR >70.0%–80.0% · Conditions: Unverified, Tier #151, Best advertised ↑ 25 bps · 8 Nov 2026, Eligibility unverified, Freshness · Unknown |
| 31 | start filter rollback | 34 | +6 |  |  | 667 | Rate change does not match the selected offer: Virgin Money Lite Home Loan, Virgin Money, Comparison rate 6.36%, Advertised rate 6.34% · Variable · Principal & interest · Owner occupied · Listed LVR >70.0%–80.0% · Conditions: Unverified, Tier #151, Best advertised ↑ 25 bps · 8 Nov 2026, Eligibility unverified, Freshness · Unknown |
| 32 | start save from rates | 29 | +6 |  |  | 667 | Rate change does not match the selected offer: Virgin Money Lite Home Loan, Virgin Money, Comparison rate 6.36%, Advertised rate 6.34% · Variable · Principal & interest · Owner occupied · Listed LVR >70.0%–80.0% · Conditions: Unverified, Tier #151, Best advertised ↑ 25 bps · 8 Nov 2026, Eligibility unverified, Freshness · Unknown |
| 33 | start compare from rates | 31 | +1 |  |  | 668 | Rate change does not match the selected offer: Virgin Money Lite Home Loan, Virgin Money, Comparison rate 6.36%, Advertised rate 6.34% · Variable · Principal & interest · Owner occupied · Listed LVR >70.0%–80.0% · Conditions: Unverified, Tier #151, Best advertised ↑ 25 bps · 8 Nov 2026, Eligibility unverified, Freshness · Unknown |

## Errors

### 1 open app
```
11-28 15:21:58.607 E/australianrates( 4644): Not starting debugger since process cannot load the jdwp agent.
```
