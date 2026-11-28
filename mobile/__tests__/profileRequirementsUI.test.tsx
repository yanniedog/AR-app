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

jest.mock('../src/components/selectors', () => ({ OptionSelect: 'OptionSelect', OptionStrip: 'OptionStrip' }));
/** Every selectable option rendered by the editor, as simple label/selected/press records. */
function chips(root: any): any[] {
  const fromList = (type: string) => root.findAllByType(type).flatMap((n: any) => n.props.options.map((o: any) => ({ props: {
    label: o.label, selected: Array.isArray(n.props.value) ? n.props.value.includes(o.value) : n.props.value === o.value,
    onPress: () => n.props.onChange(o.value) } })));
  return [...fromList('OptionSelect'), ...fromList('OptionStrip'), ...root.findAllByType('CompactToggle').map((n: any) => ({ props: {
    label: n.props.label, selected: n.props.value, onPress: () => n.props.onChange(!n.props.value) } }))];
}
jest.mock('../src/components/controls', () => ({ SegmentedControl: 'SegmentedControl', CompactToggle: 'CompactToggle' }));

function core(types: string[]) { return { sections: { Mortgage: { rates: types.map((rate_type, index) => ({
  rate_type, product_key: String(index), product_name: String(index), provider: 'A', rate: '0.05',
})) }, Savings: { rates: [] }, TD: { rates: [] } } }; }
afterEach(() => installMandatoryEligibility(selectMandatoryEligibility(null, EMPTY_PROFILE, null)));

test('selection edits reuse catalogue metadata and a replaced edition refreshes options', () => {
  mockCore = core(['VARIABLE']);
  const readType = jest.fn(() => 'VARIABLE');
  Object.defineProperty(mockCore.sections.Mortgage.rates[0], 'rate_type', { get: readType });
  const sections = ['Mortgage'] as const;
  const onChange = jest.fn(); let tree: any;
  const render = (value: ProfileFilters) => <ProfileEditor sections={[...sections]} value={value} onChange={onChange} />;
  // The screen supplies the stable SECTION_ORDER array.
  const stableSections: 'Mortgage'[] = ['Mortgage'];
  act(() => { tree = TestRenderer.create(<ProfileEditor sections={stableSections} value={EMPTY_PROFILE} onChange={onChange} />); });
  try {
    const initialReads = readType.mock.calls.length;
    expect(initialReads).toBeGreaterThan(0);
    act(() => tree.update(<ProfileEditor sections={stableSections} value={{ ...EMPTY_PROFILE, rateTypes: ['OLD_TYPE'] }} onChange={onChange} />));
    expect(readType).toHaveBeenCalledTimes(initialReads);
    expect(chips(tree.root).some((n: any) => n.props.label === 'OLD_TYPE' && n.props.selected)).toBe(true);
    mockCore = core(['FIXED']);
    act(() => tree.update(render(EMPTY_PROFILE)));
    const labels = chips(tree.root).map((n: any) => n.props.label);
    expect(labels).toContain('Fixed');
    expect(labels).not.toContain('Variable');
  } finally { act(() => tree.unmount()); }
});

