package expo.modules.focusblock

import android.content.Context
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Task 11.11. Reads the jog-confirmed-today flag that
 * expo.modules.activityrecognition.JogDetectionPrefs (a separate local Expo module,
 * modules/activity-recognition, task 11.2) writes.
 *
 * Deliberately NOT a Gradle/compile-time dependency between the two modules: Kotlin's `internal`
 * visibility is scoped per compilation unit, and focus-block/activity-recognition are separate
 * Android library modules -- a real cross-module class reference would need an explicit Gradle
 * dependency edge that Expo's local-module autolinking doesn't set up. SharedPreferences files,
 * however, are just OS-level files keyed by name within this app's single package, shared by
 * every component running in the same process no matter which Gradle module compiled it -- so
 * this reads the exact same file via the same name/key/date-format contract
 * JogDetectionPrefs.kt uses, instead of trying to import it. If that file's constants ever
 * change, this must change with them (there is no compiler to catch a drift here).
 */
internal object JogStatusReader {
  private const val PREFS_NAME = "jog_detection_state"
  private const val KEY_DATE = "jogged_date"
  private val dayFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US)

  fun hasJoggedToday(context: Context): Boolean {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    return prefs.getString(KEY_DATE, null) == dayFormat.format(Date())
  }
}
