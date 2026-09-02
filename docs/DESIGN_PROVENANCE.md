# Rate Ledger design provenance

Status: auditable source record
Scope: visual system, typography, icon approach and design guidance

## Authorship position

Rate Ledger is an original interface system designed for the Australian Rates product and its data contracts. It was not assembled from a UI kit or generated from a one-line style prompt. The identity, palette roles, Rate Mark, layout grammar, copy rules, evidence states and local icon geometry are project-specific decisions.

No AI-generated raster artwork is required or accepted for the redesign. A claim that every viewer will perceive a product as “human made” cannot be guaranteed; this record instead makes the craft accountable: each external input is pinned, each incorporated asset is licensed, and each local choice has a documented product reason.

## Incorporated open-source runtime assets

| Project | Exact source | Licence | Incorporated use |
|---|---|---|---|
| Commissioner | `kosbarts/Commissioner@16865a9483b54bd633b5471b109792db44f7786e` | SIL Open Font License 1.1 | Static 400, 500, 600 and 700 UI/numeric fonts |
| Newsreader | `productiontype/Newsreader@cfcb4f7af0e52c25e8df2a2431814c8e5fe2e155` | SIL Open Font License 1.1 | Static 500, 600 and 500 italic editorial fonts |
| Iconoir | `iconoir-icons/iconoir@d7dfa4d0341df0670bfed9fc24221c9d7ef2112e` | MIT | Selected utility paths adapted into the local semantic SVG registry; the Rate Mark is not derived from Iconoir |

Canonical source pages:

- <https://github.com/kosbarts/Commissioner/tree/16865a9483b54bd633b5471b109792db44f7786e>
- <https://github.com/productiontype/Newsreader/tree/cfcb4f7af0e52c25e8df2a2431814c8e5fe2e155>
- <https://github.com/iconoir-icons/iconoir/tree/d7dfa4d0341df0670bfed9fc24221c9d7ef2112e>

The app never fetches font files at runtime. The seven required static binaries are checked in under `mobile/assets/fonts/`, and `mobile/assets/fonts/SOURCES.json` records their pinned sources, weights, licence files and SHA-256 digests. The corresponding OFL and MIT notices are checked in under `mobile/assets/licenses/`. Current recorded digests are:

| File | SHA-256 |
|---|---|
| `Commissioner-Regular.ttf` | `44abbc5907648b15f9e179b55614f49a31328400f20b8d7108da27d83c05daf3` |
| `Commissioner-Medium.ttf` | `55c23e3fd35d6d86dcf58fdd72089cedbd938f97ef5237b14a8391a46703d62b` |
| `Commissioner-SemiBold.ttf` | `d2c7d8962919ad8f71cd1dc749b512fc382f66ea537db007f39d16034809ac17` |
| `Commissioner-Bold.ttf` | `49b79365c17d88b2a209560f883bcca104f2e43cfd17b5b9ade586bd46c45f4a` |
| `Newsreader-Medium.ttf` | `ee2f66ee4c6c313acf211c952211f8c6c0c0d9fa6a17cd0ec0ceba13418b1aed` |
| `Newsreader-SemiBold.ttf` | `9e29bad1d5022c1a3d1822469a62dc9fa66cc41ba553f352530f867f84ba1c8f` |
| `Newsreader-MediumItalic.ttf` | `a7e93b7f83811d96aaf9bdb5909f4b836c0990ffea45f074868ed081056e2276` |

`mobile/src/theme/fonts.ts` defines the same stable family keys used by the root loader. Verification must re-hash the checked-in bytes and compare them with `SOURCES.json`; a manifest entry alone is not sufficient.

Local verification on 3 September 2026 re-hashed all seven checked-in `.ttf` files with SHA-256; every byte digest matched the value above and the checked-in source manifest. Runtime rendering remains a separate Android/iOS/web acceptance check.

## Studied developer resources (not dependencies)

| Resource | Pinned source/version | Licence/status | Influence and boundary |
|---|---|---|---|
| Adobe Leonardo | upstream `adobe/leonardo@eb6481da40df27654ac8efa42038007f6fad2431` | Apache-2.0 | Informed the repeatable palette/contrast method. No package or code is redistributed. |
| React Native Testing Library | upstream `17a3435962a0d3958bba95685f64d4f5241623c4` | MIT | Informed behaviour-first component-testing criteria. No package or code is redistributed. |

Canonical references:

- <https://github.com/adobe/leonardo/tree/eb6481da40df27654ac8efa42038007f6fad2431>
- <https://github.com/callstack/react-native-testing-library/tree/17a3435962a0d3958bba95685f64d4f5241623c4>

Studied resources do not appear in the in-app notice because their code is not installed or redistributed. Iconoir appears in the notice because adapted icon geometry is runtime code. If bundling behaviour changes, update this record and the in-app notice in the same change.

## Workflow reference not incorporated

Maestro CLI 2.10.0 (Apache-2.0) informed the proposed native journey and screenshot-regression workflow, but is not a checked-in repository dependency: <https://github.com/mobile-dev-inc/Maestro/releases/tag/cli-2.10.0>.

## Public guidance used

The following guidance shaped decisions but is not redistributed content:

- Australian Government Style Manual: plain language, sentence case, inclusive and Australian usage — <https://www.stylemanual.gov.au/>
- Moneysmart: consumer-centred framing and financial-information caution — <https://moneysmart.gov.au/>
- ASIC guidance and regulatory context — <https://asic.gov.au/>
- WCAG 2.2: contrast, focus, reflow, target size and status-message requirements — <https://www.w3.org/TR/WCAG22/>
- React Native accessibility documentation — <https://reactnative.dev/docs/accessibility>
- GOV.UK data visualisation guidance: readable annotation and non-colour cues — <https://design-system.service.gov.uk/styles/data-visualisation/>

These sources inform principles; app copy must not imply government, ASIC, ACCC, OAIC, Treasury, Data Standards Body or lender endorsement.

## Original project work

The following are created specifically for Rate Ledger and remain project code/artwork:

- Rate Mark geometry: three ledger rules, a movement stroke and one datum;
- light and dark semantic palette and compatibility mapping;
- paper/rule/asymmetry layout grammar;
- evidence-state model and canonical data-status language;
- the semantic icon registry, naming and optical normalisation around the selected attributed Iconoir-derived utility paths;
- screen composition, content hierarchy and Australian-English interface copy;
- rate, comparison, ongoing, coverage and failure presentation rules.

## Asset intake procedure

For every third-party asset added after this record:

1. select a tagged release or full commit SHA; never use an unpinned branch URL;
2. confirm the repository and exact file licence at that revision;
3. download from the pinned source on a trusted connection;
4. calculate SHA-256 and record repository, revision, source path, local path and hash in the asset manifest;
5. preserve the required licence and attribution in the app bundle;
6. scan binary type and ensure its extension matches its contents;
7. verify there is no runtime CDN dependency or tracking request;
8. render on Android, iOS and web and check fallback behaviour;
9. add or update the in-app third-party notice;
10. have a human review the actual rendered result and licence record before merge.

Do not paste paths from an icon repository, add a font from a search result, or use generated images as placeholders while provenance is unresolved.

## Change record requirements

A redesign PR must state:

- which tokens or primitives changed and why;
- which screens were visually reviewed;
- screenshots for light/dark, small/large text and narrow/wide layouts;
- any incorporated third-party file and its source hash;
- whether copy or data semantics changed;
- accessibility and data-state checks performed;
- known deviations with an owner and removal date.

“Looks cleaner” is not an acceptable rationale. A change should name the user decision, data truth or accessibility problem it improves.
