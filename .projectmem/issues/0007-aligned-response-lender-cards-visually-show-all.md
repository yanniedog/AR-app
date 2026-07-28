# #0007 Aligned Response lender cards visually show all three section values, but their explicit accessibility label announces only the active section.

- 2026-07-23T07:32:40Z `issue`: Aligned Response lender cards visually show all three section values, but their explicit accessibility label announces only the active section. [mobile/src/components/passthrough/PassThroughDashboard.tsx]
- 2026-07-23T07:33:35Z `attempt`: Expanded each lender card's accessibility label to announce Home loans, Savings, and Term deposits values and timing, including no-series states. [mobile/src/components/passthrough/PassThroughDashboard.tsx] (partial)
- 2026-07-23T07:37:08Z `attempt`: Extracted the three-section accessibility label into a pure helper and added regression coverage for all aligned columns and full provider names; targeted tests passed. [mobile/__tests__/passThroughModels.test.ts] (worked)
- 2026-07-23T07:37:46Z `fix`: Response lender cards now announce Home loans, Savings, and Term deposits values and timing through a tested full accessibility label. [mobile/src/components/passthrough/PassThroughDashboard.tsx]
