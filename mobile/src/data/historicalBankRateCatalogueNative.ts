import { Platform } from 'react-native';
import { configureHistoricalCatalogueCodec } from './historicalBankRateCatalogueCompression';

/** Called after first paint; portable serializers never import Expo themselves. */
export async function configureNativeHistoricalCatalogueCodec(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  // Metro resolves this literal lazily; Node tooling never enters this adapter.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getNativeHistoryCodec } = require('../../modules/history-codec') as typeof import('../../modules/history-codec');
  const codec = getNativeHistoryCodec();
  if (!codec) return false;
  configureHistoricalCatalogueCodec(codec);
  return true;
}
