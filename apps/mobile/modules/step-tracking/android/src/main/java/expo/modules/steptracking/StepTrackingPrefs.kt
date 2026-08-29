package expo.modules.steptracking

import android.content.Context
import android.content.SharedPreferences
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private const val DEFAULT_DAILY_GOAL = 8000

/**
 * SharedPreferences bridge for StepTrackingService's native, always-on step counter -- same
 * "the only channel between JS and a component that runs independent of it" pattern as
 * FocusBlockPrefs.kt/JogDetectionPrefs.kt. `TYPE_STEP_COUNTER` reports a raw value cumulative
 * since the device's last reboot, not since midnight, so today's total is (raw - baseline),
 * where baseline is the raw reading captured the first time a sensor event lands on a new
 * calendar day (or after a reboot, detected by the raw value going backwards -- see
 * StepTrackingService.kt).
 */
internal object StepTrackingPrefs {
  private const val PREFS_NAME = "step_tracking_state"
  private const val KEY_BASELINE_DAY = "baseline_day"
  private const val KEY_BASELINE_VALUE = "baseline_value"
  private const val KEY_DAILY_STEPS = "daily_steps"
  private const val KEY_DAILY_GOAL = "daily_goal"
  private val dayFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US)

  private fun prefs(context: Context): SharedPreferences =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  fun today(): String = dayFormat.format(Date())

  fun getBaselineDay(context: Context): String? = prefs(context).getString(KEY_BASELINE_DAY, null)

  fun getBaselineValue(context: Context): Float = prefs(context).getFloat(KEY_BASELINE_VALUE, 0f)

  fun setBaseline(context: Context, day: String, value: Float) {
    prefs(context).edit()
      .putString(KEY_BASELINE_DAY, day)
      .putFloat(KEY_BASELINE_VALUE, value)
      .putInt(KEY_DAILY_STEPS, 0)
      .apply()
  }

  fun setDailySteps(context: Context, steps: Int) {
    prefs(context).edit().putInt(KEY_DAILY_STEPS, steps).apply()
  }

  // Self-healing date check at read time, same reasoning as JogDetectionPrefs/dailySteps.ts --
  // if the service hasn't processed a sensor event yet today, this reports 0 rather than a
  // stale value from yesterday, with no midnight-reset job needed.
  fun getDailySteps(context: Context): Int =
    if (getBaselineDay(context) == today()) prefs(context).getInt(KEY_DAILY_STEPS, 0) else 0

  fun setDailyGoal(context: Context, goal: Int) {
    prefs(context).edit().putInt(KEY_DAILY_GOAL, goal.coerceAtLeast(1)).apply()
  }

  fun getDailyGoal(context: Context): Int = prefs(context).getInt(KEY_DAILY_GOAL, DEFAULT_DAILY_GOAL)
}
