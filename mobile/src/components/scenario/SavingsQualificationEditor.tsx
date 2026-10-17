import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import type { ProjectionInputs } from '../../data/projectionScenario';
import { useTheme } from '../../theme/ThemeProvider';
import { SegmentedControl } from '../controls';
import { AppText, Disclosure } from '../ui';
import { uiJoin, uiInputNumber } from '../../lib/uiCopy';

export function SavingsQualificationEditor({ inputs, onChange, editable }: {
  inputs: ProjectionInputs; onChange: (patch: Partial<ProjectionInputs>) => void; editable: boolean;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const fields = [['monthlyDeposit', 'Monthly deposits ($)'], ['withdrawals', 'Monthly withdrawals'], ['balanceGrowth', 'Balance growth ($)'], ['cardTransactions', 'Card purchases']] as const;
  return <Disclosure title="Bonus qualification" open={open} onToggle={() => setOpen(value => !value)}>
    {open ? <View style={{ gap: 10 }}>
      <AppText variant="tiny" color="textMuted">{uiJoin('Storage', ': ', 'Private', ' · ', 'Eligibility', ': ', 'Unverified')}</AppText>
      <SegmentedControl options={[
        { value: 'unknown', label: 'Unknown' }, { value: 'met', label: 'Meets' }, { value: 'unmet', label: 'Unmet' },
      ]} value={inputs.bonusQualification} onChange={bonusQualification => { if (editable) onChange({ bonusQualification, bonusConditionsMet: bonusQualification === 'met' }); }} />
      {fields.map(([field, label]) => <View key={field} style={{ gap: 3 }}>
        <AppText variant="tiny" color="textMuted">{label}</AppText>
        <TextInput value={uiInputNumber(inputs[field])} keyboardType="decimal-pad" accessibilityLabel={label} editable={editable}
          onChangeText={value => { if (editable) onChange({ [field]: value }); }}
          placeholder="Unknown" placeholderTextColor={theme.colors.textFaint}
          style={{ minHeight: 48, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 10, color: theme.colors.text }} />
      </View>)}
    </View> : null}
  </Disclosure>;
}
