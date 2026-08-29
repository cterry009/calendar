package expo.modules.focusblock

import java.util.Calendar

/**
 * Task 11.10/11.11. Pure functions, no state -- deliberately NOT routed through a JS-computed-
 * and-pushed boolean the way FocusBlockPrefs.isActive/blockedPackages are for the pomodoro/
 * work-hours trigger. A fixed nightly clock window is pure System.currentTimeMillis() arithmetic
 * with no dependency on live session/DB state only JS has -- routing it through JS anyway would
 * inherit exactly the "stale if the RN process is dead" failure mode this feature most needs to
 * avoid, since it matters precisely while the user is asleep and the app is almost certainly not
 * foregrounded or alive. Evaluated fresh on every onAccessibilityEvent callback in
 * FocusBlockAccessibilityService.kt (which already fires on every foreground-app change), so no
 * new timer/alarm component is needed either.
 */
internal object NightBlockRules {
  private const val NIGHT_START_HOUR = 22
  private const val NIGHT_START_MINUTE = 30
  private const val MORNING_END_HOUR = 8
  private const val MORNING_END_MINUTE = 0

  private fun minutesSinceMidnight(now: Calendar): Int = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)
  private fun nightStartMinutes(): Int = NIGHT_START_HOUR * 60 + NIGHT_START_MINUTE
  private fun morningEndMinutes(): Int = MORNING_END_HOUR * 60 + MORNING_END_MINUTE

  private fun isEveningPortion(now: Calendar): Boolean = minutesSinceMidnight(now) >= nightStartMinutes()

  /**
   * The full 22:30-08:00 window, crossing midnight, ignoring the jog exception entirely -- a
   * single "start <= now" check can't express a range that wraps past midnight, hence the OR.
   * Exposed for UI copy/tests; NOT used to compute [isNightListBlocking] below (see its doc
   * comment for why ORing this with the jog rule would be wrong, not just redundant).
   */
  fun isNightWindowActive(now: Calendar): Boolean {
    val nowMinutes = minutesSinceMidnight(now)
    return nowMinutes >= nightStartMinutes() || nowMinutes < morningEndMinutes()
  }

  /**
   * The morning portion (00:00-08:00) specifically: blocked until a confirmed jog (task 11.2) or
   * the 08:00 hard cutoff, whichever comes first -- this is what actually implements "trotar para
   * desbloquear el cel". False the instant `hasJoggedToday` flips true, even well before 08:00.
   */
  private fun isMorningPortionBlocking(now: Calendar, hasJoggedToday: Boolean): Boolean =
    minutesSinceMidnight(now) < morningEndMinutes() && !hasJoggedToday

  /**
   * The single rule FocusBlockAccessibilityService actually enforces for the NIGHT list: a flat
   * block from 22:30 through midnight, then block-until-jog-or-08:00 after midnight.
   *
   * Deliberately NOT `isNightWindowActive(now) || isMorningPortionBlocking(now, hasJoggedToday)`.
   * That OR looks like it combines "the fixed window" with "the jog exception," but
   * `isNightWindowActive` already returns true for the *entire* morning portion on its own,
   * regardless of jog status -- ORing it in would make the jog exception provably unreachable
   * (an OR can only be forced false by making *both* sides false, and the left side is never
   * false while the right side's precondition holds). The jog exception has to be evaluated as
   * the *only* rule governing the morning portion, not added on top of an already-unconditional
   * one.
   */
  fun isNightListBlocking(now: Calendar, hasJoggedToday: Boolean): Boolean =
    if (isEveningPortion(now)) true else isMorningPortionBlocking(now, hasJoggedToday)
}
