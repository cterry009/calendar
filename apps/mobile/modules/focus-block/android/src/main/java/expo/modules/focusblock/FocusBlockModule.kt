package expo.modules.focusblock

import android.content.Context
import android.content.Intent
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class FocusBlockModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FocusBlock")

    // Fire-and-forget: called every time useFocusBlocking.ts recomputes the combined
    // pomodoro/work-hours/block-list state. Cheap local write, no return value needed.
    //
    // Written as `context?.let { }` rather than `val context = ... ?: return@Function` -- the
    // latter hit a real Kotlin type-inference edge case here (a bare `return@Function` inside an
    // elvis expression, followed by a Unit-returning final statement, produced
    // "Return type mismatch: expected 'Any?', actual 'Unit'" from the Expo Modules Kotlin DSL's
    // generic Function() overload; found by an actual `gradlew assembleDebug` run, not by
    // inspection). `?.let` sidesteps it entirely.
    Function("setBlockingState") { active: Boolean, blockedPackages: List<String> ->
      appContext.reactContext?.let { context -> FocusBlockPrefs.write(context, active, blockedPackages.toSet()) }
    }

    // AccessibilityServices can't be enabled programmatically -- Android requires an explicit,
    // manual toggle in system Settings (this permission class lets an app observe every app the
    // user opens, so auto-enabling it would be a real abuse vector). This just reports status.
    Function("isAccessibilityServiceEnabled") {
      appContext.reactContext?.let { context -> isServiceEnabled(context) } ?: false
    }

    // Deep-links to the exact settings screen where the user flips that toggle.
    Function("openAccessibilitySettings") {
      appContext.reactContext?.let { context ->
        context.startActivity(
          Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
      }
    }
  }
}

private fun isServiceEnabled(context: Context): Boolean {
  val expected = "${context.packageName}/${FocusBlockAccessibilityService::class.java.name}"
  val enabled = Settings.Secure.getString(context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)
    ?: return false
  return enabled.split(':').any { it.equals(expected, ignoreCase = true) }
}
