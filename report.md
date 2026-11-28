# App explorer: 1.0.400 (456)

**Real-use session FAIL vs 1.0.399: 2 broken, 23 friction, 24 slower**

- Broken: Nothing to read for 19.5 s on "open app"
- Broken: "choose ongoing savings" failed: UI assertion failed: app hierarchy unavailable
- Friction: No reaction for 3.8 s after "scroll rates 1"
- Friction: No reaction for 3.3 s after "scroll rates 2"
- Friction: No reaction for 3.0 s after "scroll product"
- Friction: No reaction for 5.6 s after "expand visible fees"
- Friction: No reaction for 3.1 s after "scroll product fees"
- Friction: No reaction for 3.1 s after "scroll product eligibility"
- Friction: No reaction for 3.1 s after "scroll product sources"
- Friction: No reaction for 4.1 s after "switch to savings and see a priced account"
- Friction: No reaction for 4.8 s after "switch to term deposits and see a priced offer"
- Friction: No reaction for 3.4 s after "switch to home loans"
- Friction: No reaction for 3.1 s after "open market"
- Friction: No reaction for 3.1 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Friction: No reaction for 3.5 s after "verify term deposit rates"
- Friction: No reaction for 3.3 s after "restore home loans"
- Friction: No reaction for 8.1 s after "search Macquarie"
- Friction: No reaction for 3.7 s after "return from savings search"
- Friction: No reaction for 3.4 s after "open mortgage filter draft"
- Friction: No reaction for 3.6 s after "open unsaved rate"
- Friction: No reaction for 3.0 s after "open product from saved rates"
- Friction: No reaction for 13.0 s after "leave removed product"
- Friction: "No saved rates" shown on "leave removed product"
- Friction: "No saved rates" shown on "follow browse rates recovery"
- Slower: "open app" content 4.4 s to 71.4 s
- Slower: "scroll rates 1" content 0.7 s to 3.8 s
- Slower: "scroll rates 2" content 0.7 s to 3.3 s
- Slower: "open product" content 0.0 s to 2.6 s
- Slower: "scroll product" content 0.7 s to 3.0 s
- Slower: "expand visible fees" content 0.0 s to 5.6 s
- Slower: "expand product facts" content 0.0 s to 2.4 s
- Slower: "scroll product fees" content 0.7 s to 3.1 s
- Slower: "scroll product eligibility" content 0.8 s to 3.1 s
- Slower: "expand constraints" content 0.0 s to 2.3 s
- Slower: "scroll product sources" content 0.7 s to 3.1 s
- Slower: "open lenders" content 0.0 s to 2.7 s
- Slower: "back from lenders" content 0.0 s to 2.5 s
- Slower: "switch to home loans" content 0.0 s to 3.4 s
- Slower: "open filters" content 0.0 s to 2.7 s
- Slower: "open market" content 0.0 s to 3.1 s
- Slower: "open rba" content 0.0 s to 2.5 s
- Slower: "scroll rba" content 0.9 s to 2.9 s
- Slower: "scroll market" content 0.8 s to 3.1 s
- Slower: "return to rates" content 0.0 s to 2.6 s
- Slower: "search Macquarie" content 4.8 s to 8.1 s
- Slower: "search Macquarie" reaction 4.8 s to 8.1 s
- Slower: Dropped frames 73% to 91% on "discard unsaved filter draft"
- Slower: "select second comparison rate" content 0.0 s to 2.4 s

**Initial Rates readiness:** 81.3 s from JS start (at or above the 3 s target) · last blocker: rows

**Extended journeys**

- Product categories: 4 passed, 0 failed, 0 blocked
- Search and clear: 6 passed, 0 failed, 0 blocked
- Discard temporary filters: 6 passed, 0 failed, 0 blocked
- Saved rate lifecycle: 10 passed, 0 failed, 0 blocked
- Compare two rates: 6 passed, 0 failed, 0 blocked
- Saved Savings matches: 8 passed, 1 failed, 4 blocked
- Restore Savings profile: 3 passed, 0 failed, 0 blocked

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-29

