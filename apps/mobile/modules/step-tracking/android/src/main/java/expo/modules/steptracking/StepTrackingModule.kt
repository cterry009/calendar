package expo.modules.steptracking

import android.content.Context
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorManager
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class StepTrackingModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("StepTracking")

    // Fire-and-forget, called once per app session (useStepTrackingService.ts, mounted at the
    // app root). ContextCompat.startForegroundService is required (not a plain startService) --
    // Android kills a background-started service that doesn't call startForeground() within a
    // few seconds, which StepTrackingService.onStartCommand does immediately.
    Function("startTracking") {
      appContext.reactContext?.let { context ->
        ContextCompat.startForegroundService(context, Intent(context, StepTrackingService::class.java))
      }
    }

    Function("stopTracking") {
      appContext.reactContext?.let { context ->
        context.stopService(Intent(context, StepTrackingService::class.java))
      }
    }

    Function("setDailyGoal") { goal: Int ->
      appContext.reactContext?.let { context -> StepTrackingPrefs.setDailyGoal(context, goal) }
    }

    Function("getDailyGoal") {
      appContext.reactContext?.let { context -> StepTrackingPrefs.getDailyGoal(context) } ?: 8000
    }

    Function("getDailySteps") {
      appContext.reactContext?.let { context -> StepTrackingPrefs.getDailySteps(context) } ?: 0
    }

    Function("isStepSensorAvailable") {
      appContext.reactContext?.let { context ->
        val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
        sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null
      } ?: false
    }
  }
}
