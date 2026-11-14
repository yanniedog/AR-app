import { canonicalPurpose, canonicalRepayment } from '../data/mortgageFacets';
import { isWidelyAvailableMortgageFacet, scopeMortgageFacets } from '../data/mortgageFacetScope';
import { publicCataloguePricingKey, type PublicCatalogueView } from '../data/publicRateIntegration';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TextInput, useWindowDimensions, View } from 'react-native';
import { useMortgageComparison, clearMortgageComparison, mortgageComparisonValues, setMortgageComparisonInputs, type MortgageComparisonInputs } from '../data/mortgageComparison';
import { profileAttributeOptions } from '../data/profileRequirements';
import { humanizeEnum } from '../data/format';
import type { Filters } from '../data/selectors';
import type { RateRow } from '../types';
import { useStore } from '../data/store';
import { updateRatesSection } from '../data/ratesSession';
import { uiCount, uiJoin, uiLabel, uiMoney, uiMortgageComparisonInput, uiRate } from '../lib/uiCopy';
import { yieldToUi } from '../lib/yieldToUi';
import { useTheme } from '../theme/ThemeProvider';
import { AppText, Chip, Row } from './ui';
import { IconAction } from './IconAction';
import { SegmentedControl } from './controls';

const TYPING_DEBOUNCE_MS = 200;
const EMPTY_FACETS = { loanPurposes: [], repaymentTypes: [] };

// Untouched inputs default to funds available with an offset account. A
// direct LVR (for example from an audit scope) keeps the LVR mode, and a saved
// funds scenario without a type keeps its deposit meaning.
function resolvedMode(value: MortgageComparisonInputs): 'lvr' | 'funds' {
  return value.lvrMode ?? (value.lvr.trim() ? 'lvr' : 'funds');
}
function resolvedFundsType(value: MortgageComparisonInputs): 'deposit' | 'offset' {
  return value.fundsType ?? (value.lvrMode === 'funds' ? 'deposit' : 'offset');
}
function withResolvedMode(value: MortgageComparisonInputs): MortgageComparisonInputs {
  if (value.lvrMode || resolvedMode(value) !== 'funds') return value;
  return { ...value, lvrMode: 'funds', fundsType: resolvedFundsType(value) };
}

function sameInputs(left: MortgageComparisonInputs, right: MortgageComparisonInputs): boolean {
  return left.loanAmount === right.loanAmount && left.lvr === right.lvr
    && (left.lvrMode ?? 'lvr') === (right.lvrMode ?? 'lvr')
    && (left.fundsAvailable ?? '') === (right.fundsAvailable ?? '')
    && (left.fundsType ?? 'deposit') === (right.fundsType ?? 'deposit')
    && (left.propertyValue ?? '') === (right.propertyValue ?? '');
}

type FacetKey = 'loanPurposes' | 'repaymentTypes';
type NumericInputField = 'loanAmount' | 'lvr' | 'fundsAvailable' | 'propertyValue';

function rowFacetOptions(
  rows: RateRow[],
  filters: Pick<Filters, FacetKey>,
): Record<FacetKey, string[]> {
  return {
    loanPurposes: (() => {
      const meanings = new Set<string | undefined>();
      return profileAttributeOptions(rows, 'loan_purpose', filters.loanPurposes).filter(option => {
        const meaning = canonicalPurpose(option);
        const duplicate = meanings.has(meaning);
        meanings.add(meaning);
        return filters.loanPurposes.includes(option) || !duplicate;
      });
    })(),
    repaymentTypes: (() => {
      const meanings = new Set<string | undefined>();
      return profileAttributeOptions(rows, 'ribbon_repayment_type', filters.repaymentTypes).filter(option => {
        const meaning = canonicalRepayment(option);
        const duplicate = meanings.has(meaning);
        meanings.add(meaning);
        return filters.repaymentTypes.includes(option) || !duplicate;
      });
    })(),
  };
}

// The header remounts with the list; the installed row array does not change.
const rowFacetCache = new WeakMap<RateRow[], Record<FacetKey, string[]>>();
function cachedRowFacetOptions(rows: RateRow[]): Record<FacetKey, string[]> {
  let options = rowFacetCache.get(rows);
  if (!options) { options = rowFacetOptions(rows, EMPTY_FACETS); rowFacetCache.set(rows, options); }
  return options;
}

