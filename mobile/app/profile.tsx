import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { ProfileEditor } from '../src/components/ProfileEditor';
import { CustomerProfilePanel } from '../src/components/CustomerProfilePanel';
import { ScreenScrollView } from '../src/components/Screen';
import { AppText, Button, Card } from '../src/components/ui';
import { LedgerRow, LedgerSection } from '../src/components/ledger';
import { LedgerIcon } from '../src/components/icons/LedgerIcon';
import { SECTION_ORDER, SECTIONS } from '../src/constants';
import { toggleInterest } from '../src/data/interests';
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
        layoutMeasured: layoutReady,
      },
    ],
  });

  return (
    <ScreenScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      onLayout={() => setLayoutReady(true)}
    >
      <LedgerSection title="Product types" deck="Choose at least one. These are the products you see across the app." ruled={false}>
        {SECTION_ORDER.map(section => {
          const selected = interests.includes(section);
          const disabled = selected && interests.length === 1;
          return <LedgerRow key={section} title={SECTIONS[section].title}
            accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled }}
            aria-checked={selected} aria-disabled={disabled}
            disabled={disabled} onPress={() => setPref('interests', toggleInterest(interests, section))}
            trailing={<LedgerIcon name={selected ? 'checkbox' : 'checkbox-empty'} size={24} color={theme.colors.primary} />} />;
        })}
      </LedgerSection>
      <AppText variant="body" color="textMuted" style={{ marginBottom: 16, lineHeight: 22 }}>
        Choose the features you need. Your choices apply across products, matches and charts.
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
      <CustomerProfilePanel />
    </ScreenScrollView>
  );
}
