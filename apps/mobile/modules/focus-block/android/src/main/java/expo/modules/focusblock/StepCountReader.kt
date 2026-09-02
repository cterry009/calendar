package expo.modules.focusblock

import android.content.Context
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Task 11.22. Reads the always-on native daily step count that
 * expo.modules.steptracking.StepTrackingPrefs (a separate local Expo module, modules/step-tracking,
 * task 11.16) writes -- same cross-module SharedPreferences contract JogStatusReader.kt already
 * uses for the jog flag, for the identical reason: focus-block and step-tracking are separate
 * Android library modules with no compile-time Gradle dependency between them, so this reads the
 * same file/key contract StepTrackingPrefs.kt uses instead of trying to import it.
 *
 * The daily-steps value resets at calendar midnight (self-healing, see StepTrackingPrefs.kt), which
 * conveniently lines up with what the morning-portion unlock actually wants: "steps taken since
 * midnight," not a rolling 24h count that would already be past 1000 well before bedtime for most
 * people and make the unlock trivial the moment the night window starts.
 */
internal object StepCountReader {
  private const val PREFS_NAME = "step_tracking_state"
  private const val KEY_BASELINE_DAY = "baseline_day"
  private const val KEY_DAILY_STEPS = "daily_steps"
  private val dayFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US)

  fun dailySteps(context: Context): Int {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    if (prefs.getString(KEY_BASELINE_DAY, null) != dayFormat.format(Date())) return 0
    return prefs.getInt(KEY_DAILY_STEPS, 0)
  }
}
