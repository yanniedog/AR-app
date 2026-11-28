# UX review

UX review: 12 major, 57 minor across 54 screens. Weakest: Frustration and abandonment risk 1.5/5, Comfort 2.9/5, Appropriateness 3.8/5.
Product details: duplicate source records removed across audited payload: unmeasured; confirmed extra rows visible in captured disclosures: unmeasured (0 measured captures).
First value unknown, 0 gate taps. Taps: find the best rate unknown, compare unknown, open a lender unknown, open a product unknown, save a rate unknown.

Frustration and abandonment risk 1.5/5: 12 major, 27 minor.
- major | back to rates: spinner-no-result "screen never settled", screen kept changing until the settle timeout | Fix: Replace the spinner with a result or a retry action
- major | back to rates: slow, 20.2 s to settle | Fix: Show content first and defer the slow work
- major | close filters: spinner-no-result "screen never settled", screen kept changing until the settle timeout | Fix: Replace the spinner with a result or a retry action
- major | close filters: slow, 20.2 s to settle | Fix: Show content first and defer the slow work
- major | back from rba: spinner-no-result "screen never settled", screen kept changing until the settle timeout | Fix: Replace the spinner with a result or a retry action
- major | back from rba: slow, 20.2 s to settle | Fix: Show content first and defer the slow work

| dimension | score | findings |
| --- | --- | --- |
| Design consistency | 4.8/5 | 4 |
| Layout | 5/5 | 0 |
| Ease of use | 5/5 | 0 |
| Comfort | 2.9/5 | 12 |
| Helpfulness | 4.1/5 | 5 |
| Appropriateness | 3.8/5 | 26 |
| Onboarding ease | 4.8/5 | 1 |
| Barriers to entry and use | 4.8/5 | 1 |
| Engagement hooks | 5/5 | 0 |
| Frustration and abandonment risk | 1.5/5 | 39 |

## Task cost

| task | taps from first screen | seconds |
| --- | --- | --- |
| Find the best rate | unknown | unknown |
| Compare | unknown | 2.5 s |
| Open a lender | unknown | unknown |
| Open a product | unknown | unknown |
| Save a rate | unknown | unknown |

## Top findings per dimension

**Design consistency**
- minor select fixed in draft: contrast "Fixed" (4.5:1, needs 4.5:1). Fix: Darken the text or lighten the background
- minor enter selection mode: contrast "Done" (4.5:1, needs 4.5:1). Fix: Darken the text or lighten the background
- minor select first comparison rate: contrast "Done" (4.5:1, needs 4.5:1). Fix: Darken the text or lighten the background

**Comfort**
- major back to rates: spinner-no-result "screen never settled" (screen kept changing until the settle timeout). Fix: Replace the spinner with a result or a retry action
- major back to rates: slow (20.2 s to settle). Fix: Show content first and defer the slow work
- major close filters: spinner-no-result "screen never settled" (screen kept changing until the settle timeout). Fix: Replace the spinner with a result or a retry action

**Helpfulness**
- major back to rates: spinner-no-result "screen never settled" (screen kept changing until the settle timeout). Fix: Replace the spinner with a result or a retry action
- major close filters: spinner-no-result "screen never settled" (screen kept changing until the settle timeout). Fix: Replace the spinner with a result or a retry action
- major back from rba: spinner-no-result "screen never settled" (screen kept changing until the settle timeout). Fix: Replace the spinner with a result or a retry action

**Appropriateness**
- minor start category switch: accuracy "CLASSIC HOME LOAN VARIABLE 60-80 LVR PI, Cairns bank" (comparison 6% is below advertised 6.54%). Fix: Fix the displayed figure or its sort
- minor start category switch: accuracy "Owner Occupier P&I No Offset Mortgage, MoveBank" (comparison 6.19% is below advertised 6.49%). Fix: Fix the displayed figure or its sort
- minor start search from rates: accuracy "CLASSIC HOME LOAN VARIABLE 60-80 LVR PI, Cairns bank" (comparison 6% is below advertised 6.54%). Fix: Fix the displayed figure or its sort

