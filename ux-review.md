# UX review

UX review: 9 major, 131 minor across 77 screens. Weakest: Frustration and abandonment risk 1.8/5, Appropriateness 3.2/5, Comfort 4.2/5.
Product details: duplicate source records removed across audited payload: unmeasured; confirmed extra rows visible in captured disclosures: 0 (2 measured captures).
First value 81.0 s, 0 gate taps. Taps: find the best rate 0, compare unknown, open a lender unknown, open a product 1, save a rate unknown.
- major | open app: contrast "Updating", 1.1:1, needs 4.5:1 | Fix: Darken the text or lighten the background
- major | open app: contrast "Principal & interest", 1.1:1, needs 4.5:1 | Fix: Darken the text or lighten the background

Frustration and abandonment risk 1.8/5: 7 major, 72 minor.
- major | open app: slow, 53.4 s to settle | Fix: Show content first and defer the slow work
- major | restart with a saved rate: slow, 15.2 s to settle | Fix: Show content first and defer the slow work
- major | clear audit requirements: tap-target "Digital banking", 47x27 dp, minimum 48 | Fix: Pad the control to 48 dp or add hitSlop
- major | leave savings profile: tap-target "Digital banking", 47x27 dp, minimum 48 | Fix: Pad the control to 48 dp or add hitSlop
- major | cold start: slow-first-value, 81.0 s from launch to rates showing | Fix: Show cached rates on launch before the refresh
- minor | open app: jargon "Cairns · CLASSIC HOME LOAN VARIABLE 60-80 LVR PI", unexpanded LVR | Fix: Replace the abbreviation with a plain label

| dimension | score | findings |
| --- | --- | --- |
| Design consistency | 4.6/5 | 7 |
| Layout | 5/5 | 0 |
| Ease of use | 4.5/5 | 4 |
| Comfort | 4.2/5 | 7 |
| Helpfulness | 5/5 | 0 |
| Appropriateness | 3.2/5 | 54 |
| Onboarding ease | 4.9/5 | 1 |
| Barriers to entry and use | 4.9/5 | 1 |
| Engagement hooks | 5/5 | 0 |
| Frustration and abandonment risk | 1.8/5 | 79 |

## Task cost

| task | taps from first screen | seconds |
| --- | --- | --- |
| Find the best rate | 0 | 81.0 s |
| Compare | unknown | 7.0 s |
| Open a lender | unknown | unknown |
| Open a product | 1 | 2.5 s |
| Save a rate | unknown | unknown |

## Top findings per dimension

**Design consistency**
- major open app: contrast "Updating" (1.1:1, needs 4.5:1). Fix: Darken the text or lighten the background
- major open app: contrast "Principal & interest" (1.1:1, needs 4.5:1). Fix: Darken the text or lighten the background
- minor select fixed in draft: contrast "Fixed" (4.5:1, needs 4.5:1). Fix: Darken the text or lighten the background

