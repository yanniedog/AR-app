import { createContext } from 'react';
import { performanceAuditReadinessRegistry, type PerformanceAuditReadinessRegistry } from '../lib/performanceAuditReadiness';
export const PerformanceAuditReadinessContext = createContext<PerformanceAuditReadinessRegistry>(performanceAuditReadinessRegistry);
