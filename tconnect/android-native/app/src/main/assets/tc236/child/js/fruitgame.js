// T-Connect Child — Jogo de Frutas (estilo match-3 / "candy").
// Sem dependências nem imagens: usa emojis de fruta. Toque numa fruta e depois
// numa fruta vizinha para as trocar; alinhar 3+ iguais rebenta-as, as de cima
// caem e entram novas (cascata). Pontuação e recorde guardados no dispositivo.
(function () {
  "use strict";
  var FRUITS = ["🍎", "🍊", "🍋", "🍇", "🍉", "🍓"];
  var ROWS = 8, COLS = 8;
  var G = null; // estado atual

  function bestKey() { return "tc_fruit_best"; }
  function loadBest() { try { return parseInt(localStorage.getItem(bestKey()) || "0", 10) || 0; } catch (_) { return 0; } }
  function saveBest(v) { try { localStorage.setItem(bestKey(), String(v)); } catch (_) {} }

  function rnd() { return FRUITS[(Math.random() * FRUITS.length) | 0]; }
  function idx(r, c) { return r * COLS + c; }
  function inBounds(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS; }

  // Cria um tabuleiro SEM combinações iniciais (para não rebentar sozinho ao abrir).
  function freshGrid() {
    var g = new Array(ROWS * COLS);
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var f;
        do { f = rnd(); }
        while (
          (c >= 2 && g[idx(r, c - 1)] === f && g[idx(r, c - 2)] === f) ||
          (r >= 2 && g[idx(r - 1, c)] === f && g[idx(r - 2, c)] === f)
        );
        g[idx(r, c)] = f;
      }
    }
    return g;
  }

  function findMatches(g) {
    var hit = {};
    // horizontais
    for (var r = 0; r < ROWS; r++) {
      var run = 1;
      for (var c = 1; c <= COLS; c++) {
        if (c < COLS && g[idx(r, c)] && g[idx(r, c)] === g[idx(r, c - 1)]) { run++; }
        else { if (run >= 3) for (var k = 1; k <= run; k++) hit[idx(r, c - k)] = 1; run = 1; }
      }
    }
    // verticais
    for (var c2 = 0; c2 < COLS; c2++) {
      var run2 = 1;
      for (var r2 = 1; r2 <= ROWS; r2++) {
        if (r2 < ROWS && g[idx(r2, c2)] && g[idx(r2, c2)] === g[idx(r2 - 1, c2)]) { run2++; }
        else { if (run2 >= 3) for (var k2 = 1; k2 <= run2; k2++) hit[idx(r2 - k2, c2)] = 1; run2 = 1; }
      }
    }
    return Object.keys(hit).map(Number);
  }

  // Há alguma jogada possível? (procura uma troca que gere combinação)
  function hasMove(g) {
    function swap(a, i, j) { var t = a[i]; a[i] = a[j]; a[j] = t; }
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      if (c + 1 < COLS) { swap(g, idx(r, c), idx(r, c + 1)); var m = findMatches(g).length; swap(g, idx(r, c), idx(r, c + 1)); if (m) return true; }
      if (r + 1 < ROWS) { swap(g, idx(r, c), idx(r + 1, c)); var m2 = findMatches(g).length; swap(g, idx(r, c), idx(r + 1, c)); if (m2) return true; }
    }
    return false;
  }

  function reshuffleUntilPlayable(g) {
    var tries = 0;
    while (!hasMove(g) && tries < 40) { var ng = freshGrid(); for (var i = 0; i < g.length; i++) g[i] = ng[i]; tries++; }
  }

  // Aplica gravidade e preenche espaços vazios (null) com frutas novas.
  function collapse(g) {
    for (var c = 0; c < COLS; c++) {
      var col = [];
      for (var r = ROWS - 1; r >= 0; r--) { if (g[idx(r, c)] != null) col.push(g[idx(r, c)]); }
      for (var r2 = ROWS - 1, k = 0; r2 >= 0; r2--, k++) { g[idx(r2, c)] = (k < col.length) ? col[k] : rnd(); }
    }
  }

  function render() {
    if (!G || !G.boardEl) return;
    var html = "";
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      var i = idx(r, c);
      var sel = (G.sel === i) ? " fg-sel" : "";
      var pop = G.popping[i] ? " fg-pop" : "";
      html += '<button class="fg-cell' + sel + pop + '" data-i="' + i + '" style="animation-delay:' + ((r + c) % 6 * 20) + 'ms">' + (G.grid[i] || "") + '</button>';
    }
    G.boardEl.innerHTML = html;
    var s = document.getElementById("fg-score"); if (s) s.textContent = G.score;
    var b = document.getElementById("fg-best"); if (b) b.textContent = G.best;
  }

  function burst() { try { if (navigator.vibrate) navigator.vibrate(18); } catch (_) {} }

  // Resolve cascatas até não haver mais combinações. Devolve pontos ganhos.
  function resolve(cb) {
    var matches = findMatches(G.grid);
    if (!matches.length) { G.busy = false; reshuffleUntilPlayable(G.grid); render(); if (cb) cb(0); return; }
    G.busy = true;
    G.popping = {};
    matches.forEach(function (i) { G.popping[i] = 1; });
    G.score += matches.length * 10;
    if (G.score > G.best) { G.best = G.score; saveBest(G.best); }
    burst();
    render();
    setTimeout(function () {
      matches.forEach(function (i) { G.grid[i] = null; });
      collapse(G.grid);
      G.popping = {};
      render();
      setTimeout(function () { resolve(cb); }, 150);
    }, 180);
  }

  function tap(i) {
    if (!G || G.busy) return;
    if (G.sel == null) { G.sel = i; render(); return; }
    if (G.sel === i) { G.sel = null; render(); return; }
    var r1 = (G.sel / COLS) | 0, c1 = G.sel % COLS, r2 = (i / COLS) | 0, c2 = i % COLS;
    var adj = (Math.abs(r1 - r2) + Math.abs(c1 - c2)) === 1;
    if (!adj) { G.sel = i; render(); return; } // seleciona a nova em vez de trocar à distância
    // troca
    var a = G.sel, b = i;
    var t = G.grid[a]; G.grid[a] = G.grid[b]; G.grid[b] = t;
    G.sel = null;
    if (findMatches(G.grid).length) { render(); resolve(); }
    else { // troca inválida: desfaz
      var t2 = G.grid[a]; G.grid[a] = G.grid[b]; G.grid[b] = t2;
      render();
    }
  }

  function onBoardClick(e) {
    var el = e.target.closest ? e.target.closest(".fg-cell") : null;
    if (!el) return;
    var i = parseInt(el.getAttribute("data-i"), 10);
    if (!isNaN(i)) tap(i);
  }

  function restart() {
    if (!G) return;
    G.grid = freshGrid();
    reshuffleUntilPlayable(G.grid);
    G.score = 0; G.sel = null; G.busy = false; G.popping = {};
    render();
  }

  // Monta o jogo dentro do elemento host (com o seu próprio HTML interno).
  function mount(host) {
    if (!host) return;
    host.innerHTML =
      '<div class="fg-hud">' +
        '<div class="fg-stat"><small>PONTOS</small><b id="fg-score">0</b></div>' +
        '<div class="fg-stat"><small>RECORDE</small><b id="fg-best">0</b></div>' +
        '<button class="fg-restart" id="fg-restart">↻ Reiniciar</button>' +
      '</div>' +
      '<div class="fg-board" id="fg-board"></div>' +
      '<p class="fg-tip">Toca numa fruta e depois numa vizinha para trocar. Alinha 3 ou mais iguais!</p>';
    G = { grid: freshGrid(), boardEl: host.querySelector("#fg-board"), score: 0, best: loadBest(), sel: null, busy: false, popping: {} };
    reshuffleUntilPlayable(G.grid);
    G.boardEl.addEventListener("click", onBoardClick);
    var rb = host.querySelector("#fg-restart"); if (rb) rb.addEventListener("click", restart);
    render();
  }

  function unmount() { G = null; }

  window.TCFruitGame = { mount: mount, unmount: unmount };
})();
