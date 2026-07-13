import { Redirect } from 'expo-router';
import React from 'react';

/** Legacy /rba deep links redirect into the Trends tab RBA block. */
export default function WhyRatesMove() {
  return <Redirect href="/(tabs)/trends" />;
}
