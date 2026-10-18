import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { humanizeEnum } from '../data/format';
import {
  PROFILE_FEATURE_OPTIONS,
  PROFILE_GROUPS,
  type ProfileFilters,
} from '../data/profile';
import { clearHomeLoanRequirements, otherProfileFeatures, profileAttributeOptions, sharedProfileFeatures } from '../data/profileRequirements';
import { profileSectionCount } from '../data/profile';
import { visibleFilterOptions } from '../lib/filterOptions';
import { useStore } from '../data/store';
import type { SectionKey } from '../types';
import { useTheme } from '../theme/ThemeProvider';
import { AppText, Button, Chip, Row } from './ui';
import { uiListedLvr } from '../lib/financialUiCopy';
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
  const theme = useTheme();
  const core = useStore((s) => s.core);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());

  const groups = useMemo(() => {
    const attrGroups: EditorGroup[] = PROFILE_GROUPS.filter((g) => sections.includes(g.section))
      .map((g) => ({
        section: g.section,
        title: g.title,
        key: g.key,
        options: profileAttributeOptions(core?.sections[g.section].rates ?? [], g.field, value[g.key]),
      }))
      .filter((g) => g.options.length > 0);

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
  }, [core, sections, value]);

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
        {groups.filter(group => group.section === section).map(g => {
          const groupKey = `${g.section}-${g.key}`;
          const { visible, hidden } = visibleFilterOptions(g.options, value[g.key], expanded.has(groupKey), 12);
          return <View key={groupKey}>
            <AppText variant="small" weight="700" style={{ marginBottom: theme.spacing(2) }}>
              {GROUP_LABELS[g.key]}
            </AppText>
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              {visible.map((o) => (
                <Chip
                  key={o}
                  label={g.key === 'lvrTiers' ? uiListedLvr({ lvr_tier: o }) : humanizeEnum(o)}
                  selected={value[g.key].includes(o)}
                  onPress={() => toggle(g.key, o)}
                />
              ))}
            </Row>
            {hidden > 0 ? <Button title={uiJoin('Show', ' ', 'All', ' ', uiCount(g.options.length), ' ', GROUP_LABELS[g.key])}
              variant="ghost" accessibilityState={{ expanded: false }}
              onPress={() => setExpanded(current => new Set(current).add(groupKey))} /> : null}
          </View>;
        })}
      </View>)}
      {sharedProfileFeatures(sections).map(item => <View key={item.feature} style={{ gap: 8 }}>
        <AppText variant="small" weight="700">{uiLabel('Shared requirements')}</AppText>
        <AppText variant="tiny" color="textMuted">{uiJoin(...item.sections.flatMap((section, index) => index ? [uiLabel(' / '), uiSectionName(section)] : [uiSectionName(section)]))}</AppText>
        <Chip label={humanizeEnum(item.feature)} selected={value.accountFeatures.includes(item.feature)} onPress={() => toggle('accountFeatures', item.feature)} />
      </View>)}
      {otherFeatures.length ? <View style={{ gap: 8 }}>
        <AppText variant="small" weight="700">{uiLabel('Other saved selections')}</AppText>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>{otherFeatures.map(option => <Chip key={option}
          label={humanizeEnum(option)} selected onPress={() => toggle('accountFeatures', option)} />)}</Row>
      </View> : null}
    </View>
  );
}
