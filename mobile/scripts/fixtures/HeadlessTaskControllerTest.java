package expo.modules.taskManager;

import android.content.Context;
import com.facebook.react.*;
import com.facebook.react.bridge.*;
import com.facebook.react.jstasks.*;
import java.util.*;

public class HeadlessTaskControllerTest {
  static class Host implements ReactHost {
    ReactContext context;
    boolean readyWhileAdding;
    final List<ReactInstanceEventListener> listeners = new ArrayList<>();
    public ReactContext getCurrentReactContext() { return context; }
    public void addReactInstanceEventListener(ReactInstanceEventListener listener) {
      listeners.add(listener);
      if (readyWhileAdding) context = new ReactContext();
    }
    public void removeReactInstanceEventListener(ReactInstanceEventListener listener) { listeners.remove(listener); }
    void ready() {
      context = new ReactContext();
      for (ReactInstanceEventListener listener : new ArrayList<>(listeners)) listener.onReactContextInitialized(context);
    }
  }
  static class App extends Context implements ReactApplication {
    final Host host = new Host();
    public ReactHost getReactHost() { return host; }
  }
  static void check(boolean condition, String message) { if (!condition) throw new AssertionError(message); }
  static void drain() { UiThreadUtil.drain(); }
  static boolean timers(App app) { return HeadlessJsTaskContext.getInstance(app.host.context).timersRunning(); }

  public static void main(String[] args) {
    HeadlessTaskController controller = new HeadlessTaskController();
    App app = new App();
    // No React Activity or mounted UI. Two Expo events share one cold runtime.
    controller.start(app, "app", "passive"); controller.start(app, "app", "daily"); drain();
    check(app.host.listeners.size() == 1, "one cold context listener");
    app.host.ready(); drain();
    check(timers(app), "paused-host timers must run");
    check(app.host.listeners.isEmpty(), "ready listener released");
    check(HeadlessJsTaskContext.starts == 1, "one native lease for overlapping events");
    controller.finish("app", "unknown"); controller.finish("app", "passive"); drain();
    check(timers(app), "first/unknown completion cannot stop second event timers");
    controller.finish("app", "daily"); drain();
    check(!timers(app), "last event releases native timer lease");
    controller.finish("app", "daily"); drain();
    check(HeadlessJsTaskContext.finishes == 1, "duplicate finish harmless");

    // Warm runtime can acquire again; a queued new event survives old completion.
    controller.start(app, "app", "one"); controller.start(app, "app", "two");
    controller.finish("app", "one"); drain();
    check(timers(app), "warm overlapping event retained");
    controller.finish("app", "two"); controller.start(app, "app", "next"); drain();
    check(timers(app), "new event after last completion reacquires lease");
    controller.cancel("app"); drain();
    check(!timers(app), "failed load releases active lease");

    // Cancellation before cold context creation removes the listener and queued
    // callbacks cannot revive a finished batch or interfere with a replacement.
    App cold = new App();
    controller.start(cold, "cold", "old"); drain();
    ReactInstanceEventListener stale = cold.host.listeners.get(0);
    controller.cancel("cold"); controller.start(cold, "cold", "new"); drain();
    stale.onReactContextInitialized(new ReactContext()); drain();
    check(cold.host.listeners.size() == 1, "only replacement listener remains");
    cold.host.ready(); drain(); check(timers(cold), "replacement starts");
    controller.finish("cold", "new"); drain(); check(!timers(cold), "replacement finishes");
    App neverReady = new App();
    controller.start(neverReady, "never", "event"); controller.finish("never", "event"); drain();
    check(neverReady.host.listeners.isEmpty(), "early completion removes cold listener");

    App race = new App(); race.host.readyWhileAdding = true;
    controller.start(race, "race", "event"); drain();
    check(timers(race) && race.host.listeners.isEmpty(), "context registration race handled");
    controller.finish("race", "event"); drain();
    HeadlessJsTaskContext.reject = true;
    controller.start(app, "error", "failed"); drain();
    HeadlessJsTaskContext.reject = false;
    controller.start(app, "error", "retry"); drain(); check(timers(app), "native start failure permits retry");
    controller.finish("error", "retry"); drain(); check(!timers(app), "retry releases lease");
    check(HeadlessJsTaskContext.starts == HeadlessJsTaskContext.finishes, "all leases released");
    System.out.println("HEADLESS_TIMER_LIFECYCLE_PASS");
  }
}
