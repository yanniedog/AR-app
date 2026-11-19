import { canonicalPurpose, canonicalRepayment } from '../data/mortgageFacets';
import { isWidelyAvailableMortgageFacet, scopeMortgageFacets } from '../data/mortgageFacetScope';
import { publicCataloguePricingKey, type PublicCatalogueView } from '../data/publicRateIntegration';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import { useMortgageComparison, mortgageComparisonValues, type MortgageComparisonInputs } from '../data/mortgageComparison';
import { openMortgageComparisonProfile, saveMortgageComparisonFacets, saveMortgageComparisonInputs,
  clearSavedMortgageComparison, useMortgageComparisonProfile } from '../data/mortgageComparisonProfile';
import { profileAttributeOptions } from '../data/profileRequirements';
import { humanizeEnum } from '../data/format';
import { DEFAULT_MORTGAGE_BROWSE_FACETS, effectiveMortgageBrowseAssumptions } from '../data/mortgageComparisonScenario';
import { LIST_REPAYMENT_TERM_YEARS } from '../data/mortgageRepayment';
import type { Filters } from '../data/selectors';
import type { RateRow } from '../types';
import { useStore } from '../data/store';
import { updateRatesSection, useRatesSession } from '../data/ratesSession';
import { uiCount, uiJoin, uiLabel, uiMoney, uiMortgageComparisonInput, uiRate } from '../lib/uiCopy';
import { yieldToUi } from '../lib/yieldToUi';
import { useTheme } from '../theme/ThemeProvider';
import { AppText, Button, Chip, Row } from './ui';
import { IconAction } from './IconAction';
import { SegmentedControl } from './controls';
import { CurrencyInput } from './CurrencyInput';
import { SharedInputConflicts } from './SharedInputConflicts';

const TYPING_DEBOUNCE_MS = 200;
const EMPTY_FACETS = { loanPurposes: [], repaymentTypes: [] };
const STANDARD_FACETS = {
  loanPurposes: ['OWNER_OCCUPIED', 'INVESTMENT'],
  repaymentTypes: ['PRINCIPAL_AND_INTEREST', 'INTEREST_ONLY'],
};

