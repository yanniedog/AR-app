# App explorer: 1.0.399 (455)

**Real-use session FAIL vs 1.0.398: 28 broken, 27 friction, 8 slower**

- Broken: "open product" failed: not found: {"contains":", Comparison rate"}
- Broken: "back to rates" failed: Back destination was not observed
- Broken: "open lenders" failed: not found: "Lenders"
- Broken: Blank screen after "open lenders"
- Broken: Blank screen after "scroll lenders"
- Broken: No way back on "back from lenders"
- Broken: Blank screen after "back from lenders"
- Broken: "switch to savings" failed: not found: "Savings"
- Broken: Blank screen after "switch to savings"
- Broken: "switch to home loans" failed: not found: "Home loans"
- Broken: Blank screen after "switch to home loans"
- Broken: "open filters" failed: not found: {"contains":"Temporary filters"}
- Broken: Blank screen after "open filters"
- Broken: "close filters" failed: Back destination was not observed
- Broken: "open market" failed: not found: "Market"
- Broken: Blank screen after "open market"
- Broken: "open rba" failed: not found: "RBA"
- Broken: Blank screen after "open rba"
- Broken: Blank screen after "scroll rba"
- Broken: "back from rba" failed: Back destination was not observed
- Broken: Blank screen after "scroll market"
- Broken: "open saved" failed: not found: "Saved"
- Broken: Blank screen after "open saved"
- Broken: "return to rates" failed: not found: "Rates"
- Broken: Blank screen after "return to rates"
- Broken: Screen never settled on "start category switch"
- Broken: Screen never settled on "leave removed product"
- Broken: "select second comparison rate" failed: UI assertion failed: app hierarchy unavailable
- Friction: "Rates unavailable" shown on "open app"
- Friction: "Rates unavailable" shown on "scroll rates 1"
- Friction: "Rates unavailable" shown on "scroll rates 2"
- Friction: "Rates unavailable" shown on "scroll rates back"
- Friction: "Rates unavailable" shown on "open product"
- Friction: "Rates unavailable" shown on "scroll product"
- Friction: "Rates unavailable" shown on "expand visible fees"
- Friction: "Rates unavailable" shown on "expand product facts"
- Friction: "Rates unavailable" shown on "scroll product fees"
- Friction: "Rates unavailable" shown on "scroll product eligibility"
- Friction: "Rates unavailable" shown on "expand eligibility"
- Friction: "Rates unavailable" shown on "expand constraints"
- Friction: "Rates unavailable" shown on "scroll product sources"
- Friction: No reaction for 6.0 s after "back to rates"
- Friction: No reaction for 20.0 s after "close filters"
- Friction: No reaction for 3.5 s after "scroll rba"
- Friction: No reaction for 3.2 s after "scroll market"
- Friction: No reaction for 22.9 s after "start category switch"
- Friction: No reaction for 7.2 s after "start search from rates"
- Friction: No reaction for 4.2 s after "open savings search"
- Friction: No reaction for 4.8 s after "search Macquarie"
- Friction: No reaction for 7.3 s after "return from savings search"
- Friction: No reaction for 3.5 s after "open mortgage filter draft"
- Friction: No reaction for 9.5 s after "leave saved product"
- Friction: No reaction for 3.2 s after "open product from saved rates"
- Friction: No reaction for 19.9 s after "leave removed product"
- Friction: "No saved rates" shown on "leave removed product"
- Slower: "back to rates" content 2.3 s to 20.2 s
- Slower: "back to rates" reaction 2.3 s to 6.0 s
- Slower: "close filters" content 2.5 s to 20.2 s
- Slower: "close filters" reaction 2.5 s to 20.0 s
- Slower: "back from rba" content 2.2 s to 20.2 s
- Slower: "start category switch" content 0.0 s to 22.9 s
- Slower: "start search from rates" content 0.0 s to 7.2 s
- Slower: "start compare from rates" content 0.0 s to 2.5 s

**Initial Rates readiness:** 553.2 s from JS start (at or above the 3 s target) · last blocker: rows

**Extended journeys**

- Product categories: 0 passed, 1 failed, 3 blocked
- Search and clear: 6 passed, 0 failed, 0 blocked
- Discard temporary filters: 6 passed, 0 failed, 0 blocked
- Saved rate lifecycle: 8 passed, 1 failed, 1 blocked
- Compare two rates: 3 passed, 1 failed, 2 blocked

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-29

