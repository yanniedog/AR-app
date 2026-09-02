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
import { AppText } from '../src/components/ui';

export default function AboutScreen() {
  return (
    <ScreenScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Section title="Australian Rates">
        <InfoRow
          label="Version"
          value={`${Application.nativeApplicationVersion ?? '1.0.0'} (${Application.nativeBuildVersion ?? '0'})`}
        />
        <AppText variant="small" color="textMuted" style={{ marginTop: 6, lineHeight: 20 }}>
          Independent rate information from published Australian banking data.
        </AppText>
      </Section>

      <Section title="Legal">
        <NavRow
          icon="document-text-outline"
          label="Terms"
          sub="Data sources and legal notices"
          onPress={() => router.push('/terms')}
        />
        <SettingsGap size={4} />
        <NavRow
          icon="code-slash-outline"
          label="Open-source notices"
          sub="Fonts, icons, licences and pinned sources"
          onPress={() => router.push('/third-party-notices')}
        />
        <AppText variant="tiny" color="textFaint" style={{ marginTop: 8, lineHeight: 16 }}>
          General information only, not financial advice. Confirm rates, fees and eligibility with
          the bank before applying.
        </AppText>
      </Section>

      <Section title="Support">
        <DisclosureGroup title="Diagnostics" summary="Troubleshooting tools" defaultOpen={false}>
          <AppText variant="tiny" color="textFaint" style={{ lineHeight: 16 }}>
            These tools stay on this device unless you explicitly share or upload a report.
          </AppText>
          <SettingsGap size={6} />
          <NavRow
            icon="speedometer-outline"
            label="App health audit"
            sub="Check responsiveness, data quality and display gaps"
            onPress={() => router.push('/performance-audit')}
          />
          <SettingsGap size={4} />
          <NavRow
            icon="document-text-outline"
            label="Debug log"
            sub="Review or share troubleshooting details"
            onPress={() => router.push('/debug-log')}
          />
        </DisclosureGroup>
      </Section>
    </ScreenScrollView>
  );
}
