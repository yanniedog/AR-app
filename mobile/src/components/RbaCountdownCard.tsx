import Ionicons from './icons/AppIcon';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, Card, Divider, Row } from './ui';
import {
  rbaCalendarCoverage,
  rbaCountdown,
  recentDecisions,
} from '../data/rbaCalendar';
import { useStore } from '../data/store';
import { withAlpha } from '../theme/colors';
import { useTheme } from '../theme/ThemeProvider';
import { uiDate, uiDuration, uiJoin, uiLabel } from '../lib/uiCopy';
import { uiChartBps, uiChartPercent } from '../lib/chartUiCopy';

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
  const meetingDate = unresolved?.date ?? countdown!.meeting.date;
  const hero = unresolved ? uiLabel('Awaiting result') : days <= 0 ? uiLabel('Today')
    : days === 1 ? uiLabel('Tomorrow') : uiDuration(days, 'days');
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
            {uiJoin('RBA', ' · ', 'Next decision')}
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
        {uiDate(meetingDate)}
      </AppText>
    </View>
  );

  return (
    <Card
      variant="outlined"
      accessible={!showDisclosure}
      accessibilityLabel={uiJoin('RBA', ' · ', 'Next decision', ' · ', hero, ' · ', uiDate(meetingDate))}
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
          accessibilityLabel={uiJoin('RBA', ' · ', 'Decisions')}
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
                {uiDate(decision.date)}
              </AppText>
              <AppText variant="small" weight="600">
                {uiJoin(decision.outcome === 'hold' ? uiLabel('Held') : uiChartBps(decision.delta_bps), ' · ', uiChartPercent(decision.rate))}
              </AppText>
            </Row>
          ))}
        </View>
      ) : null}
    </Card>
  );
}
