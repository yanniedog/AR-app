# #0005 Reactive suitability dependencies trigger new exhaustive-deps warnings because the memo bodies do not explicitly read the revision token.

- 2026-07-23T05:56:58Z `issue`: Reactive suitability dependencies trigger new exhaustive-deps warnings because the memo bodies do not explicitly read the revision token. [mobile/app/(tabs)/index.tsx]
- 2026-07-23T05:57:57Z `attempt`: Made each gate-backed memo explicitly consume the revision token so exhaustive-deps recognizes the intentional invalidation dependency. [mobile/app/(tabs)/index.tsx] (partial)
- 2026-07-23T05:58:38Z `attempt`: Lint rerun passed with zero errors and only the repository's 15 pre-existing warnings; all six introduced exhaustive-deps warnings are gone. [mobile/app/(tabs)/index.tsx] (worked)
- 2026-07-23T05:58:48Z `fix`: Gate-backed memos now explicitly consume the suitability revision without adding lint warnings. [mobile/app/(tabs)/index.tsx]
