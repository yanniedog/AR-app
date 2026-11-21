# UX review

UX review: 35 major, 170 minor across 53 screens. Weakest: Design consistency 0/5, Frustration and abandonment risk 0.6/5, Appropriateness 1/5.
First value 93.3 s, 0 gate taps. Taps: find the best rate 0, compare unknown, open a lender unknown, open a product 1, save a rate unknown.
- major | search Macquarie: contrast "Macq · Macquarie Cash Management Accelerator Accou", 1.1:1, needs 4.5:1 | Fix: Darken the text or lighten the background
- major | search Macquarie: contrast "Rates", 1.0:1, needs 4.5:1 | Fix: Darken the text or lighten the background
- major | search Macquarie: contrast "Saved", 1.0:1, needs 4.5:1 | Fix: Darken the text or lighten the background
- major | search Macquarie: contrast "Market", 1.0:1, needs 4.5:1 | Fix: Darken the text or lighten the background

Frustration and abandonment risk 0.6/5: 3 major, 81 minor.
- major | open app: slow, 53.6 s to settle | Fix: Show content first and defer the slow work
- major | restart with a saved rate: slow, 14.6 s to settle | Fix: Show content first and defer the slow work
- major | cold start: slow-first-value, 93.3 s from launch to rates showing | Fix: Show cached rates on launch before the refresh
- minor | open app: jargon "Cairns · CLASSIC HOME LOAN VARIABLE 60-80 LVR PI", unexpanded LVR | Fix: Replace the abbreviation with a plain label
- minor | open app: crowded-targets "View Police Credit Union Ltd · History · Freshness", 7 dp apart | Fix: Add at least 8 dp between adjacent controls
- minor | scroll rates 1: jargon "Cairns · PLUS HOME LOAN FIXED 3YR 60-80 LVR PI", unexpanded LVR | Fix: Replace the abbreviation with a plain label

| dimension | score | findings |
| --- | --- | --- |
| Design consistency | 0/5 | 37 |
| Layout | 5/5 | 0 |
| Ease of use | 5/5 | 0 |
| Comfort | 4.6/5 | 3 |
| Helpfulness | 5/5 | 0 |
| Appropriateness | 1/5 | 84 |
| Onboarding ease | 4.8/5 | 1 |
| Barriers to entry and use | 4.8/5 | 1 |
| Engagement hooks | 5/5 | 0 |
| Frustration and abandonment risk | 0.6/5 | 84 |

## Task cost

| task | taps from first screen | seconds |
| --- | --- | --- |
| Find the best rate | 0 | 93.3 s |
| Compare | unknown | 2.5 s |
| Open a lender | unknown | unknown |
| Open a product | 1 | 3.2 s |
| Save a rate | unknown | unknown |

## Top findings per dimension

**Design consistency**
- major search Macquarie: contrast "Macq · Macquarie Cash Management Accelerator Account" (1.1:1, needs 4.5:1). Fix: Darken the text or lighten the background
- major search Macquarie: contrast "Rates" (1.0:1, needs 4.5:1). Fix: Darken the text or lighten the background
- major search Macquarie: contrast "Saved" (1.0:1, needs 4.5:1). Fix: Darken the text or lighten the background

**Comfort**
- major open app: slow (53.6 s to settle). Fix: Show content first and defer the slow work
- major restart with a saved rate: slow (14.6 s to settle). Fix: Show content first and defer the slow work
- minor open product: slow (6.5 s to settle). Fix: Show content first and defer the slow work

**Appropriateness**
- minor open app: accuracy "CLASSIC HOME LOAN VARIABLE 60-80 LVR PI, Cairns bank" (comparison 6% is below advertised 6.54%). Fix: Fix the displayed figure or its sort
- minor open app: accuracy "Everyday Home Loan, MoveBank" (comparison 6.19% is below advertised 6.49%). Fix: Fix the displayed figure or its sort
- minor scroll rates 1: accuracy "Everyday Home Loan, MoveBank" (comparison 6.19% is below advertised 6.49%). Fix: Fix the displayed figure or its sort

