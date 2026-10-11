import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function assertAuditScreenAwakeExport(sources, runtime) {
  if (!sources.some((source) => source.endsWith('/modules/audit-screen-awake/index.android.tsx'))) {
    throw new Error('Android export is missing the native audit screen-awake implementation');
  }
  if (!runtime.includes(Buffer.from('ArAuditScreenAwake'))) {
    throw new Error('Android runtime is missing the audit screen-awake native view reference');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const symbols = path.resolve('.expo/export-symbols');
  const manifest = JSON.parse(await readFile(path.join(symbols, 'latest.json'), 'utf8'));
  const android = manifest.entries.find((entry) => entry.platform === 'android');
  if (!android) throw new Error('Android export symbols are missing');
  const map = JSON.parse(await readFile(path.join(symbols, android.file), 'utf8'));
  const runtime = await readFile(path.join('dist/_expo/static/js/android', android.runtimeFile));
  assertAuditScreenAwakeExport(map.sources, runtime);
  console.log('Compiled Android audit screen-awake view passed.');
}
