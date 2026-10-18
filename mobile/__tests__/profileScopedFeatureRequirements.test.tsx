import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { ProfileEditor } from '../src/components/ProfileEditor';
import { EMPTY_PROFILE, PROFILE_FEATURE_OPTIONS } from '../src/data/profile';
import { clearHomeLoanRequirements } from '../src/data/profileRequirements';
import type { SectionKey } from '../src/types';

jest.mock('../src/data/store', () => ({ useStore: (selector: (state: unknown) => unknown) => selector({ core: null }) }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ spacing: (n: number) => n * 4 }) }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Chip: 'Chip', Row: 'Row', Button: 'Button' }));

it('preserves a feature shared with another category while resetting Home-loan requirements', () => {
  const mortgage = PROFILE_FEATURE_OPTIONS.Mortgage;
  PROFILE_FEATURE_OPTIONS.Mortgage = [...mortgage, 'DIGITAL_BANKING'];
  try {
    const profile = { ...EMPTY_PROFILE, loanPurposes: ['OWNER_OCCUPIED'], accountFeatures: ['OFFSET', 'DIGITAL_BANKING', 'LEGACY_FEATURE'] };
    expect(clearHomeLoanRequirements(profile)).toMatchObject({ loanPurposes: [], accountFeatures: ['DIGITAL_BANKING', 'LEGACY_FEATURE'] });
    expect(profile.accountFeatures).toEqual(['OFFSET', 'DIGITAL_BANKING', 'LEGACY_FEATURE']);
  } finally { PROFILE_FEATURE_OPTIONS.Mortgage = mortgage; }
});

it.each(['Mortgage', 'Savings', 'TD'] as SectionKey[])('keeps unknown saved features visible and removable in the %s editor', section => {
  const value = { ...EMPTY_PROFILE, accountFeatures: ['DIGITAL_BANKING', 'LEGACY_FEATURE'] };
  const change = jest.fn(); let tree: any;
  act(() => { tree = TestRenderer.create(<ProfileEditor sections={[section]} value={value} onChange={change} />); });
  try {
    const legacy = tree.root.findAllByType('Chip').find((node: any) => node.props.label === 'LEGACY_FEATURE');
    expect(legacy.props.selected).toBe(true);
    act(() => legacy.props.onPress());
    expect(change).toHaveBeenCalledWith({ ...value, accountFeatures: ['DIGITAL_BANKING'] });
  } finally { act(() => tree.unmount()); }
});