/** Catalogue condition scan — keyed by content identity, not snapshot object identity. */
function catalogueFacetOptions(catalogue: PublicCatalogueView): Record<FacetKey, string[]> {
  const loanPurposes: string[] = [];
  const repaymentTypes: string[] = [];
  const seenPurpose = new Set<string>();
  const seenRepayment = new Set<string>();
  for (const product of catalogue.products) {
    if (product.section !== 'Mortgage' || product.status === 'legacy') continue;
    for (const programme of catalogue.getProgrammes(product.productId)) {
      if (programme.section !== 'Mortgage') continue;
      for (const condition of programme.conditions) {
        if (condition.field !== 'purpose' && condition.field !== 'repayment') continue;
        const values = condition.operator === 'eq' ? [condition.value]
          : condition.operator === 'in' ? condition.values ?? [] : [];
        for (const value of values) {
          if (typeof value !== 'string' || !value.trim()) continue;
          if (condition.field === 'purpose') {
            const option = canonicalPurpose(value)!;
            if (!seenPurpose.has(option)) { loanPurposes.push(option); seenPurpose.add(option); }
          } else {
            const option = canonicalRepayment(value)!;
            if (!seenRepayment.has(option)) { repaymentTypes.push(option); seenRepayment.add(option); }
          }
        }
      }
    }
  }
  return { loanPurposes, repaymentTypes };
}

function mergeFacetOptions(
  base: string[],
  extra: string[],
  selected: readonly string[],
  canonicalize: (value: string) => string | undefined,
): string[] {
  const meanings = new Set<string>();
  const merged: string[] = [];
  const add = (option: string) => {
    const meaning = canonicalize(option) ?? option;
    if (meanings.has(meaning)) return;
    meanings.add(meaning);
    merged.push(meaning);
  };
  for (const option of base) add(option);
  for (const option of extra) add(option);
  for (const option of selected) add(option);
  return merged;
}

