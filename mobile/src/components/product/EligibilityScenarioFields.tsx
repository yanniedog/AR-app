import React from 'react';
import type { EligibilitySubject } from '../../data/eligibilityContracts/types';
import type { EligibilityScenario,ScenarioRole } from '../../data/eligibilityContracts/facts';
import { LedgerField } from '../ledger/LedgerField';

/** Only reviewed scenario roles; customer-profile answers never supply these values. */
export function EligibilityScenarioFields({definitions,needed,values,onChange}:{definitions:EligibilitySubject['inputDefinitions'];needed:EligibilitySubject['inputDefinitions'];values:EligibilityScenario['values'];onChange:(values:EligibilityScenario['values'])=>void}){
 const fields=definitions.filter(d=>!['customer_fact','assessment_date'].includes(d.binding)&&(needed.some(n=>n.key===d.key)||Object.hasOwn(values,d.binding)));
 return <>{fields.map(d=><LedgerField key={d.key} label={d.label} value={String(values[d.binding as ScenarioRole]?.value??'')} keyboardType={d.type==='decimal'?'decimal-pad':'default'} onChangeText={value=>{
  const next={...values};if(!value)delete next[d.binding as ScenarioRole];else next[d.binding as ScenarioRole]=d.type==='decimal'?{type:'decimal',value,unit:d.unit!}:{type:'text',value};onChange(next);
 }}/>)}</>;
}
