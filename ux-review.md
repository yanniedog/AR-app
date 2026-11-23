# UX review

UX review: 2 major, 128 minor across 55 screens. Weakest: Frustration and abandonment risk 0.8/5, Appropriateness 3.5/5, Design consistency 4.5/5.
First value 42.6 s, relaunch 10.2 s, 0 gate taps. Taps: find the best rate 0, compare unknown, open a lender unknown, open a product 1, save a rate unknown.

Frustration and abandonment risk 0.8/5: 2 major, 84 minor.
- major | cold start: slow-first-value, 42.6 s from launch to rates showing | Fix: Show cached rates on launch before the refresh
- major | cold start: slow-relaunch, 10.2 s from relaunch to rates showing | Fix: Draw the cached rates first, then refresh in the background
- minor | open app: jargon "Cairns · CLASSIC HOME LOAN VARIABLE 60-80 LVR PI", unexpanded LVR | Fix: Replace the abbreviation with a plain label
- minor | open app: crowded-targets "View MoveBank · History · Freshness · Unknown / Ev", 4 dp apart | Fix: Add at least 8 dp between adjacent controls
- minor | scroll rates 1: jargon "Save, PLUS HOME LOAN FIXED 2YR 60-80 LVR PI, Cairn", unexpanded LVR | Fix: Replace the abbreviation with a plain label
- minor | scroll rates 1: crowded-targets "View Cairns bank · History · Freshness · Unknown /", 4 dp apart | Fix: Add at least 8 dp between adjacent controls

| dimension | score | findings |
| --- | --- | --- |
| Design consistency | 4.5/5 | 12 |
| Layout | 5/5 | 0 |
| Ease of use | 4.7/5 | 7 |
| Comfort | 4.6/5 | 8 |
| Helpfulness | 5/5 | 0 |
| Appropriateness | 3.5/5 | 32 |
| Onboarding ease | 4.8/5 | 1 |
| Barriers to entry and use | 4.6/5 | 2 |
| Engagement hooks | 5/5 | 1 |
| Frustration and abandonment risk | 0.8/5 | 86 |

## Task cost

| task | taps from first screen | seconds |
| --- | --- | --- |
| Find the best rate | 0 | 42.6 s |
| Compare | unknown | unknown |
| Open a lender | unknown | unknown |
| Open a product | 1 | 2.8 s |
| Save a rate | unknown | unknown |

## Top findings per dimension

**Design consistency**
- minor open app: contrast "Updating" (4.2:1, needs 4.5:1). Fix: Darken the text or lighten the background
- minor /browse: contrast "Updating" (4.2:1, needs 4.5:1). Fix: Darken the text or lighten the background
- minor /tools: contrast "Refinancing" (4.5:1, needs 4.5:1). Fix: Darken the text or lighten the background

**Ease of use**
- minor /tools: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- minor /tools: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- minor /trends: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop

**Comfort**
- minor open product: slow (5.7 s to settle). Fix: Show content first and defer the slow work
- minor /tools: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- minor /tools: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop

**Appropriateness**
- minor open app: accuracy "CLASSIC HOME LOAN VARIABLE 60-80 LVR PI, Cairns bank" (comparison 6% is below advertised 6.54%). Fix: Fix the displayed figure or its sort
- minor open app: accuracy "Everyday Home Loan, MoveBank" (comparison 6.19% is below advertised 6.49%). Fix: Fix the displayed figure or its sort
- minor scroll rates 1: accuracy "Everyday Home Loan, MoveBank" (comparison 6.25% is below advertised 6.44%). Fix: Fix the displayed figure or its sort

**Onboarding ease**
- major cold start: slow-first-value (42.6 s from launch to rates showing). Fix: Show cached rates on launch before the refresh

**Barriers to entry and use**
- major cold start: slow-first-value (42.6 s from launch to rates showing). Fix: Show cached rates on launch before the refresh
- major cold start: slow-relaunch (10.2 s from relaunch to rates showing). Fix: Draw the cached rates first, then refresh in the background

