import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import type { EconomicIndicator, EconomicOutlookPayload } from '../../data/economicOutlook';
import {
  economicMomentumModel,
  indicatorHistoryModel,
  inflationExpectationsModel,
  policyPathModel,
  type EconomicWindow,
} from '../../data/economicModels';
import type { RbaEntry } from '../../types';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText, Badge, Chip, Row } from '../ui';
import { EconomicChartFrame } from './EconomicChartFrame';
import { MomentumChart } from './MomentumChart';

export type EconomicExplorerLens = 'indicator' | 'compare' | 'momentum' | 'policy';

const LENSES: { id: EconomicExplorerLens; label: string; description: string }[] = [
  { id: 'indicator', label: 'Indicators', description: 'Explore one official series at a readable mobile scale' },
  { id: 'compare', label: 'Inflation', description: 'Underlying inflation and expectations on one common percent scale' },
  { id: 'momentum', label: 'Momentum', description: 'How the four policy signals have changed across recent observations' },
  { id: 'policy', label: 'Policy path', description: 'The actual cash rate joined to the economists’ median forecast path' },
];

const WINDOWS: EconomicWindow[] = ['1Y', '3Y', '5Y', 'All'];

export interface EconomicExplorerProps {
  data: EconomicOutlookPayload;
  rba: RbaEntry[];
  initialLens?: EconomicExplorerLens;
}

export function EconomicExplorer({
  data,
  rba,
  initialLens = 'indicator',
}: EconomicExplorerProps) {
  const theme = useTheme();
  const [lens, setLens] = useState<EconomicExplorerLens>(initialLens);
  const [window, setWindow] = useState<EconomicWindow>('5Y');
  const [indicatorId, setIndicatorId] = useState<EconomicIndicator['id']>(
    data.indicators[0]?.id ?? 'underlying_inflation',
  );
  const activeLens = LENSES.find((item) => item.id === lens) ?? LENSES[0];
  const indicator = useMemo(
    () => indicatorHistoryModel(data, indicatorId, window),
    [data, indicatorId, window],
  );
  const comparison = useMemo(
    () => inflationExpectationsModel(data, window),
    [data, window],
  );
  const momentum = useMemo(() => economicMomentumModel(data), [data]);
  const policy = useMemo(() => policyPathModel(data, rba, window), [data, rba, window]);

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
        <Row gap={6}>
          {LENSES.map((item) => (
            <Chip
              key={item.id}
              label={item.label}
              selected={lens === item.id}
              onPress={() => setLens(item.id)}
            />
          ))}
        </Row>
      </ScrollView>
      <AppText variant="tiny" color="textMuted" style={{ marginBottom: 10 }}>
        {activeLens.description}
      </AppText>

      {lens !== 'momentum' ? (
        <Row gap={6} style={{ flexWrap: 'wrap', marginBottom: 10 }}>
          {WINDOWS.map((item) => (
            <Chip key={item} label={item} selected={window === item} onPress={() => setWindow(item)} />
          ))}
        </Row>
      ) : null}

      {lens === 'indicator' ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            <Row gap={6}>
              {data.indicators.map((item) => (
                <Chip
                  key={item.id}
                  label={item.label}
                  selected={indicatorId === item.id}
                  onPress={() => setIndicatorId(item.id)}
                />
              ))}
            </Row>
          </ScrollView>
          {indicator ? (
            <>
              <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <AppText variant="h3">{indicator.label}</AppText>
                  <AppText variant="tiny" color="textFaint">{indicator.shortLabel}</AppText>
                </View>
                <Badge label={`${indicator.latest.value.toFixed(2)}%`} tone="primary" />
              </Row>
              <EconomicChartFrame
                series={[{
                  id: indicator.id,
                  label: indicator.label,
                  points: indicator.points,
                  color: theme.colors.primary,
                }]}
                targetBand={indicator.targetBand}
                accessibilitySummary={indicator.summary}
              />
            </>
          ) : <EmptyLens />}
        </>
      ) : null}

      {lens === 'compare' ? comparison ? (
        <EconomicChartFrame
          series={[
            {
              id: 'underlying_inflation',
              label: 'Underlying inflation',
              points: comparison.inflation,
              color: theme.colors.warning,
            },
            {
              id: 'inflation_expectations',
              label: '1Y expectations',
              points: comparison.expectations,
              color: theme.colors.primary,
              dashed: true,
            },
          ]}
          targetBand={comparison.targetBand}
          accessibilitySummary={comparison.summary}
        />
      ) : <EmptyLens /> : null}

      {lens === 'momentum' ? momentum
        ? <MomentumChart model={momentum} />
        : <EmptyLens />
        : null}

      {lens === 'policy' ? policy ? (
        <>
          {policy.surveyDate ? (
            <AppText variant="tiny" color="textFaint" style={{ marginBottom: 5 }}>
              Forecast survey vintage {policy.surveyDate}
            </AppText>
          ) : null}
          <EconomicChartFrame
            series={[
              {
                id: 'actual',
                label: 'Actual cash rate',
                points: policy.actual,
                color: theme.colors.rba,
                stepped: true,
              },
              {
                id: 'forecast',
                label: 'Economists’ median',
                points: policy.forecast,
                color: theme.colors.primary,
                dashed: true,
              },
            ]}
            accessibilitySummary={policy.summary}
          />
          <AppText variant="tiny" color="textFaint" style={{ marginTop: 5 }}>
            Solid = official cash-rate history · dashed = survey median, not a probability
          </AppText>
        </>
      ) : <EmptyLens /> : null}
    </View>
  );
}

function EmptyLens() {
  return (
    <AppText variant="small" color="textMuted">
      This view needs more official observations.
    </AppText>
  );
}
