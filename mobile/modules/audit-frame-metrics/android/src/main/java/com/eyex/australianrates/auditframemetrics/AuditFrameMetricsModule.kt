package com.eyex.australianrates.auditframemetrics

import android.app.Activity
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.Looper
import android.view.FrameMetrics
import android.view.Window
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.round

class AuditFrameMetricsModule : Module() {
  private val lock = Any()
  private var active = false
  private var attachedActivity: Activity? = null
  private var attachedWindow: Window? = null
  private var listener: Window.OnFrameMetricsAvailableListener? = null
  private var handlerThread: HandlerThread? = null
  private var refreshRateHz: Double = 60.0
  private var deadlineMs: Double = 1000.0 / 60.0
  private val overrunsMs = ArrayList<Double>(4096)
  private var totalFrames: Int = 0
  private var jankFrames: Int = 0
  private var frozenFrames: Int = 0
  private var maxFrozenFrameMs: Double = 0.0

  override fun definition() = ModuleDefinition {
    Name("ArAuditFrameMetrics")

    Function("startFrameMetrics") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return@Function false
      val activity = appContext.currentActivity ?: return@Function false
      val window = activity.window ?: return@Function false
      stopInternal()

      val hz = readRefreshRateHz(activity)
      val frameDeadlineMs = 1000.0 / hz
      val thread = HandlerThread("ArAuditFrameMetrics").apply { start() }
      val handler = Handler(thread.looper)

      synchronized(lock) {
        active = true
        refreshRateHz = hz
        deadlineMs = frameDeadlineMs
        overrunsMs.clear()
        totalFrames = 0
        jankFrames = 0
        frozenFrames = 0
        maxFrozenFrameMs = 0.0
        handlerThread = thread
      }

      val frameListener = Window.OnFrameMetricsAvailableListener { _, frameMetrics, _ ->
        val totalNs = frameMetrics.getMetric(FrameMetrics.TOTAL_DURATION)
        if (totalNs <= 0L) return@OnFrameMetricsAvailableListener
        val totalMs = totalNs / 1_000_000.0
        val perFrameDeadlineMs = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          val deadlineNs = frameMetrics.getMetric(FrameMetrics.DEADLINE)
          if (deadlineNs > 0L) deadlineNs / 1_000_000.0 else null
        } else {
          null
        }
        synchronized(lock) {
          if (!active) return@OnFrameMetricsAvailableListener
          val effectiveDeadlineMs = perFrameDeadlineMs ?: deadlineMs
          totalFrames += 1
          val overrun = totalMs - effectiveDeadlineMs
          overrunsMs.add(overrun)
          if (totalMs > effectiveDeadlineMs) {
            jankFrames += 1
          }
          if (totalMs >= 700.0) {
            frozenFrames += 1
            if (totalMs > maxFrozenFrameMs) {
              maxFrozenFrameMs = totalMs
            }
          }
        }
      }

      val latch = CountDownLatch(1)
      var attached = false
      activity.runOnUiThread {
        try {
          synchronized(lock) {
            if (!active || handlerThread !== thread) {
              return@runOnUiThread
            }
            window.addOnFrameMetricsAvailableListener(frameListener, handler)
            attachedWindow = window
            attachedActivity = activity
            listener = frameListener
            attached = true
          }
        } catch (_: Throwable) {
          attached = false
        } finally {
          latch.countDown()
        }
      }
      latch.await(1, TimeUnit.SECONDS)

      if (!attached) {
        synchronized(lock) {
          if (handlerThread === thread) {
            active = false
            attachedWindow = null
            attachedActivity = null
            listener = null
            handlerThread = null
          }
        }
        thread.quitSafely()
        return@Function false
      }

      return@Function true
    }

    Function("stopFrameMetrics") {
      return@Function stopInternal()
    }
  }

  private fun readRefreshRateHz(activity: Activity): Double {
    val raw = try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        activity.display?.refreshRate
      } else {
        @Suppress("DEPRECATION")
        activity.windowManager.defaultDisplay?.refreshRate
      }
    } catch (_: Throwable) {
      null
    }
    return if (raw != null && raw.isFinite() && raw >= 30f && raw <= 240f) {
      round(raw.toDouble() * 10.0) / 10.0
    } else {
      60.0
    }
  }

  private fun stopInternal(): Map<String, Any>? {
    val windowToDetach: Window?
    val listenerToDetach: Window.OnFrameMetricsAvailableListener?
    val threadToQuit: HandlerThread?
    val hz: Double
    val frames: Int
    val jank: Int
    val frozen: Int
    val maxFrozen: Double
    val sortedOverruns: List<Double>

    synchronized(lock) {
      active = false
      windowToDetach = attachedWindow
      listenerToDetach = listener
      threadToQuit = handlerThread
      attachedActivity = null
      attachedWindow = null
      listener = null
      handlerThread = null
      hz = refreshRateHz
      frames = totalFrames
      jank = jankFrames
      frozen = frozenFrames
      maxFrozen = maxFrozenFrameMs
      sortedOverruns = overrunsMs.sorted()
      overrunsMs.clear()
      totalFrames = 0
      jankFrames = 0
      frozenFrames = 0
      maxFrozenFrameMs = 0.0
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && windowToDetach != null && listenerToDetach != null) {
      val latch = CountDownLatch(1)
      Handler(Looper.getMainLooper()).post {
        try {
          windowToDetach.removeOnFrameMetricsAvailableListener(listenerToDetach)
        } catch (_: Throwable) {
        } finally {
          latch.countDown()
        }
      }
      latch.await(1, TimeUnit.SECONDS)
    }
    threadToQuit?.quitSafely()

    if (frames <= 0 || sortedOverruns.isEmpty()) {
      return null
    }

    val p95Index = max(0, ceil(sortedOverruns.size * 0.95).toInt() - 1)
    val p95OverrunMs = round(sortedOverruns[p95Index] * 10.0) / 10.0
    val jankPercent = round(((jank * 100.0) / frames) * 10.0) / 10.0

    val result = HashMap<String, Any>(7)
    result["refreshRateHz"] = hz
    result["frameOverrunP95Ms"] = p95OverrunMs
    result["jankPercent"] = jankPercent
    result["frozenFrameCount"] = frozen
    result["totalFrameCount"] = frames
    result["totalFrames"] = frames
    if (frozen > 0) {
      result["maxFrozenFrameMs"] = round(maxFrozen * 10.0) / 10.0
    }
    return result
  }
}
