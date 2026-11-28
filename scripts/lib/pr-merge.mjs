import { spawnSync } from 'node:child_process';
import { PROTECTED_BASE } from './pr-auto-merge-policy.mjs';

const GH_TIMEOUT_MS = 120_000;

/**
 * @param {number} prNumber
 * @param {{ repo: string, dryRun?: boolean, skipBranchUpdate?: boolean }} opts
 * @returns {{ ok: boolean, stdout: string, stderr: string, exitCode: number }}
 */
export function requestPullRequestReconciliation(prNumber, { repo, dryRun = false, skipBranchUpdate = false }) {
  if (!Number.isSafeInteger(prNumber) || prNumber < 1) throw new Error('PR number must be a positive integer');
  const args = ['workflow', 'run', 'pr-auto-merge.yml', '--repo', repo, '--ref', PROTECTED_BASE,
    '-f', `pr_number=${prNumber}`, '-f', `skip_branch_update=${skipBranchUpdate}`];
  if (dryRun) {
    return { ok: true, stdout: `gh ${args.join(' ')}`, stderr: '', exitCode: 0 };
  }
  const r = spawnSync('gh', args, { encoding: 'utf8', timeout: GH_TIMEOUT_MS });
  if (r.error?.code === 'ETIMEDOUT') {
    return {
      ok: false,
      stdout: '',
      stderr: `gh timed out after ${GH_TIMEOUT_MS}ms`,
      exitCode: 1,
    };
  }
  if (r.error) {
    return {
      ok: false,
      stdout: '',
      stderr: r.error.message,
      exitCode: 1,
    };
  }
  return {
    ok: r.status === 0,
    stdout: (r.stdout || '').trim(),
    stderr: (r.stderr || '').trim(),
    exitCode: r.status ?? 1,
  };
}
