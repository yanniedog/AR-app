import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import { InfoRow } from '../src/components/settings/settingsUi';

let mockDimensions = { width: 411, height: 915, scale: 2.625, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ default: () => mockDimensions }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => jest.requireActual('../src/theme/theme').lightTheme }));

type TestNode = {
  props: { children?: unknown; style?: StyleProp<TextStyle>; allowFontScaling?: boolean;
    numberOfLines?: number; maxFontSizeMultiplier?: number; adjustsFontSizeToFit?: boolean };
  findByType: (type: React.ElementType) => TestNode;
  findAllByType: (type: React.ElementType) => TestNode[];
};
type Renderer = ReactTestRenderer & { root: TestNode };
let tree: Renderer | undefined;
const facts = <InfoRow label="Fees / eligibility / conditions" value="Partial / Unknown" />;
afterEach(() => { if (tree) act(() => tree!.unmount()); tree = undefined; });

test.each([
  [320, 1, true], [360, 1, true], [411, 1, false],
  [360, 2, true], [411, 2, true], [720, 2, true],
])('necessary facts remain complete at %sdp/font%s (stacked=%s)', (width, fontScale, stacked) => {
  mockDimensions = { ...mockDimensions, width: Number(width), fontScale: Number(fontScale) };
  act(() => { tree = TestRenderer.create(facts) as Renderer; });
  const container = StyleSheet.flatten(tree!.root.findByType(View).props.style);
  expect(container).toMatchObject({ flexDirection: stacked ? 'column' : 'row', alignItems: stacked ? 'stretch' : 'flex-start',
    gap: stacked ? 4 : 12 });
  const [label, value] = tree!.root.findAllByType(Text);
  expect(label.props.children).toBe('Fees / eligibility / conditions');
  expect(value.props.children).toBe('Partial / Unknown');
  for (const text of [label, value]) {
    expect(StyleSheet.flatten(text.props.style)).toMatchObject({ flexShrink: 1, minWidth: 0 });
    expect(StyleSheet.flatten(text.props.style).flex).toBe(stacked ? undefined : 1);
    expect(text.props.allowFontScaling).toBe(true);
    expect(text.props.numberOfLines).toBeUndefined();
    expect(text.props.maxFontSizeMultiplier).toBeUndefined();
    expect(text.props.adjustsFontSizeToFit).not.toBe(true);
    expect(StyleSheet.flatten(text.props.style).marginLeft).toBeUndefined();
  }
  expect(StyleSheet.flatten(value.props.style).textAlign).toBe(stacked ? 'left' : 'right');
});

test('an existing factual row reflows through live large-text changes without replacing its value', () => {
  mockDimensions = { ...mockDimensions, width: 411, fontScale: 1 };
  act(() => { tree = TestRenderer.create(<InfoRow label="Data set" value="Unknown" />) as Renderer; });
  for (const fontScale of [2, 1]) {
    mockDimensions = { ...mockDimensions, fontScale };
    act(() => tree!.update(<InfoRow label="Data set" value="Unknown" />));
    expect(StyleSheet.flatten(tree!.root.findByType(View).props.style).flexDirection).toBe(fontScale === 2 ? 'column' : 'row');
    expect(tree!.root.findAllByType(Text).map(text => text.props.children)).toEqual(['Data set', 'Unknown']);
  }
});
