# UX review

UX review: 5 major, 197 minor across 94 screens. Weakest: Frustration and abandonment risk 1.9/5, Appropriateness 2.7/5, Comfort 4.6/5.
Product details: duplicate source records removed across audited payload: 137; confirmed extra rows visible in captured disclosures: 0 (3 measured captures).
First value 47.4 s, relaunch 17.0 s, 0 gate taps. Taps: find the best rate 0, compare unknown, open a lender unknown, open a product 1, save a rate unknown.

Frustration and abandonment risk 1.9/5: 5 major, 97 minor.
- major | restart with a saved rate: slow, 19.8 s to settle | Fix: Show content first and defer the slow work
- major | leave removed product: spinner-no-result "screen never settled", screen kept changing until the settle timeout | Fix: Replace the spinner with a result or a retry action
- major | leave removed product: slow, 20.2 s to settle | Fix: Show content first and defer the slow work
- major | cold start: slow-first-value, 47.4 s from launch to rates showing | Fix: Show cached rates on launch before the refresh
- major | cold start: slow-relaunch, 17.0 s from relaunch to rates showing | Fix: Draw the cached rates first, then refresh in the background
- minor | open app: jargon "Cairns · CLASSIC HOME LOAN VARIABLE 60-80 LVR PI", unexpanded LVR | Fix: Replace the abbreviation with a plain label

| dimension | score | findings |
| --- | --- | --- |
| Design consistency | 4.7/5 | 13 |
| Layout | 5/5 | 0 |
| Ease of use | 4.9/5 | 3 |
| Comfort | 4.6/5 | 7 |
| Helpfulness | 4.9/5 | 1 |
| Appropriateness | 2.7/5 | 87 |
| Onboarding ease | 4.9/5 | 1 |
| Barriers to entry and use | 4.8/5 | 2 |
| Engagement hooks | 5/5 | 0 |
| Frustration and abandonment risk | 1.9/5 | 102 |

## Task cost

| task | taps from first screen | seconds |
| --- | --- | --- |
| Find the best rate | 0 | 47.4 s |
| Compare | unknown | unknown |
| Open a lender | unknown | unknown |
| Open a product | 1 | 4.0 s |
| Save a rate | unknown | unknown |

## Top findings per dimension

**Design consistency**
- minor select fixed in draft: contrast "Fixed" (4.5:1, needs 4.5:1). Fix: Darken the text or lighten the background
- minor enter selection mode: contrast "Done" (4.5:1, needs 4.5:1). Fix: Darken the text or lighten the background
- minor select first comparison rate: contrast "Done" (4.5:1, needs 4.5:1). Fix: Darken the text or lighten the background

