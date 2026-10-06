package expo.modules.focusblock

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.SystemClock
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.Chronometer
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import org.json.JSONArray
import org.json.JSONObject

/**
 * The pomodoro on top of the screen during a WORK block (user-requested, 2026-10-06): when a block
 * starts and every time the phone is unlocked during one, a card over whatever is on screen shows
 * the block, the phase and a live countdown. It doesn't lock anything: "Salir" lets the user go do
 * something else, and from that moment the block's time stops counting (the session pauses) and
 * the exit is counted; "Abrir pomodoro" opens the app.
 *
 * Drawn by the accessibility service as a TYPE_ACCESSIBILITY_OVERLAY, like BlockPopup, so it shows
 * with the app in the background. Which block is on comes from WorkSocialLimit's windows (pushed by
 * JS, "no puedo" days excluded); what the pomodoro is doing comes from JS (setState). An exit made
 * here is queued and applied by JS (drainExits), back-dated to when it happened.
 */
internal object FocusOverlay {
  private const val TAG = "FocusOverlay"
  private const val PREFS_NAME = "focus_overlay"
  private const val KEY_STATE = "state"
  private const val KEY_EXITED = "exited"
  private const val KEY_SHOWN = "shown"
  private const val KEY_PENDING_EXITS = "pending_exits"

  private var current: View? = null
  private var currentKey: String? = null

  private fun prefs(context: Context): SharedPreferences =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  /**
   * From JS, whenever the pomodoro changes: {"scheduleId","title","text","endsAtMs","running",
   * "paused","exits"}; "{}" when nothing runs.
   */
  fun writeState(context: Context, json: String) {
    prefs(context).edit().putString(KEY_STATE, json).apply()
    val state = runCatching { JSONObject(json) }.getOrNull()
    // Left the block from another device or from the app: don't pop up again for it.
    if (state?.optBoolean("paused") == true) state.optString("scheduleId").takeIf { it.isNotBlank() }?.let {
      markExited(context, "$it@${WorkSocialLimit.localDay(Calendar.getInstance())}", record = false)
    }
  }

  /** "Volver al bloque" in the app: this block may pop up again. */
  fun clearExited(context: Context, key: String) {
    val set = prefs(context).getStringSet(KEY_EXITED, emptySet())!!.toMutableSet()
    set.remove(key)
    prefs(context).edit().putStringSet(KEY_EXITED, set).apply()
  }

  /** Exits made on the overlay since the last call, oldest first: [{"key","at"}]. Clears them. */
  @Synchronized
  fun drainExits(context: Context): List<Map<String, String>> {
    val raw = prefs(context).getString(KEY_PENDING_EXITS, "[]")
    prefs(context).edit().remove(KEY_PENDING_EXITS).apply()
    val array = runCatching { JSONArray(raw) }.getOrDefault(JSONArray())
    return (0 until array.length()).map { i ->
      val item = array.getJSONObject(i)
      mapOf("key" to item.getString("key"), "at" to item.getString("at"))
    }
  }

  @Synchronized
  private fun markExited(context: Context, key: String, record: Boolean) {
    val p = prefs(context)
    val set = p.getStringSet(KEY_EXITED, emptySet())!!.toMutableSet()
    // Only today's keys are worth keeping.
    val today = WorkSocialLimit.localDay(Calendar.getInstance())
    set.retainAll { it.endsWith("@$today") }
    set.add(key)
    val edit = p.edit().putStringSet(KEY_EXITED, set)
    if (record) {
      val pending = runCatching { JSONArray(p.getString(KEY_PENDING_EXITS, "[]")) }.getOrDefault(JSONArray())
      pending.put(JSONObject().put("key", key).put("at", isoNow()))
      edit.putString(KEY_PENDING_EXITS, pending.toString())
    }
    edit.apply()
  }

