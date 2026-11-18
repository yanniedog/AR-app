import React, { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { currencyAmount, currencyDigits, type CurrencyUnit } from '../data/currencyInput';
import { useCurrencyAmountInput, uiJoin, uiLabel, type UiCopy } from '../lib/uiCopy';
import { useTheme } from '../theme/ThemeProvider';
import { LEDGER_RADIUS } from '../theme/layout';
import { AppText } from './ui';

/** The public value and callback always use dollars. Unit changes affect display only. */
export function CurrencyInput({ label, value, onChangeText, editable = true, error, accessibilityLabel, testID, onBlur }: {
  label: UiCopy; value: string; onChangeText: (value: string) => void; editable?: boolean;
  error?: UiCopy; accessibilityLabel?: UiCopy; testID?: string; onBlur?: () => void;
}) {
  const theme = useTheme();
  const [unit, setUnit] = useState<CurrencyUnit>('K');
  const input = useCurrencyAmountInput(), draft = input.value, setDraft = input.onChangeText;
  const emitted = useRef<string | null>(null);
  useEffect(() => {
    if (value !== emitted.current) { emitted.current = value; setDraft(currencyDigits(value, unit)); }
  }, [unit, value, setDraft]);
  const change = (text: string) => {
    const parsed = currencyAmount(text, unit);
    setDraft(parsed !== null && /[$kKmM]/.test(text) ? currencyDigits(parsed, unit) : text);
    // Invalid drafts remain invalid to consumers, rather than reusing an older amount.
    emitted.current = parsed ?? text;
    onChangeText(emitted.current);
  };
  return <View testID={testID} style={{ gap: 5, flexGrow: 1, minWidth: 0 }}>
    <AppText variant="small" color="textMuted">{label}</AppText>
    <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: error ? theme.colors.danger : theme.colors.border, borderRadius: LEDGER_RADIUS.control, backgroundColor: theme.colors.surfaceAlt, paddingLeft: 12 }}>
      <AppText accessible={false}>{uiLabel('$')}</AppText>
      <TextInput value={draft} onChangeText={change} onBlur={() => { if (currencyAmount(value) !== null) setDraft(currencyDigits(value, unit)); onBlur?.(); }} editable={editable}
        keyboardType="decimal-pad" autoCorrect={false} autoCapitalize="none" maxLength={48}
        accessibilityLabel={uiJoin(accessibilityLabel ?? label, ', ', unit === 'K' ? 'thousands of dollars' : unit === 'M' ? 'millions of dollars' : 'dollars')}
        style={{ flex: 1, minWidth: 20, minHeight: 48, paddingHorizontal: 8, color: theme.colors.text, fontSize: theme.font.body }} />
      <Pressable accessibilityRole="button" accessibilityLabel="Amount unit" accessibilityValue={{ text: uiLabel(unit) }} disabled={!editable}
        onPress={() => { const next = unit === 'K' ? 'M' : unit === 'M' ? '$' : 'K'; if (currencyAmount(value) === null) return; setDraft(currencyDigits(value, next)); setUnit(next); }}
        style={{ minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center' }}>
        <AppText weight="700">{uiLabel(unit)}</AppText>
      </Pressable>
    </View>
    {error ? <AppText variant="small" color="danger">{error}</AppText> : null}
  </View>;
}
