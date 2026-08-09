import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { HierarchyView } from '../../src/components/HierarchyView';
import { Screen, screenEdgeStyle } from '../../src/components/Screen';
import { ToolbarIconButton } from '../../src/components/ToolbarIconButton';
import { SegmentedControl } from '../../src/components/controls';
import { Row } from '../../src/components/ui';
import { sectionFromSlug } from '../../src/constants';
import { resolveInterestSection, sectionSegmentOptions } from '../../src/data/interests';
import { profileSectionCount } from '../../src/data/profile';
import { useStore } from '../../src/data/store';
import { checkDrillOutcome, logNavParamDrop } from '../../src/lib/degradationLog';
import { openBrowse, openSearch, parseBrowsePath, scalarRouteParam } from '../../src/lib/nav';
import { useTheme } from '../../src/theme/ThemeProvider';
import { ScreenSkeleton } from '../../src/components/feedback';

export default function Browse() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const compactToolbar = width < 480;
  const core = useStore((s) => s.core);
  const params = useLocalSearchParams<{
    section?: string | string[];
    path?: string | string[];
    request?: string | string[];
  }>();
  const drillPath = useMemo(() => parseBrowsePath(params.path), [params.path]);
  const interests = useStore((s) => s.prefs.interests);
  const storedSection = useStore((s) => s.activeSection);
  const setActiveSection = useStore((s) => s.setActiveSection);
  const routeSectionSlug = scalarRouteParam(params.section);
  const routeRequest = scalarRouteParam(params.request) ??
    (routeSectionSlug ? `section:${routeSectionSlug}` : null);
  const consumedRouteRequest = useRef<string | null>(null);
  const requestedSection = useMemo(() => {
    const slug = routeSectionSlug;
    const parsed = slug ? sectionFromSlug(slug) : undefined;
    return parsed ? resolveInterestSection(interests, parsed) : null;
  }, [interests, routeSectionSlug]);
  const pendingRouteRequest = routeRequest != null && consumedRouteRequest.current !== routeRequest;
  // Route params are the immediate navigation contract. Rendering them directly
  // avoids changing the still-visible source tab before Browse has mounted.
  const section = pendingRouteRequest && requestedSection
    ? requestedSection
    : resolveInterestSection(interests, storedSection);
  const sectionOptions = useMemo(() => sectionSegmentOptions(interests), [interests]);
  const profileFilters = useStore((s) => s.prefs.profileFilters);
  const profileCount = profileSectionCount(profileFilters, section);

  useEffect(() => {
    if (!pendingRouteRequest) return;
    const slug = routeSectionSlug;
    if (slug && !sectionFromSlug(slug)) {
      logNavParamDrop({ screen: 'browse', param: 'section', actual: slug });
    }
    consumedRouteRequest.current = routeRequest;
    if (requestedSection && storedSection !== requestedSection) {
      setActiveSection(requestedSection);
    }
  }, [pendingRouteRequest, requestedSection, routeRequest, routeSectionSlug, setActiveSection, storedSection]);

  const changeSection = useCallback((next: typeof section) => {
    setActiveSection(next);
    openBrowse(next);
  }, [setActiveSection]);

  useEffect(() => {
    checkDrillOutcome(section, drillPath);
  }, [section, drillPath]);

  if (!core) return <ScreenSkeleton />;

  return (
    <Screen>
      <View style={screenEdgeStyle(theme)}>
        <View
          style={{
            flexDirection: compactToolbar ? 'column' : 'row',
            gap: theme.spacing(3),
          }}
        >
          <View style={{ flex: compactToolbar ? undefined : 1, width: compactToolbar ? '100%' : undefined }}>
            {sectionOptions.length > 1 ? (
              <SegmentedControl options={sectionOptions} value={section} onChange={changeSection} />
            ) : null}
          </View>
          <Row
            gap={theme.spacing(3)}
            style={compactToolbar ? { justifyContent: 'space-between' } : undefined}
          >
            <ToolbarIconButton
              icon="person-circle-outline"
              badge={profileCount || undefined}
              onPress={() => router.push('/profile')}
              accessibilityLabel="Your product profile"
              accessibilityHint="Set default filters applied across the app"
            />
            <ToolbarIconButton
              icon="business-outline"
              onPress={() => router.push('/banks')}
              accessibilityLabel="Browse lenders"
              accessibilityHint="Opens searchable lender directory"
            />
            {section === 'Mortgage' ? (
              <ToolbarIconButton
                icon="calculator-outline"
                onPress={() => router.push('/calculator')}
                accessibilityLabel="Mortgage calculator"
                accessibilityHint="Opens repayment calculator"
              />
            ) : null}
            <ToolbarIconButton icon="search" onPress={() => openSearch(section)} accessibilityLabel="Search products" />
          </Row>
        </View>
      </View>
      <View style={{ flex: 1 }}>
        {/* Key on the drill path only — switching SECTION updates HierarchyView in
            place (FlashList recycles, no teardown/blank), so section changes are
            instant. Drilling still remounts to reset list/scroll cleanly. */}
        <HierarchyView key={drillPath.join('.') || 'root'} section={section} path={drillPath} />
      </View>
    </Screen>
  );
}
