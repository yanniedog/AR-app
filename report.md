# App explorer: 1.0.342 (398)

**Real-use session FAIL vs 1.0.340: 2 broken, 17 friction, 2 slower**

- Broken: Nothing to read for 15.3 s on "open app"
- Broken: No way back on "verify Macquarie result"
- Friction: No reaction for 4.1 s after "scroll rates 1"
- Friction: No reaction for 3.4 s after "scroll rates 2"
- Friction: No reaction for 3.2 s after "scroll product"
- Friction: No reaction for 3.2 s after "scroll lenders"
- Friction: No reaction for 4.3 s after "switch to savings"
- Friction: "Refresh failed" shown on "open rba"
- Friction: No reaction for 3.1 s after "scroll rba"
- Friction: "Forecast unavailable" shown on "scroll rba"
- Friction: No reaction for 3.1 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Friction: No reaction for 4.5 s after "open term deposits"
- Friction: No reaction for 3.6 s after "verify term deposit rates"
- Friction: No reaction for 6.4 s after "search Macquarie"
- Friction: No reaction for 3.0 s after "return from savings search"
- Friction: No reaction for 3.4 s after "verify fixed was not applied"
- Friction: No reaction for 3.3 s after "open unsaved rate"
- Friction: "No saved rates" shown on "leave removed product"
- Slower: "open app" content 39.0 s to 67.3 s
- Slower: "open rba" content 0.0 s to 2.4 s

**Initial Rates readiness:** 70.2 s from JS start (at or above the 3 s target) · last blocker: rows

**Extended journeys**

