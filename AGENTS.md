# AR-app Agent Instructions

This repo owns only the installable Expo app and app-release automation.

- Do not make Pi, ingest, dashboard, payload-builder, or systemd changes here.
- Daily CDR payloads are published by `yanniedog/AR-local`; keep app payload URLs pointed there unless a later migration explicitly changes that.
- APK update releases belong to `yanniedog/AR-app`.
- Use `cd mobile && npm run ci` as the primary local verification path.
- Keep the `mobile/` directory layout until a separate flattening migration is planned.

## Codex Cloud

- Use the Linux universal image with Node.js 24 pinned in the environment.
- Configure the setup command as `bash .codex/cloud/setup.sh` and the maintenance command as `bash .codex/cloud/maintenance.sh`.
- Keep agent-phase internet access off. The app CI path uses checked-in lockfiles and Firebase placeholder files and does not require production credentials.
- Do not add Expo, EAS, Firebase production, Android signing, release, SSH, or GitHub tokens to the Cloud environment. Builds, signing, publishing, and deployment remain in GitHub Actions/EAS.
- Before handing off code changes, run `cd mobile && npm run ci`. If a task only changes repository automation outside `mobile/`, run the narrowest relevant script plus `git diff --check`.
