# Rate Ledger design system

Status: implementation contract  
Product: Australian Rates mobile app  
Language: Australian English

## 1. Design intent

Rate Ledger is a calm, evidence-first interface for understanding Australian bank rates. It should feel like a carefully edited public-interest financial publication: warm paper, clear ink, ruled comparisons, date stamps and restrained signals. It must not resemble a generic component gallery, trading terminal or AI-generated dashboard.

Every visual choice serves one of three jobs:

1. make the rate and its meaning legible;
2. show where the figure came from and what may be missing;
3. help a person take the next sensible action without manufactured urgency.

The system intentionally avoids gradients, glass effects, glowing accents, decorative blobs, excessive shadows, interchangeable rounded cards and colour-only meaning.

## 2. Visual grammar

- Paper is the page. Raised paper is reserved for controls, sheets and bounded working areas.
- A thin rule separates related ledger entries. A rule is not a card border.
- One datum, underline or change stroke may carry emphasis; several competing accents may not.
- Rates align as tabular figures. Advertised, comparison and ongoing rates retain their exact labels.
- Editorial headings use a serif face. Interface labels and numeric content use a humanist sans.
- Asymmetry is welcome when it clarifies hierarchy: a large figure may sit beside a compact evidence column.
- A screen gets one dominant action. Secondary actions are outlined or quiet text actions.

## 3. Colour

The checked-in semantic tokens live in `mobile/src/theme/colors.ts`. Components use roles, never raw colour values.

### Light appearance

| Role | Token | Value | Use |
|---|---|---:|---|
| Paper | `paper` | `#F4F0E6` | Main page background |
| Raised paper | `raised` | `#FCFAF5` | Sheets, inputs, focused working areas |
| Ink | `ink` | `#15231F` | Primary text and marks |
| Muted ink | `mutedInk` | `#4D5D56` | Secondary text; accessible control boundary |
| Faint ink | `faintInk` | `#5C6B65` | Tertiary text, placeholders |
| Rule | `rule` | `#C9C1B2` | Decorative separators only |
| Eucalyptus | `eucalyptus` | `#2E6A56` | Links, focus, live/complete evidence |
| Deep eucalyptus | `eucalyptusDeep` | `#1E5141` | Strong positive text |
| Wattle | `wattle` | `#D5A62E` | Primary action fill, selected datum |
| Clay | `clay` | `#9B5133` | Caution, rate-up movement |
| Danger | `danger` | `#A43D37` | Unavailable/error states |
| Information | `info` | `#315F7D` | Neutral informational state |

### Dark appearance

| Role | Token | Value | Use |
|---|---|---:|---|
| Paper | `paper` | `#0E1714` | Main page background |
| Raised paper | `raised` | `#16211D` | Sheets and controls |
| Ink | `ink` | `#F3EFE4` | Primary text and marks |
| Muted ink | `mutedInk` | `#BAC3BD` | Secondary text |
| Faint ink | `faintInk` | `#A6B0AA` | Tertiary text |
| Rule | `rule` | `#34453E` | Decorative separators only |
| Eucalyptus | `eucalyptus` | `#72B89D` | Links, focus, live/complete evidence |
| Wattle | `wattle` | `#E2BC54` | Primary action fill, selected datum |
| Clay | `clay` | `#E18A67` | Caution, rate-up movement |
| Danger | `danger` | `#F09A93` | Unavailable/error states |
| Information | `info` | `#84B5D2` | Neutral informational state |

### Contrast rules

- Light ink/paper is approximately 14.3:1; muted ink/paper 6.1:1; eucalyptus/paper 5.6:1.
- Dark ink/paper is approximately 15.9:1; muted ink/paper 10.1:1; eucalyptus/paper 7.9:1.
- Wattle is a fill, not body text. Dark ink on light wattle is approximately 7.2:1.
- `rule` is deliberately quiet and does **not** meet text contrast. It may separate content but may not define a field, button, focus ring, chart series or other interactive state.
- Interactive boundaries use `controlRule`; focused controls use `eucalyptus`; errors use `danger` plus written explanation.
- Change direction always has a symbol and word. Colour is supporting information only.

The legacy `theme.colors` contract remains available while screens migrate. New work uses `theme.ledger`.

## 4. Typography

### Families

