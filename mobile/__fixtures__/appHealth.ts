import type { CorePayload, Manifest, RateRow, Ribbon, SectionKey } from '../src/types';
import {
  APP_HEALTH_ASSET_KEYS,
  type AppHealthDataSnapshot,
  type AppHealthSourceContract,
  type AppHealthSurfaceContract,
  type AppHealthSurfaceObservation,
} from '../src/lib/appHealth/types';
import { createV1AppHealthSourceContract } from '../src/lib/appHealth/sourceContract';

export const FIXTURE_RUN_DATE = '2026-09-01';
export const FIXTURE_NOW_MS = Date.parse('2026-09-02T06:00:00.000Z');

const ROOTS: Record<SectionKey, string> = {
  Mortgage: 'HOME_LOAN',
  Savings: 'SAVINGS',
  TD: 'TERM_DEPOSIT',
};

function row(section: SectionKey, index: number): RateRow {
  return {
    provider: `Provider ${index}`,
    product_key: `${section.toLowerCase()}-${index}`,
    product_name: `${section} product ${index}`,
    rate: section === 'Mortgage' ? '0.061' : '0.051',
    rate_index: 0,
    exact_alert_eligible: true,
    taxonomy_path: `${ROOTS[section]}.STANDARD`,
  };
}

function ribbon(rateRow: RateRow): Ribbon {
  const rate = Number(rateRow.rate);
  return {
    counts: { rates: 1, products: 1, providers: 1 },
    range: { min: rate, max: rate, mean: rate, median: rate },
    providers: [
      {
        provider: rateRow.provider,
        rates: 1,
        products: 1,
        min: rate,
        max: rate,
        mean: rate,
        median: rate,
      },
    ],
  };
}

export function makeHealthyCore(): CorePayload {
  const mortgage = row('Mortgage', 1);
  const savings = row('Savings', 2);
  const termDeposit = row('TD', 3);
  return {
    schema_version: 1,
    run_date: FIXTURE_RUN_DATE,
    sections: {
      Mortgage: { rates: [mortgage], ribbon: ribbon(mortgage) },
      Savings: { rates: [savings], ribbon: ribbon(savings) },
      TD: { rates: [termDeposit], ribbon: ribbon(termDeposit) },
    },
    brands: {},
    rba: [{ date: FIXTURE_RUN_DATE, rate: 0.036 }],
    coverage: {
      schema_version: 1,
      observed_on: FIXTURE_RUN_DATE,
      providers_attempted: 3,
      providers_succeeded: 3,
      provider_failures: [],
      counts: {
        brands_observed: 3,
        providers_failed: 0,
        providers_partial: 0,
        products: 3,
        rates: 3,
        failure_records: 0,
      },
      limitations: [],
    },
  };
}

function descriptor(contract: AppHealthSourceContract, name: string, hash: string) {
  const tag = `${contract.datedTagPrefix}${FIXTURE_RUN_DATE}`;
  return {
    name,
    bytes: 128,
    sha256: hash.repeat(64),
    url: `https://github.com/${contract.repo}/releases/download/${tag}/${name}`,
  };
}

export function makeHealthyManifest(
  contract: AppHealthSourceContract = createV1AppHealthSourceContract(),
): Manifest {
  return {
    schema_version: 1,
    run_date: FIXTURE_RUN_DATE,
    generated_at: '2026-09-02T00:00:00.000Z',
    app_min_version: '1.0.0',
    repo: contract.repo,
    tag: `${contract.datedTagPrefix}${FIXTURE_RUN_DATE}`,
    counts: { products: 3, rates: 3 },
    schedule: {
      label: 'Daily',
      next_due_utc: '2026-09-02T00:00:00.000Z',
    },
    files: {
      core: descriptor(contract, 'core.json.gz', 'a'),
      details: descriptor(contract, 'details.json.gz', 'b'),
    },
  };
}

export function makeHealthyDataFixture(): {
  contract: AppHealthSourceContract;
  snapshot: AppHealthDataSnapshot;
} {
  const contract = createV1AppHealthSourceContract();
  return {
    contract,
    snapshot: {
      source: 'remote',
      core: makeHealthyCore(),
      manifest: makeHealthyManifest(contract),
      appVersion: '1.0.0',
      datesIndex: { dates: [FIXTURE_RUN_DATE], latestRunDate: FIXTURE_RUN_DATE },
      details: {
        runDate: FIXTURE_RUN_DATE,
        productCount: 3,
        matchedProductCount: 3,
        orphanProductCount: 0,
      },
      assets: Object.fromEntries(
        APP_HEALTH_ASSET_KEYS.map((asset) => [
          asset,
          { state: 'ready' as const, runDate: FIXTURE_RUN_DATE, itemCount: 1 },
        ]),
      ),
      quarantine: { rowsByReason: {}, bankHistoryPairs: 0 },
    },
  };
}

export function makeCompleteDisplayFixture(): {
  contracts: AppHealthSurfaceContract[];
  observations: AppHealthSurfaceObservation[];
} {
  return {
    contracts: [
      {
        id: 'rates-surface',
        requiredRoles: [
          'model',
          'list',
          'visible',
          'empty-state',
          'critical-layout',
          'chart',
          'logo',
        ],
        chartRequired: true,
        logosRequired: true,
      },
    ],
    observations: [
      {
        surfaceId: 'rates-surface',
        evidence: [
          { role: 'model', sourceCount: 3, modelCount: 3 },
          { role: 'list', modelCount: 3, renderedCount: 3 },
          { role: 'visible', expectedMinimum: 1, visibleCount: 3 },
          { role: 'empty-state', expected: false, rendered: false },
          { role: 'critical-layout', measured: true, clipped: false, width: 320, height: 480 },
          { role: 'chart', modelPointCount: 8, renderedPointCount: 8, accessibleSummary: true },
          { role: 'logo', expectedCount: 3, decodedCount: 3, fallbackCount: 0, missingCount: 0 },
        ],
      },
    ],
  };
}
