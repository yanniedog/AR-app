import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { DetailLoadingLines } from '../feedback';
import { TOUCH_TARGET_MIN, TouchTarget } from '../TouchTarget';
import { AppText, Badge, Card, Disclosure, Divider, Row } from '../ui';
import {
  formatBalanceRange,
  formatRate,
  formatTerm,
  humanizeEnum,
} from '../../data/format';
import { accessExcludesFromStandard, assessAccess } from '../../data/access';
import { ratePresentation } from '../../data/ratePresentation';
import { feeCapLabel, feeDiscountLabel, formatFeeValue } from '../../data/feePresentation';
import {
  productFactDisplayModel,
  productFactLabel,
  productFactSignature,
  productFactValue,
} from '../../data/productFacts';
import { useStore } from '../../data/store';
import { rateQualifier } from '../../lib/rateQualifier';
import type { DetailItem, ProductDetail as ProductDetailData, RateRow, SectionKey } from '../../types';
import { useTheme } from '../../theme/ThemeProvider';
import { openProduct } from '../../lib/nav';

export function RateRowLine({ row, section, accent }: { row: RateRow; section: SectionKey; accent: string }) {
  const theme = useTheme();
  const mortgageRateMetric = useStore((state) => state.prefs.mortgageRateMetric);
  const presentation = ratePresentation(row, section, mortgageRateMetric);
  const q = rateQualifier(row, section);
  const bits: string[] = [];
  const rt = row.rate_type?.toUpperCase();
  const rtRedundant = q.conditional && (rt === 'BONUS' || rt === 'INTRODUCTORY' || rt === 'INTRO');
  if (row.rate_type && !rtRedundant) bits.push(humanizeEnum(row.rate_type));
  const term = formatTerm(row);
  if (term && q.kind !== 'intro') bits.push(term);
  if (section === 'Mortgage') {
    if (row.ribbon_repayment_type ?? row.repayment_type)
      bits.push(humanizeEnum(row.ribbon_repayment_type ?? row.repayment_type));
    if (row.lvr_tier) bits.push(humanizeEnum(row.lvr_tier));
  } else {
    const bal = formatBalanceRange(row.balance_min, row.balance_max);
    if (bal) bits.push(bal);
  }
  const descriptor = bits.join(' · ');
  return (
    <Row style={{ justifyContent: 'space-between', gap: 12 }}>
      <Row style={{ flex: 1, alignItems: 'center', gap: 6 }}>
        {q.conditional ? (
          <View
            style={{
              flexShrink: 0,
              paddingHorizontal: 6,
              paddingVertical: 1,
              borderRadius: theme.radius.sm,
              borderWidth: 1,
              borderColor: theme.colors.warning,
            }}
          >
            <AppText variant="tiny" weight="700" numberOfLines={1} style={{ color: theme.colors.warning }}>
              {q.shortLabel}
            </AppText>
          </View>
        ) : null}
        {descriptor ? (
          <AppText variant="small" color="textMuted" style={{ flex: 1, flexShrink: 1 }}>
            {descriptor}
          </AppText>
        ) : null}
      </Row>
      <Row gap={8}>
        <View style={{ alignItems: 'flex-end' }}>
          <AppText variant="tiny" color="textFaint">
            {presentation.primaryLabel}
          </AppText>
          <AppText variant="body" weight="800" style={{ color: accent }}>
            {formatRate(presentation.primary)}
          </AppText>
        </View>
        {presentation.secondary !== null && presentation.secondaryLabel ? (
          <AppText variant="tiny" color="textFaint">
            {formatRate(presentation.secondary)} {presentation.secondaryLabel.toLowerCase()}
          </AppText>
        ) : null}
      </Row>
    </Row>
  );
}

