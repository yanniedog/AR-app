import { sampleCore } from '../src/data/sample';
import { parsePopulationAssessment, validatePopulationAssessment, validatePopulationEdition, type PopulationAssessmentV1 } from '../src/data/populationAssessment';
import { cachedAssetStateForProviderCoverage, liveAssetStateForProviderCoverage } from '../src/data/assetState';
import { normalizeCoreWithIntegrity } from '../src/data/sectionIntegrity';
import { displayEvidenceFacts } from '../src/data/displayEvidenceFacts';
import { mapDisplayEvidence } from '../src/data/displayEvidence';
import { makeHealthyDataFixture, FIXTURE_NOW_MS } from '../__fixtures__/appHealth';
import { evaluateAppHealthDataQuality } from '../src/lib/appHealth/dataQuality';
import { APP_HEALTH_CHECK_CODES } from '../src/lib/appHealth/types';
import { finalizeAppHealthReport, toPublicAppHealthReport } from '../src/lib/appHealth/report';
import type { CorePayload, Manifest } from '../src/types';

function assessmentFor(core: CorePayload): PopulationAssessmentV1 {
  const rows = Object.values(core.sections).flatMap(section => section.rates);
  return { schema_version: 1, scope: 'observed-products', observed_on: core.run_date,
    total_population: null, missing_product_count: null,
    observed_counts: { products: new Set(rows.map(r => r.product_key)).size, rates: rows.length, providers: new Set(rows.map(r => r.provider)).size },
    affected_providers: [{ provider_id: 'wise', provider_name: 'Wise', register_status: 'registered', membership_status: 'unknown',
      missing_product_count: null, reason: 'register-endpoint-conflict', register_url: 'https://register.example/providers', endpoint_url: 'https://wise.example/products' }] };
}
function fixture() {
  const core: CorePayload = JSON.parse(JSON.stringify(sampleCore));
  core.coverage = { providers_attempted: 3, providers_succeeded: 3, counts: { providers_partial: 0, providers_failed: 0 },
    population_assessment: assessmentFor(core) };
  return core;
}
test('accepts reconciled observed rows without claiming an exhaustive population', () => {
  const core = fixture();
  expect(validatePopulationAssessment(core)).toEqual(core.coverage!.population_assessment);
  expect(normalizeCoreWithIntegrity(core).core.coverage?.population_assessment?.total_population).toBeNull();
  expect(liveAssetStateForProviderCoverage(core, core.coverage).status).toBe('partial');
  expect(cachedAssetStateForProviderCoverage(core, core.coverage).status).toBe('partial');
  for (const source of ['remote', 'cache', 'sample'] as const) {
    const input = { source, offline: source === 'cache', runDate: core.run_date, coverage: core.coverage };
    expect(displayEvidenceFacts(input).facts).toContainEqual({ kind: 'coverage', value: 'partial' });
    expect(mapDisplayEvidence(input).coverageState).toBe('partial');
  }
});
test.each([{}, null, false, 0])('subset editions cannot synthesize current offers via an unassessed public catalogue %j', capability => {
  const core = fixture();
  expect(() => validatePopulationEdition(core, { run_date: core.run_date } as Manifest)).not.toThrow();
  expect(() => validatePopulationEdition(core, { run_date: core.run_date, public_rate_catalogue: capability } as unknown as Manifest)).toThrow();
});
test('legacy absence stays compatible but explicit null is not absence', () => {
  expect(parsePopulationAssessment(undefined)).toBeUndefined();
  expect(() => parsePopulationAssessment(null)).toThrow();
  expect(() => validatePopulationAssessment(sampleCore)).not.toThrow();
});
test.each([
  { schema_version: 2 }, { scope: 'all-products' }, { total_population: 0 }, { missing_product_count: 0 },
  { observed_on: '2026-02-30' }, { affected_providers: [] }, { extra: true }, { observed_counts: { products: 1, rates: -1, providers: 1 } },
])('rejects unsupported or misleading contract values %j', patch => {
  expect(() => parsePopulationAssessment({ ...assessmentFor(sampleCore), ...patch })).toThrow();
});
test.each([{ membership_status: 'empty' }, { missing_product_count: 0 }, { register_status: 'ceased' }, { register_url: 'http://register.example' }, { provider_id: '' }])('rejects false provider certainty %j', patch => {
  const assessment = assessmentFor(sampleCore);
  expect(() => parsePopulationAssessment({ ...assessment, affected_providers: [{ ...assessment.affected_providers[0], ...patch }] })).toThrow();
});
test('rejects duplicate identities and credentials in source URLs', () => {
  const a = assessmentFor(sampleCore);
  expect(() => parsePopulationAssessment({ ...a, affected_providers: [...a.affected_providers, ...a.affected_providers] })).toThrow();
  a.affected_providers[0].endpoint_url = 'https://secret:password@wise.example/products';
  expect(() => parsePopulationAssessment(a)).toThrow();
});
test.each(['rates', 'products', 'providers'] as const)('rejects false observed %s counts at cache/network normalization boundary', key => {
  const core = fixture(); core.coverage!.population_assessment!.observed_counts[key]++;
  expect(() => normalizeCoreWithIntegrity(core)).toThrow('Invalid observed population');
});
test('rejects assessment from another publication date', () => {
  const core = fixture(); core.coverage!.population_assessment!.observed_on = '2026-01-01';
  expect(() => validatePopulationAssessment(core)).toThrow();
});
test.each(['wise', 'Wise', ' WISE '])('rejects carried-forward current rows for unknown provider %s', provider => {
  const core = fixture(); const rows = Object.values(core.sections).flatMap(section => section.rates);
  rows[0].provider = provider;
  core.coverage!.population_assessment = assessmentFor(core);
  expect(() => normalizeCoreWithIntegrity(core)).toThrow('Invalid observed population');
});
test('audit retains unknown population and provider evidence even when all attempted providers succeeded', () => {
  const { snapshot, contract } = makeHealthyDataFixture();
  snapshot.core!.coverage!.population_assessment = assessmentFor(snapshot.core!);
  const result = evaluateAppHealthDataQuality(snapshot, contract, FIXTURE_NOW_MS).find(c => c.code === APP_HEALTH_CHECK_CODES.COVERAGE)!;
  expect(result.status).toBe('warn');
  expect(result.metrics).toMatchObject({ populationScope: 'observed-products', totalPopulation: null, missingProducts: null, affectedRegisteredProviders: 1 });
  expect(result.localEvidence).toMatchObject({ populationAssessment: { affected_providers: [{ provider_id: 'wise' }] } });
  const report = finalizeAppHealthReport({ checks: [result], plannedCheckIds: [result.id], mode: 'local',
    sessionId: 'subset-test', startedAt: '2026-11-02T00:00:00Z', finishedAt: '2026-11-02T00:00:01Z' });
  const exported = toPublicAppHealthReport(report);
  expect(exported.checks.find(c => c.code === result.code)?.metrics).toMatchObject({ populationScope: 'observed-products', totalPopulation: null, missingProducts: null });
  expect(JSON.stringify(exported)).not.toContain('wise.example');
});
