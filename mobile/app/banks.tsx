import Ionicons from '@expo/vector-icons/Ionicons';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { BankAvatar } from '../src/components/BankAvatar';
import { SearchBar, SegmentedControl } from '../src/components/controls';
import { EmptyState, IndeterminateProgressBar, LoadingRows } from '../src/components/feedback';
import { Screen } from '../src/components/Screen';
import { AppText, Button, Row } from '../src/components/ui';
import { SECTION_ORDER, SECTIONS } from '../src/constants';
import { formatRankedFraction } from '../src/data/format';
import { resolveInterestSection, sectionSegmentOptions } from '../src/data/interests';
import { groupByProvider, rankFraction, type MortgageRateMetric, type ProviderGroup, type RankMetric } from '../src/data/selectors';
import { isSuitabilityFilterReady } from '../src/data/suitabilityGate';
import { useStore } from '../src/data/store';
import { openBank } from '../src/lib/nav';
import { useSuitabilityRevision } from '../src/hooks/useSuitabilityRevision';
import { usePerformanceAuditSurface } from '../src/hooks/usePerformanceAuditReadiness';
import { useLogoReadiness } from '../src/hooks/useLogoReadiness';
import { useVirtualizedListReadiness } from '../src/hooks/useVirtualizedListReadiness';
import type { LogoRenderState } from '../src/lib/logoReadiness';
import { auditActionString } from '../src/lib/performanceAuditActionParams';
import { SECTION_KEYS, type SectionKey } from '../src/types';
import { useTheme } from '../src/theme/ThemeProvider';

