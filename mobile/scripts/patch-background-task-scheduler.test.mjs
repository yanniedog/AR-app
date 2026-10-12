import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { patchSource } = require('./patch-task-manager-timers.cjs');
const { edits, SOURCE_HASH } = require('./patch-background-task-scheduler.cjs');
const upstream = path.dirname(require.resolve('expo-background-task/package.json'));
const installed = fs.readFileSync(path.join(upstream,
  'android/src/main/java/expo/modules/backgroundtask/BackgroundTaskScheduler.kt'), 'utf8');
const patched = patchSource(installed, edits, SOURCE_HASH);

test('scheduler repair is idempotent and rejects drift or partially applied changes', () => {
  assert.equal(patchSource(patched, edits, SOURCE_HASH), patched);
  let original = patched;
  for (const [before, after] of [...edits].reverse()) original = original.replace(after, before);
  assert.equal(patchSource(original.replaceAll('\n', '\r\n'), edits, SOURCE_HASH), patched);
  assert.throws(() => patchSource(`${original}\n// different SDK`, edits, SOURCE_HASH), /source drift/);
  for (const [before, after] of edits) {
    assert.throws(() => patchSource(patched.replace(after, before), edits, SOURCE_HASH), /partial|drift/);
  }
});

test('restoration preserves pending one-time work atomically and never adds a child or cancels it', () => {
  const register = patched.slice(patched.indexOf('  fun registerTask('), patched.indexOf('  fun unregisterTask('));
  assert.match(register, /numberOfRegisteredTasksOfThisType == 1[\s\S]*scheduleWorker\(context, context.packageName\)/);
  const schedule = patched.slice(patched.indexOf('  private suspend fun scheduleWorker('), patched.indexOf('  private suspend fun stopWorker('));
  assert.match(schedule, /initialRegistration: Boolean = true/);
  assert.match(schedule, /if \(initialRegistration\) ExistingWorkPolicy.KEEP else ExistingWorkPolicy.APPEND/);
  assert.doesNotMatch(schedule, /stopWorker\(|cancelUniqueWork\(|ExistingWorkPolicy.REPLACE|CANCEL_AND_REENQUEUE/);
  assert.match(schedule, /enqueueUniquePeriodicWork\([\s\S]*ExistingPeriodicWorkPolicy.UPDATE/);
  // This checks the actual pinned scheduler, not an independently reimplemented
  // fake scheduler. Android's KEEP handles RUNNING/ENQUEUED atomically; only its
  // explicit continuation branch can append a child.
  const continuations = [...patched.matchAll(/scheduleWorker\(context, appScopeKey, false[^\n]*/g)];
  assert.equal(continuations.length, 2);
  assert.match(continuations[0][0], /60L.coerceAtMost\(intervalMinutes\)/);
  assert.match(patched.slice(patched.indexOf('    tasks.awaitAll()')), /tasks.awaitAll\(\)[\s\S]*scheduleWorker\(context, appScopeKey, false\)/);
});

test('only explicit last-task unregistration cancels; interval changes govern the next child', () => {
  const unregister = patched.slice(patched.indexOf('  fun unregisterTask('), patched.indexOf('  private suspend fun scheduleWorker('));
  assert.match(unregister, /numberOfRegisteredTasksOfThisType -= 1[\s\S]*numberOfRegisteredTasksOfThisType == 0[\s\S]*stopWorker\(context\)/);
  assert.equal([...patched.matchAll(/stopWorker\(context\)/g)].length, 1);
  const stop = patched.slice(patched.indexOf('  private suspend fun stopWorker('), patched.indexOf('  private suspend fun isWorkerRunning('));
  assert.doesNotMatch(stop, /isWorkerRunning\(|getWorkerInfo\(/);
  assert.match(stop, /workManager.cancelUniqueWork\(WORKER_IDENTIFIER\).await\(\)/);
  assert.match(patched, /this.intervalMinutes = intervalMinutes/);
  assert.match(patched, /overriddenIntervalMinutes: Long = intervalMinutes/);
  assert.match(patched, /setInitialDelay\(Duration.ofMinutes\(overriddenIntervalMinutes\)\)/);
  const consumer = fs.readFileSync(path.join(upstream,
    'android/src/main/java/expo/modules/backgroundtask/BackgroundTaskConsumer.kt'), 'utf8');
  // Do not pretend the SDK's no-op same-process setOptions reschedules work.
  assert.doesNotMatch(consumer, /override fun setOptions/);
});

test('portable postinstall and required native CI compile the scheduler patch', () => {
  const install = fs.readFileSync(new URL('./apply-dependency-compat.cjs', import.meta.url), 'utf8');
  assert.match(install, /require\('\.\/patch-background-task-scheduler.cjs'\).patchBackgroundTaskScheduler\(\)/);
  const workflow = fs.readFileSync(new URL('../../.github/workflows/app-ci.yml', import.meta.url), 'utf8');
  assert.match(workflow, /:expo-background-task:compileReleaseKotlin/);
});
