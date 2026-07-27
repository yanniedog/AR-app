import type { Manifest } from '../src/types';
import { sampleManifest } from '../src/data/sample';
import {
  isManifestFinalized,
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
    const fetchDated = jest.fn(async () => finalizedDay);
    const resolution = await resolveFinalizedManifest(rolling, {
      fetchIndex: async () => indexThrough27,
      fetchDated,
    });

    expect(resolution.status).toBe('pending');
    expect(resolution.pendingIngestRunDate).toBe('2026-07-28');
    expect(resolution.manifest?.run_date).toBe('2026-07-27');
    expect(fetchDated).toHaveBeenCalledWith('2026-07-27');
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
