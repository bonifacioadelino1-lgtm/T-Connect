window.TC_APP_VERSION='2.39.91';try{if(window.TCNativeApp&&window.TCNativeApp.getVersion){var _tcv=window.TCNativeApp.getVersion();if(_tcv)window.TC_APP_VERSION=_tcv;}}catch(e){}
const tcTimeout=(p,ms=10000)=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('Tempo esgotado')),ms))]);
const POS=[-25.9692,32.5732];
const state={page:'overview',mapType:'roadmap',menuOpen:false,pairingBusy:false,pairingMessage:'',update:{auto:localStorage.getItem('tc_auto_updates')!=='0',checking:false,latest:null,error:''},events:JSON.parse(localStorage.getItem('tc_events')||'[]'),notifications:JSON.parse(localStorage.getItem('tc_notifications')||'[]'),search:'',authenticated:false,authMode:'login',loading:false,recoverySent:false,profile:null,devices:[],messages:[],calls:[],contactsList:[],appsList:[],contactStats:[],trailOn:false,commsSub:false,pairCode:'',pairLink:'',realtime:false,authError:'',lastLocation:null,mapTerminalEvents:JSON.parse(localStorage.getItem('tc_map_terminal_events')||'[]')};
const t=k=>window.TC_I18N?.t(k)||k;
const langOptions=()=>window.TC_I18N?.options?.map(k=>`<option value="${k}" ${window.TC_I18N.lang===k?'selected':''}>${window.TC_I18N.flag[k]} ${window.TC_I18N.labels[k]}</option>`).join('')||'';
function languageSelect(extra=''){return `<div class="auth-lang ${extra}"><span>🌐 ${esc(t('language'))}</span><select class="lang-select" aria-label="${esc(t('language'))}" onchange="changeLanguage(this.value)">${langOptions()}</select></div>`}
function changeLanguage(lang){window.TC_I18N.setLang(lang);render()}
window.changeLanguage=changeLanguage;
window.tcOnBackPressed=function(){
  try{
    // Portão de plano: sem plano ativo, o "Voltar" é consumido e NÃO dá acesso à app.
    if(state.authenticated&&!isSuperAdmin()&&needsPlanChoice()){ try{render();}catch(_){} return true; }
    // Ecrãs de autenticação: o "Voltar" navega entre eles em vez de sair da app.
    if(!state.authenticated){
      if(state.authMode==='terms'){ state.authMode='signup'; render(); return true; }
      if(state.authMode==='recover'||state.authMode==='signup'||state.authMode==='recoverUpdate'){ state.authMode='login'; state.authError=''; state.recoverySent=false; render(); return true; }
    }
    if(document.getElementById('tc-screen-preview')||document.getElementById('tc-audio-only-panel')){
      try{endRemoteCapture(tcCaptureRequestId)}catch(_){var a=document.getElementById('tc-screen-preview')||document.getElementById('tc-audio-only-panel');if(a)a.remove();}
      return true;
    }
    var ids=['tc-metric-popup','tc-notification-panel','tc-pay-overlay','tc-plan-overlay','tc-profile-overlay','tc-contact-overlay','tc-communication-prompt','tc-welcome-overlay','tc-emergency-speaker'];
    for(var i=0;i<ids.length;i++){var el=document.getElementById(ids[i]);if(el){el.remove();return true;}}
    var modal=document.querySelector('.modal');if(modal){modal.remove();return true;}
    if(state.menuOpen){state.menuOpen=false;render();return true;}
    if(tcNav.length){go(tcNav.pop(),true);return true;}
    if(state.page!=='overview'){go('overview',true);return true;}
  }catch(e){}
  return false;
};
window.addEventListener('tc-language',()=>{if(document.getElementById('app'))render()});
const contacts=[];
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function save(){localStorage.setItem('tc_events',JSON.stringify(state.events));localStorage.setItem('tc_notifications',JSON.stringify(state.notifications))}
function alertName(ev){const d=state.devices[0]||{};return ev.contact||ev.child_name||d.device_name||'Child'}
// Um dispositivo só está realmente "online" se o último heartbeat for recente.
// Sem isto, o status fica preso em 'online' no Supabase mesmo depois do aparelho
// parar de enviar dados. Considera offline se passaram mais de 2 minutos.
const TC_ONLINE_MAX_AGE_MS=120000;
function isDeviceOnline(d){if(!d||d.status!=='online')return false;if(!d.last_seen_at)return true;const age=Date.now()-new Date(d.last_seen_at).getTime();return !(age>=0&&age>TC_ONLINE_MAX_AGE_MS)}
// Super Admin: visível APENAS para esta conta.
const TC_SUPER_ADMIN_EMAIL='bonifacioadelino1@gmail.com';
function isSuperAdmin(){const e=String(window.TC_DB?.user?.email||'').trim().toLowerCase();return e===TC_SUPER_ADMIN_EMAIL}
// Indicativos internacionais → país (para qualquer número do mundo).
const TC_COUNTRY_CODES={'258':'Moçambique','27':'África do Sul','351':'Portugal','55':'Brasil','244':'Angola','238':'Cabo Verde','245':'Guiné-Bissau','239':'São Tomé e Príncipe','670':'Timor-Leste','263':'Zimbabwe','260':'Zâmbia','265':'Malawi','255':'Tanzânia','266':'Lesoto','268':'Essuatíni','267':'Botsuana','264':'Namíbia','254':'Quénia','256':'Uganda','250':'Ruanda','257':'Burundi','243':'RD Congo','242':'Congo','241':'Gabão','237':'Camarões','234':'Nigéria','233':'Gana','225':'Costa do Marfim','221':'Senegal','212':'Marrocos','213':'Argélia','216':'Tunísia','20':'Egito','1':'EUA / Canadá','44':'Reino Unido','353':'Irlanda','33':'França','49':'Alemanha','34':'Espanha','39':'Itália','31':'Países Baixos','32':'Bélgica','41':'Suíça','43':'Áustria','45':'Dinamarca','46':'Suécia','47':'Noruega','358':'Finlândia','48':'Polónia','30':'Grécia','7':'Rússia / Cazaquistão','380':'Ucrânia','86':'China','852':'Hong Kong','886':'Taiwan','91':'Índia','92':'Paquistão','880':'Bangladesh','94':'Sri Lanka','62':'Indonésia','60':'Malásia','65':'Singapura','66':'Tailândia','84':'Vietname','63':'Filipinas','971':'Emirados Árabes','966':'Arábia Saudita','90':'Turquia','98':'Irão','972':'Israel','961':'Líbano','962':'Jordânia','964':'Iraque','965':'Kuwait','968':'Omã','974':'Catar','973':'Bahrein','61':'Austrália','64':'Nova Zelândia','81':'Japão','82':'Coreia do Sul','52':'México','54':'Argentina','56':'Chile','57':'Colômbia','51':'Peru','598':'Uruguai','595':'Paraguai','591':'Bolívia','593':'Equador','58':'Venezuela','502':'Guatemala','503':'El Salvador','504':'Honduras','505':'Nicarágua','506':'Costa Rica','507':'Panamá','53':'Cuba'};
// Operadoras de Moçambique por prefixo (sem indicativo).
function tcMzCarrier(nd){const p=String(nd).slice(0,2);if(['84','85'].includes(p))return 'Vodacom';if(['82','83'].includes(p))return 'Tmcel (mCel)';if(['86','87'].includes(p))return 'Movitel';return '';}
// Deteta o país pelo indicativo (tenta 3, 2 e 1 dígitos).
function tcDetectCountry(digits){let d=String(digits||'').replace(/\D/g,'').replace(/^00/,'');for(const len of [3,2,1]){const cc=d.slice(0,len);if(TC_COUNTRY_CODES[cc])return{cc,country:TC_COUNTRY_CODES[cc],national:d.slice(len)};}return null;}
// País de um número (para mostrar no cartão). Local de 9 dígitos assume-se Moçambique.
function tcContactCountry(num){let d=String(num||'').replace(/\D/g,'').replace(/^00/,'');if((d.length===9&&(d[0]==='8'))||d.startsWith('258'))return 'Moçambique';const c=tcDetectCountry(d);return c?c.country:'—';}
// Operadora/rede de QUALQUER número do mundo. Em Moçambique dá a operadora exata;
// nos outros países dá a rede pelo país (a operadora exata de cada número não é
// detetável offline por causa da portabilidade, por isso mostramos a rede/país).
function mozOperator(num){
  let d=String(num||'').replace(/\D/g,'').replace(/^00/,'');
  const isLocalMZ=(d.length===9&&d[0]==='8')||d.startsWith('258');
  if(isLocalMZ){const nd=d.replace(/^258/,'');const c=tcMzCarrier(nd);return (c||'Operadora')+' · Moçambique';}
  const c=tcDetectCountry(d);
  if(c)return 'Rede de '+c.country;
  return 'Operadora desconhecida';
}
function knownContactName(num){
  const d=String(num).replace(/\D/g,'');
  for(const e of state.events){
    const blob=`${e.detail||''} ${e.contact||''} ${e.child_name||''}`;
    if(d && blob.replace(/\D/g,'').includes(d.slice(-7)) && (e.contact||e.child_name)){
      return e.contact||e.child_name;
    }
  }
  return '';
}
function lookupContact(query){
  tcSound&&tcSound('tap');
  const raw=String(query||'').trim();
  const digits=raw.replace(/\D/g,'');
  if(digits.length<6){ state.search=raw; render(); return; }
  const operator=mozOperator(digits);
  const country=tcContactCountry(digits);
  const name=knownContactName(digits)||'Não identificado nos registos';
  const display=digits.startsWith('258')?('+'+digits):(digits.length===9?('+258 '+digits):('+'+digits));
  addEvent('PESQUISA','Pesquisa de contacto: '+display+' · '+operator+(country&&country!=='—'?(' · '+country):''),{status:'CONSULTADO',source:'Guardian',contact:name});
  // Tenta localizar no mapa onde a criança esteve com este número; se não houver histórico,
  // o trackContact mostra o cartão de identidade (operadora/nome) como alternativa.
  try{ trackContact(digits,{number:display,operator,name,country}); }catch(_){ showContactCard({number:display,operator,name,country}); }
}
window.lookupContact=lookupContact;
function showContactCard(info){
  const old=document.getElementById('tc-contact-overlay');if(old)old.remove();
  const el=document.createElement('div');el.id='tc-contact-overlay';el.className='tc-contact-overlay';
  const initial=(info.name&&info.name[0]&&/[a-zA-Z]/.test(info.name[0]))?info.name[0].toUpperCase():'?';
  el.innerHTML=`<div class="tc-contact-card" onclick="event.stopPropagation()"><button class="tc-contact-close" aria-label="Fechar" onclick="document.getElementById('tc-contact-overlay').remove()">×</button>
    <div class="tc-contact-avatar">${esc(initial)}</div>
    <div class="tc-contact-name">${esc(info.name)}</div>
    <div class="tc-contact-number">${esc(info.number)}</div>
    <div class="tc-contact-rows">
      <div class="tc-contact-row"><span>Operadora</span><b>${esc(info.operator)}</b></div>
      <div class="tc-contact-row"><span>País</span><b>${esc(info.country||'Moçambique')}</b></div>
      <div class="tc-contact-row"><span>Registo</span><b>${info.name==='Não identificado nos registos'?'Sem correspondência':'Identificado'}</b></div>
    </div>
    <button class="btn primary tc-contact-track" onclick="trackContact('${esc(String(info.number||'').replace(/'/g,''))}')"><span style="margin-right:6px">📍</span>Localização nos contactos</button>
    <p class="tc-contact-note">Mostra no mapa onde a <b>criança</b> estava nos momentos de chamada/SMS com este contacto (histórico do próprio dispositivo). Não localiza a outra pessoa.</p>
  </div>`;
  el.onclick=()=>el.remove();
  document.body.appendChild(el);
}
// Rastreio por contacto: mostra no mapa onde a CRIANÇA estava nos momentos de
// chamadas/SMS com este número (usa só o histórico de localização do dispositivo).
async function trackContact(number,fallbackCard){
  try{document.getElementById('tc-contact-overlay')?.remove();}catch(_){}
  const d=state.devices[0];
  if(!d||!d.id||!window.TC_DB?.enabled||!window.TC_DB.client){if(fallbackCard)showContactCard(fallbackCard);else alert('É preciso um dispositivo vinculado e ligação ativa.');return}
  const norm=x=>String(x||'').replace(/[^0-9+]/g,'').slice(-9);
  const key=norm(number); if(!key)return;
  if(!(state.calls&&state.calls.length)){try{await loadCalls()}catch(_){}}
  if(!(state.messages&&state.messages.length)){try{await loadMessages()}catch(_){}}
  const inter=[];
  (state.calls||[]).forEach(c=>{if(norm(c.number)===key){const t=tcCallTime(c);if(t)inter.push({t,kind:'Chamada',dir:c.direction||''})}});
  (state.messages||[]).forEach(m=>{if(norm(m.address)===key){const t=tcMsgTime(m);if(t)inter.push({t,kind:'Mensagem',dir:m.direction||''})}});
  const nm=knownContactName(key)||number;
  if(!inter.length){if(fallbackCard){showContactCard(fallbackCard);}else{alert('Sem chamadas ou mensagens com '+nm+' para localizar no mapa.');}return}
  inter.sort((a,b)=>a.t-b.t);
  const minT=inter[0].t-3600000,maxT=inter[inter.length-1].t+3600000;
  let locs=[];
  try{const {data}=await window.TC_DB.client.from('location_history').select('lat,lng,epoch_ms').eq('device_id',d.id).gte('epoch_ms',minT).lte('epoch_ms',maxT).order('epoch_ms',{ascending:true}).limit(8000);locs=data||[]}catch(e){console.warn('loc hist',e&&e.message)}
  const WIN=20*60*1000;const points=[];
  for(const it of inter){
    let best=null,bestd=Infinity;
    for(const p of locs){const dd=Math.abs(Number(p.epoch_ms)-it.t);if(dd<bestd){bestd=dd;best=p}}
    if(best&&bestd<=WIN&&Number.isFinite(Number(best.lat))&&Number.isFinite(Number(best.lng))){
      points.push({lat:Number(best.lat),lng:Number(best.lng),time:it.t,kind:it.kind,dir:it.dir});
    }
  }
  if(!points.length){if(fallbackCard){showContactCard(fallbackCard);}else{alert('Não há localização registada da criança nos horários dos contactos com '+nm+'.\n(O histórico de localização só existe a partir do momento em que o dispositivo começou a enviar posições.)');}return}
  state.page='map';state.menuOpen=false;render();
  addEvent('RASTREIO','Localização da criança nos contactos com '+nm+': '+points.length+' ponto(s).',{status:'CONSULTADO',source:'Guardian',contact:nm});
  setTimeout(()=>{try{if(window.TC_MAP){if(TC_MAP.refresh)TC_MAP.refresh();if(TC_MAP.showContactPoints)TC_MAP.showContactPoints(points,nm);}}catch(e){console.warn(e)}},500);
}
window.trackContact=trackContact;
window.showContactCard=showContactCard;
// Som profissional (sintetizado, sem ficheiros) para os ícones animados.
let tcSfxCtx=null;
function tcSound(kind){
  try{
    const Ctx=window.AudioContext||window.webkitAudioContext; if(!Ctx)return;
    tcSfxCtx=tcSfxCtx||new Ctx(); if(tcSfxCtx.state==='suspended')tcSfxCtx.resume().catch(()=>{});
    const now=tcSfxCtx.currentTime;
    // Cada tipo tem um par de notas distinto (duas notas = som "profissional" curto).
    const seq={
      'msg-in':[[660,0],[880,0.09]],
      'msg-out':[[880,0],[660,0.09]],
      'call-in':[[523,0],[784,0.1],[1046,0.2]],
      'call-out':[[784,0],[523,0.1]],
      'tap':[[720,0]]
    }[kind]||[[720,0]];
    const master=tcSfxCtx.createGain(); master.gain.value=0.0001; master.connect(tcSfxCtx.destination);
    master.gain.setValueAtTime(0.0001,now); master.gain.exponentialRampToValueAtTime(0.16,now+0.01); master.gain.exponentialRampToValueAtTime(0.0001,now+0.42);
    seq.forEach(([freq,t])=>{
      const o=tcSfxCtx.createOscillator(); const g=tcSfxCtx.createGain();
      o.type='sine'; o.frequency.setValueAtTime(freq,now+t);
      g.gain.setValueAtTime(0.0001,now+t); g.gain.exponentialRampToValueAtTime(0.22,now+t+0.015); g.gain.exponentialRampToValueAtTime(0.0001,now+t+0.16);
      o.connect(g); g.connect(master); o.start(now+t); o.stop(now+t+0.2);
    });
  }catch(_){}
}
window.tcSound=tcSound;
// Perfil do Guardian: nome e foto personalizados (guardados localmente por conta).
function profileKey(){const uid=window.TC_DB?.user?.id||'local';return 'tc_profile_'+uid}
function loadProfile(){try{return JSON.parse(localStorage.getItem(profileKey())||'null')||{}}catch(_){return {}}}
function saveProfile(p){try{localStorage.setItem(profileKey(),JSON.stringify(p))}catch(_){}}
function profileDisplayName(){const p=loadProfile();return p.name||(window.TC_DB?.user?.email||'Conta local').split('@')[0]}
function profileAvatarHtml(){const p=loadProfile();if(p.photo){return `<div class="tc-profile-avatar has-photo"><img src="${esc(p.photo)}" alt="Perfil"></div>`;}return '<div class="tc-profile-avatar"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg></div>';}
function openProfileEditor(){
  const p=loadProfile();
  const old=document.getElementById('tc-profile-overlay');if(old)old.remove();
  const el=document.createElement('div');el.id='tc-profile-overlay';el.className='tc-contact-overlay';
  el.innerHTML=`<div class="tc-contact-card tc-profile-editor" onclick="event.stopPropagation()"><button class="tc-contact-close" onclick="document.getElementById('tc-profile-overlay').remove()">×</button>
    <div class="tc-profile-edit-avatar" id="tc-profile-preview">${p.photo?`<img src="${esc(p.photo)}" alt="Perfil">`:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>'}</div>
    <label class="btn small tc-photo-btn">📷 Colocar foto<input type="file" accept="image/*" id="tc-profile-file" hidden></label>
    <label class="tc-profile-label">Nome</label>
    <input class="tc-profile-input" id="tc-profile-name" value="${esc(p.name||profileDisplayName())}" placeholder="O seu nome" maxlength="40">
    <label class="tc-profile-label">Contacto</label>
    <input class="tc-profile-input" id="tc-profile-contact" value="${esc(p.contact||'')}" placeholder="O seu número de telemóvel" inputmode="tel" maxlength="30">
    <label class="tc-profile-label">Morada / Local</label>
    <input class="tc-profile-input" id="tc-profile-address" value="${esc(p.address||'')}" placeholder="A sua morada ou localidade" maxlength="80">
    <div class="tc-profile-account">
      <div class="setting"><span>E-mail</span><b>${esc(window.TC_DB?.user?.email||'Conta local')}</b></div>
      <div class="setting"><span>Estado da sessão</span><b class="${window.TC_DB?.user?'online':''}">${window.TC_DB?.user?'● Ativa':'○ Local'}</b></div>
      <div class="setting"><span>Atualização em tempo real</span><b class="${state.realtime?'online':''}">${state.realtime?'● Ativa':'○ Inativa'}</b></div>
    </div>
    <div class="tc-profile-actions"><button class="btn primary wide" onclick="saveProfileEditor()">Guardar</button></div>
  </div>`;
  el.onclick=()=>el.remove();
  document.body.appendChild(el);
  const file=document.getElementById('tc-profile-file');
  file.onchange=e=>{const f=e.target.files&&e.target.files[0];if(!f)return;if(f.size>2*1024*1024){alert('Imagem muito grande (máx. 2MB).');return;}const r=new FileReader();r.onload=()=>{const prev=document.getElementById('tc-profile-preview');prev.innerHTML=`<img src="${r.result}" alt="Perfil">`;prev.dataset.photo=r.result;};r.readAsDataURL(f);};
}
function saveProfileEditor(){
  const p=loadProfile();
  const name=(document.getElementById('tc-profile-name')?.value||'').trim();
  const contact=(document.getElementById('tc-profile-contact')?.value||'').trim();
  const address=(document.getElementById('tc-profile-address')?.value||'').trim();
  const prev=document.getElementById('tc-profile-preview');
  if(name)p.name=name;
  p.contact=contact;p.address=address;
  if(prev&&prev.dataset.photo)p.photo=prev.dataset.photo;
  saveProfile(p);
  // Supabase: grava nome (profiles.full_name) e foto (profiles.avatar_url).
  if(supaReady()&&window.tcSaveMyProfile){window.tcSaveMyProfile({name:p.name||'',photo:p.photo||''}).catch(err=>console.warn('Supabase perfil:',err.message));}
  const ov=document.getElementById('tc-profile-overlay');if(ov)ov.remove();
  addEvent('PERFIL','Perfil atualizado'+(name?(' — '+name):''),{status:'ATUALIZADO',source:'Guardian'});
  render();
}
window.openProfileEditor=openProfileEditor;window.saveProfileEditor=saveProfileEditor;
function deviceName(){const d=state.devices[0];return (d&&d.device_name)||'Child'}
function syncDeviceName(){window.TC_DEVICE_NAME=deviceName()}
// Só contam como alerta (sino) emergências reais e eventos críticos — não os
// eventos de rotina online/offline/heartbeat, que antes inflavam a contagem.
function isAlertEvent(ev){const type=String(ev.type||'').toUpperCase();return type==='SOS'||type==='EMERGENCIA'||type==='ALERTA'||String(ev.severity||'').toLowerCase()==='critical'||/emerg[eê]nc/i.test(String(ev.detail||''))}
var tcAudioCtx=null;
function tcAudioContext(){try{if(!tcAudioCtx)tcAudioCtx=new (window.AudioContext||window.webkitAudioContext)();if(tcAudioCtx.state==='suspended')tcAudioCtx.resume();return tcAudioCtx;}catch(_){return null;}}
try{['click','touchstart','keydown'].forEach(function(ev){window.addEventListener(ev,function(){tcAudioContext();},{once:true,passive:true});});}catch(_){}
function tcVibrate(pattern){try{if(window.TCNativeVoice&&window.TCNativeVoice.vibrate){window.TCNativeVoice.vibrate(JSON.stringify(pattern));return;}}catch(_){}try{if(navigator.vibrate)navigator.vibrate(pattern);}catch(_){}}
function tcEmergencyAlarm(){tcVibrate([0,600,160,600,160,600,160,1100]);var ctx=tcAudioContext();if(!ctx)return;try{if(ctx.state==='suspended')ctx.resume();}catch(_){}
  var now=ctx.currentTime;
  // barramento com reverb curto (som cinematográfico de filme)
  var bus=ctx.createGain();bus.gain.value=0.85;var conv=null;try{conv=ctx.createConvolver();var sr=ctx.sampleRate,len=Math.floor(sr*1.5),b=ctx.createBuffer(2,len,sr);for(var ch=0;ch<2;ch++){var dd=b.getChannelData(ch);for(var ii=0;ii<len;ii++)dd[ii]=(Math.random()*2-1)*Math.pow(1-ii/len,3);}conv.buffer=b;}catch(_){conv=null;}
  var dry=ctx.createGain();dry.gain.value=0.92;bus.connect(dry);dry.connect(ctx.destination);if(conv){var wet=ctx.createGain();wet.gain.value=0.3;bus.connect(conv);conv.connect(wet);wet.connect(ctx.destination);}
  function boom(t,f,g,dur){var o=ctx.createOscillator();o.type='sine';var gg=ctx.createGain();o.frequency.setValueAtTime(f*2.4,t);o.frequency.exponentialRampToValueAtTime(f,t+dur*0.5);gg.gain.setValueAtTime(0.0001,t);gg.gain.exponentialRampToValueAtTime(g,t+0.02);gg.gain.exponentialRampToValueAtTime(0.0001,t+dur);o.connect(gg);gg.connect(bus);o.start(t);o.stop(t+dur+0.05);}
  boom(now,58,0.6,1.3);
  // klaxon duplo "alerta vermelho" — 4 varreduras com detune
  var t=now+0.05;
  for(var k=0;k<4;k++){
    [0,0.6].forEach(function(det){var o=ctx.createOscillator();o.type='sawtooth';var g=ctx.createGain();var lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.setValueAtTime(1100,t);lp.frequency.linearRampToValueAtTime(3200,t+0.34);o.frequency.setValueAtTime(430+det,t);o.frequency.linearRampToValueAtTime(900+det,t+0.33);o.frequency.linearRampToValueAtTime(430+det,t+0.62);g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(0.3,t+0.05);g.gain.setValueAtTime(0.3,t+0.5);g.gain.exponentialRampToValueAtTime(0.0001,t+0.66);o.connect(lp);lp.connect(g);g.connect(bus);o.start(t);o.stop(t+0.7);});
    var h=ctx.createOscillator();h.type='square';var hg=ctx.createGain();hg.gain.value=0.0001;h.frequency.setValueAtTime(1760,t);hg.gain.linearRampToValueAtTime(0.045,t+0.05);hg.gain.exponentialRampToValueAtTime(0.0001,t+0.6);h.connect(hg);hg.connect(bus);h.start(t);h.stop(t+0.62);
    t+=0.66;
  }
  boom(t-0.1,70,0.4,0.8);}
window.tcEmergencyAlarm=tcEmergencyAlarm;window.tcVibrate=tcVibrate;
function tcSpeak(text){try{if(window.TCNativeVoice&&window.TCNativeVoice.available&&window.TCNativeVoice.available()){window.TCNativeVoice.speak(String(text));return true;}}catch(_){}try{if(window.speechSynthesis){var u=new SpeechSynthesisUtterance(String(text));u.lang='pt-PT';u.rate=1;u.pitch=1;var vs=window.speechSynthesis.getVoices()||[];var pv=vs.find(function(v){return /pt/i.test(v.lang)});if(pv)u.voice=pv;window.speechSynthesis.cancel();window.speechSynthesis.speak(u);return true;}}catch(_){}return false;}
function tcAnnounce(text){tcSpeak(text);try{var eyes=document.querySelectorAll('.tcbe');eyes.forEach(function(eye){eye.classList.add('tcbe-speaking');if(!eye.querySelector('.tcbe-speaker')){var sp=document.createElement('div');sp.className='tcbe-speaker';sp.innerHTML='<span></span><span></span><span></span><span></span>';eye.appendChild(sp);}var cap=eye.querySelector('.tcbe-caption');if(!cap){cap=document.createElement('div');cap.className='tcbe-caption';eye.appendChild(cap);}cap.textContent=text;});clearTimeout(window.__tcSpeakT);window.__tcSpeakT=setTimeout(function(){document.querySelectorAll('.tcbe').forEach(function(eye){eye.classList.remove('tcbe-speaking');var sp=eye.querySelector('.tcbe-speaker');if(sp)sp.remove();var cap=eye.querySelector('.tcbe-caption');if(cap)cap.remove();});},3400);}catch(_){}}
window.tcSpeak=tcSpeak;window.tcAnnounce=tcAnnounce;
function addNotification(ev){if(!isAlertEvent(ev))return;const type=String(ev.type||'').toUpperCase();let title='Novo alerta',icon='🔔';if(type==='SOS'||type==='EMERGENCIA'||/emerg[eê]nc/i.test(ev.detail||'')){title='Alerta de emergência';icon='🚨'}else if(type==='ONLINE'){title='Dispositivo online';icon='🟢'}else if(type==='OFFLINE'){title='Dispositivo offline';icon='⚫'}else if(type==='ALERTA'||String(ev.severity||'').toLowerCase()==='critical'){title='Alerta do sistema';icon='⚠️'}state.notifications.unshift({id:ev.id,title,icon,name:alertName(ev),detail:ev.detail||'Nova atividade requer atenção.',at:ev.at,read:false});state.notifications=state.notifications.slice(0,100);save();try{if(window.tcAnnounce){var isEmerg=(type==='SOS'||type==='EMERGENCIA'||/emerg[eê]nc/i.test(ev.detail||''));var ph=isEmerg?'Emergência detetada':type==='ONLINE'?'Alvo online':type==='OFFLINE'?'Alvo offline':'Alerta detetado';tcAnnounce(ph);if(isEmerg&&window.tcEmergencyAlarm)tcEmergencyAlarm();}}catch(_){}}
function unreadNotifications(){return state.notifications.filter(n=>!n.read).length}
function markNotificationsRead(){state.notifications=state.notifications.map(n=>({...n,read:true}));save();render()}
function dismissNotification(id){state.notifications=state.notifications.filter(n=>String(n.id)!==String(id));save();const panel=document.getElementById('tc-notification-panel');if(panel){const list=panel.querySelector('.tc-notification-list');if(list){list.querySelectorAll('.tc-notification-item').forEach(function(it){if(it.getAttribute('data-id')===String(id))it.remove()});if(!list.querySelector('.tc-notification-item'))list.innerHTML='<div class="terminal-empty">Nenhum alerta recebido.</div>'}const small=panel.querySelector('.tc-notification-head small');if(small){const c=state.notifications.length;small.textContent=c?c+' registo'+(c===1?'':'s'):'Nenhum alerta'}}try{const b=document.querySelector('.top-alert-btn');if(b&&!unreadNotifications()){b.classList.remove('has-unread');const em=b.querySelector('em');if(em)em.remove()}}catch(_){}}
function tcSwipeToDismiss(item,onDone){let x0=0,dx=0,drag=false;item.style.touchAction='pan-y';item.addEventListener('pointerdown',function(e){x0=e.clientX;dx=0;drag=true;item.style.transition='none';try{item.setPointerCapture(e.pointerId)}catch(_){}});item.addEventListener('pointermove',function(e){if(!drag)return;dx=e.clientX-x0;if(Math.abs(dx)>6)item.__tcDragged=true;item.style.transform='translateX('+dx+'px)';item.style.opacity=String(Math.max(0,1-Math.abs(dx)/170))});var end=function(){if(!drag)return;drag=false;setTimeout(function(){item.__tcDragged=false},80);item.style.transition='transform .22s ease,opacity .22s ease';if(Math.abs(dx)>78){item.style.transform='translateX('+(dx>0?520:-520)+'px)';item.style.opacity='0';setTimeout(function(){onDone&&onDone()},210)}else{item.style.transform='';item.style.opacity=''}};item.addEventListener('pointerup',end);item.addEventListener('pointercancel',end)}
function showNotifications(){const old=document.getElementById('tc-notification-panel');if(old){old.remove();return}const items=state.notifications.slice(0,20);
  // Basta tocar no sino para "ler": a contagem desaparece imediatamente, e o cartão de
  // Alertas do Monitoramento fica sincronizado com o sino do topo.
  if(state.notifications.some(n=>!n.read)){state.notifications=state.notifications.map(n=>({...n,read:true}));save();const b=document.querySelector('.top-alert-btn');if(b){b.classList.remove('has-unread');const em=b.querySelector('em');if(em)em.remove()}const card=document.querySelector('.metric-alert');if(card){const ic=card.querySelector('.icon-bell');if(ic){ic.classList.remove('has-alert','alert-pulse');const e=ic.querySelector('em');if(e)e.remove()}const val=card.querySelector('.compact-value');if(val)val.textContent='0'}}const el=document.createElement('div');el.id='tc-notification-panel';el.className='tc-notification-layer';el.innerHTML=`<div class="tc-notification-card" role="dialog" aria-label="Alertas"><div class="tc-notification-head"><div><b>Alertas</b><small>${items.length?items.length+' registo'+(items.length===1?'':'s'):'Nenhum alerta'}</small></div><button class="tc-popup-close" type="button" aria-label="Fechar">×</button></div><div class="tc-notification-list">${items.length?items.map(n=>`<div class="tc-notification-item ${n.read?'read':'unread'}" data-id="${esc(String(n.id))}"><span class="tc-notification-icon">${n.icon}</span><div><b>${esc(n.title)}</b><strong>${esc(n.name)}</strong><p>${esc(String(n.detail||'').slice(0,80))}</p><small>${esc(n.at||'')}</small></div></div>`).join(''):'<div class="terminal-empty">Nenhum alerta recebido.</div>'}</div><button class="btn small" type="button" id="tc-mark-alerts">Marcar como lidos</button></div>`;document.body.appendChild(el);requestAnimationFrame(()=>el.classList.add('show'));el.querySelector('.tc-popup-close').onclick=()=>el.remove();el.onclick=e=>{if(e.target===el)el.remove()};el.querySelector('#tc-mark-alerts').onclick=markNotificationsRead;el.querySelectorAll('.tc-notification-item').forEach(function(it){it.style.cursor='pointer';it.title='Toque para abrir';tcSwipeToDismiss(it,function(){dismissNotification(it.getAttribute('data-id'))});it.addEventListener('click',function(){if(it.__tcDragged)return;tcNotifGo(it.getAttribute('data-id'))})})}
function tcNotifGo(id){const n=(state.notifications||[]).find(x=>String(x.id)===String(id));const panel=document.getElementById('tc-notification-panel');if(panel)panel.remove();let page='overview';if(n){const t=String(n.title||'')+' '+String(n.detail||'');const ids=String(n.id||'');if(ids.indexOf('upd-')===0||/atualiza[çc]/i.test(t))page='settings';else if(n.icon==='🚨'||/emerg[eê]nc|sos/i.test(t))page='map';else if(/offline|online|bateria|dispositivo|localiza|gps/i.test(t))page='status';}try{if(typeof go==='function')go(page);}catch(_){}}

async function boot(){try{if(window.TC_DB_READY) await window.TC_DB_READY;}catch(e){console.warn('Database initialization:',e)}window.TC_DB=window.TC_DB||{enabled:false,user:null,client:null};const demo=sessionStorage.getItem('tc_demo')==='1';const recoveryHash=/#.*(?:type=recovery|access_token=)/i.test(location.hash);if(window.TC_DB.user||demo){state.authenticated=!recoveryHash;state.authMode=recoveryHash?'recoverUpdate':'login';if(window.TC_DB.user&&window.TC_DB.enabled){try{state.profile=await tcProfile();state.devices=await tcDevices();applyActiveOrder();const dbEvents=await tcLoadEvents();if(dbEvents.length){state.events=dbEvents;save()}try{if(window.__tcGuardianRealtimeChannel&&window.TC_DB.client?.removeChannel)await window.TC_DB.client.removeChannel(window.__tcGuardianRealtimeChannel)}catch(_){}window.__tcGuardianRealtimeChannel=await tcRealtime(handleRealtimeEvent,handleDeviceUpdate);state.realtime=true}catch(e){console.warn('Backend:',e.message)}
    // Supabase como fonte de verdade: carrega planos, a subscrição da conta e o perfil.
    try{ if(window.tcLoadPlans){const plans=await window.tcLoadPlans();if(Array.isArray(plans)&&plans.length)adminSavePlans(plans);} }catch(e){console.warn('Planos:',e.message);}
    try{ if(window.tcMySubscription){const sub=await window.tcMySubscription();if(sub&&sub.plan){localStorage.setItem(userPlanKey(),JSON.stringify({plan:sub.plan,days:sub.days,paidAt:sub.paidAt}));} } }catch(e){console.warn('Subscrição:',e.message);}
    try{ if(window.tcLoadMyProfile){const prof=await window.tcLoadMyProfile();if(prof&&(prof.name||prof.photo)){const cur=loadProfile();if(prof.name)cur.name=prof.name;if(prof.photo)cur.photo=prof.photo;saveProfile(cur);} } }catch(e){console.warn('Perfil:',e.message);}
    if(isSuperAdmin()){let ok=false;try{ if(window.tcAdminListUsers){const all=await window.tcAdminListUsers();if(Array.isArray(all)){adminSaveUsers(all);ok=true;}} }catch(e){console.warn('Lista de contas:',e.message);} if(!ok){try{ if(window.tcLoadSubscriptions){const subs=await window.tcLoadSubscriptions();if(Array.isArray(subs)&&subs.length)adminSaveUsers(subs);} }catch(e){console.warn('Subscrições admin:',e.message);}}}
  }}render()}
