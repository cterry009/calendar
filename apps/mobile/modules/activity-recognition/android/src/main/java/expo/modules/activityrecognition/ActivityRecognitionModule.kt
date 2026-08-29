package expo.modules.activityrecognition

import android.Manifest
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.google.android.gms.location.ActivityRecognition
import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.ActivityTransitionRequest
import com.google.android.gms.location.DetectedActivity
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val PENDING_INTENT_REQUEST_CODE = 4771

class ActivityRecognitionModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ActivityRecognition")

    Function("hasPermission") {
      appContext.reactContext?.let { context -> hasActivityRecognitionPermission(context) } ?: false
    }

    // Fire-and-forget, called once per app session (useJogDetection.ts). Registers ENTER/EXIT
    // transition updates for RUNNING with Play Services, delivered to ActivityTransitionReceiver
    // -- no-ops silently if the permission isn't granted yet rather than throwing, since the
    // caller already checks/requests it first and this must never block app startup.
    Function("startTracking") {
      appContext.reactContext?.let { context ->
        if (!hasActivityRecognitionPermission(context)) return@let
        val client = ActivityRecognition.getClient(context)
        val request = ActivityTransitionRequest(buildTransitions())
        client.requestActivityTransitionUpdates(request, pendingIntent(context))
      }
    }

    Function("stopTracking") {
      appContext.reactContext?.let { context ->
        ActivityRecognition.getClient(context).removeActivityTransitionUpdates(pendingIntent(context))
      }
    }

    Function("hasJoggedToday") {
      appContext.reactContext?.let { context -> JogDetectionPrefs.hasJoggedToday(context) } ?: false
    }

    Function("getLastJogDurationMinutes") {
      appContext.reactContext?.let { context -> JogDetectionPrefs.getLastJogDurationMinutes(context) }
    }
  }
}

private fun hasActivityRecognitionPermission(context: Context): Boolean {
  // ACTIVITY_RECOGNITION only became a runtime (dangerous) permission on Android 10 (API 29) for
  // apps targeting 29+ -- below that it's a normal permission, auto-granted as long as it's
  // declared in the manifest (which it is, via this module's own AndroidManifest.xml fragment).
  if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return true
  return ContextCompat.checkSelfPermission(context, Manifest.permission.ACTIVITY_RECOGNITION) ==
    PackageManager.PERMISSION_GRANTED
}

private fun buildTransitions(): List<ActivityTransition> = listOf(
  ActivityTransition.Builder()
    .setActivityType(DetectedActivity.RUNNING)
    .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_ENTER)
    .build(),
  ActivityTransition.Builder()
    .setActivityType(DetectedActivity.RUNNING)
    .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_EXIT)
    .build(),
)

private fun pendingIntent(context: Context): PendingIntent {
  val intent = Intent(context, ActivityTransitionReceiver::class.java)
  // FLAG_MUTABLE: Play Services fills this PendingIntent's extras with the transition result --
  // an immutable PendingIntent would silently drop them (a real Android 12+ requirement, not
  // optional here, unlike most of this app's other PendingIntents).
  val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
  return PendingIntent.getBroadcast(context, PENDING_INTENT_REQUEST_CODE, intent, flags)
}
