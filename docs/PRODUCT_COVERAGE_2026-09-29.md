# Product coverage audit — 29 September 2026

The app's default suitability filter was excluding ordinary retail products in
all three categories. The repair corrects specific classification errors; it
does not remove profile requirements or enable the full catalogue by default.

## Reproducible source

The selected immutable publication is
[`app-payload-2026-09-29-r000001`](https://github.com/yanniedog/AR-local/releases/download/app-payload-2026-09-29-r000001/manifest.json).
The manifest was checked against the published dates-index revision head. Core
and details were downloaded through the app's configured delivery service and
checked against the manifest's byte lengths and SHA-256 hashes:

- Core: `0b6fd476d916591d9eb8f187d3d7654faa91e784fb48f45d51fc896d177650cd`
- Details: `e37cf7c3ba401aa132f93848ef4e5040eb55085a170d6682c8ab9c1a4c7a4e80`

The app comparison baseline is main commit `4bf46cd`. Counts below use distinct `product_key` values and the shipping shared
`isBroadlyAvailable` predicate with matching product details. They precede
user profile selections, screen filters and the deposit token-rate floor.

| Category | Published products with rates | Before | After |
| --- | ---: | ---: | ---: |
| Mortgage | 1,449 | 963 | 1,049 |
| Savings | 735 | 305 | 324 |
| Term deposits | 647 | 316 | 395 |
| Total | 2,831 | 1,584 | 1,768 |

Visible rate tiers increase from 9,298 to 10,680, a net gain of 1,382 tiers and
184 products. These are catalogue-level measurements, not observations of an
installed phone's saved profile or cache. Savings/TD lists also remove rates
below 0.10%: after that unchanged floor the product counts are 1,049, 170 and 385.
At that default-list boundary, products increase from 1,430 to 1,604 (+174)
and rate tiers from 8,790 to 10,017 (+1,227), before saved-profile requirements.

## Corrected app classifications

- `staff assisted` application channels no longer imply staff-only eligibility
  (Bankwest Term Deposit and Hero Saver). Explicit STAFF codes still exclude.
- BUSINESS plus NATURAL_PERSON represents alternative applicant types unless
  there is explicit business-only evidence. Business product names, exclusive
  business access, separate membership restrictions and restricted distribution
  channels remain excluded. Examples restored include CommBank fixed home loans,
  NAB Term Deposit, Bank Australia deposits and Auswide Cash Management.
- A credit union's own name in contact instructions no longer creates a
  membership restriction. Actual membership/referral requirements remain.
- Northern Inland's ordinary term deposits are not made youth-only by an
  additional lower deposit minimum for young savers. Youth product names, age
  caps and standalone youth descriptions remain restricted.
- The conditional-deposit predicate no longer excludes mortgage rows because
  their loan rate structure is introductory. Conditional savings rates remain
  excluded under the existing default policy.
- Suitability cache schema 5 forces older exclusions to rebuild on upgrade.
- Verified public membership at Australian Military Bank, Defence Bank and
  Police Credit Union overrides brand-only occupation inferences and ordinary
  membership of those banks. Product-level staff, ADF/DHOAS, age and other
  restrictions remain enforced, including when a description repeats the brand.
- Australian Military Bank Capital Guaranteed Super and Police Credit Union
  Super MyWay remain non-standard retirement/SMSF accounts, including before
  details load. Explicit SMSF account descriptions and exclusive applicant
  requirements remain restricted; alternatives and negated restrictions do not.

Every newly admitted product identity was inspected by provider and product.
The only newly excluded product is Judo's Home Loan, whose published description
explicitly limits it to business lending customers. Regression fixtures retain
exact row identities and the description/eligibility/constraint fields consumed
by the classifier. Tests cover cold and indexed lists, search, bank grouping,
mandatory profile requirements and retained restriction boundaries.

Independent provider references corroborate examples:
[Bankwest term deposit](https://www.bankwest.com.au/term-deposit),
[CommBank fixed home loans](https://www.commbank.com.au/home-loans/fixed-rate.html),
[Northern Inland deposits](https://www.nicu.com.au/banking/investments-term-deposits).
Public membership statements:
[Australian Military Bank](https://support.australianmilitarybank.com.au/about-us/can-anyone-join-australian-military-bank),
[Defence Bank](https://www.defencebank.com.au/tools-and-advice/faqs/deposit-accounts/),
[Police Credit Union](https://www.policecu.com.au/become-a-member/).

## Remaining source coverage and policy limits

This audit does not establish complete Australian-market coverage.

The publication reports 2,973 source products, of which 142 have no published
rate rows. Its accounting explicitly excludes 157 mortgage observations because
they describe a discount rather than an absolute interest rate. Those exclusions
are not missing app rows and must not be converted into invented rates.

There are 18 source failure records across eight providers: Aussie Home Loans,
Bank of Queensland, Bank of Sydney, CommFCU, DDH Graham, Geelong Bank, ME Go and
SWSbank. The source marks these providers partial, not complete.

Source classifications also need producer investigation:

- CommBank Standard Term Deposit has `account_class=non_standard`, despite
  describing individual and other applicant types. The app retains that source
  classification; the BUSINESS-alternative repair does not override it.
- Some source eligibility arrays list STAFF, STUDENT and PENSION_RECIPIENT
  together with NATURAL_PERSON (for example SWSbank term deposits). The app
  continues to respect these explicit restriction codes pending source review.
- Other provider-brand occupation rules and general membership rules remain
  in place; further exceptions require equivalent provider evidence rather
  than assuming every branded or member-owned institution is public.

Unspecified mortgage LVR, source non-standard classifications, conditional
deposit rates, genuinely restricted eligibility and saved profile requirements
remain enforced. Pi/ingest/payload-builder work belongs to AR-local and was not
changed by this app repair.
