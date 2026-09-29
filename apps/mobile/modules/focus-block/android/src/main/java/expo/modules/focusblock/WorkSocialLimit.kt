package expo.modules.focusblock

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.SharedPreferences
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import org.json.JSONArray
import java.util.Calendar

/**
 * Strict social-media limit during work hours -- the Android half of the desktop's work-hours
 * game limit (packages/shared/src/screenTime/usageWarnings.ts has the same numbers):
 * warning at 60 min, final warning at 90 ("the next one closes it"), a 5-minute countdown at the
 * next step of the escalation (120), then every listed social app is kicked out until the work
 * block ends.
 *
 * **Native on purpose, same reasoning as NightBlockRules.** The JS side can only read usage while
 * the app is in the foreground, which is exactly when you are *not* scrolling Instagram. The
 * accessibility service is resident, so it evaluates the rule itself -- on every app switch and on
 * a 60s tick while a social app stays in front -- from state JS pushed once (the WORK schedules and
 * the social package list). Correct with the RN process dead.
 *
 * Minutes come from UsageEvents (resume/pause pairs), not queryUsageStats' aggregates: the
 * aggregates only fold in a session when it ends, and the session in progress is the one that
 * matters here.
 */
internal object WorkSocialLimit {
  const val WARNING_MINUTES = 60
  const val FINAL_WARNING_MINUTES = 90
  const val CLOSE_GRACE_MS = 5 * 60_000L

  private const val PREFS_NAME = "work_social_limit"
  private const val KEY_WINDOWS = "work_windows"
  private const val KEY_PACKAGES = "social_packages"
  private const val KEY_DAY = "day"
  private const val KEY_LAST_WARNED = "last_warned_minutes"
  private const val KEY_FINAL_GIVEN = "final_given"
  private const val KEY_DEADLINE = "close_deadline"

  private const val CHANNEL_ID = "work_social_limit"
  private const val NOTIFICATION_ID = 8241

  data class WorkWindow(val days: Set<Int>, val startMinute: Int, val endMinute: Int)

  sealed class Decision {
    object None : Decision()
    data class Notify(val title: String, val body: String) : Decision()
    object Block : Decision()
  }

  private fun prefs(context: Context): SharedPreferences =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  // ---- Config pushed from JS ----

  /** windowsJson: [{"days":[1,2,3],"start":540,"end":630}, ...] (days: 0 = Sunday, like JS). */
  fun writeConfig(context: Context, windowsJson: String, socialPackages: Set<String>) {
    prefs(context).edit()
      .putString(KEY_WINDOWS, windowsJson)
      .putStringSet(KEY_PACKAGES, socialPackages)
      .apply()
  }

  fun socialPackages(context: Context): Set<String> =
    prefs(context).getStringSet(KEY_PACKAGES, emptySet()) ?: emptySet()

  private fun windows(context: Context): List<WorkWindow> {
    val raw = prefs(context).getString(KEY_WINDOWS, null) ?: return emptyList()
    return runCatching {
      val array = JSONArray(raw)
      (0 until array.length()).map { i ->
        val item = array.getJSONObject(i)
        val days = item.getJSONArray("days")
        WorkWindow(
          (0 until days.length()).map { days.getInt(it) }.toSet(),
          item.getInt("start"),
          item.getInt("end"),
        )
      }
    }.getOrDefault(emptyList())
  }

  // ---- Pure rules (mirrors usageWarnings.ts) ----

