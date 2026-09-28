import { useIsFocused } from '@react-navigation/native';
import React, { useMemo, useState } from 'react';

import { BankRatesPanel, type BankRatesAuditState } from '../src/components/passthrough/BankRatesPanel';
import { ScreenScrollView } from '../src/components/Screen';
import { normalizeInterests, resolveInterestSection } from '../src/data/interests';
import { useStore } from '../src/data/store';
import { usePerformanceAuditSurface } from '../src/hooks/usePerformanceAuditReadiness';

export default function BankRates() {
  const focused = useIsFocused();
  const interests = useStore(s => s.prefs.interests);
  const activeSection = useStore(s => s.activeSection);
  const core = useStore(s => s.core);
  const coreSha = useStore(s => s.manifest?.files.core.sha256);
  const [chosenSection, setChosenSection] = useState(activeSection);
  const section = resolveInterestSection(interests, chosenSection);
  const [laidOut, setLaidOut] = useState(false);
  const [chart, setChart] = useState<BankRatesAuditState | null>(null);
  const actions = useMemo(() => ({
    'bank-rates.open': () => undefined,
    'bank-rates.section.next': () => {
      const options = normalizeInterests(interests);
      if (options.length < 2) return { unavailableReason: 'Only one product type is enabled in interests' };
      setChosenSection(options[(options.indexOf(section) + 1) % options.length]);
    },
  }), [interests, section]);
  const probes = useMemo(() => [
    { id: 'bank-rates.model', kind: 'data' as const, status: chart?.status ?? 'pending' as const, error: chart?.error },
    { id: 'bank-rates.layout', kind: 'layout' as const, status: focused && laidOut ? 'ready' as const : 'pending' as const, layoutMeasured: focused && laidOut },
    { id: 'bank-rates.chart', kind: 'graphic' as const,
      status: chart?.status ?? 'pending' as const, error: chart?.error,
      expectedCount: chart?.modelPointCount ?? 0, actualCount: chart?.renderedPointCount ?? 0,
      emptyStateRendered: chart?.emptyStateRendered ?? false,
      accessibleSummary: chart?.accessibleSummary ?? false, renderRevision: chart?.revision },
  ], [chart, focused, laidOut]);
  usePerformanceAuditSurface({ id: 'bank-rates.dashboard', routeKey: '/bank-rates',
    datasetRevision: coreSha ?? core?.run_date ?? null,
    renderRevision: chart?.revision ?? `${section}:pending`, actions, probes });
  return (
    <ScreenScrollView onLayout={() => setLaidOut(true)}>
      <BankRatesPanel section={section} onSectionChange={setChosenSection} onAuditStateChange={setChart} />
    </ScreenScrollView>
  );
}