Mode session | 54 steps | crashes 0 | step failures 13 | settle timeouts 5 | steps with JS/native errors 8
Baseline 1.0.398

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 4379 | -95084 | 598/825 | 85 | 293 | 5 errors; start 4269ms |
| 2 | scroll rates 1 | 747 | -3259 | 15/26 | 57 | 295 |  |
| 3 | scroll rates 2 | 697 | -61 | 15/24 | 69 | 312 |  |
| 4 | scroll rates back | 703 | -12 |  |  | 304 |  |
| 5 | open product | 0 | -35 |  |  | 283 | not found: {"contains":", Comparison rate"} |
| 6 | scroll product | 701 | -14 | 16/27 | 65 | 283 |  |
| 7 | expand visible fees | 0 | 0 |  |  | 283 |  |
| 8 | expand product facts | 0 | -25 | 145/241 | 69 | 284 |  |
| 9 | scroll product fees | 732 | +4 | 17/26 | 65 | 282 |  |
| 10 | scroll product eligibility | 758 | +29 | 15/25 | 89 | 282 |  |
| 11 | expand eligibility | 0 | -22 | 137/243 | 65 | 284 |  |
| 12 | expand constraints | 0 | -26 | 133/236 | 65 | 284 |  |
| 13 | scroll product sources | 687 | -38 | 14/25 | 61 | 282 |  |
| 14 | back to rates | 20152 | +20114 |  |  | 274 | no settle; Back destination was not observed; 3 errors |
| 15 | open lenders | 0 | -24 |  |  | 269 | not found: "Lenders" |
| 16 | scroll lenders | 713 | +2 |  |  | 265 |  |
| 17 | back from lenders | 22 | -4 |  |  | 265 |  |
| 18 | switch to savings | 0 | -29 |  |  | 260 | not found: "Savings" |
| 19 | switch to home loans | 0 | -24 |  |  | 256 | not found: "Home loans" |
| 20 | open filters | 0 | -27 |  |  | 252 | not found: {"contains":"Temporary filters"} |
| 21 | close filters | 20151 | +20128 |  |  | 248 | no settle; Back destination was not observed |
| 22 | open market | 0 | -23 |  |  | 240 | not found: "Market" |
| 23 | open rba | 1 | -2774 |  |  | 236 | not found: "RBA" |
| 24 | scroll rba | 896 | +163 |  |  | 232 |  |
| 25 | back from rba | 20151 | +20127 |  |  | 228 | no settle; Back destination was not observed |
| 26 | scroll market | 812 | +123 |  |  | 224 |  |
| 27 | open saved | 0 | -23 |  |  | 224 | not found: "Saved" |
| 28 | return to rates | 0 | -25 |  |  | 220 | not found: "Rates" |
| 29 | start category switch | 23093 | +23062 | 420/572 | 85 | 426 | no settle; 1 errors |
| 30 | start search from rates | 4629 | +4598 | 2/2 | 32 | 499 | boot js-start 86362, layout-mounted 86809, cache-read 87157, hydrated 87592, splash-hide 87592, manifest 89391, resolved 89998, core-fetched 98242, core-saved 99635, pricing-wait-suitability 100267, search-index-idle 100267, details-start 100861, post-refresh-wait 118758, refresh-done 140104, details-fetched 618806, rows-prepared 624617, detail-filters-idle 624617, leading-requested 624617, last-pricing 624617, suitability-built 625917, leading-scoped 630578, leading-page 630578, pricing-ready 639250, last-rows 639250, rates-ready 639540, pricing-starts 1, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 292, pricing-scope-ms 13509, filter-runs 2, filter-rows 37735, filter-yields 9, filter-ms 181, sort-runs 1, sort-rows 2150, sort-yields 1, sort-ms 24 |
| 31 | open savings search | 23 |  | 45/63 | 85 | 527 |  |
| 32 | search Macquarie | 2488 |  | 27/31 | 150 | 506 |  |
| 33 | verify Macquarie result | 1 |  | 44/52 | 117 | 514 |  |
| 34 | clear query and restore results | 21 |  | 17/20 | 44 | 508 |  |
| 35 | return from savings search | 4521 |  | 32/38 | 77 | 528 |  |
| 36 | start filter rollback | 31 | -3 | 12/16 | 48 | 566 |  |
| 37 | open mortgage filter draft | 34 |  | 19/24 | 300 | 579 |  |
| 38 | select fixed in draft | 23 |  | 12/14 | 101 | 577 |  |
| 39 | discard unsaved filter draft | 22 |  | 16/22 | 113 | 579 |  |
| 40 | verify fixed was not applied | 21 |  | 22/26 | 250 | 586 | 1 errors |
| 41 | close verified filter draft | 20 |  | 19/21 | 105 | 587 |  |
| 42 | start save from rates | 32 | +3 | 15/17 | 18 | 584 | 1 errors |
| 43 | open unsaved rate | 41 |  | 39/56 | 89 | 617 | 1 errors |
| 44 | save a rate | 24 |  | 9/14 | 57 | 627 | 1 errors |
| 45 | leave saved product | 6645 |  | 14/23 | 73 | 626 |  |
| 46 | restart with a saved rate | 18877 |  | 412/536 | 85 | 612 | 3 errors; start 4852ms; boot js-start 792766, layout-mounted 793003, hydrated 793289, cache-read 794696, core-ready 795491, rows-prepared 795639, search-index-idle 795639, detail-filters-idle 795639, leading-requested 795639, last-pricing 795639, splash-hide 795640, manifest 799116, resolved 800105, leading-scoped 805340, leading-page 805340, pricing-ready 806623, last-rows 806623, rates-ready 806919, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 120, pricing-scope-ms 7516, filter-runs 2, filter-rows 37735, filter-yields 9, filter-ms 185, sort-runs 1, sort-rows 2150, sort-yields 1, sort-ms 26 |
| 47 | verify saved rate after restart | 55 |  | 29/41 | 85 | 423 |  |
| 48 | open product from saved rates | 31 |  | 44/62 | 77 | 548 |  |
| 49 | remove saved rate | 23 |  | 11/18 | 101 | 608 |  |
| 50 | leave removed product | 20007 |  | 6/11 | 65 | 640 | no settle |
| 51 | start compare from rates | 27 | -4 | 13/22 | 61 | 633 |  |
| 52 | enter selection mode | 2706 |  | 12/17 | 77 | 662 |  |
| 53 | select first comparison rate | 39 |  | 13/16 | 61 | 707 |  |
| 54 | select second comparison rate | 34 |  |  |  | 732 | UI assertion failed: app hierarchy unavailable |

