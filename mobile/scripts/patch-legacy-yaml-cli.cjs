const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { createHash } = require('node:crypto');

// Only the legacy YAML command's argparse caller changes. The YAML loader and
// argparse's implementation remain the published, integrity-locked packages.
function adaptLegacyYamlCli(source) {
  const digest = createHash('sha256').update(source).digest('hex');
  if (digest === ADAPTED_SHA256) return source;
  if (digest !== ORIGINAL_SHA256) throw new Error('js-yaml CLI: unexpected upstream caller');
  let result = source
    .replace("  version:  require('../package.json').version,\n  addHelp:  true", '  add_help: true')
    .replace("cli.addArgument([ '-c', '--compact' ], {", "cli.add_argument('-c', '--compact', {")
    .replace("cli.addArgument([ '-j', '--to-json' ], {", "cli.add_argument('-j', '--to-json', {")
    .replace("cli.addArgument([ '-t', '--trace' ], {", "cli.add_argument('-t', '--trace', {")
    .replace("cli.addArgument([ 'file' ], {", "cli.add_argument('file', {")
    .replaceAll("  action: 'storeTrue'", "  action: 'store_true'")
    .replace('argparse.Const.SUPPRESS', 'argparse.SUPPRESS')
    .replace("  defaultValue: '-'", "  default: '-'")
    .replace('var options = cli.parseArgs();', 'var options = cli.parse_args();');
  const anchor = "\n\ncli.add_argument('-c', '--compact', {";
  result = result.replace(anchor, "\n\ncli.add_argument('-v', '--version', {\n  action: 'version',\n  version: require('../package.json').version,\n  help: \"show program's version number and exit\"\n});" + anchor);
  if (createHash('sha256').update(result).digest('hex') !== ADAPTED_SHA256) {
    throw new Error('js-yaml CLI: unexpected adapter output');
  }
  return result;
}

function patchLegacyYamlCli(projectDir = path.resolve(__dirname, '..')) {
  const lock = JSON.parse(fs.readFileSync(path.join(projectDir, 'package-lock.json'), 'utf8'));
  for (const [relative, entry] of Object.entries(lock.packages)) {
    if (!relative.endsWith('node_modules/js-yaml') || !entry.version.startsWith('3.')) continue;
    const directory = path.join(projectDir, relative);
    if (!fs.existsSync(directory)) continue; // npm may omit development packages.
    const resolveFrom = createRequire(path.join(directory, 'package.json'));
    const yaml = resolveFrom('./package.json');
    const parser = resolveFrom('argparse/package.json');
    if (yaml.version !== '3.15.2' || parser.version !== '2.0.1') {
      throw new Error(`Unsupported legacy YAML/argparse versions ${yaml.version}/${parser.version}`);
    }
    const file = path.join(directory, 'bin/js-yaml.js');
    const source = fs.readFileSync(file, 'utf8');
    const adapted = adaptLegacyYamlCli(source);
    if (adapted !== source) fs.writeFileSync(file, adapted);
  }
}

const ORIGINAL_SHA256 = '3d0c9cbce9363a08e5d932e6c843013059758e4bd426cd77d2e09a2a229a443f';
const ADAPTED_SHA256 = '4ed97e87f0ceb85ade2e962d21b4bcab26b16bdfa3d460a7ebb39eae0e3a4424';
module.exports = { adaptLegacyYamlCli, patchLegacyYamlCli };
