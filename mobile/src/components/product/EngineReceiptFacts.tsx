import type { CalculationReceipt, LedgerTotals } from '../../lib/productTermsEngine/types';
import { uiCount, uiDecimal, uiIdentifier, uiJoin, uiLabel, type UiLabel, type UiText } from '../../lib/uiCopy';
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

/** Shows existing evaluated facts; it neither recomputes nor upgrades a claim. */
export function EngineReceiptFacts({ receipt }: { receipt: CalculationReceipt }) {
  return <>
    <AppText>{uiJoin('Status', ': ', uiEngineStatus(receipt.status))}</AppText>
    <AppText>{uiJoin('Claim available', ': ', receipt.claimAvailable ? 'Yes' : 'No')}</AppText>
    <AppText>{uiJoin('Completeness', ': ', uiEngineStatus(receipt.completeness))}</AppText>
    <AppText>{uiJoin('Recorded criteria', ': ', uiEngineStatus(receipt.eligibility?.status))}</AppText>
    <AppText>{uiJoin('Bank approval', ': ', 'Not assessed')}</AppText>
    <AppText>{uiJoin('Issues', ': ', uiCount(receipt.issues.length), ' · ', 'Assumption count', ': ', uiCount(receipt.assumptions.length))}</AppText>
    <AppText variant="small">{uiJoin('Receipt', ': ', uiIdentifier(receipt.inputSha256))}</AppText>
    {receipt.claimAvailable && receipt.totals ? TOTAL_FIELDS.map(([key, label]) => <Row key={key} style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
      <AppText variant="small">{label}</AppText><AppText variant="small">{uiDecimal(receipt.totals![key])}</AppText>
    </Row>) : <AppText>{uiLabel("Unavailable")}</AppText>}
  </>;
}
