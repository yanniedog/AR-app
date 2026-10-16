import { LegacyRatesRoute } from '../src/components/LegacyRatesRoute';
import React from 'react';
import { useStore } from '../src/data/store';
export default function Index() {
  const hydrated = useStore(state => state.hydrated);
  return hydrated ? <LegacyRatesRoute /> : null;
}
