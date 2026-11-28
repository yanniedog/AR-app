# UX review

UX review: 9 major, 184 minor across 67 screens. Weakest: Frustration and abandonment risk 0.6/5, Appropriateness 1.5/5, Comfort 3.8/5.
Product details: duplicate source records removed across audited payload: unmeasured; confirmed extra rows visible in captured disclosures: 0 (3 measured captures).
First value 85.6 s, 0 gate taps. Taps: find the best rate 0, compare unknown, open a lender unknown, open a product 1, save a rate unknown.

Frustration and abandonment risk 0.6/5: 9 major, 83 minor.
- major | open app: slow, 53.8 s to settle | Fix: Show content first and defer the slow work
- major | expand product facts: tap-target "30 days", 73x30 dp, minimum 48 | Fix: Pad the control to 48 dp or add hitSlop
- major | restart with a saved rate: slow, 20.6 s to settle | Fix: Show content first and defer the slow work
- major | leave removed product: spinner-no-result "screen never settled", screen kept changing until the settle timeout | Fix: Replace the spinner with a result or a retry action
- major | leave removed product: slow, 20.2 s to settle | Fix: Show content first and defer the slow work
- major | cold start: slow-first-value, 85.6 s from launch to rates showing | Fix: Show cached rates on launch before the refresh

| dimension | score | findings |
| --- | --- | --- |
| Design consistency | 4.8/5 | 6 |
| Layout | 5/5 | 0 |
| Ease of use | 4.4/5 | 4 |
| Comfort | 3.8/5 | 8 |
| Helpfulness | 4.9/5 | 1 |
| Appropriateness | 1.5/5 | 95 |
| Onboarding ease | 4.9/5 | 1 |
| Barriers to entry and use | 4.9/5 | 1 |
| Engagement hooks | 5/5 | 0 |
| Frustration and abandonment risk | 0.6/5 | 92 |

## Task cost

| task | taps from first screen | seconds |
| --- | --- | --- |
| Find the best rate | 0 | 85.6 s |
| Compare | unknown | 2.6 s |
| Open a lender | unknown | unknown |
| Open a product | 1 | unknown |
| Save a rate | unknown | unknown |

## Top findings per dimension

**Design consistency**
- minor expand product facts: contrast "Benchmarks · LVR ≥80.0%" (4.5:1, needs 4.5:1). Fix: Darken the text or lighten the background
- minor select fixed in draft: contrast "Fixed" (4.5:1, needs 4.5:1). Fix: Darken the text or lighten the background
- minor enter selection mode: contrast "Done" (4.5:1, needs 4.5:1). Fix: Darken the text or lighten the background

