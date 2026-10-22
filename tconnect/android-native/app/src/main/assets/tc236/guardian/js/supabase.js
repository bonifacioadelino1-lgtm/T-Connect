(function(){
  const cfg=window.TC_SUPABASE||{};
  window.TC_DB={enabled:false,client:null,user:null};
  window.TC_DB_READY=(async()=>{
    if(!cfg.url||!cfg.publishableKey||!window.supabase)return false;
    try{
      const client=window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      window.TC_DB.client=client;window.TC_DB.enabled=true;
      const sessionResult=await Promise.race([client.auth.getSession(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Supabase timeout')),6000))]);const {data}=sessionResult||{};window.TC_DB.user=data?.session?.user||null;
      client.auth.onAuthStateChange((_event,session)=>{window.TC_DB.user=session?.user||null;window.dispatchEvent(new CustomEvent('tc-auth',{detail:{event:_event,session}}));});
      return true;
    }catch(e){console.error(e);return false;}
  })();
  const ready=async()=>{await window.TC_DB_READY;if(!window.TC_DB.enabled)throw new Error('Supabase não configurado.');};
  window.tcSignUp=async(email,password,fullName)=>{await ready();return window.TC_DB.client.auth.signUp({email,password,options:{data:{full_name:fullName||''}}});};
  window.tcSignIn=async(email,password)=>{await ready();return window.TC_DB.client.auth.signInWithPassword({email,password});};
  window.tcResetPasswordForEmail=async(email)=>{await ready();const redirectTo=location.origin==='null'?undefined:(location.origin+location.pathname);return window.TC_DB.client.auth.resetPasswordForEmail(email,redirectTo?{redirectTo}:undefined);};
  window.tcUpdatePassword=async(password)=>{await ready();return window.TC_DB.client.auth.updateUser({password});};
  // Redefinição simples (sem e-mail): chama a RPC guardian_reset_password no Supabase.
  window.tcResetPasswordDirect=async(email,newPassword)=>{await ready();return window.TC_DB.client.rpc('guardian_reset_password',{p_email:String(email||'').trim().toLowerCase(),p_new_password:String(newPassword||'')});};
  window.tcGoogle=async()=>{
    await ready();
    try{
      const r=await fetch(cfg.url.replace(/\/$/,'')+'/auth/v1/settings',{headers:{apikey:cfg.publishableKey}});
      if(r.ok){const settings=await r.json();if(settings?.external?.google!==true)return {error:new Error('Unsupported provider: provider is not enabled')};}
    }catch(_e){/* Se o preflight não estiver disponível, o SDK continua o fluxo normal. */}
    const redirectTo=location.origin==='null'?undefined:(location.origin+location.pathname);
    return window.TC_DB.client.auth.signInWithOAuth({provider:'google',options:redirectTo?{redirectTo}:undefined});
  };
  window.tcSignOut=async()=>{await window.TC_DB_READY;if(window.TC_DB.enabled)await window.TC_DB.client.auth.signOut();};
  window.tcProfile=async()=>{await ready();const {data,error}=await window.TC_DB.client.from('profiles').select('*').eq('id',window.TC_DB.user.id).maybeSingle();if(error)throw error;return data;};
  window.tcInsertEvent=async(ev)=>{await ready();if(!window.TC_DB.user)return null;const {data,error}=await window.TC_DB.client.from('activity_events').insert({guardian_id:window.TC_DB.user.id,type:ev.type,detail:ev.detail,contact:ev.contact||null,status:ev.status,source:ev.source,severity:ev.severity||'info',occurred_at:new Date().toISOString()}).select().single();if(error)throw error;return data;};
  window.tcLoadEvents=async()=>{await ready();const {data,error}=await window.TC_DB.client.from('activity_events').select('*').order('occurred_at',{ascending:false}).limit(200);if(error)throw error;return(data||[]).map(x=>({id:x.id,type:x.type,detail:x.detail,contact:x.contact||'',status:x.status,source:x.source,severity:x.severity,at:new Date(x.occurred_at).toLocaleString('pt-PT')}));};
  window.tcCreatePairingCode=async()=>{await ready();const {data,error}=await window.TC_DB.client.rpc('create_pairing_code');if(error)throw error;return data;};
  window.tcLatestRelease=async()=>{await ready();const {data,error}=await window.TC_DB.client.from('app_releases').select('*').eq('is_published',true).order('released_at',{ascending:false}).limit(1).maybeSingle();if(error)throw error;if(!data)return null;return{version:data.version,title:data.title,description:data.description||'',date:data.released_at?new Date(data.released_at).toISOString().slice(0,10):'',released_at:data.released_at,changes:Array.isArray(data.changelog)?data.changelog:[],download_url:data.download_url||'',apk_url:data.download_url||''};};
  window.tcChildren=async()=>{await ready();const {data,error}=await window.TC_DB.client.from('guardian_children').select('child_id,created_at').eq('guardian_id',window.TC_DB.user.id);if(error)throw error;return data||[];};
  window.tcDevices=async()=>{await ready();const {data,error}=await window.TC_DB.client.from('devices').select('*').eq('owner_id',window.TC_DB.user.id).order('last_seen_at',{ascending:false});if(error)throw error;return data||[];};
  window.tcRealtime=async(onEvent,onDevice)=>{await ready();const ch=window.TC_DB.client.channel('tc-guardian-'+window.TC_DB.user.id).on('postgres_changes',{event:'INSERT',schema:'public',table:'activity_events',filter:'guardian_id=eq.'+window.TC_DB.user.id},payload=>onEvent?.(payload.new)).on('postgres_changes',{event:'UPDATE',schema:'public',table:'devices',filter:'owner_id=eq.'+window.TC_DB.user.id},payload=>onDevice?.(payload.new)).subscribe();return ch;};

  // ---- Planos (catálogo) ----
  window.tcLoadPlans=async()=>{await ready();const {data,error}=await window.TC_DB.client.from('plans').select('*').order('sort',{ascending:true});if(error)throw error;return(data||[]).map(p=>({id:p.id,name:p.name,price:p.price,days:p.days,features:Array.isArray(p.features)?p.features:[]}));};
  window.tcSavePlan=async(p)=>{await ready();const {error}=await window.TC_DB.client.from('plans').upsert({id:p.id,name:p.name,price:p.price,days:p.days,features:p.features||[],updated_at:new Date().toISOString()});if(error)throw error;return true;};

  // ---- Subscrições (planos por conta/email) ----
  window.tcLoadSubscriptions=async()=>{await ready();const {data,error}=await window.TC_DB.client.from('subscriptions').select('*').order('updated_at',{ascending:false});if(error)throw error;return(data||[]).map(s=>({email:s.email,plan:s.plan||'',days:s.days||0,paidAt:s.paid_at,status:s.status}));};
  window.tcAdminListUsers=async()=>{await ready();const {data,error}=await window.TC_DB.client.rpc('tc_admin_list_users');if(error)throw error;return(data||[]).map(s=>({email:s.email,plan:s.plan||'',days:s.days||0,paidAt:s.paid_at,status:s.status}));};
  window.tcMySubscription=async()=>{await ready();const email=(window.TC_DB.user?.email||'').toLowerCase();const {data,error}=await window.TC_DB.client.from('subscriptions').select('*').eq('email',email).maybeSingle();if(error)throw error;if(!data)return null;return{email:data.email,plan:data.plan||'',days:data.days||0,paidAt:data.paid_at,status:data.status};};
  window.tcSetMyPlan=async(planId)=>{await ready();const {data,error}=await window.TC_DB.client.rpc('tc_set_my_plan',{p_plan:planId});if(error)throw error;return data;};
  window.tcAdminUpsertSubscription=async(sub)=>{await ready();const {error}=await window.TC_DB.client.from('subscriptions').upsert({email:(sub.email||'').toLowerCase(),plan:sub.plan||null,days:sub.days||0,paid_at:sub.paidAt||null,status:sub.status||'active',updated_at:new Date().toISOString()},{onConflict:'email'});if(error)throw error;return true;};
  window.tcAdminDeleteSubscription=async(email)=>{await ready();const {error}=await window.TC_DB.client.from('subscriptions').delete().eq('email',(email||'').toLowerCase());if(error)throw error;return true;};

  // ---- Perfil (nome + avatar) ----
  window.tcLoadMyProfile=async()=>{await ready();const {data,error}=await window.TC_DB.client.from('profiles').select('full_name,avatar_url').eq('id',window.TC_DB.user.id).maybeSingle();if(error)throw error;if(!data)return {};return{name:data.full_name||'',photo:data.avatar_url||''};};
  window.tcSaveMyProfile=async(p)=>{await ready();const row={id:window.TC_DB.user.id};if(p.name!=null)row.full_name=p.name;if(p.photo!=null)row.avatar_url=p.photo;const {error}=await window.TC_DB.client.from('profiles').upsert(row,{onConflict:'id'});if(error)throw error;return true;};

  // ---- Pagamento (via Edge Function segura 'pay') ----
  // Inicia um pagamento STK Push (o cliente confirma com o PIN no telemóvel).
  window.tcCharge=async({method,plan,amount,days,phone})=>{await ready();const {data,error}=await window.TC_DB.client.functions.invoke('pay',{body:{action:'charge',method,plan,amount,days,phone}});if(error)throw error;return data;};
  // Consulta o estado de uma referência de pagamento (para gateways assíncronos).
  window.tcChargeStatus=async({reference,plan,days})=>{await ready();const {data,error}=await window.TC_DB.client.functions.invoke('pay',{body:{action:'status',reference,plan,days}});if(error)throw error;return data;};
})();
