import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { usePublicRateCatalogue } from '../../data/publicRateCatalogue';
import { publicRateOriginLabel, publicRateReason, publicRateText, publicReferenceScope } from '../../data/publicRatePresentation';
import { publicRateScenario, resolveLocalCurrentRate } from '../../data/publicRateIntegration';
import { rateDecimal, decimalText } from '../../data/publicRateDecimal';
import { selectPublicReference } from '../../data/publicRateLocal';
import { useStore } from '../../data/store';
import { ensurePermissions } from '../../data/notifications';
import type { LocalRateInputs, UserRateScenario } from '../../data/userRateScenario';
import { EMPTY_LOCAL_RATE_INPUTS } from '../../data/userRateScenario';
import type { RateScenario } from '../../data/publicRateModel';
import type { SectionKey } from '../../types';
import { useTheme } from '../../theme/ThemeProvider';
import { SegmentedControl, CompactToggle } from '../controls';
import { AppText, Button, Card } from '../ui';
import { uiDate, uiIdentifier, uiInputIdentifier, uiInputNumber, uiJoin, uiLabel, uiOpaqueEnum, uiPublicProviderName, uiPublicReferenceName, uiRate, type UiCopy } from '../../lib/uiCopy';

/** Numerical assumptions and selected public identities use protected local storage. */
export function LocalRateEditor({ section, scenario, onChange, editable, children }: {
  section: SectionKey; scenario: UserRateScenario; onChange: (patch: Partial<LocalRateInputs>) => void;
  editable: boolean; children?: React.ReactElement;
}) {
  const theme = useTheme();
  const manifest = useStore(state => state.manifest);
  const profile = useStore(state => state.prefs?.profileFilters);
  const catalogue = usePublicRateCatalogue(manifest);
  const [selecting, setSelecting] = useState(false);
  const key = section === 'Mortgage' ? 'mortgage' : section === 'TD' ? 'termDeposit' : 'savings';
  const local = scenario?.localRates?.[key] ?? EMPTY_LOCAL_RATE_INPUTS;
  const current = scenario?.currentProducts?.[key];
  const product = catalogue.getProduct(current?.productKey ?? '');
  const providerName = current?.provider?.trim().toLocaleLowerCase('en-AU') ?? '';
  const providerModels = [...catalogue.products, ...catalogue.coverage];
  const providerIds = new Set(providerModels.filter(item => item.providerName.trim().toLocaleLowerCase('en-AU') === providerName).map(item => item.providerId));
  const references = catalogue.references.filter(reference => product ? product.referenceIds.includes(reference.referenceId) : !providerName || providerIds.has(reference.providerId));
  const now = new Date().toISOString();
  const selected = selectPublicReference(references, local.referenceId, now).reference;
  const result = resolveLocalCurrentRate(section, scenario, references, now, catalogue, profile);
  const assumptions: RateScenario = { ...publicRateScenario(section, scenario, profile), ...local.referenceScenario };
  const scopeFields = new Set(['purpose', 'repayment', 'package', 'customerCategory', 'channel', 'termMonths', 'termDays']);
  const fields = [...new Map((selected?.conditions ?? []).filter(condition => scopeFields.has(condition.field)).map(condition => [condition.field, condition])).values()];
  const inputStyle = { color: theme.colors.text, minHeight: 48, padding: 10, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md };
  const fieldLabel: Record<string, UiCopy> = { purpose: 'Purpose', repayment: 'Repayment', package: 'Package', customerCategory: 'Customer category', channel: 'Channel', termMonths: uiJoin('Fixed term', ' (', 'months', ')'), termDays: uiJoin('Quoted term', ' (', 'days', ')') };
  const setScope = (field: string, value: string) => { if (editable) onChange({ referenceScenario: { ...local.referenceScenario, [field]: value } }); };
  const { status: catalogueStatus, allLoaded, loadAll } = catalogue;
  useEffect(() => {
    if (local.mode === 'reference' && catalogueStatus === 'ready' && !allLoaded) void loadAll().catch(() => undefined);
  }, [local.mode, catalogueStatus, allLoaded, loadAll]);
  return <View style={{ gap: 10 }}>
    <SegmentedControl options={[{ value: 'entered', label: 'Current rate' }, { value: 'reference', label: 'Reference + adjustment' }]}
      value={local.mode} onChange={mode => { if (editable) onChange({ mode }); }} />
    {local.mode === 'entered' ? children : <>
      <Button title={selected ? uiPublicReferenceName(selected) : uiLabel('Select reference')} variant="secondary" onPress={() => editable && setSelecting(true)} disabled={!editable} />
      {selected ? <AppText variant="tiny" color="textMuted">{publicReferenceScope(selected)}</AppText> : null}
      {fields.length ? <View style={{ gap: 8 }}>
        <AppText variant="small" weight="600">{uiLabel('Reference scope')}</AppText>
        {fields.map(condition => {
          const values = condition.operator === 'eq' ? [condition.value] : condition.values;
          const options = (values ?? []).filter((value): value is string => typeof value === 'string');
          const currentValue = assumptions[condition.field];
          const label = fieldLabel[condition.field] ?? uiOpaqueEnum(condition.field.toUpperCase());
          return <View key={condition.field} style={{ gap: 4 }}>
            <AppText variant="tiny" color="textMuted">{label}</AppText>
            {options.length ? <View style={{ gap: 4 }}>
              {options.map(value => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={uiOpaqueEnum(value.toUpperCase())}
                accessibilityState={{ checked: currentValue === value, disabled: !editable }} disabled={!editable}
                style={{ minHeight: 48, padding: 8, borderWidth: 1, borderColor: currentValue === value ? theme.colors.primary : theme.colors.border, borderRadius: theme.radius.md }}
                onPress={() => setScope(condition.field, value)}>
                <AppText variant="small">{uiOpaqueEnum(value.toUpperCase())}</AppText>
              </Pressable>)}
              {currentValue != null && !options.includes(String(currentValue)) ? <AppText variant="tiny" color="textMuted">{uiJoin('Selected', ': ', uiOpaqueEnum(String(currentValue).toUpperCase()), ' · ', 'Reference scope', ': ', 'Unmet')}</AppText> : null}
            </View> : <TextInput value={condition.field.startsWith('term') ? uiInputNumber(typeof currentValue === 'string' ? currentValue : '') : uiInputIdentifier(typeof currentValue === 'string' ? currentValue : '')} editable={editable} onChangeText={value => setScope(condition.field, value)}
              keyboardType={condition.field.startsWith('term') ? 'decimal-pad' : 'default'} accessibilityLabel={label} placeholder="Unknown" placeholderTextColor={theme.colors.textFaint} style={inputStyle} />}
          </View>;
        })}
      </View> : null}
      <AppText variant="tiny" color="textMuted">{uiJoin('Discount sign', ': ', '−', ' · ', 'Public discounts', ': ', 'Included', ' · ', 'Total adjustment')}</AppText>
      <View style={{ gap: 4 }}>
        <AppText variant="tiny" color="textMuted">{uiLabel('Total adjustment (pp)')}</AppText>
        <TextInput value={uiInputNumber(local.totalAdjustment)} onChangeText={totalAdjustment => { if (editable) onChange({ totalAdjustment }); }} editable={editable}
          keyboardType="numbers-and-punctuation" accessibilityLabel="Total adjustment (pp)" placeholder={uiInputNumber('-2.50')} placeholderTextColor={theme.colors.textFaint} style={inputStyle} />
      </View>
      {selected?.value != null ? <AppText variant="small">{uiJoin('Reference rate', ': ', uiRate(Number(decimalText(rateDecimal(selected.value, selected.unit))), 4), ' · ', 'Adjustment', ': ', uiInputNumber(local.totalAdjustment), ' ', 'pp', ' · ', '=', ' ', publicRateText(result))}</AppText> : null}
      <CompactToggle label="Historical reference" value={local.allowHistorical} onChange={allowHistorical => { if (editable) onChange({ allowHistorical }); }} />
      <CompactToggle label="Reference alerts" value={local.referenceChangeAlerts} onChange={referenceChangeAlerts => {
        if (!editable) return;
        if (!referenceChangeAlerts) { onChange({ referenceChangeAlerts }); return; }
        void ensurePermissions().then(allowed => { if (allowed) { useStore.getState().setPref('notificationsEnabled', true); onChange({ referenceChangeAlerts: true }); } });
      }} />
      {result.reasonCodes.map(reason => <AppText variant="tiny" color="textMuted" key={reason}>{publicRateReason(reason)}</AppText>)}
      {selected?.freshness.lastSuccessAt ? <AppText variant="tiny" color="textMuted">{uiJoin('Last successful check', ': ', uiDate(selected.freshness.lastSuccessAt))}</AppText> : null}
      {catalogue.status === 'loading' || !catalogue.allLoaded && catalogue.status === 'ready' ? <AppText variant="tiny" color="textMuted">{uiJoin('Public reference', ': ', 'Loading')}</AppText> : null}
      {catalogue.status === 'unavailable' ? <AppText variant="tiny" color="textMuted">{uiJoin('Public reference', ': ', 'Unavailable')}</AppText> : null}
    </>}
    {result.status === 'exact' ? <AppText variant="tiny" color="textMuted">{uiJoin(publicRateOriginLabel(result), ' · ', publicRateText(result), ' · ', 'Storage', ': ', 'Protected on device')}</AppText> : null}
    <Modal transparent visible={selecting} onRequestClose={() => setSelecting(false)} animationType="none">
      <View style={{ flex: 1, padding: 18, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.64)' }}>
        <Card accessibilityViewIsModal style={{ maxHeight: '82%', gap: 10 }}>
          <AppText variant="h3">{uiLabel('Select reference')}</AppText>
          <ScrollView keyboardShouldPersistTaps="handled">
            {references.map(reference => {
              const provider = providerModels.find(item => item.providerId === reference.providerId);
              return <Pressable key={reference.referenceId + ':' + (reference.effectiveFrom ?? '') + ':' + (reference.scopeId ?? '')} accessibilityRole="radio"
                accessibilityState={{ checked: reference.referenceId === local.referenceId }} style={{ minHeight: 56, paddingVertical: 8 }}
                onPress={() => { if (editable) onChange({ referenceId: reference.referenceId }); setSelecting(false); }}>
                <AppText weight="600">{uiPublicReferenceName(reference)}</AppText>
                <AppText variant="tiny" color="textMuted">{publicReferenceScope(reference)}</AppText>
                <AppText variant="tiny" color="textMuted">{uiJoin(provider ? uiPublicProviderName(provider) : uiIdentifier(reference.providerId), ' · ', uiOpaqueEnum(reference.freshness.state.toUpperCase()),
                  reference.effectiveFrom ? uiJoin(' · ', 'Effective from', ': ', uiDate(reference.effectiveFrom)) : null, reference.effectiveTo ? uiJoin(' · ', 'Effective to', ': ', uiDate(reference.effectiveTo)) : null)}</AppText>
              </Pressable>;
            })}
            {!references.length ? <AppText variant="small" color="textMuted">{uiJoin('Public reference', ': ', 'Unavailable')}</AppText> : null}
          </ScrollView>
          <Button title="Close" variant="ghost" onPress={() => setSelecting(false)} />
        </Card>
      </View>
    </Modal>
  </View>;
}
