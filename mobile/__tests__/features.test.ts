import {
  distinctAccountFeatures,
  featureTypeKey,
  productFeatureTypes,
  productHasAllFeatures,
} from '../src/data/features';
import type { ProductDetail } from '../src/types';

describe('features', () => {
  test('featureTypeKey prefers label over name', () => {
    expect(featureTypeKey({ label: 'OFFSET', name: '100% offset' })).toBe('OFFSET');
    expect(featureTypeKey({ name: 'REDRAW' })).toBe('REDRAW');
  });

  test('productHasAllFeatures requires every selected featureType', () => {
    const lookup: Record<string, ProductDetail> = {
      'A|1': {
        features: [{ label: 'OFFSET' }, { label: 'REDRAW' }],
      },
      'B|1': {
        features: [{ label: 'OFFSET' }],
      },
    };
    expect(productHasAllFeatures('A|1', [], lookup)).toBe(true);
    expect(productHasAllFeatures('A|1', ['OFFSET'], lookup)).toBe(true);
    expect(productHasAllFeatures('A|1', ['OFFSET', 'REDRAW'], lookup)).toBe(true);
    expect(productHasAllFeatures('B|1', ['OFFSET', 'REDRAW'], lookup)).toBe(false);
    expect(productHasAllFeatures('A|1', ['OFFSET'], null)).toBe(false);
  });

  test('distinctAccountFeatures sorts alphabetically by display label', () => {
    const lookup: Record<string, ProductDetail> = {
      'A|1': { features: [{ label: 'OFFSET' }, { label: 'REDRAW' }] },
      'B|1': { features: [{ label: 'OFFSET' }] },
      'C|1': { features: [{ label: 'DIGITAL_BANKING' }] },
    };
    const rows = [
      { product_key: 'A|1', provider: 'X', product_name: 'A', rate: '0.05' },
      { product_key: 'A|1', provider: 'X', product_name: 'A', rate: '0.06' },
      { product_key: 'B|1', provider: 'Y', product_name: 'B', rate: '0.05' },
      { product_key: 'C|1', provider: 'Z', product_name: 'C', rate: '0.05' },
    ];
    expect(distinctAccountFeatures(rows, lookup)).toEqual(['DIGITAL_BANKING', 'OFFSET', 'REDRAW']);
    expect(productFeatureTypes(lookup['A|1'])).toEqual(new Set(['OFFSET', 'REDRAW']));
  });

  test('promotes only curated normalized feature keys and still matches them', () => {
    const lookup: Record<string, ProductDetail> = {
      'A|1': { facts: [
        { id: 'offset-1', kind: 'feature', canonicalKey: 'OFFSET', value: true, unit: 'boolean' },
        { id: 'raw-1', kind: 'feature', canonicalKey: 'INTERNAL_PROVIDER_FLAG', value: true },
        { id: 'condition-1', kind: 'condition', canonicalKey: 'REDRAW', condition: 'Ask the bank' },
      ], features: [{ label: 'REDRAW' }] },
    };
    const rows = [{ product_key: 'A|1', provider: 'X', product_name: 'A', rate: '0.05' }];

    expect(productFeatureTypes(lookup['A|1'])).toEqual(new Set(['OFFSET']));
    expect(productHasAllFeatures('A|1', ['OFFSET'], lookup)).toBe(true);
    expect(distinctAccountFeatures(rows, lookup)).toEqual(['OFFSET']);
  });

  test('resolves namespaced feature keys and excludes explicit negative facts', () => {
    const lookup: Record<string, ProductDetail> = {
      'A|1': { facts: [
        { id: 'offset-true', kind: 'feature', canonicalKey: 'feature.offset', sourceType: 'OFFSET', value: true },
        { id: 'redraw-false', kind: 'feature', canonicalKey: 'feature.redraw', sourceType: 'REDRAW', value: false },
      ] },
      'B|1': { facts: [
        { id: 'offset-false', kind: 'feature', canonicalKey: 'feature.offset', sourceType: 'OFFSET', value: false },
      ] },
    };

    expect(productFeatureTypes(lookup['A|1'])).toEqual(new Set(['OFFSET']));
    expect(productFeatureTypes(lookup['B|1'])).toEqual(new Set());
  });
});
