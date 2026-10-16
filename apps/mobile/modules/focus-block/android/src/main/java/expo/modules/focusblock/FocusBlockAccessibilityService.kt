package expo.modules.focusblock

import android.accessibilityservice.AccessibilityService
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.content.pm.ApplicationInfo
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
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
private const val POPUP_DELAY_MS = 350L
private const val NIGHT_WARNING_LEAD_MIN = 30
private const val NIGHT_WARNING_EVERY_MS = 15 * 60_000L
private const val SITE_TICK_MS = 30_000L
private const val OVERLAY_TICK_MS = 30_000L
private const val SITE_READ_THROTTLE_MS = 1_000L
/** No single gap counts for more than this (a missed screen-off, a long gap between events). */
private const val SITE_MAX_CREDIT_MS = 60_000L

class FocusBlockAccessibilityService : AccessibilityService() {

  override fun onAccessibilityEvent(event: AccessibilityEvent) {
    // Content changes only matter inside a browser: the address bar changing site.
    if (event.eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED) {
      val pkg = event.packageName?.toString() ?: return
      if (WebsiteUsage.isBrowser(pkg)) onBrowserContent(pkg, throttled = true)
      return
    }
    if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return

    // Task 8.2: checked on every qualifying event regardless of which app is foregrounded --
    // the jog/step unlock can happen while the user is in an allowed app (or the launcher), not
    // necessarily the exact moment they try to open a blocked one.
    checkNightUnlockTransition()

    val foregroundPackage = event.packageName?.toString() ?: return
    trackForeground(foregroundPackage)
    if (foregroundPackage == packageName) return // never block our own app

    // Work focus: social media and games are off limits from the first minute, whether or not
    // they're on the block list. "Focus" = inside a WORK block (evaluated natively from the pushed
    // schedules, so it holds with the app closed) or a pomodoro/work session JS reported active.
    if (kickIfInWorkFocus(foregroundPackage)) return
    if (applyNightRule(foregroundPackage)) return

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
      blockAndExplain(foregroundPackage, "FOCUS", focusReason())
      return
    }

    val blockedScope = blockedScope(foregroundPackage) ?: return

    blockAndExplain(
      foregroundPackage,
      blockedScope,
      if (blockedScope == "NIGHT") "es horario de bloqueo nocturno" else focusReason(),
    )
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
    // The morning stretch now runs until the exercise deadline (09:30), not the window's end.
    val morningEndMinutes = maxOf(FocusBlockPrefs.nightEndMinutes(this), FocusBlockPrefs.wakeExerciseEndMinutes(this))
    if (!NightBlockRules.isInMorningPortion(now, morningEndMinutes)) {
      FocusBlockPrefs.setWasMorningBlocking(this, false)
      return
    }

    val isBlockingNow = nightListBlockingNow(now)

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

