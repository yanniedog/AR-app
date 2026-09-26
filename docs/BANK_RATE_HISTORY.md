# Bank rate history

The Rates and Gap charts follow the exact current rate tiers admitted by the app's profile and product filters. They do not substitute bank-wide averages when a selected tier has no historical observation. Missing dates remain gaps.

`bank_rate_history` in a verified producer core is authoritative. For cores that lack it, `bankRateHistorySync.ts` prepares every bank before catalogue adoption using a portable numerical baseline and the selected immutable revision index. Bank selection reuses the prepared chart model and SVG paths; it does not fetch history. Profile changes aggregate only admitted current row references.

The baseline contains 134 published observations across the 137 calendar days from 13 May to 26 September 2026. It includes 44,044 historical tier signatures. Not every bank or currently matching tier existed on every date. For example, the September 26 AFG Home Loans Alpha mortgage cohort has 104 observed days starting June 13. May 14, June 26, and September 23 have no selected published core in this baseline.

## Refresh and offline recovery

Each historical date is bound to its selected manifest SHA-256. A refresh downloads only new or revised dates, reuses the current downloaded core for today, and replaces corrected observations. Failed corrections hide superseded values and remain retryable gaps. The saved index rejects revision rollback and equivocation. Persisted history is checksummed and retains edition bindings for offline restart, including when the next catalogue fails to install. The baseline works offline for its exact current core; subsequent catalogues use verified persisted bindings.

## Reproduce the baseline

Prepare a directory containing the public `dates-index.json`, exact selected manifest bytes at `manifests/YYYY-MM-DD.json`, and decrypted gzip core bytes at `cores/<core-sha256>.gz`. The generator checks every manifest hash, revision binding, core byte length, core hash, and decoded core date. Missing or invalid input aborts generation.

From `mobile/` run:

```sh
node scripts/bundle-portable-bank-rate-history.cjs /path/to/verified-input
npm run ci
```

The output is `src/data/portableBankRateHistory.snapshot.json`. Its compressed numerical history is 1,802,935 bytes, with decoded SHA-256 `075cc4d97f4cee61847f4820fe9f7b85144a0355ebe211655bcf224393e578e0`. It stores tier signature hashes and rate observations, not product text or customer data. The generator calls the shipping app's tier identity and rate parser rather than maintaining a second definition.

The baseline is a startup accelerator, not a daily app-release requirement: normal payload refresh extends and corrects the verified history cache.

The snapshot uses bounded base64 encoding, saving 1,201,951 bytes versus hexadecimal. The measured web bundle baseline is now 7,002,023 bytes to include this offline data. Android and iOS remain within their existing bundle budgets; APK, font, asset, and 5% growth limits are unchanged.
