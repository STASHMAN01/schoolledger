package za.co.crechely.app

import android.Manifest
import android.app.Activity
import android.app.NotificationManager
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import android.provider.Settings
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.util.Log
import android.widget.FrameLayout
import android.widget.ProgressBar
import android.widget.Toast
import androidx.core.content.FileProvider
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.google.firebase.messaging.FirebaseMessaging
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * The Crechely app: the real website inside a native shell. Everything you see
 * is the website itself, so it always matches the web app. The native part adds
 * what a website cannot do: push notifications when the app is closed, loud
 * alarms, and handing files to the share sheet.
 */
class MainActivity : Activity() {
    private lateinit var web: WebView
    private lateinit var progress: ProgressBar
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    // Where the camera writes a photo taken for an upload, until it's handed back to the page.
    private var cameraUri: Uri? = null
    private var cameraFile: File? = null
    // A downloaded update waiting for the "install unknown apps" permission.
    private var pendingUpdate: File? = null

    // True only while the page on screen is our own website. The JS bridge
    // refuses to do anything otherwise.
    @Volatile private var trusted = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Prefs.init(this)

        val root = FrameLayout(this).apply { setBackgroundColor(Color.parseColor("#0670B8")) }
        web = WebView(this)
        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100; visibility = android.view.View.GONE
        }
        root.addView(web, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        root.addView(progress, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, (3 * resources.displayMetrics.density).toInt()))
        setContentView(root)

        // Android 15 draws apps edge to edge; keep the page clear of the bars and keyboard.
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime())
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }

        setupWebView()
        askForPermissions()

        if (savedInstanceState != null) web.restoreState(savedInstanceState) else web.loadUrl(urlFor(intent))
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (intent.hasExtra("screen")) web.loadUrl(urlFor(intent))
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onResume() {
        super.onResume()
        CookieManager.getInstance().flush()
        // Back from allowing "install unknown apps": carry on with the update.
        pendingUpdate?.let { file ->
            if (packageManager.canRequestPackageInstalls()) {
                pendingUpdate = null
                installApk(file)
            }
        }
    }

    override fun onPause() {
        CookieManager.getInstance().flush()
        super.onPause()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (web.canGoBack()) web.goBack() else @Suppress("DEPRECATION") super.onBackPressed()
    }

    private fun urlFor(i: Intent): String = BuildConfig.BASE_URL + when (i.getStringExtra("screen")) {
        "attendance" -> "/dashboard/centre/attendance"
        else -> "/dashboard"
    }

    private fun isOurs(u: Uri?): Boolean {
        val host = u?.host ?: return false
        return u.scheme == "https" && (host == "crechely.co.za" || host.endsWith(".crechely.co.za"))
    }

    private fun setupWebView() {
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = true
            cacheMode = WebSettings.LOAD_DEFAULT
            allowFileAccess = false
            allowContentAccess = false
            userAgentString = "$userAgentString CrechelyApp/${appVersion()}"
        }
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(web, false)
        }
        web.addJavascriptInterface(Bridge(), "CrechelyApp")

        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val u = request.url
                if (isOurs(u) || u.scheme == "file" && u.path?.startsWith("/android_asset/") == true) return false
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, u))
                } catch (_: ActivityNotFoundException) {
                    Toast.makeText(this@MainActivity, "Nothing on this tablet can open that link.", Toast.LENGTH_SHORT).show()
                }
                return true
            }

            override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
                trusted = isOurs(Uri.parse(url))
            }

            override fun onPageFinished(view: WebView, url: String) {
                trusted = isOurs(Uri.parse(url))
                if (trusted) registerPushToken()
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) {
                    trusted = false
                    view.loadUrl("file:///android_asset/offline.html")
                }
            }
        }

        web.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, newProgress: Int) {
                progress.progress = newProgress
                progress.visibility = if (newProgress in 1..99) android.view.View.VISIBLE else android.view.View.GONE
            }

            override fun onShowFileChooser(
                webView: WebView,
                callback: ValueCallback<Array<Uri>>,
                params: FileChooserParams,
            ): Boolean {
                filePathCallback?.onReceiveValue(null)
                filePathCallback = callback
                return try {
                    @Suppress("DEPRECATION")
                    startActivityForResult(fileChooserIntent(params), REQ_FILE)
                    true
                } catch (_: Exception) {
                    filePathCallback = null
                    false
                }
            }
        }

        web.setDownloadListener { url, _, contentDisposition, mimeType, _ ->
            if (!isOurs(Uri.parse(url))) return@setDownloadListener
            val name = URLUtil.guessFileName(url, contentDisposition, mimeType)
            Toast.makeText(this, "Downloading…", Toast.LENGTH_SHORT).show()
            Thread {
                val file = downloadToCache(url, name)
                runOnUiThread {
                    if (file == null) {
                        Toast.makeText(this, "Could not download the file.", Toast.LENGTH_LONG).show()
                    } else {
                        sendFile(file, Intent.ACTION_VIEW)
                    }
                }
            }.start()
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        @Suppress("DEPRECATION")
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQ_FILE) {
            val picked = if (resultCode == RESULT_OK) WebChromeClient.FileChooserParams.parseResult(resultCode, data) else null
            // The camera returns no data of its own; it wrote the photo to cameraFile.
            val shot = cameraFile?.takeIf { resultCode == RESULT_OK && picked.isNullOrEmpty() && it.length() > 0 }
            val result = picked?.takeIf { it.isNotEmpty() } ?: shot?.let { arrayOf(cameraUri!!) }
            filePathCallback?.onReceiveValue(result)
            filePathCallback = null
            if (shot == null) cameraFile?.delete()
            cameraFile = null
            cameraUri = null
        }
    }

    /**
     * Teachers must photograph the activity (Dylan, 8-9 Oct 2026), but a
     * WebView's own picker only offers files and the gallery: the page's
     * capture="environment" is ignored. So for photo uploads, offer the
     * camera alongside the gallery (needs the <queries> entry in the
     * manifest to find the camera app on Android 11+). Needs no camera permission: the
     * camera app takes the picture and writes it to a file we share with it.
     */
    private fun fileChooserIntent(params: WebChromeClient.FileChooserParams): Intent {
        val picker = params.createIntent()
        val wantsImages = params.acceptTypes.any { it.isBlank() || it.startsWith("image") }
        if (!wantsImages) return picker
        val camera = runCatching {
            val dir = File(cacheDir, "camera").apply { mkdirs() }
            dir.listFiles()?.forEach { it.delete() }
            val file = File(dir, "photo-${System.currentTimeMillis()}.jpg")
            val uri = FileProvider.getUriForFile(this, "$packageName.files", file)
            cameraFile = file
            cameraUri = uri
            Intent(MediaStore.ACTION_IMAGE_CAPTURE)
                .putExtra(MediaStore.EXTRA_OUTPUT, uri)
                .addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
                .apply { clipData = ClipData.newRawUri("", uri) }
                .takeIf { it.resolveActivity(packageManager) != null }
        }.getOrNull() ?: return picker
        // Always offer both: teachers often snap photos during the activity
        // and record it afterwards, so the gallery must stay available.
        return Intent.createChooser(picker, "Add a photo").putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(camera))
    }

    // ---- app updates ----
    // Dylan, 9 Oct 2026: "new update available ... when you click update it
    // downloads directly from that app". The website (AppUpdateBanner) gets
    // a short-lived link to the APK in our private R2 bucket and hands it
    // here; we download it, check it really is a newer Crechely, and open
    // Android's own installer. Android only accepts it if it's signed with
    // the same key as the installed app.

    private fun isUpdateHost(u: Uri): Boolean =
        u.scheme == "https" && (u.host ?: "").endsWith(".r2.cloudflarestorage.com")

    private fun updateState(state: String) = runOnUiThread {
        if (trusted) {
            web.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('crechely-update',{detail:${JSONObject.quote(state)}}));",
                null,
            )
        }
    }

    private fun downloadAndInstallUpdate(url: String) {
        updateState("downloading")
        Thread {
            val file = runCatching {
                val dir = File(cacheDir, "updates").apply { mkdirs() }
                dir.listFiles()?.forEach { it.delete() }
                val out = File(dir, "crechely-update.apk")
                val conn = URL(url).openConnection() as HttpURLConnection
                conn.connectTimeout = 20000
                conn.readTimeout = 120000
                if (conn.responseCode in 200..299) {
                    conn.inputStream.use { input -> out.outputStream().use { input.copyTo(it) } }
                    out
                } else {
                    null
                }
            }.getOrNull()
            if (file == null || !isNewerCrechelyApk(file)) {
                file?.delete()
                Log.e("CrechelyUpdate", "Update download failed or wasn't a newer Crechely APK")
                updateState("failed")
            } else {
                runOnUiThread { installApk(file) }
            }
        }.start()
    }

    /** Only ever install our own app, and only a newer version of it. */
    private fun isNewerCrechelyApk(file: File): Boolean {
        val info = runCatching { packageManager.getPackageArchiveInfo(file.path, 0) }.getOrNull() ?: return false
        val code = if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else @Suppress("DEPRECATION") info.versionCode.toLong()
        return info.packageName == packageName && code > BuildConfig.VERSION_CODE
    }

    private fun installApk(file: File) {
        if (!packageManager.canRequestPackageInstalls()) {
            // Android asks once per device: "Allow from this source".
            pendingUpdate = file
            updateState("permission")
            runCatching {
                startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:$packageName")))
            }
            return
        }
        val uri = FileProvider.getUriForFile(this, "$packageName.files", file)
        try {
            startActivity(
                Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK),
            )
            updateState("installing")
        } catch (_: ActivityNotFoundException) {
            updateState("failed")
        }
    }

    // ---- push ----

    /**
     * Tells the server (using the website sign-in) where to send this tablet's
     * notifications. Only runs on a real page load (WebViewClient#onPageFinished),
     * which fires after the first cold load of our site but NOT after a client-side
     * (SPA) navigation -- e.g. the redirect a login form does straight to
     * /dashboard without a full page reload. That left this silently never
     * firing again post-login for anyone who signed in after a redirect rather
     * than a fresh page load. The website itself also calls this (via the
     * Bridge.registerPush() JS entry point below) every time its dashboard
     * mounts, which covers that case -- same pattern already used for the
     * routine-alarm sync.
     */
    private fun registerPushToken() {
        runCatching {
            FirebaseMessaging.getInstance().token
                .addOnSuccessListener { token ->
                    Prefs.fcmToken = token
                    val body = JSONObject().put("fcmToken", token).put("deviceName", "${Build.MANUFACTURER} ${Build.MODEL}")
                    val js = "fetch('/api/mobile/device',{method:'PUT',headers:{'Content-Type':'application/json'},body:" +
                        JSONObject.quote(body.toString()) + "}).catch(function(){});"
                    runOnUiThread { if (trusted) web.evaluateJavascript(js, null) }
                }
                .addOnFailureListener { e -> Log.e("CrechelyPush", "Could not get an FCM token", e) }
        }.onFailure { e -> Log.e("CrechelyPush", "registerPushToken() threw (Firebase not initialized?)", e) }
    }

    private fun askForPermissions() {
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
        }
        // Android 14 can switch off the "alarm over the lock screen" permission. Ask once.
        if (Build.VERSION.SDK_INT >= 34 && !Prefs.askedFullScreen) {
            val nm = getSystemService(NotificationManager::class.java)
            if (!nm.canUseFullScreenIntent()) {
                Prefs.askedFullScreen = true
                runCatching {
                    startActivity(
                        Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:$packageName")),
                    )
                }
            }
        }
    }

    // ---- files ----

    private fun downloadToCache(url: String, name: String): File? = runCatching {
        val dir = File(cacheDir, "downloads").apply { mkdirs() }
        dir.listFiles()?.forEach { it.delete() }
        val safe = name.replace(Regex("[^A-Za-z0-9._ -]"), "_").ifBlank { "file" }
        val out = File(dir, safe)
        val conn = URL(url).openConnection() as HttpURLConnection
        CookieManager.getInstance().getCookie(url)?.let { conn.setRequestProperty("Cookie", it) }
        conn.connectTimeout = 20000
        conn.readTimeout = 60000
        if (conn.responseCode !in 200..299) return null
        conn.inputStream.use { input -> out.outputStream().use { input.copyTo(it) } }
        out
    }.getOrNull()

    private fun sendFile(file: File, action: String) {
        val uri = FileProvider.getUriForFile(this, "$packageName.files", file)
        val type = contentResolver.getType(uri)
            ?: android.webkit.MimeTypeMap.getSingleton().getMimeTypeFromExtension(file.extension.lowercase())
            ?: "application/octet-stream"
        val i = if (action == Intent.ACTION_SEND) {
            Intent(Intent.ACTION_SEND).setType(type).putExtra(Intent.EXTRA_STREAM, uri)
        } else {
            Intent(Intent.ACTION_VIEW).setDataAndType(uri, type)
        }.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        try {
            startActivity(if (action == Intent.ACTION_SEND) Intent.createChooser(i, "Share") else i)
        } catch (_: ActivityNotFoundException) {
            Toast.makeText(this, "Nothing on this tablet can open that file.", Toast.LENGTH_LONG).show()
        }
    }

    private fun appVersion(): String = runCatching { packageManager.getPackageInfo(packageName, 0).versionName }.getOrNull() ?: "1"

    /** What the website can ask the app to do. Only works while our own website is on screen. */
    inner class Bridge {
        @JavascriptInterface fun appVersion(): String = this@MainActivity.appVersion()

        /** Lets the website tell whether a newer app is published (AppUpdateBanner). */
        @JavascriptInterface fun appVersionCode(): Int = BuildConfig.VERSION_CODE

        @JavascriptInterface fun installUpdate(url: String) {
            if (!trusted || !isUpdateHost(Uri.parse(url))) return
            runOnUiThread { downloadAndInstallUpdate(url) }
        }

        /** The website calls this every time its dashboard mounts (see PushRegister.tsx),
         *  so push gets registered even after a sign-in that redirected client-side
         *  rather than with a full page load. */
        @JavascriptInterface fun registerPush() {
            if (!trusted) return
            runOnUiThread { registerPushToken() }
        }

        @JavascriptInterface fun getAlarms(): String {
            if (!trusted) return "[]"
            val arr = JSONArray()
            Prefs.alarms.forEach {
                arr.put(
                    JSONObject().put("id", it.id).put("hour", it.hour).put("minute", it.minute)
                        .put("label", it.label).put("weekdaysOnly", it.weekdaysOnly).put("enabled", it.enabled),
                )
            }
            return arr.toString()
        }

        @JavascriptInterface fun setAlarms(json: String) {
            if (!trusted) return
            val next = runCatching {
                val arr = JSONArray(json)
                (0 until arr.length()).map {
                    val o = arr.getJSONObject(it)
                    DailyAlarm(
                        o.getInt("id"), o.getInt("hour").coerceIn(0, 23), o.getInt("minute").coerceIn(0, 59),
                        o.optString("label", "Alarm").take(80), o.optBoolean("weekdaysOnly", true), o.optBoolean("enabled", true),
                    )
                }
            }.getOrNull() ?: return
            val removed = Prefs.alarms.map { it.id } - next.map { it.id }.toSet()
            removed.forEach { AlarmScheduler.cancel(applicationContext, it) }
            Prefs.alarms = next
            next.forEach { AlarmScheduler.schedule(applicationContext, it) }
        }

        @JavascriptInterface fun getRoutineEnabled(): Boolean = trusted && Prefs.routineEnabled

        @JavascriptInterface fun setRoutineEnabled(on: Boolean) {
            if (!trusted) return
            Prefs.routineEnabled = on
            AlarmScheduler.scheduleRoutine(applicationContext)
        }

        /** The website sends this class's timetable: JSON [{day,hour,minute,activity}]. */
        @JavascriptInterface fun setRoutine(json: String) {
            if (!trusted) return
            val next = runCatching {
                val arr = JSONArray(json)
                (0 until arr.length()).map {
                    val o = arr.getJSONObject(it)
                    RoutineItem(o.getInt("day").coerceIn(1, 7), o.getInt("hour").coerceIn(0, 23), o.getInt("minute").coerceIn(0, 59), o.optString("activity", "Next activity").take(120))
                }
            }.getOrNull() ?: return
            Prefs.routine = next
            AlarmScheduler.scheduleRoutine(applicationContext)
        }

        @JavascriptInterface fun routineCount(): Int = if (trusted) Prefs.routine.size else 0

        @JavascriptInterface fun testAlarm() {
            if (!trusted) return
            AlarmService.ring(applicationContext, "Test alarm", "This is how loud your alarm will be. Tap Stop.", "todos")
        }

        @JavascriptInterface fun openAppSettings() {
            if (!trusted) return
            runOnUiThread {
                startActivity(
                    Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, packageName),
                )
            }
        }

        @JavascriptInterface fun shareFile(url: String, name: String) {
            if (!trusted || !isOurs(Uri.parse(url))) return
            Thread {
                val file = downloadToCache(url, name.ifBlank { "document.pdf" })
                runOnUiThread {
                    if (file == null) Toast.makeText(this@MainActivity, "Could not load the file.", Toast.LENGTH_LONG).show()
                    else sendFile(file, Intent.ACTION_SEND)
                }
            }.start()
        }
    }

    companion object {
        private const val REQ_FILE = 42
    }
}
