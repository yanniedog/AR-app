# UX review

UX review: 10 major, 193 minor across 66 screens. Weakest: Frustration and abandonment risk 0/5, Appropriateness 1.9/5, Comfort 3.6/5.
Product details: duplicate source records removed across audited payload: unmeasured; confirmed extra rows visible in captured disclosures: 0 (2 measured captures).
First value 124.1 s, 0 gate taps. Taps: find the best rate 0, compare unknown, open a lender unknown, open a product 1, save a rate unknown.

Frustration and abandonment risk 0/5: 10 major, 107 minor.
- major | open app: slow, 106.8 s to settle | Fix: Show content first and defer the slow work
- major | verify Income Plus rate history: tap-target "Share", 5x48 dp, minimum 48 | Fix: Pad the control to 48 dp or add hitSlop
- major | verify Income Plus rate history: slow, 12.0 s to settle | Fix: Show content first and defer the slow work
- major | restart with a saved rate: slow, 23.9 s to settle | Fix: Show content first and defer the slow work
- major | leave removed product: spinner-no-result "screen never settled", screen kept changing until the settle timeout | Fix: Replace the spinner with a result or a retry action
- major | leave removed product: slow, 20.2 s to settle | Fix: Show content first and defer the slow work

| dimension | score | findings |
| --- | --- | --- |
| Design consistency | 4.8/5 | 5 |
| Layout | 5/5 | 0 |
| Ease of use | 4.4/5 | 4 |
| Comfort | 3.6/5 | 9 |
| Helpfulness | 4.8/5 | 1 |
| Appropriateness | 1.9/5 | 81 |
| Onboarding ease | 4.8/5 | 1 |
| Barriers to entry and use | 4.8/5 | 1 |
| Engagement hooks | 5/5 | 0 |
| Frustration and abandonment risk | 0/5 | 117 |

## Task cost

| task | taps from first screen | seconds |
| --- | --- | --- |
| Find the best rate | 0 | 124.1 s |
| Compare | unknown | unknown |
| Open a lender | unknown | unknown |
| Open a product | 1 | unknown |
| Save a rate | unknown | unknown |

## Top findings per dimension

**Design consistency**
- minor select fixed in draft: contrast "Fixed" (4.5:1, needs 4.5:1). Fix: Darken the text or lighten the background
- minor enter selection mode: contrast "Done" (4.5:1, needs 4.5:1). Fix: Darken the text or lighten the background
- minor select first comparison rate: contrast "Done" (4.5:1, needs 4.5:1). Fix: Darken the text or lighten the background

