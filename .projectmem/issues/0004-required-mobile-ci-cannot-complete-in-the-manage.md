# #0004 Required mobile CI cannot complete in the managed sandbox because Expo Doctor requires outbound Expo API access and the escalation was rejected.

- 2026-07-23T05:56:05Z `issue`: Required mobile CI cannot complete in the managed sandbox because Expo Doctor requires outbound Expo API access and the escalation was rejected. [mobile/package.json#scripts.ci]
- 2026-07-23T05:56:12Z `attempt`: Ran npm run ci; Expo Doctor stopped at 16/18 checks because its config-schema and React Native Directory validations could not reach the Expo API (EACCES), and network escalation was rejected. [mobile/package.json#scripts.doctor] (failed)
- 2026-07-23T06:01:27Z `attempt`: Completed the safer local CI stages individually: typecheck, lint (0 errors), 8 script tests, all 550 Jest tests, and Android/iOS/web export passed; only Expo Doctor's two online checks remain blocked. [mobile/package.json#scripts.ci] (partial)
