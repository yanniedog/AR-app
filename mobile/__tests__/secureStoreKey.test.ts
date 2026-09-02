import * as SecureStore from 'expo-secure-store';

import {
  defineSecureStoreKey,
  SECURE_STORE_KEY_ERROR_MESSAGE,
  SECURE_STORE_KEYS,
} from '../src/lib/secureStoreKey';

describe('SecureStore key contract', () => {
  it('registers every static key with an Expo-compatible value', () => {
    expect(SECURE_STORE_KEYS).toEqual({
      debugLogUploadReceipt: 'ar.debug-log.public-upload-receipt.v1',
      payloadDecryptionKey: 'ar.payload.deckey',
      performanceAuditRollbackScenario: 'performance-audit-rollback-scenario-v1',
      trackedRateAuditRollbackMetadata:
        'ar-rates.performance-audit.tracked-rate-metadata.v1',
      trackedRateMetadata: 'ar-rates.tracked-rate-metadata.v1',
      userRateScenario: 'user-rate-scenario-v1',
    });
    expect(Object.isFrozen(SECURE_STORE_KEYS)).toBe(true);

    for (const key of Object.values(SECURE_STORE_KEYS)) {
      expect(defineSecureStoreKey(key)).toBe(key);
    }
  });

  it('accepts the tracked-rate dynamic chunk format', () => {
    expect(
      defineSecureStoreKey(`${SECURE_STORE_KEYS.trackedRateMetadata}.chunk.abc-123.0`),
    ).toBe('ar-rates.tracked-rate-metadata.v1.chunk.abc-123.0');
  });

  it.each([
    '',
    '@ar/debug-log/public-upload-receipt-v1',
    'has/slash',
    'has space',
    'has:colon',
    'mötley',
  ])('rejects unsupported key %p', (key) => {
    expect(() => defineSecureStoreKey(key)).toThrow(SECURE_STORE_KEY_ERROR_MESSAGE);
  });

  it('keeps the Jest SecureStore mock aligned with Expo validation', async () => {
    const invalidKey = '@invalid/key';
    await expect(SecureStore.getItemAsync(invalidKey)).rejects.toThrow(
      SECURE_STORE_KEY_ERROR_MESSAGE,
    );
    await expect(SecureStore.setItemAsync(invalidKey, 'value')).rejects.toThrow(
      SECURE_STORE_KEY_ERROR_MESSAGE,
    );
    await expect(SecureStore.deleteItemAsync(invalidKey)).rejects.toThrow(
      SECURE_STORE_KEY_ERROR_MESSAGE,
    );
  });
});