**Engagement hooks**
- minor all: no-return-reason (no change or recency signal and no alerts). Fix: Show what changed since the last visit

**Frustration and abandonment risk**
- major cold start: slow-first-value (42.6 s from launch to rates showing). Fix: Show cached rates on launch before the refresh
- major cold start: slow-relaunch (10.2 s from relaunch to rates showing). Fix: Draw the cached rates first, then refresh in the background
- minor open app: jargon "Cairns · CLASSIC HOME LOAN VARIABLE 60-80 LVR PI" (unexpanded LVR). Fix: Replace the abbreviation with a plain label

## Screens

| screen | elements | tappable | findings | major |
| --- | --- | --- | --- | --- |
| open app | 52 | 31 | 7 | 0 |
| scroll rates 1 | 48 | 31 | 7 | 0 |
| scroll rates 2 | 57 | 27 | 3 | 0 |
| scroll rates back | 57 | 27 | 3 | 0 |
| open product | 27 | 10 | 2 | 0 |
| scroll product | 26 | 8 | 3 | 0 |
| back to rates | 57 | 27 | 3 | 0 |
| open lenders | 41 | 21 | 0 | 0 |
| scroll lenders | 39 | 21 | 0 | 0 |
| back from lenders | 57 | 27 | 3 | 0 |
| switch to savings | 49 | 31 | 3 | 0 |
| switch to home loans | 57 | 30 | 5 | 0 |
| open filters | 42 | 20 | 1 | 0 |
| close filters | 57 | 30 | 5 | 0 |
| open market | 42 | 13 | 0 | 0 |
| open rba | 25 | 7 | 0 | 0 |
| scroll rba | 19 | 8 | 0 | 0 |
| back from rba | 42 | 13 | 0 | 0 |
| scroll market | 32 | 10 | 1 | 0 |
| open saved | 19 | 9 | 0 | 0 |
| return to rates | 60 | 30 | 7 | 0 |
| cold start | 52 | 31 | 6 | 0 |
| /browse | 52 | 31 | 7 | 0 |
| /watchlist | 19 | 9 | 0 | 0 |
| /market | 42 | 13 | 0 | 0 |
| /tools | 41 | 20 | 5 | 0 |
| /trends | 41 | 20 | 5 | 0 |
| /search | 52 | 31 | 6 | 0 |
| /banks | 52 | 31 | 6 | 0 |
| /bank-rates | 45 | 21 | 4 | 0 |
| /categories | 52 | 31 | 6 | 0 |
| /catalogue | 48 | 17 | 3 | 0 |
| /compare | 6 | 3 | 0 | 0 |
| /matches | 48 | 17 | 3 | 0 |
| /calculator | 41 | 20 | 5 | 0 |
| /projections | 33 | 15 | 1 | 0 |
| /profile | 49 | 21 | 1 | 0 |
| /research | 33 | 14 | 1 | 0 |
| /rba | 25 | 7 | 0 | 0 |
| /rba-response | 47 | 15 | 4 | 0 |
| /settings | 26 | 8 | 0 | 0 |
| /about | 22 | 9 | 0 | 0 |
| /terms | 15 | 5 | 0 | 0 |
| /privacy | 15 | 5 | 0 | 0 |
| /third-party-notices | 16 | 5 | 0 | 0 |
| /node | 48 | 17 | 3 | 0 |
| /passthrough | 42 | 13 | 0 | 0 |
| /calculation-receipt | 19 | 8 | 0 | 0 |
| /rate-receipt | 10 | 5 | 0 | 0 |
| warm resume | 10 | 5 | 0 | 0 |
| cold relaunch | 52 | 31 | 6 | 0 |
| about | 22 | 9 | 0 | 0 |
| audit screen | 25 | 10 | 1 | 0 |
| about for debug log | 22 | 9 | 1 | 0 |
| debug log screen | 24 | 6 | 0 | 0 |
