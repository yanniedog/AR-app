# Native Android baseline evidence

This repository retains the modest app-only subset used by the
[redesign inventory](../../ANDROID_REDESIGN_INVENTORY.md). Retrieve these paths
from the same Git commit as the inventory, or download that commit's repository
archive. [manifest.json](manifest.json) records each capture's repository path,
SHA-256, byte length, app package, version/build and published APK source SHA.
The version association comes from the capture operator's installed-APK
verification and retained release manifests; screenshots do not embed an app
version field.

The capture environment was Android 16/API 36.1, x86_64 emulator, 1080 x 2400,
420 dpi, font scale 1.0. This is native emulator evidence, not browser or physical
device acceptance. No APK, personal-account export or competitor screenshot is
included.

## Historical friction baseline: v1.0.237/build 295

Package: `com.eyex.australianrates`. Published APK source:
`947884a4daf0323c30401453de38d579e75b193d`.
The [published manifest](v1.0.237-b295/published-apk-manifest.json) retains the
versioned download URL, APK SHA-256/size and signer identity.

| Capture | Evidence |
| --- | --- |
| [05-fresh-ready.png](v1.0.237-b295/05-fresh-ready.png) / [XML](v1.0.237-b295/05-fresh-ready.xml) | Onboarding default job/type choices; does not prove completed setup/calculation |
| [12-rates.png](v1.0.237-b295/12-rates.png) / [XML](v1.0.237-b295/12-rates.xml) | Initial Rates preview, five tabs and adjacent displayed rate variants |
| [13-product-top.png](v1.0.237-b295/13-product-top.png) / [XML](v1.0.237-b295/13-product-top.xml) | Opened product header/facts |
| [14-product-middle.png](v1.0.237-b295/14-product-middle.png) / [XML](v1.0.237-b295/14-product-middle.xml) | Product facts/history controls after scrolling |
| [15-product-saved.png](v1.0.237-b295/15-product-saved.png) / [XML](v1.0.237-b295/15-product-saved.xml) | Saved state and changed product-header geometry |
| [16-saved.png](v1.0.237-b295/16-saved.png) / [XML](v1.0.237-b295/16-saved.xml) | One saved rate displayed; not an independent exact-identity audit |
| [17-market.png](v1.0.237-b295/17-market.png) / [XML](v1.0.237-b295/17-market.xml) | Market directory baseline |
| [19-tools-hub.png](v1.0.237-b295/19-tools-hub.png) / [XML](v1.0.237-b295/19-tools-hub.xml) | Tools directory baseline |
| [24-rates-bottom.png](v1.0.237-b295/24-rates-bottom.png) / [XML](v1.0.237-b295/24-rates-bottom.xml) | Below-preview “See all 6243 home loans” and additional directories |
| [26-before-press.png](v1.0.237-b295/26-before-press.png) / [XML](v1.0.237-b295/26-before-press.xml); [27-held-button.png](v1.0.237-b295/27-held-button.png) | Before/held press states; no hierarchy was retained for the held image |
| [28-search-results.png](v1.0.237-b295/28-search-results.png) / [XML](v1.0.237-b295/28-search-results.xml) | Full Search list, 6243 products |
| [baseline-motion.mp4](v1.0.237-b295/baseline-motion.mp4) | Retained native interaction recording; no measured frame-timing or physical-haptic claim |

The screenshots/hierarchies are state evidence. The linked
[scoped operator report](operator-report.md) preserves the retained sequence
description. Its counts are operator-reported scoped observations, not complete
independently verified task totals. No original instrumented input/timestamp log
is available. File names, screen clocks and a pair of states are not a substitute
for that log; Phase 5 will retain fresh instrumented baseline/final ledgers.
The startup System UI ANR prevents reliable baseline completion-time claims.

## Later published context: v1.0.239/build 296

The [phase1-settled.png](v1.0.239-b296/phase1-settled.png) capture follows verified
installation of the later published APK. It shows **onboarding**, despite its
filename. No paired hierarchy was retained. The
[published manifest](v1.0.239-b296/published-apk-manifest.json) identifies package
`com.eyex.australianrates`, APK source
`f756137cddcb9a0a360b13150424af6f2ccea9bc`, versioned URL, size and SHA-256.
It does not replace the v1.0.237 friction baseline or accept the newer PR source
`7e4caee4e4fbd1957449c372761aece5cf6a7e5b`.

## Identity verification

Resolve each `manifest.json` path from the repository root and compare its file
length and SHA-256. For example, PowerShell `Get-FileHash -Algorithm SHA256`
or `sha256sum` can validate downloaded files. Never infer app version from the
PNG alone or call this historical set native acceptance of a redesign build.
