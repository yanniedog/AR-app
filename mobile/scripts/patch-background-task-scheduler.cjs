const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { patchSource } = require('./patch-task-manager-timers.cjs');

// SDK 54 restores task consumers from inside the currently running worker.
// Its first registration must preserve that worker instead of cancelling it.
const VERSION = '1.0.10';
const SOURCE_HASH = '0391c1034c3fa2208e6974387852c88d22d335829ea411f60a74b18ab7c90889';
const edits = [
  ['cancelExisting: Boolean = true', 'initialRegistration: Boolean = true'],
  [`    // Stop the current worker (if any)
    if (cancelExisting) {
      stopWorker(context)
    }`, `    // Restoring the first consumer can happen inside this running worker.
    // KEEP is atomic: no cancellation, duplicate child, or delay reset.
    if (initialRegistration) {
      Log.d(TAG, "AR_BACKGROUND_RESTORE_KEEP_V1")
    }`],
  [`          // This is where we decide if we should cancel or replace the task - cancelling is done
          // when spawning the first task, while appending is when we spawn from a running task
          // to set up the next periodic run of the task
          if (cancelExisting) ExistingWorkPolicy.REPLACE else ExistingWorkPolicy.APPEND,`, `          // Registration preserves pending work. Only a completing worker (or
          // foreground deferral) appends its next delayed run.
          if (initialRegistration) ExistingWorkPolicy.KEEP else ExistingWorkPolicy.APPEND,`],
  ['          ExistingPeriodicWorkPolicy.CANCEL_AND_REENQUEUE,',
    '          ExistingPeriodicWorkPolicy.UPDATE,'],
  [`    if (!isWorkerRunning(context)) {
      return false
    }`, `    // Explicit last-task unregistration cancels the unique chain atomically.
    // Its first historical WorkInfo may be finished while a child is pending.`],
];

function patchBackgroundTaskScheduler(projectDir = path.resolve(__dirname, '..')) {
  const resolveFrom = createRequire(path.join(projectDir, 'package.json'));
  const packagePath = resolveFrom.resolve('expo-background-task/package.json');
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  if (pkg.version !== VERSION) throw new Error(`Unsupported expo-background-task version ${pkg.version}; review the scheduler repair`);
  const file = path.join(path.dirname(packagePath), 'android/src/main/java/expo/modules/backgroundtask/BackgroundTaskScheduler.kt');
  const patched = patchSource(fs.readFileSync(file, 'utf8'), edits, SOURCE_HASH);
  fs.writeFileSync(file, patched);
}

if (require.main === module) patchBackgroundTaskScheduler();
module.exports = { patchBackgroundTaskScheduler, edits, SOURCE_HASH };
