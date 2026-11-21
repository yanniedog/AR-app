# UX review

UX review: 5 major, 75 minor across 30 screens. Weakest: Frustration and abandonment risk 0/5, Design consistency 3.5/5, Barriers to entry and use 3.9/5.
First value 8.5 s, 0 gate taps. Taps: find the best rate 0, compare unknown, open a lender unknown, open a product unknown, save a rate unknown.
- major | /market: contrast "No saved rates", 1.1:1, needs 3:1 | Fix: Darken the text or lighten the background
- major | /market: contrast "Add my rate", 1.1:1, needs 4.5:1 | Fix: Darken the text or lighten the background

Frustration and abandonment risk 0/5: 3 major, 53 minor.
- major | /catalogue: dead-end-state "No listed rate", empty or error state with no action | Fix: Give the empty or error state a retry or back action
- major | /matches: dead-end-state "No listed rate", empty or error state with no action | Fix: Give the empty or error state a retry or back action
- major | /node: dead-end-state "No listed rate", empty or error state with no action | Fix: Give the empty or error state a retry or back action
- minor | cold start: jargon "Cairns · CLASSIC HOME LOAN VARIABLE 60-80 LVR PI", unexpanded LVR | Fix: Replace the abbreviation with a plain label
- minor | cold start: crowded-targets "View Police Credit Union Ltd · History · Freshness", 7 dp apart | Fix: Add at least 8 dp between adjacent controls
- minor | /browse: jargon "Cairns · CLASSIC HOME LOAN VARIABLE 60-80 LVR PI", unexpanded LVR | Fix: Replace the abbreviation with a plain label

| dimension | score | findings |
| --- | --- | --- |
| Design consistency | 3.5/5 | 12 |
| Layout | 5/5 | 0 |
| Ease of use | 4.6/5 | 5 |
| Comfort | 4.6/5 | 5 |
| Helpfulness | 4/5 | 3 |
| Appropriateness | 4/5 | 12 |
| Onboarding ease | 4.9/5 | 1 |
| Barriers to entry and use | 3.9/5 | 4 |
| Engagement hooks | 4.9/5 | 1 |
| Frustration and abandonment risk | 0/5 | 56 |

## Task cost

| task | taps from first screen | seconds |
| --- | --- | --- |
| Find the best rate | 0 | 8.5 s |
| Compare | unknown | unknown |
| Open a lender | unknown | unknown |
| Open a product | unknown | unknown |
| Save a rate | unknown | unknown |

## Top findings per dimension

**Design consistency**
- major /market: contrast "No saved rates" (1.1:1, needs 3:1). Fix: Darken the text or lighten the background
- major /market: contrast "Add my rate" (1.1:1, needs 4.5:1). Fix: Darken the text or lighten the background
- minor /tools: contrast "Refinancing" (4.5:1, needs 4.5:1). Fix: Darken the text or lighten the background

**Ease of use**
- minor /tools: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- minor /tools: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- minor /calculator: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop

**Comfort**
- minor /tools: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- minor /tools: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- minor /calculator: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop

**Helpfulness**
- major /catalogue: dead-end-state "No listed rate" (empty or error state with no action). Fix: Give the empty or error state a retry or back action
- major /matches: dead-end-state "No listed rate" (empty or error state with no action). Fix: Give the empty or error state a retry or back action
- major /node: dead-end-state "No listed rate" (empty or error state with no action). Fix: Give the empty or error state a retry or back action

**Appropriateness**
- minor cold start: accuracy "CLASSIC HOME LOAN VARIABLE 60-80 LVR PI, Cairns bank" (comparison 6% is below advertised 6.54%). Fix: Fix the displayed figure or its sort
- minor cold start: accuracy "Everyday Home Loan, MoveBank" (comparison 6.19% is below advertised 6.49%). Fix: Fix the displayed figure or its sort
- minor /browse: accuracy "CLASSIC HOME LOAN VARIABLE 60-80 LVR PI, Cairns bank" (comparison 6% is below advertised 6.54%). Fix: Fix the displayed figure or its sort

**Onboarding ease**
- minor cold start: slow-first-value (8.5 s from launch to rates showing). Fix: Show cached rates on launch before the refresh

**Barriers to entry and use**
- major /catalogue: dead-end-state "No listed rate" (empty or error state with no action). Fix: Give the empty or error state a retry or back action
- major /matches: dead-end-state "No listed rate" (empty or error state with no action). Fix: Give the empty or error state a retry or back action
- major /node: dead-end-state "No listed rate" (empty or error state with no action). Fix: Give the empty or error state a retry or back action

**Engagement hooks**
- minor all: no-return-reason (no change or recency signal and no alerts). Fix: Show what changed since the last visit

**Frustration and abandonment risk**
- major /catalogue: dead-end-state "No listed rate" (empty or error state with no action). Fix: Give the empty or error state a retry or back action
- major /matches: dead-end-state "No listed rate" (empty or error state with no action). Fix: Give the empty or error state a retry or back action
- major /node: dead-end-state "No listed rate" (empty or error state with no action). Fix: Give the empty or error state a retry or back action

## Screens

| screen | elements | tappable | findings | major |
| --- | --- | --- | --- | --- |
| cold start | 52 | 31 | 7 | 0 |
| /browse | 52 | 31 | 7 | 0 |
| /watchlist | 19 | 9 | 0 | 0 |
| /market | 19 | 9 | 2 | 2 |
| /tools | 41 | 20 | 5 | 0 |
| /trends | 33 | 14 | 1 | 0 |
| /search | 52 | 31 | 7 | 0 |
| /banks | 52 | 31 | 7 | 0 |
| /bank-rates | 45 | 21 | 4 | 0 |
| /categories | 52 | 31 | 7 | 0 |
| /catalogue | 48 | 17 | 4 | 1 |
| /compare | 6 | 3 | 0 | 0 |
| /matches | 48 | 17 | 4 | 1 |
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
| /node | 48 | 17 | 4 | 1 |
| /passthrough | 42 | 13 | 0 | 0 |
| /calculation-receipt | 19 | 8 | 0 | 0 |
| /rate-receipt | 10 | 5 | 0 | 0 |
| warm resume | 10 | 5 | 0 | 0 |
| cold relaunch | 52 | 31 | 7 | 0 |
