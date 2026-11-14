import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { downloadInflate } from '../src/data/payload';
import { evidenceSelection } from '../testUtils/productEvidenceSelection';
import { ProductEvidenceDisclosure } from '../src/components/product/ProductEvidenceDisclosure';
import type { ProductEvidenceContext } from '../src/data/productEvidenceDocument';

let mockState: ProductEvidenceContext;
jest.mock('../src/data/store', () => ({ useStore: Object.assign((select: (state: ProductEvidenceContext) => unknown) => select(mockState), { getState: () => mockState }) }));
jest.mock('../src/data/payload', () => ({ downloadInflate: jest.fn() }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ colors: { text: '#000' }, font: { tiny: 12 } }) }));
jest.mock('../src/components/ui', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return { AppText: 'AppText', Button: 'Button', Row: 'Row',
    Disclosure: ({ children, open, ...props }: any) => React.createElement('Disclosure', { ...props, open }, open ? children : null) };
});
type Tree = ReturnType<typeof TestRenderer.create> & { root: { findByProps: (props: object) => { props: Record<string, any> } }; toJSON: () => unknown };
const trees: Tree[] = [];
const rendered = (tree: Tree) => JSON.stringify(tree.toJSON());
async function until(check: () => boolean) {
  for (let i = 0; i < 100 && !check(); i++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); });
  expect(check()).toBe(true);
}
function render(p: ReturnType<typeof evidenceSelection>) {
  mockState = p.context; jest.mocked(downloadInflate).mockReset().mockImplementation(p.load);
  let tree!: Tree; act(() => { tree = TestRenderer.create(<ProductEvidenceDisclosure productKey={p.key} />) as Tree; }); trees.push(tree); return tree;
}
const button = (tree: Tree, title: string) => tree.root.findByProps({ title }).props.onPress();
afterEach(() => { for (const tree of trees.splice(0)) act(() => tree.unmount()); });

test('closed disclosure makes no request; explicit opening pages through captured facts', async () => {
  const p = evidenceSelection(), tree = render(p); expect(downloadInflate).not.toHaveBeenCalled();
  act(() => tree.root.findByProps({ title: 'Source evidence' }).props.onToggle());
  await until(() => rendered(tree).includes('Last fact'));
  expect(rendered(tree)).toContain('No approval'); expect(rendered(tree)).toContain('Unverified');
  act(() => button(tree, 'Last fact')); expect(tree.root.findByProps({ title: 'Next fact' }).props.disabled).toBe(true);
  act(() => button(tree, 'First fact')); expect(tree.root.findByProps({ title: 'Previous fact' }).props.disabled).toBe(true);
  act(() => tree.root.findByProps({ title: 'Source evidence' }).props.onToggle());
  expect(rendered(tree)).not.toContain('fact_id');
});
test('raw body and declared alternative are separate explicit actions', async () => {
  const p = evidenceSelection('product_response_evidence_v1'), tree = render(p);
  act(() => tree.root.findByProps({ title: 'Source evidence' }).props.onToggle());
  await until(() => rendered(tree).includes('Unavailable')); expect(downloadInflate).not.toHaveBeenCalled();
  act(() => button(tree, 'Original response')); await until(() => rendered(tree).includes('Last response'));
  const calls = jest.mocked(downloadInflate).mock.calls.length;
  act(() => button(tree, 'Last response')); expect(downloadInflate).toHaveBeenCalledTimes(calls);
  expect(rendered(tree)).toContain('Product index');
  act(() => button(tree, 'Open response')); await until(() => rendered(tree).includes('First page'));
  expect(rendered(tree)).toContain('No approval'); expect(rendered(tree)).toContain('Product index');
});
test('closing cancels an in-flight acquisition and a new open may retry', async () => {
  const p = evidenceSelection(), tree = render(p); let finish!: (text: string) => void;
  jest.mocked(downloadInflate).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  act(() => tree.root.findByProps({ title: 'Source evidence' }).props.onToggle());
  await until(() => jest.mocked(downloadInflate).mock.calls.length === 1);
  const signal = jest.mocked(downloadInflate).mock.calls[0][2]?.signal;
  act(() => tree.root.findByProps({ title: 'Source evidence' }).props.onToggle()); expect(signal?.aborted).toBe(true);
  await act(async () => { finish(await p.load(jest.mocked(downloadInflate).mock.calls[0][0])); });
  expect(downloadInflate).toHaveBeenCalledTimes(1); expect(rendered(tree)).not.toContain('fact_id');
  act(() => tree.root.findByProps({ title: 'Source evidence' }).props.onToggle()); await until(() => rendered(tree).includes('First fact'));
});
test('source identity change hides prior data immediately and cannot adopt a late result', async () => {
  const p = evidenceSelection(), tree = render(p); let finish!: (text: string) => void;
  jest.mocked(downloadInflate).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  act(() => tree.root.findByProps({ title: 'Source evidence' }).props.onToggle());
  await until(() => jest.mocked(downloadInflate).mock.calls.length === 1);
  const signal = jest.mocked(downloadInflate).mock.calls[0][2]?.signal;
  mockState = { ...p.context, productEvidenceHead: null };
  act(() => tree.update(<ProductEvidenceDisclosure productKey={p.key} />)); expect(signal?.aborted).toBe(true);
  await act(async () => { finish(await p.load(jest.mocked(downloadInflate).mock.calls[0][0])); });
  await until(() => rendered(tree).includes('Unverified'));
  expect(rendered(tree)).not.toContain('fact_id'); expect(downloadInflate).toHaveBeenCalledTimes(1);
});
test('only one comparison disclosure retains a full source document', async () => {
  const p = evidenceSelection(), first = render(p), second = render(p);
  act(() => first.root.findByProps({ title: 'Source evidence' }).props.onToggle()); await until(() => rendered(first).includes('First fact'));
  act(() => second.root.findByProps({ title: 'Source evidence' }).props.onToggle()); await until(() => rendered(second).includes('First fact'));
  expect(rendered(first)).toContain('Paused'); expect(rendered(first)).not.toContain('fact_id');
  act(() => button(first, 'Retry')); await until(() => rendered(first).includes('First fact'));
  expect(rendered(second)).toContain('Paused'); expect(rendered(second)).not.toContain('fact_id');
});
