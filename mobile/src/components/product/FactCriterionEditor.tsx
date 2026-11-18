import React, { useEffect } from 'react';
import { TextInput, View } from 'react-native';
import type { FactCriterion, FactCriterionOperator } from '../../data/productFactsCore';
import { normalizeFactCriterion } from '../../data/productFactsCore';
import { uiIdentifier, uiJoin, uiLabel, useFactCriterionInput, type UiLabel } from '../../lib/uiCopy';
import { AppText, Button, Row } from '../ui';

/** Values and units retain the selected parameter identity; editing a
 * threshold never changes a fee into an age or another product constraint. */
export function FactCriterionEditor({ criterion, onChange }: { criterion: FactCriterion; onChange: (value: FactCriterion) => void }) {
  const input = useFactCriterionInput();
  useEffect(() => { input.onChangeText(String(criterion.value ?? '')); }, [criterion.value, input.onChangeText]);
  if (typeof criterion.value === 'boolean' || criterion.operator === 'exists') return null;
  const numeric = /^-?(?:0|[1-9]\d*)(?:\.\d{1,24})?$/.test(String(criterion.value)) && Boolean(criterion.unit);
  const update = (operator: FactCriterionOperator) => {
    if (numeric && !/^-?(?:0|[1-9]\d*)(?:\.\d{1,24})?$/.test(input.raw)) return;
    const value = normalizeFactCriterion({ ...criterion, operator, value: input.raw });
    if (value) onChange(value);
  };
  const operators: readonly [FactCriterionOperator, UiLabel][] = numeric
    ? [['eq', 'Equal to'], ['gte', 'At least'], ['lte', 'At most']] : [['eq', 'Equal to']];
  return <View style={{ gap: 8 }}>
    <AppText variant="small">{uiJoin(uiIdentifier(criterion.canonicalKey || criterion.sourceType), ' · ', uiIdentifier(criterion.unit))}</AppText>
    <TextInput value={input.value} onChangeText={input.onChangeText} maxLength={72}
      accessibilityLabel="Filter value" placeholder="Filter value" keyboardType={numeric ? 'decimal-pad' : 'default'} />
    <Row style={{ gap: 8, flexWrap: 'wrap' }}>{operators.map(([operator, title]) => <Button key={operator} title={title}
      variant="secondary" onPress={() => update(operator)} />)}</Row>
    {numeric && !/^-?(?:0|[1-9]\d*)(?:\.\d{1,24})?$/.test(input.raw) ? <AppText variant="small">{uiLabel('Invalid value')}</AppText> : null}
  </View>;
}
