import { router, useLocalSearchParams, type Href } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BankAvatar } from '../src/components/BankAvatar';
import { EmptyState } from '../src/components/feedback';
import { ProductRateChangeLine } from '../src/components/product/ProductRateChangeLine';
import { Screen } from '../src/components/Screen';
import { AppText, Badge, Divider } from '../src/components/ui';
import { SECTIONS } from '../src/constants';
import {
  formatBalanceRange,
  formatRate,
  formatTerm,
  humanizeEnum,
  isNonStandard,
} from '../src/data/format';
import { rankFraction } from '../src/data/selectors';
import { resolveCompareSelections } from '../src/data/compareSelection';
import { useStore } from '../src/data/store';
import { usePerformanceAuditSurface } from '../src/hooks/usePerformanceAuditReadiness';
import { useLogoReadiness } from '../src/hooks/useLogoReadiness';
import { hasProAccess } from '../src/lib/proAccess';
import type { DetailItem, ProductDetail, RateRow, SectionKey } from '../src/types';
import { useTheme } from '../src/theme/ThemeProvider';

const LABEL_W = 108;
const COL_W = 136;
const HEADER_H = 88;
const ROW_H = 44;
const RATE_ROW_H = 52;
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

function detailSummary(items: DetailItem[] | undefined, empty = 'None published'): string {
  if (!items?.length) return empty;
  return items
    .slice(0, 2)
    .map((item) => [item.label ?? item.name, item.value ?? item.info].filter(Boolean).join(': '))
    .filter(Boolean)
    .join(' · ') || empty;
}

export default function Compare() {
  const theme = useTheme();
  const { keys } = useLocalSearchParams<{ keys: string }>();
  const core = useStore((s) => s.core);
  const details = useStore((s) => s.details);
  const ensureDetails = useStore((s) => s.ensureDetails);
  const depositRankMetric = useStore((s) => s.prefs.depositRankMetric);
  const mortgageRateMetric = useStore((s) => s.prefs.mortgageRateMetric);
  const productHistoryAvailable = useStore(
    (s) => hasProAccess(s.prefs) && s.productHistory != null,
  );
  const horizontalScrollRef = useRef<ScrollView>(null);
  const [layoutReady, setLayoutReady] = useState(false);

  const entries = useMemo<Entry[]>(() => {
    if (!core || !keys) return [];
    let list: string[];
    try {
      list = JSON.parse(keys);
    } catch {
      list = keys.split(',');
    }
    return resolveCompareSelections(core, list);
  }, [core, keys]);

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
        status: core && entries.length >= 2 ? 'ready' : 'pending',
        datasetRevision: core?.run_date ?? null,
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
      },
      {
        id: 'compare.logos',
        kind: 'logo',
        status: entries.length >= 2 && logoReadiness.ready ? 'ready' : 'pending',
        expectedCount: logoReadiness.expectedCount,
        actualCount: logoReadiness.terminalCount,
      },
      {
        id: 'compare.history-graphics',
        kind: 'graphic',
        required: false,
        status: 'ready',
        actualCount: productHistoryAvailable ? entries.length : 0,
      },
    ],
  });

  if (!core) return null;
  if (entries.length < 2) {
    return (
      <EmptyState
        icon="git-compare-outline"
        title="Nothing to compare"
        subtitle="Select at least two products."
        fill
      />
    );
  }

  const sameSection = entries.every((e) => e.section === entries[0].section);
  const lowerIsBetter = SECTIONS[entries[0].section].lowerIsBetter;
  const fractions = entries.map((e) =>
    rankFraction(e.row, e.section, depositRankMetric, mortgageRateMetric),
  );
  const valid = fractions.filter((f): f is number => f !== null);
  const bestVal =
    sameSection && valid.length ? (lowerIsBetter ? Math.min(...valid) : Math.max(...valid)) : null;
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
    { label: 'Account', get: (e) => (isNonStandard(e.row) ? 'Non-standard' : 'Standard') },
    { label: 'Fees', get: (e) => detailSummary(detailFor(e)?.fees) },
    { label: 'Eligibility', get: (e) => detailSummary(detailFor(e)?.eligibility, 'No criteria published') },
    { label: 'Features', get: (e) => detailSummary(detailFor(e)?.features) },
    { label: 'Observed', get: (e) => e.row.last_updated?.slice(0, 10) || core.run_date },
  ];
  const attrRows = commonRows.filter((item) => {
    if (item.label === 'Comparison rate' || item.label === 'Repayment' || item.label === 'LVR') {
      return entries.some((entry) => entry.section === 'Mortgage');
    }
    if (item.label === 'Ongoing rate') return entries.some((entry) => entry.section === 'Savings');
    return true;
  });

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
    <Screen style={{ padding: 16 }} onLayout={() => setLayoutReady(true)}>
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
             {labelCell('Ranked rate', RATE_ROW_H, '700')}
             {productHistoryAvailable ? labelCell('Best-rate move', CHANGE_ROW_H) : null}
             {attrRows.map((r) => labelCell(r.label, ROW_H))}
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
                        {isBest ? <Badge label="Best" tone={bestTone} /> : null}
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
                    {attrRows.map((r) =>
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

      <Divider style={{ marginTop: 16 }} />
      <AppText variant="tiny" color="textFaint" style={{ marginTop: 8 }}>
        {sameSection
          ? `${entries.length} products · “Best” uses ${entries[0].section === 'Mortgage'
            ? mortgageRateMetric === 'comparison' ? 'lowest comparison rate' : 'lowest advertised rate'
            : depositRankMetric === 'base' ? 'highest published ongoing/base rate' : 'highest headline rate'} · scroll for more columns`
          : `${entries.length} products · mixed categories — no best badge`}
      </AppText>
      <AppText variant="tiny" color="textFaint" style={{ marginTop: 4 }}>
        Missing details mean the lender did not publish that field in the loaded CDR payload. Confirm fees,
        conditions, eligibility, and current rates with the lender before acting.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
