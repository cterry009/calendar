package expo.modules.focusblock

import android.content.Context
import android.content.SharedPreferences
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID
import org.json.JSONArray
import org.json.JSONObject

/**
 * The only channel between the JS-computed blocking state (apps/mobile/src/hooks/useFocusBlocking.ts)
 * and FocusBlockAccessibilityService, which runs independently of the JS engine (a system
 * AccessibilityService is not guaranteed to share a live RN bridge) and so cannot call back into JS
 * to ask "should I block right now?" on every foreground-app change. SharedPreferences is
 * same-process, synchronous, and cheap enough to read on every TYPE_WINDOW_STATE_CHANGED event.
 * Shared between FocusBlockModule (writer) and FocusBlockAccessibilityService (reader) so the key
 * names only exist in one place.
 */
internal object FocusBlockPrefs {
  private const val PREFS_NAME = "focus_block_state"
  private const val KEY_ACTIVE = "active"
  private const val KEY_BLOCKED_PACKAGES = "blocked_packages"

  // When the active state stops holding on its own (epoch ms, 0 = no end): the end of the focus
  // phase or WORK block JS saw running. The flag used to be a bare boolean, so if Android reclaimed
  // the app process mid-block nothing ever turned it off and apps stayed blocked indefinitely,
  // until the app was opened again (found 2026-10-05). JS re-pushes it on every change.
  private const val KEY_ACTIVE_UNTIL = "active_until"

  // Task 7.28 ("bloqueo total"): when active AND this flag is on, FocusBlockAccessibilityService
  // kicks *any* foreground app that isn't on its safety allowlist back to the home screen, not
  // just the ones in KEY_BLOCKED_PACKAGES -- the mobile equivalent of apps/web's mandatory
  // full-screen focus overlay. JS-pushed on the same setBlockingState call as KEY_ACTIVE, so it's
  // always as fresh as the active flag itself.
  private const val KEY_LOCKDOWN = "lockdown"

  // Task 11.9/11.10. A second, independent pair of keys (not reusing KEY_ACTIVE/KEY_BLOCKED_PACKAGES)
  // -- the night list is a deliberately separate list from the focus/pomodoro one (see
  // BlockListScope's doc comment in schema.prisma), not a filtered view of it, so its native state
  // has to be separate too.
  private const val KEY_NIGHT_ENABLED = "night_enabled"
  private const val KEY_NIGHT_BLOCKED_PACKAGES = "night_blocked_packages"

  // Task 11.22: the window itself (previously a fixed 22:30-08:00 constant in NightBlockRules.kt)
  // is now user-configurable -- JS enforces the >=10h minimum before ever calling setNightWindow,
  // this layer just stores whatever it's given. Defaults match the original hardcoded values so an
  // upgrade with no configured window yet behaves identically to before this task.
  private const val KEY_NIGHT_START_MINUTES = "night_start_minutes"
  private const val KEY_NIGHT_END_MINUTES = "night_end_minutes"
  // 22:00-08:00 since 2026-10-15 (was 22:30-08:00).
  private const val DEFAULT_NIGHT_START_MINUTES = 22 * 60
  private const val DEFAULT_NIGHT_END_MINUTES = 8 * 60

  // weekend-mode (2026-11-04): Friday and Saturday nights start here (0 = from midnight), and a
  // NIGHT entry can start at its own time (JSON: identifier -> {"s": weeknights, "w": weekend}).
  // Same rule as packages/shared/src/blocking/nightSchedule.ts.
  private const val KEY_NIGHT_WEEKEND_START_MINUTES = "night_weekend_start_minutes"
  private const val DEFAULT_NIGHT_WEEKEND_START_MINUTES = 0
  private const val KEY_NIGHT_APP_STARTS = "night_app_starts"

  // The block commitment (weekend-mode): epoch ms it lasts until, Long.MAX_VALUE = indefinitely,
  // 0 = none. Evaluated here against the clock, so it holds and ends with the app closed.
  private const val KEY_COMMITMENT_UNTIL = "commitment_until"

