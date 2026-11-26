# UX review

UX review: 7 major, 222 minor across 94 screens. Weakest: Frustration and abandonment risk 1.3/5, Appropriateness 2.4/5, Comfort 4.3/5.
Product details: duplicate source records removed across audited payload: 139; confirmed extra rows visible in captured disclosures: 6 (5 measured captures).
First value 38.0 s, relaunch 10.1 s, 0 gate taps. Taps: find the best rate 0, compare unknown, open a lender unknown, open a product 1, save a rate unknown.

Frustration and abandonment risk 1.3/5: 7 major, 112 minor.
- major | restart with a saved rate: slow, 18.6 s to settle | Fix: Show content first and defer the slow work
- major | leave removed product: spinner-no-result "screen never settled", screen kept changing until the settle timeout | Fix: Replace the spinner with a result or a retry action
- major | leave removed product: slow, 20.1 s to settle | Fix: Show content first and defer the slow work
- major | /projections: slow, 13.6 s to settle | Fix: Show content first and defer the slow work
- major | /settings: tap-target "Changelog 1.0.389", 328x24 dp, minimum 48 | Fix: Pad the control to 48 dp or add hitSlop
- major | cold start: slow-first-value, 38.0 s from launch to rates showing | Fix: Show cached rates on launch before the refresh

| dimension | score | findings |
| --- | --- | --- |
| Design consistency | 4.6/5 | 14 |
| Layout | 5/5 | 0 |
| Ease of use | 4.7/5 | 8 |
| Comfort | 4.3/5 | 12 |
| Helpfulness | 4.9/5 | 1 |
| Appropriateness | 2.4/5 | 96 |
| Onboarding ease | 4.9/5 | 1 |
| Barriers to entry and use | 4.8/5 | 2 |
| Engagement hooks | 5/5 | 0 |
| Frustration and abandonment risk | 1.3/5 | 119 |

## Task cost

| task | taps from first screen | seconds |
| --- | --- | --- |
| Find the best rate | 0 | 38.0 s |
| Compare | unknown | 2.4 s |
| Open a lender | unknown | unknown |
| Open a product | 1 | 4.0 s |
| Save a rate | unknown | unknown |

## Top findings per dimension

**Design consistency**
- minor select fixed in draft: contrast "Fixed" (4.5:1, needs 4.5:1). Fix: Darken the text or lighten the background
- minor enter selection mode: contrast "Done" (4.5:1, needs 4.5:1). Fix: Darken the text or lighten the background
- minor select first comparison rate: contrast "Done" (4.5:1, needs 4.5:1). Fix: Darken the text or lighten the background

