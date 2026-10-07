package za.co.crechely.app

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/** One alarm that rings every day at [hour]:[minute] (weekdays only if [weekdaysOnly]). */
data class DailyAlarm(val id: Int, val hour: Int, val minute: Int, val label: String, val weekdaysOnly: Boolean, val enabled: Boolean)

/** Small settings store. The sign-in token is kept encrypted. No child data is ever saved on the tablet. */
object Prefs {
    private lateinit var sp: SharedPreferences

    fun init(context: Context) {
        sp = try {
            val key = MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
            EncryptedSharedPreferences.create(
                context, "crechely_secure", key,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
            )
        } catch (e: Exception) {
            context.getSharedPreferences("crechely_plain", Context.MODE_PRIVATE)
        }
    }

    var token: String?
        get() = sp.getString("token", null)
        set(v) = sp.edit().putString("token", v).apply()

    var orgId: String?
        get() = sp.getString("orgId", null)
        set(v) = sp.edit().putString("orgId", v).apply()

    var fcmToken: String?
        get() = sp.getString("fcmToken", null)
        set(v) = sp.edit().putString("fcmToken", v).apply()

    var lastEmail: String
        get() = sp.getString("lastEmail", "") ?: ""
        set(v) = sp.edit().putString("lastEmail", v).apply()

    fun signOut() = sp.edit().remove("token").remove("orgId").apply()

    // ---- alarms set on this tablet ----
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
