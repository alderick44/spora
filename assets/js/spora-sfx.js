// Effets sonores synthetises (Web Audio API), aucun fichier audio.
// window.sporaSfx = { play(nom, opts), muted(), setMuted(bool) }
(function () {
  'use strict';

  var KEY = 'spora-sfx-muted';
  var MASTER = 0.12;
  var ctx = null, master = null, noiseBuf = null;
  var unlocked = false;
  var last = {};
  var muted = false;
  try { muted = localStorage.getItem(KEY) === '1'; } catch (e) {}

  function ensure() {
    if (!unlocked) return null; // jamais avant un geste utilisateur (politique autoplay)
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = MASTER;
        // Limiteur : plafonne le niveau global, meme si plusieurs sons se superposent.
        var lim = ctx.createDynamicsCompressor();
        lim.threshold.value = -28; lim.knee.value = 0; lim.ratio.value = 20;
        lim.attack.value = 0.002; lim.release.value = 0.15;
        master.connect(lim);
        lim.connect(ctx.destination);
      } catch (e) { ctx = null; return null; }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function unlock() {
    unlocked = true;
    ensure();
  }
  ['pointerdown', 'keydown'].forEach(function (ev) {
    window.addEventListener(ev, unlock, { capture: true, passive: true });
  });

  // Oscillateur + enveloppe. f1 = frequence de fin (glissando) optionnelle.
  function tone(o) {
    var t0 = ctx.currentTime + (o.at || 0);
    var dur = o.dur || 0.1;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t0);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t0 + dur);
    var v = o.vol == null ? 0.5 : o.vol;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  // Bruit filtre (bandpass/lowpass/highpass).
  function noise(o) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    var t0 = ctx.currentTime + (o.at || 0);
    var dur = o.dur || 0.1;
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    var flt = ctx.createBiquadFilter();
    flt.type = o.filter || 'bandpass';
    flt.frequency.setValueAtTime(o.f || 1000, t0);
    if (o.f1) flt.frequency.exponentialRampToValueAtTime(o.f1, t0 + dur);
    flt.Q.value = o.q || 1;
    var g = ctx.createGain();
    var v = o.vol == null ? 0.5 : o.vol;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + (o.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(flt); flt.connect(g); g.connect(master);
    src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.02);
  }

  var R = function (a, b) { return a + Math.random() * (b - a); };

  var SOUNDS = {
    click: function () { tone({ f: 660, f1: 440, dur: 0.06, type: 'triangle', vol: 0.4 }); },
    hover: function () { tone({ f: 900, dur: 0.03, vol: 0.06 }); },
    open: function () { tone({ f: 380, f1: 620, dur: 0.12, type: 'triangle', vol: 0.4 }); },
    close: function () { tone({ f: 620, f1: 340, dur: 0.12, type: 'triangle', vol: 0.4 }); },
    addToCart: function () {
      tone({ f: 523, dur: 0.1, vol: 0.4 });
      tone({ f: 784, dur: 0.16, vol: 0.4, at: 0.08 });
    },
    qtyUp: function () { tone({ f: 500, f1: 700, dur: 0.07, type: 'triangle', vol: 0.4 }); },
    qtyDown: function () { tone({ f: 700, f1: 480, dur: 0.07, type: 'triangle', vol: 0.4 }); },
    error: function () {
      tone({ f: 220, dur: 0.12, type: 'triangle', vol: 0.25 });
      tone({ f: 160, dur: 0.18, type: 'triangle', vol: 0.25, at: 0.1 });
    },
    dig: function () {
      noise({ filter: 'lowpass', f: R(500, 900), f1: 250, dur: 0.12, vol: 0.5, q: 0.7 });
    },
    scrape: function () {
      for (var i = 0; i < 3; i++) noise({ filter: 'bandpass', f: R(2400, 3600), f1: R(1800, 2600), dur: 0.05, vol: 0.32, q: 1.2, at: i * 0.065 });
    },
    fling: function () {
      noise({ filter: 'bandpass', f: R(700, 1100), f1: 300, dur: 0.14, vol: 0.4, q: 0.9 });
      tone({ f: R(140, 200), f1: 70, dur: 0.1, vol: 0.2 });
    },
    thud: function () {
      tone({ f: R(90, 120), f1: 45, dur: 0.14, vol: 0.7 });
      noise({ filter: 'lowpass', f: 300, dur: 0.08, vol: 0.25 });
    },
    pop: function () {
      tone({ f: R(400, 480), f1: 900, dur: 0.09, vol: 0.5 });
      noise({ filter: 'highpass', f: 2500, dur: 0.04, vol: 0.15 });
    },
    coin: function () {
      tone({ f: 988, dur: 0.07, type: 'triangle', vol: 0.18 });
      tone({ f: 1319, dur: 0.18, type: 'triangle', vol: 0.18, at: 0.06 });
    },
    plant: function () {
      tone({ f: 300, f1: 520, dur: 0.14, vol: 0.45 });
      noise({ filter: 'lowpass', f: 600, dur: 0.1, vol: 0.2 });
    },
    rain: function () {
      noise({ filter: 'highpass', f: 3000, dur: 0.28, attack: 0.08, vol: 0.25 });
    },
    thunder: function () {
      noise({ filter: 'lowpass', f: 400, f1: 80, dur: 0.29, attack: 0.03, vol: 0.9, q: 0.5 });
      tone({ f: 60, f1: 35, dur: 0.29, vol: 0.5 });
    },
    splash: function () {
      noise({ filter: 'bandpass', f: 1500, f1: 700, dur: 0.16, vol: 0.4, q: 0.8 });
      tone({ f: 500, f1: 250, dur: 0.08, vol: 0.2 });
    },
    whoosh: function () {
      noise({ filter: 'bandpass', f: 400, f1: 2500, dur: 0.26, attack: 0.1, vol: 0.4, q: 1.2 });
    },
    toolSwitch: function () {
      tone({ f: 800, dur: 0.03, type: 'triangle', vol: 0.15 });
      tone({ f: 600, dur: 0.04, type: 'triangle', vol: 0.15, at: 0.04 });
    }
  };

  // opts.min : delai minimal (ms) entre deux appels du meme son (defaut 40, hover 120).
  function play(name, opts) {
    try {
      if (muted || !SOUNDS[name]) return;
      var now = Date.now();
      var min = (opts && opts.min) || (name === 'hover' ? 120 : 40);
      if (last[name] && now - last[name] < min) return;
      if (!ensure()) return;
      last[name] = now;
      SOUNDS[name]();
    } catch (e) {}
  }

  var btn = null;
  var ICON_ON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
  var ICON_OFF = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 5 6"/><path d="m21 9-5 6"/></svg>';

  function refreshBtn() {
    if (!btn) return;
    btn.innerHTML = muted ? ICON_OFF : ICON_ON;
    btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    btn.setAttribute('aria-label', muted ? 'Activer les effets sonores' : 'Couper les effets sonores');
    btn.title = btn.getAttribute('aria-label');
  }

  function setMuted(v) {
    muted = !!v;
    try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch (e) {}
    refreshBtn();
    if (wind) wind.out.gain.setTargetAtTime(windTarget(), ctx.currentTime, 0.3);
  }

  function injectButton() {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'spora-sfx-toggle';
    btn.addEventListener('click', function () {
      setMuted(!muted);
      if (!muted) play('click');
    });
    refreshBtn();
    // Le bouton vit dans le jeu du logo (a cote du plein ecran), pas dans le site.
    var fs = document.getElementById('logo-explosion-fullscreen');
    if (!fs || !fs.parentNode) { btn = null; return; }
    fs.parentNode.appendChild(btn);
    function sync() { btn.classList.toggle('d-none', fs.classList.contains('d-none')); }
    sync();
    new MutationObserver(sync).observe(fs, { attributes: true, attributeFilter: ['class'] });
  }

  // Ambiance : vent et feuilles, en boucle, page d'accueil seulement. Les rafales sont
  // des rampes de gain/filtre replanifiees au hasard, donc jamais deux fois pareil.
  var wind = null, gameSeen = true, gameOn = false;
  function windTarget() { return muted || !gameSeen || !gameOn ? 0 : 1; }
  function startWind() {
    if (wind || !gameOn || !document.body.classList.contains('home')) return;
    if (!ensure()) return;
    var len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    var lastV = 0; // bruit brun (integre) : doux et grave, sans le sifflement du bruit blanc
    for (var i = 0; i < len; i++) { lastV = (lastV + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = lastV * 3.5; }
    var out = ctx.createGain();
    out.gain.value = windTarget();
    out.connect(master);
    function layer(type, f, q) {
      var src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      var flt = ctx.createBiquadFilter(); flt.type = type; flt.frequency.value = f; flt.Q.value = q;
      var g = ctx.createGain(); g.gain.value = 0;
      src.connect(flt); flt.connect(g); g.connect(out); src.start();
      return { flt: flt, g: g };
    }
    var low = layer('lowpass', 400, 0.3), leaf = layer('bandpass', 2200, 0.4);
    wind = { out: out };
    function gust() {
      var t = ctx.currentTime, dur = 2 + Math.random() * 3, strong = Math.random();
      low.g.gain.linearRampToValueAtTime(0.004, t + dur);
      low.flt.frequency.linearRampToValueAtTime(200 + strong * 250, t + dur);
      leaf.g.gain.linearRampToValueAtTime(0.015 + strong * 0.05, t + dur);
      leaf.flt.frequency.linearRampToValueAtTime(1800 + Math.random() * 1400, t + dur);
      setTimeout(gust, dur * 1000);
    }
    gust();
  }
  // Le vent ne joue que lorsque le jeu est a l'ecran : fondu a zero quand on defile ailleurs.
  var gameEl = document.getElementById('logo-explosion-fullscreen');
  gameEl = gameEl && gameEl.parentNode;
  if (gameEl && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      gameSeen = es[0].isIntersecting;
      if (wind) wind.out.gain.setTargetAtTime(windTarget(), ctx.currentTime, 0.4);
    }, { threshold: 0.15 }).observe(gameEl);
  }
  // Ni avant le lancement du jeu, ni apres la reconstruction du logo : le canvas est alors en d-none.
  var gameCanvas = document.getElementById('logo-explosion-canvas');
  if (gameCanvas) {
    var syncGameOn = function () {
      gameOn = !gameCanvas.classList.contains('d-none');
      if (wind) wind.out.gain.setTargetAtTime(windTarget(), ctx.currentTime, 0.4);
      else startWind();
    };
    syncGameOn();
    new MutationObserver(syncGameOn).observe(gameCanvas, { attributes: true, attributeFilter: ['class'] });
  }
  document.addEventListener('visibilitychange', function () {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else if (!muted || wind) ctx.resume();
  });
  ['pointerdown', 'keydown'].forEach(function (ev) {
    window.addEventListener(ev, function () { startWind(); }, { capture: true, passive: true });
  });

  window.sporaSfx = { play: play, muted: function () { return muted; }, setMuted: setMuted };

  if (document.body) injectButton();
  else document.addEventListener('DOMContentLoaded', injectButton);
})();
