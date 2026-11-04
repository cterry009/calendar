package expo.modules.focusblock

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
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
    Function("setBlockingState") { active: Boolean, activeUntilMs: Double, blockedPackages: List<String>, lockdown: Boolean ->
      appContext.reactContext?.let { context ->
        FocusBlockPrefs.write(context, active, activeUntilMs.toLong(), blockedPackages.toSet(), lockdown)
      }
    }

    // Task 11.9. Same fire-and-forget shape as setBlockingState above, called from
    // useNightBlocking.ts (mounted once at the app root) whenever the NIGHT-scope block list or
    // its on/off toggle changes.
    Function("setNightBlockingState") { enabled: Boolean, blockedPackages: List<String> ->
      appContext.reactContext?.let { context ->
        FocusBlockPrefs.writeNight(context, enabled, blockedPackages.toSet())
        // Re-arms (or cancels, if enabled just went false) the "bloqueo nocturno empieza ahora"
        // alarm -- piggybacking on this existing push point instead of adding a new JS bridge call,
        // since useNightBlocking.ts already invokes this on every enabled/packages change.
        NightBlockAlarmScheduler.reschedule(context)
      }
    }

    // Task 11.22. startMinutes/endMinutes are minutes-since-midnight (e.g. 22:30 -> 1350); the
    // >=10h-duration validation lives entirely on the JS side (lib/nightBlock/state.ts) before this
    // is ever called -- this layer just stores whatever it's given, same "native side has no
    // business logic of its own" pattern as setNightBlockingState above.
    Function("setNightWindow") { startMinutes: Int, endMinutes: Int, weekendStartMinutes: Int ->
      appContext.reactContext?.let { context ->
        FocusBlockPrefs.setNightWindow(context, startMinutes, endMinutes, weekendStartMinutes)
        NightBlockAlarmScheduler.reschedule(context)
      }
    }

    // weekend-mode: the NIGHT entries with their own start, as {"identifier":{"s":m,"w":m}}.
    Function("setNightAppStarts") { json: String ->
      appContext.reactContext?.let { context -> FocusBlockPrefs.writeNightAppStarts(context, json) }
    }

    // The block commitment: epoch ms it lasts until (0 = none, a huge number = indefinitely).
    Function("setCommitmentUntil") { untilMs: Double ->
      appContext.reactContext?.let { context ->
        FocusBlockPrefs.setCommitmentUntil(context, if (untilMs >= Long.MAX_VALUE.toDouble()) Long.MAX_VALUE else untilMs.toLong())
        NightBlockAlarmScheduler.reschedule(context)
      }
    }

    // Device admin: with it active the app can't be uninstalled until it's deactivated, and the
    // commitment keeps that screen closed. Android only lets the user grant it, on its own screen.
    Function("isDeviceAdminActive") {
      appContext.reactContext?.let { context -> devicePolicy(context)?.isAdminActive(adminComponent(context)) } ?: false
    }

    Function("requestDeviceAdmin") {
      appContext.reactContext?.let { context ->
        context.startActivity(
          Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN)
            .putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent(context))
            .putExtra(
              DevicePolicyManager.EXTRA_ADD_EXPLANATION,
              "Mientras dure tu compromiso, la app no se podrá desinstalar. Al terminar se quita sola.",
            )
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
      }
    }

    // The commitment ended: uninstalling works normally again.
    Function("removeDeviceAdmin") {
      appContext.reactContext?.let { context -> devicePolicy(context)?.removeActiveAdmin(adminComponent(context)) }
    }

    // Work-hours social limit (WorkSocialLimit.kt). windowsJson is the enabled WORK schedules as
    // [{"days":[..],"start":m,"end":m}]; pushed by useFocusBlocking.ts whenever schedules change.
    Function("setWorkSocialLimit") { windowsJson: String, socialPackages: List<String> ->
      appContext.reactContext?.let { context ->
        WorkSocialLimit.writeConfig(context, windowsJson, socialPackages.toSet())
      }
    }

    // Texts for the native "App bloqueada" popup (BlockPopup.kt): the shared activity suggestions
    // by category and the motivational phrases, as JSON.
    // The persistent block/pomodoro notification with a native countdown (FocusStatusNotification.kt).
    // endsAtMs arrives as a JS number (Double).
    Function("setFocusStatus") { title: String, text: String, endsAtMs: Double ->
      appContext.reactContext?.let { context ->
        FocusStatusNotification.show(context, title, text, endsAtMs.toLong())
      }
    }

    Function("clearFocusStatus") {
      appContext.reactContext?.let { context ->
        FocusStatusNotification.clear(context)
      }
    }

    // The pomodoro over the screen during a WORK block (FocusOverlay.kt): what it shows, the exits
    // made on it, and "Volver al bloque" letting it pop up again.
    Function("setFocusOverlayState") { json: String ->
      appContext.reactContext?.let { context ->
        FocusOverlay.writeState(context, json)
        android.os.Handler(android.os.Looper.getMainLooper()).post {
          runCatching { FocusOverlay.refresh(FocusBlockAccessibilityService.instance) }
        }
      }
    }

    Function("drainOverlayExits") {
      val context = appContext.reactContext
      val exits: List<Map<String, String>> = if (context == null) emptyList() else FocusOverlay.drainExits(context)
      exits
    }

    Function("clearOverlayExit") { key: String ->
      appContext.reactContext?.let { context -> FocusOverlay.clearExited(context, key) }
    }

    // Reviewed (or given up) in the app: no end-of-block card for this block occurrence.
    Function("markBlockReviewed") { key: String ->
      appContext.reactContext?.let { context -> FocusOverlay.markReviewed(context, key) }
    }

    // WEBSITE block-list entries, per list (WebsiteUsage.kt / FocusBlockAccessibilityService).
    Function("setBlockedDomains") { focus: List<String>, night: List<String> ->
      appContext.reactContext?.let { context ->
        FocusBlockPrefs.writeBlockedDomains(context, focus.toSet(), night.toSet())
      }
    }

    // Time per website the accessibility service measured, most used first.
    Function("getWebsiteUsage") { startMillis: Double, endMillis: Double ->
      val context = appContext.reactContext
      val usage: List<Map<String, Any>> =
        if (context == null) emptyList() else WebsiteUsage.usage(context, startMillis.toLong(), endMillis.toLong())
      usage
    }

    Function("setBlockPopupContent") { json: String ->
      appContext.reactContext?.let { context -> BlockPopup.writeContent(context, json) }
    }

    // Lets JS defer to the native limit: during work hours, social warnings are native-only.
    Function("isWorkHours") {
      appContext.reactContext?.let { context -> WorkSocialLimit.isWorkHours(context) } ?: false
    }

    Function("getNightWindowStartMinutes") {
      appContext.reactContext?.let { context -> FocusBlockPrefs.nightStartMinutes(context) } ?: (22 * 60)
    }

    Function("getNightWindowEndMinutes") {
      appContext.reactContext?.let { context -> FocusBlockPrefs.nightEndMinutes(context) } ?: (8 * 60)
    }

    // Task 8.2. Returns and clears the native pending-BlockEvent queue in one call (see
    // FocusBlockPrefs.drainPendingBlockEvents's doc comment for the atomicity reasoning) -- called
    // from useBlockEvents.ts on mount/foreground, handing the result straight to the existing
    // offline sync queue so network delivery/retry is the JS layer's job, not this bridge's.
    Function("drainPendingBlockEvents") {
      val context = appContext.reactContext
      val events: List<Map<String, String?>> = if (context != null) FocusBlockPrefs.drainPendingBlockEvents(context) else emptyList()
      events
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

private fun devicePolicy(context: Context): DevicePolicyManager? =
  context.getSystemService(Context.DEVICE_POLICY_SERVICE) as? DevicePolicyManager

private fun adminComponent(context: Context): ComponentName = ComponentName(context, CommitmentAdminReceiver::class.java)

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
