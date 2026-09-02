package expo.modules.focusblock

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent
import java.util.Calendar

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

    if (!isBlocked(foregroundPackage)) return

    performGlobalAction(GLOBAL_ACTION_HOME)
    FocusBlockNotifications.showBlockedAlert(this, foregroundPackage)
  }

  // Task 11.10/11.11/11.22: two independent trigger families, both consulted on every event.
  // - Focus/pomodoro/work-hours: FocusBlockPrefs.isActive/blockedPackages, JS-computed and pushed
  //   every ~30s while the RN process is alive (useFocusBlocking.ts) -- unchanged from task 6.6.
  // - Night list: FocusBlockPrefs.isNightEnabled/nightBlockedPackages/night window are also
  //   JS-pushed (task 11.9/11.22), but rarely change (a toggle flip, an edit to the list, a
  //   reconfigured window) so staleness there is a non-issue the same way the block-list
  //   *contents* already tolerate it for the focus list. The actual time-window + jog/step-status
  //   decision (NightBlockRules/JogStatusReader/StepCountReader) is 100% native, correct even if
  //   the RN process has been dead for hours -- see NightBlockRules.kt's doc comment for why that
  //   split is the point of this whole design.
  private fun isBlocked(pkg: String): Boolean {
    if (FocusBlockPrefs.isActive(this) && pkg in FocusBlockPrefs.blockedPackages(this)) return true

    if (!FocusBlockPrefs.isNightEnabled(this)) return false
    if (pkg !in FocusBlockPrefs.nightBlockedPackages(this)) return false

    val hasJoggedToday = JogStatusReader.hasJoggedToday(this)
    val stepsToday = StepCountReader.dailySteps(this)
    return NightBlockRules.isNightListBlocking(
      Calendar.getInstance(),
      FocusBlockPrefs.nightStartMinutes(this),
      FocusBlockPrefs.nightEndMinutes(this),
      hasJoggedToday,
      stepsToday,
    )
  }

  override fun onInterrupt() {
    // Required override, no state to tear down -- FocusBlockPrefs is just a SharedPreferences
    // read, nothing held open between events.
  }
}
