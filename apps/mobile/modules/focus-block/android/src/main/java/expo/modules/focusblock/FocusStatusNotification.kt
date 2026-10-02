package expo.modules.focusblock

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

private const val STATUS_CHANNEL_ID = "focus_status"
private const val STATUS_NOTIFICATION_ID = 8240

/**
 * The persistent "you're working" notification (user-requested, 2026-10-02): while a pomodoro or a
 * WORK schedule runs, which block it is and how long is left. The countdown is a native chronometer
 * (`setUsesChronometer` + `setChronometerCountDown`, target in `setWhen`), so the system redraws it
 * every second on its own -- no JS timer, and it keeps counting while the app is in the background
 * or its process has been reclaimed. JS (useFocusStatusNotification) only calls this when the
 * phase or block changes. Silent, low importance: it informs, it doesn't interrupt.
 */
internal object FocusStatusNotification {
  private fun ensureChannel(context: Context) {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(STATUS_CHANNEL_ID) != null) return
    val channel = NotificationChannel(STATUS_CHANNEL_ID, "Tiempo de trabajo", NotificationManager.IMPORTANCE_LOW).apply {
      description = "Muestra el bloque o pomodoro en curso y cuánto falta."
      setShowBadge(false)
    }
    manager.createNotificationChannel(channel)
  }

  fun show(context: Context, title: String, text: String, endsAtMs: Long) {
    if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return
    ensureChannel(context)

    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
    val contentIntent = launch?.let {
      PendingIntent.getActivity(context, STATUS_NOTIFICATION_ID, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    val notification = NotificationCompat.Builder(context, STATUS_CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setContentTitle(title)
      .setContentText(text)
      .setStyle(NotificationCompat.BigTextStyle().bigText(text))
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setShowWhen(true)
      .setWhen(endsAtMs)
      .setUsesChronometer(true)
      .setChronometerCountDown(true)
      .apply { contentIntent?.let { setContentIntent(it) } }
      .build()

    try {
      NotificationManagerCompat.from(context).notify(STATUS_NOTIFICATION_ID, notification)
    } catch (_: SecurityException) {
      // POST_NOTIFICATIONS revoked between the check above and now: nothing to show.
    }
  }

  fun clear(context: Context) {
    NotificationManagerCompat.from(context).cancel(STATUS_NOTIFICATION_ID)
  }
}