Mode session | 73 steps | crashes 0 | step failures 1 | settle timeouts 0 | steps with JS/native errors 8
Baseline 1.0.399

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 52062 | +47683 | 1299/1906 | 81 | 530 | 1 errors; start 3784ms |
| 2 | scroll rates 1 | 3971 | +3224 | 33/50 | 109 | 659 | boot js-start 74431, layout-mounted 74901, cache-read 75169, hydrated 75409, splash-hide 75409, manifest 76685, resolved 77279, core-fetched 87284, core-saved 89335, pricing-wait-suitability 89671, search-index-idle 89671, details-start 89917, details-fetched 103180, rows-prepared 112089, detail-filters-idle 112089, leading-requested 112089, last-pricing 112089, suitability-built 115721, post-refresh-wait 118376, leading-scoped 140133, leading-page 140133, refresh-done 149837, pricing-ready 155041, last-rows 155041, rates-ready 155727, pricing-starts 1, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 363, pricing-scope-ms 40773, filter-runs 2, filter-rows 37735, filter-yields 19, filter-ms 478, sort-runs 1, sort-rows 2150, sort-yields 2, sort-ms 98 |
| 3 | scroll rates 2 | 736 | +39 | 20/32 | 85 | 569 |  |
| 4 | scroll rates back | 685 | -18 |  |  | 667 |  |
| 5 | open product | 22 | +22 | 34/61 | 81 | 625 |  |
| 6 | scroll product | 695 | -6 | 30/51 | 77 | 667 |  |
| 7 | expand visible fees | 2240 | +2240 | 7/17 | 46 | 639 |  |
| 8 | expand product facts | 20 | +20 | 96/179 | 77 | 630 |  |
| 9 | scroll product fees | 753 | +21 | 32/58 | 81 | 655 |  |
| 10 | scroll product eligibility | 716 | -42 | 23/36 | 77 | 628 |  |
| 11 | expand eligibility | 0 | 0 | 199/309 | 77 | 619 |  |
| 12 | expand constraints | 21 | +21 | 8/16 | 53 | 627 |  |
| 13 | scroll product sources | 736 | +49 | 21/35 | 77 | 627 |  |
| 14 | back to rates | 28 | -20124 | 12/24 | 69 | 624 |  |
| 15 | open lenders | 21 | +21 | 18/23 | 200 | 632 |  |
| 16 | scroll lenders | 788 | +75 | 22/23 | 129 | 631 |  |
| 17 | back from lenders | 21 | -1 | 8/9 | 250 | 632 |  |
| 18 | switch to savings and see a priced account | 21 |  | 44/71 | 85 | 657 |  |
| 19 | switch to term deposits and see a priced offer | 25 |  | 63/94 | 85 | 677 |  |
| 20 | switch to home loans | 23 | +23 | 16/30 | 65 | 707 |  |
| 21 | open filters | 22 | +22 | 24/29 | 133 | 713 |  |
| 22 | close filters | 21 | -20130 | 10/11 | 113 | 704 |  |
| 23 | open market | 21 | +21 | 16/34 | 57 | 710 |  |
| 24 | open rba | 2614 | +2613 | 67/86 | 57 | 732 |  |
| 25 | scroll rba | 713 | -183 | 29/57 | 61 | 725 |  |
| 26 | back from rba | 22 | -20129 | 10/21 | 53 | 726 |  |
| 27 | scroll market | 687 | -125 | 23/42 | 73 | 725 |  |
| 28 | open saved | 21 | +21 | 8/19 | 65 | 729 |  |
| 29 | return to rates | 22 | +22 | 26/51 | 65 | 735 |  |
| 30 | start category switch | 33 | -23060 |  |  | 736 |  |
| 31 | open term deposits | 21 |  | 16/33 | 65 | 768 |  |
| 32 | verify term deposit rates | 713 |  | 33/57 | 73 | 720 |  |
| 33 | restore home loans | 27 |  | 16/31 | 57 | 712 |  |
| 34 | start search from rates | 29 | -4600 |  |  | 709 |  |
| 35 | open savings search | 23 | 0 | 15/31 | 53 | 719 |  |
| 36 | search Macquarie | 2635 | +147 | 93/109 | 150 | 749 | 1 errors |
| 37 | verify Macquarie result | 0 | -1 | 12/15 | 16 | 729 |  |
| 38 | clear query and restore results | 24 | +3 | 18/20 | 32 | 725 |  |
| 39 | return from savings search | 47 | -4474 | 28/44 | 89 | 735 |  |
| 40 | start filter rollback | 31 | 0 | 13/16 | 16 | 725 |  |
| 41 | open mortgage filter draft | 41 | +7 | 26/30 | 200 | 731 |  |
| 42 | select fixed in draft | 22 | -1 | 12/14 | 113 | 729 |  |
| 43 | discard unsaved filter draft | 22 | 0 | 20/22 | 85 | 731 |  |
| 44 | verify fixed was not applied | 21 | 0 | 20/27 | 150 | 734 | 1 errors |
| 45 | close verified filter draft | 19 | -1 | 16/23 | 85 | 733 |  |
| 46 | start save from rates | 45 | +13 | 13/15 | 18 | 731 | 1 errors |
| 47 | open unsaved rate | 20 | -21 | 74/121 | 77 | 749 | 1 errors |
| 48 | save a rate | 23 | -1 | 7/15 | 53 | 749 | 1 errors |
| 49 | leave saved product | 22 | -6623 | 11/20 | 65 | 753 |  |
| 50 | restart with a saved rate | 16923 | -1954 | 321/484 | 81 | 409 | 1 errors; start 4310ms; boot js-start 639871, layout-mounted 640061, hydrated 640154, cache-read 641406, core-ready 642030, rows-prepared 642180, search-index-idle 642180, detail-filters-idle 642180, leading-requested 642180, last-pricing 642180, splash-hide 642181, manifest 644387, resolved 644958, leading-scoped 649139, leading-page 649139, pricing-ready 650232, last-rows 650232, rates-ready 650490, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 98, pricing-scope-ms 5677, filter-runs 2, filter-rows 37735, filter-yields 8, filter-ms 163, sort-runs 1, sort-rows 2150, sort-yields 1, sort-ms 24 |
| 51 | verify saved rate after restart | 24 | -31 | 16/28 | 69 | 431 |  |
| 52 | open product from saved rates | 23 | -8 | 37/59 | 89 | 572 |  |
| 53 | remove saved rate | 28 | +5 | 8/17 | 65 | 617 |  |
| 54 | leave removed product | 11011 | -8996 | 6/11 | 61 | 655 |  |
| 55 | follow browse rates recovery | 22 |  |  |  | 671 |  |
| 56 | start compare from rates | 27 | 0 | 19/30 | 69 | 692 |  |
| 57 | enter selection mode | 22 | -2684 | 9/17 | 48 | 703 |  |
| 58 | select first comparison rate | 20 | -19 | 9/16 | 53 | 708 |  |
| 59 | select second comparison rate | 21 | -13 | 9/15 | 65 | 708 |  |
| 60 | open two-rate comparison | 22 |  | 19/30 | 150 | 713 |  |
| 61 | return from two-rate comparison | 21 |  | 19/30 | 93 | 716 |  |
| 62 | open savings profile | 30 |  | 18/30 | 81 | 714 |  |
| 63 | open savings features | 19 |  | 20/22 | 200 | 712 |  |
| 64 | require Card access | 21 |  | 12/16 | 69 | 720 |  |
| 65 | require PayID | 20 |  |  |  | 724 |  |
| 66 | require Unlimited transactions | 20 |  | 20/31 | 93 | 731 |  |
| 67 | require Bill payment | 21 |  |  |  | 728 |  |
| 68 | save four savings features | 20 |  | 23/29 | 121 | 736 |  |
| 69 | open savings rate kinds | 25 |  |  |  | 733 |  |
| 70 | choose ongoing savings | 18 |  | 39/46 | 133 | 752 | UI assertion failed: app hierarchy unavailable |
| 71 | restore audit profile | 82 |  |  |  | 738 |  |
| 72 | clear audit requirements | 19 |  | 30/56 | 81 | 742 | 58 errors |
| 73 | leave savings profile | 33 |  |  |  | 749 |  |

