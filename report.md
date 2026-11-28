# App explorer: 1.0.400 (456)

**Real-use session FAIL vs 1.0.399: 3 broken, 25 friction, 23 slower**

- Broken: Nothing to read for 41.8 s on "open app"
- Broken: "leave removed product" failed: Back destination was not observed
- Broken: "choose ongoing savings" failed: UI assertion failed: app hierarchy unavailable
- Friction: No reaction for 3.6 s after "scroll rates 1"
- Friction: No reaction for 3.4 s after "scroll rates 2"
- Friction: No reaction for 3.2 s after "scroll product"
- Friction: No reaction for 3.3 s after "scroll product sources"
- Friction: No reaction for 4.5 s after "switch to savings and see a priced account"
- Friction: No reaction for 5.3 s after "switch to term deposits and see a priced offer"
- Friction: No reaction for 3.7 s after "switch to home loans"
- Friction: No reaction for 3.1 s after "open filters"
- Friction: No reaction for 3.2 s after "open market"
- Friction: No reaction for 3.2 s after "scroll rba"
- Friction: No reaction for 3.2 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Friction: No reaction for 3.1 s after "verify term deposit rates"
- Friction: No reaction for 3.5 s after "restore home loans"
- Friction: No reaction for 3.1 s after "open savings search"
- Friction: No reaction for 8.2 s after "search Macquarie"
- Friction: No reaction for 4.1 s after "return from savings search"
- Friction: No reaction for 3.6 s after "open mortgage filter draft"
- Friction: No reaction for 3.6 s after "verify fixed was not applied"
- Friction: No reaction for 3.5 s after "open unsaved rate"
- Friction: No reaction for 3.4 s after "open product from saved rates"
- Friction: No reaction for 15.9 s after "leave removed product"
- Friction: "No saved rates" shown on "start compare from rates"
- Friction: No reaction for 3.4 s after "open two-rate comparison"
- Friction: No reaction for 3.5 s after "choose ongoing savings"
- Slower: Dropped frames 64% to 83% on "scroll rates 2"
- Slower: Dropped frames 61% to 76% on "open product"
- Slower: Dropped frames 49% to 74% on "expand product facts"
- Slower: Dropped frames 45% to 86% on "scroll product fees"
- Slower: Dropped frames 57% to 86% on "scroll product eligibility"
- Slower: Dropped frames 60% to 81% on "expand eligibility"
- Slower: Dropped frames 65% to 81% on "back to rates"
- Slower: Dropped frames 59% to 82% on "switch to term deposits and see a priced offer"
- Slower: Dropped frames 50% to 66% on "open market"
- Slower: Dropped frames 50% to 65% on "scroll rba"
- Slower: Dropped frames 54% to 71% on "open saved"
- Slower: Dropped frames 56% to 71% on "open term deposits"
- Slower: Dropped frames 54% to 74% on "verify term deposit rates"
- Slower: Dropped frames 46% to 69% on "restore home loans"
- Slower: Dropped frames 57% to 76% on "open savings search"
- Slower: Dropped frames 66% to 81% on "open unsaved rate"
- Slower: Dropped frames 52% to 70% on "leave saved product"
- Slower: Dropped frames 62% to 78% on "open product from saved rates"
- Slower: "leave removed product" content 8.9 s to 20.2 s
- Slower: Dropped frames 48% to 82% on "open savings profile"
- Slower: "open savings features" content 0.0 s to 2.5 s
- Slower: "restore audit profile" content 0.0 s to 2.2 s
- Slower: "clear audit requirements" content 0.0 s to 2.4 s

**Initial Rates readiness:** 108.4 s from JS start (at or above the 3 s target) · last blocker: rows

**Extended journeys**

- Product categories: 4 passed, 0 failed, 0 blocked
- Search and clear: 6 passed, 0 failed, 0 blocked
- Discard temporary filters: 6 passed, 0 failed, 0 blocked
- Saved rate lifecycle: 8 passed, 1 failed, 1 blocked
- Compare two rates: 6 passed, 0 failed, 0 blocked
- Saved Savings matches: 8 passed, 1 failed, 4 blocked
- Restore Savings profile: 3 passed, 0 failed, 0 blocked

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-29

