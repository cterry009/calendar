package expo.modules.focusblock

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
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
 * What a WORK block puts on the phone's screen, by the accessibility service (TYPE_ACCESSIBILITY_OVERLAY
 * windows, which show with the app in the background):
 * - Nothing while it runs: popping up during the block broke the concentration it's for
 *   (user-requested, 2026-10-07). The persistent notification keeps the countdown.
 * - While out of the block ("Salir" in the app), a small bar on top with what's left of the pomodoro
 *   and "Volver".
 * - Once, at its end, a card asking how it went (1-5); a rating opens the app to finish the review
 *   (what applied, a comment, whether the study session got done). Not when the app is already in
 *   front -- it asks there itself -- and not for a block given up ("no puedo") or already reviewed.
 *
 * Which block is on comes from WorkSocialLimit's windows (pushed by JS, "no puedo" days excluded);
 * what the pomodoro is doing comes from JS (writeState).
 */
internal object FocusOverlay {
  private const val TAG = "FocusOverlay"
  private const val PREFS_NAME = "focus_overlay"
  private const val KEY_STATE = "state"
  private const val KEY_EXITED = "exited"
  private const val KEY_PENDING_EXITS = "pending_exits"
  private const val KEY_LAST_BLOCK = "last_block"
  private const val KEY_REVIEWED = "reviewed"
  /** A block that ended longer ago than this isn't asked about any more. */
  private const val REVIEW_WINDOW_MS = 3 * 60 * 60_000L

  private var card: View? = null
  private var bar: View? = null
  private var barSignature: String? = null

  private val ACCENT = Color.parseColor("#4EE0A0")
  private val WARNING = Color.parseColor("#E0B64C")
  private val MUTED = Color.parseColor("#A9B8B0")
  private val BODY = Color.parseColor("#F2F7F4")
  private val RATINGS = listOf(1 to "Muy mal", 2 to "Mal", 3 to "Regular", 4 to "Bien", 5 to "Excelente")

  private fun prefs(context: Context): SharedPreferences =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  /**
   * From JS, whenever the pomodoro changes: {"scheduleId","title","text","phase","endsAtMs",
   * "running","paused","remainingMs","exits","phrase","session","taskId"}; "{}" when nothing runs.
   */
  fun writeState(context: Context, json: String) {
    prefs(context).edit().putString(KEY_STATE, json).apply()
    val state = runCatching { JSONObject(json) }.getOrNull()
    if (state?.optBoolean("paused") == true) state.optString("scheduleId").takeIf { it.isNotBlank() }?.let {
      markExited(context, "$it@${WorkSocialLimit.localDay(Calendar.getInstance())}", record = false)
    }
  }

  private fun state(context: Context): JSONObject =
    runCatching { JSONObject(prefs(context).getString(KEY_STATE, "{}")!!) }.getOrDefault(JSONObject())

  /** "Volver al bloque" in the app. */
  fun clearExited(context: Context, key: String) {
    val set = prefs(context).getStringSet(KEY_EXITED, emptySet())!!.toMutableSet()
    set.remove(key)
    prefs(context).edit().putStringSet(KEY_EXITED, set).apply()
  }

  /** The block was reviewed (or given up) in the app: no end-of-block card for it. */
  fun markReviewed(context: Context, key: String) {
    val today = WorkSocialLimit.localDay(Calendar.getInstance())
    val set = prefs(context).getStringSet(KEY_REVIEWED, emptySet())!!.filter { it.endsWith("@$today") }.toMutableSet()
    set.add(key)
    prefs(context).edit().putStringSet(KEY_REVIEWED, set).apply()
  }

  /** Exits queued natively, oldest first: [{"key","at"}]. Clears them. Kept for older app versions. */
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

