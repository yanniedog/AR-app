import React, { useState } from 'react';
import { Alert, Modal, TextInput, View } from 'react-native';

import { toFraction } from '../../data/format';
import { ensurePermissions } from '../../data/notifications';
import { useStore } from '../../data/store';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { uiDate, uiInputNumber, uiJoin, uiLabel, uiNumber } from '../../lib/uiCopy';
import { fontStyle } from '../../theme/fonts';
import { useTheme } from '../../theme/ThemeProvider';
import type { RateRow, SectionKey } from '../../types';
import { IconAction } from '../IconAction';
import { AppText, Button, Card, Row } from '../ui';

/** Saved metadata belongs to the exact product context, outside collection rows. */
export function SavedRateActions({ row, section }: { row: RateRow; section: SectionKey }) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const saved = useStore(s => s.savedRates);
  const trackedRates = useStore(s => s.trackedRates);
  const runDate = useStore(s => s.core?.run_date);
  const notificationsEnabled = useStore(s => s.prefs.notificationsEnabled);
  // Subscribe to changes as well as reading the store's exact-scope predicate.
  useStore(s => s.subscriptions);
  const isProductSubscribed = useStore(s => s.isProductSubscribed);
  const subscribeProduct = useStore(s => s.subscribeProduct);
  const unsubscribeProduct = useStore(s => s.unsubscribeProduct);
  const setPref = useStore(s => s.setPref);
  const setTrackedRateRelevantDate = useStore(s => s.setTrackedRateRelevantDate);
  const [editing, setEditing] = useState(false);
  const [dateValue, setDateValue] = useState('');
  const ref = saved?.find(value => value.productKey === row.product_key && value.scope === 'rate' && value.rateIndex === row.rate_index)
    ?? saved?.find(value => value.productKey === row.product_key && value.scope === 'product');
  if (!ref) return null;
  const tracked = trackedRates?.find(value => value.id === ref.id);
  const rateIndex = row.rate_index ?? null;
  const subscribed = notificationsEnabled && isProductSubscribed(row.product_key, rateIndex);
  const currentRate = toFraction(row.rate);
  const changeBps = tracked?.observedRate != null && currentRate != null
    ? Math.round((currentRate - tracked.observedRate) * 10_000) : 0;
  const dateKind = section === 'TD' ? 'term-maturity' : 'fixed-rate-end';
  const relevantDate = tracked?.relevantDate && tracked.relevantDateKind
    ? uiJoin(tracked.relevantDateKind === 'term-maturity' ? 'Matures' : 'Fixed rate ends', ': ', uiDate(tracked.relevantDate)) : null;
  const supportsDate = section === 'TD' || tracked?.relevantDateKind === 'fixed-rate-end'
    || row.rate_type?.toUpperCase().includes('FIXED') || row.ribbon_rate_structure?.toLowerCase() === 'fixed';
  const toggleAlert = async () => {
    if (isProductSubscribed(row.product_key, rateIndex) && notificationsEnabled) {
      unsubscribeProduct(row.product_key, rateIndex);
      return;
    }
    if (!(await ensurePermissions())) { Alert.alert('Notifications disabled'); return; }
    if (!notificationsEnabled) setPref('notificationsEnabled', true);
    if (!isProductSubscribed(row.product_key, rateIndex)) subscribeProduct(row.product_key, rateIndex, row);
  };
  const saveDate = async () => {
    try {
      await setTrackedRateRelevantDate(ref.id, dateValue.trim() || null, dateValue.trim() ? dateKind : null);
      setEditing(false);
    } catch (error) {
      Alert.alert(error instanceof RangeError ? 'Invalid date' : 'Date not saved',
        error instanceof RangeError ? 'YYYY-MM-DD' : 'Storage unavailable · Previous date retained');
    }
  };
  return <View testID="saved-rate-actions" style={{ gap: 8, marginBottom: 16 }}>
    <Row style={{ alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <View style={{ flex: 1 }}>
        <AppText variant="small" weight="700">{uiLabel('Saved rates')}</AppText>
        <AppText variant="tiny" color="textMuted">{ref.scope === 'product' ? uiLabel('All product variants · Legacy save')
          : changeBps ? uiJoin(changeBps > 0 ? 'Increase' : 'Decrease', ': ', uiNumber(Math.abs(changeBps) / 100, 2), ' ', 'percentage points', ' · ', 'Since saved')
            : uiJoin('Last updated', ': ', uiDate(row.last_updated ?? runDate))}</AppText>
      </View>
      <IconAction word="Alerts" icon={subscribed ? 'notifications' : 'notifications-outline'} active={subscribed}
        accessibilityLabel={subscribed ? 'Disable alerts' : 'Enable alerts'} accessibilityState={{ checked: subscribed }}
        onPress={() => void toggleAlert()} />
    </Row>
    {supportsDate ? <Button title={relevantDate ?? (section === 'TD' ? 'Add maturity date' : 'Add fixed-rate end date')}
      accessibilityLabel={relevantDate ? uiJoin('Edit', ' ', relevantDate)
        : section === 'TD' ? 'Add term deposit maturity date' : 'Add fixed rate end date'}
      icon="calendar-outline" variant="ghost" onPress={() => { setDateValue(tracked?.relevantDate ?? ''); setEditing(true); }} /> : null}
    {!supportsDate && relevantDate ? <AppText variant="small" color="textMuted">{relevantDate}</AppText> : null}
    <Modal visible={editing} transparent animationType={reducedMotion === false ? 'fade' : 'none'} onRequestClose={() => setEditing(false)}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <Card accessibilityViewIsModal style={{ gap: 14 }}>
          <View>
            <AppText variant="h3">{section === 'TD' ? uiLabel('Term deposit maturity') : uiLabel('Fixed-rate end')}</AppText>
            <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <AppText variant="tiny" color="textMuted">{uiLabel('Storage')}</AppText>
              <AppText variant="tiny">{uiJoin('This device', ' · ', 'Private')}</AppText>
            </Row>
          </View>
          <TextInput value={uiInputNumber(dateValue)} onChangeText={setDateValue} placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.colors.textFaint} autoFocus autoCapitalize="none" autoCorrect={false}
            inputMode="numeric" maxLength={10} accessibilityLabel="Date"
            style={{ ...fontStyle(), minHeight: 48, borderWidth: 1, borderColor: theme.colors.border,
              borderRadius: theme.radius.md, paddingHorizontal: 12, color: theme.colors.text,
              backgroundColor: theme.colors.surfaceAlt, fontSize: theme.font.body }} />
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {dateValue ? <Button title="Remove date" variant="ghost" onPress={() => setDateValue('')} /> : null}
            <View style={{ flex: 1 }} />
            <Button title="Cancel" variant="secondary" onPress={() => setEditing(false)} />
            <Button title="Save date" onPress={() => void saveDate()} />
          </Row>
        </Card>
      </View>
    </Modal>
  </View>;
}
