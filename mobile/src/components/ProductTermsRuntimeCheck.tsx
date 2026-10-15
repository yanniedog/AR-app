import { uiLabel } from '../lib/uiCopy';
import React, { useState } from 'react';
import { View } from 'react-native';

import { AppText, Button, Disclosure } from './ui';
import { debugLog } from '../lib/debugLog';
import { runtimeConformance } from '../lib/productTermsEngine/runtimeConformance';
import { uiCount, uiIdentifier, uiJoin } from '../lib/uiCopy';

/** Fixed primitives only: never reads customer facts or authorizes product claims. */
export function ProductTermsRuntimeCheck() {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof runtimeConformance> | null>(null);
  const run = () => {
    const next = runtimeConformance();
    setResult(next);
    debugLog.info('productTermsRuntime', JSON.stringify(next));
  };
  return (
    <View style={{ marginTop: 12 }}>
      <Disclosure title="Evaluator runtime" open={open} onToggle={() => setOpen(!open)}>
        <View style={{ gap: 8 }}>
          <AppText variant="tiny" color="textMuted">{uiLabel("Arithmetic · Calendar")}</AppText>
          <Button title="Run check" variant="secondary" onPress={run} />
          {result ? (
            <AppText variant="small" selectable>
              {uiJoin('Version', ': ', uiIdentifier(result.evaluatorVersion), ' · ', 'Runtime', ': ', result.runtime === 'hermes' ? 'Hermes' : 'Other', ' · ', result.passed ? 'Verified' : 'Failed', ' · ', 'Checks', ': ', uiCount(Object.values(result.checks).filter(Boolean).length), ' / ', uiCount(Object.keys(result.checks).length))}
            </AppText>
          ) : null}
        </View>
      </Disclosure>
    </View>
  );
}