- **Commissioner** 400/500/600/700: body copy, interface labels, controls and all rate figures.
- **Newsreader** 500/600 and 500 italic: display, title and section heading roles.
- **System monospace**: raw debug-log payloads only. It must not leak into normal diagnostics, identifiers or rate tables.

Font keys are centralised in `mobile/src/theme/fonts.ts`. The app root loads only checked-in, hash-verified static font files. There is no runtime font download.

### Type roles

| Role | Size / line | Family | Default weight |
|---|---:|---|---:|
| Display | 40 / 44 | Newsreader | 600 |
| Title | 30 / 36 | Newsreader | 600 |
| Heading | 22 / 28 | Newsreader | 600 |
| Body | 16 / 24 | Commissioner | 400 |
| Label | 14 / 19 | Commissioner | 600 |
| Caption | 12 / 17 | Commissioner | 500 |
| Rate | 24 / 29 | Commissioner, tabular | 600 |
| Large rate | 38 / 42 | Commissioner, tabular | 600 |
| Debug mono | 12 / 18 | System monospace | 400 |

`LedgerText` removes fixed line-height constraints whenever the operating-system font scale is above 1. Screens must still be checked at 200% text size: no clipped rate, hidden evidence or unreachable action is acceptable.

## 5. Space, measure and shape

Named spacing tokens are 4, 8, 12, 16, 24, 32 and 48 dp. Avoid one-off values unless optical alignment genuinely requires them.

- Compact phone gutter: 16 dp.
- Wide phone/tablet gutter: 24 dp.
- Reading measure: 680 dp maximum.
- Dense data measure: 920 dp maximum.
- Minimum touch target: 48 by 48 dp.
- Small radius: 4 dp for buttons and small bounded controls.
- Control radius: 10 dp for inputs and compact panels.
- Sheet radius: 18 dp on exposed top corners only.
- Pill radius: filters, toggles and compact status chips only—not sections, cards or navigation destinations.

Large screens centre the measure and may use a two-column figure/evidence composition. They do not merely stretch phone cards across the window.

## 6. Brand and icons

The Rate Mark is original artwork in `mobile/src/components/RateMark.tsx`: three ledger rules, one movement stroke and a datum point. It does not depict a bank roof, dollar sign, house, coin or stock-market arrow.

The Rate Ledger line icons are implemented as a local code-native registry in `mobile/src/components/icons/LedgerIcon.tsx`:

- 24 dp view box;
- 1.8 dp optical stroke;
- round line caps and joins;
- no filled containers;
- labels come from the control, not duplicated by a decorative SVG;
- a standalone meaningful SVG must receive an accessibility label.

Selected utility icon geometry is adapted from pinned MIT-licensed Iconoir source into the local semantic registry, then normalised to the Rate Ledger optical grammar. The Rate Mark is wholly original. New icons must extend one of those documented sources rather than mixing Ionicons, Material Symbols and arbitrary illustrations on migrated surfaces.

## 7. Core primitives

New Rate Ledger primitives live under `mobile/src/components/ledger/`.

### `LedgerText`

The only default text primitive on migrated screens. Choose a semantic variant and colour role. Do not manually reconstruct heading sizes.

### `LedgerAction`

- `primary`: wattle fill and dark ink; at most one visible per screen region.
- `secondary`: ruled outline for a meaningful alternate action.
- `quiet`: low-chrome navigation or disclosure action.
- `destructive`: danger outline and explicit verb.

Labels describe the outcome: “Compare 3 rates”, “Save this rate”, “Try update again”. Avoid “Continue”, “Submit”, “OK” and conversational filler.

### `LedgerSection`

A ruled content chapter with optional title, deck, action and evidence. It replaces most card containers. Nested ruled sections are not allowed.

### `LedgerRow`

An aligned ledger entry with optional leading/trailing content. Interactive rows expose a button role, 48 dp target and chevron.

### `LedgerTabs`

Text tabs with a wattle datum/underline. Do not place primary navigation inside pills.

### `LedgerField`

Persistent external label, raised-paper field, accessible boundary, written hint/error and visible focus state. Placeholder text never replaces the label.

### `LedgerSheet`

A modal detail surface for filters, evidence and compact tasks. It respects reduced motion and provides a named close action. It is not a substitute for a full route when the task has multiple decisions.

### `RateFigure`