  private fun isoNow(): String =
    SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.ROOT).apply { timeZone = TimeZone.getTimeZone("UTC") }.format(Date())

  /**
   * Called on a timer and on unlock. Shows the card at the start of a block (once) and, when
   * `unlocked`, every time the phone is unlocked during it -- unless the user left the block.
   * Hides it when the block is over.
   */
  fun check(service: AccessibilityService, unlocked: Boolean) {
    val window = WorkSocialLimit.currentWorkWindow(service)
    Log.d(TAG, "check unlocked=$unlocked window=${window?.label} id=${window?.id}")
    if (window?.id == null) {
      hide(service)
      return
    }
    val key = "${window.id}@${WorkSocialLimit.localDay(Calendar.getInstance())}"
    val p = prefs(service)
    if (key in p.getStringSet(KEY_EXITED, emptySet())!!) {
      hide(service)
      return
    }
    val shown = p.getStringSet(KEY_SHOWN, emptySet())!!
    val firstTime = key !in shown
    if (firstTime) {
      val today = WorkSocialLimit.localDay(Calendar.getInstance())
      p.edit().putStringSet(KEY_SHOWN, (shown.filter { it.endsWith("@$today") } + key).toSet()).apply()
    }
    Log.d(TAG, "key=$key firstTime=$firstTime showing=${current != null}")
    if (firstTime || unlocked || current != null) show(service, window, key)
  }

  /** JS pushed a new phase: refresh the card if it's up. */
  fun refresh(service: AccessibilityService?) {
    service ?: return
    if (current != null) check(service, unlocked = false)
  }

  private fun show(service: AccessibilityService, window: WorkSocialLimit.WorkWindow, key: String) {
    val windowManager = service.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    val state = runCatching { JSONObject(prefs(service).getString(KEY_STATE, "{}")!!) }.getOrDefault(JSONObject())
    val now = System.currentTimeMillis()
    val sameBlock = state.optString("scheduleId") == window.id
    val running = sameBlock && state.optBoolean("running") && state.optLong("endsAtMs") > now
    val blockEnd = Calendar.getInstance().apply {
      set(Calendar.HOUR_OF_DAY, window.endMinute / 60)
      set(Calendar.MINUTE, window.endMinute % 60)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
    }.timeInMillis
    val endsAt = if (running) state.optLong("endsAtMs") else blockEnd
    val exits = if (sameBlock) state.optInt("exits", 0) else 0

    fun dp(value: Int) = TypedValue.applyDimension(
      TypedValue.COMPLEX_UNIT_DIP, value.toFloat(), service.resources.displayMetrics,
    ).toInt()

    fun text(value: String, sizeSp: Float, color: Int, bold: Boolean = false, center: Boolean = false) = TextView(service).apply {
      this.text = value
      setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp)
      setTextColor(color)
      if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
      if (center) gravity = Gravity.CENTER_HORIZONTAL
      setPadding(0, 0, 0, dp(8))
    }

    val accent = Color.parseColor("#4EE0A0")
    val muted = Color.parseColor("#A9B8B0")
    val body = Color.parseColor("#F2F7F4")

    fun button(label: String, primary: Boolean, onClick: () -> Unit) = Button(service).apply {
      this.text = label
      isAllCaps = false
      setTextColor(if (primary) Color.parseColor("#0A1C13") else body)
      background = GradientDrawable().apply {
        cornerRadius = dp(24).toFloat()
        if (primary) setColor(accent) else {
          setColor(Color.TRANSPARENT)
          setStroke(dp(1), muted)
        }
      }
      setOnClickListener { onClick() }
    }

    val card = LinearLayout(service).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(24), dp(24), dp(24), dp(20))
      background = GradientDrawable().apply {
        cornerRadius = dp(24).toFloat()
        setColor(Color.parseColor("#FA212836"))
        setStroke(dp(2), accent)
      }
      addView(text("Bloque de trabajo", 14f, accent, bold = true, center = true))
      addView(text(window.label ?: "Horario de trabajo", 20f, body, bold = true, center = true))
      addView(
        text(
          if (running) state.optString("title") else "Toca \"Abrir pomodoro\" para empezar",
          15f, muted, center = true,
        ),
      )
      addView(
        Chronometer(service).apply {
          isCountDown = true
          base = SystemClock.elapsedRealtime() + (endsAt - now)
          setTextSize(TypedValue.COMPLEX_UNIT_SP, 56f)
          setTextColor(body)
          gravity = Gravity.CENTER_HORIZONTAL
          start()
        },
        LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT),
      )
      addView(
        text(
          (if (running) state.optString("text") else "hasta ${WorkSocialLimit.clock(window.endMinute)}") +
            (if (exits > 0) " · $exits ${if (exits == 1) "salida" else "salidas"}" else ""),
          14f, muted, center = true,
        ),
      )
      addView(
        button("Abrir pomodoro", primary = true) {
          hide(service)
          val intent = Intent(Intent.ACTION_VIEW, Uri.parse("calendarproductivity://pomodoro"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
          runCatching { service.startActivity(intent) }
        },
        LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(48)).apply { topMargin = dp(8) },
      )
      addView(
        button("Salir (deja de contar el tiempo)", primary = false) {
          markExited(service, key, record = true)
          hide(service)
        },
        LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(48)).apply { topMargin = dp(10) },
      )
    }

    val root = FrameLayout(service).apply {
      setBackgroundColor(Color.parseColor("#D10A0C10"))
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

    hide(service)
    runCatching {
      windowManager.addView(root, params)
      current = root
      currentKey = key
      Log.d(TAG, "shown $key")
    }.onFailure { Log.e(TAG, "addView failed", it) }
  }

  fun hide(context: Context) {
    val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    current?.let { view -> runCatching { windowManager.removeView(view) } }
    current = null
    currentKey = null
  }

  fun isShowing(): Boolean = current != null
}
