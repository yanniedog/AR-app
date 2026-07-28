import type { Manifest } from '../src/types';
import { sampleManifest } from '../src/data/sample';
import {
  isManifestFinalized,
  mergeOptionalManifestFiles,
  pendingIngestBannerMessage,
  resolveFinalizedManifest,
} from '../src/data/ingestFinalized';
import type { DatesIndex } from '../src/data/historyDaily';

const rolling: Manifest = {
  ...sampleManifest,
  run_date: '2026-07-28',
};

const finalizedDay: Manifest = {
  ...sampleManifest,
  run_date: '2026-07-27',
  files: {
    ...sampleManifest.files,
    core: { ...sampleManifest.files.core, sha256: 'finalized-core-sha' },
  },
};

const indexThrough27: DatesIndex = {
  schema_version: 1,
  dates: ['2026-07-25', '2026-07-26', '2026-07-27'],
  count: 3,
  min_date: '2026-05-13',
  latest_date: '2026-07-27',
};

function optionalAsset(name: string, sha256: string) {
  return {
    name,
    bytes: 100,
    sha256,
    url: `https://example.com/${name}`,
  };
}

describe('ingestFinalized', () => {
  it('treats a rolling day listed in dates-index as finalized', () => {
    expect(
      isManifestFinalized({ ...rolling, run_date: '2026-07-27' }, indexThrough27),
    ).toBe(true);
  });

  it('treats a rolling day ahead of dates-index as not finalized', () => {
    expect(isManifestFinalized(rolling, indexThrough27)).toBe(false);
  });

  it('resolves to the latest finalized dated manifest while rolling is pending', async () => {
    const fetchDated = jest.fn(async (runDate: string) => {
      if (runDate === '2026-07-28') throw new Error('dated 28 not ready');
      return finalizedDay;
    });
    const resolution = await resolveFinalizedManifest(rolling, {
      fetchIndex: async () => indexThrough27,
      fetchDated,
    });

    expect(resolution.status).toBe('pending');
    expect(resolution.pendingIngestRunDate).toBe('2026-07-28');
    expect(resolution.manifest?.run_date).toBe('2026-07-27');
    expect(fetchDated).toHaveBeenCalledWith('2026-07-28');
    expect(fetchDated).toHaveBeenCalledWith('2026-07-27');
  });

  it('adopts the dated release when dates-index lags a completed publish', async () => {
    const datedRolling: Manifest = {
      ...rolling,
      tag: 'app-payload-2026-07-28',
      files: {
        ...rolling.files,
        core: { ...rolling.files.core, sha256: 'dated-28-core-sha' },
      },
    };
    const fetchDated = jest.fn(async (runDate: string) => {
      if (runDate === '2026-07-28') return datedRolling;
      throw new Error(`unexpected dated fetch ${runDate}`);
    });
    const resolution = await resolveFinalizedManifest(rolling, {
      fetchIndex: async () => indexThrough27,
      fetchDated,
    });

    expect(resolution).toEqual({
      status: 'finalized',
      manifest: datedRolling,
      pendingIngestRunDate: null,
      datesIndex: indexThrough27,
    });
    expect(fetchDated).toHaveBeenCalledWith('2026-07-28');
    expect(fetchDated).not.toHaveBeenCalledWith('2026-07-27');
  });

  it('restores optional rolling assets when dated lag adopt shares the same core', async () => {
    const bankHistory = optionalAsset('bank-history.json.gz', 'bank-history-sha');
    const rbaCalendar = optionalAsset('rba-calendar.json.gz', 'rba-calendar-sha');
    const rollingFull: Manifest = {
      ...rolling,
      files: {
        ...rolling.files,
        core: { ...rolling.files.core, sha256: 'same-core-sha' },
        bank_history: bankHistory,
        rba_calendar: rbaCalendar,
        history_banks: optionalAsset('history-banks.json.gz', 'history-banks-sha'),
        search_index: optionalAsset('search-index.json.gz', 'search-index-sha'),
      },
    };
    const datedCoreOnly: Manifest = {
      ...rollingFull,
      tag: 'app-payload-2026-07-28',
      files: {
        core: rollingFull.files.core,
        details: rollingFull.files.details,
      },
    };
    const resolution = await resolveFinalizedManifest(rollingFull, {
      fetchIndex: async () => indexThrough27,
      fetchDated: async () => datedCoreOnly,
    });

    expect(resolution.status).toBe('finalized');
    expect(resolution.manifest?.tag).toBe('app-payload-2026-07-28');
    expect(resolution.manifest?.files.bank_history).toEqual(bankHistory);
    expect(resolution.manifest?.files.rba_calendar).toEqual(rbaCalendar);
    expect(resolution.manifest?.files.history_banks?.sha256).toBe('history-banks-sha');
    expect(resolution.manifest?.files.search_index?.sha256).toBe('search-index-sha');
  });

  it('mergeOptionalManifestFiles requires matching run_date and core sha', () => {
    const source: Manifest = {
      ...rolling,
      files: {
        ...rolling.files,
        bank_history: optionalAsset('bank-history.json.gz', 'bh'),
      },
    };
    const targetSame: Manifest = {
      ...rolling,
      tag: 'app-payload-2026-07-28',
      files: {
        core: rolling.files.core,
        details: rolling.files.details,
      },
    };
    expect(mergeOptionalManifestFiles(targetSame, source).files.bank_history?.sha256).toBe('bh');

    const differentCore: Manifest = {
      ...targetSame,
      files: {
        ...targetSame.files,
        core: { ...targetSame.files.core, sha256: 'other-core' },
      },
    };
    expect(mergeOptionalManifestFiles(differentCore, source).files.bank_history).toBeUndefined();

    const differentDay: Manifest = {
      ...targetSame,
      run_date: '2026-07-27',
    };
    expect(mergeOptionalManifestFiles(differentDay, source).files.bank_history).toBeUndefined();
  });

  it('does not adopt a dated release when dates-index is ahead of rolling', async () => {
    const staleRolling: Manifest = {
      ...sampleManifest,
      run_date: '2026-07-26',
    };
    const indexAhead: DatesIndex = {
      schema_version: 1,
      dates: ['2026-07-25', '2026-07-27'],
      count: 2,
      min_date: '2026-07-25',
      latest_date: '2026-07-27',
    };
    const fetchDated = jest.fn(async () => {
      throw new Error('should not probe dated for stale rolling');
    });
    const resolution = await resolveFinalizedManifest(staleRolling, {
      fetchIndex: async () => indexAhead,
      fetchDated,
    });

    expect(resolution.status).toBe('pending');
    expect(resolution.pendingIngestRunDate).toBe('2026-07-26');
    expect(resolution.manifest).toBeNull();
    expect(fetchDated).not.toHaveBeenCalled();
  });

  it('returns finalized rolling when dates-index includes it', async () => {
    const index = {
      ...indexThrough27,
      dates: [...indexThrough27.dates, '2026-07-28'],
      latest_date: '2026-07-28',
      count: 4,
    };
    const resolution = await resolveFinalizedManifest(rolling, {
      fetchIndex: async () => index,
      fetchDated: jest.fn(),
    });

    expect(resolution).toEqual({
      status: 'finalized',
      manifest: rolling,
      pendingIngestRunDate: null,
      datesIndex: index,
    });
  });

  it('keeps pending with null manifest when dated fallback cannot load', async () => {
    const resolution = await resolveFinalizedManifest(rolling, {
      fetchIndex: async () => indexThrough27,
      fetchDated: async () => {
        throw new Error('network');
      },
    });

    expect(resolution.status).toBe('pending');
    expect(resolution.manifest).toBeNull();
    expect(resolution.pendingIngestRunDate).toBe('2026-07-28');
  });

  it('marks index-unavailable when dates-index fetch fails', async () => {
    const resolution = await resolveFinalizedManifest(rolling, {
      fetchIndex: async () => {
        throw new Error('dates-index HTTP 404');
      },
    });

    expect(resolution.status).toBe('index-unavailable');
    expect(resolution.manifest).toBe(rolling);
  });

  it('builds subtle pending banner copy with the day being shown', () => {
    expect(pendingIngestBannerMessage('2026-07-28', '2026-07-27')).toMatch(
      /still uploading.*showing/i,
    );
    expect(pendingIngestBannerMessage('2026-07-28', '2026-07-28')).toBe(
      'Today\u2019s rates are still uploading',
    );
  });
});
