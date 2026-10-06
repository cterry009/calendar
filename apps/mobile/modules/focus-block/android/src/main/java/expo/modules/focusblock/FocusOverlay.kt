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
 * the block, the phase, a live countdown to the end of the pomodoro and a line to finish it. It
 * doesn't lock anything, same as the desktop's card:
 * - "Seguir trabajando" hides it; the time keeps counting.
 * - "Abrir pomodoro" opens the app.
 * - "Salir" lets the user go do something else: from that moment the block's time stops counting
 *   (the session pauses) and the exit is counted. While out, a small bar at the top of the screen
 *   shows how much of the pomodoro is left, with "Volver" -- the desktop's "Volver al bloque" bar.
 *
 * Drawn by the accessibility service as TYPE_ACCESSIBILITY_OVERLAY windows, like BlockPopup, so they
 * show with the app in the background. Which block is on comes from WorkSocialLimit's windows (pushed
 * by JS, "no puedo" days excluded); what the pomodoro is doing comes from JS (writeState). An exit
 * made here is queued and applied by JS (drainExits), back-dated to when it happened.
 */
internal object FocusOverlay {
  private const val TAG = "FocusOverlay"
  private const val PREFS_NAME = "focus_overlay"
  private const val KEY_STATE = "state"
  private const val KEY_EXITED = "exited"
  private const val KEY_SHOWN = "shown"
  private const val KEY_PENDING_EXITS = "pending_exits"

  private var card: View? = null
  private var bar: View? = null
  private var barSignature: String? = null

  private val ACCENT = Color.parseColor("#4EE0A0")
  private val WARNING = Color.parseColor("#E0B64C")
  private val MUTED = Color.parseColor("#A9B8B0")
  private val BODY = Color.parseColor("#F2F7F4")

  private fun prefs(context: Context): SharedPreferences =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  /**
   * From JS, whenever the pomodoro changes: {"scheduleId","title","text","phase","endsAtMs",
   * "running","paused","remainingMs","exits","phrase"}; "{}" when nothing runs.
   */
  fun writeState(context: Context, json: String) {
    prefs(context).edit().putString(KEY_STATE, json).apply()
    val state = runCatching { JSONObject(json) }.getOrNull()
    // Left the block from another device or from the app: the card doesn't pop up for it again.
    if (state?.optBoolean("paused") == true) state.optString("scheduleId").takeIf { it.isNotBlank() }?.let {
      markExited(context, "$it@${WorkSocialLimit.localDay(Calendar.getInstance())}", record = false)
    }
  }

  private fun state(context: Context): JSONObject =
    runCatching { JSONObject(prefs(context).getString(KEY_STATE, "{}")!!) }.getOrDefault(JSONObject())

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
   * Called on a timer, on unlock and when JS pushes a new state. Shows the card at the start of a
   * block (once) and, when `unlocked`, every time the phone is unlocked during it -- unless the user
   * left the block, in which case the "fuera del bloque" bar shows instead. Hides both when the block
   * is over.
   */
  fun check(service: AccessibilityService, unlocked: Boolean) {
    val window = WorkSocialLimit.currentWorkWindow(service)
    Log.d(TAG, "check unlocked=$unlocked window=${window?.label} id=${window?.id}")
    if (window?.id == null) {
      hide(service)
      hideBar(service)
      return
    }
    val today = WorkSocialLimit.localDay(Calendar.getInstance())
    val key = "${window.id}@$today"
    val p = prefs(service)
    val state = state(service)
    val pausedHere = state.optBoolean("paused") && state.optString("scheduleId") == window.id
    if (pausedHere) showBar(service, state) else hideBar(service)

    if (key in p.getStringSet(KEY_EXITED, emptySet())!!) {
      hide(service)
      return
    }
    val shown = p.getStringSet(KEY_SHOWN, emptySet())!!
    val firstTime = key !in shown
    if (firstTime) {
      p.edit().putStringSet(KEY_SHOWN, (shown.filter { it.endsWith("@$today") } + key).toSet()).apply()
    }
    if (firstTime || unlocked || card != null) show(service, window, key, state)
  }

