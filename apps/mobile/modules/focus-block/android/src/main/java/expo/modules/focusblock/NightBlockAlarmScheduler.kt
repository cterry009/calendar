package expo.modules.focusblock

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import java.util.Calendar

/**
 * Schedules the "night block is starting" alarm the user asked for: something that actually
 * fires and makes noise right when the configured window opens, not just a passive reminder to
 * open the app. Uses AlarmManager.setAlarmClock rather than setExactAndAllowWhileIdle -- alarm-
 * clock-style alarms are the one AlarmManager mode that's both exempt from the SCHEDULE_EXACT_ALARM
 * permission gate Android 12+ added for regular exact alarms, and exempt from Doze/App Standby
 * deferral, which matters here for exactly the reason NightBlockRules.kt's own doc comment gives:
 * this has to fire reliably while the user (and often the RN process) is asleep.
 *
 * Re-armed from FocusBlockModule's setNightWindow/setNightBlockingState -- both already fire
 * on every relevant JS-side change (useNightBlocking.ts), so no new JS wiring was needed. Also
 * re-armed on boot and app update by NightBlockAlarmReceiver, since AlarmManager entries don't
 * survive either.
 */
internal object NightBlockAlarmScheduler {
  private const val REQUEST_CODE = 8231

  private fun alarmOperation(context: Context): PendingIntent =
    PendingIntent.getBroadcast(
      context,
      REQUEST_CODE,
      Intent(context, NightBlockAlarmReceiver::class.java),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

  // Real bug found and fixed: this used to let a SecurityException from setAlarmClock() propagate
  // straight up through FocusBlockModule's setNightWindow/setNightBlockingState (called from
  // useNightBlocking.ts on every app launch) and crash the whole render tree -- confirmed
  // on-device, traced to the manifest missing SCHEDULE_EXACT_ALARM entirely (fixed there too; see
  // AndroidManifest.xml's comment). Caught here as well, defense-in-depth: a missing/revoked exact
  // alarm permission should mean "no night-start alarm", not "no app", same tolerance the rest of
  // this module already gives missing permissions elsewhere (accessibility service, battery
  // optimization, full-screen intent).
  fun reschedule(context: Context) {
    try {
      val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
      val operation = alarmOperation(context)

      if (!FocusBlockPrefs.isNightEnabled(context)) {
        alarmManager.cancel(operation)
        return
      }

      val triggerAt = nextTriggerMillis(context)
      // Shown if the user taps the alarm-clock icon in the status bar before it fires -- reuses the
      // app's own launch intent rather than building one by hand (see the FocusBlockModule doc
      // comment on Class.forName-style package-name assembly being the kind of thing that only
      // breaks on a real device).
      val showIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
        PendingIntent.getActivity(context, REQUEST_CODE, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      }

      alarmManager.setAlarmClock(AlarmManager.AlarmClockInfo(triggerAt, showIntent), operation)
    } catch (error: SecurityException) {
      // No exact-alarm permission available -- degrade to no alarm rather than crashing.
    }
  }

  // The next night's general start, day by day since it depends on the weekday (weekend-mode). A
  // start of 0 (from midnight) fires at the next day's 00:00. The earlier per-app starts have no
  // alarm: they're warned about while the app is in use.
  private fun nextTriggerMillis(context: Context): Long {
    val now = Calendar.getInstance()
    for (ahead in 0..7) {
      val trigger = Calendar.getInstance().apply {
        add(Calendar.DAY_OF_YEAR, ahead)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
      }
      val start = FocusBlockPrefs.nightStartFor(context, trigger.get(Calendar.DAY_OF_WEEK))
      if (start == 0) trigger.add(Calendar.DAY_OF_YEAR, 1)
      trigger.set(Calendar.HOUR_OF_DAY, start / 60)
      trigger.set(Calendar.MINUTE, start % 60)
      if (trigger.after(now)) return trigger.timeInMillis
    }
    return now.timeInMillis + 24 * 60 * 60_000L
  }
}
