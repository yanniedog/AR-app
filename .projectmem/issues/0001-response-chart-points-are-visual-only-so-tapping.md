# #0001 Response chart points are visual-only, so tapping a plotted lender cannot reveal its bank name.

- 2026-07-23T05:47:11Z `issue`: Response chart points are visual-only, so tapping a plotted lender cannot reveal its bank name. [mobile/src/components/passthrough/ResponseScatter.tsx]
- 2026-07-23T05:48:12Z `attempt`: Added 32px SVG touch targets and provider-selection callback so tapping a response point toggles its lender label; verification pending. [mobile/src/components/passthrough/ResponseScatter.tsx] (partial)
- 2026-07-23T05:48:41Z `attempt`: TypeScript validation confirmed the tappable scatter callback and dashboard selection wiring compile cleanly. [mobile/src/components/passthrough/ResponseScatter.tsx] (worked)
- 2026-07-23T05:48:46Z `fix`: Response scatter points now expose a 32px touch target and select/toggle the lender label when tapped. [mobile/src/components/passthrough/ResponseScatter.tsx]