// Untouched inputs default to funds available with an offset account. A
// direct LVR (for example from an audit scope) keeps the LVR mode, and a saved
// funds scenario without a type keeps its deposit meaning.
function resolvedMode(value: MortgageComparisonInputs): 'lvr' | 'funds' {
  return value.lvrMode ?? (value.lvr.trim() ? 'lvr' : 'funds');
}
function resolvedFundsType(value: MortgageComparisonInputs): 'deposit' | 'offset' {
  return value.fundsType ?? (value.lvrMode === 'funds' ? 'deposit' : 'offset');
}
// Materialises the displayed mode and funds type so edits never flip the
// selected inputs and the data layer never has to infer either default.
function withResolvedMode(value: MortgageComparisonInputs): MortgageComparisonInputs {
  if (resolvedMode(value) === 'lvr') return value.lvrMode === 'lvr' ? value : { ...value, lvrMode: 'lvr' };
  const fundsType = resolvedFundsType(value);
  return value.lvrMode === 'funds' && value.fundsType === fundsType ? value : { ...value, lvrMode: 'funds', fundsType };
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

export function MortgageComparisonControls({ rows, catalogue, filters, unverified, invalid, collapsible = false, profile = false,
  open, onOpenChange }: {
  rows: RateRow[]; catalogue?: PublicCatalogueView; filters: Filters; unverified: number; invalid: boolean;
  collapsible?: boolean; profile?: boolean;
  /** Controlled expansion for collapsible controls (e.g. opened from an empty state). */
  open?: boolean; onOpenChange?: (open: boolean) => void;
}) {
  const theme = useTheme();
  const liveValue = useMortgageComparison();
  const profileValue = useMortgageComparisonProfile(state => profile ? state.profile.inputs : null);
  const storeValue = profileValue ?? liveValue;
  const { fontScale } = useWindowDimensions();
  const metric = useStore(state => state.prefs.mortgageRateMetric);
  const storageStatus = useMortgageComparisonProfile(state => state.status);
  // Keep keystrokes local so Rates can leave catalogue work until typing pauses.
  // Audit/programmatic store writes still apply immediately (dirty stays false).
  const [draft, setDraft] = useState(storeValue);
  const dirty = useRef(false);
  const writing = useRef(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const commitDraft = useCallback((next: MortgageComparisonInputs) => {
    writing.current = true;
    saveMortgageComparisonInputs(next);
    dirty.current = false;
    writing.current = false;
  }, []);
  useEffect(() => {
    function onExternalChange(state: MortgageComparisonInputs) {
    // External writes (clear / audit apply / Reset Rates view) must win over an
    // in-progress draft, including same-value clears that leave loanAmount/lvr
    // unchanged. Own commits set writing so they do not abandon themselves.
      if (writing.current) return;
      if (dirty.current) dirty.current = false;
      setDraft(state);
    }
    return profile ? useMortgageComparisonProfile.subscribe((state, previous) => {
      if (state.profile.inputs !== previous.profile.inputs) onExternalChange(state.profile.inputs);
    }) : useMortgageComparison.subscribe(onExternalChange);
  }, [profile]);
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
      profile ? [...facetCatalogueOptions[group.key], ...STANDARD_FACETS[group.key]] : facetCatalogueOptions[group.key],
      filters[group.key],
      group.canonicalize,
    ).filter(option => filters.includeNonStandard || isWidelyAvailableMortgageFacet(group.key, option)),
  })), [rowOptions, facetCatalogueOptions, filters, profile]);
  const change = (field: NumericInputField, text: string) => {
    dirty.current = true;
    setDraft(current => ({ ...withResolvedMode(current), [field]: text }));
  };
  const clearInputs = () => {
    if (dirty.current) commitDraft(draftRef.current);
    dirty.current = false;
    // Reset comparison scope durably; financial inputs remain entered once.
    clearSavedMortgageComparison({ preserveFacets: true });
    setDraft({ ...useMortgageComparison.getState(), lvr: '' });
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
      : { ...withResolvedMode(current), lvrMode: nextMode };
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
  // Rates keeps each unreplaced default (purpose, repayment, LVR 80%) in force.
  const assumed = profile ? null : effectiveMortgageBrowseAssumptions('Mortgage', withResolvedMode(draft), filters);
  const shownFacets = (key: FacetKey): readonly string[] => profile || filters[key].length ? filters[key] : DEFAULT_MORTGAGE_BROWSE_FACETS[key];
  const fieldLabel = (field: NumericInputField) =>
    uiLabel(field === 'loanAmount' ? 'Loan amount' : field === 'propertyValue' ? 'Property value'
      : field === 'fundsAvailable' ? fundsType === 'offset' ? 'Offset balance' : 'Deposit' : 'LVR');
  const hasCustomInputs = Boolean(
    draft.loanAmount.trim()
    || draft.lvr.trim()
    || (draft.fundsAvailable ?? '').trim()
    || (draft.propertyValue ?? '').trim(),
  );
  const hasCustomFacets = filters.loanPurposes.length > 0 || filters.repaymentTypes.length > 0;
  const hasAnyCustom = hasCustomInputs || hasCustomFacets;
  const [localOpen, setLocalOpen] = useState(false);
  const openedForEdit = open ?? localOpen;
  const setOpenedForEdit = (next: boolean) => { setLocalOpen(next); onOpenChange?.(next); };
  const isExpanded = !collapsible || openedForEdit;
  const facetText = (key: FacetKey) => uiJoin(...shownFacets(key).flatMap((option, index) =>
    index ? [uiLabel(' / '), humanizeEnum(option)] : [humanizeEnum(option)]));
  const lvrText = values.lvr !== null ? uiJoin('LVR', ' ', uiRate(values.lvr / 100, 0))
    : uiJoin('LVR', ' ', '≤', uiCount(80), '%');
  const scenarioLabel = profile && hasAnyCustom
    ? uiJoin('Mortgage comparison', values.lvr === null ? null : uiJoin(' · ', 'LVR', ' ', uiRate(values.lvr / 100, 0)))
    : uiJoin(facetText('loanPurposes'), ' · ', facetText('repaymentTypes'), ' · ', lvrText);
  const scopeStatus = (profile || pending ? values.invalid : invalid)
    ? <AppText color="danger">{uiLabel('Invalid comparison inputs')}</AppText>
    : unverified > 0 ? <AppText variant="small">{uiJoin('Eligibility unverified', ' · ', uiCount(unverified))}</AppText> : null;
  if (!isExpanded) {
    const chips = [
      facetText('loanPurposes'),
      facetText('repaymentTypes'),
      lvrText,
      ...(values.amount !== null && values.amount > 0 && !values.invalid
        ? [uiMoney(values.amount, Number.isInteger(values.amount) ? 0 : 2), uiJoin(uiCount(LIST_REPAYMENT_TERM_YEARS), ' ', 'years')] : []),
    ];
    return (
      <View testID="mortgage-scenario-summary">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: 6, alignItems: 'center', paddingVertical: 2 }}>
          <Button title="Edit" icon="options" variant="ghost" accessibilityLabel="Edit" onPress={() => setOpenedForEdit(true)} />
          {chips.map((label, index) => <Chip key={index} label={label} onPress={() => setOpenedForEdit(true)} />)}
        </ScrollView>
        {scopeStatus}
      </View>
    );
  }
  return <View style={{ gap: 8 }} testID="mortgage-comparison-controls">
    <SharedInputConflicts />
    {collapsible ? (
      <Row gap={8} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <AppText variant="small" color="textMuted" style={{ flex: 1 }}>
          {scenarioLabel}
        </AppText>
        <Button title="Hide" variant="ghost" accessibilityLabel="Hide" onPress={() => setOpenedForEdit(false)} />
      </Row>
    ) : null}
    <SegmentedControl value={mode} options={[{ value: 'funds', label: uiLabel('Funds available') }, { value: 'lvr', label: uiLabel('LVR') }]}
      onChange={changeMode} />
    {mode === 'funds' ? <SegmentedControl value={fundsType} options={[{ value: 'deposit', label: uiLabel('Deposit') }, { value: 'offset', label: uiLabel('Offset account') }]}
      onChange={changeFundsType} /> : null}
    <Row gap={8} style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>{fields.map(field => {
      // Rates applies the default LVR until one is entered; the profile still requires it.
      const fieldRequired = profile && hasAnyCustom && values.lvr === null && !values.invalid && (
        field === 'lvr'
          ? !draft.lvr.trim()
          : mode === 'funds' && !uiMortgageComparisonInput(draft, field).trim()
      );
      if (field !== 'lvr') return <View key={field} style={{ flexBasis: Math.min(220, 120 * Math.max(1, fontScale)), flexGrow: 1, minWidth: 0 }}>
        <CurrencyInput label={fieldRequired ? uiJoin(fieldLabel(field), ' · ', 'Required') : fieldLabel(field)}
          accessibilityLabel={fieldLabel(field)}
          value={draft[field] ?? ''} onChangeText={text => change(field, text)} />
      </View>;
      return <View key={field} style={{ flexBasis: Math.min(220, 120 * Math.max(1, fontScale)), flexGrow: 1, minWidth: 0, gap: 4 }}>
        <AppText variant="small" color={fieldRequired ? 'warning' : 'text'} weight={fieldRequired ? '700' : undefined}>
          {fieldRequired ? uiJoin(fieldLabel(field), ' · ', 'Required') : fieldLabel(field)}
        </AppText>
        <View style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 4,
          borderColor: theme.colors.border, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8 }}>
          <TextInput value={uiMortgageComparisonInput(draft, field)} onChangeText={text => change(field, text)}
            keyboardType="decimal-pad" autoCapitalize="none" autoCorrect={false} maxLength={62}
            accessibilityLabel={fieldLabel(field)}
            placeholder={assumed && !draft.lvr.trim() ? uiJoin(uiCount(80), '%') : uiLabel('%')}
            style={{ flex: 1, minWidth: 0, minHeight: 48, color: theme.colors.text, padding: 0, fontSize: theme.font.body }} />
        </View>
      </View>;
    })}<IconAction icon="close" word="Clear" accessibilityLabel="Clear comparison inputs" onPress={clearInputs} /></Row>
    {mode === 'funds' ? <Row gap={12} style={{ flexWrap: 'wrap' }}>
      <AppText variant="small" testID="mortgage-calculated-lvr">{uiJoin('Calculated LVR', ' · ', values.lvr === null ? uiLabel('Unknown') : uiRate(values.lvr / 100, 0))}</AppText>
      {fundsType === 'deposit'
        ? <AppText variant="small" testID="mortgage-property-value">{uiJoin('Property value', ' · ', uiMoney(values.propertyValue, Number.isInteger(values.propertyValue) ? 0 : 2))}</AppText>
        : <AppText variant="small" testID="mortgage-loan-less-offset">{uiJoin('Loan less offset', ' · ', uiMoney(values.interestBearingBalance, Number.isInteger(values.interestBearingBalance) ? 0 : 2))}</AppText>}
    </Row> : null}
    {pending
      ? <AppText variant="tiny" color="textMuted">{uiLabel('Updating')}</AppText> : null}
    <Row gap={8} style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
    {groups.map(group => {
      const groupIncomplete = profile && hasAnyCustom && filters[group.key].length === 0;
      return <View key={group.key} style={{ gap: 4, flexBasis: Math.min(240, 170 * Math.max(1, fontScale)), flexGrow: 1, minWidth: 0 }}>
      <AppText variant="small" color={groupIncomplete ? 'warning' : 'text'} weight={groupIncomplete ? '700' : undefined}>
        {groupIncomplete ? uiJoin(group.label, ' · ', 'Required') : uiLabel(group.label)}
      </AppText>
      <Row gap={6} style={{ flexWrap: 'wrap' }}>{group.options.map(option => {
        const meaningOf = (value: string) => group.canonicalize(value) ?? value;
        const selected = shownFacets(group.key).some(item => meaningOf(item) === option);
        return <Chip key={option} label={humanizeEnum(option)} selected={selected}
          onPress={() => {
            if (dirty.current) commitDraft(draftRef.current);
            const scoped = profile ? filters : scopeMortgageFacets(useRatesSession.getState().sections.Mortgage.filters, filters.includeNonStandard);
            // A shown default is replaced, not appended to, by another choice.
            // The shown default behaves as a selected chip; clearing every choice restores it.
            const base = profile || scoped[group.key].length ? scoped[group.key] : DEFAULT_MORTGAGE_BROWSE_FACETS[group.key];
            saveMortgageComparisonFacets({
              loanPurposes: scoped.loanPurposes, repaymentTypes: scoped.repaymentTypes,
              [group.key]: selected ? base.filter(item => meaningOf(item) !== option) : [...base, option],
            });
          }} />;
      })}</Row>
    </View>;
    })}
    </Row>
    {!profile ? <SegmentedControl value={metric} options={[{ value: 'headline', label: uiLabel('Advertised rate') }, { value: 'comparison', label: uiLabel('Comparison rate') }]}
      onChange={next => useStore.getState().setPref('mortgageRateMetric', next)} /> : null}
    {scopeStatus}
    {storageStatus === 'unavailable' ? <Row gap={8}>
      <AppText variant="small" color="warning">{uiJoin('Saved inputs', ' · ', 'Unavailable')}</AppText>
      <Button title="Retry" onPress={() => void openMortgageComparisonProfile()} />
    </Row> : profile && (storageStatus === 'saving' || storageStatus === 'loading') ? <AppText variant="small" color="textMuted">
      {uiLabel(storageStatus === 'saving' ? 'Saving' : 'Loading')}
    </AppText> : null}
  </View>;
}
