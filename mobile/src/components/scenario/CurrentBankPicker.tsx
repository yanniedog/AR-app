import Ionicons from '../icons/AppIcon';
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import type { CurrentProductReference } from '../../data/userRateScenario';
import { NOT_LISTED_PROVIDER } from '../../data/userRateScenario';
import { formatRate } from '../../data/format';
import { alphabeticalScenarioProviders, currentProductOptions } from '../../data/scenarioCatalog';
import type { RateRow } from '../../types';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText, Button, Card, Row } from '../ui';

function selectionLabel(value: CurrentProductReference): string {
  if (value.provider === NOT_LISTED_PROVIDER) return 'Not listed';
  return value.provider || 'Select bank';
}

export function CurrentBankPicker({
  label,
  rows,
  value,
  onChange,
  editable = true,
}: {
  label: string;
  rows: RateRow[];
  value: CurrentProductReference;
  onChange: (value: CurrentProductReference) => void;
  editable?: boolean;
}) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState<'bank' | 'product' | null>(null);
  const providers = useMemo(
    () => alphabeticalScenarioProviders(rows),
    [rows],
  );
  const products = useMemo(() => {
    if (!value.provider || value.provider === NOT_LISTED_PROVIDER) return [];
    return currentProductOptions(rows, value.provider);
  }, [rows, value.provider]);
  const selectedProduct = products.find((row) =>
    row.product_key === value.productKey && (row.rate_index ?? null) === value.rateIndex,
  );
  const chooseBank = (provider: string) => {
    onChange({ provider, productKey: '', rateIndex: null });
    setOpen(null);
  };
  const chooseProduct = (row: RateRow | null) => {
    onChange({
      provider: value.provider,
      productKey: row?.product_key ?? '',
      rateIndex: row?.rate_index ?? null,
    });
    setOpen(null);
  };
  const modalTitle = open === 'bank' ? label : 'Current product';
  return (
    <View style={{ gap: 8 }}>
      <AppText variant="tiny" color="textMuted" weight="700">{label}</AppText>
      <Pressable
        onPress={() => editable && setOpen('bank')}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${selectionLabel(value)}`}
        accessibilityHint="Opens an alphabetically sorted bank list"
        accessibilityState={{ disabled: !editable }}
        style={({ pressed }) => ({
          minHeight: 48,
          paddingHorizontal: 12,
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
          backgroundColor: theme.colors.surfaceAlt,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <AppText style={{ flex: 1 }} color={value.provider ? 'text' : 'textMuted'}>{selectionLabel(value)}</AppText>
        <Ionicons name="chevron-down" size={18} color={theme.colors.textFaint} />
      </Pressable>
      {value.provider && value.provider !== NOT_LISTED_PROVIDER ? (
        <Pressable
          onPress={() => editable && setOpen('product')}
          accessibilityRole="button"
          accessibilityLabel={`Current product, ${selectedProduct?.product_name ?? 'not matched'}`}
          accessibilityHint="Optional. Match the exact current product tier for published fee evidence."
          accessibilityState={{ disabled: !editable }}
          style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1, paddingVertical: 3 })}
        >
          <AppText variant="small" color="primary" weight="700">
            {selectedProduct ? selectedProduct.product_name : 'Match current product (optional)'}
          </AppText>
          {selectedProduct ? (
            <AppText variant="tiny" color="textMuted">
              {formatRate(selectedProduct.rate)} advertised{selectedProduct.comparison_rate ? ` · ${formatRate(selectedProduct.comparison_rate)} comparison` : ''}
            </AppText>
          ) : null}
        </Pressable>
      ) : null}
      <Modal
        visible={open != null}
        transparent
        animationType={reducedMotion === false ? 'fade' : 'none'}
        onRequestClose={() => setOpen(null)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            padding: 18,
            backgroundColor: 'rgba(0,0,0,0.64)',
          }}
        >
          <Card accessibilityViewIsModal style={{ maxHeight: '82%', gap: 12 }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <AppText variant="h3">{modalTitle}</AppText>
                <AppText variant="tiny" color="textMuted">
                  {open === 'bank' ? 'Banks are listed A–Z.' : 'Optional published-data match.'}
                </AppText>
              </View>
              <Button title="Close" variant="ghost" onPress={() => setOpen(null)} />
            </Row>
            <ScrollView keyboardShouldPersistTaps="handled">
              {open === 'bank' ? (
                <>
                  {providers.map((provider) => (
                    <Pressable
                      key={provider}
                      onPress={() => chooseBank(provider)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: value.provider === provider }}
                      style={({ pressed }) => ({
                        minHeight: 48,
                        justifyContent: 'center',
                        paddingHorizontal: 10,
                        borderBottomWidth: 1,
                        borderBottomColor: theme.colors.border,
                        backgroundColor: value.provider === provider ? theme.colors.chip : undefined,
                        opacity: pressed ? 0.65 : 1,
                      })}
                    >
                      <AppText weight={value.provider === provider ? '800' : '500'}>{provider}</AppText>
                    </Pressable>
                  ))}
                  <Pressable
                    onPress={() => chooseBank(NOT_LISTED_PROVIDER)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: value.provider === NOT_LISTED_PROVIDER }}
                    style={({ pressed }) => ({
                      minHeight: 48,
                      justifyContent: 'center',
                      paddingHorizontal: 10,
                      opacity: pressed ? 0.65 : 1,
                    })}
                  >
                    <AppText weight="700">Not listed</AppText>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable
                    onPress={() => chooseProduct(null)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: !value.productKey }}
                    style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 10 }}
                  >
                    <AppText weight="700">No exact match</AppText>
                  </Pressable>
                  {products.map((row) => {
                    const checked = row.product_key === value.productKey && (row.rate_index ?? null) === value.rateIndex;
                    return (
                      <Pressable
                        key={`${row.product_key}:${row.rate_index ?? ''}`}
                        onPress={() => chooseProduct(row)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked }}
                        accessibilityLabel={`${row.product_name}, ${formatRate(row.rate)} advertised rate`}
                        style={({ pressed }) => ({
                          minHeight: 56,
                          justifyContent: 'center',
                          paddingHorizontal: 10,
                          borderTopWidth: 1,
                          borderTopColor: theme.colors.border,
                          backgroundColor: checked ? theme.colors.chip : undefined,
                          opacity: pressed ? 0.65 : 1,
                        })}
                      >
                        <AppText weight={checked ? '800' : '500'}>{row.product_name}</AppText>
                        <AppText variant="tiny" color="textMuted">
                          {formatRate(row.rate)} advertised{row.comparison_rate ? ` · ${formatRate(row.comparison_rate)} comparison` : ''}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </>
              )}
            </ScrollView>
          </Card>
        </View>
      </Modal>
    </View>
  );
}