**Ease of use**
- minor /calculator: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- minor /projections: tap-target "EditText" (292x38 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- minor /projections: tap-target "EditText" (269x38 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop

**Comfort**
- major restart with a saved rate: slow (19.8 s to settle). Fix: Show content first and defer the slow work
- major leave removed product: spinner-no-result "screen never settled" (screen kept changing until the settle timeout). Fix: Replace the spinner with a result or a retry action
- major leave removed product: slow (20.2 s to settle). Fix: Show content first and defer the slow work

**Helpfulness**
- major leave removed product: spinner-no-result "screen never settled" (screen kept changing until the settle timeout). Fix: Replace the spinner with a result or a retry action

**Appropriateness**
- minor open app: accuracy "CLASSIC HOME LOAN VARIABLE 60-80 LVR PI, Cairns bank" (comparison 6% is below advertised 6.54%). Fix: Fix the displayed figure or its sort
- minor open app: accuracy "Owner Occupier P&I No Offset Mortgage, MoveBank" (comparison 6.19% is below advertised 6.49%). Fix: Fix the displayed figure or its sort
- minor scroll rates 1: accuracy "PLUS HOME LOAN FIXED 2YR 60-80 LVR PI, Cairns bank" (comparison 6.28% is below advertised 6.54%). Fix: Fix the displayed figure or its sort

**Onboarding ease**
- major cold start: slow-first-value (47.4 s from launch to rates showing). Fix: Show cached rates on launch before the refresh

**Barriers to entry and use**
- major cold start: slow-first-value (47.4 s from launch to rates showing). Fix: Show cached rates on launch before the refresh
- major cold start: slow-relaunch (17.0 s from relaunch to rates showing). Fix: Draw the cached rates first, then refresh in the background

**Frustration and abandonment risk**
- major restart with a saved rate: slow (19.8 s to settle). Fix: Show content first and defer the slow work
- major leave removed product: spinner-no-result "screen never settled" (screen kept changing until the settle timeout). Fix: Replace the spinner with a result or a retry action
- major leave removed product: slow (20.2 s to settle). Fix: Show content first and defer the slow work

## Screens

| screen | elements | tappable | findings | major |
| --- | --- | --- | --- | --- |
| open app | 52 | 31 | 4 | 0 |
| scroll rates 1 | 49 | 31 | 6 | 0 |
| scroll rates 2 | 57 | 27 | 6 | 0 |
| scroll rates back | 57 | 27 | 6 | 0 |
| open product | 34 | 10 | 1 | 0 |
| scroll product | 22 | 8 | 0 | 0 |
| expand visible fees | 25 | 8 | 0 | 0 |
| expand product facts | 20 | 11 | 0 | 0 |
| scroll product fees | 20 | 11 | 0 | 0 |
| scroll product eligibility | 20 | 11 | 0 | 0 |
| expand eligibility | 20 | 11 | 0 | 0 |
| expand constraints | 22 | 10 | 1 | 0 |
| scroll product sources | 22 | 10 | 1 | 0 |
| back to rates | 57 | 27 | 6 | 0 |
| open lenders | 34 | 17 | 2 | 0 |
| scroll lenders | 34 | 17 | 2 | 0 |
| back from lenders | 57 | 27 | 6 | 0 |
| switch to savings | 49 | 31 | 0 | 0 |
| switch to home loans | 57 | 30 | 6 | 0 |
| open filters | 41 | 19 | 2 | 0 |
| close filters | 57 | 30 | 6 | 0 |
| open market | 42 | 13 | 0 | 0 |
| open rba | 24 | 7 | 0 | 0 |
| scroll rba | 25 | 10 | 0 | 0 |
| back from rba | 42 | 13 | 0 | 0 |
| scroll market | 41 | 10 | 0 | 0 |
| open saved | 19 | 9 | 0 | 0 |
| return to rates | 57 | 27 | 6 | 0 |
| start category switch | 57 | 27 | 6 | 0 |
| open term deposits | 49 | 31 | 0 | 0 |
| verify term deposit rates | 51 | 33 | 1 | 0 |
| restore home loans | 57 | 30 | 6 | 0 |
| start search from rates | 57 | 30 | 6 | 0 |
| open savings search | 49 | 31 | 0 | 0 |
| search Macquarie | 50 | 32 | 0 | 0 |
| verify Macquarie result | 50 | 32 | 0 | 0 |
| clear query and restore results | 49 | 31 | 0 | 0 |
| return from savings search | 57 | 30 | 6 | 0 |
| start filter rollback | 57 | 30 | 6 | 0 |
| open mortgage filter draft | 40 | 19 | 4 | 0 |
| select fixed in draft | 40 | 19 | 5 | 0 |
| discard unsaved filter draft | 57 | 30 | 6 | 0 |
| verify fixed was not applied | 40 | 19 | 4 | 0 |
| close verified filter draft | 57 | 30 | 6 | 0 |
| start save from rates | 57 | 30 | 6 | 0 |
| open unsaved rate | 27 | 10 | 1 | 0 |
| save a rate | 27 | 10 | 1 | 0 |
| leave saved product | 57 | 30 | 6 | 0 |
| restart with a saved rate | 52 | 31 | 5 | 1 |
| verify saved rate after restart | 26 | 12 | 1 | 0 |
| open product from saved rates | 27 | 10 | 1 | 0 |
| remove saved rate | 27 | 10 | 1 | 0 |
| leave removed product | 0 | 0 | 2 | 2 |
| start compare from rates | 19 | 9 | 0 | 0 |
| enter selection mode | 42 | 21 | 6 | 0 |
| select first comparison rate | 42 | 21 | 5 | 0 |
| select second comparison rate | 42 | 21 | 5 | 0 |
| open two-rate comparison | 19 | 2 | 2 | 0 |
| return from two-rate comparison | 42 | 21 | 5 | 0 |
| cold start | 49 | 28 | 3 | 0 |
| /browse | 49 | 28 | 3 | 0 |
| /watchlist | 20 | 9 | 0 | 0 |
| /market | 38 | 13 | 0 | 0 |
| /tools | 38 | 13 | 0 | 0 |
| /trends | 34 | 14 | 1 | 0 |
| /search | 49 | 28 | 3 | 0 |
| /banks | 49 | 28 | 3 | 0 |
| /bank-rates | 45 | 21 | 4 | 0 |
| /categories | 49 | 28 | 3 | 0 |
| /catalogue | 44 | 16 | 1 | 0 |
| /compare | 7 | 3 | 0 | 0 |
| /matches | 44 | 16 | 1 | 0 |
| /calculator | 40 | 19 | 3 | 0 |
| /projections | 36 | 16 | 3 | 0 |
| /profile | 28 | 12 | 1 | 0 |
| /research | 34 | 14 | 1 | 0 |
| /rba | 24 | 7 | 0 | 0 |
| /rba-response | 41 | 14 | 1 | 0 |
| /settings | 24 | 6 | 0 | 0 |
| /about | 22 | 9 | 0 | 0 |
| /terms | 15 | 5 | 0 | 0 |
| /privacy | 15 | 5 | 0 | 0 |
| /third-party-notices | 16 | 5 | 0 | 0 |
| /node | 44 | 16 | 1 | 0 |
| /passthrough | 38 | 13 | 0 | 0 |
| /calculation-receipt | 20 | 8 | 0 | 0 |
| /rate-receipt | 10 | 5 | 0 | 0 |
| warm resume | 10 | 5 | 0 | 0 |
| cold relaunch | 52 | 31 | 4 | 0 |
| about | 22 | 9 | 0 | 0 |
| audit screen | 25 | 10 | 0 | 0 |
| about for debug log | 22 | 9 | 0 | 0 |
| debug log screen | 30 | 11 | 0 | 0 |
| debug log uploaded | 30 | 11 | 0 | 0 |
