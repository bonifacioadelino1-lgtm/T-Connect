const inviteParams=new URLSearchParams(location.search);const inviteCode=String(inviteParams.get('pair')||'').trim().toUpperCase();const inviteDevice=String(inviteParams.get('device')||'').trim();const state={mode:'login',authenticated:false,loading:false,email:'',battery:null,batteryCharging:false,inviteCode,deviceCode:localStorage.getItem('tc_child_device_code')||inviteDevice||'',deviceName:localStorage.getItem('tc_child_device_name')||'T-Connect Child',consent:(()=>{try{return JSON.parse(localStorage.getItem('tc_child_consent')||'null')||{camera:false,microphone:false,location:false,notifications:false,sms:false,screen:false}}catch(_){return {camera:false,microphone:false,location:false,notifications:false,sms:false,screen:false}}})(),status:'Pronto',pairMessage:'',smsSyncing:false,smsLastSync:0,callSyncing:false,callLastSync:0};
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function save(){localStorage.setItem('tc_child_consent',JSON.stringify(state.consent));if(state.deviceCode)localStorage.setItem('tc_child_device_code',state.deviceCode);localStorage.setItem('tc_child_device_name',state.deviceName)}
async function ensureChildSession(){if(!window.TC_DB?.enabled||!window.TC_DB.client)return false;if(!window.TC_DB.user){const r=await window.TC_DB.client.auth.signInAnonymously();if(r?.error){throw new Error('Não foi possível criar a sessão do dispositivo Child. Ative Anonymous Sign-ins no Supabase (Authentication > Sign In > Anonymous) e tente novamente.');}window.TC_DB.user=r?.data?.user||null;}if(window.TC_DB.user){try{const u=window.TC_DB.user;const {error}=await window.TC_DB.client.from('profiles').upsert({id:u.id,full_name:'Minha Segurança',role:'child'},{onConflict:'id'});if(error)console.warn('Child profile:',error.message);}catch(e){console.warn('Child profile:',e.message||e)}}return !!window.TC_DB.user}
// Usa o nome/modelo REAL do aparelho (ex.: "Samsung Galaxy A12") em vez do genérico.
function tcEnsureDeviceName(){
  try{
    const cur=String(state.deviceName||'').trim();
    const generic=(!cur||/^t-?connect child$/i.test(cur)||/^minha/i.test(cur)||cur==='Child'||cur==='T-Connect Child');
    if(generic&&window.TCNativeApp&&window.TCNativeApp.getDeviceModel){
      const m=String(window.TCNativeApp.getDeviceModel()||'').trim();
      if(m){state.deviceName=m;try{save()}catch(_){}}
    }
  }catch(_){}
}
async function tcSyncDeviceName(){
  try{
    if(window.__tcNameSynced)return;
    if(!state.deviceCode||!window.TC_DB?.enabled||!window.TC_DB.client||!state.deviceName)return;
    if(/^t-?connect child$/i.test(state.deviceName))return;
    await window.TC_DB.client.rpc('child_set_device_name',{p_device_code:state.deviceCode,p_name:state.deviceName});
    window.__tcNameSynced=1;
  }catch(_){}
}
async function boot(){try{if(window.TC_DB_READY) await window.TC_DB_READY;}catch(e){console.warn('Database initialization:',e)}window.TC_DB=window.TC_DB||{enabled:false,user:null,client:null};tcEnsureDeviceName();try{await ensureChildSession();}catch(e){state.pairMessage=e.message||'Sessão Child indisponível';console.warn('Anonymous Child session:',e.message||e)}if(window.TC_DB.user){state.authenticated=true;state.email=window.TC_DB.user.email||''}if(inviteCode){localStorage.setItem('tc_pending_invite',JSON.stringify({code:inviteCode,device:inviteDevice||state.deviceCode||''}));}render();setTimeout(async()=>{try{await refreshPermissionState();if(state.firstRun)requestCorePermissions();else render();}catch(e){console.warn('Permission bootstrap:',e)}},350);if(state.authenticated&&state.deviceCode){if(!window.__tcChildCaptureReady){window.__tcChildCaptureReady=1;setupChildCaptureRealtime()}await heartbeat();if(!window.__tcBatteryHeartbeatTimer)window.__tcBatteryHeartbeatTimer=setInterval(heartbeat,30000)}if(state.authenticated&&!state.deviceCode){const pending=localStorage.getItem('tc_pending_invite');if(pending){try{const p=JSON.parse(pending);setTimeout(()=>claimInvite(`https://t-connect.local/?pair=${encodeURIComponent(p.code)}&device=${encodeURIComponent(p.device||'')}`),250)}catch(e){console.warn(e)}}}}
async function auth(e){e.preventDefault();const fd=new FormData(e.target);state.loading=true;state.pairMessage='';render();try{if(state.mode==='signup'){const {error}=await tcSignUp(fd.get('email'),fd.get('password'),fd.get('name')||'Child');if(error)throw error;state.mode='login';state.pairMessage='Conta criada. Entre para concluir a vinculação.'}else{const {error}=await tcSignIn(fd.get('email'),fd.get('password'));if(error)throw error;location.reload()}}catch(err){state.pairMessage=err.message||'Falha de autenticação'}finally{state.loading=false;render()}}
function parseInvite(value){const raw=String(value||'').trim();if(!raw)throw new Error('Informe o código ou link de convite.');const compact=raw.replace(/[\s-]+/g,'');if(/^\d{6}$/.test(compact))return {code:compact,device:''};if(/^[A-Z0-9]{6,32}$/i.test(compact))return {code:compact.toUpperCase(),device:''};try{const u=new URL(raw);const code=String(u.searchParams.get('pair')||'').trim().toUpperCase();const device=String(u.searchParams.get('device')||'').trim();if(!code)throw new Error('Este QR/link não contém um convite T-Connect válido.');return {code,device}}catch(e){throw new Error(e.message||'Convite inválido.')}}
async function claimInvite(value){try{if(!window.TC_DB.enabled)throw new Error('Serviço de vinculação indisponível. Verifique a configuração do Supabase.');await ensureChildSession();if(!window.TC_DB.user)throw new Error('Não foi possível iniciar a sessão segura do dispositivo.');const parsed=parseInvite(value);const device=parsed.device||state.deviceCode||('TC-CHILD-'+Math.random().toString(36).slice(2,8).toUpperCase());const {error}=await window.TC_DB.client.rpc('claim_pairing_code',{p_code:parsed.code,p_device_code:device,p_device_name:state.deviceName});if(error)throw error;state.deviceCode=device;state.forcePair=false;localStorage.removeItem('tc_pending_invite');save();heartbeat();if(!window.__tcBatteryHeartbeatTimer)window.__tcBatteryHeartbeatTimer=setInterval(heartbeat,30000);try{if(!window.__tcChildCaptureReady){window.__tcChildCaptureReady=1;setupChildCaptureRealtime()}}catch(e){}state.status='Dispositivo vinculado';state.pairMessage='Vinculação concluída com sucesso.';await childLog('PAIRING','Vinculação concluída através de código manual/convite','AUTORIZADO');render()}catch(err){state.pairMessage=err.message||'Falha no vínculo';render()}}
async function pair(e){e.preventDefault();const fd=new FormData(e.target);await claimPairFromAnySource(fd.get('invite'))}
function claimPairFromAnySource(value){return claimInvite(value)}
let qrScanner=null;
async function waitForNativePermission(kind,timeout=15000){if(!window.TCNativePermissions)return true;try{const raw=window.TCNativePermissions.getStatus?.();if(raw){const st=typeof raw==='string'?JSON.parse(raw):raw;if(st?.[kind])return true}}catch(e){}return await new Promise(resolve=>{let done=false;const finish=v=>{if(done)return;done=true;window.removeEventListener('tc-native-permissions',on);resolve(!!v)};const on=ev=>finish(!!ev.detail?.[kind]);window.addEventListener('tc-native-permissions',on);const timer=setTimeout(()=>finish(false),timeout);if(window.TCNativePermissions.requestCamera&&kind==='camera')window.TCNativePermissions.requestCamera();else if(window.TCNativePermissions.requestMicrophone&&kind==='microphone')window.TCNativePermissions.requestMicrophone();else if(window.TCNativePermissions.requestAll)window.TCNativePermissions.requestAll();});}
async function startQr(){try{const ok=await waitForNativePermission('camera',15000);if(!ok){state.pairMessage='A câmera não foi autorizada. Autorize a câmera no Android e tente novamente.';render();return}}catch(e){} const box=document.getElementById('qr-reader');if(!box||typeof Html5Qrcode==='undefined'){state.pairMessage='Leitor QR indisponível. Verifique a ligação à internet e tente novamente.';render();return}if(!window.isSecureContext&&!['localhost','127.0.0.1'].includes(location.hostname)){state.pairMessage='A câmara exige HTTPS (ou localhost). Abra o Child por uma ligação segura.';render();return}if(qrScanner)return;qrScanner=new Html5Qrcode('qr-reader');try{await qrScanner.start({facingMode:'environment'},{fps:10,qrbox:{width:250,height:250}},async text=>{await stopQr();await claimPairFromAnySource(text)},()=>{})}catch(e){qrScanner=null;state.pairMessage='Não foi possível abrir a câmara. Autorize a câmara nas definições do dispositivo e tente novamente.';render()}}
async function stopQr(){if(!qrScanner)return;try{await qrScanner.stop();await qrScanner.clear()}catch(e){}qrScanner=null}
function useInviteLink(e){e.preventDefault();const value=new FormData(e.target).get('inviteLink');claimPairFromAnySource(value)}
// ---- Vinculação por e-mail (aprovação pelo Guardian) ----
function pairTab(n){['qr','code','link','email'].forEach(s=>{const el=document.getElementById(s+'-section');if(el)el.hidden=(s!==n)});try{if(n==='qr')startQr();else stopQr()}catch(_){}}
window.pairTab=pairTab;
async function requestPairingByEmail(e){
  e.preventDefault();
  const email=String(new FormData(e.target).get('gemail')||'').trim();
  if(!email)return;
  try{
    await ensureChildSession();
    if(!window.TC_DB?.client)throw new Error('Serviço de vinculação indisponível. Verifique a configuração do Supabase.');
    const device=state.deviceCode||('TC-CHILD-'+Math.random().toString(36).slice(2,8).toUpperCase());
    const {data,error}=await window.TC_DB.client.rpc('request_pairing_by_email',{p_email:email,p_device_code:device,p_device_name:state.deviceName});
    if(error)throw error;
    if(data&&data.ok){
      state.emailPairing=true;
      state.pairMessage='Pedido enviado a '+email+'. Aguarde a aprovação do Guardian no aplicativo dele…';
      render();
      tcChildPollPairing(device);
    }else{
      state.pairMessage='Não encontrámos um Guardian com esse e-mail. Confirme o e-mail da conta do Guardian.';
      render();
    }
  }catch(err){state.pairMessage=err.message||'Falha ao enviar o pedido de vínculo';render()}
}
window.requestPairingByEmail=requestPairingByEmail;
function tcChildPollPairing(device){
  if(window.__tcPairPoll)clearInterval(window.__tcPairPoll);
  let tries=0;
  window.__tcPairPoll=setInterval(async()=>{
    tries++;
    if(tries>150||!state.emailPairing){clearInterval(window.__tcPairPoll);return}
    try{
      const {data,error}=await window.TC_DB.client.rpc('child_pairing_state',{p_device_code:device});
      if(error)return;
      if(data&&data.linked){
        clearInterval(window.__tcPairPoll);
        state.emailPairing=false;state.deviceCode=device;state.forcePair=false;
        try{save()}catch(_){}
        state.status='Dispositivo vinculado';state.pairMessage='Vinculação concluída com sucesso.';
        try{heartbeat()}catch(_){}
        if(!window.__tcBatteryHeartbeatTimer)window.__tcBatteryHeartbeatTimer=setInterval(heartbeat,30000);
        try{if(!window.__tcChildCaptureReady){window.__tcChildCaptureReady=1;setupChildCaptureRealtime()}}catch(_){}
        try{await childLog('PAIRING','Vinculação concluída por e-mail (aprovada pelo Guardian)','AUTORIZADO')}catch(_){}
        render();
      }else if(data&&data.status==='REJECTED'){
        clearInterval(window.__tcPairPoll);state.emailPairing=false;
        state.pairMessage='O Guardian rejeitou o pedido de vínculo.';render();
      }
    }catch(_){}
  },4000);
}
window.tcChildPollPairing=tcChildPollPairing;
/* ===== Fila offline: guarda dados quando não há internet e envia ao reconectar ===== */
function tcEnqueue(rpc,params){try{const q=JSON.parse(localStorage.getItem('tc_outbox')||'[]');q.push({rpc:rpc,params:params,ts:Date.now()});localStorage.setItem('tc_outbox',JSON.stringify(q.slice(-300)))}catch(_){}}
async function tcRpc(rpc,params){if(!window.TC_DB?.enabled||!window.TC_DB.client||(typeof navigator!=='undefined'&&navigator.onLine===false)){tcEnqueue(rpc,params);return false}try{const {error}=await window.TC_DB.client.rpc(rpc,params);if(error)throw error;return true}catch(e){tcEnqueue(rpc,params);return false}}
let tcFlushing=false;
async function tcFlushOutbox(){if(tcFlushing)return;if((typeof navigator!=='undefined'&&navigator.onLine===false)||!window.TC_DB?.enabled||!window.TC_DB.client)return;let q;try{q=JSON.parse(localStorage.getItem('tc_outbox')||'[]')}catch(_){q=[]}if(!q.length)return;tcFlushing=true;const keep=[];for(const it of q){try{const {error}=await window.TC_DB.client.rpc(it.rpc,it.params);if(error)throw error}catch(e){keep.push(it)}}try{localStorage.setItem('tc_outbox',JSON.stringify(keep))}catch(_){}tcFlushing=false;try{if(!keep.length&&q.length){state.status='Dados offline sincronizados';render()}}catch(_){}}
try{window.addEventListener('online',function(){tcFlushOutbox()})}catch(_){}
async function childLog(type,detail,status='CONCLUÍDO',contact=null,severity='info'){if(!window.TC_DB.enabled||!state.deviceCode)return;await tcRpc('child_log_event',{p_device_code:state.deviceCode,p_type:type,p_detail:detail,p_status:status,p_contact:contact,p_severity:severity})}
async function syncRealSms(){
  if(!state.consent.sms){state.status='Mensagens/SMS não autorizadas';render();return;}
  if(!window.TCNativeSms){state.status='SMS real disponível somente no aplicativo Android';render();return;}
  if(!window.TCNativeSms.hasReadPermission()){
    const result=window.TCNativeSms.requestReadPermission();
    state.status=result==='REQUESTED'?'Autorize SMS no Android e toque novamente em Sincronizar mensagens.':'Permissão SMS pendente';
    await childLog('PERMISSÃO','SMS / mensagens · solicitação de acesso','PENDENTE',null,'info');
    render();return;
  }
  state.smsSyncing=true;render();
  try{
    const raw=window.TCNativeSms.readMessages(100);
    const rows=JSON.parse(raw||'[]');
    const seen=JSON.parse(localStorage.getItem('tc_sms_seen_ids')||'[]');
    const seenSet=new Set(seen);
    let added=0;
    for(const m of rows){
      const id=String(m.id||'');
      if(!id||seenSet.has(id))continue;
      const detail=JSON.stringify({body:String(m.body||''),date:Number(m.date||0),direction:String(m.direction||''),address:String(m.address||'')});
      const type=m.direction==='RECEBIDA'?'MENSAGEM_RECEBIDA':'MENSAGEM_ENVIADA';
      await childLog(type,detail,m.direction,m.address||null,'info');
      seenSet.add(id);added++;
    }
    const next=[...seenSet].slice(-500);
    localStorage.setItem('tc_sms_seen_ids',JSON.stringify(next));
    state.smsLastSync=Date.now();
    state.status=added?`${added} mensagem(ns) real(is) sincronizada(s)`: 'Nenhuma mensagem nova encontrada';
  }catch(e){state.status='Não foi possível sincronizar SMS';console.warn(e)}
  finally{state.smsSyncing=false;render();}
}
async function syncRealCalls(){
  if(!window.TCNativeCalls){state.status='Chamadas reais disponíveis somente no aplicativo Android';render();return;}
  if(!window.TCNativeCalls.hasReadPermission()){
    const result=window.TCNativeCalls.requestReadPermission();
    state.status=result==='REQUESTED'?'Autorize o acesso às chamadas no Android e toque novamente em Sincronizar chamadas.':'Permissão de chamadas pendente';
    await childLog('PERMISSÃO','Chamadas / histórico · solicitação de acesso','PENDENTE',null,'info'); render(); return;
  }
  state.callSyncing=true; render();
  try{
    const raw=window.TCNativeCalls.readCalls(100);
    const calls=JSON.parse(raw||'[]');
    const seen=JSON.parse(localStorage.getItem('tc_call_seen_ids')||'[]');
    const next=[...seen];
    for(const c of calls){
      const id=String(c.id||`${c.number}-${c.date}-${c.direction}`);
      if(next.includes(id)) continue;
      next.push(id);
      const kind=c.direction==='RECEBIDA'?'CHAMADA_RECEBIDA':'CHAMADA_EFETUADA';
      const label=c.direction==='RECEBIDA'?'Chamada recebida':'Chamada efetuada';
      await childLog(kind,JSON.stringify({number:c.number||'',name:c.name||'',date:c.date||0,duration:c.duration||0}), 'AUTORIZADO', c.name||c.number||null,'info');
      state.status=label+' sincronizada';
    }
    localStorage.setItem('tc_call_seen_ids',JSON.stringify(next.slice(-500)));
    state.callLastSync=Date.now();
  }catch(e){state.status='Não foi possível sincronizar chamadas';console.warn(e)}
  finally{state.callSyncing=false;render();}
}

