import { canonicalPurpose, canonicalRepayment } from '../data/mortgageFacets';
import type { PublicCatalogueView } from '../data/publicRateIntegration';
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
import { useTheme } from '../theme/ThemeProvider';
import { AppText, Button, Chip, Row } from './ui';
import { SegmentedControl } from './controls';

const TYPING_DEBOUNCE_MS = 200;

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
  const groups = useMemo(() => [
    { key: 'loanPurposes' as const, field: 'loan_purpose' as const, condition: 'purpose', canonical: canonicalPurpose },
    { key: 'repaymentTypes' as const, field: 'ribbon_repayment_type' as const, condition: 'repayment', canonical: canonicalRepayment },
  ].map(group => {
    // Discover options before scenario resolution, including loaded offers whose conditions are not yet met.
    const meanings = new Set<string | undefined>();
    const options = profileAttributeOptions(rows, group.field, filters[group.key]).filter(option => {
      const meaning = group.canonical(option), duplicate = meanings.has(meaning);
      meanings.add(meaning);
      return filters[group.key].includes(option) || !duplicate;
    });
    for (const product of catalogue?.products ?? []) {
      if (product.section !== 'Mortgage' || product.status === 'legacy') continue;
      for (const programme of catalogue!.getProgrammes(product.productId)) {
        if (programme.section !== 'Mortgage') continue;
        for (const condition of programme.conditions) {
          if (condition.field !== group.condition) continue;
          const values = condition.operator === 'eq' ? [condition.value] : condition.operator === 'in' ? condition.values ?? [] : [];
          for (const value of values) {
            if (typeof value !== 'string' || !value.trim()) continue;
            const option = group.canonical(value)!;
            if (!meanings.has(option)) { options.push(option); meanings.add(option); }
          }
        }
      }
    }
    return { ...group, options };
  }), [catalogue, filters, rows]);
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
      <AppText variant="small">{uiLabel(group.key === 'loanPurposes' ? 'Loan purpose' : 'Repayment')}</AppText>
      <Row gap={6} style={{ flexWrap: 'wrap' }}>{group.options.map(option => <Chip key={option} label={humanizeEnum(option)} selected={filters[group.key].includes(option)}
        onPress={() => updateRatesSection('Mortgage', current => ({ filters: { ...current.filters,
          [group.key]: current.filters[group.key].includes(option) ? current.filters[group.key].filter(item => item !== option) : [...current.filters[group.key], option] } }), true)} />)}</Row>
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
