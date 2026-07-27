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
- Do not stop while `mergeStateStatus` is blocked on required checks or unresolved review threads. Keep watching until squash-merge ready (required checks green, threads resolved, branch current with base).
- Mark the PR ready for review when checks are green and the change is merge-ready; leave it draft only while intentionally incomplete.
- Do not declare the task done while any owned PR is blocked on failing/pending required checks. Keep iterating until it is clear for squash merge (or blocked only by something outside your write access — then state that explicitly and keep retrying what you can).

## Bot feedback (mandatory — every finding, every session)

Always respond to **all** bot review feedback appropriately. Do not ignore threads, skim past suggestions, or treat “gate green enough” as done while findings remain unaddressed. This applies to every bot that posts on the PR (Sourcery, Cursor/Codex, Gemini, etc.), every repo, every session — without being asked.

For each substantive finding:

1. **Read it fully** and decide: fix now, defer with reason, or decline with reason.
2. **Prefer fixing** valid bug risks, correctness gaps, and test holes in the same PR when the change is in scope.
3. **Reply in-thread** with a clear disposition (`implemented` / `fixed` / `deferred` / `declined` / `by design`) and a one-line rationale. Vague “thanks” is not enough.
4. **Resolve the thread** after the reply (live gate requires resolution, not reply alone). Use ManagePullRequest `post_comment` (`in_reply_to`) and `resolve_comment` when `gh` cannot write.
5. Re-run `npm run pr:bot-feedback-check -- --pr <N>` until it passes, then confirm GitHub `bot-feedback-gate` is green.
6. After later pushes, **re-check for new bot threads** and handle those the same way before calling the PR merge-ready.

Low-signal noise (quota notices, empty “react with thumbs” prompts) can be left alone if the feedback gate classifies them as non-blocking; everything else gets an explicit response.
