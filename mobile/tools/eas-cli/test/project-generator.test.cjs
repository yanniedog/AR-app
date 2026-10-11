const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { generateAppConfigAsync } = require('eas-cli/build/commandUtils/new/projectFiles');

test('real EAS project generator preserves nested config and filters unsafe merge keys', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ar-eas-compat-'));
  try {
    await fs.writeFile(path.join(directory, 'app.json'), JSON.stringify({
      expo: JSON.parse('{"name":"template","extra":{"retained":true,"toString":"unsafe"},"ios":{"supportsTablet":true},"toString":"unsafe","__proto__":{"polluted":true}}'),
    }));
    await generateAppConfigAsync(directory, {
      id: 'a7834c3e-b422-4a4a-9853-e8bb8a50a76f',
      name: 'Australian Rates', slug: 'australian-rates', ownerAccount: { name: 'yanniedog' },
    });
    const { expo } = JSON.parse(await fs.readFile(path.join(directory, 'app.json'), 'utf8'));
    assert.equal(expo.name, 'Australian Rates');
    assert.equal(expo.extra.retained, true);
    assert.equal(expo.extra.eas.projectId, 'a7834c3e-b422-4a4a-9853-e8bb8a50a76f');
    assert.equal(expo.ios.supportsTablet, true);
    assert.equal(expo.ios.bundleIdentifier, 'com.yanniedog.australianrates');
    assert.equal(expo.android.package, 'com.yanniedog.australianrates');
    assert.equal(Object.hasOwn(expo, 'toString'), false);
    assert.equal(Object.hasOwn(expo.extra, 'toString'), false);
    assert.equal(Object.hasOwn(expo, '__proto__'), false);
    assert.equal(Object.prototype.polluted, undefined);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
