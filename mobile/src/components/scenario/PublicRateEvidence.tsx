import React, { useEffect, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { usePublicRateCatalogue } from '../../data/publicRateCatalogue';
import type { PublicProgramme, RateScenario } from '../../data/publicRateModel';
import { publicRateScenario, resolveProductPublicRate, resolveRowPublicRate } from '../../data/publicRateIntegration';
import { publicComponentFact, publicConditionFact, publicRateOriginLabel, publicRateReason, publicRateText } from '../../data/publicRatePresentation';
import { publicRateFreshness } from '../../data/publicRateResolver';
import { useStore } from '../../data/store';
import type { RateRow } from '../../types';
import { useUserRateScenario } from '../../hooks/useUserRateScenario';
import { trustedExternalUrl } from '../../lib/trustedExternalUrl';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText, Button, Disclosure } from '../ui';
import { uiDate, uiIdentifier, uiJoin, uiLabel, uiNumber, uiOpaqueEnum, uiPublicAliasName, uiPublicEvidenceLocator, uiRate, type UiCopy } from '../../lib/uiCopy';

function programmeLabel(programme: PublicProgramme) {
  return programme.conditions.length ? uiJoin(...programme.conditions.flatMap<UiCopy>((condition, i) => i ? [' · ', publicConditionFact(condition)] : [publicConditionFact(condition)])) : uiLabel('Pricing programme');
}

