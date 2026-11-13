# Headless catalogue audit repair — 2026-11-14

Shipping v267's command-line payload audit omitted catalogue selector evidence.
The catalogue check therefore always returned unavailable, which the producer's
unchanged deployment validator rejects. A command-line audit also has no device
history-rendering evidence or personal saved-profile scope.

The CLI now runs the actual shipping catalogue scanner and default preferences
over verified core, details and search-index inputs. Exact identity mismatches
still fail; missing inputs and blocked visibility remain unavailable. Explicit
headless scope reports absent device history as WARN with unknown history and
false rendered/pixel claims. The native audit's requirements remain unchanged.

Pure rate-policy constants retain their exact values and config re-exports.
Native interaction scheduling loads the real manager only when invoked. Customer
question labels likewise load the same transport-bound verifier only when that
capability is used; no binding, authority or validation is removed. The CLI's
PNG loader accepts only checked-in bank artwork paths and supplies file identity,
not rendered-image evidence. No selectors or business data are stubbed.

Verification: 55 CLI tests; 104 catalogue/selector/scheduler tests; 19 existing
customer-question authority tests passed. Typecheck and UI-copy guard passed
(zero violations). The old bundled fixture predates search publication; its
positive CLI control derives an index with the shipping indexer from unchanged
retained details, and removing it still yields unavailable.

An actual retained November 13 candidate produced 17 PASS/WARN checks, zero
catalogue identity mismatches, 2,824 published products, 103 providers and 16,728
rates. History and physical rendering remain unverified, and private-candidate
publication verification remains false. This development-tree result must be
repeated from the final clean shipping commit; it is not APK/device acceptance
or proof of full upstream bank/product coverage. Exact CI, review, automatic
merge/release and final producer-bound app evidence remain outstanding.

Late review: validate decoded search-index schema/products before selector
scanning. Malformed but hash-valid JSON now yields failed asset evidence plus an
unavailable catalogue check, preserving the complete audit report. Default
visibility/interests are asserted against shipping preferences. Duplicate source
tier identities already fail the independent exact-tier check; a CLI regression
confirms this rather than weakening or duplicating that guard. The branch also
incorporates shipping `94392216` before its final CI cycle.
After synchronization and review repairs, all 61 CLI tests, 147 focused app tests
and typecheck passed. Full CI and fresh shipping-commit acceptance remain required.