  fun isInWorkWindow(now: Calendar, windows: List<WorkWindow>): Boolean {
    val day = now.get(Calendar.DAY_OF_WEEK) - 1 // Calendar: 1 = Sunday -> JS: 0 = Sunday
    val minute = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)
    return windows.any { day in it.days && minute >= it.startMinute && minute < it.endMinute }
  }

  fun warningInterval(minutes: Int): Int = when {
    minutes >= 180 -> 5
    minutes >= 120 -> 15
    else -> 30
  }

  fun nextThreshold(lastWarned: Int?): Int =
    if (lastWarned == null) WARNING_MINUTES else lastWarned + warningInterval(lastWarned)

  fun isWorkHours(context: Context): Boolean = isInWorkWindow(Calendar.getInstance(), windows(context))

  // ---- Per-day state ----

  private fun dayKey(now: Calendar): String =
    "${now.get(Calendar.YEAR)}-${now.get(Calendar.DAY_OF_YEAR)}"

  private fun stateFor(context: Context, now: Calendar): SharedPreferences {
    val p = prefs(context)
    val today = dayKey(now)
    if (p.getString(KEY_DAY, null) != today) {
      p.edit()
        .putString(KEY_DAY, today)
        .remove(KEY_LAST_WARNED)
        .remove(KEY_FINAL_GIVEN)
        .remove(KEY_DEADLINE)
        .apply()
    }
    return p
  }

  /**
   * What to do right now, given that [foregroundPackage] is in front. Records warnings as given,
   * so calling it repeatedly (every event, every tick) fires each warning once.
   */
  fun evaluate(context: Context, foregroundPackage: String): Decision {
    val packages = socialPackages(context)
    if (foregroundPackage !in packages) return Decision.None
    val now = Calendar.getInstance()
    if (!isInWorkWindow(now, windows(context))) return Decision.None

    val state = stateFor(context, now)
    val deadline = state.getLong(KEY_DEADLINE, 0L)
    if (deadline > 0L) {
      return if (System.currentTimeMillis() >= deadline) Decision.Block else Decision.None
    }

    val minutes = socialMinutesToday(context, packages)
    val lastWarned = if (state.contains(KEY_LAST_WARNED)) state.getInt(KEY_LAST_WARNED, 0) else null
    if (minutes < nextThreshold(lastWarned)) return Decision.None

    val finalGiven = state.getBoolean(KEY_FINAL_GIVEN, false)
    val editor = state.edit().putInt(KEY_LAST_WARNED, minutes)
    val decision = when {
      finalGiven -> {
        editor.putLong(KEY_DEADLINE, System.currentTimeMillis() + CLOSE_GRACE_MS)
        Decision.Notify(
          "Las redes sociales se cierran en 5 minutos",
          "Llevas ${formatMinutes(minutes)} hoy en redes sociales. En 5 minutos se cierran y quedan bloqueadas hasta que termine tu horario de trabajo.",
        )
      }
      minutes >= FINAL_WARNING_MINUTES -> {
        editor.putBoolean(KEY_FINAL_GIVEN, true)
        Decision.Notify(
          "Último aviso en horario de trabajo",
          "Llevas ${formatMinutes(minutes)} hoy en redes sociales. El próximo aviso las cierra.",
        )
      }
      else -> Decision.Notify(
        "Una hora en redes sociales",
        "Llevas ${formatMinutes(minutes)} hoy en redes sociales y estás en horario de trabajo.",
      )
    }
    editor.apply()
    return decision
  }

  private fun formatMinutes(minutes: Int): String {
    val hours = minutes / 60
    val rest = minutes % 60
    return when {
      hours == 0 -> "$rest min"
      rest == 0 -> "$hours h"
      else -> "$hours h $rest min"
    }
  }

  // ---- Usage ----

  /** Foreground minutes today across [packages], including the session in progress. */
  fun socialMinutesToday(context: Context, packages: Set<String>): Int {
    val manager = context.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager ?: return 0
    val start = Calendar.getInstance().apply {
      set(Calendar.HOUR_OF_DAY, 0)
      set(Calendar.MINUTE, 0)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
    }.timeInMillis
    val end = System.currentTimeMillis()

    // Without usage access this returns no events and the limit simply never fires -- the same
    // permission the Tiempo de pantalla screen already asks for.
    val events = runCatching { manager.queryEvents(start, end) }.getOrNull() ?: return 0
    val openSince = HashMap<String, Long>()
    var totalMs = 0L
    val event = UsageEvents.Event()
    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      val pkg = event.packageName ?: continue
      if (pkg !in packages) continue
      when (event.eventType) {
        UsageEvents.Event.ACTIVITY_RESUMED -> openSince.putIfAbsent(pkg, event.timeStamp)
        UsageEvents.Event.ACTIVITY_PAUSED, UsageEvents.Event.ACTIVITY_STOPPED -> {
          openSince.remove(pkg)?.let { totalMs += event.timeStamp - it }
        }
      }
    }
    // Still open: count up to now.
    openSince.values.forEach { totalMs += end - it }
    return (totalMs / 60_000L).toInt()
  }

  // ---- Notification ----

  fun notify(context: Context, title: String, body: String) {
    if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(CHANNEL_ID) == null) {
      manager.createNotificationChannel(
        NotificationChannel(CHANNEL_ID, "Límite en horario de trabajo", NotificationManager.IMPORTANCE_HIGH).apply {
          description = "Avisos del límite de redes sociales durante tus bloques de trabajo."
        },
      )
    }
    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
    val pendingIntent = launchIntent?.let {
      PendingIntent.getActivity(context, NOTIFICATION_ID, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_dialog_alert)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setContentIntent(pendingIntent)
      .setAutoCancel(true)
      .build()
    NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
  }
}
