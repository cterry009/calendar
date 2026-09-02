package expo.modules.focusblock

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Fires when the configured night-block start time arrives, via
 * NightBlockAlarmScheduler.reschedule's AlarmManager.setAlarmClock. Also registered (see
 * AndroidManifest.xml) for BOOT_COMPLETED and MY_PACKAGE_REPLACED -- AlarmManager entries are
 * cleared on both a reboot and an app update, so those are the only way the alarm survives either
 * without the user having to reopen the app first.
 */
class NightBlockAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) {
      NightBlockAlarmScheduler.reschedule(context)
      return
    }

    if (FocusBlockPrefs.isNightEnabled(context)) {
      FocusBlockNotifications.showNightBlockStartingAlert(context)
    }
    // setAlarmClock fires once -- always re-arm for tomorrow, even if isNightEnabled was false
    // just now, so a mid-window disable-then-re-enable doesn't leave the alarm permanently dead.
    NightBlockAlarmScheduler.reschedule(context)
  }
}
