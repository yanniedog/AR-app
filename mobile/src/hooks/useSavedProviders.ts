import { useMemo } from 'react';

import { savedProviders } from '../data/bankGroups';
import { useStore } from '../data/store';

export function useSavedProviders(): ReadonlySet<string> {
  const core = useStore((state) => state.core);
  const savedRates = useStore((state) => state.savedRates);
  return useMemo(() => savedProviders(core, savedRates), [core, savedRates]);
}