function normalizeEvent(x){return {id:x.id||crypto.randomUUID?.()||String(Date.now()),type:x.type||'EVENTO',detail:x.detail||'',at:x.at||new Date().toLocaleString('pt-PT'),status:x.status||'CONCLUÍDO',contact:x.contact||'',source:x.source||'Child Android',severity:x.severity||'info'}}
function showMetricPopup(kind){
  const d=state.devices[0]||{};
  const online=isDeviceOnline(d);
  // Offline: não mostrar a percentagem antiga; a bateria só é fiável com o dispositivo ligado.
  const battery=(!online||d.battery==null)?null:Number(d.battery);
  const sos=state.events.filter(e=>e.type==='SOS');
  const old=document.getElementById('tc-metric-popup');
  if(old) old.remove();
  let title='',body='',icon='';
  if(kind==='alert'){
    title='Alertas'; icon='🔔';
    const alerts=state.events.filter(isAlertEvent);
    const a0=alerts[0];
    body=alerts.length?`<b>${alerts.length} alerta${alerts.length===1?'':'s'}</b><small>${esc((a0?.detail||'Requer atenção no dispositivo.')).slice(0,90)} · ${esc(alertName(a0||{}))}</small>`:'<b>Nenhum alerta ativo</b><small>O sino mostra apenas emergências e eventos críticos reais.</small>';
  }else if(kind==='battery'){
    title='Bateria'; icon='🔋';
    const pct=battery==null?null:Math.max(0,Math.min(100,battery));
    body=pct==null?'<b>Sem dados</b><small>Aguardando informação real do dispositivo Child.</small>':`<div class="popup-battery"><i style="width:${pct}%"></i></div><b class="popup-battery-percent">${pct}%</b><small>${pct<=20?'Bateria baixa':pct<=50?'Bateria moderada':'Bateria normal'} · valor real recebido do dispositivo</small>`;
  }else{
    title='Conexão'; icon=online?'🟢':'⚫';
    body=online?'<b>ONLINE</b><small>O dispositivo está ligado e conectado.</small>':'<b>OFFLINE</b><small>O dispositivo não está conectado neste momento.</small>';
  }
  const el=document.createElement('div');
  el.id='tc-metric-popup';
  el.className='tc-metric-popup';
  el.innerHTML=`<div class="tc-metric-popup-card" role="status" aria-live="polite"><div class="tc-popup-head"><span class="tc-popup-icon">${icon}</span><div><b>${title}</b><small>T CONNECT</small></div><button type="button" class="tc-popup-close" aria-label="Fechar">×</button></div><div class="tc-popup-body">${body}</div><button type="button" class="tc-popup-gear" aria-label="Abrir definições" title="Definições">⚙</button></div>`;
  document.body.appendChild(el);
  requestAnimationFrame(()=>el.classList.add('show'));
  const close=()=>{el.classList.remove('show');setTimeout(()=>el.remove(),180)};
  el.querySelector('.tc-popup-close').addEventListener('click',close);
  el.addEventListener('click',e=>{if(e.target===el)close()});
  el.querySelector('.tc-popup-gear').addEventListener('click',()=>{close();go('settings')});
  setTimeout(()=>{if(document.getElementById('tc-metric-popup')===el)close()},4500);
}

