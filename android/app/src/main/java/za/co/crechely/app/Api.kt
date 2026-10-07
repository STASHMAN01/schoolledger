package za.co.crechely.app

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit

class ApiException(val status: Int, message: String) : Exception(message)

/** Talks to https://www.crechely.co.za. Every call after sign-in sends the Bearer token. */
object Api {
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(40, TimeUnit.SECONDS)
        .build()
    private val json = "application/json".toMediaType()

    /** Called when the server says the sign-in is no longer valid, so the app can show the login. */
    var onSignedOut: (() -> Unit)? = null

    private fun builder(path: String, auth: Boolean = true): Request.Builder {
        val rb = Request.Builder().url(BuildConfig.BASE_URL + path)
        if (auth) Prefs.token?.let { rb.header("Authorization", "Bearer $it") }
        return rb
    }

    private suspend fun run(rb: Request.Builder): String = withContext(Dispatchers.IO) {
        try {
            client.newCall(rb.build()).execute().use { r ->
                val text = r.body?.string().orEmpty()
                if (!r.isSuccessful) {
                    if (r.code == 401 && Prefs.token != null) {
                        Prefs.signOut()
                        onSignedOut?.invoke()
                    }
                    val msg = runCatching { JSONObject(text).optString("error") }.getOrNull().orEmpty()
                    throw ApiException(r.code, msg.ifBlank { "Something went wrong (${r.code})." })
                }
                text
            }
        } catch (e: IOException) {
            throw ApiException(0, "No connection. Check the Wi-Fi or data and try again.")
        }
    }

    private fun obj(text: String) = if (text.isBlank()) JSONObject() else JSONObject(text)

    suspend fun get(path: String): JSONObject = obj(run(builder(path).get()))
    suspend fun post(path: String, body: JSONObject): JSONObject = obj(run(builder(path).post(body.toString().toRequestBody(json))))
    suspend fun put(path: String, body: JSONObject): JSONObject = obj(run(builder(path).put(body.toString().toRequestBody(json))))

    suspend fun login(email: String, password: String, deviceName: String): String {
        val body = JSONObject().put("email", email).put("password", password).put("deviceName", deviceName)
        val res = obj(run(builder("/api/mobile/login", auth = false).post(body.toString().toRequestBody(json))))
        return res.getString("token")
    }

    suspend fun signOut() {
        runCatching { run(builder("/api/mobile/device").delete()) }
    }

    suspend fun registerPushToken(fcm: String) {
        if (Prefs.token == null) return
        runCatching { put("/api/mobile/device", JSONObject().put("fcmToken", fcm)) }
    }

    suspend fun me(): Me = parseMe(get("/api/mobile/me"))

    // ---- school data (the same endpoints the website uses) ----
    suspend fun todos(org: String, date: String) = parseTodos(get("/api/organizations/$org/todos?date=$date"))
    suspend fun classes(org: String) = parseClasses(get("/api/organizations/$org/categories"))
    suspend fun register(org: String, classId: String, date: String) =
        parseRegister(get("/api/organizations/$org/attendance/register?categoryId=$classId&date=$date"))

    suspend fun saveRegister(org: String, classId: String, date: String, marks: Map<String, String>) {
        val records = org.json.JSONArray()
        marks.forEach { (id, status) -> records.put(JSONObject().put("childId", id).put("status", status)) }
        post(
            "/api/organizations/$org/attendance/register",
            JSONObject().put("categoryId", classId).put("date", date).put("records", records),
        )
    }

    suspend fun children(org: String) = parseChildren(get("/api/organizations/$org/children"))

    suspend fun quickAddChild(org: String, classId: String, first: String, last: String, today: String) {
        post(
            "/api/organizations/$org/children",
            JSONObject().put("quickAdd", true).put("categoryId", classId)
                .put("firstName", first).put("lastName", last).put("enrollmentDate", today),
        )
    }

    suspend fun files(org: String, mode: String, params: Map<String, String>): FilesPage {
        val qs = (mapOf("mode" to mode) + params).entries.joinToString("&") { "${it.key}=${java.net.URLEncoder.encode(it.value, "UTF-8")}" }
        return parseFiles(get("/api/organizations/$org/files?$qs"), params)
    }

    /** Downloads a PDF into the app's cache folder (cleared by Android when space is needed). */
    suspend fun download(context: Context, path: String, name: String): File = withContext(Dispatchers.IO) {
        val dir = File(context.cacheDir, "downloads").apply { mkdirs() }
        dir.listFiles()?.forEach { it.delete() } // keep only the latest; no documents pile up on a shared tablet
        val file = File(dir, name.replace(Regex("[^A-Za-z0-9._ -]"), "_").take(80).ifBlank { "document" } + ".pdf")
        try {
            client.newCall(builder(path).get().build()).execute().use { r ->
                if (!r.isSuccessful) throw ApiException(r.code, "The document couldn't be opened (${r.code}).")
                r.body!!.byteStream().use { input -> file.outputStream().use { input.copyTo(it) } }
            }
        } catch (e: IOException) {
            throw ApiException(0, "No connection. Check the Wi-Fi or data and try again.")
        }
        file
    }
}
