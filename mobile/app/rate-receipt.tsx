import { useMortgageComparison } from '../src/data/mortgageComparison';
import { mortgageComparisonScenario } from '../src/data/mortgageComparisonScenario';
import { useRatesSession } from '../src/data/ratesSession';
import { uiCount, uiDate, uiJoin, uiLabel, uiMoney, uiNumber, uiProductName, uiProviderName, type UiCopy, type UiLabel, type UiText } from "../src/lib/uiCopy";
import { uiConditionalRateFact } from "../src/lib/financialUiCopy";
import Ionicons from '../src/components/icons/AppIcon';
import { usePublicRateCatalogue } from '../src/data/publicRateCatalogue';
import { bindCurrentPublicRow, publicScenarioForRow, publicRateScenario, publicRecommendationRows, resolveLocalCurrentRate, resolveRowPublicRate, resolvedPublicRankingRows, scenarioWithLocalCurrentRate } from '../src/data/publicRateIntegration';
import { PublicRateEvidence } from '../src/components/scenario/PublicRateEvidence';
import * as Clipboard from 'expo-clipboard';
import { Stack, router, useLocalSearchParams, type Href } from 'expo-router';
import { useSuitabilityRevision } from '../src/hooks/useSuitabilityRevision';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Share, type ScrollView, View } from 'react-native';

import { useTrustedExternalUrl } from '../src/components/ExternalLinkConfirmation';
import { useAuditExternalLinks } from '../src/hooks/useAuditExternalLinks';
import { EmptyState, ScreenSkeleton } from '../src/components/feedback';
import { SectionTitle } from '../src/components/product/ProductDetailParts';
import { RateConditionsDisclosure } from '../src/components/product/RateConditionsDisclosure';
import { ScreenScrollView } from '../src/components/Screen';
import { TOUCH_TARGET_MIN } from '../src/components/TouchTarget';
import { AppText, Button, Card, Disclosure, Divider, Row } from '../src/components/ui';
import {
  buildNegotiationBrief,
  buildRateReceipt,
  rateConditionReceiptLines,
  type ReceiptFact,
  type ReceiptStatusFact,
} from '../src/data/rateReceipt';
import type { RateRow, SectionKey } from '../src/types';
import { findEligibleByKey } from '../src/data/selectors';
import { isMandatoryEligibilityReady } from '../src/data/eligibilityGate';
import { useStore } from '../src/data/store';
import { useUserRateScenario } from '../src/hooks/useUserRateScenario';
import { usePerformanceAuditSurface } from '../src/hooks/usePerformanceAuditReadiness';
import { useTheme } from '../src/theme/ThemeProvider';

