import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef } from 'react';
import { Alert, Share, View } from 'react-native';

import { BankAvatar } from '../../src/components/BankAvatar';
import { BankHistoryChart } from '../../src/components/BankHistoryChart';
import { ChartErrorBoundary } from '../../src/components/ChartErrorBoundary';
import { EmptyState } from '../../src/components/feedback';
import { ProPaywall } from '../../src/components/ProPaywall';
import {
  AccessNotice,
  DetailGroup,
  HistoryLegend,
  OfficialLinks,
  ProductRatesList,
  ProductSpecs,
  SectionTitle,
} from '../../src/components/product/ProductDetailParts';
import { ScreenScrollView } from '../../src/components/Screen';
import { AppText, Button, Card, IconButton, Row } from '../../src/components/ui';
import { SECTIONS } from '../../src/constants';
import { filterBankInsightsForSuitability } from '../../src/data/bankInsights';
import { formatRate, isNonStandard, toFraction } from '../../src/data/format';
import { sortRows, findByKey } from '../../src/data/selectors';
import { selectBankHistoryChartModel } from '../../src/data/historySelectors';
import {
  hasProductSeries,
  productSeriesRecordWithCurrent,
} from '../../src/data/productHistory';
import { ensurePermissions, registerBackgroundRefresh } from '../../src/data/notifications';
import { useStore } from '../../src/data/store';
import { useProPaywall } from '../../src/hooks/useProPaywall';
import { useSuitabilityRevision } from '../../src/hooks/useSuitabilityRevision';
import { openBank } from '../../src/lib/nav';
import { rateQualifier } from '../../src/lib/rateQualifier';
import { logSwallowedError } from '../../src/lib/degradationLog';
import {
  canAddAlertSubscription,
  effectiveBankInsights,
  effectiveHistoryRibbon,
} from '../../src/lib/proAccess';
import { relativeDate } from '../../src/data/format';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function ProductDetail() {
  const suitabilityRevision = useSuitabilityRevision();
  const theme = useTheme();
  const { key, ri } = useLocalSearchParams<{ key: string; ri?: string }>();
  const productKey = key ?? '';
  const rateIndex = ri != null && ri !== '' ? Number(ri) : null;
  const core = useStore((s) => s.core);
  const coreSha = useStore((s) => s.manifest?.files.core.sha256);
  const ensureDetails = useStore((s) => s.ensureDetails);
  const detail = useStore((s) => s.details?.products[productKey] ?? null);
  const detailsProducts = useStore((s) => s.details?.products ?? null);
  const detailsLoading = useStore((s) => s.detailsLoading);
  const favorite = useStore((s) => s.favorites.includes(productKey));
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const notificationsEnabled = useStore((s) => s.prefs.notificationsEnabled);
  const setPref = useStore((s) => s.setPref);
  const subscribed = useStore((s) => s.isProductSubscribed(productKey, rateIndex));
  const subscribeProduct = useStore((s) => s.subscribeProduct);
  const unsubscribeProduct = useStore((s) => s.unsubscribeProduct);
  const subscriptions = useStore((s) => s.subscriptions);
  const includeNonStandard = useStore((s) => s.prefs.includeNonStandard);
  const depositRankMetric = useStore((s) => s.prefs.depositRankMetric);
  const historyEnabled = useStore((s) => effectiveHistoryRibbon(s.prefs));
  const showBankInsights = useStore((s) => effectiveBankInsights(s.prefs));
  const historyBanks = useStore((s) => s.historyBanks);
  const bankInsights = useStore((s) => s.bankInsights);
  const bankInsightsError = useStore((s) => s.bankInsightsError);
  const productHistory = useStore((s) => s.productHistory);
  const productHistoryError = useStore((s) => s.productHistoryError);
  const ensureHistoryBanks = useStore((s) => s.ensureHistoryBanks);
  const ensureBankInsights = useStore((s) => s.ensureBankInsights);
  const ensureProductHistory = useStore((s) => s.ensureProductHistory);
  const { paywallVisible, paywallIntent, requestPro, closePaywall } = useProPaywall();
  const insightsRequestKey = useRef<string | null>(null);

  useEffect(() => {
    void ensureDetails({ forProductView: true });
  }, [ensureDetails]);

  useEffect(() => {
    if (!showBankInsights) {
      insightsRequestKey.current = null;
      return;
    }
    const key = core?.run_date ?? null;
    if (!key || insightsRequestKey.current === key) return;
    insightsRequestKey.current = key;
    void ensureBankInsights();
  }, [core?.run_date, ensureBankInsights, showBankInsights]);

  useEffect(() => {
    if (!historyEnabled) return;
    // Product-history dated-core fan-out is expensive; prefer the disk/bootstrap
    // cache and only sync after history banks so tab navigation stays responsive.
    // Bank insights supply the multi-day market ribbon under Standard-only mode.
    void ensureHistoryBanks().then(() => {
      if (showBankInsights) void ensureBankInsights();
      void ensureProductHistory();
    });
  }, [
    core?.run_date,
    coreSha,
    historyEnabled,
    showBankInsights,
    ensureHistoryBanks,
    ensureBankInsights,
    ensureProductHistory,
    productKey,
  ]);

  const found = core ? findByKey(core.sections, productKey) : null;

  const explorerInsights = useMemo(() => {
    void suitabilityRevision;
    return filterBankInsightsForSuitability(
      bankInsights,
      core,
      includeNonStandard,
      detailsProducts,
    );
  }, [bankInsights, core, detailsProducts, includeNonStandard, suitabilityRevision]);

  const historyModel = useMemo(() => {
    void suitabilityRevision;
    if (!historyEnabled || !core || !found) return null;
    return selectBankHistoryChartModel(
      {
        core,
        historyBanks,
        bankInsights: explorerInsights,
        includeNonStandard,
        detailsProducts,
      },
      found.section,
      'All',
    );
  }, [
    core,
    detailsProducts,
    explorerInsights,
    found,
    historyBanks,
    historyEnabled,
    includeNonStandard,
    suitabilityRevision,
  ]);

  // Single-day fallback is a misleading solid RBA block; wait for multi-day context
  // when Standard-only mode is relying on bank insights that have not arrived yet.
  // Stop waiting once insights fail so the empty/collecting copy can show.
  const historyWaitingForInsights =
    historyEnabled &&
    !includeNonStandard &&
    showBankInsights &&
    !explorerInsights &&
    !bankInsightsError &&
    (!historyModel || historyModel.dates.length < 2);

  if (!found) {
    return (
      <>
        <Stack.Screen options={{ title: 'Product' }} />
        <EmptyState icon="alert-circle-outline" title="Product not found" />
      </>
    );
  }

  const { section, siblings } = found;
  const row =
    (rateIndex != null ? siblings.find((s) => s.rate_index === rateIndex) : undefined) ?? found.row;
  const meta = SECTIONS[section];
  const accent = meta.lowerIsBetter ? theme.colors.success : theme.colors.primary;
  const rateRows = sortRows(siblings, 'rate', section, depositRankMetric);
  const qualifier = rateQualifier(row, section);

  const sectionInk = meta.lowerIsBetter ? theme.colors.rateLoan : theme.colors.rateDeposit;
  // Match productHistory's section-best pick so the seeded point aligns with synced series.
  let currentBest: number | null = null;
  for (const sibling of siblings) {
    const rate = toFraction(sibling.rate);
    if (rate == null || rate <= 0) continue;
    if (currentBest == null) currentBest = rate;
    else currentBest = meta.lowerIsBetter ? Math.min(currentBest, rate) : Math.max(currentBest, rate);
  }
  const productSeries = {
    values: productSeriesRecordWithCurrent(productHistory, productKey, core?.run_date, currentBest),
    label: row.product_name,
  };
  const productHasSeries = hasProductSeries(productHistory, productKey);
  const productHasHighlight = Object.values(productSeries.values).some(
    (v) => typeof v === 'number' && Number.isFinite(v),
  );

  const onShare = () =>
    Share.share({
      message: `${row.provider} — ${row.product_name}: ${formatRate(row.rate)} (${meta.title}, Australian Rates)`,
    }).catch((err) => logSwallowedError('product.share', err));

  const onToggleNotify = async () => {
    if (subscribed) {
      unsubscribeProduct(productKey, rateIndex);
      return;
    }
    if (!canAddAlertSubscription(subscriptions, useStore.getState().prefs)) {
      requestPro('alert_limit');
      return;
    }
    const ok = await ensurePermissions();
    if (!ok) {
      Alert.alert('Notifications disabled', 'Enable notifications for Australian Rates in system settings.');
      return;
    }
    if (!notificationsEnabled) {
      setPref('notificationsEnabled', true);
      void registerBackgroundRefresh();
    }
    subscribeProduct(productKey, rateIndex, row);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: row.provider,
          headerRight: () => (
            <Row gap={2}>
              <IconButton
                icon={subscribed ? 'notifications' : 'notifications-outline'}
                color={subscribed ? 'primary' : 'text'}
                onPress={() => void onToggleNotify()}
                accessibilityLabel={subscribed ? 'Remove rate alert' : 'Notify on rate change'}
              />
              <IconButton
                icon={favorite ? 'star' : 'star-outline'}
                color={favorite ? 'warning' : 'text'}
                onPress={() => toggleFavorite(productKey)}
                accessibilityLabel="Toggle favourite"
              />
              <IconButton icon="share-outline" onPress={onShare} accessibilityLabel="Share" />
            </Row>
          ),
        }}
      />
      <ScreenScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Row gap={14} style={{ marginBottom: 16 }}>
          <BankAvatar provider={row.provider} size={56} />
          <View style={{ flex: 1 }}>
            <AppText variant="h3">{row.product_name}</AppText>
            <AppText variant="small" color="textMuted">
              {row.provider} · {meta.title}
            </AppText>
          </View>
        </Row>

        <Card style={{ marginBottom: 16, alignItems: 'center' }}>
          <AppText variant="small" color="textMuted">
            {meta.lowerIsBetter ? 'Advertised rate' : 'Interest rate'}
          </AppText>
          <AppText variant="h1" weight="800" style={{ color: accent, marginVertical: 2 }}>
            {formatRate(row.rate)}
          </AppText>
          {row.comparison_rate ? (
            <AppText variant="small" color="textFaint">
              {formatRate(row.comparison_rate)} comparison rate
            </AppText>
          ) : null}
          {isNonStandard(row) ? (
            <View
              style={{
                marginTop: 8,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: theme.radius.sm,
                backgroundColor: theme.colors.chip,
              }}
            >
              <AppText variant="tiny" weight="700" style={{ color: theme.colors.warning }}>
                Non-standard account
              </AppText>
            </View>
          ) : null}
          {qualifier.conditional ? (
            <>
              <View
                style={{
                  marginTop: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: theme.radius.sm,
                  borderWidth: 1,
                  borderColor: theme.colors.warning,
                }}
              >
                <AppText variant="tiny" weight="700" style={{ color: theme.colors.warning }}>
                  {qualifier.label}
                </AppText>
              </View>
              <AppText
                variant="small"
                color="textMuted"
                style={{ marginTop: 8, textAlign: 'center', lineHeight: 18 }}
              >
                {qualifier.note}
              </AppText>
            </>
          ) : null}
        </Card>

        <AccessNotice name={row.product_name} provider={row.provider} detail={detail} loading={detailsLoading} />

        {detail?.description ? (
          <AppText variant="small" color="textMuted" style={{ marginBottom: 16, lineHeight: 20 }}>
            {detail.description}
          </AppText>
        ) : null}

        <ProductSpecs row={row} section={section} />

        <SectionTitle text="Rate history" icon="trending-up-outline" />
        <Card style={{ marginBottom: 16 }}>
          {historyEnabled ? (
            historyWaitingForInsights ? (
              <AppText variant="small" color="textMuted">
                Loading market history…
              </AppText>
            ) : historyModel && historyModel.dates.length >= 2 ? (
              <>
                <AppText variant="tiny" color="textFaint" style={{ marginBottom: 8 }}>
                  {row.product_name} vs all {meta.title.toLowerCase()} rates
                </AppText>
                <ChartErrorBoundary name="ProductHistoryChart">
                  <BankHistoryChart
                    dates={historyModel.dates}
                    points={historyModel.points}
                    allDates={historyModel.allDates}
                    rba={core?.rba}
                    rbaHolds={core?.rba_holds}
                    section={section}
                    height={210}
                    highlightSeries={productHasHighlight ? productSeries : null}
                  />
                </ChartErrorBoundary>
                <HistoryLegend productColor={theme.colors.text} sectionColor={sectionInk} />
                {productHistoryError && !productHasSeries ? (
                  <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
                    <AppText variant="tiny" color="danger" style={{ flex: 1 }}>
                      Couldn&apos;t load this product&apos;s history.
                    </AppText>
                    <Button
                      title="Retry"
                      variant="ghost"
                      onPress={() => void ensureProductHistory({ force: true })}
                    />
                  </Row>
                ) : !productHasSeries ? (
                  <AppText variant="tiny" color="textFaint" style={{ marginTop: 6 }}>
                    Gathering this product&apos;s daily history…
                  </AppText>
                ) : null}
              </>
            ) : (
              <AppText variant="small" color="textMuted">
                Rate history appears once more daily snapshots are collected.
              </AppText>
            )
          ) : (
            <>
              <AppText variant="small" color="textMuted" style={{ marginBottom: 10, lineHeight: 20 }}>
                See how {row.product_name}&apos;s rate moved over time against the market&apos;s mean and median.
              </AppText>
              <Button
                title="Unlock rate history"
                icon="sparkles"
                variant="secondary"
                onPress={() => {
                  if (requestPro('history_ribbon')) setPref('showHistoryRibbon', true);
                }}
              />
            </>
          )}
        </Card>

        <DetailGroup title="Features" icon="checkmark-circle-outline" items={detail?.features} loading={detailsLoading} />
        <DetailGroup title="Fees" icon="cash-outline" items={detail?.fees} loading={detailsLoading} />
        <DetailGroup title="Eligibility" icon="person-outline" items={detail?.eligibility} loading={detailsLoading} />
        <DetailGroup title="Constraints" icon="lock-closed-outline" items={detail?.constraints} loading={detailsLoading} />

        <OfficialLinks links={detail?.links} />

        <Button
          title={`View all ${row.provider} products`}
          icon="business-outline"
          variant="secondary"
          style={{ marginTop: 4 }}
          onPress={() => openBank(row.provider)}
        />

        <ProductRatesList rows={rateRows} section={section} accent={accent} />

        {row.last_updated ? (
          <AppText variant="tiny" color="textFaint" style={{ textAlign: 'center', marginTop: 14 }}>
            Lender data updated {relativeDate(row.last_updated)}
          </AppText>
        ) : null}
      </ScreenScrollView>
      <ProPaywall
        visible={paywallVisible}
        intent={paywallIntent}
        onClose={closePaywall}
        onUpgraded={() => {
          if (paywallIntent === 'history_ribbon') setPref('showHistoryRibbon', true);
        }}
      />
    </>
  );
}
