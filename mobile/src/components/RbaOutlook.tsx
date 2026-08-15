import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, View } from 'react-native';

import {
  ABS_CPI_RELEASE_URL,
  ECONOMIC_RECHECK_MS,
  loadEconomicOutlook,
  RBA_ECONOMIC_TABLE_URL,
  type EconomicOutlookPayload,
} from '../data/economicOutlook';
import type { EconomicWindow } from '../data/economicModels';
import { relativeDate } from '../data/format';
import { yieldToPaintFrames } from '../lib/yieldToUi';
import type { RbaEntry } from '../types';
import { useTheme } from '../theme/ThemeProvider';
import { EconomicExplorer, EconomicReleasesList } from './economy';
import { useTrustedExternalUrl } from './ExternalLinkConfirmation';
import type { EconomicExplorerLens } from './economy/EconomicExplorer';
import { AppText, Button, Row } from './ui';

function OutlookContent({
  data,
  rba,
  rbaHolds,
  lens,
  onLensChange,
  window,
  onWindowChange,
  selectionStep,
  onGraphicReady,
}: {
  data: EconomicOutlookPayload;
  rba: RbaEntry[];
  rbaHolds?: string[];
  lens: EconomicExplorerLens;
  onLensChange: (lens: EconomicExplorerLens) => void;
  window: EconomicWindow;
  onWindowChange: (window: EconomicWindow) => void;
  selectionStep: number;
  onGraphicReady: (result: { revision: string; pointCount: number }) => void;
}) {
  const theme = useTheme();
  const { requestExternalUrl } = useTrustedExternalUrl();
  const isFocused = useIsFocused();
  const revision = data.checkedAt || data.fetchedAt;
  const [explorerRevision, setExplorerRevision] = useState<string | null>(null);
  useEffect(() => {
    if (!isFocused || explorerRevision === revision) return;
    let active = true;
    void (async () => {
      await yieldToPaintFrames(3);
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
    counts.higher ? `${counts.higher} point higher` : null,
    counts.lower ? `${counts.lower} point lower` : null,
    counts.balanced ? `${counts.balanced} mixed` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const usesAbsCpi = data.indicators.some((indicator) => indicator.sourceAgency === 'abs');

  return (
    <View style={{ marginTop: 12 }}>
      {pressureLine ? (
        <AppText variant="tiny" color="textMuted" style={{ marginBottom: 10 }}>
          {pressureLine} · not a rate forecast
        </AppText>
      ) : null}
      <EconomicReleasesList data={data} />
      {explorerRevision === revision ? (
        <EconomicExplorer
          data={data}
          rba={rba}
          rbaHolds={rbaHolds}
          lens={lens}
          onLensChange={onLensChange}
          window={window}
          onWindowChange={onWindowChange}
          selectionStep={selectionStep}
          onGraphicReady={onGraphicReady}
        />
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
              onPress={() => requestExternalUrl({
                url: ABS_CPI_RELEASE_URL,
                purpose: 'official_economic_source',
                label: 'ABS CPI release',
              })}
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
          onPress={() => requestExternalUrl({
            url: RBA_ECONOMIC_TABLE_URL,
            purpose: 'official_economic_source',
            label: 'RBA statistics tables',
          })}
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

export interface RbaOutlookAuditHandle {
  nextLens(): void;
  nextWindow(): void;
  previousDate(): void;
}

export interface RbaOutlookAuditState {
  status: 'pending' | 'ready' | 'error';
  revision: string | null;
  indicatorCount: number;
  pointCount: number;
  layoutReady: boolean;
  graphicReady: boolean;
  error: string | null;
}

export const RbaOutlook = forwardRef<RbaOutlookAuditHandle, {
  rba: RbaEntry[];
  rbaHolds?: string[];
  onAuditStateChange?: (state: RbaOutlookAuditState) => void;
}>(function RbaOutlook({ rba, rbaHolds, onAuditStateChange }, ref) {
  const theme = useTheme();
  const [data, setData] = useState<EconomicOutlookPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const dataRef = useRef<EconomicOutlookPayload | null>(null);
  const [lens, setLens] = useState<EconomicExplorerLens>('policy');
  const [window, setWindow] = useState<EconomicWindow>('5Y');
  const [selectionStep, setSelectionStep] = useState(0);
  const [layoutRevision, setLayoutRevision] = useState<string | null>(null);
  const [graphic, setGraphic] = useState<{ revision: string; pointCount: number } | null>(null);

  const availableLenses = useMemo<EconomicExplorerLens[]>(() => {
    const indicatorLenses = data?.indicators.map((indicator) => indicator.id) ?? [];
    return [...indicatorLenses, 'compare', 'momentum', 'policy'];
  }, [data]);
  useImperativeHandle(ref, () => ({
    nextLens: () => {
      const index = Math.max(0, availableLenses.indexOf(lens));
      setLens(availableLenses[(index + 1) % Math.max(1, availableLenses.length)] ?? 'policy');
    },
    nextWindow: () => {
      const windows: EconomicWindow[] = ['1Y', '3Y', '5Y', 'All'];
      const index = Math.max(0, windows.indexOf(window));
      setWindow(windows[(index + 1) % windows.length]);
    },
    previousDate: () => setSelectionStep((current) => current + 1),
  }), [availableLenses, lens, window]);

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

  const revision = data ? data.checkedAt || data.fetchedAt : null;
  const expectedGraphicRevision = revision ? `${revision}:${lens}:${window}:${selectionStep}` : null;
  const layoutReady = revision != null && layoutRevision === revision;
  const graphicReady = expectedGraphicRevision != null && graphic?.revision === expectedGraphicRevision;
  useEffect(() => {
    onAuditStateChange?.({
      status: data && !loading && layoutReady && graphicReady ? 'ready' : !data && !loading && error ? 'error' : 'pending',
      revision,
      indicatorCount: data?.indicators.length ?? 0,
      pointCount: graphic?.pointCount ?? 0,
      layoutReady,
      graphicReady,
      error,
    });
  }, [data, error, graphic?.pointCount, graphicReady, layoutReady, loading, onAuditStateChange, revision]);

  return (
    <View
      style={{ marginBottom: 8 }}
      onLayout={(event) => {
        if (revision && event.nativeEvent.layout.width > 0 && event.nativeEvent.layout.height > 0) {
          setLayoutRevision(revision);
        }
      }}
    >
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <AppText variant="h2">Decision context</AppText>
          <AppText variant="small" color="textMuted" style={{ marginTop: 3 }}>
            Inflation, jobs, housing and policy expectations
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
          <AppText variant="tiny" color="textMuted" style={{ marginTop: 8 }}>Loading official data…</AppText>
        </View>
      ) : data ? (
        <>
          <OutlookContent
            data={data}
            rba={rba}
            rbaHolds={rbaHolds}
            lens={lens}
            onLensChange={setLens}
            window={window}
            onWindowChange={setWindow}
            selectionStep={selectionStep}
            onGraphicReady={setGraphic}
          />
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
    </View>
  );
});
