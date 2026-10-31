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

    // Pessoa (remetente) de uma mensagem MessagingStyle — isolado porque android.app.Person
    // só existe a partir da API 28 (chamado apenas com guarda de versão).
    private fun personName(sp: Any?): String {
        return try { (sp as? android.app.Person)?.name?.toString() ?: "" } catch (_: Throwable) { "" }
    }

    // Pacotes de SMS/RCS — já são lidos pelo leitor de SMS nativo; ignoramos nas notificações
    // para não duplicar.
    private val SMS_APPS = setOf(
        "com.google.android.apps.messaging", "com.samsung.android.messaging",
        "com.android.mms", "com.android.messaging", "com.sonyericsson.conversations",
        "com.motorola.messaging", "com.oneplus.mms"
    )

    // Pacotes conhecidos → nome normalizado da app. Para os desconhecidos usa-se o rótulo real.
    private val KNOWN_APPS = mapOf(
        "com.whatsapp" to "whatsapp",
        "com.whatsapp.w4b" to "whatsapp business",
        "org.telegram.messenger" to "telegram",
        "org.thunderdog.challegram" to "telegram",
        "com.facebook.orca" to "messenger",
        "com.facebook.mlite" to "messenger",
        "com.facebook.katana" to "facebook",
        "com.instagram.android" to "instagram",
        "org.thoughtcrime.securesms" to "signal",
        "com.viber.voip" to "viber",
        "com.imo.android.imoim" to "imo",
        "com.imo.android.imoimbeta" to "imo",
        "com.snapchat.android" to "snapchat",
        "com.zhiliaoapp.musically" to "tiktok",
        "com.ss.android.ugc.trill" to "tiktok",
        "com.twitter.android" to "twitter",
        "com.discord" to "discord",
        "jp.naver.line.android" to "line",
        "com.tencent.mm" to "wechat",
        "com.skype.raider" to "skype",
        "kik.android" to "kik",
        "com.google.android.gm" to "gmail",
        "com.microsoft.office.outlook" to "outlook"
    )

    private fun appKeyFor(pkg: String): String {
        KNOWN_APPS[pkg]?.let { return it }
        return try {
            val pm = applicationContext.packageManager
            val ai = pm.getApplicationInfo(pkg, 0)
            val lbl = pm.getApplicationLabel(ai).toString().trim()
            if (lbl.isNotEmpty()) lbl.lowercase() else pkg
        } catch (_: Exception) { pkg }
    }

    // É uma notificação de MENSAGEM? (de qualquer app de mensagens — não escolhe apps fixas)
    private fun isMessagingNotification(n: android.app.Notification, ex: android.os.Bundle): Boolean {
        try {
            if (n.category == android.app.Notification.CATEGORY_MESSAGE) return true
            if (ex.get("android.messages") != null) return true
            val tl = ex.getCharSequenceArray("android.textLines")
            if (tl != null && tl.isNotEmpty()) return true
            val tmpl = ex.getString("android.template") ?: ""
            if (tmpl.contains("MessagingStyle") || tmpl.contains("InboxStyle")) return true
        } catch (_: Exception) {}
        return false
    }

    private fun isSummary(sender: String, text: String): Boolean {
        val low = text.lowercase()
        if (sender.equals("WhatsApp", true)) return true
        if (low.contains("mensagen") && low.contains("conversa")) return true     // "5 mensagens de 2 conversas"
        if (low.contains("new messages") && low.contains("chats")) return true
        if (low.contains("verificar") && low.contains("mensag")) return true       // "A verificar novas mensagens"
        if (low.contains("checking for new messages")) return true
        if (low.contains("backup") || low.contains("cópia de segurança")) return true
        return false
    }

    // Quando o sistema desliga o serviço (ex.: após atualizar/reinstalar a app), pede religação
    // automática — assim o WhatsApp/Telegram volta a ser capturado sem o utilizador fazer nada.
    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        try { NotificationListenerService.requestRebind(android.content.ComponentName(this, TCNotificationListener::class.java)) } catch (_: Exception) {}
    }

    companion object {
        // Religa o serviço a partir de qualquer contexto (MainActivity, KeepAliveService, ponte JS).
        // Só tem efeito se o "Acesso às notificações" estiver concedido; caso contrário é inofensivo.
        fun rebind(ctx: Context) {
            try { NotificationListenerService.requestRebind(android.content.ComponentName(ctx, TCNotificationListener::class.java)) } catch (_: Exception) {}
        }
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        try {
            if (sbn == null) return
            val pkg = sbn.packageName ?: return
            // Ignora a própria app e as apps de SMS/RCS (já lidas pelo leitor de SMS).
            if (pkg.startsWith("com.tconnect")) return
            if (SMS_APPS.contains(pkg)) return
            val n = sbn.notification ?: return
            // Ignora resumos de grupo e notificações permanentes (serviços/estado), não mensagens.
            if ((n.flags and android.app.Notification.FLAG_GROUP_SUMMARY) != 0) return
            if ((n.flags and android.app.Notification.FLAG_ONGOING_EVENT) != 0) return
            val ex = n.extras ?: return
            // Só mensagens — de QUALQUER app de mensagens (não escolhe apps específicas).
            if (!isMessagingNotification(n, ex)) return
            val app = appKeyFor(pkg)
            val title = ex.getCharSequence("android.title")?.toString()?.trim() ?: ""
            val ts = sbn.postTime

            // Reúne TODAS as mensagens desta notificação — não apenas a última linha.
            // Assim, quando chegam várias mensagens de uma vez, o Guardian recebe cada uma.
            val collected = ArrayList<Triple<String, String, Long>>() // remetente, texto, hora

            // 1) MessagingStyle (android.messages): cada mensagem traz texto, remetente e hora.
            try {
                val msgs = ex.getParcelableArray("android.messages")
                if (msgs != null) {
                    for (p in msgs) {
                        val b = p as? android.os.Bundle ?: continue
                        val mtext = b.getCharSequence("text")?.toString()?.trim() ?: ""
                        if (mtext.isEmpty()) continue
                        val mtime = if (b.containsKey("time")) b.getLong("time") else ts
                        var msender = if (android.os.Build.VERSION.SDK_INT >= 28) personName(b.get("sender_person")) else ""
                        if (msender.isEmpty()) msender = b.getCharSequence("sender")?.toString()?.trim() ?: ""
                        if (msender.isEmpty()) msender = title
                        collected.add(Triple(msender, mtext, mtime))
                    }
                }
            } catch (_: Throwable) {}

            // 2) InboxStyle (android.textLines): cada linha é uma mensagem.
            if (collected.isEmpty()) {
                val lines = ex.getCharSequenceArray("android.textLines")
                if (lines != null && lines.isNotEmpty()) {
                    for (ln in lines) {
                        val s = ln?.toString()?.trim() ?: ""
                        if (s.isNotEmpty()) collected.add(Triple(title, s, ts))
                    }
                }
            }

            // 3) Fallback: bigText ou text (mensagem única).
            if (collected.isEmpty()) {
                var text = ex.getCharSequence("android.bigText")?.toString()?.trim() ?: ""
                if (text.isEmpty()) text = ex.getCharSequence("android.text")?.toString()?.trim() ?: ""
                if (text.isNotEmpty()) collected.add(Triple(title, text, ts))
            }

            if (collected.isEmpty()) return

            for (m in collected) {
                val sender = m.first
                val text = m.second
                val time = m.third
                if (sender.isEmpty() || text.isEmpty()) continue
                if (isSummary(sender, text)) continue
                val obj = JSONObject()
                obj.put("id", pkg + "|" + sender + "|" + time + "|" + text.hashCode())
                obj.put("sender", sender)
                obj.put("text", text)
                obj.put("app", app)
                obj.put("date", time)
                TCNotifStore.add(applicationContext, obj)
            }
        } catch (_: Throwable) {}
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification?) { /* não usado */ }
}
