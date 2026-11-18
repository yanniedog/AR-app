import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { TextInput } from 'react-native';
import { CurrencyInput } from '../src/components/CurrencyInput';

type TestNode = { props: Record<string, any> };
type Renderer = ReactTestRenderer & { root: {
  findByType(type: unknown): TestNode;
  findAllByProps(props: Record<string, unknown>): TestNode[];
} };

jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ colors: {}, font: { body: 16 } }) }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText' }));

test('unit switches preserve the amount and dollars are grouped; typing preserves partial decimals', () => {
  const change = jest.fn();
  let tree!: Renderer;
  const screen = (value: string) => <CurrencyInput label="Loan amount" value={value} onChangeText={change} />;
  act(() => { tree = TestRenderer.create(screen('750000')) as Renderer; });
  const input = () => tree.root.findByType(TextInput);
  const unit = () => tree.root.findAllByProps({ accessibilityLabel: 'Amount unit' }).find(node => typeof node.props.onPress === 'function')!;
  expect(input().props.value).toBe('750');
  act(() => unit().props.onPress());
  expect(input().props.value).toBe('0.75');
  act(() => unit().props.onPress());
  expect(input().props.value).toBe('750,000');
  expect(change).not.toHaveBeenCalled();
  act(() => unit().props.onPress());
  act(() => input().props.onChangeText('775.'));
  expect(change).toHaveBeenLastCalledWith('775000');
  act(() => tree.update(screen('775000')));
  expect(input().props.value).toBe('775.');
  act(() => input().props.onChangeText('775.5'));
  expect(change).toHaveBeenLastCalledWith('775500');
  act(() => tree.update(screen('775500')));
  expect(input().props.value).toBe('775.5');
  act(() => input().props.onChangeText('not a number'));
  expect(change).toHaveBeenLastCalledWith('not a number');
  expect(input().props.value).toBe('not a number');
  act(() => tree.update(screen('500000')));
  expect(input().props.value).toBe('500');
  act(() => tree.unmount());
});
