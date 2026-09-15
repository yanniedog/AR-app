import type { AccountAuthority } from './accountAuthority';
import type { PortfolioInput } from './portfolioTypes';
import { canonical } from './validation';
import { dayNumber } from './calendar';
import { PORTFOLIO_EVALUATOR_VERSION, EVALUATOR_VERSION } from './types';

export function portfolioAuthorities(input: PortfolioInput): Map<string, AccountAuthority> {
  const result = new Map(input.accounts.map(a => [a.id, { packageInstances: new Set<string>(), tdExternalFees: false }]));
  const packages = input.packages ?? [], routes = input.tdFeeRoutes ?? [];
  if (!Array.isArray(packages) || packages.length > 128 || !Array.isArray(routes) || routes.length > 32) throw new Error('portfolio_authority_limit');
  const seen = new Set<string>();
  for (const p of packages) {
    if (!p.id || seen.has(p.id) || !Array.isArray(p.memberAccountIds) || !p.memberAccountIds.length || new Set(p.memberAccountIds).size !== p.memberAccountIds.length || !p.memberAccountIds.includes(p.debtorAccountId) ||
        p.memberAccountIds.some(id => !result.has(id)) || dayNumber(p.from) > dayNumber(input.frame.startDate) || dayNumber(p.toExclusive) < dayNumber(input.frame.endDateExclusive)) throw new Error('portfolio_package_scope_invalid');
    seen.add(p.id); let expected: string | null = null;
    for (const accountId of p.memberAccountIds) {
      const account = input.accounts.find(a => a.id === accountId)!;
      if (![EVALUATOR_VERSION, PORTFOLIO_EVALUATOR_VERSION].includes(account.contract.evaluatorVersion as typeof EVALUATOR_VERSION) || !Array.isArray(p.evidenceIds) || !p.evidenceIds.length || p.evidenceIds.some(id => !account.contract.evidence.some(e => e.id === id))) throw new Error('portfolio_package_evidence_missing');
      const fees = account.contract.feeSchedule?.fees.filter(f => f.scope.type === 'package' && f.scope.packageInstanceId === p.id) ?? [];
      if (!fees.length) throw new Error('portfolio_package_member_inventory_missing');
      for (const f of fees) if (f.scope.type !== 'package' || canonical([...f.scope.memberAccountIds].sort()) !== canonical([...p.memberAccountIds].sort()) || f.scope.debtorAccountId !== p.debtorAccountId) throw new Error('portfolio_package_membership_mismatch');
      const shape = canonical(fees.map(({ id: _id, order: _order, ...rest }) => rest).sort((a, b) => a.chargeIdentity.localeCompare(b.chargeIdentity)));
      if (expected !== null && shape !== expected) throw new Error('portfolio_package_obligation_mismatch'); expected = shape;
      result.get(accountId)!.packageInstances.add(p.id);
    }
  }
  const routed = new Set<string>();
  for (const route of routes) {
    const account = input.accounts.find(a => a.id === route.accountId), inventory = account?.contract.feeSchedule?.inventory;
    if (!account?.contract.tdLifecycle || ![EVALUATOR_VERSION, PORTFOLIO_EVALUATOR_VERSION].includes(account.contract.evaluatorVersion as typeof EVALUATOR_VERSION) || routed.has(route.accountId) || route.generalFees !== 'external_only' || route.lifecycleOccurrenceId !== 'td:break-fee' ||
        !inventory?.some(i => i.state === 'lifecycle_owned' && i.lifecycleOccurrenceId === route.lifecycleOccurrenceId) || !Array.isArray(route.evidenceIds) || !route.evidenceIds.length || route.evidenceIds.some(id => !account.contract.evidence.some(e => e.id === id))) throw new Error('portfolio_td_fee_route_invalid');
    if (account.contract.feeSchedule!.fees.some(f => f.chargeIdentity === route.lifecycleOccurrenceId || f.id === route.lifecycleOccurrenceId)) throw new Error('portfolio_td_fee_duplicate_owner');
    routed.add(route.accountId); result.get(route.accountId)!.tdExternalFees = true;
  }
  return result;
}
