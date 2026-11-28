# App explorer: 1.0.399 (455)

**Real-use session FAIL vs 1.0.399: 7 broken, 25 friction, 19 slower**

- Broken: Nothing to read for 69.1 s on "open app"
- Broken: "expand visible fees again" failed: no reaction to tap on "Show Fees"
- Broken: "switch to savings and see a priced account" failed: UI assertion failed: app hierarchy unavailable
- Broken: "switch to term deposits and see a priced offer" failed: UI assertion failed: app hierarchy unavailable
- Broken: "leave removed product" failed: Back destination was not observed
- Broken: "open savings features" failed: not found: {"id":"profile:Savings:accountFeatures:open"}
- Broken: "clear audit requirements" failed: not found: {"contains":"Clear all saved requirements"}
- Friction: No reaction for 4.0 s after "scroll rates 1"
- Friction: No reaction for 3.4 s after "scroll rates 2"
- Friction: No reaction for 4.0 s after "scroll product"
- Friction: "expand visible fees again" needed a second tap
- Friction: No reaction for 3.0 s after "scroll product sources"
- Friction: No reaction for 4.5 s after "switch to savings and see a priced account"
- Friction: No reaction for 5.4 s after "switch to term deposits and see a priced offer"
- Friction: No reaction for 3.6 s after "switch to home loans"
- Friction: No reaction for 3.1 s after "open market"
- Friction: No reaction for 3.1 s after "scroll rba"
- Friction: No reaction for 3.1 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Friction: No reaction for 4.2 s after "verify Income Plus rate history"
- Friction: No reaction for 3.1 s after "open term deposits"
- Friction: No reaction for 3.5 s after "verify term deposit rates"
- Friction: No reaction for 3.4 s after "restore home loans"
- Friction: No reaction for 7.1 s after "search Macquarie"
- Friction: No reaction for 3.7 s after "return from savings search"
- Friction: No reaction for 3.7 s after "open mortgage filter draft"
- Friction: No reaction for 3.7 s after "verify fixed was not applied"
- Friction: No reaction for 3.7 s after "open unsaved rate"
- Friction: No reaction for 3.4 s after "open product from saved rates"
- Friction: No reaction for 15.9 s after "leave removed product"
- Friction: "No saved rates" shown on "start compare from rates"
- Friction: No reaction for 3.0 s after "open two-rate comparison"
- Slower: "open app" content 4.4 s to 124.1 s
- Slower: "scroll rates 1" content 0.7 s to 4.0 s
- Slower: "scroll rates 2" content 0.7 s to 3.4 s
- Slower: "scroll product" content 0.7 s to 4.0 s
- Slower: Dropped frames 60% to 78% on "scroll product eligibility"
- Slower: Dropped frames 56% to 76% on "expand eligibility"
- Slower: "expand constraints" content 0.0 s to 2.3 s
- Slower: Dropped frames 56% to 81% on "scroll product sources"
- Slower: "scroll product sources" content 0.7 s to 3.0 s
- Slower: "open lenders" content 0.0 s to 2.9 s
- Slower: "back from lenders" content 0.0 s to 2.5 s
- Slower: "switch to home loans" content 0.0 s to 3.6 s
- Slower: "open filters" content 0.0 s to 2.8 s
- Slower: "open market" content 0.0 s to 3.1 s
- Slower: "open rba" content 0.0 s to 2.4 s
- Slower: "scroll rba" content 0.9 s to 3.1 s
- Slower: "scroll market" content 0.8 s to 3.1 s
- Slower: "return to rates" content 0.0 s to 2.8 s
- Slower: "select second comparison rate" content 0.0 s to 2.8 s

**Initial Rates readiness:** 134.4 s from JS start (at or above the 3 s target) · last blocker: rows

**Extended journeys**

- Rate change evidence: 1 passed, 0 failed, 0 blocked
- Product categories: 4 passed, 0 failed, 0 blocked
- Search and clear: 6 passed, 0 failed, 0 blocked
- Discard temporary filters: 6 passed, 0 failed, 0 blocked
- Saved rate lifecycle: 8 passed, 1 failed, 1 blocked
- Compare two rates: 6 passed, 0 failed, 0 blocked
- Saved Savings matches: 1 passed, 1 failed, 11 blocked
- Restore Savings profile: 1 passed, 1 failed, 1 blocked

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-29

