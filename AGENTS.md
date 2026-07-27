# AR-app Agent Instructions

This repo owns only the installable Expo app and app-release automation.

- Do not make Pi, ingest, dashboard, payload-builder, or systemd changes here.
- Daily CDR payloads are published by `yanniedog/AR-local`; keep app payload URLs pointed there unless a later migration explicitly changes that.
- APK update releases belong to `yanniedog/AR-app`.
- Use `cd mobile && npm run ci` as the primary local verification path.
- Keep the `mobile/` directory layout until a separate flattening migration is planned.

## PR babysitting (mandatory — every repo, every session)

Do not stop after opening a PR. Always monitor each PR you own (and any still open from this session) until all required gates are green and the PR is ready for squash merge. Do this without being asked.

- After every push: commit, push, create/update the PR, then watch checks until they settle.
- Required gates here typically include `mobile-ci`, `bot-presence-gate`, and `bot-feedback-gate`.
- Run `npm run wait-for-bots -- --pr <N>` (repo root) until exit 0; if GitHub `bot-presence-gate` is still red after bots have posted, re-trigger it (e.g. empty commit / `synchronize`, or `ready_for_review`) so Actions re-runs with bots present.
- Resolve or clear bot feedback until `bot-feedback-gate` is green.
- Mark the PR ready for review when checks are green and the change is merge-ready; leave it draft only while intentionally incomplete.
- Do not declare the task done while any owned PR is blocked on failing/pending required checks. Keep iterating until it is clear for squash merge (or blocked only by something outside your write access — then state that explicitly and keep retrying what you can).