  /** JS pushed a new phase or a pause: refresh what's on screen. */
  fun refresh(service: AccessibilityService?) {
    service ?: return
    check(service, unlocked = false)
  }

  private fun dp(context: Context, value: Int) = TypedValue.applyDimension(
    TypedValue.COMPLEX_UNIT_DIP, value.toFloat(), context.resources.displayMetrics,
  ).toInt()

  private fun text(context: Context, value: String, sizeSp: Float, color: Int, bold: Boolean = false, center: Boolean = false) =
    TextView(context).apply {
      this.text = value
      setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp)
      setTextColor(color)
      if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
      if (center) gravity = Gravity.CENTER_HORIZONTAL
      setPadding(0, 0, 0, dp(context, 6))
    }

  private fun button(context: Context, label: String, primary: Boolean, onClick: () -> Unit) = Button(context).apply {
    this.text = label
    isAllCaps = false
    setTextColor(if (primary) Color.parseColor("#0A1C13") else BODY)
    background = GradientDrawable().apply {
      cornerRadius = dp(context, 24).toFloat()
      if (primary) setColor(ACCENT) else {
        setColor(Color.TRANSPARENT)
        setStroke(dp(context, 1), MUTED)
      }
    }
    setOnClickListener { onClick() }
  }

  private fun openApp(service: AccessibilityService, uri: String) {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(uri))
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    runCatching { service.startActivity(intent) }.onFailure { Log.e(TAG, "open app failed", it) }
  }

  private fun blockEndMs(window: WorkSocialLimit.WorkWindow): Long = Calendar.getInstance().apply {
    set(Calendar.HOUR_OF_DAY, window.endMinute / 60)
    set(Calendar.MINUTE, window.endMinute % 60)
    set(Calendar.SECOND, 0)
    set(Calendar.MILLISECOND, 0)
  }.timeInMillis

  private fun show(service: AccessibilityService, window: WorkSocialLimit.WorkWindow, key: String, state: JSONObject) {
    val windowManager = service.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    val now = System.currentTimeMillis()
    val sameBlock = state.optString("scheduleId") == window.id
    val running = sameBlock && state.optBoolean("running") && state.optLong("endsAtMs") > now
    val focus = running && state.optString("phase") == "FOCUS"
    val endsAt = if (running) state.optLong("endsAtMs") else blockEndMs(window)
    val exits = if (sameBlock) state.optInt("exits", 0) else 0
    fun d(v: Int) = dp(service, v)

    val content = LinearLayout(service).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(d(24), d(24), d(24), d(20))
      background = GradientDrawable().apply {
        cornerRadius = d(24).toFloat()
        setColor(Color.parseColor("#FA212836"))
        setStroke(d(2), ACCENT)
      }
      addView(text(service, "Bloque de trabajo", 14f, ACCENT, bold = true, center = true))
      addView(text(service, window.label ?: "Horario de trabajo", 20f, BODY, bold = true, center = true))
      if (running) addView(text(service, state.optString("title"), 15f, MUTED, center = true))
      addView(
        Chronometer(service).apply {
          isCountDown = true
          base = SystemClock.elapsedRealtime() + (endsAt - now)
          setTextSize(TypedValue.COMPLEX_UNIT_SP, 56f)
          setTextColor(BODY)
          gravity = Gravity.CENTER_HORIZONTAL
          start()
        },
        LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT),
      )
      addView(
        text(
          service,
          when {
            focus -> "para terminar este pomodoro"
            running -> "de descanso"
            else -> "hasta el final del bloque (${WorkSocialLimit.clock(window.endMinute)})"
          },
          14f, MUTED, center = true,
        ),
      )
      val phrase = state.optString("phrase")
      if (focus && phrase.isNotBlank()) addView(text(service, phrase, 16f, ACCENT, bold = true, center = true))
      addView(
        text(
          service,
          if (exits == 0) "Sin salidas en este bloque" else "Saliste $exits ${if (exits == 1) "vez" else "veces"} de este bloque",
          14f, if (exits > 0) WARNING else MUTED, center = true,
        ),
      )
      addView(
        button(service, "Seguir trabajando", primary = true) { hide(service) },
        LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, d(48)).apply { topMargin = d(8) },
      )
      addView(
        button(service, "Abrir pomodoro", primary = false) {
          hide(service)
          openApp(service, "calendarproductivity://pomodoro")
        },
        LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, d(48)).apply { topMargin = d(10) },
      )
      addView(
        button(service, "Salir (deja de contar el tiempo)", primary = false) {
          markExited(service, key, record = true)
          hide(service)
        },
        LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, d(48)).apply { topMargin = d(10) },
      )
    }

    val root = FrameLayout(service).apply {
      setBackgroundColor(Color.parseColor("#D10A0C10"))
      isClickable = true
      addView(
        content,
        FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.CENTER)
          .apply { setMargins(d(20), 0, d(20), 0) },
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
      card = root
      Log.d(TAG, "shown $key")
    }.onFailure { Log.e(TAG, "addView failed", it) }
  }

  /**
   * Out of the block: a small bar at the top, over every app, with what's left of the pomodoro
   * (frozen, it doesn't count while out) and "Volver". Touches outside it go to the app below.
   */
  private fun showBar(service: AccessibilityService, state: JSONObject) {
    val remainingMs = state.optLong("remainingMs", 0L)
    val exits = state.optInt("exits", 0)
    val signature = "$remainingMs:$exits:${state.optString("phrase")}"
    if (bar != null && signature == barSignature) return
    hideBar(service)
    val windowManager = service.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    fun d(v: Int) = dp(service, v)
    val seconds = (remainingMs / 1000).coerceAtLeast(0)
    val left = "%02d:%02d".format(seconds / 60, seconds % 60)

    val view = LinearLayout(service).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      setPadding(d(14), d(8), d(8), d(8))
      background = GradientDrawable().apply {
        cornerRadius = d(20).toFloat()
        setColor(Color.parseColor("#F2212836"))
        setStroke(d(1), WARNING)
      }
      addView(
        LinearLayout(service).apply {
          orientation = LinearLayout.VERTICAL
          addView(text(service, "⏸ Fuera del bloque · faltan $left del pomodoro", 13f, BODY, bold = true).apply { setPadding(0, 0, 0, 0) })
          val phrase = state.optString("phrase")
          addView(
            text(service, if (phrase.isNotBlank()) phrase else "$exits ${if (exits == 1) "salida" else "salidas"}", 12f, MUTED)
              .apply { setPadding(0, d(2), 0, 0) },
          )
        },
        LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f),
      )
      addView(
        button(service, "Volver", primary = true) {
          hideBar(service)
          // The app resumes the session (it owns it); the pomodoro screen reads "volver".
          openApp(service, "calendarproductivity://pomodoro?volver=1")
        },
        LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, d(40)).apply { leftMargin = d(8) },
      )
    }

    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
      PixelFormat.TRANSLUCENT,
    ).apply {
      gravity = Gravity.TOP
      y = d(36)
      horizontalMargin = 0.03f
    }

    runCatching {
      windowManager.addView(view, params)
      bar = view
      barSignature = signature
    }.onFailure { Log.e(TAG, "bar addView failed", it) }
  }

  private fun hideBar(context: Context) {
    val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    bar?.let { view -> runCatching { windowManager.removeView(view) } }
    bar = null
    barSignature = null
  }

  fun hide(context: Context) {
    val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    card?.let { view -> runCatching { windowManager.removeView(view) } }
    card = null
  }

  /**
   * The pomodoro the block popup (BlockPopup) shows under "App bloqueada": its end and a line to
   * finish it, while a focus phase runs. Null otherwise.
   */
  fun runningFocus(context: Context): Pair<Long, String>? {
    val state = state(context)
    val endsAt = state.optLong("endsAtMs", 0L)
    if (!state.optBoolean("running") || state.optString("phase") != "FOCUS" || endsAt <= System.currentTimeMillis()) return null
    return endsAt to state.optString("phrase")
  }
}
