import Ionicons from './icons/AppIcon';
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { bankEventMedianContext, eventsOnDate, type BankInsightsPayload, type BankRateEvent } from '../data/bankInsights';
import { uiLabel,  uiCount, uiDate, uiJoin, uiProductName, uiProviderName, uiRate } from '../lib/uiCopy';
import { uiChartBps, uiChartMove, uiChartSection } from '../lib/chartUiCopy';
import { productMovesForBankEvent, type ProductHistoryPayload } from '../data/productHistory';
import { moveTone } from '../lib/moveSemantics';
import { openBank, openProduct } from '../lib/nav';
import type { CorePayload, SectionKey } from '../types';
import { useTheme } from '../theme/ThemeProvider';
import { BankAvatar } from './BankAvatar';
import { AppText, Divider, Row } from './ui';


function Mover({ event, payload, core, history, historyError, onRetryHistory }: {
  event: BankRateEvent;
  payload: BankInsightsPayload;
  core: CorePayload | null;
  history: ProductHistoryPayload | null;
  historyError: string | null;
  onRetryHistory: () => void;
}) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const context = useMemo(() => bankEventMedianContext(payload, event), [payload, event]);
  const products = useMemo(
    () => expanded ? productMovesForBankEvent(core, history, event) : [],
    [core, event, expanded, history],
  );
  const tone = moveTone(event.section, event.avg_bps);
  const ink = tone === 'danger' ? theme.colors.danger : tone === 'success' ? theme.colors.success : theme.colors.textMuted;

  return (
    <View>
      <Pressable
        onPress={() => setExpanded((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={uiJoin(uiProviderName(event), ' · ', uiChartMove(event.section, event.dir), ' · ', uiChartBps(event.avg_bps), ' · ', uiCount(event.moved), ' ', 'products')}
        style={{ minHeight: 48, justifyContent: 'center' }}
      >
        <Row gap={10} style={{ paddingVertical: 8 }}>
          <BankAvatar provider={event.provider} size={30} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText variant="small" weight="700">{uiProviderName(event)}</AppText>
            <AppText variant="tiny" color="textFaint">
              {uiJoin(uiChartMove(event.section, event.dir), ' · ', uiCount(event.moved), '/', uiCount(event.total), ' ', 'products',
                context ? uiJoin(' · ', 'Median', ' ', uiRate(context.before), ' → ', uiRate(context.after)) : null)}
            </AppText>
          </View>
          <AppText variant="small" weight="800" style={{ color: ink }}>{uiChartBps(event.avg_bps)}</AppText>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={theme.colors.textFaint} />
        </Row>
      </Pressable>
      {expanded ? (
        <View style={{ paddingLeft: 40, paddingBottom: 8 }}>
          <AppText variant="tiny" color="textFaint" style={{ marginBottom: 4 }}>
            {uiJoin('Basis', ' · ', 'Published product history', ' · ', 'Eligibility unverified')}
          </AppText>
          {historyError && !history ? (
            <View>
              <AppText variant="tiny" color="danger">
                {uiJoin('History', ' · ', 'Unavailable')}
              </AppText>
              <Pressable
                onPress={onRetryHistory}
                accessibilityRole="button"
                accessibilityLabel="Retry history"
                style={{ minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' }}
              >
                <AppText variant="tiny" color="primary" weight="700">{uiLabel("Retry history")}</AppText>
              </Pressable>
            </View>
          ) : products.length ? products.map((move) => (
            <View key={`${move.productKey}:${move.rateIndex ?? 'all'}`}>
              <Pressable
                disabled={move.rateIndex == null}
                onPress={() => move.rateIndex != null && openProduct(move.productKey, move.rateIndex)}
                accessibilityRole={move.rateIndex != null ? 'button' : undefined}
                accessibilityLabel={move.rateIndex != null ? uiJoin('Open', ' · ', uiProductName({ product_name: move.productName })) : undefined}
                style={{ minHeight: 48, justifyContent: 'center' }}
              >
                <Row gap={8}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <AppText variant="tiny" weight="700">{uiProductName({ product_name: move.productName })}</AppText>
                    <AppText variant="tiny" color="textFaint">
                      {uiJoin(uiRate(move.fromRate), ' → ', uiRate(move.toRate), move.rateIndex == null ? uiJoin(' · ', 'Exact tier unavailable') : null)}
                    </AppText>
                  </View>
                  <AppText variant="tiny" weight="800" style={{ color: moveTone(event.section, move.bps) === 'danger' ? theme.colors.danger : theme.colors.success }}>
                    {uiChartBps(move.bps)}
                  </AppText>
                </Row>
              </Pressable>
            </View>
          )) : (
            <AppText variant="tiny" color="textFaint">
              {uiJoin('History', ' · ', history ? 'No results' : 'Loading')}
            </AppText>
          )}
          <Pressable
            onPress={() => openBank(event.provider, { date: event.date, section: event.section })}
            accessibilityRole="button"
            accessibilityLabel={uiJoin('Open', ' · ', uiProviderName(event))}
            style={{ minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' }}
          >
            <AppText variant="tiny" color="primary" weight="700">{uiLabel("Lender profile")}</AppText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export function PulseDayMovers({ payload, section, date, productHistory, productHistoryError, onRetryProductHistory, core }: {
  payload: BankInsightsPayload | null;
  section: SectionKey;
  date: string;
  productHistory: ProductHistoryPayload | null;
  productHistoryError: string | null;
  onRetryProductHistory: () => void;
  core: CorePayload | null;
}) {
  const events = useMemo(() => eventsOnDate(payload, section, date), [date, payload, section]);
  if (!payload) return <AppText variant="small" color="textMuted">{uiJoin('History', ' · ', 'Unavailable')}</AppText>;
  if (!events.length) return <AppText variant="small" color="textMuted">{uiJoin(uiChartSection(section), ' · ', 'No observations', ' · ', uiDate(date))}</AppText>;
  return (
    <View>
      {events.map((event, index) => (
        <React.Fragment key={`${event.provider}:${event.section}:${event.date}`}>
          {index ? <Divider /> : null}
          <Mover
            event={event}
            payload={payload}
            core={core}
            history={productHistory}
            historyError={productHistoryError}
            onRetryHistory={onRetryProductHistory}
          />
        </React.Fragment>
      ))}
    </View>
  );
}
