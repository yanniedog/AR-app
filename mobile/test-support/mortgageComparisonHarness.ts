import { mortgageHarness } from './mortgageHarness';
import { normalizeCoreWithIntegrity } from '../src/data/sectionIntegrity';
import { monetaryIdentity } from '../src/data/monetaryContracts/authority';
import { canonical, hashText } from '../src/lib/productTermsEngine/validation';
import { mortgageObligationId } from '../src/data/mortgageContracts/calendar';
import { downloadInflate } from '../src/data/payload';
import { loadMortgageSelections } from '../src/data/mortgageContracts/transport';
import type { MortgageComparisonDraft } from '../src/data/portfolioContracts/mortgageAdapter';

/** Engineering-only two-target publication. Transport decoding is mocked, not bank authority. */
export async function mortgageComparisonHarness() {
  const h = await mortgageHarness({ rate: '0.0365', obligation: '30', payment: '30', external_fee: '2' });
  const core = structuredClone(h.context.core);
  core.sections.Mortgage.rates = ['0.0365', '0.073'].map((rate, n) => ({ product_key: h.target.productKey, product_id: 'technical', provider: 'Engineering only', product_name: `Technical loan ${n + 1}`, rate_index: n + 1, rate, rate_type: 'FIXED' }));
  const normalized = normalizeCoreWithIntegrity(core, { coreSha256: h.context.manifest.files.core.sha256 });
  h.context.core = normalized.core; h.context.coreIntegrity = normalized.integrity;
  const rows = h.context.core.sections.Mortgage.rates;
  h.asset.subjects = rows.map((row, n) => {
    const s = structuredClone(h.subject), approval = structuredClone(h.asset.subjects[0].approval);
    s.scope.tierKey = `technical-tier-${n}`;
    const a = s.authorityGraph.authorities[0]; a.scope = { ...s.scope }; a.id = monetaryIdentity(a, 'id'); s.policy.authorityIds = [a.id];
    s.authorityGraph.identitySha256 = monetaryIdentity(s.authorityGraph, 'identitySha256');
    s.scopeId = hashText(canonical(['monetary-scope-v3', s.capability, s.scope]));
    s.policy.annualRate = String(row.rate); s.policy.fees.occurrences[0].amount = n ? '3' : '2';
    s.target = { kind: 'rate_variant', section: 'Mortgage', coreRowIndex: n, rateIndex: n + 1, rowSha256: hashText(canonical(row)), rateUnit: 'fraction', annualRate: String(row.rate) };
    s.id = monetaryIdentity(s, 'id'); approval.subjectId = s.id; approval.authorityGraphSha256 = s.authorityGraph.identitySha256;
    return { subject: s, approval };
  });
  h.asset.identitySha256 = monetaryIdentity(h.asset, 'identitySha256');
  (downloadInflate as jest.Mock).mockImplementation(async (url: string) => JSON.stringify(url.includes('_index-') ? h.index : h.shard));
  const options = await Promise.all(rows.map(async row => {
    const target = { ...h.target, kind: 'rate_variant' as const, section: 'Mortgage' as const, row };
    return { target, selections: await loadMortgageSelections(h.context, target), label: row.product_name! };
  }));
  const alternatives = options.map((o, n) => {
    const inputs = structuredClone(h.inputs), selection = o.selections[0];
    inputs.confirmedAnnualRate = selection.subject.policy.annualRate; inputs.feeSettlements[0].amount = n ? '3' : '2';
    inputs.payments[0].obligationId = mortgageObligationId(selection.subject, inputs.accountId, inputs.from);
    return { id: `loan-${n + 1}`, selection, target: o.target, inputs };
  });
  const draft: MortgageComparisonDraft = { startDate: h.inputs.from, endDateExclusive: h.inputs.toExclusive, timezone: h.subject.authorityGraph.completedPeriod.timezone,
    metric: 'net_interest_fee_cost', referenceId: 'loan-1', independentLoansConfirmed: true, alternatives };
  return { ...h, options, draft, rows: rows.map(row => ({ row, section: 'Mortgage' as const })) };
}
