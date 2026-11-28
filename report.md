# App explorer: 1.0.400 (456)

**Real-use session FAIL vs 1.0.399: 2 broken, 25 friction, 6 slower**

- Broken: Nothing to read for 16.9 s on "open app"
- Broken: "choose ongoing savings" failed: UI assertion failed: app hierarchy unavailable
- Friction: No reaction for 4.0 s after "scroll rates 1"
- Friction: No reaction for 3.5 s after "scroll rates 2"
- Friction: No reaction for 5.2 s after "expand visible fees"
- Friction: No reaction for 3.1 s after "scroll product fees"
- Friction: No reaction for 3.1 s after "scroll product eligibility"
- Friction: No reaction for 3.0 s after "scroll product sources"
- Friction: No reaction for 4.1 s after "switch to savings and see a priced account"
- Friction: No reaction for 4.0 s after "switch to term deposits and see a priced offer"
- Friction: No reaction for 3.2 s after "switch to home loans"
- Friction: No reaction for 3.0 s after "scroll rba"
- Friction: No reaction for 3.1 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Friction: No reaction for 3.1 s after "verify Income Plus rate history"
- Friction: No reaction for 3.5 s after "verify term deposit rates"
- Friction: No reaction for 3.1 s after "restore home loans"
- Friction: No reaction for 6.5 s after "search Macquarie"
- Friction: No reaction for 3.5 s after "return from savings search"
- Friction: No reaction for 3.4 s after "open mortgage filter draft"
- Friction: No reaction for 3.4 s after "verify fixed was not applied"
- Friction: No reaction for 4.0 s after "open unsaved rate"
- Friction: No reaction for 4.2 s after "open product from saved rates"
- Friction: No reaction for 11.9 s after "leave removed product"
- Friction: "No saved rates" shown on "leave removed product"
- Friction: "No saved rates" shown on "follow browse rates recovery"
- Friction: No reaction for 7.5 s after "start compare from rates"
- Slower: "expand visible fees" content 2.4 s to 5.2 s
- Slower: "expand visible fees" reaction 2.4 s to 5.2 s
- Slower: "start category switch" content 0.0 s to 2.3 s
- Slower: "open product from saved rates" reaction 2.7 s to 4.2 s
- Slower: "open savings features" content 0.0 s to 2.7 s
- Slower: "clear audit requirements" content 0.0 s to 2.2 s

**Initial Rates readiness:** 74.9 s from JS start (at or above the 3 s target) · last blocker: rows

**Extended journeys**

- Rate change evidence: 1 passed, 0 failed, 0 blocked
- Product categories: 4 passed, 0 failed, 0 blocked
- Search and clear: 6 passed, 0 failed, 0 blocked
- Discard temporary filters: 6 passed, 0 failed, 0 blocked
- Saved rate lifecycle: 10 passed, 0 failed, 0 blocked
- Compare two rates: 6 passed, 0 failed, 0 blocked
- Saved Savings matches: 8 passed, 1 failed, 4 blocked
- Restore Savings profile: 3 passed, 0 failed, 0 blocked

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-29

