import Ionicons from '../icons/AppIcon';
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
  edge: { label: 'Spread', icon: 'flash-outline', blurb: 'Leading advertised rate versus the median' },
  calendar: { label: 'Calendar', icon: 'calendar-outline', blurb: 'Every day, coloured by which way rates moved' },
  pulse: { label: 'Pulse', icon: 'pulse-outline', blurb: 'Daily rate-move activity across all lenders' },
  race: { label: 'Leaders', icon: 'podium-outline', blurb: "Today's leading rates, traced back through the rankings" },
};

const WINDOW_OPTIONS: HistoryWindow[] = ['30D', '90D', '1Y', 'All'];

/**
 * History explorer: four focused lenses over aggregate and per-bank history.
 * Calendar / spread read section aggregates; leaders / pulse read bank history.
 */
export const HistoryExplorer = React.memo(function HistoryExplorer({
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
  window: controlledWindow,
  onWindowChange,
  auditRevision,
  onLeaderLogoReadiness,
  showModePicker = true,
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
  window?: HistoryWindow;
  onWindowChange?: (window: HistoryWindow) => void;
  auditRevision?: string;
  onLeaderLogoReadiness?: (state: { revision: string; expectedCount: number; terminalCount: number }) => void;
  /** Keeps the default Market view calm; advanced lenses can be disclosed on demand. */
  showModePicker?: boolean;
}) {
  const [localMode, setLocalMode] = useState<HistoryViewMode>(controlledMode ?? 'edge');
  const [localWindow, setLocalWindow] = useState<HistoryWindow>('90D');
  const window = controlledWindow ?? localWindow;
  const changeWindow = (next: HistoryWindow) => {
    if (controlledWindow == null) setLocalWindow(next);
    onWindowChange?.(next);
  };

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

  useEffect(() => {
    onDateSelect?.(null);
  }, [activeMode, window, onDateSelect]);

  const availableDates = needsInsights ? insights?.run_dates : historyModel?.dates;
  useEffect(() => {
    if (selectedDate && availableDates?.length && !availableDates.includes(selectedDate)) {
      onDateSelect?.(null);
    }
  }, [availableDates, onDateSelect, selectedDate]);

  return (
    <View>
      {showModePicker ? (
        <>
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
          <AppText variant="small" color="textMuted" style={{ marginBottom: 8 }}>
            {MODE_META[activeMode].blurb}
          </AppText>
        </>
      ) : null}
      {standardOnly &&
      !standardFilterWarming &&
      (activeMode === 'calendar' || activeMode === 'edge') &&
      (historyModel?.dates.length ?? 0) <= 1 ? (
        <AppText variant="tiny" color="textFaint" style={{ marginBottom: 8 }}>
          More history is needed for Spread and Calendar. Pulse and Leaders are available now.
        </AppText>
      ) : null}

      {showWindowChips ? (
        <Row gap={6} style={{ marginBottom: 8, flexWrap: 'wrap' }}>
          {WINDOW_OPTIONS.map((w) => (
            <Chip key={w} label={w} selected={window === w} onPress={() => changeWindow(w)} />
          ))}
        </Row>
      ) : null}

      {standardFilterWarming ? (
        <AppText variant="small" color="textMuted">
          Filtering the latest standard products…
        </AppText>
      ) : needsInsights && !insightsAvailable ? (
        <AppText variant="small" color="textMuted">
          This view compares bank-level rate movements — included with Pro.
        </AppText>
      ) : needsInsights && !insights ? (
        <AppText variant="small" color="textMuted">
          Loading bank history…
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
                auditRevision={auditRevision}
                onLogoReadiness={onLeaderLogoReadiness}
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
              Bank history is still loading.
            </AppText>
          ) : null}
        </>
      )}
    </View>
  );
});