## Fatal lines
```
72 E/unknown:MountItemDispatcher(12106): Caused by: com.facebook.react.bridge.RetryableMountingLayerException: Unable to find viewState for tag: 7622 for commandId: hotspotUpdate
72 E/unknown:MountItemDispatcher(12106): Caused by: com.facebook.react.bridge.RetryableMountingLayerException: Unable to find viewState for tag: 7622 for commandId: setPressed
```

## Errors

### 1 open app
```
11-28 16:24:50.722 E/australianrates( 4969): Not starting debugger since process cannot load the jdwp agent.
```

### 36 search Macquarie
```
11-28 16:32:26.654 E/FrameTracker( 4969): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 44 verify fixed was not applied
```
11-28 16:33:30.425 E/FrameTracker( 4969): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 46 start save from rates
```
11-28 16:33:47.066 E/FrameTracker( 4969): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 47 open unsaved rate
```
11-28 16:33:52.562 E/ImeBackDispatcher( 4969): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 222671049
```

### 48 save a rate
```
11-28 16:34:03.056 E/FrameTracker( 4969): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 50 restart with a saved rate
```
11-28 16:34:17.701 E/australianrates(12106): Not starting debugger since process cannot load the jdwp agent.
```

### 72 clear audit requirements
```
11-28 16:38:13.218 E/unknown:MountItemDispatcher(12106): 	... 19 more
11-28 16:38:13.218 E/unknown:MountItemDispatcher(12106): 	at B3.h.doFrame(SourceFile:1)
11-28 16:38:13.218 E/unknown:MountItemDispatcher(12106): 	at android.app.ActivityThread.main(ActivityThread.java:8177)
11-28 16:38:13.218 E/unknown:MountItemDispatcher(12106): 	at android.os.Handler.dispatchMessage(Handler.java:99)
11-28 16:38:13.218 E/unknown:MountItemDispatcher(12106): 	at android.os.Handler.handleCallback(Handler.java:958)
11-28 16:38:13.218 E/unknown:MountItemDispatcher(12106): 	at android.os.Looper.loop(Looper.java:294)
11-28 16:38:13.218 E/unknown:MountItemDispatcher(12106): 	at android.os.Looper.loopOnce(Looper.java:205)
11-28 16:38:13.218 E/unknown:MountItemDispatcher(12106): 	at android.view.Choreographer$CallbackRecord.run(Choreographer.java:1337)
```