**Ease of use**
- major clear audit requirements: tap-target "Digital banking" (47x27 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- major clear audit requirements: tap-target "Undo" (33x20 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- major leave savings profile: tap-target "Digital banking" (47x27 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop

**Comfort**
- major open app: slow (53.4 s to settle). Fix: Show content first and defer the slow work
- major restart with a saved rate: slow (15.2 s to settle). Fix: Show content first and defer the slow work
- major clear audit requirements: tap-target "Digital banking" (47x27 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop

**Appropriateness**
- minor open app: accuracy "CLASSIC HOME LOAN VARIABLE 60-80 LVR PI, Cairns bank" (comparison 6% is below advertised 6.54%). Fix: Fix the displayed figure or its sort
- minor open app: accuracy "Owner Occupier P&I No Offset Mortgage, MoveBank" (comparison 6.19% is below advertised 6.49%). Fix: Fix the displayed figure or its sort
- minor scroll rates 1: accuracy "PLUS HOME LOAN FIXED 3YR 60-80 LVR PI, Cairns bank" (comparison 6.25% is below advertised 6.64%). Fix: Fix the displayed figure or its sort

**Onboarding ease**
- major cold start: slow-first-value (81.0 s from launch to rates showing). Fix: Show cached rates on launch before the refresh

**Barriers to entry and use**
- major cold start: slow-first-value (81.0 s from launch to rates showing). Fix: Show cached rates on launch before the refresh

**Frustration and abandonment risk**
- major open app: slow (53.4 s to settle). Fix: Show content first and defer the slow work
- major restart with a saved rate: slow (15.2 s to settle). Fix: Show content first and defer the slow work
- major clear audit requirements: tap-target "Digital banking" (47x27 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop

## Screens

| screen | elements | tappable | findings | major |
| --- | --- | --- | --- | --- |
| open app | 52 | 31 | 7 | 3 |
| scroll rates 1 | 51 | 33 | 9 | 0 |
| scroll rates 2 | 57 | 27 | 3 | 0 |
| scroll rates back | 57 | 27 | 3 | 0 |
| open product | 26 | 11 | 1 | 0 |
| scroll product | 22 | 8 | 1 | 0 |
| expand visible fees | 24 | 8 | 1 | 0 |
| expand product facts | 20 | 11 | 1 | 0 |
| scroll product fees | 20 | 11 | 1 | 0 |
| scroll product eligibility | 20 | 11 | 1 | 0 |
| expand eligibility | 20 | 11 | 1 | 0 |
| expand constraints | 28 | 10 | 2 | 0 |
| scroll product sources | 22 | 10 | 2 | 0 |
| back to rates | 57 | 27 | 3 | 0 |
| open lenders | 35 | 18 | 3 | 0 |
| scroll lenders | 35 | 18 | 3 | 0 |
| back from lenders | 57 | 27 | 3 | 0 |
| switch to savings and see a priced account | 49 | 31 | 0 | 0 |
| switch to term deposits and see a priced offer | 49 | 31 | 0 | 0 |
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
| open term deposits | 49 | 31 | 0 | 0 |
| verify term deposit rates | 51 | 33 | 2 | 0 |
| inspect term deposit quote | 26 | 11 | 0 | 0 |
| return from term deposit quote | 51 | 33 | 2 | 0 |
| restore home loans | 57 | 30 | 3 | 0 |
| start search from rates | 57 | 30 | 3 | 0 |
| open savings search | 49 | 31 | 0 | 0 |
| inspect savings quote | 26 | 11 | 0 | 0 |
| return from savings quote | 49 | 31 | 0 | 0 |
| search Macquarie | 50 | 32 | 0 | 0 |
| verify Macquarie result | 50 | 32 | 0 | 0 |
| clear query and restore results | 49 | 31 | 0 | 0 |
| return from savings search | 57 | 30 | 3 | 0 |
| start filter rollback | 57 | 30 | 3 | 0 |
| open mortgage filter draft | 38 | 17 | 0 | 0 |
| select fixed in draft | 38 | 17 | 1 | 0 |
| discard unsaved filter draft | 57 | 30 | 3 | 0 |
| verify fixed was not applied | 38 | 17 | 0 | 0 |
| close verified filter draft | 57 | 30 | 3 | 0 |
| start save from rates | 57 | 30 | 3 | 0 |
| open unsaved rate | 26 | 11 | 1 | 0 |
| save a rate | 26 | 11 | 1 | 0 |
| leave saved product | 57 | 30 | 3 | 0 |
| restart with a saved rate | 52 | 31 | 5 | 1 |
| verify saved rate after restart | 26 | 12 | 2 | 0 |
| open product from saved rates | 26 | 11 | 1 | 0 |
| remove saved rate | 26 | 11 | 1 | 0 |
| leave removed product | 19 | 9 | 1 | 0 |
| follow browse rates recovery | 52 | 31 | 4 | 0 |
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
| require Unlimited transactions | 12 | 10 | 0 | 0 |
| require Bill payment | 12 | 10 | 0 | 0 |
| save four savings features | 30 | 13 | 0 | 0 |
| open savings rate kinds | 7 | 6 | 0 | 0 |
| choose ongoing savings | 30 | 13 | 0 | 0 |
| restore audit profile | 30 | 13 | 0 | 0 |
| clear audit requirements | 27 | 13 | 4 | 2 |
| leave savings profile | 27 | 13 | 4 | 2 |
