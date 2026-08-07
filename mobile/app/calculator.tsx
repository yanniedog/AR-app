import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { IndeterminateProgressBar } from '../src/components/feedback';
import { BankAvatar } from '../src/components/BankAvatar';
import {
  productRateChangeText,
  ProductRateChangeSummaryLine,
} from '../src/components/product/ProductRateChangeLine';
import { ProfileEditor } from '../src/components/ProfileEditor';
import { ScreenScrollView } from '../src/components/Screen';
import { SegmentedControl } from '../src/components/controls';
import { AppText, Badge, Button, Card, Row } from '../src/components/ui';
import { SECTIONS } from '../src/constants';
import { assessAccess } from '../src/data/access';
import {
  advertisedTermMonths,
  computeLvr,
  depositToReachLvr,
  fixedRateProjectionMonths,
  num,
  termDepositInterestDifference,
  type CalcInputs,
} from '../src/data/calc';
import { formatRate, humanizeEnum, toFraction, visibleAccountRows } from '../src/data/format';
import { sectionSegmentOptions } from '../src/data/interests';
import { bestRateForProduct, summarizeProductBestRate } from '../src/data/productHistory';
import {
  lvrTierForValue,
  parseLvrTier,
  profileFeaturesForSection,
  profileFilterRows,
} from '../src/data/profile';
import { distinctValues, rankFraction } from '../src/data/selectors';
import { isSuitabilityFilterReady } from '../src/data/suitabilityGate';
import { useStore } from '../src/data/store';
import { useUserRateScenario } from '../src/hooks/useUserRateScenario';
import { usePerformanceAuditSurface } from '../src/hooks/usePerformanceAuditReadiness';
import { useSuitabilityRevision } from '../src/hooks/useSuitabilityRevision';
import { rowsUnder, statsFor } from '../src/data/taxonomy';
import { openProduct } from '../src/lib/nav';
import { hasProAccess } from '../src/lib/proAccess';
import { auditActionString } from '../src/lib/performanceAuditActionParams';
import { useLogoReadiness } from '../src/hooks/useLogoReadiness';
import type { RateRow, SectionKey } from '../src/types';
import { useTheme } from '../src/theme/ThemeProvider';

function monthlyPayment(balance: number, annualRate: number, months: number): number {
  const r = annualRate / 12;
  if (r <= 0) return balance / months;
  return (r * balance) / (1 - Math.pow(1 + r, -months));
}

const formatDollars = (n: number): string => `$${Math.round(n).toLocaleString('en-AU')}`;

interface Candidate {
  row: RateRow;
  rate: number; // configured ranking metric shown for transparency
  projectionRate: number; // contractual/headline rate used for arithmetic
  perMonth: number; // mortgage: repayment saved per month; deposits: extra interest per month
  total: number; // mortgage: saved over remaining term; deposits: extra interest per year
  totalLabel: string;
}

