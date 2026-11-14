import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { downloadInflate } from '../src/data/payload';
import { evidenceSelection } from '../testUtils/productEvidenceSelection';
import { statusSelection } from '../testUtils/productEvidenceStatusSelection';
import { ProductEvidenceCriteria } from '../src/components/product/ProductEvidenceCriteria';
import { ProductEvidenceDisclosure } from '../src/components/product/ProductEvidenceDisclosure';
import type { ProductEvidenceContext } from '../src/data/productEvidenceDocument';

let mockState: ProductEvidenceContext & { refresh?: jest.Mock };
const mockRefresh = jest.fn(async () => false);
jest.mock('../src/data/store', () => ({ useStore: Object.assign((select: (state: ProductEvidenceContext) => unknown) => select(mockState), { getState: () => mockState }) }));
jest.mock('../src/data/payload', () => ({ downloadInflate: jest.fn() }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ colors: { text: '#000' }, font: { tiny: 12 } }) }));
jest.mock('../src/components/ui', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return { AppText: 'AppText', Button: 'Button', Row: 'Row',
    Disclosure: ({ children, open, ...props }: any) => React.createElement('Disclosure', { ...props, open }, open ? children : null) };
});
type Tree = ReturnType<typeof TestRenderer.create> & { root: { findByProps: (props: object) => { props: Record<string, any> } }; toJSON: () => unknown };
const trees: Tree[] = [], rendered = (tree: Tree) => JSON.stringify(tree.toJSON());
async function until(check: () => boolean) {
  for (let i = 0; i < 100 && !check(); i++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); });
  expect(check()).toBe(true);
}
function render(p = evidenceSelection(), source = false) {
  mockState = { ...p.context, refresh: mockRefresh }; mockRefresh.mockReset().mockResolvedValue(false);
  jest.mocked(downloadInflate).mockReset().mockImplementation(p.load);
  let tree!: Tree;
  act(() => { tree = TestRenderer.create(source ? <ProductEvidenceDisclosure productKey={p.key} /> : <ProductEvidenceCriteria productKeys={[p.key]} />) as Tree; });
  trees.push(tree); return tree;
}
const press = (tree: Tree, title: string) => tree.root.findByProps({ title }).props.onPress();
const toggle = (tree: Tree, title = 'Source criteria') => tree.root.findByProps({ title }).props.onToggle();
afterEach(() => { for (const tree of trees.splice(0)) act(() => tree.unmount()); });

test('criteria is opt-in, search is selected-product literal text, and every matching record remains reachable', async () => {
  const tree = render(); expect(downloadInflate).not.toHaveBeenCalled();
  act(() => toggle(tree)); await until(() => rendered(tree).includes('fact_id'));
  expect(rendered(tree)).toContain('Selected products only'); expect(rendered(tree)).toContain('Eligibility unverified');
  act(() => press(tree, 'Last record')); await until(() => tree.root.findByProps({ title: 'Next record' }).props.disabled === true);
  act(() => { tree.root.findByProps({ accessibilityLabel: 'Search selected products' }).props.onChangeText('[not a regex'); });
  act(() => press(tree, 'Search')); await until(() => rendered(tree).includes('Not observed'));
  expect(rendered(tree)).not.toContain('fact_id'); expect(tree.root.findByProps({ title: 'Next record' }).props.disabled).toBe(true);
});

test.each(['pending', 'unavailable', 'failed'] as const)('%s performs no evidence IO and offers ordinary Refresh only', async status => {
  const tree = render(statusSelection(status)); act(() => toggle(tree)); await until(() => rendered(tree).includes('Refresh'));
  expect(downloadInflate).not.toHaveBeenCalled(); expect(() => tree.root.findByProps({ title: 'Retry' })).toThrow();
  let finish!: () => void; mockRefresh.mockImplementationOnce(() => new Promise<boolean>(resolve => { finish = () => resolve(false); }));
  act(() => { press(tree, 'Refresh'); press(tree, 'Refresh'); }); await until(() => mockRefresh.mock.calls.length === 1);
  expect(mockRefresh).toHaveBeenCalledWith({ manual: true });
  await act(async () => { finish(); }); expect(downloadInflate).not.toHaveBeenCalled();
});

test('closing aborts acquisition; a late response cannot repopulate closed criteria and reopening may retry', async () => {
  const p = evidenceSelection(), tree = render(p); let finish!: (text: string) => void;
  jest.mocked(downloadInflate).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  act(() => toggle(tree)); await until(() => jest.mocked(downloadInflate).mock.calls.length === 1);
  const [url, , options] = jest.mocked(downloadInflate).mock.calls[0]; act(() => toggle(tree)); expect(options?.signal?.aborted).toBe(true);
  await act(async () => { finish(await p.load(url)); }); expect(rendered(tree)).not.toContain('fact_id');
  act(() => toggle(tree)); await until(() => rendered(tree).includes('fact_id'));
});

test('a new selected edition cancels old criteria and never adopts its delayed bytes', async () => {
  const p = statusSelection(), tree = render(p); let finish!: (text: string) => void;
  jest.mocked(downloadInflate).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  act(() => toggle(tree)); await until(() => jest.mocked(downloadInflate).mock.calls.length === 1);
  const [url, , options] = jest.mocked(downloadInflate).mock.calls[0];
  delete p.manifest.product_evidence_v1; p.manifest.optional_product_evidence_status!.lanes.product_evidence_v1 = { state: 'pending', reason: 'not_prepared' }; p.seal(2);
  mockState = { ...p.context, manifest: { ...p.manifest }, productEvidenceHead: { ...p.head }, refresh: mockRefresh };
  act(() => tree.update(<ProductEvidenceCriteria productKeys={[p.key]} />)); expect(options?.signal?.aborted).toBe(true);
  await act(async () => { finish(await p.load(url)); }); await until(() => rendered(tree).includes('Pending'));
  expect(rendered(tree)).not.toContain('fact_id'); expect(downloadInflate).toHaveBeenCalledTimes(1);
});

test('criteria relinquishes a retained source document and releases its shared lease after completion or error', async () => {
  const tree = render(evidenceSelection(), true);
  act(() => toggle(tree, 'Source evidence')); await until(() => rendered(tree).includes('First fact'));
  act(() => toggle(tree)); await until(() => rendered(tree).includes('Paused') && rendered(tree).includes('Matching records'));
  // The source view can acquire again; stale criteria cleanup must not clear its lease.
  act(() => press(tree, 'Retry')); await until(() => rendered(tree).includes('First fact'));
  act(() => toggle(tree)); expect(rendered(tree)).toContain('First fact');
  act(() => toggle(tree, 'Source evidence'));
  jest.mocked(downloadInflate).mockRejectedValueOnce(new Error('transport unavailable'));
  // Use a different selected capability to avoid the bounded capability cache.
  const next = evidenceSelection(); mockState = { ...next.context, refresh: mockRefresh };
  act(() => tree.update(<ProductEvidenceDisclosure productKey={next.key} />)); act(() => toggle(tree));
  await until(() => rendered(tree).includes('Failed'));
  jest.mocked(downloadInflate).mockImplementation(next.load); act(() => press(tree, 'Retry'));
  await until(() => rendered(tree).includes('Matching records'));
});