export function MortgageComparisonControls({ rows, catalogue, filters, unverified, invalid }: {
  rows: RateRow[]; catalogue?: PublicCatalogueView; filters: Filters; unverified: number; invalid: boolean;
}) {
  const theme = useTheme(), storeValue = useMortgageComparison();
  const { fontScale } = useWindowDimensions();
  const metric = useStore(state => state.prefs.mortgageRateMetric);
  // Keep keystrokes local so Rates can leave catalogue work until typing pauses.
  // Audit/programmatic store writes still apply immediately (dirty stays false).
  const [draft, setDraft] = useState(storeValue);
  const dirty = useRef(false);
  const writing = useRef(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const commitDraft = useCallback((next: MortgageComparisonInputs) => {
    writing.current = true;
    setMortgageComparisonInputs(next);
    dirty.current = false;
    writing.current = false;
  }, []);
  useEffect(() => useMortgageComparison.subscribe((state) => {
    // External writes (clear / audit apply / Reset Rates view) must win over an
    // in-progress draft, including same-value clears that leave loanAmount/lvr
    // unchanged. Own commits set writing so they do not abandon themselves.
    if (writing.current) return;
    if (dirty.current) dirty.current = false;
    setDraft(state);
  }), []);
  useEffect(() => {
    if (!dirty.current) return;
    if (sameInputs(draft, storeValue)) {
      dirty.current = false;
      return;
    }
    const timer = setTimeout(() => {
      if (dirty.current && draftRef.current === draft) commitDraft(draft);
    }, TYPING_DEBOUNCE_MS);
    // Dependency-change cleanup must only cancel the timer. Flushing here would
    // commit a stale draft and clear dirty before the next keystroke schedules.
    return () => clearTimeout(timer);
  }, [draft, storeValue, commitDraft]);
  // Section switches unmount these controls; flush the latest draft so the
  // committed store keeps the last typed amount, LVR and funds drafts.
  useEffect(() => () => {
    if (!dirty.current) return;
    commitDraft(draftRef.current);
  }, [commitDraft]);
  const rowOptions = useMemo(() => cachedRowFacetOptions(rows), [rows]);
  const catalogueKey = useMemo(() => catalogue ? publicCataloguePricingKey(catalogue) : '', [catalogue]);
  const catalogueRef = useRef(catalogue);
  catalogueRef.current = catalogue;
  // Snapshot object identity changes on every shard tick; key on content so
  // mortgage.scope.apply does not re-walk the full programme book each render.
  // Large books leave the header render and yield before the scan.
  const catalogueOptions = useMemo(() => {
    void catalogueKey;
    const view = catalogueRef.current;
    if (!view || view.status !== 'ready' || view.products.length > 48) {
      return { loanPurposes: [] as string[], repaymentTypes: [] as string[] };
    }
    return catalogueFacetOptions(view);
  }, [catalogueKey]);
  const [deferredCatalogueOptions, setDeferredCatalogueOptions] = useState<Record<FacetKey, string[]> | null>(null);
  useEffect(() => {
    const view = catalogueRef.current;
    if (!view || view.status !== 'ready' || view.products.length <= 48) {
      setDeferredCatalogueOptions(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      await yieldToUi(0);
      if (cancelled) return;
      const options: Record<FacetKey, string[]> = { loanPurposes: [], repaymentTypes: [] };
      const purposes = new Set<string>(), repayments = new Set<string>();
      let checkpoint = performance.now();
      for (const product of view.products) {
        if (cancelled) return;
        if (product.section !== 'Mortgage' || product.status === 'legacy') continue;
        for (const programme of view.getProgrammes(product.productId)) {
          if (programme.section !== 'Mortgage') continue;
          for (const condition of programme.conditions) {
            if (condition.field !== 'purpose' && condition.field !== 'repayment') continue;
            const values = condition.operator === 'eq' ? [condition.value] : condition.operator === 'in' ? condition.values ?? [] : [];
            for (const value of values) {
              if (typeof value !== 'string' || !value.trim()) continue;
              if (condition.field === 'purpose') purposes.add(canonicalPurpose(value)!);
              else repayments.add(canonicalRepayment(value)!);
            }
          }
          if (performance.now() - checkpoint >= 4) { await yieldToUi(0); checkpoint = performance.now(); if (cancelled) return; }
        }
      }
      options.loanPurposes = [...purposes]; options.repaymentTypes = [...repayments];
      if (!cancelled) setDeferredCatalogueOptions(options);
    })();
    return () => { cancelled = true; };
  }, [catalogueKey]);
  const facetCatalogueOptions = deferredCatalogueOptions ?? catalogueOptions;
  const groups = useMemo(() => ([
    { key: 'loanPurposes' as const, label: 'Loan purpose' as const, canonicalize: canonicalPurpose },
    { key: 'repaymentTypes' as const, label: 'Repayment' as const, canonicalize: canonicalRepayment },
  ]).map(group => ({
    key: group.key,
    label: group.label,
    canonicalize: group.canonicalize,
    options: mergeFacetOptions(
      rowOptions[group.key],
      facetCatalogueOptions[group.key],
      filters[group.key],
      group.canonicalize,
    ).filter(option => filters.includeNonStandard || isWidelyAvailableMortgageFacet(group.key, option)),
  })), [rowOptions, facetCatalogueOptions, filters]);
  const change = (field: NumericInputField, text: string) => {
    dirty.current = true;
    setDraft(current => ({ ...withResolvedMode(current), [field]: text }));
  };
  const clearInputs = () => {
    dirty.current = false;
    setDraft({ loanAmount: '', lvr: '' });
    clearMortgageComparison();
    updateRatesSection('Mortgage', { page: 1 }, true);
  };
  const mode = resolvedMode(draft);
  const fundsType = resolvedFundsType(draft);
  const values = mortgageComparisonValues(withResolvedMode(draft));
  const pending = !sameInputs(draft, storeValue);
  const changeMode = (nextMode: 'lvr' | 'funds') => {
    if (nextMode === mode) return;
    const current = draftRef.current;
    const next: MortgageComparisonInputs = nextMode === 'funds'
      ? { ...current, lvrMode: nextMode, fundsType: current.fundsType ?? 'offset' }
      : { ...current, lvrMode: nextMode };
    setDraft(next);
    // An explicit mode choice commits the latest typed values together, just
    // like selecting a purpose/repayment facet, and cancels an older debounce.
    commitDraft(next);
  };
  const changeFundsType = (nextType: 'deposit' | 'offset') => {
    if (nextType === fundsType) return;
    const next = { ...withResolvedMode(draftRef.current), fundsType: nextType };
    setDraft(next);
    commitDraft(next);
  };
  const fields: NumericInputField[] = mode === 'lvr' ? ['loanAmount', 'lvr']
    : fundsType === 'offset' ? ['loanAmount', 'fundsAvailable', 'propertyValue'] : ['loanAmount', 'fundsAvailable'];
  const fieldLabel = (field: NumericInputField) =>
    uiLabel(field === 'loanAmount' ? 'Loan amount' : field === 'propertyValue' ? 'Property value'
      : field === 'fundsAvailable' ? fundsType === 'offset' ? 'Offset balance' : 'Deposit' : 'LVR');
  return <View style={{ gap: 8 }} testID="mortgage-comparison-controls">
    <SegmentedControl value={mode} options={[{ value: 'funds', label: uiLabel('Funds available') }, { value: 'lvr', label: uiLabel('LVR') }]}
      onChange={changeMode} />
    {mode === 'funds' ? <SegmentedControl value={fundsType} options={[{ value: 'deposit', label: uiLabel('Deposit') }, { value: 'offset', label: uiLabel('Offset account') }]}
      onChange={changeFundsType} /> : null}
    <Row gap={8} style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>{fields.map(field => <View key={field} style={{ flexBasis: Math.min(220, 120 * Math.max(1, fontScale)), flexGrow: 1, minWidth: 0, gap: 4 }}>
      <AppText variant="small">{fieldLabel(field)}</AppText>
      <TextInput value={uiMortgageComparisonInput(draft, field)} onChangeText={text => change(field, text)} keyboardType="decimal-pad"
        accessibilityLabel={fieldLabel(field)}
        placeholder={uiLabel(field === 'lvr' ? '%' : '$')}
        style={{ minHeight: 48, minWidth: 0, color: theme.colors.text, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 6, padding: 8, fontSize: theme.font.body }} />
    </View>)}<IconAction icon="close" word="Clear" accessibilityLabel="Clear comparison inputs" onPress={clearInputs} /></Row>
    {mode === 'funds' ? <Row gap={12} style={{ flexWrap: 'wrap' }}>
      <AppText variant="small" testID="mortgage-calculated-lvr">{uiJoin('Calculated LVR', ' · ', values.lvr === null ? uiLabel('Unknown') : uiRate(values.lvr / 100))}</AppText>
      {fundsType === 'deposit'
        ? <AppText variant="small" testID="mortgage-property-value">{uiJoin('Property value', ' · ', uiMoney(values.propertyValue, Number.isInteger(values.propertyValue) ? 0 : 2))}</AppText>
        : <AppText variant="small" testID="mortgage-loan-less-offset">{uiJoin('Loan less offset', ' · ', uiMoney(values.interestBearingBalance, Number.isInteger(values.interestBearingBalance) ? 0 : 2))}</AppText>}
    </Row> : null}
    {pending
      ? <AppText variant="tiny" color="textMuted">{uiLabel('Updating')}</AppText> : null}
    <Row gap={8} style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
    {groups.map(group => <View key={group.key} style={{ gap: 4, flexBasis: Math.min(240, 170 * Math.max(1, fontScale)), flexGrow: 1, minWidth: 0 }}>
      <AppText variant="small">{uiLabel(group.label)}</AppText>
      <Row gap={6} style={{ flexWrap: 'wrap' }}>{group.options.map(option => {
        const meaningOf = (value: string) => group.canonicalize(value) ?? value;
        const selected = filters[group.key].some(item => meaningOf(item) === option);
        return <Chip key={option} label={humanizeEnum(option)} selected={selected}
          onPress={() => { if (dirty.current) commitDraft(draftRef.current); updateRatesSection('Mortgage', current => {
            const scoped = scopeMortgageFacets(current.filters, filters.includeNonStandard);
            return { filters: { ...scoped, [group.key]: selected
              ? scoped[group.key].filter(item => meaningOf(item) !== option)
              : [...scoped[group.key], option] } };
          }, true); }} />;
      })}</Row>
    </View>)}
    </Row>
    <SegmentedControl value={metric} options={[{ value: 'headline', label: uiLabel('Advertised rate') }, { value: 'comparison', label: uiLabel('Comparison rate') }]}
      onChange={next => useStore.getState().setPref('mortgageRateMetric', next)} />
    {(pending ? values.invalid : invalid) ? <AppText color="danger">{uiLabel('Invalid comparison inputs')}</AppText> : unverified > 0 ? <AppText variant="small">{uiJoin('Eligibility unverified', ' · ', uiCount(unverified))}</AppText> : null}
  </View>;
}
