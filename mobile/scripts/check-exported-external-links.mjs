import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';
import { parseSync } from '@babel/core';

// Execute only the link validator's compiled dependency graph. Node/Jest
// package resolution cannot expose Metro's CommonJS/ESM entry mismatch.
export function checkExternalLinksInBundle(code) {
  const registry = new Map();
  const context = vm.createContext({
    __d: (factory, id, dependencies) => registry.set(id, { factory, dependencies }),
  });
  const ast = parseSync(code, { configFile: false, babelrc: false, sourceType: 'script' });
  for (const node of ast.program.body) {
    if (node.type === 'ExpressionStatement'
      && node.expression.type === 'CallExpression'
      && node.expression.callee.name === '__d') {
      vm.runInContext(code.slice(node.start, node.end), context, { timeout: 1000 });
    }
  }
  const candidates = [...registry.entries()].filter(([, entry]) =>
    /\.trustedExternalUrl\s*=/.test(entry.factory.toString()));
  assert.equal(candidates.length, 1, 'Expected one compiled external-link validator');
  function load(id) {
    const entry = registry.get(id);
    assert.ok(entry, `Missing compiled dependency ${id}`);
    if (entry.module) return entry.module.exports;
    entry.module = { exports: {} };
    entry.factory(context, load, load, load, entry.module, entry.module.exports, entry.dependencies);
    return entry.module.exports;
  }
  const { trustedExternalUrl } = load(candidates[0][0]);
  const requests = [
    { purpose: 'official_market_source', url: 'https://www.asx.com.au/markets/trade-our-derivatives-market/futures-market/rba-rate-tracker' },
    { purpose: 'official_economic_source', url: 'https://www.rba.gov.au/statistics/tables/#cash-rate' },
    { purpose: 'lender_source', url: 'https://www.commbank.com.au/home-loans.html?topic=rates#details' },
    { purpose: 'app_release', url: 'https://github.com/yanniedog/AR-app/releases/tag/app-apk-latest' },
  ];
  for (const request of requests) {
    const result = trustedExternalUrl({ ...request, label: 'Export verification' });
    assert.equal(result.ok, true, `Compiled ${request.purpose} rejected: ${result.message}`);
    assert.equal(result.url, request.url.split('#')[0], 'Compiled URL changed path or query');
  }
  for (const url of ['http://www.commbank.com.au/', 'https://localhost/', 'https://www.commbank.com.au/?token=secret']) {
    assert.equal(trustedExternalUrl({ url, purpose: 'lender_source', label: 'Rejected' }).ok, false);
  }
  return requests.length;
}

export async function checkExportedExternalLinks(dist = path.resolve('dist')) {
  const folder = path.join(dist, '_expo/static/js/web');
  const names = (await readdir(folder)).filter(name => /^entry-.+\.js$/.test(name));
  assert.equal(names.length, 1, 'Expected one exported web entry');
  const count = checkExternalLinksInBundle(await readFile(path.join(folder, names[0]), 'utf8'));
  console.log(`Compiled external links passed: ${count} approved purposes and unsafe destinations rejected.`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await checkExportedExternalLinks();
}
