# UX review

UX review: 2 major, 253 minor across 95 screens. Weakest: Frustration and abandonment risk 1.5/5, Appropriateness 2/5, Design consistency 4.6/5.
Product details: duplicate source records removed across audited payload: 137; confirmed extra rows visible in captured disclosures: 0 (4 measured captures).
First value 31.9 s, relaunch 10.0 s, 0 gate taps. Taps: find the best rate 0, compare unknown, open a lender unknown, open a product 1, save a rate unknown.

Frustration and abandonment risk 1.5/5: 2 major, 124 minor.
- major | restart with a saved rate: slow, 17.7 s to settle | Fix: Show content first and defer the slow work
- major | cold start: slow-first-value, 31.9 s from launch to rates showing | Fix: Show cached rates on launch before the refresh
- minor | open app: jargon "Cairns · CLASSIC HOME LOAN VARIABLE 60-80 LVR PI", unexpanded LVR | Fix: Replace the abbreviation with a plain label
- minor | scroll rates 1: jargon "Save, Owner Occupier P&I No Offset Mortgage, MoveB", unexpanded P&I | Fix: Replace the abbreviation with a plain label
- minor | scroll rates 1: crowded-targets "View MoveBank · History · Freshness · Unknown / Ow", 4 dp apart | Fix: Add at least 8 dp between adjacent controls
- minor | scroll rates 2: jargon "MoveBank · Owner Occupier P&I No Offset Mortgage", unexpanded P&I | Fix: Replace the abbreviation with a plain label

| dimension | score | findings |
| --- | --- | --- |
| Design consistency | 4.6/5 | 16 |
| Layout | 5/5 | 0 |
| Ease of use | 4.8/5 | 8 |
| Comfort | 4.7/5 | 9 |
| Helpfulness | 5/5 | 0 |
| Appropriateness | 2/5 | 113 |
| Onboarding ease | 4.9/5 | 1 |
| Barriers to entry and use | 4.9/5 | 2 |
| Engagement hooks | 5/5 | 0 |
| Frustration and abandonment risk | 1.5/5 | 126 |

## Task cost

| task | taps from first screen | seconds |
| --- | --- | --- |
| Find the best rate | 0 | 31.9 s |
| Compare | unknown | 2.3 s |
| Open a lender | unknown | unknown |
| Open a product | 1 | 2.8 s |
| Save a rate | unknown | unknown |

## Top findings per dimension

**Design consistency**
- minor select fixed in draft: contrast "Fixed" (4.5:1, needs 4.5:1). Fix: Darken the text or lighten the background
- minor enter selection mode: contrast "Done" (4.5:1, needs 4.5:1). Fix: Darken the text or lighten the background
- minor select first comparison rate: contrast "Done" (4.5:1, needs 4.5:1). Fix: Darken the text or lighten the background

**Ease of use**
- minor /tools: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- minor /tools: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- minor /trends: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop

**Comfort**
- major restart with a saved rate: slow (17.7 s to settle). Fix: Show content first and defer the slow work
- minor /tools: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- minor /tools: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop

**Appropriateness**
- minor open app: accuracy "CLASSIC HOME LOAN VARIABLE 60-80 LVR PI, Cairns bank" (comparison 6% is below advertised 6.54%). Fix: Fix the displayed figure or its sort
- minor open app: accuracy "Owner Occupier P&I No Offset Mortgage, MoveBank" (comparison 6.19% is below advertised 6.49%). Fix: Fix the displayed figure or its sort
- minor scroll rates 1: accuracy "Owner Occupier P&I No Offset Mortgage, MoveBank" (comparison 6.19% is below advertised 6.49%). Fix: Fix the displayed figure or its sort

**Onboarding ease**
- major cold start: slow-first-value (31.9 s from launch to rates showing). Fix: Show cached rates on launch before the refresh

**Barriers to entry and use**
- major cold start: slow-first-value (31.9 s from launch to rates showing). Fix: Show cached rates on launch before the refresh
- minor cold start: slow-relaunch (10.0 s from relaunch to rates showing). Fix: Draw the cached rates first, then refresh in the background

**Frustration and abandonment risk**
- major restart with a saved rate: slow (17.7 s to settle). Fix: Show content first and defer the slow work
- major cold start: slow-first-value (31.9 s from launch to rates showing). Fix: Show cached rates on launch before the refresh
- minor open app: jargon "Cairns · CLASSIC HOME LOAN VARIABLE 60-80 LVR PI" (unexpanded LVR). Fix: Replace the abbreviation with a plain label

## Screens

