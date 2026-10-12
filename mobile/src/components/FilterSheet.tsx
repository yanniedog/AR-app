import Ionicons from './icons/AppIcon';
import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { distinctProviders, distinctValues, type Filters } from '../data/selectors';
import { distinctEligibilityCriteria } from '../data/eligibility';
import { distinctAccountFeatures } from '../data/features';
import { humanizeEnum } from '../data/format';
import { compareLvrTiers, lvrTierDisplay } from '../data/lvrTier';
import {
  boundedPublishedFactFilterOptions,
  factCriterionId,
  publishedFactFilterOptions,
} from '../data/productFacts';
import type { ProductDetail, RateRow, SectionKey } from '../types';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { matchingLenders, visibleFilterOptions } from '../lib/filterOptions';
import { useTheme } from '../theme/ThemeProvider';
import { SearchBar } from './controls';
import { TouchTarget } from './TouchTarget';
import { AppText, Button, Chip, Disclosure, Divider, Row } from './ui';

interface Group {
  title: string;
  field: keyof RateRow;
  key: keyof Filters;
}

function groupsFor(section: SectionKey): Group[] {
  if (section === 'Mortgage') {
    return [
      { title: 'Purpose', field: 'loan_purpose', key: 'loanPurposes' },
      { title: 'Rate type', field: 'rate_type', key: 'rateTypes' },
      { title: 'Repayment', field: 'ribbon_repayment_type', key: 'repaymentTypes' },
      { title: 'LVR tier', field: 'lvr_tier', key: 'lvrTiers' },
    ];
  }
  if (section === 'TD') {
    return [{ title: 'Interest paid', field: 'interest_payment', key: 'interestPayments' }];
  }
  return [{ title: 'Account type', field: 'ribbon_deposit_kind', key: 'depositKinds' }];
}

// Plain RN Modal sheet: @gorhom/bottom-sheet modals silently failed to present
// under Reanimated 4, leaving the filter button dead.
export function FilterSheet({
  visible,
  onClose,
  rows,
  section,
  filters,
  onApply,
  detailsProducts,
  resultCount,
}: {
  visible: boolean;
  onClose: () => void;
  rows: RateRow[];
  section: SectionKey;
  filters: Filters;
  onApply: (f: Filters) => void;
  detailsProducts?: Record<string, ProductDetail> | null;
  /** Products the list would show for a draft; labels the apply action. */
  resultCount?: (draft: Filters) => number;
}) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
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

  const groups = groupsFor(section);
  // Facet option lists depend only on the (scoped) rows, never on the draft
  // selection — memoize them so toggling a chip doesn't re-scan every row for
  // every filter group (the open-sheet lag).
  const groupOptions = useMemo(
    () =>
      groups
        .map((g) => {
          const values = distinctValues(rows, g.field);
          // Bands read in order (≤60%, 60–70%, …), not by row frequency.
          if (g.field === 'lvr_tier') values.sort(compareLvrTiers);
          return { g, options: values };
        })
        .filter(({ options }) => options.length > 0),
    [rows, section], // eslint-disable-line react-hooks/exhaustive-deps -- groups is derived from section
  );
  const providers = useMemo(() => distinctProviders(rows), [rows]);
  const accountFeatures = useMemo(
    () => distinctAccountFeatures(rows, detailsProducts, section),
    [rows, detailsProducts, section],
  );
  const eligibilityCriteria = useMemo(
    () => distinctEligibilityCriteria(rows, detailsProducts),
    [rows, detailsProducts],
  );
  const availablePublishedDetails = useMemo(
    () => publishedFactFilterOptions(rows, detailsProducts, section),
    [rows, detailsProducts, section],
  );
  const publishedDetails = useMemo(
    () => boundedPublishedFactFilterOptions(
      availablePublishedDetails,
      draft.factCriteria,
      32,
    ),
    [availablePublishedDetails, draft.factCriteria],
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
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion === false ? 'slide' : 'none'}
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          onPress={onClose}
          accessibilityLabel="Dismiss filters"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)' }}
        />
        <View
          style={{
            maxHeight: '85%',
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            paddingTop: 8,
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: theme.colors.textFaint,
              marginBottom: 8,
            }}
          />
          <Row style={{ justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 }}>
            <AppText variant="h3">Filters</AppText>
            <TouchTarget square onPress={onClose} accessibilityRole="button" accessibilityLabel="Close filters" style={{ marginRight: -12 }}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchTarget>
          </Row>
          <Divider />
          <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
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
                  : 'Age, limits and account features'}
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
                <AppText variant="small" color="textMuted">No lenders match “{lenderQuery.trim()}”.</AppText>
              ) : null}
            </View>
          </ScrollView>
          <Divider />
          <Row gap={12} style={{ padding: 16, paddingBottom: Math.max(insets.bottom, 12) + 12 }}>
            <Button
              title="Reset"
              variant="ghost"
              style={{ flex: 1 }}
              onPress={() => setDraft({ ...filters, ...resetFilters() })}
            />
            <Button
              title={applyTitle}
              style={{ flex: 2 }}
              onPress={() => {
                onApply(draft);
                onClose();
              }}
            />
          </Row>
        </View>
      </View>
    </Modal>
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