**Ease of use**
- major verify Income Plus rate history: tap-target "Share" (5x48 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- major open savings features: tap-target "Digital banking" (47x27 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- major restore audit profile: tap-target "Digital banking" (47x27 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop

**Comfort**
- major open app: slow (106.8 s to settle). Fix: Show content first and defer the slow work
- major verify Income Plus rate history: tap-target "Share" (5x48 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- major verify Income Plus rate history: slow (12.0 s to settle). Fix: Show content first and defer the slow work

**Helpfulness**
- major leave removed product: spinner-no-result "screen never settled" (screen kept changing until the settle timeout). Fix: Replace the spinner with a result or a retry action

**Appropriateness**
- minor open app: accuracy "CLASSIC HOME LOAN VARIABLE 60-80 LVR PI, Cairns bank" (comparison 6% is below advertised 6.54%). Fix: Fix the displayed figure or its sort
- minor open app: accuracy "Owner Occupier P&I No Offset Mortgage, MoveBank" (comparison 6.19% is below advertised 6.49%). Fix: Fix the displayed figure or its sort
- minor scroll rates 1: accuracy "CLASSIC HOME LOAN VARIABLE 60-80 LVR PI, Cairns bank" (comparison 6% is below advertised 6.54%). Fix: Fix the displayed figure or its sort

**Onboarding ease**
- major cold start: slow-first-value (124.1 s from launch to rates showing). Fix: Show cached rates on launch before the refresh

**Barriers to entry and use**
- major cold start: slow-first-value (124.1 s from launch to rates showing). Fix: Show cached rates on launch before the refresh

**Frustration and abandonment risk**
- major open app: slow (106.8 s to settle). Fix: Show content first and defer the slow work
- major verify Income Plus rate history: tap-target "Share" (5x48 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- major verify Income Plus rate history: slow (12.0 s to settle). Fix: Show content first and defer the slow work

## Screens

| screen | elements | tappable | findings | major |
| --- | --- | --- | --- | --- |
| open app | 52 | 31 | 5 | 1 |
| scroll rates 1 | 51 | 33 | 10 | 0 |
| scroll rates 2 | 52 | 34 | 9 | 0 |
| scroll rates back | 52 | 34 | 9 | 0 |
| open product | 52 | 34 | 9 | 0 |
| scroll product | 26 | 8 | 1 | 0 |
| expand visible fees | 26 | 8 | 1 | 0 |
| expand visible fees again | 26 | 8 | 1 | 0 |
| expand product facts | 20 | 11 | 0 | 0 |
| scroll product fees | 20 | 11 | 0 | 0 |
| scroll product eligibility | 20 | 11 | 0 | 0 |
| expand eligibility | 20 | 11 | 0 | 0 |
| expand constraints | 23 | 11 | 1 | 0 |
| scroll product sources | 22 | 10 | 1 | 0 |
| back to rates | 52 | 34 | 9 | 0 |
| open lenders | 35 | 18 | 3 | 0 |
| scroll lenders | 35 | 18 | 3 | 0 |
| back from lenders | 52 | 34 | 9 | 0 |
| switch to savings and see a priced account | 49 | 31 | 0 | 0 |
| switch to term deposits and see a priced offer | 49 | 31 | 0 | 0 |
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
| verify Income Plus rate history | 28 | 12 | 3 | 2 |
| start category switch | 51 | 32 | 9 | 0 |
| open term deposits | 49 | 30 | 0 | 0 |
| verify term deposit rates | 51 | 32 | 2 | 0 |
| restore home loans | 51 | 32 | 8 | 0 |
| start search from rates | 51 | 32 | 8 | 0 |
| open savings search | 49 | 30 | 0 | 0 |
| search Macquarie | 50 | 31 | 0 | 0 |
| verify Macquarie result | 50 | 31 | 0 | 0 |
| clear query and restore results | 49 | 30 | 0 | 0 |
| return from savings search | 51 | 32 | 7 | 0 |
| start filter rollback | 51 | 32 | 7 | 0 |
| open mortgage filter draft | 38 | 17 | 0 | 0 |
| select fixed in draft | 38 | 17 | 1 | 0 |
| discard unsaved filter draft | 51 | 32 | 7 | 0 |
| verify fixed was not applied | 38 | 17 | 0 | 0 |
| close verified filter draft | 51 | 32 | 7 | 0 |
| start save from rates | 51 | 32 | 7 | 0 |
| open unsaved rate | 29 | 12 | 0 | 0 |
| save a rate | 29 | 12 | 1 | 0 |
| leave saved product | 51 | 32 | 7 | 0 |
| restart with a saved rate | 52 | 30 | 4 | 1 |
| verify saved rate after restart | 30 | 14 | 0 | 0 |
| open product from saved rates | 29 | 12 | 1 | 0 |
| remove saved rate | 29 | 12 | 0 | 0 |
| leave removed product | 0 | 0 | 2 | 2 |
| start compare from rates | 23 | 11 | 0 | 0 |
| enter selection mode | 52 | 30 | 4 | 0 |
| select first comparison rate | 44 | 22 | 4 | 0 |
| select second comparison rate | 44 | 22 | 4 | 0 |
| open two-rate comparison | 21 | 4 | 1 | 0 |
| return from two-rate comparison | 44 | 22 | 4 | 0 |
| open savings profile | 30 | 13 | 0 | 0 |
| open savings features | 24 | 12 | 2 | 1 |
| restore audit profile | 24 | 12 | 2 | 1 |
| clear audit requirements | 24 | 12 | 2 | 1 |
