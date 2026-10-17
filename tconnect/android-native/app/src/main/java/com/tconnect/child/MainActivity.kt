package com.tconnect.child

import android.annotation.SuppressLint
import android.app.Activity
import android.os.BatteryManager
import android.os.Bundle
import android.Manifest
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import org.json.JSONArray
import org.json.JSONObject
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebChromeClient
import android.webkit.PermissionRequest
import androidx.webkit.WebViewAssetLoader
import android.content.Intent
import android.content.BroadcastReceiver
import android.content.Context
import android.media.projection.MediaProjectionManager
import kotlin.math.roundToInt
import android.speech.tts.TextToSpeech
import java.util.Locale
import android.os.Build
import android.os.Vibrator
import android.os.VibratorManager
import android.os.VibrationEffect
import android.os.Environment
import android.provider.MediaStore
import android.provider.Settings
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.ThumbnailUtils
import android.util.Base64
import android.util.Size
import android.webkit.MimeTypeMap
import androidx.core.content.FileProvider
import java.io.File
import java.io.ByteArrayOutputStream

class MainActivity : Activity() {
    private lateinit var web: WebView
    private var batteryReceiver: BroadcastReceiver? = null
    private var pendingWebPermissionRequest: PermissionRequest? = null
    private var tts: TextToSpeech? = null
    private var ttsReady = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        web = WebView(this)
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.settings.allowFileAccess = false
        web.settings.allowContentAccess = false
        web.settings.setGeolocationEnabled(true)
        web.settings.mediaPlaybackRequiresUserGesture = false
        tts = TextToSpeech(this) { status ->
            if (status == TextToSpeech.SUCCESS) {
                val r = tts?.setLanguage(Locale("pt", "PT"))
                if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) {
                    tts?.setLanguage(Locale("pt", "BR"))
                }
                tts?.setSpeechRate(0.98f)
                tts?.setPitch(1.0f)
                ttsReady = true
            }
        }
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, url: String) = assetLoader.shouldInterceptRequest(Uri.parse(url))
            override fun shouldOverrideUrlLoading(view: WebView, request: android.webkit.WebResourceRequest): Boolean {
                val u = request.url
                val s = u.scheme ?: ""
                val h = u.host ?: ""
                // WhatsApp, telefone, email, SMS, lojas e esquemas de app abrem FORA da WebView (no app certo).
                val external = s in listOf("whatsapp", "tel", "mailto", "sms", "smsto", "market", "intent") ||
                    h == "wa.me" || h == "api.whatsapp.com" || h == "whatsapp.com" || h.endsWith(".whatsapp.com")
                if (external) {
                    return try {
                        startActivity(Intent(Intent.ACTION_VIEW, u).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); true
                    } catch (_: Exception) { false }
                }
                return false
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    val resources = request.resources.toList()
                    val needCamera = resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)
                    val needMic = resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)
                    val cameraOk = !needCamera || checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
                    val micOk = !needMic || checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
                    if (cameraOk && micOk) { request.grant(resources.toTypedArray()); return@runOnUiThread }
                    pendingWebPermissionRequest?.deny()
                    pendingWebPermissionRequest = request
                    val req = mutableListOf<String>()
                    if (needCamera && !cameraOk) req.add(Manifest.permission.CAMERA)
                    if (needMic && !micOk) req.add(Manifest.permission.RECORD_AUDIO)
                    if (req.isNotEmpty()) requestPermissions(req.toTypedArray(), 4300) else request.deny()
                }
            }
            override fun onGeolocationPermissionsShowPrompt(origin: String, callback: android.webkit.GeolocationPermissions.Callback) {
                val granted = checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                    checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
                // Autoriza a origem interna do app a usar o GPS, desde que o Android já tenha concedido a permissão de localização.
                callback.invoke(origin, granted, false)
                if (!granted) {
                    try {
                        requestPermissions(
                            arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION),
                            4400
                        )
                    } catch (_: Exception) {}
                }
            }
        }
        web.addJavascriptInterface(NativeBattery(), "TCNativeBattery")
        web.addJavascriptInterface(NativeSms(), "TCNativeSms")
        web.addJavascriptInterface(NativeCalls(), "TCNativeCalls")
        web.addJavascriptInterface(NativeScreenCapture(), "TCNativeScreenCapture")
        web.addJavascriptInterface(NativeUpdater(this, web), "TCNativeUpdater")
        web.addJavascriptInterface(NativePermissions(), "TCNativePermissions")
        web.addJavascriptInterface(NativeApp(), "TCNativeApp")
        web.addJavascriptInterface(NativeVoice(), "TCNativeVoice")
        web.addJavascriptInterface(NativeContacts(), "TCNativeContacts")
        web.addJavascriptInterface(NativeApps(), "TCNativeApps")
        web.addJavascriptInterface(NativeFiles(), "TCNativeFiles")
        web.addJavascriptInterface(NativeBg(), "TCNativeBg")
        // For a production APK, bundle the tc236 web root into app/src/main/assets/tc236.
        web.loadUrl(BuildConfig.START_URL)
        setContentView(web)
        // App da Criança: arranca o serviço de segundo plano para continuar detetável
        // (localização/heartbeat e pedidos de captura) sem a app estar aberta.
        if (packageName == "com.tconnect.child") {
            try {
                val svc = Intent(this, KeepAliveService::class.java)
                if (Build.VERSION.SDK_INT >= 26) startForegroundService(svc) else startService(svc)
            } catch (_: Exception) {}
        }
        batteryReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                val percent = NativeBattery().getPercent()
                val charging = NativeBattery().isCharging()
                if (percent in 0..100) {
                    web.evaluateJavascript("window.dispatchEvent(new CustomEvent('tc-native-battery',{detail:{percent:$percent,charging:$charging}}));void 0", null)
                }
            }
        }
        registerReceiver(batteryReceiver, android.content.IntentFilter(Intent.ACTION_BATTERY_CHANGED))
    }


    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (!::web.isInitialized) return
        // 4300 = pedido de permissão vindo de uma PermissionRequest do WebView (câmara/microfone).
        if (requestCode == 4300) {
            val request = pendingWebPermissionRequest
            pendingWebPermissionRequest = null
            if (request != null) {
                val resources = request.resources.toList()
                val cameraOk = !resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE) || checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
                val micOk = !resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE) || checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
                if (cameraOk && micOk) request.grant(resources.toTypedArray()) else request.deny()
            }
        }
        // 4400 = permissão de localização pedida pelo WebView (ponto azul do Guardian).
        // Quando o utilizador concede, reinicia já o rastreio para o ponto azul aparecer sem esperar.
        if (requestCode == 4400) {
            val locOk = checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
            if (locOk) {
                web.postDelayed({
                    web.evaluateJavascript("try{if(typeof tcStartSelfLocation==='function')tcStartSelfLocation();}catch(e){}void 0", null)
                }, 300)
            }
        }
        // 4500 = permissões do Explorador de ficheiros (média/armazenamento).
        if (requestCode == 4500) {
            web.evaluateJavascript("window.dispatchEvent(new Event('tc-native-files-updated'));void 0", null)
        }
        // Em qualquer pedido de permissão (4300 ou os pedidos diretos 4101/4102/4200/4201/4202),
        // atualiza a interface web com o estado atual das permissões.
        web.evaluateJavascript("window.dispatchEvent(new Event('tc-native-permissions-updated'));void 0", null)
        web.postDelayed({
            val status = NativePermissions().getStatus()
            web.evaluateJavascript("window.dispatchEvent(new CustomEvent('tc-native-permissions',{detail:$status}));void 0", null)
        }, 250)
    }

    override fun onResume() {
        super.onResume()
        // Ao regressar das definições (ex.: "Acesso a todos os ficheiros"), avisa o explorador.
        if (::web.isInitialized) {
            try { web.evaluateJavascript("window.dispatchEvent(new Event('tc-native-files-updated'));void 0", null) } catch (_: Exception) {}
        }
    }

    override fun onDestroy() {
        batteryReceiver?.let { unregisterReceiver(it) }
        batteryReceiver = null
        pendingWebPermissionRequest?.deny()
        pendingWebPermissionRequest = null
        web.stopLoading()
        web.destroy()
        try { tts?.stop(); tts?.shutdown() } catch (_: Exception) {}
        super.onDestroy()
    }

    @Deprecated("Back é tratado pelo app web; fallback minimiza a app.")
    override fun onBackPressed() {
        // Pergunta ao app web se trata o Voltar (fechar modal / ir ao Monitoramento).
        web.evaluateJavascript(
            "(window.tcOnBackPressed && window.tcOnBackPressed()) ? '1' : '0'"
        ) { result ->
            val handled = result != null && result.contains("1")
            if (!handled) {
                runOnUiThread {
                    if (web.canGoBack()) web.goBack() else moveTaskToBack(true)
                }
            }
        }
    }

    inner class NativeVoice {
        @JavascriptInterface
        fun available(): Boolean = ttsReady
        @JavascriptInterface
        fun speak(text: String) {
            if (!ttsReady) return
            runOnUiThread {
                try { tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "tc-voice") } catch (_: Exception) {}
            }
        }
        @JavascriptInterface
        fun vibrate(patternJson: String) {
            try {
                val arr = JSONArray(patternJson)
                val pattern = LongArray(arr.length()) { arr.getLong(it) }
                val vib: Vibrator = if (Build.VERSION.SDK_INT >= 31) {
                    (getSystemService(VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
                } else {
                    @Suppress("DEPRECATION") (getSystemService(VIBRATOR_SERVICE) as Vibrator)
                }
                if (Build.VERSION.SDK_INT >= 26) {
                    vib.vibrate(VibrationEffect.createWaveform(pattern, -1))
                } else {
                    @Suppress("DEPRECATION") vib.vibrate(pattern, -1)
                }
            } catch (_: Exception) {}
        }
    }

    inner class NativeBg {
        // A WebView guarda aqui as credenciais para o serviço nativo enviar heartbeat/localização
        // mesmo com a app fechada. Nada sensível além do token de sessão da própria conta anónima.
        @JavascriptInterface
        fun configure(json: String) {
            try {
                val j = org.json.JSONObject(json)
                val sp = getSharedPreferences("tc_bg", MODE_PRIVATE)
                val e = sp.edit()
                if (j.has("url")) e.putString("url", j.optString("url"))
                if (j.has("key")) e.putString("key", j.optString("key"))
                if (j.has("device")) e.putString("device", j.optString("device"))
                if (j.has("access")) e.putString("access", j.optString("access"))
                if (j.has("refresh")) e.putString("refresh", j.optString("refresh"))
                e.apply()
            } catch (_: Exception) {}
            // garante que o serviço está a correr
            try {
                val i = Intent(this@MainActivity, KeepAliveService::class.java)
                if (Build.VERSION.SDK_INT >= 26) startForegroundService(i) else startService(i)
            } catch (_: Exception) {}
        }
    }

    inner class NativeApp {
        @JavascriptInterface
        fun getVersion(): String = BuildConfig.VERSION_NAME
        @JavascriptInterface
        fun getVersionCode(): Int = BuildConfig.VERSION_CODE
        // Nome/modelo real do aparelho (ex.: "Samsung Galaxy A12"), para identificar a pessoa.
        @JavascriptInterface
        fun getDeviceModel(): String {
            return try {
                val maker = (Build.MANUFACTURER ?: "").trim()
                val model = (Build.MODEL ?: "").trim()
                val name = when {
                    model.isEmpty() -> maker
                    maker.isEmpty() || model.lowercase(Locale.getDefault()).startsWith(maker.lowercase(Locale.getDefault())) -> model
                    else -> "$maker $model"
                }
                val clean = name.trim().replaceFirstChar { if (it.isLowerCase()) it.titlecase(Locale.getDefault()) else it.toString() }
                if (clean.isBlank()) "Dispositivo Android" else clean
            } catch (_: Exception) { "Dispositivo Android" }
        }
    }

    inner class NativeContacts {
        @JavascriptInterface
        fun hasReadPermission(): Boolean = checkSelfPermission(Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED

        @JavascriptInterface
        fun requestReadPermission(): String {
            if (hasReadPermission()) return "GRANTED"
            requestPermissions(arrayOf(Manifest.permission.READ_CONTACTS), 4103)
            return "REQUESTED"
        }

        @JavascriptInterface
        fun readContacts(limit: Int): String {
            if (!hasReadPermission()) return JSONArray().toString()
            val out = JSONArray()
            val max = limit.coerceIn(1, 10000)
            var cursor: Cursor? = null
            try {
                val uri = android.provider.ContactsContract.CommonDataKinds.Phone.CONTENT_URI
                val proj = arrayOf(
                    android.provider.ContactsContract.CommonDataKinds.Phone.CONTACT_ID,
                    android.provider.ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                    android.provider.ContactsContract.CommonDataKinds.Phone.NUMBER
                )
                cursor = contentResolver.query(uri, proj, null, null,
                    android.provider.ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " ASC")
                if (cursor != null) {
                    val idI = cursor.getColumnIndex(proj[0])
                    val nameI = cursor.getColumnIndex(proj[1])
                    val numI = cursor.getColumnIndex(proj[2])
                    var count = 0
                    val seen = HashSet<String>()
                    while (cursor.moveToNext() && count < max) {
                        val num = if (numI >= 0) (cursor.getString(numI) ?: "") else ""
                        val name = if (nameI >= 0) (cursor.getString(nameI) ?: "") else ""
                        val key = name + "|" + num.replace(" ", "")
                        if (num.isBlank() || seen.contains(key)) continue
                        seen.add(key)
                        val o = JSONObject()
                        o.put("id", if (idI >= 0) cursor.getString(idI) else "")
                        o.put("name", name)
                        o.put("number", num)
                        out.put(o)
                        count++
                    }
                }
            } catch (_: Exception) {
                return JSONArray().toString()
            } finally { cursor?.close() }
            return out.toString()
        }
    }

    inner class NativeApps {
        @JavascriptInterface
        fun hasUsageAccess(): Boolean {
            return try {
                val appOps = getSystemService(APP_OPS_SERVICE) as android.app.AppOpsManager
                val mode = appOps.unsafeCheckOpNoThrow(
                    android.app.AppOpsManager.OPSTR_GET_USAGE_STATS,
                    android.os.Process.myUid(), packageName
                )
                mode == android.app.AppOpsManager.MODE_ALLOWED
            } catch (_: Exception) { false }
        }

        @JavascriptInterface
        fun requestUsageAccess() {
            try {
                startActivity(Intent(android.provider.Settings.ACTION_USAGE_ACCESS_SETTINGS)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            } catch (_: Exception) {}
        }

        @JavascriptInterface
        fun listApps(): String {
            val out = JSONArray()
            try {
                val pm = packageManager
                // Mapa de uso (últimas 24h) se o acesso estiver concedido.
                val usage = HashMap<String, Long>()
                if (hasUsageAccess()) {
                    try {
                        val usm = getSystemService(USAGE_STATS_SERVICE) as android.app.usage.UsageStatsManager
                        val now = System.currentTimeMillis()
                        val stats = usm.queryUsageStats(
                            android.app.usage.UsageStatsManager.INTERVAL_DAILY,
                            now - 24L * 60 * 60 * 1000, now)
                        stats?.forEach { u ->
                            usage[u.packageName] = (usage[u.packageName] ?: 0L) + u.totalTimeInForeground
                        }
                    } catch (_: Exception) {}
                }
                val apps = pm.getInstalledApplications(0)
                for (ai in apps) {
                    val o = JSONObject()
                    o.put("package", ai.packageName)
                    o.put("label", pm.getApplicationLabel(ai).toString())
                    val isSystem = (ai.flags and android.content.pm.ApplicationInfo.FLAG_SYSTEM) != 0
                    o.put("system", isSystem)
                    val ms = usage[ai.packageName] ?: 0L
                    o.put("usage", ms / 60000L) // minutos
                    out.put(o)
                }
            } catch (_: Exception) {
                return JSONArray().toString()
            }
            return out.toString()
        }
    }

    inner class NativeFiles {
        private fun sdk() = Build.VERSION.SDK_INT

        // Acesso total ao sistema de ficheiros (necessário para documentos/pastas em 11+).
        @JavascriptInterface
        fun hasAccess(): Boolean =
            if (sdk() >= 30) Environment.isExternalStorageManager()
            else checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED

        // Acesso só a média (fotos/vídeos/músicas) — suficiente nessas categorias em 13+.
        @JavascriptInterface
        fun hasMedia(): Boolean =
            if (sdk() >= 33)
                checkSelfPermission(Manifest.permission.READ_MEDIA_IMAGES) == PackageManager.PERMISSION_GRANTED ||
                checkSelfPermission(Manifest.permission.READ_MEDIA_VIDEO) == PackageManager.PERMISSION_GRANTED ||
                checkSelfPermission(Manifest.permission.READ_MEDIA_AUDIO) == PackageManager.PERMISSION_GRANTED
            else checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED

        @JavascriptInterface
        fun requestAccess(): String {
            if (sdk() >= 30) {
                if (Environment.isExternalStorageManager()) return "GRANTED"
                try {
                    startActivity(Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION,
                        Uri.parse("package:$packageName")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                } catch (_: Exception) {
                    try { startActivity(Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) } catch (_: Exception) {}
                }
                return "REQUESTED"
            }
            if (hasAccess()) return "GRANTED"
            requestPermissions(arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE), 4500)
            return "REQUESTED"
        }

        @JavascriptInterface
        fun requestMedia(): String {
            if (hasMedia()) return "GRANTED"
            val req = if (sdk() >= 33)
                arrayOf(Manifest.permission.READ_MEDIA_IMAGES, Manifest.permission.READ_MEDIA_VIDEO, Manifest.permission.READ_MEDIA_AUDIO)
            else arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE)
            requestPermissions(req, 4500)
            return "REQUESTED"
        }

        // Pastas comuns, para o ecrã inicial do explorador.
        @JavascriptInterface
        fun roots(): String {
            val arr = JSONArray()
            val base = Environment.getExternalStorageDirectory()
            fun add(label: String, icon: String, dir: File?) {
                if (dir != null && dir.exists() && dir.isDirectory) {
                    val o = JSONObject(); o.put("name", label); o.put("icon", icon); o.put("path", dir.absolutePath); arr.put(o)
                }
            }
            add("Armazenamento interno", "storage", base)
            add("Transferências", "download", File(base, "Download"))
            add("Documentos", "doc", File(base, "Documents"))
            add("Imagens", "image", File(base, "Pictures"))
            add("Câmara", "image", File(base, "DCIM"))
            add("Música", "audio", File(base, "Music"))
            add("Vídeos", "video", File(base, "Movies"))
            add("WhatsApp", "chat", File(base, "Android/media/com.whatsapp/WhatsApp/Media"))
            return arr.toString()
        }

        // Lista o conteúdo de uma pasta (pastas primeiro, depois ficheiros).
        @JavascriptInterface
        fun listDir(path: String): String {
            val out = JSONObject()
            try {
                val dir = if (path.isBlank()) Environment.getExternalStorageDirectory() else File(path)
                out.put("path", dir.absolutePath)
                out.put("name", if (dir.name.isBlank()) "Armazenamento" else dir.name)
                val rootPath = Environment.getExternalStorageDirectory().absolutePath
                out.put("parent", if (dir.absolutePath == rootPath) "" else (dir.parentFile?.absolutePath ?: ""))
                val arr = JSONArray()
                val files = dir.listFiles()
                if (files != null) {
                    val sorted = files.filter { !it.isHidden }
                        .sortedWith(compareByDescending<File> { it.isDirectory }.thenBy { it.name.lowercase(Locale.getDefault()) })
                    for (f in sorted) {
                        val o = JSONObject()
                        o.put("name", f.name)
                        o.put("path", f.absolutePath)
                        o.put("dir", f.isDirectory)
                        o.put("size", if (f.isDirectory) 0L else f.length())
                        o.put("date", f.lastModified())
                        if (f.isDirectory) {
                            o.put("kind", "folder")
                            o.put("count", (f.list()?.size ?: 0))
                        } else {
                            val mime = guessMime(f.name)
                            o.put("mime", mime); o.put("kind", kindOf(mime, f.name))
                        }
                        arr.put(o)
                    }
                }
                out.put("items", arr); out.put("ok", true)
            } catch (e: Exception) { out.put("ok", false); out.put("error", e.message ?: "erro") }
            return out.toString()
        }

        // Lista por categoria via MediaStore (rápido; funciona só com permissão de média).
        @JavascriptInterface
        fun listCategory(cat: String, limit: Int): String {
            val out = JSONArray()
            val max = limit.coerceIn(1, 100000)
            try {
                val uri = when (cat) {
                    "image" -> MediaStore.Images.Media.EXTERNAL_CONTENT_URI
                    "video" -> MediaStore.Video.Media.EXTERNAL_CONTENT_URI
                    "audio" -> MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
                    else -> MediaStore.Files.getContentUri("external")
                }
                val proj = arrayOf(
                    MediaStore.MediaColumns._ID, MediaStore.MediaColumns.DISPLAY_NAME,
                    MediaStore.MediaColumns.SIZE, MediaStore.MediaColumns.DATE_MODIFIED,
                    MediaStore.MediaColumns.MIME_TYPE, MediaStore.MediaColumns.DATA
                )
                var sel: String? = null; var args: Array<String>? = null
                if (cat == "doc") {
                    val mimes = listOf(
                        "application/pdf", "application/msword",
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        "application/vnd.ms-excel",
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        "application/vnd.ms-powerpoint",
                        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                        "text/plain", "application/rtf", "application/epub+zip"
                    )
                    sel = mimes.joinToString(" OR ") { MediaStore.MediaColumns.MIME_TYPE + "=?" }
                    args = mimes.toTypedArray()
                }
                val sort = MediaStore.MediaColumns.DATE_MODIFIED + " DESC"
                contentResolver.query(uri, proj, sel, args, sort)?.use { c ->
                    val idI = c.getColumnIndex(MediaStore.MediaColumns._ID)
                    val nI = c.getColumnIndex(MediaStore.MediaColumns.DISPLAY_NAME)
                    val sI = c.getColumnIndex(MediaStore.MediaColumns.SIZE)
                    val dI = c.getColumnIndex(MediaStore.MediaColumns.DATE_MODIFIED)
                    val mI = c.getColumnIndex(MediaStore.MediaColumns.MIME_TYPE)
                    val pI = c.getColumnIndex(MediaStore.MediaColumns.DATA)
                    var n = 0
                    while (c.moveToNext() && n < max) {
                        val name = if (nI >= 0) c.getString(nI) ?: "" else ""
                        val data = if (pI >= 0) c.getString(pI) ?: "" else ""
                        if (name.isBlank() && data.isBlank()) continue
                        val o = JSONObject()
                        o.put("name", if (name.isNotBlank()) name else File(data).name)
                        o.put("path", data)
                        o.put("id", if (idI >= 0) c.getLong(idI) else 0L)
                        o.put("size", if (sI >= 0) c.getLong(sI) else 0L)
                        o.put("date", (if (dI >= 0) c.getLong(dI) else 0L) * 1000L)
                        val mime = if (mI >= 0) c.getString(mI) ?: "" else ""
                        o.put("mime", mime)
                        o.put("kind", if (cat == "doc") kindOf(mime, name) else cat)
                        o.put("dir", false)
                        out.put(o); n++
                    }
                }
            } catch (_: Exception) {}
            return out.toString()
        }

        // Miniatura (base64) para imagens/vídeos.
        @JavascriptInterface
        fun thumb(path: String, px: Int): String {
            try {
                val f = File(path)
                if (!f.exists() || f.isDirectory) return ""
                val size = px.coerceIn(48, 512)
                val mime = guessMime(path)
                val bmp = (when {
                    mime.startsWith("image") -> decodeSampled(path, size)
                    mime.startsWith("video") -> videoThumb(f, path, size)
                    else -> null
                }) ?: return ""
                val baos = ByteArrayOutputStream()
                bmp.compress(Bitmap.CompressFormat.JPEG, 72, baos)
                bmp.recycle()
                return "data:image/jpeg;base64," + Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP)
            } catch (_: Exception) { return "" }
        }

        @Suppress("DEPRECATION")
        private fun videoThumb(f: File, path: String, size: Int): Bitmap? {
            return try {
                if (sdk() >= 29) ThumbnailUtils.createVideoThumbnail(f, Size(size, size), null)
                else ThumbnailUtils.createVideoThumbnail(path, MediaStore.Video.Thumbnails.MINI_KIND)
            } catch (_: Exception) { null }
        }

        private fun decodeSampled(path: String, req: Int): Bitmap? {
            val o = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(path, o)
            var s = 1; val w = o.outWidth; val h = o.outHeight
            if (w <= 0 || h <= 0) return null
            while (w / (s * 2) >= req && h / (s * 2) >= req) s *= 2
            val o2 = BitmapFactory.Options().apply { inSampleSize = s }
            return BitmapFactory.decodeFile(path, o2)
        }

        // Abre o ficheiro com o app apropriado.
        @JavascriptInterface
        fun open(path: String): String {
            try {
                val f = File(path)
                if (!f.exists()) return "NOT_FOUND"
                val mime = guessMime(path)
                val uri = FileProvider.getUriForFile(this@MainActivity, "$packageName.fileprovider", f)
                val view = Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(uri, if (mime.isNotBlank()) mime else "*/*")
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                startActivity(Intent.createChooser(view, "Abrir com").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                return "OPENED"
            } catch (e: Exception) { return "ERROR:" + (e.message ?: "open") }
        }

        private fun guessMime(name: String): String {
            val ext = name.substringAfterLast('.', "").lowercase(Locale.getDefault())
            return when (ext) {
                "jpg", "jpeg" -> "image/jpeg"; "png" -> "image/png"; "gif" -> "image/gif"
                "webp" -> "image/webp"; "bmp" -> "image/bmp"; "heic", "heif" -> "image/heic"
                "mp4" -> "video/mp4"; "mkv" -> "video/x-matroska"; "3gp" -> "video/3gpp"
                "avi" -> "video/x-msvideo"; "mov" -> "video/quicktime"; "webm" -> "video/webm"
                "mp3" -> "audio/mpeg"; "wav" -> "audio/wav"; "ogg" -> "audio/ogg"; "m4a" -> "audio/mp4"
                "aac" -> "audio/aac"; "opus" -> "audio/opus"; "flac" -> "audio/flac"; "amr" -> "audio/amr"
                "pdf" -> "application/pdf"; "txt" -> "text/plain"; "rtf" -> "application/rtf"
                "doc" -> "application/msword"
                "docx" -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                "xls" -> "application/vnd.ms-excel"
                "xlsx" -> "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                "ppt" -> "application/vnd.ms-powerpoint"
                "pptx" -> "application/vnd.openxmlformats-officedocument.presentationml.presentation"
                "zip" -> "application/zip"; "rar" -> "application/x-rar-compressed"
                "apk" -> "application/vnd.android.package-archive"
                else -> MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext) ?: ""
            }
        }

        private fun kindOf(mime: String, name: String): String {
            val m = if (mime.isNotBlank()) mime else guessMime(name)
            return when {
                m.startsWith("image") -> "image"
                m.startsWith("video") -> "video"
                m.startsWith("audio") -> "audio"
                m == "application/pdf" -> "pdf"
                m.contains("word") || m.endsWith("wordprocessingml.document") -> "doc"
                m.contains("sheet") || m.contains("excel") -> "sheet"
                m.contains("presentation") || m.contains("powerpoint") -> "slide"
                m.startsWith("text") -> "text"
                m.contains("zip") || m.contains("rar") || m.contains("compressed") -> "zip"
                else -> "file"
            }
        }
    }

    inner class NativePermissions {
        @JavascriptInterface
        fun getStatus(): String {
            fun g(p:String)=checkSelfPermission(p)==PackageManager.PERMISSION_GRANTED
            val o=JSONObject()
            o.put("camera",g(Manifest.permission.CAMERA))
            o.put("microphone",g(Manifest.permission.RECORD_AUDIO))
            o.put("location",g(Manifest.permission.ACCESS_FINE_LOCATION)||g(Manifest.permission.ACCESS_COARSE_LOCATION))
            o.put("notifications",android.os.Build.VERSION.SDK_INT<33||g(Manifest.permission.POST_NOTIFICATIONS))
            o.put("sms",g(Manifest.permission.READ_SMS))
            o.put("contacts",g(Manifest.permission.READ_CONTACTS))
            o.put("calls",g(Manifest.permission.READ_CALL_LOG)&&g(Manifest.permission.READ_PHONE_STATE))
            o.put("screen",false)
            return o.toString()
        }
        @JavascriptInterface
        fun requestCamera(): String {
            if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) return "GRANTED"
            requestPermissions(arrayOf(Manifest.permission.CAMERA), 4201)
            return "REQUESTED"
        }

        @JavascriptInterface
        fun requestMicrophone(): String {
            if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) return "GRANTED"
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), 4202)
            return "REQUESTED"
        }

        @JavascriptInterface
        fun requestAll(): String {
            val req=mutableListOf<String>()
            listOf(Manifest.permission.CAMERA,Manifest.permission.RECORD_AUDIO,Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION).forEach{if(checkSelfPermission(it)!=PackageManager.PERMISSION_GRANTED) req.add(it)}
            if(android.os.Build.VERSION.SDK_INT>=33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED) req.add(Manifest.permission.POST_NOTIFICATIONS)
            if(checkSelfPermission(Manifest.permission.READ_SMS)!=PackageManager.PERMISSION_GRANTED) req.add(Manifest.permission.READ_SMS)
            if(checkSelfPermission(Manifest.permission.READ_CALL_LOG)!=PackageManager.PERMISSION_GRANTED) req.add(Manifest.permission.READ_CALL_LOG)
            if(checkSelfPermission(Manifest.permission.READ_CONTACTS)!=PackageManager.PERMISSION_GRANTED) req.add(Manifest.permission.READ_CONTACTS)
            if(checkSelfPermission(Manifest.permission.READ_PHONE_STATE)!=PackageManager.PERMISSION_GRANTED) req.add(Manifest.permission.READ_PHONE_STATE)
            if(req.isNotEmpty()) requestPermissions(req.toTypedArray(),4200)
            return getStatus()
        }
    }

    inner class NativeSms {
        @JavascriptInterface
        fun hasReadPermission(): Boolean = checkSelfPermission(Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED

        @JavascriptInterface
        fun requestReadPermission(): String {
            if (hasReadPermission()) return "GRANTED"
            requestPermissions(arrayOf(Manifest.permission.READ_SMS), 4101)
            return "REQUESTED"
        }

        @JavascriptInterface
        fun readMessages(limit: Int): String {
            if (!hasReadPermission()) return JSONArray().toString()
            val out = JSONArray()
            val safeLimit = limit.coerceIn(1, 50000)
            val uri: Uri = Uri.parse("content://sms")
            val projection = arrayOf("_id", "address", "body", "date", "type")
            var cursor: Cursor? = null
            try {
                cursor = contentResolver.query(uri, projection, null, null, "date DESC")
                if (cursor != null) {
                    val idIdx = cursor.getColumnIndex("_id")
                    val addressIdx = cursor.getColumnIndex("address")
                    val bodyIdx = cursor.getColumnIndex("body")
                    val dateIdx = cursor.getColumnIndex("date")
                    val typeIdx = cursor.getColumnIndex("type")
                    var count = 0
                    while (cursor.moveToNext() && count < safeLimit) {
                        val type = if (typeIdx >= 0) cursor.getInt(typeIdx) else 0
                        val direction = when (type) {
                            1 -> "RECEBIDA"
                            2 -> "ENVIADA"
                            else -> "OUTRA"
                        }
                        if (direction == "OUTRA") continue
                        val item = JSONObject()
                        item.put("id", if (idIdx >= 0) cursor.getString(idIdx) else "")
                        item.put("address", if (addressIdx >= 0) cursor.getString(addressIdx) else "")
                        item.put("body", if (bodyIdx >= 0) cursor.getString(bodyIdx) else "")
                        item.put("date", if (dateIdx >= 0) cursor.getLong(dateIdx) else 0L)
                        item.put("direction", direction)
                        out.put(item)
                        count++
                    }
                }
            } catch (_: Exception) {
                return JSONArray().toString()
            } finally {
                cursor?.close()
            }
            return out.toString()
        }
    }

    inner class NativeCalls {
        @JavascriptInterface
        fun hasReadPermission(): Boolean = checkSelfPermission(Manifest.permission.READ_CALL_LOG) == PackageManager.PERMISSION_GRANTED

        @JavascriptInterface
        fun requestReadPermission(): String {
            if (hasReadPermission()) return "GRANTED"
            requestPermissions(arrayOf(Manifest.permission.READ_CALL_LOG, Manifest.permission.READ_PHONE_STATE), 4102)
            return "REQUESTED"
        }

        @JavascriptInterface
        fun readCalls(limit: Int): String {
            if (!hasReadPermission()) return JSONArray().toString()
            val out = JSONArray()
            val safeLimit = limit.coerceIn(1, 50000)
            val uri: Uri = Uri.parse("content://call_log/calls")
            val projection = arrayOf("_id", "number", "name", "date", "duration", "type")
            var cursor: Cursor? = null
            try {
                cursor = contentResolver.query(uri, projection, null, null, "date DESC")
                if (cursor != null) {
                    val idIdx = cursor.getColumnIndex("_id")
                    val numIdx = cursor.getColumnIndex("number")
                    val nameIdx = cursor.getColumnIndex("name")
                    val dateIdx = cursor.getColumnIndex("date")
                    val durIdx = cursor.getColumnIndex("duration")
                    val typeIdx = cursor.getColumnIndex("type")
                    var count = 0
                    while (cursor.moveToNext() && count < safeLimit) {
                        val type = if (typeIdx >= 0) cursor.getInt(typeIdx) else 0
                        val direction = when (type) {
                            1, 3 -> "RECEBIDA"
                            2 -> "EFETUADA"
                            else -> "OUTRA"
                        }
                        if (direction == "OUTRA") continue
                        val item = JSONObject()
                        item.put("id", if (idIdx >= 0) cursor.getString(idIdx) else "")
                        item.put("number", if (numIdx >= 0) cursor.getString(numIdx) else "")
                        item.put("name", if (nameIdx >= 0) cursor.getString(nameIdx) else "")
                        item.put("date", if (dateIdx >= 0) cursor.getLong(dateIdx) else 0L)
                        item.put("duration", if (durIdx >= 0) cursor.getLong(durIdx) else 0L)
                        item.put("direction", direction)
                        out.put(item)
                        count++
                    }
                }
            } catch (_: Exception) {
                return JSONArray().toString()
            } finally { cursor?.close() }
            return out.toString()
        }
    }

    inner class NativeScreenCapture {
        @JavascriptInterface
        fun isSupported(): Boolean = android.os.Build.VERSION.SDK_INT >= 21

        @JavascriptInterface
        fun requestCapture(): String {
            if (!isSupported()) return "UNSUPPORTED"
            val mgr = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            startActivityForResult(mgr.createScreenCaptureIntent(), 5100)
            return "REQUESTED"
        }

        @JavascriptInterface
        fun stopCapture() {
            startService(Intent(this@MainActivity, ScreenCaptureService::class.java).setAction(ScreenCaptureService.ACTION_STOP))
        }
    }

    inner class NativeBattery {
        private val bm by lazy { getSystemService(BATTERY_SERVICE) as BatteryManager }

        private fun batteryIntent(): android.content.Intent =
            registerReceiver(null, android.content.IntentFilter(android.content.Intent.ACTION_BATTERY_CHANGED))
                ?: android.content.Intent()

        @JavascriptInterface
        fun getPercent(): Int {
            val direct = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
            if (direct in 0..100) return direct
            val intent = batteryIntent()
            val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
            val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
            if (level >= 0 && scale > 0) return ((level * 100f) / scale).roundToInt().coerceIn(0, 100)
            return -1
        }

        @JavascriptInterface
        fun getInfo(): String {
            val intent = batteryIntent()
            val direct = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
            val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
            val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
            val percent = if (direct in 0..100) direct else if (level >= 0 && scale > 0) ((level * 100f) / scale).roundToInt().coerceIn(0, 100) else -1
            val status = intent.getIntExtra(BatteryManager.EXTRA_STATUS, BatteryManager.BATTERY_STATUS_UNKNOWN)
            val charging = status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL
            return org.json.JSONObject().put("percent", percent).put("charging", charging).toString()
        }

        @JavascriptInterface
        fun isCharging(): Boolean {
            val status = batteryIntent().getIntExtra(BatteryManager.EXTRA_STATUS, BatteryManager.BATTERY_STATUS_UNKNOWN)
            return status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == 5100) {
            if (resultCode == RESULT_OK && data != null) {
                val i = Intent(this, ScreenCaptureService::class.java).apply {
                    action = ScreenCaptureService.ACTION_START
                    putExtra(ScreenCaptureService.EXTRA_RESULT_CODE, resultCode)
                    putExtra(ScreenCaptureService.EXTRA_DATA, data)
                }
                if (android.os.Build.VERSION.SDK_INT >= 26) startForegroundService(i) else startService(i)
                web.evaluateJavascript("window.dispatchEvent(new CustomEvent('tc-screen-capture',{detail:{active:true}}));void 0", null)
            } else {
                web.evaluateJavascript("window.dispatchEvent(new CustomEvent('tc-screen-capture',{detail:{active:false,cancelled:true}}));void 0", null)
            }
        }
    }

}
