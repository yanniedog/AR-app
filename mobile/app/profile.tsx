import { uiCount,uiJoin,uiLabel } from "../src/lib/uiCopy";
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { ProfileEditor } from '../src/components/ProfileEditor';
import { CustomerProfilePanel } from '../src/components/CustomerProfilePanel';
import { ScreenScrollView } from '../src/components/Screen';
import { AppText, Button, Card } from '../src/components/ui';
import { SECTION_ORDER } from '../src/constants';
import {
  EMPTY_PROFILE,
  PROFILE_FEATURE_OPTIONS,
  profileSelectionCount,
  type ProfileFilters,
} from '../src/data/profile';
import { useStore } from '../src/data/store';
import { useNavigationContentReady } from '../src/hooks/useNavigationContentReady';
import { usePerformanceAuditSurface } from '../src/hooks/usePerformanceAuditReadiness';
import { useTheme } from '../src/theme/ThemeProvider';

export default function Profile() {
  const theme = useTheme();
  const interests = useStore((s) => s.prefs.interests);
  const profileFilters = useStore((s) => s.prefs.profileFilters);
  const hydrated = useStore((s) => s.hydrated);
  const setPref = useStore((s) => s.setPref);
  const count = profileSelectionCount(profileFilters);
  const [layoutReady, setLayoutReady] = useState(false);
  const contentReady = useNavigationContentReady(true);
  const auditSnapshot = useRef<ProfileFilters | null>(null);
  const firstFeature = interests
    .flatMap((section) => PROFILE_FEATURE_OPTIONS[section] ?? [])
    .at(0) ?? null;
  const updateProfile = useCallback(
    (next: ProfileFilters) => setPref('profileFilters', next),
    [setPref],
  );
  const toggleFirstProfileFilter = useCallback(() => {
    if (!firstFeature) return;
    auditSnapshot.current ??= JSON.parse(JSON.stringify(profileFilters)) as ProfileFilters;
    const selected = profileFilters.accountFeatures.includes(firstFeature);
    updateProfile({
      ...profileFilters,
      accountFeatures: selected
        ? profileFilters.accountFeatures.filter((value) => value !== firstFeature)
        : [...profileFilters.accountFeatures, firstFeature],
    });
  }, [firstFeature, profileFilters, updateProfile]);
  const restoreProfile = useCallback(() => {
    if (!auditSnapshot.current) return;
    updateProfile(auditSnapshot.current);
    auditSnapshot.current = null;
  }, [updateProfile]);
  const auditActions = useMemo(() => ({
    'profile.open': () => undefined,
    'profile.filter.first.toggle': toggleFirstProfileFilter,
    'profile.filter.restore': restoreProfile,
  }), [restoreProfile, toggleFirstProfileFilter]);
  usePerformanceAuditSurface({
    id: 'profile.filters',
    routeKey: '/profile',
    renderRevision: `${hydrated ? 'hydrated' : 'loading'}:${interests.join(',')}:${count}`,
    actions: auditActions,
    probes: [
      {
        id: 'profile.local-state',
        kind: 'data',
        status: hydrated ? 'ready' : 'pending',
        expectedCount: 1,
        actualCount: hydrated ? 1 : 0,
      },
      {
        id: 'profile.options',
        kind: 'list',
        status: 'ready',
        expectedCount: firstFeature ? 1 : 0,
        actualCount: firstFeature ? 1 : 0,
      },
      {
        id: 'profile.layout',
        kind: 'layout',
        status: layoutReady ? 'ready' : 'pending',
        layoutMeasured: layoutReady,
      },
    ],
  });

  return (
    <ScreenScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      onLayout={() => setLayoutReady(true)}
    >
      <Card>
        <AppText variant="h2">{uiLabel('Saved requirements')}</AppText>
        <AppText variant="small" color="textMuted">{uiJoin('Scope', ' · ', 'All screens')}</AppText>
        {contentReady ? (
          <ProfileEditor
            sections={SECTION_ORDER}
            value={profileFilters}
            onChange={updateProfile}
          />
        ) : (
          <AppText variant="small">{uiLabel('Loading')}</AppText>
        )}
      </Card>
      {count > 0 ? (
        <View style={{ marginTop: theme.spacing(4) }}>
          <Button
            title={uiJoin('Clear all saved requirements',' (',uiCount(count),')')}
            variant="ghost"
            onPress={() => setPref('profileFilters', { ...EMPTY_PROFILE })}
          />
        </View>
      ) : null}
      {contentReady ? <CustomerProfilePanel /> : null}
    </ScreenScrollView>
  );
}
