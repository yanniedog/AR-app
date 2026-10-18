import { uiCount, uiDate, uiJoin, uiLabel, uiProductName, uiProviderName, type UiCopy, type UiChild } from "../src/lib/uiCopy";
import { SelectedRateConditions } from "../src/components/product/RateConditionsDisclosure";
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useSuitabilityRevision } from '../src/hooks/useSuitabilityRevision';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { BankAvatar } from '../src/components/BankAvatar';
import { EmptyState, ScreenSkeleton } from '../src/components/feedback';
import { ComparisonDisclosures, PersonalCostComparisonDisclosure, publishedItemCount } from '../src/components/product/ComparisonDisclosures';
import { CanonicalTermsComparison } from '../src/components/product/CanonicalTermsComparison';
import { FixedDepositComparison } from '../src/components/product/FixedDepositComparison';
import { MortgageComparison } from '../src/components/product/MortgageComparison';
import { PortfolioComparison } from '../src/components/product/PortfolioComparison';
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
import { usePublicRateCatalogue } from '../src/data/publicRateCatalogue';
import { publicComparisonCore, publicRateScenario, resolveRowPublicRate, rowWithPublicResolution } from '../src/data/publicRateIntegration';
import { publicRateText } from '../src/data/publicRatePresentation';
import { useUserRateScenario } from '../src/hooks/useUserRateScenario';
import { PublicRateEvidence } from '../src/components/scenario/PublicRateEvidence';
import { PublicCostComparison } from '../src/components/scenario/PublicCostComparison';
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
import { uiListedLvrRange } from '../src/lib/financialUiCopy';

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
  label: UiCopy;
  get: (e: Entry) => UiCopy;
  /** When true, values use tabular numerals (rates). */
  tabular?: boolean;
}

function comparisonIssueCopy(issue: CompareSelectionIssue): { title: UiCopy } {
  if (issue === 'limit_reached') return { title: 'Maximum 4 rates' };
  if (issue === 'category_mismatch') return { title: 'Mixed rate categories' };
  if (issue === 'unavailable') return { title: 'Rate unavailable' };
  return { title: 'Minimum 2 rates' };
}

function valuesDiffer(row: AttrRow, entries: Entry[]): boolean {
  return new Set(entries.map((entry) => row.get(entry).trim().toLocaleLowerCase())).size > 1;
}

