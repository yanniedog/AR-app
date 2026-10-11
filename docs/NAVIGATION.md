# App navigation

The app has five permanent destinations, in this order. Navigation remains visible
on ordinary detail screens. Onboarding and modal comparisons use their own controls.

| Destination | Purpose | Screens it owns |
| --- | --- | --- |
| Home | A short task launcher | `/` |
| Rates | Find and compare products | `/browse`, `/search`, `/matches`, `/categories`, `/banks`, `/bank/[provider]`, `/product/[key]`, `/catalogue`, `/compare`, `/rate-receipt` |
| Saved | Watch a shortlist and manage alerts | `/watchlist` |
| Market | Understand rates and changes | `/market`, `/bank-rates`, `/passthrough`, `/rba-response`, `/rba`, `/research`, legacy `/trends` |
| Tools | Work with personal rates and needs | `/tools`, `/calculator`, `/projections`, `/calculation-receipt`, `/profile`; app settings and help |

## Finding things

- Rates → Home loans, Savings accounts or Term deposits → searchable products.
- Rates → Banks → bank → products and bank history.
- Rates → Matched rates → exact eligible product → save or compare.
- Rates → Product categories → category drill, with explicit ancestor navigation.
- Saved → product → rate details. Multiple saved rates can be compared together.
- Market → Bank rates over time, Recent rate changes, Bank response to the RBA,
  RBA rates and outlook, or Market research.
- Tools → Check my rate, Project my balance, or Your profile.
- Tools → Settings or About and help → diagnostics, terms and notices.

The labelled Menu is the complete directory. Its grouping agrees with the bottom
bar and breadcrumbs. Tools are never accessible only through a generic Options
button. Product types are edited in Your profile; the same preference remains
available in Settings. Rates only shows the user's selected types.

## Compatibility and state

The public `/browse` path is now the Rates hub. Existing `/browse?section=…&path=…`
links retain their exact category at `/categories`. `/node` redirects there too.
Empty category paths explicitly clear a previous drill. `/passthrough` retains its
public path as a detail screen under Market, and `/trends` keeps its existing
research/RBA redirect. Saved product and exact rate-tier identifiers do not change.

Matched-rate calculations move from Home to `/matches`; their suitability,
profile, evidence and rate semantics remain in place. Embedded bank-history and
projection sections are replaced by dedicated Market and Tools destinations.
Personal entered-rate summaries remain accessible below the saved shortlist.

Root pages render a lightweight directory without loading optional chart models.
Breadcrumbs identify canonical ownership on direct links; ordinary stack back
preserves the journey. The selected bottom tab identifies the parent section.

## Verification

`cd mobile && npm run ci` is the canonical check. Navigation tests cover all route
owners, menu destinations, back ancestry, native-intent acceptance, exact taxonomy
reset and compatibility links. Performance-audit plans address each real hub and
the moved detail surfaces, with layout/model evidence before completion.

Browser acceptance covers the five roots, menu, product discovery, category and
legacy links, Market destinations, Tools, and narrow layouts. Native installation
and audit acceptance must be reported separately from browser coverage.
