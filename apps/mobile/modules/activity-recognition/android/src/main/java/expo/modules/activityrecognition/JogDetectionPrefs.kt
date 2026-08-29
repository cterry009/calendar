package expo.modules.activityrecognition

import android.content.Context
import android.content.SharedPreferences
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * SharedPreferences bridge for the jog-confirmed-today flag -- same pattern as
 * expo.modules.focusblock.FocusBlockPrefs: written by ActivityTransitionReceiver, which runs
 * independent of the RN JS process, and read both from here (for the JS-facing hasJoggedToday()
 * query, e.g. to auto-log a FitnessEntry or show habit status) and, from task 11.11 on, directly
 * by FocusBlockAccessibilityService for the jog-to-unlock enforcement rule -- it has to be
 * native-side state that survives the JS process being dead, not something JS pushes.
 */
internal object JogDetectionPrefs {
  private const val PREFS_NAME = "jog_detection_state"
  private const val KEY_DATE = "jogged_date"
  private const val KEY_ENTER_AT = "running_enter_at_millis"
  private const val KEY_LAST_DURATION_MINUTES = "last_duration_minutes"
  private val dayFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US)

  private fun prefs(context: Context): SharedPreferences =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  private fun today(): String = dayFormat.format(Date())

  fun setJoggedToday(context: Context) {
    prefs(context).edit().putString(KEY_DATE, today()).apply()
  }

  // Compares the stored date to today's date at read time rather than resetting via a midnight
  // job -- self-healing, no scheduled-reset component needed (same reasoning as
  // dailySteps.ts's todayKey() comparison on the JS side).
  fun hasJoggedToday(context: Context): Boolean = prefs(context).getString(KEY_DATE, null) == today()

  fun recordRunningEnter(context: Context, atMillis: Long) {
    prefs(context).edit().putLong(KEY_ENTER_AT, atMillis).apply()
  }

  // Turns a matched ENTER/EXIT pair into a real measured duration, rather than the JS side
  // fabricating one -- if there's no matching ENTER (e.g. the process restarted mid-run and lost
  // the in-memory... well, SharedPreferences-backed, so this really only happens if EXIT arrives
  // before this receiver ever saw the corresponding ENTER), duration stays unknown and the
  // previous value (if any) is left in place rather than overwritten with a guess.
  fun recordRunningExit(context: Context, atMillis: Long) {
    val store = prefs(context)
    val enterAt = store.getLong(KEY_ENTER_AT, -1L)
    store.edit().remove(KEY_ENTER_AT).apply()
    if (enterAt < 0) return
    val minutes = ((atMillis - enterAt) / 60_000L).toInt().coerceAtLeast(1)
    store.edit().putInt(KEY_LAST_DURATION_MINUTES, minutes).apply()
  }

  // Non-consuming: reflects the most recently completed run for as long as `hasJoggedToday` says
  // today's jog is confirmed. Doesn't attempt to track multiple runs in a day -- a later run's
  // duration simply overwrites this, same "one entry per day" simplification the fitness/habit
  // auto-log already makes.
  fun getLastJogDurationMinutes(context: Context): Int? {
    val store = prefs(context)
    return if (store.contains(KEY_LAST_DURATION_MINUTES)) store.getInt(KEY_LAST_DURATION_MINUTES, 0) else null
  }
}
