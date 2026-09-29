package expo.modules.focusblock

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.telecom.TelecomManager
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
private const val WORK_LIMIT_TICK_MS = 60_000L

class FocusBlockAccessibilityService : AccessibilityService() {

  override fun onAccessibilityEvent(event: AccessibilityEvent) {
    if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return

    // Task 8.2: checked on every qualifying event regardless of which app is foregrounded --
    // the jog/step unlock can happen while the user is in an allowed app (or the launcher), not
    // necessarily the exact moment they try to open a blocked one.
    checkNightUnlockTransition()

    val foregroundPackage = event.packageName?.toString() ?: return
    trackForeground(foregroundPackage)
    if (foregroundPackage == packageName) return // never block our own app

    if (applyWorkSocialLimit(foregroundPackage)) return

    // Task 7.28 "bloqueo total": during an active focus/work session with lockdown on, kick *any*
    // app that isn't on the safety allowlist -- not just the ones in the FOCUS block list. This is
    // the mobile equivalent of apps/web's mandatory full-screen focus overlay. The per-list
    // blockedScope() check below still runs when lockdown is off (or for a NIGHT-list app), so the
    // two modes coexist. Logged as a FOCUS BLOCKED_OPEN_ATTEMPT so it feeds the same dashboard
    // "intentos bloqueados" metric as an ordinary block-list hit.
    if (FocusBlockPrefs.isActive(this) &&
      FocusBlockPrefs.isLockdown(this) &&
      !isFocusAllowlisted(foregroundPackage)
    ) {
      performGlobalAction(GLOBAL_ACTION_HOME)
      FocusBlockNotifications.showBlockedAlert(this, foregroundPackage)
      FocusBlockPrefs.addPendingBlockEvent(this, foregroundPackage, "FOCUS", "BLOCKED_OPEN_ATTEMPT")
      return
    }

    val blockedScope = blockedScope(foregroundPackage) ?: return

    performGlobalAction(GLOBAL_ACTION_HOME)
    FocusBlockNotifications.showBlockedAlert(this, foregroundPackage)
    FocusBlockPrefs.addPendingBlockEvent(this, foregroundPackage, blockedScope, "BLOCKED_OPEN_ATTEMPT")
  }

  // Apps that must stay reachable even under total lockdown: this app itself, the launcher (or the
  // home-kick would loop forever), the system UI (status bar / notification shade / recents /
  // transitions), the phone stack (so calls -- including emergency -- and their in-call UI work),
  // the OS Settings app (a real escape hatch: the user can always disable this accessibility
  // service, and blocking Settings would be user-hostile and pointless since that path stays open
  // anyway), the current keyboard, and the permission/installer UIs. Everything else is blocked.
  // Launcher + dialer + IME packages are resolved from PackageManager once and cached -- they only
  // change if the user switches their default launcher/keyboard, rare enough that a process
  // restart to pick it up is fine.
  private val staticAllowlist = setOf(
    "com.android.systemui",
    "com.android.settings",
    "com.android.phone",
    "com.android.server.telecom",
    "com.android.incallui",
    "com.google.android.permissioncontroller",
    "com.android.permissioncontroller",
    "com.google.android.packageinstaller",
    "com.android.packageinstaller",
  )
  private var dynamicAllowlist: Set<String> = emptySet()

  private fun isFocusAllowlisted(pkg: String): Boolean {
    if (pkg == packageName) return true
    if (pkg in staticAllowlist) return true
    if (dynamicAllowlist.isEmpty()) {
      dynamicAllowlist = resolveDynamicAllowlist()
    }
    return pkg in dynamicAllowlist
  }

  private fun resolveDynamicAllowlist(): Set<String> {
    val out = mutableSetOf<String>()

    // Every installed home/launcher app (there can be several; the active one can change).
    val homeIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
    packageManager.queryIntentActivities(homeIntent, 0).forEach { info ->
      info.activityInfo?.packageName?.let(out::add)
    }

    // Default phone/dialer app (emergency calls must always go through).
    runCatching {
      val telecom = getSystemService(Context.TELECOM_SERVICE) as? TelecomManager
      telecom?.defaultDialerPackage?.let(out::add)
    }

    // Current keyboard, so text entry (in our own app, the dialer, etc.) isn't interrupted.
    runCatching {
      Settings.Secure.getString(contentResolver, Settings.Secure.DEFAULT_INPUT_METHOD)
        ?.substringBefore('/')
        ?.takeIf { it.isNotEmpty() }
        ?.let(out::add)
    }

    return out
  }

