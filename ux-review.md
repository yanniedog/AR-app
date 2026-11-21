# UX review

UX review: 4 major, 75 minor across 30 screens. Weakest: Frustration and abandonment risk 0.3/5, Design consistency 3.1/5, Appropriateness 4/5.
First value 10.3 s, 0 gate taps. Taps: find the best rate 0, compare unknown, open a lender unknown, open a product unknown, save a rate unknown.
- major | /market: contrast "No saved rates", 1.1:1, needs 3:1 | Fix: Darken the text or lighten the background
- major | /market: contrast "Browse rates", 1.1:1, needs 4.5:1 | Fix: Darken the text or lighten the background
- major | /market: contrast "Add my rate", 1.1:1, needs 4.5:1 | Fix: Darken the text or lighten the background

Frustration and abandonment risk 0.3/5: 1 major, 52 minor.
- major | cold start: slow-first-value, 10.3 s from launch to rates showing | Fix: Show cached rates on launch before the refresh
- minor | cold start: jargon "Cairns · CLASSIC HOME LOAN VARIABLE 60-80 LVR PI", unexpanded LVR | Fix: Replace the abbreviation with a plain label
- minor | cold start: crowded-targets "View Police Credit Union Ltd · History · Freshness", 7 dp apart | Fix: Add at least 8 dp between adjacent controls
- minor | /browse: jargon "Cairns · CLASSIC HOME LOAN VARIABLE 60-80 LVR PI", unexpanded LVR | Fix: Replace the abbreviation with a plain label
- minor | /browse: crowded-targets "View Police Credit Union Ltd · History · Freshness", 7 dp apart | Fix: Add at least 8 dp between adjacent controls
- minor | /tools: tap-target "EditText", 328x44 dp, minimum 48 | Fix: Pad the control to 48 dp or add hitSlop

| dimension | score | findings |
| --- | --- | --- |
| Design consistency | 3.1/5 | 14 |
| Layout | 5/5 | 0 |
| Ease of use | 4.6/5 | 5 |
| Comfort | 4.6/5 | 5 |
| Helpfulness | 5/5 | 0 |
| Appropriateness | 4/5 | 12 |
| Onboarding ease | 4.7/5 | 1 |
| Barriers to entry and use | 4.7/5 | 1 |
| Engagement hooks | 4.9/5 | 1 |
| Frustration and abandonment risk | 0.3/5 | 53 |

## Task cost

| task | taps from first screen | seconds |
| --- | --- | --- |
| Find the best rate | 0 | 10.3 s |
| Compare | unknown | unknown |
| Open a lender | unknown | unknown |
| Open a product | unknown | unknown |
| Save a rate | unknown | unknown |

## Top findings per dimension

**Design consistency**
- major /market: contrast "No saved rates" (1.1:1, needs 3:1). Fix: Darken the text or lighten the background
- major /market: contrast "Browse rates" (1.1:1, needs 4.5:1). Fix: Darken the text or lighten the background
- major /market: contrast "Add my rate" (1.1:1, needs 4.5:1). Fix: Darken the text or lighten the background

**Ease of use**
- minor /tools: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- minor /tools: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- minor /calculator: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop

**Comfort**
- minor /tools: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- minor /tools: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- minor /calculator: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop

**Appropriateness**
- minor cold start: accuracy "CLASSIC HOME LOAN VARIABLE 60-80 LVR PI, Cairns bank" (comparison 6% is below advertised 6.54%). Fix: Fix the displayed figure or its sort
- minor cold start: accuracy "Everyday Home Loan, MoveBank" (comparison 6.19% is below advertised 6.49%). Fix: Fix the displayed figure or its sort
- minor /browse: accuracy "CLASSIC HOME LOAN VARIABLE 60-80 LVR PI, Cairns bank" (comparison 6% is below advertised 6.54%). Fix: Fix the displayed figure or its sort

**Onboarding ease**
- major cold start: slow-first-value (10.3 s from launch to rates showing). Fix: Show cached rates on launch before the refresh

**Barriers to entry and use**
- major cold start: slow-first-value (10.3 s from launch to rates showing). Fix: Show cached rates on launch before the refresh

**Engagement hooks**
- minor all: no-return-reason (no change or recency signal and no alerts). Fix: Show what changed since the last visit

**Frustration and abandonment risk**
- major cold start: slow-first-value (10.3 s from launch to rates showing). Fix: Show cached rates on launch before the refresh
- minor cold start: jargon "Cairns · CLASSIC HOME LOAN VARIABLE 60-80 LVR PI" (unexpanded LVR). Fix: Replace the abbreviation with a plain label
- minor cold start: crowded-targets "View Police Credit Union Ltd · History · Freshness · Unknown / View MoveBank · History · Freshness · Unknown" (7 dp apart). Fix: Add at least 8 dp between adjacent controls

## Screens

| screen | elements | tappable | findings | major |
| --- | --- | --- | --- | --- |
| cold start | 52 | 31 | 7 | 0 |
| /browse | 52 | 31 | 8 | 0 |
| /watchlist | 19 | 9 | 0 | 0 |
| /market | 19 | 9 | 3 | 3 |
| /tools | 41 | 20 | 5 | 0 |
| /trends | 33 | 14 | 1 | 0 |
| /search | 52 | 31 | 7 | 0 |
| /banks | 52 | 31 | 7 | 0 |
| /bank-rates | 45 | 21 | 4 | 0 |
| /categories | 52 | 31 | 7 | 0 |
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
| cold relaunch | 52 | 31 | 7 | 0 |
