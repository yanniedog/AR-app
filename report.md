# App explorer: 1.0.399 (455)

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-29

Mode script | 16 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1
Baseline 1.0.398

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | launch true | 11709 |  | 31/45 | 300 | 418 | 1 errors; start 2284ms |
| 2 | profile top | 90 |  | 14/20 | 200 | 507 |  |
| 3 | profile-top | 0 |  |  |  | 490 |  |
| 4 | open account type | 4769 |  | 14/17 | 250 | 633 |  |
| 5 | account-type-sheet | 0 |  |  |  | 482 |  |
| 6 | back true | 20 |  | 2/3 | 32 | 482 |  |
| 7 | open features | 18 |  | 14/18 | 113 | 484 |  |
| 8 | features-sheet | 0 |  |  |  | 483 |  |
| 9 | back true | 18 |  | 2/3 | 16 | 484 |  |
| 10 | scroll down times 3 | 2139 |  | 28/56 | 69 | 484 |  |
| 11 | profile-mortgage-fields | 0 |  |  |  | 486 |  |
| 12 | open /product/Bank%20of%20Queensland%20Limited%7C59906e88-5c03-ee11-8f6e-00224814d330%7CRESIDENTIAL_MORTGAGES%7CClear%20Path%20Variable%20Home%20Loan | 2753 |  | 21/38 | 61 | 644 |  |
| 13 | scroll down times 2 | 1440 |  | 49/79 | 81 | 631 |  |
| 14 | mortgage-product | 0 |  |  |  | 623 |  |
| 15 | scroll down times 6 | 4208 |  | 55/122 | 65 | 669 |  |
| 16 | mortgage-product-links | 0 |  |  |  | 623 |  |

## Errors

### 1 launch true
```
11-28 15:39:34.956 E/australianrates( 4783): Not starting debugger since process cannot load the jdwp agent.
```
