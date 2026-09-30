package expo.modules.focusblock

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.SharedPreferences
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONObject

/**
 * The phone's version of the desktop's "App bloqueada" popup (DesktopBlockedOverlay.tsx): a
 * full-screen card over whatever is on screen saying what was closed and why, an alternative
 * activity for that kind of app, and a motivational line.
 *
 * Drawn as a TYPE_ACCESSIBILITY_OVERLAY window by the accessibility service itself -- that window
 * type needs no extra permission and, unlike starting an Activity (blocked for background apps,
 * see FocusBlockNotifications), shows immediately even with the app process in the background.
 *
 * The texts are the shared ones (packages/shared/src/blocking), pushed by JS as JSON; a couple of
 * built-in fallbacks cover the time before the first push.
 */
internal object BlockPopup {
  enum class Category { SOCIAL, GAME, GENERIC }

  private const val PREFS_NAME = "block_popup"
  private const val KEY_CONTENT = "content"

  private val FALLBACK = mapOf(
    Category.SOCIAL to listOf("Lee unas paginas de un libro."),
    Category.GAME to listOf("Salir a caminar o estirar 5 minutos."),
    Category.GENERIC to listOf("Respira hondo unas cuantas veces."),
  )
  private val FALLBACK_PHRASE = "Cada minuto de enfoque cuenta."

  private var current: View? = null

  private fun prefs(context: Context): SharedPreferences =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  /** json: {"suggestions":{"SOCIAL":[..],"GAME":[..],"GENERIC":[..]},"phrases":[..]} */
  fun writeContent(context: Context, json: String) {
    prefs(context).edit().putString(KEY_CONTENT, json).apply()
  }

  private fun pick(context: Context, category: Category): Pair<String, String> {
    val raw = prefs(context).getString(KEY_CONTENT, null)
    return runCatching {
      val json = JSONObject(raw!!)
      val list = json.getJSONObject("suggestions").getJSONArray(category.name)
      val phrases = json.getJSONArray("phrases")
      list.getString((0 until list.length()).random()) to phrases.getString((0 until phrases.length()).random())
    }.getOrElse { FALLBACK.getValue(category).random() to FALLBACK_PHRASE }
  }

  fun show(service: AccessibilityService, appLabel: String, reason: String, category: Category) {
    val (suggestion, phrase) = pick(service, category)
    showCard(
      service,
      title = "App bloqueada",
      accentColor = "#E5484D",
      message = "Se cerro $appLabel porque $reason.",
      boxText = suggestion,
      footer = phrase,
      button = "Volver al enfoque",
    )
  }

  /** Same card as a heads-up rather than a block (amber): the pre-night-block warnings. */
  fun showWarning(service: AccessibilityService, title: String, message: String, category: Category) {
    val (suggestion, _) = pick(service, category)
    showCard(
      service,
      title = title,
      accentColor = "#E0B64C",
      message = message,
      boxText = suggestion,
      footer = null,
      button = "Entendido",
    )
  }

  private fun showCard(
    service: AccessibilityService,
    title: String,
    accentColor: String,
    message: String,
    boxText: String,
    footer: String?,
    button: String,
  ) {
    val windowManager = service.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    dismiss(windowManager)
    val suggestion = boxText

    fun dp(value: Int) = TypedValue.applyDimension(
      TypedValue.COMPLEX_UNIT_DIP, value.toFloat(), service.resources.displayMetrics,
    ).toInt()

    fun text(value: String, sizeSp: Float, color: Int, bold: Boolean = false) = TextView(service).apply {
      this.text = value
      setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp)
      setTextColor(color)
      if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
      setPadding(0, 0, 0, dp(10))
    }

    val danger = Color.parseColor(accentColor)
    val accent = Color.parseColor("#4EE0A0")
    val muted = Color.parseColor("#A9B8B0")
    val body = Color.parseColor("#F2F7F4")

    val card = LinearLayout(service).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(24), dp(24), dp(24), dp(20))
      background = GradientDrawable().apply {
        cornerRadius = dp(24).toFloat()
        setColor(Color.parseColor("#FA212836"))
        setStroke(dp(2), danger)
      }
      addView(text(title, 24f, danger, bold = true))
      addView(text(message, 16f, muted))
      addView(
        LinearLayout(service).apply {
          orientation = LinearLayout.VERTICAL
          setPadding(dp(14), dp(12), dp(14), dp(4))
          background = GradientDrawable().apply {
            cornerRadius = dp(14).toFloat()
            setColor(Color.parseColor("#14FFFFFF"))
          }
          addView(text("Mientras tanto", 15f, accent, bold = true))
          addView(text(suggestion, 16f, body))
        },
        LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
          .apply { bottomMargin = dp(14) },
      )
      footer?.let { addView(text(it, 15f, muted)) }
      addView(
        Button(service).apply {
          this.text = button
          isAllCaps = false
          setTextColor(Color.parseColor("#0A1C13"))
          background = GradientDrawable().apply {
            cornerRadius = dp(24).toFloat()
            setColor(accent)
          }
          setOnClickListener { dismiss(windowManager) }
        },
        LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(48)),
      )
    }

    val root = FrameLayout(service).apply {
      setBackgroundColor(Color.parseColor("#D10A0C10"))
      // Tapping the dimmed area outside the card does nothing, like the desktop popup: the only
      // way out is the button, so it gets read.
      isClickable = true
      addView(
        card,
        FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.CENTER)
          .apply { setMargins(dp(20), 0, dp(20), 0) },
      )
    }

    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
      WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
      PixelFormat.TRANSLUCENT,
    )

    runCatching {
      windowManager.addView(root, params)
      current = root
    }
  }

  private fun dismiss(windowManager: WindowManager) {
    current?.let { view -> runCatching { windowManager.removeView(view) } }
    current = null
  }
}
