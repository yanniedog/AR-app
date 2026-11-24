# UX review

UX review: 3 major, 185 minor across 87 screens. Weakest: Frustration and abandonment risk 2.2/5, Appropriateness 2.7/5, Design consistency 4.5/5.
First value 41.0 s, relaunch 10.2 s, 0 gate taps. Taps: find the best rate 0, compare unknown, open a lender unknown, open a product 1, save a rate unknown.

Frustration and abandonment risk 2.2/5: 3 major, 87 minor.
- major | restart with a saved rate: slow, 15.0 s to settle | Fix: Show content first and defer the slow work
- major | cold start: slow-first-value, 41.0 s from launch to rates showing | Fix: Show cached rates on launch before the refresh
- major | cold start: slow-relaunch, 10.2 s from relaunch to rates showing | Fix: Draw the cached rates first, then refresh in the background
- minor | open app: jargon "Cairns · CLASSIC HOME LOAN VARIABLE 60-80 LVR PI", unexpanded LVR | Fix: Replace the abbreviation with a plain label
- minor | scroll rates 1: jargon "Save, PLUS HOME LOAN FIXED 2YR 60-80 LVR PI, Cairn", unexpanded LVR | Fix: Replace the abbreviation with a plain label
- minor | scroll rates 1: crowded-targets "View Cairns bank · History · Freshness · Unknown /", 4 dp apart | Fix: Add at least 8 dp between adjacent controls

| dimension | score | findings |
| --- | --- | --- |
| Design consistency | 4.5/5 | 17 |
| Layout | 5/5 | 0 |
| Ease of use | 4.8/5 | 7 |
| Comfort | 4.6/5 | 10 |
| Helpfulness | 5/5 | 0 |
| Appropriateness | 2.7/5 | 81 |
| Onboarding ease | 4.9/5 | 1 |
| Barriers to entry and use | 4.8/5 | 2 |
| Engagement hooks | 5/5 | 0 |
| Frustration and abandonment risk | 2.2/5 | 90 |

## Task cost

| task | taps from first screen | seconds |
| --- | --- | --- |
| Find the best rate | 0 | 41.0 s |
| Compare | unknown | 2.4 s |
| Open a lender | unknown | unknown |
| Open a product | 1 | 2.6 s |
| Save a rate | unknown | unknown |

## Top findings per dimension

**Design consistency**
- minor open app: contrast "Updating" (4.2:1, needs 4.5:1). Fix: Darken the text or lighten the background
- minor scroll product: contrast "30 days" (4.5:1, needs 4.5:1). Fix: Darken the text or lighten the background
- minor select fixed in draft: contrast "Fixed" (4.5:1, needs 4.5:1). Fix: Darken the text or lighten the background

**Ease of use**
- minor /tools: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- minor /tools: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- minor /trends: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop

**Comfort**
- major restart with a saved rate: slow (15.0 s to settle). Fix: Show content first and defer the slow work
- minor open product: slow (5.5 s to settle). Fix: Show content first and defer the slow work
- minor leave removed product: slow (9.0 s to settle). Fix: Show content first and defer the slow work

**Appropriateness**
- minor open app: accuracy "CLASSIC HOME LOAN VARIABLE 60-80 LVR PI, Cairns bank" (comparison 6% is below advertised 6.54%). Fix: Fix the displayed figure or its sort
- minor open app: accuracy "Everyday Home Loan, MoveBank" (comparison 6.19% is below advertised 6.49%). Fix: Fix the displayed figure or its sort
- minor scroll rates 1: accuracy "Everyday Home Loan, MoveBank" (comparison 6.25% is below advertised 6.44%). Fix: Fix the displayed figure or its sort

**Onboarding ease**
- major cold start: slow-first-value (41.0 s from launch to rates showing). Fix: Show cached rates on launch before the refresh

**Barriers to entry and use**
- major cold start: slow-first-value (41.0 s from launch to rates showing). Fix: Show cached rates on launch before the refresh
- major cold start: slow-relaunch (10.2 s from relaunch to rates showing). Fix: Draw the cached rates first, then refresh in the background

**Frustration and abandonment risk**
- major restart with a saved rate: slow (15.0 s to settle). Fix: Show content first and defer the slow work
- major cold start: slow-first-value (41.0 s from launch to rates showing). Fix: Show cached rates on launch before the refresh
- major cold start: slow-relaunch (10.2 s from relaunch to rates showing). Fix: Draw the cached rates first, then refresh in the background

## Screens

