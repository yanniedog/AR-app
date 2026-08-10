import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';

import { HierarchyView } from '../../src/components/HierarchyView';
import { Screen, screenEdgeStyle } from '../../src/components/Screen';
import { SegmentedControl } from '../../src/components/controls';
import { Button, Chip, Row } from '../../src/components/ui';
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
        <View style={{ gap: theme.spacing(3) }}>
          <View>
            {sectionOptions.length > 1 ? (
              <SegmentedControl options={sectionOptions} value={section} onChange={changeSection} />
            ) : null}
          </View>
          <Row gap={theme.spacing(2)}>
            <Button
              title="Search products"
              icon="search"
              style={{ flex: 1 }}
              onPress={() => openSearch(section)}
            />
            <Button
              title={profileCount ? `Profile · ${profileCount}` : 'My profile'}
              icon="person-circle-outline"
              variant="secondary"
              onPress={() => router.push('/profile')}
            />
          </Row>
          <Row gap={theme.spacing(2)} style={{ flexWrap: 'wrap' }}>
            <Chip label="Browse lenders" icon="business-outline" onPress={() => router.push('/banks')} />
            {section === 'Mortgage' ? (
              <Chip label="Calculator" icon="calculator-outline" onPress={() => router.push('/calculator')} />
            ) : null}
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
