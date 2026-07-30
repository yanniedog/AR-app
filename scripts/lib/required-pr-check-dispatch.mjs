/**
 * GITHUB_TOKEN-created pull requests do not emit the normal pull_request
 * workflow event. Explicit workflow_dispatch calls are exempt from that
 * recursion guard, so generated PR publishers must start every required check
 * against the generated branch.
 */
export function requiredPrCheckDispatches(prNumber, branchName) {
  const pr = String(prNumber || '').trim();
  const branch = String(branchName || '').trim();
  if (!/^\d+$/.test(pr)) throw new Error(`Invalid pull request number: ${pr || '(missing)'}`);
  if (!branch) throw new Error('Generated pull request branch is required');

  return [
    { workflow: 'app-ci.yml', ref: branch, inputs: [] },
    {
      workflow: 'cursor-auto-pr-review.yml',
      ref: branch,
      inputs: ['-f', `pr_number=${pr}`],
    },
    {
      workflow: 'pr-bot-presence-gate.yml',
      ref: branch,
      inputs: ['-f', `pr_number=${pr}`],
    },
    {
      workflow: 'pr-bot-feedback-check.yml',
      ref: branch,
      inputs: ['-f', `pr_number=${pr}`],
    },
  ];
}
