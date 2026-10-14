import Ionicons from './icons/AppIcon';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, View } from 'react-native';

import {
  bankEventMedianContext,
  marketPulse,
  recentBankEvents,
  topMovers,
  type BankEventRateContext,
  type BankInsightsPayload,
  type BankRateEvent,
} from '../data/bankInsights';
import { uiCount, uiDate, uiDuration, uiJoin, uiLabel, uiProviderName, uiRate, type UiText } from '../lib/uiCopy';
import { uiChartBps, uiChartMove, uiChartSection } from '../lib/chartUiCopy';
import { buildFeedRowRevision } from '../lib/feedRenderEvidence';
import {
  DEPOSIT_SECTIONS,
  LOAN_SECTIONS,
  isLoanSection,
  moveTone,
  type MoveTone,
} from '../lib/moveSemantics';
import { openBank } from '../lib/nav';
import type { SectionKey } from '../types';
import { useTheme } from '../theme/ThemeProvider';
import { BankAvatar } from './BankAvatar';
import { AppText, Badge, Divider, Row } from './ui';

/** Arrow shows the actual direction; colour reflects what it means for the section's customer. */
function MoveArrow({ section, bps, size = 14 }: { section: SectionKey; bps: number; size?: number }) {
  const theme = useTheme();
  if (bps === 0) return null;
  return (
    <Ionicons
      name={bps > 0 ? 'arrow-up' : 'arrow-down'}
      size={size}
      color={moveTone(section, bps) === 'danger' ? theme.colors.danger : theme.colors.success}
    />
  );
}

function toneColor(tone: MoveTone, theme: ReturnType<typeof useTheme>): string {
  return tone === 'danger'
    ? theme.colors.danger
    : tone === 'success'
      ? theme.colors.success
      : theme.colors.textMuted;
}

function eventA11yLabel(event: BankRateEvent, rateCtx: BankEventRateContext | null): UiText {
  return uiJoin(uiProviderName(event), ' · ', uiChartMove(event.section, event.dir), ' · ', uiChartSection(event.section),
    ' · ', 'Average', ' ', uiChartBps(event.avg_bps), ' · ', uiCount(event.moved), '/', uiCount(event.total), ' ', 'products', ' · ', uiDate(event.date),
    rateCtx ? uiJoin(' · ', 'Median', ' ', uiRate(rateCtx.before), ' → ', uiRate(rateCtx.after)) : null);
}