function ensureEmergencySpeaker(){
  let el=document.getElementById('tc-emergency-speaker');
  if(el)return el;
  el=document.createElement('button');el.id='tc-emergency-speaker';el.type='button';el.className='tc-emergency-speaker';el.setAttribute('aria-label','Alerta de emergência recebido');
  el.innerHTML='<span class="tc-es-icon">🔊</span><span class="tc-es-copy"><b>EMERGÊNCIA</b><small>Alerta recebido da Criança</small></span><span class="tc-es-waves"><i></i><i></i><i></i></span>';
  el.onclick=()=>{tcEmergencyAlarm();el.classList.remove('tc-es-replay');void el.offsetWidth;el.classList.add('tc-es-replay');};
  document.body.appendChild(el);return el;
}
function playAlertSound(force=false){try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;const c=window.__tcAlertAudioContext||new AC();window.__tcAlertAudioContext=c;if(c.state==='suspended')c.resume().catch(()=>{});const now=c.currentTime+0.02;const master=c.createGain();master.gain.setValueAtTime(.0001,now);master.gain.linearRampToValueAtTime(.20,now+.025);master.gain.exponentialRampToValueAtTime(.0001,now+.72);master.connect(c.destination);const notes=[880,1174.66,1567.98,1174.66,1760];notes.forEach((freq,i)=>{const o=c.createOscillator();const g=c.createGain();const t=now+i*.13;o.type=i%2?'triangle':'sine';o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.7,t+.018);g.gain.exponentialRampToValueAtTime(.0001,t+.105);o.connect(g).connect(master);o.start(t);o.stop(t+.12)});setTimeout(()=>{try{master.disconnect()}catch(e){}},1100)}catch(e){console.debug('Som de alerta indisponível',e)}}
function triggerEmergencyFeedback(){
  const el=ensureEmergencySpeaker();el.classList.remove('tc-es-replay');void el.offsetWidth;el.classList.add('tc-es-active');
  tcVibrate([0,600,160,600,160,600,160,1100]);
  tcEmergencyAlarm();
  if('Notification' in window && Notification.permission==='granted'){try{new Notification('T Connect — EMERGÊNCIA',{body:'A Criança acionou o botão de emergência.',tag:'tc-emergency',silent:false})}catch(e){}}
  clearTimeout(window.__tcEmergencyFeedbackTimer);window.__tcEmergencyFeedbackTimer=setTimeout(()=>el.classList.remove('tc-es-active'),6500);
}
function maybeAlertSound(ev){if(String(ev.type||'').toUpperCase()==='SOS' || String(ev.severity||'').toLowerCase()==='critical'){triggerEmergencyFeedback()}}
function handleRealtimeEvent(x){const ev=normalizeEvent({id:x.id,type:x.type,detail:x.detail,at:new Date(x.occurred_at).toLocaleString('pt-PT'),status:x.status,contact:x.contact,source:x.source,severity:x.severity,child_name:x.child_name});state.events.unshift(ev);state.events=state.events.slice(0,200);addNotification(ev);render();maybeAlertSound(ev)}
function handleDeviceUpdate(d){
  const i=state.devices.findIndex(x=>x.id===d.id);
  const previous=i>=0?state.devices[i]:null;
  if(i>=0)state.devices[i]={...state.devices[i],...d};else state.devices.unshift(d);applyActiveOrder();
  const _activeUpd=isActiveDev(d.id);
  if(_activeUpd){try{window.TC_DEVICE_INFO={name:d.device_name||(previous&&previous.device_name)||'Child',battery:d.battery,status:d.status,lastSeen:d.last_seen_at};if(d.device_name)window.TC_DEVICE_NAME=d.device_name;if(window.TC_MAP_SCIFI&&window.TC_MAP_SCIFI.updatePanel)window.TC_MAP_SCIFI.updatePanel();}catch(_){}}
  if(previous && previous.status!==d.status && (d.status==='online'||d.status==='offline')){
    const ev=normalizeEvent({id:`status-${d.id}-${d.status}-${Date.now()}`,type:d.status.toUpperCase(),detail:`${d.device_name||'Child'} ficou ${d.status==='online'?'online':'offline'}`,status:'INFORMADO',source:'Child Android',severity:'info',child_name:d.device_name});
    state.events.unshift(ev);state.events=state.events.slice(0,200);addNotification(ev);if(d.status==='online')playAlertSound();
  }
  const lat=Number(d?.last_lat), lng=Number(d?.last_lng);
  if(_activeUpd && Number.isFinite(lat) && Number.isFinite(lng)){
    state.lastLocation={lat,lng,accuracy:Number(d?.accuracy_m)||60};
  }
  render();
  if(_activeUpd && Number.isFinite(lat) && Number.isFinite(lng)){
    setTimeout(()=>{
      if(window.TC_MAP) window.TC_MAP.setLocation(lat,lng,Number(d?.accuracy_m)||60,true);
    },90);
  }
}
async function refreshDevices(){if(window.TC_DB.enabled&&window.TC_DB.user){try{state.devices=await tcDevices();applyActiveOrder()}catch(e){console.warn(e)}}render()}
// ---- Troca de pessoa/dispositivo (quando há vários vinculados) ----
function activeDevId(){return state.activeDeviceId||(state.devices&&state.devices[0]&&state.devices[0].id)||null}
function isActiveDev(id){return !!id&&id===activeDevId()}
function applyActiveOrder(){
  if(!state.activeDeviceId||!Array.isArray(state.devices))return;
  const i=state.devices.findIndex(d=>d.id===state.activeDeviceId);
  if(i>0){const d=state.devices.splice(i,1)[0];state.devices.unshift(d)}
}
function selectDevice(id){
  if(!id)return;
  state.activeDeviceId=id;applyActiveOrder();
  const d=state.devices[0];
  try{window.TC_DEVICE_INFO={name:(d&&d.device_name)||'Child',battery:d&&d.battery,status:d&&d.status,lastSeen:d&&d.last_seen_at};if(d&&d.device_name)window.TC_DEVICE_NAME=d.device_name}catch(_){}
  render();
  try{if(window.TC_MAP&&TC_MAP.clearContactPoints)TC_MAP.clearContactPoints()}catch(_){}
  try{loadMessages();loadCalls();loadContacts();loadApps()}catch(_){}
  try{if(d&&d.last_lat!=null&&window.TC_MAP&&TC_MAP.setLocation)TC_MAP.setLocation(d.last_lat,d.last_lng,Number(d.accuracy_m)||60,true)}catch(_){}
}
window.selectDevice=selectDevice;
function toggleDeviceSwitcher(){state.deviceSwitcherOpen=!state.deviceSwitcherOpen;render()}
window.toggleDeviceSwitcher=toggleDeviceSwitcher;
// Desvincular a pessoa: remove todos os registos do mesmo aparelho (mesmo nome) desta conta.
async function unlinkPerson(id,childId,name){
  if(!window.TC_DB?.enabled||!window.TC_DB.client){alert('Serviço indisponível.');return}
  if(!confirm('Desvincular "'+(name||'este dispositivo')+'"? Os dados associados serão removidos deste Guardian.'))return;
  try{
    let q=window.TC_DB.client.from('devices').delete();
    if(childId&&String(childId).trim())q=q.eq('child_id',String(childId).trim());
    else if(name&&String(name).trim())q=q.ilike('device_name',String(name).trim());
    else q=q.eq('id',id);
    const {error}=await q;
    if(error)throw error;
    if(state.activeDeviceId===id)state.activeDeviceId=null;
    try{state.devices=await tcDevices()}catch(_){state.devices=(state.devices||[]).filter(x=>x.id!==id)}
    applyActiveOrder();
    if(!state.devices.length)state.deviceSwitcherOpen=false;
    try{addEvent('VINCULAÇÃO','Dispositivo desvinculado: '+(name||''),{status:'CONCLUÍDO',source:'Guardian'})}catch(_){}
    render();
    try{loadMessages&&loadMessages();loadCalls&&loadCalls()}catch(_){}
  }catch(e){alert('Não foi possível desvincular: '+(e.message||'erro'))}
}
window.unlinkPerson=unlinkPerson;
// Clicar em qualquer canto do ecrã (fora da engrenagem) fecha a lista.
if(!window.__tcSwitchAway){window.__tcSwitchAway=1;document.addEventListener('click',function(e){
  try{if(!state.deviceSwitcherOpen)return;const t=e.target;if(t&&t.closest&&t.closest('.dev-switch'))return;state.deviceSwitcherOpen=false;render();}catch(_){}
},true);}
// Uma pessoa/dispositivo = UMA entrada. O mesmo aparelho (mesmo nome), ainda que
// tenha sido vinculado várias vezes, mostra-se uma única vez; fica online se
// qualquer das ligações estiver online. Só nomes diferentes geram entradas diferentes.
function tcSwitchKey(d){return (d&&d.child_id)||(d&&d.device_code)||(String(d&&d.device_name||'').trim().toLowerCase())||(d&&d.id)}
function tcSwitchPeople(){
  const ds=state.devices||[];const seen=new Map();
  for(const d of ds){
    const key=tcSwitchKey(d);
    const prev=seen.get(key);
    if(!prev){seen.set(key,d);continue}
    const better=(isDeviceOnline(d)&&!isDeviceOnline(prev))||(String(d.last_seen_at||'')>String(prev.last_seen_at||''));
    if(better)seen.set(key,d);
  }
  return [...seen.values()];
}
function tcAndroidMark(){return `<svg class="andbot" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10.6h10V17a1 1 0 0 1-1 1h-1v2.3a1.05 1.05 0 0 1-2.1 0V18h-1.8v2.3a1.05 1.05 0 0 1-2.1 0V18H8a1 1 0 0 1-1-1v-6.4Z"/><rect x="4.2" y="10.5" width="2" height="6" rx="1"/><rect x="17.8" y="10.5" width="2" height="6" rx="1"/><path d="M7 9.6a5 5 0 0 1 10 0Z"/><path d="m8.4 6.4-1-1.5M15.6 6.4l1-1.5"/><circle class="andeye" cx="9.8" cy="7.7" r=".62"/><circle class="andeye" cx="14.2" cy="7.7" r=".62"/></svg>`}
function deviceSwitcher(){
  const people=tcSwitchPeople();const active=(state.devices||[])[0];
  const activeKey=active?tcSwitchKey(active):null;
  const curName=active?esc(active.device_name||'Child'):'Sem pessoa';
  return `<div class="dev-switch">
    <button class="dev-switch-btn" onclick="toggleDeviceSwitcher()" aria-label="Trocar de pessoa" aria-expanded="${state.deviceSwitcherOpen?'true':'false'}">
      <span class="dev-switch-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/></svg></span>
      <span class="dev-switch-name">${curName}</span>
      <span class="dev-switch-count">${people.length}</span>
    </button>
    ${state.deviceSwitcherOpen?`<div class="dev-switch-pop"><div class="dev-switch-head">Pessoas conectadas <b>${people.length}</b></div><div class="dev-switch-list">${people.length?people.map(d=>{const on=isDeviceOnline(d);const act=tcSwitchKey(d)===activeKey;const nm=esc(d.device_name||'Child');return `<div class="dev-switch-item${act?' on':''}"><button class="dev-switch-pick" onclick="selectDevice('${esc(d.id)}')"><span class="dev-switch-av">${tcAndroidMark()}</span><div class="dev-switch-meta"><b>${nm}</b><small><i class="dev-dot${on?' on':''}"></i>Android · ${on?'Online':'Offline'}</small></div>${act?'<span class="dev-switch-chk">✓</span>':''}</button>${act?`<button class="dev-switch-unlink" onclick="unlinkPerson('${esc(d.id)}','${esc(String(d.child_id||''))}','${nm.replace(/'/g,"\\'")}')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 12h6M8.5 8.5 6 11a3.5 3.5 0 0 0 5 5l1.2-1.2M15.5 15.5 18 13a3.5 3.5 0 0 0-5-5l-1.2 1.2"/><path d="m4 4 16 16"/></svg>Desvincular</button>`:''}</div>`}).join(''):'<div class="dev-switch-none">Nenhuma pessoa vinculada ainda.</div>'}</div></div>`:''}
  </div>`;
}
async function addEvent(type,detail,meta={}){const ev=normalizeEvent({type,detail,at:new Date().toLocaleString('pt-PT'),status:meta.status||'CONCLUÍDO',contact:meta.contact||'',source:meta.source||'Guardian',severity:meta.severity||'info',child_name:meta.child_name});state.events.unshift(ev);state.events=state.events.slice(0,200);addNotification(ev);save();render();maybeAlertSound(ev);try{await tcInsertEvent(ev)}catch(e){console.warn('Evento não sincronizado:',e.message)}}
function contactLabel(i=0){const c=contacts.length?contacts[i%contacts.length]:null;return c?`${c.name} · ${c.number}`:''}
function openCommunicationPrompt(kind){
  tcEnsureGroupStyles();
  const isMsg=kind==='message-received'||kind==='message-sent';
  const received=kind==='message-received';
  const isRecvCall=kind==='call-received';
  const title=isMsg?(received?'Mensagens recebidas':'Mensagens enviadas'):(isRecvCall?'Chamadas recebidas':'Chamadas efetuadas');
  let groups,total;
  if(isMsg){
    if(!state.messages||!state.messages.length){try{loadMessages()}catch(_){}}
    // Mensagens recebidas = SMS recebidas + TODAS as mensagens das redes sociais/apps
    // (sobem automaticamente para aqui). Enviadas: só SMS (as apps só captam recebidas).
    const list=received
      ? (state.messages||[]).filter(m=>!m.deleted&&String(m.direction)!=='ENVIADA')
      : (state.messages||[]).filter(m=>!m.deleted&&tcIsSms(m)&&String(m.direction)==='ENVIADA');
    groups=tcCommGroups(list,m=>tcIsSms(m)?m.address:(tcMsgApp(m)+' · '+(m.address||'—')),m=>tcIsSms(m)?'':(tcImAppName(tcMsgApp(m))+' · '+(m.address||'—')),tcMsgTime);total=list.length;
  }else{
    if(!state.calls||!state.calls.length){try{loadCalls()}catch(_){}}
    const list=(state.calls||[]).filter(c=>isRecvCall?String(c.direction)!=='EFETUADA':String(c.direction)==='EFETUADA');
    groups=tcCommGroups(list,c=>c.number,c=>c.name,tcCallTime);total=list.length;
  }
  const old=document.getElementById('tc-communication-prompt');if(old)old.remove();
  const el=document.createElement('div');el.id='tc-communication-prompt';el.className='tc-popup-layer';
  el.innerHTML=`<div class="tc-popup-card communication-prompt" role="dialog" aria-label="${esc(title)}"><div class="tc-popup-head"><div><span class="section-kicker">${esc(title.toUpperCase())}</span><h3>${esc(title)} <span class="comm-count" style="margin-left:6px">${groups.length} contacto${groups.length===1?'':'s'}</span></h3></div><button class="tc-popup-close" type="button" aria-label="Fechar">×</button></div><div class="communication-list" style="max-height:56vh;overflow:auto">${tcRenderGroups(groups,isMsg)}</div><div class="tc-popup-prompt"><span>${esc(title)}</span><b>${total} registo${total===1?'':'s'}</b></div></div>`;
  document.body.appendChild(el);requestAnimationFrame(()=>el.classList.add('show'));el.querySelector('.tc-popup-close').onclick=()=>el.remove();el.onclick=e=>{if(e.target===el)el.remove()};
}
async function recoverPassword(e){
  e.preventDefault();
  if(state.loading)return;
  const fd=new FormData(e.target);
  const email=String(fd.get('email')||'').trim();
  state.loading=true; state.authError=''; state.recoverySent=false; render();
  try{
    if(!window.TC_DB.enabled) throw new Error('Configure o Supabase para ativar a recuperação de senha.');
    const {error}=await tcResetPasswordForEmail(email);
    if(error)throw error;
    state.loading=false; state.recoverySent=true; render();
  }catch(err){
    state.loading=false; state.authError=err?.message||'Não foi possível iniciar a recuperação da senha.'; render();
  }
}
async function updateRecoveredPassword(e){
  e.preventDefault();
  if(state.loading)return;
  const fd=new FormData(e.target);
  const password=String(fd.get('password')||'');
  const confirm=String(fd.get('confirmPassword')||'');
  if(password.length<8){state.authError='A senha deve ter pelo menos 8 caracteres.';render();return;}
  if(password!==confirm){state.authError='As senhas não coincidem.';render();return;}
  state.loading=true; state.authError=''; render();
  try{
    if(!window.TC_DB.enabled) throw new Error('Configure o Supabase para redefinir a senha.');
    const {error}=await tcUpdatePassword(password);
    if(error)throw error;
    await tcSignOut();
    history.replaceState({},document.title,location.pathname);
    state.loading=false; state.recoverySent=false; state.authMode='login'; state.authenticated=false;
    state.authError='Senha redefinida com sucesso. Agora entre com a nova senha.'; render();
  }catch(err){state.loading=false;state.authError=err?.message||'Não foi possível redefinir a senha.';render();}
}
// Redefinição simples de senha: e-mail + nova senha + confirmar (sem passo de e-mail).
async function resetPasswordDirect(e){
  e.preventDefault();
  if(state.loading)return;
  const fd=new FormData(e.target);
  const email=String(fd.get('email')||'').trim();
  const password=String(fd.get('password')||'');
  const confirm=String(fd.get('confirmPassword')||'');
  if(!email){state.authError='Escreva o seu e-mail.';render();return;}
  if(password.length<8){state.authError='A nova senha deve ter pelo menos 8 caracteres.';render();return;}
  if(password!==confirm){state.authError='As senhas não coincidem.';render();return;}
  state.loading=true; state.authError=''; state.recoverySent=false; render();
  try{
    if(!window.TC_DB.enabled) throw new Error('Configure o Supabase para redefinir a senha.');
    if(!window.tcResetPasswordDirect) throw new Error('Função de redefinição indisponível. Atualize a aplicação.');
    const {data,error}=await window.tcResetPasswordDirect(email,password);
    if(error)throw error;
    if(data===false) throw new Error('Não existe nenhuma conta com esse e-mail.');
    state.loading=false; state.recoverySent=true; state.authMode='login';
    state.authError='Senha redefinida com sucesso. Agora entre com a nova senha.'; render();
  }catch(err){
    const m=String(err?.message||'');
    state.loading=false;
    state.authError=/function .*does not exist|PGRST202|guardian_reset_password/i.test(m)
      ? 'A redefinição de senha ainda não está instalada no Supabase. Execute o ficheiro migration-reset-password.sql.'
      : (m||'Não foi possível redefinir a senha.');
    render();
  }
}
window.resetPasswordDirect=resetPasswordDirect;
async function login(e){e.preventDefault();if(state.loading)return;const fd=new FormData(e.target);state.loading=true;state.authError='';render();try{if(window.TC_DB.enabled){const result=await tcSignIn(String(fd.get('email')||'').trim(),String(fd.get('password')||''));if(result?.error)throw result.error;window.TC_DB.user=result?.data?.user||result?.data?.session?.user||window.TC_DB.user;state.authenticated=!!window.TC_DB.user;if(!state.authenticated)throw new Error('A sessão não foi criada. Tente entrar novamente.');state.loading=false;await addEvent('AUTENTICAÇÃO','Sessão iniciada',{source:'Supabase Auth',status:'AUTORIZADO'});await boot();showPreparationThenContinue();if(state.update.auto){checkForUpdates(true);setTimeout(autoUpdateIfNeeded,800)}}else{state.authenticated=true;sessionStorage.setItem('tc_demo','1');state.loading=false;await addEvent('AUTENTICAÇÃO','Sessão local de demonstração',{source:'Demo',status:'TESTE'});render();showPreparationThenContinue()}}catch(err){state.loading=false;state.authError=err?.message||t('login')+' — erro';render()}}
function tcPwdStrength(v){v=String(v||'');let sc=0;if(v.length>=8)sc++;if(v.length>=12)sc++;if(/[a-z]/.test(v)&&/[A-Z]/.test(v))sc++;if(/[0-9]/.test(v))sc++;if(/[^A-Za-z0-9]/.test(v))sc++;const m=document.getElementById('tc-pwd-meter');if(!m)return;const bar=m.querySelector('.tc-pwd-bar i'),lab=m.querySelector('.tc-pwd-label');let pct,color,txt;if(!v){pct=0;color='#22364a';txt='';}else if(sc<=1){pct=25;color='#ef4444';txt='Senha fraca';}else if(sc===2){pct=50;color='#f59e0b';txt='Senha média';}else if(sc===3){pct=75;color='#eab308';txt='Senha boa';}else{pct=100;color='#22c55e';txt='Senha forte';}if(bar){bar.style.width=pct+'%';bar.style.background=color;}if(lab){lab.textContent=txt;lab.style.color=color;}}
function tcPwdMatch(v){const p=document.getElementById('tc-signup-pwd');const el=document.getElementById('tc-pwd-match');if(!p||!el)return;if(!v){el.textContent='';return;}if(v===p.value){el.textContent='✓ As senhas coincidem';el.style.color='#22c55e';}else{el.textContent='✗ As senhas não coincidem';el.style.color='#ef4444';}}
window.tcPwdStrength=tcPwdStrength;window.tcPwdMatch=tcPwdMatch;
async function signup(e){
  e.preventDefault();
  if(state.loading)return;
  const fd=new FormData(e.target);
  const email=String(fd.get('email')||'').trim();
  const password=String(fd.get('password')||'');
  const name=String(fd.get('name')||'').trim();
  const confirm=String(fd.get('confirmPassword')||'');
  state.authError='';
  if(!window.TC_DB.enabled){state.authError='Configure o Supabase em guardian/js/supabase-config.js antes de criar contas reais.';render();return;}
  if(password!==confirm){state.authError='As senhas não coincidem.';render();return;}
  if(password.length<8){state.authError='A senha deve ter pelo menos 8 caracteres.';render();return;}
  // Guarda os dados e mostra os Termos e Condições ANTES de criar a conta.
  // A conta só é criada se a pessoa aceitar e prosseguir.
  state.pendingSignup={email,password,name};
  state.authMode='terms';
  render();
}
// Depois de aceitar os Termos: cria mesmo a conta e entra.
async function acceptTermsAndSignup(){
  const ps=state.pendingSignup;
  if(!ps){state.authMode='signup';render();return;}
  if(state.loading)return;
  state.loading=true; state.authError=''; render();
  try{
    const {data,error}=await tcSignUp(ps.email,ps.password,ps.name);
    if(error)throw error;
    if(!data?.session){
      const signed=await tcSignIn(ps.email,ps.password);
      if(signed.error){
        if(/not confirmed|confirm/i.test(signed.error.message||''))throw new Error('A confirmação de email está ativada no Supabase. Desative-a em Authentication → Providers → Email (opção "Confirm email") para criar contas sem confirmação.');
        throw signed.error;
      }
    }
    try{localStorage.setItem('tc_terms_accepted','1')}catch(_){}
    state.pendingSignup=null;
    state.authenticated=true;
    state.authMode='login';
    state.loading=false;
    location.reload();
  }catch(err){
    state.loading=false;
    state.authError=err?.message||'Falha no cadastro';
    state.authMode='signup';
    render();
  }
}
window.acceptTermsAndSignup=acceptTermsAndSignup;
function declineTerms(){
  state.pendingSignup=null;
  state.authMode='signup';
  state.authError='Para criar a conta é necessário ler e aceitar os Termos e Condições.';
  render();
}
window.declineTerms=declineTerms;
// Texto dos Termos e Condições mostrado depois de "Criar conta", antes de prosseguir.
function tcTermsHtml(){
  return `
  <h3>1. O que é o T-Connect Guardian</h3>
  <p>O T-Connect Guardian é uma ferramenta de <b>segurança familiar</b> que permite a um responsável (pai, mãe ou tutor legal) acompanhar o dispositivo de uma criança sob a sua responsabilidade. Não é um serviço para vigiar adultos nem terceiros sem o seu conhecimento.</p>
  <h3>2. Vínculo e consentimento</h3>
  <p>O acompanhamento só funciona depois de o aparelho da criança ser <b>vinculado</b> através de um código, QR ou link gerado por si, e de as permissões serem <b>aceites no próprio aparelho da criança</b>. Deve informar a criança, de forma adequada à idade, de que o dispositivo é acompanhado.</p>
  <h3>3. Dados que podem ser recolhidos</h3>
  <p>Conforme as permissões concedidas no aparelho da criança, o Guardian pode mostrar: <b>localização</b>, <b>mensagens (SMS)</b>, <b>chamadas</b>, <b>contactos</b>, <b>aplicações instaladas e uso</b>, <b>nível de bateria</b> e, só com autorização explícita da criança no momento, <b>câmera e áudio ao vivo</b>. Os dados servem apenas para a segurança da criança.</p>
  <h3>4. Onde ficam os dados</h3>
  <p>Os dados são guardados na conta de serviço (Supabase) associada ao Guardian e usados apenas para apresentar a informação a si. É responsável por manter a sua senha segura e por usar a aplicação de acordo com a lei aplicável em Moçambique e no seu país.</p>
  <h3>5. Uso responsável e legal</h3>
  <p>Compromete-se a usar o T-Connect apenas para proteger uma criança sob a sua tutela legal. Qualquer uso para perseguir, monitorizar ou aceder ao dispositivo de outra pessoa sem autorização é <b>proibido</b> e da sua inteira responsabilidade.</p>
  <h3>6. Planos e pagamentos</h3>
  <p>Há um período <b>Grátis de 7 dias</b> com acesso total e planos pagos (Familiar, Premium, Anual). Sem um plano ativo não é possível usar a aplicação. Os pagamentos são processados pelos métodos indicados (M-Pesa, e-Mola, cartão).</p>
  <h3>7. Suporte</h3>
  <p>Em caso de dúvida pode falar com o suporte pelo WhatsApp a partir do menu da aplicação.</p>
  <p class="terms-final">Ao tocar em <b>"Aceito e prosseguir"</b>, declara que leu, compreendeu e aceita estes Termos e Condições e que é o responsável legal pela criança a acompanhar.</p>`;
}
async function google(){
  if(state.loading)return;
  state.loading=true; state.authError=''; render();
  try{
    if(!window.TC_DB.enabled)throw new Error('Configure o Supabase para ativar o Google OAuth.');
    const result=await tcGoogle();
    if(result?.error)throw result.error;
  }catch(err){
    state.loading=false;
    const raw=String(err?.message||'');
    state.authError=/provider.*not enabled|unsupported provider/i.test(raw)
      ? 'O login com Google ainda não está ativado no Supabase. Ative Authentication → Sign In / Providers → Google e configure o OAuth antes de testar novamente.'
      : (raw||'Não foi possível iniciar o login com Google.');
    render();
  }
}
// Notificação visível de nova versão DENTRO do Guardian (sem ir a fontes externas).
// Mostra uma faixa no topo com "Atualizar agora" que baixa e instala o APK pelo próprio app.
function tcShowUpdateBanner(release){
  if(!release||!release.version) return;
  const ver=String(release.version);
  // Não repetir a mesma faixa se o utilizador a dispensou para esta versão.
  if(localStorage.getItem('tc_update_banner_dismissed')===ver) return;
  if(!document.getElementById('tc-update-banner-style')){
    const st=document.createElement('style');st.id='tc-update-banner-style';
    st.textContent='.tc-update-banner{position:fixed;left:0;right:0;top:0;z-index:9700;display:flex;align-items:center;gap:12px;padding:12px 14px calc(12px + env(safe-area-inset-top,0px));background:linear-gradient(135deg,#0ea5e9,#1677ff);color:#fff;box-shadow:0 8px 26px rgba(14,120,230,.45);font-family:system-ui,-apple-system,sans-serif;animation:tcUBin .35s ease}@keyframes tcUBin{from{transform:translateY(-100%)}to{transform:translateY(0)}}.tc-update-banner .ub-ico{font-size:22px;flex:none}.tc-update-banner .ub-main{flex:1;min-width:0}.tc-update-banner .ub-main b{display:block;font-size:14px;line-height:1.2}.tc-update-banner .ub-main small{display:block;font-size:11.5px;opacity:.92;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tc-update-banner button{flex:none;border:0;border-radius:10px;font-weight:800;cursor:pointer}.tc-update-banner .ub-go{background:#fff;color:#1366d6;padding:9px 14px;font-size:13px}.tc-update-banner .ub-x{background:rgba(255,255,255,.18);color:#fff;width:34px;height:34px;font-size:16px}';
    document.head.appendChild(st);
  }
  const old=document.getElementById('tc-update-banner'); if(old) old.remove();
  const el=document.createElement('div'); el.id='tc-update-banner'; el.className='tc-update-banner';
  el.innerHTML='<span class="ub-ico">🚀</span><div class="ub-main"><b>Nova versão v'+esc(ver)+' já foi lançada</b><small>Toque em Verificar e depois em “Atualizar aplicativo”.</small></div><button class="ub-go" id="tc-ub-go">Verificar</button><button class="ub-x" id="tc-ub-x" aria-label="Depois">×</button>';
  document.body.appendChild(el);
  const goBtn=document.getElementById('tc-ub-go'); if(goBtn) goBtn.onclick=()=>{ el.remove(); try{window.go?window.go('settings'):go('settings');}catch(_){} };
  const x=document.getElementById('tc-ub-x'); if(x) x.onclick=()=>{ try{localStorage.setItem('tc_update_banner_dismissed',ver);}catch(_){} el.remove(); };
  // Regista também na lista de notificações (sino), para ficar o registo.
  try{
    if(!state.notifications.some(n=>n.id==='upd-'+ver)){
      state.notifications.unshift({id:'upd-'+ver,title:'Atualização disponível',icon:'⬆️',name:'T-Connect',detail:'Nova versão v'+ver+' disponível. Toque em Atualizar no topo para instalar pelo próprio app.',at:new Date().toLocaleString('pt-PT'),read:false});
      state.notifications=state.notifications.slice(0,100);save();
    }
  }catch(_){}
}
async function fetchReleaseManifest(){
  const cfg=window.TC_SUPABASE||{};
  const remote=String(cfg.updateManifestUrl||'').trim();
  const urls=[];
  if(remote)urls.push(remote);
  // Fallbacks remotos fixos (caso o Pages demore): raw do GitHub com a versão carimbada.
  urls.push('https://raw.githubusercontent.com/bonifacioadelino1-lgtm/T-Connect/main/tconnect/android-native/app/src/main/assets/tc236/updates/t-connect-update.json');
  // Por último, o manifesto EMBUTIDO (só serve quando se abre pela web; no APK é a versão instalada).
  urls.push('../updates/t-connect-update.json','/updates/t-connect-update.json');
  for(const url of urls){
    try{const r=await fetch(url,{cache:'no-store'});if(r.ok)return await r.json()}catch(_){}}
  return null;
}
// Compara versões "x.y.z". >0 se a>b. Serve de base para contar a partir da versão atual.
function cmpVersion(a,b){const pa=String(a||'0').split('.').map(n=>parseInt(n,10)||0);const pb=String(b||'0').split('.').map(n=>parseInt(n,10)||0);for(let i=0;i<Math.max(pa.length,pb.length);i++){const d=(pa[i]||0)-(pb[i]||0);if(d)return d>0?1:-1}return 0}
async function checkForUpdates(silent=false){
  if(state.update.checking)return;
  state.update.checking=true; state.update.error=''; if(!silent)render();
  try{
    let release=await fetchReleaseManifest();
    if(!release && window.TC_DB?.enabled){ try{ release=await tcLatestRelease(); }catch(_){} }
    // Só conta como atualização se a versão publicada for MAIS RECENTE que a instalada
    // (as versões passam a contar a partir da atual, v${window.TC_APP_VERSION}).
    const current=window.TC_APP_VERSION||'2.39.5';
    if(release && cmpVersion(release.version, current)>0){
      state.update.latest=release;
      try{ tcShowUpdateBanner(release); }catch(_){}
    }else{
      state.update.latest=null;
      if(!silent && release) state.update.error='';
    }
  }catch(err){ state.update.error=err?.message||'Não foi possível verificar atualizações.'; }
  finally{state.update.checking=false;render();}
}
function toggleAutoUpdates(enabled){state.update.auto=!!enabled;localStorage.setItem('tc_auto_updates',state.update.auto?'1':'0');render();if(state.update.auto)checkForUpdates(true)}
async function updateAppNow(){
  const apkUrl=state.update.latest?.apk_guardian||state.update.latest?.apk_url;
  // Caminho nativo (APK): descarrega pelo próprio app, com CONTADOR de progresso,
  // e no fim o Android pede "Instalar" (a pessoa toca OK). Os dados são mantidos.
  if(window.TCNativeUpdater && window.TCNativeUpdater.installFromUrl && apkUrl){
    try{
      // Cache-busting pela versão: garante que o APK descarregado é SEMPRE o da nova
      // versão (e não uma cópia em cache antiga servida pelo GitHub/CDN). Sem isto, a
      // pessoa podia reinstalar a mesma versão e ficar "presa" na anterior.
      let url=new URL(apkUrl,location.origin).href;
      const ver=String(state.update.latest?.version||'').replace(/[^0-9.]/g,'');
      if(ver) url += (url.includes('?')?'&':'?')+'v='+encodeURIComponent(ver)+'&t='+Date.now();
      state.update.downloading=true; state.update.progress={status:'pending',percent:0,downloaded:0,total:0}; state.update.error='';
      render();
      const result=String(window.TCNativeUpdater.installFromUrl(url)||'');
      if(result==='STARTED'||result==='STARTED_NEED_PERMISSION'){
        if(result==='STARTED_NEED_PERMISSION') state.update.error='Ative "Instalar apps desconhecidas" para o T-Connect (abriu nas definições) e volte — o download continua.';
        tcPollUpdateProgress();
      }else{
        state.update.downloading=false; state.update.error='Não foi possível iniciar a atualização: '+result; render();
      }
    }catch(err){ state.update.downloading=false; state.update.error=err?.message||'Não foi possível atualizar agora.'; render(); }
    return;
  }
  // Caminho web/PWA (sem ponte nativa): atualiza o service worker ou abre a versão.
  state.update.checking=true; state.update.error=''; render();
  try{
    const release=await fetchReleaseManifest();
    if('serviceWorker' in navigator){
      const reg=await navigator.serviceWorker.getRegistration('../');
      if(reg){ await tcTimeout(reg.update(),8000); if(reg.waiting){ reg.waiting.postMessage({type:'SKIP_WAITING'}); } }
    }
    if(release) state.update.latest=release;
    if(state.update.latest?.download_url){ openRelease(state.update.latest); }
    else if(document.getElementById('pwa-update-status')) document.getElementById('pwa-update-status').textContent='O T-Connect já está na versão disponível mais recente.';
  }catch(err){ state.update.error=err?.message||'Não foi possível atualizar agora.'; }
  finally{state.update.checking=false;render();}
}
// Contador de download dentro do app: faz polling ao progresso nativo e atualiza só
// a barra (#tc-upd-progress), sem re-render completo, para ficar suave.
function tcUpdProgressInner(){
  const p=state.update.progress||{};
  const pct=(p.percent!=null&&p.percent>=0)?p.percent:null;
  const mb=b=>(b>0?(b/1048576).toFixed(1)+' MB':'');
  let label;
  if(p.status==='done') label='✓ Transferência concluída — confirme "Instalar" (os seus dados são mantidos).';
  else if(p.status==='failed') label='A transferência falhou. Tente novamente.';
  else if(p.status==='paused') label='Transferência em pausa…';
  else label='A descarregar atualização… '+(pct!=null?pct+'%':'')+(p.total>0?(' · '+mb(p.downloaded)+' / '+mb(p.total)):'');
  const w=(pct!=null?pct:(p.status==='done'?100:8));
  const installBtn=(p.status==='done')?`<button class="btn primary wide" style="margin-top:10px" onclick="tcLaunchInstaller()">📲 Instalar agora</button>`:'';
  return `<div class="upd-prog-bar ${p.status==='done'?'is-done':''}"><i style="width:${w}%"></i></div><div class="upd-prog-label">${esc(label)}</div>${installBtn}`;
}
function tcRenderUpdateProgress(){ const host=document.getElementById('tc-upd-progress'); if(host) host.innerHTML=tcUpdProgressInner(); }
function tcPollUpdateProgress(){
  if(!window.TCNativeUpdater||!window.TCNativeUpdater.getDownloadProgress) return;
  if(window.__tcUpdProgTimer){ clearInterval(window.__tcUpdProgTimer); window.__tcUpdProgTimer=null; }
  const tick=()=>{
    let p={}; try{ p=JSON.parse(window.TCNativeUpdater.getDownloadProgress()||'{}')||{}; }catch(_){ p={}; }
    state.update.progress=p; tcRenderUpdateProgress();
    if(p.status==='done'||p.status==='failed'){
      clearInterval(window.__tcUpdProgTimer); window.__tcUpdProgTimer=null;
      state.update.downloading=false;
      if(p.status==='done'){
        // Transferência concluída: abre JÁ o instalador do Android (ecrã "Instalar?").
        const r=tcLaunchInstaller();
        state.update.error = (r==='NEED_PERMISSION')
          ? 'Ative "Instalar apps desconhecidas" para o T-Connect (abriu nas definições) e depois toque em "Instalar agora".'
          : 'Transferência concluída. Confirme "Instalar" no ecrã do Android — os seus dados são mantidos.';
      } else {
        state.update.error='A transferência falhou. Toque em "Atualizar aplicativo" para tentar de novo.';
      }
      setTimeout(()=>{try{render()}catch(_){}} ,700);
    }
  };
  window.__tcUpdProgTimer=setInterval(tick,600); tick();
}
// Abre o instalador do Android para o APK já descarregado. Devolve o resultado nativo.
function tcLaunchInstaller(){
  try{ if(window.TCNativeUpdater&&window.TCNativeUpdater.installDownloaded){ return String(window.TCNativeUpdater.installDownloaded()||''); } }catch(_){}
  return '';
}
window.tcLaunchInstaller=tcLaunchInstaller;
window.updateAppNow=updateAppNow; window.tcPollUpdateProgress=tcPollUpdateProgress;
async function tcCheckAndUpdate(){if(state.update.checking)return;await checkForUpdates(false);if(state.update.latest){await updateAppNow()}}
function openRelease(release){const u=release?.apk_url||release?.download_url;if(u)openExternal(u)}
// Notas de versão (novidades) mostradas nas Definições → Atualizações.
const TC_CHANGELOG={
  '2.39.91':{changes:[
    'Barra Mensagens/Chamadas/Lixo so dentro de Redes sociais (removida dos Contactos)',
    'Mensagens normais (ex.: Emola, bancos, servicos) sobem automaticamente para "Mensagens recebidas"',
    'So as redes sociais reconhecidas (WhatsApp, Messenger, Telegram…) ficam no painel Redes sociais'
  ]},
  '2.39.89':{changes:[
    'A barra Mensagens/Chamadas/Lixo passou a aparecer tambem DENTRO de Redes sociais',
    'A aba da pagina atual fica oculta na barra (sem botao repetido)'
  ]},
  '2.39.88':{changes:[
    'Nova aba "Redes sociais" junto a Mensagens, Chamadas e Lixo (barra de baixo)',
    'Apps nao reconhecidas (ex.: Emola) mostram o seu nome e um icone de mensagem normal — ja nao viram WhatsApp'
  ]},
  '2.39.87':{changes:[
    'Icone/nome correto por app mesmo sem a migracao SQL: lê a app real do proprio registo',
    'Messenger mostra o icone do Messenger, Telegram o do Telegram, etc. — ja nao fica tudo WhatsApp'
  ]},
  '2.39.86':{changes:[
    'Aba renomeada para "Redes sociais" com icone proprio',
    'Cada conversa mostra o ICONE real da app (WhatsApp, Messenger, Telegram, Instagram, Signal…) e o nome correto',
    'Deixa de aparecer "WhatsApp" quando a mensagem e de outra app'
  ]},
  '2.39.85':{changes:[
    'Correcao do arranque automatico: a app da crianca entra em segundo plano sozinha apos reiniciar o telefone',
    'O servico passa a arrancar como "specialUse", que o Android deixa iniciar no arranque sem a app ser aberta'
  ]},
  '2.39.84':{changes:[
    'Mensagens de TODAS as apps (WhatsApp, Messenger, Telegram, Instagram, Signal…), nao so WhatsApp',
    'A aba "WhatsApp" passou a "Mensagens de apps" e mostra o nome de cada app',
    'App da crianca: segundo plano automatico (nada para ativar dentro da app)',
    'Guardian: app mais usado volta a aparecer — a crianca pede "Acesso ao uso" automaticamente'
  ]},
  '2.39.83':{changes:[
    'App da crianca funciona 100% em segundo plano, sem precisar de a abrir',
    'Pede isencao da otimizacao de bateria para o Android nao matar o servico',
    'Em segundo plano envia localizacao, heartbeat e WhatsApp de forma nativa (app fechada)',
    'Servico reinicia sozinho apos arranque, atualizacao ou remocao das recentes'
  ]},
  '2.39.82':{changes:[
    'WhatsApp: captura TODAS as mensagens de cada notificacao, nao so a ultima linha',
    'Mapa: o ponto vermelho da crianca anda SUAVE e em tempo real (GPS continuo), como o ponto verde',
    'Localizacao mais exata: GPS de alta precisao e atualizacao a cada ~4 segundos quando a crianca se move'
  ]},
  '2.39.81':{changes:[
    'Contactos: grafico de Chamadas mais efetuadas (7 dias) — ja nao mostra so SMS',
    'Tocar numa notificacao (sino) abre o local correspondente',
    'Tempo real reforcado: tudo da Shield chega ao Guardian a cada 5 segundos',
    'Mensagens recebidas: janela ajustada, compacta e sem cortar o design',
    'Mapa: tocar nas telas de vidro abre o local; captura com zoom que vai limpando a imagem'
  ]},
  '2.39.80':{changes:[
    'Guardian atualiza Mensagens, Chamadas e WhatsApp a cada 10 segundos',
    'Shield envia mensagens/chamadas/WhatsApp a cada 10 segundos — tudo recente, de primeira mao',
    'Historico antigo continua guardado; o recente aparece sempre no topo'
  ]},
  '2.39.79':{changes:[
    'Atualizacao mostra o tamanho real em MB da nova versao (reflete se for maior)',
    'Site de download mostra o tamanho real de cada APK, por versao',
    'Janela de "mensagens/chamadas recebidas" cabe sempre no ecra, sem cortar'
  ]},
  '2.39.78':{changes:[
    'Contactos: "mais contactado" e "mais contactados da semana" deixam de contar WhatsApp',
    'Janela de "mensagens/chamadas recebidas" mais estreita e arrumada',
    'Logotipo SS TEAM no fundo do menu, como marca de agua'
  ]},
  '2.39.77':{changes:[
    'Mensagens recebidas/enviadas deixam de mostrar WhatsApp (so SMS)',
    'Em "mais contactos" ja nao aparecem contactos do WhatsApp',
    'Aba WhatsApp: rolagem manual e conversas/grupos agrupados num unico sitio',
    'Interface das mensagens ajustada ao tamanho das outras'
  ]},
  '2.39.76':{changes:[
    'WhatsApp separado das Mensagens: removido o cartao WA de dentro das mensagens',
    'Mensagens e WhatsApp: data/hora em cima e texto completo por baixo, sem cortes',
    'Jogo da crianca: interface ajusta-se para caber bem em todos os niveis'
  ]},
  '2.39.75':{changes:[
    'Menu da crianca mostra o numero da versao instalada',
    'Atualizacao automatica da crianca mais fiavel: verifica ao abrir e a cada 15 min; descarrega e abre o instalador sozinho',
    'Menu da crianca: "Atualizacoes automaticas" (ativar permissao uma vez) e "Verificar atualizacao agora"'
  ]},
  '2.39.74':{changes:[
    'Nova aba WhatsApp no menu do Guardian (icone real)',
    'A crianca passa a ler as mensagens do WhatsApp pelas notificacoes, apos ativar o "Acesso as notificacoes"',
    'Transparente: so o que aparece nas notificacoes, com permissao explicita da crianca'
  ]},
  '2.39.73':{changes:[
    'Crianca: o teclado ja nao fecha ao escrever o e-mail ou o codigo',
    'Contactos: barra Mensagens/Chamadas/Lixo fixa em baixo (cartoes), visivel ao rolar',
    'Vinculo por e-mail corrigido (encontra a conta do Guardian pelo e-mail); conta propria vincula na hora',
    'Menu do Guardian com icones reais em tudo'
  ]},
  '2.39.72':{changes:[
    'Vinculo permanente: sobrevive a reinicios e mudanca de sessao (codigo, QR, link ou e-mail)',
    'Mensagens e chamadas recentes aparecem sempre (sincronizacao continua + recarga automatica)',
    'Contactos: abas Mensagens/Chamadas/Lixo em baixo, com icones reais',
    'Crianca: botao de menu (⋮) abre de forma fiavel',
    'Jogo: frutas-alvo por cima (so essas contam) e interface centralizada'
  ]},
  '2.39.71':{changes:[
    'Limite de dispositivos do plano garantido tambem no servidor (Supabase)',
    'Atividade: qualquer numero de qualquer pais mostra a operadora/rede e o pais',
    'Jogo de frutas: sons na jogada, ao combinar, ganhar e perder, com botao de som'
  ]},
  '2.39.70':{changes:[
    'Familiar liga ate 5 dispositivos (mais e recusado); Premium e Anual sem limite',
    'Gratis fecha aos 7 dias; Familiar/Premium/Anual fecham aos 30 dias, automaticamente',
    'Crianca: nova versao descarrega e abre o instalador sozinha (o Android so pede "Instalar" uma vez)'
  ]},
  '2.39.69':{changes:[
    'Nome no icone: crianca "Minha Emergência", responsavel "Monitoramento" (sem mudar nada por dentro)',
    'Atualizar instala sempre o APK mais recente (sem cache antiga): ja nao fica preso na versao anterior',
    'So descarrega quando ha mesmo versao nova; na mesma versao nao baixa nada'
  ]},
  '2.39.68':{changes:[
    'Nome no icone: crianca "Minha Emergência", responsavel "Monitoramento"'
  ]},
  '2.39.67':{changes:[
    'Cerca de 5s depois de abrir, se houver versao mais recente, aparece "Nova versao ja foi lancada" com o botao Verificar',
    'O aviso so surge para versoes novas (nunca para a ja instalada) e cada nova versao avisa de novo'
  ]},
  '2.39.66':{changes:[
    'Ao concluir a transferencia, o ecra de instalacao do Android aparece mesmo (botao "Instalar agora")',
    'Se faltar a permissao de instalar apps desconhecidas, abre as definicoes e fica o botao para concluir'
  ]},
  '2.39.65':{changes:[
    '"Verificar atualizacoes" passa a procurar a versao online e encontra as novidades',
    'Login e cadastro: o teclado ja nao fecha ao escrever',
    'Jogo de frutas (Shield): tamanho certo, trocar por toque ou arrasto, niveis 1 ao infinito com dificuldades'
  ]},
  '2.39.64':{changes:[
    'Esqueceu a senha: basta o e-mail, a nova senha e confirmar (nao depende do e-mail de confirmacao)',
    'Ao criar conta aparecem os Termos e Condicoes; so prossegue quem aceitar'
  ]},
  '2.39.63':{changes:[
    'Sem plano nao ha acesso: o botao Voltar do Android ja nao entra na app sem escolher plano gratis ou pago',
    'App da crianca: novo Jogo de frutas (combinar 3+), com pontos e recorde, no menu'
  ]},
  '2.39.62':{changes:[
    'Mapa: depois de localizar fica em ALVO LOCALIZADO com o painel de vidro sempre visível (nao volta a procurar)',
    'Tradutor no canto superior direito e traduz 100% da pagina',
    'Definicoes: Perfil primeiro, guia no fim, sem o cartao de Configuracoes',
    'Atualizar: so aparece "Atualizar aplicativo" quando ha nova versao; com contador de transferencia e pedido de instalacao',
    'Atividade: pesquisa automatica ao completar os 9 digitos, sem botoes'
  ]},
  '2.39.61':{changes:[
    'Definicoes mostram quando ha atualizacao, com o tamanho em MB',
    'Atualizar pelo proprio app, sem transferir APK a mao; e opcional'
  ]},
  '2.39.60':{changes:[
    'Contactos no telemovel: abas e cartoes na horizontal, como no computador',
    'Menu lateral mais limpo: Mensagens, Chamadas, Permissoes e Child & dispositivos sairam (ja estao nos Contactos e no Perfil)'
  ]},
  '2.39.59':{changes:[
    'Contactos: Mensagens, Chamadas e Lixo (SMS ocultadas/apagadas) no topo',
    'Removido o cartao de Interacoes; lista de contactos mais limpa',
    'Perfil reune a conta (e-mail, sessao, tempo real) e abre com contacto e morada',
    'Permissoes e Child & dispositivos agrupados no perfil'
  ]},
  '2.39.58':{changes:[
    'Mapa: distância e tempo estimado (carro/a pé) até ao alvo, e há quanto tempo foi a última posição',
    'Satélite mais nítido ao aproximar (tiles nativos de maior zoom)',
    'Atividade: inserir um número passa a localizar no mapa (ou mostra o cartão do contacto)'
  ]},
  '2.39.57':{changes:[
    'Shield atualiza em silêncio, sem interromper o envio de dados',
    'Na Atividade, o teclado já não fecha ao escrever',
    'Mensagens e chamadas mostram sempre o histórico antigo e o recente'
  ]},
  '2.39.56':{changes:[
    'Engrenagem mostra o nome/modelo real do aparelho de cada pessoa',
    'Contactos: mais contactados da semana (7 dias) e pesquisa por nome/número',
    'Localizar centra na última comunicação; botão reposicionado',
    'Atualização mais clara: ajuda a ativar a instalação no Android'
  ]},
  '2.39.55':{changes:[
    'Rastreio por contacto: mostra no mapa onde a criança estava nos momentos de chamada/SMS com um contacto'
  ]},
  '2.39.54':{changes:[
    'Mapa deixa de "saltar": centra uma vez e o marcador segue em tempo real, sem recentrar a cada atualização'
  ]},
  '2.39.53':{changes:[
    'Botão "Falar com o suporte" abre diretamente o WhatsApp',
    '"Abrir nova versão" passa a instalar a atualização pelo próprio app',
    'As novidades de cada versão aparecem aqui, por baixo'
  ]},
  '2.39.52':{changes:['Lista de pessoas: uma entrada por aparelho, com opção de desvincular','A lista fecha ao tocar fora e mostra a marca do Android']},
  '2.39.51':{changes:['Seletor de pessoas: agrupa duplicados e fica rolável quando há muitos']},
  '2.39.50':{changes:['Correção: o botão de menu (⋮) da Shield voltou a abrir']},
  '2.39.49':{changes:['Engrenagem no topo para alternar entre várias pessoas conectadas']},
  '2.39.48':{changes:['Vinculação por e-mail com aprovação do Guardian']},
  '2.39.47':{changes:['Logo T-Connect e aviso de acompanhamento na Shield','Explorador de ficheiros com pesquisa e ordenação']}
};
function tcNotesList(arr){return (Array.isArray(arr)&&arr.length)?`<ul class="release-notes">${arr.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}
function tcCurrentNotesPanel(){
  const v=window.TC_APP_VERSION||'';const n=TC_CHANGELOG[v];
  if(!n||!Array.isArray(n.changes)||!n.changes.length)return '';
  return `<div class="release-panel current-notes"><div class="release-title"><b>Novidades desta versão</b><span>v${esc(v)}</span></div>${tcNotesList(n.changes)}</div>`;
}
window.tcNotesList=tcNotesList;window.tcCurrentNotesPanel=tcCurrentNotesPanel;
// Tamanho (MB) da atualização disponível, a partir do manifesto (bytes do APK).
function tcUpdSizeMB(){
  const r=state.update.latest||{};
  const b=Number(r.apk_guardian_bytes||r.apk_bytes||r.size_bytes||r.apk_size||0);
  if(b>0) return (b/1048576).toFixed(1)+' MB';
  return '';
}
window.tcUpdSizeMB=tcUpdSizeMB;

function isStandaloneApp(){return !!(window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone===true)}
// Chave de "boas-vindas já vistas", por conta (ou sessão local de demonstração).
function welcomeKey(){const uid=window.TC_DB?.user?.id||'';return 'tc_welcome_seen'+(uid?('_'+uid):'')}
function hasSeenWelcome(){try{return localStorage.getItem(welcomeKey())==='1'}catch(_){return false}}
function markWelcomeSeen(){try{localStorage.setItem(welcomeKey(),'1')}catch(_){}}
function buildPreparationOverlay(){
  const old=document.getElementById('tc-preparation-overlay'); if(old) return null;
  const el=document.createElement('div'); el.id='tc-preparation-overlay'; el.style.cssText='position:fixed;inset:0;z-index:100000;display:grid;place-items:center;background:radial-gradient(circle at 50% 18%,rgba(18,69,105,.94),rgba(3,9,16,.99) 64%);color:#fff;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;';
  el.innerHTML='<div style="text-align:center;width:min(340px,86vw)"><img src="../assets/icons/tconnect-logo-192.png" alt="T-Connect" style="width:82px;height:82px;border-radius:22px;object-fit:cover;box-shadow:0 18px 55px rgba(0,174,255,.24);margin-bottom:22px"><div style="font-weight:900;letter-spacing:.12em;font-size:17px;margin-top:4px">T-CONNECT</div><div style="margin-top:8px;color:#8faabd;font-size:12px">Processando<span class="tcbe-dots"></span></div><div style="margin-top:5px;color:#5f7d93;font-size:11px">Pode demorar alguns segundos…</div></div>';
  if(!document.getElementById('tc-prep-style')){const st=document.createElement('style');st.id='tc-prep-style';st.textContent='.tcbe-dots::after{content:"";animation:tcbeDots 1.4s steps(1) infinite}@keyframes tcbeDots{0%{content:""}25%{content:"."}50%{content:".."}75%{content:"..."}}';document.head.appendChild(st)}
  document.body.appendChild(el);
  return el;
}
// Dados de pagamento (reais) mostrados nos planos.
const TC_PAYMENT={mpesa:'844219918',emola:'861667843',name:'BONIFACIO DICKSON'};
function runPreparation(){
  const el=buildPreparationOverlay();
  const after=()=>{ if(el&&el.isConnected)el.remove(); if(needsPlanChoice())showPlanChooser(); };
  if(!el){ after(); return; }
  setTimeout(after,2200);
}
// Plano escolhido pela conta (por utilizador). Persistido localmente.
function userPlanKey(){const uid=window.TC_DB?.user?.id||'local';return 'tc_user_plan_'+uid}
// O Super Admin (dono) tem acesso total e nunca precisa de plano/pagamento.
function userHasPlan(){if(isSuperAdmin())return true;try{return !!localStorage.getItem(userPlanKey())}catch(_){return false}}
// Regra única de exibição dos planos: mostrar o seletor de planos SÓ quando a pessoa
// ainda não escolheu nenhum plano (1.ª vez) OU quando o plano escolhido expirou.
// Com um plano ativo (não expirado), NUNCA mostra. O Super Admin nunca vê planos.
function needsPlanChoice(){
  if(isSuperAdmin())return false;
  if(isPlanExpired())return true;   // plano expirado → mostra no login
  return !userHasPlan();            // nunca escolheu → mostra; plano ativo → não mostra
}
function getUserPlan(){if(isSuperAdmin())return{plan:'owner',days:99999,paidAt:null};try{return JSON.parse(localStorage.getItem(userPlanKey())||'null')}catch(_){return null}}
function userPlanId(){const p=getUserPlan();return p?p.plan:''}
// Verifica se o plano pago expirou (ex.: 30 dias após o pagamento). O Super Admin e o
// plano Grátis não expiram. Quando expira, o acesso é bloqueado até novo pagamento.
function isPlanExpired(){
  if(isSuperAdmin())return false;
  const p=getUserPlan();
  if(!p||!p.plan)return false;
  if(!p.paidAt||!p.days)return false;
  const ms=Date.now()-new Date(p.paidAt).getTime();
  return ms > (p.days*24*60*60*1000);
}
// Funções permitidas por plano. Free (7 dias) e Premium/Anual = tudo. Familiar = mensagens e chamadas.
function planFeatures(){
  if(isSuperAdmin())return{all:true};
  const id=userPlanId();
  if(id==='premium'||id==='anual'||id==='free')return{all:true};
  if(id==='familiar')return{pages:['overview','status','activity','messages','calls','contacts','whatsapp','permissions','devices','settings','admin']};
  return{all:true};
}
function planAllowsPage(p){const f=planFeatures();if(f.all)return true;return (f.pages||[]).includes(p);}
// Limite de dispositivos (telemóveis) por plano:
//  • Grátis: ilimitado (mas fecha aos 7 dias) · Familiar: 5 · Premium/Anual: ilimitado · Admin: ilimitado.
function planDeviceLimit(){
  if(isSuperAdmin())return Infinity;
  const id=userPlanId();
  if(id==='free')return Infinity;
  if(id==='premium'||id==='anual')return Infinity;
  if(id==='familiar')return 5;
  return 5;
}
function planDeviceLimitLabel(){const n=planDeviceLimit();return n===Infinity?'ilimitado':String(n);}
// Quantos dispositivos já estão vinculados a esta conta.
function tcLinkedDeviceCount(){ try{ return Array.isArray(state.devices)?state.devices.length:0; }catch(_){ return 0; } }
// Pode vincular mais um? (Grátis/Admin sempre; pagos até ao limite.)
function tcCanLinkMore(){ return tcLinkedDeviceCount() < planDeviceLimit(); }
function planUpsellCard(page){
  const nomes={map:'Localização em tempo real',screen:'Câmera e áudio ao vivo',apps:'Aplicativos'};
  const nome=nomes[page]||'Esta função';
  return `<div class="card" style="text-align:center;padding:30px 22px"><div style="font-size:34px">🔒</div><h3 style="margin:10px 0 6px">${esc(nome)} é Premium</h3><p class="muted" style="max-width:40ch;margin:0 auto 18px">O seu plano <b>Familiar</b> inclui mensagens e chamadas. Para localização em tempo real, câmera e áudio ao vivo, atualize para o <b>Premium</b>.</p><button class="btn primary" onclick="showPlanChooser()">Ver planos e atualizar</button></div>`;
}
function planDaysLeft(){const p=getUserPlan();if(!p||!p.paidAt||!p.days)return null;const left=Math.ceil((p.days*86400000-(Date.now()-new Date(p.paidAt).getTime()))/86400000);return left}
function enforcePlan(){
  // Se o plano pago expirou, remove o acesso e força o ecrã de pagamento.
  if(isPlanExpired()){
    const wasFree=userPlanId()==='free';
    try{localStorage.removeItem(userPlanKey())}catch(_){}
    state.planExpired=wasFree?'free':'paid';
    const email=(window.TC_DB?.user?.email||'').toLowerCase();
    addEvent('PLANO',wasFree?'O período grátis de 7 dias terminou. Escolha um plano para continuar.':'O seu plano expirou. Pague novamente para continuar.',{status:'EXPIRADO',source:'Conta',contact:email});
    try{['tc-communication-prompt','tc-emg-ov','tc-about-overlay'].forEach(id=>{const e=document.getElementById(id);if(e)e.remove();});}catch(_){}
    showPlanChooser();
    return true;
  }
  return false;
}
function isFreePlan(){return userPlanId()==='free'}
function tcFreeUsed(){try{return localStorage.getItem('tc_free_used_'+(window.TC_DB?.user?.id||'local'))==='1'}catch(_){return false}}
function setUserPlan(id,period){const plans=(typeof adminLoadPlans==='function')?adminLoadPlans():[];const pl=plans.find(p=>p.id===id);const isFree=id==='free';const days=isFree?7:(period==='anual'?365:(pl?pl.days:30));const rec={plan:id,period:(isFree?'':(period==='anual'?'anual':'mensal')),days:days,paidAt:new Date().toISOString()};try{localStorage.setItem(userPlanKey(),JSON.stringify(rec))}catch(_){}
  try{const email=(window.TC_DB?.user?.email||'').toLowerCase();if(email){const users=adminLoadUsers();let u=users.find(x=>x.email===email);if(!u){u={email,plan:'',days:0,paidAt:null};users.push(u)}if(id!=='free'){u.plan=id;u.days=rec.days;u.paidAt=rec.paidAt}adminSaveUsers(users)}}catch(_){}
  // Supabase: grava a subscrição da própria conta (fonte de verdade entre dispositivos).
  if(supaReady()&&window.tcSetMyPlan){window.tcSetMyPlan(id).catch(err=>console.warn('Supabase plano:',err.message));}
}
function choosePlanAccount(id){
  // Free entra direto (com limitações). Planos pagos exigem confirmar o pagamento.
  if(id==='free'){ if(tcFreeUsed()){ alert('Os seus 7 dias grátis já foram usados. Escolha o plano Familiar ou Premium para continuar.'); return; } try{localStorage.setItem('tc_free_used_'+(window.TC_DB?.user?.id||'local'),'1')}catch(_){} setUserPlan('free'); state.planExpired=null; const ov=document.getElementById('tc-plan-overlay'); if(ov)ov.remove(); addEvent('PLANO','Conta iniciou os 7 dias grátis com acesso total.',{status:'ATIVO',source:'Conta'}); render(); return; }
  showPaymentScreen(id);
}
window.choosePlanAccount=choosePlanAccount;
function confirmPayment(id,period){
  setUserPlan(id,period);
  state.planExpired=null;
  const ov=document.getElementById('tc-plan-overlay'); if(ov)ov.remove();
  const pay=document.getElementById('tc-pay-overlay'); if(pay)pay.remove();
  const nm=planLabel(id);
  addEvent('PLANO','Pagamento confirmado — plano '+nm+' ativado.',{status:'PAGO',source:'Conta'});
  render();
}
window.confirmPayment=confirmPayment;
function planLabel(id){return {free:'Grátis',familiar:'Familiar',premium:'Premium',anual:'Anual'}[id]||id}
function allPlans(){
  const plans=(typeof adminLoadPlans==='function')?adminLoadPlans():[];
  const get=(id,d)=>plans.find(p=>p.id===id)||d;
  const fam=get('familiar',{price:350,days:30,features:[]});
  const pre=get('premium',{price:750,days:30,features:[]});
  const anu=get('anual',{price:6500,days:365,features:[]});
  return [
    {id:'free',name:'Grátis',price:0,days:7,period:'/7 dias',feat:['Acesso TOTAL por 7 dias','Localização em tempo real','Mensagens e chamadas','Câmera e áudio ao vivo'],primary:false},
    {id:'familiar',name:'Familiar',price:fam.price,days:fam.days,period:'/'+fam.days+' dias',feat:(fam.features&&fam.features.length)?fam.features:['Até 5 dispositivos','Histórico de 30 dias','Mensagens e chamadas','Captura de câmera e áudio'],primary:true},
    {id:'premium',name:'Premium',price:pre.price,days:pre.days,period:'/'+pre.days+' dias',feat:(pre.features&&pre.features.length)?pre.features:['Dispositivos ilimitados','Histórico completo','Todas as capturas','Geofencing e relatórios'],primary:false},
    {id:'anual',name:'Anual',price:anu.price,days:anu.days,period:'/ano',feat:(anu.features&&anu.features.length)?anu.features:['Tudo do Premium','12 meses de acesso','2 meses grátis','Prioridade máxima de suporte'],primary:false}
  ];
}
// Markup interno do seletor de planos (reutilizado pelo PORTÃO de ecrã inteiro e
// pelo overlay de upsell). O botão fecha-nada: a escolha do plano é a única saída.
function planChooserInner(){
  const cards=allPlans();
  const expiredBanner=state.planExpired?`<div class="plan-expired-banner" style="background:linear-gradient(135deg,#c0152b,#7a0f1e);color:#fff;border-radius:12px;padding:12px 15px;margin:0 0 14px;font-weight:700">⚠ ${state.planExpired==='free'?'O seu período grátis de 7 dias terminou.':'O seu plano expirou.'} Escolha um plano para continuar a usar o T-Connect.</div>`:'';
  return `<div class="tc-plan-card"><div class="tc-plan-brand">T<span>-CONNECT</span></div><h2>${state.planExpired?'Plano expirado':'Escolha o seu plano'}</h2>${expiredBanner}<p class="tc-plan-sub">O plano Grátis dá <b>7 dias de acesso total</b>. Depois, escolha Familiar (mensagens e chamadas) ou Premium (tudo, com localização em tempo real).</p><div class="tc-plan-grid four">${cards.map(c=>`<section class="plan-card ${c.primary?'plan-featured':''}">${c.primary?'<span class="plan-tag">Mais popular</span>':''}<h3>${c.name}</h3><div class="plan-price"><b>${c.price===0?'0 MT':c.price+' MT'}</b><span>${esc(c.period)}</span></div><ul class="plan-features">${c.feat.map(f=>`<li>✓ ${esc(f)}</li>`).join('')}</ul><button class="btn ${c.primary?'primary':''} plan-cta" ${c.id==='free'&&tcFreeUsed()?'disabled':''} onclick="choosePlanAccount('${c.id}')">${c.id==='free'?(tcFreeUsed()?'7 dias já usados':'Começar 7 dias grátis'):'Escolher '+c.name}</button></section>`).join('')}</div><div class="plan-note">Não é possível aceder à plataforma sem um plano ativo.</div></div>`;
}
// PORTÃO de ecrã inteiro: é o conteúdo REAL da app quando não há plano ativo.
// Não há nada por trás, por isso o botão "Voltar" do Android não dá acesso à app.
function planGateView(){ return `<div class="tc-plan-overlay tc-plan-gate">${planChooserInner()}</div>`; }
function showPlanChooser(){
  if(!state.authenticated||isSuperAdmin()) return;
  // Sem plano (1.ª vez / expirado): o portão de ecrã inteiro trata disto no render().
  if(needsPlanChoice()){ render(); return; }
  // Upsell (já tem um plano e quer outro): overlay por cima da app.
  if(document.getElementById('tc-plan-overlay')) return;
  const el=document.createElement('div');el.id='tc-plan-overlay';el.className='tc-plan-overlay';
  el.innerHTML=planChooserInner();
  document.body.appendChild(el);
}
window.showPlanChooser=showPlanChooser;
const TC_WHATSAPP_URL='https://wa.me/258844219918?s=t';
// Abre um link EXTERNO (WhatsApp, etc.). Dentro do app (WebView) o window.open não
// abre apps externas, por isso navegamos pela própria URL — o lado nativo interceta
// wa.me e abre o WhatsApp. No navegador normal, abre num separador novo.
function openExternal(url){
  try{const w=window.open(url,'_blank','noopener');if(w)return;}catch(_){}
  try{location.href=url;}catch(_){}
}
window.openExternal=openExternal;
function waProof(planName,price){
  const msg=encodeURIComponent('Olá, acabei de pagar o plano '+planName+' ('+price+' MT) do T-Connect. Segue o comprovante do pagamento.');
  const url=TC_WHATSAPP_URL+(TC_WHATSAPP_URL.includes('?')?'&':'?')+'text='+msg;
  openExternal(url);
}
window.waProof=waProof;
function tcOpenSupport(){
  try{state.menuOpen=false;render();}catch(_){}
  const msg=encodeURIComponent('Olá, preciso de ajuda com o T-Connect (app Guardian).');
  const url=TC_WHATSAPP_URL+(TC_WHATSAPP_URL.includes('?')?'&':'?')+'text='+msg;
  openExternal(url);
}
window.tcOpenSupport=tcOpenSupport;
// ---- Botão/Painel de Emergência (Guardian) ----
function tcEmergencyFab(){return '<button type="button" id="tc-emg-fab" class="tc-emg-fab" aria-label="Emergência" title="Emergência" onclick="openEmergency()">SOS</button>';}
function openEmergency(){
  if(!document.getElementById('tc-emg-style')){const st=document.createElement('style');st.id='tc-emg-style';st.textContent='.tc-emg-fab{position:fixed;right:16px;bottom:calc(18px + env(safe-area-inset-bottom,0px));z-index:9000;width:62px;height:62px;border-radius:50%;border:0;background:radial-gradient(circle at 50% 35%,#ff5a5a,#c0152b);color:#fff;font-weight:900;font-size:16px;letter-spacing:.04em;box-shadow:0 10px 26px rgba(192,21,43,.5);cursor:pointer;animation:tcEmgPulse 2s ease-out infinite}@keyframes tcEmgPulse{0%{box-shadow:0 10px 26px rgba(192,21,43,.5),0 0 0 0 rgba(255,90,90,.55)}70%{box-shadow:0 10px 26px rgba(192,21,43,.5),0 0 0 16px rgba(255,90,90,0)}100%{box-shadow:0 10px 26px rgba(192,21,43,.5),0 0 0 0 rgba(255,90,90,0)}}.tc-emg-ov{position:fixed;inset:0;z-index:9500;display:grid;place-items:center;padding:20px;background:rgba(4,10,18,.72);backdrop-filter:blur(8px)}.tc-emg-card{width:min(420px,94vw);background:linear-gradient(180deg,#160a0c,#0a1420);border:1px solid rgba(255,90,90,.35);border-radius:22px;padding:24px 20px;color:#fff;text-align:center;box-shadow:0 30px 90px rgba(0,0,0,.6)}.tc-emg-card h2{margin:6px 0 2px;font-size:24px}.tc-emg-card .emg-sub{color:#f3b0b0;font-size:12px;margin:0 0 16px}.tc-emg-loc{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:13px;padding:12px;margin-bottom:14px;font-size:13px}.tc-emg-loc small{color:#9fb4c6;display:block;margin-bottom:3px}.tc-emg-btn{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;border:0;border-radius:13px;padding:14px;font-weight:800;font-size:15px;margin-top:10px;cursor:pointer}.emg-call{background:linear-gradient(135deg,#ff4d4d,#c0152b);color:#fff}.emg-map{background:#113a5c;color:#dff1ff}.emg-alarm{background:#3a2a08;color:#ffd87a;border:1px solid rgba(255,180,60,.3)}.tc-emg-close{margin-top:14px;background:transparent;border:0;color:#9fb4c6;font-size:13px;cursor:pointer}';document.head.appendChild(st);}
  const d=state.devices&&state.devices[0];
  const hasLoc=d&&d.last_lat!=null&&d.last_lng!=null;
  const locHtml=hasLoc
    ? `<div class="tc-emg-loc"><small>ÚLTIMA LOCALIZAÇÃO DA CRIANÇA</small><b>${Number(d.last_lat).toFixed(5)}, ${Number(d.last_lng).toFixed(5)}</b>${window.TC_MAP_AREA_NAME?('<div style="color:#bcd3e6;margin-top:4px">'+esc(window.TC_MAP_AREA_NAME)+'</div>'):''}</div>`
    : `<div class="tc-emg-loc"><small>LOCALIZAÇÃO</small><b>Sem localização recente do dispositivo.</b></div>`;
  const old=document.getElementById('tc-emg-ov');if(old)old.remove();
  const el=document.createElement('div');el.id='tc-emg-ov';el.className='tc-emg-ov';
  el.innerHTML=`<div class="tc-emg-card"><div style="font-size:30px">🆘</div><h2>Emergência</h2><p class="emg-sub">Aja rápido. Escolha uma opção abaixo.</p>${locHtml}
    <button class="tc-emg-btn emg-call" onclick="tcEmergencyCall()">📞 Ligar para emergência (112)</button>
    ${hasLoc?'<button class="tc-emg-btn emg-map" onclick="document.getElementById(\'tc-emg-ov\').remove();go(\'map\')">🗺️ Ver localização no mapa</button>':''}
    <button class="tc-emg-btn emg-alarm" onclick="tcEmergencyAlarm(this)">🔊 Tocar alarme no telemóvel da criança</button>
    <button class="tc-emg-close" onclick="document.getElementById('tc-emg-ov').remove()">Fechar</button>
  </div>`;
  document.body.appendChild(el);
  el.addEventListener('click',e=>{if(e.target===el)el.remove();});
  try{addEvent('SOS','Painel de emergência aberto no Guardian.',{status:'EMERGÊNCIA',source:'Guardian'});}catch(_){}
}
function tcEmergencyCall(){ if(!confirm('Ligar para o número de emergência 112?'))return; try{location.href='tel:112';}catch(_){ alert('Não foi possível iniciar a chamada. Ligue manualmente para 112.'); } }
async function tcRingChild(){const d=state.devices&&state.devices[0];if(!d){alert('Nenhum dispositivo vinculado.');return false;}const code=d.device_code||d.deviceCode||d.code;if(!code){alert('Dispositivo sem código de vinculação.');return false;}try{if(window.TC_DB&&window.TC_DB.client){const {error}=await window.TC_DB.client.rpc('guardian_ring',{p_device_code:code});if(error)throw error;addEvent('EMERGÊNCIA','Alarme enviado para o telemóvel da criança.',{status:'ENVIADO',source:'Guardian'});return true;}}catch(e){console.warn('ring',e&&e.message);addEvent('EMERGÊNCIA','Falha ao enviar alarme: '+(e&&e.message||''),{status:'ERRO',source:'Guardian'});}return false;}
async function tcEmergencyAlarm(btn){ if(btn){btn.disabled=true;btn.textContent='🔊 A enviar pedido…';} const ok=await tcRingChild(); if(btn){btn.disabled=false;btn.textContent=ok?'🔊 Alarme enviado ✓ (o telemóvel vai apitar)':'🔊 Falhou — tentar novamente';} if(!ok){try{const a=new (window.AudioContext||window.webkitAudioContext)();const o=a.createOscillator();const g=a.createGain();o.connect(g);g.connect(a.destination);o.type='square';o.frequency.value=880;g.gain.value=.15;o.start();setTimeout(()=>{o.stop();a.close&&a.close();},1200);}catch(_){}} }
window.openEmergency=openEmergency;window.tcEmergencyCall=tcEmergencyCall;window.tcEmergencyAlarm=tcEmergencyAlarm;window.tcRingChild=tcRingChild;
const mpesaIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18"/><circle cx="7.5" cy="14.5" r="1.4"/></svg>';
const emolaIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M4 10h16"/><path d="M8 15h4"/></svg>';
const waIcon='<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3C9.4 3 4 8.4 4 15c0 2.3.6 4.5 1.8 6.4L4 29l7.8-1.8c1.8 1 3.9 1.5 6.2 1.5 6.6 0 12-5.4 12-12S22.6 3 16 3Z"/><path d="M21.5 18.2c-.3-.2-1.9-1-2.2-1.1-.3-.1-.5-.2-.8.2-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-1.8-.7-3-1.9-4-3.5-.3-.5.3-.5.8-1.5.1-.2 0-.4 0-.5 0-.2-.8-1.9-1-2.5-.3-.6-.5-.5-.8-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.3 3.1c.2.2 2.2 3.4 5.4 4.6 2.6 1 3.1.8 3.7.8.6-.1 1.9-.8 2.1-1.5.3-.7.3-1.3.2-1.4-.1-.2-.3-.2-.6-.4Z" fill="#fff"/></svg>';
function showPaymentScreen(id){
  const p=allPlans().find(x=>x.id===id);if(!p)return;
  const old=document.getElementById('tc-pay-overlay');if(old)old.remove();
  const el=document.createElement('div');el.id='tc-pay-overlay';el.className='tc-plan-overlay';
  el.innerHTML=`<div class="tc-plan-card tc-pay-card"><button class="admin-back-gear" onclick="document.getElementById('tc-pay-overlay').remove()">${gearSvg}<span>Voltar</span></button><div class="tc-plan-brand">T<span>-CONNECT</span></div><h2>Pagamento — Plano ${esc(p.name)}</h2><p class="tc-plan-sub">Valor: <b>${p.price} MT</b> ${esc(p.period)}. Transfira para um dos contactos abaixo.</p>
    <div class="pay-boxes">
      <div class="pay-box"><div class="pay-box-top"><span class="pay-ico mpesa">${mpesaIcon}</span><span class="pay-badge mpesa">M-Pesa</span></div><div class="pay-number">${esc(TC_PAYMENT.mpesa)}</div><div class="pay-name">${esc(TC_PAYMENT.name)}</div><button class="btn small" onclick="navigator.clipboard&&navigator.clipboard.writeText('${esc(TC_PAYMENT.mpesa)}');this.textContent='Copiado ✓'">⧉ Copiar número</button></div>
      <div class="pay-box"><div class="pay-box-top"><span class="pay-ico emola">${emolaIcon}</span><span class="pay-badge emola">e-Mola</span></div><div class="pay-number">${esc(TC_PAYMENT.emola)}</div><div class="pay-name">${esc(TC_PAYMENT.name)}</div><button class="btn small" onclick="navigator.clipboard&&navigator.clipboard.writeText('${esc(TC_PAYMENT.emola)}');this.textContent='Copiado ✓'">⧉ Copiar número</button></div>
    </div>
    <div class="pay-auto">
      <div class="pay-auto-title">Pagar automaticamente (recebe o pedido de PIN no telemóvel)</div>
      <div class="pay-method-toggle"><button type="button" class="pay-method-btn is-on" data-m="mpesa" onclick="tcSelectPayMethod('mpesa')">M-Pesa</button><button type="button" class="pay-method-btn" data-m="emola" onclick="tcSelectPayMethod('emola')">e-Mola</button></div>
      <input class="pay-phone-input" id="tc-pay-phone" inputmode="tel" placeholder="Seu número (ex: 84XXXXXXX)" maxlength="12">
      <button class="btn primary wide" id="tc-pay-now" onclick="tcPayNow('${p.id}',${p.price},${p.days})">Pagar ${p.price} MT agora</button>
      <div class="pay-auto-status" id="tc-pay-status"></div>
    </div>
    <div class="pay-divider"><span>ou pague manualmente</span></div>
    <div class="pay-actions">
      <button class="btn wide" onclick="confirmPayment('${p.id}')">Já paguei (confirmação manual)</button>
      <button class="btn wa-btn wide" onclick="waProof('${esc(p.name)}','${p.price}')"><span class="wa-ico">${waIcon}</span> Enviar comprovante via WhatsApp</button>
    </div>
    <p class="plan-note">O pagamento automático precisa da integração configurada no Supabase. Caso ainda não esteja, transfira ${p.price} MT para ${esc(TC_PAYMENT.name)} e use a confirmação manual.</p>
  </div>`;
  document.body.appendChild(el);
}
window.showPaymentScreen=showPaymentScreen;
let tcPayMethod='mpesa';
function tcSelectPayMethod(m){tcPayMethod=m;document.querySelectorAll('.pay-method-btn').forEach(b=>b.classList.toggle('is-on',b.dataset.m===m));const ph=document.getElementById('tc-pay-phone');if(ph)ph.placeholder=m==='mpesa'?'Seu número M-Pesa (84/85XXXXXXX)':'Seu número e-Mola (86/87XXXXXXX)';}
window.tcSelectPayMethod=tcSelectPayMethod;
async function tcPayNow(planId,amount,days){
  const phoneEl=document.getElementById('tc-pay-phone');
  const statusEl=document.getElementById('tc-pay-status');
  const btn=document.getElementById('tc-pay-now');
  const phone=(phoneEl?.value||'').replace(/\D/g,'');
  if(phone.length<9){statusEl.textContent='Introduza um número válido.';statusEl.className='pay-auto-status err';return;}
  if(!(window.TC_DB?.enabled&&window.tcCharge)){statusEl.textContent='Pagamento automático ainda não configurado. Use a confirmação manual abaixo.';statusEl.className='pay-auto-status err';return;}
  btn.disabled=true;statusEl.className='pay-auto-status';statusEl.textContent='A enviar pedido… confirme o PIN no seu telemóvel.';
  try{
    const res=await window.tcCharge({method:tcPayMethod,plan:planId,amount,days,phone});
    if(res&&res.status==='paid'){statusEl.className='pay-auto-status ok';statusEl.textContent='Pagamento confirmado! A ativar o plano…';setTimeout(()=>confirmPayment(planId),800);}
    else if(res&&res.status==='pending'){statusEl.className='pay-auto-status';statusEl.textContent='Pagamento em processamento. Aguarde a confirmação no telemóvel.';if(res.reference)tcPollPayment(res.reference,planId,days,statusEl);}
    else{statusEl.className='pay-auto-status err';statusEl.textContent='Pagamento não concluído ('+(res?.error||res?.status||'falhou')+'). Tente de novo ou pague manualmente.';btn.disabled=false;}
  }catch(e){statusEl.className='pay-auto-status err';statusEl.textContent='Erro: '+(e.message||'falha')+'. Use a confirmação manual.';btn.disabled=false;}
}
window.tcPayNow=tcPayNow;
function tcPollPayment(reference,planId,days,statusEl){
  let tries=0;const timer=setInterval(async()=>{
    tries++;if(tries>20){clearInterval(timer);return;}
    try{const r=await window.tcChargeStatus({reference,plan:planId,days});if(r&&r.status==='paid'){clearInterval(timer);statusEl.className='pay-auto-status ok';statusEl.textContent='Pagamento confirmado! A ativar…';setTimeout(()=>confirmPayment(planId),800);}else if(r&&r.status==='failed'){clearInterval(timer);statusEl.className='pay-auto-status err';statusEl.textContent='Pagamento falhou. Tente novamente.';}}catch(_){}
  },4000);
}
window.tcPollPayment=tcPollPayment;
function tcAboutPhone(inner){return '<div class="tc-ab-phone"><div class="tc-ab-notch"></div><div class="tc-ab-screen">'+inner+'</div></div>'}
function openAbout(){
  const old=document.getElementById('tc-about-overlay'); if(old){old.remove();return}
  const ver=esc(window.TC_APP_VERSION||'');
  const feats=[
    ['📍','Localização em tempo real','Veja o local exato da criança no mapa, com ponto animado que segue o movimento e endereço (rua, bairro, cidade).'],
    ['🎥','Câmera ao vivo','Peça a câmera da criança; após ela aceitar, vê o vídeo em direto. Botão para trocar entre câmara da frente e de trás.'],
    ['🎙️','Áudio ao vivo','Escute o ambiente da criança, sempre com autorização explícita no telemóvel dela.'],
    ['🆘','Emergência (SOS)','A criança aciona o SOS; o Guardian recebe alerta sonoro cinematográfico, vibração e a localização.'],
    ['💬','Mensagens e chamadas','Histórico de SMS e chamadas (recebidas/efetuadas) com o nome do contacto, quando autorizado.'],
    ['👥','Contactos e apps','Agenda sincronizada e lista de aplicações com tempo de uso.'],
    ['🔔','Alertas e notificações','Avisos de emergência, online/offline e atividades; deslize para apagar.'],
    ['🛰️','Segundo plano','O app da criança continua detetável mesmo fechado, graças a um serviço de proteção contínua.']
  ];
  const steps=[
    ['1','Vincular','No Guardian gere um código/QR e introduza-o no app Minha Emergência da criança.'],
    ['2','Autorizar','A criança concede as permissões (localização, câmara, microfone, SMS, contactos) no Android.'],
    ['3','Monitorar','No Guardian acompanha localização, pede câmera/áudio e recebe alertas em tempo real.']
  ];
  const pros=['Localização precisa e em tempo real','Câmera e áudio só com consentimento da criança','Alertas de emergência imediatos (SOS)','Funciona em segundo plano','Dois apps separados (pais e criança)','Dados protegidos por conta e permissões'];
  const cons=['Câmera/áudio ao vivo exigem 2 telemóveis','Depende das permissões concedidas no Android','Precisa de internet nos dois aparelhos','Projeção de tela ainda não disponível','Consome bateria por usar GPS/segundo plano'];
  // Mockups demonstrativos (SVG)
  const mapShot=tcAboutPhone('<svg viewBox="0 0 150 240" width="100%" height="100%" preserveAspectRatio="xMidYMid slice"><rect width="150" height="240" fill="#0b2233"/><g stroke="#19425c" stroke-width="2"><path d="M0 60H150M0 120H150M0 180H150M40 0V240M100 0V240"/></g><path d="M0 150 Q50 120 90 160 T150 150" stroke="#2b6f8f" stroke-width="6" fill="none"/><circle cx="86" cy="120" r="9" fill="#ff3b3b"/><circle cx="86" cy="120" r="16" fill="none" stroke="#ff3b3b" stroke-opacity=".5" stroke-width="2"/><rect x="10" y="12" width="92" height="20" rx="6" fill="#06151f" stroke="#22d3ee55"/><text x="18" y="26" fill="#9beaf7" font-size="10" font-family="monospace">● AO VIVO · GPS</text></svg>');
  const camShot=tcAboutPhone('<svg viewBox="0 0 150 240" width="100%" height="100%"><rect width="150" height="240" fill="#02070c"/><rect x="12" y="24" width="126" height="150" rx="10" fill="#0a1a26" stroke="#22d3ee66"/><circle cx="75" cy="99" r="30" fill="#0e2b3a"/><circle cx="75" cy="92" r="12" fill="#1b4c63"/><path d="M55 120 Q75 104 95 120" stroke="#2b6f8f" stroke-width="4" fill="none"/><rect x="20" y="30" width="60" height="16" rx="8" fill="#06151f" stroke="#22d3ee55"/><text x="27" y="42" fill="#aef0ff" font-size="9" font-family="monospace">● AO VIVO</text><g><circle cx="48" cy="196" r="16" fill="#0a1a26" stroke="#8df7ff"/><circle cx="90" cy="196" r="16" fill="#0a1a26" stroke="#8df7ff"/><text x="40" y="200" fill="#dff6ff" font-size="12">↻</text><text x="84" y="200" fill="#8df7c0" font-size="12">🔊</text></g></svg>');
  const sosShot=tcAboutPhone('<svg viewBox="0 0 150 240" width="100%" height="100%"><rect width="150" height="240" fill="#1a0a0d"/><circle cx="75" cy="96" r="42" fill="#3a0d12"/><circle cx="75" cy="96" r="30" fill="#ff2d2d"/><text x="75" y="101" fill="#fff" font-size="16" font-weight="bold" text-anchor="middle" font-family="sans-serif">SOS</text><rect x="20" y="168" width="110" height="46" rx="10" fill="#2a0c10" stroke="#ff6b6b66"/><text x="30" y="188" fill="#ffb5b5" font-size="9" font-family="monospace">EMERGÊNCIA</text><text x="30" y="203" fill="#d6b9bd" font-size="8" font-family="monospace">Alerta + localização</text></svg>');
  const el=document.createElement('div'); el.id='tc-about-overlay'; el.className='tc-about-overlay';
  el.innerHTML='<div class="tc-about-box" role="dialog" aria-label="Sobre o T-Connect">'
    +'<div class="tc-about-head"><div class="tc-about-brand"><img src="../assets/icons/tconnect-logo-192.png" alt="T-Connect"><div><b>T‑CONNECT</b><small>Segurança em tempo real</small></div></div><button class="tc-about-close" type="button" aria-label="Fechar">×</button></div>'
    +'<div class="tc-about-body">'
    +'<span class="tc-about-ver">Versão v'+ver+'</span>'
    +'<h2>O que é o T‑Connect?</h2>'
    +'<p>O T‑Connect é uma plataforma de <b>segurança familiar</b> composta por dois aplicativos: o <b>Guardian</b> (para os pais/responsáveis) e o <b>Minha Emergência</b> (para a criança). Permite acompanhar a localização em tempo real, pedir câmera e áudio ao vivo (sempre com autorização da criança), receber alertas de emergência (SOS) e consultar mensagens, chamadas e contactos autorizados — tudo de forma segura e transparente.</p>'
    +'<h3>Demonstração</h3>'
    +'<div class="tc-about-shots"><div class="tc-ab-demo">'+mapShot+'<div class="tc-ab-cap">Localização ao vivo</div></div><div class="tc-ab-demo">'+camShot+'<div class="tc-ab-cap">Câmera autorizada</div></div><div class="tc-ab-demo">'+sosShot+'<div class="tc-ab-cap">Emergência SOS</div></div></div>'
    +'<h3>Funcionalidades</h3>'
    +'<div class="tc-about-feats">'+feats.map(f=>'<div class="tc-about-feat"><span class="tc-ab-ic">'+f[0]+'</span><div><b>'+esc(f[1])+'</b><p>'+esc(f[2])+'</p></div></div>').join('')+'</div>'
    +'<h3>Como funciona</h3>'
    +'<div class="tc-about-steps">'+steps.map(s=>'<div class="tc-about-step"><span class="tc-ab-num">'+s[0]+'</span><div><b>'+esc(s[1])+'</b><p>'+esc(s[2])+'</p></div></div>').join('')+'</div>'
    +'<h3>Vantagens e desvantagens</h3>'
    +'<div class="tc-about-pc"><div class="tc-about-pros"><b>✓ Vantagens</b><ul>'+pros.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div><div class="tc-about-cons"><b>! A ter em conta</b><ul>'+cons.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div></div>'
    +'<div class="tc-about-note">🔒 <b>Privacidade:</b> a câmera e o áudio nunca são ativados sem a criança aceitar no telemóvel dela. O objetivo do T‑Connect é a <b>proteção e o bem‑estar</b> da criança, com uso responsável e consentido.</div>'
    +'<button class="btn primary wide" type="button" id="tc-about-ok">Entendi</button>'
    +'</div></div>';
  document.body.appendChild(el);
  const close=()=>el.remove();
  el.querySelector('.tc-about-close').onclick=close;
  el.querySelector('#tc-about-ok').onclick=close;
  el.onclick=e=>{if(e.target===el)close()};
}
function showWelcomeIfNeeded(){
  if(!state.authenticated) return;
  const old=document.getElementById('tc-welcome-overlay'); if(old) return;
  const el=document.createElement('div'); el.id='tc-welcome-overlay'; el.style.cssText='position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 50% 12%,rgba(19,83,130,.72),rgba(3,10,18,.98) 62%);backdrop-filter:blur(12px);color:#fff;font-family:system-ui,-apple-system,Segoe UI,sans-serif;';
  el.innerHTML=`<div style="width:min(430px,94vw);text-align:center;padding:32px 24px 28px;border:1px solid rgba(56,189,248,.32);border-radius:28px;background:linear-gradient(180deg,rgba(10,28,45,.97),rgba(4,13,23,.98));box-shadow:0 30px 100px rgba(0,0,0,.55)"><img src="../assets/icons/tconnect-logo-192.png" alt="T-Connect" style="width:112px;height:112px;object-fit:cover;border-radius:26px;box-shadow:0 12px 45px rgba(0,174,255,.22);margin-bottom:18px"><div style="font-size:29px;font-weight:900;letter-spacing:.04em">T<span style="color:#38bdf8">-CONNECT</span></div><div style="margin-top:7px;color:#55d9ff;font-size:12px;font-weight:800;letter-spacing:.16em">SEGURANÇA EM TEMPO REAL</div><h2 style="font-size:28px;line-height:1.08;margin:30px 0 12px">Está preparado para fazer o <span style="color:#38bdf8">monitoramento?</span></h2><p style="color:#a9bfd1;line-height:1.55;margin:0 auto 24px;max-width:340px">Tudo pronto para acompanhar os seus dispositivos com segurança, rapidez e informação em tempo real.</p><button id="tc-welcome-start" style="width:100%;border:0;border-radius:15px;padding:15px 18px;background:linear-gradient(135deg,#0ea5e9,#1677ff);color:#fff;font-weight:800;font-size:16px">Começar monitoramento</button><small style="display:block;margin-top:18px;color:#6f879b">T-Connect · Sempre com você.</small></div>`;
  document.body.appendChild(el);
  el.querySelector('#tc-welcome-start').onclick=()=>{el.remove();markWelcomeSeen();if(needsPlanChoice())showPlanChooser();};
}
function showPreparationThenContinue(){
  if(!state.authenticated) return;
  // Boas-vindas APENAS para novo utilizador (logo após o cadastro/1º acesso).
  // Nesse caso a ordem é: processamento -> boas-vindas -> entrar no app.
  // Para quem já entrou antes: só a tela de processamento e entra direto, sem boas-vindas.
  if(!hasSeenWelcome()){
    const el=buildPreparationOverlay();
    const after=()=>{ if(el&&el.isConnected)el.remove(); showWelcomeIfNeeded(); };
    if(!el){ showWelcomeIfNeeded(); return; }
    setTimeout(after,2200);
  } else {
    runPreparation();
  }
}

async function logout(){try{await tcSignOut()}catch(e){}try{['tc_events','tc_notifications','tc_map_terminal_events','tc:lastKnownLocation','tc_auto_update_target'].forEach(k=>localStorage.removeItem(k));window.TC_MAP?.reset?.()}catch(_){}sessionStorage.removeItem('tc_demo');state.authenticated=false;location.reload()}
async function toggleTrail(){if(state.trailOn){state.trailOn=false;try{if(window.TC_MAP&&TC_MAP.clearTrail)TC_MAP.clearTrail()}catch(_){}render();return}state.trailOn=true;render();try{const d=state.devices[0];if(!d?.id||!window.TC_DB?.enabled||!window.TC_DB.client)return;const start=new Date();start.setHours(0,0,0,0);const {data}=await window.TC_DB.client.from('location_history').select('lat,lng,epoch_ms').eq('device_id',d.id).gte('epoch_ms',start.getTime()).order('epoch_ms',{ascending:true}).limit(2000);if(window.TC_MAP&&TC_MAP.showTrail)TC_MAP.showTrail((data||[]).map(p=>({lat:p.lat,lng:p.lng})))}catch(e){console.warn('trail',e&&e.message)}}
async function loadContacts(){if(!window.TC_DB?.enabled||!window.TC_DB.client)return;try{const ids=tcActivePersonDeviceIds();let q=window.TC_DB.client.from('contacts').select('*').order('name',{ascending:true}).limit(2000);if(ids.length)q=q.in('device_id',ids);const {data}=await q;state.contactsList=data||[];try{if(ids.length){const[c,m]=await Promise.all([window.TC_DB.client.from('calls').select('number,name').in('device_id',ids).limit(5000),window.TC_DB.client.from('messages').select('address,app').in('device_id',ids).limit(5000)]);const counts={};const norm=x=>String(x||'').replace(/[^0-9+]/g,'').slice(-9);(c.data||[]).forEach(r=>{const k=norm(r.number);if(k){counts[k]=counts[k]||{n:0,calls:0,sms:0,name:r.name||'',number:r.number};counts[k].n++;counts[k].calls++;if(r.name)counts[k].name=r.name}});(m.data||[]).forEach(r=>{if(r.app==='whatsapp')return;const k=norm(r.address);if(k){counts[k]=counts[k]||{n:0,calls:0,sms:0,name:'',number:r.address};counts[k].n++;counts[k].sms++}});(state.contactsList||[]).forEach(ct=>{const k=norm(ct.number);if(k&&counts[k]&&!counts[k].name)counts[k].name=ct.name});state.contactStats=Object.values(counts).sort((a,b)=>b.n-a.n)}}catch(_){state.contactStats=[]}ensureCommsRealtime();if(state.page==='contacts')render()}catch(e){console.warn('loadContacts',e&&e.message)}}
async function loadApps(){if(!window.TC_DB?.enabled||!window.TC_DB.client)return;try{const ids=tcActivePersonDeviceIds();let q=window.TC_DB.client.from('apps').select('*').order('usage_minutes',{ascending:false}).limit(2000);if(ids.length)q=q.in('device_id',ids);const {data}=await q;state.appsList=data||[];ensureCommsRealtime();if(state.page==='apps')render()}catch(e){console.warn('loadApps',e&&e.message)}}
function tcStatCard(label,value,sub){return `<div class="tcst-card"><span class="tcst-label">${esc(label)}</span><b class="tcst-value">${esc(value)}</b>${sub?`<small class="tcst-sub">${esc(sub)}</small>`:''}</div>`}
function tcBarRow(name,val,max,fmt){const pct=max>0?Math.max(4,Math.round(val/max*100)):0;return `<div class="tcst-row"><span class="tcst-name">${esc(name)}</span><div class="tcst-track"><i style="width:${pct}%"></i></div><span class="tcst-val">${esc(fmt?fmt(val):String(val))}</span></div>`}
function renderAppsStats(){const apps=(state.appsList||[]);const total=apps.reduce((s,a)=>s+Number(a.usage_minutes||0),0);const top=[...apps].sort((a,b)=>(b.usage_minutes||0)-(a.usage_minutes||0));const most=top[0];const max=most?Number(most.usage_minutes||0):0;const cards=`<div class="tcst-grid">${tcStatCard('App mais usado',most&&most.usage_minutes?most.label:'—',most&&most.usage_minutes?tcUsageFmt(most.usage_minutes)+' nas últimas 24h':'sem dados de uso')}${tcStatCard('Tempo total (24h)',tcUsageFmt(total))}${tcStatCard('Apps instaladas',String(apps.length))}</div>`;const used=top.filter(a=>a.usage_minutes>0).slice(0,8);const bars=max>0?`<div class="tcst-bars"><div class="tcst-bars-title">Mais usados (24h)</div>${used.map(a=>tcBarRow(a.label||a.package,Number(a.usage_minutes||0),max,tcUsageFmt)).join('')}</div>`:`<div class="tc-stats-note">Sem dados de uso. No telemóvel do Child, ative "Acesso ao uso" nas Definições do Android para ver o tempo por app.</div>`;return cards+bars}
// Contactos mais ativos nos ÚLTIMOS 7 DIAS (semanalmente), a partir de chamadas+SMS.
function tcWeeklyContacts(){
  const since=Date.now()-7*24*3600*1000;
  const norm=x=>String(x||'').replace(/[^0-9+]/g,'').slice(-9);
  const counts={};
  (state.calls||[]).forEach(c=>{const t=tcCallTime(c);if(!t||t<since)return;const k=norm(c.number);if(!k)return;counts[k]=counts[k]||{n:0,calls:0,sms:0,name:c.name||'',number:c.number||k};counts[k].n++;counts[k].calls++;if(c.name)counts[k].name=c.name});
  (state.messages||[]).forEach(m=>{if(!tcIsSms(m)||m.deleted)return;const t=tcMsgTime(m);if(!t||t<since)return;const k=norm(m.address);if(!k)return;counts[k]=counts[k]||{n:0,calls:0,sms:0,name:'',number:m.address||k};counts[k].n++;counts[k].sms++});
  (state.contactsList||[]).forEach(ct=>{const k=norm(ct.number);if(k&&counts[k]&&!counts[k].name)counts[k].name=ct.name});
  return Object.values(counts).sort((a,b)=>b.n-a.n);
}
function tcWeeklyCalls(){
  const since=Date.now()-7*24*3600*1000;
  const norm=x=>String(x||'').replace(/[^0-9+]/g,'').slice(-9);
  const counts={};
  (state.calls||[]).forEach(c=>{if(c.deleted)return;const t=tcCallTime(c);if(!t||t<since)return;const k=norm(c.number);if(!k)return;counts[k]=counts[k]||{n:0,out:0,inc:0,secs:0,name:c.name||'',number:c.number||k};counts[k].n++;if(String(c.direction)==='EFETUADA')counts[k].out++;else counts[k].inc++;counts[k].secs+=Number(c.duration_s||0);if(c.name)counts[k].name=c.name});
  (state.contactsList||[]).forEach(ct=>{const k=norm(ct.number);if(k&&counts[k]&&!counts[k].name)counts[k].name=ct.name});
  return Object.values(counts).sort((a,b)=>b.n-a.n);
}
function renderContactsStats(){
  const total=(state.contactsList||[]).length;
  const cs=tcWeeklyCalls();const topCall=cs[0];const maxC=topCall?topCall.n:0;
  const st=tcWeeklyContacts();const most=st[0];const max=most?most.n:0;
  const dur=s=>{s=Math.round(s||0);if(s<60)return s+'s';const m=Math.floor(s/60);return m+'min'+(s%60?(' '+(s%60)+'s'):'')};
  const cards=`<div class="tcst-grid tcst-grid-2">${tcStatCard('Mais chamado (7 dias)',topCall?(topCall.name||topCall.number):'—',topCall?(esc(topCall.number||'')+' · '+topCall.n+' chamada'+(topCall.n===1?'':'s')):'sem chamadas esta semana')}${tcStatCard('Total de contactos',String(total))}</div>`;
  const callBars=maxC>0?`<div class="tcst-bars"><div class="tcst-bars-title">Chamadas mais efetuadas (últimos 7 dias)</div>${cs.slice(0,8).map(x=>tcBarRow((x.name||x.number)+' · '+(x.number||''),x.n,maxC,v=>v+'×'+(x.secs?(' · '+dur(x.secs)):''))).join('')}</div>`:`<div class="tc-stats-note">Sem chamadas nos últimos 7 dias. Aparecem aqui quando houver chamadas recentes sincronizadas.</div>`;
  const msgBars=max>0?`<div class="tcst-bars" style="margin-top:10px"><div class="tcst-bars-title">Contactos mais ativos (chamadas + SMS)</div>${st.slice(0,6).map(x=>tcBarRow((x.name||x.number)+' · '+(x.number||''),x.n,max,v=>v+'×')).join('')}</div>`:'';
  return cards+callBars+msgBars;
}
function renderContactsList(){
  const all=state.contactsList||[];
  if(!all.length)return '<div class="terminal-empty">[TC::WAIT] 0x0000 :: SEM CONTATOS SINCRONIZADOS</div>';
  const q=String(state.contactSearch||'').trim().toLowerCase();
  const qd=q.replace(/[^0-9+]/g,'');
  let list=all;
  if(q)list=all.filter(c=>String(c.name||'').toLowerCase().includes(q)||(qd&&String(c.number||'').replace(/[^0-9+]/g,'').includes(qd)));
  if(!list.length)return '<div class="terminal-empty">Nada encontrado para "'+esc(q)+'".</div>';
  return '<div class="contacts-rows">'+list.map(c=>`<div class="contact-row"><div class="contact-row-main"><b>${esc(c.name||'—')}</b><small>${esc(c.number||'—')}</small></div><button class="btn small contact-loc" onclick="trackContact('${esc(String(c.number||'').replace(/'/g,''))}')"><span aria-hidden="true">📍</span> Localizar</button></div>`).join('')+'</div>';
}
function tcRenderContactsList(){const h=document.getElementById('tc-contacts-list-host');if(h)h.innerHTML=renderContactsList();}
window.tcRenderContactsList=tcRenderContactsList;
// Atualiza só a lista de atividades (não o ecrã todo) para o teclado não fechar ao escrever.
function tcRenderActivityTerminal(){const h=document.getElementById('tc-activity-terminal');if(h)h.innerHTML=terminalEvents(100);}
window.tcRenderActivityTerminal=tcRenderActivityTerminal;
// Pesquisa automática na Atividade: sem botões. Enquanto se escreve, filtra o terminal;
// assim que o número chega aos 9 dígitos, dispara o rastreio sozinho (uma vez por número).
function tcActivityInput(inp){
  const raw=String(inp&&inp.value||'');
  state.search=raw;
  tcRenderActivityTerminal();
  const digits=raw.replace(/\D/g,'');
  if(window.__tcActSearchT){clearTimeout(window.__tcActSearchT);window.__tcActSearchT=null;}
  if(digits.length>=9){
    // Dispara sozinho ao completar 9+ dígitos (MZ ou internacional). Debounce de 600ms
    // para números longos (com indicativo de país) só pesquisarem quando a pessoa pára.
    window.__tcActSearchT=setTimeout(function(){
      if(window.__tcLastAutoSearch!==digits){ window.__tcLastAutoSearch=digits; try{ lookupContact(raw); }catch(_){} }
    },600);
  } else {
    window.__tcLastAutoSearch='';
  }
}
window.tcActivityInput=tcActivityInput;
// Abas no topo dos Contactos: Mensagens, Chamadas e Lixo (SMS ocultadas/apagadas).
function contactsTopTabs(){
  const delCount=(state.messages||[]).filter(m=>(m.deleted||m.hidden)&&tcIsSms(m)).length;
  // Fica EM BAIXO, abaixo da lista de contactos, para não atrapalhar. Ícones reais
  // (SVG) para Mensagens e Chamadas; o Lixo mantém o caixote.
  const p=state.page;
  const bMsg=p==='messages'?'':`<button class="ctab" onclick="go('messages')"><span class="ctab-ic ctab-svg"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 3V6a1 1 0 0 1 1-1Z"/><path d="M8 9.5h8M8 12.5h5"/></svg></span><span class="ctab-t"><b>Mensagens</b><small>Recebidas e enviadas</small></span></button>`;
  const bCall=p==='calls'?'':`<button class="ctab" onclick="go('calls')"><span class="ctab-ic ctab-svg"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h3l1.5 4-2 1.5a12 12 0 0 0 5 5l1.5-2 4 1.5v3a1.6 1.6 0 0 1-1.7 1.6A15 15 0 0 1 3.4 5.7 1.6 1.6 0 0 1 5 4Z"/></svg></span><span class="ctab-t"><b>Chamadas</b><small>Recebidas e efetuadas</small></span></button>`;
  const bSoc=p==='whatsapp'?'':`<button class="ctab" onclick="go('whatsapp')"><span class="ctab-ic ctab-svg">${tcIcon('social')}</span><span class="ctab-t"><b>Redes sociais</b><small>WhatsApp, Messenger, Telegram…</small></span></button>`;
  const bLixo=`<button class="ctab ctab-trash" onclick="openLixo()"><span class="ctab-ic">🗑️</span><span class="ctab-t"><b>Lixo</b><small>Ocultadas e apagadas</small></span>${delCount?`<em class="ctab-badge">${delCount>99?'99+':delCount}</em>`:''}</button>`;
  return `<div class="contacts-bottom-tabs"><div class="cbt-sep"></div>${bMsg}${bCall}${bSoc}${bLixo}</div>`;
}
async function openLixo(){
  const old=document.getElementById('tc-lixo-overlay');if(old)old.remove();
  const el=document.createElement('div');el.id='tc-lixo-overlay';el.className='tc-lixo-overlay';
  el.innerHTML=`<div class="tc-lixo-box" onclick="event.stopPropagation()"><div class="tc-lixo-head"><div><div class="section-kicker" style="color:#ff7a7a">LIXO</div><h3>SMS ocultadas e apagadas</h3></div><button class="tc-lixo-close" aria-label="Fechar" onclick="document.getElementById('tc-lixo-overlay').remove()">×</button></div><div class="tc-lixo-body" id="tc-lixo-body"><div class="fx-loading" style="padding:30px;text-align:center;color:#9fb3d6">A carregar…</div></div></div>`;
  el.onclick=()=>el.remove();
  document.body.appendChild(el);
  if(!(state.messages&&state.messages.length)){try{await loadMessages()}catch(_){}}
  const body=document.getElementById('tc-lixo-body');if(!body)return;
  const del=(state.messages||[]).filter(m=>(m.deleted||m.hidden)&&tcIsSms(m));
  if(!del.length){body.innerHTML='<div class="terminal-empty" style="padding:30px">Sem SMS ocultadas ou apagadas. Aparecem aqui quando a criança apagar ou esconder uma mensagem.</div>';return}
  try{tcEnsureGroupStyles()}catch(_){}
  body.className='tc-lixo-body msg-seq-terminal';
  body.innerHTML=tcRenderGroups(tcCommGroups(del,m=>m.address,()=>'',tcMsgTime),true,true);
}
window.openLixo=openLixo;window.contactsTopTabs=contactsTopTabs;
function tcUsageFmt(m){m=Number(m||0);if(m<60)return m+' min';const h=Math.floor(m/60),mm=m%60;return h+'h '+mm+'m'}
function renderAppsList(){if(!state.appsList||!state.appsList.length)return '<div class="terminal-empty">[TC::WAIT] 0x0000 :: SEM APPS SINCRONIZADAS</div>';return '<table class="table"><tr><th>Aplicativo</th><th>Pacote</th><th>Uso (24h)</th></tr>'+state.appsList.map(a=>`<tr><td>${esc(a.label||'—')}</td><td style="color:#7891a5;font-size:11px">${esc(a.package||'')}</td><td>${a.usage_minutes?tcUsageFmt(a.usage_minutes):'—'}</td></tr>`).join('')+'</table>'}
function tcFmtWhen(ms){try{return new Date(Number(ms||0)).toLocaleString('pt-PT')}catch(_){return ''}}
function tcFmtDur(s){s=Number(s||0);const m=Math.floor(s/60),ss=s%60;return m?(m+'m '+ss+'s'):(ss+'s')}
function tcMsgTime(m){const e=Number(m&&m.epoch_ms||0);if(e>0)return e;const s=m&&(m.sent_at||m.created_at);const t=s?Date.parse(s):0;return isNaN(t)?0:t}
function tcCallTime(c){const e=Number(c&&c.epoch_ms||0);if(e>0)return e;const s=c&&(c.called_at||c.created_at);const t=s?Date.parse(s):0;return isNaN(t)?0:t}
// Todos os IDs de dispositivo da MESMA pessoa ativa (cobre re-vínculos),
// para mostrar sempre mensagens/chamadas antigas E recentes.
function tcActivePersonDeviceIds(){
  const ds=state.devices||[];const a=ds[0];if(!a)return [];
  const key=tcSwitchKey(a);
  const ids=ds.filter(d=>tcSwitchKey(d)===key).map(d=>d.id).filter(Boolean);
  return ids.length?ids:(a.id?[a.id]:[]);
}
async function loadMessages(){if(!window.TC_DB?.enabled||!window.TC_DB.client)return;try{const ids=tcActivePersonDeviceIds();let q=window.TC_DB.client.from('messages').select('*').order('epoch_ms',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false}).limit(1000);if(ids.length)q=q.in('device_id',ids);const {data}=await q;state.messages=(data||[]).sort((a,b)=>tcMsgTime(b)-tcMsgTime(a));ensureCommsRealtime();if(state.page==='messages')render()}catch(e){console.warn('loadMessages',e&&e.message)}}
async function loadCalls(){if(!window.TC_DB?.enabled||!window.TC_DB.client)return;try{const ids=tcActivePersonDeviceIds();let q=window.TC_DB.client.from('calls').select('*').order('epoch_ms',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false}).limit(1000);if(ids.length)q=q.in('device_id',ids);const {data}=await q;state.calls=(data||[]).sort((a,b)=>tcCallTime(b)-tcCallTime(a));ensureCommsRealtime();if(state.page==='calls')render()}catch(e){console.warn('loadCalls',e&&e.message)}}
function ensureCommsRealtime(){if(state.commsSub||!window.TC_DB?.enabled||!window.TC_DB.client)return;try{state.commsSub=true;window.TC_DB.client.channel('tc-comms').on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},p=>{const ids=tcActivePersonDeviceIds();if(p.new&&p.new.id&&(!ids.length||ids.includes(p.new.device_id))&&!state.messages.some(m=>m.id===p.new.id)){state.messages.unshift(p.new);state.messages.sort((a,b)=>tcMsgTime(b)-tcMsgTime(a));state.messages=state.messages.slice(0,1000);if(state.page==='messages')render()}}).on('postgres_changes',{event:'INSERT',schema:'public',table:'calls'},p=>{const ids=tcActivePersonDeviceIds();if(p.new&&p.new.id&&(!ids.length||ids.includes(p.new.device_id))&&!state.calls.some(c=>c.id===p.new.id)){state.calls.unshift(p.new);state.calls.sort((a,b)=>tcCallTime(b)-tcCallTime(a));state.calls=state.calls.slice(0,1000);if(state.page==='calls')render()}}).subscribe()}catch(e){state.commsSub=false;console.warn('comms realtime',e&&e.message)}}
function tcNormNum(x){return String(x||'').replace(/[^0-9+]/g,'').slice(-9)}
function tcContactName(number){const k=tcNormNum(number);if(!k)return '';const list=state.contactsList||[];for(const c of list){if(tcNormNum(c.number)===k&&c.name)return c.name}const st=state.contactStats||[];for(const s of st){if(tcNormNum(s.number)===k&&s.name)return s.name}const cl=state.calls||[];for(const c of cl){if(tcNormNum(c.number)===k&&c.name)return c.name}return ''}
function tcEnsureGroupStyles(){if(document.getElementById('tc-group-style'))return;const st=document.createElement('style');st.id='tc-group-style';st.textContent='.msg-seq-terminal{max-height:56vh;padding:10px;font-family:Inter,system-ui,-apple-system,sans-serif;box-shadow:none}.comm-groups{display:flex;flex-direction:column;gap:8px;width:100%;max-width:100%;font-family:Inter,system-ui,-apple-system,sans-serif}.comm-groups *,.comm-group,.comm-group *{box-sizing:border-box}.comm-group{max-width:100%;border:1px solid rgba(120,160,190,.22);border-radius:12px;overflow:hidden;background:rgba(12,28,44,.5)}.comm-group>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:10px;padding:10px 11px}.comm-group>summary::-webkit-details-marker{display:none}.comm-group-ava{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#1288e6,#36d1c4);color:#04121f;font-weight:800;font-size:14px;display:flex;align-items:center;justify-content:center;flex:none}.comm-group-main{flex:1;min-width:0}.comm-group-main b{display:block;font-size:13.5px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.comm-group-main small{display:block;color:#8aa6bd;font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.comm-group-prev{color:#7f98ac!important}.comm-group-meta{text-align:right;flex:none;max-width:42%}.comm-count{display:inline-block;background:#1288e6;color:#fff;font-weight:800;font-size:10.5px;border-radius:999px;padding:2px 8px;white-space:nowrap}.comm-group-meta small{display:block;color:#8aa6bd;font-size:9.5px;margin-top:4px;white-space:nowrap}.comm-group[open]>summary{border-bottom:1px solid rgba(120,160,190,.18)}.comm-group-body{padding:4px 10px 8px;max-height:260px;overflow:auto}.comm-group-body .comm-seq-row{display:flex;gap:8px;align-items:flex-start;padding:6px 2px;border-top:1px dashed rgba(120,160,190,.12)}.comm-group-body .comm-seq-row:first-child{border-top:0}.comm-seq-dir{font-size:9.5px;font-weight:800;color:#36d1c4;flex:none;min-width:58px}.comm-seq-row.out .comm-seq-dir{color:#f6c35b}.comm-group-body .comm-seq-main{flex:1;min-width:0}.comm-group-body .comm-seq-main p{margin:0;font-size:12.5px;line-height:1.45;word-break:break-word;overflow-wrap:anywhere;white-space:pre-wrap}.comm-seq-time{font-size:9.5px;color:#7f98ac;flex:none}.comm-msg-row{flex-direction:column;gap:3px}.comm-msg-row .comm-seq-head{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%}.comm-msg-row .comm-seq-dir{min-width:0}.comm-msg-row .comm-seq-time{font-size:10px;color:#8aa6bd}.comm-msg-row .comm-seq-main{width:100%}.messages-layout>*{min-width:0;max-width:100%}.messages-layout .card{overflow:hidden}.msg-seq-terminal{max-width:100%;overflow-x:hidden}.command-grid.two{max-width:100%}.command-grid.two .command{min-width:0;max-width:100%}.command-grid.two .command b,.command-grid.two .command small{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.messages-layout{grid-template-columns:1fr!important}@media(max-width:720px){.messages-layout{grid-template-columns:1fr!important}}.im-app-tag{display:inline-block;margin:2px 0;font-size:9.5px;font-weight:800;color:#dff6ff;background:rgba(120,160,190,.16);border:1px solid rgba(120,160,190,.32);border-radius:999px;padding:1px 7px;letter-spacing:.3px}.app-ic{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex:none;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.28)}.app-ic svg{width:21px;height:21px;display:block}.im-group>summary{align-items:center}';document.head.appendChild(st);}
function tcCommGroups(list,getNum,getName,getTime){const groups={};(list||[]).forEach(it=>{const num=getNum(it);const k=tcNormNum(num)||('x:'+String(num||'?'));(groups[k]=groups[k]||{number:num||'—',items:[]}).items.push(it)});const arr=Object.values(groups).map(g=>{g.items.sort((a,b)=>getTime(b)-getTime(a));g.last=g.items[0];g.name=getName(g.last)||tcContactName(g.number);return g});arr.sort((a,b)=>getTime(b.last)-getTime(a.last));return arr}
function tcGroupRows(items,isMsg){return items.map(it=>{if(isMsg){const sent=String(it.direction)==='ENVIADA';return `<div class="comm-seq-row comm-msg-row ${sent?'out':'in'}"><div class="comm-seq-head"><span class="comm-seq-dir">${sent?'▲ Enviada':'▼ Recebida'}</span><span class="comm-seq-time">${esc(tcFmtWhen(it.epoch_ms))}</span></div><div class="comm-seq-main"><p>${esc(it.body||'')}</p></div></div>`;}const out=String(it.direction)==='EFETUADA';return `<div class="comm-seq-row ${out?'out':'in'}"><span class="comm-seq-dir">${out?'▲ Efetuada':'▼ Recebida'}</span><div class="comm-seq-main"><p>Duração: ${esc(typeof tcFmtDur==='function'?tcFmtDur(it.duration_s):(it.duration_s||0)+'s')}</p></div><span class="comm-seq-time">${esc(tcFmtWhen(it.epoch_ms))}</span></div>`;}).join('');}
function tcRenderGroups(groups,isMsg,red){if(!groups.length)return '<div class="terminal-empty" style="padding:18px">Nenhum registo encontrado.</div>';return '<div class="comm-groups">'+groups.map(g=>{const title=esc(g.name||g.number||'—');const ini=esc((g.name||g.number||'?').trim().slice(0,1).toUpperCase()||'?');const prev=isMsg?esc((g.last.body||'').slice(0,64)):(g.items.length+' chamada'+(g.items.length===1?'':'s'));const badge=isMsg?(g.items.length+' msg'):(g.items.length+' ☎');return `<details class="comm-group"><summary><span class="comm-group-ava"${red?' style="background:linear-gradient(135deg,#c0152b,#7a0f1e)"':''}>${ini}</span><div class="comm-group-main"><b>${title}</b>${g.name?`<small>${esc(g.number)}</small>`:''}<small class="comm-group-prev">${prev}</small></div><div class="comm-group-meta"><span class="comm-count"${red?' style="background:#c0152b"':''}>${red?(g.items.length+' 🗑'):badge}</span><small>${esc(tcFmtWhen(g.last.epoch_ms))}</small></div></summary><div class="comm-group-body">${tcGroupRows(g.items,isMsg)}</div></details>`;}).join('')+'</div>';}
function renderDeletedMsgList(){const del=(state.messages||[]).filter(m=>m.deleted&&m.app!=='whatsapp');if(!del.length)return '';tcEnsureGroupStyles();const groups=tcCommGroups(del,m=>m.address,()=>'',tcMsgTime);return `<div class="card" style="margin-top:14px"><div class="section-head"><div><div class="section-kicker" style="color:#ff7a7a">APAGADAS</div><h3>Mensagens apagadas <span style="background:#c0152b;color:#fff;border-radius:999px;font-size:12px;padding:2px 9px;margin-left:6px">${del.length}</span></h3><p class="muted">SMS que foram apagadas do telemóvel da criança ficam guardadas aqui.</p></div></div><div class="msg-seq-terminal" style="margin-top:8px">${tcRenderGroups(groups,true,true)}</div></div>`;}
// Pacote (ex.: org.telegram.messenger) → chave da app. Robusto: funciona mesmo que a base
// de dados grave tudo como 'whatsapp', porque lemos o pacote REAL do source_id.
function tcPkgToApp(pkg){pkg=String(pkg||'').toLowerCase();
  const map={'com.whatsapp':'whatsapp','com.whatsapp.w4b':'whatsapp business','org.telegram.messenger':'telegram','org.thunderdog.challegram':'telegram','com.facebook.orca':'messenger','com.facebook.mlite':'messenger','com.facebook.katana':'facebook','com.instagram.android':'instagram','org.thoughtcrime.securesms':'signal','com.viber.voip':'viber','com.imo.android.imoim':'imo','com.imo.android.imoimbeta':'imo','com.snapchat.android':'snapchat','com.zhiliaoapp.musically':'tiktok','com.ss.android.ugc.trill':'tiktok','com.twitter.android':'twitter','com.discord':'discord','jp.naver.line.android':'line','com.tencent.mm':'wechat','com.skype.raider':'skype','kik.android':'kik','com.google.android.gm':'gmail','com.microsoft.office.outlook':'outlook'};
  if(map[pkg])return map[pkg];
  const keys=['whatsapp','telegram','messenger','instagram','signal','viber','snapchat','tiktok','discord','wechat','skype','facebook','line'];
  for(const k of keys){if(pkg.indexOf(k)>=0)return k;}
  return '';
}
// Nome curto a partir do pacote (quando a app não é conhecida): ex. "mz.co.emola" → "emola".
function tcPkgName(pkg){pkg=String(pkg||'').toLowerCase();if(!pkg)return '';
  const skip={com:1,org:1,net:1,android:1,app:1,apps:1,mobile:1,co:1,mz:1,io:1,me:1,www:1,client:1,messaging:1,chat:1};
  const parts=pkg.split('.').filter(p=>p&&!skip[p]);
  return (parts.length?parts[parts.length-1]:pkg.split('.').pop())||pkg;
}
// App REAL de uma mensagem: primeiro pelo pacote no source_id (fiável, sem depender do SQL),
// depois pela coluna 'app'. Para pacotes desconhecidos (ex.: Emola, bancos) usa o nome do pacote
// em vez de assumir 'whatsapp'.
function tcMsgApp(m){
  const sid=String((m&&(m.source_id||m.id))||'');
  const i=sid.indexOf('|');
  if(i>0){const pkg=sid.slice(0,i);const a=tcPkgToApp(pkg);if(a)return a;const nm=tcPkgName(pkg);if(nm)return nm;}
  const a=String((m&&m.app)||'').toLowerCase();
  return (a&&a!=='sms')?a:(a||'whatsapp');
}
// Apps que contam como REDES SOCIAIS (ficam no painel Redes sociais). Tudo o resto
// (SMS e notificações de apps não-sociais como Emola, bancos, serviços) é "mensagem normal".
const TC_SOCIAL_APPS=['whatsapp','whatsapp business','telegram','messenger','instagram','signal','viber','snapchat','tiktok','twitter','x','discord','line','wechat','skype','facebook','imo','kik','botim','hangouts'];
function tcIsSocialMsg(m){
  const sid=String((m&&(m.source_id||m.id))||'');
  const i=sid.indexOf('|');
  let key='';
  if(i>0)key=tcPkgToApp(sid.slice(0,i)); // só reconhece pacotes de redes sociais
  if(!key){const a=String((m&&m.app)||'').toLowerCase();if(a&&a!=='sms')key=a;}
  return TC_SOCIAL_APPS.indexOf(key)>=0;
}
// Mensagem "normal": SMS reais + notificações de apps NÃO sociais (Emola, bancos…). Vão todas
// para "Mensagens recebidas". Só as redes sociais reconhecidas ficam no painel Redes sociais.
function tcIsSms(m){ return !tcIsSocialMsg(m); }
function tcImAppName(a){a=String(a||'').toLowerCase();const m={whatsapp:'WhatsApp','whatsapp business':'WhatsApp Business',telegram:'Telegram',messenger:'Messenger',instagram:'Instagram',signal:'Signal',imo:'imo',viber:'Viber',snapchat:'Snapchat',tiktok:'TikTok',twitter:'X',x:'X',discord:'Discord',line:'LINE',wechat:'WeChat',skype:'Skype',kik:'Kik',botim:'Botim',hangouts:'Hangouts',gmail:'Gmail',outlook:'Outlook',facebook:'Facebook'};return m[a]||(a?a.charAt(0).toUpperCase()+a.slice(1):'App');}
// Ícone real (marca) de cada rede social / app de mensagens.
function tcAppIcon(a){a=String(a||'').toLowerCase();
  const w=(bg,svg)=>`<span class="app-ic" style="background:${bg}">${svg}</span>`;
  if(a.indexOf('whatsapp')>=0)return w('#25D366','<svg viewBox="0 0 24 24" fill="#fff"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.9 14.1c-.25.7-1.45 1.33-2 1.41-.53.08-1.2.11-1.94-.12-.45-.14-1.02-.33-1.76-.65-3.1-1.34-5.12-4.46-5.28-4.67-.15-.21-1.26-1.67-1.26-3.19s.8-2.26 1.08-2.57c.28-.31.61-.39.82-.39h.59c.19 0 .44-.07.69.53l.84 2.04c.07.14.11.31.02.5l-.31.63c-.09.19-.2.3-.09.52.11.21.63 1.04 1.36 1.68.93.83 1.72 1.09 1.96 1.21.24.12.38.1.52-.06l.74-.86c.19-.22.38-.18.64-.09l1.83.86c.26.12.43.18.49.28.07.11.07.63-.18 1.33Z"/></svg>');
  if(a.indexOf('messenger')>=0)return w('radial-gradient(circle at 30% 20%,#00B2FF,#006AFF 60%,#A033FF)','<svg viewBox="0 0 24 24" fill="#fff"><path d="M12 2C6.2 2 2 6.3 2 11.8c0 2.9 1.2 5.5 3.2 7.2V22l3-1.6c.9.25 1.84.38 2.8.38 5.8 0 10-4.3 10-9.8S17.8 2 12 2Zm1.1 13.1-2.6-2.8-4.9 2.8 5.4-5.7 2.6 2.7 4.8-2.7-5.3 5.7Z"/></svg>');
  if(a.indexOf('telegram')>=0)return w('linear-gradient(180deg,#37aee2,#1e96c8)','<svg viewBox="0 0 24 24" fill="#fff"><path d="M21.9 4.6 18.5 20c-.25 1.1-.92 1.36-1.86.85l-5.1-3.76-2.46 2.37c-.27.27-.5.5-1.02.5l.36-5.14 9.36-8.46c.4-.36-.09-.56-.63-.2L5.56 13.1.6 11.5c-1.08-.33-1.1-1.07.22-1.58L20.5 3.1c.9-.33 1.69.21 1.4 1.5Z"/></svg>');
  if(a.indexOf('instagram')>=0)return w('linear-gradient(45deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5)','<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.1"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1.1" fill="#fff" stroke="none"/></svg>');
  if(a.indexOf('signal')>=0)return w('#2592e9','<svg viewBox="0 0 24 24" fill="#fff"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Z"/></svg>');
  if(a.indexOf('viber')>=0)return w('#7360f2','<svg viewBox="0 0 24 24" fill="#fff"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Z"/></svg>');
  if(a.indexOf('facebook')>=0)return w('#1877f2','<svg viewBox="0 0 24 24" fill="#fff"><path d="M14.5 9H16.5V6H14.5c-1.9 0-3.3 1.4-3.3 3.3V11H9v3h2.2v6h3.1v-6h2.2l.5-3h-2.7V9.4c0-.25.2-.4.45-.4Z"/></svg>');
  if(a.indexOf('tiktok')>=0)return w('#111','<svg viewBox="0 0 24 24" fill="#fff"><path d="M14 3c.4 2.3 1.9 3.9 4 4.2v3c-1.5 0-2.9-.5-4-1.3V15a5.5 5.5 0 1 1-5.5-5.5c.3 0 .6 0 .9.1v3.1c-.3-.1-.6-.2-.9-.2A2.5 2.5 0 1 0 11 15V3h3Z"/></svg>');
  if(a.indexOf('snapchat')>=0)return w('#FFFC00','<svg viewBox="0 0 24 24" fill="#111"><path d="M12 3c2.6 0 4 2 4 4.2 0 1 .1 1.8.1 1.8s.9-.4 1.4-.4.9.4.9.9-.6.8-1.3 1c-.5.2-1 .3-1 .8s1.4 2.3 3.4 2.9c.3.1.5.3.4.6-.1.5-1.6.8-2 1-.2.1-.2.4-.3.7-.1.3-.3.4-.7.3-.5-.1-1.1-.3-1.9-.1-.7.2-1.3 1.1-2.9 1.1s-2.2-.9-2.9-1.1c-.8-.2-1.4 0-1.9.1-.4.1-.6 0-.7-.3-.1-.3-.1-.6-.3-.7-.4-.2-1.9-.5-2-1-.1-.3.1-.5.4-.6 2-.6 3.4-2.4 3.4-2.9s-.5-.6-1-.8c-.7-.2-1.3-.5-1.3-1s.4-.9.9-.9 1.4.4 1.4.4 .1-.8.1-1.8C8 5 9.4 3 12 3Z"/></svg>');
  // Mensagem "normal" (app não reconhecida: Emola, bancos, serviços, etc.) — ícone de mensagem.
  return w('linear-gradient(135deg,#3a7bd5,#4a90e2)','<svg viewBox="0 0 24 24"><path fill="#fff" d="M4 4h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 3V5a1 1 0 0 1 1-1Z"/><path d="M7 8.3h10M7 11.3h6" stroke="#3a7bd5" stroke-width="1.7" stroke-linecap="round" fill="none"/></svg>');
}
function renderMsgList(){const msgs=(state.messages||[]).filter(m=>!m.deleted&&tcIsSms(m));if(!msgs.length)return '<div class="terminal-empty">[TC::WAIT] 0x0000 :: SEM MENSAGENS SINCRONIZADAS</div>';tcEnsureGroupStyles();return tcRenderGroups(tcCommGroups(msgs,m=>m.address,()=>'',tcMsgTime),true);}
// Lista de TODAS as apps de mensagens (não só WhatsApp). Agrupa por app + remetente e
// mostra o nome da app em cada conversa.
function renderWhatsAppList(){
  const msgs=(state.messages||[]).filter(m=>!m.deleted&&!tcIsSms(m));
  if(!msgs.length)return '<div class="terminal-empty">Sem mensagens de apps ainda. No aplicativo da criança, ative o «Acesso às notificações» para ler todas as apps de mensagens.</div>';
  tcEnsureGroupStyles();
  const groups={};
  msgs.forEach(m=>{const app=tcMsgApp(m);const who=(m.address||'—');const k=app+'|'+who;(groups[k]=groups[k]||{app:app,who:who,items:[]}).items.push(m);});
  const arr=Object.values(groups).map(g=>{g.items.sort((a,b)=>tcMsgTime(b)-tcMsgTime(a));g.last=g.items[0];return g;});
  arr.sort((a,b)=>tcMsgTime(b.last)-tcMsgTime(a.last));
  return '<div class="comm-groups">'+arr.map(g=>{const appName=esc(tcImAppName(g.app));const prev=esc((g.last.body||'').slice(0,64));return `<details class="comm-group im-group"><summary>${tcAppIcon(g.app)}<div class="comm-group-main"><b>${esc(g.who)}</b><small class="im-app-tag">${appName}</small><small class="comm-group-prev">${prev}</small></div><div class="comm-group-meta"><span class="comm-count">${g.items.length} msg</span><small>${esc(tcFmtWhen(g.last.epoch_ms))}</small></div></summary><div class="comm-group-body">${tcGroupRows(g.items,true)}</div></details>`;}).join('')+'</div>';
}
function renderCallList(){if(!state.calls||!state.calls.length)return '<div class="terminal-empty">[TC::WAIT] 0x0000 :: SEM CHAMADAS SINCRONIZADAS</div>';tcEnsureGroupStyles();return tcRenderGroups(tcCommGroups(state.calls,c=>c.number,c=>c.name,tcCallTime),false);}
function tcEye(cls){return `<div class="tcbe ${cls||''}"><svg viewBox="0 0 120 72" role="img" aria-label="T-Connect"><defs><radialGradient id="tcIrisG" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#d4f5ff"/><stop offset="35%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#0a6fb0"/></radialGradient><clipPath id="tcEyeClip"><path d="M60 8 C92 8 114 36 114 36 C114 36 92 64 60 64 C28 64 6 36 6 36 C6 36 28 8 60 8 Z"/></clipPath></defs><path class="tcbe-outline" d="M60 8 C92 8 114 36 114 36 C114 36 92 64 60 64 C28 64 6 36 6 36 C6 36 28 8 60 8 Z"/><g clip-path="url(#tcEyeClip)"><rect x="0" y="0" width="120" height="72" fill="#02121f"/><g class="tcbe-ball"><circle class="tcbe-iris" cx="60" cy="36" r="20" fill="url(#tcIrisG)"/><circle cx="60" cy="36" r="9" fill="#02121f"/><circle cx="54" cy="30" r="3.2" fill="#eafaff"/></g><rect class="tcbe-laser" x="-6" y="0" width="6" height="72"/></g><path class="tcbe-lid" d="M60 8 C92 8 114 36 114 36 C114 36 92 64 60 64 C28 64 6 36 6 36 C6 36 28 8 60 8 Z"/></svg></div>`}
let tcNav=[];
// ---- Pedidos de vínculo por e-mail (aprovação pelo Guardian) ----
function pairRequestsCard(){
  const reqs=state.pairRequests||[];
  if(!reqs.length)return '';
  return `<div class="pair-requests"><div class="section-head"><div><div class="section-kicker" style="color:#ffd166">PEDIDOS DE VÍNCULO</div><h3>Pedidos por e-mail <span class="pair-req-badge">${reqs.length}</span></h3><p class="muted">Dispositivos a pedir vínculo com a sua conta. Aprove para começar a acompanhar.</p></div></div><div class="pair-req-list">${reqs.map(r=>`<div class="pair-req"><div class="pair-req-info"><span class="pair-req-ic">✉</span><div><b>${esc(r.device_name||'Dispositivo')}</b><small>${esc(r.child_email||'')}</small></div></div><div class="pair-req-actions"><button class="btn primary" onclick="approvePairRequest('${esc(r.id)}',true)">Aprovar</button><button class="btn" onclick="approvePairRequest('${esc(r.id)}',false)">Rejeitar</button></div></div>`).join('')}</div></div>`;
}
async function loadPairRequests(){
  if(!window.TC_DB?.enabled||!window.TC_DB.client)return;
  try{
    const {data,error}=await window.TC_DB.client.rpc('list_pairing_requests');
    if(error)throw error;
    const js=JSON.stringify(data||[]);
    if(js!==state.__pairReqJson){state.__pairReqJson=js;state.pairRequests=data||[];if(state.page==='devices')render();}
  }catch(e){/* função ainda não instalada no Supabase: ignora */}
}
window.loadPairRequests=loadPairRequests;
async function approvePairRequest(id,approve){
  if(!window.TC_DB?.client)return;
  // Ao APROVAR, respeita o limite de dispositivos do plano (Familiar=5, Premium/Anual=20).
  if(approve && !tcCanLinkMore()){
    state.pairingMessage='O seu plano '+planLabel(userPlanId()||'familiar')+' permite até '+planDeviceLimitLabel()+' dispositivos e já tem '+tcLinkedDeviceCount()+'. Rejeite ou atualize o plano para ligar mais.';
    try{render()}catch(_){}
    return;
  }
  try{
    const {error}=await window.TC_DB.client.rpc('approve_pairing_request',{p_request_id:id,p_approve:!!approve});
    if(error)throw error;
    addEvent('VINCULAÇÃO',approve?'Pedido de vínculo por e-mail aprovado.':'Pedido de vínculo por e-mail rejeitado.',{status:approve?'AUTORIZADO':'RECUSADO',source:'Guardian'});
    state.__pairReqJson='';await loadPairRequests();
    try{state.devices=await tcDevices()}catch(_){}applyActiveOrder();
    render();
  }catch(e){alert('Não foi possível concluir o pedido: '+(e.message||'erro'))}
}
window.approvePairRequest=approvePairRequest;
function go(p,fromBack){
  if(!fromBack&&p!==state.page){tcNav.push(state.page);if(tcNav.length>60)tcNav.shift();}
  // Regista a navegação no terminal de atividades (em tempo real, sem ir à base de dados).
  if(p!==state.page){const nomes={overview:'Monitoramento',activity:'Atividades',status:'Estado',map:'Localização',messages:'Mensagens',calls:'Chamadas',contacts:'Contatos',apps:'Aplicativos',screen:'Câmera',permissions:'Permissões',devices:'Dispositivos',admin:'Super Admin',settings:'Definições'};const ev=normalizeEvent({type:'NAVEGACAO',detail:'Abriu '+(nomes[p]||p),status:'OK',source:'Guardian'});state.events.unshift(ev);state.events=state.events.slice(0,200);}
  if(p!=='admin')state.adminUserView=null;
  state.page=p;state.menuOpen=false;render();if(p==='messages'){loadContacts();loadMessages();}if(p==='whatsapp')loadMessages();if(p==='calls'){loadContacts();loadCalls();}if(p==='contacts'){loadContacts();loadCalls();loadMessages();}if(p==='apps')loadApps();if(p==='settings'){try{checkForUpdates(true)}catch(_){}}if(p==='devices'){loadPairRequests();if(!window.__tcPairReqTimer)window.__tcPairReqTimer=setInterval(()=>{if(state.page==='devices')loadPairRequests()},15000);}
  // Ao abrir o Super Admin, refresca planos/subscrições do Supabase.
  if(p==='admin'&&typeof syncAdminFromSupabase==='function')syncAdminFromSupabase();
}
function toggleMenu(){state.menuOpen=!state.menuOpen;render()}
function closeMenu(){if(state.menuOpen){state.menuOpen=false;render()}}
function title(){return ({overview:'Monitoramento',activity:'Atividades',map:t('locationMap'),messages:t('messageCapture'),calls:t('callHistory'),contacts:'Contatos',apps:'Aplicativos',screen:t('screenCapture'),permissions:t('childPermissions'),devices:t('childDevices'),admin:'Super Admin',settings:t('definitions')}[state.page])||'Monitoramento'}
function eventBadge(status){const cls=String(status).toLowerCase().replace(/[^a-z]/g,'-');return `<span class="status-badge ${cls}">${esc(status)}</span>`}
async function verifyPermission(name){
  if(!state.permissionChecks)state.permissionChecks={};
  const key=String(name||'').trim();
  state.permissionChecks[key]={status:'PROCESSANDO',detail:'Verificando permissão…'}; render();
  let status='PENDENTE', detail='A permissão ainda não foi concedida.';
  try{
    // No APK Android, consulta o estado REAL das permissões do sistema e, se preciso,
    // pede a permissão nativa — é assim que as permissões funcionam com o Android.
    const nativeKey={'Localização':'location','Notificações':'notifications','Microfone':'microphone','Câmera':'camera','Câmara':'camera','SMS / mensagens':'sms','Captura de tela':'screen'}[key];
    if(window.TCNativePermissions && nativeKey){
      let st={};
      try{const raw=window.TCNativePermissions.getStatus?.();st=raw?(typeof raw==='string'?JSON.parse(raw):raw):{};}catch(_){ }
      if(st[nativeKey]){status='ATIVA';detail='Permissão concedida no Android.';}
      else{
        // Pede a permissão nativa adequada.
        try{
          if(nativeKey==='camera'&&window.TCNativePermissions.requestCamera)window.TCNativePermissions.requestCamera();
          else if(nativeKey==='microphone'&&window.TCNativePermissions.requestMicrophone)window.TCNativePermissions.requestMicrophone();
          else if(window.TCNativePermissions.requestAll)window.TCNativePermissions.requestAll();
        }catch(_){}
        status='PENDENTE';detail='A pedir a permissão ao Android. Confirme no diálogo do sistema.';
      }
      state.permissionChecks[key]={status,detail};
      await addEvent('PERMISSÃO',`${key} · verificação Android`,{status,source:'Android'});
      render();return;
    }
    const map={
      'Localização':'geolocation',
      'Notificações':'notifications',
      'Microfone':'microphone',
      'Câmara':'camera'
    };
    const permName=map[key];
    if(permName && navigator.permissions?.query){
      const result=await navigator.permissions.query({name:permName});
      if(result.state==='granted'){status='ATIVA';detail='Permissão concedida neste navegador/dispositivo.';}
      else if(result.state==='denied'){status='BLOQUEADA';detail='Permissão bloqueada. Altere-a nas definições do navegador/Android.';}
      else {status='PENDENTE';detail='Permissão ainda não concedida. A solicitação será feita somente pela função que precisar dela.';}
    }else if(key==='SMS / mensagens'){
      status='INDISPONÍVEL';detail='A Web/PWA não pode verificar SMS diretamente. É necessária uma API Android autorizada.';
    }else if(key==='Captura de tela'){
      status='PENDENTE';detail='A captura exige autorização explícita do sistema Android no momento da captura.';
    }else{
      status='INDISPONÍVEL';detail='Este ambiente não expõe uma verificação automática para esta permissão.';
    }
  }catch(err){status='INDISPONÍVEL';detail=err?.message||'Não foi possível verificar esta permissão neste navegador.';}
  state.permissionChecks[key]={status,detail};
  await addEvent('PERMISSÃO',`${key} · verificação concluída`,{status,source:'Permission Check'});
  render();
}

