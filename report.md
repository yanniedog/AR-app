# App explorer: 1.0.400 (456)

**Real-use session FAIL vs 1.0.399: 2 broken, 22 friction, 7 slower**

- Broken: Nothing to read for 27.7 s on "open app"
- Broken: "choose ongoing savings" failed: UI assertion failed: app hierarchy unavailable
- Friction: No reaction for 3.7 s after "scroll rates 1"
- Friction: No reaction for 3.3 s after "scroll rates 2"
- Friction: No reaction for 5.2 s after "expand visible fees"
- Friction: No reaction for 3.1 s after "scroll product sources"
- Friction: No reaction for 3.7 s after "switch to savings and see a priced account"
- Friction: No reaction for 4.1 s after "switch to term deposits and see a priced offer"
- Friction: No reaction for 3.3 s after "switch to home loans"
- Friction: No reaction for 3.0 s after "open market"
- Friction: No reaction for 3.1 s after "scroll rba"
- Friction: No reaction for 3.1 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Friction: No reaction for 3.5 s after "verify term deposit rates"
- Friction: No reaction for 3.5 s after "inspect term deposit quote"
- Friction: No reaction for 3.2 s after "restore home loans"
- Friction: No reaction for 6.3 s after "search Macquarie"
- Friction: No reaction for 3.6 s after "return from savings search"
- Friction: No reaction for 3.2 s after "open mortgage filter draft"
- Friction: No reaction for 3.5 s after "open unsaved rate"
- Friction: No reaction for 9.2 s after "leave removed product"
- Friction: "No saved rates" shown on "leave removed product"
- Friction: "No saved rates" shown on "follow browse rates recovery"
- Friction: No reaction for 7.0 s after "start compare from rates"
- Slower: "expand visible fees" content 2.4 s to 5.2 s
- Slower: "expand visible fees" reaction 2.4 s to 5.2 s
- Slower: "start compare from rates" content 0.0 s to 7.0 s
- Slower: Dropped frames 74% to 100% on "open savings features"
- Slower: "open savings features" content 0.0 s to 2.4 s
- Slower: "restore audit profile" content 0.0 s to 2.1 s
- Slower: "clear audit requirements" content 0.0 s to 2.3 s

**Initial Rates readiness:** 83.0 s from JS start (at or above the 3 s target) · last blocker: rows

**Extended journeys**

- Product categories: 6 passed, 0 failed, 0 blocked
- Search and clear: 8 passed, 0 failed, 0 blocked
- Discard temporary filters: 6 passed, 0 failed, 0 blocked
- Saved rate lifecycle: 10 passed, 0 failed, 0 blocked
- Compare two rates: 6 passed, 0 failed, 0 blocked
- Saved Savings matches: 8 passed, 1 failed, 4 blocked
- Restore Savings profile: 3 passed, 0 failed, 0 blocked

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-29