export const BankMoveRow = React.memo(function BankMoveRow({
  event,
  showDate = true,
  rateContext = null,
  focused = false,
  showProductHint = false,
  onSelect,
}: {
  event: BankRateEvent;
  showDate?: boolean;
  /** Optional median before→after context for the move date. */
  rateContext?: BankEventRateContext | null;
  /** Highlight when this row is the drill-down focus. */
  focused?: boolean;
  /** Makes the product drill-down affordance visible, not merely discoverable by tapping. */
  showProductHint?: boolean;
  /** Stable select handler (keeps React.memo effective across parent renders). */
  onSelect?: (event: BankRateEvent) => void;
}) {
  const theme = useTheme();
  const verb = uiChartMove(event.section, event.dir);
  const tone = moveTone(event.section, event.avg_bps);
  return (
    <Pressable
      onPress={
        onSelect
          ? () => onSelect(event)
          : () => openBank(event.provider, { date: event.date, section: event.section })
      }
      accessibilityRole="button"
      accessibilityLabel={eventA11yLabel(event, rateContext)}
    >
      <Row
        gap={10}
        style={{
          paddingVertical: 10,
          paddingHorizontal: focused ? 8 : 0,
          marginHorizontal: focused ? -8 : 0,
          borderRadius: focused ? theme.radius.md : 0,
          backgroundColor: focused ? theme.colors.primaryMuted : undefined,
        }}
      >
        <BankAvatar provider={event.provider} size={34} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="small" weight="700" numberOfLines={1}>
            {uiProviderName(event)}
          </AppText>
          <AppText variant="tiny" color="textFaint" numberOfLines={2}>
            {uiJoin(verb, ' · ', uiChartSection(event.section), ' · ', uiCount(event.moved), '/', uiCount(event.total), ' ', 'products', showDate ? uiJoin(' · ', uiDate(event.date)) : null)}
          </AppText>
          {rateContext ? (
            <AppText variant="tiny" weight="600" numberOfLines={1}>
              {uiJoin('Median', ' ', uiRate(rateContext.before), ' → ', uiRate(rateContext.after))}
            </AppText>
          ) : null}
          {showProductHint ? (
            <AppText variant="tiny" weight="700" style={{ color: theme.colors.primary }}>
              {uiJoin('Changes', ' · ', uiCount(event.moved))}
            </AppText>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <Row gap={4}>
            <MoveArrow section={event.section} bps={event.avg_bps} />
            <AppText variant="small" weight="800" style={{ color: toneColor(tone, theme) }}>
              {uiChartBps(event.avg_bps)}
            </AppText>
          </Row>
          <AppText variant="tiny" color="textFaint">
            {uiJoin('Average', ' · ', 'Movers')}
          </AppText>
        </View>
      </Row>
    </Pressable>
  );
});

/** Headline pulse strip: "4 banks moved this week · 6 loan cuts · 2 savings/TD increases". */
export const MarketPulseStrip = React.memo(function MarketPulseStrip({ payload }: { payload: BankInsightsPayload | null }) {
  const pulse = useMemo(() => marketPulse(payload, 7), [payload]);
  const loanPulse = useMemo(() => marketPulse(payload, 7, LOAN_SECTIONS), [payload]);
  const depositPulse = useMemo(() => marketPulse(payload, 7, DEPOSIT_SECTIONS), [payload]);
  if (!pulse) return null;
  const quiet = pulse.banksMoved === 0;
  return (
    <Row gap={6} style={{ flexWrap: 'wrap' }}>
      <Badge
        label={
          uiJoin('Banks', ' · ', uiCount(pulse.banksMoved), ' · ', uiDuration(7, 'days'))
        }
        tone={quiet ? 'muted' : 'primary'}
      />
      {loanPulse?.cuts ? (
        <Badge label={uiJoin('Home loans', ' · ', 'Cut', ' ', uiCount(loanPulse.cuts))} tone="success" />
      ) : null}
      {loanPulse?.hikes ? (
        <Badge label={uiJoin('Home loans', ' · ', 'Hike', ' ', uiCount(loanPulse.hikes))} tone="danger" />
      ) : null}
      {depositPulse?.hikes ? (
        <Badge
          label={uiJoin('Savings', '/', 'TD', ' · ', 'Increase', ' ', uiCount(depositPulse.hikes))}
          tone="success"
        />
      ) : null}
      {depositPulse?.cuts ? (
        <Badge
          label={uiJoin('Savings', '/', 'TD', ' · ', 'Decrease', ' ', uiCount(depositPulse.cuts))}
          tone="danger"
        />
      ) : null}
    </Row>
  );
});

export const BankMovesFeed = React.memo(function BankMovesFeed({
  payload,
  error,
  sections,
  limit = 8,
  contentRevision,
  onRenderEvidence,
}: {
  payload: BankInsightsPayload | null;
  error?: string | null;
  sections?: SectionKey[];
  limit?: number;
  contentRevision?: string;
  onRenderEvidence?: (evidence: {
    expectedCount: number;
    actualCount: number;
    emptyStateRendered: boolean;
  }) => void;
}) {
  const events = useMemo(
    () => recentBankEvents(payload, { sections, limit }),
    [payload, sections, limit],
  );
  const rows = useMemo(
    () =>
      events.map((event) => ({
        event,
        rateContext: payload ? bankEventMedianContext(payload, event) : null,
      })),
    [events, payload],
  );
  const rowRevision = useMemo(() => buildFeedRowRevision(
    contentRevision ?? payload?.run_date ?? 'no-content-revision',
    events.map((event) => `${event.date}:${event.provider}:${event.section}`),
  ), [contentRevision, events, payload?.run_date]);
  const measuredRows = useRef(new Set<string>());
  useEffect(() => {
    measuredRows.current = new Set();
    if (!payload) return;
    // A keyed row replacement can keep identical native geometry, in which
    // case Android may omit every child onLayout callback. This post-commit
    // signal proves the current React row set rendered; the screen's separate
    // layout probe still verifies that the containing surface reached layout.
    onRenderEvidence?.({
      expectedCount: rows.length,
      actualCount: rows.length,
      emptyStateRendered: rows.length === 0,
    });
  }, [onRenderEvidence, payload, rowRevision, rows.length]);
  const reportRowLayout = useCallback((key: string) => {
    if (measuredRows.current.has(key)) return;
    measuredRows.current.add(key);
    onRenderEvidence?.({
      expectedCount: rows.length,
      actualCount: measuredRows.current.size,
      emptyStateRendered: false,
    });
  }, [onRenderEvidence, rows.length]);
  const reportEmptyLayout = useCallback(() => {
    onRenderEvidence?.({ expectedCount: 0, actualCount: 0, emptyStateRendered: true });
  }, [onRenderEvidence]);
  if (!payload) {
    if (error) return null;
    return (
      <AppText variant="small" color="textMuted">
        {uiLabel("Loading")}</AppText>
    );
  }
  if (!rows.length) {
    return (
      <AppText key={rowRevision} variant="small" color="textMuted" onLayout={reportEmptyLayout}>
        {uiLabel("No observations")}</AppText>
    );
  }
  return (
    <View>
      {rows.map(({ event, rateContext }, i) => {
        const key = `${rowRevision}:${event.date}-${event.provider}-${event.section}-${i}`;
        return (
        <View key={key} onLayout={() => reportRowLayout(key)}>
          {i > 0 ? <Divider /> : null}
          <BankMoveRow event={event} rateContext={rateContext} />
        </View>
        );
      })}
    </View>
  );
});

export const MoversLeaderboard = React.memo(function MoversLeaderboard({
  payload,
  section,
  windowDays = 30,
  perSide = 3,
}: {
  payload: BankInsightsPayload | null;
  section: SectionKey;
  windowDays?: number;
  perSide?: number;
}) {
  const theme = useTheme();
  const movers = useMemo(() => topMovers(payload, section, windowDays), [payload, section, windowDays]);
  const moved = movers.filter((m) => m.netBps !== 0);
  if (!moved.length) {
    return (
      <AppText variant="small" color="textMuted">
        {uiJoin(uiChartSection(section), ' · ', 'No observations', ' · ', uiDuration(windowDays, 'days'))}
      </AppText>
    );
  }
  const loan = isLoanSection(section);
  const downs = moved.filter((m) => m.netBps < 0).slice(0, perSide);
  const positiveMoves = moved.filter((m) => m.netBps > 0);
  const ups = positiveMoves
    .slice(Math.max(0, positiveMoves.length - perSide))
    .reverse();
  // Good news first: cuts for loans, increases for savings/TD.
  const groups = loan
    ? [
        { heading: uiLabel('Cut'), rows: downs },
        { heading: uiLabel('Hike'), rows: ups },
      ]
    : [
        { heading: uiLabel('Increase'), rows: ups },
        { heading: uiLabel('Decrease'), rows: downs },
      ];
  const renderRow = (provider: string, netBps: number, current: number, movedOn: string | null) => {
    const movedLabel = movedOn ? uiDate(movedOn) : uiDuration(windowDays, 'days');
    return (
      <Pressable
        key={provider}
        onPress={() =>
          openBank(provider, movedOn ? { date: movedOn, section } : { section })
        }
        accessibilityRole="button"
        accessibilityLabel={uiJoin(uiProviderName({ provider }), ' · ', uiChartBps(netBps), ' · ', movedLabel, ' · ', uiRate(current))}
      >
        <Row gap={10} style={{ paddingVertical: 6 }}>
          <BankAvatar provider={provider} size={28} />
          <View style={{ flex: 1 }}>
            <AppText variant="small" weight="600" numberOfLines={1}>
              {uiProviderName({ provider })}
            </AppText>
            <AppText variant="tiny" color="textFaint" numberOfLines={1}>
              {uiJoin('Changes', ' · ', movedLabel, ' · ', uiRate(current))}
            </AppText>
          </View>
          <AppText
            variant="small"
            weight="800"
            style={{ color: toneColor(moveTone(section, netBps), theme), minWidth: 64, textAlign: 'right' }}
          >
            {uiChartBps(netBps)}
          </AppText>
        </Row>
      </Pressable>
    );
  };
  return (
    <View>
      {groups.map((group, gi) =>
        group.rows.length ? (
          <React.Fragment key={group.heading}>
            <AppText
              variant="tiny"
              weight="700"
              color="textFaint"
              style={{ marginBottom: 2, marginTop: gi > 0 && groups[0].rows.length ? 8 : 0 }}
            >
              {uiJoin(group.heading, ' · ', uiDuration(windowDays, 'days'))}
            </AppText>
            {group.rows.map((m) => renderRow(m.provider, m.netBps, m.current, m.movedOn))}
          </React.Fragment>
        ) : null,
      )}
    </View>
  );
});
