# Official RBA source extracts

Fetched on 22 September 2026 from:

- `https://www.rba.gov.au/statistics/tables/csv/f17-forward-rates.csv`
- `https://www.rba.gov.au/statistics/tables/csv/j1-cash-rate.csv`

Source: Reserve Bank of Australia 2026.
Reuse terms: https://www.rba.gov.au/copyright/

These are reduced CSV extracts, preserving the original metadata and values.
F17 retains the 0, 0.25, 0.5, 0.75 and 1-year forward-rate columns and the final
three observations. J1 retains the final two surveys and all their published
summary measures. They are deterministic test fixtures, never production data.

F17's final observation is 31 August 2026, published 4 September 2026. The series
is an analytical government-bond forward curve that includes risk premiums.
It does not describe an OIS curve or individual RBA meeting probabilities.

J1's latest survey is 1 August 2026, published 28 August 2026. It reports median,
mean, low, high, response count and standard deviation; it does not publish
quartiles. Low/high are respondent extremes, not a forecast confidence interval.