**Onboarding ease**
- major cold start: slow-first-value (93.3 s from launch to rates showing). Fix: Show cached rates on launch before the refresh

**Barriers to entry and use**
- major cold start: slow-first-value (93.3 s from launch to rates showing). Fix: Show cached rates on launch before the refresh

**Frustration and abandonment risk**
- major open app: slow (53.6 s to settle). Fix: Show content first and defer the slow work
- major restart with a saved rate: slow (14.6 s to settle). Fix: Show content first and defer the slow work
- major cold start: slow-first-value (93.3 s from launch to rates showing). Fix: Show cached rates on launch before the refresh

## Screens

| screen | elements | tappable | findings | major |
| --- | --- | --- | --- | --- |
| open app | 52 | 31 | 8 | 1 |
| scroll rates 1 | 49 | 31 | 7 | 0 |
| scroll rates 2 | 47 | 28 | 5 | 0 |
| scroll rates back | 47 | 28 | 5 | 0 |
| open product | 31 | 10 | 1 | 0 |
| scroll product | 23 | 8 | 0 | 0 |
| back to rates | 47 | 28 | 5 | 0 |
| open lenders | 41 | 21 | 0 | 0 |
| scroll lenders | 37 | 20 | 0 | 0 |
| back from lenders | 47 | 28 | 5 | 0 |
| switch to savings | 49 | 31 | 4 | 0 |
| switch to home loans | 47 | 28 | 5 | 0 |
| open filters | 42 | 20 | 1 | 0 |
| close filters | 47 | 28 | 5 | 0 |
| open market | 42 | 13 | 0 | 0 |
| open rba | 25 | 7 | 0 | 0 |
| scroll rba | 19 | 8 | 0 | 0 |
| back from rba | 42 | 13 | 0 | 0 |
| scroll market | 32 | 10 | 1 | 0 |
| open saved | 19 | 9 | 0 | 0 |
| return to rates | 47 | 28 | 5 | 0 |
| start category switch | 47 | 28 | 5 | 0 |
| open term deposits | 49 | 31 | 4 | 0 |
| verify term deposit rates | 52 | 34 | 4 | 0 |
| restore home loans | 47 | 28 | 5 | 0 |
| start search from rates | 47 | 28 | 5 | 0 |
| open savings search | 49 | 31 | 4 | 0 |
| search Macquarie | 50 | 32 | 8 | 4 |
| verify Macquarie result | 50 | 32 | 8 | 4 |
| clear query and restore results | 49 | 31 | 8 | 4 |
| return from savings search | 47 | 28 | 9 | 4 |
| start filter rollback | 47 | 28 | 9 | 4 |
| open mortgage filter draft | 37 | 18 | 1 | 0 |
| select fixed in draft | 37 | 18 | 2 | 0 |
| discard unsaved filter draft | 47 | 28 | 9 | 4 |
| verify fixed was not applied | 37 | 18 | 1 | 0 |
| close verified filter draft | 47 | 28 | 9 | 4 |
| start save from rates | 47 | 28 | 9 | 4 |
| open unsaved rate | 31 | 10 | 0 | 0 |
| save a rate | 31 | 10 | 0 | 0 |
| leave saved product | 47 | 28 | 5 | 0 |
| restart with a saved rate | 52 | 31 | 8 | 1 |
| verify saved rate after restart | 26 | 12 | 0 | 0 |
| open product from saved rates | 31 | 10 | 0 | 0 |
| remove saved rate | 31 | 10 | 0 | 0 |
| leave removed product | 19 | 9 | 0 | 0 |
| follow browse rates recovery | 52 | 31 | 7 | 0 |
| start compare from rates | 52 | 31 | 7 | 0 |
| enter selection mode | 42 | 21 | 5 | 0 |
| select first comparison rate | 42 | 21 | 5 | 0 |
| select second comparison rate | 42 | 21 | 4 | 0 |
| open two-rate comparison | 21 | 2 | 2 | 0 |
| return from two-rate comparison | 42 | 21 | 4 | 0 |
