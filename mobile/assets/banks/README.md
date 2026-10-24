# Bank artwork

The app bundles bank-supplied artwork so bank identification works offline and during network-isolated audits. `sources.json` records the 2026-10-24 banking CDR Register snapshot, original download URLs and SHA-256 digests, and the packaged PNG identities. Bank website artwork replaces stale or unusable register URLs. Three existing bundled marks are retained where they provide a clearer or accessible source.

PNGs preserve aspect ratio and transparency, remove surrounding whitespace, and fit within 256 by 128 pixels using a bounded colour palette. Known bundled marks take priority over older payload artwork. Unknown or retired names without verified artwork keep their initial mark instead of borrowing another bank's logo.

The brands and logos remain the trademarks of their respective owners and are used to identify the corresponding product provider. Update the source record and packaged digest together when replacing an asset. The local asset test verifies file integrity, dimensions, visible artwork, and distinct Queensland Country/BOQ identities without making network requests.
