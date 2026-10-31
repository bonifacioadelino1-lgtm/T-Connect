package com.tconnect.child

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.BatteryManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import org.json.JSONObject
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.URL

/**
 * Serviço em primeiro plano que mantém a Criança detetável mesmo sem a app aberta.
 * Além de manter o processo vivo, envia NATIVAMENTE (sem a WebView) o heartbeat e a
 * localização ao Supabase, usando as credenciais guardadas por TCNativeBg.configure(...).
 * Trata a expiração do token (refresh) de forma autónoma.
 */
class KeepAliveService : Service() {
    private var lastLocation: Location? = null
    private val handler = Handler(Looper.getMainLooper())
    private var ticking = false
    @Volatile private var lastPushMs = 0L

    private val locListener = object : LocationListener {
        override fun onLocationChanged(location: Location) {
            // Mantém sempre a melhor leitura (prefere GPS/maior precisão quando recente).
            val prev = lastLocation
            if (prev == null || location.time >= prev.time || location.accuracy <= prev.accuracy) lastLocation = location
            // Envio imediato (GPS contínuo): empurra cada leitura ao Supabase, limitado a ~4s,
            // para o ponto vermelho do Guardião se mover em tempo real mesmo com a app fechada.
            val now = System.currentTimeMillis()
            if (now - lastPushMs >= 4_000L) {
                lastPushMs = now
                try { Thread { pushLocationNow(location) }.start() } catch (_: Exception) {}
            }
        }
        @Deprecated("Deprecated in Java")
        override fun onStatusChanged(provider: String?, status: Int, extras: android.os.Bundle?) {}
        override fun onProviderEnabled(provider: String) {}
        override fun onProviderDisabled(provider: String) {}
    }

