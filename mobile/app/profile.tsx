import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { ProfileEditor } from '../src/components/ProfileEditor';
import { ScreenScrollView } from '../src/components/Screen';
import { AppText, Button, Card } from '../src/components/ui';
import {
  EMPTY_PROFILE,
  PROFILE_FEATURE_OPTIONS,
  profileSelectionCount,
  type ProfileFilters,
} from '../src/data/profile';
import { useStore } from '../src/data/store';
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
      },
    ],
  });

  return (
    <ScreenScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      onLayout={() => setLayoutReady(true)}
    >
      <AppText variant="body" color="textMuted" style={{ marginBottom: 16, lineHeight: 22 }}>
        Pick the product attributes that match your situation — owner-occupied, P&I, your LVR —
        and must-have features like an offset account or early repayment. They apply as default
        search filters across the app, so you never have to re-select them. Leave a group empty
        to see everything.
      </AppText>
      <Card>
        <ProfileEditor
          sections={interests}
          value={profileFilters}
          onChange={updateProfile}
        />
      </Card>
      {count > 0 ? (
        <View style={{ marginTop: theme.spacing(4) }}>
          <Button
            title={`Clear profile (${count} selected)`}
            variant="ghost"
            onPress={() => setPref('profileFilters', { ...EMPTY_PROFILE })}
          />
        </View>
      ) : null}
    </ScreenScrollView>
  );
}