  // Exercise on waking (2026-10-15): after the night window ends, the night list stays blocked
  // until a jog or WAKE_STEP_THRESHOLD steps taken since waking, at the latest until this time --
  // when the 09:30 study block starts and focus blocking takes over. A deadline at or before the
  // window's end turns the rule off (the old jog / 1000-steps-today morning unlock).
  private const val KEY_WAKE_EXERCISE_END_MINUTES = "wake_exercise_end_minutes"
  private const val DEFAULT_WAKE_EXERCISE_END_MINUTES = 9 * 60 + 30
  // The day's step count as of the last check before the window ended: steps after it are "since
  // waking". Updated on every check during the night, so steps walked at 3 a.m. don't count.
  private const val KEY_WAKE_STEPS_DAY = "wake_steps_day"
  private const val KEY_WAKE_STEPS_BASELINE = "wake_steps_baseline"

  private fun prefs(context: Context): SharedPreferences =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  fun write(context: Context, active: Boolean, activeUntilMs: Long, blockedPackages: Set<String>, lockdown: Boolean) {
    prefs(context).edit()
      .putBoolean(KEY_ACTIVE, active)
      .putLong(KEY_ACTIVE_UNTIL, activeUntilMs)
      .putStringSet(KEY_BLOCKED_PACKAGES, blockedPackages)
      .putBoolean(KEY_LOCKDOWN, lockdown)
      .apply()
  }

  fun isActive(context: Context): Boolean {
    val p = prefs(context)
    if (!p.getBoolean(KEY_ACTIVE, false)) return false
    val until = p.getLong(KEY_ACTIVE_UNTIL, 0L)
    return until <= 0L || System.currentTimeMillis() < until
  }

  fun isLockdown(context: Context): Boolean = prefs(context).getBoolean(KEY_LOCKDOWN, false) || isCommitted(context)

  fun setCommitmentUntil(context: Context, untilMs: Long) {
    prefs(context).edit().putLong(KEY_COMMITMENT_UNTIL, untilMs).apply()
  }

  fun isCommitted(context: Context): Boolean = System.currentTimeMillis() < prefs(context).getLong(KEY_COMMITMENT_UNTIL, 0L)

  fun blockedPackages(context: Context): Set<String> =
    prefs(context).getStringSet(KEY_BLOCKED_PACKAGES, emptySet()) ?: emptySet()

  fun writeNight(context: Context, enabled: Boolean, blockedPackages: Set<String>) {
    prefs(context).edit()
      .putBoolean(KEY_NIGHT_ENABLED, enabled)
      .putStringSet(KEY_NIGHT_BLOCKED_PACKAGES, blockedPackages)
      .apply()
  }

  fun isNightEnabled(context: Context): Boolean = prefs(context).getBoolean(KEY_NIGHT_ENABLED, false) || isCommitted(context)

  fun nightBlockedPackages(context: Context): Set<String> =
    prefs(context).getStringSet(KEY_NIGHT_BLOCKED_PACKAGES, emptySet()) ?: emptySet()

  // WEBSITE block-list entries (2026-10-06): the domains kicked in the phone's browsers, per list.
  // Enforced under the same conditions as that list's apps (isActive / the night rule).
  private const val KEY_BLOCKED_DOMAINS = "blocked_domains"
  private const val KEY_NIGHT_BLOCKED_DOMAINS = "night_blocked_domains"

  fun writeBlockedDomains(context: Context, focus: Set<String>, night: Set<String>) {
    prefs(context).edit()
      .putStringSet(KEY_BLOCKED_DOMAINS, focus)
      .putStringSet(KEY_NIGHT_BLOCKED_DOMAINS, night)
      .apply()
  }

  fun blockedDomains(context: Context): Set<String> =
    prefs(context).getStringSet(KEY_BLOCKED_DOMAINS, emptySet()) ?: emptySet()

  fun nightBlockedDomains(context: Context): Set<String> =
    prefs(context).getStringSet(KEY_NIGHT_BLOCKED_DOMAINS, emptySet()) ?: emptySet()

