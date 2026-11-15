import * as Application from 'expo-application';
import { router } from 'expo-router';
import React from 'react';

import { ScreenScrollView } from '../src/components/Screen';
import {
  DisclosureGroup,
  InfoRow,
  NavRow,
  Section,
  SettingsGap,
} from '../src/components/settings/settingsUi';
import { uiIdentifier, uiJoin, uiLabel } from '../src/lib/uiCopy';

export default function AboutScreen() {
  const appVersion = Application.nativeApplicationVersion?.trim();
  const buildVersion = Application.nativeBuildVersion?.trim();
  const versionValue = appVersion && buildVersion
    ? uiJoin(uiIdentifier(appVersion), ' ', '(', uiIdentifier(buildVersion), ')')
    : appVersion
      ? uiIdentifier(appVersion)
      : buildVersion
        ? uiIdentifier(buildVersion)
        : uiLabel('Unavailable');

  return (
    <ScreenScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Section title="Australian Rates">
        <InfoRow
          label="Version"
          value={versionValue}
        />
      </Section>

      <Section title="Legal">
        <NavRow
          icon="document-text-outline"
          label="Terms"
          onPress={() => router.push('/terms')}
        />
        <SettingsGap size={4} />
        <NavRow
          icon="code-slash-outline"
          label="Open-source notices"
          onPress={() => router.push('/third-party-notices')}
        />
      </Section>

      <Section title="Support">
        <DisclosureGroup title="Diagnostics" defaultOpen={false}>
          <SettingsGap size={6} />
          <NavRow
            icon="speedometer-outline"
            label="App health audit"
            onPress={() => router.push('/performance-audit')}
          />
          <SettingsGap size={4} />
          <NavRow
            icon="document-text-outline"
            label="Debug log"
            onPress={() => router.push('/debug-log')}
          />
        </DisclosureGroup>
      </Section>
    </ScreenScrollView>
  );
}
