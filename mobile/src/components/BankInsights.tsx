import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { SECTIONS } from '../constants';
import {
  bankEventMedianContext,
  marketPulse,
  recentBankEvents,
  topMovers,
  type BankEventRateContext,
  type BankInsightsPayload,
  type BankRateEvent,
} from '../data/bankInsights';
import { formatRate, formatRunDate } from '../data/format';
import {
  DEPOSIT_SECTIONS,
  LOAN_SECTIONS,
  isLoanSection,
  moveTone,
  moveVerb,
  type MoveTone,
} from '../lib/moveSemantics';
import { openBank } from '../lib/nav';
import type { SectionKey } from '../types';
import { useTheme } from '../theme/ThemeProvider';
import { BankAvatar } from './BankAvatar';
import { AppText, Badge, Button, Divider, Row } from './ui';

function bpsLabel(bps: number): string {
  const rounded = Math.round(bps * 10) / 10;
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${Math.abs(rounded)} bps`;
}

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

function eventA11yLabel(event: BankRateEvent, rateCtx: BankEventRateContext | null): string {
  const verb = moveVerb(event.section, event.dir);
  const rateBit = rateCtx
    ? `, median ${formatRate(rateCtx.before)} to ${formatRate(rateCtx.after)}`
    : '';
  return `${event.provider} ${verb} ${SECTIONS[event.section].title} rates by average ${bpsLabel(
    event.avg_bps,
  )} across ${event.moved} of ${event.total} products on ${formatRunDate(event.date)}${rateBit}`;
}

export const BankMoveRow = React.memo(function BankMoveRow({
  event,
  showDate = true,
  rateContext = null,
  focused = false,
  onPress,
}: {
  event: BankRateEvent;
  showDate?: boolean;
  /** Optional median before→after context for the move date. */
  rateContext?: BankEventRateContext | null;
  /** Highlight when this row is the drill-down focus. */
  focused?: boolean;
  /** Override navigation (e.g. already on the bank page). */
  onPress?: () => void;
}) {
  const theme = useTheme();
  const verb = moveVerb(event.section, event.dir);
  const tone = moveTone(event.section, event.avg_bps);
  return (
    <Pressable
      onPress={
        onPress ??
        (() => openBank(event.provider, { date: event.date, section: event.section }))
      }
      accessibilityRole="button"
      accessibilityLabel={eventA11yLabel(event, rateContext)}
      accessibilityHint="Shows which products moved and by how much"
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
            {event.provider}
          </AppText>
          <AppText variant="tiny" color="textFaint" numberOfLines={2}>
            {verb} {SECTIONS[event.section].short.toLowerCase()} · {event.moved} of {event.total}{' '}
            products
            {showDate ? ` · ${formatRunDate(event.date)}` : ''}
          </AppText>
          {rateContext ? (
            <AppText variant="tiny" weight="600" numberOfLines={1}>
              Median {formatRate(rateContext.before)} → {formatRate(rateContext.after)}
            </AppText>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <Row gap={4}>
            <MoveArrow section={event.section} bps={event.avg_bps} />
            <AppText variant="small" weight="800" style={{ color: toneColor(tone, theme) }}>
              {bpsLabel(event.avg_bps)}
            </AppText>
          </Row>
          <AppText variant="tiny" color="textFaint">
            avg across movers
          </AppText>
        </View>
      </Row>
    </Pressable>
  );
});

/** Headline pulse strip: "4 banks moved this week · 6 loan cuts · 2 savings/TD increases". */
export function MarketPulseStrip({ payload }: { payload: BankInsightsPayload | null }) {
  const pulse = useMemo(() => marketPulse(payload, 7), [payload]);
  const loanPulse = useMemo(() => marketPulse(payload, 7, LOAN_SECTIONS), [payload]);
  const depositPulse = useMemo(() => marketPulse(payload, 7, DEPOSIT_SECTIONS), [payload]);
  if (!pulse) return null;
  const quiet = pulse.banksMoved === 0;
  return (
    <Row gap={6} style={{ flexWrap: 'wrap' }}>
      <Badge
        label={
          quiet
            ? 'No bank rate moves this week'
            : `${pulse.banksMoved} bank${pulse.banksMoved === 1 ? '' : 's'} moved this week`
        }
        tone={quiet ? 'muted' : 'primary'}
      />
      {loanPulse?.cuts ? (
        <Badge label={`${loanPulse.cuts} loan ${loanPulse.cuts === 1 ? 'cut' : 'cuts'}`} tone="success" />
      ) : null}
      {loanPulse?.hikes ? (
        <Badge label={`${loanPulse.hikes} loan ${loanPulse.hikes === 1 ? 'hike' : 'hikes'}`} tone="danger" />
      ) : null}
      {depositPulse?.hikes ? (
        <Badge
          label={`${depositPulse.hikes} savings/TD ${depositPulse.hikes === 1 ? 'increase' : 'increases'}`}
          tone="success"
        />
      ) : null}
      {depositPulse?.cuts ? (
        <Badge
          label={`${depositPulse.cuts} savings/TD ${depositPulse.cuts === 1 ? 'decrease' : 'decreases'}`}
          tone="danger"
        />
      ) : null}
    </Row>
  );
}

export function BankMovesFeed({
  payload,
  error,
  sections,
  limit = 8,
}: {
  payload: BankInsightsPayload | null;
  error?: string | null;
  sections?: SectionKey[];
  limit?: number;
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
  if (!payload) {
    if (error) return null;
    return (
      <AppText variant="small" color="textMuted">
        Loading bank intelligence…
      </AppText>
    );
  }
  if (!rows.length) {
    return (
      <AppText variant="small" color="textMuted">
        No rate moves detected yet — the feed fills as banks reprice day by day.
      </AppText>
    );
  }
  return (
    <View>
      {rows.map(({ event, rateContext }, i) => (
        <React.Fragment key={`${event.date}-${event.provider}-${event.section}`}>
          {i > 0 ? <Divider /> : null}
          <BankMoveRow event={event} rateContext={rateContext} />
        </React.Fragment>
      ))}
    </View>
  );
}

export function MoversLeaderboard({
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
        No {SECTIONS[section].short.toLowerCase()} median moves in the last {windowDays} days.
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
        { heading: 'BIGGEST CUTS', rows: downs },
        { heading: 'BIGGEST HIKES', rows: ups },
      ]
    : [
        { heading: 'BIGGEST INCREASES', rows: ups },
        { heading: 'BIGGEST DECREASES', rows: downs },
      ];
  const renderRow = (provider: string, netBps: number, current: number, movedOn: string | null) => {
    const movedLabel = movedOn ? formatRunDate(movedOn) : `last ${windowDays}d`;
    return (
      <Pressable
        key={provider}
        onPress={() =>
          openBank(provider, movedOn ? { date: movedOn, section } : { section })
        }
        accessibilityRole="button"
        accessibilityLabel={`${provider}, net ${bpsLabel(netBps)} on ${movedLabel}, now ${formatRate(current)}`}
      >
        <Row gap={10} style={{ paddingVertical: 6 }}>
          <BankAvatar provider={provider} size={28} />
          <View style={{ flex: 1 }}>
            <AppText variant="small" weight="600" numberOfLines={1}>
              {provider}
            </AppText>
            <AppText variant="tiny" color="textFaint" numberOfLines={1}>
              {movedOn ? `Moved ${movedLabel}` : `Over ${windowDays} days`}
              {' · '}now {formatRate(current)}
            </AppText>
          </View>
          <AppText
            variant="small"
            weight="800"
            style={{ color: toneColor(moveTone(section, netBps), theme), minWidth: 64, textAlign: 'right' }}
          >
            {bpsLabel(netBps)}
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
              {group.heading} · {windowDays}D
            </AppText>
            {group.rows.map((m) => renderRow(m.provider, m.netBps, m.current, m.movedOn))}
          </React.Fragment>
        ) : null,
      )}
    </View>
  );
}

/** Free-tier teaser: sells the historical moat without downloading anything. */
export function InsightsLockedCard({ onUnlock }: { onUnlock: () => void }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 10 }}>
      <Row gap={8}>
        <Ionicons name="pulse" size={18} color={theme.colors.primary} />
        <AppText variant="body" weight="700" style={{ flex: 1 }}>
          Bank intelligence
        </AppText>
        <Badge label="PRO" tone="primary" />
      </Row>
      <AppText variant="small" color="textMuted">
        Everyone shows today's rates. Only Australian Rates tracks every bank, every day — see who
        moved rates which way, who drags their feet after RBA decisions, and how each lender's
        rates moved over time.
      </AppText>
      <Button title="Unlock bank intelligence" icon="sparkles" onPress={onUnlock} />
    </View>
  );
}