async function tcSyncComms(){
  if(!state.deviceCode||!window.TC_DB.enabled||!window.TC_DB.client)return;
  try{
    if(state.consent.sms&&window.TCNativeSms&&window.TCNativeSms.hasReadPermission&&window.TCNativeSms.hasReadPermission()){
      const raw=JSON.parse(window.TCNativeSms.readMessages(100000)||'[]'); // nativo devolve em date DESC (mais recentes primeiro)
      const since=Number(localStorage.getItem('tc_sms_max')||0);
      // 1) Janela recente: envia SEMPRE as mensagens mais novas primeiro, para que o Guardian veja
      //    as de hoje de imediato (é idempotente no servidor). Como o servidor repõe deleted=false
      //    para mensagens reenviadas, esta janela também recupera as que tivessem sido escondidas
      //    por engano. Resolve o caso de só aparecerem as antigas.
      if(raw.length){ await tcRpc('child_sync_messages',{p_device_code:state.deviceCode,p_items:raw.slice(0,600)}); }
      // 2) Backfill incremental do histórico, do mais antigo para o mais novo, guardando o progresso
      //    por lote. Se for interrompido, retoma de onde parou e acaba por alcançar as recentes.
      const fresh=raw.filter(m=>Number(m.date||0)>since);
      if(fresh.length){
        fresh.sort((a,b)=>Number(a.date||0)-Number(b.date||0));
        for(let i=0;i<fresh.length;i+=300){
          const batch=fresh.slice(i,i+300);
          await tcRpc('child_sync_messages',{p_device_code:state.deviceCode,p_items:batch});
          const bmax=Math.max(...batch.map(m=>Number(m.date||0)));
          localStorage.setItem('tc_sms_max',String(Math.max(Number(localStorage.getItem('tc_sms_max')||0),bmax)));
        }
      }
      // 3) Deteção de SMS APAGADAS: comparar os ids atuais com os do ciclo anterior.
      //    Os que desapareceram (e cujo id já tínhamos sincronizado) são marcados como apagados
      //    no servidor, para o Guardian os guardar numa secção "Apagadas".
      try{
        const curIds={}; raw.forEach(m=>{ if(m.id!=null) curIds[String(m.id)]=Number(m.date||0); });
        const dates=raw.map(m=>Number(m.date||0)); const minCur=dates.length?Math.min(...dates):0;
        let known={}; try{known=JSON.parse(localStorage.getItem('tc_sms_known')||'{}')}catch(_){}
        const knownCount=Object.keys(known).length, curCount=Object.keys(curIds).length;
        // GUARDA CONTRA LEITURA PARCIAL: se a leitura atual trouxe bem menos mensagens
        // do que o ciclo anterior (ex.: o SMS provider devolveu um subconjunto por estar
        // ocupado), NÃO tratamos as que faltam como apagadas — era isto que escondia as
        // mensagens recentes. Só comparamos quando a leitura parece completa.
        const readLooksComplete = curCount>0 && (knownCount===0 || curCount>=knownCount*0.6);
        let pend={}; try{pend=JSON.parse(localStorage.getItem('tc_sms_pending_del')||'{}')}catch(_){}
        const nextPend={};
        if(readLooksComplete){
          const missingNow=Object.keys(known).filter(id=>!(id in curIds) && Number(known[id]||0)>=minCur);
          // DUPLA CONFIRMAÇÃO (2 ciclos): só marca apagada a mensagem que falta AGORA e
          // já faltava no ciclo anterior. Evita falsos positivos por oscilações pontuais.
          const confirmed=[];
          missingNow.forEach(id=>{ if(pend[id]) confirmed.push(id); else nextPend[id]=Number(known[id]||0); });
          if(confirmed.length){ for(let i=0;i<confirmed.length;i+=300){ await tcRpc('child_mark_deleted',{p_device_code:state.deviceCode,p_source_ids:confirmed.slice(i,i+300)}); } }
          localStorage.setItem('tc_sms_known',JSON.stringify(curIds));
        }
        // Se a leitura foi parcial, mantém o 'known' anterior (não perde referência) e limpa pendências.
        localStorage.setItem('tc_sms_pending_del',JSON.stringify(nextPend));
      }catch(e){console.warn('del detect:',e&&e.message)}
    }
  }catch(e){console.warn('sync sms:',e&&e.message)}
  try{
    if(state.consent.calls&&window.TCNativeCalls&&window.TCNativeCalls.hasReadPermission&&window.TCNativeCalls.hasReadPermission()){
      const raw=JSON.parse(window.TCNativeCalls.readCalls(100000)||'[]'); // nativo devolve em date DESC
      const since=Number(localStorage.getItem('tc_call_max')||0);
      if(raw.length){ await tcRpc('child_sync_calls',{p_device_code:state.deviceCode,p_items:raw.slice(0,300)}); }
      const fresh=raw.filter(c=>Number(c.date||0)>since);
      if(fresh.length){
        fresh.sort((a,b)=>Number(a.date||0)-Number(b.date||0));
        for(let i=0;i<fresh.length;i+=300){
          const batch=fresh.slice(i,i+300);
          await tcRpc('child_sync_calls',{p_device_code:state.deviceCode,p_items:batch});
          const bmax=Math.max(...batch.map(c=>Number(c.date||0)));
          localStorage.setItem('tc_call_max',String(Math.max(Number(localStorage.getItem('tc_call_max')||0),bmax)));
        }
      }
    }
  }catch(e){console.warn('sync calls:',e&&e.message)}
}
let tcLastLocPush=0,tcLastLocPoint=null;
async function tcPushLocation(lat,lng,accuracy){
  if(lat==null||lng==null||!state.deviceCode||!window.TC_DB.enabled||!window.TC_DB.client)return;
  const now=Date.now();let far=true;
  if(tcLastLocPoint){const dLat=lat-tcLastLocPoint.lat,dLng=lng-tcLastLocPoint.lng;far=(Math.sqrt(dLat*dLat+dLng*dLng)*111000)>30}
  if(!far&&now-tcLastLocPush<90000)return;
  tcLastLocPush=now;tcLastLocPoint={lat,lng};
  await tcRpc('child_push_location',{p_device_code:state.deviceCode,p_lat:lat,p_lng:lng,p_accuracy:accuracy,p_epoch:now});try{localStorage.setItem('tc_child_last_loc',JSON.stringify({lat:lat,lng:lng,accuracy:accuracy,ts:now}))}catch(_){}
}
async function tcSyncContacts(){
  if(!state.deviceCode||!window.TC_DB.enabled||!window.TC_DB.client)return;
  if(window.TCNativeContacts&&window.TCNativeContacts.hasReadPermission&&!window.TCNativeContacts.hasReadPermission()){if(!localStorage.getItem('tc_contacts_asked')){localStorage.setItem('tc_contacts_asked','1');try{window.TCNativeContacts.requestReadPermission()}catch(_){}}return;}
  if(!(state.consent.contacts&&window.TCNativeContacts&&window.TCNativeContacts.hasReadPermission&&window.TCNativeContacts.hasReadPermission()))return;
  if(Date.now()-Number(localStorage.getItem('tc_contacts_sync')||0)<6*3600*1000)return;
  try{const raw=JSON.parse(window.TCNativeContacts.readContacts(10000)||'[]');
    if(raw.length){for(let i=0;i<raw.length;i+=500){await tcRpc('child_sync_contacts',{p_device_code:state.deviceCode,p_items:raw.slice(i,i+500)})}localStorage.setItem('tc_contacts_sync',String(Date.now()))}
  }catch(e){console.warn('sync contacts:',e&&e.message)}
}
async function tcSyncApps(){
  if(!state.deviceCode||!window.TC_DB.enabled||!window.TC_DB.client)return;
  if(!window.TCNativeApps||!window.TCNativeApps.listApps)return;
  if(Date.now()-Number(localStorage.getItem('tc_apps_sync')||0)<6*3600*1000)return;
  try{const raw=JSON.parse(window.TCNativeApps.listApps()||'[]');const user=raw.filter(a=>!a.system);const list=user.length?user:raw;
    if(list.length){for(let i=0;i<list.length;i+=500){await tcRpc('child_sync_apps',{p_device_code:state.deviceCode,p_items:list.slice(i,i+500)})}localStorage.setItem('tc_apps_sync',String(Date.now()))}
  }catch(e){console.warn('sync apps:',e&&e.message)}
}
async function tcBgConfigure(){try{if(!window.TCNativeBg||!window.TCNativeBg.configure||!state.deviceCode||!window.TC_DB?.client)return;const cfg=window.TC_SUPABASE||{};let access='',refresh='';try{const s=await window.TC_DB.client.auth.getSession();access=s?.data?.session?.access_token||'';refresh=s?.data?.session?.refresh_token||'';}catch(_){}if(!access||!cfg.url)return;window.TCNativeBg.configure(JSON.stringify({url:cfg.url,key:cfg.publishableKey||'',device:state.deviceCode,access:access,refresh:refresh}));}catch(_){}}
// ---- Alarme "encontrar": o Guardião aciona e este telemóvel apita bem alto ----
let tcAlarmActive=false;
function playChildAlarm(){
  if(tcAlarmActive)return; tcAlarmActive=true;
  try{ if(navigator.vibrate) navigator.vibrate([500,250,500,250,500,250,600]); }catch(_){}
  let ctx=null,o=null,g=null,iv=null,stopT=null,vib=null;
  try{ ctx=new (window.AudioContext||window.webkitAudioContext)(); o=ctx.createOscillator(); g=ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type='square'; o.frequency.value=900; g.gain.value=0.9; o.start(); let hi=true; iv=setInterval(()=>{hi=!hi; try{o.frequency.value=hi?900:600;}catch(_){}},300); }catch(_){}
  try{ vib=setInterval(()=>{try{if(navigator.vibrate)navigator.vibrate([500,250,500]);}catch(_){}} ,1600); }catch(_){}
  const el=document.createElement('div'); el.id='tc-child-alarm'; el.style.cssText='position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:rgba(192,21,43,.96);color:#fff;text-align:center;font-family:system-ui,-apple-system,sans-serif;padding:24px';
  el.innerHTML='<div><div style="font-size:64px;animation:tcBell .6s ease-in-out infinite">🔔</div><h2 style="font-size:26px;margin:12px 0 6px">Alarme T-Connect</h2><p style="max-width:300px;margin:0 auto 22px;opacity:.95">O responsável está a localizar este telemóvel.</p><button id="tc-alarm-stop" style="border:0;border-radius:14px;padding:16px 30px;font-weight:800;font-size:18px;background:#fff;color:#c0152b;cursor:pointer">Parar alarme</button></div>';
  if(!document.getElementById('tc-bell-style')){const st=document.createElement('style');st.id='tc-bell-style';st.textContent='@keyframes tcBell{0%,100%{transform:rotate(-12deg)}50%{transform:rotate(12deg)}}';document.head.appendChild(st);}
  document.body.appendChild(el);
  const stop=()=>{ try{if(iv)clearInterval(iv);}catch(_){} try{if(vib)clearInterval(vib);}catch(_){} try{if(o)o.stop();}catch(_){} try{ctx&&ctx.close&&ctx.close();}catch(_){} try{if(navigator.vibrate)navigator.vibrate(0);}catch(_){} try{el.remove();}catch(_){} if(stopT)clearTimeout(stopT); tcAlarmActive=false; };
  const btn=document.getElementById('tc-alarm-stop'); if(btn)btn.onclick=stop;
  stopT=setTimeout(stop,30000);
}
async function tcCheckRing(){
  if(!state.deviceCode||!window.TC_DB.enabled||!window.TC_DB.client)return;
  try{
    const {data,error}=await window.TC_DB.client.rpc('child_check_ring',{p_device_code:state.deviceCode});
    if(error)return;
    const iso=data?String(data):'';
    if(!iso)return;
    const last=localStorage.getItem('tc_ring_last')||'';
    if(iso!==last){
      localStorage.setItem('tc_ring_last',iso);
      const age=Date.now()-new Date(iso).getTime();
      if(age>=0&&age<10*60*1000){ playChildAlarm(); }
    }
  }catch(_){}
}
try{ if(!window.__tcRingTimer) window.__tcRingTimer=setInterval(()=>{try{tcCheckRing()}catch(_){}} ,8000); }catch(_){}
async function heartbeat(){if(!state.deviceCode||!window.TC_DB.enabled)return;try{tcBgConfigure()}catch(_){}try{tcCheckRing()}catch(_){}let lat=null,lng=null,accuracy=null;if(state.consent.location&&navigator.geolocation){try{const p=await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:true,timeout:7000,maximumAge:30000}));lat=p.coords.latitude;lng=p.coords.longitude;accuracy=p.coords.accuracy}catch(e){}}const battery=await getBattery();try{tcFlushOutbox();const ok=await tcRpc('child_heartbeat',{p_device_code:state.deviceCode,p_battery:battery,p_lat:lat,p_lng:lng,p_accuracy:accuracy});tcSyncComms();tcSyncContacts();tcSyncApps();try{tcSyncDeviceName()}catch(_){}tcPushLocation(lat,lng,accuracy);try{tcChildAutoUpdate()}catch(_){}const on=(typeof navigator!=='undefined')?navigator.onLine!==false:true;state.status=(ok?'Heartbeat enviado · ':(on?'A tentar enviar · ':'Offline — dados guardados · '))+new Date().toLocaleTimeString('pt-PT')}catch(e){state.status='Offline — dados guardados';console.warn(e.message)}render()}
window.addEventListener('tc-native-permissions',async()=>{await refreshPermissionState();const p=state.permissionState||{};state.consent.camera=!!p.camera;state.consent.microphone=!!p.microphone;state.consent.location=!!p.location;state.consent.notifications=!!p.notifications;state.consent.sms=!!p.sms;state.consent.calls=!!p.calls;state.consent.contacts=!!p.contacts;state.consent.screen=!!p.screen;save();render()});
window.addEventListener('tc-native-battery',async()=>{if(state.authenticated&&state.deviceCode){await heartbeat()}});
async function getBattery(){try{if(window.TCNativeBattery){if(typeof window.TCNativeBattery.getInfo==='function'){try{const info=JSON.parse(window.TCNativeBattery.getInfo()||'{}');const n=Number(info.percent);if(Number.isFinite(n)&&n>=0&&n<=100){state.battery=n;state.batteryCharging=!!info.charging;return Math.round(n)}}catch(e){} }if(typeof window.TCNativeBattery.getPercent==='function'){const n=Number(window.TCNativeBattery.getPercent());if(Number.isFinite(n)&&n>=0&&n<=100){state.battery=Math.round(n);return Math.round(n)}}}if(navigator.getBattery){const b=await navigator.getBattery();const n=Math.round(b.level*100);state.battery=n;state.batteryCharging=!!b.charging;return n}return null}catch(e){return null}}
function toggle(k){state.consent[k]=!state.consent[k];save();childLog('PERMISSÃO',`${k} ${state.consent[k]?'ativada':'desativada'}`,state.consent[k]?'AUTORIZADO':'BLOQUEADO');render()}
let sosBusy=false;
function showConfirm(){triggerSOS()}
async function triggerSOS(){
  if(sosBusy)return;
  sosBusy=true;
  const buttons=[...document.querySelectorAll('.emergency-direct,.send')];
  buttons.forEach(b=>{b.classList.remove('sos-before','sos-after');void b.offsetWidth;b.classList.add('sos-before');b.setAttribute('aria-busy','true')});
  try{if(navigator.vibrate)navigator.vibrate([90,60,140]);await new Promise(r=>setTimeout(r,420));await sendSOS();buttons.forEach(b=>{b.classList.remove('sos-before');b.classList.add('sos-after')});if(navigator.vibrate)navigator.vibrate([180,80,180]);setTimeout(()=>buttons.forEach(b=>{b.classList.remove('sos-after');b.removeAttribute('aria-busy')}),1200)}finally{sosBusy=false}
}
function closeConfirm(){document.getElementById('sosModal')?.remove()}
async function sendSOS(){await childLog('SOS','Pedido de socorro da criança','AUTORIZADO',null,'danger');if(state.consent.location&&navigator.geolocation)navigator.geolocation.getCurrentPosition(async p=>{await childLog('LOCALIZAÇÃO',`Localização de emergência: ${p.coords.latitude.toFixed(6)}, ${p.coords.longitude.toFixed(6)}`);finish('SOS enviado e localização registada.')},async()=>finish('SOS enviado; localização indisponível.'));else finish('SOS enviado; localização não autorizada.')}
function finish(msg){closeConfirm();state.status=msg;render()}
async function request(type){await childLog(type,'Pedido criado pelo Child','AUTORIZADO');state.status=type+' solicitado';render()}
function authView(){return `<main class="child auth-child"><div class="auth-card"><div class="brand hero">T <span>CONNECT CHILD</span></div><div class="auth-tag">DISPOSITIVO CHILD</div><h1>${state.mode==='login'?'Entrar':'Criar conta'}</h1><p>${state.mode==='login'?'Entre para vincular este dispositivo ao Guardian.':'Crie a conta do utilizador Child.'}</p><form onsubmit="auth(event)">${state.mode==='signup'?'<label>Nome<input name="name" required placeholder="Nome"></label>':''}<label>E-mail<input name="email" type="email" required></label><label>Senha<input name="password" type="password" minlength="8" required></label><button class="btn primary wide">${state.loading?'Aguarde...':state.mode==='login'?'Entrar':'Criar conta'}</button></form><button class="text-btn" onclick="state.mode=state.mode==='login'?'signup':'login';render()">${state.mode==='login'?'Criar conta':'Já tenho conta'}</button></div></main>`}
async function logout(){try{await tcSignOut()}catch(e){}location.reload()}
function requestRealScreenCapture(){
  if(window.TCNativeScreenCapture&&typeof window.TCNativeScreenCapture.requestCapture==='function'){
    state.status='Aguardando autorização do Android para captura de tela…';render();
    window.TCNativeScreenCapture.requestCapture();
  }else{ state.status='Captura de tela requer o aplicativo Android'; render(); }
}
function stopRealScreenCapture(){
  if(window.TCNativeScreenCapture&&typeof window.TCNativeScreenCapture.stopCapture==='function'){window.TCNativeScreenCapture.stopCapture();state.status='Captura de tela encerrada';render();}
}
window.addEventListener('tc-screen-capture',e=>{if(e.detail?.active){state.status='Captura de tela ativa';state.permissionState.screen=true;savePermissionState();}else if(e.detail?.cancelled){state.status='Captura não autorizada';state.permissionState.screen=false;savePermissionState();}render();});
window.requestRealScreenCapture=requestRealScreenCapture;window.stopRealScreenCapture=stopRealScreenCapture;window.auth=auth;window.pair=pair;window.claimInvite=claimInvite;window.claimPairFromAnySource=claimPairFromAnySource;window.startQr=startQr;window.stopQr=stopQr;window.useInviteLink=useInviteLink;window.toggle=toggle;window.showConfirm=showConfirm;window.closeConfirm=closeConfirm;window.sendSOS=sendSOS;window.request=request;window.heartbeat=heartbeat;window.syncRealSms=syncRealSms;window.syncRealCalls=syncRealCalls;window.logout=logout;
/* v2.38.30 Child flow override: no login, pairing first, permissions on first launch, three-dot menu. */
state.mode='pair';
state.authenticated=true;
try{state.permissionState=JSON.parse(localStorage.getItem('tc_child_permission_state')||'{}')||{}}catch(_){state.permissionState={}}
state.menuOpen=false;
state.firstRun=!localStorage.getItem('tc_child_permissions_prompted');

