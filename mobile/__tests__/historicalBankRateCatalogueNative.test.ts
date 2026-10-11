import { Platform } from 'react-native';
import { configureNativeHistoricalCatalogueCodec } from '../src/data/historicalBankRateCatalogueNative';
import { configureHistoricalCatalogueCodec } from '../src/data/historicalBankRateCatalogueCompression';
import { getNativeHistoryCodec } from '../modules/history-codec';
import { getWebHistoryCodec } from '../src/data/historicalBankRateCatalogueWeb';

jest.mock('../src/data/historicalBankRateCatalogueCompression', () => ({ configureHistoricalCatalogueCodec: jest.fn() }));
jest.mock('../modules/history-codec', () => ({ getNativeHistoryCodec: jest.fn() }));
jest.mock('../src/data/historicalBankRateCatalogueWeb', () => ({ getWebHistoryCodec: jest.fn() }));

afterEach(() => { jest.restoreAllMocks(); jest.clearAllMocks(); });

test('Android lazily registers its available native codec', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const codec = { compressAsync: jest.fn(), decompressAsync: jest.fn() };
  jest.mocked(getNativeHistoryCodec).mockReturnValue(codec);
  expect(await configureNativeHistoricalCatalogueCodec()).toBe(true);
  expect(configureHistoricalCatalogueCodec).toHaveBeenCalledWith(codec);
});

test('an Android binary without the module preserves the portable fallback', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.mocked(getNativeHistoryCodec).mockReturnValue(null);
  expect(await configureNativeHistoricalCatalogueCodec()).toBe(false);
  expect(configureHistoricalCatalogueCodec).not.toHaveBeenCalled();
});

test.each(['ios', 'web'] as const)('%s never resolves the Android module', async os => {
  jest.replaceProperty(Platform, 'OS', os);
  jest.mocked(getWebHistoryCodec).mockReturnValue(null);
  expect(await configureNativeHistoricalCatalogueCodec()).toBe(false);
  expect(getNativeHistoryCodec).not.toHaveBeenCalled();
  expect(configureHistoricalCatalogueCodec).not.toHaveBeenCalled();
});

test('web registers its built-in stream and crypto codec when supported', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  const codec = { compressAsync: jest.fn(), decompressAsync: jest.fn() };
  jest.mocked(getWebHistoryCodec).mockReturnValue(codec);
  expect(await configureNativeHistoricalCatalogueCodec()).toBe(true);
  expect(configureHistoricalCatalogueCodec).toHaveBeenCalledWith(codec);
  expect(getNativeHistoryCodec).not.toHaveBeenCalled();
});
