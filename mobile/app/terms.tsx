import { uiLabel } from "../src/lib/uiCopy";
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView } from 'react-native';

import { ScreenScrollView } from '../src/components/Screen';
import { AppText } from '../src/components/ui';
import { usePerformanceAuditSurface } from '../src/hooks/usePerformanceAuditReadiness';
import { DocumentText } from '../src/components/DocumentText';

export default function TermsScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const [contentReady, setContentReady] = useState(false);
  const scrollToEnd = useCallback(() => {
    scrollRef.current?.scrollToEnd({ animated: false });
  }, []);
  const auditActions = useMemo(() => ({
    'terms.open': () => undefined,
    'terms.scroll.end': scrollToEnd,
  }), [scrollToEnd]);
  usePerformanceAuditSurface({
    id: 'terms.notices',
    routeKey: '/terms',
    renderRevision: 'terms-v2',
    actions: auditActions,
    probes: [
      {
        id: 'terms.local-content',
        kind: 'data',
        status: 'ready',
        expectedCount: 1,
        actualCount: 1,
      },
      {
        id: 'terms.layout',
        kind: 'layout',
        status: contentReady ? 'ready' : 'pending',
        layoutMeasured: contentReady,
      },
    ],
  });

  return (
    <ScreenScrollView
      ref={scrollRef}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      onContentSizeChange={() => setContentReady(true)}
    >
      <DocumentText document="general" />

      <AppText variant="h3" style={{ marginTop: 24, marginBottom: 8 }}>{uiLabel("Data sources")}</AppText>
      <DocumentText document="data-sources" />
      <DocumentText document="affiliation" />

      <AppText variant="h3" style={{ marginTop: 24, marginBottom: 8 }}>{uiLabel("Lender artwork")}</AppText>
      <DocumentText document="artwork" />

      <AppText variant="h3" style={{ marginTop: 24, marginBottom: 8 }}>{uiLabel("Optional diagnostics")}</AppText>
      <DocumentText document="diagnostics" />


    </ScreenScrollView>
  );
}
