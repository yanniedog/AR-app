const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createRequire } = require('node:module');

// Pinned SDK 54 backport of https://github.com/expo/expo/pull/43821.
// App entry supplies the pending JS handler required by Expo issue #51304.
const VERSION = '14.0.9';
const SOURCE_HASH = '74a8a309ffb5482537a496137c3d604fae8d0e3f7a4f6f7e11ebadd7d7a5a876';
const GRADLE_HASH = 'cb948afd70863c094eedc6630fc198bfe74203f017985d3d5997a90fa30e98e0';
const normalize = source => source.replace(/\r\n/g, '\n');
const hash = source => createHash('sha256').update(normalize(source)).digest('hex');

const previousEdits = [
  ['import java.util.UUID;', 'import java.util.UUID;\nimport java.util.concurrent.ConcurrentHashMap;'],
  ['private static final Map<String, List<String>> sEvents = new HashMap<>();',
    'private static final Map<String, List<String>> sEvents = new ConcurrentHashMap<>();\n  private static final HeadlessTaskController sHeadlessTasks = new HeadlessTaskController();'],
  ['private static final Map<String, TaskExecutionCallback> sTaskCallbacks = new HashMap<>();',
    'private static final Map<String, TaskExecutionCallback> sTaskCallbacks = new ConcurrentHashMap<>();'],
  ['    List<String> appEvents = sEvents.get(appScopeKey);\n\n    Log.i',
    '    synchronized (sEvents) {\n    sHeadlessTasks.finish(appScopeKey, eventId);\n    List<String> appEvents = sEvents.get(appScopeKey);\n\n    Log.i'],
  ['    // Invoke task callback\n    TaskExecutionCallback taskCallback = sTaskCallbacks.get(eventId);',
    '    }\n\n    // Invoke each event callback once, including failed JS task results.\n    TaskExecutionCallback taskCallback = sTaskCallbacks.remove(eventId);'],
  [`    final List<String> appEvents;
    if (sEvents.get(appScopeKey) == null) {
      appEvents = new ArrayList<>();
      appEvents.add(eventId);
      sEvents.put(appScopeKey, appEvents);
    } else {
      appEvents = new ArrayList<>();
      appEvents.add(eventId);
    }
`, `    final List<String> appEvents;
    synchronized (sEvents) {
      appEvents = sEvents.computeIfAbsent(appScopeKey, key -> new ArrayList<>());
      appEvents.add(eventId);
      // Queue starts while holding the same lock used by completion. This
      // preserves event order even when workers and JS callbacks overlap.
      sHeadlessTasks.start(mContextRef.get(), appScopeKey, eventId);
    }
`],
  ['        if (!success) {\n          sEvents.remove(appScopeKey);',
    '        if (!success) {\n          sHeadlessTasks.cancel(appScopeKey);\n          sEvents.remove(appScopeKey);'],
  ['      appEvents.remove(eventId);\n      mTasksAndEventsRepository.removeEvents(appScopeKey);',
    '      sHeadlessTasks.cancel(appScopeKey);\n      sEvents.remove(appScopeKey);\n      mTasksAndEventsRepository.removeEvents(appScopeKey);'],
];
const edits = [...previousEdits,
  ['    try {\n      getAppLoader().loadApp(',
    `    // Expo's lazy ReactHost factory is not synchronized. The timer helper
    // and cold loader must acquire the first host on the same UI queue.
    sHeadlessTasks.loadAppOnUiThread(() -> {
    try {
      getAppLoader().loadApp(`],
  ['      mTasksAndEventsRepository.removeEvents(appScopeKey);\n    }\n  }\n\n  //endregion\n  //region helpers',
    '      mTasksAndEventsRepository.removeEvents(appScopeKey);\n    }\n    });\n  }\n\n  //endregion\n  //region helpers'],
];
const gradleEdits = [
  ['dependencies {', 'dependencies {\n  implementation "com.facebook.react:react-android"'],
];

function patchSource(source, replacements, expectedHash, previous = []) {
  source = normalize(source);
  // Recover the exact pinned upstream input from an already-applied patch.
  let original = source;
  for (const [before, after] of [...replacements].reverse()) original = original.replace(after, before);
  if (hash(original) !== expectedHash) throw new Error('Expo background compatibility: upstream source drift; review the pinned patch');
  let output = original;
  for (const [before, after] of replacements) {
    if (output.split(before).length !== 2) throw new Error('Expo background compatibility: ambiguous patch anchor');
    output = output.replace(before, after);
  }
  let previousOutput = original;
  for (const [before, after] of previous) previousOutput = previousOutput.replace(before, after);
  if (source !== original && source !== output && (!previous.length || source !== previousOutput)) {
    throw new Error('Expo background compatibility: partial or conflicting patch');
  }
  return output;
}

function patchTaskManagerTimers(projectDir = path.resolve(__dirname, '..')) {
  const resolveFrom = createRequire(path.join(projectDir, 'package.json'));
  const packagePath = resolveFrom.resolve('expo-task-manager/package.json');
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  if (pkg.version !== VERSION) throw new Error(`Unsupported expo-task-manager version ${pkg.version}; review the timer backport`);
  const root = path.dirname(packagePath);
  const servicePath = path.join(root, 'android/src/main/java/expo/modules/taskManager/TaskService.java');
  const gradlePath = path.join(root, 'android/build.gradle');
  // Validate every upstream input before writing either source.
  const service = patchSource(fs.readFileSync(servicePath, 'utf8'), edits, SOURCE_HASH, previousEdits);
  const gradle = patchSource(fs.readFileSync(gradlePath, 'utf8'), gradleEdits, GRADLE_HASH);
  const helper = fs.readFileSync(path.join(__dirname, 'compat/HeadlessTaskController.java'), 'utf8');
  fs.writeFileSync(servicePath, service);
  fs.writeFileSync(gradlePath, gradle);
  fs.writeFileSync(path.join(path.dirname(servicePath), 'HeadlessTaskController.java'), helper);
}

if (require.main === module) patchTaskManagerTimers();
module.exports = { patchTaskManagerTimers, patchSource, edits, previousEdits, gradleEdits, SOURCE_HASH, GRADLE_HASH };