/** Public evidence retains its actual source. Private assumptions never leave the device. */
export function PublicRateEvidence({ productKey, programmeId, row, scenario: suppliedScenario, compact = false, onSelectProgramme }: {
  productKey: string; programmeId?: string; row?: RateRow; scenario?: RateScenario; compact?: boolean;
  onSelectProgramme?: (programmeId: string, offerId: string) => void;
}) {
  const theme = useTheme();
  const manifest = useStore(state => state.manifest);
  const profile = useStore(state => state.prefs?.profileFilters);
  const catalogue = usePublicRateCatalogue(manifest);
  const { scenario } = useUserRateScenario();
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<string | undefined>();
  const [historical, setHistorical] = useState(false);
  const [sourceError, setSourceError] = useState(false);
  const product = catalogue.getProduct(productKey);
  const programmes = product ? catalogue.getProgrammes(product.productId) : [];
  const selected = programmeId ?? selection;
  const productId = product?.productId;
  const loadProduct = catalogue.loadProduct;
  useEffect(() => { setSelection(undefined); setHistorical(false); }, [productKey]);
  useEffect(() => { if (productId) void loadProduct(productId).catch(() => undefined); }, [productId, loadProduct]);
  if (catalogue.status === 'unavailable') return <AppText variant="tiny" color="textMuted">{uiJoin('Public pricing', ': ', 'Unavailable')}</AppText>;
  if (!product) return <AppText variant="tiny" color="textMuted">{uiJoin('Public products', ': ', catalogue.status === 'loading' ? 'Loading' : 'Unavailable')}</AppText>;
  const applicable = { ...(suppliedScenario ?? publicRateScenario(product.section, scenario, profile, row, 'published')), allowHistorical: historical };
  const productFreshness = product.freshness ? publicRateFreshness(product.freshness, new Date().toISOString()) : undefined;
  const resolution = row && !selected ? resolveRowPublicRate(row, catalogue, applicable) : resolveProductPublicRate(product, catalogue, applicable, selected);
  if (!resolution) return null;
  const title = uiJoin(compact ? 'Pricing evidence' : 'Public pricing', ' · ', publicRateText(resolution));
  return <Disclosure title={title} open={open} onToggle={() => setOpen(value => !value)}>
    <View style={{ gap: 8 }}>
      <AppText variant="small" weight="700">{publicRateOriginLabel(resolution)}</AppText>
      <AppText variant="tiny" color="textMuted">{uiJoin('Basis', ': ', 'Selected public scenario', ' · ', 'Negotiated rate', ': ', 'Unverified', ' · ', 'Approval', ': ', 'Unverified')}</AppText>
      {product.status === 'legacy' ? <AppText variant="small" color="textMuted">{uiJoin('New applications', ': ', 'Unavailable')}</AppText> : null}
      {product.aliases.map(alias => <AppText key={alias.name + ':' + (alias.effectiveFrom ?? '')} variant="tiny" color="textMuted">
        {uiJoin('Aliases', ': ', uiPublicAliasName(alias), alias.effectiveFrom ? uiJoin(' · ', 'Effective from', ': ', uiDate(alias.effectiveFrom)) : null, alias.effectiveTo ? uiJoin(' · ', 'Effective to', ': ', uiDate(alias.effectiveTo)) : null)}
      </AppText>)}
      {!programmes.length && productFreshness ? <AppText variant="tiny" color="textMuted">{uiJoin('Discovery', ': ', uiOpaqueEnum(productFreshness.state.toUpperCase()), ' · ', 'Checked', ': ', uiDate(productFreshness.checkedAt), ' · ', 'Last successful check', ': ', uiDate(productFreshness.lastSuccessAt))}</AppText> : null}
      {!programmes.length ? product.reasonCodes.map(reason => <AppText key={'product:' + reason} variant="tiny" color="textMuted">{publicRateReason(reason)}</AppText>) : null}
      {!selected && !row?.public_programme_id && programmes.length > 1 ? programmes.map(programme => <Pressable key={programme.programmeId}
        onPress={() => { setSelection(programme.programmeId); onSelectProgramme?.(programme.programmeId, programme.offerId); }}
        accessibilityRole="radio" accessibilityState={{ checked: selected === programme.programmeId }} style={{ minHeight: 48, paddingVertical: 8 }}>
        <AppText variant="small" color="primary">{programmeLabel(programme)}</AppText>
      </Pressable>) : null}
      {resolution.reasonCodes.map(reason => <AppText key={reason} variant="tiny" color="textMuted">{publicRateReason(reason)}</AppText>)}
      {resolution.conditions.unknown.map(condition => <AppText key={condition.conditionId} variant="tiny" color="textMuted">{uiJoin('Unknown', ' · ', publicConditionFact(condition))}</AppText>)}
      {resolution.conditions.unmet.map(condition => <AppText key={condition.conditionId} variant="tiny" color="textMuted">{uiJoin('Unmet', ' · ', publicConditionFact(condition))}</AppText>)}
      {resolution.freshness.checkedAt ? <AppText variant="tiny" color="textMuted">{uiJoin('Checked', ': ', uiDate(resolution.freshness.checkedAt))}</AppText> : null}
      {resolution.freshness.lastSuccessAt ? <AppText variant="tiny" color="textMuted">{uiJoin('Last successful check', ': ', uiDate(resolution.freshness.lastSuccessAt))}</AppText> : null}
      {resolution.effectiveFrom ? <AppText variant="tiny" color="textMuted">{uiJoin('Effective from', ': ', uiDate(resolution.effectiveFrom), resolution.effectiveTo ? uiJoin(' · ', 'Effective to', ': ', uiDate(resolution.effectiveTo)) : null)}</AppText> : null}
      {!resolution.verifiedCurrent ? <AppText variant="tiny" style={{ color: theme.colors.warning }}>{uiJoin('Current-rate ranking', ': ', 'Excluded', ' · ', 'Complete-cost ranking', ': ', 'Excluded')}</AppText> : null}
      {programmes.length > 0 && !resolution.verifiedCurrent && resolution.freshness.lastSuccessAt ? <Button title={historical ? 'Current pricing' : 'Historical pricing assumption'} variant="secondary" onPress={() => setHistorical(value => !value)} /> : null}
      {resolution.appliedComponents.map(component => <AppText key={component.componentId} variant="tiny" color="textMuted">{publicComponentFact(component)}</AppText>)}
      {resolution.phases.map(phase => <AppText key={phase.phaseId} variant="tiny" color="textMuted">{uiJoin('Months', ': ', uiNumber(phase.startMonth), '–', phase.endMonth == null ? uiLabel('Ongoing') : uiNumber(phase.endMonth), ' · ', uiOpaqueEnum(phase.status.toUpperCase()), phase.payableRate ? uiJoin(' · ', uiRate(Number(phase.payableRate), 4)) : null)}</AppText>)}
      {[...new Map([...catalogue.evidence.filter(item => resolution.evidenceIds.includes(item.evidenceId)), ...(!programmes.length && product.sourceEvidence ? [product.sourceEvidence] : [])].map(item => [item.evidenceId, item])).values()].map(item => <View key={item.evidenceId} style={{ gap: 3 }}>
        <AppText variant="tiny" color="textMuted">{uiJoin(uiPublicEvidenceLocator(item), ' · ', 'SHA-256', ': ', uiIdentifier(item.sha256))}</AppText>
        <Button title="Open source" variant="ghost" onPress={() => {
          const destination = trustedExternalUrl({ url: item.url, purpose: 'lender_source', label: 'Public rate evidence' });
          if (!destination.ok) { setSourceError(true); return; }
          void Linking.openURL(destination.url).catch(() => setSourceError(true));
        }} />
      </View>)}
      {sourceError ? <AppText variant="tiny" color="danger">{uiLabel('Public source unavailable')}</AppText> : null}
    </View>
  </Disclosure>;
}
