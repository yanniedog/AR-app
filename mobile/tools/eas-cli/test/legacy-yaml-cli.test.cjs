const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
const test = require('node:test');
const { registerLegacyYamlCliChecks } = require('../../../scripts/lib/legacy-yaml-cli-checks.cjs');

registerLegacyYamlCliChecks(path.resolve(__dirname, '..'));

test('both EAS plugins retain their legacy Oclif YAML table output', () => {
  for (const plugin of ['@expo/plugin-help', '@expo/plugin-warn-if-update-available']) {
    const resolveFromPlugin = createRequire(require.resolve(`${plugin}/package.json`));
    const corePath = resolveFromPlugin.resolve('@oclif/core');
    const resolveFromCore = createRequire(corePath);
    assert.equal(resolveFromCore('js-yaml/package.json').version, '3.15.2');
    const { ux } = resolveFromPlugin('@oclif/core');
    const lines = [];
    ux.table([{ name: 'preview', platform: 'android' }], { name: {}, platform: {} }, {
      output: 'yaml', printLine: line => lines.push(line),
    });
    assert.deepEqual(resolveFromCore('js-yaml').safeLoad(lines.join('\n')), [{ name: 'preview', platform: 'android' }]);
  }
});
