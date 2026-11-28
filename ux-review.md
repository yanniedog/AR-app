# UX review

UX review: 13 major, 177 minor across 95 screens. Weakest: Frustration and abandonment risk 1.2/5, Appropriateness 3.6/5, Comfort 4.1/5.
Product details: duplicate source records removed across audited payload: 137; confirmed extra rows visible in captured disclosures: 0 (3 measured captures).
First value 23.6 s, relaunch 8.9 s, 0 gate taps. Taps: find the best rate 0, compare unknown, open a lender unknown, open a product 1, save a rate unknown.
- major | cold start: contrast "Updating", 1.1:1, needs 4.5:1 | Fix: Darken the text or lighten the background
- major | cold start: contrast "Principal & interest", 1.1:1, needs 4.5:1 | Fix: Darken the text or lighten the background
- major | cold relaunch: contrast "Updating", 1.1:1, needs 4.5:1 | Fix: Darken the text or lighten the background
- major | cold relaunch: contrast "Principal & interest", 1.1:1, needs 4.5:1 | Fix: Darken the text or lighten the background

Frustration and abandonment risk 1.2/5: 9 major, 109 minor.
- major | open app: slow, 25.9 s to settle | Fix: Show content first and defer the slow work
- major | expand product facts: tap-target "30 days", 73x17 dp, minimum 48 | Fix: Pad the control to 48 dp or add hitSlop
- major | start category switch: slow, 14.1 s to settle | Fix: Show content first and defer the slow work
- major | restart with a saved rate: slow, 19.3 s to settle | Fix: Show content first and defer the slow work
- major | /settings: tap-target "Changelog 1.0.398", 328x24 dp, minimum 48 | Fix: Pad the control to 48 dp or add hitSlop
- major | cold start: slow-first-value, 23.6 s from launch to rates showing | Fix: Show cached rates on launch before the refresh

| dimension | score | findings |
| --- | --- | --- |
| Design consistency | 4.2/5 | 19 |
| Layout | 5/5 | 0 |
| Ease of use | 4.4/5 | 9 |
| Comfort | 4.1/5 | 12 |
| Helpfulness | 5/5 | 0 |
| Appropriateness | 3.6/5 | 53 |
| Onboarding ease | 4.9/5 | 1 |
| Barriers to entry and use | 4.9/5 | 2 |
| Engagement hooks | 5/5 | 0 |
| Frustration and abandonment risk | 1.2/5 | 118 |

## Task cost

| task | taps from first screen | seconds |
| --- | --- | --- |
| Find the best rate | 0 | 23.6 s |
| Compare | unknown | 2.0 s |
| Open a lender | unknown | unknown |
| Open a product | 1 | 3.7 s |
| Save a rate | unknown | unknown |

## Top findings per dimension

**Design consistency**
- major cold start: contrast "Updating" (1.1:1, needs 4.5:1). Fix: Darken the text or lighten the background
- major cold start: contrast "Principal & interest" (1.1:1, needs 4.5:1). Fix: Darken the text or lighten the background
- major cold relaunch: contrast "Updating" (1.1:1, needs 4.5:1). Fix: Darken the text or lighten the background

