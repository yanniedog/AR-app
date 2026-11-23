# UX review

UX review: 2 major, 105 minor across 55 screens. Weakest: Frustration and abandonment risk 2.4/5, Appropriateness 2.9/5, Design consistency 4.5/5.
First value 25.0 s, relaunch 8.7 s, 0 gate taps. Taps: find the best rate 0, compare unknown, open a lender unknown, open a product 1, save a rate unknown.

Frustration and abandonment risk 2.4/5: 2 major, 49 minor.
- major | open app: slow, 27.4 s to settle | Fix: Show content first and defer the slow work
- major | cold start: slow-first-value, 25.0 s from launch to rates showing | Fix: Show cached rates on launch before the refresh
- minor | open app: jargon "Cairns · CLASSIC HOME LOAN VARIABLE 60-80 LVR PI", unexpanded LVR | Fix: Replace the abbreviation with a plain label
- minor | scroll rates 1: jargon "Cairns · PLUS HOME LOAN FIXED 3YR 60-80 LVR PI", unexpanded LVR | Fix: Replace the abbreviation with a plain label
- minor | scroll rates 1: crowded-targets "View MoveBank · History · Freshness · Unknown / Ev", 4 dp apart | Fix: Add at least 8 dp between adjacent controls
- minor | scroll rates 2: jargon "BFirst · Basic Home Loan Variable LVR 70-80%", unexpanded LVR | Fix: Replace the abbreviation with a plain label

| dimension | score | findings |
| --- | --- | --- |
| Design consistency | 4.5/5 | 10 |
| Layout | 5/5 | 0 |
| Ease of use | 4.8/5 | 5 |
| Comfort | 4.5/5 | 7 |
| Helpfulness | 5/5 | 0 |
| Appropriateness | 2.9/5 | 46 |
| Onboarding ease | 4.8/5 | 1 |
| Barriers to entry and use | 4.8/5 | 2 |
| Engagement hooks | 5/5 | 1 |
| Frustration and abandonment risk | 2.4/5 | 51 |

## Task cost

| task | taps from first screen | seconds |
| --- | --- | --- |
| Find the best rate | 0 | 25.0 s |
| Compare | unknown | unknown |
| Open a lender | unknown | unknown |
| Open a product | 1 | 3.1 s |
| Save a rate | unknown | unknown |

## Top findings per dimension

**Design consistency**
- minor /tools: contrast "Refinancing" (4.5:1, needs 4.5:1). Fix: Darken the text or lighten the background
- minor /trends: contrast "30 days" (4.5:1, needs 4.5:1). Fix: Darken the text or lighten the background
- minor /bank-rates: contrast "All banks" (4.5:1, needs 4.5:1). Fix: Darken the text or lighten the background

**Ease of use**
- minor /tools: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- minor /tools: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- minor /calculator: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop

**Comfort**
- major open app: slow (27.4 s to settle). Fix: Show content first and defer the slow work
- minor open product: slow (6.2 s to settle). Fix: Show content first and defer the slow work
- minor /tools: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop

**Appropriateness**
- minor open app: accuracy "CLASSIC HOME LOAN VARIABLE 60-80 LVR PI, Cairns bank" (comparison 6% is below advertised 6.54%). Fix: Fix the displayed figure or its sort
- minor open app: accuracy "Everyday Home Loan, MoveBank" (comparison 6.19% is below advertised 6.49%). Fix: Fix the displayed figure or its sort
- minor scroll rates 1: accuracy "CLASSIC HOME LOAN VARIABLE 60-80 LVR PI, Cairns bank" (comparison 6% is below advertised 6.54%). Fix: Fix the displayed figure or its sort

**Onboarding ease**
- major cold start: slow-first-value (25.0 s from launch to rates showing). Fix: Show cached rates on launch before the refresh

**Barriers to entry and use**
- major cold start: slow-first-value (25.0 s from launch to rates showing). Fix: Show cached rates on launch before the refresh
- minor cold start: slow-relaunch (8.7 s from relaunch to rates showing). Fix: Draw the cached rates first, then refresh in the background

**Engagement hooks**
- minor all: no-return-reason (no change or recency signal and no alerts). Fix: Show what changed since the last visit

**Frustration and abandonment risk**
- major open app: slow (27.4 s to settle). Fix: Show content first and defer the slow work
- major cold start: slow-first-value (25.0 s from launch to rates showing). Fix: Show cached rates on launch before the refresh
- minor open app: jargon "Cairns · CLASSIC HOME LOAN VARIABLE 60-80 LVR PI" (unexpanded LVR). Fix: Replace the abbreviation with a plain label

## Screens

| screen | elements | tappable | findings | major |
| --- | --- | --- | --- | --- |
| open app | 52 | 31 | 4 | 1 |
| scroll rates 1 | 51 | 33 | 10 | 0 |
| scroll rates 2 | 48 | 30 | 7 | 0 |
| scroll rates back | 48 | 30 | 7 | 0 |
| open product | 31 | 10 | 1 | 0 |
| scroll product | 22 | 8 | 0 | 0 |
| back to rates | 48 | 30 | 7 | 0 |
| open lenders | 41 | 21 | 0 | 0 |
| scroll lenders | 35 | 18 | 0 | 0 |
| back from lenders | 48 | 30 | 7 | 0 |
| switch to savings | 49 | 31 | 0 | 0 |
| switch to home loans | 48 | 30 | 6 | 0 |
| open filters | 42 | 20 | 1 | 0 |
| close filters | 48 | 30 | 6 | 0 |
| open market | 42 | 13 | 0 | 0 |
| open rba | 24 | 7 | 0 | 0 |
| scroll rba | 25 | 10 | 0 | 0 |
| back from rba | 42 | 13 | 0 | 0 |
| scroll market | 32 | 10 | 1 | 0 |
| open saved | 19 | 9 | 0 | 0 |
| return to rates | 48 | 30 | 6 | 0 |
| cold start | 52 | 31 | 3 | 0 |
| /browse | 52 | 31 | 3 | 0 |
| /watchlist | 19 | 9 | 0 | 0 |
| /market | 42 | 13 | 0 | 0 |
| /tools | 41 | 20 | 5 | 0 |
| /trends | 33 | 14 | 1 | 0 |
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
