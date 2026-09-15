import { router, useLocalSearchParams, type Href } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { BankAvatar } from '../src/components/BankAvatar';
import { EmptyState, ScreenSkeleton } from '../src/components/feedback';
import { ComparisonDisclosures, PersonalCostComparisonDisclosure, publishedItemCount } from '../src/components/product/ComparisonDisclosures';
import { ProductRateChangeLine } from '../src/components/product/ProductRateChangeLine';
import { Screen } from '../src/components/Screen';
import { AppText, Badge, Button, Card, Divider, Row } from '../src/components/ui';
import { SECTIONS } from '../src/constants';
import {
  formatBalanceRange,
  formatRate,
  formatTerm,
  humanizeEnum,
} from '../src/data/format';
import { rankFraction, rankedRateLabelForRow } from '../src/data/selectors';
import {
  validateCompareSelections,
  type CompareSelectionIssue,
} from '../src/data/compareSelection';
import { useStore } from '../src/data/store';
import { usePerformanceAuditSurface } from '../src/hooks/usePerformanceAuditReadiness';
import { useLogoReadiness } from '../src/hooks/useLogoReadiness';
import {
  isRateDetailLabel,
  isRateLabelRankedForEveryEntry,
  showCompactDetailRow,
  usesCompactCompareLayout,
} from '../src/lib/comparePresentation';
import type { ProductDetail, RateRow, SectionKey } from '../src/types';
import { useTheme } from '../src/theme/ThemeProvider';

const LABEL_W = 108;
const COL_W = 136;
const HEADER_H = 88;
const ROW_H = 44;
// Fit the 32px rate line, padded Best badge and 4px gap with breathing room.
const RATE_ROW_H = 72;
const CHANGE_ROW_H = 64;

interface Entry {
  row: RateRow;
  section: SectionKey;
}

interface AttrRow {
  label: string;
  get: (e: Entry) => string;
  /** When true, values use tabular numerals (rates). */
  tabular?: boolean;
}

function comparisonIssueCopy(issue: CompareSelectionIssue): { title: string; subtitle: string } {
  if (issue === 'limit_reached') {
    return { title: 'Too many products', subtitle: 'Choose no more than four products.' };
  }
  if (issue === 'category_mismatch') {
    return {
      title: 'Choose one rate category',
      subtitle: 'Compare home loans, savings accounts, or term deposits separately.',
    };
  }
  if (issue === 'unavailable') {
    return { title: 'A rate is unavailable', subtitle: 'Return and choose current products again.' };
  }
  return { title: 'Nothing to compare', subtitle: 'Select at least two products.' };
}

function valuesDiffer(row: AttrRow, entries: Entry[]): boolean {
  return new Set(entries.map((entry) => row.get(entry).trim().toLocaleLowerCase())).size > 1;
}

