import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { patchExport, patchAndroidScreenHeader } = require('./apply-dependency-compat.cjs');

test('caller export patch is idempotent and rejects source drift without modifying it', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ar-caller-patch-'));
  const file = path.join(directory, 'caller.cjs');
  const patch = { file, original: 'const merge = require("library");', replacement: 'const merge = require("library").merge;', label: 'test caller' };
  try {
    fs.writeFileSync(file, patch.original);
    patchExport(patch);
    patchExport(patch);
    assert.equal(fs.readFileSync(file, 'utf8'), patch.replacement);
    for (const drift of ['unknown caller', `${patch.original}\n${patch.original}`, `${patch.original}\n${patch.replacement}`]) {
      fs.writeFileSync(file, drift);
      assert.throws(() => patchExport(patch), /unexpected upstream caller/);
      assert.equal(fs.readFileSync(file, 'utf8'), drift);
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('Android stack header postinstall guards disappearing custom header views', () => {
  const directory = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'ar-screen-header-'));
  const pkg = path.join(directory, 'node_modules/react-native-screens');
  const file = path.join(pkg, 'android/src/main/java/com/swmansion/rnscreens/ScreenStackHeaderConfig.kt');
  const pristine = [
    '    fun onUpdate() {',
    '        val stack = screenStack',
    '            toolbar.addView(view)',
    '            i++',
    '    }',
  ].join('\n');
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(path.join(pkg, 'package.json'), '{"version":"4.16.0"}');
    fs.writeFileSync(file, pristine);
    patchAndroidScreenHeader(directory);
    const patched = fs.readFileSync(file, 'utf8');
    assert.match(patched, /fun onUpdate\(\) \{\s+if \(hasRemovingScreenAncestor\(\)\) return/);
    assert.match(patched, /if \(view\.parent === toolbar && toolbar\.indexOfChild\(view\) < 0\) \{\s+toolbar\.endViewTransition\(view\)\s+\}\s+if \(view\.parent == null\) toolbar\.addView\(view\)/);
    patchAndroidScreenHeader(directory);
    assert.equal(fs.readFileSync(file, 'utf8'), patched);
    for (const drift of [
      pristine.replace('val stack = screenStack', 'val stack = findStack()'),
      pristine.replace('toolbar.addView(view)', 'toolbar.attachView(view)'),
    ]) {
      fs.writeFileSync(file, drift);
      assert.throws(() => patchAndroidScreenHeader(directory), /unexpected upstream caller/);
      assert.equal(fs.readFileSync(file, 'utf8'), drift);
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
