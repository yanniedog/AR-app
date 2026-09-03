import assert from 'node:assert/strict';
import test from 'node:test';

import { withReleaseEnvironment } from './inject-eas-release-env.mjs';

const config = {
  build: {
    preview: {
      distribution: 'internal',
      env: { AR_APP_DISTRIBUTION_CHANNEL: 'sideload' },
    },
    production: { env: { AR_APP_DISTRIBUTION_CHANNEL: 'play' } },
  },
};

test('injects the calculated version into only the selected EAS profile', () => {
  const result = withReleaseEnvironment(config, 'preview', '1.2.345', '987');
  assert.deepEqual(result.build.preview.env, {
    AR_APP_DISTRIBUTION_CHANNEL: 'sideload',
    AR_APP_RELEASE_VERSION: '1.2.345',
    AR_APP_ANDROID_VERSION_CODE: '987',
  });
  assert.deepEqual(result.build.production, config.build.production);
  assert.equal(config.build.preview.env.AR_APP_RELEASE_VERSION, undefined);
});

test('rejects unknown profiles and invalid release values', () => {
  assert.throws(() => withReleaseEnvironment(config, 'missing', '1.2.3', '9'), /unknown/i);
  assert.throws(() => withReleaseEnvironment(config, 'preview', 'latest', '9'), /semantic/i);
  assert.throws(() => withReleaseEnvironment(config, 'preview', '1.2.3', '0'), /positive/i);
});
