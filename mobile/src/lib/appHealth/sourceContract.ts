import {
  DATED_TAG_PREFIX,
  DATES_INDEX_URL,
  MANIFEST_URL,
  PAYLOAD_REPO,
  RELEASE_TAG,
  SUPPORTED_SCHEMA,
} from '../../config';
import type { AppHealthSourceContract } from './types';

const DAY_MS = 24 * 60 * 60 * 1_000;

/**
 * The app-health contract deliberately follows the app's shipping v1 reader.
 * It must not switch the consumer to a speculative producer or v3 endpoint.
 */
export const CURRENT_V1_APP_HEALTH_SOURCE_CONTRACT: AppHealthSourceContract = Object.freeze({
  contract: 'v1',
  repo: PAYLOAD_REPO,
  rollingTag: RELEASE_TAG,
  manifestUrl: MANIFEST_URL,
  datesIndexUrl: DATES_INDEX_URL,
  datedTagPrefix: DATED_TAG_PREFIX,
  supportedManifestSchemas: Object.freeze([SUPPORTED_SCHEMA] as const),
  supportedCoreSchemas: Object.freeze([SUPPORTED_SCHEMA] as const),
  requiredSections: Object.freeze(['Mortgage', 'Savings', 'TD'] as const),
  taxonomyRoots: Object.freeze({
    Mortgage: 'HOME_LOAN',
    Savings: 'SAVINGS',
    TD: 'TERM_DEPOSIT',
  }),
  requiredAssets: Object.freeze(['core', 'details'] as const),
  optionalAssets: Object.freeze([
    'search_index',
    'history_banks',
    'bank_history',
    'bank_spread_history',
    'rba_calendar',
  ] as const),
  freshnessGraceMs: DAY_MS,
});

/** Factory for deterministic tests and future contract versions. */
export function createV1AppHealthSourceContract(
  overrides: Partial<AppHealthSourceContract> = {},
): AppHealthSourceContract {
  const base = CURRENT_V1_APP_HEALTH_SOURCE_CONTRACT;
  return Object.freeze({
    ...base,
    ...overrides,
    supportedManifestSchemas: Object.freeze([
      ...(overrides.supportedManifestSchemas ?? base.supportedManifestSchemas),
    ]),
    supportedCoreSchemas: Object.freeze([
      ...(overrides.supportedCoreSchemas ?? base.supportedCoreSchemas),
    ]),
    requiredSections: Object.freeze([
      ...(overrides.requiredSections ?? base.requiredSections),
    ]),
    taxonomyRoots: Object.freeze({ ...(overrides.taxonomyRoots ?? base.taxonomyRoots) }),
    requiredAssets: Object.freeze([...(overrides.requiredAssets ?? base.requiredAssets)]),
    optionalAssets: Object.freeze([...(overrides.optionalAssets ?? base.optionalAssets)]),
  });
}
