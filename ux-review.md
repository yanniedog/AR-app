# UX review

UX review: 5 major, 173 minor across 59 screens. Weakest: Frustration and abandonment risk 0/5, Appropriateness 3.4/5, Barriers to entry and use 4.3/5.
First value 46.4 s, 0 gate taps. Taps: find the best rate 0, compare unknown, open a lender unknown, open a product 1, save a rate unknown.

Frustration and abandonment risk 0/5: 5 major, 123 minor.
- major | /catalogue: dead-end-state "No listed rate", empty or error state with no action | Fix: Give the empty or error state a retry or back action
- major | /matches: dead-end-state "No listed rate", empty or error state with no action | Fix: Give the empty or error state a retry or back action
- major | /node: dead-end-state "No listed rate", empty or error state with no action | Fix: Give the empty or error state a retry or back action
- major | relaunch after audit crash: slow, 10.1 s to settle | Fix: Show content first and defer the slow work
- major | cold start: slow-first-value, 46.4 s from launch to rates showing | Fix: Show cached rates on launch before the refresh
- minor | open app: jargon "Cairns · CLASSIC HOME LOAN VARIABLE 60-80 LVR PI", unexpanded LVR | Fix: Replace the abbreviation with a plain label

| dimension | score | findings |
| --- | --- | --- |
| Design consistency | 4.5/5 | 12 |
| Layout | 5/5 | 0 |
| Ease of use | 4.7/5 | 7 |
| Comfort | 4.5/5 | 9 |
| Helpfulness | 4.5/5 | 3 |
| Appropriateness | 3.4/5 | 38 |
| Onboarding ease | 4.8/5 | 1 |
| Barriers to entry and use | 4.3/5 | 4 |
| Engagement hooks | 5/5 | 1 |
| Frustration and abandonment risk | 0/5 | 128 |

## Task cost

| task | taps from first screen | seconds |
| --- | --- | --- |
| Find the best rate | 0 | 46.4 s |
| Compare | unknown | unknown |
| Open a lender | unknown | unknown |
| Open a product | 1 | 2.8 s |
| Save a rate | unknown | unknown |

## Top findings per dimension

**Design consistency**
- minor scroll product: contrast "30 days" (4.5:1, needs 4.5:1). Fix: Darken the text or lighten the background
- minor /browse: contrast "Updating" (4.2:1, needs 4.5:1). Fix: Darken the text or lighten the background
- minor /tools: contrast "Refinancing" (4.5:1, needs 4.5:1). Fix: Darken the text or lighten the background

**Ease of use**
- minor /tools: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- minor /tools: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- minor /trends: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop

**Comfort**
- major relaunch after audit crash: slow (10.1 s to settle). Fix: Show content first and defer the slow work
- minor open product: slow (6.3 s to settle). Fix: Show content first and defer the slow work
- minor /tools: tap-target "EditText" (328x44 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop

**Helpfulness**
- major /catalogue: dead-end-state "No listed rate" (empty or error state with no action). Fix: Give the empty or error state a retry or back action
- major /matches: dead-end-state "No listed rate" (empty or error state with no action). Fix: Give the empty or error state a retry or back action
- major /node: dead-end-state "No listed rate" (empty or error state with no action). Fix: Give the empty or error state a retry or back action

**Appropriateness**
- minor open app: accuracy "CLASSIC HOME LOAN VARIABLE 60-80 LVR PI, Cairns bank" (comparison 6% is below advertised 6.54%). Fix: Fix the displayed figure or its sort
- minor open app: accuracy "Everyday Home Loan, MoveBank" (comparison 6.19% is below advertised 6.49%). Fix: Fix the displayed figure or its sort
- minor scroll rates 1: accuracy "Everyday Home Loan, MoveBank" (comparison 6.19% is below advertised 6.49%). Fix: Fix the displayed figure or its sort

**Onboarding ease**
- major cold start: slow-first-value (46.4 s from launch to rates showing). Fix: Show cached rates on launch before the refresh

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
| open app | 52 | 31 | 7 | 0 |
| scroll rates 1 | 51 | 33 | 9 | 0 |
| scroll rates 2 | 49 | 31 | 8 | 0 |
| scroll rates back | 49 | 31 | 8 | 0 |
| open product | 29 | 10 | 2 | 0 |
| scroll product | 32 | 13 | 3 | 0 |
| back to rates | 49 | 31 | 8 | 0 |
| open lenders | 41 | 21 | 0 | 0 |
| scroll lenders | 40 | 21 | 0 | 0 |
| back from lenders | 49 | 31 | 8 | 0 |
| switch to savings | 49 | 31 | 4 | 0 |
| switch to home loans | 49 | 31 | 7 | 0 |
| open filters | 42 | 20 | 1 | 0 |
| close filters | 49 | 31 | 7 | 0 |
| open market | 42 | 13 | 0 | 0 |
| open rba | 25 | 7 | 0 | 0 |
| scroll rba | 20 | 10 | 2 | 0 |
| back from rba | 42 | 13 | 0 | 0 |
| scroll market | 32 | 10 | 1 | 0 |
| open saved | 19 | 9 | 0 | 0 |
| return to rates | 49 | 31 | 7 | 0 |
| cold start | 52 | 31 | 7 | 0 |
| /browse | 52 | 31 | 8 | 0 |
| /watchlist | 19 | 9 | 0 | 0 |
| /market | 42 | 13 | 0 | 0 |
| /tools | 41 | 20 | 5 | 0 |
| /trends | 41 | 20 | 5 | 0 |
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
| about | 22 | 9 | 0 | 0 |
| audit screen | 25 | 10 | 1 | 0 |
| audit crashed | 0 | 0 | 0 | 0 |
| relaunch after audit crash | 52 | 31 | 8 | 1 |
| about | 22 | 9 | 0 | 0 |
| audit screen | 25 | 10 | 1 | 0 |
| about for debug log | 22 | 9 | 0 | 0 |
| debug log screen | 28 | 9 | 3 | 0 |
