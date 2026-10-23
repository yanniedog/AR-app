import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import test from 'node:test';

test('native history codec preserves bytes and rejects corrupt, noncanonical and oversized input', { timeout: 120_000 }, () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'ar-history-codec-'));
  const source = fileURLToPath(new URL('../modules/history-codec/android/src/main/java/com/eyex/australianrates/historycodec/HistoryCodec.java', import.meta.url));
  const fixture = fileURLToPath(new URL('./fixtures/HistoryCodecTest.java', import.meta.url));
  const memoryFixture = fileURLToPath(new URL('./fixtures/PayloadInflationMemoryTest.java', import.meta.url));
  const catalogueMemoryFixture = fileURLToPath(new URL('./fixtures/HistoryCatalogueMemoryTest.java', import.meta.url));
  const cachedPayloadFixture = fileURLToPath(new URL('./fixtures/CachedPayloadInflationTest.java', import.meta.url));
  const command = name => process.env.JAVA_HOME
    ? path.join(process.env.JAVA_HOME, 'bin', name + (process.platform === 'win32' ? '.exe' : '')) : name;
  try {
    const compile = spawnSync(command('javac'), ['--release', '8', '-encoding', 'UTF-8', '-d', directory, source, fixture, memoryFixture, catalogueMemoryFixture, cachedPayloadFixture], { encoding: 'utf8', timeout: 30_000 });
    assert.equal(compile.status, 0, String(compile.error ?? compile.stderr));
    const run = spawnSync(command('java'), ['-Xmx512m', '-cp', directory, 'HistoryCodecTest'], { encoding: 'utf8', timeout: 90_000 });
    assert.equal(run.status, 0, String(run.error ?? run.stderr));
    assert.match(run.stdout, /history-codec assertions passed: 47\b/);
    const memory = spawnSync(command('java'), ['-Xmx192m', '-cp', directory, 'PayloadInflationMemoryTest'], { encoding: 'utf8', timeout: 30_000 });
    assert.equal(memory.status, 0, String(memory.error ?? memory.stderr));
    assert.match(memory.stdout, /payload memory assertions passed: 45188000 characters;/);
    const catalogueMemory = spawnSync(command('java'), ['-Xmx192m', '-XX:-CompactStrings', '-cp', directory, 'HistoryCatalogueMemoryTest'], { encoding: 'utf8', timeout: 30_000 });
    assert.equal(catalogueMemory.status, 0, String(catalogueMemory.error ?? catalogueMemory.stderr));
    assert.match(catalogueMemory.stdout, /history catalogue memory assertions passed: 50000000 characters; Unicode and 9 rejection cases/);
    const cachedPayload = spawnSync(command('java'), ['-Xmx192m', '-XX:-CompactStrings', '-cp', directory, 'CachedPayloadInflationTest'], { encoding: 'utf8', timeout: 30_000 });
    assert.equal(cachedPayload.status, 0, String(cachedPayload.error ?? cachedPayload.stderr));
    assert.match(cachedPayload.stdout, /cached payload assertions passed: 25; characters=4200011; compressed=/);
  } finally {
    const target = path.resolve(directory), root = path.resolve(tmpdir());
    assert.equal(path.dirname(target), root);
    assert.ok(path.basename(target).startsWith('ar-history-codec-'));
    rmSync(target, { recursive: true, force: true });
  }
});
