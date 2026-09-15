import { boundedInputs } from './bounds';
import type { CustomerProfile,CustomerAnswer,InputDefinition } from '../customerProfile';
import { validateProfile } from '../customerProfile';
import { profileDefinitions,calculateDeposit,depositInputRequirements } from '../executableContracts/instantiate';
import { compareDeposits } from '../executableContracts/depositComparison';
import { evaluateEligibilitySelection } from '../eligibilityContracts/adapter';
import { eligibilityDefinition,eligibilityRequirements } from '../eligibilityContracts/facts';
import { calculateSavingsPeriod } from '../monetaryContracts/adapter';
import { savingsDefinition,savingsRequirements } from '../monetaryContracts/facts';
import { calculateMortgagePeriod } from '../mortgageContracts/adapter';
import { mortgageDefinition,mortgageRequirements } from '../mortgageContracts/facts';
import { compareSavingsHoldings } from '../portfolioContracts/adapter';
import { compareMortgagePeriods } from '../portfolioContracts/mortgageAdapter';
import { hashText,canonical } from '../../lib/productTermsEngine/validation';
import { tdReopenItem,privateTdExport } from './tdExport';
import type { ReplayDocument } from './types';
import type { ReplayOption } from './resolve';
export function replayDefinitions(o:ReplayOption):InputDefinition[]{const s:any=o.selection;return o.item.kind==='td'?profileDefinitions(s):s.subject.inputDefinitions?s.subject.inputDefinitions.filter((d:any)=>d.binding==='customer_fact').map((d:any)=>eligibilityDefinition(s.subject,d.key)):s.subject.policy.inputDefinitions.filter((d:any)=>d.binding==='customer_fact').map((d:any)=>o.item.kind==='savings_calculation'?savingsDefinition(s.subject,d.key):mortgageDefinition(s.subject,d.field));}
export function replayProfile(o:ReplayOption,overrides:Record<string,CustomerAnswer>={}):CustomerProfile{
 const definitions=Object.fromEntries(replayDefinitions(o).map(d=>[d.id,d])),same=o.id===o.item.sourceId,answers=Object.create(null);for(const id of Object.keys(definitions)){if(same&&Object.hasOwn(o.item.answers,id))answers[id]=o.item.answers[id];if(Object.hasOwn(overrides,id))answers[id]=overrides[id];}
 return validateProfile({version:1,revision:0,definitions,answers,negotiatedTerms:[],legacyScenario:null});
}
export function replayRequirements(o:ReplayOption,inputs:any,answers:Record<string,CustomerAnswer>){const s:any=o.selection,p=replayProfile(o,answers);if(o.item.kind==='eligibility_only'){const r=eligibilityRequirements(s.subject,inputs,p);return {needed:r.needed.map(d=>eligibilityDefinition(s.subject,d.key)),deferred:r.deferred.map(d=>eligibilityDefinition(s.subject,d.key)),saved:r.saved.map(d=>eligibilityDefinition(s.subject,d.key))};}return o.item.kind==='td'?depositInputRequirements(s,inputs,p):o.item.kind==='savings_calculation'?savingsRequirements(s.subject,inputs,p):mortgageRequirements(s.subject,inputs,p);}
export interface ReplayChoice {option:ReplayOption;inputs:any;answers:Record<string,CustomerAnswer>;confirmed:boolean;sourceChangeConfirmed:boolean}
export function recalculateReceipt(document:ReplayDocument,c:ReplayOption['context'],choices:ReplayChoice[]){
 if(document.items.length!==choices.length||!choices.length)throw Error('Choose a current reviewed scope for every account.');
 const manifest=hashText(canonical(c.manifest)),profiles:CustomerProfile[]=[];
 choices.forEach((x,n)=>{if(x.option.item!==document.items[n]||!x.confirmed||x.option.changed&&!x.sourceChangeConfirmed||x.option.context.manifest!==c.manifest||x.option.context.core!==c.core||x.option.context.details!==c.details||x.option.context.coreIntegrity!==c.coreIntegrity||hashText(canonical(x.option.context.manifest))!==manifest)throw Error('Confirm the current source and private inputs.');boundedInputs(x.inputs);if(x.option.id!==x.option.item.sourceId&&x.option.item.kind==='mortgage_calculation'&&x.inputs.customerFacts?.length)throw Error('Re-enter customer facts for the new reviewed scope.');profiles.push(replayProfile(x.option,x.answers));});
 const merged:CustomerProfile={version:1,revision:0,definitions:{},answers:{},negotiatedTerms:[],legacyScenario:null};for(const p of profiles)for(const[id,a]of Object.entries(p.answers)){if(merged.answers[id]&&canonical(merged.answers[id])!==canonical(a))throw Error('Conflicting scoped answers across accounts.');merged.answers[id]=a;merged.definitions[id]=p.definitions[id];}
 let result:any;
 if(document.kind==='td_comparison'){const alternatives=choices.map(x=>({id:x.option.item.id,row:x.option.target as any,selection:x.option.selection as any,inputs:x.inputs}));const r=compareDeposits(c,alternatives,document.frame.referenceId,merged);result=privateTdExport(r,choices.map(x=>tdReopenItem(x.option.selection as any,c,x.option.target as any,x.inputs,merged,x.option.item.id)),true);}
 else if(document.kind==='historical_savings_holdings'){let cursor=0;const f=document.frame,base=f.alternatives[0].input.frame;result=compareSavingsHoldings(c,merged,{startDate:base.startDate,endDateExclusive:base.endDateExclusive,timezone:base.timezone,metric:base.metric,referenceId:f.referenceId,independentHoldingsConfirmed:true,alternatives:f.alternatives.map((a:any)=>({id:a.id,accounts:a.input.accounts.map(()=>{const x=choices[cursor++];return {selection:x.option.selection as any,target:x.option.target as any,inputs:x.inputs};})}))});}
 else if(document.kind==='historical_mortgage_comparison'){const f=document.frame,base=f.alternatives[0].input.frame;result=compareMortgagePeriods(c,merged,{startDate:base.startDate,endDateExclusive:base.endDateExclusive,timezone:base.timezone,metric:base.metric,referenceId:f.referenceId,independentLoansConfirmed:true,alternatives:choices.map((x,n)=>({id:f.alternatives[n].id,selection:x.option.selection as any,target:x.option.target as any,inputs:x.inputs}))});}
 else {const x=choices[0],o=x.option,s:any=o.selection,t:any=o.target,p=profiles[0];result=o.item.kind==='td'?privateTdExport(calculateDeposit(s,c,t,x.inputs,p),[tdReopenItem(s,c,t,x.inputs,p)]):o.item.kind==='eligibility_only'?evaluateEligibilitySelection(s,c,t,x.inputs,p):o.item.kind==='savings_calculation'?calculateSavingsPeriod(s,c,t,x.inputs,p):calculateMortgagePeriod(s,c,t,x.inputs,p);}
 return result;
}
