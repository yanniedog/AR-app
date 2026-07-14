import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { SECTIONS } from '../constants';
import {
  daysVsPeerMedian,
  filterPassThroughRows,
  marketPulse,
  PASS_THROUGH_METHODOLOGY,
  passThroughDaysLabel,
  passThroughPeerBenchmark,
  passThroughSectionOptions,
  rbaPassThrough,
  rbaPassThroughDecisionList,
  rbaPassThroughLeague,
  recentBankEvents,
  topMovers,
  type BankInsightsPayload,
  type BankRateEvent,
  type PassThroughFilter,
  type PassThroughLeagueConsistency,
  type PassThroughRow,
  type RbaDecisionRef,
} from '../data/bankInsights';
import { formatRate, formatRunDate } from '../data/format';
import type { RbaCalendar } from '../data/rbaCalendar';
import { passThroughA11ySummary } from '../lib/a11ySummaries';
import {
  DEPOSIT_SECTIONS,
  LOAN_SECTIONS,
  isLoanSection,
  moveTone,
  moveVerb,
  type MoveTone,
} from '../lib/moveSemantics';
import { openBank } from '../lib/nav';
import type { RbaEntry, SectionKey } from '../types';
import { useTheme } from '../theme/ThemeProvider';
import { BankAvatar } from './BankAvatar';
import { SegmentedControl } from './controls';
import { AppText, Badge, Button, Chip, Divider, Row } from './ui';

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

function eventA11yLabel(event: BankRateEvent): string {
  const verb = moveVerb(event.section, event.dir);
  return `${event.provider} ${verb} ${SECTIONS[event.section].title} rates by ${bpsLabel(
    event.avg_bps,
  )} across ${event.moved} of ${event.total} products on ${formatRunDate(event.date)}`;
}

export function BankMoveRow({ event, showDate = true }: { event: BankRateEvent; showDate?: boolean }) {
  const theme = useTheme();
  const verb = moveVerb(event.section, event.dir);
  return (
    <Pressable
      onPress={() => openBank(event.provider)}
      accessibilityRole="button"
      accessibilityLabel={eventA11yLabel(event)}
    >
      <Row gap={10} style={{ paddingVertical: 8 }}>
        <BankAvatar provider={event.provider} size={34} />
        <View style={{ flex: 1 }}>
          <AppText variant="small" weight="700" numberOfLines={1}>
            {event.provider}
          </AppText>
          <AppText variant="tiny" color="textFaint" numberOfLines={1}>
            {verb} {SECTIONS[event.section].short.toLowerCase()} · {event.moved} of {event.total} products
            {showDate ? ` · ${formatRunDate(event.date)}` : ''}
          </AppText>
        </View>
        <Row gap={4}>
          <MoveArrow section={event.section} bps={event.avg_bps} />
          <AppText
            variant="small"
            weight="800"
            style={{ color: toneColor(moveTone(event.section, event.avg_bps), theme) }}
          >
            {bpsLabel(event.avg_bps)}
          </AppText>
        </Row>
      </Row>
    </Pressable>
  );
}

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
  if (!payload) {
    if (error) return null;
    return (
      <AppText variant="small" color="textMuted">
        Loading bank intelligence…
      </AppText>
    );
  }
  if (!events.length) {
    return (
      <AppText variant="small" color="textMuted">
        No rate moves detected yet — the feed fills as banks reprice day by day.
      </AppText>
    );
  }
  return (
    <View>
      {events.map((event, i) => (
        <React.Fragment key={`${event.date}-${event.provider}-${event.section}`}>
          {i > 0 ? <Divider /> : null}
          <BankMoveRow event={event} />
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
  const renderRow = (provider: string, netBps: number, current: number) => (
    <Pressable
      key={provider}
      onPress={() => openBank(provider)}
      accessibilityRole="button"
      accessibilityLabel={`${provider}, net ${bpsLabel(netBps)} over ${windowDays} days, now ${formatRate(current)}`}
    >
      <Row gap={10} style={{ paddingVertical: 6 }}>
        <BankAvatar provider={provider} size={28} />
        <AppText variant="small" weight="600" numberOfLines={1} style={{ flex: 1 }}>
          {provider}
        </AppText>
        <AppText variant="tiny" color="textFaint">
          now {formatRate(current)}
        </AppText>
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
            {group.rows.map((m) => renderRow(m.provider, m.netBps, m.current))}
          </React.Fragment>
        ) : null,
      )}
    </View>
  );
}

function decisionChipLabel(d: RbaDecisionRef): string {
  const mag = `${d.bps > 0 ? '+' : '−'}${Math.abs(d.bps)}`;
  return `${formatRunDate(d.date)} · ${mag}`;
}

