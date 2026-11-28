# UX review

UX review: 2 major, 122 minor across 33 screens. Weakest: Frustration and abandonment risk 0/5, Appropriateness 0.8/5, Comfort 4.5/5.
Product details: duplicate source records removed across audited payload: unmeasured; confirmed extra rows visible in captured disclosures: 0 (3 measured captures).
First value 95.3 s, 0 gate taps. Taps: find the best rate 0, compare unknown, open a lender unknown, open a product unknown, save a rate unknown.

Frustration and abandonment risk 0/5: 2 major, 67 minor.
- major | open app: slow, 53.8 s to settle | Fix: Show content first and defer the slow work
- major | cold start: slow-first-value, 95.3 s from launch to rates showing | Fix: Show cached rates on launch before the refresh
- minor | open app: jargon "Cairns · CLASSIC HOME LOAN VARIABLE 60-80 LVR PI", unexpanded LVR | Fix: Replace the abbreviation with a plain label
- minor | scroll rates 1: jargon "MoveBank · Owner Occupier P&I No Offset Mortgage", unexpanded P&I | Fix: Replace the abbreviation with a plain label
- minor | scroll rates 1: crowded-targets "View Police Credit Union Ltd · History · Freshness", 4 dp apart | Fix: Add at least 8 dp between adjacent controls
- minor | scroll rates 1: slow, 6.6 s to settle | Fix: Show content first and defer the slow work

| dimension | score | findings |
| --- | --- | --- |
| Design consistency | 5/5 | 0 |
| Layout | 5/5 | 0 |
| Ease of use | 5/5 | 0 |
| Comfort | 4.5/5 | 3 |
| Helpfulness | 5/5 | 0 |
| Appropriateness | 0.8/5 | 55 |
| Onboarding ease | 4.7/5 | 1 |
| Barriers to entry and use | 4.7/5 | 1 |
| Engagement hooks | 5/5 | 0 |
| Frustration and abandonment risk | 0/5 | 69 |

## Task cost

| task | taps from first screen | seconds |
| --- | --- | --- |
| Find the best rate | 0 | 95.3 s |
| Compare | unknown | unknown |
| Open a lender | unknown | unknown |
| Open a product | unknown | unknown |
| Save a rate | unknown | unknown |

## Top findings per dimension

**Comfort**
- major open app: slow (53.8 s to settle). Fix: Show content first and defer the slow work
- minor scroll rates 1: slow (6.6 s to settle). Fix: Show content first and defer the slow work
- minor open product: slow (6.0 s to settle). Fix: Show content first and defer the slow work

**Appropriateness**
- minor open app: accuracy "CLASSIC HOME LOAN VARIABLE 60-80 LVR PI, Cairns bank" (comparison 6% is below advertised 6.54%). Fix: Fix the displayed figure or its sort
- minor open app: accuracy "Owner Occupier P&I No Offset Mortgage, MoveBank" (comparison 6.19% is below advertised 6.49%). Fix: Fix the displayed figure or its sort
- minor scroll rates 1: accuracy "Owner Occupier P&I No Offset Mortgage, MoveBank" (comparison 6.19% is below advertised 6.49%). Fix: Fix the displayed figure or its sort

**Onboarding ease**
- major cold start: slow-first-value (95.3 s from launch to rates showing). Fix: Show cached rates on launch before the refresh

**Barriers to entry and use**
- major cold start: slow-first-value (95.3 s from launch to rates showing). Fix: Show cached rates on launch before the refresh

**Frustration and abandonment risk**
- major open app: slow (53.8 s to settle). Fix: Show content first and defer the slow work
- major cold start: slow-first-value (95.3 s from launch to rates showing). Fix: Show cached rates on launch before the refresh
- minor open app: jargon "Cairns · CLASSIC HOME LOAN VARIABLE 60-80 LVR PI" (unexpanded LVR). Fix: Replace the abbreviation with a plain label

## Screens

| screen | elements | tappable | findings | major |
| --- | --- | --- | --- | --- |
| open app | 52 | 31 | 5 | 1 |
| scroll rates 1 | 52 | 34 | 10 | 0 |
| scroll rates 2 | 52 | 34 | 8 | 0 |
| scroll rates back | 52 | 34 | 8 | 0 |
| open product | 26 | 11 | 1 | 0 |
| scroll product | 24 | 8 | 0 | 0 |
| expand visible fees | 24 | 8 | 0 | 0 |
| expand product facts | 29 | 8 | 0 | 0 |
| scroll product fees | 27 | 9 | 0 | 0 |
| scroll product eligibility | 20 | 11 | 0 | 0 |
| expand eligibility | 20 | 11 | 0 | 0 |
| expand constraints | 23 | 11 | 1 | 0 |
| scroll product sources | 22 | 10 | 1 | 0 |
| back to rates | 52 | 34 | 8 | 0 |
| open lenders | 35 | 18 | 3 | 0 |
| scroll lenders | 35 | 18 | 3 | 0 |
| back from lenders | 52 | 34 | 8 | 0 |
| switch to savings | 49 | 31 | 0 | 0 |
| switch to home loans | 52 | 34 | 8 | 0 |
| open filters | 45 | 20 | 2 | 0 |
| close filters | 52 | 34 | 8 | 0 |
| open market | 42 | 13 | 0 | 0 |
| open rba | 24 | 7 | 0 | 0 |
| scroll rba | 25 | 10 | 0 | 0 |
| back from rba | 42 | 13 | 0 | 0 |
| scroll market | 32 | 10 | 1 | 0 |
| open saved | 19 | 9 | 0 | 0 |
| return to rates | 52 | 34 | 8 | 0 |
| start category switch | 52 | 34 | 8 | 0 |
| start search from rates | 52 | 34 | 8 | 0 |
| start filter rollback | 52 | 34 | 8 | 0 |
| start save from rates | 52 | 34 | 8 | 0 |
| start compare from rates | 52 | 34 | 8 | 0 |
