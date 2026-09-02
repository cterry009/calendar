package expo.modules.focusblock

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
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

    // Task 11.9. Same fire-and-forget shape as setBlockingState above, called from
    // useNightBlocking.ts (mounted once at the app root) whenever the NIGHT-scope block list or
    // its on/off toggle changes.
    Function("setNightBlockingState") { enabled: Boolean, blockedPackages: List<String> ->
      appContext.reactContext?.let { context -> FocusBlockPrefs.writeNight(context, enabled, blockedPackages.toSet()) }
    }

    // Task 11.22. startMinutes/endMinutes are minutes-since-midnight (e.g. 22:30 -> 1350); the
    // >=10h-duration validation lives entirely on the JS side (lib/nightBlock/state.ts) before this
    // is ever called -- this layer just stores whatever it's given, same "native side has no
    // business logic of its own" pattern as setNightBlockingState above.
    Function("setNightWindow") { startMinutes: Int, endMinutes: Int ->
      appContext.reactContext?.let { context -> FocusBlockPrefs.setNightWindow(context, startMinutes, endMinutes) }
    }

    Function("getNightWindowStartMinutes") {
      appContext.reactContext?.let { context -> FocusBlockPrefs.nightStartMinutes(context) } ?: (22 * 60 + 30)
    }

    Function("getNightWindowEndMinutes") {
      appContext.reactContext?.let { context -> FocusBlockPrefs.nightEndMinutes(context) } ?: (8 * 60)
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

    // Task 6.7 fix's other dependency, alongside the accessibility service itself: Android 14+
    // stopped auto-granting USE_FULL_SCREEN_INTENT, so the "App bloqueada" alert
    // (FocusBlockNotifications.kt) needs this explicitly allowed too, same "can't enable
    // programmatically" pattern as accessibility. Always true below API 34, where the permission
    // is still auto-granted.
    Function("isFullScreenIntentAllowed") {
      appContext.reactContext?.let { context -> FocusBlockNotifications.canUseFullScreenIntent(context) } ?: true
    }

    Function("openFullScreenIntentSettings") {
      appContext.reactContext?.let { context ->
        val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
          Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:${context.packageName}"))
        } else {
          Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
            .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
        }
        context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      }
    }

    // Task 11.12. Neither the AccessibilityService nor the night-window/jog-unlock rule it now
    // evaluates (task 11.10/11.11) are immune to Doze/App Standby or an OEM-specific battery
    // killer -- task 6.9 already found `adb shell am force-stop` silently unbinds the service on
    // a real device. Exempting the app from battery optimization is the one mitigation that's
    // actually available; same "can't enable programmatically, only deep-link to the settings
    // screen" pattern as accessibility/full-screen-intent above -- this is a sensitive permission
    // Android reserves for an explicit user action.
    Function("isIgnoringBatteryOptimizations") {
      appContext.reactContext?.let { context -> isIgnoringBatteryOptimizations(context) } ?: false
    }

    Function("openBatteryOptimizationSettings") {
      appContext.reactContext?.let { context ->
        context.startActivity(
          Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${context.packageName}"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
      }
    }
  }
}

private fun isIgnoringBatteryOptimizations(context: Context): Boolean {
  val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return false
  return powerManager.isIgnoringBatteryOptimizations(context.packageName)
}

private fun isServiceEnabled(context: Context): Boolean {
  val expected = "${context.packageName}/${FocusBlockAccessibilityService::class.java.name}"
  val enabled = Settings.Secure.getString(context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)
    ?: return false
  return enabled.split(':').any { it.equals(expected, ignoreCase = true) }
}
