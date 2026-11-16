const fs = require('node:fs');
const path = require('node:path');

// Fail closed when an upstream update changes the caller: every patch is a
// single known API adaptation, never a replacement of security-sensitive code.
function replaceExpectedSource(source, { original, replacement, label }) {
  const beforeCount = source.split(original).length - 1;
  const afterCount = source.split(replacement).length - 1;
  if (beforeCount === 0 && afterCount === 1) return source;
  if (beforeCount !== 1 || afterCount !== 0) {
    throw new Error(`${label}: unexpected upstream caller; review the compatibility patch before installing`);
  }
  return source.replace(original, replacement);
}

function patchExport({ file, ...edit }) {
  const source = fs.readFileSync(file, 'utf8');
  const patched = replaceExpectedSource(source, edit);
  if (patched !== source) fs.writeFileSync(file, patched);
}

function patchQueryString(projectDir = path.resolve(__dirname, '..')) {
  const resolveFrom = require('node:module').createRequire(path.join(projectDir, 'package.json'));
  const pkg = resolveFrom('query-string/package.json');
  if (pkg.version !== '7.1.3') throw new Error(`Unsupported query-string version ${pkg.version}`);
  const decoder = JSON.parse(fs.readFileSync(path.join(path.dirname(resolveFrom.resolve('decode-uri-component')), 'package.json'), 'utf8'));
  if (decoder.version !== '0.5.0') throw new Error(`Unsupported decoder version ${decoder.version}`);
  patchExport({
    file: resolveFrom.resolve('query-string'),
    original: "const decodeComponent = require('decode-uri-component');",
    replacement: "const decodeComponent = require('decode-uri-component').default;",
    label: 'query-string decoder export',
  });
}

function patchAndroidScreenHeader(projectDir = path.resolve(__dirname, '..')) {
  const resolveFrom = require('node:module').createRequire(path.join(projectDir, 'package.json'));
  const pkgPath = resolveFrom.resolve('react-native-screens/package.json');
  const pkg = resolveFrom(pkgPath);
  if (pkg.version !== '4.16.0') throw new Error(`Unsupported react-native-screens version ${pkg.version}`);
  const file = path.join(path.dirname(pkgPath), 'android/src/main/java/com/swmansion/rnscreens/ScreenStackHeaderConfig.kt');
  const source = fs.readFileSync(file, 'utf8');
  // A nested toolbar can still be attached while an ancestor is being removed.
  // See software-mansion/react-native-screens#3777.
  const guarded = replaceExpectedSource(source, {
    label: 'Android screen header removal guard',
    original: '    fun onUpdate() {\n        val stack = screenStack',
    replacement: [
      '    private fun hasRemovingScreenAncestor(): Boolean {',
      '        var ancestor = parent',
      '        while (ancestor != null) {',
      '            if (ancestor is Screen && ancestor.isBeingRemoved) return true',
      '            ancestor = ancestor.parent',
      '        }',
      '        return false',
      '    }',
      '',
      '    fun onUpdate() {',
      '        if (hasRemovingScreenAncestor()) return',
      '        val stack = screenStack',
    ].join('\n'),
  });
  const patched = replaceExpectedSource(guarded, {
    label: 'Android screen header reattachment',
    original: '            toolbar.addView(view)\n            i++',
    replacement: [
      '            // removeViewAt can retain a disappearing child as an Android parent.',
      '            if (view.parent === toolbar && toolbar.indexOfChild(view) < 0) {',
      '                toolbar.endViewTransition(view)',
      '            }',
      '            if (view.parent == null) toolbar.addView(view)',
      '            i++',
    ].join('\n'),
  });
  if (patched !== source) fs.writeFileSync(file, patched);
}

if (require.main === module) {
  patchQueryString();
  patchAndroidScreenHeader();
  require('./patch-legacy-yaml-cli.cjs').patchLegacyYamlCli();
  require('./patch-task-manager-timers.cjs').patchTaskManagerTimers();
  require('./patch-background-task-scheduler.cjs').patchBackgroundTaskScheduler();
}
module.exports = { patchExport, patchQueryString, patchAndroidScreenHeader };