  // Task 8.2: fires exactly once per unlock, the instant NightBlockRules stops blocking the
  // morning portion while it's still genuinely inside that portion (see
  // NightBlockRules.isInMorningPortion's doc comment for why that check excludes the window
  // simply running out on schedule).
  private fun checkNightUnlockTransition() {
    if (!FocusBlockPrefs.isNightEnabled(this)) {
      FocusBlockPrefs.setWasMorningBlocking(this, false)
      return
    }

    val now = Calendar.getInstance()
    val morningEndMinutes = FocusBlockPrefs.nightEndMinutes(this)
    if (!NightBlockRules.isInMorningPortion(now, morningEndMinutes)) {
      FocusBlockPrefs.setWasMorningBlocking(this, false)
      return
    }

    val isBlockingNow = NightBlockRules.isNightListBlocking(
      now,
      FocusBlockPrefs.nightStartMinutes(this),
      morningEndMinutes,
      JogStatusReader.hasJoggedToday(this),
      StepCountReader.dailySteps(this),
    )

    if (FocusBlockPrefs.wasMorningBlocking(this) && !isBlockingNow) {
      FocusBlockPrefs.addPendingBlockEvent(this, null, "NIGHT", "NIGHT_UNLOCK")
    }

    FocusBlockPrefs.setWasMorningBlocking(this, isBlockingNow)
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
  // Task 8.2: returns which list actually blocked this package ("FOCUS"/"NIGHT", matching
  // BlockListScope) instead of a plain Boolean, so the caller can log a BlockEvent with the right
  // scope -- the two branches are otherwise unchanged from before this task.
  private fun blockedScope(pkg: String): String? {
    if (FocusBlockPrefs.isActive(this) && pkg in FocusBlockPrefs.blockedPackages(this)) return "FOCUS"

    if (!FocusBlockPrefs.isNightEnabled(this)) return null
    if (pkg !in FocusBlockPrefs.nightBlockedPackages(this)) return null

    val hasJoggedToday = JogStatusReader.hasJoggedToday(this)
    val stepsToday = StepCountReader.dailySteps(this)
    val blocking = NightBlockRules.isNightListBlocking(
      Calendar.getInstance(),
      FocusBlockPrefs.nightStartMinutes(this),
      FocusBlockPrefs.nightEndMinutes(this),
      hasJoggedToday,
      stepsToday,
    )
    return if (blocking) "NIGHT" else null
  }

  // ---- Work-hours social limit (WorkSocialLimit.kt) ----
  //
  // Window-state events only fire on app switches, not while you scroll inside one app, so a 60s
  // tick re-evaluates while a social app stays in front. Keyboard / system UI events are ignored
  // for tracking: they fire on top of the app you are actually using.
  private val handler = Handler(Looper.getMainLooper())
  private var currentForeground: String? = null
  private val tick = object : Runnable {
    override fun run() {
      val pkg = currentForeground ?: return
      if (pkg !in WorkSocialLimit.socialPackages(this@FocusBlockAccessibilityService)) return
      applyWorkSocialLimit(pkg)
      handler.postDelayed(this, WORK_LIMIT_TICK_MS)
    }
  }

  private fun trackForeground(pkg: String) {
    if (pkg == "com.android.systemui" || pkg == currentKeyboardPackage()) return
    if (pkg == currentForeground) return
    currentForeground = pkg
    handler.removeCallbacks(tick)
    if (pkg in WorkSocialLimit.socialPackages(this)) handler.postDelayed(tick, WORK_LIMIT_TICK_MS)
  }

  private fun currentKeyboardPackage(): String? = runCatching {
    Settings.Secure.getString(contentResolver, Settings.Secure.DEFAULT_INPUT_METHOD)?.substringBefore('/')
  }.getOrNull()

  /** Returns true when it kicked the app out. */
  private fun applyWorkSocialLimit(pkg: String): Boolean {
    return when (val decision = WorkSocialLimit.evaluate(this, pkg)) {
      is WorkSocialLimit.Decision.None -> false
      is WorkSocialLimit.Decision.Notify -> {
        WorkSocialLimit.notify(this, decision.title, decision.body)
        false
      }
      is WorkSocialLimit.Decision.Block -> {
        performGlobalAction(GLOBAL_ACTION_HOME)
        FocusBlockNotifications.showBlockedAlert(this, pkg)
        FocusBlockPrefs.addPendingBlockEvent(this, pkg, "FOCUS", "BLOCKED_OPEN_ATTEMPT")
        true
      }
    }
  }

  override fun onDestroy() {
    handler.removeCallbacks(tick)
    super.onDestroy()
  }

  override fun onInterrupt() {
    // Required override, no state to tear down -- FocusBlockPrefs is just a SharedPreferences
    // read, nothing held open between events.
  }
}
