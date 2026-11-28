# UX review

UX review: 8 major, 220 minor across 95 screens. Weakest: Frustration and abandonment risk 1.8/5, Appropriateness 2.5/5, Design consistency 4.1/5.
Product details: duplicate source records removed across audited payload: 137; confirmed extra rows visible in captured disclosures: 0 (3 measured captures).
First value 23.2 s, relaunch 8.5 s, 0 gate taps. Taps: find the best rate 0, compare unknown, open a lender unknown, open a product 1, save a rate unknown.
- major | /tools: contrast "28 Nov 2026", 1.1:1, needs 4.5:1 | Fix: Darken the text or lighten the background
- major | /tools: contrast "−20.0 bps", 1.1:1, needs 4.5:1 | Fix: Darken the text or lighten the background
- major | /tools: contrast "Trends", 1.1:1, needs 4.5:1 | Fix: Darken the text or lighten the background
- major | /tools: contrast "Average", 1.1:1, needs 4.5:1 | Fix: Darken the text or lighten the background

Frustration and abandonment risk 1.8/5: 3 major, 109 minor.
- major | open app: slow, 25.5 s to settle | Fix: Show content first and defer the slow work
- major | restart with a saved rate: slow, 12.1 s to settle | Fix: Show content first and defer the slow work
- major | cold start: slow-first-value, 23.2 s from launch to rates showing | Fix: Show cached rates on launch before the refresh
- minor | open app: jargon "Cairns · CLASSIC HOME LOAN VARIABLE 60-80 LVR PI", unexpanded LVR | Fix: Replace the abbreviation with a plain label
- minor | scroll rates 1: jargon "Cairns · PLUS HOME LOAN FIXED 1YR 60-80 LVR PI", unexpanded LVR | Fix: Replace the abbreviation with a plain label
- minor | scroll rates 2: jargon "Save, Virgin Money Lite Home Loan, Virgin Money, C", unexpanded LVR | Fix: Replace the abbreviation with a plain label

| dimension | score | findings |
| --- | --- | --- |
| Design consistency | 4.1/5 | 20 |
| Layout | 5/5 | 0 |
| Ease of use | 4.9/5 | 4 |
| Comfort | 4.6/5 | 8 |
| Helpfulness | 5/5 | 0 |
| Appropriateness | 2.5/5 | 96 |
| Onboarding ease | 4.9/5 | 1 |
| Barriers to entry and use | 4.9/5 | 2 |
| Engagement hooks | 5/5 | 0 |
| Frustration and abandonment risk | 1.8/5 | 112 |

## Task cost

| task | taps from first screen | seconds |
| --- | --- | --- |
| Find the best rate | 0 | 23.2 s |
| Compare | unknown | unknown |
| Open a lender | unknown | unknown |
| Open a product | 1 | 3.1 s |
| Save a rate | unknown | unknown |

## Top findings per dimension

**Design consistency**
- major /tools: contrast "28 Nov 2026" (1.1:1, needs 4.5:1). Fix: Darken the text or lighten the background
- major /tools: contrast "−20.0 bps" (1.1:1, needs 4.5:1). Fix: Darken the text or lighten the background
- major /tools: contrast "Trends" (1.1:1, needs 4.5:1). Fix: Darken the text or lighten the background

**Ease of use**
- minor /calculator: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- minor /calculator: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- minor /projections: tap-target "EditText" (292x38 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop

**Comfort**
- major open app: slow (25.5 s to settle). Fix: Show content first and defer the slow work
- major restart with a saved rate: slow (12.1 s to settle). Fix: Show content first and defer the slow work
- minor open product: slow (6.5 s to settle). Fix: Show content first and defer the slow work

**Appropriateness**
- minor open app: accuracy "CLASSIC HOME LOAN VARIABLE 60-80 LVR PI, Cairns bank" (comparison 6% is below advertised 6.54%). Fix: Fix the displayed figure or its sort
- minor open app: accuracy "Owner Occupier P&I No Offset Mortgage, MoveBank" (comparison 6.19% is below advertised 6.49%). Fix: Fix the displayed figure or its sort
- minor scroll rates 1: accuracy "PLUS HOME LOAN FIXED 2YR 60-80 LVR PI, Cairns bank" (comparison 6.28% is below advertised 6.54%). Fix: Fix the displayed figure or its sort

**Onboarding ease**
- major cold start: slow-first-value (23.2 s from launch to rates showing). Fix: Show cached rates on launch before the refresh

**Barriers to entry and use**
- major cold start: slow-first-value (23.2 s from launch to rates showing). Fix: Show cached rates on launch before the refresh
- minor cold start: slow-relaunch (8.5 s from relaunch to rates showing). Fix: Draw the cached rates first, then refresh in the background

**Frustration and abandonment risk**
- major open app: slow (25.5 s to settle). Fix: Show content first and defer the slow work
- major restart with a saved rate: slow (12.1 s to settle). Fix: Show content first and defer the slow work
- major cold start: slow-first-value (23.2 s from launch to rates showing). Fix: Show cached rates on launch before the refresh

## Screens

| screen | elements | tappable | findings | major |
| --- | --- | --- | --- | --- |
| open app | 52 | 31 | 5 | 1 |
| scroll rates 1 | 49 | 31 | 6 | 0 |
| scroll rates 2 | 57 | 27 | 6 | 0 |
| scroll rates back | 57 | 27 | 6 | 0 |
| open product | 31 | 10 | 1 | 0 |
| scroll product | 23 | 8 | 0 | 0 |
| expand visible fees | 27 | 8 | 0 | 0 |
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
| scroll market | 32 | 10 | 1 | 0 |
| open saved | 19 | 9 | 0 | 0 |
| return to rates | 60 | 30 | 8 | 0 |
| start category switch | 60 | 30 | 8 | 0 |
| open term deposits | 49 | 31 | 0 | 0 |
| verify term deposit rates | 52 | 34 | 2 | 0 |
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
| leave removed product | 19 | 9 | 0 | 0 |
| follow browse rates recovery | 52 | 31 | 5 | 0 |
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
| /tools | 42 | 13 | 5 | 5 |
| /trends | 33 | 14 | 1 | 0 |
| /search | 52 | 31 | 4 | 0 |
| /banks | 52 | 31 | 4 | 0 |
| /bank-rates | 45 | 21 | 4 | 0 |
| /categories | 52 | 31 | 4 | 0 |
| /catalogue | 48 | 17 | 1 | 0 |
| /compare | 6 | 3 | 0 | 0 |
| /matches | 48 | 17 | 1 | 0 |
| /calculator | 41 | 20 | 5 | 0 |
| /projections | 40 | 18 | 3 | 0 |
| /profile | 30 | 13 | 1 | 0 |
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
