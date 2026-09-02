import { Redirect } from 'expo-router';
import React from 'react';

/** Preserve older Market deep links after Research moved out of the tab group. */
export default function LegacyTrendsRedirect() {
  return <Redirect href="/research" />;
}
