# App explorer: 1.0.399 (455)

**Real-use session FAIL vs 1.0.399: 15 broken, 14 friction, 1 slower**

- Broken: Nothing to read for 45.9 s on "open app"
- Broken: "back to rates" failed: Rate change does not match the selected offer: Value Home Loan - Owner Occupied, Northern Inland Credit Union Limited, Comparison rate 6.23%, Advertised rate 6.19% · Variable · Principal & interest · Owner occupied · Listed LVR ≤80.0% · Conditions: Unverified, Tier #1, Best advertised ↑ 25 bps · 19 Nov 2026, Eligibility unverified, Freshness · Unknown
- Broken: "back from lenders" failed: Rate change does not match the selected offer: Value Home Loan - Owner Occupied, Northern Inland Credit Union Limited, Comparison rate 6.23%, Advertised rate 6.19% · Variable · Principal & interest · Owner occupied · Listed LVR ≤80.0% · Conditions: Unverified, Tier #1, Best advertised ↑ 25 bps · 19 Nov 2026, Eligibility unverified, Freshness · Unknown
- Broken: "switch to savings and see a priced account" failed: Rate change does not match the selected offer: Strong Start Saver, Bank First, Rate 5.90%, Ongoing · $0–$50k, Tier #1, Best advertised ↑ 25 bps · 3 days ago, Freshness · Unknown
- Broken: "switch to term deposits and see a priced offer" failed: Rate change does not match the selected offer: Term Deposit, Unity Bank, Rate 5.80%, 1 yr · $1k–$10m · at maturity · Conditions: Unverified, Tier #22, Best advertised ↑ 25 bps · 12 Nov 2026, Freshness · Unknown
- Broken: "switch to home loans" failed: Rate change does not match the selected offer: Value Home Loan - Owner Occupied, Northern Inland Credit Union Limited, Comparison rate 6.23%, Advertised rate 6.19% · Variable · Principal & interest · Owner occupied · Listed LVR ≤80.0% · Conditions: Unverified, Tier #1, Best advertised ↑ 25 bps · 19 Nov 2026, Eligibility unverified, Freshness · Unknown
- Broken: "close filters" failed: Rate change does not match the selected offer: Value Home Loan - Owner Occupied, Northern Inland Credit Union Limited, Comparison rate 6.23%, Advertised rate 6.19% · Variable · Principal & interest · Owner occupied · Listed LVR ≤80.0% · Conditions: Unverified, Tier #1, Best advertised ↑ 25 bps · 19 Nov 2026, Eligibility unverified, Freshness · Unknown
- Broken: "return to rates" failed: Rate change does not match the selected offer: Value Home Loan - Owner Occupied, Northern Inland Credit Union Limited, Comparison rate 6.23%, Advertised rate 6.19% · Variable · Principal & interest · Owner occupied · Listed LVR ≤80.0% · Conditions: Unverified, Tier #1, Best advertised ↑ 25 bps · 19 Nov 2026, Eligibility unverified, Freshness · Unknown
- Broken: "start category switch" failed: Rate change does not match the selected offer: Value Home Loan - Owner Occupied, Northern Inland Credit Union Limited, Comparison rate 6.23%, Advertised rate 6.19% · Variable · Principal & interest · Owner occupied · Listed LVR ≤80.0% · Conditions: Unverified, Tier #1, Best advertised ↑ 25 bps · 19 Nov 2026, Eligibility unverified, Freshness · Unknown
- Broken: "start search from rates" failed: Rate change does not match the selected offer: Value Home Loan - Owner Occupied, Northern Inland Credit Union Limited, Comparison rate 6.23%, Advertised rate 6.19% · Variable · Principal & interest · Owner occupied · Listed LVR ≤80.0% · Conditions: Unverified, Tier #1, Best advertised ↑ 25 bps · 19 Nov 2026, Eligibility unverified, Freshness · Unknown
- Broken: "start filter rollback" failed: Rate change does not match the selected offer: Value Home Loan - Owner Occupied, Northern Inland Credit Union Limited, Comparison rate 6.23%, Advertised rate 6.19% · Variable · Principal & interest · Owner occupied · Listed LVR ≤80.0% · Conditions: Unverified, Tier #1, Best advertised ↑ 25 bps · 19 Nov 2026, Eligibility unverified, Freshness · Unknown
- Broken: "start save from rates" failed: Rate change does not match the selected offer: Value Home Loan - Owner Occupied, Northern Inland Credit Union Limited, Comparison rate 6.23%, Advertised rate 6.19% · Variable · Principal & interest · Owner occupied · Listed LVR ≤80.0% · Conditions: Unverified, Tier #1, Best advertised ↑ 25 bps · 19 Nov 2026, Eligibility unverified, Freshness · Unknown
- Broken: "start compare from rates" failed: Rate change does not match the selected offer: Value Home Loan - Owner Occupied, Northern Inland Credit Union Limited, Comparison rate 6.23%, Advertised rate 6.19% · Variable · Principal & interest · Owner occupied · Listed LVR ≤80.0% · Conditions: Unverified, Tier #1, Best advertised ↑ 25 bps · 19 Nov 2026, Eligibility unverified, Freshness · Unknown
- Broken: "open savings features" failed: not found: {"id":"profile:Savings:accountFeatures:open"}
- Broken: "clear audit requirements" failed: not found: {"contains":"Clear all saved requirements"}
- Friction: No reaction for 3.2 s after "scroll rates 1"
- Friction: No reaction for 3.2 s after "scroll rates 2"
- Friction: No reaction for 3.2 s after "scroll product"
- Friction: No reaction for 3.1 s after "scroll product fees"
- Friction: No reaction for 3.2 s after "scroll product eligibility"
- Friction: No reaction for 3.1 s after "scroll product sources"
- Friction: No reaction for 3.0 s after "open lenders"
- Friction: No reaction for 5.2 s after "switch to savings and see a priced account"
- Friction: No reaction for 5.0 s after "switch to term deposits and see a priced offer"
- Friction: No reaction for 3.5 s after "switch to home loans"
- Friction: No reaction for 3.1 s after "open market"
- Friction: No reaction for 3.2 s after "scroll rba"
- Friction: No reaction for 3.1 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Slower: Dropped frames 52% to 74% on "back to rates"

