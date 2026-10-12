import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { patchSource, edits, gradleEdits, SOURCE_HASH, GRADLE_HASH } = require('./patch-task-manager-timers.cjs');
const upstream = path.dirname(require.resolve('expo-task-manager/package.json'));

test('Android autolinking builds the patched task manager source instead of its prebuilt AAR', async () => {
  const autolinking = path.dirname(require.resolve('expo-modules-autolinking/package.json'));
  const { createAutolinkingOptionsLoader } = require(path.join(autolinking, 'build/commands/autolinkingOptions'));
  const { getConfiguration } = require(path.join(autolinking, 'build/platforms/android/android'));
  const loader = createAutolinkingOptionsLoader({ projectRoot: process.cwd() });
  const android = await loader.getPlatformOptions('android');
  // TaskManager's pinned Gradle source requires this exact project dependency.
  assert.deepEqual(getConfiguration(android), { buildFromSource: ['expo-task-manager', 'unimodules-app-loader'] });
  assert.deepEqual(require('../package.json').expo.install.exclude, ['@react-navigation/native']);
  const apple = await loader.getPlatformOptions('apple');
  assert.equal(apple.buildFromSource, undefined);
});

test('SDK timer backport accepts only exact pinned input or exact patched output', () => {
  for (const [relative, changes, digest] of [
    ['android/src/main/java/expo/modules/taskManager/TaskService.java', edits, SOURCE_HASH],
    ['android/build.gradle', gradleEdits, GRADLE_HASH],
  ]) {
    const installed = fs.readFileSync(path.join(upstream, relative), 'utf8');
    const patched = patchSource(installed, changes, digest);
    assert.equal(patchSource(patched, changes, digest), patched);
    let pristine = patched;
    for (const [before, after] of [...changes].reverse()) pristine = pristine.replace(after, before);
    assert.equal(patchSource(pristine.replaceAll('\n', '\r\n'), changes, digest), patched);
    assert.throws(() => patchSource(`${pristine}\n// upstream changed`, changes, digest), /source drift/);
    if (changes.length > 1) {
      assert.throws(() => patchSource(patched.replace(changes[0][1], changes[0][0]), changes, digest), /partial|drift/);
    }
  }
});

