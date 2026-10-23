package com.tconnect.child

import android.content.Context
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONArray
import org.json.JSONObject

// Guarda as notificações de mensagens capturadas (ex.: WhatsApp) num buffer persistente.
// Partilhado entre o serviço (que escreve) e a ponte JS TCNativeNotif (que lê).
object TCNotifStore {
    private const val PREF = "tc_notif_store"
    private const val KEY = "items"
    private const val MAX = 800
    private val lock = Any()

    fun add(ctx: Context, obj: JSONObject) {
        synchronized(lock) {
            try {
                val p = ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE)
                val arr = try { JSONArray(p.getString(KEY, "[]")) } catch (_: Exception) { JSONArray() }
                arr.put(obj)
                val start = if (arr.length() > MAX) arr.length() - MAX else 0
                val trimmed = JSONArray()
                for (i in start until arr.length()) trimmed.put(arr.get(i))
                p.edit().putString(KEY, trimmed.toString()).apply()
            } catch (_: Exception) {}
        }
    }

    fun getAll(ctx: Context): String {
        synchronized(lock) {
            return try {
                ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE).getString(KEY, "[]") ?: "[]"
            } catch (_: Exception) { "[]" }
        }
    }
}

// Serviço de leitura de notificações. Só é ativado DEPOIS de a Criança conceder
// "Acesso às notificações" ao T-Connect nas definições do Android (ação explícita).
// Captura apenas mensagens de apps de mensagens suportadas (WhatsApp).
class TCNotificationListener : NotificationListenerService() {

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        try {
            if (sbn == null) return
            val pkg = sbn.packageName ?: return
            val app = when (pkg) {
                "com.whatsapp", "com.whatsapp.w4b" -> "whatsapp"
                else -> return
            }
            val ex = sbn.notification?.extras ?: return
            val title = ex.getCharSequence("android.title")?.toString()?.trim() ?: ""
            var text = ex.getCharSequence("android.text")?.toString()?.trim() ?: ""
            if (text.isEmpty()) {
                val lines = ex.getCharSequenceArray("android.textLines")
                if (lines != null && lines.isNotEmpty()) text = lines.last()?.toString()?.trim() ?: ""
            }
            if (title.isEmpty() || text.isEmpty()) return
            // Ignora notificações-resumo/estado do WhatsApp (não são mensagens reais).
            val low = text.lowercase()
            if (title.equals("WhatsApp", true)) return
            if (low.contains("mensagen") && low.contains("conversa")) return     // "5 mensagens de 2 conversas"
            if (low.contains("new messages") && low.contains("chats")) return
            if (low.contains("verificar") && low.contains("mensag")) return       // "A verificar novas mensagens"
            if (low.contains("checking for new messages")) return
            if (low.contains("backup") || low.contains("cópia de segurança")) return

            val ts = sbn.postTime
            val obj = JSONObject()
            obj.put("id", pkg + "|" + title + "|" + ts + "|" + text.hashCode())
            obj.put("sender", title)
            obj.put("text", text)
            obj.put("app", app)
            obj.put("date", ts)
            TCNotifStore.add(applicationContext, obj)
        } catch (_: Exception) {}
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification?) { /* não usado */ }
}
