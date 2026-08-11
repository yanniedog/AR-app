import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, Card, Divider, Row } from './ui';
import {
  decisionLine,
  formatRbaDate,
  rbaCalendarCoverage,
  rbaCountdown,
  recentDecisions,
} from '../data/rbaCalendar';
import { useStore } from '../data/store';
import { withAlpha } from '../theme/colors';
import { useTheme } from '../theme/ThemeProvider';

/** Countdown to the next RBA cash-rate decision; tap to reveal recent decisions
 * when expandable. Renders nothing until the rba-calendar asset has synced. */
export function RbaCountdownCard({ expandable = true }: { expandable?: boolean } = {}) {
  const theme = useTheme();
  const calendar = useStore((s) => s.rbaCalendar);
  const ensureRbaCalendar = useStore((s) => s.ensureRbaCalendar);
  const [expanded, setExpanded] = useState(false);
  const countdown = rbaCountdown(calendar);
  const unresolved = rbaCalendarCoverage(calendar).unresolvedMeeting;
  useEffect(() => {
    if (!unresolved) return;
    void ensureRbaCalendar();
    const timer = setInterval(() => void ensureRbaCalendar(), 60_000);
    return () => clearInterval(timer);
  }, [ensureRbaCalendar, unresolved]);
  if (!countdown && !unresolved) return null;
  const days = countdown?.calendarDays ?? 0;
  const when = unresolved
    ? 'today'
    : days <= 0
      ? 'today'
      : days === 1
        ? 'tomorrow'
        : `in ${days} days`;
  const meetingDate = unresolved?.date ?? countdown!.meeting.date;
  const meetingYear = meetingDate.slice(0, 4);
  const hero = unresolved
    ? 'Today'
    : days <= 0
      ? 'Today'
      : days === 1
        ? 'Tomorrow'
        : `${days} days`;
  const recent = recentDecisions(calendar, 4);
  const showDisclosure = expandable && recent.length > 0;

  const header = (
    <View>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={theme.spacing(2)} style={{ flex: 1, minWidth: 0 }}>
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: withAlpha(theme.colors.rba, theme.dark ? 0.2 : 0.12),
            }}
          >
            <Ionicons name="business-outline" size={19} color={theme.colors.rba} />
          </View>
          <AppText
            variant="small"
            weight="800"
            style={{ color: theme.colors.rba, letterSpacing: 0.7, flexShrink: 1 }}
          >
            {unresolved ? 'RBA DECISION TODAY' : 'NEXT RBA DECISION'}
          </AppText>
        </Row>
        {showDisclosure ? (
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={theme.colors.textFaint}
          />
        ) : null}
      </Row>
      <AppText
        variant="rateHero"
        style={{ color: theme.colors.text, marginTop: theme.spacing(4) }}
      >
        {hero}
      </AppText>
      <AppText variant="body" weight="700" style={{ marginTop: theme.spacing(1) }}>
        {formatRbaDate(meetingDate)} {meetingYear}
      </AppText>
      <AppText variant="small" color="textMuted" style={{ marginTop: theme.spacing(1) }}>
        {`Scheduled announcement · ${when}`}
      </AppText>
    </View>
  );

  return (
    <Card
      variant="outlined"
      accessible={!showDisclosure}
      accessibilityLabel={
        unresolved
          ? `RBA decision today, ${formatRbaDate(meetingDate)} ${meetingYear}.`
          : `Next RBA decision ${hero}, ${formatRbaDate(meetingDate)} ${meetingYear}.`
      }
      style={{
        padding: theme.spacing(5),
        borderWidth: 2,
        borderColor: withAlpha(theme.colors.rba, 0.72),
        backgroundColor: withAlpha(theme.colors.rba, theme.dark ? 0.1 : 0.07),
      }}
    >
      {showDisclosure ? (
        <Pressable
          onPress={() => setExpanded((value) => !value)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityHint={expanded ? 'Hide recent RBA decisions' : 'Show recent RBA decisions'}
        >
          {header}
        </Pressable>
      ) : (
        header
      )}
      {expanded && showDisclosure ? (
        <View style={{ marginTop: theme.spacing(3) }}>
          <Divider />
          {recent.map((decision) => (
            <Row
              key={decision.date}
              style={{ justifyContent: 'space-between', marginTop: theme.spacing(2) }}
            >
              <AppText variant="small" color="textMuted">
                {formatRbaDate(decision.date)}
              </AppText>
              <AppText variant="small" weight="600">
                {decisionLine(decision)}
              </AppText>
            </Row>
          ))}
        </View>
      ) : null}
    </Card>
  );
}
