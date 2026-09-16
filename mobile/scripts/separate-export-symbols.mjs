import { copyFile, mkdir, readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export async function separateExportSymbols(dist = path.resolve('dist'), symbols = path.resolve('.expo/export-symbols')) {
  const entries = [];
  const originals = [];
  for (const platform of ['android', 'ios', 'web']) {
    const folder = path.join(dist, '_expo/static/js', platform);
    let names;
    try { names = await readdir(folder); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    for (const name of names.filter(name => name.endsWith('.map'))) {
      if (!/^.+\.(hbc|js)\.map$/.test(name)) throw new Error(`Unrecognized symbol file: ${name}`);
      const source = path.join(folder, name), runtime = path.join(folder, name.slice(0, -4));
      const data = await readFile(source), map = JSON.parse(data);
      if (map.version !== 3 || !Array.isArray(map.sources) || typeof map.mappings !== 'string') throw new Error(`Invalid source map: ${name}`);
      if (map.sources.some(source => /(?:^|\/)assets\/sample\/|(?:^|\/)src\/data\/sample\.js$/.test(String(source).replaceAll('\\', '/')))) {
        throw new Error('Export contains bundled product data; remove the runtime sample dependency');
      }
      const bundle = await readFile(runtime);
      if (!bundle.length || !(await stat(runtime)).isFile()) throw new Error(`Missing runtime for ${name}`);
      // Content-addressed storage preserves earlier symbols and makes interrupted copies retryable.
      const hash = sha256(data), destination = path.join(symbols, hash, name);
      await mkdir(path.dirname(destination), { recursive: true });
      await copyFile(source, destination);
      if (sha256(await readFile(destination)) !== hash) throw new Error('Symbol copy verification failed');
      entries.push({ platform, file: `${hash}/${name}`, bytes: data.length, sha256: hash, runtimeFile: name.slice(0, -4), runtimeSha256: sha256(bundle) });
      originals.push(source);
    }
  }
  if (!entries.length) throw new Error('No export symbols found');
  await mkdir(symbols, { recursive: true });
  await writeFile(path.join(symbols, 'latest.json'), JSON.stringify({ schemaVersion: 1, entries }, null, 2));
  for (const source of originals) await unlink(source);
  return entries;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) await separateExportSymbols();
