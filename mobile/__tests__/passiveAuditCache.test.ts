import { FIXTURE_NOW_MS, makeHealthyDataFixture } from '../__fixtures__/appHealth';
import { APP_HEALTH_DATA_CHECKS } from '../src/lib/appHealth/dataQuality';
import {
  newPassiveAuditRecord, parsePassiveAuditRecord, passiveAuditKey, runPassiveAuditCheck,
  reusePassiveAuditChecks, serializePassiveAuditRecord, PASSIVE_AUDIT_MAX_AGE_MS, PASSIVE_AUDIT_INPUT_MAX_AGE_MS,
} from '../src/lib/passiveAuditCache';

const build = '1.0.222:285';
describe('passive audit evidence', () => {
  it('resumes one check at a time and reuses only the same publication/build/observations', () => {
    const { snapshot } = makeHealthyDataFixture();
    const record = newPassiveAuditRecord(snapshot, build, FIXTURE_NOW_MS)!;
    expect(runPassiveAuditCheck(record, snapshot, () => FIXTURE_NOW_MS)).toBe(true);
    expect(Object.keys(record.entries)).toEqual(['data-source-state']);
    const restored = parsePassiveAuditRecord(serializePassiveAuditRecord(record), build, FIXTURE_NOW_MS)!;
    runPassiveAuditCheck(restored, snapshot, () => FIXTURE_NOW_MS);
    expect(Object.keys(restored.entries)).toEqual(['data-source-state', 'manifest-contract']);
    expect(reusePassiveAuditChecks(restored, snapshot, build, FIXTURE_NOW_MS).reused).toBe(2);
    expect(reusePassiveAuditChecks(restored, snapshot, 'new-build', FIXTURE_NOW_MS).reused).toBe(0);
    const changed = { ...snapshot, source: 'cache' as const };
    expect(reusePassiveAuditChecks(restored, changed, build, FIXTURE_NOW_MS).reused).toBe(0);
    snapshot.manifest!.files.details.sha256 = 'c'.repeat(64);
    expect(reusePassiveAuditChecks(restored, snapshot, build, FIXTURE_NOW_MS).reused).toBe(1);
  });

  it('executes metadata headlessly without treating omitted rows as an empty catalogue', () => {
    const { snapshot } = makeHealthyDataFixture();
    const record = newPassiveAuditRecord(snapshot, build, FIXTURE_NOW_MS)!;
    while (runPassiveAuditCheck(record, null, () => FIXTURE_NOW_MS)) { /* bounded job list */ }
    expect(Object.keys(record.entries)).toEqual(APP_HEALTH_DATA_CHECKS.filter(job => job.backgroundMetadataOnly).map(job => job.code));
    expect(record.entries['rate-values']).toBeUndefined();
    expect(record.entries['display-chart']).toBeUndefined();
    expect(record.metadata.core?.sections).toEqual({});
  });

  it('never persists raw catalogue rows, private evidence, or computed profile membership', () => {
    const { snapshot } = makeHealthyDataFixture();
    const record = newPassiveAuditRecord(snapshot, build, FIXTURE_NOW_MS)!;
    runPassiveAuditCheck(record, snapshot, () => FIXTURE_NOW_MS);
    record.entries['data-source-state'].check.localEvidence = { profileSecret: 'private-example' };
    const raw = serializePassiveAuditRecord(record)!;
    expect(raw).not.toContain('private-example');
    expect(JSON.parse(raw).metadata.core.sections).toEqual({});
    expect(JSON.parse(raw).metadata.catalogue).toBeUndefined();
  });

  it('rechecks time-based freshness and rejects expired/future evidence', () => {
    const { snapshot } = makeHealthyDataFixture();
    const record = newPassiveAuditRecord(snapshot, build, FIXTURE_NOW_MS)!;
    while (runPassiveAuditCheck(record, snapshot, () => FIXTURE_NOW_MS)) { /* all actual checks */ }
    const result = reusePassiveAuditChecks(record, snapshot, build, FIXTURE_NOW_MS + 1_000);
    expect(result.checks.find(check => check.code === 'freshness-window')?.metrics.preloaded).toBeUndefined();
    expect(result.reused).toBe(APP_HEALTH_DATA_CHECKS.length - 2); // freshness plus unprepared catalogue
    const delayedWake = parsePassiveAuditRecord(serializePassiveAuditRecord(record), build, FIXTURE_NOW_MS + PASSIVE_AUDIT_MAX_AGE_MS)!;
    expect(delayedWake.entries).toEqual({});
    expect(runPassiveAuditCheck(delayedWake, null, () => FIXTURE_NOW_MS + PASSIVE_AUDIT_MAX_AGE_MS)).toBe(true);
    expect(parsePassiveAuditRecord(serializePassiveAuditRecord(record), build, FIXTURE_NOW_MS + PASSIVE_AUDIT_INPUT_MAX_AGE_MS)).toBeNull();
    expect(parsePassiveAuditRecord(serializePassiveAuditRecord(record), build, FIXTURE_NOW_MS - 1)).toBeNull();
  });

  it('records checks exceeding ten seconds as failures', () => {
    const { snapshot } = makeHealthyDataFixture();
    const record = newPassiveAuditRecord(snapshot, build, FIXTURE_NOW_MS)!;
    let calls = 0;
    runPassiveAuditCheck(record, snapshot, () => FIXTURE_NOW_MS + (calls++ >= 2 ? 10_001 : 0));
    expect(record.entries['data-source-state'].check).toMatchObject({
      status: 'fail', metrics: { stepExceededTenSeconds: true },
    });
  });

  it('also fails an uncached foreground evaluator taking longer than ten seconds', () => {
    const { snapshot } = makeHealthyDataFixture();
    let calls = 0;
    const time = jest.spyOn(Date, 'now').mockImplementation(() => FIXTURE_NOW_MS + (calls++ % 2 ? 10_001 : 0));
    try {
      const result = reusePassiveAuditChecks(null, snapshot, build, FIXTURE_NOW_MS);
      expect(result.checks.find(check => check.code === 'rate-values')).toMatchObject({ status: 'fail',
        metrics: { foregroundDurationMs: 10_001, stepExceededTenSeconds: true } });
    } finally { time.mockRestore(); }
  });

  it('invalidates changed quarantine/loaded assets even when the publication date is unchanged', () => {
    const { snapshot } = makeHealthyDataFixture();
    const key = passiveAuditKey(snapshot, build);
    expect(passiveAuditKey({ ...snapshot, quarantine: { rowsByReason: { invalid: 1 }, bankHistoryPairs: 0 } }, build)).not.toBe(key);
    expect(passiveAuditKey({ ...snapshot, assets: { ...snapshot.assets, search_index: { state: 'failed' } } }, build)).not.toBe(key);
  });

  it('retains core checks when audit filters widen and optional assets load, while rechecking catalogue and availability', () => {
    const { snapshot } = makeHealthyDataFixture();
    snapshot.catalogue = { filterState: 'blocked', includeNonStandard: false, detailsAvailable: false,
      searchIndexAvailable: false, searchIndexRunMatches: null, detailsOnlyProductKeys: null,
      sections: [], brandedProvidersWithoutPublishedRates: [], publishedProvidersWithoutBrand: [] };
    const record = newPassiveAuditRecord(snapshot, build, FIXTURE_NOW_MS)!;
    while (runPassiveAuditCheck(record, snapshot, () => FIXTURE_NOW_MS)) { /* preload original preferences */ }
    const auditSnapshot = { ...snapshot, catalogue: { ...snapshot.catalogue, includeNonStandard: true },
      assets: { ...snapshot.assets, search_index: { state: 'ready' as const, itemCount: 20 } } };
    const result = reusePassiveAuditChecks(record, auditSnapshot, build, FIXTURE_NOW_MS);
    expect(result.checks.find(check => check.code === 'rate-values')?.metrics.preloaded).toBe(true);
    expect(result.checks.find(check => check.code === 'exact-tier-identities')?.metrics.preloaded).toBe(true);
    expect(result.checks.find(check => check.code === 'catalogue-identity-coverage')?.metrics.preloaded).toBeUndefined();
    expect(result.checks.find(check => check.code === 'asset-availability')?.metrics.preloaded).toBeUndefined();
    expect(result.reused).toBe(APP_HEALTH_DATA_CHECKS.length - 3);
  });
});
