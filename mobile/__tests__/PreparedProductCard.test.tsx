import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { PreparedProductCard } from '../src/components/rates/PreparedProductCard';
import { row } from '../testUtils/publicRateJourney';
const mockCard = jest.fn((_props: unknown) => null);
jest.mock('../src/components/ProductCard', () => ({ ProductCard: (props: unknown) => mockCard(props) }));
test('only a retained exact fixed-quote owner may suppress a scenario-only graphical rerender', () => {
  const owner = {}, onPress = jest.fn(); let tree!: ReactTestRenderer;
  const render = (amount: string, quoteOwner: object | null, selected = false) => <PreparedProductCard row={row} section="Mortgage" onPress={onPress} selected={selected} quoteOwner={quoteOwner} rateScenario={{ amount }} />;
  act(() => { tree = TestRenderer.create(render('650000', owner)); }); expect(mockCard).toHaveBeenCalledTimes(1);
  act(() => tree.update(render('650001', owner))); expect(mockCard).toHaveBeenCalledTimes(1);
  act(() => tree.update(render('650001', owner, true))); expect(mockCard).toHaveBeenCalledTimes(2);
  act(() => tree.update(render('650001', {}, true))); expect(mockCard).toHaveBeenCalledTimes(3);
  act(() => tree.update(render('650002', null, true))); expect(mockCard).toHaveBeenCalledTimes(4);
  act(() => tree.update(render('650003', null, true))); expect(mockCard).toHaveBeenCalledTimes(5);
  act(() => tree.unmount());
});