  fun setNightWindow(context: Context, startMinutes: Int, endMinutes: Int, weekendStartMinutes: Int) {
    prefs(context).edit()
      .putInt(KEY_NIGHT_START_MINUTES, startMinutes)
      .putInt(KEY_NIGHT_END_MINUTES, endMinutes)
      .putInt(KEY_NIGHT_WEEKEND_START_MINUTES, weekendStartMinutes)
      .apply()
  }

  fun writeNightAppStarts(context: Context, json: String) {
    prefs(context).edit().putString(KEY_NIGHT_APP_STARTS, json).apply()
  }

  fun nightWeekendStartMinutes(context: Context): Int =
    prefs(context).getInt(KEY_NIGHT_WEEKEND_START_MINUTES, DEFAULT_NIGHT_WEEKEND_START_MINUTES)

  private fun nightAppStart(context: Context, identifier: String): JSONObject? {
    val raw = prefs(context).getString(KEY_NIGHT_APP_STARTS, null) ?: return null
    return runCatching { JSONObject(raw).optJSONObject(identifier) }.getOrNull()
  }

  fun hasOwnNightStart(context: Context, identifier: String): Boolean = nightAppStart(context, identifier) != null

  /**
   * When the night of `weekday` (Calendar.DAY_OF_WEEK) starts, for `identifier` when it has its
   * own start and for the general rule otherwise. 0 = from midnight: that evening is free.
   */
  fun nightStartFor(context: Context, weekday: Int, identifier: String? = null): Int {
    val weekend = NightBlockRules.isWeekendNight(weekday)
    val own = identifier?.let { nightAppStart(context, it) }
    val key = if (weekend) "w" else "s"
    if (own != null && own.has(key) && !own.isNull(key)) return own.getInt(key)
    return if (weekend) nightWeekendStartMinutes(context) else nightStartMinutes(context)
  }

  fun nightStartMinutes(context: Context): Int =
    prefs(context).getInt(KEY_NIGHT_START_MINUTES, DEFAULT_NIGHT_START_MINUTES)

  fun nightEndMinutes(context: Context): Int =
    prefs(context).getInt(KEY_NIGHT_END_MINUTES, DEFAULT_NIGHT_END_MINUTES)

  // The day the morning "¿Ya hiciste ejercicio?" was asked (2026-10-15): once a day, the first
  // time the phone is used after the night window.
  private const val KEY_MORNING_ASKED_DAY = "morning_asked_day"

  fun morningAskedDay(context: Context): String? = prefs(context).getString(KEY_MORNING_ASKED_DAY, null)

  fun setMorningAskedDay(context: Context, day: String) {
    prefs(context).edit().putString(KEY_MORNING_ASKED_DAY, day).apply()
  }

  fun wakeExerciseEndMinutes(context: Context): Int =
    prefs(context).getInt(KEY_WAKE_EXERCISE_END_MINUTES, DEFAULT_WAKE_EXERCISE_END_MINUTES)

  /**
   * Steps since the night window ended today. Before it ends, records the day's count as the
   * baseline (and returns 0); after, the count minus that baseline. With no check before the end
   * (the phone untouched all night) the baseline is 0: every step today counts, which are
   * the morning's anyway.
   */
  fun stepsSinceWake(context: Context, now: java.util.Calendar, nightEndMinutes: Int, stepsToday: Int): Int {
    val today = String.format(
      java.util.Locale.US,
      "%04d-%02d-%02d",
      now.get(java.util.Calendar.YEAR),
      now.get(java.util.Calendar.MONTH) + 1,
      now.get(java.util.Calendar.DAY_OF_MONTH),
    )
    val minute = now.get(java.util.Calendar.HOUR_OF_DAY) * 60 + now.get(java.util.Calendar.MINUTE)
    val p = prefs(context)
    if (minute < nightEndMinutes) {
      p.edit().putString(KEY_WAKE_STEPS_DAY, today).putInt(KEY_WAKE_STEPS_BASELINE, stepsToday).apply()
      return 0
    }
    val baseline = if (p.getString(KEY_WAKE_STEPS_DAY, null) == today) p.getInt(KEY_WAKE_STEPS_BASELINE, 0) else 0
    return (stepsToday - baseline).coerceAtLeast(0)
  }

