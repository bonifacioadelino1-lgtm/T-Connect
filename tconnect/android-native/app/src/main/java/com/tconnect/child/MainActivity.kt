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
        // Em qualquer pedido de permissão (4300 ou os pedidos diretos 4101/4102/4200/4201/4202),
        // atualiza a interface web com o estado atual das permissões.
        web.evaluateJavascript("window.dispatchEvent(new Event('tc-native-permissions-updated'));void 0", null)
        web.postDelayed({
            val status = NativePermissions().getStatus()
            web.evaluateJavascript("window.dispatchEvent(new CustomEvent('tc-native-permissions',{detail:$status}));void 0", null)
        }, 250)
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
