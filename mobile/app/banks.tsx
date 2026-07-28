import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { BankAvatar } from '../src/components/BankAvatar';
import { SearchBar, SegmentedControl } from '../src/components/controls';
import { EmptyState } from '../src/components/feedback';
import { Screen } from '../src/components/Screen';
import { AppText, Row } from '../src/components/ui';
import { SECTION_ORDER, SECTIONS } from '../src/constants';
import { formatRate } from '../src/data/format';
import { resolveInterestSection, sectionSegmentOptions } from '../src/data/interests';
import { groupByProvider, rankFraction, type ProviderGroup, type RankMetric } from '../src/data/selectors';
import { useStore } from '../src/data/store';
import { openBank } from '../src/lib/nav';
import { useSuitabilityRevision } from '../src/hooks/useSuitabilityRevision';
import type { SectionKey } from '../src/types';
import { useTheme } from '../src/theme/ThemeProvider';

export default function Banks() {
  const theme = useTheme();
  const core = useStore((s) => s.core);
  const depositRankMetric = useStore((s) => s.prefs.depositRankMetric);
  const includeNonStandard = useStore((s) => s.prefs.includeNonStandard);
  const detailsProducts = useStore((s) => s.details?.products ?? null);
  const suitabilityRevision = useSuitabilityRevision();
  const interests = useStore((s) => s.prefs.interests);
  const section = useStore((s) => s.activeSection);
  const setActiveSection = useStore((s) => s.setActiveSection);
  const sectionOptions = useMemo(() => sectionSegmentOptions(interests), [interests]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const resolved = resolveInterestSection(interests, section);
    if (resolved !== section) setActiveSection(resolved);
  }, [interests, section, setActiveSection]);

  const groups = useMemo(
    () => {
      void suitabilityRevision;
      return core
        ? groupByProvider(core.sections, depositRankMetric, includeNonStandard, detailsProducts, section)
        : [];
    },
    [core, depositRankMetric, includeNonStandard, detailsProducts, suitabilityRevision, section],
  );
  const filtered = useMemo(
    () => groups.filter((g) => g.provider.toLowerCase().includes(query.toLowerCase())),
    [groups, query],
  );

  if (!core) return null;

  const direction = SECTIONS[section].lowerIsBetter ? 'lowest' : 'highest';
  const metricNote =
    section !== 'Mortgage' && depositRankMetric === 'base' ? ', base ongoing' : '';
  const sortHint = `Best ${SECTIONS[section].short.toLowerCase()} rate first (${direction}${metricNote})`;

  return (
    <Screen>
      <View style={{ padding: 16, gap: theme.spacing(3) }}>
        {sectionOptions.length > 1 ? (
          <SegmentedControl options={sectionOptions} value={section} onChange={setActiveSection} />
        ) : null}
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search lenders" />
        <AppText variant="tiny" color="textMuted">
          {sortHint}
        </AppText>
      </View>
      <FlashList
        data={filtered}
        extraData={`${section}:${depositRankMetric}`}
        keyExtractor={(g) => g.provider}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        renderItem={({ item }) => (
          <BankRow group={item} sortSection={section} depositRankMetric={depositRankMetric} />
        )}
        ListEmptyComponent={<EmptyState title="No lenders found" />}
      />
    </Screen>
  );
}

function BankRow({
  group,
  sortSection,
  depositRankMetric,
}: {
  group: ProviderGroup;
  sortSection: SectionKey;
  depositRankMetric: RankMetric;
}) {
  const theme = useTheme();
  const sections = SECTION_ORDER.filter((s) => group.bestBySection[s]);
  const longPressed = useRef(false);
  const open = useCallback(() => openBank(group.provider), [group.provider]);
  const onLongPress = useCallback(() => {
    longPressed.current = true;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    open();
  }, [open]);
  const onPress = useCallback(() => {
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    open();
  }, [open]);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressOut={() => {
        longPressed.current = false;
      }}
      accessibilityHint="Long press for haptic confirmation before opening lender profile"
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        backgroundColor: theme.colors.card,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        marginBottom: 10,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <BankAvatar provider={group.provider} />
      <View style={{ flex: 1 }}>
        <AppText variant="body" weight="700" numberOfLines={1}>
          {group.provider}
        </AppText>
        <Row gap={8} style={{ marginTop: 4, flexWrap: 'wrap' }}>
          {sections.map((s) => {
            const best = group.bestBySection[s];
            if (!best) return null;
            const isSortKey = s === sortSection;
            // Match the ranked value used to order lenders (base ongoing for
            // deposits by default) — not the headline/effective rate alone.
            const shown = rankFraction(best, s, depositRankMetric);
            if (shown === null) return null;
            return (
              <AppText key={s} variant="tiny" color={isSortKey ? 'text' : 'textMuted'} weight={isSortKey ? '700' : '400'}>
                {SECTIONS[s].title}: <AppText variant="tiny" weight="700">{formatRate(shown)}</AppText>
              </AppText>
            );
          })}
        </Row>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.textFaint} />
    </Pressable>
  );
}