function terminalEvents(limit=30,filter='all'){let ev=state.events;if(filter==='message')ev=ev.filter(e=>/mensagem|whatsapp/i.test(e.type));if(filter==='call')ev=ev.filter(e=>/chamada|call/i.test(e.type));if(filter==='screen')ev=ev.filter(e=>/captura de tela|screen|c[âa]mera|[áa]udio|proje[çc][ãa]o|captura|conexao|conex[ãa]o/i.test(e.type));if(state.search)ev=ev.filter(e=>`${e.type} ${e.detail} ${e.contact}`.toLowerCase().includes(state.search.toLowerCase()));if(!ev.length)return '<div class="terminal-empty">[TC::WAIT] 0x0000 :: AWAITING_AUTHORIZED_ACTIVITY</div>';return ev.slice(0,limit).map((e,i)=>terminalCodeLine(e,i)).join('')}
function terminalHash(e,i=0){const raw=`${e.id||''}|${e.type||''}|${e.at||''}|${i}`;let h=2166136261;for(let n=0;n<raw.length;n++){h^=raw.charCodeAt(n);h=Math.imul(h,16777619)}return (h>>>0).toString(16).toUpperCase().padStart(8,'0')}
function terminalCodeLine(e,i=0){const type=String(e.type||'EVENT').toUpperCase().replace(/[^A-Z0-9_]/g,'_').slice(0,14);const status=String(e.status||'OK').toUpperCase().replace(/[^A-Z0-9_]/g,'_').slice(0,12);const code=terminalHash(e,i);const stamp=esc(e.at||'--:--:--');const dev=String(e.child_name||e.contact||deviceName()||'').slice(0,18);const devTag=dev?`<span class="code-dev">${esc(dev)}</span>`:'';return `<div class="code-line"><span class="code-time">[${stamp}]</span><span class="code-prefix">TC::</span><span class="code-op">${esc(type)}</span>${devTag}<span class="code-id">0x${code}</span><span class="code-status">${esc(status)}</span><span class="code-cursor">▮</span></div>`}
function mapTerminalEvents(limit=80){return (state.mapTerminalEvents||[]).slice(0,limit).map((e,i)=>terminalCodeLine(e,i)).join('')||'<div class="terminal-empty">[TC::MAP] 0x0000 :: AGUARDANDO_INTERAÇÃO</div>'}
function pushMapTerminal(type,detail,status='OK',meta={}){const e=normalizeEvent({type,detail,status,source:'Map Terminal',...meta});state.mapTerminalEvents=state.mapTerminalEvents||[];state.mapTerminalEvents.unshift(e);state.mapTerminalEvents=state.mapTerminalEvents.slice(0,200);try{localStorage.setItem('tc_map_terminal_events',JSON.stringify(state.mapTerminalEvents))}catch(_){};const el=document.querySelector('.location-code-terminal');if(el){const row=document.createElement('div');row.innerHTML=terminalCodeLine(e,0);if(row.firstElementChild){el.prepend(row.firstElementChild);while(el.children.length>80)el.removeChild(el.lastElementChild)}}}
function refreshApplication(){try{if('serviceWorker' in navigator){navigator.serviceWorker.getRegistration().then(r=>r&&r.update()).catch(()=>{});}}catch(_){} setTimeout(()=>location.reload(),120)}
async function refreshMonitoring(){
  if(state.monitorRefreshing)return;
  state.monitorRefreshing=true;
  updateMonitorRefreshUI();
  try{
    pushMapTerminal('MONITORAMENTO','ATUALIZACAO_SOLICITADA','PROCESSANDO',{detail:'Atualização completa do painel'});
    // Atualiza os dados sem destruir a sessão. Em seguida refaz a interface e
    // reconstrói apenas o mapa necessário, sem exigir fechar/reabrir o aplicativo.
    if('serviceWorker' in navigator){ try{ const reg=await navigator.serviceWorker.getRegistration(); if(reg) reg.update().catch(()=>{}); }catch(_){} }
    if(window.TC_DB?.enabled&&window.TC_DB?.user){
      const results=await Promise.allSettled([tcTimeout(tcDevices()),tcTimeout(tcLoadEvents())]);
      if(results[0].status==='fulfilled'&&Array.isArray(results[0].value)) state.devices=results[0].value; applyActiveOrder();
      if(results[1].status==='fulfilled'&&Array.isArray(results[1].value)){state.events=results[1].value;save();}
    }
    const wantedPage=state.page;
    const wantedMap=state.mapType;
    render();
    if(state.page===wantedPage && ['overview','map'].includes(wantedPage)){
      setTimeout(()=>{ try{ window.TC_MAP?.refresh?.(); window.TC_MAP?.setType?.(wantedMap); }catch(_){} },80);
    }
    pushMapTerminal('MONITORAMENTO','ATUALIZACAO_CONCLUIDA','OK',{detail:'Dados, interface e mapa atualizados sem fechar o aplicativo'});
  }catch(e){
    console.warn('Atualizar monitoramento:',e);
    pushMapTerminal('MONITORAMENTO','ATUALIZACAO_ERRO','ERRO',{detail:e?.message||'Falha na atualização'});
  }finally{
    state.monitorRefreshing=false;
    updateMonitorRefreshUI();
  }
}
function updateMonitorRefreshUI(){
  const btn=document.querySelector('.monitor-refresh-inline, .monitor-refresh-btn');
  if(!btn)return;
  const loading=!!state.monitorRefreshing;
  btn.disabled=loading;
  btn.classList.toggle('is-loading',loading);
  // O rótulo "Atualizar/Atualizando…" é o primeiro <b> dentro do botão, seja no
  // layout inline (.refresh-inline-icon + <span><b>) ou no antigo (.refresh-copy b).
  const b=btn.querySelector('.refresh-copy b')||btn.querySelector('b'); if(b)b.textContent=loading?'Atualizando…':'Atualizar';
  const glyph=btn.querySelector('.refresh-glyph')||btn.querySelector('.refresh-inline-icon'); if(glyph)glyph.setAttribute('aria-label',loading?'Atualizando':'Atualizar');
}

