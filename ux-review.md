# UX review

UX review: 29 major, 151 minor across 87 screens. Weakest: Design consistency 1.4/5, Frustration and abandonment risk 2.7/5, Appropriateness 3.2/5.
First value 30.7 s, relaunch 8.6 s, 0 gate taps. Taps: find the best rate 0, compare unknown, open a lender unknown, open a product 1, save a rate unknown.
- major | search Macquarie: contrast "Macq · Macquarie Cash Management Accelerator Accou", 1.1:1, needs 4.5:1 | Fix: Darken the text or lighten the background
- major | search Macquarie: contrast "Rates", 1.0:1, needs 4.5:1 | Fix: Darken the text or lighten the background
- major | search Macquarie: contrast "Saved", 1.0:1, needs 4.5:1 | Fix: Darken the text or lighten the background
- major | search Macquarie: contrast "Market", 1.0:1, needs 4.5:1 | Fix: Darken the text or lighten the background

Frustration and abandonment risk 2.7/5: 2 major, 73 minor.
- major | restart with a saved rate: slow, 12.7 s to settle | Fix: Show content first and defer the slow work
- major | cold start: slow-first-value, 30.7 s from launch to rates showing | Fix: Show cached rates on launch before the refresh
- minor | open app: jargon "Cairns · CLASSIC HOME LOAN VARIABLE 60-80 LVR PI", unexpanded LVR | Fix: Replace the abbreviation with a plain label
- minor | scroll rates 1: jargon "Cairns · PLUS HOME LOAN FIXED 1YR 60-80 LVR PI", unexpanded LVR | Fix: Replace the abbreviation with a plain label
- minor | scroll rates 2: jargon "Unity Bank · Momentum Home Loan 60-80LVR - Owner O", unexpanded P&I | Fix: Replace the abbreviation with a plain label
- minor | scroll rates back: jargon "Unity Bank · Momentum Home Loan 60-80LVR - Owner O", unexpanded P&I | Fix: Replace the abbreviation with a plain label

| dimension | score | findings |
| --- | --- | --- |
| Design consistency | 1.4/5 | 43 |
| Layout | 5/5 | 0 |
| Ease of use | 4.9/5 | 4 |
| Comfort | 4.7/5 | 6 |
| Helpfulness | 5/5 | 0 |
| Appropriateness | 3.2/5 | 62 |
| Onboarding ease | 4.9/5 | 1 |
| Barriers to entry and use | 4.9/5 | 2 |
| Engagement hooks | 5/5 | 0 |
| Frustration and abandonment risk | 2.7/5 | 75 |

## Task cost

| task | taps from first screen | seconds |
| --- | --- | --- |
| Find the best rate | 0 | 30.7 s |
| Compare | unknown | 2.1 s |
| Open a lender | unknown | unknown |
| Open a product | 1 | 3.5 s |
| Save a rate | unknown | unknown |

## Top findings per dimension

**Design consistency**
- major search Macquarie: contrast "Macq · Macquarie Cash Management Accelerator Account" (1.1:1, needs 4.5:1). Fix: Darken the text or lighten the background
- major search Macquarie: contrast "Rates" (1.0:1, needs 4.5:1). Fix: Darken the text or lighten the background
- major search Macquarie: contrast "Saved" (1.0:1, needs 4.5:1). Fix: Darken the text or lighten the background

**Ease of use**
- minor /tools: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- minor /tools: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- minor /calculator: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop

**Comfort**
- major restart with a saved rate: slow (12.7 s to settle). Fix: Show content first and defer the slow work
- minor /tools: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- minor /tools: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop

**Appropriateness**
- minor open app: accuracy "CLASSIC HOME LOAN VARIABLE 60-80 LVR PI, Cairns bank" (comparison 6% is below advertised 6.54%). Fix: Fix the displayed figure or its sort
- minor open app: accuracy "Everyday Home Loan, MoveBank" (comparison 6.19% is below advertised 6.49%). Fix: Fix the displayed figure or its sort
- minor scroll rates 1: accuracy "Everyday Home Loan, MoveBank" (comparison 6.25% is below advertised 6.44%). Fix: Fix the displayed figure or its sort

**Onboarding ease**
- major cold start: slow-first-value (30.7 s from launch to rates showing). Fix: Show cached rates on launch before the refresh

**Barriers to entry and use**
- major cold start: slow-first-value (30.7 s from launch to rates showing). Fix: Show cached rates on launch before the refresh
- minor cold start: slow-relaunch (8.6 s from relaunch to rates showing). Fix: Draw the cached rates first, then refresh in the background

**Frustration and abandonment risk**
- major restart with a saved rate: slow (12.7 s to settle). Fix: Show content first and defer the slow work
- major cold start: slow-first-value (30.7 s from launch to rates showing). Fix: Show cached rates on launch before the refresh
- minor open app: jargon "Cairns · CLASSIC HOME LOAN VARIABLE 60-80 LVR PI" (unexpanded LVR). Fix: Replace the abbreviation with a plain label

