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
- Required gates here are `mobile-ci`, `qwen-code-review`, `bot-presence-gate`, and `bot-feedback-gate`.
- `qwen-code-review` is the repository-controlled required reviewer. Its formal review must identify the exact reviewed commit and a successful/no-findings/findings outcome. Failed, quota-limited, obsolete, or stale-head bot messages do not prove reviewer presence.
- Qwen runs on the dedicated local runner from reviewer code and instructions checked out from protected `main`; PR-head files are untrusted review data and must never be executed by the reviewer workflow.
- Qwen reviews bounded diff chunks and synthesizes them into the required Summary / Findings / Test Gaps format. Generic explanations or malformed output are failures, not reviewer presence.
- CodeRabbit, Sourcery, Codex, and Cursor remain visible in the bot matrix and all substantive findings still require disposition. Their quota or service availability must not make merge liveness depend on an external vendor.
- Run `npm run wait-for-bots -- --pr <N>` (repo root) until exit 0. Re-run while exit 2. If GitHub `bot-presence-gate` is still red after bots have posted, re-trigger a **PR-head** check (not a top-level issue comment — those run on the default-branch SHA and do not replace the failed check on the PR commit): prefer `ready_for_review`, a new `pull_request_review` / review-comment event, workflow re-run on the PR head when write-capable, or a fix/`synchronize` push. Prefer waiting until `mobile-ci` is green before a synchronize re-trigger so presence does not race CI.
- Enable squash auto-merge via the repo wrapper: `npm run pr:merge -- --pr <N>` (auto squash, delete-branch, freshness). Do not use bare `gh pr merge --squash --auto` without `--delete-branch` / the wrapper.
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
