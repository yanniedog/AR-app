# #0002 Response bank cards promote the selected category above the others, preventing Home loans, Savings, and TD from forming equal aligned columns.

- 2026-07-23T05:48:54Z `issue`: Response bank cards promote the selected category above the others, preventing Home loans, Savings, and TD from forming equal aligned columns. [mobile/src/components/passthrough/PassThroughDashboard.tsx]
- 2026-07-23T05:49:35Z `attempt`: Replaced the selected-first stacked bank metrics with fixed SECTION_ORDER columns, equal flex widths, shared heights, and a subtle selected-category highlight. [mobile/src/components/passthrough/PassThroughDashboard.tsx] (partial)
- 2026-07-23T05:50:05Z `attempt`: TypeScript validation confirmed the fixed three-column lender-card layout compiles cleanly. [mobile/src/components/passthrough/PassThroughDashboard.tsx] (worked)
- 2026-07-23T05:50:10Z `fix`: Every lender card now uses equal, consistently ordered Home loans, Savings, and Term deposits columns. [mobile/src/components/passthrough/PassThroughDashboard.tsx]
