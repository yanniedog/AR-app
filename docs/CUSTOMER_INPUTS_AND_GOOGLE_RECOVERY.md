# Customer inputs and Google recovery

## Local customer inputs

CustomerProfile owns the encrypted scenario and comparison selections. The original scenario and comparison keys remain untouched migration evidence. Current amounts use canonical dollar strings; K/M/dollars are input presentation units. Historical opening values and hypothetical projection assumptions are distinct from current balances.

Existing version-4 scenarios are admitted. Migration retains conflicting values and exposes a one-time choice in Calculate. Cache clearing and rate refreshes do not delete customer inputs. Invalid encrypted storage is retryable and must not be rewritten as an empty profile. A successful persistence operation requires readback verification.

The scenario hook rebases changed fields against the latest committed profile. Profile answers and comparison controls subscribe to the same committed state. Financial eligibility continues to use exact source and input precision; percentage rounding is presentation only.

## Google release gate

Google recovery is **disabled**. No Google login or upload control is exposed in the app. `GOOGLE_RECOVERY_RELEASE` has three source-controlled prerequisites, all false:

1. Written Google consent covering backup/restoration of this app's customer inputs and preferences.
2. Google OAuth Android client registration for the actual package and distribution signing certificate, with Drive API and the narrow `drive.appdata` scope configured.
3. Signed-build acceptance of Google connection, account switching, revoke/reconnect, clear-storage/reinstall restoration, offline recovery and concurrent-device conflicts.

Google's [Drive terms](https://developers.google.com/workspace/drive/api/terms) require prior written consent for app-content backups. The [application-data guide](https://developers.google.com/workspace/drive/api/guides/appdata) separately documents configuration storage. Do not infer that the configuration guide authorizes the financial-data recovery use case. No request for Google's consent has been sent by this implementation.

## Implemented recovery foundation

- The Drive transport uses only the user's private `appDataFolder`. It validates account identity for every request, keeps access tokens out of URLs and stored customer documents, uses conditional updates and verifies uploaded data by readback.
- The customer snapshot exporter admits customer inputs and selected presentation preferences only. Migration originals, permission choices, diagnostics, credentials and downloaded financial data are excluded.
- Three-way merge preserves independent changes. Conflicting values require explicit device/Google selection; arrays remain atomic. Remote deletion does not silently erase local financial inputs.
- A serial sync coordinator retains local state on network failure, prevents account crossover, stops local restoration after disconnect and preserves edits made during upload.
- Default production constructors reject work before reading local data, requesting authorization or making network calls. Tests inject a gate solely for transport/merge verification.

## Work required after consent

Integrate Android Credential Manager authentication and Google Identity Services AuthorizationClient through the existing Expo native-module pattern. Follow [Google's separate authentication and authorization flows](https://developer.android.com/identity/authorization); do not add an AR authentication server or embed a client secret. Request Drive permission only when the user connects the feature. Reacquire short-lived access tokens via Google Play services and keep them out of customer storage.

Implement the encrypted per-account repository adapter for the sync coordinator. Its commit must compare the latest document under the customer-storage serial lock before applying restoration; retry when an edit races it. Keep the common sync snapshot and account binding encrypted. Account switching requires an explicit decision before applying existing local inputs to a different account.

Wire profile-change and foreground scheduling, retry with bounded backoff, and Settings connection/sync/conflict controls only after authentication exists. Restore and validate remote state before the first upload; never upload a newly initialized default profile over existing cloud data. Display Last synced only after readback and local commit both succeed. Disconnect preserves local inputs and removes cached credentials; deleting personal data is a separate explicit action.

Google manages remote protection. This design adds no user recovery password and no AR-operated user database. A user-deleted Drive document or inaccessible Google account cannot be recovered by the app. Until this gated release is accepted, Android Clear storage, uninstall and factory reset are outside the local-persistence guarantee.
