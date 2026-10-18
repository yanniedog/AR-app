import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { ProfileEditor } from '../src/components/ProfileEditor';
import { RatesPagination } from '../src/components/RatesPagination';
import { EMPTY_PROFILE } from '../src/data/profile';
import type { ProfileFilters } from '../src/data/profile';
import { installMandatoryEligibility } from '../src/data/eligibilityGate';
import { selectMandatoryEligibility } from '../src/data/mandatoryEligibility';

let mockCore: any;
jest.mock('../src/data/store', () => ({ useStore: (selector: (state: any) => unknown) => selector({ core: mockCore }) }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ spacing: (n: number) => n * 4 }) }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Chip: 'Chip', Row: 'Row', Button: 'Button' }));
jest.mock('../src/components/controls', () => ({ SegmentedControl: 'SegmentedControl' }));

function core(types: string[]) { return { sections: { Mortgage: { rates: types.map((rate_type, index) => ({
  rate_type, product_key: String(index), product_name: String(index), provider: 'A', rate: '0.05',
})) }, Savings: { rates: [] }, TD: { rates: [] } } }; }
afterEach(() => installMandatoryEligibility(selectMandatoryEligibility(null, EMPTY_PROFILE, null)));

test('all selected values remain visible beyond the old twelve-option limit and every available value is reachable', () => {
  mockCore = core(Array.from({ length: 18 }, (_, i) => `TYPE_${i}`));
  const onChange = jest.fn(); let tree: any;
  const value = { ...EMPTY_PROFILE, rateTypes: ['TYPE_17', 'REMOVED_TYPE'] };
  installMandatoryEligibility(selectMandatoryEligibility(mockCore, value, null));
  act(() => { tree = TestRenderer.create(<ProfileEditor sections={['Mortgage']} value={value} onChange={onChange} />); });
  try {
    const chips = () => tree.root.findAllByType('Chip');
    expect(chips().filter((n: any) => n.props.selected).map((n: any) => n.props.label)).toEqual(expect.arrayContaining(['TYPE_17', 'REMOVED_TYPE']));
    act(() => chips().find((n: any) => n.props.label === 'REMOVED_TYPE').props.onPress());
    expect(onChange.mock.calls[0][0].rateTypes).toEqual(['TYPE_17']);
    const expand = tree.root.findAllByType('Button').find((n: any) => n.props.title.startsWith('Show All'));
    expect(expand.props.accessibilityState.expanded).toBe(false);
    act(() => expand.props.onPress());
    expect(chips().filter((n: any) => n.props.label.startsWith('TYPE_'))).toHaveLength(18);
  } finally { act(() => tree.unmount()); }
});
test('empty catalogue still exposes hidden saved values, unrecognised features and the scoped clear action', () => {
  mockCore = core([]); const onChange = jest.fn(); let tree: any;
  const value: ProfileFilters = { ...EMPTY_PROFILE, lvrTiers: ['lvr_70-80%'], rateTypes: ['OLD_TYPE'],
    depositKinds: ['BONUS'], accountFeatures: ['OFFSET', 'CARD_ACCESS', 'LEGACY_FEATURE'] };
  act(() => { tree = TestRenderer.create(<ProfileEditor sections={['Mortgage', 'Savings', 'TD']} value={value} onChange={onChange} />); });
  try {
    expect(tree.root.findAllByType('Chip').filter((n: any) => n.props.selected)).toHaveLength(6);
    act(() => tree.root.findAllByType('Chip').find((n: any) => n.props.label === 'LEGACY_FEATURE').props.onPress());
    expect(onChange.mock.calls[0][0].accountFeatures).toEqual(['OFFSET', 'CARD_ACCESS']);
    act(() => tree.root.findAllByType('Button').find((n: any) => n.props.title === 'Clear Home loans requirements').props.onPress());
    expect(onChange.mock.calls[1][0]).toMatchObject({ rateTypes: [], lvrTiers: [], depositKinds: ['BONUS'], accountFeatures: ['CARD_ACCESS', 'LEGACY_FEATURE'] });
  } finally { act(() => tree.unmount()); }
});

test.each([10, 20] as const)('pager %i exposes range, numbered selection and all four navigation actions with disabled boundaries', size => {
  let tree: any, page = 2; const onPage = jest.fn((next: number) => { page = next; }); const onSize = jest.fn();
  const render = (total = 43) => <RatesPagination total={total} page={page} size={size} onPage={onPage} onSize={onSize} />;
  act(() => { tree = TestRenderer.create(render()); });
  try {
    const button = (label: string) => tree.root.findAllByType('Button').find((n: any) => n.props.accessibilityLabel === label);
    expect(button('Page 2').props.accessibilityState.selected).toBe(true);
    act(() => button('Last page').props.onPress()); act(() => tree.update(render()));
    expect(page).toBe(Math.ceil(43 / size)); expect(button('Last page').props.disabled).toBe(true);
    expect(tree.root.findAllByType('AppText').some((n: any) => n.props.children === `${size === 10 ? 41 : 41}–43 / 43 rates`)).toBe(true);
    act(() => button('Previous page').props.onPress()); expect(page).toBe(Math.ceil(43 / size) - 1);
    act(() => tree.update(render())); act(() => button('First page').props.onPress()); act(() => tree.update(render()));
    expect(page).toBe(1); expect(button('First page').props.disabled).toBe(true); expect(button('Previous page').props.disabled).toBe(true);
    act(() => button('Next page').props.onPress()); expect(page).toBe(2);
    act(() => tree.update(render())); act(() => button('Page 1').props.onPress()); expect(page).toBe(1);
    act(() => tree.root.findByType('SegmentedControl').props.onChange('10')); expect(onSize).toHaveBeenCalledWith(10);
    act(() => tree.update(render(0)));
    expect(tree.root.findAllByType('Button').every((n: any) => n.props.disabled)).toBe(true);
    expect(tree.root.findByProps({ testID: 'rates-pagination' }).props.style.width).toBe('100%');
    expect(tree.root.findAllByType('Row').every((n: any) => n.props.style.flexWrap === 'wrap')).toBe(true);
  } finally { act(() => tree.unmount()); }
});

test('shared features are edited once with both affected categories visible', () => {
  mockCore = core([]); let tree: any;
  act(() => { tree = TestRenderer.create(<ProfileEditor sections={['Mortgage', 'Savings', 'TD']}
    value={{ ...EMPTY_PROFILE, accountFeatures: ['DIGITAL_BANKING'] }} onChange={jest.fn()} />); });
  try {
    expect(tree.root.findAllByType('Chip').filter((node: any) => node.props.label === 'Digital banking')).toHaveLength(1);
    expect(tree.root.findAllByType('AppText').some((node: any) => node.props.children === 'Savings accounts / Term deposits')).toBe(true);
  } finally { act(() => tree.unmount()); }
});
