const fs = require('node:fs');
const path = require('node:path');

// Fail closed when an upstream update changes the caller: every patch is a
// single known API adaptation, never a replacement of security-sensitive code.
function patchExport({ file, original, replacement, label }) {
  const source = fs.readFileSync(file, 'utf8');
  const beforeCount = source.split(original).length - 1;
  const afterCount = source.split(replacement).length - 1;
  if (beforeCount === 0 && afterCount === 1) return;
  if (beforeCount !== 1 || afterCount !== 0) {
    throw new Error(`${label}: unexpected upstream caller; review the compatibility patch before installing`);
  }
  fs.writeFileSync(file, source.replace(original, replacement));
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

if (require.main === module) patchQueryString();
module.exports = { patchExport, patchQueryString };
