import { useScrollToTop } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { EmptyState, ScreenSkeleton } from '../../src/components/feedback';
import { ProductCard } from '../../src/components/ProductCard';
import { Screen, ScreenScrollView } from '../../src/components/Screen';
import { UndoSnackbar } from '../../src/components/Snackbar';
import { SwipeableRow } from '../../src/components/SwipeableRow';
import { AppText, Button, SectionHeading } from '../../src/components/ui';
import { SECTION_ORDER, SECTIONS } from '../../src/constants';
import { resolveSavedRates, unresolvedSavedRateRefs } from '../../src/data/savedRates';
import { makeSavedRateRef, type SavedRateRef } from '../../src/data/savedRates';
import { useStore } from '../../src/data/store';
import { usePerformanceAuditSurface } from '../../src/hooks/usePerformanceAuditReadiness';
import { useLogoReadiness } from '../../src/hooks/useLogoReadiness';
import { useUndoSnackbar } from '../../src/hooks/useUndoSnackbar';
import { openCompare, openProduct } from '../../src/lib/nav';
import {
  auditActionString,
  auditActionStrings,
} from '../../src/lib/performanceAuditActionParams';
import type { RateRow } from '../../src/types';

function compareToken(productKey: string, rateIndex: number | null): string {
  return rateIndex == null ? productKey : `${rateIndex}#${productKey}`;
}

let auditSavedFixtureSnapshot: { savedRates: SavedRateRef[]; favorites: string[] } | null = null;

