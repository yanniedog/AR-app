import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import type { Filters } from '../data/selectors';
import type { SearchFilterOptions } from '../data/searchFilterOptions';
import { humanizeEnum } from '../data/format';
import { uiLoanPurpose } from '../lib/financialUiCopy';
import { lvrTierDisplay } from '../data/lvrTier';
import {
  boundedPublishedFactFilterOptions,
  factCriterionId,
} from '../data/productFacts';
import { matchingLenders, visibleFilterOptions } from '../lib/filterOptions';
import { SearchBar } from './controls';
import { SheetSurface } from './SheetSurface';
import { AppText, Button, Chip, Disclosure, Divider, Row } from './ui';
import { uiCount, uiJoin, uiLabel, uiProviderName, useProviderSearchInput, type UiCopy, type UiChild } from '../lib/uiCopy';

function filterGroupTitle(field: string): UiCopy {
  switch (field) {
    case 'loan_purpose': return uiLabel('Loan purpose');
    case 'rate_type': return uiLabel('Rate type');
    case 'ribbon_repayment_type': return uiLabel('Repayment');
    case 'lvr_tier': return uiJoin('LVR', ' · ', 'Tier');
    case 'interest_payment': return uiLabel('Interest paid');
    case 'ribbon_deposit_kind': return uiLabel('Account type');
    default: return uiLabel('Filter');
  }
}

