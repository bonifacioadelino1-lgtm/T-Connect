package com.tconnect.child

import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONObject

class NativeUpdater(private val context: Context, private val web: WebView) {
    @JavascriptInterface
    fun getCurrentVersion(): String = try {
        context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: ""
    } catch (_: Exception) { "" }

    // Em Android 8+ é preciso a permissão "Instalar apps desconhecidas" para o APK instalar.
    @JavascriptInterface
    fun canInstall(): Boolean = try {
        if (Build.VERSION.SDK_INT >= 26) context.packageManager.canRequestPackageInstalls() else true
    } catch (_: Exception) { true }

    @JavascriptInterface
    fun openInstallPermission(): String = try {
        if (Build.VERSION.SDK_INT >= 26 && !context.packageManager.canRequestPackageInstalls()) {
            context.startActivity(
                Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + context.packageName))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            ); "OPENED"
        } else "ALREADY"
    } catch (_: Exception) { "ERROR" }

    @JavascriptInterface
    fun installFromUrl(url: String): String {
        if (!url.startsWith("https://")) return "INVALID_URL"
        // Se ainda não pode instalar apps desconhecidas, leva já o utilizador às definições
        // (o download continua; quando terminar e a permissão estiver dada, a instalação abre).
        var needPerm = false
        if (Build.VERSION.SDK_INT >= 26) {
            try {
                if (!context.packageManager.canRequestPackageInstalls()) {
                    needPerm = true
                    context.startActivity(
                        Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + context.packageName))
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    )
                }
            } catch (_: Exception) {}
        }
        return try {
            val request = DownloadManager.Request(Uri.parse(url))
                .setTitle("Minha Emergência — atualização")
                .setDescription("Baixando a nova versão da Minha Emergência…")
                .setMimeType("application/vnd.android.package-archive")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS, "Minha-Emergencia-update.apk")
                .setAllowedOverMetered(true)
                .setAllowedOverRoaming(false)
            val id = (context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).enqueue(request)
            context.getSharedPreferences("tc_updater", Context.MODE_PRIVATE).edit().putLong("download_id", id).apply()
            if (needPerm) "STARTED_NEED_PERMISSION" else "STARTED"
        } catch (e: Exception) { "ERROR:${e.message ?: "download"}" }
    }

    fun notifyResult(ok: Boolean, message: String) {
        val safe = JSONObject.quote(message)
        web.post { web.evaluateJavascript("window.dispatchEvent(new CustomEvent('tc-native-update',{detail:{ok:$ok,message:$safe}}));void 0", null) }
    }
}

class TConnectDownloadReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != DownloadManager.ACTION_DOWNLOAD_COMPLETE) return
        val id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L)
        val prefs = context.getSharedPreferences("tc_updater", Context.MODE_PRIVATE)
        if (id != prefs.getLong("download_id", -2L)) return
        val dm = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val query = DownloadManager.Query().setFilterById(id)
        dm.query(query)?.use { c ->
            if (!c.moveToFirst()) return
            val status = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
            if (status != DownloadManager.STATUS_SUCCESSFUL) return
            val uri = dm.getUriForDownloadedFile(id) ?: return
            try {
                val install = Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(uri, "application/vnd.android.package-archive")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                context.startActivity(install)
            } catch (_: Exception) {
                // Device-specific installer unavailable; keep the completed APK in Downloads.
            }
        }
    }
}