    return if (nightListBlockingNow()) "NIGHT" else null
  }

  /**
   * The night list's rule right now, with exercise on waking (2026-10-15): every night check goes
   * through here so apps, sites and the social/game rule agree, and so the steps-since-waking
   * baseline is recorded on every check during the night.
   */
  private fun nightListBlockingNow(now: Calendar = Calendar.getInstance()): Boolean {
    val nightEnd = FocusBlockPrefs.nightEndMinutes(this)
    val stepsToday = StepCountReader.dailySteps(this)
    return NightBlockRules.isNightListBlocking(
      now,
      FocusBlockPrefs.nightStartMinutes(this),
      nightEnd,
      JogStatusReader.hasJoggedToday(this),
      stepsToday,
      FocusBlockPrefs.wakeExerciseEndMinutes(this),
      FocusBlockPrefs.stepsSinceWake(this, now, nightEnd, stepsToday),
    )
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
      if (!isSocialOrGame(pkg)) return
      // Catches an app that was already open when a WORK block or pomodoro began: no window event
      // fires for it, so without this it would stay usable until the next app switch.
      if (kickIfInWorkFocus(pkg)) return
      if (applyNightRule(pkg)) return
      applyWorkSocialLimit(pkg)
      handler.postDelayed(this, WORK_LIMIT_TICK_MS)
    }
  }

  private fun trackForeground(pkg: String) {
    if (pkg == "com.android.systemui" || pkg == currentKeyboardPackage()) return
    if (pkg == currentForeground) return
    currentForeground = pkg
    handler.removeCallbacks(tick)
    if (isSocialOrGame(pkg)) handler.postDelayed(tick, WORK_LIMIT_TICK_MS)
    handler.removeCallbacks(siteTick)
    if (WebsiteUsage.isBrowser(pkg)) {
      onBrowserContent(pkg, throttled = false)
      handler.postDelayed(siteTick, SITE_TICK_MS)
    } else {
      leaveSite()
    }
  }

  // ---- Websites (WebsiteUsage.kt) ----
  //
  // While a browser is in front, the site in its address bar gets the time (screen on only), and a
  // site on the block list is kicked like a blocked app. Re-read on content changes (throttled) and
  // on a tick, since a video page changes nothing for minutes at a time.
  private var site: String? = null
  private var siteCreditedAt = 0L
  private var lastSiteRead = 0L
  private val siteTick = object : Runnable {
    override fun run() {
      val pkg = currentForeground ?: return
      if (!WebsiteUsage.isBrowser(pkg)) return
      onBrowserContent(pkg, throttled = false)
      handler.postDelayed(this, SITE_TICK_MS)
    }
  }

  private fun onBrowserContent(pkg: String, throttled: Boolean) {
    val now = System.currentTimeMillis()
    if (throttled && now - lastSiteRead < SITE_READ_THROTTLE_MS) return
    lastSiteRead = now
    // Content events also fire for a browser drawn under another app; only the one in front counts.
    if (pkg != currentForeground) return
    val domain = WebsiteUsage.currentDomain(rootInActiveWindow, pkg) ?: return
    creditSite(now)
    site = domain
    val scope = blockedSiteScope(domain) ?: return
    leaveSite()
    blockAndExplain(
      pkg,
      scope,
      if (scope == "NIGHT") "es horario de bloqueo nocturno" else focusReason(),
      label = domain,
      identifier = domain,
    )
  }

  /** Gives the current site the time since it was last credited (capped, screen on only). */
  private fun creditSite(now: Long) {
    val current = site
    val since = siteCreditedAt
    siteCreditedAt = now
    if (current == null || since == 0L) return
    val power = getSystemService(Context.POWER_SERVICE) as? PowerManager
    if (power?.isInteractive == false) return
    WebsiteUsage.add(this, current, (now - since).coerceAtMost(SITE_MAX_CREDIT_MS))
  }

  private fun leaveSite() {
    creditSite(System.currentTimeMillis())
    site = null
    siteCreditedAt = 0L
  }

  /** "FOCUS"/"NIGHT" when a block-list site applies right now, same rules as apps. */
  private fun blockedSiteScope(domain: String): String? {
    if (FocusBlockPrefs.isActive(this) && FocusBlockPrefs.blockedDomains(this).any { WebsiteUsage.matches(domain, it) }) {
      return "FOCUS"
    }
    if (!FocusBlockPrefs.isNightEnabled(this)) return null
    if (FocusBlockPrefs.nightBlockedDomains(this).none { WebsiteUsage.matches(domain, it) }) return null
    return if (nightListBlockingNow()) "NIGHT" else null
  }

  private fun currentKeyboardPackage(): String? = runCatching {
    Settings.Secure.getString(contentResolver, Settings.Secure.DEFAULT_INPUT_METHOD)?.substringBefore('/')
  }.getOrNull()

  // Social = the shared curated list JS pushes (WorkSocialLimit.socialPackages). Games = the app's
  // own declared category: Android category "game" (set via android:appCategory / Play's listing),
  // plus the legacy isGame flag older games still use. Unlike the "social" category -- rejected as
  // unreliable on real hardware (socialPackages.ts) -- "game" is what game packages actually carry.
  // Cached: a package's category doesn't change while it's installed.
  private val gameCache = HashMap<String, Boolean>()

  private fun isSocialOrGame(pkg: String): Boolean {
    if (pkg in WorkSocialLimit.socialPackages(this)) return true
    return gameCache.getOrPut(pkg) {
      runCatching {
        val info = packageManager.getApplicationInfo(pkg, 0)
        @Suppress("DEPRECATION")
        info.category == ApplicationInfo.CATEGORY_GAME || (info.flags and ApplicationInfo.FLAG_IS_GAME) != 0
      }.getOrDefault(false)
    }
  }

  /**
   * Every block goes through here: back to home, logged as a BlockEvent, a notification (kept for
   * the lock screen and the notification history) and the full-screen popup explaining it.
   */
  private fun blockAndExplain(
    pkg: String,
    scope: String,
    reason: String,
    // A blocked website: its domain names it and is what the BlockEvent records.
    label: String = appLabel(pkg),
    identifier: String = pkg,
  ) {
    performGlobalAction(GLOBAL_ACTION_HOME)
    val category = when {
      pkg in WorkSocialLimit.socialPackages(this) -> BlockPopup.Category.SOCIAL
      isSocialOrGame(pkg) -> BlockPopup.Category.GAME
      else -> BlockPopup.Category.GENERIC
    }
    FocusBlockNotifications.showBlockedAlert(this, identifier, label, reason)
    FocusBlockPrefs.addPendingBlockEvent(this, identifier, scope, "BLOCKED_OPEN_ATTEMPT")
    // After the home action settles, so the popup lands on the launcher, not the closing app.
    handler.postDelayed({ BlockPopup.show(this, label, reason, category) }, POPUP_DELAY_MS)
  }

  private fun appLabel(pkg: String): String = runCatching {
    packageManager.getApplicationLabel(packageManager.getApplicationInfo(pkg, 0)).toString()
  }.getOrDefault(pkg)

  /** "estas en tu bloque de trabajo «Estudio B2» (hasta 12:30)", or the generic focus reason. */
  private fun focusReason(): String {
    val window = WorkSocialLimit.currentWorkWindow(this)
      ?: return "tenes un enfoque activo (pomodoro u horario de trabajo)"
    val name = window.label?.let { " «$it»" } ?: ""
    return "estas en tu bloque de trabajo$name (hasta ${WorkSocialLimit.clock(window.endMinute)})"
  }

  // ---- Night: social media and games ----
  //
  // With night mode on, the half hour before the window opens warns every 15 minutes while a
  // social app or game is in front ("en 30 min se bloquean..."), and from the window's start
  // (22:30 by default) they're blocked with the same rule as the NIGHT list: all evening, then in
  // the morning until a jog / 1000 steps / the cutoff (NightBlockRules).
  private var lastNightWarningAt = 0L

  /** True when it kicked the app out. */
  private fun applyNightRule(pkg: String): Boolean {
    if (!FocusBlockPrefs.isNightEnabled(this) || !isSocialOrGame(pkg)) return false
    val now = Calendar.getInstance()
    val start = FocusBlockPrefs.nightStartMinutes(this)
    val nightEnd = FocusBlockPrefs.nightEndMinutes(this)
    val exerciseEnd = FocusBlockPrefs.wakeExerciseEndMinutes(this)
    if (nightListBlockingNow(now)) {
      val reason =
        if (NightBlockRules.isInWakeExercisePortion(now, nightEnd, exerciseEnd)) {
          "primero el ejercicio: trota o camina ${NightBlockRules.WAKE_STEP_THRESHOLD} pasos y se desbloquea (o a las ${WorkSocialLimit.clock(exerciseEnd)})"
        } else {
          "es horario de bloqueo nocturno (desde las ${WorkSocialLimit.clock(start)})"
        }
      blockAndExplain(pkg, "NIGHT", reason)
      return true
    }

    val minutesLeft = NightBlockRules.minutesUntilNightStart(now, start)
    val nowMs = System.currentTimeMillis()
    if (minutesLeft in 1..NIGHT_WARNING_LEAD_MIN && nowMs - lastNightWarningAt >= NIGHT_WARNING_EVERY_MS) {
      lastNightWarningAt = nowMs
      val category = if (pkg in WorkSocialLimit.socialPackages(this)) BlockPopup.Category.SOCIAL else BlockPopup.Category.GAME
      val title = "Bloqueo nocturno en $minutesLeft min"
      val body = "A las ${WorkSocialLimit.clock(start)} se bloquean las redes sociales y los juegos hasta manana. Buen momento para ir cerrando."
      WorkSocialLimit.notify(this, title, body)
      BlockPopup.showWarning(this, title, body, category)
    }
    return false
  }

  /** Kicks a social app or game out if a work focus is on; true when it did. */
  private fun kickIfInWorkFocus(pkg: String): Boolean {
    if (!isSocialOrGame(pkg)) return false
    if (!WorkSocialLimit.isWorkHours(this) && !FocusBlockPrefs.isActive(this)) return false
    blockAndExplain(pkg, "FOCUS", focusReason())
    return true
  }

  /** Returns true when it kicked the app out. */
  private fun applyWorkSocialLimit(pkg: String): Boolean {
    return when (val decision = WorkSocialLimit.evaluate(this, pkg)) {
      is WorkSocialLimit.Decision.None -> false
      is WorkSocialLimit.Decision.Notify -> {
        WorkSocialLimit.notify(this, decision.title, decision.body)
        false
      }
      is WorkSocialLimit.Decision.Block -> {
        blockAndExplain(pkg, "FOCUS", "se acabo tu tiempo de redes sociales en horario de trabajo")
        true
      }
    }
  }

  // ---- The pomodoro over the screen during a WORK block (FocusOverlay.kt) ----
  //
  // Checked every 30 s (a block starting needs no event to happen) and on every unlock.
  private val overlayTick = object : Runnable {
    override fun run() {
      runCatching { FocusOverlay.check(this@FocusBlockAccessibilityService, appInFront = currentForeground == packageName) }
        .onFailure { android.util.Log.e("FocusOverlay", "check failed", it) }
      handler.postDelayed(this, OVERLAY_TICK_MS)
    }
  }

  private val unlockReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      if (intent.action == Intent.ACTION_USER_PRESENT) {
        runCatching { FocusOverlay.check(this@FocusBlockAccessibilityService, appInFront = currentForeground == packageName) }
          .onFailure { android.util.Log.e("FocusOverlay", "unlock check failed", it) }
      }
    }
  }

  override fun onServiceConnected() {
    super.onServiceConnected()
    instance = this
    handler.removeCallbacks(overlayTick)
    handler.post(overlayTick)
    runCatching {
      val filter = IntentFilter(Intent.ACTION_USER_PRESENT)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        registerReceiver(unlockReceiver, filter, Context.RECEIVER_EXPORTED)
      } else {
        registerReceiver(unlockReceiver, filter)
      }
    }
  }

  /** Our own app is the one in front (it asks things itself instead of an overlay). */
  fun isOwnAppInFront(): Boolean = currentForeground == packageName

  companion object {
    /** The running service, for JS-driven overlay refreshes (null when it isn't bound). */
    @Volatile
    var instance: FocusBlockAccessibilityService? = null
      private set
  }

  override fun onDestroy() {
    instance = null
    handler.removeCallbacks(overlayTick)
    runCatching { unregisterReceiver(unlockReceiver) }
    FocusOverlay.hide(this)
    handler.removeCallbacks(tick)
    handler.removeCallbacks(siteTick)
    leaveSite()
    super.onDestroy()
  }

  override fun onInterrupt() {
    // Required override, no state to tear down -- FocusBlockPrefs is just a SharedPreferences
    // read, nothing held open between events.
  }
}
