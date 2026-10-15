import Ionicons from '../icons/AppIcon';
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  meetingBiasModel,
  type EconomicReleaseRow,
  type MeetingLean,
} from '../../data/economicModels';
import type { EconomicOutlookPayload } from '../../data/economicOutlook';
import { uiDate, uiJoin, uiLabel, type UiText } from '../../lib/uiCopy';
import { uiChartPercent, uiChartPp, uiEconomicIndicator } from '../../lib/chartUiCopy';
import { useTheme } from '../../theme/ThemeProvider';
import { useTrustedExternalUrl } from '../ExternalLinkConfirmation';
import { useAuditExternalLinks } from '../../hooks/useAuditExternalLinks';
import { TOUCH_TARGET_MIN, TouchTarget } from '../TouchTarget';
import { AppText, Divider, Row } from '../ui';

function leanColor(
  lean: MeetingLean,
  theme: ReturnType<typeof useTheme>,
): string {
  if (lean === 'raise') return theme.colors.warning;
  if (lean === 'cut') return theme.colors.primary;
  return theme.colors.textMuted;
}

function vsPriorLabel(row: EconomicReleaseRow): UiText {
  if (row.vsPrior == null || row.delta == null) return uiLabel('No prior');
  if (row.vsPrior === 'same') return uiLabel('Same as prior');
  return uiJoin('Prior', ' · ', uiChartPp(row.delta));
}
function leanLabel(lean: MeetingLean): UiText {
  return uiLabel(lean === 'raise' ? 'Hike' : lean === 'cut' ? 'Cut' : 'Held');
}

function ReleaseRow({
  row,
  expanded,
  onToggle,
}: {
  row: EconomicReleaseRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const { requestExternalUrl } = useTrustedExternalUrl();
  const leanTone = leanColor(row.meetingLean, theme);

  return (
    <View>
      <TouchTarget
        fill
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={uiJoin(uiEconomicIndicator(row.id), ' · ', uiChartPercent(row.latest, 1), ' · ', 'Observed', ' · ', uiDate(row.observationDate), ' · ', 'Source date', ' · ', uiDate(row.updateDate), ' · ', vsPriorLabel(row))}
        style={({ pressed }) => ({
          minHeight: TOUCH_TARGET_MIN,
          opacity: pressed ? 0.7 : 1,
          paddingVertical: 8,
        })}
      >
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <AppText variant="small" weight="600">
              {uiEconomicIndicator(row.id)}
            </AppText>
            <AppText variant="tiny" color="textFaint" style={{ marginTop: 2 }}>
              {uiJoin('Observed', ' · ', uiDate(row.observationDate), ' · ', 'Source date', ' · ', uiDate(row.updateDate))}
            </AppText>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <AppText variant="small" weight="700">
              {uiChartPercent(row.latest, 1)}
            </AppText>
            <AppText variant="tiny" color="textMuted" style={{ marginTop: 2 }}>
              {vsPriorLabel(row)}
            </AppText>
            <AppText variant="tiny" weight="700" style={{ marginTop: 2, color: leanTone }}>
              {uiJoin('Signal', ' · ', leanLabel(row.meetingLean))}
            </AppText>
          </View>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={theme.colors.textFaint}
            style={{ marginLeft: 6, marginTop: 2 }}
          />
        </Row>
      </TouchTarget>
      {expanded ? (
        <View style={{ paddingBottom: 10, paddingRight: 4 }}>
          <AppText variant="tiny" color="textMuted">
            {uiJoin('Prior', ' · ', uiChartPercent(row.prior, 1), ' · ', 'Forecast', ' · ', 'Excluded')}
          </AppText>
          {row.sourceUrl ? (
            <Pressable
              onPress={() => requestExternalUrl({
                url: row.sourceUrl!,
                purpose: 'official_economic_source',
                label: uiJoin(row.sourceAgency === 'abs' ? 'ABS source' : 'RBA source', ' · ', uiEconomicIndicator(row.id)),
              })}
              accessibilityRole="link"
              accessibilityLabel={uiJoin('Open', ' · ', 'Source', ' · ', uiEconomicIndicator(row.id))}
              hitSlop={6}
              style={{ marginTop: 6, alignSelf: 'flex-start' }}
            >
              <AppText variant="tiny" color="primary" weight="600">
                {uiLabel(row.sourceAgency === 'abs' ? 'ABS source' : 'RBA source')}
              </AppText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function EconomicReleasesList({ data }: { data: EconomicOutlookPayload }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const bias = useMemo(() => meetingBiasModel(data), [data]);
  useAuditExternalLinks((bias?.rows ?? []).flatMap((row) => row.sourceUrl ? [{ url: row.sourceUrl, label: uiJoin('Source', ' · ', uiEconomicIndicator(row.id)), purpose: 'official_economic_source' as const }] : []));
  if (!bias?.rows.length) return null;

  const headline = bias.rows.find((row) => row.id === 'headline_inflation') ?? bias.rows[0];
  const collapsedSummary = uiJoin(uiEconomicIndicator(headline.id), ' · ', uiChartPercent(headline.latest, 1), ' · ', uiDate(headline.observationDate), ' · ', leanLabel(bias.lean));

  return (
    <View style={{ marginBottom: 12 }}>
      <TouchTarget
        fill
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel="Latest releases"
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          minHeight: TOUCH_TARGET_MIN,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <View style={{ flex: 1 }}>
          <AppText variant="body" weight="600">
            {uiLabel("Latest releases")}</AppText>
          {!open ? (
            <AppText variant="tiny" color="textFaint" numberOfLines={2} style={{ marginTop: 2 }}>
              {collapsedSummary}
            </AppText>
          ) : (
            <AppText variant="tiny" color="textMuted" style={{ marginTop: 2 }}>
              {uiJoin('Signals', ' · ', leanLabel(bias.lean), ' · ', uiLabel(bias.signalBalance === 'mixed' ? 'Mixed' : bias.signalBalance === 'moderate' ? 'Moderate' : 'Strong'), ' · ', 'Official releases')}
            </AppText>
          )}
        </View>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={theme.colors.textMuted}
        />
      </TouchTarget>

      {open ? (
        <View style={{ paddingTop: 4 }}>
          <AppText variant="tiny" color="textMuted" style={{ marginBottom: 8 }}>
            {uiJoin('Forecast', ' · ', 'Excluded')}
          </AppText>
          <Divider />
          {bias.rows.map((row, index) => (
            <View key={row.id}>
              {index > 0 ? <Divider /> : null}
              <ReleaseRow
                row={row}
                expanded={expandedId === row.id}
                onToggle={() =>
                  setExpandedId((current) => (current === row.id ? null : row.id))
                }
              />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