Mode session | 66 steps | crashes 0 | step failures 6 | settle timeouts 1 | steps with JS/native errors 9
Baseline 1.0.399

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 106786 | +102407 | 2272/3100 | 85 | 542 | 8 errors; start 5362ms |
| 2 | scroll rates 1 | 4175 | +3428 | 23/41 | 65 | 617 | boot js-start 77596, layout-mounted 78308, cache-read 78596, hydrated 79537, splash-hide 79537, manifest 81576, resolved 82574, core-fetched 91465, core-saved 93354, pricing-wait-suitability 93786, search-index-idle 93786, details-start 94587, post-refresh-wait 111137, details-fetched 148625, rows-prepared 171880, detail-filters-idle 171880, leading-requested 171880, last-pricing 171880, suitability-built 177107, leading-scoped 195743, leading-page 195743, refresh-done 200880, pricing-ready 211718, last-rows 211718, rates-ready 212007, pricing-starts 1, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 442, pricing-scope-ms 37144, filter-runs 2, filter-rows 37735, filter-yields 8, filter-ms 200, sort-runs 1, sort-rows 2150, sort-yields 1, sort-ms 27 |
| 3 | scroll rates 2 | 718 | +21 | 37/53 | 81 | 495 |  |
| 4 | scroll rates back | 687 | -16 |  |  | 529 |  |
| 5 | open product | 25 | +25 | 3/6 | 34 | 602 |  |
| 6 | scroll product | 707 | +6 | 68/95 | 85 | 648 |  |
| 7 | expand visible fees | 32 | +32 | 11/16 | 61 | 669 |  |
| 8 | expand visible fees again | 23 |  | 9/14 | 77 | 648 | no reaction to tap on "Show Fees" |
| 9 | expand product facts | 0 | 0 | 221/326 | 85 | 696 |  |
| 10 | scroll product fees | 689 | -43 | 23/31 | 81 | 646 |  |
| 11 | scroll product eligibility | 748 | -10 | 25/32 | 89 | 648 |  |
| 12 | expand eligibility | 0 | 0 | 208/273 | 89 | 664 |  |
| 13 | expand constraints | 21 | +21 | 9/14 | 61 | 650 |  |
| 14 | scroll product sources | 734 | +47 | 26/32 | 89 | 650 |  |
| 15 | back to rates | 24 | -20128 | 14/22 | 73 | 648 |  |
| 16 | open lenders | 23 | +23 | 19/22 | 250 | 651 |  |
| 17 | scroll lenders | 842 | +129 | 20/24 | 150 | 648 |  |
| 18 | back from lenders | 23 | +1 | 6/7 | 250 | 649 |  |
| 19 | switch to savings and see a priced account | 29 |  | 55/83 | 81 | 658 | UI assertion failed: app hierarchy unavailable |
| 20 | switch to term deposits and see a priced offer | 22 |  | 77/103 | 81 | 668 | UI assertion failed: app hierarchy unavailable |
| 21 | switch to home loans | 24 | +24 | 21/28 | 81 | 701 |  |
| 22 | open filters | 23 | +23 | 23/28 | 129 | 704 |  |
| 23 | close filters | 23 | -20128 | 8/9 | 150 | 703 |  |
| 24 | open market | 24 | +24 | 17/31 | 61 | 710 |  |
| 25 | open rba | 2530 | +2529 | 53/64 | 65 | 732 |  |
| 26 | scroll rba | 749 | -147 | 33/54 | 65 | 725 |  |
| 27 | back from rba | 25 | -20126 | 14/20 | 69 | 726 |  |
| 28 | scroll market | 680 | -132 | 28/38 | 85 | 723 |  |
| 29 | open saved | 22 | +22 | 12/18 | 81 | 727 |  |
| 30 | return to rates | 23 | +23 | 20/33 | 69 | 733 |  |
| 31 | verify Income Plus rate history | 12008 |  | 40/59 | 81 | 798 | 1 errors |
| 32 | start category switch | 27 | -23066 | 15/24 | 69 | 780 |  |
| 33 | open term deposits | 24 |  | 19/30 | 69 | 736 |  |
| 34 | verify term deposit rates | 711 |  | 37/54 | 77 | 745 |  |
| 35 | restore home loans | 31 |  | 18/30 | 65 | 751 |  |
| 36 | start search from rates | 30 | -4599 | 1/1 | 16 | 738 |  |
| 37 | open savings search | 22 | -1 | 15/28 | 69 | 742 |  |
| 38 | search Macquarie | 2434 | -54 | 70/77 | 150 | 742 | 1 errors |
| 39 | verify Macquarie result | 0 | -1 | 15/15 | 16 | 742 |  |
| 40 | clear query and restore results | 23 | +2 | 18/20 | 48 | 749 |  |
| 41 | return from savings search | 25 | -4496 | 34/41 | 85 | 760 |  |
| 42 | start filter rollback | 25 | -6 | 12/15 | 16 | 754 |  |
| 43 | open mortgage filter draft | 26 | -8 | 30/33 | 150 | 758 |  |
| 44 | select fixed in draft | 24 | +1 | 11/12 | 105 | 757 |  |
| 45 | discard unsaved filter draft | 23 | +1 | 18/22 | 73 | 759 |  |
| 46 | verify fixed was not applied | 21 | 0 | 27/28 | 150 | 762 | 1 errors |
| 47 | close verified filter draft | 22 | +2 | 21/24 | 105 | 762 |  |
| 48 | start save from rates | 32 | 0 | 13/17 | 17 | 759 | 1 errors |
| 49 | open unsaved rate | 26 | -15 | 107/145 | 101 | 799 | 1 errors |
| 50 | save a rate | 24 | 0 | 9/15 | 53 | 781 | 1 errors |
| 51 | leave saved product | 21 | -6624 | 13/24 | 81 | 781 |  |
| 52 | restart with a saved rate | 23922 | +5045 | 469/641 | 85 | 416 | 1 errors; start 6546ms; boot js-start 792988, layout-mounted 793241, hydrated 793473, cache-read 794782, core-ready 795636, rows-prepared 795817, search-index-idle 795817, detail-filters-idle 795817, leading-requested 795817, last-pricing 795817, splash-hide 795819, manifest 799638, resolved 800583, leading-scoped 807602, leading-page 807602, pricing-ready 809123, last-rows 809123, rates-ready 809412, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 127, pricing-scope-ms 9218, filter-runs 2, filter-rows 37735, filter-yields 8, filter-ms 199, sort-runs 1, sort-rows 2150, sort-yields 1, sort-ms 23 |
| 53 | verify saved rate after restart | 31 | -24 | 20/28 | 101 | 427 |  |
| 54 | open product from saved rates | 25 | -6 | 39/60 | 89 | 556 |  |
| 55 | remove saved rate | 25 | +2 | 14/21 | 117 | 652 | 2 errors |
| 56 | leave removed product | 20151 | +144 | 8/11 | 81 | 651 | no settle; Back destination was not observed |
| 57 | start compare from rates | 39 | +12 |  |  | 633 |  |
| 58 | enter selection mode | 29 | -2677 | 22/36 | 69 | 681 |  |
| 59 | select first comparison rate | 23 | -16 | 14/18 | 61 | 681 |  |
| 60 | select second comparison rate | 23 | -11 | 13/18 | 65 | 688 |  |
| 61 | open two-rate comparison | 23 |  | 21/28 | 150 | 687 |  |
| 62 | return from two-rate comparison | 24 |  | 20/28 | 101 | 691 |  |
| 63 | open savings profile | 26 |  | 17/28 | 69 | 691 |  |
| 64 | open savings features | 0 |  | 212/295 | 81 | 689 | not found: {"id":"profile:Savings:accountFeatures:open"} |
| 65 | restore audit profile | 34 |  | 1/1 | 16 | 690 |  |
| 66 | clear audit requirements | 0 |  | 226/294 | 81 | 690 | not found: {"contains":"Clear all saved requirements"} |