**Ease of use**
- major expand product facts: tap-target "30 days" (73x30 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- major expand product facts: tap-target "90 days" (73x30 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- major expand product facts: tap-target "1 year" (62x30 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop

**Comfort**
- major open app: slow (53.8 s to settle). Fix: Show content first and defer the slow work
- major expand product facts: tap-target "30 days" (73x30 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- major expand product facts: tap-target "90 days" (73x30 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop

**Helpfulness**
- major leave removed product: spinner-no-result "screen never settled" (screen kept changing until the settle timeout). Fix: Replace the spinner with a result or a retry action

**Appropriateness**
- minor open app: accuracy "CLASSIC HOME LOAN VARIABLE 60-80 LVR PI, Cairns bank" (comparison 6% is below advertised 6.54%). Fix: Fix the displayed figure or its sort
- minor open app: accuracy "Owner Occupier P&I No Offset Mortgage, MoveBank" (comparison 6.19% is below advertised 6.49%). Fix: Fix the displayed figure or its sort
- minor scroll rates 1: accuracy "CLASSIC HOME LOAN VARIABLE 60-80 LVR PI, Cairns bank" (comparison 6% is below advertised 6.54%). Fix: Fix the displayed figure or its sort

**Onboarding ease**
- major cold start: slow-first-value (85.6 s from launch to rates showing). Fix: Show cached rates on launch before the refresh

**Barriers to entry and use**
- major cold start: slow-first-value (85.6 s from launch to rates showing). Fix: Show cached rates on launch before the refresh

**Frustration and abandonment risk**
- major open app: slow (53.8 s to settle). Fix: Show content first and defer the slow work
- major expand product facts: tap-target "30 days" (73x30 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- major expand product facts: tap-target "90 days" (73x30 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop

## Screens

| screen | elements | tappable | findings | major |
| --- | --- | --- | --- | --- |
| open app | 52 | 31 | 5 | 1 |
| scroll rates 1 | 46 | 28 | 8 | 0 |
| scroll rates 2 | 49 | 31 | 7 | 0 |
| scroll rates back | 49 | 31 | 7 | 0 |
| open product | 49 | 31 | 7 | 0 |
| scroll product | 23 | 8 | 1 | 0 |
| expand visible fees | 23 | 8 | 1 | 0 |
| expand visible fees again | 23 | 8 | 1 | 0 |
| expand product facts | 34 | 13 | 11 | 4 |
| scroll product fees | 26 | 10 | 1 | 0 |
| scroll product eligibility | 20 | 11 | 1 | 0 |
| expand eligibility | 20 | 11 | 1 | 0 |
| expand constraints | 28 | 10 | 2 | 0 |
| scroll product sources | 24 | 10 | 1 | 0 |
| back to rates | 49 | 31 | 7 | 0 |
| open lenders | 35 | 18 | 3 | 0 |
| scroll lenders | 35 | 18 | 3 | 0 |
| back from lenders | 49 | 31 | 7 | 0 |
| switch to savings and see a priced account | 49 | 31 | 0 | 0 |
| switch to term deposits and see a priced offer | 49 | 31 | 0 | 0 |
| switch to home loans | 49 | 31 | 6 | 0 |
| open filters | 45 | 20 | 2 | 0 |
| close filters | 49 | 31 | 6 | 0 |
| open market | 42 | 13 | 0 | 0 |
| open rba | 24 | 7 | 0 | 0 |
| scroll rba | 25 | 10 | 0 | 0 |
| back from rba | 42 | 13 | 0 | 0 |
| scroll market | 32 | 10 | 1 | 0 |
| open saved | 19 | 9 | 0 | 0 |
| return to rates | 49 | 31 | 6 | 0 |
| start category switch | 49 | 31 | 6 | 0 |
| open term deposits | 49 | 31 | 0 | 0 |
| verify term deposit rates | 52 | 34 | 2 | 0 |
| restore home loans | 49 | 31 | 7 | 0 |
| start search from rates | 49 | 31 | 7 | 0 |
| open savings search | 49 | 31 | 0 | 0 |
| search Macquarie | 50 | 32 | 0 | 0 |
| verify Macquarie result | 50 | 32 | 0 | 0 |
| clear query and restore results | 49 | 31 | 0 | 0 |
| return from savings search | 49 | 31 | 6 | 0 |
| start filter rollback | 49 | 31 | 6 | 0 |
| open mortgage filter draft | 38 | 17 | 0 | 0 |
| select fixed in draft | 38 | 17 | 1 | 0 |
| discard unsaved filter draft | 49 | 31 | 6 | 0 |
| verify fixed was not applied | 38 | 17 | 0 | 0 |
| close verified filter draft | 49 | 31 | 6 | 0 |
| start save from rates | 49 | 31 | 6 | 0 |
| open unsaved rate | 26 | 11 | 1 | 0 |
| save a rate | 26 | 11 | 1 | 0 |
| leave saved product | 49 | 31 | 6 | 0 |
| restart with a saved rate | 52 | 31 | 5 | 1 |
| verify saved rate after restart | 26 | 12 | 1 | 0 |
| open product from saved rates | 26 | 11 | 1 | 0 |
| remove saved rate | 26 | 11 | 1 | 0 |
| leave removed product | 0 | 0 | 2 | 2 |
| start compare from rates | 52 | 31 | 4 | 0 |
| enter selection mode | 42 | 21 | 5 | 0 |
| select first comparison rate | 42 | 21 | 5 | 0 |
| select second comparison rate | 42 | 21 | 5 | 0 |
| open two-rate comparison | 19 | 2 | 2 | 0 |
| return from two-rate comparison | 42 | 21 | 5 | 0 |
| open savings profile | 30 | 13 | 0 | 0 |
| open savings features | 12 | 10 | 0 | 0 |
| require Card access | 12 | 10 | 0 | 0 |
| require PayID | 12 | 10 | 0 | 0 |
| restore audit profile | 12 | 10 | 0 | 0 |
| clear audit requirements | 12 | 10 | 0 | 0 |
