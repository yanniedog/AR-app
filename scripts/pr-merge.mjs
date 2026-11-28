#!/usr/bin/env node
import { hasGh, repoSlug } from './lib/gh-pr-review-threads.mjs';
import { requestPullRequestReconciliation } from './lib/pr-merge.mjs';

function parseArgs(argv) {
  const out = { pr: null, dryRun: false, enableOnly: false, noSync: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--enable-only') out.enableOnly = true;
    else if (a === '--no-sync') out.noSync = true;
    else if (a === '--pr' && argv[i + 1]) out.pr = Number(argv[++i]);
    else if (a.startsWith('--pr=')) out.pr = Number(a.slice(5));
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv);
  if (!hasGh() || !Number.isSafeInteger(args.pr) || args.pr < 1) {
    console.error('pr-merge: gh and --pr <positive integer> are required');
    process.exit(1);
  }
  const { owner, name } = repoSlug();
  const result = requestPullRequestReconciliation(args.pr, {
    repo: `${owner}/${name}`,
    dryRun: args.dryRun,
    skipBranchUpdate: args.enableOnly || args.noSync,
  });
  if (!result.ok) {
    console.error(result.stderr || result.stdout || 'Could not request PR reconciliation');
    process.exit(result.exitCode || 1);
  }
  console.log(result.stdout || `Guarded reconciliation requested for PR #${args.pr}`);
}
main();
