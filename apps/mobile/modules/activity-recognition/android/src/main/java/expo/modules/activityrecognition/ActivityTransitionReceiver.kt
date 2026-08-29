package expo.modules.activityrecognition

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.ActivityTransitionResult
import com.google.android.gms.location.DetectedActivity

/**
 * Task 11.2. Registered via ActivityRecognitionModule.startTracking()'s PendingIntent, so this
 * fires even with the RN JS process fully killed -- exactly why ActivityRecognitionClient was
 * chosen over a homegrown expo-sensors cadence heuristic, which stops delivering the moment the
 * app backgrounds (same limitation already documented for useDailySteps.ts).
 *
 * A transition event here only fires once Play Services' own on-device classifier is confident
 * enough to cross the RUNNING threshold -- unlike a raw accelerometer sample, it's already
 * smoothed over several seconds of consistent signal by Google's model, so a single ENTER event
 * is treated as a real confirmation rather than debounced further on this side.
 */
class ActivityTransitionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (!ActivityTransitionResult.hasResult(intent)) return
    val result = ActivityTransitionResult.extractResult(intent) ?: return
    val now = System.currentTimeMillis()

    for (event in result.transitionEvents) {
      if (event.activityType != DetectedActivity.RUNNING) continue

      when (event.transitionType) {
        ActivityTransition.ACTIVITY_TRANSITION_ENTER -> {
          // Marked confirmed immediately, not deferred until the run finishes -- jog-to-unlock
          // enforcement (task 11.11) needs to lift the block the moment a run actually starts,
          // not only once it's over.
          JogDetectionPrefs.setJoggedToday(context)
          JogDetectionPrefs.recordRunningEnter(context, now)
          JogNotifications.showJogDetected(context)
        }
        ActivityTransition.ACTIVITY_TRANSITION_EXIT -> {
          JogDetectionPrefs.recordRunningExit(context, now)
        }
      }
    }
  }
}
