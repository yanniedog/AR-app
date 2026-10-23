const path = require('node:path');
const fs = require('node:fs');
const { patchExport } = require('../../../scripts/apply-dependency-compat.cjs');
const { createRequire } = require('node:module');
const resolveFrom = createRequire(path.resolve(__dirname, '../package.json'));
require('../../../scripts/patch-legacy-yaml-cli.cjs').patchLegacyYamlCli(path.resolve(__dirname, '..'));
const pinned = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8')).dependencies['eas-cli'];
const installed = resolveFrom('eas-cli/package.json').version;
if (installed !== pinned) throw new Error(`Expected EAS ${pinned}, found ${installed}`);
if (!['23.2.0', '24.7.0', '24.12.0', '24.14.0'].includes(installed)) throw new Error(`Unsupported EAS compatibility target ${installed}`);
const dependency = JSON.parse(fs.readFileSync(path.join(path.dirname(resolveFrom.resolve('ts-deepmerge')), '../package.json'), 'utf8'));
if (dependency.version !== '8.0.0') throw new Error(`Unsupported ts-deepmerge version ${dependency.version}`);
patchExport({
  file: resolveFrom.resolve('eas-cli/build/commandUtils/new/projectFiles'),
  original: 'const ts_deepmerge_1 = tslib_1.__importDefault(require("ts-deepmerge"));',
  replacement: 'const ts_deepmerge_1 = { default: require("ts-deepmerge").merge };',
  label: 'EAS project generator merge export',
});
