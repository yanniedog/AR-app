import React from 'react';
import type { EligibilitySubject } from '../../data/eligibilityContracts/types';
import type { EligibilityScenario,ScenarioRole } from '../../data/eligibilityContracts/facts';
import { uiEligibilityScenarioInput, uiIdentifier, uiJoin, uiLabel, type UiText } from '../../lib/uiCopy';
import { LedgerField } from '../ledger/LedgerField';

function scenarioFieldLabel(role: ScenarioRole): UiText {
 switch(role){case 'scenario_amount':return uiLabel('Amount');case 'scenario_purpose':return uiLabel('Loan purpose');case 'scenario_security_value':return uiLabel('Security value');case 'scenario_security_type':return uiLabel('Security type');case 'scenario_ownership':return uiLabel('Ownership');}
}

/** Only reviewed scenario roles; customer-profile answers never supply these values. */
export function EligibilityScenarioFields({definitions,needed,values,onChange}:{definitions:EligibilitySubject['inputDefinitions'];needed:EligibilitySubject['inputDefinitions'];values:EligibilityScenario['values'];onChange:(values:EligibilityScenario['values'])=>void}){
 const fields=definitions.filter(d=>!['customer_fact','assessment_date'].includes(d.binding)&&(needed.some(n=>n.key===d.key)||Object.hasOwn(values,d.binding)));
 return <>{fields.map(d=><LedgerField key={d.key} label={uiJoin(scenarioFieldLabel(d.binding as ScenarioRole), d.unit ? uiJoin(' (', uiIdentifier(d.unit), ')') : null)} value={uiEligibilityScenarioInput(values,d.binding as ScenarioRole)} keyboardType={d.type==='decimal'?'decimal-pad':'default'} onChangeText={value=>{
  const next={...values};if(!value)delete next[d.binding as ScenarioRole];else next[d.binding as ScenarioRole]=d.type==='decimal'?{type:'decimal',value,unit:d.unit!}:{type:'text',value};onChange(next);
 }}/>)}</>;
}