**Ease of use**
- major /settings: tap-target "Changelog 1.0.389" (328x24 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- minor /tools: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- minor /tools: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop

**Comfort**
- major restart with a saved rate: slow (18.6 s to settle). Fix: Show content first and defer the slow work
- major leave removed product: spinner-no-result "screen never settled" (screen kept changing until the settle timeout). Fix: Replace the spinner with a result or a retry action
- major leave removed product: slow (20.1 s to settle). Fix: Show content first and defer the slow work

**Helpfulness**
- major leave removed product: spinner-no-result "screen never settled" (screen kept changing until the settle timeout). Fix: Replace the spinner with a result or a retry action

**Appropriateness**
- minor open app: accuracy "CLASSIC HOME LOAN VARIABLE 60-80 LVR PI, Cairns bank" (comparison 6% is below advertised 6.54%). Fix: Fix the displayed figure or its sort
- minor open app: accuracy "Owner Occupier P&I No Offset Mortgage, MoveBank" (comparison 6.19% is below advertised 6.49%). Fix: Fix the displayed figure or its sort
- minor scroll rates 1: accuracy "Owner Occupier P&I No Offset Mortgage, MoveBank" (comparison 6.25% is below advertised 6.44%). Fix: Fix the displayed figure or its sort

**Onboarding ease**
- major cold start: slow-first-value (38.0 s from launch to rates showing). Fix: Show cached rates on launch before the refresh

**Barriers to entry and use**
- major cold start: slow-first-value (38.0 s from launch to rates showing). Fix: Show cached rates on launch before the refresh
- major cold start: slow-relaunch (10.1 s from relaunch to rates showing). Fix: Draw the cached rates first, then refresh in the background

**Frustration and abandonment risk**
- major restart with a saved rate: slow (18.6 s to settle). Fix: Show content first and defer the slow work
- major leave removed product: spinner-no-result "screen never settled" (screen kept changing until the settle timeout). Fix: Replace the spinner with a result or a retry action
- major leave removed product: slow (20.1 s to settle). Fix: Show content first and defer the slow work

## Screens

| screen | elements | tappable | findings | major |
| --- | --- | --- | --- | --- |
| open app | 52 | 31 | 4 | 0 |
| scroll rates 1 | 51 | 33 | 8 | 0 |
| scroll rates 2 | 57 | 27 | 6 | 0 |
| scroll rates back | 57 | 27 | 6 | 0 |
| open product | 34 | 10 | 1 | 0 |
| scroll product | 22 | 8 | 0 | 0 |
| expand visible fees | 25 | 8 | 0 | 0 |
| expand product facts | 30 | 13 | 5 | 0 |
| scroll product fees | 30 | 7 | 1 | 0 |
| scroll product eligibility | 21 | 12 | 3 | 0 |
| expand eligibility | 29 | 10 | 4 | 0 |
| expand constraints | 31 | 9 | 4 | 0 |
| scroll product sources | 22 | 10 | 1 | 0 |
| back to rates | 57 | 27 | 6 | 0 |
| open lenders | 41 | 21 | 0 | 0 |
| scroll lenders | 40 | 21 | 0 | 0 |
| back from lenders | 57 | 27 | 6 | 0 |
| switch to savings | 49 | 31 | 0 | 0 |
| switch to home loans | 57 | 30 | 6 | 0 |
| open filters | 42 | 20 | 1 | 0 |
| close filters | 57 | 30 | 6 | 0 |
| open market | 42 | 13 | 0 | 0 |
| open rba | 24 | 7 | 0 | 0 |
| scroll rba | 25 | 10 | 0 | 0 |
| back from rba | 42 | 13 | 0 | 0 |
| scroll market | 32 | 10 | 1 | 0 |
| open saved | 19 | 9 | 0 | 0 |
| return to rates | 59 | 29 | 7 | 0 |
| start category switch | 59 | 29 | 7 | 0 |
| open term deposits | 49 | 31 | 0 | 0 |
| verify term deposit rates | 49 | 31 | 1 | 0 |
| restore home loans | 59 | 29 | 7 | 0 |
| start search from rates | 59 | 29 | 7 | 0 |
| open savings search | 49 | 31 | 0 | 0 |
| search Macquarie | 50 | 32 | 0 | 0 |
| verify Macquarie result | 50 | 32 | 0 | 0 |
| clear query and restore results | 49 | 31 | 0 | 0 |
| return from savings search | 57 | 30 | 6 | 0 |
| start filter rollback | 57 | 30 | 6 | 0 |
| open mortgage filter draft | 37 | 18 | 1 | 0 |
| select fixed in draft | 37 | 18 | 2 | 0 |
| discard unsaved filter draft | 57 | 30 | 6 | 0 |
| verify fixed was not applied | 37 | 18 | 1 | 0 |
| close verified filter draft | 57 | 30 | 6 | 0 |
| start save from rates | 57 | 30 | 6 | 0 |
| open unsaved rate | 27 | 10 | 1 | 0 |
| save a rate | 27 | 10 | 1 | 0 |
| leave saved product | 57 | 30 | 6 | 0 |
| restart with a saved rate | 52 | 31 | 5 | 1 |
| verify saved rate after restart | 26 | 12 | 1 | 0 |
| open product from saved rates | 27 | 10 | 1 | 0 |
| remove saved rate | 27 | 10 | 1 | 0 |
| leave removed product | 19 | 9 | 2 | 2 |
| start compare from rates | 52 | 31 | 4 | 0 |
| enter selection mode | 42 | 21 | 5 | 0 |
| select first comparison rate | 42 | 21 | 5 | 0 |
| select second comparison rate | 42 | 21 | 5 | 0 |
| open two-rate comparison | 19 | 2 | 2 | 0 |
| return from two-rate comparison | 42 | 21 | 5 | 0 |
| cold start | 52 | 31 | 4 | 0 |
| /browse | 52 | 31 | 4 | 0 |
| /watchlist | 19 | 9 | 0 | 0 |
| /market | 42 | 13 | 0 | 0 |
| /tools | 41 | 20 | 5 | 0 |
| /trends | 41 | 20 | 5 | 0 |
| /search | 52 | 31 | 4 | 0 |
| /banks | 52 | 31 | 4 | 0 |
| /bank-rates | 45 | 21 | 4 | 0 |
| /categories | 52 | 31 | 4 | 0 |
| /catalogue | 48 | 17 | 1 | 0 |
| /compare | 6 | 3 | 0 | 0 |
| /matches | 48 | 17 | 1 | 0 |
| /calculator | 41 | 20 | 5 | 0 |
| /projections | 36 | 17 | 2 | 1 |
| /profile | 42 | 18 | 1 | 0 |
| /research | 37 | 16 | 1 | 0 |
| /rba | 27 | 9 | 0 | 0 |
| /rba-response | 42 | 16 | 1 | 0 |
| /settings | 33 | 11 | 1 | 1 |
| /about | 25 | 11 | 0 | 0 |
| /terms | 18 | 7 | 0 | 0 |
| /privacy | 18 | 7 | 0 | 0 |
| /third-party-notices | 20 | 7 | 0 | 0 |
| /node | 46 | 17 | 1 | 0 |
| /passthrough | 41 | 15 | 0 | 0 |
| /calculation-receipt | 23 | 10 | 0 | 0 |
| /rate-receipt | 14 | 7 | 0 | 0 |
| warm resume | 14 | 7 | 0 | 0 |
| cold relaunch | 52 | 30 | 3 | 0 |
| about | 25 | 11 | 0 | 0 |
| audit screen | 27 | 11 | 0 | 0 |
| about for debug log | 25 | 11 | 0 | 0 |
| debug log screen | 33 | 12 | 0 | 0 |
| debug log uploaded | 33 | 12 | 0 | 0 |