window.tcMapTerminalEvent=(type,detail,status,meta)=>pushMapTerminal(type,detail,status,meta);
function authView(){
  if(state.authMode==='signup')return `<div class="auth-page"><div class="auth-card">${languageSelect('top-lang')}${tcEye()}<div class="brand hero">T <span>CONNECT</span></div><div class="auth-tag">${esc(t('guardianAccount'))}</div><h1>${esc(t('signupTitle'))}</h1><p class="muted">${esc(t('signupDesc'))}</p>${state.authError?`<div class="auth-error" role="alert">${esc(state.authError)}</div>`:''}<form onsubmit="signup(event)"><label>${esc(t('name'))}<input name="name" required placeholder="${esc(t('fullName'))}"></label><label>${esc(t('email'))}<input name="email" type="email" required placeholder="guardian@email.com"></label><label>${esc(t('password'))}<input name="password" id="tc-signup-pwd" type="password" minlength="8" required placeholder="${esc(t('minPassword'))}" oninput="tcPwdStrength(this.value)"></label><div id="tc-pwd-meter" class="tc-pwd-meter"><div class="tc-pwd-bar"><i></i></div><small class="tc-pwd-label"></small></div><label>Confirmar senha<input name="confirmPassword" type="password" minlength="8" required placeholder="Repita a senha" oninput="tcPwdMatch(this.value)"></label><small id="tc-pwd-match" class="tc-pwd-match"></small><button class="btn primary wide" ${state.loading?'disabled':''}>${state.loading?esc(t('creating')):esc(t('createNow'))}</button></form><button class="text-btn" onclick="state.authMode='login';render()">${esc(t('backLogin'))}</button></div></div>`;
  if(state.authMode==='recover')return `<div class="auth-page"><div class="auth-card">${languageSelect('top-lang')}${tcEye()}<div class="brand hero">T <span>CONNECT</span></div><div class="auth-tag">${esc(t('guardianAccount'))}</div><h1>⚙️ Redefinir senha</h1><p class="muted">Escreva o seu e-mail e defina uma nova senha. Não é preciso confirmar por e-mail.</p>${state.authError?`<div class="auth-error" role="alert">${esc(state.authError)}</div>`:''}${state.recoverySent?`<div class="auth-success" role="status">Senha redefinida com sucesso.</div>`:''}<form onsubmit="resetPasswordDirect(event)"><label>E-mail<input name="email" type="email" required placeholder="guardian@email.com" autocomplete="email"></label><label>Nova senha<input name="password" id="tc-signup-pwd" type="password" minlength="8" required placeholder="Mínimo 8 caracteres" autocomplete="new-password" oninput="tcPwdStrength(this.value)"></label><div id="tc-pwd-meter" class="tc-pwd-meter"><div class="tc-pwd-bar"><i></i></div><small class="tc-pwd-label"></small></div><label>Confirmar nova senha<input name="confirmPassword" type="password" minlength="8" required placeholder="Repita a nova senha" autocomplete="new-password" oninput="tcPwdMatch(this.value)"></label><small id="tc-pwd-match" class="tc-pwd-match"></small><button class="btn primary wide" ${state.loading?'disabled':''}>${state.loading?'A redefinir…':'Redefinir senha'}</button></form><button class="text-btn" onclick="state.authMode='login';state.recoverySent=false;state.authError='';render()">‹ ${esc(t('backLogin'))}</button></div></div>`;
  if(state.authMode==='terms')return `<div class="auth-page"><div class="auth-card auth-terms">${languageSelect('top-lang')}<div class="brand hero">T <span>CONNECT</span></div><div class="auth-tag">TERMOS E CONDIÇÕES</div><h1>Antes de prosseguir</h1><p class="muted">Leia e aceite para criar a conta Guardian de ${esc(state.pendingSignup?.name||'')||'responsável'}.</p>${state.authError?`<div class="auth-error" role="alert">${esc(state.authError)}</div>`:''}<div class="terms-box" id="tc-terms-box">${tcTermsHtml()}</div><label class="terms-check"><input type="checkbox" id="tc-terms-agree" onchange="document.getElementById('tc-terms-go')&&(document.getElementById('tc-terms-go').disabled=!this.checked)"> Li e aceito os Termos e Condições.</label><div class="terms-actions"><button class="btn primary wide" id="tc-terms-go" disabled ${state.loading?'disabled':''} onclick="acceptTermsAndSignup()">${state.loading?'A criar conta…':'Aceito e prosseguir'}</button><button class="btn wide" onclick="declineTerms()">Não aceito</button></div></div></div>`;
  if(state.authMode==='recoverUpdate')return `<div class="auth-page"><div class="auth-card">${languageSelect('top-lang')}${tcEye()}<div class="brand hero">T <span>CONNECT</span></div><div class="auth-tag">${esc(t('guardianAccount'))}</div><h1>${esc(t('newPasswordTitle'))}</h1><p class="muted">${esc(t('newPasswordDesc'))}</p>${state.authError?`<div class="auth-error" role="alert">${esc(state.authError)}</div>`:''}<form onsubmit="updateRecoveredPassword(event)"><label>${esc(t('password'))}<input name="password" type="password" minlength="8" required placeholder="${esc(t('minPassword'))}" autocomplete="new-password"></label><label>${esc(t('confirmPassword'))}<input name="confirmPassword" type="password" minlength="8" required placeholder="${esc(t('confirmPasswordPlaceholder'))}" autocomplete="new-password"></label><button class="btn primary wide" ${state.loading?'disabled':''}>${state.loading?esc(t('savingPassword')):esc(t('savePassword'))}</button></form></div></div>`;
  return `<div class="auth-page"><div class="auth-card">${languageSelect('top-lang')}${tcEye()}<div class="brand hero">T <span>CONNECT</span></div><div class="auth-tag">${esc(t('familySafety'))}</div><h1>${esc(t('loginTitle'))}</h1><p class="muted">${esc(t('loginDesc'))}</p>${state.authError?`<div class="auth-error" role="alert">${esc(state.authError)}</div>`:''}<form onsubmit="login(event)"><label>${esc(t('email'))}<input name="email" type="email" required placeholder="guardian@email.com"></label><label>${esc(t('password'))}<input name="password" type="password" required placeholder="••••••••"></label><button class="btn primary wide" ${state.loading?'disabled':''}>${state.loading?esc(t('signingIn')):esc(t('login'))}</button></form><button class="text-btn recovery-link" onclick="state.authMode='recover';state.authError='';state.recoverySent=false;render()">⚙️ ${esc(t('recoverPassword'))}</button><button class="text-btn" onclick="state.authMode='signup';render()">${esc(t('noAccount'))} <b>${esc(t('signup'))}</b></button><div class="demo-note">${window.TC_DB?.enabled?esc(t('supabaseOn')):esc(t('localMode'))}</div></div></div>`;
}
function tcIcon(n){const p={
  overview:'<path d="M4 13h6V4H4zM14 20h6v-9h-6zM14 4v4h6V4zM4 20h6v-5H4z"/>',
  activity:'<path d="M3 12h4l2.5 6 4-15 2.5 9H21"/>',
  status:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 1.8"/>',
  map:'<path d="M12 21s7-6.2 7-12A7 7 0 0 0 5 9c0 5.8 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/>',
  contacts:'<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="10" r="2.3"/><path d="M8.5 16.5a3.5 3.5 0 0 1 7 0"/><path d="M3 7.5h2M3 12h2M3 16.5h2"/>',
  apps:'<rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/>',
  screen:'<rect x="3" y="7" width="13" height="10" rx="2"/><path d="m16 10 5-3v10l-5-3Z"/>',
  admin:'<path d="M12 3l7 3v5c0 4.6-3 8.3-7 10-4-1.7-7-5.4-7-10V6z"/><path d="m9 12 2 2 4-4"/>',
  settings:'<circle cx="12" cy="12" r="3.2"/><path d="M19.4 13.5a7.7 7.7 0 0 0 0-3l1.7-1.3-2-3.4-2 .8a7.6 7.6 0 0 0-2.6-1.5L14 2h-4l-.5 2.1a7.6 7.6 0 0 0-2.6 1.5l-2-.8-2 3.4 1.7 1.3a7.7 7.7 0 0 0 0 3L2.9 14.8l2 3.4 2-.8a7.6 7.6 0 0 0 2.6 1.5L10 21h4l.5-2.1a7.6 7.6 0 0 0 2.6-1.5l2 .8 2-3.4z"/>',
  support:'<path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 21l1.9-5.6A8.5 8.5 0 1 1 21 11.5Z"/>',
  logout:'<path d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4"/><path d="M10 16l-4-4 4-4"/><path d="M6 12h11"/>',
  whatsapp:'<path d="M20.5 11.5a8.5 8.5 0 0 1-12.5 7.5L3.5 20.5l1.5-4.5A8.5 8.5 0 1 1 20.5 11.5Z"/><path d="M9 8.5c0 3.6 2.9 6.5 6.5 6.5l.8-1.8-2.1-1-.9 1a5 5 0 0 1-2-2l1-.9-1-2.1z"/>',
  social:'<circle cx="7" cy="7" r="3"/><circle cx="17" cy="7" r="3"/><circle cx="12" cy="17" r="3"/><path d="M9.5 8.3 10.5 14.7M14.5 8.3 13.5 14.7M9.6 6.2h4.8"/>'
}[n]||'';return '<svg viewBox="0 0 24 24" class="nav-ic-svg" aria-hidden="true">'+p+'</svg>';}
function appShell(){const child=state.devices[0];const nav=[['overview',t('overview'),tcIcon('overview')],['activity',t('activity'),tcIcon('activity')],['status','Estado',tcIcon('status')],['map',t('location'),tcIcon('map')],['contacts','Contatos',tcIcon('contacts')],['apps','Apps',tcIcon('apps')],['whatsapp','Redes sociais',tcIcon('social')],['screen',t('screenCapture'),tcIcon('screen')],...(isSuperAdmin()?[['admin','Super Admin',tcIcon('admin')]]:[])];const menu=state.menuOpen?`<div class="mobile-menu-backdrop" onclick="closeMenu()"><aside class="mobile-menu" onclick="event.stopPropagation()"><div class="mobile-menu-head"><b>MENU</b><button class="icon-btn" aria-label="Fechar menu" onclick="closeMenu()">×</button></div><div class="nav">${nav.map(([k,v,i])=>`<button class="${state.page===k?'active':''}" onclick="go('${k}')"><i>${i}</i><span>${v}</span>${k==='activity'&&state.events.length?'<em>'+Math.min(state.events.length,99)+'</em>':''}</button>`).join('')}</div><div class="mobile-menu-sep"></div><button class="nav-link mobile-menu-link tc-support-link" onclick="tcOpenSupport()">${tcIcon('support')}<span>Falar com o suporte</span></button><button class="nav-link mobile-menu-link ${state.page==='settings'?'active':''}" onclick="go('settings')">${tcIcon('settings')}<span>${esc(t('settings'))}</span></button><button class="nav-link mobile-menu-link" onclick="logout()">${tcIcon('logout')}<span>${esc(t('logout'))}</span></button><div class="tc-ss-wm"><img src="../assets/icons/ss-team-logo.png" alt="SS TEAM" loading="lazy"></div></aside></div>`:'';return `${menu}<div class="shell"><aside class="side"><div class="brand"><span class="brand-mark">T</span><div><strong>T <span>CONNECT</span></strong><small>FAMILY SAFETY PLATFORM</small></div></div><div class="child-mini ${child?'has-child':''}"><div class="avatar">${child?'C':'?'}</div><div class="child-mini-main"><b>${child?esc(child.device_name||'Child'):'Sem Child'}</b><small>${child?(isDeviceOnline(child)?'● Online':'○ Offline'):'Vincule um dispositivo'}</small></div><span class="chevron">›</span></div><div class="nav">${nav.map(([k,v,i])=>`<button class="${state.page===k?'active':''}" onclick="go('${k}')"><i>${i}</i><span>${v}</span>${k==='activity'&&state.events.length?'<em>'+Math.min(state.events.length,99)+'</em>':''}</button>`).join('')}</div><div class="side-bottom"><div class="nav-label">SISTEMA</div><button class="nav-link tc-support-link" onclick="tcOpenSupport()">${tcIcon('support')}<span>Falar com o suporte</span></button><button class="nav-link ${state.page==='settings'?'active':''}" onclick="go('settings')">${tcIcon('settings')}<span>${esc(t('settings'))}</span></button><button class="nav-link" onclick="logout()">${tcIcon('logout')}<span>${esc(t('logout'))}</span></button><div class="tc-ss-wm"><img src="../assets/icons/ss-team-logo.png" alt="SS TEAM" loading="lazy"></div></div></aside><main class="main ${state.page==='overview'?'overview-mode':''}${state.page==='map'?' map-mode':''}"><header class="top"><div class="top-title"><button class="mobile-menu-trigger" aria-label="Abrir menu" aria-expanded="${state.menuOpen?'true':'false'}" onclick="toggleMenu()">☰</button><div class="brand top-brand"><span class="brand-mark">T</span><div><strong>T <span>CONNECT</span></strong></div>${state.page==='overview'?tcEye('tcbe-sm'):''}</div></div><div class="top-actions">${deviceSwitcher()}<button class="top-alert-btn ${unreadNotifications()?'has-unread':''}" type="button" onclick="showNotifications()" aria-label="Abrir alertas" title="Alertas"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/><path d="M10 21h4"/></svg>${unreadNotifications()?`<em>${Math.min(unreadNotifications(),99)}</em>`:''}</button><span class="protected">● ${state.realtime?t("realtime"):t("protected")}</span></div></header>${content()}</main></div>${tcEmergencyFab()}`}
function deviceCard(d){const age=d.last_seen_at?Math.max(0,Math.floor((Date.now()-new Date(d.last_seen_at).getTime())/1000)):null;return `<div class="device-card"><div class="device-icon">C</div><div class="device-main"><div class="device-title"><b>${esc(d.device_name||'Child')}</b>${eventBadge(isDeviceOnline(d)?'ONLINE':'OFFLINE')}</div><div class="muted">${esc(d.device_code)} · ${esc(d.platform||'android')}</div><div class="device-meta"><span>🔋 ${d.battery==null?'—':d.battery+'%'}</span><span>📡 ${age==null?'sem ligação':age<60?age+'s atrás':Math.floor(age/60)+'min atrás'}</span><span>📍 ${d.last_lat!=null?d.last_lat.toFixed(5)+', '+d.last_lng.toFixed(5):'sem GPS'}</span></div></div></div>`}
function locationTerminalMarkup(d, online, area=''){
  const has=online&&Number.isFinite(Number(d?.last_lat))&&Number.isFinite(Number(d?.last_lng));
  const lat=has?Number(d.last_lat).toFixed(6):'—', lng=has?Number(d.last_lng).toFixed(6):'—';
  const status=online?'ATIVO':'OFFLINE';
  const place=has?(area||'Aguardando identificação da área'):'—';
  const updated=d?.last_seen_at?new Date(d.last_seen_at).toLocaleString('pt-PT'):'Aguardando atualização';
  return `<div class="tc-location-summary"><div class="tc-location-summary-head"><span class="tc-location-live ${online?'on':'off'}">● ${status}</span><b>${has?'LOCALIZAÇÃO ATIVA':'SEM LOCALIZAÇÃO'}</b></div><div class="tc-location-grid"><div><small>PONTO</small><strong>${has?lat+', '+lng:'—'}</strong></div><div><small>ÁREA / RUA</small><strong class="tc-location-area">${esc(place)}</strong></div><div><small>DISPOSITIVO</small><strong>${esc(d?.device_name||'Child')}</strong></div><div><small>ATUALIZAÇÃO</small><strong>${esc(updated)}</strong></div></div></div>`;
}
function refreshLocationTerminalUI(){
  const d=state.devices[0]||{}; const online=isDeviceOnline(d); const area=window.TC_MAP_AREA_NAME||'';
  document.querySelectorAll('.tc-location-summary-host').forEach(el=>{el.innerHTML=locationTerminalMarkup(d,online,area)});
}
// ---- Super Admin: planos e utilizadores (persistido em localStorage) ----
const TC_DEFAULT_PLANS=[
  {id:'familiar',name:'Familiar',price:350,days:30,features:['Até 5 dispositivos Child','Histórico de 30 dias','Mensagens e chamadas','Captura de câmera e áudio']},
  {id:'premium',name:'Premium',price:750,days:30,features:['Dispositivos ilimitados','Histórico completo','Todas as capturas','Geofencing e relatórios','Suporte 24/7']},
  {id:'anual',name:'Anual',price:6500,days:365,features:['Tudo do Premium','12 meses de acesso','2 meses grátis','Prioridade máxima de suporte']}
];
// Modelo híbrido: o Supabase é a fonte de verdade; o localStorage serve de cache para
// o render síncrono e de fallback offline. Ao arrancar, syncAdminFromSupabase() carrega
// do Supabase para a cache; as escritas vão à cache e ao Supabase (quando ligado).
function supaReady(){return !!(window.TC_DB&&window.TC_DB.enabled&&window.TC_DB.client);}
function adminLoadPlans(){try{const v=JSON.parse(localStorage.getItem('tc_admin_plans')||'null');if(Array.isArray(v)&&v.length)return v}catch(_){}return JSON.parse(JSON.stringify(TC_DEFAULT_PLANS))}
function adminSavePlans(p){try{localStorage.setItem('tc_admin_plans',JSON.stringify(p))}catch(_){}}
function tcValidEmail(e){return !!(e&&/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(e).trim()))}
function adminLoadUsers(){let v=[];try{const raw=JSON.parse(localStorage.getItem('tc_admin_users')||'null');if(Array.isArray(raw))v=raw}catch(_){}
  // Remove entradas inválidas (sem email) e contas marcadas como eliminadas.
  return v.filter(u=>u&&tcValidEmail(u.email)&&String(u.status||'')!=='deleted')}
