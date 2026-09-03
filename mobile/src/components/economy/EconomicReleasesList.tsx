import Ionicons from '../icons/AppIcon';
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  meetingBiasModel,
  type EconomicReleaseRow,
  type MeetingLean,
} from '../../data/economicModels';
import type { EconomicOutlookPayload } from '../../data/economicOutlook';
import { formatRunDate } from '../../data/format';
import { useTheme } from '../../theme/ThemeProvider';
import { useTrustedExternalUrl } from '../ExternalLinkConfirmation';
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

function vsPriorLabel(row: EconomicReleaseRow): string {
  if (row.vsPrior == null || row.delta == null) return 'no prior';
  if (row.vsPrior === 'same') return 'same as prior';
  const signed = `${row.delta > 0 ? '+' : ''}${row.delta.toFixed(1)}`;
  return row.vsPrior === 'above'
    ? `above prior (${signed} pp)`
    : `below prior (${signed} pp)`;
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
        accessibilityHint={expanded ? `Hide ${row.label} detail` : `Show ${row.label} detail`}
        accessibilityLabel={
          `${row.label}, ${row.latest.toFixed(1)} percent for ${row.coverageLabel}, `
          + `updated ${formatRunDate(row.updateDate)}, ${vsPriorLabel(row)}, ${row.leanLabel}`
        }
        style={({ pressed }) => ({
          minHeight: TOUCH_TARGET_MIN,
          opacity: pressed ? 0.7 : 1,
          paddingVertical: 8,
        })}
      >
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <AppText variant="small" weight="600">
              {row.label}
            </AppText>
            <AppText variant="tiny" color="textFaint" style={{ marginTop: 2 }}>
              Covers {row.coverageLabel}
              {' · '}
              updated {formatRunDate(row.updateDate)}
            </AppText>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <AppText variant="small" weight="700">
              {row.latest.toFixed(1)}%
            </AppText>
            <AppText variant="tiny" color="textMuted" style={{ marginTop: 2 }}>
              {vsPriorLabel(row)}
            </AppText>
            <AppText variant="tiny" weight="700" style={{ marginTop: 2, color: leanTone }}>
              {row.leanLabel}
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
            {row.deepExplanation}
          </AppText>
          {row.sourceUrl ? (
            <Pressable
              onPress={() => requestExternalUrl({
                url: row.sourceUrl!,
                purpose: 'official_economic_source',
                label: `${row.sourceAgency === 'abs' ? 'ABS' : 'RBA'} source for ${row.label}`,
              })}
              accessibilityRole="link"
              accessibilityLabel={`Open source for ${row.label}`}
              hitSlop={6}
              style={{ marginTop: 6, alignSelf: 'flex-start' }}
            >
              <AppText variant="tiny" color="primary" weight="600">
                {row.sourceAgency === 'abs' ? 'ABS source' : 'RBA source'}
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
  if (!bias?.rows.length) return null;

  const headline = bias.rows.find((row) => row.id === 'headline_inflation') ?? bias.rows[0];
  const collapsedSummary =
    `${headline.label} ${headline.latest.toFixed(1)}% · ${headline.coverageLabel}`
    + ` · ${bias.leanLabel}`;

  return (
    <View style={{ marginBottom: 12 }}>
      <TouchTarget
        fill
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityHint={open ? 'Hide latest releases' : 'Show latest releases'}
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
            Latest releases
          </AppText>
          {!open ? (
            <AppText variant="tiny" color="textFaint" numberOfLines={2} style={{ marginTop: 2 }}>
              {collapsedSummary}
            </AppText>
          ) : (
            <AppText variant="tiny" color="textMuted" style={{ marginTop: 2 }}>
              {bias.leanLabel}
              {' · '}
              {bias.signalBalance} signals · official releases
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
            {bias.rationale}
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