Mode session | 77 steps | crashes 0 | step failures 1 | settle timeouts 0 | steps with JS/native errors 7
Baseline 1.0.399

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 53408 | +84 | 1371/2115 | 77 | 471 | 1 errors; start 3598ms; boot js-start 71865, layout-mounted 72282, cache-read 72460, hydrated 72694, splash-hide 72694, manifest 73935, resolved 74785, core-fetched 82696, core-saved 84922, pricing-wait-suitability 85498, search-index-idle 85499, details-start 86101, details-fetched 100941, rows-prepared 115601, detail-filters-idle 115601, leading-requested 115601, last-pricing 115601, suitability-built 121146, post-refresh-wait 122721, leading-scoped 144896, leading-page 144896, refresh-done 150730, pricing-ready 154497, last-rows 154497, rates-ready 154819, pricing-starts 1, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 297, pricing-scope-ms 35940, filter-runs 2, filter-rows 37735, filter-yields 9, filter-ms 197, sort-runs 1, sort-rows 2150, sort-yields 1, sort-ms 24 |
| 2 | scroll rates 1 | 879 | -4934 | 30/46 | 69 | 622 |  |
| 3 | scroll rates 2 | 732 | -7 | 22/38 | 81 | 565 |  |
| 4 | scroll rates back | 696 | +20 |  |  | 579 |  |
| 5 | open product | 34 | +8 | 36/58 | 81 | 634 |  |
| 6 | scroll product | 785 | +70 | 30/58 | 81 | 632 |  |
| 7 | expand visible fees | 2219 | +2197 | 8/17 | 46 | 644 |  |
| 8 | expand product facts | 11 | -11 | 211/380 | 77 | 676 |  |
| 9 | scroll product fees | 749 | +56 | 23/34 | 69 | 627 |  |
| 10 | scroll product eligibility | 777 | -14 | 26/35 | 73 | 625 |  |
| 11 | expand eligibility | 12 | +12 | 206/305 | 77 | 629 |  |
| 12 | expand constraints | 32 | +10 | 8/16 | 69 | 631 |  |
| 13 | scroll product sources | 804 | +113 | 26/38 | 77 | 635 |  |
| 14 | back to rates | 39 | +7 | 15/25 | 61 | 630 |  |
| 15 | open lenders | 38 | +15 | 19/25 | 200 | 632 |  |
| 16 | scroll lenders | 852 | +91 | 21/23 | 121 | 631 |  |
| 17 | back from lenders | 40 | +18 | 6/9 | 200 | 632 |  |
| 18 | switch to savings and see a priced account | 41 | +17 | 41/68 | 73 | 643 |  |
| 19 | switch to term deposits and see a priced offer | 36 | +12 | 41/69 | 69 | 653 |  |
| 20 | switch to home loans | 36 | +11 | 18/33 | 53 | 678 |  |
| 21 | open filters | 31 | +8 | 21/27 | 150 | 678 |  |
| 22 | close filters | 33 | +10 | 9/10 | 129 | 678 |  |
| 23 | open market | 36 | +14 | 16/34 | 53 | 684 |  |
| 24 | open rba | 2556 | +6 | 51/72 | 65 | 707 |  |
| 25 | scroll rba | 753 | +33 | 31/56 | 65 | 699 |  |
| 26 | back from rba | 41 | +19 | 9/20 | 53 | 700 |  |
| 27 | scroll market | 744 | +67 | 27/41 | 77 | 699 |  |
| 28 | open saved | 31 | +9 | 9/22 | 69 | 703 |  |
| 29 | return to rates | 34 | +1 | 14/28 | 73 | 710 |  |
| 30 | start category switch | 52 | +19 |  |  | 710 |  |
| 31 | open term deposits | 39 |  | 16/28 | 65 | 740 |  |
| 32 | verify term deposit rates | 734 |  | 34/59 | 77 | 740 |  |
| 33 | inspect term deposit quote | 33 |  | 31/50 | 81 | 772 |  |
| 34 | return from term deposit quote | 33 |  | 14/25 | 73 | 766 |  |
| 35 | restore home loans | 33 |  | 14/30 | 48 | 767 |  |
| 36 | start search from rates | 44 | +13 |  |  | 718 |  |
| 37 | open savings search | 36 |  | 16/32 | 65 | 734 |  |
| 38 | inspect savings quote | 59 |  | 37/60 | 81 | 720 |  |
| 39 | return from savings quote | 34 |  | 13/25 | 57 | 724 |  |
| 40 | search Macquarie | 2054 |  | 55/66 | 150 | 734 |  |
| 41 | verify Macquarie result | 13 |  | 11/15 | 16 | 725 | 1 errors |
| 42 | clear query and restore results | 41 |  | 17/20 | 25 | 737 |  |
| 43 | return from savings search | 37 |  | 36/44 | 93 | 749 |  |
| 44 | start filter rollback | 60 | +27 | 14/15 | 16 | 739 |  |
| 45 | open mortgage filter draft | 36 |  | 26/33 | 250 | 744 |  |
| 46 | select fixed in draft | 34 |  | 12/14 | 150 | 745 |  |
| 47 | discard unsaved filter draft | 31 |  | 18/21 | 93 | 748 |  |
| 48 | verify fixed was not applied | 30 |  | 21/23 | 200 | 751 | 1 errors |
| 49 | close verified filter draft | 30 |  | 18/21 | 101 | 750 |  |
| 50 | start save from rates | 41 | +12 | 12/16 | 16 | 748 | 1 errors |
| 51 | open unsaved rate | 67 |  | 73/114 | 77 | 763 | 1 errors |
| 52 | save a rate | 32 |  | 9/17 | 77 | 764 | 1 errors |
| 53 | leave saved product | 37 |  | 13/23 | 65 | 764 |  |
| 54 | restart with a saved rate | 15168 |  | 307/460 | 77 | 429 | 1 errors; start 5683ms; boot js-start 692022, layout-mounted 692614, hydrated 693370, cache-read 694164, core-ready 694785, rows-prepared 694939, search-index-idle 694939, detail-filters-idle 694939, leading-requested 694939, last-pricing 694939, splash-hide 694940, manifest 697481, resolved 698088, leading-scoped 701754, leading-page 701754, pricing-ready 702722, last-rows 702722, rates-ready 702935, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 91, pricing-scope-ms 4938, filter-runs 2, filter-rows 37735, filter-yields 7, filter-ms 147, sort-runs 1, sort-rows 2150, sort-yields 1, sort-ms 23 |
| 55 | verify saved rate after restart | 32 |  | 25/41 | 81 | 453 |  |
| 56 | open product from saved rates | 36 |  | 41/65 | 77 | 595 |  |
| 57 | remove saved rate | 39 |  | 10/18 | 89 | 617 |  |
| 58 | leave removed product | 6574 |  | 6/11 | 61 | 643 |  |
| 59 | follow browse rates recovery | 32 |  |  |  | 682 |  |
| 60 | start compare from rates | 4400 | +4372 | 17/30 | 57 | 704 |  |
| 61 | enter selection mode | 37 |  | 9/15 | 53 | 702 |  |
| 62 | select first comparison rate | 41 |  | 10/17 | 53 | 709 |  |
| 63 | select second comparison rate | 30 |  | 9/14 | 61 | 708 |  |
| 64 | open two-rate comparison | 31 |  | 21/33 | 97 | 717 |  |
| 65 | return from two-rate comparison | 40 |  | 18/30 | 89 | 719 |  |
| 66 | open savings profile | 42 | +16 | 16/32 | 73 | 718 |  |
| 67 | open savings features | 31 | +31 | 20/20 | 200 | 716 |  |
| 68 | require Card access | 29 |  | 12/14 | 97 | 722 |  |
| 69 | require PayID | 39 |  |  |  | 728 |  |
| 70 | require Unlimited transactions | 31 |  | 24/29 | 77 | 745 |  |
| 71 | require Bill payment | 31 |  |  |  | 730 |  |
| 72 | save four savings features | 33 |  | 20/27 | 117 | 754 |  |
| 73 | open savings rate kinds | 32 |  |  |  | 745 |  |
| 74 | choose ongoing savings | 32 |  | 35/41 | 150 | 771 | UI assertion failed: app hierarchy unavailable |
| 75 | restore audit profile | 95 | +70 |  |  | 759 |  |
| 76 | clear audit requirements | 28 | +28 | 33/60 | 81 | 761 |  |
| 77 | leave savings profile | 44 |  |  |  | 760 |  |

