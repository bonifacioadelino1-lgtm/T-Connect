
/*
 T-Connect v2.39.5 — Alternative Map
 Leaflet + OpenStreetMap tiles. No Google Maps API key required.
 The existing interface is intentionally preserved.
*/
(() => {
  // Leaflet expõe o global `L` (usado diretamente abaixo via window.L). Se o script do
  // Leaflet ainda não tiver corrido quando `init()` é chamado, o mapa não abria e ficava
  // em silêncio para sempre; `init()` passa a reagendar-se até o Leaflet existir.
  let leafletWaitTimer = null, leafletWaitTries = 0;
  const DEFAULT = [-15.1165, 39.2666]; // Nampula, Mozambique: initial map center only; marker remains hidden until a real location is received
  let map, marker, accuracyCircle, pulseMarker = null, trail = [], currentType = 'roadmap';
  let selfMarker = null, lastSelfLocation = null;
  let tcUserMovedAt = 0; // quando o utilizador mexeu no mapa com os dedos (para não recentrar por cima)
  let lastKnownLocation = null, gridLayer = null;
  // Desenha/atualiza o ponto AZUL do Guardião com a MESMA animação do ponto vermelho (em azul).
  function drawSelfMarker(lat, lng) {
    try {
      if (!map || !window.L) return;
      const pos = [Number(lat), Number(lng)];
      if (!selfMarker) {
        const html = '<div class="tc-pulse blue"><span class="pr r1"></span><span class="pr r2"></span><span class="pc"></span></div>';
        selfMarker = window.L.marker(pos, { icon: window.L.divIcon({ className:'tc-pulse-icon', html:html, iconSize:[0,0], iconAnchor:[0,0] }), interactive:false, keyboard:false, zIndexOffset:3500 }).addTo(map);
      } else {
        selfMarker.setLatLng(pos);
      }
    } catch(_){}
  }
  function restoreSelfMarker() {
    if (!map) return;
    if (!lastSelfLocation) {
      try { const s = JSON.parse(localStorage.getItem('tc:selfLocation') || 'null'); if (s && Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng))) lastSelfLocation = { lat:Number(s.lat), lng:Number(s.lng) }; } catch(_){}
    }
    if (lastSelfLocation) drawSelfMarker(lastSelfLocation.lat, lastSelfLocation.lng);
  }
  // ===== Deteção de movimento/direção (para o painel: "a caminhar para X") =====
  // Robusta: usa um ponto de referência e um limiar que acompanha a precisão do GPS,
  // com histerese para NÃO oscilar entre "Parado" e "A caminhar" a cada tremor do sinal.
  let tcMoveRef = null, tcMovementStr = '';
  function tcCompassPt(brg){ const dirs=['Norte','Nordeste','Este','Sudeste','Sul','Sudoeste','Oeste','Noroeste']; return dirs[Math.round(((brg%360)/45))%8]; }
  function tcBearing(a,b){ const r=Math.PI/180; const f1=a.lat*r,f2=b.lat*r,dl=(b.lng-a.lng)*r; const y=Math.sin(dl)*Math.cos(f2); const x=Math.cos(f1)*Math.sin(f2)-Math.sin(f1)*Math.cos(f2)*Math.cos(dl); return (Math.atan2(y,x)*180/Math.PI+360)%360; }
  function tcHaversine(a,b){ const R=6371000,r=Math.PI/180; const dLat=(b.lat-a.lat)*r,dLng=(b.lng-a.lng)*r; const s=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dLng/2)*Math.sin(dLng/2); return 2*R*Math.asin(Math.min(1,Math.sqrt(s))); }
  function tcUpdateMovement(lat,lng,accuracy){
    const now=Date.now();
    const cur={lat:Number(lat),lng:Number(lng),t:now};
    if(!Number.isFinite(cur.lat)||!Number.isFinite(cur.lng)) return;
    const ad=window.TC_MAP_ADDRESS||{}; const area=ad.bairro||ad.distrito||ad.cidade||'';
    const suf=area?(' · '+area):'';
    // Limiar que ignora o ruído do GPS: nunca menor que ~25 m e cresce com a imprecisão.
    const acc=Math.min(120, Math.max(0, Number(accuracy)||0));
    const moveThresh=Math.max(25, acc*1.3);
    if(!tcMoveRef){ tcMoveRef=cur; if(!tcMovementStr) tcMovementStr='Parado'+suf; return; }
    const d=tcHaversine(tcMoveRef,cur);
    const dt=Math.max(1,(now-tcMoveRef.t)/1000);
    if(d>=moveThresh){
      // Deslocação real e sustentada: declara movimento e avança a referência.
      const spd=d/dt; // m/s
      const dir=tcCompassPt(tcBearing(tcMoveRef,cur));
      const verb=spd>1.8?'Em movimento para':'A caminhar para';
      tcMovementStr=verb+' '+dir+suf;
      tcMoveRef=cur;
    } else if(dt>=12){
      // Ficou dentro do limiar durante um tempo razoável: está realmente parado.
      tcMovementStr='Parado'+suf;
      tcMoveRef=cur; // reinicia a referência para não acumular deriva do GPS
    }
    // Caso contrário (pequena variação e há pouco tempo): mantém o estado anterior (histerese).
  }
  let mapContainer = null;
  let hasLiveLocation = false;
  let roadLayer, satelliteLayer, hybridLabels, fallbackRoadLayer, labelsLayer, transportLayer, esriSatLayer;
  let initToken = 0;
  let useFallbackRoad = false, useFallbackSat = false;
  const _termLast = {};
  function term(key, minMs, ...args) {
    const now = Date.now();
    if (_termLast[key] && now - _termLast[key] < minMs) return;
    _termLast[key] = now;
    if (window.tcMapTerminalEvent) window.tcMapTerminalEvent(...args);
  }
  let lastGeocodeAt = 0;
  let lastGeocodeKey = '', geocodeTimer = null, areaName = '';

  function escapeHtml(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  async function reverseGeocode(lat, lng) {
    // ~11 m de precisão: evita pedir geocodificação a cada oscilação do GPS.
    const key = lat.toFixed(4)+','+lng.toFixed(4);
    if (key === lastGeocodeKey) return;
    clearTimeout(geocodeTimer);
    const wait = Math.max(350, 1100 - (Date.now() - lastGeocodeAt));
    geocodeTimer = setTimeout(async () => {
      lastGeocodeAt = Date.now();
      let via='', bairro='', distrito='', cidade='', provincia='', pais='', full='';
      // 1) BigDataCloud: nomes administrativos REAIS da zona (bairro/localidade, cidade,
      //    província, país). Feito para uso no cliente (CORS aberto, sem chave) e dá nomes
      //    oficiais da área em vez de rótulos obscuros/inexistentes do OSM.
      try {
        const u = 'https://api.bigdatacloud.net/data/reverse-geocode-client?latitude='+encodeURIComponent(lat)+'&longitude='+encodeURIComponent(lng)+'&localityLanguage=pt';
        const r = await fetch(u);
        if (r.ok) {
          const d = await r.json();
          bairro    = d.locality || '';
          cidade    = d.city || d.locality || '';
          provincia = d.principalSubdivision || '';
          pais      = d.countryName || '';
          // Tenta um nível administrativo intermédio (distrito/município) real.
          try {
            const adm = (d.localityInfo && d.localityInfo.administrative) || [];
            // Ordenado do mais geral (país) ao mais específico. Procura um nível de
            // distrito/município distinto da cidade e da província.
            for (let i = adm.length - 1; i >= 0; i--) {
              const nm = adm[i] && adm[i].name;
              if (nm && nm !== cidade && nm !== provincia && nm !== bairro) { distrito = nm; break; }
            }
          } catch(_){}
        }
      } catch(_){}
      // 2) Nominatim: acrescenta a RUA/avenida (quando existe) e serve de reforço/alternativa.
      try {
        const url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=pt&lat='+encodeURIComponent(lat)+'&lon='+encodeURIComponent(lng)+'&zoom=18&addressdetails=1';
        const r = await fetch(url, {headers:{'Accept':'application/json'}});
        if (r.ok) {
          const data = await r.json(); const a = data.address || {};
          via = a.road || a.pedestrian || a.footway || a.residential || '';
          if (!bairro)    bairro    = a.neighbourhood || a.suburb || a.quarter || a.hamlet || '';
          if (!distrito)  distrito  = a.city_district || a.district || a.county || a.municipality || '';
          if (!cidade)    cidade    = a.city || a.town || a.village || '';
          if (!provincia) provincia = a.state || a.region || a.province || '';
          if (!pais)      pais      = a.country || '';
          full = data.display_name || '';
        }
      } catch(_){}
      // Nome final: só termos reais e não repetidos. Inclui sempre cidade/província/país
      // para nunca ficar só com um rótulo isolado e irreconhecível.
      const parts = [via, bairro, distrito, cidade, provincia].filter((v,i,arr)=>v && arr.indexOf(v)===i);
      const built = parts.length ? parts.join(', ') : full;
      if (!built) return; // nada fiável: mantém as coordenadas, nunca escreve um nome falso
      areaName = built;
      lastGeocodeKey = key; // memoriza só após obter um nome real (permite nova tentativa se falhar)
      window.TC_MAP_ADDRESS = {via, bairro, distrito, cidade, provincia, pais, full: areaName, lat, lng};
      window.TC_MAP_AREA_NAME = areaName;
      if (marker) {
        const coords = lat.toFixed(6)+', '+lng.toFixed(6);
        marker.bindPopup('<b>Child localizado</b><br>'+escapeHtml(areaName)+'<br><span style="font-family:monospace">'+coords+'</span>');
      }
      if (window.refreshLocationTerminalUI) window.refreshLocationTerminalUI();
      const hud = mapContainer && mapContainer.querySelector('.tc-exact-coordinate-hud');
      if (hud && hud.querySelector('small')) hud.querySelector('small').textContent = '✓ Localizado · ' + areaName;
      try{ const gp=mapContainer&&mapContainer.querySelector('.tc-glass-panel'); if(gp&&gp.classList.contains('open')){ const ael=gp.querySelector('[data-k=addr]'); if(ael) tcTypeInto(ael, areaName); } }catch(_){}
    }, wait);
  }

  function icon() {
    // Ponteiro com ícone de telemóvel (celular) do dispositivo da Criança.
    const name = (window.TC_DEVICE_NAME || 'Child');
    return window.L.divIcon({
      className: '',
      html: '<div class="tc-map-phone" aria-label="Localização do dispositivo">'
        + '<div class="tc-map-phone-pin">'
        + '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.2"/><line x1="10.5" y1="18.5" x2="13.5" y2="18.5"/></svg>'
        + '</div>'
        + '</div>',
      iconSize: [40,52],
      iconAnchor: [20,52]
    });
  }

  function findContainer() {
    return document.getElementById('map') ||
      document.getElementById('tc-map') ||
      document.querySelector('.tc-map') ||
      document.querySelector('[data-map]') ||
      document.querySelector('.map-container');
  }

  function destroyMap() {
    try { if (map) map.remove(); } catch (e) {}
    try { if (pulseMarker) map.removeLayer(pulseMarker); } catch (e) {}
    try { if (selfMarker) map.removeLayer(selfMarker); } catch (e) {}
    map = null; marker = null; accuracyCircle = null; pulseMarker = null; selfMarker = null; roadLayer = null;
    satelliteLayer = null; hybridLabels = null; fallbackRoadLayer = null; labelsLayer = null; transportLayer = null; esriSatLayer = null; mapContainer = null;
    initToken++;
  }

  // ===== Camada de ficção científica (HUD por cima dos tiles reais) =====
  let tcMapCtx = null;
  function tcMapAudio(){ try{ if(!tcMapCtx) tcMapCtx = new (window.AudioContext||window.webkitAudioContext)(); if(tcMapCtx.state==='suspended') tcMapCtx.resume(); return tcMapCtx; }catch(_){ return null; } }
  try{ ['click','touchstart','keydown'].forEach(function(ev){ window.addEventListener(ev, function(){ tcMapAudio(); }, {once:true, passive:true}); }); }catch(_){}
  // ===== Áudio cinematográfico (estilo filme de hackers) — sintetizado, com reverb curto, mais suave =====
  function tcBus(ctx){ try{ if(ctx.__tcBus) return ctx.__tcBus; const m=ctx.createGain(); m.gain.value=0.85; let conv=null; try{ conv=ctx.createConvolver(); const sr=ctx.sampleRate, len=Math.floor(sr*1.6), b=ctx.createBuffer(2,len,sr); for(let ch=0;ch<2;ch++){ const d=b.getChannelData(ch); for(let i=0;i<len;i++){ d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3.2); } } conv.buffer=b; }catch(_){ conv=null; } const dry=ctx.createGain(); dry.gain.value=0.9; m.connect(dry); dry.connect(ctx.destination); if(conv){ const wet=ctx.createGain(); wet.gain.value=0.22; m.connect(conv); conv.connect(wet); wet.connect(ctx.destination); } ctx.__tcBus=m; return m; }catch(_){ return ctx.destination; } }
  function tcNoiseBuf(ctx,dur){ const sr=ctx.sampleRate, len=Math.max(1,Math.floor(sr*dur)), b=ctx.createBuffer(1,len,sr), d=b.getChannelData(0); for(let i=0;i<len;i++) d[i]=Math.random()*2-1; return b; }
  function tcRiser(ctx,t,dur,f0,f1,gain){ try{ const src=ctx.createBufferSource(); src.buffer=tcNoiseBuf(ctx,dur); const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.Q.value=0.8; bp.frequency.setValueAtTime(f0,t); bp.frequency.exponentialRampToValueAtTime(f1,t+dur); const g=ctx.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(gain,t+dur*0.85); g.gain.exponentialRampToValueAtTime(0.0001,t+dur); src.connect(bp); bp.connect(g); g.connect(tcBus(ctx)); src.start(t); src.stop(t+dur); }catch(_){}}
  function tcBoom(ctx,t,f,gain,dur){ try{ const o=ctx.createOscillator(); o.type='sine'; const g=ctx.createGain(); o.frequency.setValueAtTime(f*2.2,t); o.frequency.exponentialRampToValueAtTime(f,t+dur*0.6); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(gain,t+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t+dur); o.connect(g); g.connect(tcBus(ctx)); o.start(t); o.stop(t+dur+0.05); }catch(_){}}
  function tcData(ctx,t,n,gain){ try{ for(let i=0;i<n;i++){ const o=ctx.createOscillator(); o.type='square'; const g=ctx.createGain(); const tt=t+i*0.045; const f=500+Math.random()*2200; o.frequency.setValueAtTime(f,tt); const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=3200; g.gain.setValueAtTime(0.0001,tt); g.gain.exponentialRampToValueAtTime(gain,tt+0.005); g.gain.exponentialRampToValueAtTime(0.0001,tt+0.05); o.connect(lp); lp.connect(g); g.connect(tcBus(ctx)); o.start(tt); o.stop(tt+0.06); } }catch(_){}}
  function tcSonarPing(){ const ctx=tcMapAudio(); if(!ctx) return; const n=ctx.currentTime; tcBoom(ctx,n,120,0.13,0.9); tcData(ctx,n+0.02,5,0.045); try{ const o=ctx.createOscillator(); o.type='triangle'; const g=ctx.createGain(); const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=1800; bp.Q.value=6; o.frequency.setValueAtTime(2200,n); o.frequency.exponentialRampToValueAtTime(900,n+0.25); g.gain.setValueAtTime(0.0001,n); g.gain.exponentialRampToValueAtTime(0.09,n+0.01); g.gain.exponentialRampToValueAtTime(0.0001,n+0.45); o.connect(bp); bp.connect(g); g.connect(tcBus(ctx)); o.start(n); o.stop(n+0.5); }catch(_){}}
  function tcScanSweep(){ const ctx=tcMapAudio(); if(!ctx) return; const n=ctx.currentTime; tcRiser(ctx,n,0.9,300,1600,0.045); tcData(ctx,n+0.1,4,0.03); }
  function positionReticle(){ if(!map||!mapContainer||!lastKnownLocation) return; const scifi=mapContainer.querySelector('.tc-scifi-hud'); if(!scifi) return; try{ const pt=map.latLngToContainerPoint([lastKnownLocation.lat,lastKnownLocation.lng]); const ret=scifi.querySelector('.tc-scifi-reticle'); if(ret){ ret.style.left=pt.x+'px'; ret.style.top=pt.y+'px'; } const blip=scifi.querySelector('.tc-sf-blip'); if(blip){ blip.style.left=pt.x+'px'; blip.style.top=pt.y+'px'; } ensurePulseMarker(); updateLeader(pt); }catch(_){} }
  // Ponto vermelho animado como MARCADOR do Leaflet: fica cravado na coordenada
  // exata e acompanha pan/zoom e cada atualização em tempo real (sem "fugir").
  function ensurePulseMarker(){ try{ if(!map||!lastKnownLocation||!window.L) return; const pos=[lastKnownLocation.lat,lastKnownLocation.lng]; if(!pulseMarker){ const html='<div class="tc-pulse"><span class="pr r1"></span><span class="pr r2"></span><span class="pc"></span></div>'; pulseMarker=window.L.marker(pos,{ icon:window.L.divIcon({className:'tc-pulse-icon',html:html,iconSize:[0,0],iconAnchor:[0,0]}), interactive:false, keyboard:false, zIndexOffset:4000 }).addTo(map); } else { pulseMarker.setLatLng(pos); } }catch(_){} }
  function updateLeader(pt){ try{ const scifi=mapContainer&&mapContainer.querySelector('.tc-scifi-hud'); if(!scifi) return; const ln=scifi.querySelector('.tc-sf-leader line'); const panel=mapContainer.querySelector('.tc-glass-panel'); if(!ln) return; if(!pt&&lastKnownLocation){ pt=map.latLngToContainerPoint([lastKnownLocation.lat,lastKnownLocation.lng]); } if(!pt||!panel||!panel.classList.contains('open')){ ln.setAttribute('x2', ln.getAttribute('x1')||0); return; } const prect=panel.getBoundingClientRect(); const mrect=mapContainer.getBoundingClientRect(); const px=prect.left-mrect.left; const py=prect.top-mrect.top+34; ln.setAttribute('x1', pt.x); ln.setAttribute('y1', pt.y); ln.setAttribute('x2', px); ln.setAttribute('y2', py); }catch(_){} }
  function updateGrid(){ try{ const scifi=mapContainer&&mapContainer.querySelector('.tc-scifi-hud'); if(!scifi) return; const d=window.TC_DEVICE_INFO||{}; const g=function(k,v){ const el=scifi.querySelector('[data-g='+k+']'); if(el) el.textContent=v; }; g('bat',(d.battery!=null&&d.battery!==''?d.battery+'%':'—')); g('acc',(lastKnownLocation&&lastKnownLocation.accuracy?Math.round(lastKnownLocation.accuracy)+'m':'—')); g('sig',(d.status==='online'||!d.status?'FORTE':'FRACO')); g('upd',new Date().toLocaleTimeString('pt-PT').slice(0,5)); }catch(_){} }
  function tcDetectAlert(){ const c=tcMapAudio(); if(!c) return; const n=c.currentTime; tcRiser(c,n,0.5,1800,220,0.055); tcBoom(c,n+0.42,70,0.15,1.2); tcData(c,n+0.44,7,0.045); }
  function tcApproachTone(){ const c=tcMapAudio(); if(!c) return; const n=c.currentTime; try{ const lp=c.createBiquadFilter(); lp.type='lowpass'; lp.frequency.setValueAtTime(300,n); lp.frequency.exponentialRampToValueAtTime(2200,n+8.5); const g=c.createGain(); g.gain.setValueAtTime(0.0001,n); g.gain.linearRampToValueAtTime(0.05,n+1.2); g.gain.setValueAtTime(0.05,n+7.5); g.gain.exponentialRampToValueAtTime(0.0001,n+9.2); lp.connect(g); g.connect(tcBus(c)); [55,55.4,82.5].forEach(function(f){ const o=c.createOscillator(); o.type='sawtooth'; o.frequency.setValueAtTime(f,n); o.frequency.linearRampToValueAtTime(f*1.5,n+9); o.connect(lp); o.start(n); o.stop(n+9.3); }); }catch(_){}
    for(let k=1;k<9;k++){ tcData(c,n+k,2,0.03); }
    tcRiser(c,n+7.6,1.5,400,3200,0.06); }
  let tcAcquired=false, tcAcquiring=false;
  function sizeGlobe(){ try{ if(!mapContainer) return; const d=Math.min(mapContainer.clientWidth||0, mapContainer.clientHeight||0); if(!d) return; const scifi=mapContainer.querySelector('.tc-scifi-hud'); if(!scifi) return; const g=scifi.querySelector('.tc-sf-globe'); if(g){ g.style.width=Math.round(d*0.94)+'px'; g.style.height=Math.round(d*0.94)+'px'; } }catch(_){} }
  function tcAcquire(lat,lng){ if(!map||tcAcquiring) return; tcAcquiring=true; const scifi=mapContainer&&mapContainer.querySelector('.tc-scifi-hud');
    if(scifi){ scifi.classList.remove('tc-locked','tc-clean'); scifi.classList.add('tc-scanning','tc-detected'); const st=scifi.querySelector('.tc-scifi-status span'); if(st) st.textContent='ALVO DETETADO · A APROXIMAR'; const od=scifi.querySelector('.tc-photo-deck'); if(od) od.parentNode.removeChild(od); try{ stopPanelAutoScroll(); }catch(_){} }
    positionReticle(); try{ tcDetectAlert(); }catch(_){} setTimeout(function(){ try{ tcApproachTone(); }catch(_){} },260);
    // vista ampla primeiro, depois zoom lento de ~9s até à rua
    try{ map.setView([lat,lng], 12, { animate:true, duration:0.6 }); }catch(_){}
    setTimeout(function(){ try{ map.flyTo([lat,lng], 17, { animate:true, duration:9 }); }catch(_){} positionReticle(); }, 900);
    setTimeout(function(){ tcAcquiring=false; tcAcquired=true; if(scifi) scifi.classList.remove('tc-detected'); try{ positionReticle(); scifiLock(); }catch(_){} try{ map.invalidateSize(false); }catch(_){} }, 10200);
  }

  // ===== Telas de vidro com FOTOS reais da área (mosaico de satélite centrado no ponto) =====
  function lon2tileF(lon,z){ return (lon+180)/360*Math.pow(2,z); }
  function lat2tileF(lat,z){ return (1-Math.log(Math.tan(lat*Math.PI/180)+1/Math.cos(lat*Math.PI/180))/Math.PI)/2*Math.pow(2,z); }
  // Preenche `host` com tiles de satélite Esri, centrando (lat,lng) no meio da caixa viewW×viewH.
  function tcFillTiles(host, lat, lng, z, viewW, viewH){ try{ host.innerHTML=''; z=Math.max(1,Math.min(17,Math.round(z))); const n=Math.pow(2,z); const fx=lon2tileF(lng,z), fy=lat2tileF(lat,z); const px=fx*256, py=fy*256; const originX=viewW/2-px, originY=viewH/2-py; const minTX=Math.floor((px-viewW/2)/256), maxTX=Math.floor((px+viewW/2)/256); const minTY=Math.floor((py-viewH/2)/256), maxTY=Math.floor((py+viewH/2)/256); for(let tx=minTX; tx<=maxTX; tx++){ for(let ty=minTY; ty<=maxTY; ty++){ const wx=((tx%n)+n)%n; if(ty<0||ty>=n) continue; const img=document.createElement('img'); img.className='pf-tile'; img.alt=''; img.decoding='async'; img.src='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/'+z+'/'+ty+'/'+wx; img.style.left=Math.round(originX+tx*256)+'px'; img.style.top=Math.round(originY+ty*256)+'px'; img.onerror=function(){ this.style.visibility='hidden'; }; host.appendChild(img); } } }catch(_){} }
  // Lightbox: imagem grande e nítida da área ao clicar numa tela
  function openPhotoLightbox(lat,lng,z,title){ try{ const host=mapContainer||document.body; let ov=host.querySelector('.tc-photo-modal'); if(ov) ov.parentNode.removeChild(ov); ov=document.createElement('div'); ov.className='tc-photo-modal'; const vw=Math.min(Math.round((mapContainer?mapContainer.clientWidth:360)*0.92),520); const vh=Math.round((mapContainer?mapContainer.clientHeight:360)*0.7); ov.innerHTML='<div class="pm-box" style="width:'+vw+'px"><div class="pm-head"><b>'+title+'</b><button class="pm-close" aria-label="Fechar">×</button></div><div class="pm-view" style="height:'+vh+'px"><div class="pm-tiles"></div><span class="pm-scan"></span><span class="pm-mark"></span><span class="pm-c tl"></span><span class="pm-c tr"></span><span class="pm-c bl"></span><span class="pm-c br"></span></div><div class="pm-foot"><span>'+Number(lat).toFixed(6)+'°, '+Number(lng).toFixed(6)+'°</span><span>SATÉLITE · Z'+z+'</span></div></div>'; host.appendChild(ov); tcFillTiles(ov.querySelector('.pm-tiles'), lat, lng, z, vw, vh); try{ tcCinematicOpen(); }catch(_){} const close=function(){ ov.classList.remove('on'); setTimeout(function(){ if(ov&&ov.parentNode) ov.parentNode.removeChild(ov); },260); }; ov.querySelector('.pm-close').addEventListener('click',close); ov.addEventListener('click',function(e){ if(e.target===ov) close(); }); requestAnimationFrame(function(){ ov.classList.add('on'); }); }catch(_){} }
  function openPhotoScreens(){ if(!mapContainer||!lastKnownLocation) return; const scifi=mapContainer.querySelector('.tc-scifi-hud'); if(!scifi) return;
    let deck=scifi.querySelector('.tc-photo-deck'); if(deck) deck.parentNode.removeChild(deck);
    const lat=lastKnownLocation.lat, lng=lastKnownLocation.lng;
    // Plano A = MENOS zoom (área toda, marcada) · Plano B = MAIS zoom (aproximação). Esri é fiável até z17.
    // Plano A = MENOS zoom (área, marcada) · Plano B = MAIS zoom (aproximação). Esri fiável até z17.
    const shots=[ {cls:'mid', z:14, big:16, mark:true}, {cls:'right', z:17, big:17, mark:false} ];
    deck=document.createElement('div'); deck.className='tc-photo-deck';
    shots.forEach(function(s){ const fig=document.createElement('figure'); fig.className='tc-photo-frame '+s.cls; fig.setAttribute('role','button'); fig.setAttribute('tabindex','0'); fig.setAttribute('aria-label','Ver área');
      fig.innerHTML='<span class="holo-beam"></span><span class="holo-base"></span><div class="pf-inner"><div class="pf-tiles"></div><div class="pf-scan"></div>'+(s.mark?'<span class="pf-mark"></span>':'')+'<span class="pf-corner tl"></span><span class="pf-corner tr"></span><span class="pf-corner bl"></span><span class="pf-corner br"></span></div>';
      deck.appendChild(fig);
      tcFillTiles(fig.querySelector('.pf-tiles'), lat, lng, s.z, 104, 72);
      const open=function(){ openPhotoLightbox(lat, lng, s.big, ''); };
      fig.addEventListener('click', open); fig.addEventListener('keydown', function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); open(); } });
    });
    scifi.appendChild(deck);
    requestAnimationFrame(function(){ deck.querySelectorAll('.tc-photo-frame').forEach(function(f,i){ setTimeout(function(){ f.classList.add('on'); },120+i*260); }); });
  }
  // ===== Auto-rolagem do painel de informação (mostra tudo sozinho) =====
  let tcPanelScrollTimer=null;
  function startPanelAutoScroll(){ try{ stopPanelAutoScroll(); const p=mapContainer&&mapContainer.querySelector('.tc-glass-panel'); if(!p) return; const body=p.querySelector('.tc-glass-body'); if(!body) return; let dir=1; tcPanelScrollTimer=setInterval(function(){ if(!body||!document.body.contains(body)){ stopPanelAutoScroll(); return; } const max=body.scrollHeight-body.clientHeight; if(max<=2) return; let nv=body.scrollTop+dir*0.6; if(nv>=max){ nv=max; dir=-1; } else if(nv<=0){ nv=0; dir=1; } body.scrollTop=nv; },40); }catch(_){} }
  function stopPanelAutoScroll(){ if(tcPanelScrollTimer){ clearInterval(tcPanelScrollTimer); tcPanelScrollTimer=null; } }
  function scifiLock(){ if(!mapContainer) return; const scifi=mapContainer.querySelector('.tc-scifi-hud'); if(!scifi) return; scifi.classList.remove('tc-scanning'); scifi.classList.add('tc-locked','tc-clean'); const st=scifi.querySelector('.tc-scifi-status span'); if(st) st.textContent='ALVO LOCALIZADO'; positionReticle(); const ret=scifi.querySelector('.tc-scifi-reticle'); if(ret){ ret.classList.remove('lock-anim'); void ret.offsetWidth; ret.classList.add('lock-anim'); } try{ if(map&&lastKnownLocation) map.setView([lastKnownLocation.lat,lastKnownLocation.lng], map.getZoom(), {animate:false}); }catch(_){} try{ tcSonarPing(); }catch(_){} try{ openGlassPanel(); }catch(_){} try{ openPhotoScreens(); }catch(_){} try{ updateGrid(); setTimeout(function(){ updateLeader(); },120); }catch(_){} try{ if(window.__tcGridTimer) clearInterval(window.__tcGridTimer); window.__tcGridTimer=setInterval(function(){ try{ updateGrid(); }catch(_){} },5000); }catch(_){} setTimeout(startPanelAutoScroll, 1600); }
  window.TC_MAP_SCIFI = { lock: scifiLock, scan: tcScanSweep, ping: tcSonarPing };
  function tcCinematicOpen(){ const c=tcMapAudio(); if(!c) return; const n=c.currentTime; tcRiser(c,n,0.4,600,3600,0.055); tcData(c,n,6,0.04); tcBoom(c,n+0.18,90,0.08,0.5); try{ const o=c.createOscillator(); o.type='sine'; const g=c.createGain(); o.frequency.setValueAtTime(1760,n+0.05); o.frequency.exponentialRampToValueAtTime(2640,n+0.3); g.gain.setValueAtTime(0.0001,n+0.05); g.gain.exponentialRampToValueAtTime(0.055,n+0.08); g.gain.exponentialRampToValueAtTime(0.0001,n+0.5); o.connect(g); g.connect(tcBus(c)); o.start(n+0.05); o.stop(n+0.55); }catch(_){}}
  const tcTypers = {};
  function tcTypeInto(el, text){ if(!el) return; text=String(text==null?'':text); const key=el.getAttribute('data-k')||Math.random(); if(tcTypers[key]) clearInterval(tcTypers[key]); el.textContent=''; el.classList.add('tc-type-caret'); let i=0; tcTypers[key]=setInterval(function(){ i++; el.textContent=text.slice(0,i); if(i>=text.length){ clearInterval(tcTypers[key]); delete tcTypers[key]; el.classList.remove('tc-type-caret'); } }, 24); }
  function tcGlassInfo(){ const d=window.TC_DEVICE_INFO||{}; const ad=window.TC_MAP_ADDRESS||{}; const lat=lastKnownLocation?lastKnownLocation.lat:null, lng=lastKnownLocation?lastKnownLocation.lng:null; const now=new Date();
    return { name:(window.TC_DEVICE_NAME||d.name||'Child'), coords:(lat!=null&&lng!=null)?(Number(lat).toFixed(6)+'°, '+Number(lng).toFixed(6)+'°'):'—', addr: (ad.via||areaName) || 'a localizar endereço…', zona:(ad.bairro||ad.distrito||'—'), cidade:(ad.cidade||'—'), pais:(ad.pais||'—'), mov:(tcMovementStr||'—'), acc:(lastKnownLocation&&lastKnownLocation.accuracy?Math.round(lastKnownLocation.accuracy)+' m':'—'), bat:(d.battery!=null&&d.battery!==''?d.battery+'%':'—'), st:(d.status?(d.status==='online'?'ONLINE':String(d.status).toUpperCase()):'ONLINE'), upd: now.toLocaleTimeString('pt-PT') }; }
  function openGlassPanel(){ if(!mapContainer) return; let p=mapContainer.querySelector('.tc-glass-panel'); const info=tcGlassInfo();
    if(!p){ p=document.createElement('div'); p.className='tc-glass-panel'; p.innerHTML='<div class="tc-glass-head"><span class="tc-glass-dot"></span><b data-k="name">ALVO</b><button class="tc-glass-close" aria-label="Fechar">×</button></div><div class="tc-glass-body"><div class="tc-g-line"><span>COORDENADAS</span><b data-k="coords"></b></div><div class="tc-g-line"><span>LOCAL / RUA</span><b data-k="addr"></b></div><div class="tc-g-line"><span>MOVIMENTO</span><b data-k="mov"></b></div><div class="tc-g-line"><span>BAIRRO / ZONA</span><b data-k="zona"></b></div><div class="tc-g-line"><span>CIDADE</span><b data-k="cidade"></b></div><div class="tc-g-line"><span>PAÍS</span><b data-k="pais"></b></div><div class="tc-g-line"><span>ATUALIZADO</span><b data-k="upd"></b></div><div class="tc-g-mini"><div><span>BAT</span><b data-k="bat"></b></div><div><span>PREC</span><b data-k="acc"></b></div><div><span>EST</span><b data-k="st"></b></div></div></div>';
      mapContainer.appendChild(p); p.querySelector('.tc-glass-close').addEventListener('click',function(){ p.classList.remove('open'); try{stopPanelAutoScroll();}catch(_){} try{updateLeader();}catch(_){} });
      requestAnimationFrame(function(){ p.classList.add('open'); }); try{ tcCinematicOpen(); }catch(_){}
      tcTypeInto(p.querySelector('[data-k=name]'), info.name);
      setTimeout(function(){ tcTypeInto(p.querySelector('[data-k=coords]'), info.coords); },140);
      setTimeout(function(){ tcTypeInto(p.querySelector('[data-k=addr]'), info.addr); },320);
      setTimeout(function(){ tcTypeInto(p.querySelector('[data-k=mov]'), info.mov); },400);
      setTimeout(function(){ tcTypeInto(p.querySelector('[data-k=zona]'), info.zona); },480);
      setTimeout(function(){ tcTypeInto(p.querySelector('[data-k=cidade]'), info.cidade); },540);
      setTimeout(function(){ tcTypeInto(p.querySelector('[data-k=pais]'), info.pais); },640);
      setTimeout(function(){ const u=p.querySelector('[data-k=upd]'); if(u) u.textContent=info.upd; },700);
      setTimeout(function(){ tcTypeInto(p.querySelector('[data-k=bat]'), info.bat); },760);
      setTimeout(function(){ tcTypeInto(p.querySelector('[data-k=acc]'), info.acc); },860);
      setTimeout(function(){ tcTypeInto(p.querySelector('[data-k=st]'), info.st); },960);
    } else { if(!p.classList.contains('open')){ p.classList.add('open'); try{ tcCinematicOpen(); }catch(_){} } updateGlassPanel(); } }
  function updateGlassPanel(){ if(!mapContainer) return; const p=mapContainer.querySelector('.tc-glass-panel'); if(!p||!p.classList.contains('open')) return; const info=tcGlassInfo();
    tcTypeInto(p.querySelector('[data-k=coords]'), info.coords); tcTypeInto(p.querySelector('[data-k=addr]'), info.addr);
    const sset=function(k,v){ const el=p.querySelector('[data-k='+k+']'); if(el) el.textContent=v; }; sset('mov',info.mov); sset('zona',info.zona); sset('cidade',info.cidade); sset('pais',info.pais);
    const bat=p.querySelector('[data-k=bat]'); if(bat) bat.textContent=info.bat; const st=p.querySelector('[data-k=st]'); if(st) st.textContent=info.st; const upd=p.querySelector('[data-k=upd]'); if(upd) upd.textContent=info.upd; }
  window.TC_MAP_SCIFI.panel = openGlassPanel; window.TC_MAP_SCIFI.updatePanel = updateGlassPanel;

  function init() {
    if (!window.L) {
      // O Leaflet ainda não carregou (ordem de scripts, rede lenta). Em vez de desistir
      // em silêncio, tenta de novo durante alguns segundos até o `L` estar disponível.
      if (leafletWaitTries < 40) {
        leafletWaitTries++;
        clearTimeout(leafletWaitTimer);
        leafletWaitTimer = setTimeout(init, 150);
      } else {
        const el0 = findContainer();
        if (el0 && !el0.querySelector('.leaflet-container') && !el0.querySelector('.map-provider-error')) {
          el0.innerHTML = '<div class="map-provider-error"><b>Mapa indisponível</b><span>Não foi possível carregar a biblioteca do mapa (Leaflet). Verifique a ligação à internet e recarregue a aplicação.</span></div>';
        }
      }
      return;
    }
    leafletWaitTries = 0;
    clearTimeout(leafletWaitTimer);
    const el = findContainer();
    if (!el) {
      // O Guardian saiu da tela do mapa: liberta a instância antiga (evita fuga de memória).
      if (map && mapContainer && !document.body.contains(mapContainer)) destroyMap();
      return;
    }

    // Guardian re-renders the page when switching tabs/settings. That replaces
    // #map with a new DOM node. A Leaflet instance cannot remain attached to
    // the old node, otherwise the map appears once and then disappears.
    if (map && mapContainer !== el) {
      destroyMap();
    }
    if (map) {
      map.invalidateSize(false);
      return;
    }

    mapContainer = el;
    const token = ++initToken;
    // Abre já centrado na ÚLTIMA localização conhecida da criança (se houver), para o
    // mapa não começar noutro sítio e depois "saltar" para o ponto.
    try {
      const _sv = lastKnownLocation || JSON.parse(localStorage.getItem('tc:lastKnownLocation') || 'null');
      if (_sv && Number.isFinite(Number(_sv.lat)) && Number.isFinite(Number(_sv.lng))) lastKnownLocation = { lat:Number(_sv.lat), lng:Number(_sv.lng), accuracy:Number(_sv.accuracy)||60 };
    } catch(_){}
    const _startCenter = lastKnownLocation ? [lastKnownLocation.lat, lastKnownLocation.lng] : DEFAULT;
    const _startZoom = lastKnownLocation ? 17 : 13;
    // maxZoom 21: com tiles Google o satélite tem a MESMA qualidade/aproximação do Google Maps.
    map = window.L.map(el, { zoomControl: true, attributionControl: false, preferCanvas: true, minZoom: 3, maxZoom: 21, zoomSnap: 1, zoomDelta: 1, wheelDebounceTime: 40, wheelPxPerZoomLevel: 120 }).setView(_startCenter, _startZoom);
    const BLANK_TILE0 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    roadLayer = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxNativeZoom: 19,
      maxZoom: 21,
      noWrap: true,
      updateWhenZooming: false,
      updateWhenIdle: true,
      keepBuffer: 3,
      errorTileUrl: BLANK_TILE0,
      attribution: '&copy; OpenStreetMap contributors'
    });
    // Tile transparente (1x1 PNG) usado quando um tile de satélite não existe: em vez
    // do texto "Map data not yet available", fica apenas o fundo escuro do mapa.
    const BLANK_TILE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    // Satélite com qualidade/aproximação do Google Maps (tiles Google, até zoom ~20).
    // Mantemos o Esri como alternativa automática caso o Google falhe.
    satelliteLayer = window.L.tileLayer('https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      subdomains: ['0','1','2','3'],
      maxNativeZoom: 20,
      maxZoom: 21,
      updateWhenZooming: false,
      updateWhenIdle: true,
      keepBuffer: 4,
      errorTileUrl: BLANK_TILE,
      attribution: '&copy; Google'
    });
    // Modo híbrido Google (satélite + ruas + nomes), igual ao híbrido do Google Maps.
    hybridLabels = window.L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
      subdomains: ['0','1','2','3'], maxNativeZoom: 20, maxZoom: 21, errorTileUrl: BLANK_TILE, updateWhenZooming: false, updateWhenIdle: true, keepBuffer: 4, attribution: '&copy; Google'
    });
    // Alternativa Esri (usada só se os tiles do Google falharem repetidamente).
    esriSatLayer = window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxNativeZoom: 17, maxZoom: 21, updateWhenZooming: false, updateWhenIdle: true, keepBuffer: 4, errorTileUrl: BLANK_TILE, attribution: '&copy; Esri'
    });
    // Rótulos Esri (só usados sobre o satélite Esri de alternativa).
    labelsLayer = window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
      maxNativeZoom: 17, maxZoom: 21, errorTileUrl: BLANK_TILE, updateWhenZooming: false, updateWhenIdle: true, keepBuffer: 3, pane: 'overlayPane', attribution: '&copy; Esri'
    });
    transportLayer = window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', {
      maxNativeZoom: 17, maxZoom: 21, errorTileUrl: BLANK_TILE, updateWhenZooming: false, updateWhenIdle: true, keepBuffer: 3, pane: 'overlayPane', attribution: '&copy; Esri'
    });
    fallbackRoadLayer = window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      maxNativeZoom: 19, maxZoom: 21, errorTileUrl: BLANK_TILE0, updateWhenZooming: false, updateWhenIdle: true, keepBuffer: 3, attribution: '&copy; Esri'
    });
    // Se os tiles de satélite do Google falharem muitas vezes, passa a usar o Esri.
    let satErrors = 0;
    const onSatErr = () => { satErrors++; if (satErrors >= 6 && !useFallbackSat) { useFallbackSat = true; if (map && (currentType === 'satellite' || currentType === 'hybrid')) { try { updateLayers(); } catch (_) {} } } };
    satelliteLayer.on('tileerror', onSatErr);
    hybridLabels.on('tileerror', onSatErr);
    // If OSM tiles fail repeatedly, switch only the road base to Esri instead of
    // destroying the Leaflet instance. This keeps the map usable during provider hiccups.
    let roadErrors = 0;
    roadLayer.on('tileerror', () => {
      roadErrors++;
      if (roadErrors >= 4 && !useFallbackRoad) {
        useFallbackRoad = true;
        if (map && currentType === 'roadmap') { try { updateLayers(); } catch (_) {} }
      }
    });
    roadLayer.addTo(map);
    map.on('resize', () => { if (!map) return; map.invalidateSize(false); updateGrid(); restoreLastKnownLocation(); });
    map.on('zoomend', () => { updateGrid(); restoreLastKnownLocation(); term('zoom',1500,'ZOOM', `ZOOM_${map.getZoom().toFixed(2)}`, 'OK', {detail:`Zoom ${map.getZoom().toFixed(2)}`}); });
    map.on('moveend', () => { updateGrid(); restoreLastKnownLocation(); term('move',1500,'MAPA', 'MOVIMENTO_CONCLUÍDO', 'OK', {detail:`Centro ${map.getCenter().lat.toFixed(6)}, ${map.getCenter().lng.toFixed(6)}`}); });
    map.on('click', (e) => { term('click',400,'CLICK', 'CLIQUE_NO_MAPA', 'OK', {detail:`${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`}); });
    // O utilizador pode mover/aproximar o mapa com os dedos. Quando o faz, deixamos de
    // recentrar automaticamente durante uns segundos, para o mapa não "fugir" da mão.
    map.on('dragstart zoomstart', () => { tcUserMovedAt = Date.now(); });
    map.whenReady(() => {
      if (token !== initToken || !map) return;
      [60,180,400,800].forEach(ms => setTimeout(() => { try { if (token === initToken && map && mapContainer === el) map.invalidateSize(false); } catch (_) {} }, ms));
    });

    try {
      const saved = JSON.parse(localStorage.getItem('tc:lastKnownLocation') || 'null');
      if (saved && Number.isFinite(Number(saved.lat)) && Number.isFinite(Number(saved.lng))) lastKnownLocation = {lat:Number(saved.lat),lng:Number(saved.lng),accuracy:Number(saved.accuracy)||60};
    } catch(e) {}
    marker = window.L.marker(DEFAULT, { icon: icon(), opacity: 0, zIndexOffset: 3000, keyboard: false }).addTo(map);
    restoreLastKnownLocation();
    // Exact-coordinate HUD stays inside the map and updates with every live point.
    let coordHud = el.querySelector('.tc-exact-coordinate-hud');
    if (!coordHud) {
      coordHud = document.createElement('div');
      coordHud.className = 'tc-exact-coordinate-hud';
      coordHud.innerHTML = '<span class="tc-coord-label">COORDENADAS EXATAS</span><strong>—</strong><small>aguardando localização</small>';
      el.appendChild(coordHud);
    }
    // HUD de ficção científica (não substitui o mapa; desenha por cima)
    let scifiHud = el.querySelector('.tc-scifi-hud');
    if (!scifiHud) {
      scifiHud = document.createElement('div');
      scifiHud.className = 'tc-scifi-hud tc-scanning';
      scifiHud.innerHTML = '<div class="tc-sf-vignette"></div><div class="tc-sf-globe"><i class="gr gr1"></i><i class="gr gr2"></i><i class="gr gr3"></i></div><div class="tc-scifi-corner tl"></div><div class="tc-scifi-corner tr"></div><div class="tc-scifi-corner bl"></div><div class="tc-scifi-corner br"></div>'+'<div class="tc-sf-beam top"></div><div class="tc-sf-beam bot"></div><div class="tc-sf-ring ring-top"></div><div class="tc-sf-ring ring-bot"></div>'+'<div class="tc-scifi-radar"></div><div class="tc-scifi-scan"></div>'+'<div class="tc-sf-binary left">1010110100 0110101 10110 01001010 11010<br>1010110100 0110101 10110 01001010 11010<br>1010110100 0110101 10110 01001010 11010</div><div class="tc-sf-binary right">1010110100 0110101 10110 01001010 11010<br>1010110100 0110101 10110 01001010 11010<br>1010110100 0110101 10110 01001010 11010</div>'+'<div class="tc-sf-gauges"><svg viewBox="0 0 40 40"><circle class="g-bg" cx="20" cy="20" r="15"/><circle class="g-fg a" cx="20" cy="20" r="15"/></svg><svg viewBox="0 0 40 40"><circle class="g-bg" cx="20" cy="20" r="15"/><circle class="g-fg b" cx="20" cy="20" r="15"/></svg></div>'+'<div class="tc-sf-bars"><i></i><i></i><i></i><i></i><i></i></div>'+'<div class="tc-sf-grid"><div><span>BAT</span><b data-g="bat">—</b></div><div><span>PREC</span><b data-g="acc">—</b></div><div><span>SINAL</span><b data-g="sig">—</b></div><div><span>ATU</span><b data-g="upd">—</b></div></div>'+'<svg class="tc-sf-leader" preserveAspectRatio="none"><defs><linearGradient id="tcLeadG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff3b3b"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs><line x1="0" y1="0" x2="0" y2="0" stroke="url(#tcLeadG)" stroke-width="1.5" stroke-dasharray="4 4"/></svg>'+'<div class="tc-sf-blip"><span class="b1"></span><span class="b2"></span><span class="b3"></span></div>'+'<div class="tc-scifi-status"><i></i><span>A PROCURAR ALVO…</span></div>'+'<div class="tc-scifi-reticle"><div class="r1"></div><div class="r2"></div><div class="r3"></div><div class="rx"></div><div class="ry"></div></div>';
      el.appendChild(scifiHud);
      try { tcScanSweep(); } catch (_) {}
    }
    try { map.on('move zoom moveend zoomend resize', positionReticle); } catch (_) {}
    try { map.on('resize zoomend moveend', function(){ sizeGlobe(); }); } catch (_) {}
    sizeGlobe();
    if(!window.__tcGlobeResize){ window.__tcGlobeResize=1; window.addEventListener('resize', function(){ try{ sizeGlobe(); }catch(_){} }); }
    accuracyCircle = window.L.circle(DEFAULT, {
      radius: 60,
      weight: 1,
      opacity: 0,
      fillOpacity: 0
    }).addTo(map);

    // Only change layers after ALL location objects exist.
    // This prevents the first render/resize event from calling setLatLng on null.
    updateLayers();
    restoreLastKnownLocation();
    // Repõe o ponto azul do Guardião (persistido), para não desaparecer ao mudar de aba.
    restoreSelfMarker();
  }

  function updateGrid() {
    // Coordinate grid lines are intentionally disabled. Exact coordinates are
    // shown in the HUD and terminal without drawing lines over the map.
    if (gridLayer && map && map.hasLayer(gridLayer)) { try { map.removeLayer(gridLayer); } catch (_) {} }
    gridLayer = null;
  }

  function restoreLastKnownLocation() {
    if (!map || !lastKnownLocation) return;
    const {lat,lng,accuracy=60}=lastKnownLocation;
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return;
    const pos=[Number(lat),Number(lng)];

    // Leaflet objects can temporarily be absent while Guardian replaces #map.
    // Never let a missing marker/circle break the entire map.
    if (!marker) {
      try { marker = window.L.marker(pos, { icon: icon(), opacity: 1, zIndexOffset: 3000, keyboard: false }).addTo(map); } catch(e) { return; }
    } else {
      try { marker.setLatLng(pos).setOpacity(1).setZIndexOffset(3000); } catch(e) {}
    }
    try { if (typeof marker.bringToFront === "function") marker.bringToFront(); } catch(e) {}

    if (!accuracyCircle) {
      try { accuracyCircle = window.L.circle(pos, { radius:Number(accuracy)||60, weight:1, opacity:.55, fillOpacity:.06 }).addTo(map); } catch(e) {}
    } else {
      try { accuracyCircle.setLatLng(pos).setRadius(Number(accuracy)||60).setStyle({opacity:.55,fillOpacity:.06}); } catch(e) {}
    }
    const hud=mapContainer && mapContainer.querySelector('.tc-exact-coordinate-hud');
    if(hud){ const strong=hud.querySelector('strong'); if(strong) strong.textContent=Number(lat).toFixed(6)+'°, '+Number(lng).toFixed(6)+'°'; }
  }

  function updateLayers() {
    if (!map || !roadLayer || !satelliteLayer || !hybridLabels) return;
    [roadLayer, fallbackRoadLayer, satelliteLayer, hybridLabels, esriSatLayer, labelsLayer, transportLayer].forEach(layer => { if (layer && map.hasLayer(layer)) map.removeLayer(layer); });
    if (currentType === 'satellite') {
      if (useFallbackSat && esriSatLayer) { esriSatLayer.addTo(map); if(transportLayer) transportLayer.addTo(map); if(labelsLayer) labelsLayer.addTo(map); }
      else { satelliteLayer.addTo(map); } // Google satélite já é de alta resolução
    }
    else if (currentType === 'hybrid') {
      if (useFallbackSat && esriSatLayer) { esriSatLayer.addTo(map); if(transportLayer) transportLayer.addTo(map); if(labelsLayer) labelsLayer.addTo(map); }
      else { hybridLabels.addTo(map); } // Google híbrido (satélite + ruas + nomes)
    }
    else { (useFallbackRoad && fallbackRoadLayer ? fallbackRoadLayer : roadLayer).addTo(map); }
    restoreLastKnownLocation();
    updateGrid();
    try { if (marker && typeof marker.bringToFront === 'function') marker.bringToFront(); } catch (_) {}

  }

  window.TC_MAP = {
    init,
    refresh() {
      init();
      if (map) {
        [0,80,250,600].forEach(ms => setTimeout(() => { try { if (map) map.invalidateSize(false); } catch (_) {} }, ms));
      }
    },
    setType(type) {
      currentType = ['roadmap','satellite','hybrid'].includes(type) ? type : 'roadmap';
      if (!map) init();
      if (map) {
        updateLayers();
        requestAnimationFrame(() => { try { map.invalidateSize(false); } catch (_) {} });
      }
    },
    showTrail(points) {
      if (!map) init();
      if (!map || !window.L || !Array.isArray(points)) { this.clearTrail(); return; }
      const latlngs = points.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng)).map(p => [p.lat, p.lng]);
      if (latlngs.length < 2) { this.clearTrail(); return; }
      if (this._trail) { try { map.removeLayer(this._trail); } catch (_) {} }
      this._trail = window.L.polyline(latlngs, { color: '#38bdf8', weight: 4, opacity: .85, dashArray: '1,9', lineCap: 'round' }).addTo(map);
      try { map.fitBounds(this._trail.getBounds(), { padding: [40, 40], maxZoom: 17 }); } catch (_) {}
    },
    clearTrail() {
      if (this._trail && map) { try { map.removeLayer(this._trail); } catch (_) {} this._trail = null; }
    },
    // Marca no mapa onde a CRIANÇA estava nos momentos de contacto (chamadas/SMS)
    // com um número. Usa apenas o histórico de localização do próprio dispositivo.
    showContactPoints(points, label) {
      if (!map) init();
      if (!map || !window.L || !Array.isArray(points) || !points.length) { this.clearContactPoints(); return; }
      this.clearContactPoints();
      const grp = window.L.layerGroup();
      const latlngs = [];
      points.forEach((p) => {
        if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return;
        latlngs.push([p.lat, p.lng]);
        let when = ''; try { when = new Date(p.time).toLocaleString('pt-PT'); } catch (_) {}
        const cm = window.L.circleMarker([p.lat, p.lng], { radius: 8, color: '#ffffff', weight: 2, fillColor: '#ffb020', fillOpacity: .9, zIndexOffset: 5000 });
        const ttl = (label ? ('<b>' + label + '</b><br>') : '') + (p.kind || 'Contacto') + (p.dir ? (' · ' + p.dir) : '') + '<br>' + when;
        cm.bindPopup(ttl);
        cm.addTo(grp);
      });
      grp.addTo(map);
      this._contactLayer = grp;
      try {
        if (latlngs.length === 1) { map.setView(latlngs[0], Math.max(map.getZoom() || 0, 15), { animate: true, duration: .6 }); }
        else { map.fitBounds(window.L.latLngBounds(latlngs), { padding: [50, 50], maxZoom: 17, animate: true, duration: .6 }); }
      } catch (_) {}
    },
    clearContactPoints() {
      if (this._contactLayer && map) { try { map.removeLayer(this._contactLayer); } catch (_) {} }
      this._contactLayer = null;
    },
    setLocation(lat, lng, accuracy = 60, follow = true) {
      if (!map) init();
      if (!map || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const pos = [lat, lng];
      hasLiveLocation = true;
      if (!window.__tcAutoHybrid) { window.__tcAutoHybrid = true; currentType = 'hybrid'; try { updateLayers(); } catch(_){} }
      try { tcUpdateMovement(lat, lng, accuracy); } catch(_) {}
      lastKnownLocation = {lat, lng, accuracy: Number(accuracy)||60};
      term('loc',2000,'LOCALIZAÇÃO', 'ATUALIZACAO_DISPOSITIVO', 'OK', {detail:`${(window.TC_DEVICE_NAME||'Child')} · ${lat.toFixed(6)}, ${lng.toFixed(6)}`, contact:(window.TC_DEVICE_NAME||'Child')});
      try { localStorage.setItem('tc:lastKnownLocation', JSON.stringify(lastKnownLocation)); } catch(e) {}
      reverseGeocode(lat, lng);
      if (!marker) { try { marker = window.L.marker(pos, { icon: icon(), opacity: 1, zIndexOffset: 3000, keyboard: false }).addTo(map); } catch(e) { return; } }
      marker.setLatLng(pos).setOpacity(1).setZIndexOffset(2000);
      if (typeof marker.bringToFront === "function") marker.bringToFront();
      const hud = mapContainer && mapContainer.querySelector('.tc-exact-coordinate-hud');
      if (hud) {
        const strong = hud.querySelector('strong');
        const small = hud.querySelector('small');
        if (strong) strong.textContent = lat.toFixed(6) + '°, ' + lng.toFixed(6) + '°';
        if (small) small.textContent = '✓ Localizado · ' + (areaName || 'a obter endereço…');
        if (window.refreshLocationTerminalUI) window.refreshLocationTerminalUI();
      }
      if (!accuracyCircle) { try { accuracyCircle = window.L.circle(pos, { radius:Number(accuracy)||60, weight:1, opacity:.8, fillOpacity:.08 }).addTo(map); } catch(e) {} }
      else { accuracyCircle.setLatLng(pos).setRadius(Number(accuracy) || 60).setStyle({opacity:.8, fillOpacity:.08}); }
      // Do not draw a route/trail over the map. Keep only the live/last-known marker.
      if (window.refreshLocationTerminalUI) window.refreshLocationTerminalUI();
      // Se o utilizador mexeu no mapa há pouco (arrastar/zoom com os dedos), respeitamos a
      // vista dele por uns segundos; caso contrário, o mapa fica SEMPRE travado na última
      // localização da criança (não "salta" para fora ao atualizar).
      const userBusy = (Date.now() - tcUserMovedAt) < 25000;
      if (follow && !tcAcquired && !tcAcquiring) {
        tcAcquire(lat, lng); // 1.ª aquisição (UMA vez): ponto vermelho + rotação + zoom de ~10s
      } else if (!tcAcquiring) {
        // Já adquirido uma vez: o marcador move-se em TEMPO REAL, mas o mapa NÃO volta a
        // recentrar nem a dar zoom a cada atualização (era isso que estava a "saltar" e a
        // atrapalhar). Só traz o alvo de volta — suavemente e SEM mudar o zoom — se ele sair
        // da área visível, e nunca enquanto o utilizador está a mexer no mapa.
        if (!userBusy) {
          try {
            const b = map.getBounds && map.getBounds();
            if (b && !b.pad(-0.18).contains(pos)) { map.panTo(pos, { animate: true, duration: 0.6 }); }
          } catch(_) {}
        }
        // Atualiza apenas o HUD/retículo a acompanhar o marcador, sem repetir a animação cinemática.
        try { positionReticle(); updateGrid(); updateGlassPanel(); } catch (_) {}
      }
      if (follow) {
        if (marker && typeof marker.bringToFront === "function") setTimeout(() => marker.bringToFront(), 1200);
        setTimeout(() => { if (map) map.invalidateSize(false); }, 120);
      }
      // Não travar durante a sequência cinemática (deixa o zoom de ~10s terminar);
      // só trava de imediato quando não há aquisição em curso nem já adquirida (ex.: restauro).
      try { positionReticle(); if (!tcAcquiring && !tcAcquired) scifiLock(); } catch (_) {}
    },
    clearLocation() {
      // Keep the last known point visible. Offline/temporary loss must not erase it.
      hasLiveLocation = false;
      if (lastKnownLocation) restoreLastKnownLocation();
      if (accuracyCircle) accuracyCircle.setStyle({opacity:0, fillOpacity:0});
      if (this._line && map) { try { map.removeLayer(this._line); } catch (_) {} this._line = null; }
      trail = [];
    },
    reset() {
      // Chamado no logout: nenhuma localização do Child fica guardada neste navegador.
      lastKnownLocation = null; hasLiveLocation = false; areaName = ''; lastGeocodeKey = ''; tcAcquired = false; tcAcquiring = false; tcMoveRef = null; tcMovementStr = '';
      lastSelfLocation = null; try { localStorage.removeItem('tc:selfLocation'); } catch(_){}
      try { if (selfMarker && map) map.removeLayer(selfMarker); } catch(_){} selfMarker = null;
      try { localStorage.removeItem('tc:lastKnownLocation'); } catch (e) {}
      try { if (marker) marker.setOpacity(0); } catch (e) {}
      try { if (accuracyCircle) accuracyCircle.setStyle({opacity:0, fillOpacity:0}); } catch (e) {}
      try { if (pulseMarker && map) map.removeLayer(pulseMarker); pulseMarker = null; } catch (e) {}
      try { stopPanelAutoScroll(); if(window.__tcGridTimer){ clearInterval(window.__tcGridTimer); window.__tcGridTimer=null; } const sc=mapContainer&&mapContainer.querySelector('.tc-scifi-hud'); if(sc){ sc.classList.remove('tc-clean','tc-locked'); const dk=sc.querySelector('.tc-photo-deck'); if(dk) dk.parentNode.removeChild(dk); const md=mapContainer.querySelector('.tc-photo-modal'); if(md) md.parentNode.removeChild(md); const gp=sc.parentNode&&sc.parentNode.querySelector('.tc-glass-panel'); if(gp) gp.classList.remove('open'); } } catch (e) {}
    },
    // Ponto AZUL do próprio Guardião (pai/mãe), para ver que está perto da criança.
    setSelfLocation(lat, lng) {
      if (!map) init();
      if (!map || !window.L || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
      // Guarda a última posição do Guardião para o ponto azul NÃO desaparecer quando a
      // página é re-renderizada (o mapa é recriado) nem entre leituras do GPS.
      lastSelfLocation = { lat: Number(lat), lng: Number(lng) };
      try { localStorage.setItem('tc:selfLocation', JSON.stringify(lastSelfLocation)); } catch(_){}
      drawSelfMarker(lat, lng);
      // Distância Guardião ↔ criança (para o painel/terminal).
      try {
        if (lastKnownLocation && typeof tcHaversine === 'function') {
          window.TC_SELF_DISTANCE_M = Math.round(tcHaversine({lat:lat,lng:lng}, {lat:lastKnownLocation.lat,lng:lastKnownLocation.lng}));
          if (window.refreshLocationTerminalUI) window.refreshLocationTerminalUI();
        }
      } catch(_) {}
    },
    clearSelf() { try { if (selfMarker && map) map.removeLayer(selfMarker); } catch(_){} selfMarker = null; lastSelfLocation = null; try{localStorage.removeItem('tc:selfLocation');}catch(_){} window.TC_SELF_DISTANCE_M = null; },
    isLocationLive() { return hasLiveLocation; },
    locateUser() {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        p => this.setLocation(p.coords.latitude, p.coords.longitude, p.coords.accuracy, true),
        () => {},
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      );
    }
  };

  // Guardian re-renders portions of the dashboard frequently. A synchronous
  // MutationObserver callback used to re-enter Leaflet during every DOM change,
  // causing visible stalls and repeated map initialization. Debounce it so a
  // burst of UI changes produces only one lightweight size/init pass.
  let observerTimer = null;
  const observer = new MutationObserver((records) => {
    // Ignora mutações feitas pelo próprio Leaflet (tiles, marcador, HUD): só reage
    // quando o Guardian redesenha a página fora do contentor do mapa.
    const relevant = records.some(r => {
      const t = r.target && r.target.nodeType === 1 ? r.target : (r.target && r.target.parentElement);
      return !(t && t.closest && t.closest('.leaflet-container'));
    });
    if (!relevant) return;
    clearTimeout(observerTimer);
    observerTimer = setTimeout(() => {
      if (document.visibilityState !== 'hidden') init();
    }, 80);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  // Lazy initialization: the map is created only when the Guardian enters
  // Visão Geral or Localização. It must never open during login/startup.

})();
