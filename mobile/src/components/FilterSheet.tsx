import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import type { Filters } from '../data/selectors';
import type { SearchFilterOptions } from '../data/searchFilterOptions';
import { humanizeEnum } from '../data/format';
import { lvrTierDisplay } from '../data/lvrTier';
import {
  boundedPublishedFactFilterOptions,
  factCriterionId,
} from '../data/productFacts';
import { matchingLenders, visibleFilterOptions } from '../lib/filterOptions';
import { SearchBar } from './controls';
import { SheetSurface } from './SheetSurface';
import { AppText, Button, Chip, Disclosure, Divider, Row } from './ui';

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
}: {
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
}) {
  const [draft, setDraft] = useState<Filters>(filters);
  const [publishedOpen, setPublishedOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<ReadonlySet<string>>(() => new Set());
  const [lenderQuery, setLenderQuery] = useState('');

  useEffect(() => {
    if (visible) {
      setDraft(filters);
      setPublishedOpen(false);
      setExpandedGroups(new Set());
      setLenderQuery('');
    }
  }, [visible, filters]);

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
    ? 'Apply'
    : `Show ${draftCount} ${draftCount === 1 ? 'product' : 'products'}`;

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
    noun = 'options',
    showAll = false,
  }: {
    groupKey: string;
    options: readonly string[];
    selected: readonly string[];
    label: (option: string) => string;
    onToggle: (option: string) => void;
    noun?: string;
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
            title={`Show all ${options.length} ${noun}`}
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
            {optionsPending ? <AppText variant="small" color="textMuted">Loading filters</AppText> : null}
            {optionsError ? <View style={{ gap: 8 }}>
              <AppText variant="small" color="textMuted">Filters unavailable</AppText>
              <Button title="Retry filters" variant="secondary" onPress={onRetryOptions} />
            </View> : null}
            {groupOptions.map(({ g, options }) => {
              return (
                <View key={g.key}>
                  <AppText variant="small" weight="700" style={{ marginBottom: 10 }}>
                    {g.title}
                  </AppText>
                  {optionChips({
                    groupKey: g.key,
                    options,
                    selected: draft[g.key] as string[],
                    label: (o) => (g.field === 'lvr_tier' ? lvrTierDisplay(o) : humanizeEnum(o)),
                    onToggle: (o) => toggle(g.key, o),
                  })}
                </View>
              );
            })}

            {accountFeatures.length ? (
              <View>
                <AppText variant="small" weight="700" style={{ marginBottom: 10 }}>
                  Account features
                </AppText>
                {optionChips({
                  groupKey: 'accountFeatures',
                  options: accountFeatures,
                  selected: draft.accountFeatures,
                  label: humanizeEnum,
                  onToggle: (f) => toggle('accountFeatures', f),
                  noun: 'features',
                })}
              </View>
            ) : null}

            {eligibilityCriteria.length ? (
              <View>
                <AppText variant="small" weight="700" style={{ marginBottom: 10 }}>
                  Eligibility
                </AppText>
                {optionChips({
                  groupKey: 'eligibilityCriteria',
                  options: eligibilityCriteria,
                  selected: draft.eligibilityCriteria,
                  label: humanizeEnum,
                  onToggle: (c) => toggle('eligibilityCriteria', c),
                  noun: 'criteria',
                })}
              </View>
            ) : null}

            {publishedDetails.length ? (
              <Disclosure
                title="Published details"
                summary={draft.factCriteria.length
                  ? `${draft.factCriteria.length} selected`
                  : undefined}
                open={publishedOpen}
                onToggle={() => setPublishedOpen((open) => !open)}
              >
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
                Lenders
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
                  label: (p) => p,
                  onToggle: (p) => toggle('providers', p),
                  noun: 'lenders',
                  showAll: lenderQuery.trim() !== '',
                })
              ) : lenderQuery.trim() ? (
                <AppText variant="small" color="textMuted">No lenders</AppText>
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
