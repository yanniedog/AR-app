import { router, useGlobalSearchParams, usePathname } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isMandatoryEligibilityReady, mandatoryProductAllowed } from '../data/eligibilityGate';
import { resolveInterestSection } from '../data/interests';
import { findEligibleByKey } from '../data/selectors';
import { useStore } from '../data/store';
import { useSuitabilityRevision } from '../hooks/useSuitabilityRevision';
import { destinationSectionFromParam } from '../lib/appDestinations';
import { buildBrowseRouteParams } from '../lib/browseRoute';
import { buildBreadcrumbs, shouldShowBreadcrumbs, type BreadcrumbTarget } from '../lib/breadcrumbs';
import { parseBrowsePath, scalarRouteParam } from '../lib/nav';
import { useTheme } from '../theme/ThemeProvider';
import { useAppUpdateBannerVisible } from './AppUpdateBanner';
import { LedgerIcon } from './icons/LedgerIcon';
import { AppText } from './ui';

export function AppBreadcrumbBar() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{
    section?: string | string[]; path?: string | string[];
    provider?: string | string[]; key?: string | string[]; ri?: string | string[];
  }>();
  const onboarded = useStore((state) => state.prefs.onboarded);
  const interests = useStore((state) => state.prefs.interests);
  const activeSection = useStore((state) => state.activeSection);
  const core = useStore((state) => state.core);
  const suitabilityRevision = useSuitabilityRevision();
  const updateBannerVisible = useAppUpdateBannerVisible();
  const scroll = useRef<ScrollView>(null);
  const key = scalarRouteParam(params.key);
  const rateIndex = scalarRouteParam(params.ri);
  const product = useMemo(() => {
    // Eligibility changes must invalidate labels even when core data is unchanged.
    void suitabilityRevision;
    if (!key || !core || !isMandatoryEligibilityReady() || !mandatoryProductAllowed(key)) return null;
    const found = findEligibleByKey(core.sections, key);
    if (!found || rateIndex == null) return found;
    const row = found.siblings.find((candidate) => String(candidate.rate_index) === rateIndex);
    return row ? { section: found.section, row } : null;
  }, [key, core, rateIndex, suitabilityRevision]);
  const section = resolveInterestSection(interests, destinationSectionFromParam(params.section) ?? activeSection);
  const crumbs = buildBreadcrumbs({
    pathname, section, path: parseBrowsePath(params.path),
    provider: scalarRouteParam(params.provider), product, rateIndex,
  });
  const trailKey = JSON.stringify(crumbs);
  const revealCurrent = useCallback(() => scroll.current?.scrollToEnd({ animated: false }), []);
  useEffect(() => {
    const frame = requestAnimationFrame(revealCurrent);
    return () => cancelAnimationFrame(frame);
  }, [trailKey, revealCurrent]);

  if (!shouldShowBreadcrumbs(pathname, onboarded)) return null;

  const navigate = (target: BreadcrumbTarget) => {
    if ('href' in target) router.navigate(target.href);
    else router.navigate({
      pathname: '/(tabs)/browse',
      params: { ...buildBrowseRouteParams(target.section, target.path), path: target.path.join('.') },
    });
  };
  const height = Math.max(Platform.OS === 'web' ? 36 : 44, Math.ceil(20 * fontScale + 12));
  return (
    <View
      testID="app-breadcrumb-bar"
      style={{
        paddingTop: updateBannerVisible ? 0 : insets.top,
        paddingLeft: insets.left, paddingRight: insets.right,
        backgroundColor: theme.ledger.raised,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.ledger.rule,
      }}
    >
      <View style={{ flexDirection: 'row', height }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Home"
          onPress={() => router.navigate('/(tabs)')}
          style={({ pressed }) => ({ width: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
        >
          <LedgerIcon name="home" size={18} color={theme.ledger.mutedInk} />
        </Pressable>
        <ScrollView
          ref={scroll}
          horizontal
          showsHorizontalScrollIndicator={false}
          onContentSizeChange={revealCurrent}
          onLayout={revealCurrent}
          style={{ flex: 1 }}
          contentContainerStyle={{ alignItems: 'center', paddingRight: 12 }}
        >
          {crumbs.map((crumb, index) => (
            <View key={index} style={{ flexDirection: 'row', alignItems: 'center', height: '100%' }}>
              <View accessible={false} importantForAccessibility="no-hide-descendants">
                <LedgerIcon name="chevron-right" size={12} color={theme.ledger.mutedInk} />
              </View>
              <Pressable
                accessibilityRole={crumb.target ? 'button' : 'text'}
                accessibilityLabel={crumb.target ? `Go to ${crumb.label}` : `${crumb.label}, current location`}
                accessibilityState={{ selected: !crumb.target }}
                disabled={!crumb.target}
                onPress={() => { if (crumb.target) navigate(crumb.target); }}
                style={({ pressed }) => ({ height: '100%', justifyContent: 'center', paddingHorizontal: 10, opacity: pressed ? 0.6 : 1 })}
              >
                <AppText variant="small" numberOfLines={1} style={{ color: crumb.target ? theme.ledger.mutedInk : theme.ledger.ink }}>
                  {crumb.label}
                </AppText>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}
