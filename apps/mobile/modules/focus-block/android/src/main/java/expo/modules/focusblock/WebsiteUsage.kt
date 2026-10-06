package expo.modules.focusblock

import android.content.Context
import android.view.accessibility.AccessibilityNodeInfo
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import org.json.JSONObject

/**
 * Time per website on the phone (user-requested, 2026-10-06), so the block list can suggest the
 * sites the user actually spends time on, and the site being shown so a blocked one can be kicked.
 * Android has no API for "which site is open in the browser", so FocusBlockAccessibilityService
 * reads the browser's own address bar (by view id, the same way every Android site blocker does).
 * Only the domain is kept: never the path, query or page contents.
 *
 * Stored per local day in SharedPreferences (domain -> milliseconds), the last KEEP_DAYS days.
 */
internal object WebsiteUsage {
  private const val PREFS_NAME = "website_usage"
  private const val KEEP_DAYS = 8

  // Browser package -> its address-bar view ids. Chromium-based ones share Chrome's id.
  private val ADDRESS_BARS = mapOf(
    "com.android.chrome" to listOf("com.android.chrome:id/url_bar"),
    "com.chrome.beta" to listOf("com.chrome.beta:id/url_bar"),
    "com.brave.browser" to listOf("com.brave.browser:id/url_bar"),
    "com.microsoft.emmx" to listOf("com.microsoft.emmx:id/url_bar"),
    "com.vivaldi.browser" to listOf("com.vivaldi.browser:id/url_bar"),
    "com.opera.browser" to listOf("com.opera.browser:id/url_field", "com.opera.browser:id/url_bar"),
    "com.sec.android.app.sbrowser" to listOf(
      "com.sec.android.app.sbrowser:id/location_bar_edit_text",
      "com.sec.android.app.sbrowser:id/custom_tab_toolbar_url_bar_text",
    ),
    "org.mozilla.firefox" to listOf("org.mozilla.firefox:id/mozac_browser_toolbar_url_view"),
    "com.duckduckgo.mobile.android" to listOf("com.duckduckgo.mobile.android:id/omnibarTextInput"),
  )

  fun isBrowser(pkg: String): Boolean = pkg in ADDRESS_BARS

  /** The domain the browser is showing, or null (no address bar on screen, or the user is typing in it). */
  fun currentDomain(root: AccessibilityNodeInfo?, pkg: String): String? {
    root ?: return null
    for (id in ADDRESS_BARS[pkg] ?: return null) {
      val nodes = runCatching { root.findAccessibilityNodeInfosByViewId(id) }.getOrNull() ?: continue
      for (node in nodes) {
        // Focused = the user is typing a search or address, not looking at a site.
        if (node.isFocused) continue
        val domain = domainOf(node.text?.toString() ?: continue)
        if (domain != null) return domain
      }
    }
    return null
  }

  /** "https://www.YouTube.com/watch?v=1" or the bar's own "youtube.com/watch" -> "youtube.com". */
  fun domainOf(text: String): String? {
    var rest = text.trim().lowercase(Locale.ROOT)
    if (rest.isEmpty() || rest.contains(' ')) return null
    rest = rest.substringAfter("://")
    val host = rest.substringBefore('/').substringBefore('?').substringBefore('#')
      .substringAfterLast('@').substringBefore(':')
    val bare = host.removePrefix("www.").removePrefix("m.")
    if (!bare.contains('.') || bare.startsWith('.') || bare.endsWith('.')) return null
    if (!bare.all { it.isLetterOrDigit() || it == '.' || it == '-' }) return null
    return bare
  }

  /** Whether `domain` is `entry` or one of its subdomains. */
  fun matches(domain: String, entry: String): Boolean {
    val e = entry.removePrefix("www.")
    return domain == e || domain.endsWith(".$e")
  }

  private fun dayKey(time: Long): String = SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(Date(time))

  fun add(context: Context, domain: String, ms: Long) {
    if (ms <= 0) return
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val now = System.currentTimeMillis()
    val key = dayKey(now)
    val day = runCatching { JSONObject(prefs.getString(key, "{}") ?: "{}") }.getOrDefault(JSONObject())
    day.put(domain, day.optLong(domain, 0L) + ms)
    val edit = prefs.edit().putString(key, day.toString())
    val oldest = Calendar.getInstance().apply { add(Calendar.DAY_OF_YEAR, -KEEP_DAYS) }.timeInMillis
    val oldestKey = dayKey(oldest)
    for (stored in prefs.all.keys) if (stored < oldestKey) edit.remove(stored)
    edit.apply()
  }

  /** Milliseconds per domain over the local days touching [startMs, endMs], most used first. */
  fun usage(context: Context, startMs: Long, endMs: Long): List<Map<String, Any>> {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val from = dayKey(startMs)
    val to = dayKey(endMs)
    val totals = HashMap<String, Long>()
    for ((key, value) in prefs.all) {
      if (key < from || key > to || value !is String) continue
      val day = runCatching { JSONObject(value) }.getOrNull() ?: continue
      for (domain in day.keys()) totals[domain] = (totals[domain] ?: 0L) + day.optLong(domain, 0L)
    }
    return totals.entries
      .sortedByDescending { it.value }
      .map { mapOf("domain" to it.key, "totalTimeMs" to it.value.toDouble()) }
  }
}
