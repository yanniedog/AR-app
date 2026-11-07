/**
 * Pure decisions for unattended owner PR merging and APK release catch-up.
 * Everything that talks to GitHub lives in scripts/pr-auto-merge-reconcile.mjs.
 */

export const HOLD_LABEL = 'hold';
export const PROTECTED_BASE = 'main';
/** Release runs pushed by a merge appear within a few minutes; wait past that. */
export const RELEASE_SETTLE_MS = 20 * 60 * 1000;

/**
 * @param {object} pr REST pull request
 * @param {{ owner: string, repo: string, trustedAuthors: string[], commitAuthors: (string|null)[] }} ctx
 * @returns {{ action: 'enable'|'disable'|'skip', reason: string }}
 */
export function decidePullRequest(pr, ctx) {
  if (pr.state !== 'open') return { action: 'skip', reason: 'not open' };
  if (pr.head?.repo?.full_name !== ctx.repo) return { action: 'skip', reason: 'fork or deleted head' };
  if (pr.user?.login !== ctx.owner) return { action: 'skip', reason: 'not an owner PR' };
  const held = pr.draft || (pr.labels ?? []).some(label => label?.name === HOLD_LABEL);
  if (held) return { action: 'disable', reason: pr.draft ? 'draft' : `labelled ${HOLD_LABEL}` };
  if (pr.base?.ref !== PROTECTED_BASE) return { action: 'skip', reason: `base ${pr.base?.ref} is not ${PROTECTED_BASE}` };
  const trusted = new Set(ctx.trustedAuthors);
  const foreign = ctx.commitAuthors.filter(login => !login || !trusted.has(login));
  if (!ctx.commitAuthors.length || foreign.length) {
    return { action: 'skip', reason: `commits not all from trusted authors (${[...new Set(foreign.map(l => l ?? 'unattributed'))].join(', ') || 'none'})` };
  }
  return { action: 'enable', reason: 'owner PR to main with trusted commits' };
}

/** Behind main and mergeable: update the branch so strict checks can pass. */
export function needsBranchUpdate(pr) {
  return pr.mergeable_state === 'behind';
}

/**
 * @param {{ head: string, headCommittedAt: string, releasedSha: string|null, mobileChanged: boolean,
 *   runsForHead: number, now: number }} input
 * @returns {{ dispatch: boolean, reason: string }}
 */
export function decideReleaseCatchUp(input) {
  if (!input.releasedSha) return { dispatch: false, reason: 'no previous APK release found' };
  if (input.releasedSha === input.head) return { dispatch: false, reason: 'main is already released' };
  if (!input.mobileChanged) return { dispatch: false, reason: 'no mobile changes since the last release' };
  if (input.runsForHead > 0) return { dispatch: false, reason: 'a release run already exists for this commit' };
  const age = input.now - Date.parse(input.headCommittedAt);
  if (!(age >= RELEASE_SETTLE_MS)) return { dispatch: false, reason: 'main changed recently; waiting for any push-triggered release' };
  return { dispatch: true, reason: 'main has unreleased mobile changes' };
}

/** Paths whose change warrants a new APK. */
export function isReleasePath(file) {
  return file.startsWith('mobile/') || file === '.github/workflows/mobile-android-apk.yml';
}