// Plain RN Modal sheet: @gorhom/bottom-sheet modals silently failed to present
// under Reanimated 4, leaving the filter button dead.
export function FilterSheet({
  visible,
  onClose,
  options,
  optionsPending = false,
  optionsError,
  onRetryOptions,
  filters,
  onApply,
  resultCount,
  resultNoun = 'products',
  children,
  controlledDraft,
  onDraftChange,
}: {
  children?: UiChild;
  controlledDraft?: Filters;
  onDraftChange?: React.Dispatch<React.SetStateAction<Filters>>;
  visible: boolean;
  onClose: () => void;
  options: SearchFilterOptions;
  optionsPending?: boolean;
  optionsError?: string | null;
  onRetryOptions?: () => void;
  filters: Filters;
  onApply: (f: Filters) => void;
  /** Products the list would show for a draft; labels the apply action. */
  resultCount?: (draft: Filters) => number;
  resultNoun?: 'rates' | 'products';
}) {
  const [internalDraft, setInternalDraft] = useState<Filters>(filters);
  const draft = controlledDraft ?? internalDraft;
  const setDraft = controlledDraft && onDraftChange ? onDraftChange : setInternalDraft;
  const [publishedOpen, setPublishedOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<ReadonlySet<string>>(() => new Set());
  const { value: lenderQuery, onChangeText: setLenderQuery } = useProviderSearchInput();

  useEffect(() => {
    if (visible) {
      setDraft(filters);
      setPublishedOpen(false);
      setExpandedGroups(new Set());
      setLenderQuery('');
    }
  }, [visible, filters, setDraft, setLenderQuery]);

  const { groups: groupOptions, providers, accountFeatures, eligibilityCriteria } = options;
  const publishedDetails = useMemo(
    () => boundedPublishedFactFilterOptions(
      options.publishedDetails,
      draft.factCriteria,
      32,
    ),
    [options.publishedDetails, draft.factCriteria],
  );

  // Counting re-runs the list filter, so let chip presses paint first.
  const deferredDraft = useDeferredValue(draft);
  const draftCount = useMemo(
    () => (visible && resultCount ? resultCount(deferredDraft) : null),
    [visible, resultCount, deferredDraft],
  );
  const applyTitle = draftCount === null
    ? uiLabel('Apply')
    : uiJoin('Show', ' ', uiCount(draftCount), ' ', resultNoun === 'rates' ? draftCount === 1 ? 'Rate' : 'rates' : draftCount === 1 ? 'Product' : 'products');

  const toggle = (key: keyof Filters, value: string) => {
    setDraft((d) => {
      const list = (d[key] as string[]) ?? [];
      const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
      return { ...d, [key]: next };
    });
  };

  const toggleFactCriterion = (id: string) => {
    const option = publishedDetails.find((item) => item.id === id);
    if (!option) return;
    setDraft((current) => {
      const selected = current.factCriteria.some((criterion) => factCriterionId(criterion) === id);
      return {
        ...current,
        factCriteria: selected
          ? current.factCriteria.filter((criterion) => factCriterionId(criterion) !== id)
          : [...current.factCriteria, option.criterion],
      };
    });
  };

  // Long groups collapse behind "Show all" instead of silently dropping options.
  const optionChips = ({
    groupKey,
    options,
    selected,
    label,
    onToggle,
    noun = 'Options',
    showAll = false,
  }: {
    groupKey: string;
    options: readonly string[];
    selected: readonly string[];
    label: (option: string) => UiCopy;
    onToggle: (option: string) => void;
    noun?: UiCopy;
    showAll?: boolean;
  }) => {
    const { visible: shown, hidden } = visibleFilterOptions(
      options,
      selected,
      showAll || expandedGroups.has(groupKey),
    );
    return (
      <>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {shown.map((option) => (
            <Chip
              key={option}
              label={label(option)}
              selected={selected.includes(option)}
              onPress={() => onToggle(option)}
            />
          ))}
        </Row>
        {hidden > 0 ? (
          <Button
            title={uiJoin('Show', ' ', 'All', ' ', uiCount(options.length), ' ', noun)}
            variant="ghost"
            style={{ alignSelf: 'flex-start', paddingHorizontal: 0, marginTop: 4 }}
            onPress={() => setExpandedGroups((prev) => new Set(prev).add(groupKey))}
          />
        ) : null}
      </>
    );
  };
  const lenderMatches = matchingLenders(providers, lenderQuery, draft.providers);

  return (
    <SheetSurface
      visible={visible}
      title="Filters"
      onClose={onClose}
      footer={(
        <>
          <Divider />
          <Row gap={12} style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <Button title="Reset" variant="ghost" style={{ flex: 1 }} onPress={() => setDraft({ ...filters, ...resetFilters() })} />
            <Button title={applyTitle} style={{ flex: 2 }} onPress={() => { onApply(draft); onClose(); }} />
          </Row>
        </>
      )}
    >
          <Divider />
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ padding: 16, gap: 24, paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
            {optionsPending ? <AppText variant="small" color="textMuted">{uiJoin('Filter', ' · ', 'Loading')}</AppText> : null}
            {optionsError ? <View style={{ gap: 8 }}>
              <AppText variant="small" color="textMuted">{uiJoin('Filter', ' · ', 'Unavailable')}</AppText>
              <Button title="Retry" variant="secondary" onPress={onRetryOptions} />
            </View> : null}
            {children}
            {groupOptions.map(({ g, options }) => {
              return (
                <View key={g.key}>
                  <AppText variant="small" weight="700" style={{ marginBottom: 10 }}>
                    {filterGroupTitle(g.field)}
                  </AppText>
                  {optionChips({
                    groupKey: g.key,
                    options,
                    selected: draft[g.key] as string[],
                    label: (o) => (g.field === 'lvr_tier' ? lvrTierDisplay(o) : g.field === 'loan_purpose' ? uiLoanPurpose({ loan_purpose: o }) : humanizeEnum(o)),
                    onToggle: (o) => toggle(g.key, o),
                  })}
                </View>
              );
            })}

            {accountFeatures.length ? (
              <View>
                <AppText variant="small" weight="700" style={{ marginBottom: 10 }}>
                  {uiLabel('Account features')}
                </AppText>
                {optionChips({
                  groupKey: 'accountFeatures',
                  options: accountFeatures,
                  selected: draft.accountFeatures,
                  label: humanizeEnum,
                  onToggle: (f) => toggle('accountFeatures', f),
                  noun: 'Features',
                })}
              </View>
            ) : null}

            {eligibilityCriteria.length ? (
              <View>
                <AppText variant="small" weight="700" style={{ marginBottom: 10 }}>
                  {uiLabel('Eligibility')}
                </AppText>
                {optionChips({
                  groupKey: 'eligibilityCriteria',
                  options: eligibilityCriteria,
                  selected: draft.eligibilityCriteria,
                  label: humanizeEnum,
                  onToggle: (c) => toggle('eligibilityCriteria', c),
                  noun: 'Criteria',
                })}
              </View>
            ) : null}

            {publishedDetails.length ? (
              <Disclosure
                title="Published details"
                open={publishedOpen}
                onToggle={() => setPublishedOpen((open) => !open)}
              >
                {!!draft.factCriteria.length && <AppText variant="small">{uiJoin('Selected', ' · ', uiCount(draft.factCriteria.length))}</AppText>}
                <Row gap={8} style={{ flexWrap: 'wrap' }}>
                  {publishedDetails.map((option) => (
                    <Chip
                      key={option.id}
                      label={option.label}
                      selected={draft.factCriteria.some(
                        (criterion) => factCriterionId(criterion) === option.id,
                      )}
                      onPress={() => toggleFactCriterion(option.id)}
                    />
                  ))}
                </Row>
              </Disclosure>
            ) : null}

            <View>
              <AppText variant="small" weight="700" style={{ marginBottom: 10 }}>
                {uiLabel('Lenders')}
              </AppText>
              {providers.length > 12 || lenderQuery.trim() !== '' ? (
                <View style={{ marginBottom: 10 }}>
                  <SearchBar value={lenderQuery} onChangeText={setLenderQuery} placeholder="Search lenders" />
                </View>
              ) : null}
              {lenderMatches.length ? (
                // A search shows every match; otherwise the list collapses like the other groups.
                optionChips({
                  groupKey: 'providers',
                  options: lenderMatches,
                  selected: draft.providers,
                  label: (provider) => uiProviderName({ provider }),
                  onToggle: (p) => toggle('providers', p),
                  noun: 'Lenders',
                  showAll: lenderQuery.trim() !== '',
                })
              ) : lenderQuery.trim() ? (
                <AppText variant="small" color="textMuted">{uiJoin('Lenders', ' · ', 'No results')}</AppText>
              ) : null}
            </View>
          </ScrollView>
    </SheetSurface>
  );
}

function resetFilters() {
  return {
    providers: [],
    rateTypes: [],
    lvrTiers: [],
    repaymentTypes: [],
    loanPurposes: [],
    depositKinds: [],
    interestPayments: [],
    accountFeatures: [],
    eligibilityCriteria: [],
    factCriteria: [],
  };
}
