import type { CustomerProfile } from '../customerProfile';
import type { RateRow } from '../../types';
import { canonical,hashText } from '../../lib/productTermsEngine/validation';
import { assertSelection,type ApprovedSelection,type ContractContext } from '../executableContracts/transport';
import { profileDefinitions,type DepositInputs } from '../executableContracts/instantiate';
import { boundedInputs,boundedReceiptJson } from './bounds';
/** Private export metadata only; canonical adapter/engine receipts remain untouched. */
export function tdReopenItem(selection:ApprovedSelection,context:ContractContext,row:RateRow,inputs:DepositInputs,profile:CustomerProfile,id='deposit'){
 assertSelection(selection,context,row);const answers=Object.create(null);for(const d of profileDefinitions(selection))if(Object.hasOwn(profile.answers,d.id))answers[d.id]=profile.answers[d.id];
 const item={id,kind:'td' as const,sourceId:selection.template.id,edition:hashText(canonical(context.manifest)),templateProof:selection.template,target:{kind:'rate_variant' as const,productKey:row.product_key,section:'TD' as const,coreRowIndex:context.core!.sections.TD.rates.indexOf(row),rateIndex:row.rate_index,rowSha256:hashText(canonical(row))},inputs,answers};boundedInputs(item);return JSON.parse(canonical(item));
}
export function privateTdExport(result:unknown,items:ReturnType<typeof tdReopenItem>[],comparison=false){const reopenInputs={kind:comparison?'td_comparison':'td',items};const exported={schemaVersion:1,kind:'private_calculation_export',reopenInputs,reopenSha256:hashText(canonical(reopenInputs)),result,resultSha256:hashText(canonical(result))};boundedReceiptJson(JSON.stringify(exported));return exported;}