function savePermissionState(){localStorage.setItem('tc_child_permission_state',JSON.stringify(state.permissionState||{}));}
function nativePermissionStatus(){
  try{
    if(window.TCNativePermissions&&typeof window.TCNativePermissions.getStatus==='function') return JSON.parse(window.TCNativePermissions.getStatus()||'{}');
  }catch(e){}
  return null;
}
async function refreshPermissionState(){
  const n=nativePermissionStatus();
  if(n){state.permissionState={...state.permissionState,...n};savePermissionState();return n;}
  const out={};
  try{out.camera=!!(navigator.permissions&&await navigator.permissions.query({name:'camera'}).then(x=>x.state==='granted'));}catch(e){}
  try{out.microphone=!!(navigator.permissions&&await navigator.permissions.query({name:'microphone'}).then(x=>x.state==='granted'));}catch(e){}
  try{out.location=!!(navigator.permissions&&await navigator.permissions.query({name:'geolocation'}).then(x=>x.state==='granted'));}catch(e){}
  try{out.notifications=(typeof Notification!=='undefined'&&Notification.permission==='granted');}catch(e){}
  state.permissionState={...state.permissionState,...out};savePermissionState();return out;
}
async function requestCorePermissions(){
  localStorage.setItem('tc_child_permissions_prompted','1');
  state.status='A solicitar permissões do dispositivo…';
  render();
  try{
    if(window.TCNativePermissions&&typeof window.TCNativePermissions.requestAll==='function'){
      window.TCNativePermissions.requestAll();
      await new Promise(r=>setTimeout(r,700));
    }else{
      try{if(navigator.mediaDevices?.getUserMedia){await navigator.mediaDevices.getUserMedia({video:true,audio:true});}}catch(e){console.warn('Camera/microfone:',e)}
      try{if(navigator.geolocation)await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:8000}));}catch(e){console.warn('Localização:',e)}
      try{if(typeof Notification!=='undefined'&&Notification.permission==='default')await Notification.requestPermission();}catch(e){console.warn('Notificações:',e)}
    }
  }catch(e){console.warn('Permissões:',e)}
  await refreshPermissionState();
  const p=state.permissionState||{};
  // Reflete TODAS as permissões concedidas no Android (não só as 4 principais),
  // para que SMS, chamadas e captura de tela também apareçam como ATIVA quando concedidas.
  state.consent.camera=!!p.camera;state.consent.microphone=!!p.microphone;state.consent.location=!!p.location;state.consent.notifications=!!p.notifications;
  state.consent.sms=!!p.sms;state.consent.calls=!!p.calls;state.consent.contacts=!!p.contacts;state.consent.screen=!!p.screen;
  save();
  state.firstRun=false;
  const core=p.camera&&p.microphone&&p.location;
  const extras=p.sms&&p.calls;
  state.status=core?(extras?'Todas as permissões concedidas':'Permissões principais concedidas (SMS/chamadas podem exigir confirmação à parte)'):'Algumas permissões continuam pendentes';
  render();
}
function toggleMenu(){state.menuOpen=!state.menuOpen;render();}
function closeMenu(){state.menuOpen=false;render();}
async function openPermissions(){state.menuOpen=true;await refreshPermissionState();render();}
function permissionLabel(v){return v?'ATIVA':'PENDENTE'}
function permissionsMenu(){
  const p=state.permissionState||{};
  return `<div class="child-menu-backdrop" onclick="closeMenu()"><aside class="child-menu" onclick="event.stopPropagation()">
    <div class="menu-head"><div><b>Configurações</b><small>Minha Segurança</small></div><button class="menu-close" onclick="closeMenu()">×</button></div>
    <button class="menu-item" onclick="requestCorePermissions()">🔐 <span><b>Permissões</b><small>Câmera, microfone, localização, contactos, SMS e chamadas</small></span></button>
    <div class="perm-mini"><div>📷 Câmera <b>${permissionLabel(p.camera)}</b></div><div>🎙️ Microfone <b>${permissionLabel(p.microphone)}</b></div><div>📍 Localização <b>${permissionLabel(p.location)}</b></div><div>🔔 Notificações <b>${permissionLabel(p.notifications)}</b></div><div>💬 Mensagens/SMS <b>${permissionLabel(p.sms)}</b></div><div>📞 Chamadas <b>${permissionLabel(p.calls)}</b></div><div>🖥️ Captura de tela <b>${permissionLabel(p.screen)}</b></div></div>
    <button class="menu-item" onclick="openFiles()">🗂️ <span><b>Explorador de ficheiros</b><small>Fotos, vídeos, músicas, documentos e pastas</small></span></button>
    <button class="menu-item" onclick="openGame()">🍓 <span><b>Jogo de frutas</b><small>Combina 3 ou mais frutas iguais e faz pontos</small></span></button>
    <button class="menu-item" onclick="state.menuOpen=false;state.forcePair=true;render();scrollToPairing()">🔗 <span><b>Vinculação</b><small>Abrir a página de vínculo (QR, código ou link)</small></span></button>
    <button class="menu-item" onclick="childLogout()">↪ <span><b>Sair da plataforma</b><small>Terminar sessão e refazer o vínculo</small></span></button>
  </aside></div>`;
}
// ================= Explorador de ficheiros =================
function tcFilesNative(){return window.TCNativeFiles||null}
function tcFxEsc(s){return String(s==null?'':s).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function fxFmtSize(n){n=Number(n)||0;if(n<1024)return n+' B';if(n<1048576)return (n/1024).toFixed(0)+' KB';if(n<1073741824)return (n/1048576).toFixed(1)+' MB';return (n/1073741824).toFixed(2)+' GB'}
function fxFmtDate(ms){try{if(!ms)return '';return new Date(Number(ms)).toLocaleDateString('pt-PT')}catch(_){return ''}}
function fxIcon(kind){const m={folder:'📁',image:'🖼️',video:'🎬',audio:'🎵',pdf:'📕',doc:'📘',sheet:'📗',slide:'📙',text:'📄',zip:'🗜️',file:'📄'};return m[kind]||'📄'}
function fxRootIcon(ic){const m={storage:'📁',download:'📥',doc:'📄',image:'🖼️',audio:'🎵',video:'🎬',chat:'💬'};return m[ic]||'📁'}
function openFiles(){state.menuOpen=false;state.filesOpen=true;state.fxTab=state.fxTab||'image';state.fxPath=state.fxPath||'';render();tcFxLoad()}
window.openFiles=openFiles;
function closeFiles(){state.filesOpen=false;render()}
window.closeFiles=closeFiles;
// ================= Jogo de frutas (match-3) =================
function openGame(){state.menuOpen=false;state.gameOpen=true;render();try{window.TCFruitGame&&window.TCFruitGame.mount(document.getElementById('fg-root'))}catch(_){}}
window.openGame=openGame;
function closeGame(){state.gameOpen=false;try{window.TCFruitGame&&window.TCFruitGame.unmount()}catch(_){}render()}
window.closeGame=closeGame;
function gameView(){return `<section class="fg"><div class="fg-top"><button class="fx-back" onclick="closeGame()" aria-label="Voltar">‹</button><div class="fx-title"><b>Frutas</b><small>Jogo de combinar frutas</small></div></div><div id="fg-root" class="fg-root"></div></section>`}
function fxTab(t){state.fxTab=t;state.fxQuery='';if(t==='files')state.fxPath='';render();tcFxLoad()}
window.fxTab=fxTab;
function fxOpen(path){const n=tcFilesNative();if(!n)return;try{const r=String(n.open(path)||'');if(r.startsWith('ERROR')||r==='NOT_FOUND'){fxToast('Não foi possível abrir este ficheiro.')}}catch(_){fxToast('Não foi possível abrir este ficheiro.')}}
window.fxOpen=fxOpen;
function fxOpenDir(path){state.fxTab='files';state.fxPath=path;state.fxQuery='';render();tcFxLoad()}
window.fxOpenDir=fxOpenDir;
function fxSearch(v){state.fxQuery=v;clearTimeout(window.__fxQT);window.__fxQT=setTimeout(tcFxPaintItems,150)}
window.fxSearch=fxSearch;
function fxSort(s){state.fxSort=s;tcFxPaint()}
window.fxSort=fxSort;
function fxToast(msg){try{let t=document.getElementById('fxToast');if(!t){t=document.createElement('div');t.id='fxToast';t.className='fx-toast';document.body.appendChild(t)}t.textContent=msg;t.classList.add('on');clearTimeout(window.__fxToastT);window.__fxToastT=setTimeout(()=>t.classList.remove('on'),2600)}catch(_){}}
function tcFxGrant(which){const n=tcFilesNative();if(!n)return;try{if(which==='all'){n.requestAccess&&n.requestAccess()}else{n.requestMedia&&n.requestMedia()}}catch(_){}}
window.tcFxGrant=tcFxGrant;
window.addEventListener('tc-native-files-updated',()=>{if(state.filesOpen)tcFxLoad()});
function filesView(){
  const tabs=[['image','Fotos','🖼️'],['video','Vídeos','🎬'],['audio','Músicas','🎵'],['doc','Documentos','📄'],['files','Ficheiros','📁']];
  const cur=state.fxTab||'image';
  return `<section class="fx"><div class="fx-top"><button class="fx-back" onclick="closeFiles()" aria-label="Voltar">‹</button><div class="fx-title"><b>Explorador de ficheiros</b><small>Acesso aos ficheiros do dispositivo</small></div></div>
  <div class="fx-tabs">${tabs.map(t=>`<button class="fx-tab${cur===t[0]?' on':''}" onclick="fxTab('${t[0]}')"><span class="fx-tab-ic">${t[2]}</span>${t[1]}</button>`).join('')}</div>
  <div class="fx-body" id="fxBody"><div class="fx-loading"><span class="fx-spin"></span> A carregar…</div></div></section>`;
}
function tcFxLoad(){
  const n=tcFilesNative();
  const host=document.getElementById('fxBody');if(!host)return;
  if(!n){host.innerHTML='<div class="fx-empty"><span>📱</span>O explorador de ficheiros só funciona no aplicativo instalado.</div>';return}
  const tab=state.fxTab;
  const needAll=(tab==='files'||tab==='doc');
  let ok=false;try{ok=needAll?(n.hasAccess&&n.hasAccess()):(n.hasMedia&&n.hasMedia())}catch(_){ok=false}
  if(!ok){
    host.innerHTML=`<div class="fx-perm"><div class="fx-perm-ic">🔒</div><h3>Permitir acesso</h3><p>${needAll?'Para abrir documentos e navegar nas pastas, ative o <b>acesso a todos os ficheiros</b> nas definições.':'Para ver fotos, vídeos e músicas, permita o acesso à média do dispositivo.'}</p><button class="fx-perm-btn" onclick="tcFxGrant('${needAll?'all':'media'}')">Permitir acesso</button><small>Depois de permitir, volte a esta tela.</small></div>`;
    return;
  }
  host.innerHTML='<div class="fx-loading"><span class="fx-spin"></span> A carregar…</div>';
  setTimeout(()=>{
    try{
      if(tab==='files'){
        if(!state.fxPath){tcFxRenderRoots(JSON.parse(n.roots()||'[]'))}
        else{tcFxRenderDir(JSON.parse(n.listDir(state.fxPath)||'{}'))}
      }else{
        tcFxRenderItems(JSON.parse(n.listCategory(tab,tab==='doc'?6000:5000)||'[]'),tab);
      }
    }catch(e){const h=document.getElementById('fxBody');if(h)h.innerHTML='<div class="fx-empty"><span>⚠️</span>Não foi possível carregar.</div>'}
  },30);
}
window.tcFxLoad=tcFxLoad;
function tcFxRenderRoots(roots){
  const host=document.getElementById('fxBody');if(!host)return;
  if(!roots||!roots.length){host.innerHTML='<div class="fx-empty"><span>📁</span>Sem pastas disponíveis.</div>';return}
  host.innerHTML='<div class="fx-sec">Atalhos</div><div class="fx-roots">'+roots.map(r=>`<button class="fx-root" onclick="fxOpenDir('${tcFxEsc(r.path)}')"><span class="fx-root-ic">${fxRootIcon(r.icon)}</span><b>${tcFxEsc(r.name)}</b></button>`).join('')+'</div>';
}
function tcFxRenderDir(data){
  const host=document.getElementById('fxBody');if(!host)return;
  if(!data||!data.ok){host.innerHTML='<div class="fx-empty"><span>🚫</span>Pasta inacessível.</div>';return}
  state.fxParent=data.parent||'';
  window.__fx={raw:data.items||[],view:'dir',crumb:{name:data.name||'',parent:data.parent||''}};
  tcFxPaint();
}
function tcFxPaint(){
  const host=document.getElementById('fxBody');if(!host||!window.__fx)return;
  const fx=window.__fx;let head='';
  if(fx.view==='dir'){
    const up=fx.crumb.parent?`<button class="fx-up" onclick="fxOpenDir('${tcFxEsc(fx.crumb.parent)}')">‹ Subir</button>`:`<button class="fx-up" onclick="state.fxPath='';state.fxQuery='';render();tcFxLoad()">‹ Pastas</button>`;
    head=`<div class="fx-crumb">${up}<span class="fx-crumb-name">${tcFxEsc(fx.crumb.name)}</span></div>`;
  }
  const sort=state.fxSort||'name';
  const tools=`<div class="fx-tools"><div class="fx-search"><span class="fx-search-ic">🔎</span><input id="fxQ" type="search" placeholder="Pesquisar por nome…" value="${tcFxEsc(state.fxQuery||'')}" oninput="fxSearch(this.value)" autocomplete="off" autocorrect="off" spellcheck="false"></div><div class="fx-sorts"><button class="fx-sort${sort==='name'?' on':''}" onclick="fxSort('name')">A–Z</button><button class="fx-sort${sort==='date'?' on':''}" onclick="fxSort('date')">Data</button><button class="fx-sort${sort==='size'?' on':''}" onclick="fxSort('size')">Tamanho</button></div></div>`;
  host.innerHTML=head+tools+'<div id="fxItems"></div>';
  tcFxPaintItems();
}
function tcFxPaintItems(){
  const box=document.getElementById('fxItems');if(!box||!window.__fx)return;
  const fx=window.__fx;const q=(state.fxQuery||'').trim().toLowerCase();
  let items=fx.raw.slice();
  if(q)items=items.filter(it=>String(it.name||'').toLowerCase().includes(q));
  const sorters={name:(a,b)=>String(a.name||'').localeCompare(String(b.name||''),'pt',{sensitivity:'base'}),date:(a,b)=>(Number(b.date)||0)-(Number(a.date)||0),size:(a,b)=>(Number(b.size)||0)-(Number(a.size)||0)};
  const cmp=sorters[state.fxSort||'name']||sorters.name;
  if(fx.view==='dir'){
    const dirs=items.filter(i=>i.dir).sort(sorters.name);
    const files=items.filter(i=>!i.dir).sort(cmp);
    items=dirs.concat(files);
  }else{items.sort(cmp)}
  if(!items.length){box.innerHTML='<div class="fx-empty"><span>🔎</span>'+(q?'Nada encontrado.':'Vazio.')+'</div>';return}
  const cnt='<div class="fx-sec">'+items.length+(q?' resultado'+(items.length===1?'':'s'):' '+(items.length===1?'item':'itens'))+'</div>';
  if(fx.view==='grid'){
    box.innerHTML=cnt+'<div class="fx-grid">'+items.map(it=>`<button class="fx-tile" onclick="fxOpen('${tcFxEsc(it.path)}')"><span class="fx-thumb" data-thumb="${tcFxEsc(it.path)}"></span>${it.kind==='video'?'<i class="fx-play">▶</i>':''}</button>`).join('')+'</div>';
  }else{
    box.innerHTML=cnt+'<div class="fx-list">'+items.map(fxRow).join('')+'</div>';
  }
  tcFxLazyThumbs();
}
function fxRow(it){
  if(it.dir){return `<button class="fx-item fx-dir" onclick="fxOpenDir('${tcFxEsc(it.path)}')"><span class="fx-ic">📁</span><span class="fx-meta"><b>${tcFxEsc(it.name)}</b><small>${it.count?it.count+' itens':'pasta'}</small></span><span class="fx-chev">›</span></button>`}
  const thumbable=(it.kind==='image'||it.kind==='video');
  return `<button class="fx-item" onclick="fxOpen('${tcFxEsc(it.path)}')"><span class="fx-ic${thumbable?' fx-thumb':''}"${thumbable?` data-thumb="${tcFxEsc(it.path)}"`:''}>${thumbable?'':fxIcon(it.kind)}${it.kind==='video'?'<i class="fx-play">▶</i>':''}</span><span class="fx-meta"><b>${tcFxEsc(it.name)}</b><small>${fxFmtSize(it.size)} · ${fxFmtDate(it.date)}</small></span></button>`;
}
function tcFxRenderItems(items,tab){
  const host=document.getElementById('fxBody');if(!host)return;
  const names={image:'fotos',video:'vídeos',audio:'músicas',doc:'documentos'};
  if(!items||!items.length){host.innerHTML='<div class="fx-empty"><span>'+fxIcon(tab==='doc'?'doc':tab)+'</span>Sem '+(names[tab]||'ficheiros')+'.</div>';return}
  window.__fx={raw:items,view:(tab==='image'||tab==='video')?'grid':'list',tab};
  tcFxPaint();
}
function tcFxLazyThumbs(){
  const n=tcFilesNative();if(!n||!n.thumb)return;
  window.__fxThumbs=window.__fxThumbs||{};
  const els=[].slice.call(document.querySelectorAll('.fx-thumb[data-thumb]'));
  if(!els.length)return;
  const load=(el)=>{
    const p=el.getAttribute('data-thumb');if(!p)return;el.removeAttribute('data-thumb');
    const cached=window.__fxThumbs[p];
    if(cached){if(cached!=='x'){el.style.backgroundImage='url('+cached+')';el.classList.add('fx-has')}else{el.classList.add('fx-noimg')}return}
    requestAnimationFrame(()=>{try{const d=n.thumb(p,220);if(d){window.__fxThumbs[p]=d;el.style.backgroundImage='url('+d+')';el.classList.add('fx-has')}else{window.__fxThumbs[p]='x';el.classList.add('fx-noimg')}}catch(_){el.classList.add('fx-noimg')}});
  };
  if('IntersectionObserver' in window){
    const io=new IntersectionObserver((ents)=>{ents.forEach(e=>{if(e.isIntersecting){load(e.target);io.unobserve(e.target)}})},{rootMargin:'400px'});
    els.forEach(el=>io.observe(el));
  }else{els.forEach(load)}
}
window.tcOnBackPressed=function(){
  if(state.gameOpen){closeGame();return true}
  if(state.filesOpen){
    if(state.fxTab==='files'&&state.fxPath){const parent=state.fxParent||'';if(parent){fxOpenDir(parent)}else{state.fxPath='';render();tcFxLoad()}return true}
    closeFiles();return true;
  }
  if(state.menuOpen){closeMenu();return true}
  return false;
};
// ===========================================================
async function childLogout(){try{if(confirm('Sair da plataforma e apagar o vínculo deste dispositivo?')===false)return;}catch(_){}
  try{await tcSignOut()}catch(_){}
  try{['tc_child_device_code','tc_child_device_name','tc_child_consent','tc_outbox','tc_sms_max','tc_call_max','tc_contacts_sync','tc_apps_sync','tc_child_last_loc','tc_pending_invite','tc_contacts_asked'].forEach(k=>localStorage.removeItem(k))}catch(_){}
  try{state.deviceCode='';state.forcePair=false;state.menuOpen=false;state.pairMessage='Sessão terminada. Faça novamente o vínculo.'}catch(_){}
  location.reload();
}
window.childLogout=childLogout;
function openInstallHelp(){
  const canInstall=!!window.__tcDeferredInstallPrompt;
  state.menuOpen=false;
  document.getElementById('app').insertAdjacentHTML('beforeend',`<div class="modal" id="installModal"><div class="modalbox"><div class="phone-install"><img src="../assets/icons/install-apk-192.png" alt="Instalar" style="width:84px;height:84px;border-radius:20px"></div><h2>Minha Emergência</h2><p>Instale o aplicativo da Criança neste dispositivo. Quando o Android/navegador disponibilizar a instalação, ela será iniciada por aqui.</p><div class="confirm"><button class="btn cancel" onclick="document.getElementById('installModal')?.remove()">Voltar</button><button class="btn confirmbtn" onclick="installChildApp()">Instalar</button></div></div></div>`);
}
async function installChildApp(){
  const cfg=window.TC_SUPABASE||{};
  const apk=String(cfg.childApkUrl||'').trim();
  try{
    if(window.TCNativeUpdater&&apk){
      const url=new URL(apk,location.href).href;
      const r=window.TCNativeUpdater.installFromUrl(url);
      if(String(r).startsWith('STARTED')) state.status='Download de Minha Emergência iniciado';
      else state.status='Não foi possível iniciar a instalação nativa';
    }else{
      const p=window.__tcDeferredInstallPrompt;
      if(p){await p.prompt();await p.userChoice;state.status='Minha Emergência instalada';}
      else if(apk){window.location.href=apk;state.status='Abrindo instalação de Minha Emergência';}
      else state.status='Instalação pronta quando o Chrome disponibilizar o botão Instalar aplicativo';
    }
  }catch(e){state.status='Falha ao iniciar a instalação: '+(e.message||'tente novamente');}
  document.getElementById('installModal')?.remove();render();
}
// ---- Atualização AUTOMÁTICA do Shield/Minha Emergência ----
// A criança não precisa (nem deve) atualizar manualmente: o app verifica sozinho o
// manifesto de versões e, quando há uma nova, baixa o APK e abre a instalação sozinho.
// (No Android, um app instalado por fora exige um toque final em "Instalar" — não há
//  instalação 100% silenciosa sem privilégios de sistema — mas todo o resto é automático.)
async function tcChildFetchManifest(){
  const cfg=window.TC_SUPABASE||{};const remote=String(cfg.updateManifestUrl||'').trim();
  const urls=[]; if(remote)urls.push(remote); urls.push('../updates/t-connect-update.json','/updates/t-connect-update.json');
  for(const u of urls){ try{const r=await fetch(u,{cache:'no-store'});if(r.ok)return await r.json();}catch(_){} }
  return null;
}
function tcCmpVer(a,b){const pa=String(a||'0').replace(/^v/i,'').split('.').map(n=>parseInt(n,10)||0);const pb=String(b||'0').replace(/^v/i,'').split('.').map(n=>parseInt(n,10)||0);for(let i=0;i<Math.max(pa.length,pb.length);i++){const d=(pa[i]||0)-(pb[i]||0);if(d)return d>0?1:-1}return 0}
let tcChildUpdBusy=false;
async function tcChildAutoUpdate(force){
  if(tcChildUpdBusy||!navigator.onLine)return;
  const last=Number(localStorage.getItem('tc_child_upd_check')||0);
  if(!force && Date.now()-last < 3*3600*1000) return; // verifica no máximo a cada 3h
  localStorage.setItem('tc_child_upd_check',String(Date.now()));
  tcChildUpdBusy=true;
  try{
    const m=await tcChildFetchManifest();
    if(!m||!m.version)return;
    const current=(window.TCNativeUpdater&&window.TCNativeUpdater.getCurrentVersion&&window.TCNativeUpdater.getCurrentVersion())||'';
    if(!current)return;                         // sem versão nativa não há comparação fiável
    if(tcCmpVer(m.version,current)<=0)return;   // já está na versão mais recente
    const apk=m.apk_child||m.apk_url||m.download_url;
    if(!apk||!window.TCNativeUpdater||!window.TCNativeUpdater.installFromUrl)return;
    // Não reinicia o download da MESMA versão em menos de 6h (evita insistência).
    const startedKey='tc_child_upd_started_'+m.version;
    const startedAt=Number(localStorage.getItem(startedKey)||0);
    if(!force && Date.now()-startedAt < 6*3600*1000) return;
    localStorage.setItem(startedKey,String(Date.now()));
    const url=new URL(apk,location.href).href;
    // Atualização SILENCIOSA: descarrega em segundo plano sem interromper o envio de dados.
    // Fica uma notificação para instalar; a app continua a comunicar normalmente.
    if(window.TCNativeUpdater.installFromUrlQuiet) window.TCNativeUpdater.installFromUrlQuiet(url);
    else window.TCNativeUpdater.installFromUrl(url);
    state.status='Nova versão v'+m.version+' pronta — instale pela notificação quando quiser.';
    try{render()}catch(_){}
  }catch(_){}
  finally{tcChildUpdBusy=false;}
}
window.tcChildAutoUpdate=tcChildAutoUpdate;
// Verifica ao voltar para primeiro plano e de tempos a tempos.
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') tcChildAutoUpdate(); });
window.addEventListener('online',()=>tcChildAutoUpdate());
try{ if(!window.__tcChildUpdTimer) window.__tcChildUpdTimer=setInterval(()=>{try{tcChildAutoUpdate()}catch(_){}} , 30*60*1000); }catch(_){}
function scrollToPairing(){setTimeout(()=>document.getElementById('pairing-area')?.scrollIntoView({behavior:'smooth',block:'start'}),60)}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();window.__tcDeferredInstallPrompt=e});
window.addEventListener('appinstalled',()=>{state.status='Minha Emergência instalada';render()});
function render(){
  const app=document.getElementById('app'); if(!app)return;
  if(state.filesOpen){
    app.innerHTML=`<main class="child child-files">${filesView()}${state.menuOpen?permissionsMenu():''}</main>`;
    return;
  }
  if(state.gameOpen){
    app.innerHTML=`<main class="child child-game">${gameView()}${state.menuOpen?permissionsMenu():''}</main>`;
    try{window.TCFruitGame&&window.TCFruitGame.mount(document.getElementById('fg-root'))}catch(_){}
    return;
  }
  const content=(state.deviceCode&&!state.forcePair)?linkedView():pairView();
  app.innerHTML=`<main class="child"><header><div class="hbrand"><img class="brand-logo" src="../assets/icons/tconnect-logo-192.png" alt="T-Connect"><div><div class="brand">MINHA <span>SEGURANÇA</span></div><div class="child-subtitle">T-Connect Child</div></div></div><button class="dots" aria-label="Abrir configurações" onclick="toggleMenu()">⋮</button></header>${content}${state.menuOpen?permissionsMenu():''}</main>`;
  if(state.firstRun&&!document.getElementById('permissionWelcome')){
    app.insertAdjacentHTML('beforeend',`<div class="modal" id="permissionWelcome"><div class="modalbox"><div class="phone-install">🛡️</div><h2>Minha Segurança</h2><p>Na primeira abertura, precisamos configurar as permissões necessárias para comunicação e segurança do dispositivo.</p><p class="muted">Câmera · Microfone · Localização · Contactos · SMS · Chamadas · Notificações.</p><div class="confirm"><button class="btn confirmbtn" onclick="requestCorePermissions()">Permitir e continuar</button></div></div></div>`);
  }
}
function pairView(){return `<section class="childbox" id="pairing-area"><div class="shield">⌁</div><h1>Vincular dispositivo</h1>${state.deviceCode?`<div class="notice" role="status">Já vinculado como <b>${esc(state.deviceName||'Child')}</b>. Pode revincular aqui ou <button class="text-btn" style="color:#38bdf8;background:none;border:0;cursor:pointer;text-decoration:underline" onclick="state.forcePair=false;render()">voltar ao painel</button>.</div>`:''}<p>Comece diretamente pelo QR Code, código ou link criado pelo Guardian. Não é necessário fazer login neste aplicativo.</p>${state.pairMessage?`<div class="notice" role="status">${esc(state.pairMessage)}</div>`:''}<div class="pair-tabs"><button class="btn primary" onclick="pairTab('qr')">▣ Ler QR Code</button><button class="btn" onclick="pairTab('code')"># Código</button><button class="btn" onclick="pairTab('link')">↗ Link</button><button class="btn" onclick="pairTab('email')">✉ E-mail</button></div><div id="qr-section" class="qr-child-section"><div id="qr-reader"></div><small>O QR é lido diretamente no aplicativo Minha Segurança.</small></div><div id="code-section" hidden><form onsubmit="pair(event)" class="pair-form"><label>Código de vinculação<input name="invite" required inputmode="text" autocomplete="one-time-code" maxlength="32" pattern="[A-Za-z0-9][A-Za-z0-9 -]{5,31}" placeholder="Ex.: A1B2C3D4"></label><button class="btn primary wide">Vincular código</button></form></div><div id="link-section" hidden><form onsubmit="useInviteLink(event)" class="pair-form"><label>Link do convite<input name="inviteLink" required placeholder="Cole o link do Guardian"></label><button class="btn primary wide">Abrir convite</button></form></div><div id="email-section" hidden><form onsubmit="requestPairingByEmail(event)" class="pair-form"><label>E-mail da conta do Guardian<input name="gemail" type="email" required inputmode="email" autocomplete="email" placeholder="email@exemplo.com"></label><button class="btn primary wide">Enviar pedido de vínculo</button></form><small>O Guardian recebe um pedido e precisa de <b>aprovar</b> no aplicativo dele. Nada é partilhado antes dessa aprovação.</small></div></section>`}
// Estado ao vivo (curto) e hora atual.
function tcChildStatusText(){
  var s=String(state.status||'');
  if(/offline/i.test(s)) return 'Offline';
  if(/enviado|heartbeat/i.test(s)) return 'Protegido';
  if(/tentar/i.test(s)) return 'A ligar…';
  var t=s.replace(/\s*·?\s*\d{1,2}:\d{2}:\d{2}.*$/,'').trim();
  return t||'Protegido';
}
function tcChildTime(){ return new Date().toLocaleTimeString('pt-PT'); }
function tcChildOnline(){ return !/offline/i.test(String(state.status||'')); }
// ===== Design próprio, profissional e funcional (Minha Segurança) =====
function linkedView(){
  const st=esc(tcChildStatusText()); const time=esc(tcChildTime()); const on=tcChildOnline();
  return `<section class="cm-home">
    <div class="cm-bg" aria-hidden="true">
      <span class="cm-a cm-a1"></span><span class="cm-a cm-a2"></span><span class="cm-a cm-a3"></span>
      <span class="cm-stars"></span><span class="cm-grid2"></span><span class="cm-glow"></span><span class="cm-vign"></span>
    </div>
    <div class="cm-top">
      <div class="cm-emblem"><span class="cm-ring r1"></span><span class="cm-ring r2"></span>
        <span class="cm-badge"><img class="cm-logo" src="../assets/icons/tconnect-logo-512.png" alt="T-Connect"></span>
      </div>
      <h1 class="cm-title">MINHA<br><b>PROTEÇÃO MÁXIMA</b></h1>
      <div class="cm-status ${on?'on':'off'}"><span class="cm-dot"></span><span class="cm-st-txt">${st}</span><span class="cm-sep"></span><span class="cm-time" data-clock>${time}</span><span class="cm-bars"><i></i><i></i><i></i><i></i></span></div>
    </div>
    <div class="cm-notice" role="note"><span class="cm-notice-ic">🛡️</span><p>Este dispositivo está a ser <b>acompanhado pelo Guardian</b>. A localização e as permissões ativas são partilhadas com o seu encarregado — de forma transparente.</p></div>
    <button class="cm-sos send emergency-direct" type="button" onclick="triggerSOS()" aria-label="Enviar alerta de emergência">
      <span class="cm-sos-wave"></span><span class="cm-sos-ring"></span>
      <span class="cm-sos-core"><span class="cm-sos-ico"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8.5a6 6 0 0 0-12 0c0 7-3 7-3 9.5h18c0-2.5-3-2.5-3-9.5Z"/><path d="M9.5 21a2.5 2.5 0 0 0 5 0"/></svg></span><span class="cm-sos-label">EMERGÊNCIA</span><span class="cm-sos-hint">tocar para pedir ajuda</span></span>
    </button>
    <div class="cm-foot">
      <div class="cm-foot-card"><span class="cm-foot-ico"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/></svg></span><div class="cm-foot-txt"><small>Hora</small><b data-clock>${time}</b></div></div>
      <div class="cm-foot-card"><span class="cm-foot-ico ${on?'ok':''}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.2 7-12A7 7 0 0 0 5 9c0 5.8 7 12 7 12Z"/><circle cx="12" cy="9" r="2.4"/></svg></span><div class="cm-foot-txt"><small>Estado</small><b>${on?'Ligado':'Offline'}</b></div></div>
    </div>
  </section>`;
}
// Relógio ao vivo: atualiza as horas a cada segundo (sem re-render completo).
try{ if(!window.__tcChildClock) window.__tcChildClock=setInterval(function(){ try{ const t=new Date().toLocaleTimeString('pt-PT'); document.querySelectorAll('[data-clock]').forEach(function(el){el.textContent=t;}); }catch(_){} }, 1000); }catch(_){}


