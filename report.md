# App explorer: 1.0.399 (455)

**Real-use session FAIL vs 1.0.398: 13 broken, 13 friction, 5 slower**

- Broken: Nothing to read for 41.7 s on "open app"
- Broken: "open product" failed: Rate change does not match the selected offer: Best advertised ↑ 25 bps · 13 Nov 2026 · 6.09% → 6.34%
- Broken: "back to rates" failed: Rate change does not match the selected offer: PLUS HOME LOAN FIXED 1YR 60-80 LVR PI, Cairns bank, Comparison rate 6.31%, Advertised rate 6.49% · Fixed · 1 yr · Principal & interest · Owner occupied · Listed LVR >60.0%–80.0%, Tier #1, Best advertised ↑ 25 bps · 28 Oct 2026, Freshness · Unknown
- Broken: "back from lenders" failed: Rate change does not match the selected offer: PLUS HOME LOAN FIXED 1YR 60-80 LVR PI, Cairns bank, Comparison rate 6.31%, Advertised rate 6.49% · Fixed · 1 yr · Principal & interest · Owner occupied · Listed LVR >60.0%–80.0%, Tier #1, Best advertised ↑ 25 bps · 28 Oct 2026, Freshness · Unknown
- Broken: "switch to savings" failed: Rate change does not match the selected offer: Strong Start Saver, Bank First, Rate 5.90%, Ongoing · $0–$50k, Tier #1, Best advertised ↑ 25 bps · 3 days ago, Freshness · Unknown
- Broken: "switch to home loans" failed: Rate change does not match the selected offer: PLUS HOME LOAN FIXED 1YR 60-80 LVR PI, Cairns bank, Comparison rate 6.31%, Advertised rate 6.49% · Fixed · 1 yr · Principal & interest · Owner occupied · Listed LVR >60.0%–80.0%, Tier #1, Best advertised ↑ 25 bps · 28 Oct 2026, Freshness · Unknown
- Broken: "close filters" failed: Rate change does not match the selected offer: PLUS HOME LOAN FIXED 1YR 60-80 LVR PI, Cairns bank, Comparison rate 6.31%, Advertised rate 6.49% · Fixed · 1 yr · Principal & interest · Owner occupied · Listed LVR >60.0%–80.0%, Tier #1, Best advertised ↑ 25 bps · 28 Oct 2026, Freshness · Unknown
- Broken: "return to rates" failed: Rate change does not match the selected offer: PLUS HOME LOAN FIXED 1YR 60-80 LVR PI, Cairns bank, Comparison rate 6.31%, Advertised rate 6.49% · Fixed · 1 yr · Principal & interest · Owner occupied · Listed LVR >60.0%–80.0%, Tier #1, Best advertised ↑ 25 bps · 28 Oct 2026, Freshness · Unknown
- Broken: "start category switch" failed: Rate change does not match the selected offer: PLUS HOME LOAN FIXED 1YR 60-80 LVR PI, Cairns bank, Comparison rate 6.31%, Advertised rate 6.49% · Fixed · 1 yr · Principal & interest · Owner occupied · Listed LVR >60.0%–80.0%, Tier #1, Best advertised ↑ 25 bps · 28 Oct 2026, Freshness · Unknown
- Broken: "start search from rates" failed: Rate change does not match the selected offer: PLUS HOME LOAN FIXED 1YR 60-80 LVR PI, Cairns bank, Comparison rate 6.31%, Advertised rate 6.49% · Fixed · 1 yr · Principal & interest · Owner occupied · Listed LVR >60.0%–80.0%, Tier #1, Best advertised ↑ 25 bps · 28 Oct 2026, Freshness · Unknown
- Broken: "start filter rollback" failed: Rate change does not match the selected offer: PLUS HOME LOAN FIXED 1YR 60-80 LVR PI, Cairns bank, Comparison rate 6.31%, Advertised rate 6.49% · Fixed · 1 yr · Principal & interest · Owner occupied · Listed LVR >60.0%–80.0%, Tier #1, Best advertised ↑ 25 bps · 28 Oct 2026, Freshness · Unknown
- Broken: "start save from rates" failed: Rate change does not match the selected offer: PLUS HOME LOAN FIXED 1YR 60-80 LVR PI, Cairns bank, Comparison rate 6.31%, Advertised rate 6.49% · Fixed · 1 yr · Principal & interest · Owner occupied · Listed LVR >60.0%–80.0%, Tier #1, Best advertised ↑ 25 bps · 28 Oct 2026, Freshness · Unknown
- Broken: "start compare from rates" failed: Rate change does not match the selected offer: PLUS HOME LOAN FIXED 1YR 60-80 LVR PI, Cairns bank, Comparison rate 6.31%, Advertised rate 6.49% · Fixed · 1 yr · Principal & interest · Owner occupied · Listed LVR >60.0%–80.0%, Tier #1, Best advertised ↑ 25 bps · 28 Oct 2026, Freshness · Unknown
- Friction: No reaction for 3.6 s after "scroll rates 1"
- Friction: No reaction for 4.1 s after "scroll rates 2"
- Friction: No reaction for 3.2 s after "scroll product"
- Friction: No reaction for 3.3 s after "scroll product fees"
- Friction: No reaction for 3.3 s after "scroll product eligibility"
- Friction: No reaction for 3.2 s after "scroll product sources"
- Friction: No reaction for 5.2 s after "switch to savings"
- Friction: No reaction for 3.5 s after "switch to home loans"
- Friction: No reaction for 3.5 s after "open filters"
- Friction: No reaction for 3.1 s after "open market"
- Friction: No reaction for 3.2 s after "scroll rba"
- Friction: No reaction for 3.3 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Slower: "open app" content 49.0 s to 95.3 s
- Slower: "open product" content 0.0 s to 2.7 s
- Slower: "expand visible fees" content 0.0 s to 2.5 s
- Slower: Dropped frames 58% to 74% on "scroll product eligibility"
- Slower: Dropped frames 62% to 90% on "scroll product sources"

