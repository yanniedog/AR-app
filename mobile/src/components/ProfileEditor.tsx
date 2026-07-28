import React, { useMemo } from 'react';
import { View } from 'react-native';

import { SECTIONS } from '../constants';
import { humanizeEnum } from '../data/format';
import {
  PROFILE_FEATURE_OPTIONS,
  PROFILE_GROUPS,
  type ProfileFilters,
} from '../data/profile';
import { distinctValues } from '../data/selectors';
import { useStore } from '../data/store';
import type { SectionKey } from '../types';
import { useTheme } from '../theme/ThemeProvider';
import { AppText, Chip, Row } from './ui';

type EditorGroup = {
  section: SectionKey;
  title: string;
  key: keyof ProfileFilters;
  options: string[];
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

  const groups = useMemo(() => {
    const attrGroups: EditorGroup[] = PROFILE_GROUPS.filter((g) => sections.includes(g.section))
      .map((g) => ({
        section: g.section,
        title: g.title,
        key: g.key,
        options: distinctValues(core?.sections?.[g.section]?.rates ?? [], g.field).slice(0, 12),
      }))
      .filter((g) => g.options.length > 0);

    const featureGroups: EditorGroup[] = sections
      .filter((section) => (PROFILE_FEATURE_OPTIONS[section] ?? []).length > 0)
      .map((section) => ({
        section,
        title: 'Account features',
        key: 'accountFeatures' as const,
        options: PROFILE_FEATURE_OPTIONS[section],
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

  let prevSection: SectionKey | null = null;
  return (
    <View style={{ gap: 18 }}>
      {groups.map((g) => {
        const showHeader = sections.length > 1 && g.section !== prevSection;
        prevSection = g.section;
        return (
          <View key={`${g.section}-${String(g.key)}`}>
            {showHeader ? (
              <AppText
                variant="tiny"
                weight="700"
                color="textFaint"
                style={{ marginBottom: 8, letterSpacing: 0.6 }}
              >
                {SECTIONS[g.section].title.toUpperCase()}
              </AppText>
            ) : null}
            <AppText variant="small" weight="700" style={{ marginBottom: theme.spacing(2) }}>
              {g.title}
            </AppText>
            {g.key === 'accountFeatures' ? (
              <AppText variant="tiny" color="textFaint" style={{ marginBottom: theme.spacing(2) }}>
                Narrow the next search to products that include these — leave empty for any.
              </AppText>
            ) : null}
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              {g.options.map((o) => (
                <Chip
                  key={o}
                  label={humanizeEnum(o)}
                  selected={value[g.key].includes(o)}
                  onPress={() => toggle(g.key, o)}
                />
              ))}
            </Row>
          </View>
        );
      })}
    </View>
  );
}
