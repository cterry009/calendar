package expo.modules.focusblock

import android.view.accessibility.AccessibilityNodeInfo
import java.util.Locale

/**
 * The block commitment on the phone (weekend-mode, user 2026-11-04: "que no se pueda cerrar la
 * aplicación"). Settings stays open on purpose (FocusBlockAccessibilityService's allowlist): only
 * the screens that would stop this app are closed -- its App info (force stop, uninstall), its
 * accessibility toggle, its device admin page and the uninstall dialog.
 *
 * Android doesn't say which Settings page is showing, so this reads the screen: this app's name
 * together with one of the words of those screens. The list of all apps or of accessibility
 * services shows the name but not the words, so it stays usable. It reads what the system shows in
 * Spanish or English; a phone in another language isn't guarded.
 */
internal object CommitmentGuard {
  private const val MAX_NODES = 400

  private val GUARDED_PACKAGES = setOf(
    "com.google.android.packageinstaller",
    "com.android.packageinstaller",
    "com.miui.securitycenter",
  )

  private val DANGER_WORDS = listOf(
    "forzar detención",
    "forzar detencion",
    "forzar cierre",
    "forzar la detención",
    "force stop",
    "desinstalar",
    "uninstall",
    "desactivar esta app",
    "deactivate this",
    "administrador del dispositivo",
    "device admin",
  )

  fun isGuardedPackage(pkg: String): Boolean = pkg in GUARDED_PACKAGES || pkg.endsWith(".settings")

  /** The texts on screen, lowercased, up to MAX_NODES nodes. */
  fun screenTexts(root: AccessibilityNodeInfo?): List<String> {
    root ?: return emptyList()
    val out = mutableListOf<String>()
    val queue = ArrayDeque<AccessibilityNodeInfo>()
    queue.add(root)
    var seen = 0
    while (queue.isNotEmpty() && seen < MAX_NODES) {
      val node = queue.removeFirst()
      seen++
      node.text?.toString()?.let { out.add(it.lowercase(Locale.ROOT)) }
      node.contentDescription?.toString()?.let { out.add(it.lowercase(Locale.ROOT)) }
      for (i in 0 until node.childCount) runCatching { node.getChild(i) }.getOrNull()?.let(queue::add)
    }
    return out
  }

  /** This app's name on screen, plus a word of the screens that stop it or its accessibility toggle. */
  fun isDangerousScreen(texts: List<String>, appLabel: String): Boolean {
    val label = appLabel.lowercase(Locale.ROOT)
    if (texts.none { label in it }) return false
    if (texts.any { text -> DANGER_WORDS.any { it in text } }) return true
    // The accessibility page: its switch reads "Usar <app>" / "Use <app>".
    return texts.any { it == "usar $label" || it == "use $label" }
  }
}
