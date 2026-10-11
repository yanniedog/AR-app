import { useIsFocused, useScrollToTop } from '@react-navigation/native';
import React, { useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { usePerformanceAuditSurface } from '../hooks/usePerformanceAuditReadiness';
import type { PerformanceAuditSemanticAction } from '../lib/performanceAuditReadiness';
import { useTheme } from '../theme/ThemeProvider';
import { LedgerIcon, type LedgerIconName } from './icons/LedgerIcon';
import { LedgerRow, LedgerText } from './ledger';
import { ScreenScrollView } from './Screen';

/** Lightweight destination roots render before any optional rate/history models. */
export function NavigationHub({ title, description, surface, route, actions, children }: {
  title: string;
  description: string;
  surface: string;
  route: string;
  actions: Record<string, PerformanceAuditSemanticAction>;
  children: React.ReactNode;
}) {
  const focused = useIsFocused();
  const [laidOut, setLaidOut] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const probes = useMemo(() => [
    { id: `${surface}.model`, kind: 'data' as const, status: 'ready' as const },
    { id: `${surface}.layout`, kind: 'layout' as const,
      status: focused && laidOut ? 'ready' as const : 'pending' as const,
      layoutMeasured: focused && laidOut },
  ], [focused, laidOut, surface]);
  usePerformanceAuditSurface({ id: surface, routeKey: route, renderRevision: surface, actions, probes });
  return (
    <ScreenScrollView ref={scrollRef} showDataHealthBanner={false}>
      <View onLayout={() => setLaidOut(true)} style={{ gap: 6 }}>
        <LedgerText variant="title" accessibilityRole="header">{title}</LedgerText>
        <LedgerText tone="mutedInk">{description}</LedgerText>
      </View>
      {children}
    </ScreenScrollView>
  );
}

export function DestinationRow({ title, description, icon, onPress }: {
  title: string;
  description: string;
  icon: LedgerIconName;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <LedgerRow
      title={title}
      detail={description}
      accessibilityHint={description}
      onPress={onPress}
      leading={<LedgerIcon name={icon} size={24} color={theme.ledger.eucalyptus} />}
      style={{ minHeight: 80, paddingVertical: 16 }}
    />
  );
}