Mode session | 74 steps | crashes 0 | step failures 1 | settle timeouts 0 | steps with JS/native errors 8
Baseline 1.0.399

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 53479 | -425 | 1251/1916 | 77 | 542 | 1 errors; start 4039ms |
| 2 | scroll rates 1 | 747 | -120 | 37/54 | 77 | 635 | boot js-start 72780, layout-mounted 73179, cache-read 73451, hydrated 74006, splash-hide 74006, manifest 75691, resolved 76623, core-fetched 86182, core-saved 88721, pricing-wait-suitability 89432, search-index-idle 89432, details-start 89674, details-fetched 106308, rows-prepared 117169, detail-filters-idle 117169, leading-requested 117169, last-pricing 117169, suitability-built 119712, post-refresh-wait 121407, leading-scoped 137656, leading-page 137656, refresh-done 144125, pricing-ready 147400, last-rows 147400, rates-ready 147645, pricing-starts 1, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 316, pricing-scope-ms 28798, filter-runs 2, filter-rows 37735, filter-yields 8, filter-ms 151, sort-runs 1, sort-rows 2150, sort-yields 1, sort-ms 21 |
| 3 | scroll rates 2 | 714 | -75 | 22/33 | 77 | 667 |  |
| 4 | scroll rates back | 689 | -12 |  |  | 545 |  |
| 5 | open product | 36 | +15 | 37/55 | 93 | 620 |  |
| 6 | scroll product | 728 | -19 | 33/58 | 81 | 644 |  |
| 7 | expand visible fees | 2199 | +2175 | 8/17 | 61 | 651 |  |
| 8 | expand product facts | 22 | 0 | 93/184 | 77 | 655 |  |
| 9 | scroll product fees | 705 | +9 | 26/54 | 77 | 678 |  |
| 10 | scroll product eligibility | 778 | +58 | 23/38 | 89 | 648 |  |
| 11 | expand eligibility | 0 | -1 | 207/308 | 77 | 638 |  |
| 12 | expand constraints | 23 | -2220 | 8/15 | 65 | 643 |  |
| 13 | scroll product sources | 722 | -41 | 25/37 | 77 | 651 |  |
| 14 | back to rates | 27 | -2 | 12/23 | 61 | 641 |  |
| 15 | open lenders | 20 | -2 | 19/23 | 250 | 647 |  |
| 16 | scroll lenders | 724 | -38 | 21/23 | 133 | 645 |  |
| 17 | back from lenders | 19 | -1 | 7/7 | 150 | 645 |  |
| 18 | switch to savings and see a priced account | 21 | -4 | 47/72 | 85 | 656 |  |
| 19 | switch to term deposits and see a priced offer | 21 | +2 | 44/68 | 69 | 669 |  |
| 20 | switch to home loans | 20 | 0 | 13/31 | 53 | 681 |  |
| 21 | open filters | 19 | -3 | 20/27 | 150 | 677 |  |
| 22 | close filters | 19 | -1 | 9/11 | 109 | 676 |  |
| 23 | open market | 21 | -1 | 19/33 | 65 | 679 |  |
| 24 | open rba | 2392 | -125 | 51/63 | 65 | 695 |  |
| 25 | scroll rba | 681 | -25 | 29/58 | 61 | 688 |  |
| 26 | back from rba | 20 | -1 | 7/21 | 44 | 689 |  |
| 27 | scroll market | 703 | -11 | 27/42 | 65 | 688 |  |
| 28 | open saved | 35 | +12 | 11/22 | 73 | 691 |  |
| 29 | return to rates | 19 | -2 | 15/34 | 61 | 693 |  |
| 30 | verify Income Plus rate history | 28 |  | 26/47 | 77 | 716 |  |
| 31 | start category switch | 27 | 0 | 12/23 | 73 | 712 |  |
| 32 | open term deposits | 21 | -1 | 16/33 | 48 | 735 |  |
| 33 | verify term deposit rates | 764 | +78 | 36/59 | 77 | 740 |  |
| 34 | restore home loans | 20 | 0 | 14/32 | 53 | 747 |  |
| 35 | start search from rates | 24 | -2 |  |  | 737 |  |
| 36 | open savings search | 22 | +2 | 15/31 | 61 | 747 |  |
| 37 | search Macquarie | 1881 | +188 | 68/80 | 117 | 753 | 1 errors |
| 38 | verify Macquarie result | 0 | 0 | 15/15 | 17 | 745 |  |
| 39 | clear query and restore results | 23 | +2 | 17/20 | 32 | 760 |  |
| 40 | return from savings search | 24 | +5 | 33/44 | 85 | 802 |  |
| 41 | start filter rollback | 49 | +26 | 14/15 | 16 | 791 |  |
| 42 | open mortgage filter draft | 19 | 0 | 28/31 | 150 | 790 |  |
| 43 | select fixed in draft | 23 | +2 | 14/16 | 85 | 790 |  |
| 44 | discard unsaved filter draft | 19 | 0 | 18/22 | 93 | 793 |  |
| 45 | verify fixed was not applied | 20 | +2 | 22/27 | 300 | 801 | 1 errors |
| 46 | close verified filter draft | 19 | +1 | 18/22 | 69 | 801 |  |
| 47 | start save from rates | 28 | +4 | 13/15 | 16 | 800 | 1 errors |
| 48 | open unsaved rate | 19 | +1 | 51/75 | 81 | 831 | 1 errors |
| 49 | save a rate | 22 | +2 | 7/18 | 48 | 750 | 1 errors |
| 50 | leave saved product | 26 | -2 | 14/24 | 65 | 753 |  |
| 51 | restart with a saved rate | 14481 | -321 | 308/476 | 77 | 423 | 3 errors; start 5853ms; boot js-start 635051, layout-mounted 635592, hydrated 635784, cache-read 636771, core-ready 637385, rows-prepared 637556, search-index-idle 637556, detail-filters-idle 637556, leading-requested 637556, last-pricing 637556, splash-hide 637558, manifest 639218, resolved 639865, leading-scoped 643622, leading-page 643622, pricing-ready 644637, last-rows 644637, rates-ready 644839, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 87, pricing-scope-ms 5837, filter-runs 2, filter-rows 37735, filter-yields 6, filter-ms 135, sort-runs 1, sort-rows 2150, sort-yields 1, sort-ms 22 |
| 52 | verify saved rate after restart | 23 | -4 | 16/28 | 81 | 441 |  |
| 53 | open product from saved rates | 23 | +5 | 38/60 | 81 | 600 |  |
| 54 | remove saved rate | 20 | -5 | 10/18 | 65 | 628 |  |
| 55 | leave removed product | 8791 | -102 | 7/11 | 65 | 635 |  |
| 56 | follow browse rates recovery | 33 | +13 |  |  | 690 |  |
| 57 | start compare from rates | 4400 | -25 | 17/28 | 57 | 717 |  |
| 58 | enter selection mode | 21 | -10 | 10/15 | 57 | 717 |  |
| 59 | select first comparison rate | 21 | +1 | 6/14 | 53 | 710 |  |
| 60 | select second comparison rate | 21 | +1 | 10/13 | 65 | 708 |  |
| 61 | open two-rate comparison | 23 | +1 | 21/33 | 101 | 718 |  |
| 62 | return from two-rate comparison | 21 | +2 | 16/29 | 89 | 720 |  |
| 63 | open savings profile | 23 | +1 | 16/29 | 65 | 718 |  |
| 64 | open savings features | 18 | +18 | 17/19 | 300 | 716 |  |
| 65 | require Card access | 17 |  | 14/18 | 61 | 739 |  |
| 66 | require PayID | 23 |  |  |  | 742 |  |
| 67 | require Unlimited transactions | 17 |  | 24/30 | 105 | 745 |  |
| 68 | require Bill payment | 17 |  |  |  | 732 |  |
| 69 | save four savings features | 17 |  | 24/30 | 93 | 754 |  |
| 70 | open savings rate kinds | 22 |  |  |  | 752 |  |
| 71 | choose ongoing savings | 20 |  | 39/48 | 200 | 773 | UI assertion failed: app hierarchy unavailable |
| 72 | restore audit profile | 54 | -8138 |  |  | 763 |  |
| 73 | clear audit requirements | 17 | +16 | 31/58 | 109 | 756 | 31 errors |
| 74 | leave savings profile | 25 |  |  |  | 765 |  |

