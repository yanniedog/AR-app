import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('native details cache reader is bounded, strict, app-private and preserves production-size UTF-8', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'ar-details-reader-'));
  const source = fileURLToPath(new URL('../modules/history-codec/android/src/main/java/com/eyex/australianrates/historycodec/DetailsCacheReader.java', import.meta.url));
  const fixture = fileURLToPath(new URL('./fixtures/DetailsCacheReaderTest.java', import.meta.url));
  const command = name => process.env.JAVA_HOME
    ? path.join(process.env.JAVA_HOME, 'bin', name + (process.platform === 'win32' ? '.exe' : '')) : name;
  try {
    const compile = spawnSync(command('javac'), ['--release', '8', '-encoding', 'UTF-8', '-d', directory, source, fixture], { encoding: 'utf8', timeout: 30_000 });
    assert.equal(compile.status, 0, String(compile.error ?? compile.stderr));
    const run = spawnSync(command('java'), ['-Xmx32m', '-XX:-CompactStrings', '-cp', directory, 'DetailsCacheReaderTest', directory], { encoding: 'utf8', timeout: 30_000 });
    assert.equal(run.status, 0, String(run.error ?? run.stderr));
    assert.match(run.stdout, /details-cache assertions passed: 36; bytes=35247100; chunks=/);
    console.log(run.stdout.trim());
  } finally {
    const target = path.resolve(directory), root = path.resolve(tmpdir());
    assert.equal(path.dirname(target), root);
    assert.ok(path.basename(target).startsWith('ar-details-reader-'));
    rmSync(target, { recursive: true, force: true });
  }
});
