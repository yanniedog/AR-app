# App explorer: 1.0.399 (455)

**Real-use session ATTENTION vs 1.0.398: 0 broken, 17 friction, 6 slower**

- Friction: Nothing to read for 6.6 s on "open app"
- Friction: No reaction for 4.3 s after "scroll rates 1"
- Friction: No reaction for 3.0 s after "scroll product eligibility"
- Friction: No reaction for 3.2 s after "scroll product sources"
- Friction: No reaction for 4.6 s after "back to rates"
- Friction: No reaction for 3.7 s after "switch to savings"
- Friction: No reaction for 3.4 s after "switch to home loans"
- Friction: No reaction for 3.0 s after "scroll rba"
- Friction: "No saved rates" shown on "open saved"
- Friction: No reaction for 3.1 s after "verify Income Plus rate history"
- Friction: No reaction for 3.8 s after "open term deposits"
- Friction: No reaction for 3.4 s after "verify term deposit rates"
- Friction: No reaction for 5.8 s after "search Macquarie"
- Friction: No reaction for 3.4 s after "return from savings search"
- Friction: No reaction for 3.9 s after "open unsaved rate"
- Friction: "No saved rates" shown on "leave removed product"
- Friction: No reaction for 4.3 s after "follow browse rates recovery"
- Slower: "open product" content 0.0 s to 2.5 s
- Slower: "expand visible fees" content 0.0 s to 2.4 s
- Slower: "back to rates" content 2.3 s to 4.6 s
- Slower: "back to rates" reaction 2.3 s to 4.6 s
- Slower: "start category switch" content 0.0 s to 2.2 s
- Slower: "start compare from rates" content 0.0 s to 2.0 s

**Initial Rates readiness:** 62.5 s from JS start (at or above the 3 s target) · last blocker: rows

**Extended journeys**

- Rate change evidence: 1 passed, 0 failed, 0 blocked
- Product categories: 4 passed, 0 failed, 0 blocked
- Search and clear: 6 passed, 0 failed, 0 blocked
- Discard temporary filters: 6 passed, 0 failed, 0 blocked
- Saved rate lifecycle: 10 passed, 0 failed, 0 blocked
- Compare two rates: 6 passed, 0 failed, 0 blocked

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-29

