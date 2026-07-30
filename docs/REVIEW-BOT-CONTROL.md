# Review bot control

The persistent dashboard is a pinned GitHub issue maintained by the
`review-bot-control` Actions workflow. Open that workflow and choose **Run
workflow** to apply a repository-owned control or refresh live status.

## Controls

- **Qwen disabled** cancels active Qwen runs, disables the Qwen workflow and
  presence workflow, sets `QWEN_ENABLED=false`, and sets
  `AR_BOT_WAIT_REQUIRED=off`.
- **Qwen advisory** enables the Qwen workflow but leaves Qwen and bot presence
  out of required checks. The dedicated Windows runner must also be enabled
  locally because GitHub cannot start an offline self-hosted runner.
- **CodeRabbit retry helper** controls only AR-app's rate-limit retry workflow.
  It does not install, suspend, or uninstall the CodeRabbit GitHub App.

`mobile-ci` and the vendor-neutral `bot-feedback-gate` remain required. Qwen,
bot presence, and every external vendor remain advisory.

## External GitHub Apps

GitHub Apps such as CodeRabbit, Codex, Cursor, Sourcery, Gemini, Copilot, and
Greptile are installed at the account or organization level. GitHub does not
provide a repository workflow with a universal per-app enable/disable API.
Use **Settings → Integrations → GitHub Apps → Configure** (linked from the
dashboard) to change repository access, suspend, or uninstall an app.

This boundary is deliberate: the dashboard never labels an external bot
"disabled" when it has only changed an AR-app variable or ignored the bot in a
gate.
