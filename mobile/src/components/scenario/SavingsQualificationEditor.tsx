import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import type { ProjectionInputs } from '../../data/projectionScenario';
import { useTheme } from '../../theme/ThemeProvider';
import { SegmentedControl } from '../controls';
import { AppText, Disclosure } from '../ui';

export function SavingsQualificationEditor({ inputs, onChange, editable }: {
  inputs: ProjectionInputs; onChange: (patch: Partial<ProjectionInputs>) => void; editable: boolean;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const fields = [
    ['monthlyDeposit', 'Expected qualifying monthly deposits ($)'],
    ['withdrawals', 'Expected withdrawals per month (count)'],
    ['balanceGrowth', 'Expected qualifying balance growth ($)'],
    ['cardTransactions', 'Expected qualifying card purchases (count)'],
  ] as const;
  return <Disclosure title="Savings qualification assumptions" summary="Blank values stay unknown; these are private local assumptions." open={open} onToggle={() => setOpen(value => !value)}>
    <View style={{ gap: 10 }}>
      <SegmentedControl options={[
        { value: 'unknown', label: 'Unknown' }, { value: 'met', label: 'Expect to qualify' }, { value: 'unmet', label: 'Will not qualify' },
      ]} value={inputs.bonusQualification} onChange={bonusQualification => { if (editable) onChange({ bonusQualification, bonusConditionsMet: bonusQualification === 'met' }); }} />
      {fields.map(([field, label]) => <View key={field} style={{ gap: 3 }}>
        <AppText variant="tiny" color="textMuted">{label}</AppText>
        <TextInput value={inputs[field]} keyboardType="decimal-pad" accessibilityLabel={label} editable={editable}
          onChangeText={value => { if (editable) onChange({ [field]: value }); }}
          placeholder="Unknown" placeholderTextColor={theme.colors.textFaint}
          style={{ minHeight: 48, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 10, color: theme.colors.text }} />
      </View>)}
      <AppText variant="tiny" color="textMuted">The bank's public rules define which deposits, withdrawals and transactions qualify. These selections do not confirm eligibility or approval.</AppText>
    </View>
  </Disclosure>;
}
