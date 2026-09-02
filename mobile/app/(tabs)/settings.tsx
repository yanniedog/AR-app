import { Redirect } from 'expo-router';
import React from 'react';

/** Preserve restored navigation state and older group-qualified Settings links. */
export default function LegacyGroupedSettingsRedirect() {
  return <Redirect href="/settings" />;
}
