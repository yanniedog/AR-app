import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertAuditScreenAwakeExport } from './check-exported-audit-screen-awake.mjs';

test('rejects an Android export that selected the generic platform fallback', () => {
  assert.throws(() => assertAuditScreenAwakeExport(
    ['/modules/audit-screen-awake/index.tsx'], Buffer.from('ArAuditScreenAwake'),
  ), /missing the native/);
});

test('rejects missing compiled native reference even with the right source map', () => {
  assert.throws(() => assertAuditScreenAwakeExport(
    ['/modules/audit-screen-awake/index.android.tsx'], Buffer.from('other native view'),
  ), /missing the audit/);
});

test('accepts a native Android implementation present in the runtime', () => {
  assertAuditScreenAwakeExport(
    ['/modules/audit-screen-awake/index.android.tsx'], Buffer.from('ArAuditScreenAwake'),
  );
});