Mode session | 61 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 6
Baseline 1.0.398

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 52608 | -46855 | 998/1630 | 77 | 511 | 1 errors; start 3794ms |
| 2 | scroll rates 1 | 748 | -3258 | 35/60 | 65 | 751 | boot js-start 81359, layout-mounted 82100, cache-read 82488, hydrated 82875, splash-hide 82875, manifest 84016, resolved 84550, core-fetched 92716, core-saved 94682, pricing-wait-suitability 95784, search-index-idle 95784, details-start 97207, details-fetched 110403, rows-prepared 119653, detail-filters-idle 119653, leading-requested 119653, last-pricing 119653, suitability-built 121830, post-refresh-wait 123479, leading-scoped 135612, leading-page 135612, pricing-ready 143365, last-rows 143365, rates-ready 143892, pricing-starts 1, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 283, pricing-scope-ms 21793, filter-runs 2, filter-rows 37735, filter-yields 16, filter-ms 366, sort-runs 1, sort-rows 2150, sort-yields 1, sort-ms 43 |
| 3 | scroll rates 2 | 711 | -47 | 24/38 | 77 | 532 |  |
| 4 | scroll rates back | 682 | -33 |  |  | 537 |  |
| 5 | open product | 28 | -7 | 30/60 | 81 | 621 |  |
| 6 | scroll product | 704 | -11 | 28/66 | 77 | 688 |  |
| 7 | expand visible fees | 22 | +22 | 7/16 | 61 | 661 |  |
| 8 | expand product facts | 20 | -5 | 74/163 | 77 | 695 |  |
| 9 | scroll product fees | 705 | -23 | 25/57 | 69 | 686 |  |
| 10 | scroll product eligibility | 706 | -23 | 11/30 | 65 | 659 |  |
| 11 | expand eligibility | 21 | -1 | 6/16 | 46 | 651 |  |
| 12 | expand constraints | 20 | -6 | 7/16 | 38 | 650 |  |
| 13 | scroll product sources | 689 | -36 | 25/50 | 69 | 652 |  |
| 14 | back to rates | 2362 | +2324 | 13/25 | 65 | 652 |  |
| 15 | open lenders | 21 | -3 | 18/24 | 200 | 657 |  |
| 16 | scroll lenders | 754 | +43 | 21/25 | 101 | 656 |  |
| 17 | back from lenders | 19 | -7 | 5/8 | 121 | 653 |  |
| 18 | switch to savings | 23 | -6 | 35/65 | 69 | 669 |  |
| 19 | switch to home loans | 23 | -1 | 14/31 | 48 | 680 |  |
| 20 | open filters | 23 | -4 | 23/28 | 150 | 683 |  |
| 21 | close filters | 21 | -2 | 8/10 | 150 | 673 |  |
| 22 | open market | 22 | -1 | 17/33 | 57 | 675 |  |
| 23 | open rba | 2440 | -335 | 41/74 | 53 | 692 |  |
| 24 | scroll rba | 713 | -20 | 27/59 | 65 | 686 |  |
| 25 | back from rba | 29 | +5 | 10/21 | 53 | 686 |  |
| 26 | scroll market | 699 | +10 | 23/45 | 69 | 685 |  |
| 27 | open saved | 20 | -3 | 8/16 | 65 | 688 |  |
| 28 | return to rates | 22 | -3 | 11/28 | 69 | 691 |  |
| 29 | verify Income Plus rate history | 24 |  | 28/53 | 69 | 719 |  |
| 30 | start category switch | 31 | 0 | 12/25 | 65 | 711 |  |
| 31 | open term deposits | 20 |  | 39/74 | 61 | 726 |  |
| 32 | verify term deposit rates | 727 |  | 33/67 | 77 | 731 |  |
| 33 | restore home loans | 21 |  | 12/30 | 48 | 737 |  |
| 34 | start search from rates | 36 | +5 |  |  | 735 |  |
| 35 | open savings search | 19 |  | 15/32 | 53 | 753 |  |
| 36 | search Macquarie | 1082 |  | 58/64 | 133 | 747 |  |
| 37 | verify Macquarie result | 1 |  | 15/15 | 16 | 742 |  |
| 38 | clear query and restore results | 20 |  | 14/19 | 32 | 754 |  |
| 39 | return from savings search | 20 |  | 35/44 | 69 | 785 |  |
| 40 | start filter rollback | 27 | -7 | 10/15 | 16 | 776 |  |
| 41 | open mortgage filter draft | 20 |  | 23/28 | 125 | 774 |  |
| 42 | select fixed in draft | 18 |  | 8/12 | 150 | 775 |  |
| 43 | discard unsaved filter draft | 19 |  | 19/23 | 77 | 778 |  |
| 44 | verify fixed was not applied | 33 |  | 20/26 | 150 | 787 | 1 errors |
| 45 | close verified filter draft | 18 |  | 18/21 | 85 | 786 |  |
| 46 | start save from rates | 20 | -9 | 14/16 | 27 | 785 | 1 errors |
| 47 | open unsaved rate | 21 |  | 33/57 | 101 | 814 | 1 errors |
| 48 | save a rate | 17 |  | 8/18 | 57 | 820 | 1 errors |
| 49 | leave saved product | 19 |  | 10/23 | 73 | 822 |  |
| 50 | restart with a saved rate | 12038 |  | 199/383 | 69 | 430 | 1 errors; start 4429ms; boot js-start 584278, layout-mounted 584415, hydrated 584567, cache-read 585465, core-ready 585964, rows-prepared 586115, search-index-idle 586115, detail-filters-idle 586115, leading-requested 586115, last-pricing 586115, splash-hide 586117, manifest 587599, resolved 588002, leading-scoped 591124, leading-page 591124, pricing-ready 592033, last-rows 592033, rates-ready 592270, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 78, pricing-scope-ms 4408, filter-runs 2, filter-rows 37735, filter-yields 7, filter-ms 139, sort-runs 1, sort-rows 2150, sort-yields 1, sort-ms 18 |
| 51 | verify saved rate after restart | 26 |  | 16/33 | 65 | 528 |  |
| 52 | open product from saved rates | 18 |  | 36/59 | 117 | 625 |  |
| 53 | remove saved rate | 20 |  |  |  | 624 |  |
| 54 | leave removed product | 18 |  | 13/27 | 73 | 707 |  |
| 55 | follow browse rates recovery | 2185 |  | 16/30 | 61 | 698 |  |
| 56 | start compare from rates | 22 | -9 |  |  | 700 |  |
| 57 | enter selection mode | 17 |  | 7/15 | 53 | 708 |  |
| 58 | select first comparison rate | 19 |  | 7/14 | 40 | 711 |  |
| 59 | select second comparison rate | 17 |  | 6/16 | 40 | 709 |  |
| 60 | open two-rate comparison | 18 |  | 15/34 | 109 | 720 |  |
| 61 | return from two-rate comparison | 19 |  | 15/33 | 73 | 720 |  |

## Errors

### 1 open app
```
11-28 15:35:36.317 E/australianrates( 5461): Not starting debugger since process cannot load the jdwp agent.
```

### 44 verify fixed was not applied
```
11-28 15:43:13.992 E/FrameTracker( 5461): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 46 start save from rates
```
11-28 15:43:30.091 E/FrameTracker( 5461): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 47 open unsaved rate
```
11-28 15:43:35.293 E/ImeBackDispatcher( 5461): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 165163862
```

### 48 save a rate
```
11-28 15:43:45.938 E/FrameTracker( 5461): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 50 restart with a saved rate
```
11-28 15:43:59.746 E/australianrates(11957): Not starting debugger since process cannot load the jdwp agent.
```
