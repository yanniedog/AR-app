#!/usr/bin/env node
import { updatePrBranch } from './lib/pr-branch-sync.mjs';
import { hasGh } from './lib/gh-pr-review-threads.mjs';

let pr = null;
let dryRun = false;
for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if (arg === '--dry-run') dryRun = true;
  else if (arg === '--pr' && process.argv[index + 1]) pr = Number(process.argv[++index]);
  else if (arg.startsWith('--pr=')) pr = Number(arg.slice(5));
}

if (!hasGh() || !Number.isInteger(pr) || pr <= 0) {
  console.error('pr-update-branch: gh and --pr <positive integer> are required');
  process.exit(1);
}

const result = updatePrBranch(pr, { dryRun });
console.log(`branch update ${result.action}: ${result.detail}`);
if (result.hint) console.error(result.hint);
process.exit(result.ok ? 0 : result.exitCode || 1);
