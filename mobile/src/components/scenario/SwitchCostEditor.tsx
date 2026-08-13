import React, { useMemo, useState } from 'react';
import { Platform, TextInput, View } from 'react-native';

import { resolveSwitchCosts, type SwitchFeeKey } from '../../data/staySwitchProjection';
import type { MortgageSwitchInputs } from '../../data/userRateScenario';
import type { ProductDetail } from '../../types';
import { useTheme } from '../../theme/ThemeProvider';
import { SegmentedControl } from '../controls';
import { AppText, Disclosure, Row } from '../ui';

const labels: { key: SwitchFeeKey; label: string; accessibilityLabel: string }[] = [
  { key: 'currentBankExitFees', label: 'Current bank exit fees', accessibilityLabel: 'Current bank exit fees in dollars' },
  { key: 'applicationFees', label: 'Application fees', accessibilityLabel: 'New bank application fees in dollars' },
  { key: 'valuationFees', label: 'Valuation fees', accessibilityLabel: 'Valuation fees in dollars' },
  { key: 'settlementFees', label: 'Settlement fees', accessibilityLabel: 'Settlement fees in dollars' },
  { key: 'governmentAndLegalFees', label: 'Government & legal', accessibilityLabel: 'Government and legal fees in dollars' },
  { key: 'otherUpfrontFees', label: 'Other upfront fees', accessibilityLabel: 'Other upfront fees in dollars' },
];

function dollars(value: number): string {
  return `$${Math.round(value).toLocaleString('en-AU')}`;
}
function AmountField({
  label,
  accessibilityLabel,
  value,
  placeholder,
  editable,
  onChangeText,
}: {
  label: string;
  accessibilityLabel: string;
  value: string;
  placeholder: string;
  editable: boolean;
  onChangeText: (value: string) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, minWidth: 150, gap: 4 }}>
      <AppText variant="tiny" color="textMuted" weight="700">{label}</AppText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textFaint}
        keyboardType="decimal-pad"
        editable={editable}
        maxLength={20}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: !editable }}
        style={{
          minHeight: 48,
          color: theme.colors.text,
          backgroundColor: theme.colors.surfaceAlt,
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
          paddingHorizontal: 12,
          paddingVertical: Platform.OS === 'android' ? 8 : 12,
        }}
      />
    </View>
  );
}

export function SwitchCostEditor({
  inputs,
  currentDetail,
  targetDetail,
  editable,
  compactFields,
  onChange,
}: {
  inputs: MortgageSwitchInputs;
  currentDetail: ProductDetail | null;
  targetDetail: ProductDetail | null;
  editable: boolean;
  compactFields: boolean;
  onChange: (patch: Partial<MortgageSwitchInputs>) => void;
}) {
  const [open, setOpen] = useState(false);
  const costs = useMemo(
    () => resolveSwitchCosts(inputs, currentDetail, targetDetail),
    [currentDetail, inputs, targetDetail],
  );
  const placeholder = (key: SwitchFeeKey): string => {
    const resolved = costs.fees.find((item) => item.key === key);
    return resolved?.source === 'published' ? String(resolved.amount) : '0';
  };
  return (
    <Disclosure
      title="Switch costs"
      summary={costs.gaps.length ? `${costs.gaps.length} amounts to check` : `${dollars(costs.netSwitchCost)} net upfront`}
      open={open}
      onToggle={() => setOpen((value) => !value)}
    >
      <AppText variant="tiny" color="textMuted" style={{ marginBottom: 10 }}>
        Blank fields use numeric published fees from your matched current product and leading matched rate. Check missing amounts.
      </AppText>
      {labels.map((item, index) => index % 2 === 0 ? (
        <Row
          key={item.key}
          gap={10}
          style={{
            marginTop: index ? 10 : 0,
            ...(compactFields ? { flexDirection: 'column', alignItems: 'stretch' } : null),
          }}
        >
          {[item, labels[index + 1]].filter(Boolean).map((field) => (
            <AmountField
              key={field.key}
              label={field.label}
              accessibilityLabel={field.accessibilityLabel}
              value={inputs[field.key]}
              placeholder={placeholder(field.key)}
              editable={editable}
              onChangeText={(value) => onChange({ [field.key]: value })}
            />
          ))}
        </Row>
      ) : null)}
      <View style={{ marginTop: 10 }}>
        <AmountField
          label="Cashback"
          accessibilityLabel="Eligible cashback in dollars"
          value={inputs.cashback}
          placeholder="0"
          editable={editable}
          onChangeText={(cashback) => onChange({ cashback })}
        />
      </View>
      <AppText variant="tiny" color="textMuted" weight="700" style={{ marginTop: 12, marginBottom: 7 }}>FUND NET COSTS</AppText>
      <SegmentedControl<MortgageSwitchInputs['fundingMethod']>
        options={[
          { label: 'Cash / offset', value: 'cash-or-offset' },
          { label: 'New loan', value: 'new-loan' },
        ]}
        value={inputs.fundingMethod}
        onChange={(fundingMethod) => editable && onChange({ fundingMethod })}
      />
      <AppText variant="tiny" color="textMuted" weight="700" style={{ marginTop: 12, marginBottom: 7 }}>TARGET OFFSET</AppText>
      <SegmentedControl<MortgageSwitchInputs['targetOffsetAvailable']>
        options={[
          { label: 'Published', value: 'auto' },
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' },
        ]}
        value={inputs.targetOffsetAvailable}
        onChange={(targetOffsetAvailable) => editable && onChange({ targetOffsetAvailable })}
      />
      {costs.unpricedPeriodicFees.length ? (
        <AppText variant="tiny" color="textMuted" style={{ marginTop: 10 }}>
          {costs.unpricedPeriodicFees.length} periodic fee{costs.unpricedPeriodicFees.length === 1 ? '' : 's'} lack a reliable published amount or cadence and are excluded.
        </AppText>
      ) : null}
    </Disclosure>
  );
}
