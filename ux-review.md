# UX review

UX review: 2 major, 80 minor across 33 screens. Weakest: Frustration and abandonment risk 0.8/5, Appropriateness 2.6/5, Comfort 4.7/5.
Product details: duplicate source records removed across audited payload: unmeasured; confirmed extra rows visible in captured disclosures: 0 (5 measured captures).
First value 49.0 s, 0 gate taps. Taps: find the best rate 0, compare unknown, open a lender unknown, open a product 1, save a rate unknown.

Frustration and abandonment risk 0.8/5: 2 major, 48 minor.
- major | open app: slow, 99.5 s to settle | Fix: Show content first and defer the slow work
- major | cold start: slow-first-value, 49.0 s from launch to rates showing | Fix: Show cached rates on launch before the refresh
- minor | open app: jargon "Cairns · CLASSIC HOME LOAN VARIABLE 60-80 LVR PI", unexpanded LVR | Fix: Replace the abbreviation with a plain label
- minor | scroll rates 1: jargon "Cairns · PLUS HOME LOAN FIXED 2YR 60-80 LVR PI", unexpanded LVR | Fix: Replace the abbreviation with a plain label
- minor | scroll rates 2: jargon "MoveBank · Owner Occupier P&I With Offset Mortgage", unexpanded P&I | Fix: Replace the abbreviation with a plain label
- minor | scroll rates back: jargon "MoveBank · Owner Occupier P&I With Offset Mortgage", unexpanded P&I | Fix: Replace the abbreviation with a plain label

| dimension | score | findings |
| --- | --- | --- |
| Design consistency | 5/5 | 0 |
| Layout | 5/5 | 0 |
| Ease of use | 5/5 | 0 |
| Comfort | 4.7/5 | 1 |
| Helpfulness | 5/5 | 0 |
| Appropriateness | 2.6/5 | 32 |
| Onboarding ease | 4.7/5 | 1 |
| Barriers to entry and use | 4.7/5 | 1 |
| Engagement hooks | 4.9/5 | 1 |
| Frustration and abandonment risk | 0.8/5 | 50 |

## Task cost

| task | taps from first screen | seconds |
| --- | --- | --- |
| Find the best rate | 0 | 49.0 s |
| Compare | unknown | unknown |
| Open a lender | unknown | unknown |
| Open a product | 1 | unknown |
| Save a rate | unknown | unknown |

## Top findings per dimension

**Comfort**
- major open app: slow (99.5 s to settle). Fix: Show content first and defer the slow work

**Appropriateness**
- minor open app: accuracy "CLASSIC HOME LOAN VARIABLE 60-80 LVR PI, Cairns bank" (comparison 6% is below advertised 6.54%). Fix: Fix the displayed figure or its sort
- minor open app: accuracy "Owner Occupier P&I No Offset Mortgage, MoveBank" (comparison 6.19% is below advertised 6.49%). Fix: Fix the displayed figure or its sort
- minor scroll rates 1: accuracy "Owner Occupier P&I No Offset Mortgage, MoveBank" (comparison 6.25% is below advertised 6.44%). Fix: Fix the displayed figure or its sort

**Onboarding ease**
- major cold start: slow-first-value (49.0 s from launch to rates showing). Fix: Show cached rates on launch before the refresh

**Barriers to entry and use**
- major cold start: slow-first-value (49.0 s from launch to rates showing). Fix: Show cached rates on launch before the refresh

**Engagement hooks**
- minor all: no-return-reason (no change or recency signal and no alerts). Fix: Show what changed since the last visit

**Frustration and abandonment risk**
- major open app: slow (99.5 s to settle). Fix: Show content first and defer the slow work
- major cold start: slow-first-value (49.0 s from launch to rates showing). Fix: Show cached rates on launch before the refresh
- minor open app: jargon "Cairns · CLASSIC HOME LOAN VARIABLE 60-80 LVR PI" (unexpanded LVR). Fix: Replace the abbreviation with a plain label

## Screens

| screen | elements | tappable | findings | major |
| --- | --- | --- | --- | --- |
| open app | 52 | 31 | 5 | 1 |
| scroll rates 1 | 49 | 31 | 6 | 0 |
| scroll rates 2 | 57 | 27 | 3 | 0 |
| scroll rates back | 57 | 27 | 3 | 0 |
| open product | 57 | 27 | 3 | 0 |
| scroll product | 29 | 9 | 2 | 0 |
| expand visible fees | 29 | 9 | 2 | 0 |
| expand product facts | 32 | 9 | 2 | 0 |
| scroll product fees | 26 | 10 | 1 | 0 |
| scroll product eligibility | 21 | 12 | 4 | 0 |
| expand eligibility | 27 | 11 | 4 | 0 |
| expand constraints | 31 | 10 | 4 | 0 |
| scroll product sources | 22 | 10 | 2 | 0 |
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
| return to rates | 57 | 27 | 3 | 0 |
| start category switch | 57 | 27 | 3 | 0 |
| start search from rates | 57 | 27 | 3 | 0 |
| start filter rollback | 57 | 27 | 3 | 0 |
| start save from rates | 57 | 27 | 3 | 0 |
| start compare from rates | 57 | 27 | 3 | 0 |