export function DetailGroup({
  title,
  items,
  loading,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  items?: DetailItem[];
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  if ((!items || items.length === 0) && !loading) return null;
  const displayValue = (item: DetailItem): string | null => {
    if (title === 'Fees') return formatFeeValue(item);
    if (item.value === undefined || item.value === null || String(item.value).trim() === '') return null;
    const raw = String(item.value).trim();
    const label = String(item.label ?? '').toUpperCase();
    if (title === 'Eligibility' && (label === 'MIN_AGE' || label === 'MAX_AGE') && /^\d+$/.test(raw)) {
      return `${raw} years`;
    }
    if (title === 'Constraints' && /(?:MIN|MAX)_(?:LIMIT|BALANCE|AMOUNT)/.test(label) && /^\d+(?:\.\d+)?$/.test(raw)) {
      return `$${Number(raw).toLocaleString('en-AU', { maximumFractionDigits: 2 })}`;
    }
    return raw;
  };
  return (
    <Disclosure
      title={title}
      summary={loading && !items ? 'Loading published details' : `${items?.length ?? 0} published item${items?.length === 1 ? '' : 's'}`}
      open={open}
      onToggle={() => setOpen((value) => !value)}
    >
      <View>
        {loading && !items ? (
          <DetailLoadingLines />
        ) : (
          (items ?? []).map((it, i) => (
            <View key={i}>
              {i > 0 ? <Divider style={{ marginVertical: 10 }} /> : null}
              <Row style={{ justifyContent: 'space-between', gap: 12 }}>
                <AppText variant="small" weight="600" style={{ flex: 1 }}>
                  {it.name || humanizeEnum(it.label)}
                </AppText>
                {displayValue(it) ? (
                  <AppText variant="small" color="textMuted">
                    {displayValue(it)}
                  </AppText>
                ) : null}
              </Row>
              {it.info ? (
                <AppText variant="tiny" color="textFaint" style={{ marginTop: 2, lineHeight: 16 }}>
                  {it.info}
                </AppText>
              ) : null}
              {title === 'Fees' && feeCapLabel(it) ? (
                <AppText variant="tiny" color="textMuted" style={{ marginTop: 3 }}>
                  {feeCapLabel(it)}
                </AppText>
              ) : null}
              {title === 'Fees' ? (it.discounts ?? []).map((discount, discountIndex) => {
                const label = feeDiscountLabel(discount);
                return label ? (
                  <AppText key={discountIndex} variant="tiny" color="textMuted" style={{ marginTop: 3 }}>
                    Discount · {label}
                  </AppText>
                ) : null;
              }) : null}
            </View>
          ))
        )}
      </View>
    </Disclosure>
  );
}

function ProductFactRows({ facts }: { facts: ProductDetailData['facts'] }) {
  return (
    <View>
      {(facts ?? []).map((fact, index) => {
        const value = productFactValue(fact);
        const appliesTo = fact.appliesTo?.filter(Boolean).map(humanizeEnum).join(', ');
        return (
          <View key={productFactSignature(fact)}>
            {index > 0 ? <Divider style={{ marginVertical: 10 }} /> : null}
            <Row style={{ justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
              <AppText variant="small" weight="600" style={{ flex: 1 }}>
                {productFactLabel(fact)}
              </AppText>
              {value ? (
                <AppText variant="small" color="textMuted" style={{ flexShrink: 1, textAlign: 'right' }}>
                  {value}
                </AppText>
              ) : null}
            </Row>
            {appliesTo ? (
              <AppText variant="tiny" color="textMuted" style={{ marginTop: 3 }}>
                Applies to {appliesTo}
              </AppText>
            ) : null}
            {fact.condition?.trim() ? (
              <AppText variant="tiny" color="textFaint" style={{ marginTop: 3, lineHeight: 16 }}>
                {fact.condition.trim()}
              </AppText>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function ProductFactClusterDisclosure({
  cluster,
}: {
  cluster: ReturnType<typeof productFactDisplayModel>['rateClusters'][number];
}) {
  const [open, setOpen] = useState(false);
  return (
    <Disclosure
      title={cluster.label}
      summary={cluster.summary}
      open={open}
      onToggle={() => setOpen((value) => !value)}
    >
      <ProductFactRows facts={cluster.facts} />
    </Disclosure>
  );
}

function ProductFactDisclosure({
  group,
  clusters = [],
}: {
  group: ReturnType<typeof productFactDisplayModel>['groups'][number];
  clusters?: ReturnType<typeof productFactDisplayModel>['rateClusters'];
}) {
  const [open, setOpen] = useState(false);
  const count = group.facts.length + clusters.length;
  return (
    <Disclosure
      title={group.title}
      summary={`${count} published detail${count === 1 ? '' : 's'}`}
      open={open}
      onToggle={() => setOpen((value) => !value)}
    >
      <View style={{ gap: 10 }}>
        {group.facts.length ? <ProductFactRows facts={group.facts} /> : null}
        {clusters.map((cluster) => (
          <ProductFactClusterDisclosure key={cluster.id} cluster={cluster} />
        ))}
      </View>
    </Disclosure>
  );
}

/** Structured producer facts, with legacy rich fee rows taking precedence. */
export function ProductFacts({ detail }: { detail: ProductDetailData | null }) {
  const model = productFactDisplayModel(detail, { excludeFees: Boolean(detail?.fees?.length) });
  if (!model.groups.length) return null;
  return <>{model.groups.map((group) => (
    <ProductFactDisclosure
      key={group.key}
      group={group}
      clusters={group.key === 'product' ? model.rateClusters : undefined}
    />
  ))}</>;
}

export function AccessNotice({
  name,
  detail,
  loading,
  provider,
}: {
  name: string;
  detail: ProductDetailData | null;
  loading: boolean;
  provider?: string | null;
}) {
  const theme = useTheme();
  if (loading && !detail) return null;
  const a = assessAccess(name, detail, provider);
  if (!a.restricted && !a.verify) return null;
  const tone = theme.colors.warning;
  return (
    <Card style={{ marginBottom: 16, borderLeftWidth: 3, borderLeftColor: tone }}>
      <Row gap={8} style={{ alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
        <Ionicons name={a.verify ? 'alert-circle-outline' : 'people-outline'} size={16} color={tone} />
        <AppText variant="small" weight="700">Who can get this</AppText>
        {a.badge ? <Badge label={a.badge} tone="warning" /> : null}
      </Row>
      <AppText variant="small" color="textMuted" style={{ lineHeight: 20 }}>
        {a.summary}
      </AppText>
      {detail?.links?.eligibility ? (
        <Pressable
          onPress={() => void Linking.openURL(detail.links!.eligibility!)}
          accessibilityRole="link"
          style={{ marginTop: 8 }}
        >
          <Row gap={6} style={{ alignItems: 'center' }}>
            <Ionicons name="open-outline" size={14} color={theme.colors.primary} />
            <AppText variant="small" weight="700" style={{ color: theme.colors.primary }}>
              Check the lender’s eligibility criteria
            </AppText>
          </Row>
        </Pressable>
      ) : null}
    </Card>
  );
}

export function OfficialLinks({ links }: { links?: ProductDetailData['links'] }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  if (!links) return null;
  const all: { label: string; url?: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { label: 'Product overview', url: links.overview, icon: 'document-text-outline' },
    { label: 'Eligibility criteria', url: links.eligibility, icon: 'person-outline' },
    { label: 'Fees & pricing', url: links.fees, icon: 'cash-outline' },
    { label: 'Terms & conditions', url: links.terms, icon: 'reader-outline' },
  ];
  const items = all.filter((i) => !!i.url);
  if (!items.length) return null;
  return (
    <Disclosure
      title="Official sources"
      summary={`${items.length} lender link${items.length === 1 ? '' : 's'}`}
      open={open}
      onToggle={() => setOpen((value) => !value)}
    >
      <View>
        {items.map((it, i) => (
          <View key={it.label}>
            {i > 0 ? <Divider style={{ marginVertical: 4 }} /> : null}
            <Pressable
              onPress={() => void Linking.openURL(it.url!)}
              accessibilityRole="link"
              accessibilityLabel={`${it.label} (opens lender website)`}
              style={{ paddingVertical: 8 }}
            >
              <Row gap={10} style={{ alignItems: 'center' }}>
                <Ionicons name={it.icon} size={16} color={theme.colors.primary} />
                <AppText variant="small" weight="600" style={{ flex: 1, color: theme.colors.primary }}>
                  {it.label}
                </AppText>
                <Ionicons name="open-outline" size={15} color={theme.colors.textFaint} />
              </Row>
            </Pressable>
          </View>
        ))}
      </View>
      <AppText variant="tiny" color="textFaint" style={{ marginTop: 6, marginLeft: 4 }}>
        Published by the lender and observed through CDR.
      </AppText>
    </Disclosure>
  );
}

export function SectionTitle({ text, icon }: { text: string; icon?: keyof typeof Ionicons.glyphMap }) {
  const theme = useTheme();
  return (
    <Row gap={6} style={{ marginBottom: 8, marginLeft: 4 }}>
      {icon ? <Ionicons name={icon} size={15} color={theme.colors.textMuted} /> : null}
      <AppText variant="small" weight="700" color="textMuted">
        {text.toUpperCase()}
      </AppText>
    </Row>
  );
}

/** Sibling rate variants for the same product — collapsed by default at page bottom. */
export function ProductRatesList({
  rows,
  section,
  accent,
  defaultOpen = false,
}: {
  rows: RateRow[];
  section: SectionKey;
  accent: string;
  defaultOpen?: boolean;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  const title = `Rates (${rows.length})`;

  if (rows.length === 0) return null;

  return (
    <View style={{ marginTop: 16, marginBottom: 16 }}>
      <TouchTarget
        fill
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
        accessibilityHint={open ? 'Hide additional product rates' : 'Show additional product rates'}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          minHeight: TOUCH_TARGET_MIN,
          marginLeft: 4,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <AppText variant="small" weight="700" color="textMuted" style={{ flex: 1 }}>
          {title.toUpperCase()}
        </AppText>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={theme.colors.textMuted}
        />
      </TouchTarget>
      {open ? (
        <Card>
          {rows.map((r, i) => (
            <View key={`${r.rate_index}-${i}`}>
              {i > 0 ? <Divider style={{ marginVertical: 10 }} /> : null}
              <TouchTarget
                fill
                onPress={() => openProduct(r.product_key, r.rate_index)}
                accessibilityRole="button"
                accessibilityLabel={`Open exact rate ${formatRate(r.rate)}`}
                style={({ pressed }) => ({
                  minHeight: TOUCH_TARGET_MIN,
                  justifyContent: 'center',
                  opacity: pressed ? 0.72 : 1,
                })}
              >
                <RateRowLine row={r} section={section} accent={accent} />
              </TouchTarget>
            </View>
          ))}
        </Card>
      ) : null}
    </View>
  );
}

export function ProductSpecs({
  row,
  section,
  detail,
}: {
  row: RateRow;
  section: SectionKey;
  detail: ProductDetailData | null;
}) {
  const [open, setOpen] = useState(false);
  const specs: { label: string; value: string }[] = [];
  const add = (label: string, value?: string | null) => {
    const v = value == null ? '' : String(value).trim();
    if (v) specs.push({ label, value: v });
  };

  add('Rate type', humanizeEnum(row.rate_type));
  if (section === 'Mortgage') {
    add('Structure', humanizeEnum(row.ribbon_rate_structure));
    add('Repayment', humanizeEnum(row.ribbon_repayment_type ?? row.repayment_type));
    add('Loan purpose', humanizeEnum(row.loan_purpose ?? row.security_purpose));
    add('LVR tier', humanizeEnum(row.lvr_tier));
  } else {
    add('Deposit type', humanizeEnum(row.ribbon_deposit_kind));
    add('Balance range', formatBalanceRange(row.balance_min, row.balance_max));
    add('Interest paid', humanizeEnum(row.interest_payment));
  }
  add('Term', formatTerm(row));
  add('Comparison rate', row.comparison_rate ? formatRate(row.comparison_rate) : null);
  const access = detail ? assessAccess(row.product_name, detail, row.provider) : null;
  add(
    'Availability',
    access
      ? accessExcludesFromStandard(access) ? 'Special eligibility' : 'Widely available'
      : 'Checking availability',
  );

  if (!specs.length) return null;
  return (
    <Disclosure
      title="Rate details"
      summary={`${specs.length} details for this exact tier`}
      open={open}
      onToggle={() => setOpen((value) => !value)}
    >
      <View>
        {specs.map((s, i) => (
          <View key={s.label}>
            {i > 0 ? <Divider style={{ marginVertical: 10 }} /> : null}
            <Row style={{ justifyContent: 'space-between', gap: 12 }}>
              <AppText variant="small" color="textMuted">
                {s.label}
              </AppText>
              <AppText variant="small" weight="600" style={{ flex: 1, textAlign: 'right' }}>
                {s.value}
              </AppText>
            </Row>
          </View>
        ))}
      </View>
    </Disclosure>
  );
}

export function HistoryLegend({ productColor, sectionColor }: { productColor: string; sectionColor: string }) {
  return (
    <Row gap={16} style={{ marginTop: 10, flexWrap: 'wrap' }}>
      <LegendItem color={productColor} label="This product" />
      <LegendItem color={sectionColor} label="Median" dashed />
      <LegendItem color={sectionColor} label="Mean" />
    </Row>
  );
}

export function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <Row gap={6}>
      <View
        style={{
          width: 16,
          height: 0,
          borderTopWidth: 2.4,
          borderColor: color,
          borderStyle: dashed ? 'dashed' : 'solid',
        }}
      />
      <AppText variant="tiny" color="textMuted">
        {label}
      </AppText>
    </Row>
  );
}