Mode session | 72 steps | crashes 0 | step failures 2 | settle timeouts 1 | steps with JS/native errors 8
Baseline 1.0.399

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 55442 | +1996 | 1711/2145 | 97 | 517 | 1 errors; start 4296ms |
| 2 | scroll rates 1 | 3799 | +3026 | 31/46 | 93 | 633 | boot js-start 81388, layout-mounted 81831, cache-read 82067, hydrated 82507, splash-hide 82507, manifest 84354, resolved 85058, core-fetched 95191, core-saved 96970, pricing-wait-suitability 97640, search-index-idle 97640, details-start 98710, details-fetched 113324, rows-prepared 132777, detail-filters-idle 132777, leading-requested 132777, last-pricing 132777, suitability-built 139788, post-refresh-wait 141964, leading-scoped 170534, leading-page 170534, refresh-done 179104, pricing-ready 188908, last-rows 188908, rates-ready 189787, pricing-starts 1, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 427, pricing-scope-ms 49847, filter-runs 2, filter-rows 37735, filter-yields 21, filter-ms 557, sort-runs 1, sort-rows 2150, sort-yields 3, sort-ms 178 |
| 3 | scroll rates 2 | 759 | +82 | 20/24 | 101 | 486 |  |
| 4 | scroll rates back | 755 | +73 |  |  | 550 |  |
| 5 | open product | 34 | +10 | 39/51 | 101 | 622 |  |
| 6 | scroll product | 755 | +56 | 40/60 | 93 | 639 |  |
| 7 | expand visible fees | 27 | +7 | 11/13 | 89 | 621 |  |
| 8 | expand product facts | 0 | -19 | 239/322 | 93 | 643 |  |
| 9 | scroll product fees | 795 | +64 | 25/29 | 89 | 621 |  |
| 10 | scroll product eligibility | 729 | -17 | 25/29 | 97 | 619 |  |
| 11 | expand eligibility | 0 | 0 | 210/258 | 93 | 634 |  |
| 12 | expand constraints | 27 | +10 | 9/16 | 69 | 624 |  |
| 13 | scroll product sources | 792 | +43 | 25/32 | 97 | 627 |  |
| 14 | back to rates | 32 | +7 | 17/21 | 81 | 623 |  |
| 15 | open lenders | 29 | +5 | 19/24 | 350 | 629 |  |
| 16 | scroll lenders | 793 | +48 | 19/20 | 150 | 625 |  |
| 17 | back from lenders | 28 | +9 | 8/9 | 150 | 626 |  |
| 18 | switch to savings and see a priced account | 29 | +10 | 53/69 | 97 | 635 |  |
| 19 | switch to term deposits and see a priced offer | 32 | +9 | 72/88 | 101 | 647 |  |
| 20 | switch to home loans | 31 | +4 | 17/27 | 65 | 663 |  |
| 21 | open filters | 29 | +10 | 21/24 | 150 | 663 |  |
| 22 | close filters | 32 | +13 | 8/9 | 150 | 656 |  |
| 23 | open market | 28 | +8 | 21/32 | 61 | 660 |  |
| 24 | open rba | 2848 | +263 | 49/57 | 81 | 680 |  |
| 25 | scroll rba | 725 | +11 | 32/49 | 89 | 673 |  |
| 26 | back from rba | 28 | +4 | 12/19 | 77 | 674 |  |
| 27 | scroll market | 698 | -16 | 25/37 | 85 | 673 |  |
| 28 | open saved | 27 | +6 | 17/24 | 105 | 677 |  |
| 29 | return to rates | 31 | +12 | 21/30 | 81 | 682 |  |
| 30 | start category switch | 37 | +11 |  |  | 683 |  |
| 31 | open term deposits | 28 | +9 | 20/28 | 77 | 712 |  |
| 32 | verify term deposit rates | 732 | +27 | 20/27 | 85 | 712 |  |
| 33 | restore home loans | 26 | +6 | 18/26 | 73 | 743 |  |
| 34 | start search from rates | 30 | +2 |  |  | 735 |  |
| 35 | open savings search | 28 | +6 | 22/29 | 89 | 748 |  |
| 36 | search Macquarie | 2283 | +540 | 79/87 | 150 | 763 | 1 errors |
| 37 | verify Macquarie result | 0 | 0 | 14/16 | 16 | 753 |  |
| 38 | clear query and restore results | 31 | +11 | 15/20 | 61 | 766 |  |
| 39 | return from savings search | 48 | +29 | 32/41 | 97 | 730 |  |
| 40 | start filter rollback | 40 | +10 | 13/17 | 32 | 727 |  |
| 41 | open mortgage filter draft | 30 | +12 | 19/25 | 300 | 731 |  |
| 42 | select fixed in draft | 28 | +9 | 10/13 | 150 | 731 |  |
| 43 | discard unsaved filter draft | 27 | +8 | 16/21 | 93 | 733 |  |
| 44 | verify fixed was not applied | 28 | +9 | 24/28 | 300 | 736 | 1 errors |
| 45 | close verified filter draft | 26 | +7 | 20/22 | 69 | 735 |  |
| 46 | start save from rates | 39 | +10 | 13/16 | 32 | 732 | 1 errors |
| 47 | open unsaved rate | 26 | -24 | 43/53 | 97 | 752 | 1 errors |
| 48 | save a rate | 27 | +9 | 10/15 | 81 | 751 | 1 errors |
| 49 | leave saved product | 30 | +12 | 16/23 | 113 | 750 |  |
| 50 | restart with a saved rate | 21760 | +5922 | 418/545 | 93 | 620 | 3 errors; start 6969ms; boot js-start 726173, layout-mounted 726441, hydrated 726678, cache-read 728005, core-ready 728752, rows-prepared 728933, search-index-idle 728933, detail-filters-idle 728933, leading-requested 728933, last-pricing 728933, splash-hide 728934, manifest 731007, resolved 731986, leading-scoped 739192, leading-page 739192, pricing-ready 740507, last-rows 740507, rates-ready 740862, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 139, pricing-scope-ms 8910, filter-runs 2, filter-rows 37735, filter-yields 9, filter-ms 177, sort-runs 1, sort-rows 2150, sort-yields 1, sort-ms 26 |
| 51 | verify saved rate after restart | 28 | +3 | 14/22 | 101 | 433 |  |
| 52 | open product from saved rates | 27 | +4 | 45/58 | 101 | 559 |  |
| 53 | remove saved rate | 28 | +3 | 13/18 | 117 | 660 |  |
| 54 | leave removed product | 20151 | +11285 | 9/10 | 93 | 626 | no settle; Back destination was not observed |
| 55 | start compare from rates | 34 | -4413 |  |  | 655 |  |
| 56 | enter selection mode | 32 | +8 | 28/38 | 69 | 717 |  |
| 57 | select first comparison rate | 29 | +10 | 12/14 | 61 | 707 |  |
| 58 | select second comparison rate | 36 | +16 | 10/11 | 97 | 716 |  |
| 59 | open two-rate comparison | 28 | +10 | 20/27 | 150 | 720 |  |
| 60 | return from two-rate comparison | 28 | +10 | 21/26 | 113 | 718 |  |
| 61 | open savings profile | 31 | +8 | 23/28 | 105 | 716 |  |
| 62 | open savings features | 29 | +29 | 17/17 | 250 | 715 |  |
| 63 | require Card access | 25 |  | 12/15 | 150 | 724 |  |
| 64 | require PayID | 26 |  |  |  | 725 |  |
| 65 | require Unlimited transactions | 23 |  | 25/28 | 81 | 744 |  |
| 66 | require Bill payment | 33 |  |  |  | 742 |  |
| 67 | save four savings features | 25 |  | 19/27 | 150 | 745 |  |
| 68 | open savings rate kinds | 27 |  |  |  | 746 |  |
| 69 | choose ongoing savings | 24 |  | 41/51 | 150 | 751 | UI assertion failed: app hierarchy unavailable |
| 70 | restore audit profile | 88 | +61 |  |  | 751 |  |
| 71 | clear audit requirements | 29 | +29 | 32/50 | 101 | 767 | 31 errors |
| 72 | leave savings profile | 40 |  |  |  | 762 |  |

