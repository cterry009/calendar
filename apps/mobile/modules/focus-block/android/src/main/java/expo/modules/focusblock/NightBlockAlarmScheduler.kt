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

  fun reschedule(context: Context) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
    val operation = alarmOperation(context)

    if (!FocusBlockPrefs.isNightEnabled(context)) {
      alarmManager.cancel(operation)
      return
    }

    val triggerAt = nextTriggerMillis(FocusBlockPrefs.nightStartMinutes(context))
    // Shown if the user taps the alarm-clock icon in the status bar before it fires -- reuses the
    // app's own launch intent rather than building one by hand (see the FocusBlockModule doc
    // comment on Class.forName-style package-name assembly being the kind of thing that only
    // breaks on a real device).
    val showIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
      PendingIntent.getActivity(context, REQUEST_CODE, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    alarmManager.setAlarmClock(AlarmManager.AlarmClockInfo(triggerAt, showIntent), operation)
  }

  // Next occurrence of startMinutes (minutes-since-midnight): today if it hasn't passed yet,
  // tomorrow otherwise -- same "wraps to the next day" shape NightBlockRules.kt's own window
  // arithmetic uses.
  private fun nextTriggerMillis(startMinutes: Int): Long {
    val now = Calendar.getInstance()
    val trigger = Calendar.getInstance().apply {
      set(Calendar.HOUR_OF_DAY, startMinutes / 60)
      set(Calendar.MINUTE, startMinutes % 60)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
    }
    if (!trigger.after(now)) {
      trigger.add(Calendar.DAY_OF_YEAR, 1)
    }
    return trigger.timeInMillis
  }
}
