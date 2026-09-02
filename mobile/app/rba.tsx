import { Redirect } from 'expo-router';
import React from 'react';

/** Legacy /rba deep links redirect into the Research screen's RBA block. */
export default function WhyRatesMove() {
  return <Redirect href="/research?focus=rba" />;
}
