import {
  FIXTURE_NOW_MS,
  makeHealthyDataFixture,
} from '../__fixtures__/appHealth';
import {
  loadSampleDetails,
  sampleCore,
  sampleCoreIntegrity,
  sampleManifest,
} from '../src/data/sample';
import { evaluateAppHealthDataQuality } from '../src/lib/appHealth/dataQuality';
import { CURRENT_V1_APP_HEALTH_SOURCE_CONTRACT } from '../src/lib/appHealth/sourceContract';
import { APP_HEALTH_CHECK_CODES, type AppHealthCheck } from '../src/lib/appHealth/types';

function byCode(checks: readonly AppHealthCheck[], code: AppHealthCheck['code']): AppHealthCheck {
  const found = checks.find((check) => check.code === code);
  if (!found) throw new Error(`Missing check: ${code}`);
  return found;
}

describe('app-health v1 source contract', () => {
  it('preserves the shipping public AR-local endpoints', () => {
    expect(CURRENT_V1_APP_HEALTH_SOURCE_CONTRACT.repo).toBe('yanniedog/AR-local');
    expect(CURRENT_V1_APP_HEALTH_SOURCE_CONTRACT.rollingTag).toBe('app-payload-latest');
    expect(CURRENT_V1_APP_HEALTH_SOURCE_CONTRACT.manifestUrl).toBe(
      'https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json',
    );
    expect(CURRENT_V1_APP_HEALTH_SOURCE_CONTRACT.datesIndexUrl).toBe(
      'https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/dates-index.json',
    );
  });
});

