(function () {
  'use strict';

  var container = document.getElementById('logo-explosion');
  if (!container) return;

  var canvas = container.querySelector('#logo-explosion-canvas');
  var fallbackImg = container.querySelector('#logo-explosion-fallback');
  var rebuildBtn = document.getElementById('logo-explosion-rebuild');
  if (!canvas || !fallbackImg) return;

  var prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    return; // le wordmark statique (deja dans le DOM) reste affiche, canvas jamais active
  }

  var logoUrl = canvas.getAttribute('data-logo-url');
  if (!logoUrl) return;

  var ctx = canvas.getContext('2d');
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var isMobile = window.innerWidth < 768;

  // Style low-poly : uniquement des triangles a couleur pleine (pas de degrade,
  // pas de flou). La variation de ton d'une facette a l'autre suffit a donner du relief.
  var CELLS_ACROSS = 110;                 // nb de facettes sur la largeur du logo
  var GRAVITY = 0.32;
  var AIR = 0.992;
  var COL_W = 6;                          // resolution de la carte de hauteurs du tas
  var EARTH = ['#6b4a30', '#7c5a3a', '#5a3d28', '#8a6239', '#4f3622'];
  var SOIL = ['#5a3d28', '#6b4a30', '#4a3220'];
  var SPECIES = [
    { cap: '#9a948c', gill: '#d9d2c5' },  // pleurote gris
    { cap: '#e58a9b', gill: '#f6c9d1' },  // pleurote rose
    { cap: '#f1e6d2', gill: '#ffffff' },  // hydne herisson
    { cap: '#c9a27a', gill: '#efdcc2' },  // pleurote huitre
    { cap: '#8a5a3b', gill: '#e4cfb2' }   // shiitake
  ];
  var MAX_MUSHROOMS = 36;
  var DIG_TO_REVEAL = 3;                  // coups de pelle (clic/tap) pour deterrer un tresor

  // "Tresors" enfouis dans le tas : un champignon + une infobulle (produit, conseil...).
  // x = position en fraction de la LARGEUR DU LOGO ; species = index dans SPECIES.
  var treasureDefs = [];
  try {
    treasureDefs = JSON.parse(canvas.getAttribute('data-treasures') || '[]');
  } catch (e) {
    treasureDefs = [];
  }
  treasureDefs.forEach(function (def) {
    if (def.img) new Image().src = def.img; // prechargee : l'infobulle s'affiche sans trou
  });
  var treasures = [];
  var logoLeft = 0, logoWidth = 0;

  var W = 0, H = 0, groundY = 0;
  var shards = [], heights = [], mushrooms = [];
  var mode = 'assembled';                 // 'assembled' | 'exploded' | 'rebuilding'
  var rafId = null, speciesIdx = 0, rebuildT = 0;

  var img = new Image();
  var imgReady = false;
  img.onload = function () { imgReady = true; };
  img.src = logoUrl;

  function hexToRgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function shade(rgb, k) {
    return rgb.map(function (c) { return Math.max(0, Math.min(255, Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k)))); });
  }
  function rgbStr(c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOutBack(t) { var c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  // --- Lit de terre ------------------------------------------------------------------
  // Terre supplementaire qui monte du bas au moment de l'explosion : la terre du logo
  // retombe dessus. Sans elle, le tas (fait seulement du logo) etait trop mince pour creuser.
  var SOIL_RISE_FRAMES = 32;
  var soilRiseT = 1, soilDepth = 0;       // soilRiseT < 1 : le lit est en train de monter

  function setupSoil(rect) {
    W = rect.width; H = rect.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    groundY = H - 6;
    heights = new Float32Array(Math.ceil(W / COL_W) + 1);

    // Profil : couche de base ondulee + bosse centrale sous le logo.
    var base = H * 0.07, bump = H * 0.08, phase = Math.random() * 10;
    function profile(x) {
      var u = x / W;
      var mound = Math.exp(-Math.pow((u - 0.5) / 0.3, 2));
      var wave = Math.sin(u * 9 + phase) * 0.25 + Math.sin(u * 23 + phase * 2) * 0.12;
      return base * (1 + wave) + bump * mound;
    }
    // Profil provisoire, seulement pour trier les triangles sous la crete ; la vraie
    // carte de hauteurs est ensuite reconstruite a partir des facettes gardees.
    for (var c = 0; c < heights.length; c++) heights[c] = profile(c * COL_W);
    soilDepth = base * 1.4 + bump + 10;

    // Maillage low-poly (sommets partages et decales) sur toute la bande, puis on ne
    // garde que les triangles sous la crete : leurs pointes forment une crete dentelee.
    var cell = Math.max(6, W / 160);
    var rows = Math.ceil((base * 1.4 + bump + 6) / cell), cols = Math.ceil(W / cell);
    var top = H - rows * cell;
    var verts = [];
    for (var j = 0; j <= rows; j++) {
      verts[j] = [];
      for (var i = 0; i <= cols; i++) {
        var edge = i === 0 || j === 0 || i === cols || j === rows;
        verts[j][i] = [
          i * cell + (edge ? 0 : (Math.random() - 0.5) * cell * 0.7),
          top + j * cell + (edge ? 0 : (Math.random() - 0.5) * cell * 0.7)
        ];
      }
    }
    shards = [];
    for (j = 0; j < rows; j++) {
      for (i = 0; i < cols; i++) {
        var a = verts[j][i], b = verts[j][i + 1], cc = verts[j + 1][i + 1], d = verts[j + 1][i];
        var tris = Math.random() < 0.5 ? [[a, b, cc], [a, cc, d]] : [[a, b, d], [b, cc, d]];
        addSoilShard(tris[0]);
        addSoilShard(tris[1]);
      }
    }
    heights.fill(0);
    shards.forEach(pileAdd);
    soilRiseT = 0;
  }

  function addSoilShard(tri) {
    var cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
    var cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
    var surf = surfaceAt(cx);
    if (cy < surf) return;
    // Plus sombre en profondeur : la terre "fraiche" se voit quand on creuse.
    var depth = Math.min(1, (cy - surf) / Math.max(1, H - surf));
    var k = (Math.random() - 0.5) * 0.2 - depth * 0.3;
    var color = shade(hexToRgb(EARTH[(Math.random() * EARTH.length) | 0]), k);
    shards.push({
      pts: tri.map(function (p) { return [p[0] - cx, p[1] - cy]; }),
      ox: cx, oy: cy, x: cx, y: cy, vx: 0, vy: 0, rot: 0, vr: 0,
      from: color, to: color, mix: 1, area: triArea(tri),
      settled: true, col: Math.round(cx / COL_W), soil: true
    });
  }

  function triArea(tri) {
    return Math.abs((tri[1][0] - tri[0][0]) * (tri[2][1] - tri[0][1]) - (tri[2][0] - tri[0][0]) * (tri[1][1] - tri[0][1])) / 2;
  }

  // Construit au moment du clic (pas au chargement) : la boite et le fallback sont
  // alors forcement mesures a leur vraie taille.
  function build() {
    var rect = container.getBoundingClientRect();
    setupSoil(rect);

    // Le logo est place exactement la ou le CSS affiche le fallback (encore visible
    // a ce moment-la) : taille et position se reglent donc uniquement dans style.css.
    var fr = fallbackImg.getBoundingClientRect();
    var lx = fr.left - rect.left, oy = fr.top - rect.top, lw = fr.width, lh = fr.height;
    var CELL = Math.max(5, lw / CELLS_ACROSS);
    var cols = Math.ceil(lw / CELL), rows = Math.ceil(lh / CELL);

    var off = document.createElement('canvas');
    off.width = cols * 4; off.height = rows * 4;
    var offCtx = off.getContext('2d', { willReadFrequently: true });
    offCtx.drawImage(img, 0, 0, off.width, off.height);
    var data;
    try {
      data = offCtx.getImageData(0, 0, off.width, off.height).data;
    } catch (e) {
      return false;
    }
    function sample(fx, fy) {
      var x = Math.min(off.width - 1, Math.max(0, Math.round(fx * off.width)));
      var y = Math.min(off.height - 1, Math.max(0, Math.round(fy * off.height)));
      var i = (y * off.width + x) * 4;
      return [data[i], data[i + 1], data[i + 2], data[i + 3]];
    }

    // Sommets legerement decales et PARTAGES entre cellules voisines : c'est ce
    // qui donne un vrai maillage low-poly plutot qu'une grille de carres.
    var verts = [];
    for (var j = 0; j <= rows; j++) {
      verts[j] = [];
      for (var i = 0; i <= cols; i++) {
        var edge = i === 0 || j === 0 || i === cols || j === rows;
        verts[j][i] = [
          lx + i * CELL + (edge ? 0 : (Math.random() - 0.5) * CELL * 0.7),
          oy + j * CELL + (edge ? 0 : (Math.random() - 0.5) * CELL * 0.7)
        ];
      }
    }

    for (j = 0; j < rows; j++) {
      for (i = 0; i < cols; i++) {
        var a = verts[j][i], b = verts[j][i + 1], c = verts[j + 1][i + 1], d = verts[j + 1][i];
        var tris = Math.random() < 0.5 ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]];
        addShard(tris[0], sample, lx, oy, lw, lh);
        addShard(tris[1], sample, lx, oy, lw, lh);
      }
    }

    logoLeft = lx; logoWidth = lw;
    mushrooms = [];
    return true;
  }

  function addShard(tri, sample, lx, oy, lw, lh) {
    var cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
    var cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
    var s = sample((cx - lx) / lw, (cy - oy) / lh);
    if (s[3] < 110) return;
    var k = (Math.random() - 0.5) * 0.22;
    var area = triArea(tri);
    shards.push({
      pts: tri.map(function (p) { return [p[0] - cx, p[1] - cy]; }),
      ox: cx, oy: cy, x: cx, y: cy, vx: 0, vy: 0, rot: 0, vr: 0,
      from: shade([s[0], s[1], s[2]], k),
      to: shade(hexToRgb(EARTH[(Math.random() * EARTH.length) | 0]), k * 0.8),
      mix: 0, area: area, settled: false, col: -1
    });
  }

  // --- Tas de terre : carte de hauteurs par colonne ----------------------------------
  // Chaque facette posee y ajoute son aire (etalee sur quelques colonnes) et, quand on
  // la souleve, retire EXACTEMENT ce qu'elle avait ajoute (memorise dans s.dep/s.col).
  // Avant, le retrait etait recalcule et tronque a zero alors que l'ajout ne l'etait
  // pas : chaque coup de souris gonflait le tas, jusqu'a des aiguilles de terre.
  var KERNEL = [0.08, 0.17, 0.25, 0.25, 0.17, 0.08];
  var REPOSE = COL_W * 0.7;               // denivele max entre colonnes voisines (~35 deg)
  var LOGO_BULK = 1.3;                    // la terre du logo "foisonne" un peu en retombant

  function surfaceAt(x) {
    var c = Math.max(0, Math.min(heights.length - 1, Math.round(x / COL_W)));
    return groundY - heights[c];
  }
  function applyKernel(col, dh) {
    for (var k = 0; k < KERNEL.length; k++) {
      var c = col + k - 3;
      if (c >= 0 && c < heights.length) heights[c] = Math.max(0, heights[c] + dh * KERNEL[k]);
    }
  }
  function pileAdd(s) {
    s.dep = s.area / COL_W * (s.soil ? 1 : LOGO_BULK);
    applyKernel(s.col, s.dep);
  }
  function pileRemove(s) {
    applyKernel(s.col, -s.dep);
  }

  // Comme du sable : une facette qui tombe sur une pente trop raide roule vers la
  // colonne voisine la plus basse, au lieu de s'empiler en aiguille.
  function restColumn(x) {
    var c = Math.max(0, Math.min(heights.length - 1, Math.round(x / COL_W)));
    for (var n = 0; n < 60; n++) {
      var l = c > 0 ? heights[c - 1] : Infinity;
      var r = c < heights.length - 1 ? heights[c + 1] : Infinity;
      var low = l < r ? c - 1 : c + 1;
      if (Math.min(l, r) === Infinity || heights[c] - Math.min(l, r) <= REPOSE) break;
      c = low;
    }
    return c;
  }

  // --- Physique ----------------------------------------------------------------------
  function explode(px, py) {
    fallbackImg.classList.add('d-none');
    canvas.classList.remove('d-none');
    mode = 'exploded';
    for (var i = 0; i < shards.length; i++) {
      var s = shards[i];
      if (s.soil) continue; // le lit de terre ne bouge pas, il recoit
      var dx = s.ox - px, dy = s.oy - py, d = Math.hypot(dx, dy) || 1;
      var sp = 2 + Math.random() * 5 + 40 / (d + 20);
      // Composante horizontale reduite : sinon tout s'empile contre les bords.
      s.vx = dx / d * sp * 0.45 + (Math.random() - 0.5) * 1.5;
      s.vy = dy / d * sp - 4 - Math.random() * 5;
      s.vr = (Math.random() - 0.5) * 0.35;
    }
    if (rebuildBtn) rebuildBtn.classList.remove('d-none');
    setupTreasures();
    startLoop();
  }

  function step() {
    // Tant que la pelle est a l'ecran, la boucle tourne (elle suit le curseur, porte de la terre).
    var active = shovel.on;
    if (shovel.on) {
      updateShovel();
      if (shovel.on) bowlWakePile(); // updateShovel peut la ranger (fin de versement au doigt)
    }
    for (var i = 0; i < shards.length; i++) {
      var s = shards[i];
      if (s.settled) continue;
      active = true;
      s.px = s.x; s.py = s.y;
      if (shovel.on) bladeField(s);
      s.vy += GRAVITY; s.vx *= AIR; s.vy *= AIR;
      s.x += s.vx; s.y += s.vy; s.rot += s.vr;
      s.mix = Math.min(1, s.mix + 0.012);
      if (shovel.on && collideBowl(s)) {
        s.vr *= 0.8;
        continue; // tenue par le bol : pas de contact avec le sol cette frame
      }
      if (s.x < 4) { s.x = 4; s.vx = Math.abs(s.vx) * 0.4; }
      if (s.x > W - 4) { s.x = W - 4; s.vx = -Math.abs(s.vx) * 0.4; }
      var floor = surfaceAt(s.x);
      if (s.y >= floor && s.vy > 0) {
        s.y = floor;
        if (s.vy > 2.5) {
          s.vy *= -0.28; s.vx *= 0.6; s.vr *= 0.5;
        } else {
          s.settled = true; s.vx = s.vy = s.vr = 0; s.mix = 1;
          s.col = restColumn(s.x);
          s.x = (s.col + Math.random() - 0.5) * COL_W;
          s.y = groundY - heights[s.col];
          pileAdd(s);
        }
      }
    }
    if (soilRiseT < 1) {
      soilRiseT = Math.min(1, soilRiseT + 1 / SOIL_RISE_FRAMES);
      active = true;
    }
    for (i = 0; i < mushrooms.length; i++) {
      var m = mushrooms[i];
      if (m.dying) { m.t -= 0.06; active = true; }
      else if (m.t < 1) { m.t = Math.min(1, m.t + 0.025); active = true; }
    }
    mushrooms = mushrooms.filter(function (m) { return !(m.dying && m.t <= 0); });
    return active;
  }

  function startLoop() {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(function tick() {
      var active = mode === 'rebuilding' ? stepRebuild() : step();
      if (mode !== 'assembled') draw();
      rafId = active ? requestAnimationFrame(tick) : null;
    });
  }

  // --- Pelle (bol) -------------------------------------------------------------------
  // Pas de logique "chargee / pas chargee" : la pelle est un arc de cercle (un bol) et
  // c'est sa courbe qui gere la terre. Une facette qui touche l'interieur de l'arc est
  // retenue par lui (elle glisse au fond par gravite, et deborde par le bord quand le
  // bol penche) ; celle qui touche le dos est repoussee dehors.
  // Le bol suit le curseur (le fond du bol est au curseur) et penche dans le sens du
  // geste. Bouton maintenu : la pelle ralentit (mode precis). Doigt leve (mobile) : elle verse.
  // Lame de pelle a peine courbee : une petite portion d'un grand cercle. On regle la
  // largeur de la lame et sa courbure ; le rayon du cercle en decoule. Volume d'une
  // pelletee ~ largeur x hauteur portee (0.30 x 0.04, comme 0.20 x 0.06 avant).
  var BLADE_WIDTH = 0.30;                 // largeur de la lame (fraction de la hauteur de la zone)
  var BOWL_SPAN = 0.35;                   // demi-ouverture de l'arc (rad) : plus petit = plus plat
  var BOWL_T = 5;                         // epaisseur de la paroi (px)
  var POUR_ANGLE = 2.1;                   // bascule (rad) pour vider
  var SLOW_FOLLOW = 0.12;                 // bouton maintenu : part du chemin vers le curseur par frame
  var shovel = {
    on: false, held: false, pouring: false, hideWhenEmpty: false,
    gx: 0, gy: 0,                         // curseur
    cx: 0, cy: 0, pcx: 0, pcy: 0,         // centre du cercle du bol, et a la frame precedente
    tilt: 0, ptilt: 0, face: 1            // face : 1 = dernier geste vers la droite, -1 = gauche
  };
  var BLADE_FIELD = 0.10;                 // hauteur de la zone de force au-dessus de la lame (x hauteur)
  var BLADE_PULL = 0.18;                  // part de l'ecart de vitesse rattrapee par frame (sur la lame)
  var BLADE_ATTRACT = 0.12;               // attraction vers la lame (px/frame^2, sur la lame)
  var pointerDown = null, dragMoved = false;

  function bowlR() { return H * BLADE_WIDTH / 2 / Math.sin(BOWL_SPAN); }
  function loadDepth() { return H * 0.04; } // hauteur de terre que la lame peut porter
  function angleDiff(a, b) { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function enterShovel(p) {
    shovel.on = true;
    shovel.gx = p.x; shovel.gy = p.y;
    shovel.tilt = shovel.ptilt = 0;
    shovel.pouring = false; shovel.hideWhenEmpty = false;
    shovel.cx = shovel.pcx = p.x; shovel.cy = shovel.pcy = p.y - bowlR();
    container.classList.add('is-shoveling');
  }

  function leaveShovel() {
    shovel.on = false; shovel.held = false; shovel.pouring = false; shovel.hideWhenEmpty = false;
    container.classList.remove('is-shoveling');
  }

  function updateShovel() {
    var R = bowlR();
    shovel.pcx = shovel.cx; shovel.pcy = shovel.cy; shovel.ptilt = shovel.tilt;
    // Le fond du bol (et non son centre) est colle au curseur, sans retard.
    var bottomX = shovel.cx + Math.sin(shovel.tilt) * R, bottomY = shovel.cy + Math.cos(shovel.tilt) * R;
    var dx = shovel.gx - bottomX, dy = shovel.gy - bottomY;
    // Bouton maintenu = mode precis : la pelle rejoint le curseur lentement (et penche
    // donc moins), pour mieux controler la terre.
    if (shovel.held) { dx *= SLOW_FOLLOW; dy *= SLOW_FOLLOW; }
    if (Math.abs(dx) > 0.6) shovel.face = dx > 0 ? 1 : -1;
    // Penche dans le sens du geste (le bord avant plonge : il mord dans la terre).
    var goal = shovel.pouring ? -shovel.face * POUR_ANGLE : -clamp(dx * 0.06, -0.7, 0.7);
    shovel.tilt += (goal - shovel.tilt) * (shovel.pouring ? 0.12 : 0.2);
    shovel.cx = bottomX + dx - Math.sin(shovel.tilt) * R;
    shovel.cy = bottomY + dy - Math.cos(shovel.tilt) * R;
    if (shovel.pouring && Math.abs(shovel.tilt) > POUR_ANGLE * 0.9) {
      shovel.pouring = false;
      if (shovel.hideWhenEmpty) leaveShovel();
    }
  }

  // Collision d'une facette avec le bol. Retourne true si elle a ete touchee.
  function collideBowl(s) {
    var R = bowlR();
    var rx = s.x - shovel.cx, ry = s.y - shovel.cy, d = Math.hypot(rx, ry);
    if (d > R + BOWL_T + 2 || d < 0.001) return false;
    // Seulement sur l'arc : le fond est a l'oppose de l'ouverture (vers le bas a tilt 0).
    var bottomDir = Math.PI / 2 - shovel.tilt;
    if (Math.abs(angleDiff(Math.atan2(ry, rx), bottomDir)) > BOWL_SPAN) return false;
    // Chaque facette a son propre rayon de repos : elles s'empilent en tas dans le
    // bol au lieu de toutes s'aligner sur la paroi.
    if (s.stack === undefined) s.stack = Math.random();
    var depth = loadDepth();
    var rest = R - s.stack * depth;       // hauteur de repos propre a chaque facette : un petit tas
    // De quel cote de la paroi etait-elle a la frame precedente ? (dos ou creux)
    var prx = (s.px === undefined ? s.x : s.px) - shovel.pcx;
    var pry = (s.py === undefined ? s.y : s.py) - shovel.pcy;
    var wasOutside = Math.hypot(prx, pry) > R + 1;
    if (d < R - depth * 1.2) return false; // bien au-dessus de la lame : libre
    if (d < rest) return false;
    var ux = rx / d, uy = ry / d;
    var target = wasOutside ? R + BOWL_T + 2 : rest;
    s.x = shovel.cx + ux * target;
    s.y = shovel.cy + uy * target;
    // Paroi solide, sans adherence : la facette prend la vitesse de la lame a cet
    // endroit (translation + rotation), plus son glissement le long de la lame, freine.
    var w = shovel.tilt - shovel.ptilt;
    var wx = shovel.cx - shovel.pcx + w * (s.y - shovel.cy);
    var wy = shovel.cy - shovel.pcy - w * (s.x - shovel.cx);
    if (wasOutside) {
      s.vx = clamp(wx, -16, 16);
      s.vy = clamp(wy, -16, 16);
      return true;
    }
    var relx = s.vx - wx, rely = s.vy - wy;
    var along = -rely * ux + relx * uy;   // composante tangentielle (le long de la lame)
    s.vx = clamp(wx + uy * along * 0.7, -16, 16);
    s.vy = clamp(wy - ux * along * 0.7, -16, 16);
    return true;
  }

  // Force douce au-dessus de la lame (pas seulement au contact) : dans une zone de
  // BLADE_FIELD de haut, la terre tend vers la vitesse de la pelle, un peu plus a
  // chaque frame et plus fort pres de la lame, et elle est legerement attiree vers
  // elle. Un geste lent emporte la pelletee ; un geste rapide la laisse prendre du
  // retard progressivement (pas de decrochage sec).
  function bladeField(s) {
    var R = bowlR(), field = H * BLADE_FIELD;
    var rx = s.x - shovel.cx, ry = s.y - shovel.cy, d = Math.hypot(rx, ry);
    if (d > R + 1 || d < R - field) return;
    if (Math.abs(angleDiff(Math.atan2(ry, rx), Math.PI / 2 - shovel.tilt)) > BOWL_SPAN) return;
    var k = 1 - (R - d) / field;          // 1 sur la lame, 0 en haut de la zone
    var w = shovel.tilt - shovel.ptilt;
    var wx = shovel.cx - shovel.pcx + w * ry, wy = shovel.cy - shovel.pcy - w * rx;
    s.vx += (wx - s.vx) * BLADE_PULL * k;
    s.vy += (wy - s.vy) * BLADE_PULL * k;
    // Attraction vers la lame (vers l'exterieur du cercle, donc vers l'arc).
    s.vx += rx / d * BLADE_ATTRACT * k;
    s.vy += ry / d * BLADE_ATTRACT * k;
  }

  // Reveille les facettes posees que la lame touche, pour que la collision les prenne
  // en charge : la couche juste au-dessus de la lame (ce qu'elle ramasse) plus la lame
  // elle-meme. Autour, une facette restee "suspendue" au-dessus du sol (on a retire la
  // terre dessous) retombe : le trou se referme comme du vrai sol.
  function bowlWakePile() {
    var R = bowlR(), woke = [];
    for (var i = 0; i < shards.length; i++) {
      var s = shards[i];
      if (!s.settled) continue;
      var dx = s.x - shovel.cx, dy = s.y - shovel.cy;
      if (Math.abs(dx) > R * Math.sin(BOWL_SPAN) * 2.5) continue;
      var d = Math.hypot(dx, dy);
      var inBowl = d > R - loadDepth() * 1.2 && d < R + BOWL_T + 2 &&
        Math.abs(angleDiff(Math.atan2(dy, dx), Math.PI / 2 - shovel.tilt)) <= BOWL_SPAN;
      var floating = s.y < surfaceAt(s.x) - 6;
      if (!inBowl && !floating) continue;
      pileRemove(s);
      s.settled = false;
      s.vx = s.vy = 0;
      s.px = s.x; s.py = s.y;
      woke.push(s);
    }
    if (!woke.length) return;
    // Deplacer de la terre au-dessus d'un tresor le deterre peu a peu.
    for (i = 0; i < treasures.length; i++) {
      var t = treasures[i];
      if (t.revealed) continue;
      var near = woke.filter(function (m) { return Math.abs(m.x - t.x) < 30; }).length;
      if (near) tryDig(t, Math.min(0.12, near * 0.01));
    }
  }

  function drawShovel() {
    if (!shovel.on) return;
    var R = bowlR(), N = 10;
    var a0 = Math.PI / 2 - shovel.tilt - BOWL_SPAN, a1 = Math.PI / 2 - shovel.tilt + BOWL_SPAN;
    // back = extremite cote manche (a l'oppose du sens du geste), front = tranchant.
    var back = shovel.face > 0 ? a1 : a0, front = shovel.face > 0 ? a0 : a1;
    function pt(a, r) { return [shovel.cx + Math.cos(a) * r, shovel.cy + Math.sin(a) * r]; }
    // Epaisseur : forte a la douille, fine au tranchant. La face interieure reste
    // exactement sur l'arc de collision (rayon R) ; l'epaisseur est prise dessous.
    var thBack = BOWL_T * 1.6, thFront = 1.5;
    function th(t) { return thBack + (thFront - thBack) * Math.pow(t, 0.8); }

    // Manche : prolonge la courbe de la lame vers l'arriere, releve d'environ 20 deg.
    var tx = shovel.face * -Math.sin(back), ty = shovel.face * Math.cos(back);
    var dir = Math.atan2(ty, tx) + shovel.face * 0.35;
    var ux = Math.cos(dir), uy = Math.sin(dir), nx = -uy, ny = ux;
    var base = pt(back, R + thBack / 2);
    var sockLen = H * 0.035, shaftLen = H * 0.26;
    var sockEnd = [base[0] + ux * sockLen, base[1] + uy * sockLen];
    var grip = [sockEnd[0] + ux * shaftLen, sockEnd[1] + uy * shaftLen];
    function off(p, k) { return [p[0] + nx * k, p[1] + ny * k]; }
    // Manche en bois : deux facettes sur la longueur, legerement effile.
    ctx.fillStyle = '#b98352';
    poly([off(sockEnd, 3), off(grip, 2.4), grip, sockEnd]);
    ctx.fillStyle = '#8a5a30';
    poly([sockEnd, grip, off(grip, -2.4), off(sockEnd, -3)]);
    // Poignee en T.
    var g2 = [grip[0] + ux * 5, grip[1] + uy * 5];
    ctx.fillStyle = '#7a4d28';
    poly([off(grip, 7), off(g2, 7), off(g2, 0), off(grip, 0)]);
    ctx.fillStyle = '#5e3a1d';
    poly([off(grip, 0), off(g2, 0), off(g2, -7), off(grip, -7)]);
    // Douille metal (du talon de la lame vers le manche).
    ctx.fillStyle = '#6b7378';
    poly([off(base, thBack / 2 + 1), off(sockEnd, 3.2), sockEnd, base]);
    ctx.fillStyle = '#4c5256';
    poly([base, sockEnd, off(sockEnd, -3.2), off(base, -thBack / 2 - 1)]);

    // Lame : facettes du talon au tranchant. Face interieure claire (la ou la terre
    // repose), dessous plus fonce ; tons legerement alternes pour le low-poly.
    for (var i = 0; i < N; i++) {
      var t0 = i / N, t1 = (i + 1) / N;
      var aa = back + (front - back) * t0, ab = back + (front - back) * t1;
      var in0 = pt(aa, R), in1 = pt(ab, R);
      var mid0 = pt(aa, R + th(t0) * 0.45), mid1 = pt(ab, R + th(t1) * 0.45);
      var out0 = pt(aa, R + th(t0)), out1 = pt(ab, R + th(t1));
      ctx.fillStyle = i % 2 ? '#c9cfd2' : '#bcc3c7';
      poly([in0, in1, mid1, mid0]);
      ctx.fillStyle = i % 2 ? '#7d858a' : '#8a9297';
      poly([mid0, mid1, out1, out0]);
    }
  }

  // Clic/tap sans glisser : deterrer un tresor, rouvrir son infobulle, ou faire pousser.
  function handleTap(pos) {
    var t = treasureNear(pos.x, pos.y);
    if (t) {
      if (t.revealed) {
        openTip(t);
      } else {
        digAt(t);
        tryDig(t, 1);
      }
      return;
    }
    if (pos.y > surfaceAt(pos.x) - 40) {
      openTip(null);
      sprout(pos.x);
    }
  }

  function sprout(x) {
    var sp = SPECIES[speciesIdx++ % SPECIES.length];
    var n = 1 + ((Math.random() * 3) | 0);
    for (var i = 0; i < n; i++) {
      var side = i === 0 ? 0 : (i === 1 ? -1 : 1);
      var size = H * 0.2 * (0.6 + Math.random() * 0.6) * (i === 0 ? 1.15 : 0.85);
      mushrooms.push({
        x: x + side * size * 0.55, size: size,
        lean: (Math.random() - 0.5) * 0.35 + side * 0.2,
        sp: sp, t: -i * 0.25   // t negatif = petit decalage de pousse dans la grappe
      });
    }
    var alive = mushrooms.filter(function (m) { return !m.dying && !m.treasure; });
    for (i = 0; i < alive.length - MAX_MUSHROOMS; i++) alive[i].dying = true;
    startLoop();
  }

  // --- Rendu -------------------------------------------------------------------------
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // Pendant la montee du lit de terre, tout le sol est decale vers le bas.
    var rise = soilRiseT < 1 ? Math.pow(1 - soilRiseT, 3) * soilDepth : 0;
    drawSoil(rise);
    for (var i = 0; i < shards.length; i++) {
      var s = shards[i], m = s.mix, p = s.pts;
      var sy = s.y + (s.soil && s.settled ? rise : 0);
      ctx.fillStyle = 'rgb(' + (lerp(s.from[0], s.to[0], m) | 0) + ',' + (lerp(s.from[1], s.to[1], m) | 0) + ',' + (lerp(s.from[2], s.to[2], m) | 0) + ')';
      var c = Math.cos(s.rot), sn = Math.sin(s.rot);
      ctx.beginPath();
      ctx.moveTo(s.x + p[0][0] * c - p[0][1] * sn, sy + p[0][0] * sn + p[0][1] * c);
      ctx.lineTo(s.x + p[1][0] * c - p[1][1] * sn, sy + p[1][0] * sn + p[1][1] * c);
      ctx.lineTo(s.x + p[2][0] * c - p[2][1] * sn, sy + p[2][0] * sn + p[2][1] * c);
      ctx.closePath();
      ctx.fill();
    }
    // Apres les facettes : les champignons sortent PAR-DESSUS la terre.
    for (i = 0; i < mushrooms.length; i++) drawMushroom(mushrooms[i]);
    drawShovel();
    positionTreasureOverlays();
  }

  // Corps du tas : bande de triangles plats entre la crete et le bas du canvas,
  // echantillonnee grossierement pour garder l'aspect facette.
  function drawSoil(rise) {
    var stepX = 14, pts = [];
    for (var x = 0; x <= W + stepX; x += stepX) {
      var cx = Math.min(x, W);
      pts.push([cx, surfaceAt(cx) + 4 + rise]);
    }
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1];
      if (a[1] >= H && b[1] >= H) continue;
      ctx.fillStyle = SOIL[i % SOIL.length];
      poly([a, b, [a[0], H]]);
      ctx.fillStyle = SOIL[(i + 1) % SOIL.length];
      poly([b, [b[0], H], [a[0], H]]);
    }
  }

  function drawMushroom(m) {
    var t = Math.max(0, Math.min(1, m.t));
    if (t <= 0) return;
    var g = easeOutBack(t);
    var s = m.size * g;
    var stemH = s * 0.9, stemW = s * 0.22;
    ctx.save();
    ctx.translate(m.x, surfaceAt(m.x) + 6);
    ctx.rotate(m.lean * g);
    // pied : deux facettes (lumiere a gauche, ombre a droite)
    ctx.fillStyle = '#efe6d6';
    poly([[-stemW * 0.6, 0], [0, 0], [0, -stemH], [-stemW * 0.45, -stemH]]);
    ctx.fillStyle = '#d6c8b0';
    poly([[0, 0], [stemW * 0.6, 0], [stemW * 0.45, -stemH], [0, -stemH]]);
    // lamelles
    var capW = s * 0.95, capY = -stemH, capH = s * 0.55;
    ctx.fillStyle = m.sp.gill;
    poly([[-capW, capY], [capW, capY], [0, capY + s * 0.12]]);
    // chapeau : eventail de triangles, eclaire en haut-gauche
    var cap = hexToRgb(m.sp.cap), segs = 6;
    for (var i = 0; i < segs; i++) {
      var a0 = Math.PI + (i / segs) * Math.PI, a1 = Math.PI + ((i + 1) / segs) * Math.PI;
      ctx.fillStyle = rgbStr(shade(cap, 0.28 - (i / (segs - 1)) * 0.5));
      poly([[0, capY], [Math.cos(a0) * capW, capY + Math.sin(a0) * capH], [Math.cos(a1) * capW, capY + Math.sin(a1) * capH]]);
    }
    ctx.restore();
  }

  function poly(p) {
    ctx.beginPath();
    ctx.moveTo(p[0][0], p[0][1]);
    for (var i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
    ctx.closePath();
    ctx.fill();
  }

  // --- Tresors enfouis ---------------------------------------------------------------
  // Le reperage (petite facette qui scintille) et l'infobulle sont du HTML par-dessus
  // le canvas, pas du dessin : texte net, lien cliquable, et l'animation CSS du
  // scintillement ne force pas la boucle de rendu a tourner en continu.
  function setupTreasures() {
    clearTreasures();
    treasures = treasureDefs.map(function (def) {
      var glint = document.createElement('span');
      glint.className = 'logo-explosion-glint';
      glint.setAttribute('aria-hidden', 'true');
      container.appendChild(glint);
      return { def: def, x: logoLeft + def.x * logoWidth, dig: 0, revealed: false, mushroom: null, glint: glint, tip: null };
    });
    // On laisse la terre retomber avant de montrer ou creuser.
    setTimeout(function () {
      if (mode !== 'exploded') return;
      treasures.forEach(function (t) { if (!t.revealed) t.glint.classList.add('is-visible'); });
      positionTreasureOverlays();
    }, 1600);
  }

  function clearTreasures() {
    treasures.forEach(function (t) {
      t.glint.remove();
      if (t.tip) t.tip.remove();
    });
    treasures = [];
  }

  function treasureNear(x, y) {
    for (var i = 0; i < treasures.length; i++) {
      var t = treasures[i];
      var reach = t.revealed ? t.mushroom.size * 1.5 : 50;
      if (Math.abs(x - t.x) < 36 && y > surfaceAt(t.x) - reach) return t;
    }
    return null;
  }

  // Coup de pelle : les facettes posees autour du tresor sont projetees vers
  // l'exterieur (pas vers le haut, sinon elles retombent dans le trou).
  function digAt(t) {
    var sy = surfaceAt(t.x), R = isMobile ? 30 : 42;
    for (var i = 0; i < shards.length; i++) {
      var s = shards[i];
      if (!s.settled || Math.hypot(s.x - t.x, s.y - sy) > R) continue;
      var side = s.x === t.x ? (Math.random() < 0.5 ? -1 : 1) : (s.x < t.x ? -1 : 1);
      pileRemove(s);
      s.settled = false;
      s.vx = side * (1.5 + Math.random() * 2.5);
      s.vy = -3 - Math.random() * 3;
      s.vr = (Math.random() - 0.5) * 0.4;
    }
    startLoop();
  }

  function tryDig(t, amount) {
    if (t.revealed) return;
    t.dig += amount;
    if (t.dig >= DIG_TO_REVEAL) reveal(t);
  }

  function reveal(t) {
    t.revealed = true;
    t.glint.classList.remove('is-visible');
    digAt(t);
    // t negatif : le trou s'ouvre d'abord, le champignon sort ensuite.
    t.mushroom = { x: t.x, size: H * 0.24, lean: 0, sp: SPECIES[t.def.species] || SPECIES[0], t: -0.4, treasure: true };
    mushrooms.push(t.mushroom);
    t.tip = buildTip(t.def);
    container.appendChild(t.tip);
    openTip(t);
    startLoop();
  }

  function buildTip(def) {
    var tip = document.createElement('div');
    tip.className = 'logo-explosion-tip';
    if (def.img) {
      var im = document.createElement('img');
      im.src = def.img;
      im.alt = '';
      tip.appendChild(im);
    }
    var body = document.createElement('div');
    body.className = 'logo-explosion-tip-body';
    var title = document.createElement('strong');
    title.textContent = def.title || '';
    body.appendChild(title);
    if (def.text) {
      var p = document.createElement('p');
      p.textContent = def.text;
      body.appendChild(p);
    }
    if (def.url) {
      var a = document.createElement('a');
      a.href = def.url;
      a.textContent = def.cta || 'Voir le produit';
      body.appendChild(a);
    }
    tip.appendChild(body);
    return tip;
  }

  // Une seule infobulle ouverte a la fois : les tresors sont proches, elles se chevaucheraient.
  function openTip(active) {
    treasures.forEach(function (t) {
      if (t.tip) t.tip.classList.toggle('is-open', t === active);
    });
  }

  function positionTreasureOverlays() {
    for (var i = 0; i < treasures.length; i++) {
      var t = treasures[i];
      if (!t.revealed) {
        t.glint.style.left = t.x + 'px';
        t.glint.style.top = (surfaceAt(t.x) - 2) + 'px';
        continue;
      }
      if (!t.tip) continue;
      var m = t.mushroom;
      var g = easeOutBack(Math.max(0, Math.min(1, m.t)));
      var capTop = surfaceAt(m.x) + 6 - m.size * g * 1.45;
      var half = t.tip.offsetWidth / 2;
      var left = Math.max(half + 8, Math.min(W - half - 8, m.x));
      t.tip.style.left = left + 'px';
      t.tip.style.top = (capTop - 16) + 'px';
      t.tip.style.setProperty('--arrow-dx', (m.x - left) + 'px');
    }
  }

  // --- Reconstruction ----------------------------------------------------------------
  function rebuild() {
    if (mode !== 'exploded') return;
    mode = 'rebuilding';
    rebuildT = 0;
    for (var i = 0; i < shards.length; i++) {
      var s = shards[i];
      s.sx = s.x; s.sy = s.y; s.srot = s.rot; s.smix = s.mix;
      s.delay = Math.random() * 0.35;
    }
    leaveShovel();
    clearTreasures();
    if (rebuildBtn) rebuildBtn.classList.add('d-none');
    startLoop();
  }

  function stepRebuild() {
    rebuildT += 1 / 70;
    // Le tas s'enfonce avec le lit de terre, qui redescend d'ou il etait monte.
    for (var i = 0; i < heights.length; i++) heights[i] *= 0.9;
    for (i = 0; i < shards.length; i++) {
      var s = shards[i];
      var t = easeInOut(Math.max(0, Math.min(1, (rebuildT - s.delay) / 0.65)));
      s.x = lerp(s.sx, s.ox, t);
      // Logo : petit arc vers le haut. Lit de terre : retour a sa place puis sous le bord.
      s.y = s.soil ? lerp(s.sy, s.oy + soilDepth, t) : lerp(s.sy, s.oy, t) - Math.sin(t * Math.PI) * 40;
      s.rot = lerp(s.srot, 0, t);
      s.mix = lerp(s.smix, 0, t);
    }
    mushrooms.forEach(function (m) { m.t -= 0.06; });
    mushrooms = mushrooms.filter(function (m) { return m.t > 0; });
    if (rebuildT < 1) return true;
    resetToLogo();
    return false;
  }

  function resetToLogo() {
    mode = 'assembled';
    canvas.classList.add('d-none');
    fallbackImg.classList.remove('d-none');
    leaveShovel();
    clearTreasures();
    if (rebuildBtn) rebuildBtn.classList.add('d-none');
    shards = [];
    mushrooms = [];
  }

  // --- Evenements --------------------------------------------------------------------
  function getRelativePos(evt) {
    // container plutot que canvas : le canvas est en d-none (rect a 0) avant le clic.
    var rect = container.getBoundingClientRect();
    var p = evt.touches ? evt.touches[0] : evt;
    return { x: p.clientX - rect.left, y: p.clientY - rect.top };
  }

  container.addEventListener('click', function (evt) {
    // Le bouton et les infobulles sont dans la boite : leurs clics ne creusent pas.
    if (evt.target.closest('#logo-explosion-rebuild, .logo-explosion-tip')) return;
    var pos = getRelativePos(evt);
    if (mode === 'assembled') {
      if (imgReady && build()) explode(pos.x, pos.y);
      return;
    }
    // Une fois explose, tout passe par les evenements pointer du canvas (pelle + taps).
  });

  // Pointer events : meme code pour souris, doigt et stylet.
  // Souris : la pelle suit le survol, bouton maintenu = elle ralentit (mode precis).
  // Doigt : le bol suit le doigt, doigt leve = il se vide puis disparait.
  canvas.addEventListener('pointerdown', function (evt) {
    if (mode !== 'exploded') return;
    var pos = getRelativePos(evt);
    try { canvas.setPointerCapture(evt.pointerId); } catch (e) { /* pas grave */ }
    if (!shovel.on) enterShovel(pos);
    shovel.gx = pos.x; shovel.gy = pos.y;
    shovel.held = evt.pointerType === 'mouse';
    shovel.pouring = false; shovel.hideWhenEmpty = false;
    pointerDown = pos;
    dragMoved = false;
    startLoop();
  });

  canvas.addEventListener('pointermove', function (evt) {
    if (mode !== 'exploded') return;
    var pos = getRelativePos(evt);
    if (!shovel.on) enterShovel(pos);
    shovel.gx = pos.x; shovel.gy = pos.y;
    if (pointerDown && Math.hypot(pos.x - pointerDown.x, pos.y - pointerDown.y) > 6) dragMoved = true;
    startLoop();
  });

  function endPress(evt, allowTap) {
    if (!pointerDown) return;
    shovel.held = false;
    if (allowTap && !dragMoved) handleTap(getRelativePos(evt));
    if (evt.pointerType !== 'mouse' && shovel.on) {
      shovel.pouring = true;
      shovel.hideWhenEmpty = true;
    }
    pointerDown = null;
    startLoop();
  }
  canvas.addEventListener('pointerup', function (evt) { endPress(evt, true); });
  canvas.addEventListener('pointercancel', function (evt) { endPress(evt, false); });
  canvas.addEventListener('pointerleave', function (evt) {
    if (evt.pointerType === 'mouse' && !pointerDown) leaveShovel();
  });

  if (rebuildBtn) rebuildBtn.addEventListener('click', rebuild);

  // Toutes les positions sont en px de la taille au moment du clic : si la LARGEUR
  // change (rotation, fenetre), on revient simplement au logo net. La hauteur seule
  // est ignoree, elle bouge a chaque apparition de la barre d'adresse sur mobile.
  var lastWidth = container.getBoundingClientRect().width;
  var resizeTimeout = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(function () {
      var w = container.getBoundingClientRect().width;
      if (w === lastWidth) return;
      lastWidth = w;
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      resetToLogo();
    }, 200);
  });

})();
