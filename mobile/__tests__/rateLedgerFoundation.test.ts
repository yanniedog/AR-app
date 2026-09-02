import {
  formatEvidenceDate,
  freshnessDeadlineUtc,
  mapDisplayEvidence,
} from '../src/data/displayEvidence';
import { contrastRatio, LEDGER_DARK, LEDGER_LIGHT } from '../src/theme/colors';
import { ledgerMotionDuration } from '../src/theme/motion';
import { THIRD_PARTY_NOTICES } from '../src/content/thirdPartyNotices';

const NOW = new Date(2026, 8, 3, 12, 0, 0);

describe('Rate Ledger data evidence', () => {
  it('claims full coverage only from explicit reconciled provider counts', () => {
    const complete = mapDisplayEvidence({
      source: 'remote',
      offline: false,
      runDate: '2026-09-03',
      now: NOW,
      coverage: {
        providers_attempted: 72,
        providers_succeeded: 72,
        provider_failures: [],
        counts: { providers_failed: 0, providers_partial: 0 },
      },
    });
    expect(complete.label).toBe('Updated today · full coverage');
    expect(complete.coverageState).toBe('complete');

    const unknown = mapDisplayEvidence({
      source: 'remote',
      offline: false,
      runDate: '2026-09-03',
      now: NOW,
      coverage: { provider_failures: [] },
    });
    expect(unknown.label).toBe('Updated today');
    expect(unknown.coverageState).toBe('unknown');

    const equalButUnreconciled = mapDisplayEvidence({
      source: 'remote',
      offline: false,
      runDate: '2026-09-03',
      now: NOW,
      coverage: { providers_attempted: 72, providers_succeeded: 72 },
    });
    expect(equalButUnreconciled.label).toBe('Updated today');
    expect(equalButUnreconciled.coverageState).toBe('unknown');
  });

  it('puts partial coverage ahead of offline/cache presentation', () => {
    const result = mapDisplayEvidence({
      source: 'cache',
      offline: true,
      runDate: '2026-09-02',
      now: NOW,
      coverage: {
        providers_attempted: 72,
        providers_succeeded: 70,
        provider_failures: [{ provider: 'Example Bank', reason: 'timeout' }],
        counts: { providers_failed: 2 },
      },
    });
    expect(result.kind).toBe('partial');
    expect(result.label).toBe('Partial coverage');
    expect(result.facts).toContain('Coverage issue: Example Bank — timeout');
  });

  it('never presents sample data as current', () => {
    const result = mapDisplayEvidence({
      source: 'sample',
      offline: false,
      runDate: '2026-09-03',
      now: NOW,
    });
    expect(result.kind).toBe('sample');
    expect(result.label).toBe('Sample data');
  });

  it('separates unavailable, overdue, offline and saved states', () => {
    expect(mapDisplayEvidence({
      source: 'remote', offline: false, assetStatus: 'unavailable', hasUsableData: false,
    }).kind).toBe('unavailable');

    expect(mapDisplayEvidence({
      source: 'remote', offline: false, runDate: '2026-09-02', now: NOW,
      overdueAfterUtc: '2026-09-03T01:00:00Z',
    }).kind).toBe('overdue');

    expect(mapDisplayEvidence({
      source: 'cache', offline: true, runDate: '2026-09-02', now: NOW,
    }).kind).toBe('offline');

    expect(mapDisplayEvidence({
      source: 'cache', offline: false, runDate: '2026-09-02', now: NOW,
    }).kind).toBe('saved');
  });

  it('shows retained data while checking for an update and preserves overdue offline truth', () => {
    expect(mapDisplayEvidence({
      source: 'remote', offline: false, runDate: '2026-09-03', now: NOW,
      assetStatus: 'loading', hasUsableData: true,
    })).toMatchObject({ kind: 'loading', label: 'Checking for update' });

    expect(mapDisplayEvidence({
      source: 'cache', offline: true, runDate: '2026-09-02', now: NOW,
      overdueAfterUtc: '2026-09-03T01:00:00Z',
    })).toMatchObject({ kind: 'offline', label: 'Offline · update overdue', tone: 'danger' });
  });

  it('applies the same freshness grace window as app health', () => {
    const deadline = freshnessDeadlineUtc('2026-09-03T01:00:00Z', 24 * 60 * 60 * 1_000);
    expect(deadline).toBe('2026-09-04T01:00:00.000Z');
    expect(mapDisplayEvidence({
      source: 'remote', offline: false, runDate: '2026-09-03',
      now: new Date('2026-09-03T12:00:00Z'), overdueAfterUtc: deadline,
    }).kind).toBe('current');
  });

  it('does not call an undated, unconfirmed remote result verified data', () => {
    const result = mapDisplayEvidence({ source: 'remote', offline: false, now: NOW });
    expect(result.kind).toBe('unavailable');
    expect(result.label).toBe('Data unavailable');
  });

  it('validates and formats calendar dates without rolling invalid days', () => {
    expect(formatEvidenceDate('2026-02-28')).toMatch(/28 Feb 2026/);
    expect(formatEvidenceDate('2026-02-31')).toBe('Date not provided');
    expect(formatEvidenceDate(null)).toBe('Date not provided');
  });
});

describe('Rate Ledger visual tokens', () => {
  it('ships complete user-readable notices with redistributed fonts and icon geometry', () => {
    for (const notice of THIRD_PARTY_NOTICES) {
      expect(notice.noticeText).toMatch(/Copyright/i);
      expect(notice.noticeText.length).toBeGreaterThan(900);
    }
  });

  it('keeps primary and secondary ink readable on paper', () => {
    expect(contrastRatio(LEDGER_LIGHT.ink, LEDGER_LIGHT.paper)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(LEDGER_LIGHT.mutedInk, LEDGER_LIGHT.paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(LEDGER_DARK.ink, LEDGER_DARK.paper)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(LEDGER_DARK.mutedInk, LEDGER_DARK.paper)).toBeGreaterThanOrEqual(4.5);
  });

  it('uses accessible ink on the wattle action fill', () => {
    expect(contrastRatio(LEDGER_LIGHT.onWattle, LEDGER_LIGHT.wattle)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(LEDGER_DARK.onWattle, LEDGER_DARK.wattle)).toBeGreaterThanOrEqual(4.5);
  });

  it('removes motion when reduced-motion state is true or unresolved', () => {
    expect(ledgerMotionDuration(false, 'state')).toBe(160);
    expect(ledgerMotionDuration(true, 'navigation')).toBe(0);
    expect(ledgerMotionDuration(null, 'navigation')).toBe(0);
  });
});
