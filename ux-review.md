# UX review

UX review: 3 major, 9 minor across 16 screens. Weakest: Frustration and abandonment risk 2/5, Comfort 3.1/5, Ease of use 3.8/5.
Product details: duplicate source records removed across audited payload: unmeasured; confirmed extra rows visible in captured disclosures: unmeasured (0 measured captures).
First value 7.9 s, 0 gate taps. Taps: find the best rate 0, compare unknown, open a lender unknown, open a product unknown, save a rate unknown.

Frustration and abandonment risk 2/5: 3 major, 7 minor.
- major | launch true: slow, 11.7 s to settle | Fix: Show content first and defer the slow work
- major | scroll down times 3: tap-target "Digital banking", 47x27 dp, minimum 48 | Fix: Pad the control to 48 dp or add hitSlop
- major | profile-mortgage-fields: tap-target "Digital banking", 47x27 dp, minimum 48 | Fix: Pad the control to 48 dp or add hitSlop
- minor | launch true: jargon "Cairns · CLASSIC HOME LOAN VARIABLE 60-80 LVR PI", unexpanded LVR | Fix: Replace the abbreviation with a plain label
- minor | scroll down times 3: crowded-targets "Navigate up / Account type: Any", 0 dp apart | Fix: Add at least 8 dp between adjacent controls
- minor | profile-mortgage-fields: crowded-targets "Navigate up / Account type: Any", 0 dp apart | Fix: Add at least 8 dp between adjacent controls

| dimension | score | findings |
| --- | --- | --- |
| Design consistency | 5/5 | 0 |
| Layout | 5/5 | 0 |
| Ease of use | 3.8/5 | 2 |
| Comfort | 3.1/5 | 3 |
| Helpfulness | 5/5 | 0 |
| Appropriateness | 4.7/5 | 2 |
| Onboarding ease | 4.8/5 | 1 |
| Barriers to entry and use | 4.8/5 | 1 |
| Engagement hooks | 5/5 | 0 |
| Frustration and abandonment risk | 2/5 | 10 |

## Task cost

| task | taps from first screen | seconds |
| --- | --- | --- |
| Find the best rate | 0 | 7.9 s |
| Compare | unknown | unknown |
| Open a lender | unknown | unknown |
| Open a product | unknown | unknown |
| Save a rate | unknown | unknown |

## Top findings per dimension

**Ease of use**
- major scroll down times 3: tap-target "Digital banking" (47x27 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- major profile-mortgage-fields: tap-target "Digital banking" (47x27 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop

**Comfort**
- major launch true: slow (11.7 s to settle). Fix: Show content first and defer the slow work
- major scroll down times 3: tap-target "Digital banking" (47x27 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- major profile-mortgage-fields: tap-target "Digital banking" (47x27 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop

**Appropriateness**
- minor launch true: accuracy "CLASSIC HOME LOAN VARIABLE 60-80 LVR PI, Cairns bank" (comparison 6% is below advertised 6.54%). Fix: Fix the displayed figure or its sort
- minor launch true: accuracy "Owner Occupier P&I No Offset Mortgage, MoveBank" (comparison 6.19% is below advertised 6.49%). Fix: Fix the displayed figure or its sort

**Onboarding ease**
- minor cold start: slow-first-value (7.9 s from launch to rates showing). Fix: Show cached rates on launch before the refresh

**Barriers to entry and use**
- minor cold start: slow-first-value (7.9 s from launch to rates showing). Fix: Show cached rates on launch before the refresh

**Frustration and abandonment risk**
- major launch true: slow (11.7 s to settle). Fix: Show content first and defer the slow work
- major scroll down times 3: tap-target "Digital banking" (47x27 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop
- major profile-mortgage-fields: tap-target "Digital banking" (47x27 dp, minimum 48). Fix: Pad the control to 48 dp or add hitSlop

## Screens

| screen | elements | tappable | findings | major |
| --- | --- | --- | --- | --- |
| launch true | 52 | 31 | 5 | 1 |
| profile top | 30 | 13 | 0 | 0 |
| profile-top | 30 | 13 | 0 | 0 |
| open account type | 7 | 6 | 0 | 0 |
| account-type-sheet | 7 | 6 | 0 | 0 |
| back true | 30 | 13 | 0 | 0 |
| open features | 11 | 9 | 0 | 0 |
| features-sheet | 11 | 9 | 0 | 0 |
| back true | 30 | 13 | 0 | 0 |
| scroll down times 3 | 24 | 12 | 3 | 1 |
| profile-mortgage-fields | 24 | 12 | 3 | 1 |
| open /product/Bank%20of%20Queensland%20Limited%7C59906e88-5c03-ee11-8f6e-00224814d330%7CRESIDENTIAL_MORTGAGES%7CClear%20Path%20Variable%20Home%20Loan | 27 | 11 | 0 | 0 |
| scroll down times 2 | 26 | 9 | 0 | 0 |
| mortgage-product | 26 | 9 | 0 | 0 |
| scroll down times 6 | 20 | 11 | 0 | 0 |
| mortgage-product-links | 20 | 11 | 0 | 0 |