export default function Calculator() {
  const theme = useTheme();
  const core = useStore((s) => s.core);
  const storeStatus = useStore((s) => s.status);
  const storeError = useStore((s) => s.error);
  const coreSha = useStore((s) => s.manifest?.files.core.sha256 ?? '');
  const details = useStore((s) => s.details);
  const detailsLoading = useStore((s) => s.detailsLoading);
  const productHistory = useStore((s) =>
    hasProAccess(s.prefs) ? s.productHistory : null,
  );
  const ensureDetails = useStore((s) => s.ensureDetails);
  const interests = useStore((s) => s.prefs.interests);
  const profileFilters = useStore((s) => s.prefs.profileFilters);
  const includeNonStandard = useStore((s) => s.prefs.includeNonStandard);
  const depositRankMetric = useStore((s) => s.prefs.depositRankMetric);
  const mortgageRateMetric = useStore((s) => s.prefs.mortgageRateMetric);
  const setPref = useStore((s) => s.setPref);
  const activeSection = useStore((s) => s.activeSection);
  const [section, setSection] = useState<SectionKey>(activeSection);
  const [layoutReady, setLayoutReady] = useState(false);
  const [detailsTerminalError, setDetailsTerminalError] = useState(false);
  const sectionOptions = useMemo(() => sectionSegmentOptions(interests), [interests]);
  const suitabilityRevision = useSuitabilityRevision();
  const suitabilityReady = useMemo(() => {
    void suitabilityRevision;
    return isSuitabilityFilterReady(includeNonStandard);
  }, [includeNonStandard, suitabilityRevision]);

  const profileFeaturesPending =
    profileFeaturesForSection(profileFilters, section).length > 0 && !details?.products;

  useEffect(() => {
    if (!profileFeaturesPending) {
      setDetailsTerminalError(false);
      return;
    }
    let cancelled = false;
    setDetailsTerminalError(false);
    void ensureDetails()
      .then(() => {
        if (!cancelled && !useStore.getState().details?.products) setDetailsTerminalError(true);
      })
      .catch(() => {
        if (!cancelled) setDetailsTerminalError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [profileFeaturesPending, ensureDetails]);

  const isLoan = SECTIONS[section].lowerIsBetter;
  const isMortgage = section === 'Mortgage';

  const {
    scenario,
    storageStatus: scenarioStorageStatus,
    saveStatus: scenarioSaveStatus,
    error: scenarioError,
    update: updateScenario,
    flush: flushScenario,
    retryLoad: retryScenarioLoad,
  } = useUserRateScenario();
  const inputs = scenario.mortgage;
  const upd = (patch: Partial<CalcInputs>) =>
    updateScenario((prev) => ({ ...prev, mortgage: { ...prev.mortgage, ...patch } }));

  const lvrResult = useMemo(() => computeLvr(inputs), [inputs]);
  const lvr = isMortgage ? lvrResult.lvr : null;
  const availableLvrTiers = useMemo(
    () => distinctValues(core?.sections?.Mortgage?.rates ?? [], 'lvr_tier'),
    [core],
  );
  const lvrBand = lvr !== null ? lvrTierForValue(lvr, availableLvrTiers) : null;

  // Profile-matched comparable rows. A calculated LVR applies only to this
  // scenario and never silently rewrites the saved browsing profile.
  const rows = useMemo(() => {
    void suitabilityRevision;
    const all = core?.sections?.[section]?.rates ?? [];
    const scenarioProfile =
      section === 'Mortgage' && lvrBand
        ? { ...profileFilters, lvrTiers: [lvrBand] }
        : profileFilters;
    return visibleAccountRows(
      profileFilterRows(
        rowsUnder(all, section, []),
        scenarioProfile,
        section,
        details?.products,
      ),
      includeNonStandard,
      details?.products,
    );
  }, [core, section, profileFilters, includeNonStandard, details, lvrBand, suitabilityRevision]);

  const median = useMemo(() => statsFor(rows, true, section).median, [rows, section]);

  // ---- LVR (mortgage): a real calculation from several inputs ----
  // Deposit needed to drop into the next lower LVR band (better rates).
  const nextBandHint = useMemo(() => {
    if (!isMortgage || inputs.mode !== 'buy' || !lvrBand) return null;
    const band = parseLvrTier(lvrBand);
    const propertyValue = num(inputs.propertyValue);
    if (!band || band.lo <= 0 || propertyValue <= 0) return null;
    const extra = depositToReachLvr(propertyValue, lvrResult.depositApplied, band.lo);
    if (extra <= 0) return null;
    return { extra, targetPct: band.lo };
  }, [isMortgage, inputs.mode, inputs.propertyValue, lvrBand, lvrResult.depositApplied]);

  // Loan amount that drives the savings comparison.
  const depositInputs = section === 'TD' ? scenario.termDeposit : scenario.savings;
  const balance = isMortgage ? lvrResult.loan ?? 0 : num(depositInputs.balance);

  const currentRate = (() => {
    const rawRate = isMortgage ? inputs.currentRate : depositInputs.currentRate;
    const pct = Number((rawRate || '').trim().replace(/%$/, ''));
    if (isFinite(pct) && pct > 0) return pct / 100;
    return null;
  })();
  const years = Math.min(40, Math.max(1, num(inputs.years) || 25));
  const months = Math.round(years * 12);

  const candidates = useMemo<Candidate[]>(() => {
    if (currentRate === null || balance <= 0) return [];
    const bestByProvider = new Map<string, { row: RateRow; rate: number; projectionRate: number }>();
    for (const row of rows) {
      const v = rankFraction(row, section, depositRankMetric, mortgageRateMetric);
      if (v === null) continue;
      const prev = bestByProvider.get(row.provider);
      if (!prev || (isLoan ? v < prev.rate : v > prev.rate)) {
        // Comparison rate is a ranking aid, not the contractual interest rate
        // used by an amortisation formula.
        const projectionRate = section === 'Mortgage' ? toFraction(row.rate) : v;
        if (projectionRate !== null) bestByProvider.set(row.provider, { row, rate: v, projectionRate });
      }
    }
    const out: Candidate[] = [];
    for (const { row, rate, projectionRate } of bestByProvider.values()) {
      if (isLoan ? projectionRate >= currentRate : projectionRate <= currentRate) continue;
      if (isLoan) {
        const perMonth = monthlyPayment(balance, currentRate, months) - monthlyPayment(balance, projectionRate, months);
        const fixedMonths = row.rate_type === 'FIXED' ? advertisedTermMonths(row) : null;
        const comparisonMonths = fixedRateProjectionMonths(months, fixedMonths);
        out.push({
          row,
          rate,
          projectionRate,
          perMonth,
          total: perMonth * comparisonMonths,
          totalLabel: fixedMonths ? `over ${comparisonMonths} month fixed period` : 'over remaining term',
        });
      } else {
        const perYear = balance * (rate - currentRate);
        const maturityMonths = section === 'TD' ? advertisedTermMonths(row) : null;
        const total = maturityMonths
          ? termDepositInterestDifference(balance, currentRate, projectionRate, maturityMonths)
          : perYear;
        out.push({
          row,
          rate,
          projectionRate,
          perMonth: maturityMonths ? total / maturityMonths : perYear / 12,
          total,
          totalLabel: maturityMonths ? `at ${maturityMonths} month maturity` : 'per year',
        });
      }
    }
    return out.sort((a, b) => b.perMonth - a.perMonth).slice(0, 10);
  }, [rows, currentRate, balance, months, isLoan, section, depositRankMetric, mortgageRateMetric]);

  const changeSection = useCallback((next: SectionKey) => setSection(next), []);
  const auditSelectSection = useCallback((...args: unknown[]) => {
    const requested = auditActionString(args, 'section');
    if (typeof requested === 'string' && requested in SECTIONS) {
      changeSection(requested as SectionKey);
      return;
    }
    const currentIndex = sectionOptions.findIndex((option) => option.value === section);
    const next = sectionOptions[(currentIndex + 1) % Math.max(1, sectionOptions.length)]?.value;
    if (next) changeSection(next);
  }, [changeSection, section, sectionOptions]);
  const openFirstCandidate = useCallback(() => {
    const candidate = candidates[0];
    if (!candidate) return undefined;
    openProduct(candidate.row.product_key, candidate.row.rate_index);
    return { expectedPath: `/product/${encodeURIComponent(candidate.row.product_key)}` };
  }, [candidates]);
  const openProjections = useCallback(async () => {
    const saved = await flushScenario();
    if (!saved) return undefined;
    router.push({ pathname: '/projections', params: { section } } as never);
    return { expectedPath: '/projections' };
  }, [flushScenario, section]);
  const coreRevision = core ? `${core.run_date}:${coreSha}` : null;
  const calculatorRenderRevision = `${coreRevision ?? 'none'}:${section}:${scenarioStorageStatus}:${candidates.length}:${detailsLoading ? 'details-loading' : 'details-settled'}`;
  const calculatorLogoIds = useMemo(
    () => candidates.map((candidate) =>
      `calculator:${candidate.row.product_key}:${candidate.row.rate_index ?? 'none'}`),
    [candidates],
  );
  const calculatorLogos = useLogoReadiness(calculatorRenderRevision, calculatorLogoIds);
  const auditActions = useMemo(() => ({
    'calculator.open': () => undefined,
    'calculator.section.next': auditSelectSection,
    'calculator.candidate.first': openFirstCandidate,
    'calculator.projections.open': openProjections,
  }), [auditSelectSection, openFirstCandidate, openProjections]);
  usePerformanceAuditSurface({
    id: 'calculator.results',
    routeKey: '/calculator',
    datasetRevision: coreRevision,
    renderRevision: calculatorRenderRevision,
    actions: auditActions,
    probes: [
      {
        id: 'calculator.data',
        kind: 'data',
        status: core ? 'ready' : storeStatus === 'error' ? 'error' : 'pending',
        error: !core && storeStatus === 'error' ? storeError ?? 'Core data unavailable' : null,
        datasetRevision: coreRevision,
      },
      {
        id: 'calculator.scenario-storage',
        kind: 'data',
        status: scenarioStorageStatus === 'ready'
          ? 'ready'
          : scenarioStorageStatus === 'error'
            ? 'error'
            : 'pending',
        error: scenarioStorageStatus === 'error' ? scenarioError ?? 'Encrypted scenario unavailable' : null,
      },
      {
        id: 'calculator.details',
        kind: 'data',
        status: !profileFeaturesPending || details?.products
          ? 'ready'
          : detailsTerminalError
            ? 'error'
            : 'pending',
        error: detailsTerminalError
          ? 'Profile-required product details are unavailable'
          : null,
        expectedCount: profileFeaturesPending ? 1 : 0,
        actualCount: profileFeaturesPending && details?.products ? 1 : 0,
      },
      {
        id: 'calculator.suitability',
        kind: 'data',
        status: suitabilityReady ? 'ready' : 'pending',
        datasetRevision: coreRevision,
      },
      {
        id: 'calculator.candidates',
        kind: 'list',
        status: !core || detailsLoading || !suitabilityReady ? 'pending' : 'ready',
        expectedCount: candidates.length,
        actualCount: candidates.length,
      },
      {
        id: 'calculator.logos',
        kind: 'logo',
        status: calculatorLogos.ready ? 'ready' : 'pending',
        expectedCount: calculatorLogos.expectedCount,
        actualCount: calculatorLogos.terminalCount,
      },
      {
        id: 'calculator.layout',
        kind: 'layout',
        status: layoutReady ? 'ready' : 'pending',
        renderRevision: calculatorRenderRevision,
      },
    ],
  });

  if (!core) return null;

  const inputStyle = {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt,
    color: theme.colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  } as const;

  const field = (
    label: string,
    value: string,
    onChangeText: (t: string) => void,
    placeholder: string,
    a11y: string,
    width?: number,
  ) => (
    <View style={width ? { width } : { flex: 1 }}>
      <AppText variant="tiny" color="textFaint" style={{ marginBottom: 4 }}>
        {label}
      </AppText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textFaint}
        keyboardType="numeric"
        editable={scenarioStorageStatus === 'ready'}
        maxLength={20}
        style={inputStyle}
        accessibilityLabel={a11y}
      />
    </View>
  );

  return (
    <ScreenScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
      onContentSizeChange={() => setLayoutReady(true)}
    >
      {sectionOptions.length > 1 ? (
        <View style={{ marginBottom: 12 }}>
          <SegmentedControl options={sectionOptions} value={section} onChange={changeSection} />
        </View>
      ) : null}

      <Card style={{ marginBottom: 16 }}>
        {isMortgage ? (
          <>
            <View style={{ marginBottom: 10 }}>
              <SegmentedControl<CalcInputs['mode']>
                options={[
                  { label: 'Buying', value: 'buy' },
                  { label: 'Refinancing', value: 'refi' },
                ]}
                value={inputs.mode}
                onChange={(mode) => upd({ mode })}
              />
            </View>
            {inputs.mode === 'buy' ? (
              <>
                <Row gap={10}>
                  {field('Property price ($)', inputs.propertyValue, (t) => upd({ propertyValue: t }), '650,000', 'Property price in dollars')}
                  {field('Your savings ($)', inputs.deposit, (t) => upd({ deposit: t }), '130,000', 'Savings available as deposit')}
                </Row>
                <Row gap={10} style={{ marginTop: 10 }}>
                  {field('Upfront costs ($)', inputs.costs, (t) => upd({ costs: t }), 'stamp duty + fees', 'Upfront costs paid from savings')}
                  <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                    <AppText variant="tiny" color="textFaint" style={{ marginBottom: 4 }}>
                      Loan needed
                    </AppText>
                    <AppText variant="body" weight="800" style={{ paddingVertical: 10 }}>
                      {lvrResult.loan != null ? formatDollars(lvrResult.loan) : '—'}
                    </AppText>
                  </View>
                </Row>
              </>
            ) : (
              <Row gap={10}>
                {field('Property value ($)', inputs.propertyValue, (t) => upd({ propertyValue: t }), '800,000', 'Current property value')}
                {field('Current loan ($)', inputs.loanBalance, (t) => upd({ loanBalance: t }), '600,000', 'Current loan balance')}
              </Row>
            )}

            {lvr !== null ? (
              <View style={{ marginTop: 12 }}>
                <Row gap={8} style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                  <AppText variant="small" weight="800">
                    LVR {lvr.toFixed(lvr < 100 ? 1 : 0)}%
                  </AppText>
                  {lvrBand ? (
                    <Badge label={humanizeEnum(lvrBand)} tone="success" />
                  ) : (
                    <AppText variant="tiny" color="textFaint">above tracked LVR bands</AppText>
                  )}
                </Row>
                {lvrBand ? (
                  <AppText variant="tiny" style={{ color: theme.colors.success, marginTop: 4 }}>
                    Applied to this calculation only — your saved browsing profile is unchanged.
                  </AppText>
                ) : null}
                {nextBandHint ? (
                  <AppText variant="tiny" color="textMuted" style={{ marginTop: 4 }}>
                    Add {formatDollars(nextBandHint.extra)} deposit to reach the ≤{nextBandHint.targetPct}% band and
                    unlock lower-LVR rates.
                  </AppText>
                ) : null}
              </View>
            ) : (
              <AppText variant="tiny" color="textFaint" style={{ marginTop: 10 }}>
                {inputs.mode === 'buy'
                  ? 'Enter the property price and your savings to calculate your LVR for this scenario.'
                  : 'Enter the property value and current loan to calculate your LVR.'}
              </AppText>
            )}

            <Row gap={10} style={{ marginTop: 12 }}>
              {field('Current rate (%)', inputs.currentRate, (t) => upd({ currentRate: t }), median !== null ? (median * 100).toFixed(2) : '6.00', 'Current interest rate percent')}
              {field('Years left', inputs.years, (t) => upd({ years: t }), '25', 'Years remaining on loan', 86)}
            </Row>
          </>
        ) : (
          <>
            <AppText variant="small" weight="700" style={{ marginBottom: 10 }}>
              Your current balance
            </AppText>
            <Row gap={10}>
              {field(
                section === 'TD' ? 'Deposit amount ($)' : 'Balance ($)',
                depositInputs.balance,
                (balance) => updateScenario((prev) => ({
                  ...prev,
                  [section === 'TD' ? 'termDeposit' : 'savings']: {
                    ...(section === 'TD' ? prev.termDeposit : prev.savings),
                    balance,
                  },
                })),
                '50,000',
                'Balance in dollars',
              )}
              {field(
                'Current rate (%)',
                depositInputs.currentRate,
                (currentRate) => updateScenario((prev) => ({
                  ...prev,
                  [section === 'TD' ? 'termDeposit' : 'savings']: {
                    ...(section === 'TD' ? prev.termDeposit : prev.savings),
                    currentRate,
                  },
                })),
                median !== null ? (median * 100).toFixed(2) : '4.50',
                'Current interest rate percent',
              )}
            </Row>
          </>
        )}
      </Card>

      <Card style={{ marginBottom: 16, gap: 10 }}>
        <AppText variant="h3">See the full lifecycle</AppText>
        <AppText variant="small" color="textMuted">
          Continue from these inputs into an interactive balance, interest, principal and offset projection through the modelled end date.
        </AppText>
        <Button
          title="Open lifecycle projection"
          icon="analytics-outline"
          onPress={() => void openProjections()}
          disabled={scenarioStorageStatus !== 'ready'}
        />
        {scenarioStorageStatus === 'loading' || scenarioStorageStatus === 'idle' ? (
          <AppText variant="tiny" color="textMuted">Loading encrypted scenario...</AppText>
        ) : null}
        {scenarioSaveStatus === 'saving' || scenarioSaveStatus === 'saved' ? (
          <AppText variant="tiny" color="textMuted">
            {scenarioSaveStatus === 'saving' ? 'Saving encrypted scenario...' : 'Encrypted scenario saved'}
          </AppText>
        ) : null}
        {scenarioError ? (
          <>
            <AppText variant="tiny" color="danger">{scenarioError}</AppText>
            {scenarioStorageStatus === 'error' ? (
              <Button title="Retry encrypted storage" variant="secondary" onPress={() => void retryScenarioLoad()} />
            ) : null}
          </>
        ) : null}
      </Card>

      {isMortgage ? (
        <Card style={{ marginBottom: 16 }}>
          <AppText variant="small" weight="700" style={{ marginBottom: 4 }}>
            Comparison assumptions
          </AppText>
          <AppText variant="tiny" color="textFaint" style={{ marginBottom: 12 }}>
            Tune the eligibility and loan features used to find comparable products. The calculated LVR
            temporarily overrides the LVR filter for this scenario only.
          </AppText>
          <ProfileEditor
            sections={['Mortgage']}
            value={profileFilters}
            onChange={(next) => setPref('profileFilters', next)}
          />
        </Card>
      ) : null}

      <AppText variant="small" weight="700" color="textMuted" style={{ marginBottom: 8 }}>
        {profileFeaturesPending
          ? detailsLoading
            ? 'PREPARING PROFILE FEATURES…'
            : 'COULD NOT LOAD PRODUCT FEATURES'
          : candidates.length
            ? isLoan
              ? 'WHAT SWITCHING COULD SAVE'
              : 'WHAT SWITCHING COULD EARN'
            : currentRate === null
              ? 'ENTER YOUR CURRENT RATE'
              : balance <= 0
                ? 'ENTER YOUR LOAN DETAILS ABOVE'
                : 'NO BETTER COMPARABLE RATES FOUND'}
      </AppText>
      {profileFeaturesPending ? (
        <Card style={{ marginBottom: 16 }}>
          {detailsLoading ? (
            <IndeterminateProgressBar
              caption="Loading product features so profile must-haves can be applied."
              accessibilityLabel="Preparing profile features"
            />
          ) : (
            <View style={{ gap: 12 }}>
              <AppText variant="small" color="textMuted">
                Feature filters need the details payload. Retry once you are online, or clear account
                features in your profile to compare without them.
              </AppText>
              <Button
                title="Retry"
                variant="secondary"
                onPress={() => void ensureDetails({ force: true, abandonInFlight: true })}
              />
            </View>
          )}
        </Card>
      ) : null}
      {!profileFeaturesPending
        ? candidates.map((c) => {
        const access = assessAccess(
          c.row.product_name,
          details?.products?.[c.row.product_key] ?? null,
          c.row.provider,
        );
        const rateChange = summarizeProductBestRate(
          productHistory,
          c.row.product_key,
          {
            date: core?.run_date,
            rate: bestRateForProduct(core, c.row.product_key),
          },
        );
        const rateChangeLabel = productRateChangeText(rateChange, true);
        const rateDescriptor = section === 'Mortgage'
          ? `${formatRate(c.projectionRate)} advertised${c.rate !== c.projectionRate ? ` · ${formatRate(c.rate)} comparison` : ''}`
          : `${formatRate(c.projectionRate)} ${depositRankMetric === 'base' ? 'ongoing/base' : 'headline'}`;
        return (
          <Pressable
            key={c.row.provider}
            onPress={c === candidates[0]
              ? openFirstCandidate
              : () => openProduct(c.row.product_key, c.row.rate_index)}
            accessibilityRole="button"
            accessibilityLabel={`View ${c.row.provider} ${c.row.product_name}, ${rateDescriptor}${
              rateChangeLabel ? `, ${rateChangeLabel}` : ''
            }`}
          >
            <Card style={{ marginBottom: 10 }}>
              <Row gap={12} style={{ alignItems: 'center' }}>
                <BankAvatar
                  provider={c.row.provider}
                  size={36}
                  renderStateId={`calculator:${c.row.product_key}:${c.row.rate_index ?? 'none'}`}
                  onRenderStateChange={calculatorLogos.onLogoRenderStateChange}
                />
                <View style={{ flex: 1 }}>
                  <AppText variant="body" weight="700" numberOfLines={1}>
                    {c.row.provider}
                  </AppText>
                   <AppText variant="tiny" color="textMuted" numberOfLines={1}>
                     {c.row.product_name} · {rateDescriptor}
                   </AppText>
                   <ProductRateChangeSummaryLine
                     summary={rateChange}
                     section={section}
                     compact
                   />
                  {access.badge ? (
                    <AppText variant="tiny" weight="700" style={{ color: theme.colors.warning, marginTop: 2 }}>
                      {access.verify ? `${access.badge}?` : access.badge}
                    </AppText>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <AppText variant="body" weight="800" style={{ color: theme.colors.success }}>
                    {formatDollars(c.perMonth)}/mo
                  </AppText>
                  <AppText variant="tiny" color="textFaint">
                    {formatDollars(c.total)} {c.totalLabel}
                  </AppText>
                </View>
                <AppText variant="body" color="textFaint" style={{ marginLeft: 2 }}>
                  ›
                </AppText>
              </Row>
            </Card>
          </Pressable>
        );
      })
        : null}

      <AppText variant="tiny" color="textFaint" style={{ marginTop: 8, lineHeight: 16 }}>
        Illustrative estimates use observed advertised CDR rates and exclude fees, tax, switching costs,
        compounding differences, and unverified bonus conditions. {isMortgage
          ? 'LVR is loan ÷ property value. Repayments assume principal and interest; fixed-rate savings stop at the published fixed period because the later rate is unknown.'
          : section === 'TD'
            ? 'Term-deposit differences are projected only to each product’s published maturity; confirm interest-payment timing and early-withdrawal terms.'
            : 'Savings comparisons use your selected base or headline ranking metric; confirm ongoing and bonus conditions before acting.'}
      </AppText>
    </ScreenScrollView>
  );
}