  private fun blockEndMs(window: WorkSocialLimit.WorkWindow): Long = Calendar.getInstance().apply {
    set(Calendar.HOUR_OF_DAY, window.endMinute / 60)
    set(Calendar.MINUTE, window.endMinute % 60)
    set(Calendar.SECOND, 0)
    set(Calendar.MILLISECOND, 0)
  }.timeInMillis

  /**
   * Called on a timer, on unlock and when JS pushes a new state. Keeps the "fuera del bloque" bar in
   * line with the session, remembers the block running now, and once a block is over asks how it
   * went. `appInFront`: our own app is the foreground app (it asks there instead).
   */
  fun check(service: AccessibilityService, appInFront: Boolean) {
    val window = WorkSocialLimit.currentWorkWindow(service)
    val p = prefs(service)
    val state = state(service)
    val today = WorkSocialLimit.localDay(Calendar.getInstance())

    if (window?.id != null) {
      val pausedHere = state.optBoolean("paused") && state.optString("scheduleId") == window.id
      if (pausedHere) showBar(service, state) else hideBar(service)
      // Remember it, so its end can be noticed even if nothing runs on the phone right then.
      val sameBlock = state.optString("scheduleId") == window.id
      val last = JSONObject()
        .put("key", "${window.id}@$today")
        .put("scheduleId", window.id)
        .put("label", window.label ?: "Bloque de trabajo")
        .put("day", today)
        .put("endMs", blockEndMs(window))
        .put("taskId", if (sameBlock) state.optString("taskId") else "")
      p.edit().putString(KEY_LAST_BLOCK, last.toString()).apply()
      hide(service)
      return
    }
    hideBar(service)

    val last = runCatching { JSONObject(p.getString(KEY_LAST_BLOCK, null) ?: return) }.getOrNull() ?: return
    val key = last.optString("key")
    val endMs = last.optLong("endMs")
    val now = System.currentTimeMillis()
    val reviewed = p.getStringSet(KEY_REVIEWED, emptySet())!!
    if (key in reviewed || now < endMs || now - endMs > REVIEW_WINDOW_MS) {
      if (key in reviewed) hide(service)
      return
    }
    if (appInFront || card != null) return
    showReview(service, last)
  }

  /** JS pushed a new phase or a pause: refresh what's on screen. */
  fun refresh(service: AccessibilityService?) {
    service ?: return
    check(service, appInFront = false)
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

  /** The one card a block shows: at its end, how did it go? */
  private fun showReview(service: AccessibilityService, last: JSONObject) {
    val windowManager = service.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    val key = last.optString("key")
    fun d(v: Int) = dp(service, v)

    val content = LinearLayout(service).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(d(24), d(24), d(24), d(20))
      background = GradientDrawable().apply {
        cornerRadius = d(24).toFloat()
        setColor(Color.parseColor("#FA212836"))
        setStroke(d(2), ACCENT)
      }
      addView(text(service, "Terminó el bloque", 14f, ACCENT, bold = true, center = true))
      addView(text(service, last.optString("label"), 20f, BODY, bold = true, center = true))
      addView(text(service, "¿Cómo te fue?", 18f, BODY, center = true))
      for ((value, label) in RATINGS) {
        addView(
          button(service, "$value · $label", primary = value >= 4) {
            markReviewed(service, key)
            hide(service)
            val uri = Uri.Builder()
              .scheme("calendarproductivity").authority("pomodoro")
              .appendQueryParameter("review", "1")
              .appendQueryParameter("scheduleId", last.optString("scheduleId"))
              .appendQueryParameter("day", last.optString("day"))
              .appendQueryParameter("rating", value.toString())
              .appendQueryParameter("taskId", last.optString("taskId"))
              .build()
            openApp(service, uri.toString())
          },
          LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, d(46)).apply { topMargin = d(8) },
        )
      }
      addView(
        button(service, "Ahora no", primary = false) {
          markReviewed(service, key)
          hide(service)
        },
        LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, d(46)).apply { topMargin = d(14) },
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
      Log.d(TAG, "review shown $key")
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
