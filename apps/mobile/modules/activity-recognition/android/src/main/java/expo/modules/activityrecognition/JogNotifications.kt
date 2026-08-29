package expo.modules.activityrecognition

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

private const val CHANNEL_ID = "jog_detected"
private const val NOTIFICATION_ID = 4773

/**
 * User-requested follow-up (real-device testing session, task 11.13's continuation): a visible
 * confirmation the instant Play Services confirms a jog, not just the silent SharedPreferences
 * flag ActivityTransitionReceiver.kt already wrote. Fired natively (same reasoning as
 * FocusBlockNotifications.kt) rather than from JS -- ActivityTransitionReceiver runs independent
 * of the RN process, exactly the case where a jog is most likely to be detected (the app isn't
 * necessarily open while jogging), so a JS-side expo-notifications call wouldn't fire reliably.
 */
internal object JogNotifications {
  private fun ensureChannel(context: Context) {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return

    val channel = NotificationChannel(
      CHANNEL_ID,
      "Deteccion de trote",
      NotificationManager.IMPORTANCE_DEFAULT,
    ).apply {
      description = "Avisa cuando se detecta que estas trotando."
    }
    manager.createNotificationChannel(channel)
  }

  fun showJogDetected(context: Context) {
    if (ContextCompat.checkSelfPermission(context, android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
      return
    }

    ensureChannel(context)

    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_menu_directions)
      .setContentTitle("Trote detectado")
      .setContentText("Se registro un entrenamiento de \"Trote\" automaticamente.")
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .setAutoCancel(true)
      .build()

    NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
  }
}