| screen | elements | tappable | findings | major |
| --- | --- | --- | --- | --- |
| open app | 52 | 31 | 4 | 0 |
| scroll rates 1 | 52 | 34 | 8 | 0 |
| scroll rates 2 | 57 | 27 | 4 | 0 |
| scroll rates back | 57 | 27 | 4 | 0 |
| open product | 31 | 10 | 1 | 0 |
| scroll product | 34 | 13 | 2 | 0 |
| back to rates | 57 | 27 | 4 | 0 |
| open lenders | 41 | 21 | 0 | 0 |
| scroll lenders | 35 | 18 | 0 | 0 |
| back from lenders | 57 | 27 | 4 | 0 |
| switch to savings | 49 | 31 | 0 | 0 |
| switch to home loans | 57 | 30 | 5 | 0 |
| open filters | 42 | 20 | 1 | 0 |
| close filters | 57 | 30 | 5 | 0 |
| open market | 42 | 13 | 0 | 0 |
| open rba | 24 | 7 | 0 | 0 |
| scroll rba | 25 | 10 | 0 | 0 |
| back from rba | 42 | 13 | 0 | 0 |
| scroll market | 32 | 10 | 1 | 0 |
| open saved | 19 | 9 | 0 | 0 |
| return to rates | 60 | 30 | 7 | 0 |
| start category switch | 60 | 30 | 7 | 0 |
| open term deposits | 49 | 31 | 0 | 0 |
| verify term deposit rates | 52 | 34 | 2 | 0 |
| restore home loans | 60 | 30 | 7 | 0 |
| start search from rates | 60 | 30 | 7 | 0 |
| open savings search | 49 | 31 | 0 | 0 |
| search Macquarie | 50 | 32 | 0 | 0 |
| verify Macquarie result | 50 | 32 | 0 | 0 |
| clear query and restore results | 49 | 31 | 0 | 0 |
| return from savings search | 57 | 30 | 5 | 0 |
| start filter rollback | 57 | 30 | 5 | 0 |
| open mortgage filter draft | 37 | 18 | 1 | 0 |
| select fixed in draft | 37 | 18 | 2 | 0 |
| discard unsaved filter draft | 57 | 30 | 5 | 0 |
| verify fixed was not applied | 37 | 18 | 1 | 0 |
| close verified filter draft | 57 | 30 | 5 | 0 |
| start save from rates | 57 | 30 | 5 | 0 |
| open unsaved rate | 27 | 10 | 1 | 0 |
| save a rate | 27 | 10 | 1 | 0 |
| leave saved product | 57 | 30 | 5 | 0 |
| restart with a saved rate | 52 | 31 | 4 | 1 |
| verify saved rate after restart | 26 | 12 | 1 | 0 |
| open product from saved rates | 27 | 10 | 1 | 0 |
| remove saved rate | 27 | 10 | 1 | 0 |
| leave removed product | 19 | 9 | 1 | 0 |
| follow browse rates recovery | 52 | 31 | 3 | 0 |
| start compare from rates | 52 | 31 | 3 | 0 |
| enter selection mode | 42 | 21 | 4 | 0 |
| select first comparison rate | 42 | 21 | 4 | 0 |
| select second comparison rate | 42 | 21 | 4 | 0 |
| open two-rate comparison | 21 | 2 | 2 | 0 |
| return from two-rate comparison | 42 | 21 | 4 | 0 |
| cold start | 52 | 31 | 3 | 0 |
| /browse | 52 | 31 | 3 | 0 |
| /watchlist | 19 | 9 | 0 | 0 |
| /market | 42 | 13 | 0 | 0 |
| /tools | 41 | 20 | 5 | 0 |
| /trends | 41 | 20 | 5 | 0 |
| /search | 52 | 31 | 3 | 0 |
| /banks | 52 | 31 | 3 | 0 |
| /bank-rates | 45 | 21 | 4 | 0 |
| /categories | 52 | 31 | 3 | 0 |
| /catalogue | 48 | 17 | 1 | 0 |
| /compare | 6 | 3 | 0 | 0 |
| /matches | 48 | 17 | 1 | 0 |
| /calculator | 41 | 20 | 5 | 0 |
| /projections | 33 | 15 | 1 | 0 |
| /profile | 49 | 21 | 1 | 0 |
| /research | 33 | 14 | 1 | 0 |
| /rba | 24 | 7 | 0 | 0 |
| /rba-response | 47 | 15 | 2 | 0 |
| /settings | 26 | 8 | 0 | 0 |
| /about | 22 | 9 | 0 | 0 |
| /terms | 15 | 5 | 0 | 0 |
| /privacy | 15 | 5 | 0 | 0 |
| /third-party-notices | 16 | 5 | 0 | 0 |
| /node | 48 | 17 | 1 | 0 |
| /passthrough | 42 | 13 | 0 | 0 |
| /calculation-receipt | 19 | 8 | 0 | 0 |
| /rate-receipt | 10 | 5 | 0 | 0 |
| warm resume | 10 | 5 | 0 | 0 |
| cold relaunch | 52 | 31 | 3 | 0 |
| about | 22 | 9 | 0 | 0 |
| audit screen | 25 | 10 | 0 | 0 |
| about for debug log | 22 | 9 | 0 | 0 |
| debug log screen | 28 | 9 | 0 | 0 |