**Initial Rates readiness:** no complete boot trace captured

**Extended journeys**

- Product categories: 0 passed, 1 failed, 3 blocked
- Search and clear: 0 passed, 1 failed, 5 blocked
- Discard temporary filters: 0 passed, 1 failed, 5 blocked
- Saved rate lifecycle: 0 passed, 1 failed, 9 blocked
- Compare two rates: 0 passed, 1 failed, 5 blocked
- Saved Savings matches: 1 passed, 1 failed, 11 blocked
- Restore Savings profile: 1 passed, 1 failed, 1 blocked

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-29

Mode session | 38 steps | crashes 0 | step failures 14 | settle timeouts 0 | steps with JS/native errors 1
Baseline 1.0.399

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 53324 |  | 1822/2464 | 85 | 499 | 4 errors; start 3720ms; boot js-start 83838, layout-mounted 84318, cache-read 84477, hydrated 84746, splash-hide 84746, manifest 86014, resolved 86785, core-fetched 103497, load-failed 103587 |
| 2 | scroll rates 1 | 5813 |  | 13/24 | 61 | 708 |  |
| 3 | scroll rates 2 | 739 |  | 20/30 | 73 | 617 |  |
| 4 | scroll rates back | 676 |  |  |  | 542 |  |
| 5 | open product | 26 |  | 38/56 | 93 | 664 |  |
| 6 | scroll product | 715 |  | 37/67 | 77 | 675 |  |
| 7 | expand visible fees | 22 |  | 9/14 | 93 | 658 |  |
| 8 | expand product facts | 22 |  | 109/170 | 81 | 661 |  |
| 9 | scroll product fees | 693 |  | 33/55 | 69 | 696 |  |
| 10 | scroll product eligibility | 791 |  | 22/34 | 105 | 666 |  |
| 11 | expand eligibility | 0 |  | 214/285 | 85 | 661 |  |
| 12 | expand constraints | 22 |  | 8/16 | 57 | 666 |  |
| 13 | scroll product sources | 691 |  | 19/33 | 81 | 670 |  |
| 14 | back to rates | 32 |  | 17/23 | 77 | 659 | Rate change does not match the selected offer: Value Home Loan - Owner Occupied, Northern Inland Credit Union Limited, Comparison rate 6.23%, Advertised rate 6.19% · Variable · Principal & interest · Owner occupied · Listed LVR ≤80.0% · Conditions: Unverified, Tier #1, Best advertised ↑ 25 bps · 19 Nov 2026, Eligibility unverified, Freshness · Unknown |
| 15 | open lenders | 23 |  | 22/25 | 300 | 662 |  |
| 16 | scroll lenders | 761 |  | 20/22 | 150 | 658 |  |
| 17 | back from lenders | 22 |  | 6/7 | 200 | 659 | Rate change does not match the selected offer: Value Home Loan - Owner Occupied, Northern Inland Credit Union Limited, Comparison rate 6.23%, Advertised rate 6.19% · Variable · Principal & interest · Owner occupied · Listed LVR ≤80.0% · Conditions: Unverified, Tier #1, Best advertised ↑ 25 bps · 19 Nov 2026, Eligibility unverified, Freshness · Unknown |
| 18 | switch to savings and see a priced account | 24 |  | 66/98 | 77 | 671 | Rate change does not match the selected offer: Strong Start Saver, Bank First, Rate 5.90%, Ongoing · $0–$50k, Tier #1, Best advertised ↑ 25 bps · 3 days ago, Freshness · Unknown |
| 19 | switch to term deposits and see a priced offer | 24 |  | 69/90 | 97 | 681 | Rate change does not match the selected offer: Term Deposit, Unity Bank, Rate 5.80%, 1 yr · $1k–$10m · at maturity · Conditions: Unverified, Tier #22, Best advertised ↑ 25 bps · 12 Nov 2026, Freshness · Unknown |
| 20 | switch to home loans | 25 |  | 16/27 | 69 | 695 | Rate change does not match the selected offer: Value Home Loan - Owner Occupied, Northern Inland Credit Union Limited, Comparison rate 6.23%, Advertised rate 6.19% · Variable · Principal & interest · Owner occupied · Listed LVR ≤80.0% · Conditions: Unverified, Tier #1, Best advertised ↑ 25 bps · 19 Nov 2026, Eligibility unverified, Freshness · Unknown |
| 21 | open filters | 23 |  | 23/28 | 129 | 697 |  |
| 22 | close filters | 23 |  | 8/9 | 150 | 689 | Rate change does not match the selected offer: Value Home Loan - Owner Occupied, Northern Inland Credit Union Limited, Comparison rate 6.23%, Advertised rate 6.19% · Variable · Principal & interest · Owner occupied · Listed LVR ≤80.0% · Conditions: Unverified, Tier #1, Best advertised ↑ 25 bps · 19 Nov 2026, Eligibility unverified, Freshness · Unknown |
| 23 | open market | 22 |  | 19/33 | 65 | 693 |  |
| 24 | open rba | 2550 |  | 84/97 | 69 | 709 |  |
| 25 | scroll rba | 720 |  | 31/53 | 73 | 702 |  |
| 26 | back from rba | 22 |  | 10/20 | 48 | 702 |  |
| 27 | scroll market | 677 |  | 25/40 | 77 | 699 |  |
| 28 | open saved | 22 |  | 18/25 | 85 | 704 |  |
| 29 | return to rates | 33 |  | 19/31 | 65 | 704 | Rate change does not match the selected offer: Value Home Loan - Owner Occupied, Northern Inland Credit Union Limited, Comparison rate 6.23%, Advertised rate 6.19% · Variable · Principal & interest · Owner occupied · Listed LVR ≤80.0% · Conditions: Unverified, Tier #1, Best advertised ↑ 25 bps · 19 Nov 2026, Eligibility unverified, Freshness · Unknown |
| 30 | start category switch | 33 |  |  |  | 704 | Rate change does not match the selected offer: Value Home Loan - Owner Occupied, Northern Inland Credit Union Limited, Comparison rate 6.23%, Advertised rate 6.19% · Variable · Principal & interest · Owner occupied · Listed LVR ≤80.0% · Conditions: Unverified, Tier #1, Best advertised ↑ 25 bps · 19 Nov 2026, Eligibility unverified, Freshness · Unknown |
| 31 | start search from rates | 31 |  |  |  | 704 | Rate change does not match the selected offer: Value Home Loan - Owner Occupied, Northern Inland Credit Union Limited, Comparison rate 6.23%, Advertised rate 6.19% · Variable · Principal & interest · Owner occupied · Listed LVR ≤80.0% · Conditions: Unverified, Tier #1, Best advertised ↑ 25 bps · 19 Nov 2026, Eligibility unverified, Freshness · Unknown |
| 32 | start filter rollback | 33 |  |  |  | 704 | Rate change does not match the selected offer: Value Home Loan - Owner Occupied, Northern Inland Credit Union Limited, Comparison rate 6.23%, Advertised rate 6.19% · Variable · Principal & interest · Owner occupied · Listed LVR ≤80.0% · Conditions: Unverified, Tier #1, Best advertised ↑ 25 bps · 19 Nov 2026, Eligibility unverified, Freshness · Unknown |
| 33 | start save from rates | 29 |  |  |  | 705 | Rate change does not match the selected offer: Value Home Loan - Owner Occupied, Northern Inland Credit Union Limited, Comparison rate 6.23%, Advertised rate 6.19% · Variable · Principal & interest · Owner occupied · Listed LVR ≤80.0% · Conditions: Unverified, Tier #1, Best advertised ↑ 25 bps · 19 Nov 2026, Eligibility unverified, Freshness · Unknown |
| 34 | start compare from rates | 28 |  |  |  | 705 | Rate change does not match the selected offer: Value Home Loan - Owner Occupied, Northern Inland Credit Union Limited, Comparison rate 6.23%, Advertised rate 6.19% · Variable · Principal & interest · Owner occupied · Listed LVR ≤80.0% · Conditions: Unverified, Tier #1, Best advertised ↑ 25 bps · 19 Nov 2026, Eligibility unverified, Freshness · Unknown |
| 35 | open savings profile | 26 |  | 12/23 | 73 | 707 |  |
| 36 | open savings features | 0 |  | 210/285 | 85 | 708 | not found: {"id":"profile:Savings:accountFeatures:open"} |
| 37 | restore audit profile | 25 |  | 2/2 | 32 | 708 |  |
| 38 | clear audit requirements | 0 |  | 211/279 | 85 | 713 | not found: {"contains":"Clear all saved requirements"} |

## Errors

### 1 open app
```
11-28 16:06:06.447 E/australianrates( 4848): Not starting debugger since process cannot load the jdwp agent.
11-28 16:06:12.156 E/unknown:SurfaceMountingManager( 4848): Stopping surface [1]
11-28 16:06:12.174 E/unknown:SurfaceMountingManager( 4848): Surface [1] was stopped on SurfaceMountingManager.
11-28 16:06:12.204 E/unknown:IntBufferBatchMountItem( 4848): Skipping batch of MountItems; was stopped [1].
```
