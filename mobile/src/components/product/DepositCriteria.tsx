import React, { useState } from 'react';
import { View } from 'react-native';
import type { Rule, RuleTrace } from '../../lib/productTermsEngine/types';
import type { ApprovedSelection } from '../../data/executableContracts/transport';
import { AppText, Disclosure } from '../ui';
import { DepositSource } from './DepositSource';
const comparisons = { eq: 'equals', ne: 'does not equal', gt: 'is greater than', gte: 'is at least', lt: 'is less than', lte: 'is at most' };
function RuleRow({ rule, trace, selection, depth = 0 }: { rule: Rule; trace?: RuleTrace; selection: ApprovedSelection; depth?: number }) {
  if (depth > 16) return <AppText variant="small">Criteria detail limit reached.</AppText>;
  const label = rule.op === 'compare' ? `${selection.template.inputDefinitions.find(d => d.key === rule.field)?.label ?? rule.field} ${comparisons[rule.comparison]} ${String(rule.expected.value)}${rule.expected.type === 'decimal' ? ` ${rule.expected.unit}` : ''}` : rule.op === 'and' ? 'All following criteria' : rule.op === 'or' ? 'At least one following criterion' : rule.op === 'not' ? 'The following criterion must not be met' : 'Criterion unavailable';
  const children = rule.op === 'and' || rule.op === 'or' ? rule.rules : rule.op === 'not' ? [rule.rule] : [];
  return <View style={{ gap: 4, paddingLeft: depth ? 8 : 0 }}>
    <AppText variant="small">{label}: {trace?.status.replace(/_/g, ' ') ?? 'not assessed'}</AppText>
    {trace?.reason && <AppText variant="small">{trace.reason}</AppText>}
    <AppText variant="tiny">Sources: {(rule.evidenceIds ?? []).map(id => selection.template.evidence.find(source => source.id === id)?.locator ?? 'unavailable').join('; ')}</AppText>
    {children.map((child, i) => <RuleRow key={child.id} rule={child} trace={trace?.children?.[i]} selection={selection} depth={depth + 1} />)}
  </View>;
}
export function DepositCriteria({ selection, trace }: { selection: ApprovedSelection; trace: RuleTrace }) {
  const [open, setOpen] = useState(false);
  return <View style={{ gap: 8 }}>
    <RuleRow rule={selection.template.eligibility} trace={trace} selection={selection} />
    <Disclosure title="Criteria source evidence" open={open} onToggle={() => setOpen(!open)}>
      {selection.template.evidence.map(source => <DepositSource key={source.id} source={source} />)}
    </Disclosure>
  </View>;
}