let tcChildCaptureChannel=null,tcChildCapturePeer=null,tcChildCaptureRequestId=null,tcChildCaptureStream=null;
async function childCaptureSignal(requestId,kind,payload){if(!window.TC_DB?.enabled||!window.TC_DB.client)return;await window.TC_DB.client.from('capture_signals').insert({request_id:requestId,sender_role:'child',kind,payload});}
function closeChildCapture(){try{tcChildCaptureStream?.getTracks()?.forEach(t=>t.stop())}catch(e){}try{tcChildCapturePeer?.close()}catch(e){}tcChildCaptureStream=null;tcChildCapturePeer=null;tcChildCaptureRequestId=null;}
let tcChildFacing='environment';let tcSwitching=false;
async function switchChildCamera(){if(tcSwitching)return;try{if(!tcChildCapturePeer||!tcChildCaptureStream)return;const vs=tcChildCaptureStream.getVideoTracks?.()||[];if(!vs.length)return;tcSwitching=true;tcChildFacing=(tcChildFacing==='environment'?'user':'environment');const ns=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:tcChildFacing}},audio:false});const nt=ns.getVideoTracks()[0];const sender=(tcChildCapturePeer.getSenders?.()||[]).find(s=>s.track&&s.track.kind==='video');if(sender&&nt){await sender.replaceTrack(nt);const old=tcChildCaptureStream.getVideoTracks()[0];if(old){try{old.stop()}catch(_){}try{tcChildCaptureStream.removeTrack(old)}catch(_){}}tcChildCaptureStream.addTrack(nt);state.status='Câmera trocada ('+(tcChildFacing==='user'?'frontal':'traseira')+')';render();}else{try{nt&&nt.stop()}catch(_){}}}catch(e){console.warn('switch cam:',e&&e.message)}finally{tcSwitching=false}}
async function answerCaptureRequest(requestId,accept){try{if(!accept){await window.TC_DB.client.rpc('respond_capture',{p_request_id:requestId,p_status:'DECLINED'});await childLog('CÂMERA DA CRIANÇA','Solicitação de captura recusada pelo utilizador','RECUSADO');document.getElementById('tc-capture-request')?.remove();return}await window.TC_DB.client.rpc('respond_capture',{p_request_id:requestId,p_status:'ACCEPTED'});document.getElementById('tc-capture-request')?.remove();state.status='Captura autorizada · preparando vídeo…';render();
  tcChildCaptureRequestId=requestId;tcChildCapturePeer=new RTCPeerConnection(window.TC_RTC||{});const cIce=[],cSeen={};async function cHandle(sig){if(!tcChildCapturePeer||!sig||sig.sender_role!=='guardian')return;if(cSeen[sig.id])return;cSeen[sig.id]=1;try{if(sig.kind==='answer'){if(!tcChildCapturePeer.currentRemoteDescription){await tcChildCapturePeer.setRemoteDescription(sig.payload);while(cIce.length){try{await tcChildCapturePeer.addIceCandidate(cIce.shift())}catch(_){}}}}else if(sig.kind==='ice'&&sig.payload){if(tcChildCapturePeer.remoteDescription&&tcChildCapturePeer.remoteDescription.type){try{await tcChildCapturePeer.addIceCandidate(sig.payload)}catch(_){}}else{cIce.push(sig.payload)}}else if(sig.kind==='cmd'&&sig.payload&&sig.payload.action==='switch-camera'){switchChildCamera()}}catch(e){console.warn('Child capture signaling:',e&&e.message)}}if(window.__tcCaptureSignalChildChannel)window.TC_DB.client.removeChannel(window.__tcCaptureSignalChildChannel);window.__tcCaptureSignalChildChannel=window.TC_DB.client.channel('tc-capture-signal-c-'+requestId).on('postgres_changes',{event:'INSERT',schema:'public',table:'capture_signals',filter:'request_id=eq.'+requestId},p=>cHandle(p.new)).subscribe();
  if(window.__tcChildSigPoll)clearInterval(window.__tcChildSigPoll);window.__tcChildSigPoll=setInterval(async function(){try{if(!tcChildCapturePeer){clearInterval(window.__tcChildSigPoll);return}const {data}=await window.TC_DB.client.from('capture_signals').select('*').eq('request_id',requestId).eq('sender_role','guardian').order('created_at',{ascending:true});for(const sig of (data||[])){await cHandle(sig)}}catch(_){}} ,1500);
  tcChildCapturePeer.onicecandidate=e=>{if(e.candidate)childCaptureSignal(requestId,'ice',e.candidate.toJSON())};
  tcChildCapturePeer.onconnectionstatechange=()=>{const st=tcChildCapturePeer&&tcChildCapturePeer.connectionState;if(st==='failed'||st==='closed'){closeChildCapture();state.status='Sessão de captura encerrada';render()}};
  const requestRow=await window.TC_DB.client.from('capture_requests').select('kind').eq('id',requestId).maybeSingle();
  const captureKind=requestRow?.data?.kind||'CAMERA_VIDEO';
  if(captureKind==='AUDIO_ONLY'){
    const ok=await waitForNativePermission('microphone',15000);if(!ok)throw new Error('O microfone não foi autorizado no Android.');
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('Este dispositivo não disponibiliza microfone ao aplicativo.');
    try{tcChildCaptureStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false})}
    catch(e1){await new Promise(r=>setTimeout(r,600));try{tcChildCaptureStream=await navigator.mediaDevices.getUserMedia({audio:true,video:false})}catch(e2){throw new Error('O microfone não pôde ser iniciado — pode estar a ser usado por outra app (chamada, gravador) ou pelo próprio Guardian no mesmo telemóvel. Feche essas apps/teste com 2 telemóveis e tente de novo.')}}
  }else if(captureKind==='CAMERA_VIDEO'){
    const ok=await waitForNativePermission('camera',15000);if(!ok)throw new Error('A câmera não foi autorizada no Android.');
    await waitForNativePermission('microphone',15000);
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('Este dispositivo não disponibiliza câmera ao aplicativo.');
    tcChildFacing='environment';
    try{tcChildCaptureStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}})}
    catch(e1){try{tcChildCaptureStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false})}catch(e2){tcChildCaptureStream=await navigator.mediaDevices.getUserMedia({video:true,audio:false})}}
  }else{
    if(window.TCNativeScreenCapture&&typeof window.TCNativeScreenCapture.requestCapture==='function'){
      await new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;window.removeEventListener('tc-screen-capture',on);resolve()};const on=()=>finish();window.addEventListener('tc-screen-capture',on);window.TCNativeScreenCapture.requestCapture();setTimeout(finish,20000);});
    }
    if(!navigator.mediaDevices?.getDisplayMedia)throw new Error('A projeção de tela ainda não está disponível neste dispositivo. Use Câmera ou Áudio.');
    tcChildCaptureStream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});
  }
  tcChildCaptureStream.getTracks().forEach(track=>{tcChildCapturePeer.addTrack(track,tcChildCaptureStream)});
  // Camera requests carry both authorized camera video and authorized microphone audio.
  // The Guardian receives the same MediaStream and can play its audio track through its speaker.
  if(captureKind==='CAMERA_VIDEO'){ const audioTrack=tcChildCaptureStream.getAudioTracks?.()[0]; if(audioTrack) audioTrack.enabled=true; }
  const offer=await tcChildCapturePeer.createOffer();await tcChildCapturePeer.setLocalDescription(offer);await childCaptureSignal(requestId,'offer',offer);await childLog('CÂMERA DA CRIANÇA','Captura iniciada após consentimento explícito do Child','AUTORIZADO');state.status='Captura ativa';render();
}catch(e){try{await window.TC_DB.client.rpc('respond_capture',{p_request_id:requestId,p_status:'DECLINED'})}catch(_){}await childLog('CÂMERA DA CRIANÇA','Falha ao iniciar captura após consentimento: '+(e.message||'erro'),'ERRO');state.status='Captura não iniciada: '+(e.message||'erro');render()}}
function showCaptureRequest(r){if(document.getElementById('tc-capture-request'))return;const screen=r.kind==='SCREEN_VIDEO';const audio=r.kind==='AUDIO_ONLY';const icon=screen?'🖥️':audio?'🎙️':'📹';const title=screen?'Pedido de projeção de tela':audio?'Pedido de áudio ao vivo':'Pedido de câmera';const target=screen?'projeção da tela':audio?'acesso ao microfone (somente áudio)':'acesso à câmera e microfone';const official=screen?'da projeção de tela':audio?'do microfone':'da câmera e microfone';const el=document.createElement('div');el.id='tc-capture-request';el.className='modal';el.innerHTML=`<div class="modalbox capture-request-box"><div class="phone-install">${icon}</div><h2>${title}</h2><p>O Guardian solicitou ${target} deste dispositivo.</p><p class="muted"><b>Nada será capturado antes da sua autorização.</b> Ao aceitar, o Android/navegador mostrará a confirmação oficial ${official}.</p><div class="confirm"><button class="btn cancel" onclick="answerCaptureRequest('${r.id}',false)">Recusar</button><button class="btn confirmbtn" onclick="answerCaptureRequest('${r.id}',true)">Aceitar e iniciar</button></div></div></div>`;document.body.appendChild(el)}
async function setupChildCaptureRealtime(){if(!window.TC_DB?.enabled||!window.TC_DB.client||!window.TC_DB.user)return;if(tcChildCaptureChannel)return;tcChildCaptureChannel=window.TC_DB.client.channel('tc-capture-child-'+window.TC_DB.user.id).on('postgres_changes',{event:'INSERT',schema:'public',table:'capture_requests',filter:'child_id=eq.'+window.TC_DB.user.id},payload=>{if(payload.new?.status==='PENDING'&&new Date(payload.new.expires_at)>new Date())showCaptureRequest(payload.new)}).on('postgres_changes',{event:'UPDATE',schema:'public',table:'capture_requests',filter:'child_id=eq.'+window.TC_DB.user.id},payload=>{if(payload.new?.status==='ENDED'){closeChildCapture();state.status='Captura encerrada pelo Guardian';render()}}).subscribe();try{const {data}=await window.TC_DB.client.from('capture_requests').select('*').eq('child_id',window.TC_DB.user.id).eq('status','PENDING').gt('expires_at',new Date().toISOString()).order('requested_at',{ascending:false}).limit(1);if(data?.[0])showCaptureRequest(data[0])}catch(e){console.warn('Capture request sync:',e.message)}
  if(!window.__tcChildReqPoll)window.__tcChildReqPoll=setInterval(async function(){try{if(!window.TC_DB?.enabled||!window.TC_DB.client||!window.TC_DB.user)return;const {data}=await window.TC_DB.client.from('capture_requests').select('*').eq('child_id',window.TC_DB.user.id).eq('status','PENDING').gt('expires_at',new Date().toISOString()).order('requested_at',{ascending:false}).limit(1);if(data&&data[0]&&!document.getElementById('tc-capture-request'))showCaptureRequest(data[0])}catch(_){}} ,4000)}
window.answerCaptureRequest=answerCaptureRequest;window.setupChildCaptureRealtime=setupChildCaptureRealtime;
boot();
