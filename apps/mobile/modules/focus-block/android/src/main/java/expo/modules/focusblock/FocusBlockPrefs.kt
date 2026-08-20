package expo.modules.focusblock

import android.content.Context
import android.content.SharedPreferences

/**
 * The only channel between the JS-computed blocking state (apps/mobile/src/hooks/useFocusBlocking.ts)
 * and FocusBlockAccessibilityService, which runs independently of the JS engine (a system
 * AccessibilityService is not guaranteed to share a live RN bridge) and so cannot call back into JS
 * to ask "should I block right now?" on every foreground-app change. SharedPreferences is
 * same-process, synchronous, and cheap enough to read on every TYPE_WINDOW_STATE_CHANGED event.
 * Shared between FocusBlockModule (writer) and FocusBlockAccessibilityService (reader) so the key
 * names only exist in one place.
 */
internal object FocusBlockPrefs {
  private const val PREFS_NAME = "focus_block_state"
  private const val KEY_ACTIVE = "active"
  private const val KEY_BLOCKED_PACKAGES = "blocked_packages"

  private fun prefs(context: Context): SharedPreferences =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  fun write(context: Context, active: Boolean, blockedPackages: Set<String>) {
    prefs(context).edit()
      .putBoolean(KEY_ACTIVE, active)
      .putStringSet(KEY_BLOCKED_PACKAGES, blockedPackages)
      .apply()
  }

  fun isActive(context: Context): Boolean = prefs(context).getBoolean(KEY_ACTIVE, false)

  fun blockedPackages(context: Context): Set<String> =
    prefs(context).getStringSet(KEY_BLOCKED_PACKAGES, emptySet()) ?: emptySet()
}
