# AR-app Agent Instructions

This repo owns only the installable Expo app and app-release automation.

- Do not make Pi, ingest, dashboard, payload-builder, or systemd changes here.
- Daily CDR payloads are published by `yanniedog/AR-local`; keep app payload URLs pointed there unless a later migration explicitly changes that.
- APK update releases belong to `yanniedog/AR-app`.
- Use `cd mobile && npm run ci` as the primary local verification path.
- Keep the `mobile/` directory layout until a separate flattening migration is planned.

## Global ship bar (canonical)

PR bot babysitting follows **[yanniedog/cursor-global-workflow](https://github.com/yanniedog/cursor-global-workflow)** — especially `WORKFLOW.md` steps 4–7, `skills/pr-fix-agent/SKILL.md`, and always-on rules `respond-to-each-review-comment.mdc`, `pr-review-bot-replies.mdc`, and `no-early-stop-after-pr.mdc`. Repo notes below specialize that bar for AR-app; when they conflict, prefer the global workflow unless this file states an AR-app exception.

## PR babysitting (mandatory — every repo, every session)

Do not stop after opening a PR. Always monitor each owned open PR (and any still open from this session) until squash-merged — without being asked. Prefer **one dedicated ship-bar / babysit loop per open PR number** (do not abandon a PR because another task started).

- After every push: commit, push, create/update the PR, then watch checks until they settle.
- Required gates here typically include `mobile-ci`, `bot-presence-gate`, and `bot-feedback-gate`.
- Run `npm run wait-for-bots -- --pr <N>` (repo root) until exit 0. Re-run while exit 2. If GitHub `bot-presence-gate` is still red after bots have posted, re-trigger it (comment / review event / `ready_for_review`) so Actions re-runs with bots present — avoid empty commits that only re-race CI when possible.
- Enable squash auto-merge when gates are otherwise satisfied (`gh pr merge --squash --auto` when write-capable).
- Do not declare the task done while any owned PR is open and mergeable by you. Never end on “CI green” alone.

## Bot feedback (mandatory — every finding, every session)

Always respond to **all** substantive bot (and human) review feedback. Green CI does not replace thread closure. Bots in scope include Sourcery, Cursor Auto Review / Codex, Gemini, Copilot, CodeRabbit, Greptile, and similar.

### After `wait-for-bots` exit 0 — synthesize first (global step 5b)

1. Fetch **all** review threads.
2. **Read every thread before replying to any.**
3. Post one `## Feedback plan` on the PR (implement / defer / decline per thread).
4. One code push for the implement set, then in-thread replies.

### Per finding (global step 6)

1. Prefer fixing valid bug risks, correctness gaps, and test holes in the same PR when in scope.
2. Reply in-thread with disposition and reason:
   - `implemented in <sha>`
   - `deferred — <reason>`
   - `declined — <reason>`
3. Resolve the thread after the reply (live gate requires resolution). Use ManagePullRequest `post_comment` (`in_reply_to`) and `resolve_comment` when `gh` cannot write.
4. Re-run `npm run pr:bot-feedback-check -- --pr <N>` until exit 0; confirm GitHub `bot-feedback-gate` is green.
5. After later pushes, re-check for **new** bot threads and handle them the same way before merge.

Low-signal noise (quota notices, empty “react with thumbs” prompts) can be left alone if the feedback gate classifies them as non-blocking; everything else gets an explicit response.
