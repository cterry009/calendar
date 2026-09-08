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
  private const val DEFAULT_NIGHT_START_MINUTES = 22 * 60 + 30
  private const val DEFAULT_NIGHT_END_MINUTES = 8 * 60

  private fun prefs(context: Context): SharedPreferences =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  fun write(context: Context, active: Boolean, blockedPackages: Set<String>, lockdown: Boolean) {
    prefs(context).edit()
      .putBoolean(KEY_ACTIVE, active)
      .putStringSet(KEY_BLOCKED_PACKAGES, blockedPackages)
      .putBoolean(KEY_LOCKDOWN, lockdown)
      .apply()
  }

  fun isActive(context: Context): Boolean = prefs(context).getBoolean(KEY_ACTIVE, false)

  fun isLockdown(context: Context): Boolean = prefs(context).getBoolean(KEY_LOCKDOWN, false)

  fun blockedPackages(context: Context): Set<String> =
    prefs(context).getStringSet(KEY_BLOCKED_PACKAGES, emptySet()) ?: emptySet()

  fun writeNight(context: Context, enabled: Boolean, blockedPackages: Set<String>) {
    prefs(context).edit()
      .putBoolean(KEY_NIGHT_ENABLED, enabled)
      .putStringSet(KEY_NIGHT_BLOCKED_PACKAGES, blockedPackages)
      .apply()
  }

  fun isNightEnabled(context: Context): Boolean = prefs(context).getBoolean(KEY_NIGHT_ENABLED, false)

  fun nightBlockedPackages(context: Context): Set<String> =
    prefs(context).getStringSet(KEY_NIGHT_BLOCKED_PACKAGES, emptySet()) ?: emptySet()

  fun setNightWindow(context: Context, startMinutes: Int, endMinutes: Int) {
    prefs(context).edit()
      .putInt(KEY_NIGHT_START_MINUTES, startMinutes)
      .putInt(KEY_NIGHT_END_MINUTES, endMinutes)
      .apply()
  }

  fun nightStartMinutes(context: Context): Int =
    prefs(context).getInt(KEY_NIGHT_START_MINUTES, DEFAULT_NIGHT_START_MINUTES)

  fun nightEndMinutes(context: Context): Int =
    prefs(context).getInt(KEY_NIGHT_END_MINUTES, DEFAULT_NIGHT_END_MINUTES)

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
