# AR-app Agent Instructions

This repo owns only the installable Expo app and app-release automation.

- Do not make Pi, ingest, dashboard, payload-builder, or systemd changes here.
- Daily CDR payloads are published by `yanniedog/AR-local`; keep app payload URLs pointed there unless a later migration explicitly changes that.
- APK update releases belong to `yanniedog/AR-app`.
- Primary local verification is **focused** tests for touched packages (e.g. `cd mobile && npx jest path/to/relevant.test.ts` or `npm run ci:unit` for jest + typecheck only). Full `cd mobile && npm run ci` is heavy (doctor/export/size/benchmarks) — leave it to GitHub Actions `mobile-ci` unless that gate failed and you need a local repro of the exact failing step. Do not run full local `ci` by default.
- Keep the `mobile/` directory layout until a separate flattening migration is planned.

## Consumer interface hard rules

- Follow [the Android redesign contract](docs/ANDROID_REDESIGN_CONTRACT.md): optimise friction, task completion, app complexity and sitemap complexity together.
- Explanatory application prose is prohibited everywhere, including helper/description/subtitle text, tooltips, native dialogs, accessibility hints and dynamically supplied marketing text. Keep concise headings, explicit actions/field labels and necessary financial/status facts. Do not move prose into a collapsed panel or rename its prop.
- Preserve rate metrics, eligibility, conditions, fees, assumptions, dates and unknown/unverified states as structured facts. Required legal/licence documents have a narrow document boundary, not a general help/diagnostics exemption.
- Core tasks must be discoverable without instructions: direct results, stable Rates/Saved/Market navigation, contextual actions and preserved input/filter/scroll state. No mandatory onboarding or directory gates.
- `cd mobile && npm run check:ui-copy` must report zero violations; GitHub `mobile-ci` (and full local `npm run ci` when used) includes this guard. Follow [the copy contract](docs/UI_COPY_CONTRACT.md). No grandfather baseline, route exemption, arbitrary string branding or renamed help prop.

## Global ship bar (canonical)

PR bot babysitting follows **[yanniedog/cursor-global-workflow](https://github.com/yanniedog/cursor-global-workflow)** — especially `WORKFLOW.md` steps 4–7, `skills/pr-fix-agent/SKILL.md`, and always-on rules `respond-to-each-review-comment.mdc`, `pr-review-bot-replies.mdc`, and `no-early-stop-after-pr.mdc`. Repo notes below specialize that bar for AR-app; when they conflict, prefer the global workflow unless this file states an AR-app exception.

## PR babysitting (mandatory — every repo, every session)

Do not stop after opening a PR. Always monitor each owned open PR (and any still open from this session) until squash-merged — without being asked. Prefer **one dedicated ship-bar / babysit loop per open PR number** (do not abandon a PR because another task started).

- After every push: commit, push, create/update the PR, then watch checks until they settle.
- Required gates here are `mobile-ci` and `bot-feedback-gate`.
- Qwen and `bot-presence-gate` are disabled. Do not enable either, add either to branch protection, dispatch either for generated PRs, or start the local Qwen runner unless the repository owner explicitly changes that policy.
- If Qwen is explicitly re-enabled later, keep it advisory and resource-bounded: use trusted reviewer code from protected `main`, one model call per PR head, at most 10 risk-ranked files and 60,000 diff characters, and cancel superseded runs.
- Qwen may publish only validated, line-addressable defects with direct revisions or GitHub suggestion blocks. Never add PR/file/script summaries, walkthroughs, praise, or whole-PR coverage.
- CodeRabbit, Sourcery, Codex, and Cursor remain visible in the bot matrix and all substantive findings still require disposition. Their quota or service availability must not make merge liveness depend on an external vendor.
- Run `npm run wait-for-bots -- --pr <N>` (repo root) until exit 0. With no required reviewer configured, this waits only for required CI to settle. Re-run while exit 2.
- Enable squash auto-merge via the repo wrapper: `npm run pr:merge -- --pr <N>` (auto squash, delete-branch, freshness). Do not use bare `gh pr merge --squash --auto` without `--delete-branch` / the wrapper.
- Do not declare the task done while any owned PR is open and mergeable by you. Never end on “CI green” alone.

## Bot feedback (mandatory — every finding, every session)

**babysit skill etc must always address PR bot feedback where appropriate.**

Babysit and PR-fix workers must follow the per-finding disposition rules below for every substantive PR bot finding, including advisory findings. Always respond to **all** substantive bot (and human) review feedback. Green CI does not replace thread closure. Bots in scope include Sourcery, Cursor Auto Review / Codex, Gemini, Copilot, CodeRabbit, Greptile, and similar.

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