## Errors

### 1 open app
```
11-28 16:28:20.039 E/australianrates( 4879): Not starting debugger since process cannot load the jdwp agent.
```

### 41 verify Macquarie result
```
11-28 16:36:53.986 E/FrameTracker( 4879): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 48 verify fixed was not applied
```
11-28 16:37:55.085 E/FrameTracker( 4879): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 50 start save from rates
```
11-28 16:38:11.347 E/FrameTracker( 4879): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 51 open unsaved rate
```
11-28 16:38:16.542 E/ImeBackDispatcher( 4879): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 65029035
```

### 52 save a rate
```
11-28 16:38:27.004 E/FrameTracker( 4879): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 54 restart with a saved rate
```
11-28 16:38:41.379 E/australianrates(13106): Not starting debugger since process cannot load the jdwp agent.
```
**Rate evidence: findings** · Published edition app-payload-2026-11-29-r000001 · APK binding date_only

| Category | Banks visible / published | Products visible / published |
| --- | ---: | ---: |
| Mortgage | 6 / 140 | 10 / 1893 |
| Savings | 6 / 100 | 6 / 740 |
| TD | 8 / 87 | 9 / 656 |

Visible tier observations: date only match 59
List-to-detail quotes: Mortgage date_only_match, Savings date_only_match, TD date_only_match
Historical changes: product best delta matches 10, best tier conditions changed 3
Direct bank CDR product checks: register brand unresolved 56, read 286, bank response unavailable 3
CDR values within rate type and published term: value present 3556, unmatched scope 4, source unit unverified 2, value absent 1
Retail website tables (Judo Bank personal TD and Australian Military Bank Income Plus / Investment Plus): rate and frequency match 18, payment frequency differs 2, unverified 24

- Retail page unavailable: https://www.judo.bank/term-deposits/personal-term-deposit/ (curl: (22) The requested URL returned error: 403)
- Income Plus, tier 2, 9 months: core 5.2500% at_maturity, retail {"monthly":"5.25"} (https://australianmilitarybank.com.au/bank-and-save/term-deposits/)

