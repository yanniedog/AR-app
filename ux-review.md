# UX review

UX review: 29 major, 162 minor across 59 screens. Weakest: Frustration and abandonment risk 0/5, Comfort 0.6/5, Ease of use 0.8/5.
First value 35.3 s, 0 gate taps. Taps: find the best rate 0, compare unknown, open a lender unknown, open a product 1, save a rate unknown.

Frustration and abandonment risk 0/5: 29 major, 110 minor.
- major | /tools: tap-target "Go back", 30x30 dp, minimum 48 | Fix: Pad the control to 48 dp or add hitSlop
- major | /trends: tap-target "Go back", 30x30 dp, minimum 48 | Fix: Pad the control to 48 dp or add hitSlop
- major | /bank-rates: tap-target "Go back", 30x30 dp, minimum 48 | Fix: Pad the control to 48 dp or add hitSlop
- major | /catalogue: dead-end-state "No listed rate", empty or error state with no action | Fix: Give the empty or error state a retry or back action
- major | /compare: tap-target "Go back", 30x30 dp, minimum 48 | Fix: Pad the control to 48 dp or add hitSlop
- major | /matches: dead-end-state "No listed rate", empty or error state with no action | Fix: Give the empty or error state a retry or back action

| dimension | score | findings |
| --- | --- | --- |
| Design consistency | 4.6/5 | 10 |
| Layout | 5/5 | 0 |
| Ease of use | 0.8/5 | 27 |
| Comfort | 0.6/5 | 29 |
| Helpfulness | 4.5/5 | 3 |
| Appropriateness | 3.2/5 | 42 |
| Onboarding ease | 4.8/5 | 1 |
| Barriers to entry and use | 4.3/5 | 4 |
| Engagement hooks | 5/5 | 1 |
| Frustration and abandonment risk | 0/5 | 139 |

## Task cost

| task | taps from first screen | seconds |
| --- | --- | --- |
| Find the best rate | 0 | 35.3 s |
| Compare | unknown | 2.6 s |
| Open a lender | unknown | unknown |
| Open a product | 1 | 2.8 s |
| Save a rate | unknown | unknown |

## Top findings per dimension

**Design consistency**
- minor /tools: contrast "Refinancing" (4.5:1, needs 4.5:1). Fix: Darken the text or lighten the background
- minor /trends: contrast "30 days" (4.5:1, needs 4.5:1). Fix: Darken the text or lighten the background
- minor /bank-rates: contrast "All banks" (4.5:1, needs 4.5:1). Fix: Darken the text or lighten the background