    private val tick = object : Runnable {
        override fun run() {
            try { Thread { sendCycle() }.start() } catch (_: Exception) {}
            handler.postDelayed(this, 20_000L)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForegroundSafe()
        startLocation()
        if (!ticking) { ticking = true; handler.postDelayed(tick, 5_000L) }
        return START_STICKY
    }

    // Se a app for removida das recentes, reprograma o próprio reinício do serviço.
    override fun onTaskRemoved(rootIntent: Intent?) {
        try {
            val restart = Intent(applicationContext, KeepAliveService::class.java)
            val flags = if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_IMMUTABLE else 0
            val pi = PendingIntent.getService(applicationContext, 7211, restart, flags)
            val am = getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager
            am.set(android.app.AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + 2000L, pi)
        } catch (_: Exception) {}
        super.onTaskRemoved(rootIntent)
    }

    private fun startForegroundSafe() {
        val channelId = "tc_keepalive"
        if (Build.VERSION.SDK_INT >= 26) {
            val ch = NotificationChannel(channelId, "T-Connect Proteção", NotificationManager.IMPORTANCE_LOW)
            ch.setShowBadge(false); ch.enableVibration(false)
            getSystemService(NotificationManager::class.java).createNotificationChannel(ch)
        }
        val tapFlags = if (Build.VERSION.SDK_INT >= 23)
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE else PendingIntent.FLAG_UPDATE_CURRENT
        val tap = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), tapFlags)
        val builder = if (Build.VERSION.SDK_INT >= 26)
            Notification.Builder(this, channelId) else @Suppress("DEPRECATION") Notification.Builder(this)
        val n = builder.setContentTitle("T-Connect — acompanhamento ativo")
            .setContentText("Este dispositivo está a ser acompanhado pelo Guardian (localização e permissões).")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true).setContentIntent(tap).build()
        // IMPORTANTE (arranque automático): no Android 14+ um serviço do tipo "location"
        // iniciado no arranque (BOOT) rebenta se a localização não estiver em "Sempre permitir",
        // e o serviço morre — era por isso que só arrancava ao abrir a app. Arrancamos sempre
        // como "specialUse" (permitido no arranque e sem exigir permissão), e juntamos o tipo
        // "location" só quando há localização em segundo plano concedida.
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                var type = ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
                if (hasBgLocation()) type = type or ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
                startForeground(5120, n, type)
            } else if (Build.VERSION.SDK_INT >= 29) {
                startForeground(5120, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
            } else {
                startForeground(5120, n)
            }
        } catch (_: Exception) {
            // Recurso final: arranca sem exigir permissão de localização (continua a enviar
            // heartbeat/WhatsApp pela rede; a localização entra quando a permissão existir).
            try {
                if (Build.VERSION.SDK_INT >= 34) startForeground(5120, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
                else startForeground(5120, n)
            } catch (_: Exception) {}
        }
    }

    private fun hasLocPerm(): Boolean =
        checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
        checkSelfPermission(android.Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

    // Localização em segundo plano ("Sempre permitir") — necessária para o tipo "location"
    // poder arrancar no boot sem rebentar no Android 14+.
    private fun hasBgLocation(): Boolean =
        if (Build.VERSION.SDK_INT >= 29)
            checkSelfPermission(android.Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED
        else hasLocPerm()

    private fun startLocation() {
        if (!hasLocPerm()) return
        try {
            val lm = getSystemService(LOCATION_SERVICE) as LocationManager
            // Remove pedidos anteriores para não duplicar ao reiniciar o serviço.
            try { lm.removeUpdates(locListener) } catch (_: Exception) {}
            // Alta precisão contínua: pede explicitamente o GPS a cada ~4s e 0m de distância,
            // para seguir o movimento em tempo real. A rede (NETWORK) entra como apoio para um
            // primeiro ponto rápido dentro de casa / sem sinal de GPS.
            val hasGps = checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            if (hasGps) {
                try { lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 4_000L, 0f, locListener, Looper.getMainLooper()) } catch (_: Exception) {}
            }
            try { lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 5_000L, 0f, locListener, Looper.getMainLooper()) } catch (_: Exception) {}
            // Caso algum fabricante exponha outros fornecedores ativos, também os usamos.
            for (p in lm.getProviders(true)) {
                if (p == LocationManager.GPS_PROVIDER || p == LocationManager.NETWORK_PROVIDER) continue
                try { lm.requestLocationUpdates(p, 5_000L, 0f, locListener, Looper.getMainLooper()) } catch (_: Exception) {}
            }
            // Semente inicial: último ponto conhecido mais recente.
            for (p in lm.getProviders(true)) {
                try { val l = lm.getLastKnownLocation(p); if (l != null && (lastLocation == null || l.time > lastLocation!!.time)) lastLocation = l } catch (_: Exception) {}
            }
        } catch (_: Exception) {}
    }

    /** Empurra uma leitura de localização isolada ao Supabase (chamado a cada fix do GPS). */
    private fun pushLocationNow(loc: Location) {
        var wl: PowerManager.WakeLock? = null
        try {
            try {
                val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
                wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "tconnect:locpush")
                wl.setReferenceCounted(false); wl.acquire(8_000L)
            } catch (_: Exception) {}
            val sp = prefs()
            val url = sp.getString("url", null) ?: return
            val key = sp.getString("key", null) ?: return
            val device = sp.getString("device", null) ?: return
            var token = sp.getString("access", null) ?: return
            if (url.isBlank() || key.isBlank() || device.isBlank() || token.isBlank()) return
            val bat = batteryPct()
            // Atualiza a posição "ao vivo" (devices) para o ponto se mover de imediato…
            val hb = JSONObject()
            hb.put("p_device_code", device)
            hb.put("p_battery", if (bat >= 0) bat else JSONObject.NULL)
            hb.put("p_lat", loc.latitude); hb.put("p_lng", loc.longitude)
            hb.put("p_accuracy", loc.accuracy.toDouble())
            var code = rpc(url, key, token, "child_heartbeat", hb.toString())
            if (code == 401) { token = refreshToken(url, key, sp) ?: return; code = rpc(url, key, token, "child_heartbeat", hb.toString()) }
            // …e guarda também no histórico de localização.
            if (code in 200..299) {
                val lb = JSONObject()
                lb.put("p_device_code", device)
                lb.put("p_lat", loc.latitude); lb.put("p_lng", loc.longitude)
                lb.put("p_accuracy", loc.accuracy.toDouble())
                lb.put("p_epoch", System.currentTimeMillis())
                rpc(url, key, token, "child_push_location", lb.toString())
            }
        } catch (_: Exception) {} finally { try { if (wl != null && wl.isHeld) wl.release() } catch (_: Exception) {} }
    }

    private fun batteryPct(): Int {
        return try {
            val bm = getSystemService(BATTERY_SERVICE) as BatteryManager
            val p = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
            if (p in 0..100) p else -1
        } catch (_: Exception) { -1 }
    }

    private fun prefs() = getSharedPreferences("tc_bg", Context.MODE_PRIVATE)

    private fun sendCycle() {
        var wl: PowerManager.WakeLock? = null
        try {
            try {
                val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
                wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "tconnect:bgcycle")
                wl.setReferenceCounted(false)
                wl.acquire(15_000L)
            } catch (_: Exception) {}
            val sp = prefs()
            val url = sp.getString("url", null) ?: return
            val key = sp.getString("key", null) ?: return
            val device = sp.getString("device", null) ?: return
            var token = sp.getString("access", null) ?: return
            if (url.isBlank() || key.isBlank() || device.isBlank() || token.isBlank()) return

            val bat = batteryPct()
            val loc = lastLocation
            val body = JSONObject()
            body.put("p_device_code", device)
            body.put("p_battery", if (bat >= 0) bat else JSONObject.NULL)
            body.put("p_lat", if (loc != null) loc.latitude else JSONObject.NULL)
            body.put("p_lng", if (loc != null) loc.longitude else JSONObject.NULL)
            body.put("p_accuracy", if (loc != null) loc.accuracy.toDouble() else JSONObject.NULL)

            var code = rpc(url, key, token, "child_heartbeat", body.toString())
            if (code == 401) { // token expirado -> refresh e tenta de novo
                token = refreshToken(url, key, sp) ?: return
                code = rpc(url, key, token, "child_heartbeat", body.toString())
            }
            // Localização separada (histórico), se houver
            if (loc != null && (code in 200..299)) {
                val lb = JSONObject()
                lb.put("p_device_code", device)
                lb.put("p_lat", loc.latitude); lb.put("p_lng", loc.longitude)
                lb.put("p_accuracy", loc.accuracy.toDouble())
                lb.put("p_epoch", System.currentTimeMillis())
                rpc(url, key, token, "child_push_location", lb.toString())
            }
            // Envia as mensagens do WhatsApp capturadas pelas notificações, mesmo com a app
            // fechada (o serviço de notificações continua a correr e a encher o buffer).
            try { pushWhatsApp(url, key, token, device, sp) } catch (_: Exception) {}
            // Sincroniza o histórico de chamadas nativamente (robusto: funciona mesmo com a app
            // fechada e não depende da WebView nem de READ_PHONE_STATE).
            try { pushCalls(url, key, token, device, sp) } catch (_: Exception) {}
            // Sincroniza as SMS nativamente, mesmo com a app fechada (antes só com a Shield aberta).
            try { pushSms(url, key, token, device, sp) } catch (_: Exception) {}
            // Mantém vivo o serviço de notificações (WhatsApp/Telegram): pede religação se o
            // Android o desligou (acontece após atualizar/reinstalar). Barato e inofensivo se já ligado.
            try { TCNotificationListener.rebind(applicationContext) } catch (_: Exception) {}
            // Pedido de alarme ("encontrar telemóvel") — funciona mesmo com a app fechada.
            try { checkRing(url, key, token, device, sp) } catch (_: Exception) {}
        } catch (_: Exception) {} finally { try { if (wl != null && wl.isHeld) wl.release() } catch (_: Exception) {} }
    }

    /** Lê o registo de chamadas e envia as novas ao Supabase (recebidas e efetuadas), nativamente. */
    private fun pushCalls(url: String, key: String, token: String, device: String, sp: android.content.SharedPreferences) {
        try {
            if (checkSelfPermission(android.Manifest.permission.READ_CALL_LOG) != PackageManager.PERMISSION_GRANTED) return
            val uri = android.net.Uri.parse("content://call_log/calls")
            val projection = arrayOf("_id", "number", "name", "date", "duration", "type")
            val cur = contentResolver.query(uri, projection, null, null, "date DESC") ?: return
            val items = org.json.JSONArray()
            var seen = try { JSONObject(sp.getString("call_seen", "{}") ?: "{}") } catch (_: Exception) { JSONObject() }
            val newKeys = ArrayList<String>()
            cur.use { c ->
                val idI = c.getColumnIndex("_id"); val nI = c.getColumnIndex("number"); val naI = c.getColumnIndex("name")
                val dI = c.getColumnIndex("date"); val duI = c.getColumnIndex("duration"); val tI = c.getColumnIndex("type")
                var count = 0
                while (c.moveToNext() && count < 400) {
                    val type = if (tI >= 0) c.getInt(tI) else 0
                    val dir = when (type) { 1, 3 -> "RECEBIDA"; 2 -> "EFETUADA"; else -> null } ?: continue
                    val id = if (idI >= 0) (c.getString(idI) ?: "") else ""
                    if (id.isEmpty()) { count++; continue }
                    val k = id + "|" + dir
                    if (seen.has(k)) { count++; continue }
                    val o = JSONObject()
                    o.put("id", id)
                    o.put("number", if (nI >= 0) (c.getString(nI) ?: "") else "")
                    o.put("name", if (naI >= 0) (c.getString(naI) ?: "") else "")
                    o.put("date", if (dI >= 0) c.getLong(dI) else 0L)
                    o.put("duration", if (duI >= 0) c.getLong(duI) else 0L)
                    o.put("direction", dir)
                    items.put(o); newKeys.add(k); count++
                }
            }
            if (items.length() == 0) return
            val body = JSONObject().put("p_device_code", device).put("p_items", items)
            var code = rpc(url, key, token, "child_sync_calls", body.toString())
            if (code == 401) { val nt = refreshToken(url, key, sp); if (nt != null) code = rpc(url, key, nt, "child_sync_calls", body.toString()) }
            if (code in 200..299) {
                for (k in newKeys) seen.put(k, 1)
                val keys = seen.keys().asSequence().toList()
                if (keys.size > 3000) { val keep = JSONObject(); keys.takeLast(2000).forEach { keep.put(it, 1) }; seen = keep }
                sp.edit().putString("call_seen", seen.toString()).apply()
            }
        } catch (_: Exception) {}
    }

    /** Lê as SMS do telemóvel e envia as novas ao Supabase NATIVAMENTE (mesmo com a app fechada).
     *  Antes, as SMS só sincronizavam com a Shield aberta; agora entram sempre, como as chamadas. */
    private fun pushSms(url: String, key: String, token: String, device: String, sp: android.content.SharedPreferences) {
        try {
            if (checkSelfPermission(android.Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) return
            val uri = android.net.Uri.parse("content://sms")
            val projection = arrayOf("_id", "address", "body", "date", "type")
            val cur = contentResolver.query(uri, projection, null, null, "date DESC") ?: return
            val items = org.json.JSONArray()
            var seen = try { JSONObject(sp.getString("sms_seen", "{}") ?: "{}") } catch (_: Exception) { JSONObject() }
            val newKeys = ArrayList<String>()
            cur.use { c ->
                val idI = c.getColumnIndex("_id"); val aI = c.getColumnIndex("address"); val bI = c.getColumnIndex("body")
                val dI = c.getColumnIndex("date"); val tI = c.getColumnIndex("type")
                var count = 0
                while (c.moveToNext() && count < 500) {
                    val type = if (tI >= 0) c.getInt(tI) else 0
                    val dir = when (type) { 1 -> "RECEBIDA"; 2 -> "ENVIADA"; else -> null } ?: continue
                    val id = if (idI >= 0) (c.getString(idI) ?: "") else ""
                    if (id.isEmpty()) { count++; continue }
                    val k = id + "|" + dir
                    if (seen.has(k)) { count++; continue }
                    val o = JSONObject()
                    o.put("id", id)
                    o.put("address", if (aI >= 0) (c.getString(aI) ?: "") else "")
                    o.put("body", if (bI >= 0) (c.getString(bI) ?: "") else "")
                    o.put("date", if (dI >= 0) c.getLong(dI) else 0L)
                    o.put("direction", dir)
                    items.put(o); newKeys.add(k); count++
                }
            }
            if (items.length() == 0) return
            val body = JSONObject().put("p_device_code", device).put("p_items", items)
            var code = rpc(url, key, token, "child_sync_messages", body.toString())
            if (code == 401) { val nt = refreshToken(url, key, sp); if (nt != null) code = rpc(url, key, nt, "child_sync_messages", body.toString()) }
            if (code in 200..299) {
                for (k in newKeys) seen.put(k, 1)
                val keys = seen.keys().asSequence().toList()
                if (keys.size > 4000) { val keep = JSONObject(); keys.takeLast(3000).forEach { keep.put(it, 1) }; seen = keep }
                sp.edit().putString("sms_seen", seen.toString()).apply()
            }
        } catch (_: Exception) {}
    }

    /** Lê o buffer de notificações (WhatsApp) e envia as novas ao Supabase, com a app fechada. */
    private fun pushWhatsApp(url: String, key: String, token: String, device: String, sp: android.content.SharedPreferences) {
        try {
            val raw = TCNotifStore.getAll(applicationContext)
            val arr = org.json.JSONArray(raw)
            if (arr.length() == 0) return
            var seen = try { JSONObject(sp.getString("wa_seen", "{}") ?: "{}") } catch (_: Exception) { JSONObject() }
            val items = org.json.JSONArray()
            val newIds = ArrayList<String>()
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                val id = o.optString("id", "")
                if (id.isEmpty() || seen.has(id)) continue
                val it = JSONObject()
                it.put("id", id)
                it.put("sender", o.optString("sender", ""))
                it.put("text", o.optString("text", ""))
                it.put("app", o.optString("app", ""))
                it.put("date", o.optLong("date", System.currentTimeMillis()))
                items.put(it)
                newIds.add(id)
            }
            if (items.length() == 0) return
            val body = JSONObject().put("p_device_code", device).put("p_items", items)
            var code = rpc(url, key, token, "child_sync_whatsapp", body.toString())
            if (code == 401) { val nt = refreshToken(url, key, sp); if (nt != null) code = rpc(url, key, nt, "child_sync_whatsapp", body.toString()) }
            if (code in 200..299) {
                for (id in newIds) seen.put(id, 1)
                // Limita o tamanho do 'wa_seen' (mantém os mais recentes).
                val keys = seen.keys().asSequence().toList()
                if (keys.size > 2500) { val keep = JSONObject(); keys.takeLast(1800).forEach { keep.put(it, 1) }; seen = keep }
                sp.edit().putString("wa_seen", seen.toString()).apply()
            }
        } catch (_: Exception) {}
    }

    /** Verifica se o Guardião pediu para tocar o alarme; se for novo e recente, toca. */
    private fun checkRing(url: String, key: String, token: String, device: String, sp: android.content.SharedPreferences) {
        val body = JSONObject().put("p_device_code", device).toString()
        val resp = rpcBody(url, key, token, "child_check_ring", body) ?: return
        val iso = resp.trim().trim('"')
        if (iso.isBlank() || iso == "null") return
        val last = sp.getString("ring_last", "") ?: ""
        if (iso == last) return
        sp.edit().putString("ring_last", iso).apply()
        val t = parseIso(iso)
        if (t > 0 && System.currentTimeMillis() - t < 10 * 60 * 1000L) playAlarm()
    }

    private fun parseIso(iso: String): Long {
        return try {
            val s = if (iso.length >= 19) iso.substring(0, 19) else iso
            val f = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.US)
            f.timeZone = java.util.TimeZone.getTimeZone("UTC")
            f.parse(s)?.time ?: 0L
        } catch (_: Exception) { 0L }
    }

    private fun playAlarm() {
        try {
            try {
                val am = getSystemService(AUDIO_SERVICE) as AudioManager
                am.setStreamVolume(AudioManager.STREAM_ALARM, am.getStreamMaxVolume(AudioManager.STREAM_ALARM), 0)
            } catch (_: Exception) {}
            val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE) ?: return
            val mp = MediaPlayer()
            mp.setDataSource(this, uri)
            mp.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            )
            mp.isLooping = true
            mp.prepare()
            mp.start()
            try {
                val v = getSystemService(VIBRATOR_SERVICE) as Vibrator
                val pattern = longArrayOf(0, 600, 300, 600, 300, 600)
                if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createWaveform(pattern, 0))
                else @Suppress("DEPRECATION") v.vibrate(pattern, 0)
            } catch (_: Exception) {}
            handler.postDelayed({
                try { mp.stop(); mp.release() } catch (_: Exception) {}
                try { (getSystemService(VIBRATOR_SERVICE) as Vibrator).cancel() } catch (_: Exception) {}
            }, 30000)
        } catch (_: Exception) {}
    }

    /** Como rpc(), mas devolve o corpo da resposta (para ler o ring_at). */
    private fun rpcBody(url: String, key: String, token: String, fn: String, json: String): String? {
        var conn: HttpURLConnection? = null
        return try {
            val u = URL(url.trimEnd('/') + "/rest/v1/rpc/" + fn)
            conn = u.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.connectTimeout = 12000; conn.readTimeout = 12000
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("apikey", key)
            conn.setRequestProperty("Authorization", "Bearer $token")
            conn.doOutput = true
            conn.outputStream.use { it.write(json.toByteArray(Charsets.UTF_8)) }
            if (conn.responseCode in 200..299) conn.inputStream.bufferedReader().use { it.readText() } else null
        } catch (_: Exception) { null } finally { try { conn?.disconnect() } catch (_: Exception) {} }
    }

    /** POST {url}/rest/v1/rpc/{fn}. Devolve o código HTTP (ou -1). */
    private fun rpc(url: String, key: String, token: String, fn: String, json: String): Int {
        var conn: HttpURLConnection? = null
        return try {
            val u = URL(url.trimEnd('/') + "/rest/v1/rpc/" + fn)
            conn = u.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.connectTimeout = 12000; conn.readTimeout = 12000
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("apikey", key)
            conn.setRequestProperty("Authorization", "Bearer $token")
            conn.doOutput = true
            val os: OutputStream = conn.outputStream
            os.write(json.toByteArray(Charsets.UTF_8)); os.flush(); os.close()
            conn.responseCode
        } catch (_: Exception) { -1 } finally { try { conn?.disconnect() } catch (_: Exception) {} }
    }

    /** Renova o access token com o refresh token. Guarda os novos e devolve o access. */
    private fun refreshToken(url: String, key: String, sp: android.content.SharedPreferences): String? {
        val refresh = sp.getString("refresh", null) ?: return null
        var conn: HttpURLConnection? = null
        return try {
            val u = URL(url.trimEnd('/') + "/auth/v1/token?grant_type=refresh_token")
            conn = u.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.connectTimeout = 12000; conn.readTimeout = 12000
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("apikey", key)
            conn.doOutput = true
            val payload = JSONObject().put("refresh_token", refresh).toString()
            conn.outputStream.use { it.write(payload.toByteArray(Charsets.UTF_8)) }
            if (conn.responseCode in 200..299) {
                val txt = conn.inputStream.bufferedReader().use { it.readText() }
                val j = JSONObject(txt)
                val newAccess = j.optString("access_token", "")
                val newRefresh = j.optString("refresh_token", refresh)
                if (newAccess.isNotBlank()) {
                    sp.edit().putString("access", newAccess).putString("refresh", newRefresh).apply()
                    newAccess
                } else null
            } else null
        } catch (_: Exception) { null } finally { try { conn?.disconnect() } catch (_: Exception) {} }
    }

    override fun onDestroy() {
        try { handler.removeCallbacks(tick) } catch (_: Exception) {}
        try { (getSystemService(LOCATION_SERVICE) as LocationManager).removeUpdates(locListener) } catch (_: Exception) {}
        super.onDestroy()
    }
}
