package za.co.crechely.app

import android.content.Context
import android.content.SharedPreferences

/** One alarm that rings every day at [hour]:[minute] (weekdays only if [weekdaysOnly]). */
data class DailyAlarm(val id: Int, val hour: Int, val minute: Int, val label: String, val weekdaysOnly: Boolean, val enabled: Boolean)

/** Small settings store: the alarms set on this tablet and the push token. No child data is ever saved here. */
object Prefs {
    private lateinit var sp: SharedPreferences

    fun init(context: Context) {
        sp = context.applicationContext.getSharedPreferences("crechely", Context.MODE_PRIVATE)
    }

    var fcmToken: String?
        get() = sp.getString("fcmToken", null)
        set(v) = sp.edit().putString("fcmToken", v).apply()

    var askedFullScreen: Boolean
        get() = sp.getBoolean("askedFullScreen", false)
        set(v) = sp.edit().putBoolean("askedFullScreen", v).apply()

    // Stored as "id|hour|minute|weekdaysOnly|enabled|label" lines.
    var alarms: List<DailyAlarm>
        get() = (sp.getString("alarms", "") ?: "").lines().mapNotNull { line ->
            val p = line.split("|", limit = 6)
            if (p.size < 6) null else runCatching {
                DailyAlarm(p[0].toInt(), p[1].toInt(), p[2].toInt(), p[5], p[3] == "1", p[4] == "1")
            }.getOrNull()
        }
        set(v) = sp.edit().putString(
            "alarms",
            v.joinToString("\n") { "${it.id}|${it.hour}|${it.minute}|${if (it.weekdaysOnly) 1 else 0}|${if (it.enabled) 1 else 0}|${it.label.replace("|", " ").replace("\n", " ")}" },
        ).apply()
}
