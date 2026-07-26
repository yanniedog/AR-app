# AR-app Agent Instructions

This repo owns only the installable Expo app and app-release automation.

- Do not make Pi, ingest, dashboard, payload-builder, or systemd changes here.
- Daily CDR payloads are published by `yanniedog/AR-local`; keep app payload URLs pointed there unless a later migration explicitly changes that.
- APK update releases belong to `yanniedog/AR-app`.
- Use `cd mobile && npm run ci` as the primary local verification path.
- Keep the `mobile/` directory layout until a separate flattening migration is planned.

## Cursor Cloud specific instructions

- The app requires Node >=24 (see `engines` in `mobile/package.json` and `package.json`). Node 24 is installed via nvm and login shells pick it up automatically. If `node -v` ever prints v22 (the system `/exec-daemon/node` can win in non-login shells), prepend the nvm bin first: `export PATH="$(ls -d "$HOME"/.nvm/versions/node/v24.*/bin | sort -V | tail -1):$PATH"`.
- The only product to run is the Expo app in `mobile/`. There are no backend services to start; all external data sources (payload host, Firebase, RBA/CDR) are optional and the app degrades gracefully.
- Run the app in dev with `cd mobile && npx expo start --web --port 8081` (serves at http://localhost:8081). It boots offline against the bundled sample payload in `mobile/assets/sample/`, so no network or secrets are needed to browse rates. `npm run ios` / `android` need native emulators not available here; web is the reliable in-VM target.
- `cd mobile && npm run ci` is the full gate (expo-doctor, tsc, eslint, `node --test` script tests, jest, then `expo export` for all platforms) and takes ~90s.