function consistencyTone(
  c: PassThroughLeagueConsistency,
): 'success' | 'warning' | 'danger' | 'muted' | 'primary' {
  if (c === 'reliable') return 'success';
  if (c === 'slow') return 'primary';
  if (c === 'mixed') return 'warning';
  if (c === 'holdout') return 'danger';
  return 'muted';
}

function consistencyLabel(c: PassThroughLeagueConsistency): string {
  if (c === 'reliable') return 'reliable';
  if (c === 'slow') return 'full but slow';
  if (c === 'mixed') return 'mixed';
  if (c === 'holdout') return 'often holds';
  return 'thin sample';
}

function passRowA11y(
  row: PassThroughRow,
  dayOpts: { partialObservation: boolean; windowOpen: boolean },
  peerMedianDays: number | null,
): string {
  if (row.passStatus === 'none') {
    return `${row.provider}: ${passThroughDaysLabel(null, dayOpts)}`;
  }
  const vsPeer = daysVsPeerMedian(row.daysToFirstMove, peerMedianDays);
  const peerBit =
    vsPeer == null
      ? ''
      : vsPeer === 0
        ? ', at peer median speed'
        : vsPeer < 0
          ? `, ${Math.abs(vsPeer)} days faster than peer median`
          : `, ${vsPeer} days slower than peer median`;
  return `${row.provider} passed ${bpsLabel(row.passedBps)}, ${passThroughDaysLabel(
    row.daysToFirstMove,
    dayOpts,
  )}${peerBit}`;
}

const FILTER_OPTIONS: { key: PassThroughFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'full', label: 'Full' },
  { key: 'partial', label: 'Partial' },
  { key: 'none', label: 'None' },
  { key: 'fast', label: '≤7d' },
];