**Initial Rates readiness:** 106.8 s from JS start (at or above the 3 s target) · last blocker: rows

**Extended journeys**

- Product categories: 0 passed, 1 failed, 3 blocked
- Search and clear: 0 passed, 1 failed, 5 blocked
- Discard temporary filters: 0 passed, 1 failed, 5 blocked
- Saved rate lifecycle: 0 passed, 1 failed, 9 blocked
- Compare two rates: 0 passed, 1 failed, 5 blocked

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-29

Mode session | 33 steps | crashes 0 | step failures 12 | settle timeouts 0 | steps with JS/native errors 1
Baseline 1.0.398

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 53760 | -45703 | 1729/2183 | 93 | 537 | 1 errors; start 4050ms |
| 2 | scroll rates 1 | 6592 | +2586 | 28/41 | 57 | 624 | boot js-start 83265, layout-mounted 83704, cache-read 83987, hydrated 84315, splash-hide 84315, manifest 86032, resolved 86849, core-fetched 95712, core-saved 97404, pricing-wait-suitability 98032, search-index-idle 98032, details-start 98921, details-fetched 121029, rows-prepared 141407, detail-filters-idle 141407, leading-requested 141407, last-pricing 141407, suitability-built 144189, post-refresh-wait 145248, leading-scoped 172175, leading-page 172175, refresh-done 179671, pricing-ready 189472, last-rows 189472, rates-ready 190046, pricing-starts 1, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 424, pricing-scope-ms 45861, filter-runs 2, filter-rows 37735, filter-yields 17, filter-ms 386, sort-runs 1, sort-rows 2150, sort-yields 1, sort-ms 47 |
| 3 | scroll rates 2 | 745 | -13 | 32/46 | 89 | 532 |  |
| 4 | scroll rates back | 716 | +1 |  |  | 577 |  |
| 5 | open product | 6041 | +6006 | 41/54 | 85 | 650 | Rate change does not match the selected offer: Best advertised ↑ 25 bps · 13 Nov 2026 · 6.09% → 6.34% |
| 6 | scroll product | 712 | -3 | 36/48 | 89 | 653 |  |
| 7 | expand visible fees | 28 | +28 | 7/12 | 105 | 647 |  |
| 8 | expand product facts | 28 | +3 | 106/159 | 89 | 670 |  |
| 9 | scroll product fees | 743 | +15 | 37/51 | 97 | 665 |  |
| 10 | scroll product eligibility | 766 | +37 | 35/47 | 97 | 659 |  |
| 11 | expand eligibility | 0 | -22 | 200/260 | 93 | 632 |  |
| 12 | expand constraints | 27 | +1 | 10/15 | 69 | 637 |  |
| 13 | scroll product sources | 757 | +32 | 26/29 | 97 | 637 |  |
| 14 | back to rates | 36 | -2 | 11/21 | 57 | 635 | Rate change does not match the selected offer: PLUS HOME LOAN FIXED 1YR 60-80 LVR PI, Cairns bank, Comparison rate 6.31%, Advertised rate 6.49% · Fixed · 1 yr · Principal & interest · Owner occupied · Listed LVR >60.0%–80.0%, Tier #1, Best advertised ↑ 25 bps · 28 Oct 2026, Freshness · Unknown |
| 15 | open lenders | 28 | +4 | 19/22 | 200 | 641 |  |
| 16 | scroll lenders | 801 | +90 | 21/21 | 150 | 639 |  |
| 17 | back from lenders | 30 | +4 | 8/8 | 150 | 639 | Rate change does not match the selected offer: PLUS HOME LOAN FIXED 1YR 60-80 LVR PI, Cairns bank, Comparison rate 6.31%, Advertised rate 6.49% · Fixed · 1 yr · Principal & interest · Owner occupied · Listed LVR >60.0%–80.0%, Tier #1, Best advertised ↑ 25 bps · 28 Oct 2026, Freshness · Unknown |
| 18 | switch to savings | 28 | -1 | 68/85 | 85 | 650 | Rate change does not match the selected offer: Strong Start Saver, Bank First, Rate 5.90%, Ongoing · $0–$50k, Tier #1, Best advertised ↑ 25 bps · 3 days ago, Freshness · Unknown |
| 19 | switch to home loans | 28 | +4 | 19/26 | 65 | 671 | Rate change does not match the selected offer: PLUS HOME LOAN FIXED 1YR 60-80 LVR PI, Cairns bank, Comparison rate 6.31%, Advertised rate 6.49% · Fixed · 1 yr · Principal & interest · Owner occupied · Listed LVR >60.0%–80.0%, Tier #1, Best advertised ↑ 25 bps · 28 Oct 2026, Freshness · Unknown |
| 20 | open filters | 29 | +2 | 26/29 | 150 | 678 |  |
| 21 | close filters | 28 | +5 | 6/8 | 150 | 669 | Rate change does not match the selected offer: PLUS HOME LOAN FIXED 1YR 60-80 LVR PI, Cairns bank, Comparison rate 6.31%, Advertised rate 6.49% · Fixed · 1 yr · Principal & interest · Owner occupied · Listed LVR >60.0%–80.0%, Tier #1, Best advertised ↑ 25 bps · 28 Oct 2026, Freshness · Unknown |
| 22 | open market | 31 | +8 | 19/29 | 73 | 676 |  |
| 23 | open rba | 2749 | -26 | 79/89 | 73 | 698 |  |
| 24 | scroll rba | 711 | -22 | 29/47 | 77 | 690 |  |
| 25 | back from rba | 34 | +10 | 14/19 | 61 | 691 |  |
| 26 | scroll market | 713 | +24 | 26/40 | 89 | 690 |  |
| 27 | open saved | 28 | +5 | 17/27 | 93 | 694 |  |
| 28 | return to rates | 29 | +4 | 20/31 | 89 | 700 | Rate change does not match the selected offer: PLUS HOME LOAN FIXED 1YR 60-80 LVR PI, Cairns bank, Comparison rate 6.31%, Advertised rate 6.49% · Fixed · 1 yr · Principal & interest · Owner occupied · Listed LVR >60.0%–80.0%, Tier #1, Best advertised ↑ 25 bps · 28 Oct 2026, Freshness · Unknown |
| 29 | start category switch | 35 | +4 |  |  | 700 | Rate change does not match the selected offer: PLUS HOME LOAN FIXED 1YR 60-80 LVR PI, Cairns bank, Comparison rate 6.31%, Advertised rate 6.49% · Fixed · 1 yr · Principal & interest · Owner occupied · Listed LVR >60.0%–80.0%, Tier #1, Best advertised ↑ 25 bps · 28 Oct 2026, Freshness · Unknown |
| 30 | start search from rates | 34 | +3 |  |  | 701 | Rate change does not match the selected offer: PLUS HOME LOAN FIXED 1YR 60-80 LVR PI, Cairns bank, Comparison rate 6.31%, Advertised rate 6.49% · Fixed · 1 yr · Principal & interest · Owner occupied · Listed LVR >60.0%–80.0%, Tier #1, Best advertised ↑ 25 bps · 28 Oct 2026, Freshness · Unknown |
| 31 | start filter rollback | 38 | +4 |  |  | 703 | Rate change does not match the selected offer: PLUS HOME LOAN FIXED 1YR 60-80 LVR PI, Cairns bank, Comparison rate 6.31%, Advertised rate 6.49% · Fixed · 1 yr · Principal & interest · Owner occupied · Listed LVR >60.0%–80.0%, Tier #1, Best advertised ↑ 25 bps · 28 Oct 2026, Freshness · Unknown |
| 32 | start save from rates | 31 | +2 |  |  | 704 | Rate change does not match the selected offer: PLUS HOME LOAN FIXED 1YR 60-80 LVR PI, Cairns bank, Comparison rate 6.31%, Advertised rate 6.49% · Fixed · 1 yr · Principal & interest · Owner occupied · Listed LVR >60.0%–80.0%, Tier #1, Best advertised ↑ 25 bps · 28 Oct 2026, Freshness · Unknown |
| 33 | start compare from rates | 36 | +5 |  |  | 705 | Rate change does not match the selected offer: PLUS HOME LOAN FIXED 1YR 60-80 LVR PI, Cairns bank, Comparison rate 6.31%, Advertised rate 6.49% · Fixed · 1 yr · Principal & interest · Owner occupied · Listed LVR >60.0%–80.0%, Tier #1, Best advertised ↑ 25 bps · 28 Oct 2026, Freshness · Unknown |

## Errors

### 1 open app
```
11-28 15:34:07.699 E/australianrates( 4840): Not starting debugger since process cannot load the jdwp agent.
```
