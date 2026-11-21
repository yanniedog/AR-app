# UX review

UX review: 2 major, 94 minor across 26 screens. Weakest: Frustration and abandonment risk 0/5, Appropriateness 1.1/5, Comfort 4.6/5.
First value 29.1 s, 0 gate taps. Taps: find the best rate 0, compare unknown, open a lender unknown, open a product 1, save a rate unknown.

Frustration and abandonment risk 0/5: 2 major, 53 minor.
- major | open app: slow, 31.5 s to settle | Fix: Show content first and defer the slow work
- major | cold start: slow-first-value, 29.1 s from launch to rates showing | Fix: Show cached rates on launch before the refresh
- minor | open app: jargon "Cairns · CLASSIC HOME LOAN VARIABLE 60-80 LVR PI", unexpanded LVR | Fix: Replace the abbreviation with a plain label
- minor | open app: crowded-targets "View Police Credit Union Ltd · History · Freshness", 7 dp apart | Fix: Add at least 8 dp between adjacent controls
- minor | scroll rates 1: jargon "Cairns · PLUS HOME LOAN FIXED 2YR 60-80 LVR PI", unexpanded LVR | Fix: Replace the abbreviation with a plain label
- minor | scroll rates 1: crowded-targets "Everyday Home Loan, MoveBank, Comparison rate 6.25", 4 dp apart | Fix: Add at least 8 dp between adjacent controls

| dimension | score | findings |
| --- | --- | --- |
| Design consistency | 5/5 | 0 |
| Layout | 5/5 | 0 |
| Ease of use | 5/5 | 0 |
| Comfort | 4.6/5 | 1 |
| Helpfulness | 5/5 | 0 |
| Appropriateness | 1.1/5 | 41 |
| Onboarding ease | 4.6/5 | 1 |
| Barriers to entry and use | 4.6/5 | 1 |
| Engagement hooks | 4.9/5 | 1 |
| Frustration and abandonment risk | 0/5 | 55 |

## Task cost

| task | taps from first screen | seconds |
| --- | --- | --- |
| Find the best rate | 0 | 29.1 s |
| Compare | unknown | unknown |
| Open a lender | unknown | unknown |
| Open a product | 1 | 2.6 s |
| Save a rate | unknown | unknown |

## Top findings per dimension

**Comfort**
- major open app: slow (31.5 s to settle). Fix: Show content first and defer the slow work

**Appropriateness**
- minor open app: accuracy "CLASSIC HOME LOAN VARIABLE 60-80 LVR PI, Cairns bank" (comparison 6% is below advertised 6.54%). Fix: Fix the displayed figure or its sort
- minor open app: accuracy "Everyday Home Loan, MoveBank" (comparison 6.19% is below advertised 6.49%). Fix: Fix the displayed figure or its sort
- minor scroll rates 1: accuracy "PLUS HOME LOAN FIXED 3YR 60-80 LVR PI, Cairns bank" (comparison 6.25% is below advertised 6.64%). Fix: Fix the displayed figure or its sort

**Onboarding ease**
- major cold start: slow-first-value (29.1 s from launch to rates showing). Fix: Show cached rates on launch before the refresh

**Barriers to entry and use**
- major cold start: slow-first-value (29.1 s from launch to rates showing). Fix: Show cached rates on launch before the refresh

**Engagement hooks**
- minor all: no-return-reason (no change or recency signal and no alerts). Fix: Show what changed since the last visit

**Frustration and abandonment risk**
- major open app: slow (31.5 s to settle). Fix: Show content first and defer the slow work
- major cold start: slow-first-value (29.1 s from launch to rates showing). Fix: Show cached rates on launch before the refresh
- minor open app: jargon "Cairns · CLASSIC HOME LOAN VARIABLE 60-80 LVR PI" (unexpanded LVR). Fix: Replace the abbreviation with a plain label

## Screens

| screen | elements | tappable | findings | major |
| --- | --- | --- | --- | --- |
| open app | 52 | 31 | 8 | 1 |
| scroll rates 1 | 49 | 31 | 9 | 0 |
| scroll rates 2 | 49 | 31 | 8 | 0 |
| scroll rates back | 49 | 31 | 8 | 0 |
| open product | 29 | 10 | 0 | 0 |
| scroll product | 23 | 8 | 0 | 0 |
| back to rates | 49 | 31 | 8 | 0 |
| open lenders | 41 | 21 | 0 | 0 |
| scroll lenders | 38 | 20 | 1 | 0 |
| back from lenders | 49 | 31 | 8 | 0 |
| switch to savings | 49 | 31 | 4 | 0 |
| switch to home loans | 52 | 34 | 9 | 0 |
| open filters | 42 | 20 | 1 | 0 |
| close filters | 52 | 34 | 9 | 0 |
| open market | 42 | 13 | 0 | 0 |
| open rba | 25 | 7 | 0 | 0 |
| scroll rba | 19 | 8 | 0 | 0 |
| back from rba | 42 | 13 | 0 | 0 |
| scroll market | 32 | 10 | 1 | 0 |
| open saved | 19 | 9 | 0 | 0 |
| return to rates | 52 | 34 | 9 | 0 |
| cold start | 52 | 31 | 7 | 0 |
| about | 22 | 9 | 0 | 0 |
| audit screen | 25 | 10 | 1 | 0 |
| about for debug log | 22 | 9 | 0 | 0 |
| debug log screen | 28 | 9 | 3 | 0 |
