import type { CalculationReceipt, LedgerTotals } from '../../lib/productTermsEngine/types';
import { uiCount, uiDate, uiDecimal, uiIdentifier, uiJoin, uiLabel, type UiLabel, type UiText } from '../../lib/uiCopy';
import { receiptAssumptionFacts, receiptCriterionFacts, receiptIssueFacts, type ReceiptFactState, type ReceiptFactTopic, type ReceiptIssueFact } from '../../lib/engineReceiptFactModel';
import { AppText, Row } from '../ui';

export function uiEngineStatus(status: string | null | undefined): UiText {
  switch (status) {
    case 'complete': case 'factual_complete': return uiLabel('Complete');
    case 'conditional_complete': return uiLabel('Conditions required');
    case 'incomplete': return uiLabel('Partial');
    case 'unsupported': return uiLabel('Unsupported');
    case 'meets': return uiLabel('Meets');
    case 'does_not_meet': return uiLabel('Does not meet');
    case 'needs_information': return uiLabel('Needs information');
    case 'known': return uiLabel('Known components');
    case 'unavailable': return uiLabel('Unavailable');
    default: return uiLabel('Unknown');
  }
}
const TOTAL_FIELDS: readonly (readonly [keyof LedgerTotals, UiLabel])[] = [
  ['openingBalance', 'Opening balance'], ['externalCashflowNet', 'External cashflow'],
  ['principalRepaid', 'Principal repaid'], ['externalInflows', 'External inflows'],
  ['externalOutflows', 'External outflows'], ['interestAccrued', 'Interest accrued'],
  ['interestPosted', 'Interest posted'], ['interestUnposted', 'Interest unposted'],
  ['interestRoundingAdjustment', 'Rounding adjustment'], ['feesCharged', 'Fees charged'],
  ['closingBalance', 'Closing balance'], ['feesDebitedBalance', 'Fees debited from balance'],
  ['feesPaidExternal', 'Fees paid externally'],
];
const TOPICS: Readonly<Record<ReceiptFactTopic, UiLabel>> = {
  calculation: 'Calculation', fees: 'Fees', deposit: 'Term deposits', savings: 'Savings', activity: 'Activity', loan: 'Loan', portfolio: 'Holdings',
  eligibility: 'Recorded criteria', source: 'Source', scope: 'Scope', rate: 'Rate', rounding: 'Rounding adjustment',
  applicability: 'Applicability', 'material-terms': 'Material terms', 'fee-inventory': 'Fee inventory', 'fee-timing': 'Fee timing',
  'fee-waiver': 'Fee waiver', 'fee-ordering': 'Fee ordering', 'payment-allocation': 'Payment allocation', 'payment-obligation': 'Payment obligation',
  'business-calendar': 'Business calendar', 'posting-calendar': 'Posting calendar', 'payment-destination': 'Payment destination',
  'tax-treatment': 'Tax treatment', 'break-fee': 'Break fee', 'principal-recovery': 'Principal recovery',
  'bonus-qualification': 'Bonus qualification', 'projected-payments': 'Projected payments', 'missing-input': 'Missing input', 'invalid-input': 'Invalid input',
};
const STATES: Readonly<Record<ReceiptFactState, UiLabel>> = {
  unknown: 'Unknown', unverified: 'Unverified', unsupported: 'Unsupported', unavailable: 'Unavailable', needs_information: 'Needs information',
  does_not_meet: 'Does not meet', unpaid: 'Unpaid', partial: 'Partial', acknowledged: 'Acknowledged', 'source-review-required': 'Source review required',
};
function IssueFact({ fact, assumption = false }: { fact: ReceiptIssueFact; assumption?: boolean }) {
  return <>
    <AppText variant="small">{uiJoin(assumption ? 'Assumption' : 'Issues', ' ', uiCount(fact.index + 1), ' · ', TOPICS[fact.topic], ': ', STATES[fact.state],
      ...fact.references.flatMap(reference => [uiLabel(' · '), uiIdentifier(reference)]))}</AppText>
    {fact.code ? <AppText variant="tiny">{uiJoin('Issue code', ': ', uiIdentifier(fact.code))}</AppText> : null}
  </>;
}

/** Shows existing evaluated facts; it neither recomputes nor upgrades a claim. */
export function EngineReceiptFacts({ receipt }: { receipt: CalculationReceipt }) {
  return <>
    <AppText>{uiJoin('Status', ': ', uiEngineStatus(receipt.status))}</AppText>
    <AppText>{uiJoin('Claim available', ': ', receipt.claimAvailable ? 'Yes' : 'No')}</AppText>
    <AppText>{uiJoin('Completeness', ': ', uiEngineStatus(receipt.completeness))}</AppText>
    <AppText>{uiJoin('Recorded criteria', ': ', uiEngineStatus(receipt.eligibility?.status))}</AppText>
    <AppText>{uiJoin('Bank approval', ': ', 'Not assessed')}</AppText>
    <AppText>{uiJoin('Issues', ': ', uiCount(receipt.issues.length), ' · ', 'Assumption count', ': ', uiCount(receipt.assumptions.length))}</AppText>
    {receiptIssueFacts(receipt).map(fact => <IssueFact key={`issue-${fact.index}`} fact={fact} />)}
    {receiptAssumptionFacts(receipt).map(fact => <IssueFact key={`assumption-${fact.index}`} fact={fact} assumption />)}
    {receiptCriterionFacts(receipt).map((fact, index) => <AppText key={`criterion-${index}`} variant="small">{uiJoin('Recorded criteria', ' · ', uiIdentifier(fact.ruleId), ': ', uiEngineStatus(fact.state),
      fact.field ? uiJoin(' · ', fact.inputState === 'missing' ? 'Missing input' : 'Invalid input', ': ', uiIdentifier(fact.field)) : fact.state === 'needs_information' ? uiJoin(' · ', 'Source review required') : null,
      ...fact.references.flatMap(reference => [uiLabel(' · '), uiIdentifier(reference)]))}</AppText>)}
    {receipt.loan?.obligations.filter(obligation => obligation.status !== 'paid').map(obligation => <AppText key={obligation.id} variant="small">{uiJoin('Payment obligation', ' · ', uiIdentifier(obligation.id), ': ',
      obligation.status === 'unpaid' ? 'Unpaid' : obligation.status === 'partial' ? 'Partial' : 'Unknown', ' · ', uiDate(obligation.dueDate),
      ' · ', 'Repayment due', ': ', uiDecimal(obligation.due), ' · ', 'Paid', ': ', uiDecimal(obligation.paid))}</AppText>)}
    {receipt.loan ? <AppText variant="small">{uiJoin('Basis', ': ', uiIdentifier(receipt.loan.perspective), ' · ', 'Known components', ': ', uiLabel(receipt.loan.componentStatus === 'known' ? 'Known' : 'Partial'))}</AppText> : null}
    <AppText variant="small">{uiJoin('Contract scope', ': ', uiIdentifier(receipt.contractId))}</AppText>
    <AppText variant="small">{uiJoin('Receipt', ': ', uiIdentifier(receipt.inputSha256))}</AppText>
    {receipt.claimAvailable && receipt.totals ? TOTAL_FIELDS.map(([key, label]) => <Row key={key} style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
      <AppText variant="small">{label}</AppText><AppText variant="small">{uiDecimal(receipt.totals![key])}</AppText>
    </Row>) : <AppText>{uiLabel("Unavailable")}</AppText>}
  </>;
}
