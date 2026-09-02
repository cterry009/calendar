package expo.modules.focusblock

import java.util.Calendar

/**
 * Task 11.10/11.11/11.22. Pure functions, no state -- deliberately NOT routed through a JS-computed-
 * and-pushed boolean the way FocusBlockPrefs.isActive/blockedPackages are for the pomodoro/
 * work-hours trigger. A fixed nightly clock window is pure System.currentTimeMillis() arithmetic
 * with no dependency on live session/DB state only JS has -- routing it through JS anyway would
 * inherit exactly the "stale if the RN process is dead" failure mode this feature most needs to
 * avoid, since it matters precisely while the user is asleep and the app is almost certainly not
 * foregrounded or alive. Evaluated fresh on every onAccessibilityEvent callback in
 * FocusBlockAccessibilityService.kt (which already fires on every foreground-app change), so no
 * new timer/alarm component is needed either.
 *
 * Task 11.22: the window bounds (previously fixed 22:30/08:00 constants) are now caller-supplied,
 * read from FocusBlockPrefs (JS-configurable, enforced >=10h there before it's ever written here)
 * -- this object no longer owns the actual hour/minute values, only the logic that decides
 * blocking from whatever window it's given.
 */
internal object NightBlockRules {
  // Task 11.22: an alternative to "did the activity-recognition sensor confirm a jog" (task 11.2,
  // a binary event that needs a sustained run to fire) -- reachable just by walking around enough,
  // for the same unlock goal (get up and move) without requiring a real jog specifically. Backed by
  // modules/step-tracking's always-on foreground-service counter (read via StepCountReader.kt,
  // same cross-module SharedPreferences contract JogStatusReader.kt already uses), so it works even
  // if the RN process is dead, same as the jog check.
  const val STEP_UNLOCK_THRESHOLD = 1000

  private fun minutesSinceMidnight(now: Calendar): Int = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)

  private fun isEveningPortion(now: Calendar, nightStartMinutes: Int): Boolean =
    minutesSinceMidnight(now) >= nightStartMinutes

  /**
   * The full configured window, crossing midnight, ignoring the jog/step exception entirely -- a
   * single "start <= now" check can't express a range that wraps past midnight, hence the OR.
   * Exposed for UI copy/tests; NOT used to compute [isNightListBlocking] below (see its doc
   * comment for why ORing this with the unlock rule would be wrong, not just redundant).
   */
  fun isNightWindowActive(now: Calendar, nightStartMinutes: Int, morningEndMinutes: Int): Boolean {
    val nowMinutes = minutesSinceMidnight(now)
    return nowMinutes >= nightStartMinutes || nowMinutes < morningEndMinutes
  }

  /**
   * The morning portion specifically: blocked until a confirmed jog (task 11.2), 1000+ steps today
   * (task 11.22), or the configured cutoff, whichever comes first -- this is what actually
   * implements "movete para desbloquear el cel". False the instant either unlock condition is met,
   * well before the cutoff if the user is up and moving early.
   */
  private fun isMorningPortionBlocking(
    now: Calendar,
    morningEndMinutes: Int,
    hasJoggedToday: Boolean,
    stepsToday: Int,
  ): Boolean =
    minutesSinceMidnight(now) < morningEndMinutes && !hasJoggedToday && stepsToday < STEP_UNLOCK_THRESHOLD

  /**
   * The single rule FocusBlockAccessibilityService actually enforces for the NIGHT list: a flat
   * block from the configured start through midnight, then block-until-unlocked-or-cutoff after
   * midnight.
   *
   * Deliberately NOT `isNightWindowActive(...) || isMorningPortionBlocking(...)`. That OR looks
   * like it combines "the fixed window" with "the unlock exception," but `isNightWindowActive`
   * already returns true for the *entire* morning portion on its own, regardless of jog/step
   * status -- ORing it in would make the unlock exception provably unreachable (an OR can only be
   * forced false by making *both* sides false, and the left side is never false while the right
   * side's precondition holds). The unlock exception has to be evaluated as the *only* rule
   * governing the morning portion, not added on top of an already-unconditional one.
   */
  fun isNightListBlocking(
    now: Calendar,
    nightStartMinutes: Int,
    morningEndMinutes: Int,
    hasJoggedToday: Boolean,
    stepsToday: Int,
  ): Boolean =
    if (isEveningPortion(now, nightStartMinutes)) {
      true
    } else {
      isMorningPortionBlocking(now, morningEndMinutes, hasJoggedToday, stepsToday)
    }
}
