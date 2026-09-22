# RBA rates page

`/rba` is a dedicated page, available as **RBA rates** in the hamburger menu.
It shows the confirmed cash-rate target, the next scheduled decision, two
interactive outlook graphs, cash-rate history and bank responses. An elapsed
meeting without a recorded result is labelled as awaiting its decision.

## Sources and meaning

- **RBA J1:** median economist cash-rate forecasts, by target quarter. Survey and
  publication dates are displayed. Respondent extremes are not presented as a
  confidence interval, and survey forecasts are not described as market prices.
- **RBA F17:** analytical Australian government-bond forward rates for 0, 3, 6,
  9 and 12 months. Horizons start from the observation date. Bond forwards
  include risk premiums; they are not OIS, cash futures or meeting probabilities.
- **ASX RBA Rate Tracker:** opens the official tracker outside the app through
  the existing confirmation. Daily next-meeting probabilities and cash-futures
  curves are not copied into the app. An appropriately licensed feed is needed
  before adding those charts directly.

Primary sources:

- <https://www.rba.gov.au/statistics/tables/csv/j1-cash-rate.csv>
- <https://www.rba.gov.au/statistics/tables/csv/f17-forward-rates.csv>
- <https://www.rba.gov.au/copyright/>
- <https://www.asx.com.au/markets/trade-our-derivatives-market/futures-market/rba-rate-tracker>
- <https://www.asx.com.au/legals/terms-of-use>

Source: Reserve Bank of Australia, 2026. Checked 22 September 2026: latest J1
survey 1 August, published 28 August; latest F17 observation 31 August, published
4 September. These dates are evidence of the implementation check, not hardcoded
production values. Reduced official source extracts are retained only as tests.

## Reliability and accessibility

The two sources refresh independently with an eight-second request timeout.
Successful refreshes use a fifteen-minute recheck interval; partial and offline
results retry on the next visit or resume. A failed or older response cannot erase
newer cached data. Cache recovery validates both primary and temporary files and
preserves the newest source vintages after interrupted writes. Offline and partial
refreshes retain each source's original dates. Only normalized public observations
are cached; no user financial inputs are sent.

Graphs have labelled percentage axes, a dashed cash-rate reference, written
percentage-point differences, spoken summaries and date buttons at least 48dp
high. Narrow graphs use fewer axis labels while keeping all date buttons.
The page waits for catalogue hydration before loading the decision calendar.

App health now visits `rba.dashboard` and exercises both graph selectors.
Local audits use the public-data cache without starting network requests; missing
observations return explicit unavailable results. Readiness waits for measured
chart layout.

## Verification

- Canonical `cd mobile && npm run ci`: 18 Expo Doctor checks, TypeScript, ESLint
  (12 existing warnings), 129 script tests, 227 Jest suites / 2,252 tests,
  Android/iOS/web exports and artifact-size guards.
- Focused regressions cover real-source parsing, source dates, refresh races,
  offline/partial cache retries and interrupted writes, selection, layout readiness,
  menu navigation, diagnostics export identities, external destination restrictions
  and delayed catalogue hydration.
- External Chrome: normal onboarding, hamburger navigation, empty source state,
  dated graphs, selection changes, explanations, source confirmation and history.
  Desktop and narrow phone layouts checked. The isolated browser test cache was
  populated from live official RBA responses by a temporary local QA helper;
  direct browser requests did not return usable curves. The helper is not shipped.
- Physical Android execution and native timing remain unverified; no connected
  device was available. Export/build evidence must not be described as device QA.

No AR-local, Pi, ingest or payload-publication changes are involved.