**Ease of use**
- major /tools: tap-target "Go back" (30x30 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- major /trends: tap-target "Go back" (30x30 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- major /bank-rates: tap-target "Go back" (30x30 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop

**Comfort**
- major /tools: tap-target "Go back" (30x30 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- major /trends: tap-target "Go back" (30x30 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- major /bank-rates: tap-target "Go back" (30x30 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop

**Helpfulness**
- major /catalogue: dead-end-state "No listed rate" (empty or error state with no action). Fix: Give the empty or error state a retry or back action
- major /matches: dead-end-state "No listed rate" (empty or error state with no action). Fix: Give the empty or error state a retry or back action
- major /node: dead-end-state "No listed rate" (empty or error state with no action). Fix: Give the empty or error state a retry or back action

**Appropriateness**
- minor open app: accuracy "CLASSIC HOME LOAN VARIABLE 60-80 LVR PI, Cairns bank" (comparison 6% is below advertised 6.54%). Fix: Fix the displayed figure or its sort
- minor open app: accuracy "Everyday Home Loan, MoveBank" (comparison 6.19% is below advertised 6.49%). Fix: Fix the displayed figure or its sort
- minor scroll rates 1: accuracy "PLUS HOME LOAN FIXED 3YR 60-80 LVR PI, Cairns bank" (comparison 6.25% is below advertised 6.64%). Fix: Fix the displayed figure or its sort

**Onboarding ease**
- major cold start: slow-first-value (35.3 s from launch to rates showing). Fix: Show cached rates on launch before the refresh

**Barriers to entry and use**
- major /catalogue: dead-end-state "No listed rate" (empty or error state with no action). Fix: Give the empty or error state a retry or back action
- major /matches: dead-end-state "No listed rate" (empty or error state with no action). Fix: Give the empty or error state a retry or back action
- major /node: dead-end-state "No listed rate" (empty or error state with no action). Fix: Give the empty or error state a retry or back action

**Engagement hooks**
- minor all: no-return-reason (no change or recency signal and no alerts). Fix: Show what changed since the last visit

**Frustration and abandonment risk**
- major /tools: tap-target "Go back" (30x30 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- major /trends: tap-target "Go back" (30x30 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- major /bank-rates: tap-target "Go back" (30x30 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop

## Screens

| screen | elements | tappable | findings | major |
| --- | --- | --- | --- | --- |
| open app | 52 | 31 | 7 | 0 |
| scroll rates 1 | 51 | 33 | 10 | 0 |
| scroll rates 2 | 48 | 30 | 9 | 0 |
| scroll rates back | 48 | 30 | 9 | 0 |
| open product | 31 | 10 | 1 | 0 |
| scroll product | 23 | 8 | 0 | 0 |
| back to rates | 48 | 30 | 9 | 0 |
| open lenders | 41 | 21 | 0 | 0 |
| scroll lenders | 38 | 20 | 1 | 0 |
| back from lenders | 48 | 30 | 9 | 0 |
| switch to savings | 49 | 31 | 4 | 0 |
| switch to home loans | 49 | 31 | 7 | 0 |
| open filters | 42 | 20 | 1 | 0 |
| close filters | 49 | 31 | 7 | 0 |
| open market | 42 | 13 | 0 | 0 |
| open rba | 25 | 7 | 0 | 0 |
| scroll rba | 21 | 10 | 1 | 0 |
| back from rba | 42 | 13 | 0 | 0 |
| scroll market | 32 | 10 | 1 | 0 |
| open saved | 19 | 9 | 0 | 0 |
| return to rates | 49 | 31 | 7 | 0 |
| cold start | 52 | 30 | 6 | 0 |
| /browse | 52 | 30 | 6 | 0 |
| /watchlist | 23 | 11 | 0 | 0 |
| /market | 41 | 15 | 2 | 0 |
| /tools | 43 | 21 | 6 | 1 |
| /trends | 37 | 16 | 2 | 1 |
| /search | 52 | 30 | 6 | 0 |
| /banks | 52 | 30 | 6 | 0 |
| /bank-rates | 48 | 23 | 5 | 1 |
| /categories | 52 | 30 | 6 | 0 |
| /catalogue | 46 | 17 | 2 | 1 |
| /compare | 10 | 5 | 1 | 1 |
| /matches | 46 | 17 | 2 | 1 |
| /calculator | 43 | 21 | 6 | 1 |
| /projections | 36 | 17 | 2 | 1 |
| /profile | 42 | 18 | 2 | 1 |
| /research | 37 | 16 | 2 | 1 |
| /rba | 27 | 9 | 2 | 1 |
| /rba-response | 42 | 16 | 4 | 1 |
| /settings | 28 | 9 | 1 | 1 |
| /about | 25 | 11 | 2 | 1 |
| /terms | 18 | 7 | 1 | 1 |
| /privacy | 18 | 7 | 1 | 1 |
| /third-party-notices | 20 | 7 | 1 | 1 |
| /node | 46 | 17 | 2 | 1 |
| /passthrough | 41 | 15 | 2 | 0 |
| /calculation-receipt | 23 | 10 | 1 | 1 |
| /rate-receipt | 14 | 7 | 1 | 1 |
| warm resume | 14 | 7 | 1 | 1 |
| cold relaunch | 52 | 30 | 6 | 0 |
| about | 25 | 11 | 2 | 1 |
| audit screen | 27 | 11 | 2 | 1 |
| audit crashed | 0 | 0 | 0 | 0 |
| relaunch after audit crash | 52 | 30 | 8 | 1 |
| about | 25 | 11 | 2 | 1 |
| audit screen | 27 | 11 | 2 | 1 |
| about for debug log | 25 | 11 | 2 | 1 |
| debug log screen | 27 | 8 | 1 | 1 |
