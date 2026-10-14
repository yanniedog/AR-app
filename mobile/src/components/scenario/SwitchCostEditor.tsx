import { fontStyle } from '../../theme/fonts';
import React, { useMemo, useState } from 'react';
import { Platform, TextInput, View } from 'react-native';

import { resolveSwitchCosts, type SwitchFeeKey } from '../../data/staySwitchProjection';
import type { MortgageSwitchInputs } from '../../data/userRateScenario';
import type { ProductDetail } from '../../types';
import { useTheme } from '../../theme/ThemeProvider';
import { SegmentedControl } from '../controls';
import { AppText, Disclosure, Row } from '../ui';
import { uiLabel, uiCount, uiInputNumber, uiJoin, uiMoney, uiNumber, type UiCopy, type UiText } from '../../lib/uiCopy';

const labels: { key: SwitchFeeKey; label: UiCopy; accessibilityLabel: UiCopy }[] = [
  { key: 'currentBankExitFees', accessibilityLabel: 'Current bank exit fees', label: 'Current bank exit fees' },
  { key: 'applicationFees', accessibilityLabel: 'Application fees', label: 'Application fees' },
  { key: 'valuationFees', accessibilityLabel: 'Valuation fees', label: 'Valuation fees' },
  { key: 'settlementFees', accessibilityLabel: 'Settlement fees', label: 'Settlement fees' },
  { key: 'governmentAndLegalFees', accessibilityLabel: 'Government & legal', label: 'Government & legal' },
  { key: 'otherUpfrontFees', accessibilityLabel: 'Other upfront fees', label: 'Other upfront fees' },
];

function AmountField({
  label,
  accessibilityLabel,
  value,
  placeholder,
  editable,
  onChangeText,
}: {
  label: UiCopy;
  accessibilityLabel: UiCopy;
  value: UiText;
  placeholder: UiCopy;
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
          ...fontStyle(),
          fontSize: theme.font.body,
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
  const placeholder = (key: SwitchFeeKey): UiCopy => {
    const resolved = costs.fees.find((item) => item.key === key);
    return resolved?.source === 'published' ? uiNumber(resolved.amount, 2) : 'Unknown';
  };
  return (
    <Disclosure
      title="Switch costs"
      open={open}
      onToggle={() => setOpen((value) => !value)}
    >
      <AppText variant="small" color="textMuted">{uiJoin('Known costs', ': ', uiMoney(costs.netSwitchCost), ' · ', 'Fees unverified')}</AppText>
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
              value={uiInputNumber(inputs[field.key])}
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
          accessibilityLabel="Cashback"
          value={uiInputNumber(inputs.cashback)}
          placeholder="Unknown"
          editable={editable}
          onChangeText={(cashback) => onChange({ cashback })}
        />
      </View>
      <AppText variant="tiny" color="textMuted" weight="700" style={{ marginTop: 12, marginBottom: 7 }}>{uiLabel("Funding")}</AppText>
      <SegmentedControl<MortgageSwitchInputs['fundingMethod']>
        options={[
          { label: 'Cash / offset', value: 'cash-or-offset' },
          { label: 'New loan', value: 'new-loan' },
        ]}
        value={inputs.fundingMethod}
        onChange={(fundingMethod) => editable && onChange({ fundingMethod })}
      />
      <AppText variant="tiny" color="textMuted" weight="700" style={{ marginTop: 12, marginBottom: 7 }}>{uiLabel("Target offset")}</AppText>
      <SegmentedControl<MortgageSwitchInputs['targetOffsetAvailable']>
        options={[
          { label: 'Published', value: 'auto' },
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' },
        ]}
        value={inputs.targetOffsetAvailable}
        onChange={(targetOffsetAvailable) => editable && onChange({ targetOffsetAvailable })}
      />
      {costs.unpricedPeriodicFees.length ? <AppText variant="tiny" color="textMuted">{uiJoin('Unpriced fees', ': ', uiCount(costs.unpricedPeriodicFees.length))}</AppText> : null}
      {!costs.costClaimsAvailable ? <AppText variant="tiny" color="warning">{uiJoin('Total-cost difference', ' · ', 'Unavailable', ' · ', 'Eligibility unverified')}</AppText> : null}
    </Disclosure>
  );
}
