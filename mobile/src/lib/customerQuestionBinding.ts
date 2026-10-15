import { validDefinition, type InputDefinition } from '../data/customerProfile';
import { profileDefinitions } from '../data/executableContracts/instantiate';
import { assertSelection, type ApprovedSelection, type ContractContext } from '../data/executableContracts/transport';
import { eligibilityDefinition } from '../data/eligibilityContracts/facts';
import { assertEligibilitySelection, type EligibilitySelection, type EligibilityContext, type EligibilityTarget } from '../data/eligibilityContracts/transport';
import { savingsDefinition } from '../data/monetaryContracts/facts';
import { assertSavingsSelection, type SavingsSelection } from '../data/monetaryContracts/transport';
import { assertActivitySelection, type ActivitySelection } from '../data/activityContracts/transport';
import { mortgageDefinition } from '../data/mortgageContracts/facts';
import { assertMortgageSelection, type MortgageSelection } from '../data/mortgageContracts/transport';
import type { ReplayOption } from '../data/receiptReplay/resolve';
import type { RateRow } from '../types';

export type CustomerQuestionSource =
  | { kind: 'td'; selection: ApprovedSelection; context: ContractContext; row: RateRow }
  | { kind: 'eligibility'; selection: EligibilitySelection; context: EligibilityContext; target: EligibilityTarget }
  | { kind: 'savings'; selection: SavingsSelection; context: EligibilityContext; target: EligibilityTarget }
  | { kind: 'activity'; selection: ActivitySelection; context: EligibilityContext; target: EligibilityTarget }
  | { kind: 'mortgage'; selection: MortgageSelection; context: EligibilityContext; target: EligibilityTarget };

declare const QUESTION: unique symbol;
export interface CustomerQuestionBinding { readonly [QUESTION]: true }
const bindings = new WeakMap<CustomerQuestionBinding, { definition: InputDefinition; snapshot: string; source: CustomerQuestionSource }>();
const signature = (definition: InputDefinition) => JSON.stringify([definition.id, definition.label, definition.type, definition.unit]);

/** Only current transport-created handles can supply customer_fact questions. */
function sourceDefinitions(source: CustomerQuestionSource): InputDefinition[] {
  switch (source.kind) {
    case 'td':
      assertSelection(source.selection, source.context, source.row);
      return profileDefinitions(source.selection);
    case 'eligibility':
      assertEligibilitySelection(source.selection, source.context, source.target);
      return source.selection.subject.inputDefinitions.filter(d => d.binding === 'customer_fact')
        .map(d => eligibilityDefinition(source.selection.subject, d.key));
    case 'savings':
      assertSavingsSelection(source.selection, source.context, source.target);
      return source.selection.subject.policy.inputDefinitions.filter(d => d.binding === 'customer_fact')
        .map(d => savingsDefinition(source.selection.subject, d.key));
    case 'activity':
      assertActivitySelection(source.selection, source.context, source.target);
      return source.selection.subject.policy.inputDefinitions.filter(d => d.binding === 'customer_fact')
        .map(d => savingsDefinition(source.selection.subject, d.key));
    case 'mortgage':
      assertMortgageSelection(source.selection, source.context, source.target);
      return source.selection.subject.policy.inputDefinitions.filter(d => d.binding === 'customer_fact')
        .map(d => mortgageDefinition(source.selection.subject, d.field));
  }
}
function questionLabel(definition: InputDefinition, source: CustomerQuestionSource): string | null {
  if (!validDefinition(definition)) return null;
  const actual = sourceDefinitions(source).find(d => signature(d) === signature(definition));
  // The semantic field is the reviewed input label, never a clause/description.
  if (!actual || actual.label.length > 160 || /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(actual.label)) return null;
  return actual.label.trim() || null;
}
/** Ephemeral only: no customer profile, contract or receipt fields are changed. */
export function bindCustomerQuestion(definition: InputDefinition, source: CustomerQuestionSource): CustomerQuestionBinding | null {
  try {
    if (!questionLabel(definition, source)) return null;
    const token = Object.freeze({}) as CustomerQuestionBinding;
    bindings.set(token, { definition, snapshot: signature(definition), source });
    return token;
  } catch { return null; }
}
export function readBoundCustomerQuestion(definition: InputDefinition, binding: CustomerQuestionBinding | null): string | null {
  try {
    const record = binding && bindings.get(binding);
    if (!record || record.definition !== definition || record.snapshot !== signature(definition)) return null;
    return questionLabel(definition, record.source);
  } catch { return null; }
}
/** Replay uses the same current handles and targets, never imported display text. */
export function replayQuestionSource(option: ReplayOption, context: EligibilityContext): CustomerQuestionSource | undefined {
  if (option.item.kind === 'td' && 'template' in option.selection && !('kind' in option.target))
    return { kind: 'td', selection: option.selection, context, row: option.target };
  if ('template' in option.selection || !('kind' in option.target)) return undefined;
  switch (option.item.kind) {
    case 'eligibility_only': return { kind: 'eligibility', selection: option.selection as EligibilitySelection, context, target: option.target };
    case 'savings_calculation': return { kind: 'savings', selection: option.selection as SavingsSelection, context, target: option.target };
    case 'savings_activity_calculation': return { kind: 'activity', selection: option.selection as ActivitySelection, context, target: option.target };
    case 'mortgage_calculation': return { kind: 'mortgage', selection: option.selection as MortgageSelection, context, target: option.target };
    default: return undefined;
  }
}
