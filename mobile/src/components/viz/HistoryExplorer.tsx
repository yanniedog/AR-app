import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useState } from 'react';
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
  standardOnly,
  standardFilterWarming,
  rba,
  rbaHolds,
  brands,
  selectedDate,
  onDateSelect,
  mode: controlledMode,
  onModeChange,
}: {
  section: SectionKey;
  historyModel: BankHistoryChartModel | null;
  insights: BankInsightsPayload | null;
  /** Pro bank-intelligence modes are renderable (asset enabled for this user). */
  insightsAvailable: boolean;
  /** The shared suitability gate is excluding non-standard products. */
  standardOnly?: boolean;
  /** A replacement ingest is still rebuilding the exact product suitability index. */
  standardFilterWarming?: boolean;
  rba: RbaEntry[];
  /** RBA meeting dates the rate was held (rendered as hollow diamonds). */
  rbaHolds?: string[];
  brands?: Record<string, Brand>;
  selectedDate?: string | null;
  onDateSelect?: (date: string | null) => void;
  mode?: HistoryViewMode;
  onModeChange?: (mode: HistoryViewMode) => void;
}) {
  const [localMode, setLocalMode] = useState<HistoryViewMode>(controlledMode ?? 'edge');
  const [window, setWindow] = useState<HistoryWindow>('90D');

  useEffect(() => {
    if (controlledMode) setLocalMode(controlledMode);
  }, [controlledMode]);

  const setMode = (next: HistoryViewMode) => {
    setLocalMode(next);
    onModeChange?.(next);
  };

  const modes: HistoryViewMode[] = ['edge', 'calendar', 'pulse', 'race'];
  const activeMode = modes.includes(localMode) ? localMode : 'edge';
  const needsInsights = activeMode === 'race' || activeMode === 'pulse';
  const showWindowChips = activeMode === 'race' || activeMode === 'pulse' || activeMode === 'edge';

  const revision = `${section}:${historyModel?.dates.at(-1) ?? ''}:${insights?.run_date ?? ''}`;
  useEffect(() => {
    onDateSelect?.(null);
  }, [activeMode, window, revision, onDateSelect]);

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
      {standardOnly &&
      !standardFilterWarming &&
      (activeMode === 'calendar' || activeMode === 'edge') &&
      (historyModel?.dates.length ?? 0) <= 1 ? (
        <AppText variant="tiny" color="textFaint" style={{ marginBottom: 8 }}>
          Multi-day Spread and Calendar need bank intelligence for standard
          products. Pull to refresh on Home, or check Pulse and Leaders meanwhile.
        </AppText>
      ) : null}

      {showWindowChips ? (
        <Row gap={6} style={{ marginBottom: 8, flexWrap: 'wrap' }}>
          {WINDOW_OPTIONS.map((w) => (
            <Chip key={w} label={w} selected={window === w} onPress={() => setWindow(w)} />
          ))}
        </Row>
      ) : null}

      {standardFilterWarming ? (
        <AppText variant="small" color="textMuted">
          Filtering the latest standard products…
        </AppText>
      ) : needsInsights && !insightsAvailable ? (
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
                selectedDate={selectedDate}
                onDateSelect={onDateSelect}
              />
            </ChartErrorBoundary>
          ) : null}
          {activeMode === 'edge' && historyModel ? (
            <ChartErrorBoundary name="SwitcherEdgeChart">
              <SwitcherEdgeChart
                dates={historyModel.dates}
                points={historyModel.points}
                section={section}
                window={window}
                selectedDate={selectedDate}
                onDateSelect={onDateSelect}
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
              History loads after Market explorer is enabled and bank intelligence is ready.
            </AppText>
          ) : null}
        </>
      )}
    </View>
  );
}
