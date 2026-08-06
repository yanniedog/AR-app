import { browseRouteRequestPending, parseBrowsePath, scalarRouteParam } from '../src/lib/nav';

describe('scalarRouteParam', () => {
  test('normalizes repeated and missing query parameters', () => {
    expect(scalarRouteParam(['first', 'second'])).toBe('first');
    expect(scalarRouteParam('only')).toBe('only');
    expect(scalarRouteParam()).toBeUndefined();
  });
});

describe('parseBrowsePath', () => {
  test('splits dot-delimited path segments', () => {
    expect(parseBrowsePath('FIXED.OWNER')).toEqual(['FIXED', 'OWNER']);
  });

  test('returns empty array for missing path', () => {
    expect(parseBrowsePath()).toEqual([]);
    expect(parseBrowsePath('')).toEqual([]);
  });

  test('uses first element when expo-router returns string[]', () => {
    expect(parseBrowsePath(['FIXED.OWNER', 'OTHER'])).toEqual(['FIXED', 'OWNER']);
  });
});

describe('browseRouteRequestPending', () => {
  test('reprocesses a repeated parameter-only route after another screen changes section', () => {
    expect(browseRouteRequestPending(
      'section:mortgage',
      'section:mortgage',
      'Mortgage',
      'Savings',
    )).toBe(true);
  });

  test('does not reprocess a consumed route when the requested section is already active', () => {
    expect(browseRouteRequestPending(
      'section:mortgage',
      'section:mortgage',
      'Mortgage',
      'Mortgage',
    )).toBe(false);
  });
});
