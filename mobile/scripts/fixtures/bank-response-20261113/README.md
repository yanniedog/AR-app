# Retained Bank response audit fixture

Public CDR/RBA observations retained from the real 2026-11-13 producer capture.
`provenance.json` binds the original compressed assets and source manifest.
`bank-history.json` and `rba-calendar.json` are their unchanged decoded bodies.

The core contains the first original rate row in each category, its original
section metadata/RBA series, and corresponding brand records. Details contain
those original products. Product fields, rates, dates and history are unchanged;
the full-source coverage claim is omitted because this is a subset. Test release
descriptors are generated separately. No personal profile or credentials exist
in this fixture. Missing historical baselines remain unknown.

This fixture tests the actual CLI reader and default projection. Full retained
payload qualification is recorded separately and does not establish live Pi,
publication, rendered-history or physical-device acceptance.