describe('app-health data quality', () => {
  it('passes a coherent, complete, fresh v1 publication', () => {
    const { snapshot, contract } = makeHealthyDataFixture();
    const checks = evaluateAppHealthDataQuality(snapshot, contract, FIXTURE_NOW_MS);

    expect(checks).toHaveLength(15);
    expect(checks.every((check) => check.status === 'pass')).toBe(true);
  });

  it('rejects a core payload schema that the app contract does not support', () => {
    const { snapshot, contract } = makeHealthyDataFixture();
    Object.assign(snapshot.core!, { schema_version: 99 });

    expect(
      byCode(
        evaluateAppHealthDataQuality(snapshot, contract, FIXTURE_NOW_MS),
        APP_HEALTH_CHECK_CODES.CORE_SCHEMA,
      ),
    ).toMatchObject({
      status: 'fail',
      metrics: { schemaVersion: 99, schemaSupported: false },
    });
  });

  it('surfaces independent integrity, completeness, and freshness failures', () => {
    const { snapshot, contract } = makeHealthyDataFixture();
    if (!snapshot.core || !snapshot.manifest || !snapshot.details) throw new Error('fixture');
    snapshot.core.sections.Savings.rates[0].rate = 'not-a-number';
    snapshot.core.sections.TD.rates[0].taxonomy_path = 'SAVINGS.WRONG';
    snapshot.details.runDate = '2026-08-31';
    snapshot.manifest.schedule.next_due_utc = '2026-08-01T00:00:00.000Z';
    snapshot.core.coverage!.providers_succeeded = 2;
    snapshot.core.coverage!.counts!.providers_failed = 1;
    snapshot.core.coverage!.provider_failures = [{ provider: 'withheld-from-public-report' }];
    snapshot.quarantine = {
      rowsByReason: { wrong_section: 2 },
      bankHistoryPairs: 1,
    };

    const checks = evaluateAppHealthDataQuality(snapshot, contract, FIXTURE_NOW_MS);

    expect(byCode(checks, APP_HEALTH_CHECK_CODES.RATE_VALUES).status).toBe('fail');
    expect(byCode(checks, APP_HEALTH_CHECK_CODES.TAXONOMY_ROOTS).status).toBe('warn');
    expect(byCode(checks, APP_HEALTH_CHECK_CODES.RUN_IDENTITY).status).toBe('fail');
    expect(byCode(checks, APP_HEALTH_CHECK_CODES.DETAILS_COMPLETENESS).status).toBe('fail');
    expect(byCode(checks, APP_HEALTH_CHECK_CODES.FRESHNESS).status).toBe('fail');
    expect(byCode(checks, APP_HEALTH_CHECK_CODES.COVERAGE).status).toBe('warn');
    expect(byCode(checks, APP_HEALTH_CHECK_CODES.QUARANTINE).status).toBe('warn');
  });

  it('rejects ambiguous multi-tier product identities', () => {
    const { snapshot, contract } = makeHealthyDataFixture();
    const savings = snapshot.core!.sections.Savings.rates[0];
    delete savings.rate_index;
    snapshot.core!.sections.Savings.rates.push({ ...savings, rate: '0.052' });

    const result = byCode(
      evaluateAppHealthDataQuality(snapshot, contract, FIXTURE_NOW_MS),
      APP_HEALTH_CHECK_CODES.EXACT_TIER_IDENTITIES,
    );

    expect(result.status).toBe('fail');
    expect(result.metrics.ambiguousMultiTierProducts).toBe(1);
  });

  it('does not treat sample or missing optional evidence as live health', () => {
    const { snapshot, contract } = makeHealthyDataFixture();
    snapshot.source = 'sample';
    snapshot.manifest = null;
    snapshot.assets = undefined;
    snapshot.details = null;

    const checks = evaluateAppHealthDataQuality(snapshot, contract, FIXTURE_NOW_MS);

    expect(byCode(checks, APP_HEALTH_CHECK_CODES.SOURCE_STATE).status).toBe('warn');
    expect(byCode(checks, APP_HEALTH_CHECK_CODES.MANIFEST_CONTRACT).status).toBe('unavailable');
    expect(byCode(checks, APP_HEALTH_CHECK_CODES.ASSET_AVAILABILITY).status).toBe('fail');
    expect(byCode(checks, APP_HEALTH_CHECK_CODES.DETAILS_COMPLETENESS).status).toBe('unavailable');
  });

  it('detects manifest count drift and assets from a different run', () => {
    const { snapshot, contract } = makeHealthyDataFixture();
    snapshot.manifest!.counts.rates = 999;
    snapshot.assets!.bank_history!.runDate = '2026-08-31';

    const checks = evaluateAppHealthDataQuality(snapshot, contract, FIXTURE_NOW_MS);

    expect(byCode(checks, APP_HEALTH_CHECK_CODES.RIBBON_RECONCILIATION)).toMatchObject({
      status: 'fail',
      metrics: { declaredCountMismatches: 1 },
    });
    expect(byCode(checks, APP_HEALTH_CHECK_CODES.ASSET_AVAILABILITY)).toMatchObject({
      status: 'fail',
      metrics: { mismatchedRunDates: 1 },
    });
  });

  it('does not use a quarantined row as a generic excuse for unrelated count gaps', () => {
    const { snapshot, contract } = makeHealthyDataFixture();
    snapshot.manifest!.counts.rates += 1;
    snapshot.manifest!.counts.products += 1;
    snapshot.manifest!.counts.providers = 4;
    snapshot.quarantine = {
      rowsByReason: { invalid_row: 1 },
      bankHistoryPairs: 0,
      countImpacts: { rates: 1, products: 1, providers: 0 },
    };

    expect(byCode(
      evaluateAppHealthDataQuality(snapshot, contract, FIXTURE_NOW_MS),
      APP_HEALTH_CHECK_CODES.RIBBON_RECONCILIATION,
    )).toMatchObject({
      status: 'fail',
      metrics: {
        declaredCountAdjustments: 2,
        declaredCountMismatches: 1,
        quarantineImpactsAvailable: true,
        quarantineRateImpact: 1,
        quarantineProductImpact: 1,
        quarantineProviderImpact: 0,
      },
    });
  });

  it('reconciles non-additive count changes using exact quarantine impacts', () => {
    const { snapshot, contract } = makeHealthyDataFixture();
    snapshot.manifest!.counts.rates += 1;
    snapshot.manifest!.counts.products += 1;
    snapshot.manifest!.counts.providers = 4;
    snapshot.quarantine = {
      rowsByReason: { invalid_row: 1 },
      bankHistoryPairs: 0,
      countImpacts: { rates: 1, products: 1, providers: 1 },
    };

    expect(byCode(
      evaluateAppHealthDataQuality(snapshot, contract, FIXTURE_NOW_MS),
      APP_HEALTH_CHECK_CODES.RIBBON_RECONCILIATION,
    )).toMatchObject({
      status: 'pass',
      metrics: { declaredCountAdjustments: 3, declaredCountMismatches: 0 },
    });
  });

  it('rejects section ribbon counts that under-report loaded rows and sets', () => {
    const { snapshot, contract } = makeHealthyDataFixture();
    const counts = snapshot.core!.sections.Savings.ribbon!.counts!;
    counts.rates -= 1;
    counts.products -= 1;
    counts.providers -= 1;

    expect(byCode(
      evaluateAppHealthDataQuality(snapshot, contract, FIXTURE_NOW_MS),
      APP_HEALTH_CHECK_CODES.RIBBON_RECONCILIATION,
    )).toMatchObject({ status: 'fail', metrics: { invalidSections: 1 } });
  });

  it('does not fabricate live-source evidence when acquisition is unavailable', () => {
    const { snapshot, contract } = makeHealthyDataFixture();
    snapshot.source = 'unavailable';
    snapshot.core = null;
    snapshot.manifest = null;

    const checks = evaluateAppHealthDataQuality(snapshot, contract, FIXTURE_NOW_MS);

    expect(byCode(checks, APP_HEALTH_CHECK_CODES.SOURCE_STATE)).toMatchObject({
      status: 'fail',
      metrics: { source: 'unavailable', coreAvailable: false },
    });
    expect(byCode(checks, APP_HEALTH_CHECK_CODES.MANIFEST_CONTRACT).status).toBe('unavailable');
  });

  it('treats missing coverage totals as unavailable and rejects impossible run dates', () => {
    const { snapshot, contract } = makeHealthyDataFixture();
    snapshot.core!.coverage = { provider_failures: [], counts: { providers_failed: 0 } };
    snapshot.core!.run_date = '2026-02-31';
    snapshot.manifest!.run_date = '2026-02-31';

    const checks = evaluateAppHealthDataQuality(snapshot, contract, FIXTURE_NOW_MS);

    expect(byCode(checks, APP_HEALTH_CHECK_CODES.COVERAGE)).toMatchObject({
      status: 'unavailable',
      metrics: { coverageAvailable: true, totalsAvailable: false },
    });
    expect(byCode(checks, APP_HEALTH_CHECK_CODES.MANIFEST_CONTRACT)).toMatchObject({
      status: 'fail',
      metrics: { validRunDate: false },
    });
    expect(byCode(checks, APP_HEALTH_CHECK_CODES.RUN_IDENTITY)).toMatchObject({
      status: 'fail',
      metrics: { validCoreRunDate: false },
    });
  });

  it('audits the shipping bundled sample without treating bundled URLs as live hosts', () => {
    const details = loadSampleDetails();
    const productKeys = new Set(
      Object.values(sampleCore.sections).flatMap((section) =>
        section.rates.map((row) => row.product_key),
      ),
    );
    const detailKeys = new Set(Object.keys(details.products));
    const matchedProductCount = [...productKeys].filter((key) => detailKeys.has(key)).length;
    const checks = evaluateAppHealthDataQuality(
      {
        source: 'sample',
        core: sampleCore,
        manifest: sampleManifest,
        details: {
          runDate: details.run_date,
          productCount: detailKeys.size,
          matchedProductCount,
          orphanProductCount: [...detailKeys].filter((key) => !productKeys.has(key)).length,
        },
        assets: {
          core: { state: 'ready', runDate: sampleCore.run_date, itemCount: productKeys.size },
          details: { state: 'ready', runDate: details.run_date, itemCount: detailKeys.size },
        },
        quarantine: {
          rowsByReason: sampleCoreIntegrity.quarantines.rowsByReason,
          bankHistoryPairs: sampleCoreIntegrity.quarantines.bankHistoryPairs.size,
          countImpacts: sampleCoreIntegrity.quarantines.countImpacts,
        },
      },
      CURRENT_V1_APP_HEALTH_SOURCE_CONTRACT,
      Date.parse(sampleManifest.generated_at),
    );

    expect(byCode(checks, APP_HEALTH_CHECK_CODES.SOURCE_STATE).status).toBe('warn');
    expect(byCode(checks, APP_HEALTH_CHECK_CODES.MANIFEST_CONTRACT).status).toBe('pass');
    expect(byCode(checks, APP_HEALTH_CHECK_CODES.ASSET_DESCRIPTORS).status).toBe('pass');
    expect(byCode(checks, APP_HEALTH_CHECK_CODES.REQUIRED_SECTIONS).status).toBe('pass');
    expect(byCode(checks, APP_HEALTH_CHECK_CODES.RATE_VALUES).status).toBe('pass');
    expect(byCode(checks, APP_HEALTH_CHECK_CODES.EXACT_TIER_IDENTITIES).status).toBe('pass');
    expect(byCode(checks, APP_HEALTH_CHECK_CODES.TAXONOMY_ROOTS)).toMatchObject({
      status: 'warn',
      metrics: { wrongRoot: 1 },
    });
    const sampleDetails = byCode(checks, APP_HEALTH_CHECK_CODES.DETAILS_COMPLETENESS);
    expect(sampleDetails.status).toBe('warn');
    expect(Number(sampleDetails.metrics.orphanProducts)).toBeGreaterThan(0);
    const sampleRibbon = byCode(checks, APP_HEALTH_CHECK_CODES.RIBBON_RECONCILIATION);
    expect(sampleRibbon).toMatchObject({
      status: 'pass',
      metrics: {
        declaredCountMismatches: 0,
        declaredCountAdjustments: 3,
        quarantineImpactsAvailable: true,
        quarantineRateImpact: 3,
        quarantineProductImpact: 3,
        quarantineProviderImpact: 1,
      },
    });
  });
});
