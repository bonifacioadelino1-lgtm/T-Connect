// T-Connect Child — Jogo de Frutas (match-3 estilo "candy") com níveis.
// Sem dependências nem imagens (emojis). Trocar por TOQUE (toca numa fruta e
// depois na vizinha) ou por ARRASTO (arrasta uma fruta sobre a vizinha).
// Alinhar 3+ iguais rebenta; há cascata, pontos, objetivo e jogadas limitadas.
// Dificuldades: Fácil, Difícil, Mais difícil — cada uma com níveis 1 → ∞.
(function () {
  "use strict";

  var FRUITS = ["🍎", "🍊", "🍋", "🍇", "🍉", "🍓", "🍈", "🍑"];
  // Cada dificuldade: nº de cores, grelha (quadrada), jogadas e objetivo.
  var DIFF = {
    facil:   { key: "facil",   label: "Fácil",        colors: 4, n: 7, moves: 28, base: 600,  per: 200 },
    dificil: { key: "dificil", label: "Difícil",      colors: 5, n: 8, moves: 22, base: 900,  per: 300 },
    insano:  { key: "insano",  label: "Mais difícil", colors: 6, n: 9, moves: 18, base: 1200, per: 400 }
  };

  var G = null;

  // ---------- persistência (nível alcançado por dificuldade) ----------
  function lvlKey(d) { return "tc_fruit_level_" + d; }
  function loadLevel(d) { try { return Math.max(1, parseInt(localStorage.getItem(lvlKey(d)) || "1", 10) || 1); } catch (_) { return 1; } }
  function saveLevel(d, v) { try { localStorage.setItem(lvlKey(d), String(v)); } catch (_) {} }
  function targetFor(cfg, level) { return cfg.base + (level - 1) * cfg.per; }

  // ---------- grelha ----------
  function palette() { return FRUITS.slice(0, G.cfg.colors); }
  function rnd() { var p = palette(); return p[(Math.random() * p.length) | 0]; }
  function idx(r, c) { return r * G.n + c; }

  function freshGrid() {
    var N = G.n, g = new Array(N * N);
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
      var f;
      do { f = rnd(); } while (
        (c >= 2 && g[r * N + c - 1] === f && g[r * N + c - 2] === f) ||
        (r >= 2 && g[(r - 1) * N + c] === f && g[(r - 2) * N + c] === f)
      );
      g[r * N + c] = f;
    }
    return g;
  }

  function findMatches(g) {
    var N = G.n, hit = {};
    for (var r = 0; r < N; r++) { var run = 1; for (var c = 1; c <= N; c++) { if (c < N && g[r * N + c] && g[r * N + c] === g[r * N + c - 1]) run++; else { if (run >= 3) for (var k = 1; k <= run; k++) hit[r * N + c - k] = 1; run = 1; } } }
    for (var c2 = 0; c2 < N; c2++) { var run2 = 1; for (var r2 = 1; r2 <= N; r2++) { if (r2 < N && g[r2 * N + c2] && g[r2 * N + c2] === g[(r2 - 1) * N + c2]) run2++; else { if (run2 >= 3) for (var k2 = 1; k2 <= run2; k2++) hit[(r2 - k2) * N + c2] = 1; run2 = 1; } } }
    return Object.keys(hit).map(Number);
  }

  function hasMove(g) {
    var N = G.n;
    function sw(a, i, j) { var t = a[i]; a[i] = a[j]; a[j] = t; }
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
      if (c + 1 < N) { sw(g, r * N + c, r * N + c + 1); var m = findMatches(g).length; sw(g, r * N + c, r * N + c + 1); if (m) return true; }
      if (r + 1 < N) { sw(g, r * N + c, (r + 1) * N + c); var m2 = findMatches(g).length; sw(g, r * N + c, (r + 1) * N + c); if (m2) return true; }
    }
    return false;
  }
  function ensurePlayable(g) { var t = 0; while (!hasMove(g) && t < 50) { var ng = freshGrid(); for (var i = 0; i < g.length; i++) g[i] = ng[i]; t++; } }

  function collapse(g) {
    var N = G.n;
    for (var c = 0; c < N; c++) {
      var col = [];
      for (var r = N - 1; r >= 0; r--) if (g[r * N + c] != null) col.push(g[r * N + c]);
      for (var r2 = N - 1, k = 0; r2 >= 0; r2--, k++) g[r2 * N + c] = (k < col.length) ? col[k] : rnd();
    }
  }
  function burst() { try { if (navigator.vibrate) navigator.vibrate(16); } catch (_) {} }

  // ---------- som (Web Audio, sem ficheiros) ----------
  var AC = null;
  function muted() { try { return localStorage.getItem("tc_fruit_mute") === "1"; } catch (_) { return false; } }
  function setMuted(v) { try { localStorage.setItem("tc_fruit_mute", v ? "1" : "0"); } catch (_) {} }
  function ensureAudio() {
    try {
      if (!AC) { var C = window.AudioContext || window.webkitAudioContext; if (C) AC = new C(); }
      if (AC && AC.state === "suspended") AC.resume();
    } catch (_) {}
    return AC;
  }
  function beep(freq, dur, type, vol, when) {
    if (muted()) return;
    var c = ensureAudio(); if (!c) return;
    try {
      var t = c.currentTime + (when || 0);
      var o = c.createOscillator(), g = c.createGain();
      o.type = type || "sine"; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.08, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.12));
      o.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + (dur || 0.12) + 0.03);
    } catch (_) {}
  }
  function sfxTap() { beep(430, 0.05, "triangle", 0.045); }
  function sfxSwap() { beep(540, 0.06, "sine", 0.06); beep(700, 0.06, "sine", 0.05, 0.04); }
  function sfxInvalid() { beep(200, 0.12, "sawtooth", 0.05); beep(150, 0.14, "sawtooth", 0.045, 0.08); }
  function sfxPop(chain) { var base = 520 + Math.min(chain || 0, 6) * 85; beep(base, 0.09, "triangle", 0.07); beep(base * 1.5, 0.08, "sine", 0.05, 0.045); }
  function sfxWin() {[523, 659, 784, 1047].forEach(function (f, i) { beep(f, 0.18, "triangle", 0.08, i * 0.12); }); }
  function sfxLose() {[392, 330, 262].forEach(function (f, i) { beep(f, 0.22, "sawtooth", 0.06, i * 0.14); }); }

  // ---------- resolução de cascatas ----------
  function resolve(after) {
    var m = findMatches(G.grid);
    if (!m.length) { G.busy = false; ensurePlayable(G.grid); renderBoard(); checkEnd(); if (after) after(); return; }
    G.busy = true; G.popping = {};
    m.forEach(function (i) { G.popping[i] = 1; });
    G.score += m.length * 10;
    // Conta APENAS as frutas-alvo (as que estão por cima) para o objetivo do nível.
    m.forEach(function (i) {
      var f = G.grid[i];
      for (var k = 0; k < (G.targets || []).length; k++) {
        if (G.targets[k].fruit === f && G.targets[k].got < G.targets[k].need) { G.targets[k].got++; break; }
      }
    });
    G.cascade = (G.cascade || 0) + 1;
    burst(); try { sfxPop(G.cascade); } catch (_) {}
    renderBoard(); renderHud();
    setTimeout(function () {
      m.forEach(function (i) { G.grid[i] = null; });
      collapse(G.grid); G.popping = {}; renderBoard();
      setTimeout(function () { resolve(after); }, 130);
    }, 170);
  }

  function trySwap(a, b) {
    if (G.busy || G.phase !== "play") return;
    var ra = (a / G.n) | 0, ca = a % G.n, rb = (b / G.n) | 0, cb = b % G.n;
    if ((Math.abs(ra - rb) + Math.abs(ca - cb)) !== 1) return; // só vizinhas
    var t = G.grid[a]; G.grid[a] = G.grid[b]; G.grid[b] = t;
    if (findMatches(G.grid).length) {
      try { sfxSwap(); } catch (_) {}
      G.sel = null; G.movesLeft--; G.cascade = 0; renderHud(); renderBoard();
      resolve();
    } else {
      var t2 = G.grid[a]; G.grid[a] = G.grid[b]; G.grid[b] = t2; // desfaz
      try { sfxInvalid(); } catch (_) {}
      G.sel = null; renderBoard();
    }
  }

  function tap(i) {
    if (G.busy || G.phase !== "play") return;
    if (G.sel == null) { G.sel = i; renderBoard(); return; }
    if (G.sel === i) { G.sel = null; renderBoard(); return; }
    var r1 = (G.sel / G.n) | 0, c1 = G.sel % G.n, r2 = (i / G.n) | 0, c2 = i % G.n;
    if ((Math.abs(r1 - r2) + Math.abs(c1 - c2)) === 1) { trySwap(G.sel, i); }
    else { G.sel = i; renderBoard(); }
  }

  function targetsDone() { return (G.targets || []).length > 0 && G.targets.every(function (t) { return t.got >= t.need; }); }
  function checkEnd() {
    if (G.phase !== "play") return;
    if (targetsDone()) {
      G.phase = "win";
      var nxt = G.level + 1; if (nxt > loadLevel(G.cfg.key)) saveLevel(G.cfg.key, nxt);
      try { sfxWin(); } catch (_) {}
      renderAll();
    } else if (G.movesLeft <= 0) {
      G.phase = "lose";
      try { sfxLose(); } catch (_) {}
      renderAll();
    }
  }

  // ---------- render ----------
  function renderHud() {
    var h = G.host.querySelector("#fg-hud"); if (!h) return;
    var tg = (G.targets || []).map(function (t) {
      var left = Math.max(0, t.need - t.got), done = left === 0;
      return '<span class="fg-target' + (done ? ' fg-target-done' : '') + '"><i>' + t.fruit + '</i><b>' + (done ? '✓' : left) + '</b></span>';
    }).join("");
    h.innerHTML =
      '<div class="fg-targets"><small>APANHA ESTAS FRUTAS</small><div class="fg-target-row">' + tg + '</div></div>' +
      '<div class="fg-stat-row"><div class="fg-stat"><small>NÍVEL</small><b>' + G.level + '</b></div>' +
      '<div class="fg-stat"><small>JOGADAS</small><b>' + Math.max(0, G.movesLeft) + '</b></div>' +
      '<div class="fg-stat"><small>PONTOS</small><b>' + G.score + '</b></div></div>';
    var need = 0, got = 0; (G.targets || []).forEach(function (t) { need += t.need; got += Math.min(t.got, t.need); });
    var bar = G.host.querySelector("#fg-progress i");
    if (bar) bar.style.width = (need ? Math.min(100, Math.round(got / need * 100)) : 0) + "%";
  }

  function renderBoard() {
    var b = G.host.querySelector("#fg-board"); if (!b) return;
    b.style.setProperty("--fg-n", G.n);
    var html = "";
    for (var i = 0; i < G.n * G.n; i++) {
      var sel = (G.sel === i) ? " fg-sel" : "";
      var pop = G.popping[i] ? " fg-pop" : "";
      html += '<button class="fg-cell' + sel + pop + '" data-i="' + i + '">' + (G.grid[i] || "") + '</button>';
    }
    b.innerHTML = html;
  }

  function diffMenu() {
    var cards = Object.keys(DIFF).map(function (k) {
      var d = DIFF[k], lv = loadLevel(k);
      return '<button class="fg-diff" data-diff="' + k + '"><b>' + d.label + '</b>' +
        '<small>' + d.colors + ' frutas · grelha ' + d.n + '×' + d.n + '</small>' +
        '<span class="fg-diff-lv">Nível ' + lv + '</span></button>';
    }).join("");
    return '<div class="fg-menu"><div class="fg-menu-emoji">🍓🍊🍇</div><h2>Jogo de Frutas</h2>' +
      '<p>Combina 3 ou mais frutas iguais. Escolhe a dificuldade — cada uma tem níveis sem fim (1, 2, 3 … 100 … ∞).</p>' +
      '<div class="fg-diff-grid">' + cards + '</div></div>';
  }

  function endOverlay() {
    if (G.phase === "win") {
      return '<div class="fg-over"><div class="fg-over-card win"><div class="fg-over-emoji">🎉</div><h3>Nível ' + G.level + ' concluído!</h3>' +
        '<p>Apanhaste todas as frutas e fizeste <b>' + G.score + '</b> pontos.</p>' +
        '<button class="btn primary wide" data-act="next">Próximo nível (' + (G.level + 1) + ') →</button>' +
        '<button class="btn wide" data-act="menu">Menu</button></div></div>';
    }
    if (G.phase === "lose") {
      var falta = (G.targets || []).reduce(function (s, t) { return s + Math.max(0, t.need - t.got); }, 0);
      return '<div class="fg-over"><div class="fg-over-card lose"><div class="fg-over-emoji">😮</div><h3>Sem jogadas</h3>' +
        '<p>Faltaram ' + falta + ' fruta(s)-alvo. Tenta outra vez!</p>' +
        '<button class="btn primary wide" data-act="retry">Tentar de novo</button>' +
        '<button class="btn wide" data-act="menu">Menu</button></div></div>';
    }
    return "";
  }

  function renderAll() {
    if (!G || !G.host) return;
    if (G.phase === "menu") { G.host.innerHTML = diffMenu(); bindMenu(); return; }
    G.host.innerHTML =
      '<div class="fg-hud" id="fg-hud"></div>' +
      '<div class="fg-progress" id="fg-progress"><i></i></div>' +
      '<div class="fg-board" id="fg-board"></div>' +
      '<div class="fg-foot"><button class="fg-restart" data-act="restart">↻ Recomeçar nível</button>' +
      '<button class="fg-restart" data-act="mute">' + (muted() ? "🔇 Som" : "🔊 Som") + '</button>' +
      '<button class="fg-restart" data-act="menu">⟵ Menu</button></div>' +
      '<p class="fg-tip">Toca numa fruta e na vizinha, ou arrasta uma sobre a outra.</p>' +
      endOverlay();
    renderHud(); renderBoard(); bindPlay();
  }

  // ---------- eventos ----------
  function bindMenu() {
    G.host.querySelectorAll(".fg-diff").forEach(function (el) {
      el.addEventListener("click", function () { startDifficulty(el.getAttribute("data-diff")); });
    });
  }
  function bindPlay() {
    var b = G.host.querySelector("#fg-board");
    if (b) {
      b.addEventListener("pointerdown", onDown);
      b.addEventListener("pointerup", onUp);
      b.addEventListener("pointercancel", function () { G.drag = null; });
    }
    G.host.querySelectorAll("[data-act]").forEach(function (el) {
      el.addEventListener("click", function () {
        var a = el.getAttribute("data-act");
        if (a === "next") { startLevel(G.cfg.key, G.level + 1); }
        else if (a === "retry") { startLevel(G.cfg.key, G.level); }
        else if (a === "restart") { startLevel(G.cfg.key, G.level); }
        else if (a === "mute") { setMuted(!muted()); if (!muted()) { ensureAudio(); try { sfxTap(); } catch (_) {} } renderAll(); }
        else if (a === "menu") { G.phase = "menu"; renderAll(); }
      });
    });
  }
  function cellFromEvent(e) {
    var el = (e.target && e.target.closest) ? e.target.closest(".fg-cell") : null;
    if (!el) return -1;
    var i = parseInt(el.getAttribute("data-i"), 10);
    return isNaN(i) ? -1 : i;
  }
  function onDown(e) {
    ensureAudio(); // 1.º toque desbloqueia o som no Android
    if (G.busy || G.phase !== "play") return;
    var i = cellFromEvent(e); if (i < 0) return;
    try { sfxTap(); } catch (_) {}
    G.drag = { i: i, x: e.clientX, y: e.clientY, moved: false };
  }
  function onUp(e) {
    if (!G.drag) { var it = cellFromEvent(e); if (it >= 0) tap(it); return; }
    var d = G.drag; G.drag = null;
    var dx = e.clientX - d.x, dy = e.clientY - d.y;
    var ax = Math.abs(dx), ay = Math.abs(dy);
    var thr = 14;
    if (ax < thr && ay < thr) { tap(d.i); return; } // foi toque, não arrasto
    var r = (d.i / G.n) | 0, c = d.i % G.n, nr = r, nc = c;
    if (ax > ay) nc += (dx > 0 ? 1 : -1); else nr += (dy > 0 ? 1 : -1);
    if (nr < 0 || nc < 0 || nr >= G.n || nc >= G.n) { G.sel = null; renderBoard(); return; }
    G.sel = null;
    trySwap(d.i, nr * G.n + nc);
  }

  // ---------- objetivos (frutas-alvo que aparecem por cima) ----------
  // O nível só se GANHA apanhando as frutas mostradas por cima. As frutas normais
  // não contam para o objetivo (embora deem pontos de bónus).
  function buildTargets(cfg, level) {
    var pal = palette();
    var k = cfg.key === "facil" ? 1 : (cfg.key === "dificil" ? 2 : 3);
    k = Math.min(k, pal.length);
    var pool = pal.slice(), chosen = [];
    for (var i = 0; i < k && pool.length; i++) { chosen.push(pool.splice((Math.random() * pool.length) | 0, 1)[0]); }
    var base = cfg.key === "facil" ? 8 : (cfg.key === "dificil" ? 10 : 12);
    var per = cfg.key === "insano" ? 3 : 2;
    var need = base + (level - 1) * per;
    return chosen.map(function (f) { return { fruit: f, need: need, got: 0 }; });
  }
  // ---------- fluxo de jogo ----------
  function startDifficulty(key) { startLevel(key, loadLevel(key)); }
  function startLevel(key, level) {
    var cfg = DIFF[key] || DIFF.facil;
    level = Math.max(1, level | 0);
    G.cfg = cfg; G.n = cfg.n; G.level = level;
    G.movesLeft = cfg.moves;
    G.score = 0; G.cascade = 0; G.sel = null; G.busy = false; G.popping = {}; G.drag = null; G.phase = "play";
    G.targets = buildTargets(cfg, level);
    G.grid = freshGrid(); ensurePlayable(G.grid);
    renderAll();
  }

  function mount(host) {
    if (!host) return;
    G = { host: host, cfg: DIFF.facil, n: DIFF.facil.n, level: 1, movesLeft: 0, score: 0, targets: [], grid: [], sel: null, busy: false, popping: {}, drag: null, phase: "menu" };
    renderAll();
  }
  function unmount() { G = null; }

  window.TCFruitGame = { mount: mount, unmount: unmount };
})();
