import Ionicons from './icons/AppIcon';
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { SECTIONS } from '../constants';
import { bankEventMedianContext, eventsOnDate, type BankInsightsPayload, type BankRateEvent } from '../data/bankInsights';
import { formatRate, formatRunDate } from '../data/format';
import { productMovesForBankEvent, type ProductHistoryPayload } from '../data/productHistory';
import { moveTone, moveVerb } from '../lib/moveSemantics';
import { openBank, openProduct } from '../lib/nav';
import type { CorePayload, SectionKey } from '../types';
import { useTheme } from '../theme/ThemeProvider';
import { BankAvatar } from './BankAvatar';
import { AppText, Divider, Row } from './ui';

function bpsLabel(value: number): string {
  const bps = Math.round(value * 10) / 10;
  return `${bps > 0 ? '+' : bps < 0 ? '−' : ''}${Math.abs(bps)} bps`;
}

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
        accessibilityLabel={`${event.provider} ${moveVerb(event.section, event.dir)} by ${bpsLabel(event.avg_bps)} across ${event.moved} products. ${expanded ? 'Collapse' : 'Expand'} details.`}
        style={{ minHeight: 48, justifyContent: 'center' }}
      >
        <Row gap={10} style={{ paddingVertical: 8 }}>
          <BankAvatar provider={event.provider} size={30} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText variant="small" weight="700">{event.provider}</AppText>
            <AppText variant="tiny" color="textFaint">
              {moveVerb(event.section, event.dir)} · {event.moved} of {event.total} products
              {context ? ` · median ${formatRate(context.before)} → ${formatRate(context.after)}` : ''}
            </AppText>
          </View>
          <AppText variant="small" weight="800" style={{ color: ink }}>{bpsLabel(event.avg_bps)}</AppText>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={theme.colors.textFaint} />
        </Row>
      </Pressable>
      {expanded ? (
        <View style={{ paddingLeft: 40, paddingBottom: 8 }}>
          <AppText variant="tiny" color="textFaint" style={{ marginBottom: 4 }}>
            Published product movements. Exact tier history may vary.
          </AppText>
          {historyError && !history ? (
            <View>
              <AppText variant="tiny" color="danger">
                Product history could not be refreshed. Previously downloaded rates are unchanged.
              </AppText>
              <Pressable
                onPress={onRetryHistory}
                accessibilityRole="button"
                accessibilityLabel="Retry product history"
                style={{ minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' }}
              >
                <AppText variant="tiny" color="primary" weight="700">Retry history</AppText>
              </Pressable>
            </View>
          ) : products.length ? products.map((move) => (
            <View key={`${move.productKey}:${move.rateIndex ?? 'all'}`}>
              <Pressable
                disabled={move.rateIndex == null}
                onPress={() => move.rateIndex != null && openProduct(move.productKey, move.rateIndex)}
                accessibilityRole={move.rateIndex != null ? 'button' : undefined}
                accessibilityLabel={move.rateIndex != null ? `Open ${move.productName}, current matching rate record` : undefined}
                style={{ minHeight: 48, justifyContent: 'center' }}
              >
                <Row gap={8}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <AppText variant="tiny" weight="700">{move.productName}</AppText>
                    <AppText variant="tiny" color="textFaint">
                      {formatRate(move.fromRate)} → {formatRate(move.toRate)}
                      {move.rateIndex == null ? ' · exact current tier unavailable' : ''}
                    </AppText>
                  </View>
                  <AppText variant="tiny" weight="800" style={{ color: moveTone(event.section, move.bps) === 'danger' ? theme.colors.danger : theme.colors.success }}>
                    {bpsLabel(move.bps)}
                  </AppText>
                </Row>
              </Pressable>
            </View>
          )) : (
            <AppText variant="tiny" color="textFaint">
              {history ? 'No product changes found in the available history.' : 'Loading product history…'}
            </AppText>
          )}
          <Pressable
            onPress={() => openBank(event.provider, { date: event.date, section: event.section })}
            accessibilityRole="button"
            accessibilityLabel={`Open ${event.provider} lender profile`}
            style={{ minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' }}
          >
            <AppText variant="tiny" color="primary" weight="700">Lender profile</AppText>
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
  if (!payload) return <AppText variant="small" color="textMuted">Lender detail needs the bank intelligence feed.</AppText>;
  if (!events.length) return <AppText variant="small" color="textMuted">No {SECTIONS[section].short.toLowerCase()} lender moves on {formatRunDate(date)}.</AppText>;
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