## Fatal lines
```
1 W/ReactNativeJS( 5026): [AR warn] store: ensureDetails failed: Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget
1 W/ReactNativeJS( 5026): [AR warn] degrade: store.ensureFailed fn=ensureDetails error="Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget"
```

## Errors

### 1 open app
```
11-28 15:40:29.667 E/australianrates( 5026): Not starting debugger since process cannot load the jdwp agent.
11-28 15:40:55.866 W/ReactNativeJS( 5026): [AR warn] store: ensureDetails failed: Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget
11-28 15:40:55.869 W/ReactNativeJS( 5026): [AR warn] degrade: store.ensureFailed fn=ensureDetails error="Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget"
11-28 15:41:04.423 W/ReactNativeJS( 5026): [AR warn] degrade: store.ensureFailed fn=ensureDetails error="Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget"
11-28 15:41:04.423 W/ReactNativeJS( 5026): [AR warn] store: ensureDetails failed: Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget
```

### 14 back to rates
```
11-28 15:45:10.706 E/unknown:SurfaceMountingManager( 5026): Stopping surface [1]
11-28 15:45:10.829 E/unknown:ReactNative( 5026): Tried to remove non-existent frame callback
11-28 15:45:10.850 E/unknown:SurfaceMountingManager( 5026): Surface [1] was stopped on SurfaceMountingManager.
```

### 29 start category switch
```
11-28 15:49:15.941 E/unknown:IntBufferBatchMountItem( 5026): Skipping batch of MountItems; was stopped [1].
```

### 40 verify fixed was not applied
```
11-28 15:51:23.051 E/FrameTracker( 5026): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 42 start save from rates
```
11-28 15:51:39.713 E/FrameTracker( 5026): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 43 open unsaved rate
```
11-28 15:51:45.466 E/ImeBackDispatcher( 5026): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 229701155
```

### 44 save a rate
```
11-28 15:51:55.966 E/FrameTracker( 5026): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 46 restart with a saved rate
```
11-28 15:52:17.720 E/australianrates(13283): Not starting debugger since process cannot load the jdwp agent.
11-28 15:52:22.441 E/SurfaceSyncGroup(13283): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
11-28 15:52:22.441 E/SurfaceSyncGroup(13283): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
```
