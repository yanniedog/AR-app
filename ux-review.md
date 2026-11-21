# UX review

UX review: 1 major, 70 minor across 30 screens. Weakest: Frustration and abandonment risk 0.8/5, Appropriateness 3/5, Onboarding ease 4.7/5.
First value 43.2 s, 0 gate taps. Taps: find the best rate 0, compare unknown, open a lender unknown, open a product 1, save a rate unknown.

Frustration and abandonment risk 0.8/5: 1 major, 46 minor.
- major | cold start: slow-first-value, 43.2 s from launch to rates showing | Fix: Show cached rates on launch before the refresh
- minor | open app: jargon "Cairns · CLASSIC HOME LOAN VARIABLE 60-80 LVR PI", unexpanded LVR | Fix: Replace the abbreviation with a plain label
- minor | open app: crowded-targets "View Police Credit Union Ltd · History · Freshness", 7 dp apart | Fix: Add at least 8 dp between adjacent controls
- minor | scroll rates 1: jargon "Cairns · PLUS HOME LOAN FIXED 2YR 60-80 LVR PI", unexpanded LVR | Fix: Replace the abbreviation with a plain label
- minor | scroll rates 1: crowded-targets "PLUS HOME LOAN FIXED 2YR 60-80 LVR PI, Cairns bank", 4 dp apart | Fix: Add at least 8 dp between adjacent controls
- minor | open product: slow, 5.5 s to settle | Fix: Show content first and defer the slow work

| dimension | score | findings |
| --- | --- | --- |
| Design consistency | 5/5 | 0 |
| Layout | 5/5 | 0 |
| Ease of use | 5/5 | 0 |
| Comfort | 4.8/5 | 2 |
| Helpfulness | 5/5 | 0 |
| Appropriateness | 3/5 | 24 |
| Onboarding ease | 4.7/5 | 1 |
| Barriers to entry and use | 4.7/5 | 1 |
| Engagement hooks | 4.9/5 | 1 |
| Frustration and abandonment risk | 0.8/5 | 47 |

## Task cost

| task | taps from first screen | seconds |
| --- | --- | --- |
| Find the best rate | 0 | 43.2 s |
| Compare | unknown | unknown |
| Open a lender | unknown | unknown |
| Open a product | 1 | 2.7 s |
| Save a rate | unknown | unknown |

## Top findings per dimension

**Comfort**
- minor open product: slow (5.5 s to settle). Fix: Show content first and defer the slow work
- minor relaunch after audit crash: slow (9.5 s to settle). Fix: Show content first and defer the slow work

**Appropriateness**
- minor open app: accuracy "CLASSIC HOME LOAN VARIABLE 60-80 LVR PI, Cairns bank" (comparison 6% is below advertised 6.54%). Fix: Fix the displayed figure or its sort
- minor open app: accuracy "Everyday Home Loan, MoveBank" (comparison 6.19% is below advertised 6.49%). Fix: Fix the displayed figure or its sort
- minor scroll rates 1: accuracy "Everyday Home Loan, MoveBank" (comparison 6.25% is below advertised 6.44%). Fix: Fix the displayed figure or its sort

**Onboarding ease**
- major cold start: slow-first-value (43.2 s from launch to rates showing). Fix: Show cached rates on launch before the refresh

**Barriers to entry and use**
- major cold start: slow-first-value (43.2 s from launch to rates showing). Fix: Show cached rates on launch before the refresh

**Engagement hooks**
- minor all: no-return-reason (no change or recency signal and no alerts). Fix: Show what changed since the last visit

**Frustration and abandonment risk**
- major cold start: slow-first-value (43.2 s from launch to rates showing). Fix: Show cached rates on launch before the refresh
- minor open app: jargon "Cairns · CLASSIC HOME LOAN VARIABLE 60-80 LVR PI" (unexpanded LVR). Fix: Replace the abbreviation with a plain label
- minor open app: crowded-targets "View Police Credit Union Ltd · History · Freshness · Unknown / View MoveBank · History · Freshness · Unknown" (7 dp apart). Fix: Add at least 8 dp between adjacent controls

## Screens

| screen | elements | tappable | findings | major |
| --- | --- | --- | --- | --- |
| open app | 52 | 31 | 7 | 0 |
| scroll rates 1 | 49 | 31 | 8 | 0 |
| scroll rates 2 | 57 | 27 | 2 | 0 |
| scroll rates back | 57 | 27 | 2 | 0 |
| open product | 31 | 10 | 1 | 0 |
| scroll product | 23 | 8 | 0 | 0 |
| back to rates | 57 | 27 | 2 | 0 |
| open lenders | 41 | 21 | 0 | 0 |
| scroll lenders | 35 | 18 | 0 | 0 |
| back from lenders | 57 | 27 | 2 | 0 |
| switch to savings | 49 | 31 | 4 | 0 |
| switch to home loans | 57 | 30 | 5 | 0 |
| open filters | 42 | 20 | 1 | 0 |
| close filters | 57 | 30 | 5 | 0 |
| open market | 42 | 13 | 0 | 0 |
| open rba | 25 | 7 | 0 | 0 |
| scroll rba | 18 | 10 | 2 | 0 |
| back from rba | 42 | 13 | 0 | 0 |
| scroll market | 32 | 10 | 1 | 0 |
| open saved | 19 | 9 | 0 | 0 |
| return to rates | 61 | 30 | 7 | 0 |
| cold start | 52 | 31 | 7 | 0 |
| about | 22 | 9 | 0 | 0 |
| audit screen | 25 | 10 | 1 | 0 |
| audit crashed | 0 | 0 | 0 | 0 |
| relaunch after audit crash | 52 | 31 | 8 | 0 |
| about | 22 | 9 | 0 | 0 |
| audit screen | 25 | 10 | 1 | 0 |
| about for debug log | 22 | 9 | 0 | 0 |
| debug log screen | 28 | 9 | 3 | 0 |
