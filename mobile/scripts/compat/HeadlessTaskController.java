package expo.modules.taskManager;

import android.content.Context;
import android.util.Log;
import com.facebook.react.ReactApplication;
import com.facebook.react.ReactHost;
import com.facebook.react.ReactInstanceEventListener;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.bridge.WritableNativeMap;
import com.facebook.react.jstasks.HeadlessJsTaskConfig;
import com.facebook.react.jstasks.HeadlessJsTaskContext;
import java.lang.ref.WeakReference;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/** SDK 54 backport of Expo #43821. Own a React Native headless task only while
 * Expo events are pending, so timers work without an Activity or screen. All
 * mutable state runs on the UI thread, including cold ReactHost callbacks. */
final class HeadlessTaskController {
  private static final String TAG = "TaskService";
  private static final String TASK_KEY = "ar-expo-task-timers";
  private final Map<String, Lease> leases = new HashMap<>();

  private static final class Lease {
    final Set<String> events = new HashSet<>();
    ReactHost host;
    ReactInstanceEventListener listener;
    WeakReference<ReactContext> context;
    Integer taskId;
  }

  // The caller queued start() first. Loading on this same queue prevents the
  // unsynchronized Expo factory from constructing a second, unused ReactHost.
  void loadAppOnUiThread(Runnable load) {
    UiThreadUtil.runOnUiThread(() -> {
      Log.i(TAG, "AR_BACKGROUND_COLD_LOADER_UI_V1");
      load.run();
    });
  }

  void start(Context context, String scope, String eventId) {
    UiThreadUtil.runOnUiThread(() -> {
      Lease existing = leases.get(scope);
      if (existing != null) {
        existing.events.add(eventId);
        return;
      }
      Lease lease = new Lease();
      lease.events.add(eventId);
      leases.put(scope, lease);
      try {
        ReactApplication app = (ReactApplication) context.getApplicationContext();
        ReactHost host = app.getReactHost();
        if (host == null) throw new IllegalStateException("ReactHost unavailable");
        lease.host = host;
        ReactContext reactContext = host.getCurrentReactContext();
        if (reactContext != null) {
          startReady(scope, lease, reactContext);
        } else {
          lease.listener = ready -> UiThreadUtil.runOnUiThread(() -> startReady(scope, lease, ready));
          host.addReactInstanceEventListener(lease.listener);
          // Context creation can win the gap before listener registration.
          reactContext = host.getCurrentReactContext();
          if (reactContext != null) startReady(scope, lease, reactContext);
        }
      } catch (Exception error) {
        release(scope, lease);
        Log.w(TAG, "Unable to start background timer lease: " + error.getClass().getSimpleName());
      }
    });
  }

  private void startReady(String scope, Lease lease, ReactContext context) {
    if (leases.get(scope) != lease || lease.events.isEmpty() || lease.taskId != null) return;
    removeListener(lease);
    try {
      lease.context = new WeakReference<>(context);
      lease.taskId = HeadlessJsTaskContext.getInstance(context).startTask(
        new HeadlessJsTaskConfig(TASK_KEY, new WritableNativeMap(), 0, true));
      Log.i(TAG, "Started background timer lease");
    } catch (Exception error) {
      release(scope, lease);
      Log.w(TAG, "Unable to start background timer lease: " + error.getClass().getSimpleName());
    }
  }

  void finish(String scope, String eventId) {
    UiThreadUtil.runOnUiThread(() -> {
      Lease lease = leases.get(scope);
      if (lease == null) return;
      lease.events.remove(eventId);
      if (lease.events.isEmpty()) release(scope, lease);
    });
  }

  // A failed cold load drops its entire queued event batch in Expo TaskService.
  void cancel(String scope) {
    UiThreadUtil.runOnUiThread(() -> {
      Lease lease = leases.get(scope);
      if (lease != null) release(scope, lease);
    });
  }

  private void removeListener(Lease lease) {
    if (lease.listener != null) {
      lease.host.removeReactInstanceEventListener(lease.listener);
      lease.listener = null;
    }
  }

  private void release(String scope, Lease lease) {
    if (leases.get(scope) != lease) return;
    leases.remove(scope);
    removeListener(lease);
    ReactContext context = lease.context == null ? null : lease.context.get();
    if (context != null && lease.taskId != null) {
      HeadlessJsTaskContext.getInstance(context).finishTask(lease.taskId);
      Log.i(TAG, "Finished background timer lease");
    }
  }
}