test('all selected values remain visible beyond the old twelve-option limit and every available value is reachable', () => {
  mockCore = core(Array.from({ length: 18 }, (_, i) => `TYPE_${i}`));
  const onChange = jest.fn(); let tree: any;
  const value = { ...EMPTY_PROFILE, rateTypes: ['TYPE_17', 'REMOVED_TYPE'] };
  installMandatoryEligibility(selectMandatoryEligibility(mockCore, value, null));
  act(() => { tree = TestRenderer.create(<ProfileEditor sections={['Mortgage']} value={value} onChange={onChange} />); });
  try {
    expect(chips(tree.root).filter((n: any) => n.props.selected).map((n: any) => n.props.label)).toEqual(expect.arrayContaining(['TYPE_17', 'REMOVED_TYPE']));
    act(() => chips(tree.root).find((n: any) => n.props.label === 'REMOVED_TYPE').props.onPress());
    expect(onChange.mock.calls[0][0].rateTypes).toEqual(['TYPE_17']);
    // Every option sits in one collapsed list, with no partial reveal.
    expect(chips(tree.root).filter((n: any) => n.props.label.startsWith('TYPE_'))).toHaveLength(18);
  } finally { act(() => tree.unmount()); }
});
test('empty catalogue still exposes hidden saved values, unrecognised features and the scoped clear action', () => {
  mockCore = core([]); const onChange = jest.fn(); let tree: any;
  const value: ProfileFilters = { ...EMPTY_PROFILE, rateTypes: ['OLD_TYPE'],
    depositKinds: ['BONUS'], accountFeatures: ['OFFSET', 'CARD_ACCESS', 'LEGACY_FEATURE'] };
  act(() => { tree = TestRenderer.create(<ProfileEditor sections={['Mortgage', 'Savings', 'TD']} value={value} onChange={onChange} />); });
  try {
    expect(chips(tree.root).filter((n: any) => n.props.selected)).toHaveLength(5);
    act(() => chips(tree.root).find((n: any) => n.props.label === 'LEGACY_FEATURE').props.onPress());
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
    act(() => tree.root.findByType('SegmentedControl').props.onChange('20')); expect(onSize).toHaveBeenLastCalledWith(20);
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
    expect(chips(tree.root).filter((node: any) => node.props.label === 'Digital banking')).toHaveLength(1);
    expect(tree.root.findAllByType('AppText').some((node: any) => String(node.props.children).includes('Savings accounts / Term deposits'))).toBe(true);
  } finally { act(() => tree.unmount()); }
});

test('ProfileEditor offers no LVR band options', () => {
  mockCore = {
    sections: {
      Mortgage: {
        rates: ['lvr_<=30%', 'lvr_60-69.9999%', 'lvr_70-80%', 'lvr_85-90%', 'lvr_>=80.01-95%']
          .map((lvr_tier, index) => ({ lvr_tier, product_key: String(index), product_name: String(index), provider: 'A', rate: '0.05' })),
      },
      Savings: { rates: [] },
      TD: { rates: [] },
    },
  };
  let tree: any;
  act(() => { tree = TestRenderer.create(<ProfileEditor sections={['Mortgage']} value={EMPTY_PROFILE} onChange={jest.fn()} />); });
  try {
    const labels = chips(tree.root).map((node: any) => String(node.props.label));
    expect(labels.filter(label => /^(<60|60-70|70-80|80-90|>90)$/.test(label) || label.includes('lvr_'))).toEqual([]);
  } finally { act(() => tree.unmount()); }
});

test('single-choice groups use radio rows; saved extras show as ticks until removed and Features stay ticks', () => {
  mockCore = core(['FIXED', 'VARIABLE']);
  const onChange = jest.fn(); let tree: any;
  const field = (label: string) => tree.root.findAllByType('OptionSelect').find((n: any) => n.props.label === label);
  act(() => { tree = TestRenderer.create(<ProfileEditor sections={['Mortgage']} value={{ ...EMPTY_PROFILE, rateTypes: ['FIXED'] }} onChange={onChange} />); });
  try {
    expect(field('Rate type').props.multiple).toBe(false);
    act(() => tree.update(<ProfileEditor sections={['Mortgage']} value={{ ...EMPTY_PROFILE, rateTypes: ['FIXED', 'VARIABLE'] }} onChange={onChange} />));
    expect(field('Rate type').props.multiple).toBe(true);
    act(() => field('Rate type').props.onChange('VARIABLE'));
    expect(onChange.mock.calls[0][0].rateTypes).toEqual(['FIXED']);
    const features = field('Features');
    if (features) expect(features.props.multiple).toBe(true);
  } finally { act(() => tree.unmount()); }
});