  // Task 8.2: remembers whether the morning portion's jog/step unlock was still blocking as of
  // the last accessibility event, purely so FocusBlockAccessibilityService can detect the
  // true->false transition (the actual unlock moment) and log exactly one NIGHT_UNLOCK event for
  // it, not a boolean it makes any blocking decision from.
  private const val KEY_WAS_MORNING_BLOCKING = "was_morning_blocking"

  fun wasMorningBlocking(context: Context): Boolean = prefs(context).getBoolean(KEY_WAS_MORNING_BLOCKING, false)

  fun setWasMorningBlocking(context: Context, value: Boolean) {
    prefs(context).edit().putBoolean(KEY_WAS_MORNING_BLOCKING, value).apply()
  }

  // Task 8.2: a small pending queue for BlockEvent rows (tasks.md 8.2), the only channel this
  // service has to hand telemetry to JS -- same reasoning as KEY_ACTIVE/KEY_NIGHT_ENABLED above,
  // just in the opposite direction (native writes, JS reads/drains instead of JS writes/native
  // reads). Stored as one JSON-array string rather than a StringSet: a StringSet is unordered and
  // has no room for structured fields (identifier/scope/trigger/occurredAt) per entry. org.json is
  // built into the Android SDK, no new dependency. Capped at MAX_PENDING_EVENTS so a device that
  // goes a long time without the RN process running (this service can outlive it, see
  // FocusBlockAccessibilityService.kt's doc comment) can't grow this pref file unbounded -- drops
  // the oldest events first, since "some telemetry lost after an extreme backlog" is a far better
  // failure mode than an ever-growing SharedPreferences file.
  private const val KEY_PENDING_BLOCK_EVENTS = "pending_block_events"
  private const val MAX_PENDING_EVENTS = 500
  private val isoFormat =
    SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }

  fun addPendingBlockEvent(context: Context, identifier: String?, scope: String, trigger: String) {
    val event = JSONObject().apply {
      put("id", UUID.randomUUID().toString())
      put("identifier", identifier)
      put("scope", scope)
      put("trigger", trigger)
      put("occurredAt", isoFormat.format(Date()))
    }

    val sharedPrefs = prefs(context)
    val current = readPendingEvents(sharedPrefs)
    current.put(event)

    val trimmed = if (current.length() > MAX_PENDING_EVENTS) {
      JSONArray(List(MAX_PENDING_EVENTS) { index -> current.get(current.length() - MAX_PENDING_EVENTS + index) })
    } else {
      current
    }

    sharedPrefs.edit().putString(KEY_PENDING_BLOCK_EVENTS, trimmed.toString()).apply()
  }

  // Reads and clears atomically (from this process's single-threaded perspective -- SharedPreferences
  // itself serializes concurrent edits) so a JS-side read can never double-deliver the same batch.
  fun drainPendingBlockEvents(context: Context): List<Map<String, String?>> {
    val sharedPrefs = prefs(context)
    val current = readPendingEvents(sharedPrefs)
    if (current.length() == 0) return emptyList()

    sharedPrefs.edit().remove(KEY_PENDING_BLOCK_EVENTS).apply()

    return List(current.length()) { index ->
      val event = current.getJSONObject(index)
      mapOf(
        "id" to event.getString("id"),
        "identifier" to if (event.isNull("identifier")) null else event.getString("identifier"),
        "scope" to event.getString("scope"),
        "trigger" to event.getString("trigger"),
        "occurredAt" to event.getString("occurredAt"),
      )
    }
  }

  private fun readPendingEvents(sharedPrefs: SharedPreferences): JSONArray {
    val raw = sharedPrefs.getString(KEY_PENDING_BLOCK_EVENTS, null) ?: return JSONArray()
    return try {
      JSONArray(raw)
    } catch (e: org.json.JSONException) {
      JSONArray()
    }
  }
}