export function RbaPassThroughCard({
  payload,
  rba,
  calendar = null,
  maxRows = 6,
}: {
  payload: BankInsightsPayload | null;
  rba: RbaEntry[];
  calendar?: RbaCalendar | null;
  maxRows?: number;
}) {
  const theme = useTheme();
  const sectionOptions = useMemo(() => passThroughSectionOptions(payload), [payload]);
  const availableSections = useMemo(
    () => sectionOptions.map((o) => o.value),
    [sectionOptions],
  );
  const [section, setSection] = useState<SectionKey>('Mortgage');
  const activeSection = availableSections.includes(section)
    ? section
    : availableSections[0] ?? 'Mortgage';

  const decisions = useMemo(
    () => rbaPassThroughDecisionList(payload, rba, { calendar, section: activeSection }),
    [payload, rba, calendar, activeSection],
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [filter, setFilter] = useState<PassThroughFilter>('all');
  const [expanded, setExpanded] = useState(false);
  const [leagueExpanded, setLeagueExpanded] = useState(false);
  const [showLeague, setShowLeague] = useState(false);
  const [showMethod, setShowMethod] = useState(false);

  const handleSectionChange = (next: SectionKey) => {
    setSection(next);
    setFilter('all');
    setExpanded(false);
    setLeagueExpanded(false);
  };

  const activeDate =
    selectedDate && decisions.some((d) => d.date === selectedDate)
      ? selectedDate
      : decisions[0]?.date;
  const model = useMemo(
    () =>
      rbaPassThrough(payload, rba, {
        calendar,
        decisionDate: activeDate,
        section: activeSection,
      }),
    [payload, rba, calendar, activeDate, activeSection],
  );
  const league = useMemo(
    () => rbaPassThroughLeague(payload, rba, { calendar, section: activeSection }),
    [payload, rba, calendar, activeSection],
  );
  const peer = useMemo(
    () => (model ? passThroughPeerBenchmark(model.rows) : null),
    [model],
  );

  if (!decisions.length) {
    return (
      <AppText variant="small" color="textMuted">
        No RBA hike or cut has a response window overlapping the tracked bank history yet. When
        the next cash-rate move lands, lenders will be scored here against that decision.
      </AppText>
    );
  }

  if (!model || !peer) {
    return (
      <View style={{ gap: 8 }}>
        {sectionOptions.length > 1 ? (
          <SegmentedControl
            options={sectionOptions}
            value={activeSection}
            onChange={handleSectionChange}
          />
        ) : null}
        <AppText variant="small" color="textMuted">
          No {SECTIONS[activeSection].short.toLowerCase()} lenders are observable for this RBA
          decision in the tracked history yet. Try another product section, or wait for the next
          ingest once banks publish rates in this category.
        </AppText>
      </View>
    );
  }

  const { decision, rows, windowDays, windowEnd, windowOpen, observedThrough } = model;
  const dirWord = decision.bps < 0 ? 'cut' : 'raised';
  const filtered = filterPassThroughRows(rows, filter);
  const limit = expanded ? filtered.length : maxRows;
  const shown = filtered.slice(0, limit);
  const dayOpts = { partialObservation: decision.partialObservation, windowOpen };
  const sectionTitle = SECTIONS[activeSection].title;
  const leagueShown = showLeague ? league.slice(0, leagueExpanded ? 20 : 8) : [];

  return (
    <View>
      {sectionOptions.length > 1 ? (
        <View style={{ marginBottom: 10 }}>
          <SegmentedControl
            options={sectionOptions}
            value={activeSection}
            onChange={handleSectionChange}
          />
        </View>
      ) : null}

      {decisions.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          <Row gap={6}>
            {decisions.map((d) => (
              <Chip
                key={d.date}
                label={decisionChipLabel(d)}
                selected={d.date === decision.date}
                onPress={() => {
                  setSelectedDate(d.date);
                  setExpanded(false);
                  setLeagueExpanded(false);
                }}
              />
            ))}
          </Row>
        </ScrollView>
      ) : null}

      <AppText
        variant="small"
        color="textMuted"
        style={{ marginBottom: 4 }}
        accessibilityLabel={passThroughA11ySummary(model)}
      >
        RBA {dirWord} the cash rate by {Math.abs(decision.bps)} bps
        {decision.rate != null ? ` to ${decision.rate.toFixed(2)}%` : ''}.{' '}
        {sectionTitle} pass-through in the {windowDays}-day response window
        {windowOpen
          ? ` (open through ${formatRunDate(windowEnd)}; observed to ${formatRunDate(observedThrough)})`
          : ` (closed ${formatRunDate(windowEnd)})`}
        .
      </AppText>
      <AppText variant="tiny" color="textFaint" style={{ marginBottom: 6 }}>
        Announced {formatRunDate(decision.date)}
        {decision.effective
          ? ` · cash rate effective ${formatRunDate(decision.effective)}`
          : ' · effective date not in calendar payload'}
        {decision.partialObservation ? ' · partial observation (pre-ledger announcement)' : ''}
      </AppText>
      {windowOpen ? (
        <AppText variant="tiny" color="textFaint" style={{ marginBottom: 6 }}>
          Response window still open — lenders with no move yet may still pass the change through.
        </AppText>
      ) : null}

      <Row gap={6} style={{ flexWrap: 'wrap', marginBottom: 8 }}>
        <Badge
          label={`${peer.fullOrOver} full pass${peer.fullOrOver === 1 ? '' : 'es'}`}
          tone="success"
        />
        {peer.partial ? <Badge label={`${peer.partial} partial`} tone="warning" /> : null}
        <Badge label={`${peer.movers} moved`} tone="primary" />
        {peer.none ? (
          <Badge
            label={windowOpen ? `${peer.none} waiting` : `${peer.none} no move`}
            tone="warning"
          />
        ) : null}
        {peer.medianDaysToMove != null ? (
          <Badge
            label={`peer median ${decision.partialObservation ? '≤' : ''}${peer.medianDaysToMove}d`}
            tone="muted"
          />
        ) : null}
        {peer.medianRatio != null ? (
          <Badge label={`peer median ${Math.round(peer.medianRatio * 100)}% pass`} tone="muted" />
        ) : null}
      </Row>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
        <Row gap={6}>
          {FILTER_OPTIONS.map((opt) => (
            <Chip
              key={opt.key}
              label={opt.label}
              selected={filter === opt.key}
              onPress={() => {
                setFilter(opt.key);
                setExpanded(false);
                setLeagueExpanded(false);
              }}
            />
          ))}
        </Row>
      </ScrollView>

      {!filtered.length ? (
        <AppText variant="small" color="textMuted" style={{ marginBottom: 8 }}>
          No lenders match this filter for {SECTIONS[activeSection].short.toLowerCase()} on this
          decision.
        </AppText>
      ) : (
        shown.map((row) => {
          const vsPeer = daysVsPeerMedian(row.daysToFirstMove, peer.medianDaysToMove);
          return (
            <Pressable
              key={row.provider}
              onPress={() => openBank(row.provider)}
              accessibilityRole="button"
              accessibilityLabel={passRowA11y(row, dayOpts, peer.medianDaysToMove)}
            >
              <Row gap={10} style={{ paddingVertical: 6 }}>
                <BankAvatar provider={row.provider} size={28} />
                <View style={{ flex: 1 }}>
                  <AppText variant="small" weight="600" numberOfLines={1}>
                    {row.provider}
                  </AppText>
                  <AppText variant="tiny" color="textFaint">
                    {passThroughDaysLabel(row.daysToFirstMove, dayOpts)}
                    {vsPeer != null && vsPeer !== 0
                      ? ` · ${vsPeer < 0 ? `${Math.abs(vsPeer)}d faster` : `${vsPeer}d slower`} than peers`
                      : ''}
                  </AppText>
                </View>
                {row.passStatus === 'full' || row.passStatus === 'over' ? (
                  <Badge
                    label={row.passStatus === 'over' ? 'over-pass' : 'full pass'}
                    tone="success"
                  />
                ) : null}
                {row.passStatus === 'partial' ? <Badge label="partial" tone="warning" /> : null}
                {row.passStatus === 'none' ? (
                  <Badge label={windowOpen ? 'waiting' : 'no move'} tone="muted" />
                ) : null}
                <AppText
                  variant="small"
                  weight="800"
                  style={{
                    color:
                      row.passedBps === 0
                        ? theme.colors.textMuted
                        : row.passedBps > 0
                          ? theme.colors.danger
                          : theme.colors.success,
                    minWidth: 64,
                    textAlign: 'right',
                  }}
                >
                  {bpsLabel(row.passedBps)}
                </AppText>
              </Row>
            </Pressable>
          );
        })
      )}

      {filtered.length > maxRows ? (
        <Button
          title={
            expanded
              ? 'Show fewer lenders'
              : `Show all ${filtered.length} lenders`
          }
          variant="ghost"
          onPress={() => setExpanded((v) => !v)}
        />
      ) : filtered.length > 0 && filtered.length < rows.length ? (
        <AppText variant="tiny" color="textFaint" style={{ marginTop: 4 }}>
          Showing {filtered.length} of {rows.length} lenders (filter applied; full and fastest first).
        </AppText>
      ) : null}

      {league.length > 1 ? (
        <View style={{ marginTop: 10 }}>
          <Button
            title={showLeague ? 'Hide multi-decision league' : 'Multi-decision league table'}
            variant="ghost"
            icon="trophy"
            onPress={() => setShowLeague((v) => !v)}
          />
          {showLeague ? (
            <View style={{ marginTop: 4 }}>
              <AppText variant="tiny" color="textFaint" style={{ marginBottom: 6 }}>
                Ranked across {decisions.length} scorable RBA moves for{' '}
                {SECTIONS[activeSection].short.toLowerCase()} — higher full-pass share, fewer
                holdouts, then larger sample and faster median first move.
              </AppText>
              {leagueShown.map((row) => (
                <Pressable
                  key={row.provider}
                  onPress={() => openBank(row.provider)}
                  accessibilityRole="button"
                  accessibilityLabel={`${row.provider}: ${row.fullOrOver} full of ${row.decisionsScored} decisions, ${consistencyLabel(row.consistency)}`}
                >
                  <Row gap={10} style={{ paddingVertical: 6 }}>
                    <BankAvatar provider={row.provider} size={26} />
                    <View style={{ flex: 1 }}>
                      <AppText variant="small" weight="600" numberOfLines={1}>
                        {row.provider}
                      </AppText>
                      <AppText variant="tiny" color="textFaint">
                        {row.fullOrOver}/{row.decisionsScored} full
                        {row.partial ? ` · ${row.partial} partial` : ''}
                        {row.none ? ` · ${row.none} none` : ''}
                        {row.medianDays != null ? ` · median ${row.medianDays}d` : ''}
                      </AppText>
                    </View>
                    <Badge
                      label={consistencyLabel(row.consistency)}
                      tone={consistencyTone(row.consistency)}
                    />
                  </Row>
                </Pressable>
              ))}
              {league.length > 8 ? (
                <View style={{ gap: 4, marginTop: 4 }}>
                  {league.length > leagueShown.length ? (
                    <AppText variant="tiny" color="textFaint">
                      Showing {leagueShown.length} of {league.length} lenders.
                    </AppText>
                  ) : null}
                  <Button
                    title={
                      leagueExpanded
                        ? 'Show fewer lenders'
                        : `Show all ${league.length} lenders`
                    }
                    variant="ghost"
                    onPress={() => setLeagueExpanded((v) => !v)}
                  />
                </View>
              ) : league.length > leagueShown.length ? (
                <AppText variant="tiny" color="textFaint">
                  Showing {leagueShown.length} of {league.length} lenders.
                </AppText>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={{ marginTop: 6 }}>
        <Button
          title={showMethod ? 'Hide methodology' : 'How scoring works'}
          variant="ghost"
          icon="information-circle-outline"
          onPress={() => setShowMethod((v) => !v)}
        />
        {showMethod ? (
          <View style={{ marginTop: 4, gap: 4 }}>
            {PASS_THROUGH_METHODOLOGY.map((line) => (
              <AppText key={line} variant="tiny" color="textFaint">
                • {line}
              </AppText>
            ))}
          </View>
        ) : null}
      </View>
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
