import React, { useState } from 'react';
import { View } from 'react-native';

import { AppText, Button, Disclosure } from './ui';
import { debugLog } from '../lib/debugLog';
import { runtimeConformance } from '../lib/productTermsEngine/runtimeConformance';

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
      <Disclosure title="Evaluator runtime" open={open} onToggle={() => setOpen(!open)}
        summary={result ? `runtime=${result.runtime}; passed=${result.passed}` : 'Not run'}>
        <View style={{ gap: 8 }}>
          <AppText variant="tiny" color="textMuted">
            Fixed arithmetic and calendar checks only. No customer inputs or product assessment.
            A result from another runtime does not verify Hermes.
          </AppText>
          <Button title="Run runtime check" variant="secondary" onPress={run} />
          {result ? (
            <AppText variant="small" selectable>
              {`${result.evaluatorVersion}\nruntime=${result.runtime}; passed=${result.passed}\nChecks: ${Object.values(result.checks).filter(Boolean).length}/${Object.keys(result.checks).length}. Full result in the local log.`}
            </AppText>
          ) : null}
        </View>
      </Disclosure>
    </View>
  );
}
