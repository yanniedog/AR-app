# Bank rate overview

Home and Bank response share a Rates/Gap panel. Rates opens on Mean, with Min,
Mean, Median and Max choices for Mortgage, Savings and Term Deposits. Banks are
shown together, with alphabetical navigation highlighting one bank. Gap is the
matching mortgage mean minus matching savings mean, in percentage points.

All statistics use advertised rate tiers, with equal weight per matching tier
(not balances, customers, or loan volumes). Zero is a valid rate. Before
aggregation, current rows pass the shared mandatory eligibility and standard
product gates and the saved profile filters. Completed onboarding restricts
sections to selected interests. Required features without verified details
produce no matching rows. A gap requires both selected product lines and
matching rates on both sides for the bank and date.

The complete history is embedded in the normal verified core catalogue as
`bank_rate_history`. A separate row map becomes internal `bank_rate_tier` IDs before row quarantine; original catalogue rows remain unchanged on the wire.
Each tier stores run-length encoded `[start, length, ratesPercent]` observations
against a shared date axis. Missing observations remain blank, duplicate rate
tiers retain their statistical weight, and each admitted tier group is counted
once. The producer scans retained observations once during packaging.

The app validates and aggregates this local data synchronously after applying
its ordinary eligibility and profile filters. Home and Bank response show all
history together. There are no graph-history requests, daily-catalogue downloads,
progressive backfills, or Load more controls. Existing verified core caching,
refresh, correction, encryption, and Wi-Fi preferences cover the entire graph.
The signed app also includes a 97 KB gzip history snapshot for the exact verified
22 September 2026 catalogue. It attaches before quarantine on fresh downloads
and offline cache loads only when the core SHA-256 and observation date match.
It never replaces producer history or applies row IDs to a different revision.
Other older catalogues without the extension show current rates only.

The bundled snapshot contains dates, rates, and section-local numeric tier IDs,
not catalogue rows or credentials. Rebuild it with
`node mobile/scripts/bundle-bank-rate-history.mjs packed-core.json original-core.gz manifest.json output.json`.
The generator verifies the source gzip hash and exact equality of all original
catalogue facts before retaining only the history extension. The recorded source
manifest and history digest are included with the bundle.

Historical scope means the history of **currently matching tiers**, not a claim
that the user's present profile was applicable on every historical date. Exact
non-rate tier attributes must match a currently eligible row. A sibling tier's
best rate is never substituted. Changed descriptive attributes conservatively
break membership; no missing observations are inferred. Scope changes remove
old graph data immediately and invalidate in-flight work.

Verification: bankRateOverview tests cover statistics, zero rates, sections,
profile exclusion, feature evidence and gaps. bankRateHistory tests cover cache
identity, corrections, cancellation, loading limits and outages. BankRatesPanel
tests cover default tabs, controls and immediate profile changes. Full checks:
`cd mobile && npm run ci`. Browser QA uses external Chrome.