| screen | elements | tappable | findings | major |
| --- | --- | --- | --- | --- |
| open app | 52 | 31 | 4 | 0 |
| scroll rates 1 | 52 | 34 | 10 | 0 |
| scroll rates 2 | 47 | 28 | 8 | 0 |
| scroll rates back | 47 | 28 | 8 | 0 |
| open product | 26 | 11 | 1 | 0 |
| scroll product | 24 | 8 | 1 | 0 |
| expand visible fees | 24 | 8 | 1 | 0 |
| expand product facts | 33 | 9 | 1 | 0 |
| scroll product fees | 26 | 10 | 1 | 0 |
| scroll product eligibility | 20 | 11 | 1 | 0 |
| expand eligibility | 20 | 11 | 1 | 0 |
| expand constraints | 28 | 10 | 2 | 0 |
| scroll product sources | 23 | 10 | 1 | 0 |
| back to rates | 47 | 28 | 8 | 0 |
| open lenders | 35 | 18 | 3 | 0 |
| scroll lenders | 35 | 18 | 3 | 0 |
| back from lenders | 47 | 28 | 8 | 0 |
| switch to savings | 49 | 31 | 0 | 0 |
| switch to home loans | 47 | 28 | 8 | 0 |
| open filters | 45 | 20 | 2 | 0 |
| close filters | 47 | 28 | 8 | 0 |
| open market | 42 | 13 | 0 | 0 |
| open rba | 24 | 7 | 0 | 0 |
| scroll rba | 25 | 10 | 0 | 0 |
| back from rba | 42 | 13 | 0 | 0 |
| scroll market | 32 | 10 | 1 | 0 |
| open saved | 19 | 9 | 0 | 0 |
| return to rates | 47 | 28 | 8 | 0 |
| start category switch | 47 | 28 | 8 | 0 |
| open term deposits | 49 | 31 | 0 | 0 |
| verify term deposit rates | 51 | 33 | 2 | 0 |
| restore home loans | 47 | 28 | 8 | 0 |
| start search from rates | 47 | 28 | 8 | 0 |
| open savings search | 49 | 31 | 0 | 0 |
| search Macquarie | 50 | 32 | 0 | 0 |
| verify Macquarie result | 50 | 32 | 0 | 0 |
| clear query and restore results | 49 | 31 | 0 | 0 |
| return from savings search | 47 | 28 | 8 | 0 |
| start filter rollback | 47 | 28 | 8 | 0 |
| open mortgage filter draft | 38 | 17 | 0 | 0 |
| select fixed in draft | 38 | 17 | 1 | 0 |
| discard unsaved filter draft | 47 | 28 | 8 | 0 |
| verify fixed was not applied | 38 | 17 | 0 | 0 |
| close verified filter draft | 47 | 28 | 8 | 0 |
| start save from rates | 47 | 28 | 8 | 0 |
| open unsaved rate | 26 | 11 | 1 | 0 |
| save a rate | 26 | 11 | 1 | 0 |
| leave saved product | 47 | 28 | 8 | 0 |
| restart with a saved rate | 52 | 31 | 5 | 1 |
| verify saved rate after restart | 26 | 12 | 2 | 0 |
| open product from saved rates | 26 | 11 | 1 | 0 |
| remove saved rate | 26 | 11 | 1 | 0 |
| leave removed product | 19 | 9 | 0 | 0 |
| follow browse rates recovery | 19 | 9 | 0 | 0 |
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
| /projections | 40 | 18 | 3 | 0 |
| /profile | 30 | 13 | 0 | 0 |
| /research | 33 | 14 | 1 | 0 |
| /rba | 24 | 7 | 0 | 0 |
| /rba-response | 47 | 15 | 2 | 0 |
| /settings | 30 | 9 | 0 | 0 |
| /about | 22 | 9 | 0 | 0 |
| /terms | 15 | 5 | 0 | 0 |
| /privacy | 15 | 5 | 0 | 0 |
| /third-party-notices | 16 | 5 | 0 | 0 |
| /node | 48 | 17 | 1 | 0 |
| /passthrough | 42 | 13 | 0 | 0 |
| /calculation-receipt | 19 | 8 | 0 | 0 |
| /rate-receipt | 10 | 5 | 0 | 0 |
| warm resume | 10 | 5 | 0 | 0 |
| cold relaunch | 52 | 31 | 4 | 0 |
| about | 22 | 9 | 0 | 0 |
| audit screen | 25 | 10 | 0 | 0 |
| about for debug log | 25 | 11 | 0 | 0 |
| debug log screen | 32 | 12 | 0 | 0 |
| debug log uploaded | 32 | 12 | 0 | 0 |
