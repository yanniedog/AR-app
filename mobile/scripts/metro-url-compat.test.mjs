import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const folder = path.dirname(fileURLToPath(new URL('../metro.config.js', import.meta.url)));
const require = createRequire(new URL('../package.json', import.meta.url));
function resolver() {
  const context = {
    __dirname: folder,
    module: { exports: {} },
    require: () => ({ getDefaultConfig: () => ({ resolver: {} }) }),
  };
  vm.runInNewContext(readFileSync(path.join(folder, 'metro.config.js'), 'utf8'), context);
  return context.module.exports.resolver.resolveRequest;
}

test('all platforms resolve CommonJS punycode for the WHATWG URL consumer', () => {
  const resolve = resolver();
  for (const platform of ['web', 'android', 'ios']) {
    const context = {
      resolveRequest: (actualContext, name, actualPlatform) => {
        assert.equal(actualContext, context);
        assert.equal(actualPlatform, platform);
        return { filePath: require.resolve(name) };
      },
    };
    const result = resolve(context, 'punycode', platform);
    const punycode = require(result.filePath);
    assert.deepEqual(punycode.ucs2.decode('A😀'), [65, 0x1F600]);
  }
});

test('URL compatibility resolution preserves unrelated packages and crypto workaround', () => {
  const resolve = resolver();
  const context = {
    mainFields: ['browser', 'module', 'main'],
    resolveRequest: (actualContext, name, platform) => ({ actualContext, name, platform }),
  };
  assert.equal(resolve(context, 'react-native', 'android').actualContext, context);
  const crypto = resolve(context, '@noble/hashes/crypto', 'web');
  assert.deepEqual([...crypto.actualContext.mainFields], ['module', 'main']);
  assert.equal(crypto.name, '@noble/hashes/crypto');
});
