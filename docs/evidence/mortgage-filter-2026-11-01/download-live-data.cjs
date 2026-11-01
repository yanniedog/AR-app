const fs = require('node:fs');
const { createHash } = require('node:crypto');
const { gunzipSync } = require('node:zlib');
const manifest = JSON.parse(fs.readFileSync('tmp/live-manifest.json', 'utf8'));
(async () => {
  for (const name of ['core', 'details']) {
    const asset = manifest.files[name];
    const path = new URL(asset.url).pathname.replace('/yanniedog/AR-local/releases/download/', '');
    const response = await fetch('https://ar-app-data.jkokavec.workers.dev/v1/release/' + path);
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length !== asset.bytes || createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw new Error(`${name}: identity mismatch`);
    const json = gunzipSync(bytes);
    fs.writeFileSync(`tmp/live-${name}.json`, json);
    const value = JSON.parse(json);
    console.log(JSON.stringify({name, bytes: bytes.length, decodedBytes: json.length, sha256: asset.sha256,
      ...(name === 'core' ? {mortgageRows: value.sections.Mortgage.rates.length} : {products: Object.keys(value.products).length})}));
  }
  console.log(JSON.stringify({runDate: manifest.run_date, publicRateCatalogue: !!manifest.public_rate_catalogue}));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
