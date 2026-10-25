import { canonicalPurpose, canonicalRepayment } from '../data/mortgageFacets';
import { publicCataloguePricingKey, type PublicCatalogueView } from '../data/publicRateIntegration';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TextInput, useWindowDimensions, View } from 'react-native';
import { useMortgageComparison, clearMortgageComparison } from '../data/mortgageComparison';
import { profileAttributeOptions } from '../data/profileRequirements';
import { humanizeEnum } from '../data/format';
import type { Filters } from '../data/selectors';
import type { RateRow } from '../types';
import { useStore } from '../data/store';
import { updateRatesSection } from '../data/ratesSession';
import { uiCount, uiJoin, uiLabel, uiMortgageComparisonInput } from '../lib/uiCopy';
import { yieldToUi } from '../lib/yieldToUi';
import { useTheme } from '../theme/ThemeProvider';
import { AppText, Button, Chip, Row } from './ui';
import { SegmentedControl } from './controls';

const TYPING_DEBOUNCE_MS = 200;

type FacetKey = 'loanPurposes' | 'repaymentTypes';

function rowFacetOptions(
  rows: RateRow[],
  filters: Filters,
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
  const commitDraft = (next: typeof storeValue) => {
    writing.current = true;
    useMortgageComparison.setState(next);
    dirty.current = false;
    writing.current = false;
  };
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
    if (draft.loanAmount === storeValue.loanAmount && draft.lvr === storeValue.lvr) {
      dirty.current = false;
      return;
    }
    const timer = setTimeout(() => commitDraft(draft), TYPING_DEBOUNCE_MS);
    // Dependency-change cleanup must only cancel the timer. Flushing here would
    // commit a stale draft and clear dirty before the next keystroke schedules.
    return () => clearTimeout(timer);
  }, [draft, storeValue.loanAmount, storeValue.lvr]);
  // Section switches unmount these controls; flush the latest draft so the
  // committed store keeps the last typed amount/LVR.
  useEffect(() => () => {
    if (!dirty.current) return;
    commitDraft(draftRef.current);
  }, []);
  const rowOptions = useMemo(() => rowFacetOptions(rows, filters), [rows, filters]);
  const catalogueKey = useMemo(() => catalogue ? publicCataloguePricingKey(catalogue) : '', [catalogue]);
  const catalogueRef = useRef(catalogue);
  catalogueRef.current = catalogue;
  // Snapshot object identity changes on every shard tick; key on content so
  // mortgage.scope.apply does not re-walk the full programme book each render.
  // Large books leave the header render and yield before the scan.
  const catalogueOptions = useMemo(() => {
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
      const options = catalogueFacetOptions(view);
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
    ),
  })), [rowOptions, facetCatalogueOptions, filters]);
  const change = (field: 'loanAmount' | 'lvr', text: string) => {
    dirty.current = true;
    setDraft(current => ({ ...current, [field]: text }));
  };
  return <View style={{ gap: 8 }} testID="mortgage-comparison-controls">
    <Row gap={8} style={{ flexWrap: 'wrap' }}>{(['loanAmount', 'lvr'] as const).map(field => <View key={field} style={{ flexBasis: Math.min(220, 120 * Math.max(1, fontScale)), flexGrow: 1, minWidth: 0, gap: 4 }}>
      <AppText variant="small">{uiLabel(field === 'loanAmount' ? 'Loan amount' : 'LVR')}</AppText>
      <TextInput value={uiMortgageComparisonInput(draft, field)} onChangeText={text => change(field, text)} keyboardType="decimal-pad"
        accessibilityLabel={uiLabel(field === 'loanAmount' ? 'Loan amount' : 'LVR')}
        placeholder={uiLabel(field === 'loanAmount' ? '$' : '%')}
        style={{ minHeight: 48, minWidth: 0, color: theme.colors.text, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 6, padding: 8, fontSize: theme.font.body }} />
    </View>)}</Row>
    {groups.map(group => <View key={group.key} style={{ gap: 4 }}>
      <AppText variant="small">{uiLabel(group.label)}</AppText>
      <Row gap={6} style={{ flexWrap: 'wrap' }}>{group.options.map(option => {
        const meaningOf = (value: string) => group.canonicalize(value) ?? value;
        const selected = filters[group.key].some(item => meaningOf(item) === option);
        return <Chip key={option} label={humanizeEnum(option)} selected={selected}
          onPress={() => updateRatesSection('Mortgage', current => ({ filters: { ...current.filters,
            [group.key]: selected
              ? current.filters[group.key].filter(item => meaningOf(item) !== option)
              : [...current.filters[group.key], option] } }), true)} />;
      })}</Row>
    </View>)}
    <SegmentedControl value={metric} options={[{ value: 'headline', label: uiLabel('Advertised rate') }, { value: 'comparison', label: uiLabel('Comparison rate') }]}
      onChange={next => useStore.getState().setPref('mortgageRateMetric', next)} />
    {invalid ? <AppText color="danger">{uiLabel('Invalid comparison inputs')}</AppText> : unverified > 0 ? <AppText variant="small">{uiJoin('Eligibility unverified', ' · ', uiCount(unverified))}</AppText> : null}
    <Button title="Clear comparison inputs" variant="ghost" onPress={() => {
      dirty.current = false;
      setDraft({ loanAmount: '', lvr: '' });
      clearMortgageComparison();
      updateRatesSection('Mortgage', { page: 1 }, true);
    }} />
  </View>;
}
