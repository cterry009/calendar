package expo.modules.steptracking

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

private const val CHANNEL_ID = "step_tracking"
private const val NOTIFICATION_ID = 4774

/**
 * User-requested real background step tracking (not the Health-Connect-first design task 11.3
 * shipped with -- this is the fallback that design deliberately avoided building, revisited once
 * real-device testing found Health Connect itself doesn't work on this test hardware: the
 * `com.google.android.healthconnect.controller` package is present and enabled, but
 * androidx.health.connect:connect-client 1.1.0's compatibility check still reports it
 * unavailable for both known provider package names -- confirmed by inspecting the library's own
 * compiled strings, not guessed. A real device limitation, not a bug in this app's glue code.)
 *
 * A genuine Android foreground service reading `TYPE_STEP_COUNTER` directly via SensorManager,
 * independent of the RN JS process and of Health Connect entirely -- keeps counting and updating
 * its own persistent notification even with the app's JS killed, which is the whole point (the
 * user's original ask: "que la app corra de fondo... que siga corriendo"). The always-visible
 * notification isn't a side effect to minimize -- Android requires a foreground service to show
 * one, and here it doubles as exactly the live progress display the user asked for.
 */
class StepTrackingService : Service(), SensorEventListener {
  private var sensorManager: SensorManager? = null
  private var stepSensor: Sensor? = null

  override fun onCreate() {
    super.onCreate()
    sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
    stepSensor = sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
  }

  override fun onStartCommand(intent: android.content.Intent?, flags: Int, startId: Int): Int {
    ensureChannel()
    val notification = buildNotification(StepTrackingPrefs.getDailySteps(this), StepTrackingPrefs.getDailyGoal(this))

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }

    val sensor = stepSensor
    if (sensor != null && hasActivityRecognitionPermission()) {
      sensorManager?.registerListener(this, sensor, SensorManager.SENSOR_DELAY_NORMAL)
    }

    // Real device without a step-counter sensor at all: nothing to listen for, but the service
    // (and its notification) still runs rather than crash-looping on a null sensor -- same
    // "honest three states" tolerance useDailySteps.ts already applies to the JS-side sensor.
    return START_STICKY
  }

  override fun onSensorChanged(event: SensorEvent) {
    val raw = event.values[0]
    val today = StepTrackingPrefs.today()
    val baselineDay = StepTrackingPrefs.getBaselineDay(this)
    val baselineValue = StepTrackingPrefs.getBaselineValue(this)

    // New day, or the device rebooted since the baseline was captured (TYPE_STEP_COUNTER's raw
    // value is cumulative since boot, not since midnight, so a reboot makes it drop below any
    // baseline captured before it) -- either way, today's count restarts from this reading.
    if (baselineDay != today || raw < baselineValue) {
      StepTrackingPrefs.setBaseline(this, today, raw)
    }

    val steps = (raw - StepTrackingPrefs.getBaselineValue(this)).toInt().coerceAtLeast(0)
    StepTrackingPrefs.setDailySteps(this, steps)
    updateNotification(steps, StepTrackingPrefs.getDailyGoal(this))
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

  override fun onBind(intent: android.content.Intent?): IBinder? = null

  override fun onDestroy() {
    sensorManager?.unregisterListener(this)
    super.onDestroy()
  }

  private fun hasActivityRecognitionPermission(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return true
    return ContextCompat.checkSelfPermission(this, android.Manifest.permission.ACTIVITY_RECOGNITION) ==
      PackageManager.PERMISSION_GRANTED
  }

  private fun ensureChannel() {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return

    val channel = NotificationChannel(
      CHANNEL_ID,
      "Progreso de pasos",
      // LOW, not DEFAULT/HIGH: this updates on every few steps, a sound/heads-up per update
      // would be unusable -- same silent-but-visible tolerance Android's own Fit/Health
      // notifications use for step progress.
      NotificationManager.IMPORTANCE_LOW,
    ).apply {
      description = "Notificacion continua con tus pasos de hoy y tu progreso hacia la meta diaria."
    }
    manager.createNotificationChannel(channel)
  }

  private fun buildNotification(steps: Int, goal: Int): android.app.Notification {
    val remaining = (goal - steps).coerceAtLeast(0)
    val text = if (steps >= goal) "Meta cumplida por hoy" else "Faltan $remaining pasos para tu meta"

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_menu_directions)
      .setContentTitle("$steps pasos hoy")
      .setContentText(text)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setProgress(goal.coerceAtLeast(1), steps.coerceAtMost(goal), false)
      .build()
  }

  private fun updateNotification(steps: Int, goal: Int) {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.notify(NOTIFICATION_ID, buildNotification(steps, goal))
  }
}
