# App explorer: 1.0.399 (455)

**Real-use session ATTENTION vs 1.0.398: 0 broken, 22 friction, 0 slower**

- Friction: Nothing to read for 5.6 s on "open app"
- Friction: No reaction for 3.3 s after "scroll rates 1"
- Friction: No reaction for 3.5 s after "scroll rates 2"
- Friction: No reaction for 3.5 s after "scroll product"
- Friction: No reaction for 3.1 s after "scroll product sources"
- Friction: No reaction for 4.0 s after "switch to savings"
- Friction: No reaction for 3.3 s after "switch to home loans"
- Friction: No reaction for 3.1 s after "open market"
- Friction: No reaction for 3.0 s after "scroll rba"
- Friction: No reaction for 3.2 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Friction: No reaction for 4.6 s after "open term deposits"
- Friction: No reaction for 3.3 s after "verify term deposit rates"
- Friction: No reaction for 3.4 s after "inspect term deposit quote"
- Friction: No reaction for 3.1 s after "restore home loans"
- Friction: No reaction for 3.5 s after "inspect savings quote"
- Friction: No reaction for 6.1 s after "search Macquarie"
- Friction: No reaction for 3.3 s after "return from savings search"
- Friction: No reaction for 3.2 s after "verify fixed was not applied"
- Friction: No reaction for 3.2 s after "open unsaved rate"
- Friction: "No saved rates" shown on "leave removed product"
- Friction: No reaction for 4.8 s after "follow browse rates recovery"

**Initial Rates readiness:** 67.0 s from JS start (at or above the 3 s target) · last blocker: rows

**Extended journeys**

- Product categories: 6 passed, 0 failed, 0 blocked
- Search and clear: 8 passed, 0 failed, 0 blocked
- Discard temporary filters: 6 passed, 0 failed, 0 blocked
- Saved rate lifecycle: 10 passed, 0 failed, 0 blocked
- Compare two rates: 6 passed, 0 failed, 0 blocked

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-29

Mode session | 64 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 7
Baseline 1.0.398

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 53063 | -51387 | 1008/1578 | 73 | 546 | 1 errors; start 3691ms |
| 2 | scroll rates 1 | 3445 | -3140 | 43/64 | 85 | 749 | boot js-start 67943, layout-mounted 68244, cache-read 68422, hydrated 68656, splash-hide 68656, manifest 70347, resolved 70742, core-fetched 78016, core-saved 79209, pricing-wait-suitability 80060, search-index-idle 80060, details-start 81240, details-fetched 91947, rows-prepared 100420, detail-filters-idle 100420, leading-requested 100420, last-pricing 100420, suitability-built 102460, post-refresh-wait 104420, leading-scoped 119934, leading-page 119934, refresh-done 127757, pricing-ready 134692, last-rows 134692, rates-ready 134901, pricing-starts 1, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 330, pricing-scope-ms 32660, filter-runs 2, filter-rows 37735, filter-yields 7, filter-ms 124, sort-runs 1, sort-rows 2150, sort-yields 1, sort-ms 17 |
| 3 | scroll rates 2 | 936 | +197 | 23/34 | 89 | 522 |  |
| 4 | scroll rates back | 700 | -30 |  |  | 539 |  |
| 5 | open product | 56 | -65 | 30/57 | 85 | 649 |  |
| 6 | scroll product | 763 | -3 | 28/63 | 73 | 683 |  |
| 7 | expand visible fees | 42 | -4471 | 9/16 | 42 | 636 |  |
| 8 | expand product facts | 15 | -1 | 210/380 | 81 | 656 |  |
| 9 | scroll product fees | 788 | +7 | 20/36 | 65 | 636 |  |
| 10 | scroll product eligibility | 784 | -1 | 24/32 | 81 | 633 |  |
| 11 | expand eligibility | 17 | +1 | 192/310 | 77 | 635 |  |
| 12 | expand constraints | 43 | -11 | 9/15 | 57 | 639 |  |
| 13 | scroll product sources | 785 | +36 | 20/38 | 69 | 644 |  |
| 14 | back to rates | 54 | +9 | 12/24 | 65 | 639 |  |
| 15 | open lenders | 46 | +1 | 19/23 | 250 | 642 |  |
| 16 | scroll lenders | 782 | -129 | 22/24 | 125 | 640 |  |
| 17 | back from lenders | 45 | +5 | 7/9 | 200 | 641 |  |
| 18 | switch to savings | 52 | +8 | 44/77 | 69 | 656 |  |
| 19 | switch to home loans | 117 | +60 | 13/28 | 61 | 668 |  |
| 20 | open filters | 54 | +13 | 20/24 | 150 | 662 |  |
| 21 | close filters | 55 | +12 | 7/10 | 133 | 661 |  |
| 22 | open market | 66 | +24 | 20/32 | 61 | 665 |  |
| 23 | open rba | 2609 | -46 | 55/71 | 65 | 682 |  |
| 24 | scroll rba | 787 | -11 | 27/53 | 65 | 674 |  |
| 25 | back from rba | 61 | +21 | 10/20 | 57 | 675 |  |
| 26 | scroll market | 770 | -48 | 26/43 | 69 | 674 |  |
| 27 | open saved | 49 | +5 | 13/22 | 85 | 680 |  |
| 28 | return to rates | 42 | -5 | 13/28 | 77 | 681 |  |
| 29 | start category switch | 79 | -14400 |  |  | 680 |  |
| 30 | open term deposits | 47 | -25 | 57/86 | 77 | 700 |  |
| 31 | verify term deposit rates | 769 | -7 | 33/61 | 65 | 701 |  |
| 32 | inspect term deposit quote | 71 | +30 | 33/51 | 81 | 716 |  |
| 33 | return from term deposit quote | 45 |  | 13/23 | 69 | 711 |  |
| 34 | restore home loans | 42 |  | 16/31 | 57 | 725 |  |
| 35 | start search from rates | 57 | 0 |  |  | 722 |  |
| 36 | open savings search | 58 | -7 | 15/29 | 57 | 735 |  |
| 37 | inspect savings quote | 45 | -1 | 227/416 | 73 | 792 |  |
| 38 | return from savings quote | 144 |  | 38/78 | 81 | 786 |  |
| 39 | search Macquarie | 1935 |  | 55/63 | 150 | 754 |  |
| 40 | verify Macquarie result | 24 |  | 13/15 | 32 | 745 | 1 errors |
| 41 | clear query and restore results | 40 |  | 16/20 | 34 | 761 |  |
| 42 | return from savings search | 63 |  | 28/40 | 85 | 799 |  |
| 43 | start filter rollback | 46 | -61 | 15/16 | 17 | 794 |  |
| 44 | open mortgage filter draft | 63 | +23 | 22/25 | 200 | 803 |  |
| 45 | select fixed in draft | 39 |  | 12/13 | 117 | 792 |  |
| 46 | discard unsaved filter draft | 37 |  | 16/22 | 85 | 795 |  |
| 47 | verify fixed was not applied | 47 |  | 21/28 | 300 | 801 | 1 errors |
| 48 | close verified filter draft | 29 |  | 16/23 | 105 | 805 |  |
| 49 | start save from rates | 55 | +5 | 11/16 | 16 | 803 | 1 errors |
| 50 | open unsaved rate | 51 |  | 62/99 | 81 | 867 | 1 errors |
| 51 | save a rate | 52 |  | 7/16 | 65 | 837 | 1 errors |
| 52 | leave saved product | 45 |  | 14/22 | 65 | 837 |  |
| 53 | restart with a saved rate | 15557 |  | 281/452 | 73 | 425 | 1 errors; start 5406ms; boot js-start 672461, layout-mounted 672865, hydrated 672866, cache-read 674008, core-ready 674544, rows-prepared 674669, search-index-idle 674669, detail-filters-idle 674669, leading-requested 674669, last-pricing 674669, splash-hide 674670, manifest 677061, resolved 677653, leading-scoped 681875, leading-page 681875, pricing-ready 682830, last-rows 682830, rates-ready 683022, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 99, pricing-scope-ms 5465, filter-runs 2, filter-rows 37735, filter-yields 7, filter-ms 115, sort-runs 1, sort-rows 2150, sort-yields 1, sort-ms 14 |
| 54 | verify saved rate after restart | 43 |  | 20/34 | 73 | 521 |  |
| 55 | open product from saved rates | 47 |  | 40/66 | 73 | 661 |  |
| 56 | remove saved rate | 42 |  |  |  | 630 |  |
| 57 | leave removed product | 48 |  | 15/26 | 77 | 694 |  |
| 58 | follow browse rates recovery | 2252 |  | 15/30 | 73 | 695 |  |
| 59 | start compare from rates | 56 | +6 | 2/2 | 32 | 700 |  |
| 60 | enter selection mode | 41 |  | 7/13 | 65 | 714 |  |
| 61 | select first comparison rate | 38 |  | 11/16 | 57 | 707 |  |
| 62 | select second comparison rate | 41 |  | 9/13 | 48 | 706 |  |
| 63 | open two-rate comparison | 40 |  | 20/31 | 129 | 716 |  |
| 64 | return from two-rate comparison | 32 |  | 22/32 | 89 | 717 |  |

