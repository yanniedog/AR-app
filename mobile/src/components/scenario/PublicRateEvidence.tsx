import React, { useEffect, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { usePublicRateCatalogue } from '../../data/publicRateCatalogue';
import type { PublicProgramme, RateScenario } from '../../data/publicRateModel';
import { publicRateScenario, resolveProductPublicRate, resolveRowPublicRate } from '../../data/publicRateIntegration';
import { publicRateOriginLabel, publicRateReason, publicRateText } from '../../data/publicRatePresentation';
import { publicRateFreshness } from '../../data/publicRateResolver';
import { useStore } from '../../data/store';
import type { RateRow } from '../../types';
import { useUserRateScenario } from '../../hooks/useUserRateScenario';
import { trustedExternalUrl } from '../../lib/trustedExternalUrl';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText, Button, Disclosure } from '../ui';

function programmeLabel(programme: PublicProgramme): string {
  return programme.conditions.map(condition => condition.description
    || `${condition.field} ${condition.value ?? condition.values?.join('/') ?? `${condition.minimum ?? ''}–${condition.maximum ?? 'and above'}`}`)
    .join(' · ') || 'Published pricing programme';
}

/** Public evidence is progressively disclosed; numerical local assumptions never leave the device. */
export function PublicRateEvidence({ productKey, programmeId, row, scenario: suppliedScenario, compact = false, onSelectProgramme }: {
  productKey: string;
  programmeId?: string;
  row?: RateRow;
  scenario?: RateScenario;
  compact?: boolean;
  onSelectProgramme?: (programmeId: string, offerId: string) => void;
}) {
  const theme = useTheme();
  const manifest = useStore(state => state.manifest);
  const profile = useStore(state => state.prefs.profileFilters);
  const catalogue = usePublicRateCatalogue(manifest);
  const { scenario } = useUserRateScenario();
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<string | undefined>();
  const [historical, setHistorical] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const product = catalogue.getProduct(productKey);
  const programmes = product ? catalogue.getProgrammes(product.productId) : [];
  const selected = programmeId ?? selection;
  const productId = product?.productId;
  const loadProduct = catalogue.loadProduct;
  useEffect(() => { setSelection(undefined); setHistorical(false); }, [productKey]);
  useEffect(() => {
    if (productId) void loadProduct(productId).catch(() => undefined);
  }, [productId, loadProduct]);
  if (catalogue.status === 'unavailable') return (
    <AppText variant="tiny" color="textMuted">Public pricing details are unavailable in this data edition. Published comparison rates are a separate metric.</AppText>
  );
  if (!product) return <AppText variant="tiny" color="textMuted">{catalogue.status === 'loading' ? 'Loading public product discovery…' : 'No public pricing details for this product in this edition.'}</AppText>;
  const applicable = { ...(suppliedScenario ?? publicRateScenario(product.section, scenario, profile, row, 'published')), allowHistorical: historical };
  const productFreshness = product.freshness ? publicRateFreshness(product.freshness, new Date().toISOString()) : undefined;
  const resolution = row && !selected ? resolveRowPublicRate(row, catalogue, applicable)
    : resolveProductPublicRate(product, catalogue, applicable, selected);
  if (!resolution) return null;
  const summary = `${publicRateText(resolution)} · ${publicRateOriginLabel(resolution)}`;
  const details = (
    <View style={{ gap: 8 }}>
      <AppText variant="small" weight="700">{summary}</AppText>
      <AppText variant="tiny" color="textMuted">Public pricing identifies the selected product scenario. Your negotiated rate and lender approval are not confirmed.</AppText>
      {product.status === 'legacy' ? <AppText variant="small" color="textMuted">Not available for new applications.</AppText> : null}
      {product.aliases.map(alias => <AppText key={`${alias.name}:${alias.effectiveFrom ?? ''}`} variant="tiny" color="textMuted">
        Also known as {alias.name}{alias.effectiveFrom ? ` from ${alias.effectiveFrom}` : ''}{alias.effectiveTo ? ` until ${alias.effectiveTo}` : ''}
      </AppText>)}
      {!programmes.length && productFreshness ? <AppText variant="tiny" color="textMuted">Product discovery source {productFreshness.state}{productFreshness.checkedAt ? ` · checked ${productFreshness.checkedAt}` : ''}{productFreshness.lastSuccessAt ? ` · last successful check ${productFreshness.lastSuccessAt}` : ''}</AppText> : null}
      {!programmes.length ? product.reasonCodes.map(reason => <AppText key={`product:${reason}`} variant="tiny" color="textMuted">{publicRateReason(reason)}</AppText>) : null}
      {!selected && !row?.public_programme_id && programmes.length > 1 ? programmes.map(programme => (
        <Pressable key={programme.programmeId} onPress={() => {
          setSelection(programme.programmeId); onSelectProgramme?.(programme.programmeId, programme.offerId);
        }} accessibilityRole="radio" accessibilityState={{ checked: selected === programme.programmeId }}
          style={{ minHeight: 48, paddingVertical: 8 }}>
          <AppText variant="small" color="primary">{programmeLabel(programme)}</AppText>
        </Pressable>
      )) : null}
      {resolution.reasonCodes.map(reason => <AppText key={reason} variant="tiny" color="textMuted">{publicRateReason(reason)}</AppText>)}
      {resolution.conditions.unknown.map(condition => <AppText key={condition.conditionId} variant="tiny" color="textMuted">Unknown: {condition.description ?? condition.field}</AppText>)}
      {resolution.conditions.unmet.map(condition => <AppText key={condition.conditionId} variant="tiny" color="textMuted">Does not meet: {condition.description ?? condition.field}</AppText>)}
      {resolution.freshness.checkedAt ? <AppText variant="tiny" color="textMuted">Source checked {resolution.freshness.checkedAt}</AppText> : null}
      {resolution.freshness.lastSuccessAt ? <AppText variant="tiny" color="textMuted">Last successful check {resolution.freshness.lastSuccessAt}</AppText> : null}
      {resolution.effectiveFrom ? <AppText variant="tiny" color="textMuted">Effective from {resolution.effectiveFrom}{resolution.effectiveTo ? ` until ${resolution.effectiveTo}` : ''}</AppText> : null}
      {!resolution.verifiedCurrent ? <AppText variant="tiny" style={{ color: theme.colors.warning }}>Excluded from verified current-rate and complete-cost rankings.</AppText> : null}
      {programmes.length > 0 && !resolution.verifiedCurrent && resolution.freshness.lastSuccessAt ? <Button
        title={historical ? 'Return to current public pricing' : 'Use dated last-verified pricing as a historical scenario'} variant="secondary"
        onPress={() => setHistorical(value => !value)} /> : null}
      {resolution.appliedComponents.map(component => <AppText key={component.componentId} variant="tiny" color="textMuted">
        {component.role}: {component.value ?? 'public reference'} {component.unit}{component.includedInPayable ? ' · already included' : ''}
      </AppText>)}
      {resolution.phases.map(phase => <AppText key={phase.phaseId} variant="tiny" color="textMuted">Months {phase.startMonth}–{phase.endMonth ?? 'ongoing'}: {phase.status}{phase.payableRate ? ` · ${(Number(phase.payableRate) * 100).toFixed(4)}% p.a.` : ''}</AppText>)}
      {[...new Map([...catalogue.evidence.filter(item => resolution.evidenceIds.includes(item.evidenceId)),
        ...(!programmes.length && product.sourceEvidence ? [product.sourceEvidence] : [])].map(item => [item.evidenceId, item])).values()].map(item => (
        <View key={item.evidenceId} style={{ gap: 3 }}>
          <AppText variant="tiny" color="textMuted">{item.locator} · SHA-256 {item.sha256}</AppText>
          <Button title="Open public lender source" variant="ghost" onPress={() => {
            const destination = trustedExternalUrl({ url: item.url, purpose: 'lender_source', label: 'Public rate evidence' });
            if (!destination.ok) { setSourceError(destination.message); return; }
            void Linking.openURL(destination.url).catch(() => setSourceError('Could not open the public lender source.'));
          }} />
        </View>
      ))}
      {sourceError ? <AppText variant="tiny" color="danger">{sourceError}</AppText> : null}
    </View>
  );
  return compact ? <Disclosure title="Public pricing evidence" summary={summary} open={open} onToggle={() => setOpen(value => !value)}>{details}</Disclosure>
    : <Disclosure title="Public pricing and calculation" summary={summary} open={open} onToggle={() => setOpen(value => !value)}>{details}</Disclosure>;
}
