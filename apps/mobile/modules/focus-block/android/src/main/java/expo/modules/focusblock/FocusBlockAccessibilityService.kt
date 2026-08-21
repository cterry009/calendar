package expo.modules.focusblock

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent

/**
 * Task 6.6. Declared + configured via android/src/main/AndroidManifest.xml and
 * res/xml/accessibility_service_config.xml (eventTypes=typeWindowStateChanged only -- this never
 * requests canRetrieveWindowContent, since foreground-app detection only needs the event's own
 * packageName, not window contents).
 *
 * Real, uncrossable limitation of this whole approach, stated plainly: this only runs while the
 * user has manually enabled it in system Accessibility settings (see
 * FocusBlockModule.isAccessibilityServiceEnabled/openAccessibilitySettings) -- Android does not
 * allow silently enabling one. And the blocking state it reads (FocusBlockPrefs) is only as fresh
 * as the last time the RN app was alive to write it; if the app process is fully killed, this
 * service can keep running (Android services can outlive their app's foreground UI) but will act
 * on stale state until the app reopens and useFocusBlocking.ts pushes a fresh value.
 *
 * Originally called `startActivity()` directly after the home-kick to reach /blocked (task 6.7) --
 * confirmed on a real device that this never actually surfaces the app, silently dropped by
 * Android's background-activity-launch restrictions (a Service reacting to a system event isn't a
 * "direct foreground user interaction"). Replaced with a `fullScreenIntent` notification
 * (FocusBlockNotifications.kt), the Android-sanctioned way around exactly this restriction.
 */
class FocusBlockAccessibilityService : AccessibilityService() {

  override fun onAccessibilityEvent(event: AccessibilityEvent) {
    if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return

    val foregroundPackage = event.packageName?.toString() ?: return
    if (foregroundPackage == packageName) return // never block our own app

    if (!FocusBlockPrefs.isActive(this)) return
    if (foregroundPackage !in FocusBlockPrefs.blockedPackages(this)) return

    performGlobalAction(GLOBAL_ACTION_HOME)
    FocusBlockNotifications.showBlockedAlert(this, foregroundPackage)
  }

  override fun onInterrupt() {
    // Required override, no state to tear down -- FocusBlockPrefs is just a SharedPreferences
    // read, nothing held open between events.
  }
}