function adminSaveUsers(u){try{localStorage.setItem('tc_admin_users',JSON.stringify(u))}catch(_){}}
// Carrega planos + subscrições do Supabase para a cache local e re-renderiza.
async function syncAdminFromSupabase(){
  if(!supaReady())return;
  try{ if(window.tcLoadPlans){const plans=await window.tcLoadPlans();if(Array.isArray(plans)&&plans.length)adminSavePlans(plans);} }catch(e){console.warn('Planos:',e.message);}
  if(isSuperAdmin()){
    let loaded=false;
    // Preferir a lista COMPLETA de contas registadas (inclui quem ainda não tem plano).
    try{ if(window.tcAdminListUsers){const all=await window.tcAdminListUsers();if(Array.isArray(all)){adminSaveUsers(all);loaded=true;}} }catch(e){console.warn('Lista de contas:',e.message);}
    // Fallback: apenas as subscrições (se a migração tc_admin_list_users ainda não foi executada).
    if(!loaded){ try{ if(window.tcLoadSubscriptions){const subs=await window.tcLoadSubscriptions();if(Array.isArray(subs))adminSaveUsers(subs);} }catch(e){console.warn('Subscrições:',e.message);} }
  }
  if(state.page==='admin')render();
}
window.syncAdminFromSupabase=syncAdminFromSupabase;
function adminAddUser(){const email=prompt('Email do utilizador a cadastrar:');if(!email)return;const e=email.trim().toLowerCase();if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)){alert('Email inválido.');return}const users=adminLoadUsers();if(users.some(u=>u.email===e)){alert('Esse email já está cadastrado.');return}const rec={email:e,plan:'',days:0,paidAt:null};users.push(rec);adminSaveUsers(users);if(supaReady()&&window.tcAdminUpsertSubscription){window.tcAdminUpsertSubscription({...rec,status:'none'}).catch(err=>console.warn('Supabase add:',err.message));}render()}
function planAnnual(price){return Math.round(Number(price||0)*10);}
function planExpiryIso(u){if(!u||!u.paidAt||!u.days)return null;return new Date(new Date(u.paidAt).getTime()+Number(u.days)*86400000).toISOString();}
function isUserExpired(u){const e=planExpiryIso(u);return e?Date.now()>new Date(e).getTime():false;}
function adminActivatePlan(email,planId,period){const users=adminLoadUsers();const plans=adminLoadPlans();const pl=plans.find(p=>p.id===planId);if(!pl)return;const annual=period==='anual';const days=annual?365:(pl.days||30);const price=annual?planAnnual(pl.price):pl.price;let u=users.find(x=>x.email===email);if(!u){u={email,plan:'',days:0,paidAt:null};users.push(u);}u.plan=planId;u.days=days;u.period=annual?'anual':'mensal';u.paidAt=new Date().toISOString();adminSaveUsers(users);if(supaReady()&&window.tcAdminUpsertSubscription){window.tcAdminUpsertSubscription({email,plan:planId,days,paidAt:u.paidAt,period:u.period,status:'active'}).catch(err=>console.warn('Supabase ativar:',err.message));}addEvent('PLANO',`Plano ${pl.name} (${annual?'Anual':'Mensal'}) ativado para ${email} (${price} MT, ${days} dias).`,{status:'ATIVADO',source:'Super Admin',contact:email});render()}
function adminEditDays(email){const users=adminLoadUsers();const u=users.find(x=>x.email===email);if(!u)return;const v=prompt('Número de dias do plano para '+email+':',String(u.days||0));if(v===null)return;const n=parseInt(v,10);if(!Number.isFinite(n)||n<0){alert('Valor inválido.');return}u.days=n;if(!u.paidAt)u.paidAt=new Date().toISOString();adminSaveUsers(users);if(supaReady()&&window.tcAdminUpsertSubscription){window.tcAdminUpsertSubscription({email,plan:u.plan,days:n,paidAt:u.paidAt,status:u.plan?'active':'none'}).catch(err=>console.warn('Supabase dias:',err.message));}addEvent('PLANO',`Dias do plano de ${email} definidos para ${n}.`,{status:'EDITADO',source:'Super Admin',contact:email});render()}
function adminDeleteUser(email){if(!confirm('Eliminar a conta '+email+'? Deixa de aparecer na lista.'))return;let users=adminLoadUsers();users=users.filter(x=>x.email!==email);adminSaveUsers(users);
  // Marca como eliminada no Supabase (o RPC de listagem esconde as "deleted"),
  // para que a eliminação valha sem precisar de ir ao Supabase manualmente.
  if(supaReady()&&window.tcAdminUpsertSubscription){window.tcAdminUpsertSubscription({email,plan:null,days:0,paidAt:null,status:'deleted'}).catch(err=>console.warn('Supabase del:',err.message));}
  addEvent('CONTA',`Conta ${email} eliminada.`,{status:'ELIMINADO',source:'Super Admin',contact:email});render()}
