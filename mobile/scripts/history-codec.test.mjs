import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('native history codec preserves bytes and rejects corrupt, noncanonical and oversized input', { timeout: 120_000 }, () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'ar-history-codec-'));
  const source = fileURLToPath(new URL('../modules/history-codec/android/src/main/java/com/eyex/australianrates/historycodec/HistoryCodec.java', import.meta.url));
  const fixture = fileURLToPath(new URL('./fixtures/HistoryCodecTest.java', import.meta.url));
  const command = name => process.env.JAVA_HOME
    ? path.join(process.env.JAVA_HOME, 'bin', name + (process.platform === 'win32' ? '.exe' : '')) : name;
  try {
    const compile = spawnSync(command('javac'), ['--release', '8', '-d', directory, source, fixture], { encoding: 'utf8', timeout: 30_000 });
    assert.equal(compile.status, 0, String(compile.error ?? compile.stderr));
    const run = spawnSync(command('java'), ['-Xmx512m', '-cp', directory, 'HistoryCodecTest'], { encoding: 'utf8', timeout: 90_000 });
    assert.equal(run.status, 0, String(run.error ?? run.stderr));
    assert.match(run.stdout, /history-codec assertions passed: 29\b/);
  } finally {
    const target = path.resolve(directory), root = path.resolve(tmpdir());
    assert.equal(path.dirname(target), root);
    assert.ok(path.basename(target).startsWith('ar-history-codec-'));
    rmSync(target, { recursive: true, force: true });
  }
});