export default function Saved() {
  const core = useStore((s) => s.core);
  const coreSha = useStore((s) => s.manifest?.files.core.sha256 ?? '');
  const storeStatus = useStore((s) => s.status);
  const storeError = useStore((s) => s.error);
  const savedRates = useStore((s) => s.savedRates);
  const removeSavedRate = useStore((s) => s.removeSavedRate);
  const { snack, showUndo, undo } = useUndoSnackbar();
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [layoutReady, setLayoutReady] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);

  const items = useMemo(() => (core ? resolveSavedRates(core, savedRates) : []), [core, savedRates]);
  const unavailableRefs = useMemo(
    () => unresolvedSavedRateRefs(savedRates, items),
    [items, savedRates],
  );

  const toggleCompareMode = useCallback(() => {
    setSelectMode((value) => !value);
    setSelected([]);
  }, []);
  const toggleSelection = useCallback((token: string) => {
    setSelected((prev) =>
      prev.includes(token)
        ? prev.filter((value) => value !== token)
        : prev.length < 4
          ? [...prev, token]
          : [...prev.slice(1), token],
    );
  }, []);
  const findExactRow = useCallback((token: string): RateRow | null => {
    if (!core) return null;
    const hash = token.indexOf('#');
    const rateIndex = hash > 0 && Number.isInteger(Number(token.slice(0, hash)))
      ? Number(token.slice(0, hash))
      : null;
    const productKey = rateIndex == null ? token : token.slice(hash + 1);
    for (const section of Object.values(core.sections)) {
      const exact = section.rates.find((row) =>
        row.product_key === productKey && (rateIndex == null || row.rate_index === rateIndex));
      if (exact) return exact;
    }
    return null;
  }, [core]);
  const ensureExactPair = useCallback((...args: unknown[]) => {
    const tokens = auditActionStrings(args, 'selectionTokens');
    auditSavedFixtureSnapshot ??= {
      savedRates: JSON.parse(JSON.stringify(useStore.getState().savedRates)) as SavedRateRef[],
      favorites: [...useStore.getState().favorites],
    };
    const rows = tokens
      .map(findExactRow)
      .filter((row): row is RateRow => row != null);
    if (rows.length < 2) return;
    useStore.setState((state) => {
      const fixtureKeys = new Set(rows.map((row) => row.product_key));
      const retained = state.savedRates.filter((ref) => !fixtureKeys.has(ref.productKey));
      const additions = rows.map((row) => makeSavedRateRef(
        row,
        Number.isInteger(row.rate_index) ? 'rate' : 'product',
      ));
      const next = [...retained, ...additions];
      return {
        savedRates: next,
        favorites: [...new Set(next.map((ref) => ref.productKey))],
      };
    });
  }, [findExactRow]);
  const restoreSavedFixture = useCallback(() => {
    const snapshot = auditSavedFixtureSnapshot;
    if (!snapshot) return;
    useStore.setState({
      savedRates: JSON.parse(JSON.stringify(snapshot.savedRates)) as SavedRateRef[],
      favorites: [...snapshot.favorites],
    });
    auditSavedFixtureSnapshot = null;
    setSelectMode(false);
    setSelected([]);
  }, []);
  const selectAuditToken = useCallback((...args: unknown[]) => {
    const token = auditActionString(args, 'selectionToken');
    if (token) toggleSelection(token);
  }, [toggleSelection]);
  const openSelectedCompare = useCallback(() => {
    if (selected.length < 2) return undefined;
    openCompare(selected);
    return { expectedPath: '/compare' };
  }, [selected]);
  const coreRevision = core ? `${core.run_date}:${coreSha}` : null;
  const savedRenderRevision = `${coreRevision ?? 'none'}:${items.length}:${unavailableRefs.length}:${selectMode ? 'select' : 'view'}:${selected.join(',')}`;
  const savedLogoIds = useMemo(
    () => selectMode ? [] : items.map(({ ref }) => `saved:${ref.id}`),
    [items, selectMode],
  );
  const savedLogos = useLogoReadiness(savedRenderRevision, savedLogoIds);
  const auditActions = useMemo(() => ({
    'saved.open': () => undefined,
    'saved.fixture.ensure-exact-pair': ensureExactPair,
    'saved.compare.mode': toggleCompareMode,
    'saved.compare.select.0': selectAuditToken,
    'saved.compare.select.1': selectAuditToken,
    'saved.compare.open': openSelectedCompare,
    'saved.fixture.restore': restoreSavedFixture,
  }), [ensureExactPair, openSelectedCompare, restoreSavedFixture, selectAuditToken, toggleCompareMode]);
  usePerformanceAuditSurface({
    id: 'saved.list',
    routeKey: '/watchlist',
    datasetRevision: coreRevision,
    renderRevision: savedRenderRevision,
    actions: auditActions,
    probes: [
      {
        id: 'saved.data',
        kind: 'data',
        status: core ? 'ready' : storeStatus === 'error' ? 'error' : 'pending',
        error: !core && storeStatus === 'error' ? storeError ?? 'Core data unavailable' : null,
        datasetRevision: coreRevision,
      },
      {
        id: 'saved.items',
        kind: 'list',
        status: core ? 'ready' : 'pending',
        expectedCount: items.length,
        actualCount: items.length,
      },
      {
        id: 'saved.logos',
        kind: 'logo',
        status: savedLogos.ready ? 'ready' : 'pending',
        expectedCount: savedLogos.expectedCount,
        actualCount: savedLogos.terminalCount,
      },
      {
        id: 'saved.layout',
        kind: 'layout',
        status: layoutReady ? 'ready' : 'pending',
        renderRevision: savedRenderRevision,
      },
    ],
  });

  const remove = useCallback(
    (id: string) => {
      const item = items.find((candidate) => candidate.ref.id === id);
      if (!item) return;
      removeSavedRate(id);
      setSelected((prev) => prev.filter((token) => token !== compareToken(item.row.product_key, item.row.rate_index ?? null)));
      showUndo(`Removed ${item.row.product_name}`, () => {
        useStore.setState((state) => {
          if (state.savedRates.some((ref) => ref.id === id)) return state;
          const restored = [...state.savedRates, item.ref];
          return {
            savedRates: restored,
            favorites: [...new Set(restored.map((ref) => ref.productKey))],
          };
        });
      });
    },
    [items, removeSavedRate, showUndo],
  );

  if (!core) return <ScreenSkeleton />;

  if (!items.length) {
    return (
      <Screen onLayout={() => setLayoutReady(true)}>
        <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 12 }}>
          <EmptyState
            icon="star-outline"
            title={unavailableRefs.length ? 'Saved item unavailable' : 'Nothing saved yet'}
            subtitle={
              unavailableRefs.length
                ? 'The saved product or exact tier is not in this dataset. It has not been replaced with a different rate.'
                : 'Save an exact rate to track that product variant, or save all variants from its product page.'
            }
          />
          {unavailableRefs.length ? (
            <Button
              title="Remove unavailable save"
              variant="secondary"
              onPress={() => unavailableRefs.forEach((ref) => removeSavedRate(ref.id))}
            />
          ) : null}
          <Button title="Browse products" onPress={() => router.push('/(tabs)/browse')} />
          <Button title="Search rates" variant="secondary" onPress={() => router.push('/search?section=Mortgage')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen onLayout={() => setLayoutReady(true)}>
      <ScreenScrollView
        ref={scrollRef}
        showDataHealthBanner={false}
        contentContainerStyle={{ padding: 16, paddingBottom: snack ? 96 : 32 }}
      >
        <SectionHeading
          title="Saved rates"
          subtitle={`${items.length} saved ${items.length === 1 ? 'rate' : 'rates'} · changes appear on each item`}
          action={items.length >= 2 ? (
            <Button
              title={selectMode ? 'Done' : 'Compare'}
              variant="secondary"
              onPress={toggleCompareMode}
            />
          ) : undefined}
        />
        {unavailableRefs.length ? (
          <View style={{ gap: 8, marginBottom: 12 }}>
            <AppText variant="small" color="textMuted">
              {unavailableRefs.length} saved {unavailableRefs.length === 1 ? 'item is' : 'items are'} unavailable in this dataset and hidden rather than substituted.
            </AppText>
            <Button
              title={`Remove unavailable ${unavailableRefs.length === 1 ? 'save' : 'saves'}`}
              variant="secondary"
              onPress={() => unavailableRefs.forEach((ref) => removeSavedRate(ref.id))}
            />
          </View>
        ) : null}
        {selectMode && selected.length >= 2 ? (
          <Button
            title={`Compare ${selected.length}`}
            icon="git-compare"
            style={{ marginBottom: 16 }}
            onPress={openSelectedCompare}
          />
        ) : null}
        {SECTION_ORDER.map((groupSection) => {
          const sectionItems = items.filter((item) => item.section === groupSection);
          if (!sectionItems.length) return null;
          return (
            <View key={groupSection} style={{ gap: 4 }}>
              <AppText variant="small" weight="700" color="textMuted">
                {SECTIONS[groupSection].title}
              </AppText>
              {sectionItems.map(({ ref, row, section }) => {
                const token = compareToken(row.product_key, row.rate_index ?? null);
                const selectedNow = selected.includes(token);
                return (
                  <SwipeableRow
                    key={ref.id}
                    onDelete={() => remove(ref.id)}
                    deleteLabel="Remove from saved"
                  >
                    <ProductCard
                      row={row}
                      section={section}
                      selectMode={selectMode}
                      selected={selectedNow}
                      logoRenderStateId={`saved:${ref.id}`}
                      onLogoRenderStateChange={savedLogos.onLogoRenderStateChange}
                      onPress={() => {
                        if (!selectMode) {
                          openProduct(row.product_key, row.rate_index);
                          return;
                        }
                        toggleSelection(token);
                      }}
                    />
                  </SwipeableRow>
                );
              })}
            </View>
          );
        })}
        <View style={{ height: 8 }} />
      </ScreenScrollView>
      <UndoSnackbar snack={snack} onUndo={undo} />
    </Screen>
  );
}