export default function Compare() {
  const suitabilityRevision = useSuitabilityRevision();
  const theme = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const compact = usesCompactCompareLayout(width, fontScale);
  const { keys } = useLocalSearchParams<{ keys: string }>();
  const core = useStore((s) => s.core);
  const manifest = useStore(state => state.manifest);
  const profile = useStore(state => state.prefs.profileFilters);
  const catalogue = usePublicRateCatalogue(manifest);
  const { scenario } = useUserRateScenario();
  const details = useStore((s) => s.details);
  const ensureDetails = useStore((s) => s.ensureDetails);
  const depositRankMetric = useStore((s) => s.prefs.depositRankMetric);
  const mortgageRateMetric = useStore((s) => s.prefs.mortgageRateMetric);
  const productHistoryAvailable = useStore((s) => s.productHistory != null);
  const horizontalScrollRef = useRef<ScrollView>(null);
  const [layoutReady, setLayoutReady] = useState(false);

  const comparison = useMemo(() => {
    void suitabilityRevision;
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
    return validateCompareSelections(publicComparisonCore(core, catalogue,
      section => publicRateScenario(section, scenario, profile)), list);
  }, [core, keys, suitabilityRevision, catalogue, scenario, profile]);
  const entries = useMemo<Entry[]>(
    () => comparison && comparison.issue == null ? comparison.entries.map(entry => {
      const resolution = resolveRowPublicRate(entry.row, catalogue, publicRateScenario(entry.section, scenario, profile, entry.row));
      return resolution ? { ...entry, row: rowWithPublicResolution(entry.row, resolution) } : entry;
    }) : [],
    [comparison, catalogue, scenario, profile],
  );

  const calculationRows = useMemo(() => entries.map(entry => entry.row), [entries]);

  useEffect(() => {
    if (core && !details) void ensureDetails();
  }, [core, details, ensureDetails]);
  const { status: catalogueStatus, allLoaded, loadAll } = catalogue;
  useEffect(() => { if (catalogueStatus === 'ready' && !allLoaded) void loadAll().catch(() => undefined); }, [catalogueStatus, allLoaded, loadAll]);

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
        error: comparison?.issue ? comparisonIssueCopy(comparison.issue).title : null,
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
  const comparisonLoading = catalogue.status !== 'unavailable' && !(catalogue.status === 'ready' && catalogue.allLoaded);
  if (comparisonLoading && comparison?.issue) return <Screen>
    <AppText variant="small" color="textMuted">{uiJoin('Public pricing', ': ', catalogue.status === 'error' ? 'Unavailable' : 'Loading')}</AppText>
  </Screen>;
  if (comparison?.issue) {
    const copy = comparisonIssueCopy(comparison.issue);
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}>
          <EmptyState icon="git-compare-outline" title={copy.title} />
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
    !comparisonLoading && valid.length === entries.length && valid.length
      ? (lowerIsBetter ? Math.min(...valid) : Math.max(...valid)) : null;
  const bestTone = lowerIsBetter ? 'success' : 'primary';
  const bestHighlightBg =
    bestTone === 'success' ? `${theme.colors.success}33` : theme.colors.primaryMuted;

  const rateColorFor = (section: SectionKey) =>
    SECTIONS[section].lowerIsBetter ? theme.colors.success : theme.colors.primary;

  const detailFor = (entry: Entry): ProductDetail | undefined =>
    details?.products?.[entry.row.product_key];
  const commonRows: AttrRow[] = [
    { label: uiLabel('Payable rate'), get: (e) => { const resolution = resolveRowPublicRate(e.row, catalogue, publicRateScenario(e.section, scenario, profile, e.row)); return resolution ? publicRateText(resolution) : formatRate(e.row.rate); }, tabular: true },
    {
      label: uiLabel("Ongoing rate"),
      get: (e) => e.row.ongoing_rate ? formatRate(e.row.ongoing_rate) : 'Unknown',
      tabular: true,
    },
    {
      label: uiLabel("Comparison rate"),
      get: (e) => (e.row.comparison_rate ? formatRate(e.row.comparison_rate) : '—'),
      tabular: true,
    },
    { label: uiLabel("Type"), get: (e) => humanizeEnum(e.row.rate_type) || '—' },
    { label: uiLabel("Term"), get: (e) => formatTerm(e.row) || '—' },
    {
      label: uiLabel("Repayment"),
      get: (e) => humanizeEnum(e.row.ribbon_repayment_type ?? e.row.repayment_type) || '—',
    },
    { label: uiLabel("Listed LVR"), get: (e) => uiListedLvrRange(e.row) },
    { label: uiLabel("Balance"), get: (e) => formatBalanceRange(e.row.balance_min, e.row.balance_max) || '—' },
    { label: uiLabel("Fees"), get: (e) => publishedItemCount(detailFor(e)?.fees) },
    { label: uiLabel("Eligibility"), get: (e) => publishedItemCount(detailFor(e)?.eligibility) },
    { label: uiLabel("Features"), get: (e) => publishedItemCount(detailFor(e)?.features) },
    { label: uiLabel("Constraints"), get: (e) => publishedItemCount(detailFor(e)?.constraints) },
    // Calendar-day formatting: UTC-midnight parsing shows the previous day west of UTC.
    { label: uiLabel("Last updated"), get: (e) => uiDate(e.row.last_updated?.slice(0,10)||core.run_date) },
  ];
  const attrRows = commonRows.filter((item) => {
    if (item.label === 'Comparison rate' || item.label === 'Repayment' || item.label === 'Listed LVR') {
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

  const labelCell = (label: UiCopy, height: number, weight: '600' | '700' = '600') => (
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
    content: UiChild,
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
      {compact ? (
        <>
          <AppText variant="h3">{uiLabel("Differences")}</AppText>
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
                accessibilityLabel={uiJoin(uiProviderName(entry.row),' · ',uiProductName(entry.row),' · ',uiCount(idx+1),' / ',uiCount(entries.length))}
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
                    <AppText variant="body" weight="700">{uiProductName(entry.row)}</AppText>
                    <AppText variant="small" color="textMuted">{uiProviderName(entry.row)}</AppText>
                  </View>
                  {isBest ? <Badge label={uiLabel(lowerIsBetter ? "Lowest rate" : "Highest rate")} tone={bestTone} /> : null}
                </Row>

                <View style={styles.compactRateBlock}>
                  <AppText variant="tiny" color="textFaint">
                    {rankedRateLabel}
                  </AppText>
                  <AppText variant="rateHero" style={{ color: rateColorFor(entry.section) }}>
                    {fraction === null ? uiLabel("—") : formatRate(fraction)}
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
                  <AppText variant="small" color="textMuted">{uiLabel("No other differences")}</AppText>
                )}
              </Card>
            );
          })}

          {sharedRows.length ? (
            <View style={styles.sharedSection}>
              <AppText variant="h3">{uiLabel("Shared details")}</AppText>
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
                        {uiProductName(e.row)}
                      </AppText>
                      <AppText variant="tiny" color="textMuted" numberOfLines={1}>
                        {uiProviderName(e.row)}
                      </AppText>
                    </View>

                    {/* Rate row */}
                    {valueCell(
                      'rate',
                      RATE_ROW_H,
                      <View style={styles.rateCell}>
                        {isBest ? <Badge label={uiLabel(lowerIsBetter ? "Lowest rate" : "Highest rate")} tone={bestTone} /> : null}
                        <AppText variant="rate" style={{ color: entryRateColor }}>
                          {f === null ? uiLabel("—") : formatRate(f)}
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

      {entries.map((entry,index)=><Card key={`conditions:${entry.row.product_key}#${entry.row.rate_index??index}`} style={{gap:8}}>
        <AppText weight="700">{uiProductName(entry.row)}</AppText>
        <SelectedRateConditions row={entry.row} section={entry.section}/>
      </Card>)}
      {/* Differences first; calculations and document terms are follow-up detail. */}
      <CanonicalTermsComparison rows={calculationRows} />
      {entries.map(entry => <View key={`public:${entry.row.product_key}:${entry.row.public_offer_id ?? entry.row.rate_index}`}>
        <PublicRateEvidence productKey={entry.row.product_key} row={entry.row} />
        <PublicCostComparison section={entry.section} target={entry.row} scenario={scenario} />
      </View>)}
      {entries.every(entry => entry.section === 'TD') ? <FixedDepositComparison rows={calculationRows} /> : entries.every(entry => entry.section === 'Savings') ? <PortfolioComparison rows={entries} /> : entries.every(entry => entry.section === 'Mortgage') ? <MortgageComparison rows={entries} /> : <PersonalCostComparisonDisclosure />}

      <AppText variant="h3">{uiLabel("Published product details")}</AppText>
      {entries.map((entry, index) => (
        <ComparisonDisclosures
          key={`${entry.row.product_key}#${entry.row.rate_index ?? index}`}
          name={entry.row.product_name}
          provider={entry.row.provider}
          productKey={entry.row.product_key}
          productDetails={detailFor(entry)}
          loading={!details}
        />
      ))}
      <Divider />
      <AppText variant="tiny" color="textFaint">
        {uiJoin(uiCount(entries.length),' ','Products',' · ','Ranked rate',': ',commonRankedRateLabel)}
      </AppText>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <AppText variant="tiny" color="textFaint">{uiLabel("Missing details")}</AppText>
        <AppText variant="tiny">{uiLabel("Unknown")}</AppText>
      </Row>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <AppText variant="tiny" color="textFaint">{uiLabel("Eligibility / total costs")}</AppText>
        <AppText variant="tiny">{uiLabel("Unverified")}</AppText>
      </Row>
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