## Fatal lines
```
71 E/unknown:MountItemDispatcher(12295): Caused by: com.facebook.react.bridge.RetryableMountingLayerException: Unable to find viewState for tag: 7602 for commandId: hotspotUpdate
71 E/unknown:MountItemDispatcher(12295): Caused by: com.facebook.react.bridge.RetryableMountingLayerException: Unable to find viewState for tag: 7602 for commandId: setPressed
```

## Errors

### 1 open app
```
11-28 16:24:06.189 E/australianrates( 4767): Not starting debugger since process cannot load the jdwp agent.
```

### 36 search Macquarie
```
11-28 16:32:54.619 E/FrameTracker( 4767): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 44 verify fixed was not applied
```
11-28 16:34:01.214 E/FrameTracker( 4767): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 46 start save from rates
```
11-28 16:34:19.092 E/FrameTracker( 4767): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 47 open unsaved rate
```
11-28 16:34:25.338 E/ImeBackDispatcher( 4767): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 219034005
```

### 48 save a rate
```
11-28 16:34:35.944 E/FrameTracker( 4767): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 50 restart with a saved rate
```
11-28 16:34:51.036 E/australianrates(12295): Not starting debugger since process cannot load the jdwp agent.
11-28 16:34:57.714 E/SurfaceSyncGroup(12295): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
11-28 16:34:57.718 E/SurfaceSyncGroup(12295): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
```

### 71 clear audit requirements
```
11-28 16:39:07.329 E/unknown:MountItemDispatcher(12295): 	... 19 more
11-28 16:39:07.329 E/unknown:MountItemDispatcher(12295): 	at B3.h.doFrame(SourceFile:1)
11-28 16:39:07.329 E/unknown:MountItemDispatcher(12295): 	at android.app.ActivityThread.main(ActivityThread.java:8177)
11-28 16:39:07.329 E/unknown:MountItemDispatcher(12295): 	at android.os.Handler.dispatchMessage(Handler.java:99)
11-28 16:39:07.329 E/unknown:MountItemDispatcher(12295): 	at android.os.Handler.handleCallback(Handler.java:958)
11-28 16:39:07.329 E/unknown:MountItemDispatcher(12295): 	at android.os.Looper.loop(Looper.java:294)
11-28 16:39:07.329 E/unknown:MountItemDispatcher(12295): 	at android.os.Looper.loopOnce(Looper.java:205)
11-28 16:39:07.329 E/unknown:MountItemDispatcher(12295): 	at android.view.Choreographer$CallbackRecord.run(Choreographer.java:1337)
```
