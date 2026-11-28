# UX review

UX review: 5 major, 134 minor across 38 screens. Weakest: Frustration and abandonment risk 0/5, Appropriateness 0.6/5, Comfort 3.9/5.
Product details: duplicate source records removed across audited payload: unmeasured; confirmed extra rows visible in captured disclosures: 0 (4 measured captures).
First value 99.1 s, 0 gate taps. Taps: find the best rate 0, compare unknown, open a lender unknown, open a product 1, save a rate unknown.

Frustration and abandonment risk 0/5: 5 major, 67 minor.
- major | open app: slow, 53.3 s to settle | Fix: Show content first and defer the slow work
- major | open savings features: tap-target "Digital banking", 47x27 dp, minimum 48 | Fix: Pad the control to 48 dp or add hitSlop
- major | restore audit profile: tap-target "Digital banking", 47x27 dp, minimum 48 | Fix: Pad the control to 48 dp or add hitSlop
- major | clear audit requirements: tap-target "Digital banking", 47x27 dp, minimum 48 | Fix: Pad the control to 48 dp or add hitSlop
- major | cold start: slow-first-value, 99.1 s from launch to rates showing | Fix: Show cached rates on launch before the refresh
- minor | open app: jargon "Cairns · CLASSIC HOME LOAN VARIABLE 60-80 LVR PI", unexpanded LVR | Fix: Replace the abbreviation with a plain label

| dimension | score | findings |
| --- | --- | --- |
| Design consistency | 5/5 | 0 |
| Layout | 5/5 | 0 |
| Ease of use | 4.2/5 | 3 |
| Comfort | 3.9/5 | 5 |
| Helpfulness | 5/5 | 0 |
| Appropriateness | 0.6/5 | 67 |
| Onboarding ease | 4.7/5 | 1 |
| Barriers to entry and use | 4.7/5 | 1 |
| Engagement hooks | 5/5 | 0 |
| Frustration and abandonment risk | 0/5 | 72 |

## Task cost

| task | taps from first screen | seconds |
| --- | --- | --- |
| Find the best rate | 0 | 99.1 s |
| Compare | unknown | unknown |
| Open a lender | unknown | unknown |
| Open a product | 1 | 2.8 s |
| Save a rate | unknown | unknown |

## Top findings per dimension

**Ease of use**
- major open savings features: tap-target "Digital banking" (47x27 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- major restore audit profile: tap-target "Digital banking" (47x27 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- major clear audit requirements: tap-target "Digital banking" (47x27 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop

**Comfort**
- major open app: slow (53.3 s to settle). Fix: Show content first and defer the slow work
- major open savings features: tap-target "Digital banking" (47x27 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- major restore audit profile: tap-target "Digital banking" (47x27 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop

**Appropriateness**
- minor open app: accuracy "CLASSIC HOME LOAN VARIABLE 60-80 LVR PI, Cairns bank" (comparison 6% is below advertised 6.54%). Fix: Fix the displayed figure or its sort
- minor open app: accuracy "Owner Occupier P&I No Offset Mortgage, MoveBank" (comparison 6.19% is below advertised 6.49%). Fix: Fix the displayed figure or its sort
- minor scroll rates 1: accuracy "Owner Occupier P&I No Offset Mortgage, MoveBank" (comparison 6.19% is below advertised 6.49%). Fix: Fix the displayed figure or its sort

**Onboarding ease**
- major cold start: slow-first-value (99.1 s from launch to rates showing). Fix: Show cached rates on launch before the refresh

**Barriers to entry and use**
- major cold start: slow-first-value (99.1 s from launch to rates showing). Fix: Show cached rates on launch before the refresh

**Frustration and abandonment risk**
- major open app: slow (53.3 s to settle). Fix: Show content first and defer the slow work
- major open savings features: tap-target "Digital banking" (47x27 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- major restore audit profile: tap-target "Digital banking" (47x27 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop

## Screens

| screen | elements | tappable | findings | major |
| --- | --- | --- | --- | --- |
| open app | 52 | 31 | 5 | 1 |
| scroll rates 1 | 49 | 31 | 8 | 0 |
| scroll rates 2 | 49 | 31 | 8 | 0 |
| scroll rates back | 49 | 31 | 8 | 0 |
| open product | 26 | 11 | 1 | 0 |
| scroll product | 23 | 8 | 1 | 0 |
| expand visible fees | 26 | 8 | 1 | 0 |
| expand product facts | 32 | 9 | 2 | 0 |
| scroll product fees | 20 | 11 | 1 | 0 |
| scroll product eligibility | 20 | 11 | 1 | 0 |
| expand eligibility | 20 | 11 | 1 | 0 |
| expand constraints | 28 | 10 | 2 | 0 |
| scroll product sources | 24 | 10 | 1 | 0 |
| back to rates | 49 | 31 | 8 | 0 |
| open lenders | 35 | 18 | 3 | 0 |
| scroll lenders | 35 | 18 | 3 | 0 |
| back from lenders | 49 | 31 | 8 | 0 |
| switch to savings and see a priced account | 49 | 31 | 0 | 0 |
| switch to term deposits and see a priced offer | 49 | 31 | 0 | 0 |
| switch to home loans | 49 | 31 | 8 | 0 |
| open filters | 45 | 20 | 2 | 0 |
| close filters | 49 | 31 | 8 | 0 |
| open market | 42 | 13 | 0 | 0 |
| open rba | 24 | 7 | 0 | 0 |
| scroll rba | 25 | 10 | 0 | 0 |
| back from rba | 42 | 13 | 0 | 0 |
| scroll market | 32 | 10 | 1 | 0 |
| open saved | 19 | 9 | 0 | 0 |
| return to rates | 49 | 31 | 8 | 0 |
| start category switch | 49 | 31 | 8 | 0 |
| start search from rates | 49 | 31 | 8 | 0 |
| start filter rollback | 49 | 31 | 8 | 0 |
| start save from rates | 49 | 31 | 8 | 0 |
| start compare from rates | 49 | 31 | 8 | 0 |
| open savings profile | 30 | 13 | 0 | 0 |
| open savings features | 24 | 12 | 3 | 1 |
| restore audit profile | 24 | 12 | 3 | 1 |
| clear audit requirements | 24 | 12 | 3 | 1 |
