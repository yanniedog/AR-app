/**
 * Return fallback workflow_dispatch calls for required checks whose normal
 * pull_request runs have not appeared. Current GitHub behavior creates those
 * runs in action_required state for GITHUB_TOKEN-authored PRs, so publishers
 * should approve and reuse them instead of always launching duplicate CI.
 */
export function requiredPrCheckDispatches(prNumber, branchName, observedWorkflowNames = []) {
  const pr = String(prNumber || '').trim();
  const branch = String(branchName || '').trim();
  if (!/^\d+$/.test(pr)) throw new Error(`Invalid pull request number: ${pr || '(missing)'}`);
  if (!branch) throw new Error('Generated pull request branch is required');
  const observed = new Set(
    (Array.isArray(observedWorkflowNames) ? observedWorkflowNames : [])
      .map((name) => String(name || '').trim())
      .filter(Boolean),
  );

  return [
    { workflow: 'app-ci.yml', ref: branch, inputs: [] },
    {
      workflow: 'pr-bot-feedback-check.yml',
      ref: branch,
      inputs: ['-f', `pr_number=${pr}`],
    },
  ].filter((dispatch) => !observed.has(dispatch.workflow.replace(/\.ya?ml$/i, '')));
}