## Fatal lines
```
1 W/ReactNativeJS( 4733): [AR warn] degrade: store.ensureFailed fn=ensureDetails error="Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget"
1 W/ReactNativeJS( 4733): [AR warn] store: ensureDetails failed: Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget
```

## Errors

### 1 open app
```
11-28 16:17:53.570 E/australianrates( 4733): Not starting debugger since process cannot load the jdwp agent.
11-28 16:18:20.490 W/ReactNativeJS( 4733): [AR warn] degrade: store.ensureFailed fn=ensureDetails error="Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget"
11-28 16:18:20.490 W/ReactNativeJS( 4733): [AR warn] store: ensureDetails failed: Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget
11-28 16:18:29.529 W/ReactNativeJS( 4733): [AR warn] store: ensureDetails failed: Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget
11-28 16:18:29.530 W/ReactNativeJS( 4733): [AR warn] degrade: store.ensureFailed fn=ensureDetails error="Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget"
11-28 16:18:30.436 E/unknown:SurfaceMountingManager( 4733): Stopping surface [1]
11-28 16:18:30.447 E/unknown:SurfaceMountingManager( 4733): Surface [1] was stopped on SurfaceMountingManager.
11-28 16:18:30.453 E/unknown:IntBufferBatchMountItem( 4733): Skipping batch of MountItems; was stopped [1].
```

### 31 verify Income Plus rate history
```
11-28 16:26:32.175 W/ReactNativeJS( 4733): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/dates-index.json?%E2%80%A6 ctx=download
```

### 38 search Macquarie
```
11-28 16:27:56.376 E/FrameTracker( 4733): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 46 verify fixed was not applied
```
11-28 16:28:59.916 E/FrameTracker( 4733): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 48 start save from rates
```
11-28 16:29:17.575 E/FrameTracker( 4733): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 49 open unsaved rate
```
11-28 16:29:23.334 E/ImeBackDispatcher( 4733): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 264854110
```

### 50 save a rate
```
11-28 16:29:33.822 E/FrameTracker( 4733): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 52 restart with a saved rate
```
11-28 16:29:49.046 E/australianrates(12875): Not starting debugger since process cannot load the jdwp agent.
```

### 55 remove saved rate
```
11-28 16:30:55.057 W/ReactNativeJS(12875): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/dates-index.json?%E2%80%A6 ctx=download
11-28 16:30:55.816 W/ReactNativeJS(12875): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/dates-index.json?%E2%80%A6 ctx=download
```
