import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';

const directory = new URL('../assets/banks/', import.meta.url);
const catalogue = JSON.parse(readFileSync(new URL('sources.json', directory), 'utf8'));
const moduleSource = readFileSync(new URL('../src/data/bankLogoAssets.ts', import.meta.url), 'utf8');
const references = new Map([...moduleSource.matchAll(/'([^']+)': require\('\.\.\/\.\.\/assets\/banks\/([^']+)'\)/g)]
  .map(([, key, file]) => [key, file]));

test('the offline catalogue contains verified, readable artwork for all 116 register brands', () => {
  assert.equal(catalogue.brands.length, 116);
  const files = new Set();
  const providers = new Set();
  for (const brand of catalogue.brands) {
    assert.ok(!providers.has(brand.provider), `Duplicate provider: ${brand.provider}`);
    providers.add(brand.provider);
    assert.match(brand.file, /^[a-z0-9-]+\.png$/);
    assert.equal(references.get(brand.key), brand.file, brand.provider);
    assert.match(brand.source_url, /^https:\/\//);
    assert.doesNotMatch(brand.source_url, /No-logo-available/i);
    assert.match(brand.source_sha256, /^[a-f0-9]{64}$/);
    const bytes = readFileSync(new URL(brand.file, directory));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), brand.sha256, brand.provider);
    const image = PNG.sync.read(bytes);
    assert.equal(image.width, brand.width, brand.provider);
    assert.equal(image.height, brand.height, brand.provider);
    assert.ok(image.width > 0 && image.width <= 256 && image.height > 0 && image.height <= 128, brand.provider);
    let visible = 0;
    for (let i = 0; i < image.data.length; i += 4) {
      if (image.data[i + 3] > 64 && Math.min(image.data[i], image.data[i + 1], image.data[i + 2]) < 220) visible++;
    }
    assert.ok(visible > 8, `Artwork invisible on the avatar's white frame: ${brand.provider}`);
    files.add(brand.file);
  }
  for (const file of references.values()) assert.ok(files.has(file), `Unverified bundled file: ${file}`);
  assert.deepEqual(new Set(readdirSync(directory).filter(name => name.endsWith('.png'))), files);
});

test('Queensland Country Bank and Bank of Queensland retain distinct artwork', () => {
  const country = catalogue.brands.find(brand => brand.provider === 'Queensland Country Bank');
  const boq = catalogue.brands.find(brand => brand.provider === 'Bank of Queensland Limited');
  assert.notEqual(country.sha256, boq.sha256);
  assert.notEqual(references.get(country.key), references.get(boq.key));
});
