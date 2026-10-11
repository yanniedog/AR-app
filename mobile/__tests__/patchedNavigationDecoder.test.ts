import { getStateFromPath } from '@react-navigation/core';

describe('patched navigation query decoder', () => {
  const options = { screens: { product: 'products/:id' } };

  it('preserves encoded route IDs, Unicode query values and embedded URL paths', () => {
    const state = getStateFromPath('/products/a%20b?name=%E2%82%AC&next=%2Fbanks%2Fdemo', options);
    expect(state?.routes[0]).toMatchObject({
      name: 'product', params: { id: 'a b', name: '€', next: '/banks/demo' },
    });
  });

  it('retains malformed query text and repeated query parameters', () => {
    const state = getStateFromPath('/products/demo?name=%E0%A4%A&tag=one&tag=two', options);
    expect(state?.routes[0].params).toMatchObject({ name: '%E0%A4%A', tag: ['one', 'two'] });
  });

  it('handles a long malformed percent sequence without recursive decoding', () => {
    const malformed = '%'.repeat(20_000);
    const state = getStateFromPath(`/products/demo?name=${malformed}`, options);
    expect(state?.routes[0].params).toMatchObject({ name: malformed });
  });
});
