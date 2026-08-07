import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, View } from 'react-native';

import {
  ABS_CPI_RELEASE_URL,
  ECONOMIC_RECHECK_MS,
  loadEconomicOutlook,
  RBA_ECONOMIC_TABLE_URL,
  type EconomicOutlookPayload,
} from '../data/economicOutlook';
import { relativeDate } from '../data/format';
import { yieldToUiFrames } from '../lib/yieldToUi';
import type { RbaEntry } from '../types';
import { useTheme } from '../theme/ThemeProvider';
import { EconomicExplorer, EconomicReleasesList } from './economy';
import { AppText, Button, Card, Row } from './ui';

function OutlookContent({ data, rba, rbaHolds }: { data: EconomicOutlookPayload; rba: RbaEntry[]; rbaHolds?: string[] }) {
  const theme = useTheme();
  const isFocused = useIsFocused();
  const revision = data.checkedAt || data.fetchedAt;
  const [explorerRevision, setExplorerRevision] = useState<string | null>(null);
  useEffect(() => {
    if (!isFocused || explorerRevision === revision) return;
    let active = true;
    void (async () => {
      await yieldToUiFrames(3);
      if (active) setExplorerRevision(revision);
    })();
    return () => {
      active = false;
    };
  }, [explorerRevision, isFocused, revision]);
  const counts = data.indicators.reduce(
    (acc, indicator) => ({ ...acc, [indicator.signal.direction]: acc[indicator.signal.direction] + 1 }),
    { higher: 0, lower: 0, balanced: 0 },
  );
  const pressureLine = [
    counts.higher ? `${counts.higher} higher` : null,
    counts.lower ? `${counts.lower} lower` : null,
    counts.balanced ? `${counts.balanced} mixed` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const usesAbsCpi = data.indicators.some((indicator) => indicator.sourceAgency === 'abs');

  return (
    <View style={{ marginTop: 12 }}>
      {pressureLine ? (
        <AppText variant="tiny" color="textMuted" style={{ marginBottom: 10 }}>
          {pressureLine} rate-pressure signals · official series with app interpretation
        </AppText>
      ) : null}
      <EconomicReleasesList data={data} />
      {explorerRevision === revision ? (
        <EconomicExplorer data={data} rba={rba} rbaHolds={rbaHolds} />
      ) : (
        <View
          style={{
            minHeight: 180,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.surfaceAlt,
          }}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Preparing economic charts"
        >
          <AppText variant="tiny" color="textFaint">Preparing economic charts…</AppText>
        </View>
      )}
      <Row gap={4} style={{ marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <AppText variant="tiny" color="textFaint">
          Checked {relativeDate(data.checkedAt)}
          {data.refreshStatus && data.refreshStatus !== 'current'
            ? data.refreshStatus === 'offline'
              ? ' · could not verify latest release'
              : ' · some series retained from last known values'
            : ''}
          {' · '}
        </AppText>
        {usesAbsCpi ? (
          <>
            <Pressable
              onPress={() => void Linking.openURL(ABS_CPI_RELEASE_URL)}
              accessibilityRole="link"
              accessibilityLabel="Open ABS CPI release"
              hitSlop={6}
            >
              <AppText variant="tiny" color="primary" weight="600">
                ABS CPI
              </AppText>
            </Pressable>
            <AppText variant="tiny" color="textFaint">
              {' · '}
            </AppText>
          </>
        ) : null}
        <Pressable
          onPress={() => void Linking.openURL(RBA_ECONOMIC_TABLE_URL)}
          accessibilityRole="link"
          accessibilityLabel="Open RBA statistics tables"
          hitSlop={6}
        >
          <AppText variant="tiny" color="primary" weight="600">
            RBA sources
          </AppText>
        </Pressable>
      </Row>
    </View>
  );
}

export function RbaOutlook({ rba, rbaHolds }: { rba: RbaEntry[]; rbaHolds?: string[] }) {
  const theme = useTheme();
  const [data, setData] = useState<EconomicOutlookPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const dataRef = useRef<EconomicOutlookPayload | null>(null);

  const load = useCallback(async (force = false) => {
    if (!dataRef.current || force) setLoading(true);
    setError(null);
    try {
      const value = await loadEconomicOutlook(force);
      if (mounted.current && dataRef.current !== value) {
        dataRef.current = value;
        setData(value);
      }
    } catch (err) {
      if (mounted.current) setError(String((err as Error)?.message ?? err));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    mounted.current = true;
    void load(false);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load(false);
    });
    const timer = setInterval(() => void load(false), ECONOMIC_RECHECK_MS);
    return () => {
      mounted.current = false;
      subscription.remove();
      clearInterval(timer);
    };
  }, [load]));

  return (
    <Card style={{ marginBottom: 16, borderColor: `${theme.colors.rba}55` }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <AppText variant="h2">RBA outlook</AppText>
          <AppText variant="small" color="textMuted" style={{ marginTop: 3 }}>
            Economic signals that shape the next rate decision
          </AppText>
        </View>
        <Pressable
          onPress={() => void load(true)}
          disabled={loading && !!data}
          accessibilityRole="button"
          accessibilityLabel="Refresh economic signals"
          hitSlop={8}
          style={{ paddingVertical: 4, paddingHorizontal: 2 }}
        >
          <AppText variant="tiny" weight="700" color={loading && data ? 'textFaint' : 'primary'}>
            {loading && data ? 'Updating…' : 'Refresh'}
          </AppText>
        </Pressable>
      </Row>
      {loading && !data ? (
        <View style={{ minHeight: 120, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.colors.rba} />
          <AppText variant="tiny" color="textMuted" style={{ marginTop: 8 }}>Loading RBA tables…</AppText>
        </View>
      ) : data ? (
        <>
          <OutlookContent data={data} rba={rba} rbaHolds={rbaHolds} />
          {error ? (
            <AppText variant="tiny" color="warning" style={{ marginTop: 8 }}>
              Could not verify the latest data: {error}
            </AppText>
          ) : null}
        </>
      ) : (
        <View style={{ marginTop: 14 }}>
          <AppText variant="small" color="textMuted">
            Economic signals are unavailable right now. Bank rates and cached app data still work normally.
          </AppText>
          {error ? <AppText variant="tiny" color="danger" style={{ marginTop: 5 }}>{error}</AppText> : null}
          <View style={{ alignSelf: 'flex-start', marginTop: 10 }}>
            <Button title="Retry" variant="secondary" onPress={() => void load(true)} loading={loading} />
          </View>
        </View>
      )}
    </Card>
  );
}
