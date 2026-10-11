package com.eyex.australianrates.auditawake

import android.content.Context
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.views.ExpoView

class AuditScreenAwakeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ArAuditScreenAwake")
    View(AuditScreenAwakeView::class) {}
  }
}

/** Android derives screen-on ownership from the visible audit view hierarchy.
 * It survives route/window updates and ends automatically when the view leaves. */
class AuditScreenAwakeView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    keepScreenOn = true
  }

  override fun onDetachedFromWindow() {
    keepScreenOn = false
    super.onDetachedFromWindow()
  }
}
