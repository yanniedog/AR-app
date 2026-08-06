import { buildBrowseRouteParams } from '../src/lib/browseRoute';
import { parseBrowsePath, scalarRouteParam } from '../src/lib/nav';

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

describe('buildBrowseRouteParams', () => {
  test('gives repeated parameterized entries unique consumable identities', () => {
    const first = buildBrowseRouteParams('Mortgage', ['FIXED', 'OWNER']);
    const second = buildBrowseRouteParams('Mortgage', ['FIXED', 'OWNER']);

    expect(first).toMatchObject({ section: 'home-loans', path: 'FIXED.OWNER' });
    expect(second).toMatchObject({ section: 'home-loans', path: 'FIXED.OWNER' });
    expect(second.request).not.toBe(first.request);
  });
});
