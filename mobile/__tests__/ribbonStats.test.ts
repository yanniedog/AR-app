import core from '../assets/sample/core.json';
import { resolveSectionRibbonStats, ribbonToRateStats, hasPayloadRibbon } from '../src/data/ribbonStats';
import { visibleAccountRows } from '../src/data/format';
import { rowsUnder, statsFor } from '../src/data/taxonomy';
import type { CorePayload, SectionKey } from '../src/types';

const sample = core as CorePayload;

describe('ribbonStats', () => {
  it('maps payload ribbon range and counts to RateStats', () => {
    const ribbon = sample.sections.Mortgage.ribbon;
    expect(hasPayloadRibbon(ribbon)).toBe(true);
    const stats = ribbonToRateStats(ribbon);
    expect(stats.min).toBeCloseTo(0.0279, 4);
    expect(stats.max).toBeCloseTo(0.1177, 4);
    expect(stats.count).toBe(5346);
    expect(stats.providers).toBe(51);
  });

  it('uses filtered hierarchy rows when non-standard is excluded', () => {
    const section = 'Mortgage' as SectionKey;
    const data = sample.sections[section];
    const hierRows = rowsUnder(data.rates, section, []);
    const stats = resolveSectionRibbonStats(data, hierRows, false, section);
    const expected = statsFor(visibleAccountRows(hierRows, false), true, section);
    expect(stats.min).toBe(expected.min);
    expect(stats.max).toBe(expected.max);
  });

  it('recomputes from rows when non-standard accounts are included', () => {
    const section = 'Mortgage' as SectionKey;
    const data = sample.sections[section];
    const hierRows = rowsUnder(data.rates, section, []);
    const stats = resolveSectionRibbonStats(data, hierRows, true, section);
    const expected = statsFor(hierRows, true, section);
    expect(stats.min).toBe(expected.min);
    expect(stats.max).toBe(expected.max);
  });


  it('treats incomplete payload ribbon as missing', () => {
    const data = {
      ...sample.sections.Mortgage,
      ribbon: { range: { min: null, max: 0.1, mean: null, median: null }, counts: { rates: 1, products: 1, providers: 1 }, providers: [] },
    };
    expect(hasPayloadRibbon(data.ribbon)).toBe(false);
    const stats = resolveSectionRibbonStats(data, [], false);
    expect(stats.min).toBeNull();
  });

  it('returns empty stats when ribbon and rows are absent', () => {
    const stats = resolveSectionRibbonStats(undefined, [], false);
    expect(stats.min).toBeNull();
    expect(stats.count).toBe(0);
  });
  it('falls back to payload ribbon when filtered rows yield no stats', () => {
    const stats = resolveSectionRibbonStats(
      sample.sections.Mortgage,
      [],
      false,
    );
    expect(stats.min).toBe(sample.sections.Mortgage.ribbon.range.min);
  });

  it('excludes token near-zero deposit rates from Savings ribbon stats', () => {
    const section = 'Savings' as SectionKey;
    const rows = [
      {
        provider: 'Bank A',
        product_key: 'JUNK|S',
        product_name: 'Access',
        rate: '0.0001',
        taxonomy_path: 'SAVINGS',
      },
      {
        provider: 'Bank B',
        product_key: 'OK|S',
        product_name: 'High Saver',
        rate: '0.045',
        taxonomy_path: 'SAVINGS',
      },
      {
        provider: 'Bank C',
        product_key: 'MID|S',
        product_name: 'Mid Saver',
        rate: '0.025',
        taxonomy_path: 'SAVINGS',
      },
    ];
    const stats = statsFor(rows, true, section);
    expect(stats.min).toBeCloseTo(0.025, 4);
    expect(stats.max).toBeCloseTo(0.045, 4);
    expect(stats.count).toBe(2);
  });

  it('excludes token near-zero deposit rates from TD ribbon stats', () => {
    const section = 'TD' as SectionKey;
    const rows = [
      {
        provider: 'Bank A',
        product_key: 'FX|TD',
        product_name: 'EURO TD',
        rate: '0.0001',
        taxonomy_path: 'TERM_DEPOSIT',
      },
      {
        provider: 'Bank B',
        product_key: 'AUD|TD',
        product_name: '12 Month TD',
        rate: '0.041',
        taxonomy_path: 'TERM_DEPOSIT',
      },
    ];
    const stats = statsFor(rows, true, section);
    expect(stats.min).toBeCloseTo(0.041, 4);
    expect(stats.max).toBeCloseTo(0.041, 4);
    expect(stats.count).toBe(1);
  });
});