export default function Banks() {
  const theme = useTheme();
  const core = useStore((s) => s.core);
  const coreSha = useStore((s) => s.manifest?.files.core.sha256 ?? null);
  const depositRankMetric = useStore((s) => s.prefs.depositRankMetric);
  const mortgageRateMetric = useStore((s) => s.prefs.mortgageRateMetric);
  const includeNonStandard = useStore((s) => s.prefs.includeNonStandard);
  const detailsProducts = useStore((s) => s.details?.products ?? null);
  const detailsLoading = useStore((s) => s.detailsLoading);
  const ensureDetails = useStore((s) => s.ensureDetails);
  const suitabilityRevision = useSuitabilityRevision();
  const interests = useStore((s) => s.prefs.interests);
  const section = useStore((s) => s.activeSection);
  const setActiveSection = useStore((s) => s.setActiveSection);
  const sectionOptions = useMemo(() => sectionSegmentOptions(interests), [interests]);
  const [query, setQuery] = useState('');
  const [filterPrepFailed, setFilterPrepFailed] = useState(false);
  const filterPrepAttempts = useRef(0);
  const coreRevision = core ? core.run_date : '';

  useEffect(() => {
    const resolved = resolveInterestSection(interests, section);
    if (resolved !== section) setActiveSection(resolved);
  }, [interests, section, setActiveSection]);

  const filterReady = useMemo(() => {
    void suitabilityRevision;
    return isSuitabilityFilterReady(includeNonStandard);
  }, [includeNonStandard, suitabilityRevision]);

  useEffect(() => {
    filterPrepAttempts.current = 0;
    setFilterPrepFailed(false);
  }, [coreRevision]);

  // Standard-only ranking must wait for the post-ingest suitability index —
  // otherwise an empty/closed allowlist yields an empty lender list or a
  // core-only fallback that can disagree with Browse/Home. Bound retries so a
  // failed ensureDetails cannot loop forever on detailsLoading flips.
  useEffect(() => {
    if (filterReady) {
      filterPrepAttempts.current = 0;
      setFilterPrepFailed(false);
      return;
    }
    if (includeNonStandard || detailsLoading || !core) return;
    if (filterPrepAttempts.current >= 3) return;
    filterPrepAttempts.current += 1;
    void ensureDetails({ force: true });
  }, [filterReady, includeNonStandard, detailsLoading, core, ensureDetails, suitabilityRevision]);

  // Escape permanent "Preparing" when details settle still-closed (or hang).
  useEffect(() => {
    if (filterReady || includeNonStandard || !coreRevision) {
      setFilterPrepFailed(false);
      return;
    }
    if (detailsLoading) {
      setFilterPrepFailed(false);
      const hung = setTimeout(() => {
        if (!isSuitabilityFilterReady(includeNonStandard)) setFilterPrepFailed(true);
      }, 12_000);
      return () => clearTimeout(hung);
    }
    const timer = setTimeout(() => {
      if (!isSuitabilityFilterReady(includeNonStandard)) setFilterPrepFailed(true);
    }, 400);
    return () => clearTimeout(timer);
  }, [filterReady, includeNonStandard, coreRevision, detailsLoading, suitabilityRevision]);

  const retryFilterPrep = useCallback(() => {
    setFilterPrepFailed(false);
    filterPrepAttempts.current = 0;
    void ensureDetails({ force: true, abandonInFlight: true });
  }, [ensureDetails]);

  const groups = useMemo(
    () => {
      void suitabilityRevision;
      if (!core || !filterReady) return [];
      return groupByProvider(
        core.sections,
        depositRankMetric,
        includeNonStandard,
        detailsProducts,
        section,
        mortgageRateMetric,
      );
    },
    [
      core,
      depositRankMetric,
      mortgageRateMetric,
      includeNonStandard,
      detailsProducts,
      suitabilityRevision,
      section,
      filterReady,
    ],
  );
  const filtered = useMemo(
    () => groups.filter((g) => g.provider.toLowerCase().includes(query.toLowerCase())),
    [groups, query],
  );
  const auditActions = useMemo(() => ({
    'lenders.open': () => undefined,
    'lenders.section.next': (...args: unknown[]) => {
      const requested = auditActionString(args, 'section');
      if (requested && SECTION_KEYS.includes(requested as SectionKey) &&
        sectionOptions.some((option) => option.value === requested)) {
        setActiveSection(requested as SectionKey);
        return;
      }
      const index = sectionOptions.findIndex((option) => option.value === section);
      const next = sectionOptions[(Math.max(0, index) + 1) % sectionOptions.length]?.value;
      if (next) setActiveSection(next);
    },
    'lenders.query.provider': (...args: unknown[]) => {
      const provider = auditActionString(args, 'query');
      if (provider) setQuery(provider);
    },
    'lenders.query.clear': () => setQuery(''),
    'lenders.provider.open': (...args: unknown[]) => {
      const provider = auditActionString(args, 'provider');
      if (provider && groups.some((group) => group.provider === provider)) openBank(provider);
    },
  }), [groups, section, sectionOptions, setActiveSection]);
  const listRevision = JSON.stringify([
    coreSha ?? core?.run_date ?? 'none',
    section,
    query,
    depositRankMetric,
    mortgageRateMetric,
    includeNonStandard,
    detailsProducts != null,
    suitabilityRevision,
    filterReady,
    filtered.map((group) => group.provider),
  ]);
  const listReadiness = useVirtualizedListReadiness(listRevision, filtered.length);
  const logoReadiness = useLogoReadiness(listRevision);
  usePerformanceAuditSurface({
    id: 'lenders.list',
    routeKey: '/banks',
    datasetRevision: coreSha ?? core?.run_date ?? null,
    renderRevision: listRevision,
    actions: auditActions,
    probes: [
      {
        id: 'lenders.data',
        kind: 'data',
        status: core && filterReady ? 'ready' : 'pending',
        datasetRevision: coreSha ?? core?.run_date ?? null,
      },
      {
        id: 'lenders.list',
        kind: 'list',
        status: filterReady && listReadiness.visiblyCommitted ? 'ready' : 'pending',
        expectedCount: filtered.length,
        actualCount: listReadiness.committedItemCount,
      },
      {
        id: 'lenders.layout',
        kind: 'layout',
        status: listReadiness.ready ? 'ready' : 'pending',
        renderRevision: listRevision,
      },
      {
        id: 'lenders.logos',
        kind: 'logo',
        status: filterReady && logoReadiness.ready ? 'ready' : 'pending',
        expectedCount: logoReadiness.expectedCount,
        actualCount: logoReadiness.terminalCount,
      },
    ],
  });

  if (!core) return null;

  const direction = SECTIONS[section].lowerIsBetter ? 'lowest' : 'highest';
  const metricNote =
    section === 'Mortgage'
      ? mortgageRateMetric === 'comparison'
        ? ', comparison'
        : ', headline'
      : depositRankMetric === 'base'
        ? ', base ongoing'
        : ', headline';
  const scopeNote = includeNonStandard ? '' : ', broadly applicable only';
  const sortHint = `Best ${SECTIONS[section].short.toLowerCase()} rate first (${direction}${metricNote}${scopeNote})`;

  return (
    <Screen>
      <View style={{ padding: 16, gap: theme.spacing(3) }}>
        {sectionOptions.length > 1 ? (
          <SegmentedControl options={sectionOptions} value={section} onChange={setActiveSection} />
        ) : null}
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search lenders" />
        <AppText variant="tiny" color="textMuted">
          {filterReady
            ? sortHint
            : filterPrepFailed
              ? 'Could not prepare filtered lender rates.'
              : 'Preparing filtered lender rates…'}
        </AppText>
      </View>
      {!filterReady ? (
        <View style={{ paddingHorizontal: 16, gap: theme.spacing(3) }}>
          {filterPrepFailed ? (
            <>
              <AppText variant="small" color="textMuted">
                Broadly applicable ranking needs the suitability index. Check your connection and retry.
              </AppText>
              <Button title="Retry" variant="secondary" onPress={retryFilterPrep} />
            </>
          ) : (
            <>
              <IndeterminateProgressBar
                caption="Waiting until broadly applicable products are ready for ranking."
                accessibilityLabel="Preparing filtered lender rates"
              />
              <LoadingRows count={4} />
            </>
          )}
        </View>
      ) : (
        <View style={{ flex: 1 }} onLayout={listReadiness.onRevisionLayout}>
          <FlashList
            // Remount when the search filter changes so FlashList re-emits load /
            // viewability after an in-place data shrink (audit readiness hangs otherwise).
            key={`lenders:${section}:${query}`}
            data={filtered}
            onCommitLayoutEffect={listReadiness.onCommitLayoutEffect}
            onLoad={listReadiness.onLoad}
            onContentSizeChange={listReadiness.onContentSizeChange}
            onViewableItemsChanged={listReadiness.onViewableItemsChanged}
            viewabilityConfig={{ itemVisiblePercentThreshold: 1, minimumViewTime: 16 }}
            extraData={`${section}:${query}:${depositRankMetric}:${mortgageRateMetric}:${includeNonStandard ? 1 : 0}:${suitabilityRevision}`}
            keyExtractor={(g) => g.provider}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
            renderItem={({ item }) => (
              <BankRow
                group={item}
                logoRenderStateId={`lenders:${item.provider}`}
                onLogoRenderStateChange={logoReadiness.onLogoRenderStateChange}
                sortSection={section}
                depositRankMetric={depositRankMetric}
                mortgageRateMetric={mortgageRateMetric}
              />
            )}
            ListEmptyComponent={<EmptyState title="No lenders found" />}
          />
        </View>
      )}
    </Screen>
  );
}

function BankRow({
  group,
  sortSection,
  depositRankMetric,
  mortgageRateMetric,
  logoRenderStateId,
  onLogoRenderStateChange,
}: {
  group: ProviderGroup;
  sortSection: SectionKey;
  depositRankMetric: RankMetric;
  mortgageRateMetric: MortgageRateMetric;
  logoRenderStateId: string;
  onLogoRenderStateChange: (id: string, state: LogoRenderState) => void;
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
      <BankAvatar
        provider={group.provider}
        renderStateId={logoRenderStateId}
        onRenderStateChange={onLogoRenderStateChange}
      />
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
            const shown = rankFraction(best, s, depositRankMetric, mortgageRateMetric);
            if (shown === null) return null;
            return (
              <AppText key={s} variant="tiny" color={isSortKey ? 'text' : 'textMuted'} weight={isSortKey ? '700' : '400'}>
                {SECTIONS[s].title}: <AppText variant="tiny" weight="700">{formatRankedFraction(shown)}</AppText>
              </AppText>
            );
          })}
        </Row>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.textFaint} />
    </Pressable>
  );
}
