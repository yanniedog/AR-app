import { execFileSync } from 'child_process';
import path from 'path';

const file = path.join(__dirname, '..', 'tools', 'app-explorer', 'hide-outdated.mjs');

function run<T>(expression: string): T {
  const code = `import * as m from ${JSON.stringify(file)};
const bot = 'github-actions[bot]';
const comment = (id, tag, extra = {}) => ({ id: 'n' + id, databaseId: id, author: bot, isMinimized: false,
  body: 'explorer run ' + id + ' on ' + tag + ' (audit)\\n\\nbody', ...extra });
console.log(JSON.stringify(${expression}));`;
  return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' })) as T;
}

describe('hide outdated explorer comments', () => {
  it('reads the app version from the comment title and compares numerically', () => {
    expect(run('m.versionOf("explorer run 1 on app-v1.0.329 (full)\\n\\nx")')).toEqual([1, 0, 329]);
    expect(run('m.versionOf("something else")')).toBeNull();
    expect(run<number>('m.compareVersions([1, 0, 10], [1, 0, 9])')).toBeGreaterThan(0);
  });

  it('selects only comments for releases older than the newest', () => {
    const ids = run<number[]>(`m.outdatedComments([comment(1, 'app-v1.0.9'), comment(2, 'app-v1.0.10'), comment(3, 'app-v1.0.10'), comment(4, 'app-v1.0.11')]).map(c => c.databaseId)`);
    expect(ids).toEqual([1, 2, 3]);
  });

  it('keeps the newest release and skips other authors, hidden and collapsed comments', () => {
    expect(run<number[]>(`m.outdatedComments([
      comment(1, 'app-v1.0.5'), comment(2, 'app-v1.0.5', { isMinimized: true }),
      comment(3, 'app-v1.0.5', { author: 'someone' }), comment(4, 'app-v1.0.5', { body: '<!-- explorer-collapsed -->\\nold' }),
      comment(5, 'app-v1.0.6'), comment(6, 'app-v1.0.6')]).map(c => c.databaseId)`)).toEqual([1]);
    expect(run(`m.outdatedComments([comment(7, 'app-v1.0.6')])`)).toEqual([]);
    expect(run(`m.outdatedComments([])`)).toEqual([]);
  });

  it('collapses a body into a details block that names the newer release', () => {
    const out = run<string>(`m.collapsedBody('explorer run 1 on app-v1.0.5 (audit)\\n\\nbody', [1, 0, 6])`);
    expect(out.startsWith('<!-- explorer-collapsed -->')).toBe(true);
    expect(out).toContain('<summary>explorer run 1 on app-v1.0.5 (audit) - Superseded by app-v1.0.6</summary>');
    expect(out).toContain('body');
  });
});
