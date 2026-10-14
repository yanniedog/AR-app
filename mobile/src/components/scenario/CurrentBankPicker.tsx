import { useSuitabilityRevision } from '../../hooks/useSuitabilityRevision';
import Ionicons from '../icons/AppIcon';
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import type { CurrentProductReference } from '../../data/userRateScenario';
import { NOT_LISTED_PROVIDER } from '../../data/userRateScenario';
import { formatRate } from '../../data/format';
import { alphabeticalScenarioProviders, currentProductDiscovery, currentProductSelectionMatches, type CurrentProductOption } from '../../data/scenarioCatalog';
import type { RateRow, SectionKey } from '../../types';
import { useStore } from '../../data/store';
import { usePublicRateCatalogue } from '../../data/publicRateCatalogue';
import { PublicRateEvidence } from './PublicRateEvidence';
import { bindCurrentPublicRow } from '../../data/publicRateIntegration';
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
  section,
}: {
  label: string;
  rows: RateRow[];
  value: CurrentProductReference;
  onChange: (value: CurrentProductReference) => void;
  editable?: boolean;
  section?: SectionKey;
}) {
  const revision = useSuitabilityRevision();
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState<'bank' | 'product' | null>(null);
  const manifest = useStore(state => state.manifest);
  const catalogue = usePublicRateCatalogue(manifest);
  const publicRows = useMemo(() => rows.map(row => bindCurrentPublicRow(row, catalogue)), [rows, catalogue]);
  const discovery = useMemo(() => catalogue.products.filter(product => !section || product.section === section), [catalogue.products, section]);
  const providers = useMemo(
    () => { void revision; return open === 'bank' ? alphabeticalScenarioProviders(rows, discovery, catalogue.coverage.filter(item => !section || item.section === section).map(item => item.providerName)) : []; },
    [open, rows, discovery, catalogue.coverage, section, revision],
  );
  const products = useMemo(() => {
    void revision;
    if (open !== 'product' || !value.provider || value.provider === NOT_LISTED_PROVIDER) return [];
    return currentProductDiscovery(publicRows, discovery, value.provider, section);
  }, [open, publicRows, discovery, value.provider, section, revision]);
  const selectedProduct = useMemo(() => {
    void revision;
    if (!value.productKey) return undefined;
    return currentProductDiscovery(publicRows, discovery, value.provider, section).find(option => currentProductSelectionMatches(option, value));
  }, [publicRows, discovery, value, section, revision]);
  const chooseBank = (provider: string) => {
    onChange({ provider, productKey: '', rateIndex: null });
    setOpen(null);
  };
  const chooseProduct = async (option: CurrentProductOption | null) => {
    if (option?.row && option.product && catalogue.status === 'ready' && !option.offerId) {
      await catalogue.loadProduct(option.product.productId).catch(() => undefined);
      const bound = bindCurrentPublicRow(option.row, catalogue);
      option = { ...option, offerId: bound.public_offer_id, programmeId: bound.public_programme_id };
    }
    onChange({
      provider: value.provider,
      productKey: option?.productKey ?? '',
      rateIndex: option?.row?.rate_index ?? null,
      ...(option?.offerId ? { offerId: option.offerId } : {}),
      ...(option?.programmeId ? { programmeId: option.programmeId } : {}),
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
          accessibilityLabel={`Current product, ${selectedProduct?.name ?? 'not matched'}`}
          accessibilityHint="Select the product and pricing regime explicitly; entered rates stay unchanged."
          accessibilityState={{ disabled: !editable }}
          style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1, paddingVertical: 3 })}
        >
          <AppText variant="small" color="primary" weight="700">
            {selectedProduct ? selectedProduct.name : 'Find current product (optional)'}
          </AppText>
          {selectedProduct ? (
            <AppText variant="tiny" color="textMuted">
              {selectedProduct.row ? `${formatRate(selectedProduct.row.rate)} published rate` : 'Product identified · pricing needs public evidence'}
            </AppText>
          ) : null}
        </Pressable>
      ) : null}
      {selectedProduct ? <PublicRateEvidence productKey={selectedProduct.productKey} programmeId={value.programmeId} row={selectedProduct.row} compact
        onSelectProgramme={(programmeId, offerId) => onChange({ ...value, programmeId, offerId })} /> : null}
      {catalogue.status === 'error' ? <AppText variant="tiny" color="textMuted">Public product discovery could not load. {catalogue.error}</AppText> : null}
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
                  {open === 'bank' ? 'Banks are listed A–Z, including products without a resolved rate.' : 'Choose the exact product and pricing regime. Your entered rate stays unchanged.'}
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
              ) : open === 'product' ? (
                <>
                  <Pressable
                    onPress={() => void chooseProduct(null)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: !value.productKey }}
                    style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 10 }}
                  >
                    <AppText weight="700">No exact match</AppText>
                  </Pressable>
                  {products.map((option) => {
                    const row = option.row;
                    const checked = currentProductSelectionMatches(option, value);
                    return (
                      <Pressable
                        key={`${option.productKey}:${option.offerId ?? row?.rate_index ?? 'discovery'}`}
                        onPress={() => void chooseProduct(option)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked }}
                        accessibilityLabel={`${option.name}, ${row ? `${formatRate(row.rate)} published rate` : 'pricing unresolved'}`}
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
                        <AppText weight={checked ? '800' : '500'}>{option.name}</AppText>
                        <AppText variant="tiny" color="textMuted">
                          {row ? `${formatRate(row.rate)} published${row.comparison_rate ? ` · ${formatRate(row.comparison_rate)} comparison` : ''}` : 'Pricing unresolved · available to identify'}
                        </AppText>
                        {option.aliases.length ? <AppText variant="tiny" color="textMuted">Also known as {option.aliases.join(', ')}</AppText> : null}
                        {option.status === 'legacy' ? <AppText variant="tiny" color="textMuted">Not available for new applications</AppText> : null}
                      </Pressable>
                    );
                  })}
                </>
              ) : null}
            </ScrollView>
          </Card>
        </View>
      </Modal>
    </View>
  );
}