## Fatal lines
```
73 E/unknown:MountItemDispatcher(12072): Caused by: com.facebook.react.bridge.RetryableMountingLayerException: Unable to find viewState for tag: 7610 for commandId: hotspotUpdate
73 E/unknown:MountItemDispatcher(12072): Caused by: com.facebook.react.bridge.RetryableMountingLayerException: Unable to find viewState for tag: 7610 for commandId: setPressed
```

## Errors

### 1 open app
```
11-28 16:36:53.701 E/australianrates( 5023): Not starting debugger since process cannot load the jdwp agent.
```

### 37 search Macquarie
```
11-28 16:44:25.683 E/FrameTracker( 5023): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 45 verify fixed was not applied
```
11-28 16:45:27.433 E/FrameTracker( 5023): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 47 start save from rates
```
11-28 16:45:44.436 E/FrameTracker( 5023): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 48 open unsaved rate
```
11-28 16:45:50.328 E/ImeBackDispatcher( 5023): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 153230569
```

### 49 save a rate
```
11-28 16:46:00.802 E/FrameTracker( 5023): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 51 restart with a saved rate
```
11-28 16:46:16.339 E/australianrates(12072): Not starting debugger since process cannot load the jdwp agent.
11-28 16:46:22.036 E/SurfaceSyncGroup(12072): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
11-28 16:46:22.036 E/SurfaceSyncGroup(12072): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
```

### 73 clear audit requirements
```
11-28 16:50:15.456 E/unknown:MountItemDispatcher(12072): 	... 19 more
11-28 16:50:15.456 E/unknown:MountItemDispatcher(12072): 	at B3.h.doFrame(SourceFile:1)
11-28 16:50:15.456 E/unknown:MountItemDispatcher(12072): 	at android.app.ActivityThread.main(ActivityThread.java:8177)
11-28 16:50:15.456 E/unknown:MountItemDispatcher(12072): 	at android.os.Handler.dispatchMessage(Handler.java:99)
11-28 16:50:15.456 E/unknown:MountItemDispatcher(12072): 	at android.os.Handler.handleCallback(Handler.java:958)
11-28 16:50:15.456 E/unknown:MountItemDispatcher(12072): 	at android.os.Looper.loop(Looper.java:294)
11-28 16:50:15.456 E/unknown:MountItemDispatcher(12072): 	at android.os.Looper.loopOnce(Looper.java:205)
11-28 16:50:15.456 E/unknown:MountItemDispatcher(12072): 	at android.view.Choreographer$CallbackRecord.run(Choreographer.java:1337)
```