**Ease of use**
- major expand product facts: tap-target "30 days" (73x17 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- major expand product facts: tap-target "90 days" (73x17 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- major expand product facts: tap-target "1 year" (62x17 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop

**Comfort**
- major open app: slow (25.9 s to settle). Fix: Show content first and defer the slow work
- major expand product facts: tap-target "30 days" (73x17 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- major expand product facts: tap-target "90 days" (73x17 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop

**Appropriateness**
- minor open app: accuracy "CLASSIC HOME LOAN VARIABLE 60-80 LVR PI, Cairns bank" (comparison 6% is below advertised 6.54%). Fix: Fix the displayed figure or its sort
- minor open app: accuracy "Owner Occupier P&I No Offset Mortgage, MoveBank" (comparison 6.19% is below advertised 6.49%). Fix: Fix the displayed figure or its sort
- minor scroll rates 1: accuracy "PLUS HOME LOAN FIXED 3YR 60-80 LVR PI, Cairns bank" (comparison 6.25% is below advertised 6.64%). Fix: Fix the displayed figure or its sort

**Onboarding ease**
- major cold start: slow-first-value (23.6 s from launch to rates showing). Fix: Show cached rates on launch before the refresh

**Barriers to entry and use**
- major cold start: slow-first-value (23.6 s from launch to rates showing). Fix: Show cached rates on launch before the refresh
- minor cold start: slow-relaunch (8.9 s from relaunch to rates showing). Fix: Draw the cached rates first, then refresh in the background

**Frustration and abandonment risk**
- major open app: slow (25.9 s to settle). Fix: Show content first and defer the slow work
- major expand product facts: tap-target "30 days" (73x17 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- major expand product facts: tap-target "90 days" (73x17 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop

## Screens

| screen | elements | tappable | findings | major |
| --- | --- | --- | --- | --- |
| open app | 52 | 31 | 5 | 1 |
| scroll rates 1 | 51 | 33 | 8 | 0 |
| scroll rates 2 | 57 | 27 | 3 | 0 |
| scroll rates back | 57 | 27 | 3 | 0 |
| open product | 26 | 11 | 1 | 0 |
| scroll product | 24 | 8 | 1 | 0 |
| expand visible fees | 24 | 8 | 1 | 0 |
| expand product facts | 34 | 13 | 11 | 4 |
| scroll product fees | 25 | 9 | 1 | 0 |
| scroll product eligibility | 20 | 11 | 1 | 0 |
| expand eligibility | 20 | 11 | 1 | 0 |
| expand constraints | 28 | 10 | 2 | 0 |
| scroll product sources | 23 | 10 | 1 | 0 |
| back to rates | 57 | 27 | 3 | 0 |
| open lenders | 35 | 18 | 3 | 0 |
| scroll lenders | 35 | 18 | 3 | 0 |
| back from lenders | 57 | 27 | 3 | 0 |
| switch to savings | 49 | 31 | 0 | 0 |
| switch to home loans | 57 | 30 | 3 | 0 |
| open filters | 45 | 20 | 2 | 0 |
| close filters | 57 | 30 | 3 | 0 |
| open market | 42 | 13 | 0 | 0 |
| open rba | 24 | 7 | 0 | 0 |
| scroll rba | 25 | 10 | 0 | 0 |
| back from rba | 42 | 13 | 0 | 0 |
| scroll market | 32 | 10 | 1 | 0 |
| open saved | 19 | 9 | 0 | 0 |
| return to rates | 60 | 30 | 5 | 0 |
| start category switch | 51 | 30 | 6 | 1 |
| open term deposits | 49 | 30 | 0 | 0 |
| verify term deposit rates | 49 | 30 | 1 | 0 |
| restore home loans | 51 | 30 | 5 | 0 |
| start search from rates | 51 | 30 | 5 | 0 |
| open savings search | 49 | 30 | 0 | 0 |
| search Macquarie | 50 | 31 | 0 | 0 |
| verify Macquarie result | 50 | 31 | 0 | 0 |
| clear query and restore results | 49 | 30 | 0 | 0 |
| return from savings search | 51 | 30 | 5 | 0 |
| start filter rollback | 51 | 30 | 5 | 0 |
| open mortgage filter draft | 38 | 17 | 0 | 0 |
| select fixed in draft | 38 | 17 | 1 | 0 |
| discard unsaved filter draft | 51 | 30 | 5 | 0 |
| verify fixed was not applied | 38 | 17 | 0 | 0 |
| close verified filter draft | 51 | 30 | 5 | 0 |
| start save from rates | 51 | 30 | 5 | 0 |
| open unsaved rate | 28 | 12 | 1 | 0 |
| save a rate | 28 | 12 | 1 | 0 |
| leave saved product | 51 | 30 | 5 | 0 |
| restart with a saved rate | 52 | 30 | 4 | 1 |
| verify saved rate after restart | 30 | 14 | 2 | 0 |
| open product from saved rates | 28 | 12 | 1 | 0 |
| remove saved rate | 28 | 12 | 1 | 0 |
| leave removed product | 23 | 11 | 0 | 0 |
| follow browse rates recovery | 52 | 30 | 3 | 0 |
| start compare from rates | 52 | 30 | 3 | 0 |
| enter selection mode | 44 | 22 | 4 | 0 |
| select first comparison rate | 44 | 22 | 4 | 0 |
| select second comparison rate | 44 | 22 | 4 | 0 |
| open two-rate comparison | 21 | 4 | 1 | 0 |
| return from two-rate comparison | 44 | 22 | 4 | 0 |
| cold start | 52 | 30 | 5 | 2 |
| /browse | 52 | 30 | 3 | 0 |
| /watchlist | 23 | 11 | 0 | 0 |
| /market | 23 | 11 | 0 | 0 |
| /tools | 43 | 21 | 3 | 0 |
| /trends | 37 | 16 | 1 | 0 |
| /search | 52 | 30 | 3 | 0 |
| /banks | 52 | 30 | 3 | 0 |
| /bank-rates | 48 | 23 | 4 | 0 |
| /categories | 52 | 30 | 3 | 0 |
| /catalogue | 46 | 17 | 1 | 0 |
| /compare | 10 | 5 | 0 | 0 |
| /matches | 46 | 17 | 1 | 0 |
| /calculator | 43 | 21 | 3 | 0 |
| /projections | 39 | 18 | 3 | 0 |
| /profile | 30 | 13 | 0 | 0 |
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
| cold relaunch | 52 | 30 | 5 | 2 |
| about | 25 | 11 | 0 | 0 |
| audit screen | 27 | 11 | 0 | 0 |
| about for debug log | 24 | 10 | 0 | 0 |
| debug log screen | 31 | 12 | 0 | 0 |
| debug log uploaded | 31 | 12 | 0 | 0 |