test('TaskService hooks start before dispatch and release on normal, failed-result and failed-loader paths', () => {
  const source = patchSource(fs.readFileSync(path.join(upstream,
    'android/src/main/java/expo/modules/taskManager/TaskService.java'), 'utf8'), edits, SOURCE_HASH);
  const execute = source.slice(source.indexOf('  public void executeTask('), source.indexOf('  //endregion', source.indexOf('  public void executeTask(')));
  assert.ok(execute.indexOf('sHeadlessTasks.start(') < execute.indexOf('taskManager.executeTaskWithBody(body)'));
  assert.match(execute, /synchronized \(sEvents\)[\s\S]*computeIfAbsent[\s\S]*appEvents.add\(eventId\)/);
  assert.match(execute, /if \(!success\) \{\s*sHeadlessTasks.cancel\(appScopeKey\)/);
  assert.match(execute, /catch \(HeadlessAppLoader.AppConfigurationError[\s\S]*sHeadlessTasks.cancel\(appScopeKey\)/);
  const completion = source.slice(source.indexOf('  public void notifyTaskFinished('), source.indexOf('  public void setTaskManager('));
  assert.ok(completion.indexOf('sHeadlessTasks.finish(') < completion.indexOf('taskCallback.onFinished(response)'));
  assert.match(completion, /sTaskCallbacks.remove\(eventId\)/);
  assert.doesNotMatch(completion, /get\("result"\)/); // Failed JS results release the same lease.
});

test('native lease enables cold timers for every pending event and cleans up after completion or loader failure', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ar-headless-timers-'));
  const stubs = {
    'android/content/Context.java': 'package android.content; public class Context { public Context getApplicationContext(){return this;} }',
    'android/util/Log.java': 'package android.util; public class Log { public static int i(String a,String b){return 0;} public static int w(String a,String b){return 0;} }',
    'com/facebook/react/ReactApplication.java': 'package com.facebook.react; public interface ReactApplication { ReactHost getReactHost(); }',
    'com/facebook/react/ReactHost.java': `package com.facebook.react; import com.facebook.react.bridge.ReactContext;
      public interface ReactHost { ReactContext getCurrentReactContext(); void addReactInstanceEventListener(ReactInstanceEventListener listener); void removeReactInstanceEventListener(ReactInstanceEventListener listener); }`,
    'com/facebook/react/ReactInstanceEventListener.java': 'package com.facebook.react; import com.facebook.react.bridge.ReactContext; public interface ReactInstanceEventListener { void onReactContextInitialized(ReactContext context); }',
    'com/facebook/react/bridge/ReactContext.java': 'package com.facebook.react.bridge; public class ReactContext {}',
    'com/facebook/react/bridge/WritableNativeMap.java': 'package com.facebook.react.bridge; public class WritableNativeMap {}',
    'com/facebook/react/bridge/UiThreadUtil.java': `package com.facebook.react.bridge; import java.util.*;
      public class UiThreadUtil { public static final Queue<Runnable> queue=new ArrayDeque<>(); public static void runOnUiThread(Runnable run){queue.add(run);} public static void drain(){while(!queue.isEmpty())queue.remove().run();} }`,
    'com/facebook/react/jstasks/HeadlessJsTaskConfig.java': `package com.facebook.react.jstasks; import com.facebook.react.bridge.WritableNativeMap;
      public class HeadlessJsTaskConfig { public HeadlessJsTaskConfig(String key,WritableNativeMap data,long timeout,boolean foreground){if(!key.equals("ar-expo-task-timers")||timeout!=0||!foreground)throw new AssertionError("task configuration");} }`,
    'com/facebook/react/jstasks/HeadlessJsTaskContext.java': `package com.facebook.react.jstasks; import java.util.*; import com.facebook.react.bridge.ReactContext;
      public class HeadlessJsTaskContext { static final Map<ReactContext,HeadlessJsTaskContext> contexts=new HashMap<>(); public static int starts=0,finishes=0; public static boolean reject=false;
      public final Set<Integer> active=new HashSet<>(); public static HeadlessJsTaskContext getInstance(ReactContext c){return contexts.computeIfAbsent(c,x->new HeadlessJsTaskContext());}
      public int startTask(HeadlessJsTaskConfig c){if(reject)throw new IllegalStateException();int id=++starts;active.add(id);return id;}
      public void finishTask(int id){if(!active.remove(id))throw new AssertionError("double finish");finishes++;} public boolean timersRunning(){return !active.isEmpty();} }`,
  };
  try {
    const files = [];
    for (const [relative, source] of Object.entries(stubs)) {
      const filename = path.join(directory, relative);
      fs.mkdirSync(path.dirname(filename), { recursive: true }); fs.writeFileSync(filename, source); files.push(filename);
    }
    files.push(path.resolve('scripts/compat/HeadlessTaskController.java'), path.resolve('scripts/fixtures/HeadlessTaskControllerTest.java'));
    const command = name => process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', `${name}${process.platform === 'win32' ? '.exe' : ''}`) : name;
    const compile = spawnSync(command('javac'), ['--release', '8', '-encoding', 'UTF-8', '-d', directory, ...files], { encoding: 'utf8', timeout: 30_000 });
    assert.equal(compile.status, 0, compile.stderr || compile.error?.message);
    const run = spawnSync(command('java'), ['-Xmx64m', '-cp', directory, 'expo.modules.taskManager.HeadlessTaskControllerTest'], { encoding: 'utf8', timeout: 10_000 });
    assert.equal(run.status, 0, run.stderr || run.error?.message);
    assert.match(run.stdout, /HEADLESS_TIMER_LIFECYCLE_PASS/);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