**Onboarding ease**
- major cold start: no-first-value (no rate rows on the first screen). Fix: Show cached rates on launch instead of an error screen

**Barriers to entry and use**
- major cold start: no-first-value (no rate rows on the first screen). Fix: Show cached rates on launch instead of an error screen

**Frustration and abandonment risk**
- major back to rates: spinner-no-result "screen never settled" (screen kept changing until the settle timeout). Fix: Replace the spinner with a result or a retry action
- major back to rates: slow (20.2 s to settle). Fix: Show content first and defer the slow work
- major close filters: spinner-no-result "screen never settled" (screen kept changing until the settle timeout). Fix: Replace the spinner with a result or a retry action

## Screens

| screen | elements | tappable | findings | major |
| --- | --- | --- | --- | --- |
| open app | 35 | 17 | 0 | 0 |
| scroll rates 1 | 35 | 17 | 0 | 0 |
| scroll rates 2 | 35 | 17 | 0 | 0 |
| scroll rates back | 35 | 17 | 0 | 0 |
| open product | 35 | 17 | 0 | 0 |
| scroll product | 35 | 17 | 0 | 0 |
| expand visible fees | 35 | 17 | 0 | 0 |
| expand product facts | 35 | 17 | 0 | 0 |
| scroll product fees | 35 | 17 | 0 | 0 |
| scroll product eligibility | 35 | 17 | 0 | 0 |
| expand eligibility | 35 | 17 | 0 | 0 |
| expand constraints | 35 | 17 | 0 | 0 |
| scroll product sources | 35 | 17 | 0 | 0 |
| back to rates | 0 | 0 | 2 | 2 |
| open lenders | 0 | 0 | 0 | 0 |
| scroll lenders | 0 | 0 | 0 | 0 |
| back from lenders | 0 | 0 | 0 | 0 |
| switch to savings | 0 | 0 | 0 | 0 |
| switch to home loans | 0 | 0 | 0 | 0 |
| open filters | 0 | 0 | 0 | 0 |
| close filters | 0 | 0 | 2 | 2 |
| open market | 0 | 0 | 0 | 0 |
| open rba | 0 | 0 | 0 | 0 |
| scroll rba | 0 | 0 | 0 | 0 |
| back from rba | 0 | 0 | 2 | 2 |
| scroll market | 0 | 0 | 0 | 0 |
| open saved | 0 | 0 | 0 | 0 |
| return to rates | 0 | 0 | 0 | 0 |
| start category switch | 52 | 31 | 6 | 2 |
| start search from rates | 52 | 31 | 4 | 0 |
| open savings search | 49 | 31 | 0 | 0 |
| search Macquarie | 49 | 31 | 0 | 0 |
| verify Macquarie result | 50 | 32 | 0 | 0 |
| clear query and restore results | 49 | 31 | 0 | 0 |
| return from savings search | 52 | 31 | 4 | 0 |
| start filter rollback | 52 | 31 | 4 | 0 |
| open mortgage filter draft | 38 | 17 | 0 | 0 |
| select fixed in draft | 38 | 17 | 1 | 0 |
| discard unsaved filter draft | 52 | 31 | 4 | 0 |
| verify fixed was not applied | 38 | 17 | 0 | 0 |
| close verified filter draft | 52 | 31 | 4 | 0 |
| start save from rates | 52 | 31 | 4 | 0 |
| open unsaved rate | 28 | 11 | 0 | 0 |
| save a rate | 28 | 11 | 0 | 0 |
| leave saved product | 52 | 31 | 5 | 0 |
| restart with a saved rate | 52 | 31 | 5 | 1 |
| verify saved rate after restart | 26 | 12 | 0 | 0 |
| open product from saved rates | 28 | 11 | 0 | 0 |
| remove saved rate | 28 | 11 | 0 | 0 |
| leave removed product | 19 | 9 | 2 | 2 |
| start compare from rates | 52 | 31 | 4 | 0 |
| enter selection mode | 42 | 21 | 5 | 0 |
| select first comparison rate | 42 | 21 | 5 | 0 |
| select second comparison rate | 42 | 21 | 5 | 0 |
