import { useCallback } from 'react';

import type { ProGateIntent } from '../lib/proAccess';

export function useProPaywall() {
  const requestPro = useCallback(
    (_intent: ProGateIntent): boolean => true,
    [],
  );

  const closePaywall = useCallback(() => undefined, []);

  return {
    pro: true,
    paywallVisible: false,
    paywallIntent: 'alert_limit' as ProGateIntent,
    requestPro,
    closePaywall,
  };
}
