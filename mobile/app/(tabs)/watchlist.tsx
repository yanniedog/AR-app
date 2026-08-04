import { useScrollToTop } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { EmptyState } from '../../src/components/feedback';
import { ProductCard } from '../../src/components/ProductCard';
import { Screen, ScreenScrollView } from '../../src/components/Screen';
import { UndoSnackbar } from '../../src/components/Snackbar';
import { SwipeableRow } from '../../src/components/SwipeableRow';
import { AppText, Button, Row } from '../../src/components/ui';
import { resolveSavedRates } from '../../src/data/savedRates';
import { useStore } from '../../src/data/store';
import { useUndoSnackbar } from '../../src/hooks/useUndoSnackbar';
import { openCompare, openProduct } from '../../src/lib/nav';

function compareToken(productKey: string, rateIndex: number | null): string {
  return rateIndex == null ? productKey : `${rateIndex}#${productKey}`;
}

export default function Saved() {
  const core = useStore((s) => s.core);
  const savedRates = useStore((s) => s.savedRates);
  const removeSavedRate = useStore((s) => s.removeSavedRate);
  const toggleSavedRate = useStore((s) => s.toggleSavedRate);
  const { snack, showUndo, undo } = useUndoSnackbar();
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);

  const items = useMemo(() => (core ? resolveSavedRates(core, savedRates) : []), [core, savedRates]);
  const unavailableRefs = useMemo(() => {
    const resolvedIds = new Set(items.map((item) => item.ref.id));
    return savedRates.filter((ref) => ref.scope === 'rate' && !resolvedIds.has(ref.id));
  }, [items, savedRates]);

  const remove = useCallback(
    (id: string) => {
      const item = items.find((candidate) => candidate.ref.id === id);
      if (!item) return;
      removeSavedRate(id);
      setSelected((prev) => prev.filter((token) => token !== compareToken(item.row.product_key, item.row.rate_index ?? null)));
      showUndo(`Removed ${item.row.product_name}`, () => {
        if (!useStore.getState().savedRates.some((ref) => ref.id === id)) {
          toggleSavedRate(item.row, item.ref.scope);
        }
      });
    },
    [items, removeSavedRate, showUndo, toggleSavedRate],
  );

  if (!core) return null;

  if (!items.length) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 12 }}>
          <EmptyState
            icon="star-outline"
            title={unavailableRefs.length ? 'Saved rate unavailable' : 'Nothing saved yet'}
            subtitle={
              unavailableRefs.length
                ? 'The exact saved tier is not in this dataset. It has not been replaced with a different product rate.'
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
    <Screen>
      <ScreenScrollView ref={scrollRef} contentContainerStyle={{ padding: 16, paddingBottom: snack ? 96 : 32 }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <AppText variant="small" color="textMuted">
            {items.length} saved {items.length === 1 ? 'rate' : 'rates'}
          </AppText>
          {items.length >= 2 ? (
            <Button
              title={selectMode ? 'Done' : 'Choose to compare'}
              variant="secondary"
              onPress={() => {
                setSelectMode((value) => !value);
                setSelected([]);
              }}
            />
          ) : null}
        </Row>
        {unavailableRefs.length ? (
          <AppText variant="small" color="textMuted" style={{ marginBottom: 12 }}>
            {unavailableRefs.length} exact saved {unavailableRefs.length === 1 ? 'rate is' : 'rates are'} unavailable in this dataset and hidden rather than substituted.
          </AppText>
        ) : null}
        {selectMode && selected.length >= 2 ? (
          <Button
            title={`Compare ${selected.length}`}
            icon="git-compare"
            style={{ marginBottom: 16 }}
            onPress={() => openCompare(selected)}
          />
        ) : null}
        {items.map(({ ref, row, section }) => {
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
                onPress={() => {
                  if (!selectMode) {
                    openProduct(row.product_key, row.rate_index);
                    return;
                  }
                  setSelected((prev) =>
                    prev.includes(token)
                      ? prev.filter((value) => value !== token)
                      : prev.length < 4
                        ? [...prev, token]
                        : [...prev.slice(1), token],
                  );
                }}
              />
            </SwipeableRow>
          );
        })}
        <View style={{ height: 8 }} />
      </ScreenScrollView>
      <UndoSnackbar snack={snack} onUndo={undo} />
    </Screen>
  );
}
