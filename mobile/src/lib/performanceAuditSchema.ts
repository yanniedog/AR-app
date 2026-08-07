/** Lightweight schema constants shared by audit capture and durable log storage. */
export const PERFORMANCE_AUDIT_SCHEMA_VERSION = 3 as const;
export const LATEST_PERFORMANCE_AUDIT_STORAGE_KEY =
  `ar-performance-audit-latest-v${PERFORMANCE_AUDIT_SCHEMA_VERSION}`;
