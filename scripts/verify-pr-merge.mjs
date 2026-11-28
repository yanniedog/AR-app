#!/usr/bin/env node
import assert from 'node:assert/strict';
import { requestPullRequestReconciliation } from './lib/pr-merge.mjs';

const opts = { repo: 'yanniedog/AR-app', dryRun: true };
const command = 'gh workflow run pr-auto-merge.yml --repo yanniedog/AR-app --ref main -f pr_number=638';
assert.equal(requestPullRequestReconciliation(638, opts).stdout, `${command} -f skip_branch_update=false`);
assert.equal(requestPullRequestReconciliation(638, { ...opts, skipBranchUpdate: true }).stdout,
  `${command} -f skip_branch_update=true`);
assert.throws(() => requestPullRequestReconciliation(0, opts), /positive integer/);
console.log('verify-pr-merge: pass');