## Screens

| screen | elements | tappable | findings | major |
| --- | --- | --- | --- | --- |
| open app | 52 | 31 | 4 | 0 |
| scroll rates 1 | 49 | 31 | 5 | 0 |
| scroll rates 2 | 57 | 27 | 3 | 0 |
| scroll rates back | 57 | 27 | 3 | 0 |
| open product | 27 | 10 | 1 | 0 |
| scroll product | 26 | 8 | 2 | 0 |
| back to rates | 57 | 27 | 3 | 0 |
| open lenders | 41 | 21 | 0 | 0 |
| scroll lenders | 38 | 20 | 1 | 0 |
| back from lenders | 57 | 27 | 3 | 0 |
| switch to savings | 49 | 31 | 0 | 0 |
| switch to home loans | 57 | 30 | 3 | 0 |
| open filters | 42 | 20 | 1 | 0 |
| close filters | 57 | 30 | 3 | 0 |
| open market | 42 | 13 | 0 | 0 |
| open rba | 24 | 7 | 0 | 0 |
| scroll rba | 25 | 10 | 0 | 0 |
| back from rba | 42 | 13 | 0 | 0 |
| scroll market | 32 | 10 | 1 | 0 |
| open saved | 19 | 9 | 0 | 0 |
| return to rates | 60 | 30 | 5 | 0 |
| start category switch | 60 | 30 | 5 | 0 |
| open term deposits | 49 | 31 | 0 | 0 |
| verify term deposit rates | 52 | 34 | 2 | 0 |
| restore home loans | 57 | 30 | 3 | 0 |
| start search from rates | 57 | 30 | 3 | 0 |
| open savings search | 49 | 31 | 0 | 0 |
| search Macquarie | 50 | 32 | 4 | 4 |
| verify Macquarie result | 50 | 32 | 4 | 4 |
| clear query and restore results | 49 | 31 | 4 | 4 |
| return from savings search | 60 | 30 | 8 | 3 |
| start filter rollback | 60 | 30 | 8 | 3 |
| open mortgage filter draft | 37 | 18 | 1 | 0 |
| select fixed in draft | 37 | 18 | 2 | 0 |
| discard unsaved filter draft | 60 | 30 | 8 | 3 |
| verify fixed was not applied | 37 | 18 | 1 | 0 |
| close verified filter draft | 60 | 30 | 8 | 3 |
| start save from rates | 60 | 30 | 8 | 3 |
| open unsaved rate | 31 | 10 | 0 | 0 |
| save a rate | 31 | 10 | 0 | 0 |
| leave saved product | 60 | 30 | 5 | 0 |
| restart with a saved rate | 52 | 31 | 4 | 1 |
| verify saved rate after restart | 26 | 12 | 1 | 0 |
| open product from saved rates | 31 | 10 | 0 | 0 |
| remove saved rate | 31 | 10 | 0 | 0 |
| leave removed product | 19 | 9 | 0 | 0 |
| follow browse rates recovery | 52 | 31 | 4 | 0 |
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
| /trends | 33 | 14 | 1 | 0 |
| /search | 52 | 31 | 3 | 0 |
| /banks | 52 | 30 | 3 | 0 |
| /bank-rates | 48 | 23 | 4 | 0 |
| /categories | 52 | 30 | 2 | 0 |
| /catalogue | 46 | 17 | 1 | 0 |
| /compare | 10 | 5 | 0 | 0 |
| /matches | 46 | 17 | 1 | 0 |
| /calculator | 43 | 21 | 3 | 0 |
| /projections | 36 | 17 | 1 | 0 |
| /profile | 42 | 18 | 1 | 0 |
| /research | 37 | 16 | 1 | 0 |
| /rba | 27 | 9 | 0 | 0 |
| /rba-response | 42 | 16 | 1 | 0 |
| /settings | 28 | 9 | 0 | 0 |
| /about | 25 | 11 | 0 | 0 |
| /terms | 18 | 7 | 0 | 0 |
| /privacy | 18 | 7 | 0 | 0 |
| /third-party-notices | 20 | 7 | 0 | 0 |
| /node | 46 | 17 | 1 | 0 |
| /passthrough | 41 | 15 | 0 | 0 |
| /calculation-receipt | 23 | 10 | 0 | 0 |
| /rate-receipt | 14 | 7 | 0 | 0 |
| warm resume | 14 | 7 | 0 | 0 |
| cold relaunch | 52 | 30 | 2 | 0 |
| about | 25 | 11 | 0 | 0 |
| audit screen | 27 | 11 | 0 | 0 |
| about for debug log | 25 | 11 | 0 | 0 |
| debug log screen | 27 | 8 | 0 | 0 |
