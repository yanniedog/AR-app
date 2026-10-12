import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { collectDiff } from './qwen-pr-review.mjs';

export function verifyQwenDiff() {
  const initialDirectory = process.cwd();
  const root = mkdtempSync(join(tmpdir(), 'qwen-diff-'));
  const source = join(root, 'source');
  const reviewer = join(root, 'reviewer');
  const git = (cwd, ...args) => {
    const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    return result.stdout.trim();
  };
  try {
    mkdirSync(source);
    git(source, 'init', '--initial-branch=main');
    git(source, 'config', 'user.name', 'Review test');
    git(source, 'config', 'user.email', 'review-test@example.invalid');
    writeFileSync(join(source, 'code.js'), 'export const value = 1;\n');
    git(source, 'add', 'code.js');
    git(source, 'commit', '-m', 'base');
    const base = git(source, 'rev-parse', 'HEAD');
    writeFileSync(join(source, 'code.js'), 'export const value = 2;\n');
    git(source, 'commit', '-am', 'PR change');
    const head = git(source, 'rev-parse', 'HEAD');
    git(source, 'checkout', '-B', 'main', base);
    writeFileSync(join(source, 'base.js'), 'export const baseOnly = true;\n');
    git(source, 'add', 'base.js');
    git(source, 'commit', '-m', 'base advances');
    const advancedBase = git(source, 'rev-parse', 'HEAD');
    // Packed remote refs can advertise valid Git names that Windows cannot
    // materialize as loose filenames. Include an unrelated unsafe branch too.
    writeFileSync(join(source, '.git', 'packed-refs'), [
      '# pack-refs with: peeled fully-peeled sorted',
      `${advancedBase} refs/heads/release>hotfix`,
      `${advancedBase} refs/heads/unrelated>branch`,
      `${head} refs/pull/12/head`,
      '',
    ].join('\n'));
    git(root, 'clone', '--depth=1', '--single-branch', '--branch=main',
      pathToFileURL(source).href, reviewer);
    git(reviewer, 'config', 'remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*');
    assert.equal(git(reviewer, 'rev-parse', '--is-shallow-repository'), 'true');
    process.chdir(reviewer);
    const diff = collectDiff('release>hotfix', head, 60_000, '0012');
    assert.deepEqual(diff.reviewedFiles, ['code.js']);
    assert.match(diff.sections[0].text, /\+export const value = 2;/);
    assert.equal(git(reviewer, 'rev-parse', 'HEAD'), advancedBase);
    assert.equal(git(reviewer, 'status', '--porcelain'), '');
    assert.equal(readFileSync(join(reviewer, 'code.js'), 'utf8').trim(), 'export const value = 1;');
    assert.doesNotMatch(git(reviewer, 'for-each-ref', '--format=%(refname)'), />/);
    assert.throws(() => collectDiff('release>hotfix', base, 60_000, '12'), /SHA mismatch/);
  } finally {
    process.chdir(initialDirectory);
    rmSync(root, { recursive: true, force: true });
  }
}
