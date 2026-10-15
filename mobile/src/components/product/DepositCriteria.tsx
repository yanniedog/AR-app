import React, { useState } from 'react';
import { View } from 'react-native';
import type { Rule, RuleTrace, EvidenceReference, Fact } from '../../lib/productTermsEngine/types';
import type { ApprovedSelection } from '../../data/executableContracts/transport';
import { AppText, Disclosure } from '../ui';
import { uiDate, uiIdentifier, uiJoin, uiLabel, uiMoney, uiNumber, uiRate, uiOpaqueEnum, type UiText, type UiLabel } from '../../lib/uiCopy';
import { DepositSource } from './DepositSource';
const comparisons: Record<'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte', UiLabel> = { eq: '=', ne: '≠', gt: '>', gte: '≥', lt: '<', lte: '≤' };
interface CriteriaContract { eligibility: Rule; inputDefinitions: { key: string; label: string }[]; evidence: EvidenceReference[] }
function expectedValue(fact: Fact): UiText {
  if (fact.type === 'boolean') return uiLabel(fact.value ? 'Yes' : 'No');
  if (fact.type === 'date') return uiDate(fact.value);
  if (fact.type === 'text') return uiOpaqueEnum(fact.value);
  if (fact.type !== 'decimal') return uiLabel('Unknown');
  const n = Number(fact.value); if (!Number.isFinite(n)) return uiLabel('Unknown');
  return fact.unit === 'AUD' ? uiMoney(n, 2) : fact.unit === 'fraction' ? uiRate(n) : uiJoin(uiNumber(n, Math.min(6, (fact.value.split('.')[1] ?? '').length)), ' ', uiOpaqueEnum(fact.unit.toUpperCase()));
}
export function criteriaStatus(status?: RuleTrace['status']): UiText {
  return uiLabel(status === 'meets' ? 'Meets' : status === 'does_not_meet' ? 'Does not meet' : status === 'needs_information' ? 'Needs information' : 'Not assessed');
}
function RuleRow({ rule, trace, contract, depth = 0 }: { rule: Rule; trace?: RuleTrace; contract: CriteriaContract; depth?: number }) {
  if (depth > 16) return <AppText variant="small">{uiLabel("Unavailable")}</AppText>;
  const label = rule.op === 'compare' ? uiJoin(uiIdentifier(rule.field), ' ', comparisons[rule.comparison], ' ', expectedValue(rule.expected)) : uiLabel(rule.op === 'and' ? 'AND' : rule.op === 'or' ? 'OR' : 'NOT');
  const children = rule.op === 'and' || rule.op === 'or' ? rule.rules : rule.op === 'not' ? [rule.rule] : [];
  return <View style={{ gap: 4, paddingLeft: depth ? 8 : 0 }}>
    <AppText variant="small">{uiJoin(label, ': ', criteriaStatus(trace?.status))}</AppText>
    {(rule.evidenceIds ?? []).map(id => <AppText key={id} variant="tiny">{uiJoin('Source', ' ', uiIdentifier(id))}</AppText>)}
    {children.map((child, i) => <RuleRow key={child.id} rule={child} trace={trace?.children?.[i]} contract={contract} depth={depth + 1} />)}
  </View>;
}
export function ReviewedCriteria({ contract, trace }: { contract: CriteriaContract; trace: RuleTrace }) {
  const [open, setOpen] = useState(false);
  return <View style={{ gap: 8 }}><RuleRow rule={contract.eligibility} trace={trace} contract={contract} />
    <Disclosure title="Sources" open={open} onToggle={() => setOpen(!open)}>{contract.evidence.map(source => <DepositSource key={source.id} source={source} />)}</Disclosure>
  </View>;
}
export function DepositCriteria({ selection, trace }: { selection: ApprovedSelection; trace: RuleTrace }) { return <ReviewedCriteria contract={selection.template} trace={trace} />; }