- Product categories: 4 passed, 0 failed, 0 blocked
- Search and clear: 6 passed, 0 failed, 0 blocked
- Discard temporary filters: 6 passed, 0 failed, 0 blocked
- Saved rate lifecycle: 10 passed, 0 failed, 0 blocked
- Compare two rates: 6 passed, 0 failed, 0 blocked

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode session | 53 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 8
Baseline 1.0.340

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 52183 |  | 1120/1732 | 81 | 598 | 1 errors; start 3286ms; boot js-start 67516, layout-mounted 68306, cache-read 68467, hydrated 68740, splash-hide 68740, manifest 70393, resolved 71103, core-fetched 82367, core-saved 84745, rows-prepared 85865, search-index-idle 85865, details-start 87633, pricing-ready 94487, last-gate 94809, details-fetched 102823, detail-filters-idle 119089, last-pricing 119089, suitability-built 122896, post-refresh-wait 123457, last-rows 137336, rates-ready 137675 |
| 2 | scroll rates 1 | 780 |  | 32/54 | 77 | 488 |  |
| 3 | scroll rates 2 | 700 |  | 24/40 | 89 | 711 |  |
| 4 | scroll rates back | 680 |  |  |  | 569 |  |
| 5 | open product | 5049 |  | 31/55 | 85 | 622 |  |
| 6 | scroll product | 763 |  | 29/57 | 69 | 654 |  |
| 7 | back to rates | 21 |  | 10/25 | 65 | 627 |  |
| 8 | open lenders | 18 |  | 19/24 | 150 | 622 |  |
| 9 | scroll lenders | 764 |  | 23/28 | 133 | 619 |  |
| 10 | back from lenders | 19 |  | 8/9 | 129 | 621 |  |
| 11 | switch to savings | 20 |  | 50/80 | 77 | 634 |  |
| 12 | switch to home loans | 20 |  | 16/31 | 61 | 654 |  |
| 13 | open filters | 19 |  | 21/28 | 121 | 668 |  |
| 14 | close filters | 19 |  | 9/9 | 150 | 659 |  |
| 15 | open market | 20 |  | 18/28 | 61 | 664 |  |
| 16 | open rba | 2527 |  | 49/70 | 53 | 665 |  |
| 17 | scroll rba | 705 |  | 21/46 | 65 | 663 |  |
| 18 | back from rba | 25 |  | 7/20 | 65 | 665 |  |
| 19 | scroll market | 716 |  | 26/44 | 69 | 665 |  |
| 20 | open saved | 18 |  | 15/26 | 73 | 672 |  |
| 21 | return to rates | 19 |  | 14/30 | 61 | 678 |  |
| 22 | start category switch | 22 |  |  |  | 677 |  |
| 23 | open term deposits | 20 |  | 51/84 | 69 | 711 |  |
| 24 | verify term deposit rates | 706 |  | 32/55 | 81 | 720 |  |
| 25 | restore home loans | 21 |  | 12/28 | 53 | 735 |  |
| 26 | start search from rates | 25 |  |  |  | 725 |  |
| 27 | open savings search | 20 |  | 13/30 | 69 | 749 |  |
| 28 | search Macquarie | 1631 |  | 66/75 | 125 | 761 |  |
| 29 | verify Macquarie result | 26 |  | 13/16 | 16 | 753 | 1 errors |
| 30 | clear query and restore results | 34 |  | 18/19 | 32 | 767 | 1 errors |
| 31 | return from savings search | 20 |  | 32/45 | 61 | 792 |  |
| 32 | start filter rollback | 33 |  | 13/15 | 16 | 782 |  |
| 33 | open mortgage filter draft | 20 |  | 23/29 | 133 | 797 |  |
| 34 | select fixed in draft | 20 |  | 11/13 | 85 | 801 |  |
| 35 | discard unsaved filter draft | 18 |  | 14/22 | 85 | 804 |  |
| 36 | verify fixed was not applied | 20 |  | 22/29 | 150 | 817 | 1 errors |
| 37 | close verified filter draft | 19 |  | 19/22 | 81 | 817 |  |
| 38 | start save from rates | 42 |  | 13/15 | 16 | 813 | 1 errors |
| 39 | open unsaved rate | 34 |  | 40/62 | 73 | 748 | 1 errors |
| 40 | save a rate | 20 |  | 7/14 | 61 | 749 | 1 errors |
| 41 | leave saved product | 28 |  | 13/24 | 65 | 750 |  |
| 42 | restart with a saved rate | 14012 |  | 164/259 | 81 | 513 | 1 errors; start 5393ms; boot js-start 498627, layout-mounted 499016, hydrated 499172, cache-read 500190, core-ready 500787, rows-prepared 500902, search-index-idle 500902, detail-filters-idle 500902, last-pricing 500902, splash-hide 500903, manifest 503726, resolved 505229, pricing-ready 507787, last-rows 507787, rates-ready 507989 |
| 43 | verify saved rate after restart | 25 |  | 13/25 | 81 | 430 |  |
| 44 | open product from saved rates | 19 |  | 42/65 | 73 | 456 |  |
| 45 | remove saved rate | 20 |  | 7/15 | 57 | 452 |  |
| 46 | leave removed product | 20 |  | 6/11 | 53 | 452 |  |
| 47 | follow browse rates recovery | 19 |  | 16/27 | 65 | 459 |  |
| 48 | start compare from rates | 32 |  |  |  | 464 |  |
| 49 | enter selection mode | 20 |  | 7/14 | 48 | 472 |  |
| 50 | select first comparison rate | 23 |  | 8/16 | 40 | 471 |  |
| 51 | select second comparison rate | 19 |  | 8/13 | 53 | 477 |  |
| 52 | open two-rate comparison | 19 |  | 17/33 | 150 | 467 |  |
| 53 | return from two-rate comparison | 25 |  | 18/30 | 81 | 467 |  |

## Errors

### 1 open app
```
11-21 10:40:23.743 E/australianrates( 4816): Not starting debugger since process cannot load the jdwp agent.
```

### 29 verify Macquarie result
```
11-21 10:45:47.685 E/FrameTracker( 4816): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 30 clear query and restore results
```
11-21 10:45:59.094 E/FrameTracker( 4816): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 36 verify fixed was not applied
```
11-21 10:46:47.791 E/FrameTracker( 4816): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 38 start save from rates
```
11-21 10:47:04.790 E/FrameTracker( 4816): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 39 open unsaved rate
```
11-21 10:47:10.145 E/ImeBackDispatcher( 4816): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 5036885
```

### 40 save a rate
```
11-21 10:47:20.617 E/FrameTracker( 4816): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 42 restart with a saved rate
```
11-21 10:47:34.496 E/australianrates(10507): Not starting debugger since process cannot load the jdwp agent.
```
