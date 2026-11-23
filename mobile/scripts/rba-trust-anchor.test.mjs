import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const plugin = require('../plugins/with-rba-trust-anchor.js');

test('bundled Sectigo R46 root matches its published fingerprint', () => {
  assert.equal(plugin.certFingerprint(), plugin.CERT_SHA256);
  assert.equal(plugin.certFingerprint(), '7bb647a62aeeac88bf257aa522d01ffea395e0ab45c73f93f65654ec38f25a06');
});

test('network config adds the root for RBA only and keeps system roots', () => {
  const xml = plugin.networkSecurityConfigXml();
  assert.match(xml, /<domain includeSubdomains="true">rba\.gov\.au<\/domain>/);
  assert.match(xml, /<certificates src="system" \/>/);
  assert.match(xml, /<certificates src="@raw\/sectigo_public_server_authentication_root_r46" \/>/);
  assert.equal((xml.match(/<domain /g) ?? []).length, 1);
  assert.doesNotMatch(xml, /base-config|cleartextTrafficPermitted/);
});

test('manifest points the application at the network config', () => {
  const manifest = { application: [{ $: { 'android:name': '.MainApplication' } }] };
  plugin.setNetworkSecurityConfig(manifest);
  assert.equal(manifest.application[0].$['android:networkSecurityConfig'], '@xml/network_security_config');
  assert.equal(manifest.application[0].$['android:name'], '.MainApplication');
});

test('the plugin itself rewrites the manifest and writes the cert and config resources', async () => {
  const config = plugin({ name: 'x', slug: 'x' });
  const manifest = { application: [{ $: {} }] };
  await config.mods.android.manifest({ modResults: { manifest }, modRequest: {}, modRawConfig: config });
  assert.equal(manifest.application[0].$['android:networkSecurityConfig'], '@xml/network_security_config');

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rba-trust-'));
  try {
    await config.mods.android.dangerous({ modResults: {}, modRequest: { platformProjectRoot: root }, modRawConfig: config });
    const res = path.join(root, 'app', 'src', 'main', 'res');
    assert.equal(fs.readFileSync(path.join(res, 'raw', 'sectigo_public_server_authentication_root_r46.pem'), 'utf8'), plugin.CERT_PEM);
    assert.equal(fs.readFileSync(path.join(res, 'xml', 'network_security_config.xml'), 'utf8'), plugin.networkSecurityConfigXml());
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
