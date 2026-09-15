import { verifiedCoreContents } from '../sectionIntegrity';
import type { RateRow } from '../../types';
import { canonical,hashText } from '../../lib/productTermsEngine/validation';
import { loadExecutableSelections,type ApprovedSelection } from '../executableContracts/transport';
import { loadEligibilitySelections,type EligibilityContext,type EligibilityTarget,type EligibilitySelection } from '../eligibilityContracts/transport';
import { loadSavingsSelections,type SavingsSelection } from '../monetaryContracts/transport';
import { loadMortgageSelections,type MortgageSelection } from '../mortgageContracts/transport';
import type { ReplayItem } from './types';
export interface ReplayOption {item:ReplayItem;selection:ApprovedSelection|EligibilitySelection|SavingsSelection|MortgageSelection;target:EligibilityTarget|RateRow;id:string;label:string;changed:boolean;context:EligibilityContext}
export function currentReplayRows(item:ReplayItem,c:EligibilityContext){if(item.target.kind!=='rate_variant')return [];const rows=c.core?.sections[item.target.section!]?.rates.filter(r=>r.product_key===item.target.productKey)??[];if(rows.length>128)throw Error('Open the product page to choose among this many rates.');return rows;}
export async function resolveReplayItem(item:ReplayItem,c:EligibilityContext,rowChoice?:RateRow):Promise<ReplayOption[]>{
 if(!verifiedCoreContents(c.coreIntegrity))throw Error('Current core contents are not verified.');
 const before=hashText(canonical(c.manifest)),rows=currentReplayRows(item,c);let row:RateRow|undefined;
 if(item.target.kind==='rate_variant'){if(rowChoice){if(!rows.includes(rowChoice))throw Error('Choose an actual current product rate.');row=rowChoice;}else{const matches=rows.filter(r=>hashText(canonical(r))===item.target.rowSha256&&r.rate_index===item.target.rateIndex);if(matches.length===1)row=matches[0];}if(!row)throw Error('The previous rate variant is unavailable. Choose a current variant explicitly.');if(before===item.edition&&item.target.coreRowIndex!==undefined&&c.core!.sections[item.target.section!].rates.indexOf(row)!==item.target.coreRowIndex)throw Error('Same-edition row identity differs.');}
 let target:EligibilityTarget|RateRow,selections:ReplayOption['selection'][];
 if(item.kind==='td'){target=row!;selections=await loadExecutableSelections(c,row!);}
 else{const detail=c.details&&Object.hasOwn(c.details.products,item.target.productKey)?c.details.products[item.target.productKey]:null;if(!detail)throw Error('Current product details unavailable.');target=row?{kind:'rate_variant',productKey:item.target.productKey,section:item.target.section!,row,detail}:{kind:'product',productKey:item.target.productKey,detail};selections=await(item.kind==='eligibility_only'?loadEligibilitySelections(c,target):item.kind==='savings_calculation'?loadSavingsSelections(c,target):loadMortgageSelections(c,target));}
 if(!verifiedCoreContents(c.coreIntegrity)||hashText(canonical(c.manifest))!==before)throw Error('Publication changed while checking sources.');
 return selections.filter(s=>('template'in s?s.template:s.subject).evaluatorVersion==='product-terms-engine-v8').map(selection=>{const s='template'in selection?selection.template:selection.subject,scope='scope'in s?s.scope:null;return {item,selection,target,id:s.id,label:scope?Object.values(scope).filter(v=>typeof v==='string').join(' · '):`${(s as any).cohortKey} · ${(s as any).tierKey} · ${(s as any).packageKey}`,changed:before!==item.edition||s.id!==item.sourceId||!!row&&hashText(canonical(row))!==item.target.rowSha256,context:c};});
}
