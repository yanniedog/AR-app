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

The current snapshot renders immediately. After navigation settles, the focused
screen warms at most seven missing historical catalogues, respecting automatic
Wi-Fi preferences. Load more history requests up to 30 prior observations.
When Wi-Fi-only preferences prevent automatic network use, history validation
is deferred entirely; current rates remain visible. Older cached observations
are retained across interrupted backfills and reused beyond the download cap.
Only one historical catalogue is processed at a time. The optional local cache
contains scoped aggregates, not product catalogues. Historical publication
identities are revalidated before reuse, including correction/rollback checks.
Four consecutive failures stop loading; missing dates break graph lines.

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