export default function Compare() {
  const theme = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const compact = usesCompactCompareLayout(width, fontScale);
  const { keys } = useLocalSearchParams<{ keys: string }>();
  const core = useStore((s) => s.core);
  const details = useStore((s) => s.details);
  const ensureDetails = useStore((s) => s.ensureDetails);
  const depositRankMetric = useStore((s) => s.prefs.depositRankMetric);
  const mortgageRateMetric = useStore((s) => s.prefs.mortgageRateMetric);
  const productHistoryAvailable = useStore((s) => s.productHistory != null);
  const horizontalScrollRef = useRef<ScrollView>(null);
  const [layoutReady, setLayoutReady] = useState(false);

  const comparison = useMemo(() => {
    if (!core) return null;
    let list: string[];
    try {
      const parsed: unknown = keys ? JSON.parse(keys) : [];
      list = Array.isArray(parsed)
        ? parsed.filter((value): value is string => typeof value === 'string')
        : [];
    } catch {
      list = keys ? keys.split(',') : [];
    }
    return validateCompareSelections(core, list);
  }, [core, keys]);
  const entries = useMemo<Entry[]>(
    () => comparison && comparison.issue == null ? comparison.entries : [],
    [comparison],
  );

  useEffect(() => {
    if (entries.length >= 2 && !details) void ensureDetails();
  }, [details, ensureDetails, entries.length]);

  const logoIds = useMemo(
    () => entries.map((entry) =>
      `compare:${entry.row.rate_index ?? 'default'}#${entry.row.product_key}`),
    [entries],
  );
  const logoReadiness = useLogoReadiness(logoIds.join('|'), logoIds);

  const auditActions = useMemo(() => {
    const dismiss = (parameters: unknown) => {
      const returnPath = parameters && typeof parameters === 'object'
        ? (parameters as { returnPath?: unknown }).returnPath
        : null;
      if (typeof returnPath === 'string' && returnPath.startsWith('/')) {
        router.replace(returnPath as Href);
      } else {
        router.back();
      }
    };
    return {
      'compare.open': () => undefined,
      'compare.scroll.last-column': () => horizontalScrollRef.current?.scrollToEnd({ animated: true }),
      'compare.dismiss': dismiss,
      'saved.compare.dismiss': dismiss,
    };
  }, []);
  usePerformanceAuditSurface({
    id: 'compare.table',
    routeKey: '/compare',
    datasetRevision: core?.run_date ?? null,
    renderRevision: `${core?.run_date ?? 'none'}:${entries.map((entry) => `${entry.row.rate_index ?? ''}#${entry.row.product_key}`).join('|')}`,
    actions: auditActions,
    probes: [
      {
        id: 'compare.data',
        kind: 'data',
        status: comparison?.issue ? 'error' : core && entries.length >= 2 ? 'ready' : 'pending',
        datasetRevision: core?.run_date ?? null,
        error: comparison?.issue ? comparisonIssueCopy(comparison.issue).subtitle : null,
      },
      {
        id: 'compare.columns',
        kind: 'list',
        status: entries.length >= 2 ? 'ready' : 'pending',
        expectedCount: entries.length,
        actualCount: entries.length,
      },
      {
        id: 'compare.layout',
        kind: 'layout',
        status: layoutReady ? 'ready' : 'pending',
        layoutMeasured: layoutReady,
      },
      {
        id: 'compare.logos',
        kind: 'logo',
        status: entries.length >= 2 && logoReadiness.ready ? 'ready' : 'pending',
        expectedCount: logoReadiness.expectedCount,
        actualCount: logoReadiness.terminalCount,
        fallbackCount: logoReadiness.fallbackCount,
      },
    ],
  });

  if (!core) return <ScreenSkeleton />;
  if (comparison?.issue) {
    const copy = comparisonIssueCopy(comparison.issue);
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}>
          <EmptyState icon="git-compare-outline" title={copy.title} subtitle={copy.subtitle} />
          <Button title="Choose products" variant="secondary" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const lowerIsBetter = SECTIONS[entries[0].section].lowerIsBetter;
  const fractions = entries.map((e) =>
    rankFraction(e.row, e.section, depositRankMetric, mortgageRateMetric),
  );
  const valid = fractions.filter((f): f is number => f !== null);
  const bestVal =
    valid.length ? (lowerIsBetter ? Math.min(...valid) : Math.max(...valid)) : null;
  const bestTone = lowerIsBetter ? 'success' : 'primary';
  const bestHighlightBg =
    bestTone === 'success' ? `${theme.colors.success}33` : theme.colors.primaryMuted;

  const rateColorFor = (section: SectionKey) =>
    SECTIONS[section].lowerIsBetter ? theme.colors.success : theme.colors.primary;

  const detailFor = (entry: Entry): ProductDetail | undefined =>
    details?.products?.[entry.row.product_key];
  const commonRows: AttrRow[] = [
    { label: 'Advertised rate', get: (e) => formatRate(e.row.rate), tabular: true },
    {
      label: 'Ongoing rate',
      get: (e) => e.row.ongoing_rate ? formatRate(e.row.ongoing_rate) : 'Not separately published',
      tabular: true,
    },
    {
      label: 'Comparison rate',
      get: (e) => (e.row.comparison_rate ? formatRate(e.row.comparison_rate) : '—'),
      tabular: true,
    },
    { label: 'Type', get: (e) => humanizeEnum(e.row.rate_type) || '—' },
    { label: 'Term', get: (e) => formatTerm(e.row) || '—' },
    {
      label: 'Repayment',
      get: (e) => humanizeEnum(e.row.ribbon_repayment_type ?? e.row.repayment_type) || '—',
    },
    { label: 'LVR', get: (e) => humanizeEnum(e.row.lvr_tier) || '—' },
    { label: 'Balance', get: (e) => formatBalanceRange(e.row.balance_min, e.row.balance_max) || '—' },
    { label: 'Fees', get: (e) => publishedItemCount(detailFor(e)?.fees) },
    { label: 'Eligibility', get: (e) => publishedItemCount(detailFor(e)?.eligibility) },
    { label: 'Features', get: (e) => publishedItemCount(detailFor(e)?.features) },
    { label: 'Constraints', get: (e) => publishedItemCount(detailFor(e)?.constraints) },
    { label: 'Observed', get: (e) => e.row.last_updated?.slice(0, 10) || core.run_date },
  ];
  const attrRows = commonRows.filter((item) => {
    if (item.label === 'Comparison rate' || item.label === 'Repayment' || item.label === 'LVR') {
      return entries.some((entry) => entry.section === 'Mortgage');
    }
    if (item.label === 'Ongoing rate') return entries.some((entry) => entry.section === 'Savings');
    return true;
  });
  const rankedRateLabels = entries.map((entry) => rankedRateLabelForRow(
    entry.row,
    entry.section,
    depositRankMetric,
    mortgageRateMetric,
  ));
  const commonRankedRateLabel = new Set(rankedRateLabels).size === 1
    ? rankedRateLabels[0]
    : 'Ranked rate';
  // A rate field is globally redundant only when it is the ranked metric for
  // every entry.
  const detailRows = attrRows.filter((row) =>
    !isRateLabelRankedForEveryEntry(row.label, rankedRateLabels));
  const differingRows = detailRows.filter((row) => valuesDiffer(row, entries));
  const sharedRows = detailRows.filter((row) =>
    !isRateDetailLabel(row.label) && !valuesDiffer(row, entries));

  const labelCell = (label: string, height: number, weight: '600' | '700' = '600') => (
    <View
      key={label}
      style={[
        styles.labelCell,
        {
          width: LABEL_W,
          height,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.bg,
        },
      ]}
    >
      <AppText variant="tiny" color="textFaint" weight={weight} numberOfLines={2}>
        {label}
      </AppText>
    </View>
  );

  const valueCell = (
    key: string,
    height: number,
    content: React.ReactNode,
    backgroundColor: string = theme.colors.card,
  ) => (
    <View
      key={key}
      style={[
        styles.valueCell,
        {
          width: COL_W,
          height,
          borderColor: theme.colors.border,
          backgroundColor,
        },
      ]}
    >
      {content}
    </View>
  );

  return (
    <Screen onLayout={() => setLayoutReady(true)}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator>
      <PersonalCostComparisonDisclosure />
      {compact ? (
        <>
          <View style={styles.compactIntro}>
            <AppText variant="h3">Key differences</AppText>
            <AppText variant="small" color="textMuted">
              Compare the details that differ first. Shared details follow.
            </AppText>
          </View>
          {entries.map((entry, idx) => {
            const fraction = fractions[idx];
            const isBest = bestVal !== null && fraction === bestVal;
            const rankedRateLabel = rankedRateLabelForRow(
              entry.row,
              entry.section,
              depositRankMetric,
              mortgageRateMetric,
            );
            const compactDetailRows = detailRows.filter((row) =>
              showCompactDetailRow(row.label, rankedRateLabel, differingRows.includes(row)));
            return (
              <Card
                key={`${entry.row.product_key}#${entry.row.rate_index ?? idx}`}
                variant="outlined"
                accessibilityLabel={`${entry.row.provider}, ${entry.row.product_name}, product ${idx + 1} of ${entries.length}`}
                style={styles.compactCard}
              >
                <Row gap={12} style={styles.compactProductHeader}>
                  <BankAvatar
                    provider={entry.row.provider}
                    size={36}
                    renderStateId={logoIds[idx]}
                    onRenderStateChange={logoReadiness.onLogoRenderStateChange}
                  />
                  <View style={styles.compactProductTitle}>
                    <AppText variant="body" weight="700">{entry.row.product_name}</AppText>
                    <AppText variant="small" color="textMuted">{entry.row.provider}</AppText>
                  </View>
                  {isBest ? <Badge label={lowerIsBetter ? "Lowest rate" : "Highest rate"} tone={bestTone} /> : null}
                </Row>

                <View style={styles.compactRateBlock}>
                  <AppText variant="tiny" color="textFaint">
                    {rankedRateLabel}
                  </AppText>
                  <AppText variant="rateHero" style={{ color: rateColorFor(entry.section) }}>
                    {fraction === null ? '—' : formatRate(fraction)}
                  </AppText>
                  {productHistoryAvailable ? (
                    <ProductRateChangeLine
                      productKey={entry.row.product_key}
                      section={entry.section}
                      compact
                    />
                  ) : null}
                </View>

                {compactDetailRows.length ? (
                  <View style={styles.compactFacts}>
                    {compactDetailRows.map((row, rowIndex) => (
                      <View key={row.label}>
                        {rowIndex > 0 ? <Divider style={styles.compactDivider} /> : null}
                        <AppText variant="tiny" color="textFaint">{row.label}</AppText>
                        <AppText
                          variant="small"
                          weight="600"
                          style={row.tabular ? { fontVariant: ['tabular-nums'] } : undefined}
                        >
                          {row.get(entry)}
                        </AppText>
                      </View>
                    ))}
                  </View>
                ) : (
                  <AppText variant="small" color="textMuted">No other published differences.</AppText>
                )}
              </Card>
            );
          })}

          {sharedRows.length ? (
            <View style={styles.sharedSection}>
              <AppText variant="h3">Shared details</AppText>
              <Card variant="outlined" style={styles.sharedCard}>
                {sharedRows.map((row, idx) => (
                  <View key={row.label}>
                    {idx > 0 ? <Divider style={styles.compactDivider} /> : null}
                    <AppText variant="tiny" color="textFaint">{row.label}</AppText>
                    <AppText
                      variant="small"
                      weight="600"
                      style={row.tabular ? { fontVariant: ['tabular-nums'] } : undefined}
                    >
                      {row.get(entries[0])}
                    </AppText>
                  </View>
                ))}
              </Card>
            </View>
          ) : null}
        </>
      ) : (
      <View style={[styles.table, { borderColor: theme.colors.border }]}>
        <View style={styles.bodyRow}>
          {/* Frozen label column */}
          <View>
            <View
              style={[
                styles.labelCell,
                {
                  width: LABEL_W,
                  height: HEADER_H,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.bg,
                },
              ]}
            />
             {labelCell(commonRankedRateLabel ?? 'Ranked rate', RATE_ROW_H, '700')}
             {productHistoryAvailable ? labelCell('Recent move', CHANGE_ROW_H) : null}
             {detailRows.map((r) => labelCell(r.label, ROW_H))}
          </View>

          {/* Horizontally scrollable product columns */}
          <ScrollView
            ref={horizontalScrollRef}
            horizontal
            showsHorizontalScrollIndicator
            style={styles.scrollArea}
            contentContainerStyle={{ flexGrow: 1 }}
          >
            <View style={{ flexDirection: 'row' }}>
              {entries.map((e, idx) => {
                const f = fractions[idx];
                const isBest = bestVal !== null && f === bestVal;
                const entryRateColor = rateColorFor(e.section);
                const entryHighlightBg = isBest ? bestHighlightBg : theme.colors.card;
                return (
                  <View
                    key={`${e.row.product_key}#${e.row.rate_index ?? idx}`}
                    style={{ width: COL_W }}
                  >
                    {/* Product header */}
                    <View
                      style={[
                        styles.headerCell,
                        {
                          height: HEADER_H,
                          borderColor: theme.colors.border,
                          backgroundColor: theme.colors.card,
                        },
                      ]}
                    >
                      <BankAvatar
                        provider={e.row.provider}
                        size={28}
                        renderStateId={logoIds[idx]}
                        onRenderStateChange={logoReadiness.onLogoRenderStateChange}
                      />
                      <AppText variant="tiny" weight="700" numberOfLines={2} style={{ marginTop: 4 }}>
                        {e.row.product_name}
                      </AppText>
                      <AppText variant="tiny" color="textMuted" numberOfLines={1}>
                        {e.row.provider}
                      </AppText>
                    </View>

                    {/* Rate row */}
                    {valueCell(
                      'rate',
                      RATE_ROW_H,
                      <View style={styles.rateCell}>
                        {isBest ? <Badge label={lowerIsBetter ? "Lowest rate" : "Highest rate"} tone={bestTone} /> : null}
                        <AppText variant="rate" style={{ color: entryRateColor }}>
                          {f === null ? '—' : formatRate(f)}
                        </AppText>
                      </View>,
                      entryHighlightBg,
                     )}

                     {productHistoryAvailable
                       ? valueCell(
                           'best-rate-move',
                           CHANGE_ROW_H,
                           <ProductRateChangeLine
                             productKey={e.row.product_key}
                             section={e.section}
                             compact
                           />,
                         )
                       : null}

                     {/* Attribute rows */}
                    {detailRows.map((r) =>
                      valueCell(
                        r.label,
                        ROW_H,
                        <AppText
                          variant="small"
                          weight="600"
                          numberOfLines={2}
                          style={r.tabular ? { fontVariant: ['tabular-nums'] } : undefined}
                        >
                          {r.get(e)}
                        </AppText>,
                      ),
                    )}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
      )}

      <AppText variant="h3">Published product details</AppText>
      {entries.map((entry, index) => (
        <ComparisonDisclosures
          key={`${entry.row.product_key}#${entry.row.rate_index ?? index}`}
          name={entry.row.product_name}
          provider={entry.row.provider}
          productKey={entry.row.product_key}
          detail={detailFor(entry)}
          loading={!details}
        />
      ))}
      <Divider />
      <AppText variant="tiny" color="textFaint">
        {`${entries.length} products · Compared by ${entries[0].section === 'Mortgage'
          ? mortgageRateMetric === 'comparison' ? 'comparison rate' : 'advertised rate'
          : depositRankMetric === 'base' ? 'ongoing rate' : 'headline rate'}${compact ? '' : ' · scroll for more columns'}`}
      </AppText>
      <AppText variant="tiny" color="textFaint">
        Missing details may reflect a collection gap. A rate ranking does not include all costs or establish eligibility.
      </AppText>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
    gap: 12,
  },
  compactIntro: {
    gap: 3,
    marginBottom: 2,
  },
  compactCard: {
    gap: 14,
  },
  compactProductHeader: {
    alignItems: 'flex-start',
  },
  compactProductTitle: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  compactRateBlock: {
    gap: 2,
  },
  compactFacts: {
    gap: 8,
  },
  compactDivider: {
    marginBottom: 8,
  },
  sharedSection: {
    gap: 8,
  },
  sharedCard: {
    gap: 8,
  },
  table: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    overflow: 'hidden',
  },
  bodyRow: {
    flexDirection: 'row',
  },
  scrollArea: {
    flex: 1,
  },
  labelCell: {
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerCell: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  valueCell: {
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rateCell: {
    alignItems: 'flex-start',
    gap: 4,
  },
});
