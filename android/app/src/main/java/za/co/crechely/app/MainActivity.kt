package za.co.crechely.app

import android.Manifest
import android.app.Activity
import android.app.NotificationManager
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
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
                    startActivityForResult(params.createIntent(), REQ_FILE)
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
            val result = if (resultCode == RESULT_OK) WebChromeClient.FileChooserParams.parseResult(resultCode, data) else null
            filePathCallback?.onReceiveValue(result)
            filePathCallback = null
        }
    }

    // ---- push ----

    /** Tells the server (using the website sign-in) where to send this tablet's notifications. */
    private fun registerPushToken() {
        runCatching {
            FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
                Prefs.fcmToken = token
                val body = JSONObject().put("fcmToken", token).put("deviceName", "${Build.MANUFACTURER} ${Build.MODEL}")
                val js = "fetch('/api/mobile/device',{method:'PUT',headers:{'Content-Type':'application/json'},body:" +
                    JSONObject.quote(body.toString()) + "}).catch(function(){});"
                runOnUiThread { if (trusted) web.evaluateJavascript(js, null) }
            }
        } // Firebase isn't set up yet: the website still works, just without push.
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
