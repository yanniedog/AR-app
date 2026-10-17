const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { adaptLegacyYamlCli, patchLegacyYamlCli } = require('../patch-legacy-yaml-cli.cjs');

function registerLegacyYamlCliChecks(projectDir) {
  const lock = JSON.parse(fs.readFileSync(path.join(projectDir, 'package-lock.json'), 'utf8'));
  const legacy = Object.entries(lock.packages)
    .filter(([name, entry]) => name.endsWith('node_modules/js-yaml') && entry.version.startsWith('3.'))
    .map(([name]) => path.join(projectDir, name));

  test('legacy YAML CLI removes sprintf while preserving parsing, version and failures', () => {
    assert.ok(legacy.length > 0, 'exercise the actual legacy YAML consumer');
    assert.ok(!Object.keys(lock.packages).some(name => name.endsWith('node_modules/sprintf-js')));
    for (const directory of legacy) {
      const resolveFrom = createRequire(path.join(directory, 'package.json'));
      assert.equal(resolveFrom('argparse/package.json').version, '2.0.1');
      assert.throws(() => resolveFrom.resolve('sprintf-js'), { code: 'MODULE_NOT_FOUND' });
      const cli = path.join(directory, 'bin/js-yaml.js');
      const run = (args, input) => {
        const result = spawnSync(process.execPath, [cli, ...args], {
          input, encoding: 'utf8', timeout: 10_000,
          env: { ...process.env, NODE_OPTIONS: '--throw-deprecation' },
        });
        if (result.error) throw result.error;
        assert.equal(result.signal, null);
        return result;
      };
      for (const option of ['-v', '--version']) {
        const version = run([option]);
        assert.equal(version.status, 0);
        assert.equal(version.stdout, '3.15.2\n');
        assert.equal(version.stderr, '');
      }
      const help = run(['--help']);
      assert.equal(help.status, 0);
      for (const option of ['--compact', '--trace', '--version']) assert.ok(help.stdout.includes(option));
      assert.ok(!help.stdout.includes('--to-json'), 'the compatibility flag stays hidden');
      assert.equal(help.stderr, '');
      for (const args of [[], ['--to-json']]) {
        const valid = run(args, 'build:\n  android:\n    buildType: apk\n');
        assert.equal(valid.status, 0);
        assert.deepEqual(JSON.parse(valid.stdout), { build: { android: { buildType: 'apk' } } });
        assert.equal(valid.stderr, '');
      }
      const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'ar-yaml cli-'));
      try {
        const file = path.join(temporary, 'build profile.yaml');
        fs.writeFileSync(file, 'build:\n  android:\n    buildType: apk\n');
        const positional = run([file]);
        assert.equal(positional.status, 0);
        assert.deepEqual(JSON.parse(positional.stdout), { build: { android: { buildType: 'apk' } } });
        assert.equal(positional.stderr, '');
      } finally {
        fs.rmSync(temporary, { recursive: true, force: true });
      }
      const invalidOption = run(['--unknown-option']);
      assert.equal(invalidOption.status, 2);
      assert.match(invalidOption.stderr, /unrecognized arguments.*--unknown-option/i);
      for (const args of [[], ['--compact'], ['--trace']]) {
        const invalid = run(args, 'key: [unterminated\n');
        assert.equal(invalid.status, 1);
        assert.match(invalid.stderr, /YAMLException/);
      }
      const yaml = resolveFrom('./');
      const value = { build: { enabled: true }, list: ['a', 'b'] };
      assert.deepEqual(yaml.safeLoad(yaml.safeDump(value)), value);
    }
  });

  test('legacy YAML caller adapter is repeatable and rejects upstream source drift', () => {
    patchLegacyYamlCli(projectDir);
    patchLegacyYamlCli(projectDir);
    for (const directory of legacy) {
      const source = fs.readFileSync(path.join(directory, 'bin/js-yaml.js'), 'utf8');
      assert.equal(adaptLegacyYamlCli(source), source);
      assert.throws(() => adaptLegacyYamlCli(source + '\n// unexpected drift\n'), /unexpected upstream caller/);
    }
  });
}

async function checkIstanbulYamlConfig(projectDir) {
  const resolveFrom = createRequire(path.join(projectDir, 'package.json'));
  const { loadNycConfig } = resolveFrom('@istanbuljs/load-nyc-config');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ar-nyc-yaml-'));
  try {
    fs.writeFileSync(path.join(directory, 'package.json'), '{}');
    fs.writeFileSync(path.join(directory, '.nycrc.yaml'), 'all: true\ninclude:\n  - src/**/*.ts\nstatements: 90\n');
    const config = await loadNycConfig({ cwd: directory, nycrcPath: '.nycrc.yaml' });
    assert.equal(config.all, true);
    assert.equal(config.statements, 90);
    assert.deepEqual(config.include, ['src/**/*.ts']);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

module.exports = { registerLegacyYamlCliChecks, checkIstanbulYamlConfig };