function adminEditPlan(planId){const plans=adminLoadPlans();const p=plans.find(x=>x.id===planId);if(!p)return;const price=prompt('Preço (MT) do plano '+p.name+':',String(p.price));if(price===null)return;const days=prompt('Dias de validade do plano '+p.name+':',String(p.days));if(days===null)return;const pr=parseInt(price,10),dy=parseInt(days,10);if(!Number.isFinite(pr)||pr<0||!Number.isFinite(dy)||dy<0){alert('Valores inválidos.');return}p.price=pr;p.days=dy;adminSavePlans(plans);if(supaReady()&&window.tcSavePlan){window.tcSavePlan(p).catch(err=>console.warn('Supabase plano:',err.message));}addEvent('PLANO',`Plano ${p.name} atualizado: ${pr} MT / ${dy} dias.`,{status:'EDITADO',source:'Super Admin'});render()}
window.adminAddUser=adminAddUser;window.adminActivatePlan=adminActivatePlan;window.adminEditDays=adminEditDays;window.adminDeleteUser=adminDeleteUser;window.adminEditPlan=adminEditPlan;
function fmtDateTime(iso){if(!iso)return '—';try{const d=new Date(iso);return d.toLocaleDateString('pt-PT')+' '+d.toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'})}catch(_){return '—'}}
function planName(id){const p=adminLoadPlans().find(x=>x.id===id);return p?p.name:'—'}
const gearSvg='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z"/><path d="m19.4 13.5 1.1.9-1.7 3-1.3-.5a7.6 7.6 0 0 1-1.6.9l-.2 1.4h-3.5l-.2-1.4a7.6 7.6 0 0 1-1.6-.9l-1.3.5-1.7-3 1.1-.9a7.7 7.7 0 0 1 0-1.9l-1.1-.9 1.7-3 1.3.5a7.6 7.6 0 0 1 1.6-.9l.2-1.4h3.5l.2 1.4a7.6 7.6 0 0 1 1.6.9l1.3-.5 1.7 3-1.1.9a7.7 7.7 0 0 1 0 1.9Z"/></svg>';
// Sub-aba de um utilizador. Abre com um registo no histórico, para que o botão
// físico "Voltar" do Android (popstate) feche a sub-aba e volte à lista.
function openAdminUser(email){state.adminUserView=email;try{history.pushState({tcAdminUser:email},'','#admin-user');}catch(_){}render()}
function closeAdminUser(fromPop){state.adminUserView=null;if(!fromPop){try{if(location.hash==='#admin-user')history.back();}catch(_){}}render()}
window.openAdminUser=openAdminUser;window.closeAdminUser=closeAdminUser;
window.addEventListener('popstate',()=>{ if(state.adminUserView){ state.adminUserView=null; render(); return; } if(state.authenticated&&!isSuperAdmin()&&needsPlanChoice()){ try{history.pushState({tcPlanGate:1},'','');}catch(_){} render(); } });
function adminUserDetailPage(email){
  const users=adminLoadUsers();const plans=adminLoadPlans();
  const u=users.find(x=>x.email===email);
  if(!u)return `<div class="card"><button class="btn" onclick="closeAdminUser()">‹ Voltar</button><p class="muted" style="margin-top:12px">Utilizador não encontrado.</p></div>`;
  const planCards=plans.filter(p=>p.id==='familiar'||p.id==='premium').map(p=>{const chosen=u.plan===p.id;const annual=planAnnual(p.price);const chMes=chosen&&u.period!=='anual';const chAno=chosen&&u.period==='anual';return `<section class="plan-card ${p.id==='familiar'?'plan-featured':''} ${chosen?'plan-chosen':''}">${p.id==='familiar'?'<span class="plan-tag">Mais popular</span>':''}<button class="plan-gear" title="Editar plano" aria-label="Editar plano" onclick="adminEditPlan('${p.id}')">${gearSvg}</button><h3>${esc(p.name)}</h3><div class="plan-price"><b>${esc(String(p.price))} MT</b><span>/mês</span></div><ul class="plan-features">${p.features.map(f=>`<li>✓ ${esc(f)}</li>`).join('')}</ul><div style="display:flex;flex-direction:column;gap:8px"><button class="btn ${chMes?'primary':''} plan-cta" onclick="adminActivatePlan('${esc(email)}','${p.id}','mensal')">${chMes?'✓ ':''}Mensal · ${esc(String(p.price))} MT</button><button class="btn ${chAno?'primary':''} plan-cta" onclick="adminActivatePlan('${esc(email)}','${p.id}','anual')">${chAno?'✓ ':''}Anual · ${esc(String(annual))} MT</button></div></section>`}).join('');
  return `<div class="admin-page admin-user-detail">
    <div class="admin-detail-bar"><button class="admin-back-gear" title="Voltar" aria-label="Voltar" onclick="closeAdminUser()">${gearSvg}<span>Voltar</span></button></div>
    <section class="card admin-head-card"><div class="section-kicker">CONTA</div><h2 style="word-break:break-all">${esc(email)}</h2>
      <div class="admin-detail-top"><div><small>DATA DO PAGAMENTO</small><b>${fmtDateTime(u.paidAt)}</b></div><div><small>DATA DE EXPIRAÇÃO</small><b>${fmtDateTime(planExpiryIso(u))}</b></div><div><small>PLANO</small><b>${u.plan?esc(planName(u.plan))+(u.period?' · '+(u.period==='anual'?'Anual':'Mensal'):''):'Nenhum'}</b></div><div><small>DIAS</small><b>${esc(String(u.days||0))} <button class="admin-gear tiny" title="Editar dias" aria-label="Editar dias" onclick="adminEditDays('${esc(email)}')">${gearSvg}</button></b></div></div>
      ${u.plan?(isUserExpired(u)?'<div style="margin-top:12px;background:linear-gradient(135deg,#c0152b,#7a0f1e);color:#fff;border-radius:10px;padding:9px 13px;font-weight:800;text-align:center">⚠ PLANO EXPIRADO</div>':'<div style="margin-top:12px;background:rgba(26,169,120,.16);border:1px solid rgba(26,169,120,.4);color:#1aa978;border-radius:10px;padding:9px 13px;font-weight:800;text-align:center">● PLANO ATIVO</div>'):''}
    </section>
    <section class="card"><div class="section-head"><div><h3>Ativar / editar plano</h3><p class="muted">Escolha Familiar ou Premium para ativar. A engrenagem edita preço/dias.</p></div></div><div class="plans-grid">${planCards}</div><div class="pay-methods"><span class="pay-chip">M-Pesa</span><span class="pay-chip">e-Mola</span><span class="pay-chip">Cartão</span></div></section>
    <section class="card"><div class="section-head"><div><h3>Conta</h3><p class="muted">Ações administrativas sobre esta conta.</p></div></div><button class="btn danger" onclick="adminDeleteUser('${esc(email)}');closeAdminUser();">🗑 Eliminar conta</button></section>
  </div>`;
}
function adminPage(){
  if(state.adminUserView)return adminUserDetailPage(state.adminUserView);
  const email=window.TC_DB?.user?.email||'Conta local';
  const plans=adminLoadPlans();
  const users=adminLoadUsers();
  const plansHtml=plans.filter(p=>p.id==='familiar'||p.id==='premium').map(p=>`<section class="plan-card ${p.id==='familiar'?'plan-featured':''}">${p.id==='familiar'?'<span class="plan-tag">Mais popular</span>':''}<button class="plan-gear" title="Editar plano" aria-label="Editar plano" onclick="adminEditPlan('${p.id}')">${gearSvg}</button><h3>${esc(p.name)}</h3><div class="plan-price"><b>${esc(String(p.price))} MT</b><span>/mês</span></div><div class="muted" style="font-size:12px;margin:-6px 0 8px">ou ${esc(String(planAnnual(p.price)))} MT / ano</div><ul class="plan-features">${p.features.map(f=>`<li>✓ ${esc(f)}</li>`).join('')}</ul></section>`).join('');
  tcEnsureGroupStyles();
  const userBtn=u=>{const active=!!u.plan;const expired=active&&isUserExpired(u);return `<button class="admin-user as-link ${active?'is-active':''}" onclick="openAdminUser('${esc(u.email)}')"><div class="admin-user-head"><div class="tc-profile-avatar sm"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg></div><div class="admin-user-id"><b>${esc(u.email)}</b><small>${active?('Plano '+esc(planName(u.plan))+(u.period?' · '+(u.period==='anual'?'Anual':'Mensal'):'')+' · expira '+esc(fmtDateTime(planExpiryIso(u)))):'Sem plano ativo'}</small></div>${expired?'<span style="background:#c0152b;color:#fff;font-size:10px;font-weight:800;border-radius:999px;padding:3px 8px;margin-right:6px">EXPIRADO</span>':''}<span class="admin-user-chevron">›</span></div></button>`};
  const paid=users.filter(u=>u.plan==='familiar'||u.plan==='premium');
  const free=users.filter(u=>!(u.plan==='familiar'||u.plan==='premium'));
  const folder=(label,arr,color)=>`<details class="comm-group" ${arr.length?'open':''} style="margin-bottom:10px"><summary><span class="comm-group-ava" style="background:${color}">${arr.length}</span><div class="comm-group-main"><b>${label}</b><small class="comm-group-prev">${arr.length} conta${arr.length===1?'':'s'}</small></div></summary><div style="padding:8px 6px 6px;display:flex;flex-direction:column;gap:6px">${arr.length?arr.map(userBtn).join(''):'<div class="terminal-empty">Nenhuma.</div>'}</div></details>`;
  const usersHtml=users.length?(folder('Contas pagas',paid,'linear-gradient(135deg,#1aa978,#0e7a56)')+folder('Contas grátis / sem plano',free,'linear-gradient(135deg,#1288e6,#36d1c4)')):'<div class="terminal-empty">Nenhum utilizador cadastrado.</div>';
  return `<div class="admin-page"><section class="card admin-head-card"><div class="section-kicker">SUPER ADMIN</div><h2>Gestão de planos e contas</h2><p class="muted">Edite os planos, veja as pessoas cadastradas, ative planos, ajuste os dias e faça a gestão das contas.</p><div class="admin-account"><div class="tc-profile-avatar"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg></div><div><b>${esc(email)}</b><small>Super Administrador</small></div></div></section>
  <section class="card"><div class="section-head"><div><h3>Planos de pagamento</h3><p class="muted">Toque na engrenagem para editar preço e dias.</p></div></div><div class="plans-grid">${plansHtml}</div><div class="pay-methods"><span class="pay-chip">M-Pesa</span><span class="pay-chip">e-Mola</span><span class="pay-chip">Cartão</span></div></section>
  <section class="card"><div class="section-head"><div><h3>Pessoas / emails cadastrados</h3><p class="muted">Ative o plano Familiar ou Premium, edite os dias (engrenagem) ou elimine a conta (🗑).</p></div><button class="btn primary small" onclick="adminAddUser()">＋ Cadastrar email</button></div><div class="admin-users">${usersHtml}</div></section></div>`;
}
function content(){if(state.authenticated&&!isSuperAdmin()&&userHasPlan()&&!planAllowsPage(state.page))return planUpsellCard(state.page);if(state.page==='devices')return `<div class="layout single"><section class="card"><div class="section-head"><div><h3>Vínculo Guardian ↔ Child</h3><p class="muted">Crie um código manual de 6 dígitos. O QR e o link são opções adicionais para o mesmo convite.</p></div><span class="live">● EM TEMPO REAL</span></div><div class="pairing-workspace"><div class="pair-left"><div class="pair-box"><div><span class="muted">Convite de vinculação</span><b class="pair-code">${state.pairCode?'CÓDIGO ATIVO':'CÓDIGO NÃO GERADO'}</b></div><button class="btn primary" onclick="createPairing()" ${state.pairingBusy?'disabled':''}>${state.pairingBusy?'Gerando código…':state.pairCode?'Gerar novo código':'Gerar código de vinculação'}</button></div>${state.pairingMessage?`<div class="notice" role="status">${esc(state.pairingMessage)}</div>`:''}${state.pairCode?`<div class="manual-code-card"><div><span class="muted">Código manual</span><strong class="manual-pair-code">${esc(state.pairCode)}</strong><small>Use este mesmo código no Child para vincular sem QR.</small></div><button class="btn" onclick="copyPairCode()">⧉ Copiar código</button></div><div class="invite-actions"><button class="btn primary" onclick="shareInvite()">↗ Enviar convite</button><button class="btn" onclick="copyInvite()">⧉ Copiar link</button><button class="btn" onclick="shareWhatsApp()">WhatsApp</button><button class="btn" onclick="shareEmail()">E-mail</button><button class="btn" onclick="shareSMS()">SMS</button></div><div class="invite-link"><span>Link de convite</span><code>${esc(state.pairLink||'')}</code></div><p class="muted small-note">O QR e o código manual usam o mesmo convite temporário. O código expira e só pode ser usado uma vez.</p>`:''}</div><div class="qr-panel"><div class="qr-frame"><div id="pairQr"></div></div><b>QR de vinculação</b><small>${state.pairCode?'Leia este QR dentro do aplicativo T-Connect Child.':'Gere um QR para iniciar a vinculação.'}</small>${state.pairCode&&!window.TC_SUPABASE?.childApkUrl?'<span class="qr-note">APK Child ainda não configurado. O convite web continua disponível.</span>':''}</div></div><div class="install-panel"><div><b>Aplicativo Child</b><p class="muted">O convite é destinado ao aplicativo Child, não ao Guardian. Depois de publicar o APK assinado, coloque o endereço em <code>childApkUrl</code> no arquivo de configuração.</p></div>${window.TC_SUPABASE?.childApkUrl?`<a class="btn primary" href="${esc(window.TC_SUPABASE.childApkUrl)}" target="_blank" rel="noopener">⬇ Baixar APK Child</a>`:'<span class="status-badge pendente">APK não configurado</span>'}</div>${pairRequestsCard()}<h3 class="mt">Dispositivos vinculados <span class="pair-req-badge" style="background:rgba(14,165,233,.18);border:1px solid rgba(14,165,233,.4);color:#7dd3fc">${tcLinkedDeviceCount()} / ${planDeviceLimitLabel()}</span></h3><p class="muted" style="margin:-4px 0 8px">Plano ${esc(planLabel(userPlanId()||'free'))}: até ${planDeviceLimitLabel()} dispositivo(s).${tcCanLinkMore()?'':' Limite atingido — atualize o plano para ligar mais.'}</p><div class="device-list">${(()=>{const on=state.devices.filter(d=>isDeviceOnline(d));return on.length?on.map(deviceCard).join(''):'<div class="terminal-empty">Nenhum dispositivo online no momento.</div>'})()}</div></section></div>`;if(state.page==='overview'){const sos=state.events.filter(e=>e.type==='SOS');const d=state.devices[0];const online=isDeviceOnline(d);const battery=isDeviceOnline(d)?d?.battery:null;const locationReady=isDeviceOnline(d)&&d?.last_lat!=null;const recent=terminalEvents(40);return `<div class="overview-actions"><div class="overview-title-mark">MONITORAMENTO</div><button class="monitor-refresh-inline ${state.monitorRefreshing?'is-loading':''}" type="button" onclick="refreshMonitoring()" ${state.monitorRefreshing?'disabled':''} aria-label="Atualizar monitoramento" title="Atualizar monitoramento"><span class="refresh-inline-icon" aria-hidden="true">↻</span><span><b>${state.monitorRefreshing?'Atualizando…':'Atualizar'}</b></span></button></div><div class="grid dashboard-metrics compact-metrics"><button type="button" class="metric metric-online compact-metric metric-interactive ${online?'online-card':'offline-card'}" onclick="showMetricPopup('connection')" aria-label="Ver estado da conexão"><div class="compact-icon icon-state ${online?'is-live online-pulse':'is-offline offline-pulse'}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"/><path d="M12 8v4l2.5 1.5"/></svg></div><b class="compact-value ${online?'online':''}">${online?'Online':'Offline'}</b><small>${online?'Conectado':'Sem conexão'}</small><div class="metric-bar"><i style="width:${online?'100':'18'}%"></i></div></button><button type="button" class="metric metric-battery compact-metric metric-interactive" onclick="showMetricPopup('battery')" aria-label="Ver bateria"><div class="compact-icon icon-battery ${battery!=null?'is-live':''}"><svg viewBox="0 0 28 24" aria-hidden="true"><rect x="2" y="6" width="21" height="12" rx="3"/><path d="M25 10v4"/><rect class="battery-fill" x="5" y="9" width="15" height="6" rx="1.5"/></svg></div><b class="compact-value">${battery==null?'—':battery+'%'}</b><small>Bateria</small><div class="metric-bar"><i style="width:${battery==null?'0':Math.max(5,Math.min(100,battery))}%"></i></div></button><button type="button" class="metric metric-alert compact-metric metric-interactive" onclick="showNotifications()" aria-label="Ver alertas"><div class="compact-icon icon-bell ${unreadNotifications()?'has-alert alert-pulse':''}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/><path d="M10 21h4"/></svg>${unreadNotifications()?`<em>${unreadNotifications()}</em>`:''}</div><b class="compact-value">${unreadNotifications()?String(unreadNotifications()):'0'}</b><small>Alertas</small><div class="metric-bar"><i style="width:${sos.length?'70':'0'}%"></i></div></button></div><div class="layout dashboard-layout"><section class="card map-card dashboard-map-card"><div class="section-head"><div><div class="section-kicker">LOCALIZAÇÃO</div><p class="muted location-status-text">${locationReady?'LOCALIZADO':'LOCALIZANDO...'}</p></div><div class="actions map-mode-actions"><button data-map-type="satellite" class="btn map-mode-btn ${state.mapType==='satellite'?'primary':''}" onclick="setMap('satellite')" title="Satélite" aria-label="Satélite" aria-pressed="${state.mapType==='satellite'?'true':'false'}"><span class="map-mode-icon icon-satellite"><svg viewBox="0 0 24 24"><path d="m13 5 6 6"/><path d="M7 17 4 20"/><path d="m5 12 7 7"/><path d="M9 5 19 15"/><path d="M4 7 7 4l13 13-3 3Z"/><circle cx="5" cy="19" r="2"/></svg></span><span>Satélite</span></button><button data-map-type="hybrid" class="btn map-mode-btn ${state.mapType==='hybrid'?'primary':''}" onclick="setMap('hybrid')" title="Híbrido" aria-label="Híbrido" aria-pressed="${state.mapType==='hybrid'?'true':'false'}"><span class="map-mode-icon icon-hybrid"><svg viewBox="0 0 24 24"><path d="M4 6h16v12H4z"/><path d="M4 15h16"/><path d="m8 18 2-4 3 2 2-3 5 4"/><path d="M8 10h3M14 10h3"/></svg></span><span>Híbrido</span></button><button data-map-type="roadmap" class="btn map-mode-btn ${state.mapType==='roadmap'?'primary':''}" onclick="setMap('roadmap')" title="Mapa" aria-label="Mapa" aria-pressed="${state.mapType==='roadmap'?'true':'false'}"><span class="map-mode-icon icon-map"><svg viewBox="0 0 24 24"><path d="m9 18-6 3V6l6-3 6 3 6-3v15l-6 3-6-3Z"/><path d="M9 3v15M15 6v15"/></svg></span><span>Mapa</span></button><button class="btn map-mode-btn ${state.trailOn?'primary':''}" onclick="toggleTrail()" title="Trajeto de hoje" aria-label="Trajeto"><span class="map-mode-icon"><svg viewBox="0 0 24 24"><path d="M4 19c4-11 12-11 16 0"/><circle cx="4" cy="19" r="2"/><circle cx="20" cy="19" r="2"/></svg></span><span>Trajeto</span></button></div></div><div class="map map-with-terminal"><div id="map"></div><div class="mapkey"><span class="mapkey-dot"></span><div><b>${online?'Online':'Offline'}</b><br><span class="muted">${locationReady?d.last_lat.toFixed(6)+', '+d.last_lng.toFixed(6):'sem coordenadas'}</span></div></div><div class="tc-location-summary-host">${locationTerminalMarkup(d,online,window.TC_MAP_AREA_NAME||'')}</div></div></section></div></div>`}if(state.page==='status'){const d=state.devices[0];const online=isDeviceOnline(d);const battery=isDeviceOnline(d)?d?.battery:null;const locationReady=isDeviceOnline(d)&&d?.last_lat!=null;const sos=state.events.filter(e=>e.type==='SOS');return `<div class="dashboard-head"><div><span class="dashboard-kicker">MONITORAMENTO</span><h2>Estado</h2><p class="muted">Estado atual do dispositivo e dos principais serviços.</p></div><div class="dashboard-actions"><button class="btn" onclick="go('activity')">⌁ Ver atividades</button></div></div><div class="grid dashboard-metrics"><div class="metric status-feature"><div class="metric-top"><span>Estado Child</span><span class="metric-icon icon-state ${online?'is-live':''}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 1.5"/><path d="M7 5.8 5.8 4.6M17 5.8l1.2-1.2"/></svg></span></div><b class="${online?'online':''}">${online?'Online':'Offline'}</b><small>${d?.device_name||'Nenhum dispositivo vinculado'}</small></div><div class="metric status-feature"><div class="metric-top"><span>Bateria</span><span class="metric-icon icon-battery ${battery!=null?'is-live':''}"><svg viewBox="0 0 28 24" aria-hidden="true"><rect x="2" y="6" width="21" height="12" rx="3"/><path d="M25 10v4"/><path d="m9 12 2 2 4-5"/></svg></span></div><b>${battery==null?'—':battery+'%'}</b><small>${d?.last_seen_at?'Atualizada no heartbeat':'Aguardando dados'}</small></div><div class="metric status-feature"><div class="metric-top"><span>Localização</span><span class="metric-icon icon-location ${locationReady?'is-live':''}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.2 7-12A7 7 0 0 0 5 9c0 5.8 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/><path d="M3 19h4M17 19h4"/></svg></span></div><b>${locationReady?'LIVE':'—'}</b><small>${locationReady?'GPS disponível':'Aguardando GPS'}</small></div><div class="metric status-feature"><div class="metric-top"><span>Alertas</span><span class="metric-icon icon-bell ${sos.length?'has-alert':''}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/><path d="M10 21h4"/></svg>${sos.length?`<em>${sos.length}</em>`:''}</span></div><b>${sos.length||'—'}</b><small>${sos.length?'Requer atenção':'Aguardando alertas'}</small></div></div><div class="layout"><section class="card"><div class="section-head"><div><h3>Estado do dispositivo</h3><p class="muted">Informações atuais recebidas pelo Guardian.</p></div><span class="live">● ${online?'ONLINE':'OFFLINE'}</span></div><div class="device-list">${d?deviceCard(d):'<div class="terminal-empty">Nenhum Child vinculado ainda.</div>'}</div></section><section class="card"><h3>Serviços</h3><div class="setting"><span>Em tempo real</span><b class="${state.realtime?'online':''}">${state.realtime?'● Ativo':'○ Inativo'}</b></div><div class="setting"><span>Conexão do dispositivo</span><b class="${online?'online':''}">${online?'● Online':'○ Offline'}</b></div><div class="setting"><span>Localização (GPS)</span><b>${locationReady?'● Disponível':'○ Aguardando'}</b></div><div class="setting"><span>Bateria</span><b>${battery==null?'—':battery+'%'}</b></div><div class="setting"><span>Último heartbeat</span><b>${d?.last_seen_at?new Date(d.last_seen_at).toLocaleString('pt-PT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—'}</b></div><p class="muted small-note">Os detalhes técnicos do backend ficam disponíveis em Definições, não no painel de monitoramento.</p></section></div>`} 
if(state.page==='map'){const d=state.devices[0];const online=isDeviceOnline(d);const locationReady=isDeviceOnline(d)&&d?.last_lat!=null;const recent=mapTerminalEvents(80);return `<div class="layout dashboard-layout location-only-layout"><section class="card map-card dashboard-map-card"><div class="section-head"><div><div class="section-kicker">LOCALIZAÇÃO</div><p class="muted location-status-text">${locationReady?'LOCALIZADO':'LOCALIZANDO...'}</p></div><div class="actions map-mode-actions"><button data-map-type="roadmap" class="btn map-mode-btn ${state.mapType==='roadmap'?'primary':''}" onclick="setMap('roadmap')" title="Mapa" aria-label="Mapa" aria-pressed="${state.mapType==='roadmap'?'true':'false'}"><span class="map-mode-icon icon-map"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18-6 3V6l6-3 6 3 6-3v15l-6 3-6-3Z"/><path d="M9 3v15M15 6v15"/></svg></span><span>Mapa</span></button><button data-map-type="satellite" class="btn map-mode-btn ${state.mapType==='satellite'?'primary':''}" onclick="setMap('satellite')" title="Satélite" aria-label="Satélite" aria-pressed="${state.mapType==='satellite'?'true':'false'}"><span class="map-mode-icon icon-satellite"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13 5 6 6"/><path d="M7 17 4 20"/><path d="m5 12 7 7"/><path d="M9 5 19 15"/><path d="M4 7 7 4l13 13-3 3Z"/><circle cx="5" cy="19" r="2"/></svg></span><span>Satélite</span></button><button data-map-type="hybrid" class="btn map-mode-btn ${state.mapType==='hybrid'?'primary':''}" onclick="setMap('hybrid')" title="Híbrido" aria-label="Híbrido" aria-pressed="${state.mapType==='hybrid'?'true':'false'}"><span class="map-mode-icon icon-hybrid"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v12H4z"/><path d="M4 15h16"/><path d="m8 18 2-4 3 2 2-3 5 4"/><path d="M8 10h3M14 10h3"/></svg></span><span>Híbrido</span></button></div></div><div class="map location-map-only"><div id="map"></div><div class="mapkey"><span class="mapkey-dot"></span><div><b>${online?'Online':'Offline'}</b><br><span class="muted">${locationReady?Number(d.last_lat).toFixed(6)+', '+Number(d.last_lng).toFixed(6):'sem coordenadas'}</span></div></div><div class="tc-location-summary-host">${locationTerminalMarkup(d,online,window.TC_MAP_AREA_NAME||'')}</div></div></section></div>`}
if(state.page==='activity')return `<div class="card"><div class="section-head"><div><h3>Atividades do terminal</h3><p class="muted">Fluxo técnico das atividades autorizadas em tempo real.</p></div><span class="live">● ${state.realtime?'LIVE':'LOCAL'}</span></div><div class="toolbar"><input id="tc-activity-search" placeholder="Escreva um número — ao completar 9 dígitos, pesquisa sozinho…" value="${esc(state.search)}" oninput="tcActivityInput(this)" autocomplete="off" inputmode="tel"></div><div class="terminal activity-terminal" id="tc-activity-terminal">${terminalEvents(100)}</div></div>`;if(state.page==='messages')return `<div class="messages-layout"><section class="card"><div class="section-head"><div><h3>Captura de mensagens</h3><p class="muted">Somente fontes autorizadas pelo Android.</p></div><span class="live">● LIVE</span></div><div class="command-grid two"><button class="command comm-btn" onclick="tcSound('msg-in');openCommunicationPrompt('message-received')"><span class="comm-ico comm-in" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 5h16v12H8l-4 3Z"/><path d="m9 11 3 3 5-6" class="comm-check"/></svg></span><b>Mensagens recebidas</b><small>Ver mensagens recebidas</small></button><button class="command comm-btn" onclick="tcSound('msg-out');openCommunicationPrompt('message-sent')"><span class="comm-ico comm-out" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 5h16v12H8l-4 3Z"/><path d="m8 11 4-2 4 2-4 2Z" class="comm-arrow"/></svg></span><b>Mensagens enviadas</b><small>Ver mensagens enviadas</small></button></div><div class="terminal auto-terminal msg-seq-terminal">${renderMsgList()}</div>${renderDeletedMsgList()}</section></div>`;if(state.page==='calls')return `<div class="card"><div class="section-head"><div><h3>Histórico de chamadas</h3><p class="muted">Disponibilidade real depende das permissões e APIs Android.</p></div></div><div class="command-grid two call-actions"><button class="command comm-btn" onclick="tcSound('call-in');openCommunicationPrompt('call-received')"><span class="comm-ico call-in" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 4h3l1.5 4-2 1.5a12 12 0 0 0 5 5l1.5-2 4 1.5v3a1.6 1.6 0 0 1-1.7 1.6A15 15 0 0 1 3.4 5.7 1.6 1.6 0 0 1 5 4Z" class="call-body"/><path d="M14 8l5-5M19 3v4M19 3h-4" class="call-dir-in"/></svg></span><b>Chamadas recebidas</b><small>Ver chamadas recebidas</small></button><button class="command comm-btn" onclick="tcSound('call-out');openCommunicationPrompt('call-sent')"><span class="comm-ico call-out" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 4h3l1.5 4-2 1.5a12 12 0 0 0 5 5l1.5-2 4 1.5v3a1.6 1.6 0 0 1-1.7 1.6A15 15 0 0 1 3.4 5.7 1.6 1.6 0 0 1 5 4Z" class="call-body"/><path d="M19 3l-5 5M14 3h5M19 3v5" class="call-dir-out"/></svg></span><b>Chamadas efetuadas</b><small>Ver chamadas efetuadas</small></button></div><h3 class="mt">Terminal de chamadas</h3><div class="terminal call-terminal auto-terminal">${renderCallList()}</div></div>`;if(state.page==='contacts')return `<div class="card"><div class="section-head"><div><h3>Contatos</h3><p class="muted">Mensagens, chamadas e contactos mais ativos da semana.</p></div><span class="live">● LIVE</span></div>${renderContactsStats()}<div class="toolbar contacts-toolbar"><input id="tc-contacts-search" placeholder="Pesquisar nome ou número…" value="${esc(state.contactSearch||'')}" oninput="state.contactSearch=this.value;tcRenderContactsList()" autocomplete="off"><button class="btn" onclick="state.contactSearch='';render()">Limpar</button></div><div id="tc-contacts-list-host">${renderContactsList()}</div></div>`;if(state.page==='whatsapp')return `<div class="card"><div class="section-head"><div><h3><span class="wa-head-ic">${tcIcon('social')}</span> Redes sociais</h3><p class="muted">Mensagens de todas as redes sociais e apps de mensagens (WhatsApp, Messenger, Telegram, Instagram, Signal, …) recebidas no telemóvel da criança — cada uma com o seu ícone.</p></div><span class="live">● LIVE</span></div><div class="notice" style="margin:4px 0 12px">🔒 Mostra o que aparece nas <b>notificações</b> do próprio telemóvel da criança, de <b>todas</b> as redes sociais e apps de mensagens. É preciso a criança ativar o «Acesso às notificações» no aplicativo dela (Minha Emergência → menu → Mensagens).</div><div class="terminal auto-terminal msg-seq-terminal">${renderWhatsAppList()}</div>${contactsTopTabs()}</div>`;if(state.page==='apps')return `<div class="card"><div class="section-head"><div><h3>Aplicativos</h3><p class="muted">Apps instaladas e tempo de uso nas últimas 24h.</p></div><span class="live">● LIVE</span></div>${renderAppsStats()}${renderAppsList()}</div>`;if(state.page==='screen')return `<div class="card narrow screen-capture-page"><div class="section-head"><div><h3>Câmera da Criança</h3><p class="muted">Visual ao vivo somente após aceitação explícita no aplicativo Minha Segurança.</p></div><div class="screen-glass-wrap"><button class="screen-glass" type="button" onclick="if(!this.dataset.dragged)openScreenCapture()" aria-label="Abrir câmera da Criança" title="Abrir câmera autorizada"><div class="screen-glass-sheen"></div><span class="screen-glass-dot"></span><span class="screen-glass-label">CÂMERA · TOCAR PARA VISUALIZAR</span></button></div></div><div class="permission-box"><span>Estado</span><b>● Pronto para solicitar</b><small>A Criança deverá aceitar o pedido e autorizar a câmera no Android.</small></div><div class="capture-actions"><button class="btn primary capture-btn ${state.capturePending==='camera'?'is-searching':''}" data-cap="camera" onclick="tcSound('tap');requestScreenCapture()"><span class="cap-ico cap-ico-cam" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="7" width="13" height="10" rx="2"/><path d="m16 10 5-3v10l-5-3Z"/></svg></span><span class="cap-label">Solicitar câmera</span><span class="cap-search" aria-hidden="true"><i></i><i></i><i></i></span></button><button class="btn capture-btn ${state.capturePending==='audio'?'is-searching':''}" data-cap="audio" onclick="tcSound('tap');requestAudioOnly()"><span class="cap-ico cap-ico-mic" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v3"/></svg></span><span class="cap-label">Escutar áudio</span><span class="cap-search" aria-hidden="true"><i></i><i></i><i></i></span></button><button class="btn capture-btn ${state.capturePending==='screen'?'is-searching':''}" data-cap="screen" onclick="tcSound('tap');requestScreenProjection()"><span class="cap-ico cap-ico-screen" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg></span><span class="cap-label">Projetar tela</span><span class="cap-search" aria-hidden="true"><i></i><i></i><i></i></span></button></div><div class="terminal screen-terminal auto-terminal">${terminalEvents(20,'screen')}</div></div>`;if(state.page==='permissions')return `<div class="permission-grid">${[['Localização','Necessária para GPS e SOS','ATIVA'],['Notificações','Alertas e eventos do sistema','ATIVA'],['SMS / mensagens','Somente se permitido pela função Android aplicável','PENDENTE'],['Câmera','Exige autorização da Criança e do Android','PENDENTE'],['Microfone','Somente quando a função de áudio for usada','DESATIVADA']].map(x=>{const c=state.permissionChecks?.[x[0]];const st=c?.status||x[2];return `<div class="permission-row"><div><b>${x[0]}</b><span>${x[1]}</span>${c?.detail?`<small class="permission-detail">${esc(c.detail)}</small>`:''}</div>${eventBadge(st)}<button class="btn small" onclick="verifyPermission('${x[0]}')" ${c?.status==='PROCESSANDO'?'disabled':''}>${c?.status==='PROCESSANDO'?'Verificando…':'Verificar'}</button></div>`}).join('')}</div>`;if(state.page==='admin')return isSuperAdmin()?adminPage():'<div class="card"><h3>Acesso restrito</h3><p class="muted">Esta área é exclusiva do Super Administrador.</p></div>';return `<div class="settings-grid"><div class="settings-topbar"><div class="settings-translator">${languageSelect('settings-lang')}</div></div><section class="card tc-profile-card"><div class="section-kicker">PERFIL</div><button class="tc-profile-badge" onclick="openProfileEditor()" title="Editar perfil" style="width:100%;margin-top:8px">${profileAvatarHtml()}<div class="tc-profile-meta"><b>${esc(profileDisplayName())}</b><small>${esc(window.TC_DB?.user?.email||'Conta local')} · ${window.TC_DB?.user?'● Ativa':'○ Local'}</small></div><span class="tc-profile-chev">›</span></button><div class="tc-profile-hint">Toque no perfil para editar foto, nome, contacto, morada e ver a conta.</div><div class="tc-profile-links"><button class="tc-prof-link" onclick="go('permissions')"><span class="tc-prof-ic">✓</span><b>Permissões</b><span class="tc-prof-chev">›</span></button><button class="tc-prof-link" onclick="go('devices')"><span class="tc-prof-ic">⌘</span><b>Child &amp; dispositivos</b><span class="tc-prof-chev">›</span></button></div></section><section class="card pwa-install-card"><div class="section-kicker">APLICATIVO</div><div style="display:flex;align-items:center;gap:14px;margin:8px 0 16px"><img src="../assets/icons/tconnect-logo-192.png" alt="T-Connect" style="width:72px;height:72px;border-radius:18px;object-fit:cover;box-shadow:0 8px 28px rgba(14,165,233,.2)"><div><b style="font-size:18px">T-Connect</b><small style="display:block;color:#7f98aa;margin-top:3px">Segurança em tempo real</small></div></div><div class="section-head"><div><h3><span class="settings-gear-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z"/><path d="m19.4 13.5 1.1.9-1.7 3-1.3-.5a7.6 7.6 0 0 1-1.6.9l-.2 1.4h-3.5l-.2-1.4a7.6 7.6 0 0 1-1.6-.9l-1.3.5-1.7-3 1.1-.9a7.7 7.7 0 0 1 0-1.9l-1.1-.9 1.7-3 1.3.5a7.6 7.6 0 0 1 1.6-.9l.2-1.4h3.5l.2 1.4a7.6 7.6 0 0 1 1.6.9l1.3-.5 1.7 3-1.1.9a7.7 7.7 0 0 1 0 1.9Z"/></svg></span>Instalar aplicativo</h3><p class="muted">Instale o T Connect diretamente pelo próprio aplicativo e abra-o em modo Android.</p></div><span class="version-pill">PWA</span></div><button class="btn primary install-app-btn" type="button" onclick="installTConnect()"><span class="install-app-icon">＋</span> Instalar aplicativo</button><p class="muted small-note" id="pwa-install-status">A instalação usa o recurso oficial do Chrome. No Android, quando o botão do navegador estiver disponível, o T-Connect pode ser instalado com o mesmo logotipo e abrir como aplicativo. Se o Chrome ainda não oferecer o botão, use ⋮ → Instalar aplicativo.</p></section><section class="card update-card"><div class="section-head"><div><div class="section-kicker">SOFTWARE</div><h3>Atualizações</h3><p class="muted">Verifique novos recursos, melhorias e correções do T-Connect.</p></div><span class="version-pill">v${esc(window.TC_APP_VERSION||'2.39.5')}</span></div><div class="update-toggle"><div><b>Atualização automática</b><small>Baixa a nova versão automaticamente quando houver uma atualização publicada.</small></div><label class="switch"><input type="checkbox" ${state.update.auto?'checked':''} onchange="toggleAutoUpdates(this.checked)"><span></span></label></div><div class="setting"><span>Versão instalada</span><b>v${esc(window.TC_APP_VERSION||'2.39.5')}</b></div><div class="update-actions"><button class="btn primary" onclick="checkForUpdates(false)" ${state.update.checking||state.update.downloading?'disabled':''} title="Verificar atualizações"><span class="settings-gear-icon ${state.update.checking?'spin':''}" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z"/><path d="m19.4 13.5 1.1.9-1.7 3-1.3-.5a7.6 7.6 0 0 1-1.6.9l-.2 1.4h-3.5l-.2-1.4a7.6 7.6 0 0 1-1.6-.9l-1.3.5-1.7-3 1.1-.9a7.7 7.7 0 0 1 0-1.9l-1.1-.9 1.7-3 1.3.5a7.6 7.6 0 0 1 1.6-.9l.2-1.4h3.5l.2 1.4a7.6 7.6 0 0 1 1.6.9l1.3-.5 1.7 3-1.1.9a7.7 7.7 0 0 1 0 1.9Z"/></svg></span> ${state.update.checking?'A verificar…':'Verificar atualizações'}</button>${state.update.latest&&!state.update.downloading?`<button class="btn primary update-now-btn" onclick="updateAppNow()">⬆ Atualizar aplicativo${tcUpdSizeMB()?(' · '+tcUpdSizeMB()):''}</button>`:''}</div>${(state.update.downloading||state.update.progress&&state.update.progress.status==='done')?`<div id="tc-upd-progress" class="upd-progress">${tcUpdProgressInner()}</div>`:''}${!state.update.checking&&!state.update.latest&&!state.update.error?`<div class="update-note ok">✓ Está na versão mais recente (v${esc(window.TC_APP_VERSION||'2.39.5')}).</div>`:''}${state.update.error?`<div class="update-note">${esc(state.update.error)}</div>`:''}${state.update.latest?`<div class="release-panel update-available"><div class="update-avail-head"><span class="update-avail-dot"></span><b>Atualização disponível</b><span class="update-avail-ver">v${esc(state.update.latest.version||'?')}</span></div><div class="update-avail-meta"><div><span>Tamanho</span><b>${tcUpdSizeMB()||'—'}</b></div><div><span>Publicada</span><b>${state.update.latest.released_at?new Date(state.update.latest.released_at).toLocaleDateString('pt-PT'):'—'}</b></div></div><p>${esc(state.update.latest.description||'Melhorias e correções.')}</p>${tcNotesList(state.update.latest.changes||state.update.latest.changelog||state.update.latest.releaseNotes)}<p class="update-avail-note">Atualiza pelo próprio app — não precisa de descarregar nem transferir nenhum ficheiro à mão. A atualização é opcional; pode instalar quando quiser.</p></div>`:''}${tcCurrentNotesPanel()}</section><section class="card tc-about-card"><div class="section-kicker">GUIA</div><h3>Sobre o T-Connect</h3><p class="muted">O que é, todas as funcionalidades, vantagens e desvantagens, e como usar — com demonstrações visuais.</p><button class="btn primary" type="button" onclick="openAbout()"><span style="font-weight:900;margin-right:6px">ⓘ</span> Abrir guia do aplicativo</button></section></div>`}
function childEntryUrl(code){const cfg=window.TC_SUPABASE||{};let base=String(cfg.childInviteBaseUrl||'').trim();if(!base){if(/^https?:$/i.test(location.protocol)){base=new URL('../child/invite.html',location.href).href}else{base='child/invite.html'}}let u;try{u=new URL(base,location.href)}catch(e){throw new Error('URL do convite inválida. Configure childInviteBaseUrl nas definições do projeto.')}u.searchParams.set('pair',String(code).trim().toUpperCase());u.searchParams.set('device',`TC-CHILD-${Math.random().toString(36).slice(2,8).toUpperCase()}`);if(cfg.childApkUrl)u.searchParams.set('apk',cfg.childApkUrl);return u.href}
function inviteText(){return `Convite T-Connect Child\nAbra o link para baixar/abrir o aplicativo Child e concluir a vinculação.\n${state.pairLink}`}
async function copyPairCode(){if(!state.pairCode){state.pairingMessage='Gere primeiro um convite.';render();return}try{await navigator.clipboard.writeText(state.pairCode);state.pairingMessage='Código manual copiado.'}catch(e){state.pairingMessage='Não foi possível copiar o código.'}render()}
function initPairQR(){const el=document.getElementById('pairQr');if(!el||!state.pairCode)return;if(typeof QRCode==='undefined'){state.pairingMessage='O gerador de QR não carregou. Use temporariamente o código manual abaixo.';return}el.innerHTML='';const payload=state.pairLink||state.pairCode;new QRCode(el,{text:payload,width:240,height:240,colorDark:'#39ff88',colorLight:'#06140d',correctLevel:QRCode.CorrectLevel.M});}
async function createPairing(){if(state.pairingBusy)return;
  // Limite de dispositivos por plano: Familiar=5, Premium/Anual=20, Grátis=ilimitado.
  if(!tcCanLinkMore()){ state.pairingMessage='O seu plano '+planLabel(userPlanId()||'familiar')+' permite até '+planDeviceLimitLabel()+' dispositivos e já tem '+tcLinkedDeviceCount()+'. Para ligar mais, atualize para um plano superior.'; render(); return; }
  state.pairingBusy=true;state.pairingMessage='';state.pairCode='';state.pairLink='';render();try{if(!window.TC_DB.enabled)throw new Error('Supabase não está configurado ou não ficou disponível.');if(!window.TC_DB.user)throw new Error('Inicie sessão no Guardian antes de gerar o código.');const client=window.TC_DB.client;let code='';let inserted=false;for(let attempt=0;attempt<5&&!inserted;attempt++){if(window.crypto?.getRandomValues){const a=new Uint32Array(1);crypto.getRandomValues(a);code=String(a[0]%1000000).padStart(6,'0')}else{code=String(Math.floor(Math.random()*1000000)).padStart(6,'0')}const expiresAt=new Date(Date.now()+10*60*1000).toISOString();const {error}=await client.from('pairing_codes').insert({guardian_id:window.TC_DB.user.id,code,expires_at:expiresAt});if(!error)inserted=true;else if(!/duplicate key|unique/i.test(error.message||''))throw error}if(!inserted)throw new Error('Não foi possível gerar um código único. Tente novamente.');state.pairCode=code;state.pairLink=childEntryUrl(state.pairCode);await addEvent('PAIRING','Código manual de vinculação criado',{status:'AUTORIZADO',source:'Guardian'});state.pairingMessage='Código criado com sucesso. Válido por 10 minutos e de uso único.';}catch(e){const raw=String(e?.message||e||'');state.pairingMessage=/relation .*pairing_codes.*does not exist|schema cache|PGRST/i.test(raw)?'A tabela de vinculação ainda não está disponível no Supabase. Execute supabase/schema.sql e tente novamente.':raw||'Não foi possível criar o código.';}finally{state.pairingBusy=false;render();if(state.pairCode)setTimeout(initPairQR,80)}}
async function shareInvite(){if(!state.pairLink){state.pairingMessage='Gere primeiro um código de vinculação.';render();return}try{if(navigator.share)await navigator.share({title:'Convite T-Connect Child',text:inviteText(),url:state.pairLink});else await copyInvite()}catch(e){if(e.name!=='AbortError')await copyInvite()}}
async function copyInvite(){if(!state.pairLink){state.pairingMessage='Gere primeiro um código de vinculação.';render();return}try{await navigator.clipboard.writeText(inviteText());state.authError='Convite copiado para a área de transferência.'}catch(e){state.authError='Não foi possível copiar o convite.'}render()}
function shareWhatsApp(){if(!state.pairLink){state.pairingMessage='Gere primeiro um código de vinculação.';render();return}openExternal('https://wa.me/?text='+encodeURIComponent(inviteText()))}
function shareEmail(){if(!state.pairLink){state.pairingMessage='Gere primeiro um código de vinculação.';render();return}location.href='mailto:?subject='+encodeURIComponent('Convite T-Connect Child')+'&body='+encodeURIComponent(inviteText())}
function shareSMS(){if(!state.pairLink){state.pairingMessage='Gere primeiro um código de vinculação.';render();return}location.href='sms:?body='+encodeURIComponent(inviteText())}
function setMap(t){
  const nextType=['roadmap','satellite','hybrid'].includes(t)?t:'roadmap';
  state.mapType=nextType;
  document.querySelectorAll('.map-mode-actions .map-mode-btn').forEach(btn=>{
    const active=btn.dataset.mapType===nextType || btn.getAttribute('onclick')?.includes(`setMap('${nextType}')`);
    btn.classList.toggle('primary',active);
    btn.setAttribute('aria-pressed',active?'true':'false');
  });
  pushMapTerminal('MAPA',`CAMADA_${String(nextType).toUpperCase()}_SELECIONADA`,'OK',{detail:`Modo ${nextType} selecionado`});
  if(window.TC_MAP?.setType) window.TC_MAP.setType(nextType);
}
let tcSelfWatchId=null;let tcSelfLocTries=0;
function tcStartSelfLocation(){
  if(!('geolocation'in navigator))return;
  const push=p=>{try{tcSelfLocTries=0;window.TC_MAP&&window.TC_MAP.setSelfLocation&&window.TC_MAP.setSelfLocation(p.coords.latitude,p.coords.longitude);}catch(_){}};
  const onErr=()=>{
    // No Android, a permissão de localização costuma ser concedida só DEPOIS do 1.º pedido.
    // Nesse caso o watch inicial falha; reiniciamos algumas vezes até o GPS responder,
    // para o ponto azul do Guardian acabar sempre por aparecer no mapa.
    if(tcSelfWatchId!=null){try{navigator.geolocation.clearWatch(tcSelfWatchId);}catch(_){}tcSelfWatchId=null;}
    if(tcSelfLocTries++<10){setTimeout(tcStartSelfLocation,3500);}
  };
  // Pedido imediato: força o prompt de permissão e pinta o ponto azul assim que houver fix.
  try{navigator.geolocation.getCurrentPosition(push,()=>{},{enableHighAccuracy:true,maximumAge:10000,timeout:15000});}catch(_){}
  if(tcSelfWatchId==null){
    try{
      tcSelfWatchId=navigator.geolocation.watchPosition(push,onErr,{enableHighAccuracy:true,maximumAge:15000,timeout:20000});
    }catch(_){}
  }
  // Mantém o rastreio vivo: de vez em quando reforça a posição (e rearma o watch se tiver
  // morrido), para o ponto azul nunca deixar de atualizar nem desaparecer com o tempo.
  if(!window.__tcSelfKeepAlive){
    window.__tcSelfKeepAlive=setInterval(function(){
      try{
        navigator.geolocation.getCurrentPosition(push,function(){},{enableHighAccuracy:true,maximumAge:10000,timeout:15000});
        if(tcSelfWatchId==null){ tcSelfLocTries=0; tcStartSelfLocation(); }
      }catch(_){}
    },60000);
  }
}
async function initMap(_retry){
  const node=document.getElementById('map');
  if(!node)return;
  if(!window.TC_MAP){
    // O módulo do mapa pode ainda estar a carregar nalguns dispositivos mais lentos.
    const n=Number(_retry||0);
    if(n<12){ setTimeout(()=>initMap(n+1),400); if(n===0)node.innerHTML='<div class="map-provider-error"><b>A abrir o mapa…</b><span>Um momento.</span></div>'; return; }
    node.innerHTML='<div class="map-provider-error"><b>Mapa</b><span>O módulo do mapa não carregou. Toque em Atualizar ou reabra a página.</span></div>';
    return;
  }
  try{
    window.TC_MAP.init();
    // Vários refreshes escalonados: em alguns aparelhos o contentor só ganha
    // tamanho depois de pintar, e o mapa ficava em branco sem estes ajustes.
    [120,400,900,1600].forEach(ms=>setTimeout(()=>{try{window.TC_MAP.refresh?.();window.TC_MAP.invalidate?.();window.TC_MAP.setType?.(state.mapType);}catch(_){}},ms));
    tcStartSelfLocation();
    // Sincroniza a camada escolhida (Mapa/Satélite/Híbrido) entre as duas telas que
    // mostram o mapa (Monitoramento inicial e Localização do menu): ambas partilham
    // state.mapType, por isso o mapa abre sempre na mesma camada em que foi deixado.
    if(window.TC_MAP.setType && state.mapType) window.TC_MAP.setType(state.mapType);
    requestAnimationFrame(()=>{ try{ window.TC_MAP.refresh?.(); }catch(_){} });
    setTimeout(()=>{ try{ window.TC_MAP.refresh?.(); window.TC_MAP.setType?.(state.mapType); }catch(_){} },220);
    const d=state.devices[0]||{};
    const saved=state.lastLocation;
    const lat=Number(saved?.lat ?? d?.last_lat), lng=Number(saved?.lng ?? d?.last_lng);
    if(Number.isFinite(lat)&&Number.isFinite(lng)){
      const accuracy=Number(saved?.accuracy ?? d?.accuracy_m)||60;
      state.lastLocation={lat,lng,accuracy};
      window.TC_MAP.setLocation(lat,lng,accuracy,false);
    }
  }catch(err){
    node.innerHTML='<div class="map-provider-error"><b>Mapa alternativo</b><span>'+esc(err?.message||'Não foi possível carregar o mapa.')+'</span></div>';
  }
}
function initActivityTerminalAutoScroll(){if(window.__tcActivityTerminalTimer){clearInterval(window.__tcActivityTerminalTimer);window.__tcActivityTerminalTimer=null}if(!state.authenticated||state.page!=='activity')return;const el=document.querySelector('.activity-terminal');if(!el||el.scrollHeight<=el.clientHeight)return;let dir=1;window.__tcActivityTerminalTimer=setInterval(()=>{const max=Math.max(0,el.scrollHeight-el.clientHeight);if(max<=0)return;if(el.scrollTop>=max-1)dir=-1;if(el.scrollTop<=1)dir=1;el.scrollTop+=dir*0.75},40)}
async function captureSignalInsert(requestId,kind,payload){if(!window.TC_DB?.enabled||!window.TC_DB.client)return;await window.TC_DB.client.from('capture_signals').insert({request_id:requestId,sender_role:'guardian',kind,payload});}
let tcCapturePeer=null,tcCaptureRequestId=null,tcCapturePoll=null;
// Ondas de som em TEMPO REAL: liga um AnalyserNode ao áudio da Criança e anima as
// barras conforme o volume real do microfone. Para quando a captura encerra.
let tcMicAudioCtx=null,tcMicRaf=null,tcMicSource=null;
const TC_MIC_BARS=7;
function micWavesHtml(){let b='';for(let i=0;i<TC_MIC_BARS;i++)b+='<i></i>';return b}
function startMicWaves(stream){
  stopMicWaves();
  try{
    const aud=(stream.getAudioTracks?.()||[]);
    if(!aud.length)return;
    const Ctx=window.AudioContext||window.webkitAudioContext;
    if(!Ctx)return;
    tcMicAudioCtx=new Ctx();
    tcMicSource=tcMicAudioCtx.createMediaStreamSource(stream);
    const analyser=tcMicAudioCtx.createAnalyser();
    analyser.fftSize=64;analyser.smoothingTimeConstant=.75;
    tcMicSource.connect(analyser);
    const data=new Uint8Array(analyser.frequencyBinCount);
    const tick=()=>{
      analyser.getByteFrequencyData(data);
      const bars=document.querySelectorAll('.tc-glass-mic-waves i');
      if(!bars.length){tcMicRaf=requestAnimationFrame(tick);return;}
      const step=Math.floor(data.length/bars.length)||1;
      bars.forEach((bar,i)=>{
        const v=data[i*step]||0;            // 0..255
        const h=Math.max(4,Math.round((v/255)*26)); // 4..30px
        bar.style.height=h+'px';
        bar.style.opacity=(0.4+Math.min(0.6,v/255)).toFixed(2);
      });
      tcMicRaf=requestAnimationFrame(tick);
    };
    if(tcMicAudioCtx.state==='suspended')tcMicAudioCtx.resume().catch(()=>{});
    tick();
  }catch(_){}
}
function stopMicWaves(){
  try{if(tcMicRaf)cancelAnimationFrame(tcMicRaf);tcMicRaf=null;if(tcMicSource)tcMicSource.disconnect();tcMicSource=null;if(tcMicAudioCtx&&tcMicAudioCtx.state!=='closed')tcMicAudioCtx.close();}catch(_){}tcMicAudioCtx=null;
}
window.startMicWaves=startMicWaves;window.stopMicWaves=stopMicWaves;
function showRemoteCapture(stream,requestId){const old=document.getElementById('tc-screen-preview');if(old)old.remove();const hasAudio=(stream.getAudioTracks?.()||[]).length>0;
  // Espelho na tela de vidro (pequeno)
  const glass=document.querySelector('.screen-glass');if(glass){glass.innerHTML='<video class="tc-camera-glass-video" autoplay playsinline muted></video><div class="screen-glass-live"><span></span> AO VIVO</div>';const gv=glass.querySelector('video');gv.srcObject=stream;gv.play().catch(()=>{});glass.dataset.live='1';glass.setAttribute('aria-label','Câmera da Criança ao vivo');}
  // Tela principal da câmera (painel dedicado, grande)
  const v=document.createElement('video');v.autoplay=true;v.playsInline=true;v.muted=false;v.volume=1;v.srcObject=stream;v.className='tc-screen-preview-video';
  const wrap=document.createElement('div');wrap.id='tc-screen-preview';wrap.className='tc-screen-preview';
  wrap.innerHTML='<div class="tc-screen-preview-head"><b>Câmera da Criança</b><span class="tc-live-audio">● AO VIVO</span><div class="tc-sp-actions"><button type="button" class="btn small" id="tc-switch-cam" title="Trocar câmera (frente/trás)">↻ Trocar</button><button type="button" class="btn small" id="tc-enable-audio" title="Ativar som">🔊 Som</button><button type="button" class="btn small danger" id="tc-stop-screen">✕ Encerrar</button></div></div>';
  wrap.appendChild(v);document.body.appendChild(wrap);
  const at=stream.getAudioTracks?.()||[];at.forEach(t=>t.enabled=true);
  const playAudio=()=>{v.muted=false;v.volume=1;return v.play().catch(()=>{})};playAudio();v.play().catch(()=>{v.muted=true;v.play().catch(()=>{});});
  const eb=document.getElementById('tc-enable-audio');if(eb)eb.onclick=()=>{playAudio();eb.textContent='🔊 Som ativo'};
  const sc=document.getElementById('tc-switch-cam');if(sc)sc.onclick=()=>switchRemoteCamera(requestId);
  const sp=document.getElementById('tc-stop-screen');if(sp)sp.onclick=()=>endRemoteCapture(requestId);
  try{initScreenPanelGestures&&initScreenPanelGestures()}catch(_){}}
async function switchRemoteCamera(requestId){try{await captureSignalInsert(requestId,'cmd',{action:'switch-camera'});pushCaptureTerminal?.('CÂMERA',true,'a trocar câmera');}catch(e){}}
function showRemoteAudio(stream,requestId){const old=document.getElementById('tc-audio-only-panel');if(old)old.remove();
  // Microfone animado dentro da tela de vidro: áudio conectado, sem vídeo.
  const glass=document.querySelector('.screen-glass');if(glass){glass.innerHTML='<div class="tc-glass-audio"><div class="tc-glass-mic big" aria-label="Áudio ao vivo"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v3"/></svg><span class="tc-glass-mic-waves">'+micWavesHtml()+'</span></div><span class="screen-glass-live"><span></span> ÁUDIO AO VIVO</span></div>';glass.dataset.live='1';glass.setAttribute('aria-label','Áudio da Criança ao vivo');startMicWaves(stream);}const audio=document.createElement('audio');audio.id='tc-remote-audio';audio.autoplay=true;audio.controls=true;audio.volume=1;audio.srcObject=stream;const wrap=document.createElement('div');wrap.id='tc-audio-only-panel';wrap.className='tc-audio-only-panel';wrap.innerHTML='<div class="tc-audio-only-head"><b>🎙️ ÁUDIO DA CRIANÇA</b><span class="tc-live-audio">● AO VIVO</span></div><p>Microfone autorizado pela Criança. Nenhuma câmera está sendo transmitida.</p>';wrap.appendChild(audio);const hint=document.createElement('p');hint.className='tc-audio-hint';hint.style.cssText='margin:4px 0 0;font-size:12.5px;color:#ffd27a;display:none';hint.textContent='Toque em “Ativar áudio” para ouvir.';wrap.appendChild(hint);const btn=document.createElement('button');btn.className='btn primary';btn.textContent='🔊 Ativar áudio';
  // Reprodução robusta: em telemóvel o navegador bloqueia o áudio automático se já
  // passou tempo desde o toque. Se bloquear, destacamos o botão para o utilizador tocar.
  const tryPlay=()=>{ try{ audio.muted=false; audio.volume=1; }catch(_){ } return audio.play().then(()=>{hint.style.display='none';btn.classList.remove('pulse');btn.textContent='🔊 Áudio ativo';}).catch(()=>{hint.style.display='block';btn.classList.add('pulse');}); };
  btn.onclick=tryPlay;wrap.appendChild(btn);const stop=document.createElement('button');stop.className='btn';stop.textContent='Encerrar';stop.onclick=()=>endRemoteCapture(requestId);wrap.appendChild(stop);document.body.appendChild(wrap);
  if(!document.getElementById('tc-audio-pulse-style')){const st=document.createElement('style');st.id='tc-audio-pulse-style';st.textContent='.tc-audio-only-panel .btn.pulse{animation:tcAudPulse 1.1s ease-in-out infinite}@keyframes tcAudPulse{0%,100%{box-shadow:0 0 0 0 rgba(14,165,233,.5)}50%{box-shadow:0 0 0 10px rgba(14,165,233,0)}}';document.head.appendChild(st);}
  tryPlay();
  // Qualquer toque no ecrã também desbloqueia o áudio (política de autoplay do browser).
  const unlock=()=>{ tryPlay().finally(()=>{ document.removeEventListener('touchend',unlock);document.removeEventListener('click',unlock); }); };
  document.addEventListener('touchend',unlock,{once:true});document.addEventListener('click',unlock,{once:true});}
async function endRemoteCapture(requestId){stopMicWaves();stopCaptureSearch();try{if(tcCapturePeer){tcCapturePeer.close();tcCapturePeer=null}await window.TC_DB.client.rpc('end_capture',{p_request_id:requestId});await captureSignalInsert(requestId,'bye',{reason:'guardian-ended'});}catch(e){}const wrap=document.getElementById('tc-screen-preview');if(wrap)wrap.remove();const glass=document.querySelector('.screen-glass');if(glass){glass.innerHTML='<div class="screen-glass-sheen"></div><span class="screen-glass-dot"></span><span class="screen-glass-label">CÂMERA · TOCAR PARA VISUALIZAR</span>';glass.dataset.live='0';glass.removeAttribute('aria-label');}await addEvent('CÂMERA DA CRIANÇA','Sessão de captura encerrada pelo Guardian',{status:'FINALIZADO',source:'Guardian'});}
function tcPollCaptureStatus(requestId){if(!window.TC_DB?.enabled||!window.TC_DB.client||!requestId)return;if(window.__tcCapStatusPoll)clearInterval(window.__tcCapStatusPoll);let done=false;window.__tcCapStatusPoll=setInterval(async function(){try{const {data}=await window.TC_DB.client.from('capture_requests').select('status').eq('id',requestId).maybeSingle();if(!data||done)return;if(data.status==='ACCEPTED'){done=true;clearInterval(window.__tcCapStatusPoll);try{stopCaptureSearch()}catch(_){}try{await addEvent('CAPTURA','Criança aceitou. A iniciar sessão autorizada.',{status:'AUTORIZADO',source:'Guardian'})}catch(_){}try{await startGuardianPeer(requestId)}catch(_){}}else if(data.status==='DECLINED'){done=true;clearInterval(window.__tcCapStatusPoll);try{stopCaptureSearch()}catch(_){}try{await addEvent('CAPTURA','Criança recusou a solicitação.',{status:'RECUSADO',source:'Guardian'})}catch(_){}}else if(data.status==='ENDED'){done=true;clearInterval(window.__tcCapStatusPoll);try{await endRemoteCapture(requestId)}catch(_){}}}catch(_){}} ,3000);setTimeout(function(){try{clearInterval(window.__tcCapStatusPoll)}catch(_){}} ,300000)}
async function startGuardianPeer(requestId){if(!window.TC_DB?.enabled||!window.TC_DB.client)throw new Error('Supabase não configurado.');if(tcCapturePeer&&tcCaptureRequestId===requestId)return;tcCaptureRequestId=requestId;const {data:requestInfo}=await window.TC_DB.client.from('capture_requests').select('kind').eq('id',requestId).maybeSingle();const isAudioOnly=requestInfo?.kind==='AUDIO_ONLY';tcCapturePeer=new RTCPeerConnection(window.TC_RTC||{});const gIce=[],gSeen={};tcCapturePeer.ontrack=e=>{const stream=e.streams?.[0]||new MediaStream([e.track]);if(window.__tcNoVideoTimer){clearTimeout(window.__tcNoVideoTimer);window.__tcNoVideoTimer=null}if(isAudioOnly)showRemoteAudio(stream,requestId);else showRemoteCapture(stream,requestId)};tcCapturePeer.onicecandidate=e=>{if(e.candidate)captureSignalInsert(requestId,'ice',e.candidate.toJSON())};
  // Diagnóstico da ligação WebRTC: avisa claramente se a ligação falhar (ex.: rede sem
  // STUN/TURN) em vez de ficar em silêncio sem som/imagem.
  tcCapturePeer.onconnectionstatechange=()=>{try{const st=tcCapturePeer&&tcCapturePeer.connectionState;if(st==='connected'){if(window.__tcRtcFailTimer){clearTimeout(window.__tcRtcFailTimer);window.__tcRtcFailTimer=null}addEvent(isAudioOnly?'ÁUDIO DA CRIANÇA':'CÂMERA DA CRIANÇA','Ligação estabelecida. A receber '+(isAudioOnly?'áudio':'imagem')+' ao vivo.',{status:'CONECTADO',source:'Guardian'});}else if(st==='failed'){addEvent(isAudioOnly?'ÁUDIO DA CRIANÇA':'CÂMERA DA CRIANÇA','Não foi possível ligar ao telemóvel da criança (rede/NAT). Tente novamente; se persistir em dados móveis, é preciso um servidor TURN.',{status:'ERRO',source:'Guardian'});}}catch(_){}};async function gHandle(sig){if(!tcCapturePeer||!sig||sig.sender_role!=='child')return;if(gSeen[sig.id])return;gSeen[sig.id]=1;try{if(sig.kind==='offer'){if(!tcCapturePeer.currentRemoteDescription){await tcCapturePeer.setRemoteDescription(sig.payload);const ans=await tcCapturePeer.createAnswer();await tcCapturePeer.setLocalDescription(ans);await captureSignalInsert(requestId,'answer',ans);while(gIce.length){try{await tcCapturePeer.addIceCandidate(gIce.shift())}catch(_){}}}}else if(sig.kind==='ice'&&sig.payload){if(tcCapturePeer.remoteDescription&&tcCapturePeer.remoteDescription.type){try{await tcCapturePeer.addIceCandidate(sig.payload)}catch(_){}}else{gIce.push(sig.payload)}}}catch(e){console.warn('Capture signaling:',e&&e.message)}}if(window.__tcCaptureSignalChannel)window.TC_DB.client.removeChannel(window.__tcCaptureSignalChannel);window.__tcCaptureSignalChannel=window.TC_DB.client.channel('tc-capture-signal-g-'+requestId).on('postgres_changes',{event:'INSERT',schema:'public',table:'capture_signals',filter:'request_id=eq.'+requestId},p=>gHandle(p.new)).subscribe();const {data:signals}=await window.TC_DB.client.from('capture_signals').select('*').eq('request_id',requestId).eq('sender_role','child').order('created_at',{ascending:true});for(const sig of (signals||[])){await gHandle(sig)}if(window.__tcGSigPoll)clearInterval(window.__tcGSigPoll);window.__tcGSigPoll=setInterval(async function(){try{if(!tcCapturePeer){clearInterval(window.__tcGSigPoll);return}const {data}=await window.TC_DB.client.from('capture_signals').select('*').eq('request_id',requestId).eq('sender_role','child').order('created_at',{ascending:true});for(const sig of (data||[])){await gHandle(sig)}}catch(_){}} ,1500);if(window.__tcNoVideoTimer)clearTimeout(window.__tcNoVideoTimer);window.__tcNoVideoTimer=setTimeout(function(){try{const g=document.querySelector('.screen-glass');if(!g||g.dataset.live!=='1'){addEvent('CÂMERA DA CRIANÇA','Sem vídeo recebido. A câmera ao vivo precisa de 2 telemóveis: num só aparelho o Android desliga a câmera da Criança ao mudar de app. Confirme também que a Criança autorizou a câmera no Android.',{status:'SEM_VIDEO',source:'Guardian'})}}catch(_){}} ,15000)}
// Terminal da captura: regista o estado de cada função (câmera/áudio/projeção) com
// nome do dispositivo, localização real, horas e data — ponto 4.
function captureInfo(){const d=state.devices[0]||{};const online=isDeviceOnline(d);const loc=(online&&d.last_lat!=null&&d.last_lng!=null)?`${Number(d.last_lat).toFixed(5)}, ${Number(d.last_lng).toFixed(5)}`:'sem localização';return {name:d.device_name||'Child',loc,online}}
function pushCaptureTerminal(fn,connected,extra=''){const info=captureInfo();const now=new Date();const date=now.toLocaleDateString('pt-PT');const time=now.toLocaleTimeString('pt-PT');const estado=connected?'CONECTADO':'NAO_CONECTADO';const detail=`${fn} · ${connected?'CONECTADO':'NÃO CONECTADO'} · ${info.name} · ${info.online?'ONLINE':'OFFLINE'} · 📍 ${info.loc} · ${date} ${time}${extra?' · '+extra:''}`;addEvent('CAPTURA',detail,{status:connected?'CONECTADO':'NAO_CONECTADO',source:'Captura',contact:info.name,child_name:info.name})}
// Mecanismo "procurando conexão" partilhado pelos 3 botões (câmera/áudio/projeção).
// Marca o botão, mostra pulsos de procura e regista no terminal até haver resposta.
function startCaptureSearch(kind,label){
  state.capturePending=kind;
  if(window.__tcSearchTerminalTimer)clearInterval(window.__tcSearchTerminalTimer);
  let dots=0;
  const tick=()=>{dots=(dots%3)+1;const ev=normalizeEvent({type:'CONEXAO',detail:'Procurando conexão'+'.'.repeat(dots)+' ('+label+')',status:'PROCURANDO',source:'Captura'});state.events.unshift(ev);state.events=state.events.slice(0,200);if(state.page==='screen')render();};
  tick();
  window.__tcSearchTerminalTimer=setInterval(tick,1800);
  // Tempo-limite de procura (45s) — evita ficar a "procurar" para sempre.
  if(window.__tcSearchTimeout)clearTimeout(window.__tcSearchTimeout);
  window.__tcSearchTimeout=setTimeout(()=>{ if(state.capturePending===kind){ addEvent('CONEXAO','Sem resposta do dispositivo ('+label+'). Verifique no Supabase: (1) SQL supabase/setup-completo.sql executado; (2) Realtime ativo nas tabelas capture_requests/capture_signals; (3) Anonymous Sign-ins ativado (o app da Criança precisa dele para ligar).',{status:'SEM_RESPOSTA',source:'Captura'}); stopCaptureSearch(); } },45000);
}
function stopCaptureSearch(){
  state.capturePending=null;
  if(window.__tcSearchTerminalTimer){clearInterval(window.__tcSearchTerminalTimer);window.__tcSearchTerminalTimer=null;}
  if(window.__tcSearchTimeout){clearTimeout(window.__tcSearchTimeout);window.__tcSearchTimeout=null;}
  if(state.page==='screen')render();
}
window.startCaptureSearch=startCaptureSearch;window.stopCaptureSearch=stopCaptureSearch;
async function requestScreenCapture(){const d=state.devices[0];if(!d?.child_id){await addEvent('CÂMERA DA CRIANÇA','Nenhuma Criança vinculada para solicitar captura',{status:'INDISPONÍVEL',source:'Guardian'});return}startCaptureSearch('camera','Câmera');if(!window.TC_DB?.enabled||!window.TC_DB.client){await addEvent('CÂMERA DA CRIANÇA','Serviço de captura não configurado',{status:'INDISPONÍVEL',source:'Guardian'});return}try{const {data,error}=await window.TC_DB.client.rpc('request_capture',{p_child_id:d.child_id,p_device_id:d.id,p_kind:'CAMERA_VIDEO'});if(error)throw error;tcCaptureRequestId=data;tcPollCaptureStatus(data);await addEvent('CÂMERA DA CRIANÇA','Pedido enviado para aprovação no aplicativo Minha Segurança.',{status:'PENDENTE',source:'Guardian'});const channel=window.TC_DB.client.channel('tc-capture-guardian-'+data).on('postgres_changes',{event:'UPDATE',schema:'public',table:'capture_requests',filter:'id=eq.'+data},async payload=>{const r=payload.new;if(r.status==='ACCEPTED'){await addEvent('CÂMERA DA CRIANÇA','Criança aceitou a solicitação. Iniciando sessão de vídeo autorizada.',{status:'AUTORIZADO',source:'Guardian'});stopCaptureSearch();pushCaptureTerminal('CÂMERA',true);await startGuardianPeer(data)}else if(r.status==='DECLINED'){await addEvent('CÂMERA DA CRIANÇA','Criança recusou a solicitação.',{status:'RECUSADO',source:'Guardian'});stopCaptureSearch();pushCaptureTerminal('CÂMERA',false,'recusado')}else if(r.status==='ENDED'){await endRemoteCapture(data)}}).subscribe();window.__tcCaptureChannel=channel;}catch(e){await addEvent('CÂMERA DA CRIANÇA','Não foi possível solicitar captura: '+(e?.message||'erro'),{status:'ERRO',source:'Guardian'})}}
async function requestAudioOnly(){const d=state.devices[0];if(!d?.child_id){await addEvent('ÁUDIO DA CRIANÇA','Nenhuma Criança vinculada para solicitar áudio',{status:'INDISPONÍVEL',source:'Guardian'});return}startCaptureSearch('audio','Áudio');if(!window.TC_DB?.enabled||!window.TC_DB.client){await addEvent('ÁUDIO DA CRIANÇA','Serviço de áudio não configurado',{status:'INDISPONÍVEL',source:'Guardian'});return}try{const {data,error}=await window.TC_DB.client.rpc('request_capture',{p_child_id:d.child_id,p_device_id:d.id,p_kind:'AUDIO_ONLY'});if(error)throw error;tcCaptureRequestId=data;tcPollCaptureStatus(data);await addEvent('ÁUDIO DA CRIANÇA','Pedido de áudio enviado para aprovação no aplicativo Minha Segurança.',{status:'PENDENTE',source:'Guardian'});const channel=window.TC_DB.client.channel('tc-audio-guardian-'+data).on('postgres_changes',{event:'UPDATE',schema:'public',table:'capture_requests',filter:'id=eq.'+data},async payload=>{const r=payload.new;if(r.status==='ACCEPTED'){await addEvent('ÁUDIO DA CRIANÇA','Criança aceitou. Iniciando áudio autorizado.',{status:'AUTORIZADO',source:'Guardian'});stopCaptureSearch();pushCaptureTerminal('ÁUDIO',true);await startGuardianPeer(data)}else if(r.status==='DECLINED'){await addEvent('ÁUDIO DA CRIANÇA','Criança recusou a solicitação.',{status:'RECUSADO',source:'Guardian'});stopCaptureSearch();pushCaptureTerminal('ÁUDIO',false,'recusado')}else if(r.status==='ENDED'){await endRemoteCapture(data)}}).subscribe();window.__tcAudioChannel=channel;}catch(e){await addEvent('ÁUDIO DA CRIANÇA','Não foi possível solicitar áudio: '+(e?.message||'erro'),{status:'ERRO',source:'Guardian'})}}
async function requestScreenProjection(){const d=state.devices[0];if(!d?.child_id){await addEvent('PROJEÇÃO DE TELA','Nenhuma Criança vinculada para solicitar projeção',{status:'INDISPONÍVEL',source:'Guardian'});return}startCaptureSearch('screen','Projeção');if(!window.TC_DB?.enabled||!window.TC_DB.client){await addEvent('PROJEÇÃO DE TELA','Serviço de projeção não configurado',{status:'INDISPONÍVEL',source:'Guardian'});return}try{const {data,error}=await window.TC_DB.client.rpc('request_capture',{p_child_id:d.child_id,p_device_id:d.id,p_kind:'SCREEN_VIDEO'});if(error)throw error;tcCaptureRequestId=data;tcPollCaptureStatus(data);await addEvent('PROJEÇÃO DE TELA','Pedido enviado para aprovação no aplicativo Minha Segurança.',{status:'PENDENTE',source:'Guardian'});const channel=window.TC_DB.client.channel('tc-screen-guardian-'+data).on('postgres_changes',{event:'UPDATE',schema:'public',table:'capture_requests',filter:'id=eq.'+data},async payload=>{const r=payload.new;if(r.status==='ACCEPTED'){await addEvent('PROJEÇÃO DE TELA','Criança aceitou a projeção. Iniciando sessão autorizada.',{status:'AUTORIZADO',source:'Guardian'});stopCaptureSearch();pushCaptureTerminal('PROJEÇÃO',true);await startGuardianPeer(data)}else if(r.status==='DECLINED'){await addEvent('PROJEÇÃO DE TELA','Criança recusou a projeção.',{status:'RECUSADO',source:'Guardian'});stopCaptureSearch();pushCaptureTerminal('PROJEÇÃO',false,'recusado')}else if(r.status==='ENDED'){await endRemoteCapture(data)}}).subscribe();window.__tcCaptureChannel=channel;}catch(e){await addEvent('PROJEÇÃO DE TELA','Não foi possível solicitar projeção: '+(e?.message||'erro'),{status:'ERRO',source:'Guardian'})}}

async function openScreenCapture(){const glass=document.querySelector('.screen-glass');if(glass&&glass.dataset.live==='1'){return}await requestScreenCapture()}
function initLocationTerminalAutoScroll(){if(window.__tcLocationTerminalTimer){clearInterval(window.__tcLocationTerminalTimer);window.__tcLocationTerminalTimer=null}if(!state.authenticated||state.page!=='map')return;const el=document.querySelector('.location-code-terminal');if(!el||el.scrollHeight<=el.clientHeight)return;let dir=1;window.__tcLocationTerminalTimer=setInterval(()=>{const max=Math.max(0,el.scrollHeight-el.clientHeight);if(max<=0)return;if(el.scrollTop>=max-1)dir=-1;if(el.scrollTop<=1)dir=1;el.scrollTop+=dir*.75},40)}

function initScreenPanelGestures(){
  const targets=[document.querySelector('.screen-glass'),document.getElementById('tc-screen-preview')].filter(Boolean);
  targets.forEach(el=>{
    if(el.dataset.gestureReady==='1')return;
    el.dataset.gestureReady='1';
    let scale=Number(el.dataset.scale||1), x=Number(el.dataset.x||0), y=Number(el.dataset.y||0);
    let startX=0,startY=0,startDist=0,startScale=scale,moved=false,dragging=false;
    const apply=()=>{el.style.transform=`translate3d(${x}px,${y}px,0) scale(${scale})`;el.style.transformOrigin='center center'};
    const dist=(a,b)=>Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
    const mid=(a,b)=>({x:(a.clientX+b.clientX)/2,y:(a.clientY+b.clientY)/2});
    el.addEventListener('touchstart',e=>{
      if(!e.touches.length)return;
      e.stopPropagation();
      moved=false; dragging=e.touches.length===1;
      if(e.touches.length===1){startX=e.touches[0].clientX-x;startY=e.touches[0].clientY-y}
      else {startDist=dist(e.touches[0],e.touches[1]);startScale=scale}
    },{passive:false});
    el.addEventListener('touchmove',e=>{
      if(!e.touches.length)return;
      e.preventDefault();e.stopPropagation();moved=true;
      if(e.touches.length===1 && dragging){x=e.touches[0].clientX-startX;y=e.touches[0].clientY-startY;apply()}
      else if(e.touches.length>=2){const d=dist(e.touches[0],e.touches[1]);scale=Math.min(3.2,Math.max(.55,startScale*(d/Math.max(1,startDist))));apply()}
    },{passive:false});
    el.addEventListener('touchend',e=>{if(moved){el.dataset.dragged='1';setTimeout(()=>delete el.dataset.dragged,180)};dragging=false},{passive:false});
    el.addEventListener('dblclick',e=>{e.preventDefault();scale=1;x=0;y=0;apply()});
    apply();
  });
}

function initAutoTerminalScroll(){if(window.__tcAutoTerminalTimer){clearInterval(window.__tcAutoTerminalTimer);window.__tcAutoTerminalTimer=null}if(!state.authenticated||!['overview','messages','calls','screen'].includes(state.page))return;const els=document.querySelectorAll('.auto-terminal');if(!els.length)return;let dir=1;window.__tcAutoTerminalTimer=setInterval(()=>els.forEach(el=>{const max=Math.max(0,el.scrollHeight-el.clientHeight);if(max<=0)return;if(el.scrollTop>=max-1)dir=-1;if(el.scrollTop<=1)dir=1;el.scrollTop+=dir*.75}),40)}
function render(){syncDeviceName();
  // Bloqueio por expiração do plano (30 dias): mostra o pagamento e não deixa usar.
  if(state.authenticated&&!isSuperAdmin()&&isPlanExpired()){enforcePlan();}
  // Guarda a posição de scroll para não "saltar para cima" ao re-renderizar (ex.: ao
  // tocar em "Atualizar aplicativo", que faz render enquanto verifica).
  const __samePage=(window.__tcLastRenderedPage===state.page);
  window.__tcLastRenderedPage=state.page;
  const __prevMain=document.querySelector('.main');
  const __scrollMain=(__samePage&&__prevMain)?__prevMain.scrollTop:0;
  const __scrollWin=__samePage?(window.scrollY||document.documentElement.scrollTop||0):0;
  if(window.__tcActivityTerminalTimer){clearInterval(window.__tcActivityTerminalTimer);window.__tcActivityTerminalTimer=null}if(window.__tcAutoTerminalTimer){clearInterval(window.__tcAutoTerminalTimer);window.__tcAutoTerminalTimer=null}if(window.__tcLocationTerminalTimer){clearInterval(window.__tcLocationTerminalTimer);window.__tcLocationTerminalTimer=null}// PORTÃO de plano: enquanto não houver plano ativo (1.ª vez ou expirado), a app
// NÃO é montada — só o seletor de planos. Assim o "Voltar" do Android não entra.
const __gated=state.authenticated&&!isSuperAdmin()&&needsPlanChoice();
if(__gated){const o=document.getElementById('tc-plan-overlay');if(o)o.remove();
  // Captura o "Voltar" do Android: coloca uma entrada no histórico para que a tecla
  // física dispare popstate (re-renderiza o portão) em vez de revelar a app.
  if(!window.__tcGatePushed){try{history.pushState({tcPlanGate:1},'','');}catch(_){}window.__tcGatePushed=true;}
}else{window.__tcGatePushed=false;}
document.getElementById('app').innerHTML=state.authenticated?(__gated?planGateView():appShell()):authView();
  // Restaura o scroll (apenas quando continua na mesma página).
  if(__scrollMain||__scrollWin){const nm=document.querySelector('.main');if(nm&&__scrollMain)nm.scrollTop=__scrollMain;if(__scrollWin)window.scrollTo(0,__scrollWin);}
  if(state.authenticated&&(state.page==='overview'||state.page==='map'))setTimeout(initMap,50);if(state.authenticated&&state.page==='devices'&&state.pairCode)setTimeout(initPairQR,50);if(state.authenticated&&state.page==='activity')setTimeout(initActivityTerminalAutoScroll,80);if(state.authenticated&&state.page==='map')setTimeout(initLocationTerminalAutoScroll,80);if(state.authenticated&&['overview','messages','calls','screen'].includes(state.page))setTimeout(initAutoTerminalScroll,80);if(state.authenticated&&state.page==='screen')setTimeout(initScreenPanelGestures,90)}
window.addEvent=addEvent;window.verifyPermission=verifyPermission;window.requestScreenCapture=requestScreenCapture;window.requestAudioOnly=requestAudioOnly;window.openScreenCapture=openScreenCapture;window.toggleMenu=toggleMenu;window.closeMenu=closeMenu;window.shareInvite=shareInvite;window.copyInvite=copyInvite;window.shareWhatsApp=shareWhatsApp;window.shareEmail=shareEmail;window.shareSMS=shareSMS;window.checkForUpdates=checkForUpdates;window.updateAppNow=updateAppNow;window.toggleAutoUpdates=toggleAutoUpdates;window.openRelease=openRelease;window.go=go;window.openAbout=openAbout;window.setMap=setMap;window.login=login;window.signup=signup;window.google=google;window.logout=logout;window.recoverPassword=recoverPassword;window.updateRecoveredPassword=updateRecoveredPassword;window.createPairing=createPairing;window.copyPairCode=copyPairCode;window.refreshLocationTerminalUI=refreshLocationTerminalUI;window.refreshApplication=refreshApplication;window.refreshMonitoring=refreshMonitoring;window.pushMapTerminal=pushMapTerminal;
window.addEventListener('storage',e=>{if(e.key==='tc_events'){try{const v=JSON.parse(e.newValue||'[]');state.events=Array.isArray(v)?v:[];render()}catch(_){}}});
// Atualizações de permissões vindas do Android (APK): reflete o novo estado real.
function applyNativePermissionStatus(st){if(!st)return;if(!state.permissionChecks)state.permissionChecks={};const mapBack={location:'Localização',notifications:'Notificações',microphone:'Microfone',camera:'Câmera',sms:'SMS / mensagens',screen:'Captura de tela'};Object.keys(mapBack).forEach(k=>{if(k in st){state.permissionChecks[mapBack[k]]={status:st[k]?'ATIVA':'PENDENTE',detail:st[k]?'Permissão concedida no Android.':'Permissão ainda não concedida no Android.'}}});if(state.page==='permissions')render()}
window.addEventListener('tc-native-permissions',e=>applyNativePermissionStatus(e.detail));
window.addEventListener('tc-native-permissions-updated',()=>{try{const raw=window.TCNativePermissions?.getStatus?.();if(raw)applyNativePermissionStatus(typeof raw==='string'?JSON.parse(raw):raw)}catch(_){}});
if(!Array.isArray(state.notifications))state.notifications=[];
if(!state.events.length){state.events=[{id:'boot',type:'SYSTEM',detail:'Guardian iniciado · pronto para vincular Child',at:new Date().toLocaleString('pt-PT'),status:'ATIVO',source:'Guardian'},{id:'pair',type:'PAIRING',detail:'Aguardando vínculo Guardian ↔ Child',at:new Date().toLocaleString('pt-PT'),status:'PENDENTE',source:'Supabase'}];save()}
window.addEventListener('tc-pwa-install-ready',()=>{const e=document.getElementById('pwa-install-status');if(e)e.textContent='Pronto para instalar pelo Chrome.';});window.addEventListener('tc-pwa-installed',()=>{const e=document.getElementById('pwa-install-status');if(e)e.textContent='T Connect foi instalado neste dispositivo.';});window.addEventListener('tc-native-update',e=>{const d=e.detail||{};if(d.message){state.update.error=d.message;render();}});async function autoUpdateIfNeeded(){
  if(!state.authenticated || !state.update.auto || !navigator.onLine || state.update.checking) return;
  try{
    const release=await fetchReleaseManifest();
    if(!release?.version)return;
    state.update.latest=release;
    const current=(window.TCNativeUpdater?.getCurrentVersion?.()||window.TC_APP_VERSION).replace(/^v/i,'');
    const newer=String(release.version).localeCompare(String(current),undefined,{numeric:true,sensitivity:'base'})>0;
    if(newer){
      localStorage.setItem('tc_auto_update_target',String(release.version));
      try{ tcShowUpdateBanner(release); }catch(_){}
      if(window.TCNativeUpdater && (release.apk_guardian||release.apk_url)){
        state.update.error='Nova versão encontrada. A preparar a atualização…';
        render();
        await updateAppNow();
      }else if('serviceWorker' in navigator){
        const reg=await navigator.serviceWorker.getRegistration('../');
        if(reg){await tcTimeout(reg.update(),8000); if(reg.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'});}
      }
    }
  }catch(err){console.warn('Atualização automática:',err?.message||err)}
}
// ~5s depois de abrir: se houver mesmo uma NOVA versão (maior que a instalada), mostra
// a mensagem "Nova versão vX já foi lançada" a convidar a ir verificar a atualização.
// Só aparece para versões mais recentes — nunca para a versão que já está instalada.
async function tcAnnounceNewVersion(){
  try{
    if(!state.authenticated||!navigator.onLine) return;
    const release=await fetchReleaseManifest();
    if(!release?.version) return;
    const current=String(window.TCNativeUpdater?.getCurrentVersion?.()||window.TC_APP_VERSION||'').replace(/^v/i,'');
    if(cmpVersion(release.version,current)>0){
      state.update.latest=release;
      tcShowUpdateBanner(release);
    }
  }catch(_){}
}
window.tcAnnounceNewVersion=tcAnnounceNewVersion;
boot().then(()=>{
  if(state.authenticated){
    showPreparationThenContinue();
    if(state.update.auto){checkForUpdates(true);setTimeout(autoUpdateIfNeeded,800);}
    // Anúncio de nova versão 5 segundos depois de abrir (independente da atualização automática).
    setTimeout(()=>{try{tcAnnounceNewVersion()}catch(_){}} ,5000);
  }
  const autoUpdateCheck=()=>{if(state.authenticated&&state.update.auto&&navigator.onLine)autoUpdateIfNeeded()};
  window.addEventListener('online',autoUpdateCheck);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')autoUpdateCheck()});
  // Ao voltar ao primeiro plano: se o plano expirou (7 dias grátis / 30 dias pago),
  // bloqueia já o acesso, sem hesitar. O ecrã de planos aparece de imediato.
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&state.authenticated&&!isSuperAdmin()&&isPlanExpired())enforcePlan()});
  if(state.update.auto){setInterval(autoUpdateCheck,5*60*1000);}
  // Reavalia o estado online/offline periodicamente: se o heartbeat ficar velho,
  // o cartão passa a "Offline" sozinho, sem precisar de carregar em Atualizar.
  // Reavalia online/offline periodicamente, mas só re-renderiza se o estado mudou de
  // facto — evitar reconstruir o DOM à toa (que causava um "piscar" da tela).
  let __lastOnline=null;
  setInterval(()=>{ if(!state.authenticated||document.visibilityState==='hidden')return; if(!['overview','status','map'].includes(state.page))return; const on=isDeviceOnline(state.devices[0]); if(on!==__lastOnline){__lastOnline=on;render();} },30000);
  // Verifica a expiração do plano a cada minuto: se expirar durante o uso, bloqueia já.
  setInterval(()=>{ if(state.authenticated&&!isSuperAdmin()&&isPlanExpired()){enforcePlan();} },60000);
  // Rede de segurança: recarrega mensagens/chamadas/contactos de tempos a tempos,
  // para as recentes aparecerem mesmo que o tempo-real falhe um evento.
  // Atualização a cada 5s nas páginas de Mensagens, Chamadas, WhatsApp e Contactos:
  // apanha sempre o que a Shield acabou de enviar (além do tempo-real), mostrando o recente.
  // Robusto: guarda de sobreposição (não dispara nova leitura se a anterior ainda corre),
  // re-liga o tempo-real se a subscrição caiu, e revalida assim que a app volta ao primeiro plano.
  window.__tcFastPullBusy=false;
  async function tcFastPull(){ if(window.__tcFastPullBusy)return; if(!state.authenticated||document.visibilityState==='hidden')return; window.__tcFastPullBusy=true; try{ try{ if(typeof ensureCommsRealtime==='function')ensureCommsRealtime(); }catch(_){} if(state.page==='messages'){await loadMessages();} else if(state.page==='calls'){await loadCalls();} else if(state.page==='contacts'){await loadContacts();await loadCalls();await loadMessages();} else if(state.page==='whatsapp'){await loadMessages();} else if(state.page==='overview'||state.page==='status'){await loadMessages();await loadCalls();} }catch(_){}finally{ window.__tcFastPullBusy=false; } }
  setInterval(tcFastPull,5000);
  try{ document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='visible'){ tcFastPull(); } }); }catch(_){}
});
