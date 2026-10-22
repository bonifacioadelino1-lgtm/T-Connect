// T-Connect Supabase configuration
// Paste your Supabase Project URL and Publishable key here.
// Never put a service_role/secret key in this file.
window.TC_SUPABASE = {
  url: 'https://ygtvbczjolbaabqbhnxu.supabase.co',
  publishableKey: 'sb_publishable_Y6K_cRvVd_xnUSDG2lo89g_KEHVun5I',
  // Configure the public Child APK URL after hosting the signed APK.
  childApkUrl: '',
  // Optional public URL of the Child web/app entrypoint. Leave blank to use the current site.
  childInviteBaseUrl: '',
  // URL remoto do manifesto de atualização (site GitHub Pages, sempre com a versão mais recente).
  // Sem isto, a app lê o manifesto EMBUTIDO no próprio APK (mesma versão instalada) e nunca
  // encontra atualização. Com o URL remoto, o botão "Verificar atualizações" procura a sério.
  updateManifestUrl: 'https://bonifacioadelino1-lgtm.github.io/T-Connect/updates/t-connect-update.json'
};

// Configuração WebRTC (câmara/áudio/projeção).
// Em dados móveis / NAT do operador (muito comum), só STUN não chega: a ligação
// falha e o Guardian não recebe som nem imagem. Por isso incluímos também servidores
// TURN públicos gratuitos (OpenRelay/Metered), que fazem o relay do áudio/vídeo quando
// a ligação direta não é possível. Para uso intensivo, troque por um TURN próprio.
window.TC_RTC = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302'] },
    { urls: 'stun:stun.relay.metered.ca:80' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
    // ,{ urls:'turn:SEU_TURN:3478', username:'USUARIO', credential:'SENHA' }  // TURN próprio (opcional)
  ],
  iceCandidatePoolSize: 4
};