## Errors

### 1 open app
```
11-28 15:51:20.540 E/australianrates( 4859): Not starting debugger since process cannot load the jdwp agent.
```

### 40 verify Macquarie result
```
11-28 15:59:37.374 E/FrameTracker( 4859): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 47 verify fixed was not applied
```
11-28 16:00:37.707 E/FrameTracker( 4859): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 49 start save from rates
```
11-28 16:00:54.722 E/FrameTracker( 4859): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 50 open unsaved rate
```
11-28 16:01:00.481 E/ImeBackDispatcher( 4859): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 80160059
```

### 51 save a rate
```
11-28 16:01:11.206 E/FrameTracker( 4859): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 53 restart with a saved rate
```
11-28 16:01:25.132 E/australianrates(12789): Not starting debugger since process cannot load the jdwp agent.
```
**Rate evidence: findings** · Published edition app-payload-2026-11-29-r000001 · APK binding date_only

| Category | Banks visible / published | Products visible / published |
| --- | ---: | ---: |
| Mortgage | 6 / 140 | 10 / 1893 |
| Savings | 6 / 100 | 6 / 740 |
| TD | 8 / 87 | 9 / 656 |

Visible tier observations: date only match 52
List-to-detail quotes: Mortgage date_only_match, Savings date_only_match, TD date_only_match
Historical changes: product best delta matches 9, best tier conditions changed 3, history unavailable 1
Direct bank CDR product checks: register brand unresolved 56, read 284, bank response unavailable 5
CDR values within rate type and published term: value present 3512, unmatched scope 4, source unit unverified 2, value absent 1
Retail website tables (Judo Bank personal TD and Australian Military Bank Income Plus / Investment Plus): rate and frequency match 18, payment frequency differs 2, unverified 24

- Retail page unavailable: https://www.judo.bank/term-deposits/personal-term-deposit/ (curl: (22) The requested URL returned error: 403)
- Income Plus, tier 2, 9 months: core 5.2500% at_maturity, retail {"monthly":"5.25"} (https://australianmilitarybank.com.au/bank-and-save/term-deposits/)

