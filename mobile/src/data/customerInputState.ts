import type { CustomerProfile } from './customerProfile';
import { userProvenance } from './customerProfileProvenance';
import { normalizeUserRateScenario, type UserRateScenario } from './userRateScenarioModel';
import { calculatorAmount, computeLvr, MAX_CALCULATOR_MORTGAGE_AMOUNT } from './calc';
import type { MortgageComparisonInputs } from './mortgageComparison';
import { currencyAmount } from './currencyInput';
import { Decimal } from '../lib/productTermsEngine/decimal';

export interface CustomerInputState {
  version: 1;
  scenario: UserRateScenario;
  comparison: { lvr: string; lvrMode?: 'lvr' | 'funds'; fundsType?: 'deposit' | 'offset'; facets: { loanPurposes: string[]; repaymentTypes: string[] } };
  conflicts: { path: string; current: string; incoming: string }[];
  legacyComparison: unknown;
}
const paths = ['mortgage.propertyValue', 'mortgage.loanBalance', 'mortgage.currentRate', 'mortgage.deposit', 'mortgage.costs', 'mortgage.years', 'savings.balance', 'savings.currentRate', 'termDeposit.balance', 'termDeposit.currentRate', 'projections.mortgage.offsetBalance'] as const;
const fieldLabels = ['Property value', 'Mortgage balance', 'Mortgage rate', 'Deposit', 'Upfront costs', 'Years remaining', 'Savings balance', 'Savings rate', 'Term deposit balance', 'Term deposit rate', 'Offset balance'];
export type SharedInputPath = typeof paths[number];
function scalar(value: string, percentage = false): string | null {
  const text = percentage ? value.trim().replace(/\s*%$/, '').trim() : value.trim();
  if (!/^\+?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null;
  const normalized = text.replace(/^\+/, '').replace(/^\./, '0.').replace(/\.$/, '').replace(/^0+(?=\d)/, '');
  return normalized.length <= 100 ? normalized : null;
}
function equivalent(path: SharedInputPath, left: string, right: string): boolean {
  if (left === right) return true;
  if (path.endsWith('Rate') || path.endsWith('years')) {
    const a = scalar(left, path.endsWith('Rate')), b = scalar(right, path.endsWith('Rate'));
    return a !== null && b !== null && Number(a) === Number(b);
  }
  const a = calculatorAmount(left, MAX_CALCULATOR_MORTGAGE_AMOUNT), b = calculatorAmount(right, MAX_CALCULATOR_MORTGAGE_AMOUNT);
  return a !== null && a === b;
}
export function inputAt(scenario: UserRateScenario, path: SharedInputPath): string {
  return path.split('.').reduce<unknown>((value, key) => (value as Record<string, unknown>)[key], scenario) as string;
}
export function withInput(scenario: UserRateScenario, path: SharedInputPath, value: string): UserRateScenario {
  const next = normalizeUserRateScenario(scenario);
  let target = next as unknown as Record<string, unknown>;
  const keys = path.split('.');
  for (const key of keys.slice(0, -1)) target = target[key] as Record<string, unknown>;
  target[keys[keys.length - 1]] = value;
  return next;
}
function sorted(value: unknown): string {
  return JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
}
export function validateCustomerInputState(value: unknown): asserts value is CustomerInputState {
  const state = value as CustomerInputState;
  if (!state || state.version !== 1 || !state.scenario || state.scenario.version !== 4
    || sorted(normalizeUserRateScenario(state.scenario)) !== sorted(state.scenario)
    || !state.comparison || typeof state.comparison.lvr !== 'string'
    || ![undefined, 'lvr', 'funds'].includes(state.comparison.lvrMode)
    || ![undefined, 'deposit', 'offset'].includes(state.comparison.fundsType)
    || !state.comparison.facets || ![state.comparison.facets.loanPurposes, state.comparison.facets.repaymentTypes].every(items => Array.isArray(items) && items.every(item => typeof item === 'string'))
    || !Array.isArray(state.conflicts) || state.conflicts.length > 32
    || state.conflicts.some(item => !paths.includes(item.path as SharedInputPath) || typeof item.current !== 'string' || typeof item.incoming !== 'string')) throw new Error('Invalid shared customer inputs. Original retained.');
}
export function comparisonInputs(state: CustomerInputState): MortgageComparisonInputs {
  const { scenario, comparison } = state;
  const mode = comparison.lvrMode ?? (scenario.mortgage.propertyValue.trim() ? 'funds' : undefined);
  const fundsType = comparison.fundsType ?? 'offset';
  let deposit = scenario.mortgage.deposit;
  if (scenario.mortgage.mode === 'buy' && fundsType === 'deposit') {
    const gross = currencyAmount(scenario.mortgage.deposit || '0'), costs = currencyAmount(scenario.mortgage.costs || '0');
    try {
      if (!gross || !costs || calculatorAmount(gross, MAX_CALCULATOR_MORTGAGE_AMOUNT) === null || calculatorAmount(costs, MAX_CALCULATOR_MORTGAGE_AMOUNT) === null) deposit = '';
      else {
        const net = Decimal.parse(gross).sub(Decimal.parse(costs));
        deposit = net.compare(Decimal.parse('0')) >= 0 ? net.fixed(2) : '0';
      }
    } catch { deposit = ''; }
  }
  const loan = scenario.mortgage.mode === 'buy' ? computeLvr(scenario.mortgage).loan : null;
  return {
    loanAmount: scenario.mortgage.mode === 'buy' ? loan !== null ? String(loan) : '' : scenario.mortgage.loanBalance,
    lvr: comparison.lvr,
    ...(mode ? { lvrMode: mode } : {}),
    ...(mode === 'funds' ? { fundsType,
      fundsAvailable: fundsType === 'offset' ? scenario.projections.mortgage.offsetBalance : deposit,
      ...(fundsType === 'offset' ? { propertyValue: scenario.mortgage.propertyValue } : {}),
    } : {}),
  };
}
export function applyComparisonInputs(state: CustomerInputState, value: MortgageComparisonInputs): CustomerInputState {
  let scenario = normalizeUserRateScenario(state.scenario);
  scenario.mortgage = { ...scenario.mortgage, mode: 'refi', loanBalance: value.loanAmount };
  if (value.lvrMode === 'funds') {
    if (value.fundsType === 'offset') {
      scenario.mortgage.propertyValue = value.propertyValue ?? '';
      scenario.projections.mortgage.offsetBalance = value.fundsAvailable ?? '';
    } else {
      scenario.mortgage.deposit = value.fundsAvailable ?? '';
      const loan = calculatorAmount(value.loanAmount, MAX_CALCULATOR_MORTGAGE_AMOUNT);
      const deposit = calculatorAmount(value.fundsAvailable ?? '', MAX_CALCULATOR_MORTGAGE_AMOUNT);
      scenario.mortgage.propertyValue = loan !== null && deposit !== null
        ? Decimal.parse(currencyAmount(value.loanAmount)!).add(Decimal.parse(currencyAmount(value.fundsAvailable ?? '')!)).fixed(2) : '';
    }
  }
  return { ...state, scenario, comparison: { ...state.comparison, lvr: value.lvr, lvrMode: value.lvrMode, fundsType: value.fundsType } };
}
export function migrateInputState(profile: CustomerProfile, legacyScenario: unknown, legacyComparison: unknown): CustomerInputState {
  const version = legacyScenario && typeof legacyScenario === 'object' ? (legacyScenario as { version?: unknown }).version : undefined;
  if (version !== undefined && ![1, 2, 3, 4].includes(version as number)) throw new Error('Unsupported legacy scenario version. Original retained.');
  let scenario = normalizeUserRateScenario(legacyScenario);
  const comparison = legacyComparison as { version?: number; inputs?: MortgageComparisonInputs; facets?: CustomerInputState['comparison']['facets'] } | null;
  if (comparison && (comparison.version !== 1 || !comparison.inputs || typeof comparison.inputs.loanAmount !== 'string' || typeof comparison.inputs.lvr !== 'string'
    || !comparison.facets || ![comparison.facets.loanPurposes, comparison.facets.repaymentTypes].every(items => Array.isArray(items) && items.every(item => typeof item === 'string')))) throw new Error('Invalid legacy comparison. Original retained.');
  const state: CustomerInputState = { version: 1, scenario,
    comparison: { lvr: '', ...(scenario.mortgage.propertyValue ? { lvrMode: 'funds', fundsType: 'offset' } as const : {}), facets: { loanPurposes: [], repaymentTypes: [] } },
    conflicts: [], legacyComparison };
  if (comparison?.inputs) {
    const incoming = applyComparisonInputs(state, comparison.inputs);
    state.comparison = { ...incoming.comparison, facets: comparison.facets! };
    for (const path of paths) {
      const current = inputAt(scenario, path), next = inputAt(incoming.scenario, path);
      if (!current && next) scenario = withInput(scenario, path, next);
      else if (current && next && !equivalent(path, current, next)) state.conflicts.push({ path, current, incoming: next });
    }
    if (!legacyScenario) scenario.mortgage.mode = incoming.scenario.mortgage.mode;
  }
  for (const path of paths) {
    const answer = profile.answers[`legacy.${path}`];
    if (answer?.state === 'known' && answer.fact.type === 'decimal') {
      const current = inputAt(scenario, path), incoming = answer.fact.value;
      if (current && !equivalent(path, current, incoming)) state.conflicts.push({ path, current, incoming });
      else scenario = withInput(scenario, path, incoming);
    }
  }
  return { ...state, scenario };
}
/** Profile answer edits and task edits address the same stored numeric values. */
export function reconcileProfileAnswers(previous: CustomerProfile, next: CustomerProfile): CustomerProfile {
  if (!next.inputState) return next;
  let scenario = next.inputState.scenario;
  const answers = { ...next.answers };
  const definitions = { ...next.definitions };
  for (const path of paths) {
    const id = `legacy.${path}`, answer = next.answers[id];
    if (JSON.stringify(answer) !== JSON.stringify(previous.answers[id])) {
      if (answer?.state === 'known' && answer.fact.type === 'decimal') scenario = withInput(scenario, path, answer.fact.value);
      else if (answer) scenario = withInput(scenario, path, '');
    } else {
      const value = inputAt(scenario, path);
      const unit = path.endsWith('Rate') ? 'percent' : path.endsWith('years') ? 'years' : 'AUD';
      let decimal = unit === 'AUD' ? currencyAmount(value) : scalar(value, unit === 'percent');
      try { if (decimal) Decimal.parse(decimal); } catch { decimal = null; }
      // Invalid/partial typing remains a task draft and never becomes a known fact.
      if (decimal && (!answer || answer.state !== 'known' || answer.fact.type !== 'decimal' || answer.fact.value !== decimal)) {
        definitions[id] = { id, label: fieldLabels[paths.indexOf(path)], type: 'decimal', unit };
        answers[id] = { state: 'known', fact: { type: 'decimal', value: decimal, unit }, provenance: userProvenance() };
      } else if (!decimal && answer?.state === 'known') answers[id] = { state: 'unknown', provenance: userProvenance() };
    }
  }
  return { ...next, definitions, answers, inputState: { ...next.inputState, scenario } };
}
