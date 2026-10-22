// T-Connect — Tradutor de ecrã (traduz TODO o texto visível da interface).
// Funciona por cima do i18n.js: quando o idioma não é 'pt', percorre o DOM
// e substitui cada texto conhecido pela tradução. Dados dinâmicos (nomes,
// números, mensagens) não constam do dicionário, por isso ficam intactos.
(function () {
  "use strict";

  // pt -> { en, fr, zh }
  var UI = {
    // ---- Navegação / abas ----
    "Monitoramento": { en: "Monitoring", fr: "Surveillance", zh: "监控" },
    "Atividades": { en: "Activity", fr: "Activité", zh: "活动" },
    "Atividade": { en: "Activity", fr: "Activité", zh: "活动" },
    "Estado": { en: "Status", fr: "État", zh: "状态" },
    "Localização": { en: "Location", fr: "Localisation", zh: "定位" },
    "Mensagens": { en: "Messages", fr: "Messages", zh: "短信" },
    "Chamadas": { en: "Calls", fr: "Appels", zh: "通话" },
    "Contatos": { en: "Contacts", fr: "Contacts", zh: "联系人" },
    "Contactos": { en: "Contacts", fr: "Contacts", zh: "联系人" },
    "Aplicativos": { en: "Apps", fr: "Applications", zh: "应用" },
    "Apps": { en: "Apps", fr: "Applications", zh: "应用" },
    "Câmera": { en: "Camera", fr: "Caméra", zh: "摄像头" },
    "Permissões": { en: "Permissions", fr: "Autorisations", zh: "权限" },
    "Dispositivos": { en: "Devices", fr: "Appareils", zh: "设备" },
    "Definições": { en: "Settings", fr: "Paramètres", zh: "设置" },
    "Super Admin": { en: "Super Admin", fr: "Super Admin", zh: "超级管理员" },

    // ---- Cabeçalhos / kickers ----
    "MONITORAMENTO": { en: "MONITORING", fr: "SURVEILLANCE", zh: "监控" },
    "LOCALIZAÇÃO": { en: "LOCATION", fr: "LOCALISATION", zh: "定位" },
    "CONFIGURAÇÕES": { en: "SETTINGS", fr: "PARAMÈTRES", zh: "设置" },
    "SISTEMA": { en: "SYSTEM", fr: "SYSTÈME", zh: "系统" },
    "PERFIL": { en: "PROFILE", fr: "PROFIL", zh: "个人资料" },
    "APLICATIVO": { en: "APP", fr: "APPLICATION", zh: "应用" },
    "SOFTWARE": { en: "SOFTWARE", fr: "LOGICIEL", zh: "软件" },
    "CONTA": { en: "ACCOUNT", fr: "COMPTE", zh: "账户" },
    "ATUALIZAÇÃO": { en: "UPDATE", fr: "MISE À JOUR", zh: "更新" },
    "ATIVIDADES RECENTES": { en: "RECENT ACTIVITY", fr: "ACTIVITÉ RÉCENTE", zh: "最近活动" },
    "SUPER ADMIN": { en: "SUPER ADMIN", fr: "SUPER ADMIN", zh: "超级管理员" },
    "SEGURANÇA EM TEMPO REAL": { en: "REAL-TIME SECURITY", fr: "SÉCURITÉ EN TEMPS RÉEL", zh: "实时安全" },
    "FAMILY SAFETY PLATFORM": { en: "FAMILY SAFETY PLATFORM", fr: "PLATEFORME DE SÉCURITÉ FAMILIALE", zh: "家庭安全平台" },
    "EMERGÊNCIA": { en: "EMERGENCY", fr: "URGENCE", zh: "紧急" },
    "DISPOSITIVO": { en: "DEVICE", fr: "APPAREIL", zh: "设备" },
    "PONTO": { en: "POINT", fr: "POINT", zh: "位置点" },
    "DATA/HORA DO PAGAMENTO": { en: "PAYMENT DATE/TIME", fr: "DATE/HEURE DU PAIEMENT", zh: "付款日期/时间" },
    "PLANO ATUAL": { en: "CURRENT PLAN", fr: "FORFAIT ACTUEL", zh: "当前套餐" },
    "ÁREA / RUA": { en: "AREA / STREET", fr: "ZONE / RUE", zh: "区域 / 街道" },

    // ---- Estado / monitoramento ----
    "Online": { en: "Online", fr: "En ligne", zh: "在线" },
    "Offline": { en: "Offline", fr: "Hors ligne", zh: "离线" },
    "ONLINE": { en: "ONLINE", fr: "EN LIGNE", zh: "在线" },
    "OFFLINE": { en: "OFFLINE", fr: "HORS LIGNE", zh: "离线" },
    "Conectado": { en: "Connected", fr: "Connecté", zh: "已连接" },
    "Sem conexão": { en: "No connection", fr: "Pas de connexion", zh: "无连接" },
    "Bateria": { en: "Battery", fr: "Batterie", zh: "电量" },
    "Alertas": { en: "Alerts", fr: "Alertes", zh: "警报" },
    "Estado Child": { en: "Child status", fr: "État de l'enfant", zh: "孩子状态" },
    "Estado atual do dispositivo e dos principais serviços.": { en: "Current device status and main services.", fr: "État actuel de l'appareil et des services principaux.", zh: "设备和主要服务的当前状态。" },
    "Estado do dispositivo": { en: "Device status", fr: "État de l'appareil", zh: "设备状态" },
    "Estado da sessão": { en: "Session status", fr: "État de la session", zh: "会话状态" },
    "Informações atuais recebidas pelo Guardian.": { en: "Current information received by Guardian.", fr: "Informations actuelles reçues par Guardian.", zh: "Guardian 收到的当前信息。" },
    "Serviços": { en: "Services", fr: "Services", zh: "服务" },
    "Em tempo real": { en: "Real-time", fr: "Temps réel", zh: "实时" },
    "Conexão do dispositivo": { en: "Device connection", fr: "Connexion de l'appareil", zh: "设备连接" },
    "Localização (GPS)": { en: "Location (GPS)", fr: "Localisation (GPS)", zh: "定位 (GPS)" },
    "Último heartbeat": { en: "Last heartbeat", fr: "Dernier signal", zh: "最后心跳" },
    "Conexão": { en: "Connection", fr: "Connexion", zh: "连接" },
    "O dispositivo está ligado e conectado.": { en: "The device is on and connected.", fr: "L'appareil est allumé et connecté.", zh: "设备已开启并连接。" },
    "O dispositivo não está conectado neste momento.": { en: "The device is not connected right now.", fr: "L'appareil n'est pas connecté pour le moment.", zh: "设备当前未连接。" },
    "Aguardando informação real do dispositivo Child.": { en: "Waiting for real data from the Child device.", fr: "En attente des données réelles de l'appareil enfant.", zh: "正在等待孩子设备的真实数据。" },

    // ---- Mapa ----
    "Satélite": { en: "Satellite", fr: "Satellite", zh: "卫星" },
    "Híbrido": { en: "Hybrid", fr: "Hybride", zh: "混合" },
    "Mapa": { en: "Map", fr: "Carte", zh: "地图" },
    "Mapa alternativo": { en: "Alternative map", fr: "Carte alternative", zh: "备用地图" },
    "Trajeto": { en: "Route", fr: "Trajet", zh: "轨迹" },
    "Trajeto de hoje": { en: "Today's route", fr: "Trajet du jour", zh: "今日轨迹" },
    "Terminal de comando": { en: "Command terminal", fr: "Terminal de commande", zh: "命令终端" },
    "Terminal de localização": { en: "Location terminal", fr: "Terminal de localisation", zh: "定位终端" },
    "Abrir terminal completo →": { en: "Open full terminal →", fr: "Ouvrir le terminal complet →", zh: "打开完整终端 →" },
    "Abrir terminal →": { en: "Open terminal →", fr: "Ouvrir le terminal →", zh: "打开终端 →" },
    "O módulo do mapa não carregou. Recarregue a página.": { en: "The map module failed to load. Reload the page.", fr: "Le module de carte n'a pas pu se charger. Rechargez la page.", zh: "地图模块加载失败。请重新加载页面。" },

    // ---- Mensagens / chamadas ----
    "Captura de mensagens": { en: "Message capture", fr: "Capture de messages", zh: "消息捕获" },
    "Histórico de chamadas": { en: "Call history", fr: "Historique des appels", zh: "通话记录" },
    "Mensagens recebidas": { en: "Received messages", fr: "Messages reçus", zh: "收到的短信" },
    "Mensagens enviadas": { en: "Sent messages", fr: "Messages envoyés", zh: "发送的短信" },
    "Chamadas recebidas": { en: "Received calls", fr: "Appels reçus", zh: "来电" },
    "Chamadas efetuadas": { en: "Made calls", fr: "Appels passés", zh: "拨出电话" },
    "Ver mensagens recebidas": { en: "View received messages", fr: "Voir les messages reçus", zh: "查看收到的短信" },
    "Ver mensagens enviadas": { en: "View sent messages", fr: "Voir les messages envoyés", zh: "查看发送的短信" },
    "Ver chamadas recebidas": { en: "View received calls", fr: "Voir les appels reçus", zh: "查看来电" },
    "Ver chamadas efetuadas": { en: "View made calls", fr: "Voir les appels passés", zh: "查看拨出电话" },
    "Terminal de chamadas": { en: "Call terminal", fr: "Terminal d'appels", zh: "通话终端" },
    "Somente fontes autorizadas pelo Android.": { en: "Only sources authorized by Android.", fr: "Uniquement les sources autorisées par Android.", zh: "仅限 Android 授权的来源。" },
    "Disponibilidade real depende das permissões e APIs Android.": { en: "Actual availability depends on Android permissions and APIs.", fr: "La disponibilité réelle dépend des autorisations et API Android.", zh: "实际可用性取决于 Android 权限和 API。" },
    "Privacidade protegida": { en: "Privacy protected", fr: "Confidentialité protégée", zh: "隐私受保护" },
    "Somente integração oficial e autorizada.": { en: "Official and authorized integration only.", fr: "Intégration officielle et autorisée uniquement.", zh: "仅限官方授权集成。" },
    "Verificar integração": { en: "Check integration", fr: "Vérifier l'intégration", zh: "检查集成" },
    "Mensagem": { en: "Message", fr: "Message", zh: "消息" },
    "Direção": { en: "Direction", fr: "Sens", zh: "方向" },
    "Duração": { en: "Duration", fr: "Durée", zh: "时长" },
    "Contacto": { en: "Contact", fr: "Contact", zh: "联系人" },
    "Número": { en: "Number", fr: "Numéro", zh: "号码" },
    "Nome": { en: "Name", fr: "Nom", zh: "姓名" },
    "Data": { en: "Date", fr: "Date", zh: "日期" },

    // ---- Contatos / apps (estatísticas) ----
    "Agenda do dispositivo, sincronizada automaticamente.": { en: "Device address book, synced automatically.", fr: "Carnet d'adresses de l'appareil, synchronisé automatiquement.", zh: "设备通讯录，自动同步。" },
    "Apps instaladas e tempo de uso nas últimas 24h.": { en: "Installed apps and usage time in the last 24h.", fr: "Applications installées et temps d'utilisation sur 24 h.", zh: "已安装应用及过去 24 小时使用时长。" },
    "App mais usado": { en: "Most-used app", fr: "App la plus utilisée", zh: "最常用应用" },
    "Tempo total (24h)": { en: "Total time (24h)", fr: "Temps total (24 h)", zh: "总时长 (24小时)" },
    "Apps instaladas": { en: "Installed apps", fr: "Applications installées", zh: "已安装应用" },
    "Mais usados (24h)": { en: "Most used (24h)", fr: "Les plus utilisés (24 h)", zh: "使用最多 (24小时)" },
    "Contacto mais frequente": { en: "Most frequent contact", fr: "Contact le plus fréquent", zh: "最常联系人" },
    "Total de contactos": { en: "Total contacts", fr: "Total des contacts", zh: "联系人总数" },
    "Interações (chamadas+SMS)": { en: "Interactions (calls+SMS)", fr: "Interactions (appels+SMS)", zh: "互动次数 (通话+短信)" },
    "Mais contactados": { en: "Most contacted", fr: "Les plus contactés", zh: "联系最多" },
    "Pacote": { en: "Package", fr: "Paquet", zh: "包名" },
    "Uso (24h)": { en: "Usage (24h)", fr: "Usage (24 h)", zh: "使用 (24小时)" },
    "sem dados de uso": { en: "no usage data", fr: "aucune donnée d'usage", zh: "无使用数据" },
    "sem interações ainda": { en: "no interactions yet", fr: "aucune interaction", zh: "暂无互动" },

    // ---- Câmera / áudio / tela ----
    "Câmera da Criança": { en: "Child's camera", fr: "Caméra de l'enfant", zh: "孩子的摄像头" },
    "Câmera autorizada da Criança": { en: "Child's authorized camera", fr: "Caméra autorisée de l'enfant", zh: "孩子已授权的摄像头" },
    "Solicitar câmera": { en: "Request camera", fr: "Demander la caméra", zh: "请求摄像头" },
    "Escutar áudio": { en: "Listen to audio", fr: "Écouter l'audio", zh: "收听音频" },
    "Projetar tela": { en: "Project screen", fr: "Projeter l'écran", zh: "投射屏幕" },
    "Encerrar": { en: "End", fr: "Terminer", zh: "结束" },
    "Ativar som": { en: "Enable sound", fr: "Activer le son", zh: "开启声音" },
    "🔊 Ativar som": { en: "🔊 Enable sound", fr: "🔊 Activer le son", zh: "🔊 开启声音" },
    "Som do microfone autorizado pela Criança": { en: "Microphone sound authorized by the Child", fr: "Son du micro autorisé par l'enfant", zh: "孩子授权的麦克风声音" },
    "Áudio ao vivo": { en: "Live audio", fr: "Audio en direct", zh: "实时音频" },
    "Áudio conectado": { en: "Audio connected", fr: "Audio connecté", zh: "音频已连接" },
    "ÁUDIO AO VIVO": { en: "LIVE AUDIO", fr: "AUDIO EN DIRECT", zh: "实时音频" },
    "🔊 ÁUDIO AO VIVO": { en: "🔊 LIVE AUDIO", fr: "🔊 AUDIO EN DIRECT", zh: "🔊 实时音频" },
    "🎙️ ÁUDIO DA CRIANÇA": { en: "🎙️ CHILD'S AUDIO", fr: "🎙️ AUDIO DE L'ENFANT", zh: "🎙️ 孩子的音频" },
    "AO VIVO": { en: "LIVE", fr: "EN DIRECT", zh: "直播" },
    "● AO VIVO": { en: "● LIVE", fr: "● EN DIRECT", zh: "● 直播" },
    "● Pronto para solicitar": { en: "● Ready to request", fr: "● Prêt à demander", zh: "● 可发起请求" },
    "CÂMERA · TOCAR PARA VISUALIZAR": { en: "CAMERA · TAP TO VIEW", fr: "CAMÉRA · TOUCHER POUR VOIR", zh: "摄像头 · 点击查看" },
    "Abrir câmera da Criança": { en: "Open Child's camera", fr: "Ouvrir la caméra de l'enfant", zh: "打开孩子的摄像头" },
    "Abrir câmera autorizada": { en: "Open authorized camera", fr: "Ouvrir la caméra autorisée", zh: "打开已授权摄像头" },

    // ---- Dispositivos / vinculação ----
    "Vínculo Guardian ↔ Child": { en: "Guardian ↔ Child pairing", fr: "Appairage Guardian ↔ Enfant", zh: "Guardian ↔ 孩子 绑定" },
    "Dispositivos vinculados": { en: "Linked devices", fr: "Appareils liés", zh: "已绑定设备" },
    "Convite de vinculação": { en: "Pairing invite", fr: "Invitation d'appairage", zh: "绑定邀请" },
    "Código manual": { en: "Manual code", fr: "Code manuel", zh: "手动代码" },
    "Use este mesmo código no Child para vincular sem QR.": { en: "Use this same code on the Child to pair without QR.", fr: "Utilisez ce code sur l'enfant pour appairer sans QR.", zh: "在孩子端输入此代码即可免扫码绑定。" },
    "QR de vinculação": { en: "Pairing QR", fr: "QR d'appairage", zh: "绑定二维码" },
    "QR / Convite": { en: "QR / Invite", fr: "QR / Invitation", zh: "二维码 / 邀请" },
    "QR e convite": { en: "QR and invite", fr: "QR et invitation", zh: "二维码和邀请" },
    "Link de convite": { en: "Invite link", fr: "Lien d'invitation", zh: "邀请链接" },
    "Aplicativo Child": { en: "Child app", fr: "Application enfant", zh: "孩子应用" },
    "APK não configurado": { en: "APK not configured", fr: "APK non configuré", zh: "APK 未配置" },
    "Nenhum Child vinculado ainda.": { en: "No Child linked yet.", fr: "Aucun enfant lié pour l'instant.", zh: "尚未绑定孩子。" },
    "Nenhum dispositivo online no momento.": { en: "No device online right now.", fr: "Aucun appareil en ligne pour le moment.", zh: "当前没有在线设备。" },
    "Vincular criança": { en: "Link child", fr: "Lier un enfant", zh: "绑定孩子" },
    "Abrir vinculação": { en: "Open pairing", fr: "Ouvrir l'appairage", zh: "打开绑定" },

    // ---- Definições / atualização / perfil ----
    "Conta e sessão": { en: "Account & session", fr: "Compte et session", zh: "账户与会话" },
    "Atualizações": { en: "Updates", fr: "Mises à jour", zh: "更新" },
    "Atualização automática": { en: "Automatic update", fr: "Mise à jour automatique", zh: "自动更新" },
    "Atualização em tempo real": { en: "Real-time update", fr: "Mise à jour en temps réel", zh: "实时更新" },
    "Verificar e atualizar": { en: "Check and update", fr: "Vérifier et mettre à jour", zh: "检查并更新" },
    "A verificar…": { en: "Checking…", fr: "Vérification…", zh: "正在检查…" },
    "Versão instalada": { en: "Installed version", fr: "Version installée", zh: "已安装版本" },
    "Verifique novos recursos, melhorias e correções do T-Connect.": { en: "Check for new features, improvements and fixes in T-Connect.", fr: "Recherchez nouveautés, améliorations et correctifs de T-Connect.", zh: "查看 T-Connect 的新功能、改进和修复。" },
    "Instalar aplicativo": { en: "Install app", fr: "Installer l'application", zh: "安装应用" },
    "Idioma / Tradutor": { en: "Language / Translator", fr: "Langue / Traducteur", zh: "语言 / 翻译" },
    "Perfil": { en: "Profile", fr: "Profil", zh: "个人资料" },
    "Editar perfil": { en: "Edit profile", fr: "Modifier le profil", zh: "编辑资料" },
    "Guardian · toque para editar": { en: "Guardian · tap to edit", fr: "Guardian · touchez pour modifier", zh: "Guardian · 点击编辑" },
    "O seu nome": { en: "Your name", fr: "Votre nom", zh: "您的姓名" },
    "Guardar": { en: "Save", fr: "Enregistrer", zh: "保存" },
    "Segurança em tempo real": { en: "Real-time security", fr: "Sécurité en temps réel", zh: "实时安全" },

    // ---- Atividades / terminais / alertas ----
    "Atividades do terminal": { en: "Terminal activity", fr: "Activité du terminal", zh: "终端活动" },
    "Fluxo técnico das atividades autorizadas em tempo real.": { en: "Technical stream of authorized activities in real time.", fr: "Flux technique des activités autorisées en temps réel.", zh: "已授权活动的实时技术流。" },
    "Pesquisar contacto": { en: "Search contact", fr: "Rechercher un contact", zh: "搜索联系人" },
    "Pesquisar atividade, contacto ou número de telemóvel...": { en: "Search activity, contact or phone number...", fr: "Rechercher activité, contact ou numéro...", zh: "搜索活动、联系人或电话号码…" },
    "Limpar": { en: "Clear", fr: "Effacer", zh: "清除" },
    "Nenhum alerta ativo": { en: "No active alerts", fr: "Aucune alerte active", zh: "无激活警报" },
    "Nenhum alerta recebido.": { en: "No alerts received.", fr: "Aucune alerte reçue.", zh: "未收到警报。" },
    "Marcar como lidos": { en: "Mark as read", fr: "Marquer comme lus", zh: "标记为已读" },
    "O sino mostra apenas emergências e eventos críticos reais.": { en: "The bell shows only real emergencies and critical events.", fr: "La cloche n'affiche que les urgences et événements critiques réels.", zh: "铃铛仅显示真实的紧急和关键事件。" },
    "Alerta recebido da Criança": { en: "Alert received from the Child", fr: "Alerte reçue de l'enfant", zh: "收到来自孩子的警报" },

    // ---- Botões / ações comuns ----
    "Voltar": { en: "Back", fr: "Retour", zh: "返回" },
    "‹ Voltar": { en: "‹ Back", fr: "‹ Retour", zh: "‹ 返回" },
    "Fechar": { en: "Close", fr: "Fermer", zh: "关闭" },
    "Fechar menu": { en: "Close menu", fr: "Fermer le menu", zh: "关闭菜单" },
    "Abrir menu": { en: "Open menu", fr: "Ouvrir le menu", zh: "打开菜单" },
    "Abrir alertas": { en: "Open alerts", fr: "Ouvrir les alertes", zh: "打开警报" },
    "Abrir definições": { en: "Open settings", fr: "Ouvrir les paramètres", zh: "打开设置" },
    "Abrir nova versão": { en: "Open new version", fr: "Ouvrir la nouvelle version", zh: "打开新版本" },
    "Atualizar monitoramento": { en: "Refresh monitoring", fr: "Actualiser la surveillance", zh: "刷新监控" },
    "Ver alertas": { en: "View alerts", fr: "Voir les alertes", zh: "查看警报" },
    "Ver bateria": { en: "View battery", fr: "Voir la batterie", zh: "查看电量" },
    "Ver estado da conexão": { en: "View connection status", fr: "Voir l'état de connexion", zh: "查看连接状态" },
    "⌁ Ver atividades": { en: "⌁ View activity", fr: "⌁ Voir l'activité", zh: "⌁ 查看活动" },
    "↗ Enviar convite": { en: "↗ Send invite", fr: "↗ Envoyer l'invitation", zh: "↗ 发送邀请" },
    "⧉ Copiar código": { en: "⧉ Copy code", fr: "⧉ Copier le code", zh: "⧉ 复制代码" },
    "⧉ Copiar link": { en: "⧉ Copy link", fr: "⧉ Copier le lien", zh: "⧉ 复制链接" },
    "⧉ Copiar número": { en: "⧉ Copy number", fr: "⧉ Copier le numéro", zh: "⧉ 复制号码" },
    "⬇ Baixar APK Child": { en: "⬇ Download Child APK", fr: "⬇ Télécharger l'APK enfant", zh: "⬇ 下载孩子 APK" },
    "＋ Cadastrar email": { en: "＋ Register email", fr: "＋ Enregistrer l'e-mail", zh: "＋ 注册邮箱" },
    "🗑 Eliminar conta": { en: "🗑 Delete account", fr: "🗑 Supprimer le compte", zh: "🗑 删除账户" },
    "📷 Colocar foto": { en: "📷 Add photo", fr: "📷 Ajouter une photo", zh: "📷 添加照片" },

    // ---- Processamento / vazios ----
    "Processando": { en: "Processing", fr: "Traitement", zh: "处理中" },
    "Pode demorar alguns segundos…": { en: "This may take a few seconds…", fr: "Cela peut prendre quelques secondes…", zh: "可能需要几秒钟…" },
    "Começar monitoramento": { en: "Start monitoring", fr: "Commencer la surveillance", zh: "开始监控" },
    "Está preparado para fazer o": { en: "Are you ready to start", fr: "Êtes-vous prêt à faire le", zh: "您准备好开始" },
    "T-Connect · Sempre com você.": { en: "T-Connect · Always with you.", fr: "T-Connect · Toujours avec vous.", zh: "T-Connect · 始终陪伴您。" },
    "Sem dados": { en: "No data", fr: "Aucune donnée", zh: "无数据" },

    // ---- Auth ----
    "E-mail": { en: "Email", fr: "E-mail", zh: "邮箱" },

    // ---- Admin / planos ----
    "Acesso restrito": { en: "Restricted access", fr: "Accès restreint", zh: "受限访问" },
    "Esta área é exclusiva do Super Administrador.": { en: "This area is exclusive to the Super Administrator.", fr: "Cette zone est réservée au super administrateur.", zh: "此区域仅限超级管理员。" },
    "Gestão de planos e contas": { en: "Plans and accounts management", fr: "Gestion des forfaits et comptes", zh: "套餐与账户管理" },
    "Ações administrativas sobre esta conta.": { en: "Administrative actions on this account.", fr: "Actions administratives sur ce compte.", zh: "对该账户的管理操作。" },
    "Pessoas / emails cadastrados": { en: "Registered people / emails", fr: "Personnes / e-mails enregistrés", zh: "已注册人员 / 邮箱" },
    "Nenhum utilizador cadastrado.": { en: "No registered user.", fr: "Aucun utilisateur enregistré.", zh: "无注册用户。" },
    "Utilizador não encontrado.": { en: "User not found.", fr: "Utilisateur introuvable.", zh: "未找到用户。" },
    "Escolha o seu plano": { en: "Choose your plan", fr: "Choisissez votre forfait", zh: "选择您的套餐" },
    "Mais popular": { en: "Most popular", fr: "Le plus populaire", zh: "最受欢迎" },
    "Não é possível aceder à plataforma sem escolher um plano.": { en: "You cannot access the platform without choosing a plan.", fr: "Impossible d'accéder à la plateforme sans choisir un forfait.", zh: "未选择套餐无法访问平台。" },
    "Planos de pagamento": { en: "Payment plans", fr: "Forfaits de paiement", zh: "付费方案" },
    "Ativar / editar plano": { en: "Activate / edit plan", fr: "Activer / modifier le forfait", zh: "激活 / 编辑套餐" },
    "Editar plano": { en: "Edit plan", fr: "Modifier le forfait", zh: "编辑套餐" },
    "Editar dias": { en: "Edit days", fr: "Modifier les jours", zh: "编辑天数" },
    "Toque na engrenagem para editar preço e dias.": { en: "Tap the gear to edit price and days.", fr: "Touchez l'engrenage pour modifier le prix et les jours.", zh: "点击齿轮编辑价格和天数。" },
    "Enviar comprovante via WhatsApp": { en: "Send proof via WhatsApp", fr: "Envoyer la preuve via WhatsApp", zh: "通过 WhatsApp 发送凭证" },
    "Já paguei (confirmação manual)": { en: "I've paid (manual confirmation)", fr: "J'ai payé (confirmation manuelle)", zh: "我已付款（手动确认）" },
    "Pagar automaticamente (recebe o pedido de PIN no telemóvel)": { en: "Pay automatically (you'll get a PIN prompt on your phone)", fr: "Payer automatiquement (demande de PIN sur le téléphone)", zh: "自动付款（手机将收到 PIN 请求）" },
    "Seu número (ex: 84XXXXXXX)": { en: "Your number (e.g. 84XXXXXXX)", fr: "Votre numéro (ex : 84XXXXXXX)", zh: "您的号码（例如 84XXXXXXX）" },
    "Operadora": { en: "Carrier", fr: "Opérateur", zh: "运营商" },
    "País": { en: "Country", fr: "Pays", zh: "国家" },
    "Moçambique": { en: "Mozambique", fr: "Mozambique", zh: "莫桑比克" },
    "Cartão": { en: "Card", fr: "Carte", zh: "卡片" },
    "Registo": { en: "Record", fr: "Enregistrement", zh: "记录" },
    "Valor:": { en: "Amount:", fr: "Montant :", zh: "金额：" },
    "Nenhum registo real/autorizado encontrado.": { en: "No real/authorized record found.", fr: "Aucun enregistrement réel/autorisé trouvé.", zh: "未找到真实/授权记录。" },
    "Confirmar senha": { en: "Confirm password", fr: "Confirmer le mot de passe", zh: "确认密码" },
    "Repita a senha": { en: "Repeat the password", fr: "Répétez le mot de passe", zh: "再次输入密码" },
    "Senha fraca": { en: "Weak password", fr: "Mot de passe faible", zh: "密码较弱" },
    "Senha média": { en: "Medium password", fr: "Mot de passe moyen", zh: "密码中等" },
    "Senha boa": { en: "Good password", fr: "Bon mot de passe", zh: "密码良好" },
    "Senha forte": { en: "Strong password", fr: "Mot de passe fort", zh: "密码很强" },
    "✓ As senhas coincidem": { en: "✓ Passwords match", fr: "✓ Les mots de passe correspondent", zh: "✓ 密码一致" },
    "✗ As senhas não coincidem": { en: "✗ Passwords do not match", fr: "✗ Les mots de passe ne correspondent pas", zh: "✗ 密码不一致" }
  };

  function lang() { return (window.TC_I18N && window.TC_I18N.lang) || "pt"; }
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, INPUT: 1, SELECT: 1, OPTION: 1 };
  var ATTRS = ["placeholder", "title", "aria-label", "alt"];

  // ----------------------------------------------------------------------
  // Tradução DINÂMICA (100% da página). O dicionário acima é o caminho
  // rápido e offline; o que ele não cobre é traduzido em tempo real por um
  // serviço de tradução e fica guardado em cache (localStorage) para não
  // repetir pedidos. Assim nada fica em português quando se muda o idioma.
  // ----------------------------------------------------------------------
  var GT = { en: "en", fr: "fr", zh: "zh-CN" };
  var DONE = (typeof WeakSet !== "undefined") ? new WeakSet() : null; // nós já tratados
  var MEM = {}; // MEM[L] = { ptOriginal: traduzido }
  // Zonas de alta rotação / dados técnicos: o dicionário ainda se aplica,
  // mas NÃO se envia este texto para tradução dinâmica (evita inundar a rede
  // com carimbos de hora, coordenadas e códigos que mudam a cada segundo).
  var DYN_SKIP_SEL = ".terminal,.auto-terminal,.activity-terminal,.msg-seq-terminal,.call-terminal,.screen-terminal,.tc-scifi-hud,.tc-glass-panel,.tc-exact-coordinate-hud,.mapkey,.invite-link,.manual-pair-code,.pair-code,code,pre,.version-pill";

  function ensureMem(L) {
    if (MEM[L]) return MEM[L];
    try { MEM[L] = JSON.parse(localStorage.getItem("tcx:" + L) || "{}") || {}; }
    catch (_) { MEM[L] = {}; }
    return MEM[L];
  }
  function cacheGet(L, txt) { var m = ensureMem(L); return Object.prototype.hasOwnProperty.call(m, txt) ? m[txt] : undefined; }
  function cacheSet(L, txt, val) { var m = ensureMem(L); m[txt] = val; try { localStorage.setItem("tcx:" + L, JSON.stringify(m)); } catch (_) {} }

  function inDynSkip(el) { try { return !!(el && el.closest && el.closest(DYN_SKIP_SEL)); } catch (_) { return false; } }
  // Vale a pena traduzir? Tem de ter pelo menos uma letra e não ser só números,
  // horas, coordenadas, percentagens ou símbolos (esses ficam como estão).
  function translatable(t) {
    if (!t || t.length < 2) return false;
    if (!/[A-Za-zÀ-ÿ]/.test(t)) return false;
    if (/^[\d\s.,:;+\-–—°%/()[\]#@|]+$/.test(t)) return false;
    return true;
  }

  var QUEUE = [];   // { t: ptText, apply: fn(translated) }
  var INFLIGHT = false;

  function gtrans(L, text) {
    var tl = GT[L] || L;
    var url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=pt&tl=" + encodeURIComponent(tl) + "&dt=t&q=" + encodeURIComponent(text);
    return fetch(url).then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); }).then(function (j) {
      var out = "";
      try { (j[0] || []).forEach(function (seg) { if (seg && seg[0]) out += seg[0]; }); } catch (_) {}
      return out || text;
    });
  }

  function flushQueue() {
    if (INFLIGHT || !QUEUE.length) return;
    var L = lang();
    if (L === "pt") { QUEUE = []; return; }
    INFLIGHT = true;
    var batch = QUEUE; QUEUE = [];
    // Agrupa por texto para traduzir cada frase UMA só vez.
    var groups = {};
    batch.forEach(function (it) { (groups[it.t] = groups[it.t] || []).push(it.apply); });
    var texts = Object.keys(groups);
    var i = 0, POOL = 4, active = 0;
    function done() {
      INFLIGHT = false;
      // aplica as traduções recolhidas sem disparar o próprio observador
      if (obs) obs.disconnect();
      pendingApply.forEach(function (fnArgs) { try { fnArgs[0](fnArgs[1]); } catch (_) {} });
      pendingApply = [];
      if (obs && document.body) obs.observe(document.body, { childList: true, subtree: true, characterData: true });
      if (QUEUE.length) flushQueue();
    }
    var pendingApply = [];
    function next() {
      if (i >= texts.length) { if (active === 0) done(); return; }
      while (active < POOL && i < texts.length) {
        var txt = texts[i++]; active++;
        (function (txt) {
          var cached = cacheGet(L, txt);
          var p = (cached != null) ? Promise.resolve(cached) : gtrans(L, txt).then(function (tr) { cacheSet(L, txt, tr); return tr; });
          p.then(function (tr) {
            (groups[txt] || []).forEach(function (fn) { pendingApply.push([fn, tr]); });
          }).catch(function () { /* falhou: fica em pt, tenta de novo noutro ciclo */ })
            .then(function () { active--; next(); });
        })(txt);
      }
    }
    next();
  }

  function walk(node) {
    var L = lang();
    if (L === "pt") return;
    if (node.nodeType === 3) {
      if (DONE && DONE.has(node)) return;
      var raw = node.nodeValue;
      if (!raw) return;
      var t = raw.trim();
      if (!t) return;
      var e = UI[t];
      if (e && e[L]) { node.nodeValue = raw.replace(t, e[L]); if (DONE) DONE.add(node); return; }
      // Caminho dinâmico (tudo o resto)
      if (inDynSkip(node.parentNode)) return;
      if (!translatable(t)) return;
      var cached = cacheGet(L, t);
      if (cached != null) { node.nodeValue = raw.replace(t, cached); if (DONE) DONE.add(node); return; }
      if (DONE) DONE.add(node); // otimista: evita re-enfileirar o mesmo nó
      (function (n, r, tt) { QUEUE.push({ t: tt, apply: function (tr) { try { n.nodeValue = r.replace(tt, tr); } catch (_) {} } }); })(node, raw, t);
      return;
    }
    if (node.nodeType !== 1) return;
    // Traduz atributos de QUALQUER elemento (inclui placeholders de inputs).
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i];
      if (node.hasAttribute && node.hasAttribute(a)) {
        var v = (node.getAttribute(a) || "").trim();
        if (!v) continue;
        var e2 = UI[v];
        if (e2 && e2[L]) { node.setAttribute(a, e2[L]); continue; }
        if (inDynSkip(node) || !translatable(v)) continue;
        var flag = "data-xl-" + a;
        if (node.getAttribute(flag) === "1") continue;
        var c2 = cacheGet(L, v);
        if (c2 != null) { node.setAttribute(a, c2); node.setAttribute(flag, "1"); continue; }
        node.setAttribute(flag, "1");
        (function (el, attr, orig) { QUEUE.push({ t: orig, apply: function (tr) { try { el.setAttribute(attr, tr); } catch (_) {} } }); })(node, a, v);
      }
    }
    // Não desce ao conteúdo de script/style/textarea/select/option/input.
    if (SKIP[node.tagName]) return;
    for (var c = node.firstChild; c; c = c.nextSibling) walk(c);
  }

  var obs = null;
  function translateAll() {
    if (lang() === "pt" || !document.body) return;
    if (obs) obs.disconnect();
    try { walk(document.body); } catch (_) {}
    if (obs) obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    if (QUEUE.length) flushQueue();
  }
  var pending = null;
  function schedule() {
    if (pending) cancelAnimationFrame(pending);
    pending = requestAnimationFrame(function () { translateAll(); pending = null; });
  }

  function start() {
    if (!document.body) { setTimeout(start, 50); return; }
    obs = new MutationObserver(function () { schedule(); });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    // re-traduzir quando o idioma muda
    if (window.TC_I18N && typeof window.TC_I18N.setLang === "function") {
      var orig = window.TC_I18N.setLang;
      window.TC_I18N.setLang = function (l) { var r = orig.call(window.TC_I18N, l); schedule(); return r; };
    }
    translateAll();
  }
  if (document.readyState !== "loading") start();
  else document.addEventListener("DOMContentLoaded", start);

  window.TC_UI_DICT = UI; // exposto para depuração / expansão
})();