function Facts({ items, empty }: { items: readonly ReceiptFact[]; empty?: UiCopy }) {
  if (!items.length) {
    return empty ? <AppText variant="small" color="textMuted">{empty}</AppText> : null;
  }
  return (
    <>
      {items.map((fact, index) => (
        <View key={`${fact.label}-${index}`}>
          {index > 0 ? <Divider style={{ marginVertical: 10 }} /> : null}
          <Row style={{ alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <AppText variant="small" color="textMuted" style={{ flex: 1 }}>
              {fact.label}
            </AppText>
            <AppText variant="small" weight="600" style={{ flex: 1.4, textAlign: 'right' }}>
              {fact.value}
            </AppText>
          </Row>
        </View>
      ))}
    </>
  );
}

const money=(value:number):UiText=>uiMoney(value);
function statusFact(fact:ReceiptStatusFact):ReceiptFact {
  switch(fact.kind) {
    case 'eligibility':return {label:uiLabel("Eligibility"),value:uiLabel('Unverified')};
    case 'quote':return {label:uiLabel("Lender quote / approval"),value:uiLabel('Unavailable')};
    case 'advice':return {label:uiLabel("Personal advice"),value:uiLabel('Excluded')};
    case 'privacy':return {label:uiLabel("Privacy"),value:uiLabel('Local only')};
    case 'costs':return {label:uiLabel("Total costs"),value:uiLabel('Unverified')};
    case 'comparables':return {label:uiLabel("Comparable criteria"),value:uiLabel('Unmatched')};
    case 'source':return {label:uiLabel("Source"),value:uiLabel('Unavailable')};
    case 'detailed-eligibility':return {label:uiLabel("Detailed eligibility"),value:uiLabel('Unavailable')};
  }
}
const TOPICS:Record<'current-rate'|'selected-tier'|'fees'|'conditions',UiLabel>={'current-rate':'Current rate','selected-tier':'Selected tier',fees:'Fees',conditions:'Conditions'};
const EXCLUSIONS:Record<'repayments'|'fees'|'loan-structure'|'switching-costs'|'compounding'|'maturity-instructions'|'bonus-eligibility'|'tax'|'balance-changes',UiLabel>={repayments:'Repayments',fees:'Fees','loan-structure':'Loan structure','switching-costs':'Switching costs',compounding:'Compounding','maturity-instructions':'Maturity instructions','bonus-eligibility':'Bonus qualification',tax:'Tax','balance-changes':'Balance changes'};

export default function RateReceiptScreen() {
  const suitabilityRevision = useSuitabilityRevision();
  const theme = useTheme();
  const { requestExternalUrl } = useTrustedExternalUrl();
  const { key, ri, programme: requestedProgramme, origin } = useLocalSearchParams<{ key?: string; ri?: string; programme?: string; origin?: string }>();
  const fromRatesComparison = origin === 'rates-comparison';
  const comparisonInputs = useMortgageComparison();
  const mortgageFilters = useRatesSession(state => state.sections.Mortgage.filters);
  const productKey = key ?? '';
  const requestedRateIndex = ri == null || ri === '' ? null : Number(ri);
  const validRateIndex = requestedRateIndex == null || Number.isInteger(requestedRateIndex);
  const core = useStore((state) => state.core);
  const details = useStore((state) => state.details);
  const manifest = useStore((state) => state.manifest);
  const profile = useStore((state) => state.prefs?.profileFilters);
  const publicCatalogue = usePublicRateCatalogue(manifest);
  const publicProduct = publicCatalogue.getProduct(productKey);
  const coreIntegrity = useStore((state) => state.coreIntegrity);
  const detailsProducts = useStore((state) => state.details?.products ?? null);
  const detail = detailsProducts?.[productKey] ?? null;
  const ensureDetails = useStore((state) => state.ensureDetails);
  const { scenario, storageStatus } = useUserRateScenario();
  const scenarioLoaded = storageStatus === 'ready';
  const scenarioFor = useCallback((section: SectionKey, row?: RateRow) => {
    const saved = publicRateScenario(section, scenario, profile, row);
    return publicScenarioForRow(row, publicCatalogue, fromRatesComparison
      ? mortgageComparisonScenario(section, saved, comparisonInputs, mortgageFilters) : saved);
  }, [scenario, profile, publicCatalogue, fromRatesComparison, comparisonInputs, mortgageFilters]);
  const scrollRef = useRef<ScrollView>(null);
  const [layoutReady, setLayoutReady] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [scenarioOpen, setScenarioOpen] = useState(false);

  useEffect(() => {
    void ensureDetails({ forProductView: true });
  }, [ensureDetails]);
  const { status: catalogueStatus, allLoaded, loadAll } = publicCatalogue;
  useEffect(() => {
    if (catalogueStatus === 'ready' && !allLoaded) void loadAll().catch(() => undefined);
  }, [catalogueStatus, allLoaded, loadAll]);
  const comparisonsReady = catalogueStatus === 'unavailable' || catalogueStatus === 'ready' && allLoaded;

  const found = useMemo(
    () => {
      void suitabilityRevision;
      if (!core) return null;
      const sections = publicProduct ? { ...core.sections, [publicProduct.section]: { ...core.sections[publicProduct.section],
        rates: publicRecommendationRows(core.sections[publicProduct.section].rates, publicCatalogue, publicProduct.section,
          scenarioFor(publicProduct.section)) } } : core.sections;
      return findEligibleByKey(sections, productKey);
    },
    [core, productKey, suitabilityRevision, publicProduct, publicCatalogue, scenarioFor],
  );
  const selectedRow = found && validRateIndex
    ? requestedProgramme ? found.siblings.find(candidate => bindCurrentPublicRow(candidate, publicCatalogue).public_programme_id === requestedProgramme) ?? null
    : requestedRateIndex == null
      ? found.row
      : found.siblings.find((candidate) => candidate.rate_index === requestedRateIndex) ?? null
    : null;
  const publicResolution = selectedRow && found ? resolveRowPublicRate(selectedRow, publicCatalogue, scenarioFor(found.section, selectedRow)) : undefined;
  const row = useMemo(() => selectedRow && publicResolution?.status === 'exact' && publicResolution.verifiedCurrent
    ? { ...selectedRow, rate: publicResolution.payableRate ?? '' } : selectedRow, [selectedRow, publicResolution]);
  const calculationScenario = found ? scenarioWithLocalCurrentRate(found.section, scenario,
    resolveLocalCurrentRate(found.section, scenario, publicCatalogue.references, undefined, publicCatalogue, profile)) : scenario;
  const receipt = useMemo(
    () => row && found && core
      ? buildRateReceipt({ row, section: found.section, evidenceDate: core.run_date, detail, rateConditionContext: { core, details, manifest, coreIntegrity } })
      : null,
    [core, detail, details, manifest, coreIntegrity, found, row],
  );
  const brief = useMemo(
    () => {
      if (!receipt || !found) return null;
      const brief = buildNegotiationBrief({
          receipt,
          scenario: calculationScenario,
          sectionRows: comparisonsReady ? resolvedPublicRankingRows(publicRecommendationRows(
            core?.sections[found.section].rates ?? [], publicCatalogue, found.section,
            scenarioFor(found.section)), publicCatalogue,
            row => scenarioFor(found.section, row)).rows : [],
          comparisonsReady,
          detailsProducts,
        });
      if (!fromRatesComparison || found.section !== 'Mortgage') return brief;
      const scoped = scenarioFor(found.section, selectedRow ?? undefined);
      // Rates inputs describe offer applicability, not the saved current loan.
      // Do not combine a qualified offer with a different saved principal/rate.
      const facts: ReceiptFact[] = [];
      if (typeof scoped.amount === 'string' && Number(scoped.amount) > 0)
        facts.push({ label: uiLabel('Loan amount'), value: uiMoney(Number(scoped.amount)) });
      if (typeof scoped.lvr === 'string' && Number.isFinite(Number(scoped.lvr)))
        facts.push({ label: uiLabel('Scenario LVR'), value: uiJoin(uiNumber(Number(scoped.lvr) * 100, 1), '%') });
      return { ...brief, illustration: null, scenario: facts };
    },
    [core, detailsProducts, found, receipt, calculationScenario, publicCatalogue, comparisonsReady, fromRatesComparison, scenarioFor, selectedRow],
  );
  useAuditExternalLinks((receipt?.officialSources ?? []).map((source) => ({ url: source.url, purpose: 'lender_source', label: source.label })));
  const shareText = useMemo(() => {
    if (!receipt || !brief) return uiLabel('Unavailable');
    const lines:UiCopy[]=[uiJoin('Bank-call brief',': ',uiProviderName({provider:receipt.provider})),
      uiJoin(uiProductName({product_name:receipt.productName}),' · ',receipt.advertisedRate,' · ','Observed',': ',uiDate(receipt.evidenceDate)),
      ...rateConditionReceiptLines(receipt),...brief.facts.map(fact=>{const row=statusFact(fact);return uiJoin(row.label,': ',row.value);})];
    if(brief.illustration) lines.push(uiJoin('Simple interest-rate difference',': ',money(brief.illustration.periodDifference),' · ',brief.illustration.periodLabel),
      uiJoin('Entered / observed',': ',brief.illustration.currentRate,' / ',brief.illustration.selectedRate),
      ...brief.illustration.exclusions.map(code=>uiJoin('Excluded',': ',EXCLUSIONS[code])));
    for(const item of brief.comparables) lines.push(uiJoin(uiProviderName({provider:item.provider}),': ',item.advertisedRate,
      item.comparisonRate ? uiJoin(' · ','Comparison rate',': ',item.comparisonRate) : null,
      ' · ',uiProductName({product_name:item.productName})),...item.conditionalFacts.map(uiConditionalRateFact));
    lines.push(uiJoin('Topics',': ',...brief.topics.flatMap<UiCopy>((topic,index)=>index?[' / ',TOPICS[topic]]:[TOPICS[topic]])));
    return uiJoin(...lines.flatMap<UiCopy>((line,index)=>index?[' · ',line]:[line]));
  }, [brief, receipt]);
  const auditActions = useMemo(() => ({
    'receipt.open': () => undefined,
    'receipt.scroll.evidence': () => {
      setEvidenceOpen(true);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    },
    'receipt.back-to-product': (parameters: unknown) => {
      const plannedKey = parameters && typeof parameters === 'object'
        ? (parameters as { productKey?: unknown }).productKey
        : null;
      const plannedRateIndex = parameters && typeof parameters === 'object'
        ? (parameters as { rateIndex?: unknown }).rateIndex
        : null;
      if (typeof plannedKey === 'string' && plannedKey) {
        router.replace({
          pathname: '/product/[key]',
          params: {
            key: plannedKey,
            ...(plannedKey === productKey && requestedProgramme ? { programme: requestedProgramme }
              : typeof plannedRateIndex === 'number' ? { ri: String(plannedRateIndex) } : {}),
            ...(fromRatesComparison ? { origin: 'rates-comparison' } : {}),
          },
        } as unknown as Href);
      } else {
        router.back();
      }
    },
  }), [productKey, requestedProgramme, fromRatesComparison]);
  const receiptFactCount = receipt
    ? receipt.tier.length + receipt.conditions.length + receipt.fees.length
    : 0;
  usePerformanceAuditSurface({
    id: 'receipt.evidence',
    routeKey: '/rate-receipt',
    datasetRevision: core?.run_date ?? null,
    renderRevision: `${productKey}:${row?.rate_index ?? 'none'}:${receiptFactCount}:${evidenceOpen ? 'evidence-open' : 'evidence-closed'}`,
    actions: auditActions,
    probes: [
      {
        id: 'receipt.data',
        kind: 'data',
        status: core && isMandatoryEligibilityReady() && (!found || !row) ? 'error'
          : receipt && brief ? 'ready' : 'pending',
        error: core && isMandatoryEligibilityReady() && (!found || !row)
          ? 'The selected exact rate is absent from the eligible current catalogue' : null,
        datasetRevision: core?.run_date ?? null,
      },
      {
        id: 'receipt.scenario-storage',
        kind: 'data',
        status: scenarioLoaded ? 'ready' : 'pending',
      },
      {
        id: 'receipt.facts',
        kind: 'list',
        // The disclosure is intentionally closed on entry. Its contents only
        // become required after the audit (or user) opens it.
        required: evidenceOpen,
        status: !evidenceOpen || (receipt && brief) ? 'ready' : 'pending',
        expectedCount: evidenceOpen ? receiptFactCount : 0,
        actualCount: evidenceOpen && receipt && brief ? receiptFactCount : 0,
      },
      {
        id: 'receipt.layout',
        kind: 'layout',
        status: layoutReady ? 'ready' : 'pending',
        layoutMeasured: layoutReady,
      },
      {
        id: 'receipt.logos',
        kind: 'logo',
        required: false,
        status: 'ready',
        expectedCount: 0,
        actualCount: 0,
      },
    ],
  });

  if (!core) return <ScreenSkeleton />;
  if (publicProduct && (!found || !row) || publicResolution && (publicResolution.status !== 'exact' || !publicResolution.verifiedCurrent)) return <>
    <Stack.Screen options={{ title: 'Pricing evidence' }} />
    <ScreenScrollView><AppText variant="small">{uiJoin('Bank-call brief', ': ', 'Unavailable', ' · ', 'Pricing unresolved')}</AppText>
      <PublicRateEvidence productKey={productKey} row={selectedRow ?? undefined} programmeId={requestedProgramme} scenario={publicProduct ? scenarioFor(publicProduct.section, selectedRow ?? undefined) : undefined} />
    </ScreenScrollView>
  </>;
  if (!found || !row || !receipt || !brief) {
    return (
      <>
        <Stack.Screen options={{ title: 'Bank-call brief' }} />
        <EmptyState
          icon="receipt-outline"
          title="Exact rate no longer available"
          fill
        />
      </>
    );
  }

  return <><Stack.Screen options={{title:'Bank-call brief'}}/>
    <ScreenScrollView ref={scrollRef} onLayout={()=>setLayoutReady(true)} contentContainerStyle={{padding:16,paddingBottom:32,gap:12}}>
      <Card style={{gap:8}}>
        <AppText variant="small" color="textMuted">{uiProviderName(row)}</AppText>
        <AppText variant="h3">{uiProductName(row)}</AppText>
        <AppText variant="rateHero" style={{color:theme.colors.primary}}>{receipt.advertisedRate}</AppText>
        <AppText variant="tiny" color="textMuted">{uiJoin('Tier',': ',receipt.rateIndex == null ? 'Unknown':uiCount(receipt.rateIndex),' · ','Observed',': ',uiDate(receipt.evidenceDate))}</AppText>
        {receipt.comparisonRate ? <AppText variant="small">{uiJoin('Comparison rate',': ',receipt.comparisonRate)}</AppText>:null}
        {receipt.ongoingRate ? <AppText variant="small">{uiJoin('Ongoing rate',': ',receipt.ongoingRate)}</AppText>:null}
      </Card>
      {brief.illustration ? <Card style={{gap:8}}>
        <AppText variant="small" color="textMuted">{uiLabel('Simple interest-rate difference')}</AppText>
        <AppText variant="h2">{uiJoin(money(brief.illustration.periodDifference),' ',brief.illustration.periodLabel)}</AppText>
        {brief.illustration.monthlyDifference != null ? <AppText weight="700">{uiJoin('Approximate',': ',money(brief.illustration.monthlyDifference),' ','per month')}</AppText>:null}
        <Facts items={[{label:uiLabel("Entered / observed"),value:uiJoin(brief.illustration.currentRate,' / ',brief.illustration.selectedRate)},
          {label:uiLabel("Basis"),value:uiLabel('Illustrative')},...brief.illustration.exclusions.map(code=>({label:'Excluded' as const,value:uiLabel(EXCLUSIONS[code])}))]}/>
      </Card>:<Button title="Add my rate" variant="secondary" onPress={()=>router.push({pathname:'/calculator',params:{intent:'check',section:receipt.section}})}/>}
      <Card style={{gap:8}}><Facts items={brief.facts.map(statusFact)}/></Card>
      <SectionTitle text="Comparable observed rates" icon="git-compare-outline"/>
      <Card style={{gap:8}}>
        <AppText variant="tiny" color="textMuted">{uiJoin(brief.cohortSummary,brief.typicalAdvertisedRate ? uiJoin(' · ','Median',': ',brief.typicalAdvertisedRate):null)}</AppText>
        {brief.comparables.length ? brief.comparables.map((comparable,index)=><Pressable key={`${comparable.productKey}#${comparable.rateIndex??'default'}`}
          accessibilityRole="button" accessibilityLabel={uiJoin('Open',' ',uiProviderName({provider:comparable.provider}),' · ',uiProductName({product_name:comparable.productName}))}
          onPress={()=>router.push({pathname:'/product/[key]',params:{key:comparable.productKey,...(comparable.programmeId ? {programme:comparable.programmeId} : comparable.rateIndex!=null?{ri:String(comparable.rateIndex)}:{}),...(fromRatesComparison?{origin:'rates-comparison'}:{})}} as Href)}
          style={{minHeight:TOUCH_TARGET_MIN,justifyContent:'center',gap:4}}>
          {index ? <Divider/>:null}
          <Row style={{justifyContent:'space-between',gap:12}}><View style={{flex:1}}><AppText weight="700">{uiProviderName({provider:comparable.provider})}</AppText><AppText variant="tiny" color="textMuted">{uiProductName({product_name:comparable.productName})}</AppText></View><AppText weight="800">{comparable.advertisedRate}</AppText></Row>
          {comparable.comparisonRate ? <AppText variant="tiny" color="textMuted">{uiJoin('Comparison rate',': ',comparable.comparisonRate)}</AppText>:null}
          {comparable.conditionalFacts.map((fact,i)=><AppText key={i} variant="tiny" color="textMuted">{uiConditionalRateFact(fact)}</AppText>)}
        </Pressable>):<AppText>{uiLabel('No comparable rates observed')}</AppText>}
      </Card>
      <Row gap={8}><Button title="Copy" variant="secondary" icon="copy-outline" style={{flex:1}} onPress={()=>void Clipboard.setStringAsync(shareText)}/><Button title="Share" icon="share-outline" style={{flex:1}} onPress={()=>void Share.share({title:'Bank-call brief',message:shareText})}/></Row>
      <Disclosure title="Your entered scenario" open={scenarioOpen} onToggle={()=>setScenarioOpen(!scenarioOpen)}><Card>
        {!scenarioLoaded ? <AppText>{uiLabel('Loading')}</AppText>:brief.scenario.length ? <Facts items={brief.scenario}/>:<Button title="Add scenario" variant="secondary" onPress={()=>router.push('/calculator')}/>}
      </Card></Disclosure>
      <Disclosure title="Published evidence" open={evidenceOpen} onToggle={()=>setEvidenceOpen(!evidenceOpen)}>
        <SectionTitle text="Exact published tier" icon="layers-outline"/><Card><Facts items={receipt.tier}/></Card>
        <SectionTitle text="Conditions recorded" icon="checkmark-done-outline"/><RateConditionsDisclosure model={receipt.rateConditions}/><Card><Facts items={receipt.conditions} empty="Eligibility / constraints unpublished"/></Card>
        {receipt.fees.length ? <><SectionTitle text="Fees recorded" icon="cash-outline"/><Card><Facts items={receipt.fees}/></Card></>:null}
        <SectionTitle text="Published source links" icon="link-outline"/><Card>
          {receipt.officialSources.length ? receipt.officialSources.map((source,index)=><View key={source.url}>
            {index ? <Divider/>:null}
            <Pressable accessibilityRole="link" accessibilityLabel={uiJoin(source.label,' · ',source.hostname,' · ','External link')}
              onPress={()=>requestExternalUrl({url:source.url,purpose:'lender_source',label:source.label})}
              style={({pressed})=>({minHeight:TOUCH_TARGET_MIN,flexDirection:'row',alignItems:'center',gap:10,opacity:pressed?0.7:1})}>
              <Ionicons name="open-outline" size={17} color={theme.colors.primary}/><View style={{flex:1}}><AppText weight="700">{source.label}</AppText><AppText variant="tiny" color="textMuted">{source.hostname}</AppText></View>
            </Pressable>
          </View>):<AppText>{uiLabel('Published source unavailable')}</AppText>}
        </Card>
      </Disclosure>
    </ScreenScrollView>
  </>;
}
