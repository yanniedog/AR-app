import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { usePublicRateCatalogue } from '../../data/publicRateCatalogue';
import { publicRateOriginLabel, publicRateReason, publicRateText, publicReferenceScope } from '../../data/publicRatePresentation';
import { publicRateScenario, resolveLocalCurrentRate } from '../../data/publicRateIntegration';
import { decimalText, rateDecimal } from '../../data/publicRateDecimal';
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

/** Only numerical assumptions and selected public identities enter protected local storage. */
export function LocalRateEditor({ section, scenario, onChange, editable, children }: {
  section: SectionKey;
  scenario: UserRateScenario;
  onChange: (patch: Partial<LocalRateInputs>) => void;
  editable: boolean;
  children?: React.ReactNode;
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
  const providerIds = new Set([...catalogue.products, ...catalogue.coverage]
    .filter(item => item.providerName.trim().toLocaleLowerCase('en-AU') === providerName).map(item => item.providerId));
  const providerNames = new Map([...catalogue.products, ...catalogue.coverage]
    .map(item => [item.providerId, item.providerName]));
  const references = catalogue.references.filter(reference => product ? product.referenceIds.includes(reference.referenceId)
    : !providerName || providerIds.has(reference.providerId));
  const now = new Date().toISOString();
  const selected = selectPublicReference(references, local.referenceId, now).reference;
  const result = resolveLocalCurrentRate(section, scenario, references, now, catalogue, profile);
  const assumptions: RateScenario = { ...publicRateScenario(section, scenario, profile), ...local.referenceScenario };
  const scopeFields = new Set(['purpose', 'repayment', 'package', 'customerCategory', 'channel', 'termMonths', 'termDays']);
  const fields = [...new Map((selected?.conditions ?? []).filter(condition => scopeFields.has(condition.field)).map(condition => [condition.field, condition])).values()];
  const inputStyle = { color: theme.colors.text, minHeight: 48, padding: 10, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md };
  const fieldLabel: Record<string, string> = { purpose: 'Purpose', repayment: 'Repayment', package: 'Package', customerCategory: 'Customer category', channel: 'Channel', termMonths: 'Fixed/quoted term (months)', termDays: 'Quoted term (days)' };
  const setScope = (field: string, value: string) => {
    if (editable) onChange({ referenceScenario: { ...local.referenceScenario, [field]: value } });
  };
  const { status: catalogueStatus, allLoaded, loadAll } = catalogue;
  useEffect(() => {
    if (local.mode === 'reference' && catalogueStatus === 'ready' && !allLoaded) void loadAll().catch(() => undefined);
  }, [local.mode, catalogueStatus, allLoaded, loadAll]);
  const modeChange = (mode: LocalRateInputs['mode']) => { if (editable) onChange({ mode }); };
  return <View style={{ gap: 10 }}>
    <SegmentedControl options={[
      { value: 'entered', label: 'Enter current rate' },
      { value: 'reference', label: 'Reference + adjustment' },
    ]} value={local.mode} onChange={modeChange} />
    {local.mode === 'entered' ? children : <>
      <Button title={selected?.name ?? 'Select public reference rate'} variant="secondary" onPress={() => editable && setSelecting(true)} disabled={!editable} />
      {selected ? <AppText variant="tiny" color="textMuted">{publicReferenceScope(selected)}</AppText> : null}
      {fields.length ? <View style={{ gap: 8 }}>
        <AppText variant="small" weight="600">Existing loan reference scope</AppText>
        <AppText variant="tiny" color="textMuted">Scope values: explicit assumptions · Blank values: unknown</AppText>
        {fields.map(condition => {
          const values = condition.operator === 'eq' ? [condition.value] : condition.values;
          const options = (values ?? []).filter((value): value is string => typeof value === 'string');
          const currentValue = assumptions[condition.field];
          return <View key={condition.field} style={{ gap: 4 }}>
            <AppText variant="tiny" color="textMuted">{fieldLabel[condition.field]}</AppText>
            {options.length ? <View style={{ gap: 4 }}>
              {options.map(value => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: currentValue === value, disabled: !editable }}
                disabled={!editable} style={{ minHeight: 44, padding: 8, borderWidth: 1, borderColor: currentValue === value ? theme.colors.primary : theme.colors.border, borderRadius: theme.radius.md }}
                onPress={() => setScope(condition.field, value)}>
                <AppText variant="small">{value.toLowerCase().replace(/_/g, ' ')}</AppText>
              </Pressable>)}
              {currentValue != null && !options.includes(String(currentValue)) ? <AppText variant="tiny" color="textMuted">Selected value: {String(currentValue).toLowerCase().replace(/_/g, ' ')} · Reference scope: unmet</AppText> : null}
            </View> : <TextInput value={typeof currentValue === 'string' ? currentValue : ''} editable={editable}
              onChangeText={value => setScope(condition.field, value)} keyboardType={condition.field.startsWith('term') ? 'decimal-pad' : 'default'}
              accessibilityLabel={`Existing loan ${fieldLabel[condition.field]}`} placeholder="Unknown" placeholderTextColor={theme.colors.textFaint} style={inputStyle} />}
          </View>;
        })}
      </View> : null}
      <AppText variant="tiny" color="textMuted">Discount sign: − · Public discounts: included in total adjustment</AppText>
      <View style={{ gap: 4 }}>
        <AppText variant="tiny" color="textMuted">Total signed adjustment (percentage points)</AppText>
        <TextInput value={local.totalAdjustment} onChangeText={totalAdjustment => { if (editable) onChange({ totalAdjustment }); }}
          editable={editable} keyboardType="numbers-and-punctuation" accessibilityLabel="Total signed adjustment in percentage points; negative discounts"
          placeholder="-2.50" placeholderTextColor={theme.colors.textFaint}
          style={inputStyle} />
      </View>
      {selected?.value != null ? <AppText variant="small">{decimalText(rateDecimal(selected.value, selected.unit).mul(rateDecimal('100', 'fraction_per_annum')))}% reference + {local.totalAdjustment || '?'} percentage points = {publicRateText(result)}</AppText> : null}
      <CompactToggle label="Historical reference assumption" value={local.allowHistorical} onChange={allowHistorical => { if (editable) onChange({ allowHistorical }); }} />
      <CompactToggle label="Watch public reference-rate changes" value={local.referenceChangeAlerts} onChange={referenceChangeAlerts => {
        if (!editable) return;
        if (!referenceChangeAlerts) { onChange({ referenceChangeAlerts }); return; }
        void ensurePermissions().then(allowed => {
          if (allowed) { useStore.getState().setPref('notificationsEnabled', true); onChange({ referenceChangeAlerts: true }); }
        });
      }} />
      {result.reasonCodes.map(reason => <AppText variant="tiny" color="textMuted" key={reason}>{publicRateReason(reason)}</AppText>)}
      {selected?.freshness.lastSuccessAt ? <AppText variant="tiny" color="textMuted">Successful reference check: {selected.freshness.lastSuccessAt}</AppText> : null}
      {catalogue.status === 'loading' || !catalogue.allLoaded && catalogue.status === 'ready' ? <AppText variant="tiny" color="textMuted">Public reference families: loading</AppText> : null}
      {catalogue.status === 'unavailable' ? <AppText variant="tiny" color="textMuted">Public references: unavailable · Entered rate: retained</AppText> : null}
    </>}
    {result.status === 'exact' ? <AppText variant="tiny" color="textMuted">{publicRateOriginLabel(result)} · {publicRateText(result)} · Storage: protected on device · Public updates: entered rate unchanged</AppText> : null}
    <Modal transparent visible={selecting} onRequestClose={() => setSelecting(false)} animationType="none">
      <View style={{ flex: 1, padding: 18, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.64)' }}>
        <Card accessibilityViewIsModal style={{ maxHeight: '82%', gap: 10 }}>
          <AppText variant="h3">Choose a reference family</AppText>
          <AppText variant="tiny" color="textMuted">Reference scope: purpose, repayment, package, customer category</AppText>
          <AppText variant="tiny" color="textMuted">Selection: family · Applied version: effective on calculation date · Scheduled version: inactive until effective date</AppText>
          <ScrollView keyboardShouldPersistTaps="handled">
            {references.map(reference => <Pressable key={`${reference.referenceId}:${reference.effectiveFrom ?? ''}:${reference.scopeId ?? ''}`} accessibilityRole="radio"
              accessibilityState={{ checked: reference.referenceId === local.referenceId }}
              style={{ minHeight: 56, paddingVertical: 8 }} onPress={() => {
                if (editable) onChange({ referenceId: reference.referenceId }); setSelecting(false);
              }}>
              <AppText weight="600">{reference.name}</AppText>
              <AppText variant="tiny" color="textMuted">{publicReferenceScope(reference)}</AppText>
              <AppText variant="tiny" color="textMuted">{providerNames.get(reference.providerId) ?? 'Bank name unavailable'} · {reference.freshness.state}{reference.effectiveFrom ? `${Date.parse(reference.effectiveFrom) > Date.parse(now) ? ' · scheduled from ' : ' · effective from '}${reference.effectiveFrom}` : ''}{reference.effectiveTo ? ` · until ${reference.effectiveTo}` : ''}</AppText>
            </Pressable>)}
            {!references.length ? <AppText variant="small" color="textMuted">Reviewed reference: unavailable</AppText> : null}
          </ScrollView>
          <Button title="Close" variant="ghost" onPress={() => setSelecting(false)} />
        </Card>
      </View>
    </Modal>
  </View>;
}
