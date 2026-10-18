import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { SavedRequirementsSummary } from '../src/components/SavedRequirementsSummary';
import { EMPTY_PROFILE } from '../src/data/profile';
import { profileRequirementImpact } from '../src/data/profileRequirements';
import type { CorePayload, RateRow } from '../src/types';

const raw: RateRow[] = [
  { product_key: 'a', product_name: 'A', provider: 'A', rate: '0.05', rate_type: 'VARIABLE' },
  { product_key: 'a', product_name: 'A', provider: 'A', rate: '0.06', rate_type: 'VARIABLE' },
  { product_key: 'unresolved', product_name: 'Unknown', provider: 'B', rate: '0.07', rate_type: 'FIXED' },
];
const resolved: RateRow[] = [raw[0], { product_key: 'new-public-offer', product_name: 'New', provider: 'C', rate: '0.055', rate_type: 'FIXED' }];
const mockCore = { sections: { Mortgage: { rates: raw }, Savings: { rates: [] }, TD: { rates: [] } } } as unknown as CorePayload;
const mockProfile = { ...EMPTY_PROFILE, rateTypes: ['FIXED'] };
jest.mock('../src/data/store', () => ({ useStore: (selector: (state: unknown) => unknown) => selector({
  core: mockCore, prefs: { profileFilters: mockProfile }, details: null, coreIntegrity: null, manifest: null,
}) }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button', Row: 'Row' }));

it('counts the resolved catalogue before saved requirements, including synthetic offers and excluding unresolved duplicates', () => {
  expect(profileRequirementImpact(mockCore, mockProfile, 'Mortgage', null, resolved)).toEqual({
    catalogue: { rates: 2, products: 2, banks: 2 }, matching: { rates: 1, products: 1, banks: 1 },
  });
  expect(raw).toHaveLength(3);
  expect(profileRequirementImpact(mockCore, mockProfile, 'Mortgage', null, null)).toEqual({ catalogue: null, matching: null });
});

it('renders the supplied resolved catalogue facts instead of raw core counts', () => {
  let tree: any;
  act(() => { tree = TestRenderer.create(<SavedRequirementsSummary section="Mortgage" catalogueRows={resolved} />); });
  try {
    const text = tree.root.findAllByType('AppText').map((node: any) => node.props.children);
    expect(text).toContain('Catalogue: 2 products · 2 banks · 2 rates');
    expect(text).toContain('After saved requirements: 1 products · 1 banks · 1 rates');
  } finally { act(() => tree.unmount()); }
});
