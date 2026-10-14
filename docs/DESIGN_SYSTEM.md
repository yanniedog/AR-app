# Android rate browser design system

Approved direction: 14 October 2026. This supersedes the warm-paper Rate Ledger visual system. The [Android redesign contract](ANDROID_REDESIGN_CONTRACT.md) owns the product, navigation and content acceptance bar.

## Purpose and composition

Make a rate easy to find, distinguish, save and compare. Use Airtasker's Android interaction feel and Play Store browsing patterns as references: clear actions, immediate content, compact scanning and restrained tactile feedback. The timings below are our prototype targets, not measured competitor timings.

- White page, navy text and blue actions; a corresponding navy dark appearance.
- Content sits directly on the page with quiet separators. Bounded backgrounds belong to fields, sheets and controls.
- No gradients, decorative dashboards, hero paragraphs or galleries of cards.
- One dominant action per working region. Quiet actions remain named and reachable.
- Rates, Saved and Market are the primary destinations. Root results appear immediately; calculations, comparisons and history are contextual.
- Every transition preserves the user's query, filters, sort, inputs and position.

## Palette and typography

Semantic roles live in `mobile/src/theme/colors.ts`; components never invent colour meanings. Legacy `eucalyptus` and `wattle` roles temporarily alias blue primary, and `clay` aliases caution. New components use `primary`, `onPrimary`, `success`, `warning`, `danger`, `ink` and `mutedInk` directly.

| Role | Light | Dark |
| --- | --- | --- |
| Page | `#FFFFFF` | `#101A2B` |
| Raised surface | `#FFFFFF` | `#17243A` |
| Alternate surface | `#F3F5FA` | `#1D2C44` |
| Text | `#172B4D` | `#F6F8FC` |
| Secondary text | `#4F5F78` | `#C2CBDA` |
| Faint text | `#5A687D` | `#ABB8CC` |
| Primary | `#2563EB` | `#8BB5FF` |
| On primary | `#FFFFFF` | `#102241` |
| Success | `#147D57` | `#70D7B0` |
| Caution | `#936000` | `#E9BF72` |
| Danger | `#BD3043` | `#FFA7AB` |

Primary, success, caution and danger remain distinct. Use a written status or direction alongside colour. Decorative separators do not define interactive boundaries. Normal text and action labels meet 4.5:1 contrast; interactive boundaries meet 3:1. Wallpaper-derived colours never change financial meaning.

Android uses the system `sans-serif` family (Roboto) with real numeric weights. `fontStyle(weight)` returns both family and weight; setting only a family loses Android's weight distinctions. iOS/web retain the checked-in Commissioner static faces, with `fontWeight: normal`. Monospace belongs to raw diagnostics only.

| Role | Size / line | Weight |
| --- | --- | --- |
| Screen title / heading | 22 / 28 | 600 |
| Subheading | 18 / 24 | 600 |
| Control / product name | 16 / 24 | 500–600 |
| Body / field | 16 / 24 | 400 |
| Metadata / qualifier | 14 / 20 | 400–500 |
| Rate | 24 / 32 | 600 |
| Prominent rate | 32 / 40 | 600 |

Rates use tabular numerals. Text retains accessibility scaling; fixed line heights are removed above normal font scale. Important financial facts wrap, including secondary rate labels. Missing, zero and unpublished are different states.

## Space, controls and rows

Use 16 dp phone gutters and 24 dp wide gutters. Spacing is 4/8/12/16/24/32/48 dp. Reading content is at most 680 dp wide; dense data may use 920 dp. Controls use 12 dp radii, fields 14 dp, sheets 24 dp top corners, and chips pill radii. Minimum touch bounds are 48 × 48 dp and do not overlap adjacent controls.

- Product rows align identity beside an explicitly labelled rate on ordinary phones; widths below 340 dp or font scale at least 1.3 reflow vertically.
- Term, LVR, repayment, balance and conditional distinctions occupy a full-width factual row. Never truncate the fact set to two tags.
- Advertised, comparison, ongoing and conditional values retain exact labels. The ranking preference controls the primary mortgage figure without discarding its counterpart.
- The compact visible metric is “Comparison” or “Advertised”; its spoken label remains “Comparison rate” or “Advertised rate”. The secondary labelled figure joins the full-width factual metadata rather than occupying two extra lines in the narrow rate column.
- Save has a separate 48 dp target. Exact-tier save identity, logo readiness and memoised row subscriptions remain intact.
- Selected rows retain padding and trailing-column width. Checkboxes reserve the same leading width as logos. Saving changes the icon/state, not the row geometry.
- Loading buttons keep their label's measured geometry; a centred spinner overlays it.
- Fields use a persistent name and visible focus colour. Focus does not change border width or cause a layout jump. Placeholder values are never calculation inputs.
- Selected chips and tabs change state immediately. Labels, selected state and an indicator carry meaning.

Existing typed local `LedgerIcon`/`AppIcon` artwork remains the icon vocabulary. Extend that registry instead of introducing a second runtime icon family. Bundled font and icon licences remain available in About.

## Motion and sheets

`PressFeedback` owns tactile feedback. The outer `Pressable` and Android ripple stay stationary; only an inner content layer scales. A new press cancels the old animation before starting the next target.

| Interaction | Duration / target |
| --- | --- |
| Press | Native ripple immediately; 80 ms to scale 0.97 |
| Release / cancelled press | 160 ms to scale 1 |
| Selection state | Immediate; 160 ms optional feedback |
| Sheet open / close | Interruptible 240 ms |
| Reduced motion enabled or unresolved | No scale or travel; immediate state feedback |

All press controls share one OS reduced-motion subscription. Native animations use the native driver; no animation changes hit bounds or surrounding geometry. No bounce, parallax or looping decoration. Haptics require separate physical-device proof.

Animated content does not grow horizontally by default: chips and quiet buttons retain intrinsic widths. Full-width rows explicitly opt into content growth. This distinction prevents the shared press wrapper from changing a horizontal toolbar into several full-width rows.

`SheetSurface` is the shared single-layer native modal for filters and compact tasks. It retains a named close action, safe bottom inset, scrolling body and a persistent action footer. Keyboard avoidance keeps actions reachable. Android Back first dismisses an open keyboard, then closes the sheet; cancellation never applies the filter draft. Opening or closing during an animation cancels the prior transition. Filters prepare options and counts without blocking immediate chip selection.

## Content and verification

UI text may identify an action, field, identity, result, status or necessary fact. Explanatory prose is prohibited in screens, sheets, dialogs, accessibility hints and dynamic provider paths. Remove its containers and spacing. The Phase 4 text guard enforces that contract across all surfaces; this pilot adds no explanatory UI copy.

Retain structured rate qualifications, eligibility, fees, dates, observations, model assumptions and explicit unknown/stale/partial/unavailable states. Required legal/licence material remains explicitly opened document content. Do not flatten financial data into a misleading attractive number.

Verify the pilot in Android with find → filter → product → save → Back. Record the layout and interaction instead of claiming screenshots prove motion. Check 360/411 dp, large fonts, light/dark, reduced motion, keyboard, native Back, loading/offline/error states and interrupted presses/sheets. Compare total taps, choices, inputs, task time and recovery against the baseline. Canonical CI is `cd mobile && npm run ci`; rendered emulator, human-user and physical-device evidence are distinct.
