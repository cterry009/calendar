package expo.modules.screentime

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Process
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ScreenTimeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ScreenTime")

    // PACKAGE_USAGE_STATS can't be requested at runtime like a normal dangerous permission -- a
    // plain checkSelfPermission on it always reports denied even once the user has granted usage
    // access from Settings, since it's backed by AppOps rather than the standard permission
    // system. AppOpsManager.checkOpNoThrow (or its non-deprecated unsafeCheckOpNoThrow on API 29+)
    // is the actual source of truth.
    Function("hasUsageAccess") {
      appContext.reactContext?.let { context -> hasUsageAccess(context) } ?: false
    }

    // Deep-links to the exact settings screen where the user flips that toggle -- same
    // can't-enable-programmatically pattern as FocusBlockModule's accessibility/full-screen-intent/
    // battery-optimization settings links.
    Function("openUsageAccessSettings") {
      appContext.reactContext?.let { context ->
        context.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      }
    }

    // startMillis/endMillis define the query window (e.g. today, or the last 7 days) -- the
    // caller decides, this module has no opinion on it. queryUsageStats can return more than one
    // UsageStats entry per package across a range (the system buckets its own stats DB
    // internally), so totals are summed per package here rather than trusting one-row-per-app.
    Function("getAppUsage") { startMillis: Double, endMillis: Double ->
      appContext.reactContext?.let { context -> queryAppUsage(context, startMillis.toLong(), endMillis.toLong()) }
        ?: emptyList<Map<String, Any>>()
    }
  }
}

private fun hasUsageAccess(context: Context): Boolean {
  val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
  val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
    appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
  } else {
    @Suppress("DEPRECATION")
    appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
  }
  return mode == AppOpsManager.MODE_ALLOWED
}

private fun queryAppUsage(context: Context, startMillis: Long, endMillis: Long): List<Map<String, Any>> {
  val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
  val stats = usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startMillis, endMillis)
    ?: return emptyList()

  val totalsByPackage = mutableMapOf<String, Long>()
  for (usageStats in stats) {
    if (usageStats.totalTimeInForeground <= 0) continue
    totalsByPackage[usageStats.packageName] =
      (totalsByPackage[usageStats.packageName] ?: 0L) + usageStats.totalTimeInForeground
  }

  return totalsByPackage.map { (packageName, totalTimeMs) ->
    mapOf("packageName" to packageName, "totalTimeMs" to totalTimeMs)
  }
}
