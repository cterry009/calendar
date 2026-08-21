package expo.modules.focusblock

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

// Deep-link scheme registered in apps/mobile/app.json ("scheme": "calendarproductivity") --
// expo-router picks this up automatically and routes it to app/blocked.tsx (task 6.7).
private const val DEEP_LINK_SCHEME = "calendarproductivity"
private const val CHANNEL_ID = "focus_block_alerts"
private const val NOTIFICATION_ID = 8221

/**
 * Task 6.7 fix. `FocusBlockAccessibilityService.startActivity()` alone never surfaced the
 * /blocked screen -- confirmed on a real device that Android's background-activity-launch
 * restrictions (Android 10+) silently drop an Activity start triggered by a Service reacting to
 * a system event, not a direct foreground user interaction. A `fullScreenIntent` notification is
 * the standard, Android-sanctioned way around this (same mechanism incoming-call and alarm apps
 * use) -- the OS itself launches the Activity on the notification's behalf once the user (or the
 * system, for a full-screen intent) triggers it.
 *
 * Two real dependencies this can silently no-op on, both surfaced in the "Bloqueo real" card
 * (blocklist.tsx) the same way accessibility-service status already is: POST_NOTIFICATIONS
 * (Android 13+, shared with the existing expo-notifications permission from task 6.4 -- if the
 * user already granted it there, this works too) and, Android 14+ specifically,
 * `USE_FULL_SCREEN_INTENT` is no longer auto-granted and needs its own explicit Settings toggle
 * (`canUseFullScreenIntent()`/`ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT`).
 */
internal object FocusBlockNotifications {
  private fun ensureChannel(context: Context) {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return

    val channel = NotificationChannel(
      CHANNEL_ID,
      "Bloqueo de apps",
      NotificationManager.IMPORTANCE_HIGH,
    ).apply {
      description = "Avisa cuando abris una app bloqueada durante un enfoque activo."
    }
    manager.createNotificationChannel(channel)
  }

  fun canUseFullScreenIntent(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return true
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    return manager.canUseFullScreenIntent()
  }

  fun showBlockedAlert(context: Context, blockedPackage: String) {
    if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return

    ensureChannel(context)

    val deepLinkIntent = Intent(Intent.ACTION_VIEW, Uri.parse("$DEEP_LINK_SCHEME://blocked?package=$blockedPackage"))
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)

    val pendingIntent = PendingIntent.getActivity(
      context,
      NOTIFICATION_ID,
      deepLinkIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
      .setContentTitle("App bloqueada")
      .setContentText("Volviste a un enfoque activo -- toca para volver a la app.")
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setFullScreenIntent(pendingIntent, true)
      .setContentIntent(pendingIntent)
      .setAutoCancel(true)
      .build()

    NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
  }
}
