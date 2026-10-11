import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { HierarchyView } from '../src/components/HierarchyView';
import { Screen, screenEdgeStyle } from '../src/components/Screen';
import { SegmentedControl } from '../src/components/controls';
import { Button, Row } from '../src/components/ui';
import { sectionFromSlug } from '../src/constants';
import { resolveInterestSection, sectionSegmentOptions } from '../src/data/interests';
import { profileSectionCount } from '../src/data/profile';
import { useStore } from '../src/data/store';
import { checkDrillOutcome, logNavParamDrop } from '../src/lib/degradationLog';
import { openBrowse, openSearch, parseBrowsePath, scalarRouteParam } from '../src/lib/nav';
import { useTheme } from '../src/theme/ThemeProvider';
import { ScreenSkeleton } from '../src/components/feedback';

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
  const defaultSection = useStore((s) => s.prefs.defaultSection);
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
  // Explore owns its category. Changing a market or Today category must not
  // silently move this screen to another product type.
  const [section, setSection] = useState(() => resolveInterestSection(interests, defaultSection));
  const renderedSection = pendingRouteRequest && requestedSection ? requestedSection : section;
  const sectionOptions = useMemo(() => sectionSegmentOptions(interests), [interests]);
  const profileFilters = useStore((s) => s.prefs.profileFilters);
  const profileCount = profileSectionCount(profileFilters, renderedSection);

  useEffect(() => {
    if (!pendingRouteRequest) return;
    const slug = routeSectionSlug;
    if (slug && !sectionFromSlug(slug)) {
      logNavParamDrop({ screen: 'browse', param: 'section', actual: slug });
    }
    consumedRouteRequest.current = routeRequest;
    if (requestedSection) setSection(requestedSection);
  }, [pendingRouteRequest, requestedSection, routeRequest, routeSectionSlug]);

  useEffect(() => {
    setSection((current) => resolveInterestSection(interests, current));
  }, [interests]);

  useFocusEffect(useCallback(() => {
    setActiveSection(renderedSection);
  }, [renderedSection, setActiveSection]));

  const changeSection = useCallback((next: typeof section) => {
    setSection(next);
    openBrowse(next);
  }, []);

  useEffect(() => {
    checkDrillOutcome(renderedSection, drillPath);
  }, [renderedSection, drillPath]);

  if (!core) return <ScreenSkeleton />;

  return (
    <Screen>
      <View style={screenEdgeStyle(theme)}>
        <View style={{ gap: theme.spacing(3) }}>
          <View>
            {sectionOptions.length > 1 ? (
              <SegmentedControl options={sectionOptions} value={renderedSection} onChange={changeSection} />
            ) : null}
          </View>
          <Row gap={theme.spacing(2)} style={{ flexWrap: 'wrap' }}>
            <Button
              title="Search these products"
              icon="search"
              style={{ flexGrow: 1, flexBasis: 140 }}
              onPress={() => openSearch(renderedSection)}
            />
            <Button title={profileCount ? `Match settings · ${profileCount}` : 'Match settings'} variant="ghost" onPress={() => router.push('/profile')} />
          </Row>
        </View>
      </View>
      <View style={{ flex: 1 }}>
        {/* Key on the drill path only — switching SECTION updates HierarchyView in
            place (FlashList recycles, no teardown/blank), so section changes are
            instant. Drilling still remounts to reset list/scroll cleanly. */}
        <HierarchyView key={drillPath.join('.') || 'root'} section={renderedSection} path={drillPath} />
      </View>
    </Screen>
  );
}
