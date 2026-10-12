import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { BACKGROUND_TASK, PASSIVE_AUDIT_TASK } from './taskNames';

// Imported by the production entry before Router. No store hydration, payload
// loading, network work or React mount is needed to define either callback.
const tasks = [
  [PASSIVE_AUDIT_TASK, () => {
    // Synchronous module loading inside the callback works in a cold native
    // bundle without requesting an asynchronously split route/chunk.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const runtime = require('../lib/passiveAudit') as typeof import('../lib/passiveAudit');
    return runtime.runPassiveAuditBackgroundTask();
  }],
  [BACKGROUND_TASK, () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const runtime = require('../data/store') as typeof import('../data/store');
    return runtime.runScheduledBackgroundRefresh();
  }],
] as const;

for (const [name, execute] of tasks) {
  try {
    if (typeof TaskManager.isTaskDefined === 'function' && !TaskManager.isTaskDefined(name)) {
      TaskManager.defineTask(name, async () => {
        try { return await execute(); }
        catch { return BackgroundTask.BackgroundTaskResult.Failed; }
      });
    }
  } catch { /* Web/native-unavailable runtimes retain foreground work. */ }
}