Pairs an exact semantic label with a tabular rate. Missing values say “Not published”; they never render as `0`, an empty area or a fabricated figure. Secondary rate types remain labelled.

### `ChangeIndicator`

Shows symbol, written direction, magnitude, context and date as available. “Up” is not automatically good and “down” is not automatically bad; the product context determines the explanation.

### `DataEvidenceLine`

A tappable evidence statement under every substantive data surface. It opens observed date, source, coverage counts, known failures, limitations and schedule details. The mapper in `mobile/src/data/displayEvidence.ts` owns the wording and precedence.

## 8. Data-state language

Use these canonical visible states:

| State | Short label | Required meaning |
|---|---|---|
| Current | `Updated today` | A verified remote observation is dated today |
| Complete | `Updated today · full coverage` | Attempted and succeeded counts are explicit, equal and non-zero; no partial/failed evidence exists |
| Partial | `Partial coverage` | A provider, asset or reconciliation is incomplete |
| Saved | `Saved copy` | Last-known-good on-device data is shown |
| Overdue | `Update overdue` | An explicit producer/scheduler deadline has passed |
| Sample | `Sample data` | Bundled illustrative data, never current rates |
| Offline | `Offline` | Network is unavailable and saved data is shown |
| Unavailable | `Data unavailable` | No verified usable value exists |

Never infer complete coverage from a quiet UI, a `200` response or an empty failure list without explicit attempted/succeeded evidence. Never infer overdue from age alone when no schedule threshold is available.

The UI may shorten the line but the detail sheet must preserve the underlying facts. Error, empty and partial states occupy the same intentional layout as success—not a blank card, spinner that never resolves or debug string.

## 9. Rate and data presentation

- Comparison rate is the default loan comparison metric when published, with the advertised rate still shown and labelled.
- Deposit bonus, introductory, base and ongoing rates stay distinct.
- Tier boundaries, balances, fixed terms, LVR, repayment type, fees and eligibility must not be flattened into one attractive number.
- `0%`, unavailable and not published are three different states.
- A ranking states its cohort, filters, observation date and inclusion rules.
- A chart has a written title, unit, date range, accessible summary and data fallback.
- When a series has gaps, retain the gaps. Do not interpolate unless the method and visual treatment are explicit.
- A saved or sample data set may be explored but cannot trigger current-rate language.

## 10. Motion

- State transition: 160 ms.
- Navigation transition: 240 ms.
- Easing: `[0.2, 0, 0, 1]`.
- No spring bounce, parallax, looping decoration or celebratory motion.
- Unknown reduced-motion state is treated as reduced motion.
- Refresh indicators may rotate only while work is active and must be accompanied by a written status for assistive technology.

## 11. Voice and content

- Australian English and sentence case.
- Lead with the fact: “3 lenders changed rates” rather than “Here’s what’s happening today”.
- Use ordinary financial language, then define necessary terms in context.
- Avoid synthetic enthusiasm, rhetorical questions, emoji, marketing claims and fake personalisation.
- State uncertainty directly: “Two providers could not be checked”, not “Some data may be unavailable”.
- State privacy at the decision point. Do not hide it in Terms.
- Legal and comparison-rate disclosures remain concise but visible near the affected decision.

## 12. Accessibility acceptance

Every migrated screen must pass all of the following:

- logical heading order and screen-reader order;
- 48 dp targets with non-overlapping hit areas;
- meaningful controls have names, roles, state and disabled/busy status;
- decorative SVGs are excluded from the accessibility tree;
- no information conveyed by colour, position or animation alone;
- text and controls remain usable at 200% font scale;
- portrait, landscape, 320 dp width and tablet layouts have no clipping or horizontal body scroll;
- keyboard focus is visible on web and external keyboards;
- sheets trap reading context, have a named close action and restore focus where supported;
- charts expose a concise data summary and a non-visual route to important values;
- reduced-motion mode removes non-essential transitions;
- light and dark appearances meet WCAG 2.2 AA for normal text and interactive boundaries.

## 13. Review test

Before accepting a new visual element, ask:

1. Does it clarify a rate, its evidence or the next action?
2. Does a shared Rate Ledger primitive already solve it?
3. Is its label exact and human-edited?
4. Does it still work without colour, motion, network or fresh data?
5. Does it introduce a generic rounded card, icon style or decorative effect that weakens the bespoke grammar?

If the first answer is no, remove it.
