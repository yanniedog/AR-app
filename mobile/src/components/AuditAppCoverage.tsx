import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { buildAuditAppCoverage } from '../lib/auditAppCoverage';
import type { PerformanceAuditReport } from '../lib/performanceAudit';
import { uiCount, uiIdentifier, uiJoin, uiLabel } from '../lib/uiCopy';
import { InfoRow } from './settings/settingsUi';
import { Disclosure } from './ui';

export function AuditAppCoverage({ report }: { report: PerformanceAuditReport }) {
  const [open, setOpen] = useState(false);
  const coverage = useMemo(() => buildAuditAppCoverage(report), [report]);
  const planned = coverage.actions.length;
  const verified = coverage.actions.filter(action => action.outcome === 'verified').length;
  const routes = coverage.routeFiles.filter(route => route.status !== 'system');
  const scenarios = new Map(coverage.scenarios.map(scenario => [scenario.scenario, scenario]));
  return <View style={{ gap: 6 }}>
    <InfoRow label="Routes verified" value={uiJoin(uiCount(routes.filter(route => route.status === 'verified').length), ' / ', uiCount(routes.length))} />
    <InfoRow label="Semantic actions verified" value={uiJoin(uiCount(verified), ' / ', uiCount(planned))} />
    <Disclosure title="Route coverage" open={open} onToggle={() => setOpen(value => !value)}>
      {open && routes.map(route => {
        const counts = scenarios.get(route.scenario);
        return <InfoRow key={route.file} label={uiIdentifier(route.file)}
          value={counts ? uiJoin(uiCount(counts.verified), ' / ', uiCount(counts.planned)) : uiLabel('Unknown')} />;
      })}
    </Disclosure>
  </View>;
}
