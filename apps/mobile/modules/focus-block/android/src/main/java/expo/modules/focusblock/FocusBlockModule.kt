package expo.modules.focusblock

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
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
  }
}

private fun isServiceEnabled(context: Context): Boolean {
  val expected = "${context.packageName}/${FocusBlockAccessibilityService::class.java.name}"
  val enabled = Settings.Secure.getString(context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)
    ?: return false
  return enabled.split(':').any { it.equals(expected, ignoreCase = true) }
}
