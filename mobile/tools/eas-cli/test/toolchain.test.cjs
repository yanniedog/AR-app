const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const path = require('node:path');
const test = require('node:test');
const { EasJsonAccessor } = require('@expo/eas-json');
const { createValidator } = require('eas-cli/build/metadata/utils/ajv');

test('release build profiles remain valid and malformed profiles are rejected', async () => {
  const config = await EasJsonAccessor.fromProjectPath(path.resolve(__dirname, '../../..')).readAsync();
  assert.equal(config.build.production.android.buildType, 'app-bundle');
  assert.equal(config.build.preview.android.buildType, 'apk');
  await assert.rejects(
    EasJsonAccessor.fromRawString('{"build":{"production":{"android":{"buildType":"invalid"}}}}').readAsync(),
    /is not valid/,
  );
});

test('EAS metadata validates UUID formats with its own AJV factory', () => {
  const validate = createValidator().compile({
    type: 'object', properties: { id: { type: 'string', format: 'uuid' } }, required: ['id'],
  });
  assert.equal(validate({ id: 'a7834c3e-b422-4a4a-9853-e8bb8a50a76f' }), true);
  assert.equal(validate({ id: 'invalid' }), false);
  assert.equal(validate({}), false);
});

test('fingerprint diff preserves line-based change records', () => {
  const requireFromConsumer = createRequire(require.resolve('eas-cli/build/fingerprint/diff'));
  const changes = requireFromConsumer('diff').diffLines('same\nold\n', 'same\nnew\n');
  assert.deepEqual(changes.map(({ value, added, removed }) => ({ value, added: !!added, removed: !!removed })), [
    { value: 'same\n', added: false, removed: false },
    { value: 'old\n', added: false, removed: true },
    { value: 'new\n', added: true, removed: false },
  ]);
});

test('CommonJS telemetry consumers and Xcode retain their UUID APIs', () => {
  for (const consumer of ['@expo/bunyan', '@expo/rudder-sdk-node', 'xcode']) {
    const uuid = createRequire(require.resolve(consumer))('uuid');
    assert.equal(uuid.validate(uuid.v1()), true, consumer);
    assert.equal(uuid.validate(uuid.v4()), true, consumer);
  }
  const project = require('xcode').project('/tmp/toolchain-smoke.pbxproj');
  project.hash = { project: { objects: {} } };
  assert.match(project.generateUuid(), /^[A-F0-9]{24}$/);
});

test('release YAML parsing preserves nested configuration', () => {
  assert.deepEqual(require('yaml').parse('build:\n  platform: android\n'), { build: { platform: 'android' } });
});
