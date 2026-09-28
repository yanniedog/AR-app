import { router, useGlobalSearchParams, usePathname } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isMandatoryEligibilityReady, mandatoryProductAllowed } from '../data/eligibilityGate';
import { detailsDisplayIdentity, verifiedCatalogueDetails } from '../data/detailsCatalogue';
import { resolveInterestSection } from '../data/interests';
import { findEligibleByKey } from '../data/selectors';
import { useStore } from '../data/store';
import { useSuitabilityRevision } from '../hooks/useSuitabilityRevision';
import { destinationSectionFromParam } from '../lib/appDestinations';
import { buildBrowseRouteParams } from '../lib/browseRoute';
import { buildBreadcrumbs, shouldShowBreadcrumbs, type BreadcrumbTarget } from '../lib/breadcrumbs';
import { compactBreadcrumbs, shortBreadcrumbLabel } from '../lib/compactBreadcrumbs';
import { parseBrowsePath, scalarRouteParam } from '../lib/nav';
import { useTheme } from '../theme/ThemeProvider';
import { useAppUpdateBannerVisible } from './AppUpdateBanner';
import { LedgerIcon } from './icons/LedgerIcon';
import { AppText } from './ui';

export function AppBreadcrumbBar() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height: screenHeight, fontScale } = useWindowDimensions();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{
    section?: string | string[]; path?: string | string[];
    provider?: string | string[]; key?: string | string[]; ri?: string | string[];
  }>();
  const onboarded = useStore((state) => state.prefs.onboarded);
  const interests = useStore((state) => state.prefs.interests);
  const activeSection = useStore((state) => state.activeSection);
  const core = useStore((state) => state.core);
  const coreIntegrity = useStore((state) => state.coreIntegrity);
  const manifest = useStore((state) => state.manifest);
  const details = useStore((state) => state.details);
  const suitabilityRevision = useSuitabilityRevision();
  const updateBannerVisible = useAppUpdateBannerVisible();
  const [openTrail, setOpenTrail] = useState<string | null>(null);
  const key = scalarRouteParam(params.key);
  const rateIndex = scalarRouteParam(params.ri);
  const { product, catalogueProductName } = useMemo(() => {
    // Eligibility changes must invalidate labels even when core data is unchanged.
    void suitabilityRevision;
    const unavailable = { product: null, catalogueProductName: null };
    if (!key || !core || !isMandatoryEligibilityReady() || !mandatoryProductAllowed(key)) return unavailable;
    const found = findEligibleByKey(core.sections, key);
    const exactRateRequested = rateIndex != null && rateIndex !== '';
    if (!found) {
      if (exactRateRequested) return unavailable;
      const catalogue = verifiedCatalogueDetails(core, coreIntegrity, manifest, details);
      const detail = catalogue && Object.hasOwn(catalogue.products, key) ? catalogue.products[key] : null;
      return { product: null, catalogueProductName: detail ? detailsDisplayIdentity(detail).name ?? 'Product' : null };
    }
    if (!exactRateRequested) return { product: found, catalogueProductName: null };
    const parsedIndex = Number(rateIndex);
    const row = Number.isInteger(parsedIndex)
      ? found.siblings.find((candidate) => candidate.rate_index === parsedIndex)
      : null;
    return row ? { product: { section: found.section, row }, catalogueProductName: null } : unavailable;
  }, [key, core, coreIntegrity, manifest, details, rateIndex, suitabilityRevision]);
  const requestedSection = destinationSectionFromParam(params.section);
  const scenarioRoute = pathname === '/calculator' || pathname === '/projections';
  const section = scenarioRoute
    ? requestedSection ?? (pathname === '/projections' ? 'Mortgage' : activeSection)
    : resolveInterestSection(interests, requestedSection ?? activeSection);
  const crumbs = buildBreadcrumbs({
    pathname, section, path: parseBrowsePath(params.path),
    provider: scalarRouteParam(params.provider), product, catalogueProductName, rateIndex,
  });
  const trailKey = JSON.stringify({ pathname, params, crumbs });
  const { hidden, visible } = compactBreadcrumbs(crumbs, width - insets.left - insets.right, fontScale);
  // A changed route or eligibility result dismisses the menu before stale labels can render.
  if (openTrail !== null && (openTrail !== trailKey || hidden.length === 0)) setOpenTrail(null);
  const menuOpen = openTrail === trailKey && hidden.length > 0;
  const closeMenu = () => setOpenTrail(null);

  if (!shouldShowBreadcrumbs(pathname, onboarded)) return null;

  const navigate = (target: BreadcrumbTarget) => {
    closeMenu();
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
        {hidden.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show parent sections"
            accessibilityState={{ expanded: menuOpen }}
            onPress={() => setOpenTrail(trailKey)}
            style={({ pressed }) => ({ width: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
          >
            <AppText variant="small" style={{ color: theme.ledger.mutedInk }}>…</AppText>
          </Pressable>
        ) : null}
        <View testID="breadcrumb-visible-path" style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, overflow: 'hidden', paddingRight: 8 }}>
          {visible.map((crumb, index) => (
            <View key={index} style={{ flexDirection: 'row', alignItems: 'center', height: '100%', flexShrink: 1, minWidth: 0 }}>
              <View accessible={false} importantForAccessibility="no-hide-descendants">
                <LedgerIcon name="chevron-right" size={12} color={theme.ledger.mutedInk} />
              </View>
              <Pressable
                accessibilityRole={crumb.target ? 'button' : 'text'}
                accessibilityLabel={crumb.target ? `Go to ${crumb.label}` : `${crumb.label}, current location`}
                accessibilityState={{ selected: !crumb.target }}
                disabled={!crumb.target}
                onPress={() => { if (crumb.target) navigate(crumb.target); }}
                style={({ pressed }) => ({ height: '100%', minWidth: 0, flexShrink: 1, justifyContent: 'center', paddingHorizontal: 8, opacity: pressed ? 0.6 : 1 })}
              >
                <AppText variant="small" numberOfLines={1} ellipsizeMode="tail" style={{ color: crumb.target ? theme.ledger.mutedInk : theme.ledger.ink }}>
                  {shortBreadcrumbLabel(crumb.label, crumb.target ? 12 : 18)}
                </AppText>
              </Pressable>
            </View>
          ))}
        </View>
      </View>
      <Modal visible={menuOpen} transparent animationType="none" onRequestClose={closeMenu} statusBarTranslucent>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: Math.max(insets.top, 8), paddingHorizontal: Math.max(insets.left, insets.right, 8), paddingBottom: Math.max(insets.bottom, 8) }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss parent sections"
            onPress={closeMenu}
            style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.32)' }]}
          />
          <View
            accessibilityViewIsModal
            style={{ maxHeight: screenHeight * 0.65, width: 360, maxWidth: '100%', borderRadius: theme.radius.sm, backgroundColor: theme.ledger.raised, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.ledger.rule }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16 }}>
              <AppText variant="small" style={{ flexShrink: 1 }}>Jump to</AppText>
              <Pressable accessibilityRole="button" accessibilityLabel="Close parent sections" onPress={closeMenu} style={{ minHeight: 44, width: 44, alignItems: 'center', justifyContent: 'center' }}>
                <LedgerIcon name="close" size={20} color={theme.ledger.ink} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 8 }}>
              {hidden.map((crumb, index) => (
                <Pressable
                  key={index}
                  accessibilityRole={crumb.target ? 'button' : 'text'}
                  accessibilityLabel={crumb.target ? `Go to ${crumb.label}` : crumb.label}
                  disabled={!crumb.target}
                  onPress={() => { if (crumb.target) navigate(crumb.target); }}
                  style={({ pressed }) => ({ minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
                >
                  <AppText variant="small">{crumb.label}</AppText>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
