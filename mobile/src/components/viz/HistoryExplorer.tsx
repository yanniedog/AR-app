import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';

import type { BankInsightsPayload } from '../../data/bankInsights';
import type { BankHistoryChartModel, Brand, HistoryWindow, RbaEntry, SectionKey } from '../../types';
import { SECTIONS } from '../../constants';
import { ChartErrorBoundary } from '../ChartErrorBoundary';
import { AppText, Chip, Row } from '../ui';
import { LenderRaceChart } from './LenderRaceChart';
import { MarketSeismograph } from './MarketSeismograph';
import { RateHeatCalendar } from './RateHeatCalendar';
import { SwitcherEdgeChart } from './SwitcherEdgeChart';

export type HistoryViewMode = 'edge' | 'calendar' | 'pulse' | 'race';

const MODE_META: Record<HistoryViewMode, { label: string; icon: keyof typeof Ionicons.glyphMap; blurb: string }> = {
  edge: { label: 'Spread', icon: 'flash-outline', blurb: 'Best advertised rate versus the median advertised rate row' },
  calendar: { label: 'Calendar', icon: 'calendar-outline', blurb: 'Every day, coloured by which way rates moved' },
  pulse: { label: 'Pulse', icon: 'pulse-outline', blurb: 'Daily rate-move activity across all lenders' },
  race: { label: 'Leaders', icon: 'podium-outline', blurb: "Today's leading rates, traced back through the rankings" },
};

const WINDOW_OPTIONS: HistoryWindow[] = ['30D', '90D', '1Y', 'All'];

/**
 * History explorer: four focused lenses over aggregate and per-bank history.
 * Calendar / spread read section aggregates; leaders / pulse read bank history.
 */
export function HistoryExplorer({
  section,
  historyModel,
  insights,
  insightsAvailable,
  rba,
  rbaHolds,
  brands,
  selectedDate,
  onDateSelect,
}: {
  section: SectionKey;
  historyModel: BankHistoryChartModel | null;
  insights: BankInsightsPayload | null;
  /** Pro bank-intelligence modes are renderable (asset enabled for this user). */
  insightsAvailable: boolean;
  rba: RbaEntry[];
  /** RBA meeting dates the rate was held (rendered as hollow diamonds). */
  rbaHolds?: string[];
  brands?: Record<string, Brand>;
  selectedDate?: string | null;
  onDateSelect?: (date: string) => void;
}) {
  const [mode, setMode] = useState<HistoryViewMode>('edge');
  const [window, setWindow] = useState<HistoryWindow>('90D');

  const modes: HistoryViewMode[] = ['edge', 'calendar', 'pulse', 'race'];
  const activeMode = modes.includes(mode) ? mode : 'edge';
  const needsInsights = activeMode === 'race' || activeMode === 'pulse';
  const showWindowChips = activeMode === 'race' || activeMode === 'pulse';

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
        <Row gap={6}>
          {modes.map((m) => (
            <Chip
              key={m}
              label={MODE_META[m].label}
              icon={MODE_META[m].icon}
              selected={activeMode === m}
              onPress={() => setMode(m)}
            />
          ))}
        </Row>
      </ScrollView>
      <AppText variant="tiny" color="textFaint" style={{ marginBottom: 8 }}>
        {MODE_META[activeMode].blurb}
      </AppText>

      {showWindowChips ? (
        <Row gap={6} style={{ marginBottom: 8, flexWrap: 'wrap' }}>
          {WINDOW_OPTIONS.map((w) => (
            <Chip key={w} label={w} selected={window === w} onPress={() => setWindow(w)} />
          ))}
        </Row>
      ) : null}

      {needsInsights && !insightsAvailable ? (
        <AppText variant="small" color="textMuted">
          This lens uses the per-bank intelligence feed — included with Pro.
        </AppText>
      ) : needsInsights && !insights ? (
        <AppText variant="small" color="textMuted">
          Loading bank intelligence…
        </AppText>
      ) : (
        <>
          {activeMode === 'calendar' && historyModel ? (
            <ChartErrorBoundary name="RateHeatCalendar">
              <RateHeatCalendar
                dates={historyModel.allDates ?? historyModel.dates}
                points={historyModel.points}
                section={section}
                selectedDate={selectedDate}
                onDateSelect={onDateSelect}
              />
            </ChartErrorBoundary>
          ) : null}
          {activeMode === 'race' ? (
            <ChartErrorBoundary name="LenderRaceChart">
              <LenderRaceChart
                payload={insights}
                section={section}
                lowerIsBetter={SECTIONS[section].lowerIsBetter}
                window={window}
                brands={brands}
              />
            </ChartErrorBoundary>
          ) : null}
          {activeMode === 'edge' && historyModel ? (
            <ChartErrorBoundary name="SwitcherEdgeChart">
              <SwitcherEdgeChart
                dates={historyModel.dates}
                points={historyModel.points}
                section={section}
              />
            </ChartErrorBoundary>
          ) : null}
          {activeMode === 'pulse' ? (
            <ChartErrorBoundary name="MarketSeismograph">
              <MarketSeismograph
                payload={insights}
                section={section}
                window={window}
                rba={section === 'Mortgage' ? rba : undefined}
                rbaHolds={section === 'Mortgage' ? rbaHolds : undefined}
                selectedDate={selectedDate}
                onDateSelect={onDateSelect}
              />
            </ChartErrorBoundary>
          ) : null}
          {(activeMode === 'calendar' || activeMode === 'edge') && !historyModel ? (
            <AppText variant="small" color="textMuted">
              History loads after the first refresh with History explorer enabled.
            </AppText>
          ) : null}
        </>
      )}
    </View>
  );
}
