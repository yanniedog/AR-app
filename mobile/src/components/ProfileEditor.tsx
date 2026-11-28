import React, { useMemo } from 'react';
import { View } from 'react-native';

import { humanizeEnum } from '../data/format';
import {
  PROFILE_FEATURE_OPTIONS,
  PROFILE_GROUPS,
  type ProfileFilters,
} from '../data/profile';
import { clearHomeLoanRequirements, otherProfileFeatures, profileAttributeOptions, sharedProfileFeatures } from '../data/profileRequirements';
import { profileSectionCount } from '../data/profile';
import { useStore } from '../data/store';
import type { SectionKey } from '../types';
import { AppText, Button } from './ui';
import { CompactToggle } from './controls';
import { OptionSelect, OptionStrip } from './selectors';
import { uiCount, uiJoin, uiLabel, uiSectionName, type UiLabel } from '../lib/uiCopy';

type EditorGroup = {
  section: SectionKey;
  title: string;
  key: keyof ProfileFilters;
  options: string[];
};
const GROUP_LABELS: Readonly<Record<keyof ProfileFilters, UiLabel>> = {
  loanPurposes: 'Loan purpose', rateTypes: 'Rate type', repaymentTypes: 'Repayment', lvrTiers: 'LVR',
  depositKinds: 'Account type', interestPayments: 'Interest paid', accountFeatures: 'Features',
};

/** Chip groups for the saved product profile — shared by onboarding and the Profile screen. */
export function ProfileEditor({
  sections,
  value,
  onChange,
}: {
  sections: SectionKey[];
  value: ProfileFilters;
  onChange: (next: ProfileFilters) => void;
}) {
  const core = useStore((s) => s.core);

  const groups = useMemo(() => {
    const attrGroups: EditorGroup[] = PROFILE_GROUPS.filter((g) => sections.includes(g.section))
      .map((g) => ({
        section: g.section,
        title: g.title,
        key: g.key,
        options: profileAttributeOptions(core?.sections[g.section].rates ?? [], g.field, []),
      }));

    const featureGroups: EditorGroup[] = sections
      .filter((section) => (PROFILE_FEATURE_OPTIONS[section] ?? []).length > 0)
      .map((section) => ({
        section,
        title: 'Account features',
        key: 'accountFeatures' as const,
        options: PROFILE_FEATURE_OPTIONS[section].filter(feature => !sharedProfileFeatures(sections).some(item => item.feature === feature)),
      }));

    // Keep section blocks contiguous: attributes for a section, then its features.
    const out: EditorGroup[] = [];
    for (const section of sections) {
      out.push(...attrGroups.filter((g) => g.section === section));
      out.push(...featureGroups.filter((g) => g.section === section));
    }
    return out;
  }, [core, sections]);

  const toggle = (key: keyof ProfileFilters, option: string) => {
    const list = value[key];
    onChange({
      ...value,
      [key]: list.includes(option) ? list.filter((v) => v !== option) : [...list, option],
    });
  };

  const otherFeatures = otherProfileFeatures(value);
  return (
    <View style={{ gap: 18 }}>
      {sections.map(section => <View key={section} style={{ gap: 12 }}>
        <AppText variant="small" weight="700">{uiJoin(section === 'Mortgage' ? 'Home loans' : section === 'Savings' ? 'Savings' : 'Term deposits',
          ' · ', 'Saved requirements', ' ', uiCount(profileSectionCount(value, section)))}</AppText>
        {section === 'Mortgage' && profileSectionCount(value, section) > 0 ? <Button
          title="Clear Home loans requirements" variant="ghost"
          onPress={() => onChange(clearHomeLoanRequirements(value))} /> : null}
        <View>
          {groups.filter(group => group.section === section).map((g, index, sectionGroups) => {
            // Saved values remain removable even if absent from this catalogue.
            const options = g.key === 'accountFeatures' ? g.options : [...new Set([...value[g.key], ...g.options])];
            if (!options.length) return null;
            const items = options.map(o => ({ value: o, label: humanizeEnum(o) }));
            return <OptionSelect
              key={`${g.section}-${g.key}`}
              auditId={`profile:${g.section}:${g.key}`}
              label={GROUP_LABELS[g.key]}
              options={items}
              value={value[g.key].filter(item => options.includes(item))}
              multiple
              onChange={option => toggle(g.key, option)}
              onClear={() => onChange({ ...value, [g.key]: value[g.key].filter(item => !options.includes(item)) })}
              last={index === sectionGroups.length - 1}
            />;
          })}
        </View>
      </View>)}
      {sharedProfileFeatures(sections).map(item => <View key={item.feature} style={{ gap: 8 }}>
        <AppText variant="small" weight="700">{uiJoin('Shared requirements', ' · ', ...item.sections.flatMap((section, index) => index ? [uiLabel(' / '), uiSectionName(section)] : [uiSectionName(section)]))}</AppText>
        <CompactToggle label={humanizeEnum(item.feature)} value={value.accountFeatures.includes(item.feature)} onChange={() => toggle('accountFeatures', item.feature)} />
      </View>)}
      {otherFeatures.length ? <View style={{ gap: 8 }}>
        <AppText variant="small" weight="700">{uiLabel('Other saved selections')}</AppText>
        <OptionStrip multiple options={otherFeatures.map(option => ({ value: option, label: humanizeEnum(option) }))}
          value={otherFeatures} onChange={option => toggle('accountFeatures', option)} />
      </View> : null}
    </View>
  );
}
