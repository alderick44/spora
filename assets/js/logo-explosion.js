(function () {
  'use strict';

  var container = document.getElementById('logo-explosion');
  if (!container) return;

  var canvas = container.querySelector('#logo-explosion-canvas');
  var fallbackImg = container.querySelector('#logo-explosion-fallback');
  var rebuildBtn = document.getElementById('logo-explosion-rebuild');
  var scrollLeftBtn = document.getElementById('logo-explosion-scroll-left');
  var scrollRightBtn = document.getElementById('logo-explosion-scroll-right');
  var scrollUpBtn = document.getElementById('logo-explosion-scroll-up');
  var scrollDownBtn = document.getElementById('logo-explosion-scroll-down');
  var toolsBar = document.getElementById('logo-explosion-tools');
  var toolBtns = toolsBar ? toolsBar.querySelectorAll('[data-tool]') : [];
  var speedWrap = document.getElementById('logo-explosion-speed-wrap');
  var speedInput = document.getElementById('logo-explosion-speed');
  var speedVal = document.getElementById('logo-explosion-speed-val');
  var caption = document.getElementById('logo-explosion-caption');
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

  // Legende sous la boite : indique quoi faire puis ce qui se passe, mise a jour aux
  // moments cles (image prete, explosion, premier champignon issu du mycelium, rebuild).
  var CAPTION_BEFORE = isMobile ? 'Touchez le logo' : 'Cliquez sur le logo';
  var CAPTION_EXPLODED = 'Creusez avec la pelle pour trouver les trésors, ou versez du mycélium.';
  var CAPTION_MYC = 'Le mycélium transforme le bois mort en sol vivant, et nourrit les arbres.';
  function setCaption(text) { if (caption) caption.textContent = text; }

  // Style low-poly : uniquement des triangles a couleur pleine (pas de degrade,
  // pas de flou). La variation de ton d'une facette a l'autre suffit a donner du relief.
  var CELLS_ACROSS = 110;                 // nb de facettes sur la largeur du logo
  var GRAVITY = 0.32;
  var AIR = 0.992;
  var COL_W = 6;                          // resolution de la carte de hauteurs du tas
  var EARTH = ['#6b4a30', '#7c5a3a', '#5a3d28', '#8a6239', '#4f3622'];
  var SOIL = ['#5a3d28', '#6b4a30', '#4a3220'];
  // Terre dure en profondeur (etape 2 du defilement vertical) : plus foncee, plus
  // uniforme (moins de variation de teinte que EARTH) — pauvre, compacte, pas la terre
  // riche de surface. Genere a la volee, seulement la ou la pelle creuse sous le niveau
  // d'origine (voir spawnHardShard) : trop couteux de pre-generer tout le fond du monde.
  var HARD_EARTH = ['#3a2c1f', '#332619', '#41311f', '#2e2216'];
  var HARD_HP = 3;                        // coups de pelle pour deloger une facette de terre dure
  var HARD_SPAWN_EPS = 1.5;               // heights[] en-dessous de ce seuil = colonne a nu, prete a faire apparaitre du dur
  var BEDROCK_MARGIN = 40;                // marge (px) avant le fond du monde ou plus rien n'apparait (roche-mere)
  var HARD_DIG_STEP = COL_W;              // de combien le trou descend (pitDepth) chaque fois qu'une facette de terre dure cede
  var SPECIES = [
    { cap: '#9a948c', gill: '#d9d2c5' },  // pleurote gris
    { cap: '#e58a9b', gill: '#f6c9d1' },  // pleurote rose
    { cap: '#f1e6d2', gill: '#ffffff' },  // hydne herisson
    { cap: '#c9a27a', gill: '#efdcc2' },  // pleurote huitre
    { cap: '#8a5a3b', gill: '#e4cfb2' }   // shiitake
  ];
  var MAX_MUSHROOMS = 36;
  var MUSHROOM_STARVE_MS = 10000;         // un champignon issu du mycelium (pas plante a la main) fane sans mycelium a portee pendant ce temps

  // Mycelium en vrac : le sac verse des grains qui inoculent les facettes ou ils tombent.
  // Une facette colonisee blanchit peu a peu et gagne ses voisines, lentement ; quand
  // assez de surface est blanche a un endroit, des champignons y sortent.
  var MYC = [243, 238, 226];              // blanc du mycelium
  var GRAIN = ['#f3eee2', '#e8dfcc', '#fbf8f0', '#d9cdb3'];
  var MYC_GROW = 0.005;                   // blanchiment d'une facette par frame (~3 s pour etre pleine)
  var MYC_READY = 0.45;                   // seuil a partir duquel une facette gagne ses voisines
  var MYC_SPREAD_EVERY = 8;               // la propagation se calcule toutes les N frames
  var MYC_SPREAD_P = 0.3;                 // chance, par passage, de gagner une voisine
  var MYC_RADIUS = 0.4;                   // portee max depuis le point d'inoculation (x hauteur)
  var FRUIT_W = 0.22;                     // largeur d'une zone de fructification (x hauteur)
  var FRUIT_MIN = 6;                      // facettes de surface colonisees pour faire sortir une grappe
  // MYC_DECOMPOSE_REACH et MYC_STARVE_MS doivent rester coherents avec le rythme naturel
  // de chute des feuilles (LEAF_LIFE_MS, 25-45s) : une feuille tombee dure ~21s de
  // decomposition (LITTER_MS/MYC_DECOMPOSE_MULT), mais entre deux feuilles qui tombent au
  // MEME endroit il peut s'ecouler largement plus que ca (elles tombent un peu partout
  // sous le houppier). Un mycelium avec un rayon/delai de grace trop serres meurt de faim
  // entre deux arrivees de bois, meme si le systeme produit bien assez de bois au total.
  var MYC_DECOMPOSE_REACH = 90;           // portee (px) a laquelle le mycelium decompose du bois au sol (large : couvre tout le pied du houppier, pas juste un point)
  var MYC_DECOMPOSE_MULT = 14;            // vitesse de decomposition du bois pres du mycelium vs tout seul
  var MYC_STARVE_MS = 90000;              // sans bois a portee pendant ce temps, le mycelium s'eteint (au-dela de l'ecart naturel entre deux feuilles qui tombent, 25-45s)
  var MYC_DECAY = 0.006;                  // vitesse a laquelle un mycelium affame s'eteint (par frame)
  var MYC_ACTIVE_FEED_MS = 3000;          // fenetre "activement nourri" : au-dela, une facette peut encore survivre sur sa reserve mais ne colonise plus de terre neuve
  var tool = 'shovel';                    // 'shovel' | 'mycelium'
  var colonised = [], fruited = {}, frame = 0, mycBusyUntil = 0;

  // Horloge virtuelle : tout le "temps reel" (ms) du cycle bois/mycelium/arbres (litiere,
  // faim du mycelium, pousse des feuilles...) passe par vTime plutot que
  // performance.now() directement, pour pouvoir l'accelerer avec le slider de debug
  // (#logo-explosion-speed) sans toucher a la physique image par image (gravite, pelle).
  var timeScale = 1, vTime = 0, lastRealNow = null;

  // Cycle des nutriments : le mycelium decompose du BOIS (feuilles tombees, voir
  // MYC_DECOMPOSE_*) ou meurt de faim et devient lui-meme nutriment (necromasse) — jamais
  // la terre elle-meme, qui n'a pas de valeur nutritive en soi. Les racines d'un arbre
  // absorbent ce nutriment et en font une feuille, qui vieillit (vert tendre -> vert ->
  // jaune -> roux), tombe et redevient du bois a decomposer. Tout ce qui est lent ici se
  // mesure en temps reel (ms), pas en frames : quand il ne reste que ca a animer, la
  // boucle ralentit a quelques images par seconde.
  var NUTRI = ['#2a1d14', '#1f1610', '#33241a']; // humus : terre noire, riche
  // Portee de RECHERCHE des racines (invisible, x largeur de la boite W) : le monde est
  // bien plus large que haut, un arbre mature doit pouvoir trouver du nutriment loin de
  // lui. La longueur VISUELLE des racines dessinees est volontairement plus courte
  // (ROOT_VISUAL_REACH, x hauteur H) : les etirer jusqu'a la portee de recherche donnait
  // des barres quasi droites traversant toute la scene (repere : capture d'ecran du
  // 2026-09-25).
  var ROOT_REACH = 0.7;                   // portee de recherche de nutriment une fois l'arbre mature (x largeur de la boite)
  var ROOT_VISUAL_REACH = 0.6;            // longueur des racines DESSINEES une fois mature (x hauteur de la boite)
  var EAT_MS = 1200;                      // un nutriment absorbe au plus toutes les EAT_MS
  // Croissance : plus un arbre a mange de nutriments (t.eaten), plus t.growth (0..1) monte,
  // et plus ses racines vont chercher loin, plus il peut porter de feuilles, plus il est grand.
  var MATURE_NUTRIENTS = 12;              // nutriments manges pour atteindre la pleine croissance
  var ROOT_GROWTH_MIN = 0.15;             // longueur des racines a la naissance (fraction de leur taille mature)
  var LEAF_UNLOCK_MIN = 8;                // places de feuilles utilisables a la naissance (sur 40)
  var TREE_SCALE_MIN = 0.3;               // taille du tronc/houppier a la naissance (fraction de la taille de reference)
  var TREE_SCALE_MAX = 1.6;               // taille du tronc/houppier une fois bien nourri (fraction de la taille de reference)
  var MAX_TREES = 6;                      // nombre max d'arbres (2 de depart + ceux plantes par le joueur)
  var TREE_MIN_SPACING = 90;              // distance minimale (px monde) entre deux arbres plantes
  // La base de l'arbre (t.by) suit le niveau du sol SOUS elle avec un delai plutot que de
  // recalculer surfaceAt(t.x) brut a chaque frame : sinon, remuer la terre pres du tronc
  // (pelle) le fait sauter haut/bas tres vite. Embed un peu plus profond que l'ancien +8 :
  // un arbre legerement enfonce dans le sol semble mieux ancre.
  var TREE_EMBED = 14;                    // enfoncement du pied du tronc sous la surface (px)
  var TREE_BY_FOLLOW = 0.04;              // vitesse (par frame) a laquelle t.by rattrape le niveau du sol
  var EATEN_MS = 450;                     // duree de l'absorption (la facette retrecit)
  var LEAF_GROW_MS = 700;
  var LEAF_LIFE_MS = [25000, 45000];      // duree de vie d'une feuille (min, max)
  var LITTER_MS = 300000;                 // une feuille tombee loin de tout mycelium redevient humus toute seule, tres lentement (5 min, comme dans la vraie vie) ; le mycelium a proximite accelere fortement ce delai (MYC_DECOMPOSE_MULT)
  var LEAF_AGES = [[0, [156, 204, 90]], [0.25, [86, 150, 60]], [0.65, [62, 120, 50]], [0.82, [217, 169, 46]], [1, [184, 97, 42]]];
  var trees = [], litter = [], treeLife = false, slowTimer = null;
  var DIG_TO_REVEAL = 3;                  // coups de pelle (clic/tap) pour deterrer un tresor

  // "Camera" : le monde (terre + tresors) est plus large ET plus profond que la boite
  // visible. camX/camY sont le decalage (en px monde) affiche a l'ecran ; tout se dessine
  // translate de (-camX, -camY). Horizontal : le monde deborde des deux cotes, camX est
  // centre au depart. Vertical : rien d'utile au-dessus du sol, donc camY part a 0 (vue de
  // depart identique a avant) et ne descend QUE vers le bas pour reveler de la profondeur
  // (etape 1 : juste le defilement, la vraie couche profonde creusable viendra apres).
  var WORLD_MULT = 3;                     // largeur du monde = WORLD_MULT x largeur de la boite
  var DEPTH_MULT = 1;                     // profondeur ajoutee sous la boite = DEPTH_MULT x hauteur de la boite
  var CAMERA_EDGE = 0.28;                 // fraction de la largeur/hauteur de la boite ou le defilement s'active, depuis chaque bord
  var CAMERA_MAX = 3.2;                   // vitesse max de defilement horizontal (px monde / frame)
  var CAMERA_MAX_Y = 2.4;                 // vitesse max de defilement vertical (px monde / frame)
  var worldW = 0, camMargin = 0, camX = 0;
  var worldH = 0, camY = 0;
  var hoverScreenX = null, hoverScreenY = null; // position souris (coord. ecran), pour le defilement aux bords
  var mobileArrow = 0;                    // -1/0/1 : fleches tactiles mobiles maintenues (horizontal)
  var mobileArrowY = 0;                   // -1/0/1 : fleches tactiles mobiles maintenues (vertical)

  // "Tresors" enfouis dans le tas : un champignon + une infobulle (produit, conseil...).
  // x = position en fraction de la LARGEUR DU MONDE ; species = index dans SPECIES.
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
  // Bulle produit sur le premier champignon issu du mycelium verse (pas un tresor : pas
  // de def.x/species, juste une infobulle qui suit ce champignon-la). Voir sprout().
  var mycTip = null, mycTipMushroom = null, mycTipShown = false;

  var W = 0, H = 0, groundY = 0;
  var shards = [], heights = [], mushrooms = [];
  var hardFrontier = [];                  // par colonne : la facette de terre dure en cours (ou null)
  // heights[] garde son plancher a 0 (Math.max dans applyKernel) : ne pas y toucher, tout
  // le reste du tas (repos, kernel de propagation) en depend. La profondeur d'un trou
  // creuse dans la roche-mere est trackee a part, colonne par colonne, et s'ajoute a
  // surfaceAt : ainsi de la terre meuble qui retombe dans le trou peut encore le remplir
  // partiellement (heights remonte) sans que pitDepth ne bouge.
  var pitDepth = [];
  var mode = 'assembled';                 // 'assembled' | 'exploded' | 'rebuilding'
  var rafId = null, speciesIdx = 0, rebuildT = 0;
  var paused = false, wasRunningBeforeHide = false; // en pause : hors viewport ou onglet cache

  var img = new Image();
  var imgReady = false;
  img.onload = function () {
    imgReady = true;
    // Canvas pret : on montre la legende, cachee par defaut pour les visiteurs
    // reduced-motion / no-JS qui ne verront jamais l'animation tourner.
    setCaption(CAPTION_BEFORE);
    if (caption) caption.classList.remove('d-none');
  };
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
    // Le monde deborde de la boite ; la boite est centree dedans au depart.
    worldW = W * WORLD_MULT;
    camMargin = (worldW - W) / 2;
    camX = camMargin;
    worldH = H + H * DEPTH_MULT;
    camY = 0;
    groundY = H - 6;
    heights = new Float32Array(Math.ceil(worldW / COL_W) + 1);
    hardFrontier = new Array(heights.length).fill(null);
    pitDepth = new Float32Array(heights.length);

    // Profil : couche de base ondulee + bosse centrale sous le logo (au centre du monde).
    var base = H * 0.07, bump = H * 0.08, phase = Math.random() * 10;
    function profile(x) {
      var u = x / worldW;
      var mound = Math.exp(-Math.pow((u - 0.5) / 0.3, 2));
      var wave = Math.sin(u * 9 + phase) * 0.25 + Math.sin(u * 23 + phase * 2) * 0.12;
      return base * (1 + wave) + bump * mound;
    }
    // Profil provisoire, seulement pour trier les triangles sous la crete ; la vraie
    // carte de hauteurs est ensuite reconstruite a partir des facettes gardees.
    for (var c = 0; c < heights.length; c++) heights[c] = profile(c * COL_W);
    soilDepth = base * 1.4 + bump + 10;

    // Maillage low-poly (sommets partages et decales) sur toute la largeur du MONDE,
    // puis on ne garde que les triangles sous la crete : leurs pointes forment une
    // crete dentelee. Coordonnees x en px monde (0..worldW), pas de decalage camera ici.
    var cell = Math.max(6, W / 160);
    var rows = Math.ceil((base * 1.4 + bump + 6) / cell), cols = Math.ceil(worldW / cell);
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

  // Fait apparaitre un chunk de terre dure a la colonne c (voir bowlWakePile) : contrairement
  // a la terre de surface (deja toute generee dans setupSoil), la couche profonde est
  // generee a la demande, seulement la ou la pelle creuse vraiment sous le niveau
  // d'origine — sinon il faudrait pre-generer un maillage sur toute la profondeur du
  // monde, bien trop de facettes pour rien (la plupart jamais vues).
  function spawnHardShard(c) {
    var x = c * COL_W, y = surfaceAt(x) - 1;
    var size = COL_W * (1.1 + Math.random() * 0.5);
    var pts = [[-size * 0.55, size * 0.32], [size * 0.55, size * 0.32], [(Math.random() - 0.5) * size * 0.3, -size * 0.55]];
    var color = shade(hexToRgb(HARD_EARTH[(Math.random() * HARD_EARTH.length) | 0]), (Math.random() - 0.5) * 0.12);
    var s = {
      pts: pts, ox: x, oy: y, x: x, y: y, vx: 0, vy: 0, rot: 0, vr: 0,
      from: color, to: color, mix: 1, area: triArea(pts),
      settled: true, col: c, hard: true, hp: HARD_HP
    };
    shards.push(s);
    pileAdd(s);
    hardFrontier[c] = s;
  }

  // Construit au moment du clic (pas au chargement) : la boite et le fallback sont
  // alors forcement mesures a leur vraie taille.
  function build() {
    var rect = container.getBoundingClientRect();
    setupSoil(rect);

    // Le logo est place exactement la ou le CSS affiche le fallback (encore visible
    // a ce moment-la) : taille et position se reglent donc uniquement dans style.css.
    // + camMargin : la boite est centree dans le monde, donc le logo aussi.
    var fr = fallbackImg.getBoundingClientRect();
    var lx = fr.left - rect.left + camMargin, oy = fr.top - rect.top, lw = fr.width, lh = fr.height;
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
    return groundY - heights[c] + pitDepth[c];
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
    if (toolsBar) toolsBar.classList.remove('d-none');
    if (speedWrap) speedWrap.classList.remove('d-none');
    if (scrollLeftBtn) scrollLeftBtn.classList.remove('d-none');
    if (scrollRightBtn) scrollRightBtn.classList.remove('d-none');
    if (scrollUpBtn) scrollUpBtn.classList.remove('d-none');
    if (scrollDownBtn) scrollDownBtn.classList.remove('d-none');
    setupTreasures();
    // Un arbre visible a gauche du logo, un autre plus loin a droite dans le monde.
    trees = [makeTree(camMargin + W * 0.14), makeTree(camMargin + W * 1.35)];
    litter = [];
    setCaption(CAPTION_EXPLODED);
    startLoop();
  }

  // Vitesse de defilement selon la position ecran du curseur : nulle au centre, augmente
  // en approchant des CAMERA_EDGE derniers % de chaque bord de la boite.
  function cameraSpeed(screenX) {
    var edge = W * CAMERA_EDGE;
    if (screenX < edge) {
      var k = 1 - screenX / edge;
      return -CAMERA_MAX * k * k;
    }
    if (screenX > W - edge) {
      var k2 = 1 - (W - screenX) / edge;
      return CAMERA_MAX * k2 * k2;
    }
    return 0;
  }

  // Meme logique, axe vertical : pres du haut de la boite ca remonte (camY vers 0), pres
  // du bas ca descend (camY vers worldH - H, plus profond).
  function cameraSpeedY(screenY) {
    var edge = H * CAMERA_EDGE;
    if (screenY < edge) {
      var k = 1 - screenY / edge;
      return -CAMERA_MAX_Y * k * k;
    }
    if (screenY > H - edge) {
      var k2 = 1 - (H - screenY) / edge;
      return CAMERA_MAX_Y * k2 * k2;
    }
    return 0;
  }

  function step() {
    var camMoving = false;
    if (mode === 'exploded') {
      // La souris ne bouge pas forcement pendant qu'on defile : on garde sa derniere
      // position ecran connue et on la reconvertit en coord. monde a chaque frame, pour
      // que la pelle reste sous le curseur meme quand le monde glisse dessous.
      if (hoverScreenX !== null) {
        shovel.gx = bag.x = hoverScreenX + camX;
        shovel.gy = bag.y = hoverScreenY + camY;
      }
      var camV = mobileArrow ? mobileArrow * CAMERA_MAX : (hoverScreenX !== null ? cameraSpeed(hoverScreenX) : 0);
      if (camV) {
        var newCamX = clamp(camX + camV, 0, worldW - W);
        if (newCamX !== camX) camMoving = true;
        camX = newCamX;
      }
      var camVY = mobileArrowY ? mobileArrowY * CAMERA_MAX_Y : (hoverScreenY !== null ? cameraSpeedY(hoverScreenY) : 0);
      if (camVY) {
        var newCamY = clamp(camY + camVY, 0, worldH - H);
        if (newCamY !== camY) camMoving = true;
        camY = newCamY;
      }
    }
    // Tant que la pelle est a l'ecran ou que le monde defile, la boucle tourne.
    frame++;
    var realNow = performance.now();
    if (lastRealNow === null) lastRealNow = realNow;
    // Plafonne le delta reel avant de l'accelerer : sinon un long moment sans frame (onglet
    // en arriere-plan, boucle a l'arret le temps qu'on interagisse de nouveau) ferait
    // exploser vTime d'un coup une fois multiplie par timeScale. 500ms passe large au-dessus
    // du tick de la boucle lente (slowTimer, 250ms) pour ne pas la ralentir artificiellement.
    vTime += Math.min(realNow - lastRealNow, 500) * timeScale;
    lastRealNow = realNow;
    var now = vTime;
    var active = shovel.on || bag.on || camMoving;
    if (bag.on) updateBag();
    if (shovel.on) {
      updateShovel();
      if (shovel.on) bowlWakePile(); // updateShovel peut la ranger (fin de versement au doigt)
    }
    var anyDead = false;
    for (var i = 0; i < shards.length; i++) {
      var s = shards[i];
      if (s.settled) continue;
      active = true;
      if (s.eaten !== undefined) {
        // Absorbee par une racine : elle retrecit sur place puis disparait.
        if (now - s.eaten > EATEN_MS) { s.dead = true; anyDead = true; }
        continue;
      }
      s.px = s.x; s.py = s.y;
      if (shovel.on) bladeField(s);
      if (s.leaf) {
        // Une feuille plane : chute lente, se balance de gauche a droite.
        // Vent : toujours un sens (qui s'inverse toutes les ~60 s), par rafales. Chaque
        // feuille a sa prise au vent (s.gust) : la plupart tombent pres, certaines partent loin.
        var wind = (Math.sin(now / 20000) >= 0 ? 1 : -1) * (0.4 + 0.3 * (1 + Math.sin(now / 1700 + s.sway)));
        s.vy += GRAVITY * 0.1 / (1 + s.gust * 0.4); s.vy *= 0.94;
        s.vx = s.vx * 0.95 + Math.sin(now / 350 + s.sway) * 0.1 + wind * (0.02 + s.gust * 0.045);
      } else {
        s.vy += GRAVITY; s.vx *= AIR; s.vy *= AIR;
        s.mix = Math.min(1, s.mix + 0.012);
      }
      s.x += s.vx; s.y += s.vy; s.rot += s.vr;
      if (shovel.on && collideBowl(s)) {
        s.vr *= 0.8;
        continue; // tenue par le bol : pas de contact avec le sol cette frame
      }
      if (s.x < 4) { s.x = 4; s.vx = Math.abs(s.vx) * 0.4; }
      if (s.x > worldW - 4) { s.x = worldW - 4; s.vx = -Math.abs(s.vx) * 0.4; }
      var floor = surfaceAt(s.x);
      if (s.grain) {
        // Un grain ne s'empile pas : il se fond dans la terre et l'inocule.
        if (s.y >= floor) { inoculate(s.x, floor, now); s.dead = true; anyDead = true; }
        continue;
      }
      if (s.y >= floor && s.vy > 0) {
        s.y = floor;
        if (s.vy > 2.5) {
          s.vy *= -0.28; s.vx *= 0.6; s.vr *= 0.5;
        } else {
          s.settled = true; s.vx = s.vy = s.vr = 0;
          // Une feuille garde sa couleur au sol et se decompose lentement (voir stepTrees).
          if (s.leaf) { s.landed = now; if (litter.indexOf(s) < 0) litter.push(s); } else s.mix = 1;
          s.col = restColumn(s.x);
          s.x = (s.col + Math.random() - 0.5) * COL_W;
          s.y = groundY - heights[s.col];
          pileAdd(s);
        }
      }
    }
    if (mode === 'exploded') {
      var tl = stepTrees(now);
      treeLife = tl > 0;
      if (tl === 2) active = true;
    }
    if (anyDead) shards = shards.filter(function (g) { return !g.dead; });
    if (mode === 'exploded' && colonised.length && stepMycelium(now)) active = true;
    if (soilRiseT < 1) {
      soilRiseT = Math.min(1, soilRiseT + 1 / SOIL_RISE_FRAMES);
      active = true;
    }
    // Un champignon sorti du mycelium (pas plante a la main) fane si plus aucun mycelium
    // bien vivant n'est a portee pendant un moment : il ne peut pas survivre sans le
    // reseau qui l'a fait fructifier.
    var mycNearReach = H * FRUIT_W;
    for (i = 0; i < mushrooms.length; i++) {
      var mm = mushrooms[i];
      if (!mm.myc || mm.dying || mm.treasure) continue;
      var nearMyc = false;
      for (var ci = 0; ci < colonised.length; ci++) {
        if (colonised[ci].myc > MYC_READY && Math.abs(colonised[ci].x - mm.x) < mycNearReach) { nearMyc = true; break; }
      }
      if (nearMyc) mm.lastMycNear = now;
      else if (now - mm.lastMycNear > MUSHROOM_STARVE_MS) mm.dying = true;
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
    if (paused) return; // hors viewport ou onglet cache : rien ne doit programmer de frame
    if (rafId !== null) return;
    if (slowTimer !== null) { clearTimeout(slowTimer); slowTimer = null; }
    rafId = requestAnimationFrame(function tick() {
      var active = mode === 'rebuilding' ? stepRebuild() : step();
      if (mode !== 'assembled') draw();
      if (active) { rafId = requestAnimationFrame(tick); return; }
      rafId = null;
      // Il ne reste que des feuilles qui vieillissent : 4 images/s suffisent.
      if (mode === 'exploded' && treeLife) {
        slowTimer = setTimeout(function () { slowTimer = null; startLoop(); }, 250);
      }
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
    container.classList.add('is-tool-cursor');
  }

  function leaveShovel() {
    shovel.on = false; shovel.held = false; shovel.pouring = false; shovel.hideWhenEmpty = false;
    container.classList.remove('is-tool-cursor');
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
    // Remuer de la terre colonisee ne produit plus de nutriment ici : la terre en elle-
    // meme n'a pas de valeur nutritive, seul le bois decompose (ou le mycelium qui meurt
    // de faim) en donne — voir stepTrees/stepMycelium.
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
      if (s.hard && s.hp > 1) { s.hp--; continue; } // terre dure : resiste, il faut repasser
      if (s.hard) {
        // Dernier coup : la colonne descend d'un cran pour de bon (pitDepth), la facette
        // elle-meme se detache et devient une facette de terre normale a partir d'ici.
        hardFrontier[s.col] = null;
        s.hard = false;
        pitDepth[s.col] += HARD_DIG_STEP;
      }
      pileRemove(s);
      s.settled = false;
      s.vx = s.vy = 0;
      s.px = s.x; s.py = s.y;
      woke.push(s);
    }
    // Front de creusage : la ou la pelle presse une colonne deja a nu (plus rien a
    // retirer) et qu'on n'a pas atteint la roche-mere, une nouvelle facette de terre dure
    // apparait — c'est elle qu'il faudra deloger pour continuer a descendre.
    var bowlHalfW = R * Math.sin(BOWL_SPAN);
    var c0 = Math.max(0, Math.round((shovel.cx - bowlHalfW) / COL_W));
    var c1 = Math.min(heights.length - 1, Math.round((shovel.cx + bowlHalfW) / COL_W));
    for (var c = c0; c <= c1; c++) {
      if (heights[c] > HARD_SPAWN_EPS || hardFrontier[c]) continue;
      var sx = c * COL_W, sy = surfaceAt(sx);
      if (sy >= worldH - BEDROCK_MARGIN) continue; // roche-mere
      if (shovel.cy < sy - 16) continue; // la pelle ne touche pas vraiment cette colonne
      spawnHardShard(c);
    }
    if (!woke.length) return;
    // La pelle qui passe sous un champignon le brise (sauf les tresors, qui portent l'infobulle).
    for (i = 0; i < mushrooms.length; i++) {
      var mu = mushrooms[i];
      if (mu.treasure || mu.dying || mu.t < 0.5) continue;
      if (Math.abs(mu.x - shovel.cx) < R * Math.sin(BOWL_SPAN) + mu.size * 0.3) breakMushroom(mu);
    }
    // Deplacer de la terre au-dessus d'un tresor le deterre peu a peu.
    for (i = 0; i < treasures.length; i++) {
      var t = treasures[i];
      if (t.revealed) continue;
      var near = woke.filter(function (m) { return Math.abs(m.x - t.x) < 30; }).length;
      if (near) tryDig(t, Math.min(0.12, near * 0.01));
    }
  }

  // Le champignon disparait d'un coup et eclate en quelques facettes a ses couleurs,
  // qui retombent et virent a la terre comme celles du logo.
  function breakMushroom(m) {
    m.dying = true; m.t = 0;
    var base = surfaceAt(m.x) + 6, cols = [hexToRgb(m.sp.cap), hexToRgb(m.sp.gill), [239, 230, 214]];
    for (var i = 0; i < 9; i++) {
      var r = m.size * (0.08 + Math.random() * 0.08), a = Math.random() * Math.PI * 2;
      var pts = [0, 1, 2].map(function (j) {
        var t = a + j * 2.1 + (Math.random() - 0.5) * 0.5;
        return [Math.cos(t) * r, Math.sin(t) * r];
      });
      shards.push({
        pts: pts, x: m.x + (Math.random() - 0.5) * m.size * 0.8, y: base - Math.random() * m.size * 0.9,
        vx: (Math.random() - 0.5) * 4, vy: -2 - Math.random() * 3, rot: 0, vr: (Math.random() - 0.5) * 0.4,
        from: cols[i % 3], to: hexToRgb(EARTH[(Math.random() * EARTH.length) | 0]), mix: 0,
        area: triArea(pts), settled: false, col: -1, extra: true
      });
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
    openTip(null);
    if (pos.y > surfaceAt(pos.x) - 40) sprout(pos.x);
  }

  // fromMyc : true quand la grappe sort d'une zone de mycelium bien blanche
  // (spreadMycelium) plutot que plantee a la main (tap sur la terre nue, handleTap) —
  // seule celle-la fane si le mycelium qui l'a fait sortir disparait (voir step()).
  function sprout(x, fromMyc) {
    var sp = SPECIES[speciesIdx++ % SPECIES.length];
    var n = 1 + ((Math.random() * 3) | 0);
    var mainMushroom = null;
    for (var i = 0; i < n; i++) {
      var side = i === 0 ? 0 : (i === 1 ? -1 : 1);
      var size = H * 0.2 * (0.6 + Math.random() * 0.6) * (i === 0 ? 1.15 : 0.85);
      var m = {
        x: x + side * size * 0.55, size: size,
        lean: (Math.random() - 0.5) * 0.35 + side * 0.2,
        sp: sp, t: -i * 0.25,   // t negatif = petit decalage de pousse dans la grappe
        myc: !!fromMyc, lastMycNear: vTime
      };
      mushrooms.push(m);
      if (i === 0) mainMushroom = m;
    }
    var alive = mushrooms.filter(function (m) { return !m.dying && !m.treasure; });
    for (i = 0; i < alive.length - MAX_MUSHROOMS; i++) alive[i].dying = true;
    // Bulle produit : seulement au tout premier champignon issu du mycelium verse par le
    // visiteur (pas les champignons plantes a la main ni les tresors), une fois par
    // chargement de page (mycTipShown ne se reinitialise jamais, meme au rebuild).
    if (fromMyc && !mycTipShown) {
      mycTipShown = true;
      mycTipMushroom = mainMushroom;
      mycTip = buildTip({
        title: 'Ce mycélium existe pour vrai',
        text: 'Le même mycélium en vrac, à étendre chez vous.',
        url: '/product/mycelium-en-vrac',
        cta: 'Précommander'
      });
      container.appendChild(mycTip);
      openTip('myc');
      setCaption(CAPTION_MYC);
    }
    startLoop();
  }

  // --- Mycelium ----------------------------------------------------------------------
  // lastFed : quand fourni (propagation vers une voisine), la nouvelle facette HERITE de
  // l'horloge de celle qui l'a colonisee plutot que d'en recevoir une neuve - se repandre
  // dans la terre ne nourrit pas, seul le bois pres d'une facette (stepTrees) la nourrit
  // vraiment. Seule l'inoculation directe (grain du sac, sa propre reserve) demarre une
  // horloge fraiche.
  function infect(s, ox, oy, amount, now, lastFed) {
    if (s.myc || s.grain || s.nutri) return;
    s.myc = amount;
    s.mox = ox; s.moy = oy;               // point d'inoculation : borne la portee (MYC_RADIUS)
    s.mycTone = 0.7 + Math.random() * 0.2; // jamais tout a fait blanc : les facettes restent lisibles
    s.lastFed = lastFed !== undefined ? lastFed : now;
    colonised.push(s);
    mycBusyUntil = frame + 120;
  }

  function inoculate(x, y, now) {
    for (var i = 0; i < shards.length; i++) {
      var s = shards[i];
      if (!s.settled || Math.abs(s.x - x) > 12 || Math.abs(s.y - y) > 12) continue;
      infect(s, x, y, 0.06, now);
    }
  }

  // Retourne true tant que quelque chose change (la boucle de rendu doit tourner).
  // Sans bois a decomposer a portee (voir stepTrees, qui met a jour c.lastFed), un
  // mycelium colonise finit par s'eteindre et la facette redevient de la terre normale.
  function stepMycelium(now) {
    var busy = frame < mycBusyUntil;
    for (var i = colonised.length - 1; i >= 0; i--) {
      var c = colonised[i];
      if (c.myc < 1 && (now - c.lastFed < MYC_STARVE_MS)) { c.myc = Math.min(1, c.myc + MYC_GROW); busy = true; continue; }
      if (now - c.lastFed >= MYC_STARVE_MS) {
        c.myc -= MYC_DECAY;
        busy = true;
        // Le mycelium qui meurt de faim devient lui-meme un nutriment (necromasse) :
        // comme dans la vraie vie, sa propre mort nourrit encore le sol et les arbres.
        if (c.myc <= 0) {
          c.myc = 0;
          c.nutri = NUTRI[(Math.random() * NUTRI.length) | 0];
          colonised.splice(i, 1);
        }
      }
    }
    if (frame % MYC_SPREAD_EVERY === 0) spreadMycelium(now);
    return busy;
  }

  // Grille de voisinage refaite a chaque passage : la pelle deplace les facettes.
  function spreadMycelium(now) {
    var D = 14, radius = H * MYC_RADIUS, grid = new Map(), i, s, b;
    for (i = 0; i < shards.length; i++) {
      s = shards[i];
      if (!s.settled) continue;
      var key = ((s.x / D) | 0) * 1024 + ((s.y / D) | 0);
      var cell = grid.get(key);
      if (cell) cell.push(s); else grid.set(key, [s]);
    }
    var buckets = {}, fw = H * FRUIT_W;
    for (i = 0; i < colonised.length; i++) {
      var c = colonised[i];
      if (!c.settled || c.myc < MYC_READY) continue;
      if (c.myc > 0.9 && c.y - surfaceAt(c.x) < 18) {
        b = Math.floor(c.x / fw);
        (buckets[b] = buckets[b] || []).push(c.x);
      }
      if (c.mycIdle > frame || Math.random() > MYC_SPREAD_P) continue;
      // Coloniser de la terre neuve demande d'etre activement nourri MAINTENANT (bois
      // vraiment a portee), pas juste "pas encore mort" : sinon une facette peut conquerir
      // toute la terre autour d'elle avant de s'eteindre, loin de tout bois.
      if (now - c.lastFed >= MYC_ACTIVE_FEED_MS) continue;
      var gx = (c.x / D) | 0, gy = (c.y / D) | 0, free = [];
      for (var ax = -1; ax <= 1; ax++) {
        for (var ay = -1; ay <= 1; ay++) {
          var list = grid.get((gx + ax) * 1024 + gy + ay);
          if (!list) continue;
          for (var k = 0; k < list.length; k++) {
            var n = list[k];
            if (n.myc || Math.hypot(n.x - c.x, n.y - c.y) > D) continue;
            if (Math.hypot(n.x - c.mox, n.y - c.moy) > radius) continue;
            free.push(n);
          }
        }
      }
      // Plus rien a gagner autour : on la laisse tranquille un moment (economise des calculs).
      if (!free.length) { c.mycIdle = frame + 90; continue; }
      // Herite l'horloge de faim du parent : se repandre dans la terre ne nourrit pas.
      infect(free[(Math.random() * free.length) | 0], c.mox, c.moy, 0.02, now, c.lastFed);
    }
    // Une zone de surface bien blanche fructifie une fois.
    for (b in buckets) {
      var xs = buckets[b];
      if (fruited[b] || xs.length < FRUIT_MIN) continue;
      fruited[b] = true;
      sprout(xs[(Math.random() * xs.length) | 0], true);
    }
  }

  // --- Sac de mycelium ---------------------------------------------------------------
  // Le goulot du sac est au curseur. Bouton maintenu (ou doigt pose) : le sac bascule
  // et les grains coulent ; relache, il se redresse.
  var bag = { on: false, pouring: false, x: 0, y: 0, rot: 1.9 };

  function enterBag(p) {
    bag.on = true;
    bag.x = p.x; bag.y = p.y;
    container.classList.add('is-tool-cursor');
  }
  function leaveBag() {
    bag.on = false; bag.pouring = false;
    container.classList.remove('is-tool-cursor');
  }

  function updateBag() {
    var goal = bag.pouring ? 0.45 : 1.9;
    bag.rot += (goal - bag.rot) * 0.18;
    if (!bag.pouring || bag.rot > 1) return; // les grains coulent une fois le sac bascule
    var n = Math.random() < 0.5 ? 2 : 1;
    for (var i = 0; i < n; i++) {
      var r = 1.8 + Math.random() * 1.6, a = Math.random() * Math.PI * 2;
      var color = hexToRgb(GRAIN[(Math.random() * GRAIN.length) | 0]);
      shards.push({
        pts: [0, 1, 2].map(function (j) {
          var t = a + j * 2.1 + (Math.random() - 0.5) * 0.5;
          return [Math.cos(t) * r, Math.sin(t) * r];
        }),
        x: bag.x + (Math.random() - 0.5) * 5, y: bag.y + 2,
        vx: (Math.random() - 0.5) * 0.8, vy: 0.5 + Math.random(),
        rot: 0, vr: (Math.random() - 0.5) * 0.3,
        from: color, to: color, mix: 1, area: 0, settled: false, col: -1, grain: true
      });
    }
  }

  function drawBag() {
    if (!bag.on) return;
    var k = clamp(H / 500, 0.7, 1.3);
    ctx.save();
    ctx.translate(bag.x, bag.y);
    ctx.rotate(bag.rot);
    ctx.scale(k, k);
    // Goulot (plastique froisse), puis le corps : plastique clair autour du grain colonise.
    ctx.fillStyle = '#c9cfd0';
    poly([[-6, 0], [0, 0], [-6, -12], [-17, -12]]);
    ctx.fillStyle = '#b3babc';
    poly([[0, 0], [6, 0], [17, -12], [-6, -12]]);
    ctx.fillStyle = '#dde2e2';
    poly([[-17, -12], [17, -12], [15, -64], [-15, -64]]);
    ctx.fillStyle = '#f1ebdd';
    poly([[-14, -15], [14, -15], [-12, -40]]);
    ctx.fillStyle = '#e4dac5';
    poly([[14, -15], [12, -61], [-12, -40]]);
    ctx.fillStyle = '#f7f3ea';
    poly([[-12, -40], [12, -61], [-12, -61]]);
    // Filtre du sac.
    ctx.fillStyle = '#cbbf9f';
    poly([[-6, -50], [6, -50], [6, -58], [-6, -58]]);
    ctx.restore();
  }

  function setTool(name) {
    if (!name || name === tool) return;
    leaveShovel();
    leaveBag();
    tool = name;
    container.classList.toggle('is-planting', name === 'tree');
    for (var i = 0; i < toolBtns.length; i++) {
      var on = toolBtns[i].getAttribute('data-tool') === name;
      toolBtns[i].classList.toggle('is-active', on);
      toolBtns[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    startLoop();
  }

  // --- Arbres -----------------------------------------------------------------------
  function makeTree(x) {
    var now = vTime, slots = [];
    var rx = H * 0.2, ry = H * 0.13;
    for (var i = 0; i < 40; i++) {
      var a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random());
      slots.push({ dx: Math.cos(a) * rx * d, dy: Math.sin(a) * ry * d, leaf: null });
    }
    // Racines dessinees : lignes brisees, longueur volontairement plus courte que la
    // portee de recherche de nutriment (voir ROOT_VISUAL_REACH plus haut).
    var roots = [], reach = H * ROOT_VISUAL_REACH;
    for (i = 0; i < 6; i++) {
      var side = i % 2 ? 1 : -1, spread = (0.45 + Math.random() * 0.55) * reach;
      var depth = H * (0.02 + Math.random() * 0.1), pts = [[0, 0]];
      for (var k = 1; k <= 4; k++) {
        pts.push([side * spread * k / 4 + (Math.random() - 0.5) * 6, depth * Math.pow(k / 4, 0.7) + (Math.random() - 0.5) * 4]);
      }
      roots.push(pts);
    }
    var t = { x: x, h: H * 0.42, slots: slots, roots: roots, nextEat: now + EAT_MS, eaten: 0, growth: 0 };
    // Quelques feuilles au depart, d'ages varies : on reconnait un arbre tout de suite.
    for (i = 0; i < 8; i++) addLeaf(t, now - Math.random() * LEAF_LIFE_MS[0] * 0.6);
    return t;
  }

  // Nombre de places de feuilles utilisables : monte de LEAF_UNLOCK_MIN a toutes les
  // places (t.slots.length) a mesure que l'arbre grandit (t.growth).
  function unlockedSlots(t) {
    return Math.round(lerp(LEAF_UNLOCK_MIN, t.slots.length, t.growth));
  }

  // Echelle du tronc/houppier : petit a la naissance, et nettement plus grand que la
  // taille de reference une fois bien nourri (TREE_SCALE_MAX > 1).
  function treeScale(t) {
    return lerp(TREE_SCALE_MIN, TREE_SCALE_MAX, t.growth);
  }

  // Plante un nouvel arbre si la place ne manque pas (MAX_TREES) et qu'on n'est pas
  // trop pres d'un autre (TREE_MIN_SPACING).
  function plantTree(x) {
    if (trees.length >= MAX_TREES) return false;
    for (var i = 0; i < trees.length; i++) {
      if (Math.abs(trees[i].x - x) < TREE_MIN_SPACING) return false;
    }
    trees.push(makeTree(x));
    treeLife = true;
    startLoop();
    return true;
  }

  function addLeaf(t, born) {
    var free = t.slots.slice(0, unlockedSlots(t)).filter(function (sl) { return !sl.leaf; });
    if (!free.length) return false;
    free[(Math.random() * free.length) | 0].leaf = {
      born: born, life: lerp(LEAF_LIFE_MS[0], LEAF_LIFE_MS[1], Math.random()),
      rot: Math.random() * Math.PI * 2, size: H * (0.022 + Math.random() * 0.014)
    };
    return true;
  }

  function leafColor(age) {
    for (var i = 1; i < LEAF_AGES.length; i++) {
      if (age <= LEAF_AGES[i][0]) {
        var a = LEAF_AGES[i - 1], b = LEAF_AGES[i], k = (age - a[0]) / (b[0] - a[0]);
        return [0, 1, 2].map(function (j) { return Math.round(lerp(a[1][j], b[1][j], k)); });
      }
    }
    return LEAF_AGES[LEAF_AGES.length - 1][1];
  }

  function leafTri(size, rot) {
    return [0, 2.3, 3.9].map(function (a, j) {
      var r = size * (j === 0 ? 1 : 0.6);
      return [Math.cos(rot + a) * r, Math.sin(rot + a) * r];
    });
  }

  // Retourne 2 si une animation rapide est en cours (feuille qui pousse), 1 s'il reste
  // de la vie lente (feuilles qui vieillissent, nutriments, litiere), 0 sinon.
  function stepTrees(now) {
    var state = 0, i;
    for (var ti = 0; ti < trees.length; ti++) {
      var t = trees[ti];
      // t.by suit le sol avec un delai (TREE_BY_FOLLOW) : les petites secousses (pelle
      // pres du tronc) sont lissees, mais un trou creuse durablement sous l'arbre finit
      // par le faire lentement s'enfoncer, sans sauter.
      var target = surfaceAt(t.x) + TREE_EMBED;
      t.by = t.by === undefined ? target : t.by + (target - t.by) * TREE_BY_FOLLOW;
      var by = t.by;
      for (i = 0; i < t.slots.length; i++) {
        var sl = t.slots[i], lf = sl.leaf;
        if (!lf) continue;
        var age = (now - lf.born) / lf.life;
        if (age < 1) {
          state = Math.max(state, now - lf.born < LEAF_GROW_MS ? 2 : 1);
          continue;
        }
        // Feuille morte : elle se detache et tombe (devient une facette du monde).
        sl.leaf = null;
        var pts = leafTri(lf.size, lf.rot);
        var tg = treeScale(t);
        shards.push({
          pts: pts, x: t.x + sl.dx * tg, y: by - t.h * tg + sl.dy * tg, vx: (Math.random() - 0.5) * 0.6, vy: 0,
          rot: 0, vr: (Math.random() - 0.5) * 0.06, from: leafColor(1),
          to: hexToRgb(NUTRI[(Math.random() * NUTRI.length) | 0]), mix: 0,
          area: triArea(pts), settled: false, col: -1, leaf: true, extra: true, sway: Math.random() * 6,
          gust: Math.pow(Math.random(), 2) * 3
        });
        state = 2;
      }
      if (now >= t.nextEat) {
        t.nextEat = now + EAT_MS;
        // Les racines vont chercher plus loin a mesure que l'arbre grandit (t.growth), et
        // visent la meilleure terre a portee : le nutriment le plus proche, pas un au hasard.
        var reach = W * ROOT_REACH * lerp(ROOT_GROWTH_MIN, 1, t.growth), best = null, bestD = Infinity;
        for (i = 0; i < shards.length; i++) {
          var s = shards[i];
          if (!s.nutri || !s.settled) continue;
          var d = Math.abs(s.x - t.x);
          if (d < reach && d < bestD) { bestD = d; best = s; }
        }
        if (best && t.slots.slice(0, unlockedSlots(t)).some(function (x) { return !x.leaf; })) {
          var f = best;
          pileRemove(f);
          f.settled = false;
          f.eaten = now;
          addLeaf(t, now + EATEN_MS); // la feuille sort quand le nutriment a fini d'etre absorbe
          // Plus il mange de nutriments, plus il grandit : racines plus longues, plus de
          // feuilles possibles, tronc/houppier plus grands (voir drawTree/drawRoots).
          t.eaten++;
          t.growth = Math.min(1, t.eaten / MATURE_NUTRIENTS);
          state = 2;
        }
      }
    }
    // Du bois tombe se decompose tout seul, lentement (LITTER_MS) ; un mycelium a
    // proximite le decompose bien plus vite (MYC_DECOMPOSE_MULT) et s'en nourrit
    // (c.lastFed), ce qui le maintient en vie (voir stepMycelium).
    for (i = 0; i < litter.length; i++) {
      var l = litter[i];
      if (!l.settled) continue;
      var dt = l.lastNow ? now - l.lastNow : 0;
      l.lastNow = now;
      var fed = false;
      for (var ci = 0; ci < colonised.length; ci++) {
        var c = colonised[ci];
        if (Math.abs(c.x - l.x) < MYC_DECOMPOSE_REACH && Math.abs(c.y - l.y) < MYC_DECOMPOSE_REACH) {
          c.lastFed = now;
          fed = true;
        }
      }
      if (fed) l.bonus = (l.bonus || 0) + dt * (MYC_DECOMPOSE_MULT - 1);
      l.mix = Math.min(1, (now - l.landed + (l.bonus || 0)) / LITTER_MS);
    }
    // Feuille tout a fait decomposee : elle devient de l'humus, que les racines peuvent reprendre.
    litter.forEach(function (l) { if (l.mix >= 1 && l.settled) l.nutri = rgbStr(l.to); });
    litter = litter.filter(function (l) { return l.mix < 1 && shards.indexOf(l) >= 0; });
    if (litter.length) state = Math.max(state, 1);
    if (!state && shards.some(function (x) { return x.nutri; })) state = 1;
    return state;
  }

  // Dessinees PAR-DESSUS la terre (en clair) : sinon on ne les verrait pas.
  function drawRoots(t) {
    var by = t.by !== undefined ? t.by : surfaceAt(t.x) + TREE_EMBED, w0 = H * 0.012;
    // Racines courtes a la naissance, elles s'etirent jusqu'a leur pleine longueur en poussant.
    var rg = lerp(ROOT_GROWTH_MIN, 1, t.growth);
    for (var r = 0; r < t.roots.length; r++) {
      var pts = t.roots[r];
      for (var i = 0; i < pts.length - 1; i++) {
        var a = pts[i], b = pts[i + 1];
        var wa = w0 * (1 - i / pts.length), wb = w0 * (1 - (i + 1) / pts.length) + 0.6;
        var ax = t.x + a[0] * rg, ay = Math.min(H - 2, by + a[1] * rg), bx = t.x + b[0] * rg, bey = Math.min(H - 2, by + b[1] * rg);
        ctx.fillStyle = i % 2 ? '#c9ae86' : '#d8c3a0';
        poly([[ax, ay - wa], [bx, bey - wb], [bx, bey + wb], [ax, ay + wa]]);
      }
    }
  }

  function drawTree(t) {
    // Tronc/houppier petits a la naissance, pleine taille une fois l'arbre mature (t.growth).
    var now = vTime, tg = treeScale(t), by = t.by !== undefined ? t.by : surfaceAt(t.x) + TREE_EMBED, h = t.h * tg, w = H * 0.035 * tg, top = by - h;
    // Tronc : deux facettes (lumiere a gauche), effile vers le haut.
    ctx.fillStyle = '#8a5a3b';
    poly([[t.x - w, by], [t.x, by], [t.x, top], [t.x - w * 0.35, top]]);
    ctx.fillStyle = '#6b4428';
    poly([[t.x, by], [t.x + w, by], [t.x + w * 0.35, top], [t.x, top]]);
    // Branches : minces triangles du tronc vers le houppier.
    ctx.fillStyle = '#6b4428';
    poly([[t.x - 2, top + h * 0.3], [t.x + 2, top + h * 0.25], [t.x - H * 0.13 * tg, top - H * 0.04 * tg]]);
    poly([[t.x - 2, top + h * 0.2], [t.x + 2, top + h * 0.25], [t.x + H * 0.14 * tg, top - H * 0.02 * tg]]);
    poly([[t.x - 2, top + 4], [t.x + 2, top + 4], [t.x + H * 0.02 * tg, top - H * 0.11 * tg]]);
    for (var i = 0; i < t.slots.length; i++) {
      var sl = t.slots[i], lf = sl.leaf;
      if (!lf || now < lf.born) continue;
      var g = easeOutBack(Math.min(1, (now - lf.born) / LEAF_GROW_MS));
      var pts = leafTri(lf.size * g, lf.rot);
      ctx.fillStyle = rgbStr(leafColor(Math.min(1, (now - lf.born) / lf.life)));
      var x = t.x + sl.dx * tg, y = top + sl.dy * tg;
      poly(pts.map(function (q) { return [x + q[0], y + q[1]]; }));
    }
  }

  // --- Rendu -------------------------------------------------------------------------
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // Tout ce qui suit est dessine en coord. MONDE ; ce translate ramene la portion
    // visible (camX..camX+W, camY..camY+H) a l'ecran. Les overlays HTML (tresors) font
    // ce -camX/-camY a la main dans positionTreasureOverlays, hors de ce contexte canvas.
    ctx.save();
    ctx.translate(-camX, -camY);
    // Pendant la montee du lit de terre, tout le sol est decale vers le bas.
    var rise = soilRiseT < 1 ? Math.pow(1 - soilRiseT, 3) * soilDepth : 0;
    drawSoil(rise);
    // Avant les facettes : le pied du tronc est enfoui dans la terre.
    for (var ti = 0; ti < trees.length; ti++) drawTree(trees[ti]);
    for (var i = 0; i < shards.length; i++) {
      var s = shards[i], m = s.mix, p = s.pts;
      var sy = s.y + (s.soil && s.settled ? rise : 0);
      var r = lerp(s.from[0], s.to[0], m), g = lerp(s.from[1], s.to[1], m), bl = lerp(s.from[2], s.to[2], m);
      if (s.myc) {
        var w = s.myc * s.mycTone;
        r = lerp(r, MYC[0], w); g = lerp(g, MYC[1], w); bl = lerp(bl, MYC[2], w);
      }
      ctx.fillStyle = s.nutri || 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (bl | 0) + ')';
      var c = Math.cos(s.rot), sn = Math.sin(s.rot);
      if (s.eaten !== undefined) {
        var k = Math.max(0, 1 - (vTime - s.eaten) / EATEN_MS);
        c *= k; sn *= k;
      }
      ctx.beginPath();
      ctx.moveTo(s.x + p[0][0] * c - p[0][1] * sn, sy + p[0][0] * sn + p[0][1] * c);
      ctx.lineTo(s.x + p[1][0] * c - p[1][1] * sn, sy + p[1][0] * sn + p[1][1] * c);
      ctx.lineTo(s.x + p[2][0] * c - p[2][1] * sn, sy + p[2][0] * sn + p[2][1] * c);
      ctx.closePath();
      ctx.fill();
    }
    for (ti = 0; ti < trees.length; ti++) drawRoots(trees[ti]);
    // Apres les facettes : les champignons sortent PAR-DESSUS la terre.
    for (i = 0; i < mushrooms.length; i++) drawMushroom(mushrooms[i]);
    drawShovel();
    drawBag();
    ctx.restore();
    positionTreasureOverlays();
  }

  // Corps du tas : bande de triangles plats entre la crete et le fond du MONDE (worldH,
  // pas juste le bas de la boite H : le defilement vertical doit reveler du remplissage,
  // pas un trou), echantillonnee grossierement pour garder l'aspect facette. On ne dessine
  // que la portion du monde visible (autour de camX/camY), pas tout le monde a chaque frame.
  function drawSoil(rise) {
    var stepX = 14, bottom = worldH, visBottom = camY + H;
    var x0 = Math.max(0, Math.floor((camX - stepX) / stepX) * stepX);
    var x1 = Math.min(worldW, camX + W + stepX);
    var pts = [];
    for (var x = x0; x <= x1; x += stepX) {
      var cx = Math.min(x, worldW);
      pts.push([cx, surfaceAt(cx) + 4 + rise]);
    }
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1];
      if (a[1] >= visBottom && b[1] >= visBottom) continue;
      ctx.fillStyle = SOIL[i % SOIL.length];
      poly([a, b, [a[0], bottom]]);
      ctx.fillStyle = SOIL[(i + 1) % SOIL.length];
      poly([b, [b[0], bottom], [a[0], bottom]]);
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
      // def.x est une fraction de la largeur du MONDE (pas du logo) : les tresors sont
      // repartis sur toute la zone explorable, pas seulement sous le logo.
      return { def: def, x: def.x * worldW, dig: 0, revealed: false, mushroom: null, glint: glint, tip: null, hint: null };
    });
    // Le tout premier tresor porte un repere en plus (halo + fleche) pour inciter a creuser.
    if (treasures.length) {
      var first = treasures[0];
      first.hint = document.createElement('div');
      first.hint.className = 'logo-explosion-hint';
      first.hint.setAttribute('aria-hidden', 'true');
      first.hint.innerHTML = '<span class="logo-explosion-hint-halo"></span><span class="logo-explosion-hint-arrow"></span>';
      container.appendChild(first.hint);
    }
    // On laisse la terre retomber avant de montrer ou creuser.
    setTimeout(function () {
      if (mode !== 'exploded') return;
      treasures.forEach(function (t) {
        if (!t.revealed) t.glint.classList.add('is-visible');
        if (t.hint) t.hint.classList.add('is-visible');
      });
      positionTreasureOverlays();
    }, 1600);
  }

  function clearTreasures() {
    treasures.forEach(function (t) {
      t.glint.remove();
      if (t.tip) t.tip.remove();
      if (t.hint) t.hint.remove();
    });
    treasures = [];
  }

  // Retire juste la bulle DOM (le rebuild fait tomber le champignon qui la portait) —
  // mycTipShown n'est PAS reinitialise : elle ne doit s'afficher qu'une fois par page.
  function clearMycTip() {
    if (mycTip) { mycTip.remove(); mycTip = null; }
    mycTipMushroom = null;
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
    if (t.hint) { t.hint.remove(); t.hint = null; }
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

  // Une seule infobulle ouverte a la fois : les tresors (et la bulle mycelium, active
  // valant la chaine 'myc') sont proches, elles se chevaucheraient.
  function openTip(active) {
    treasures.forEach(function (t) {
      if (t.tip) t.tip.classList.toggle('is-open', t === active);
    });
    if (mycTip) mycTip.classList.toggle('is-open', active === 'myc');
  }

  // Position d'une infobulle juste au-dessus du chapeau d'un champignon (monde -> ecran,
  // - camX/- camY) ; partagee par les tresors deterres et la bulle mycelium.
  function positionTipOverMushroom(tipEl, m) {
    var g = easeOutBack(Math.max(0, Math.min(1, m.t)));
    var capTop = surfaceAt(m.x) - camY + 6 - m.size * g * 1.45;
    var half = tipEl.offsetWidth / 2;
    var mScreenX = m.x - camX;
    var left = Math.max(half + 8, Math.min(W - half - 8, mScreenX));
    tipEl.style.left = left + 'px';
    tipEl.style.top = (capTop - 16) + 'px';
    tipEl.style.setProperty('--arrow-dx', (mScreenX - left) + 'px');
  }

  // Ces overlays sont du HTML positionne en absolu dans la boite : leurs coordonnees
  // doivent etre converties de monde vers ecran (- camX, - camY), contrairement au canvas
  // qui le fait via ctx.translate dans draw().
  function positionTreasureOverlays() {
    for (var i = 0; i < treasures.length; i++) {
      var t = treasures[i];
      var screenX = t.x - camX;
      if (!t.revealed) {
        t.glint.style.left = screenX + 'px';
        t.glint.style.top = (surfaceAt(t.x) - camY - 2) + 'px';
        if (t.hint) {
          t.hint.style.left = screenX + 'px';
          t.hint.style.top = (surfaceAt(t.x) - camY - 46) + 'px';
        }
        continue;
      }
      if (!t.tip) continue;
      positionTipOverMushroom(t.tip, t.mushroom);
    }
    if (mycTip && mycTipMushroom) positionTipOverMushroom(mycTip, mycTipMushroom);
  }

  // --- Reconstruction ----------------------------------------------------------------
  function rebuild() {
    if (mode !== 'exploded') return;
    mode = 'rebuilding';
    rebuildT = 0;
    camX = camMargin; // la camera revient au centre pendant que le logo se reconstruit
    camY = 0;
    mobileArrow = 0;
    mobileArrowY = 0;
    // Les grains en vol n'ont pas de place dans le logo : ils disparaissent.
    shards = shards.filter(function (g) { return !g.grain && !g.extra && g.eaten === undefined; });
    colonised = []; fruited = {};
    trees = []; litter = []; treeLife = false;
    leaveBag();
    for (var i = 0; i < shards.length; i++) {
      var s = shards[i];
      s.sx = s.x; s.sy = s.y; s.srot = s.rot; s.smix = s.mix;
      s.delay = Math.random() * 0.35;
    }
    leaveShovel();
    clearTreasures();
    clearMycTip();
    setCaption(CAPTION_BEFORE);
    if (rebuildBtn) rebuildBtn.classList.add('d-none');
    if (toolsBar) toolsBar.classList.add('d-none');
    if (speedWrap) speedWrap.classList.add('d-none');
    if (scrollLeftBtn) scrollLeftBtn.classList.add('d-none');
    if (scrollRightBtn) scrollRightBtn.classList.add('d-none');
    if (scrollUpBtn) scrollUpBtn.classList.add('d-none');
    if (scrollDownBtn) scrollDownBtn.classList.add('d-none');
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
      if (s.myc) s.myc *= 0.93;
      s.nutri = null;
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
    clearMycTip();
    if (rebuildBtn) rebuildBtn.classList.add('d-none');
    if (toolsBar) toolsBar.classList.add('d-none');
    if (speedWrap) speedWrap.classList.add('d-none');
    if (scrollLeftBtn) scrollLeftBtn.classList.add('d-none');
    if (scrollRightBtn) scrollRightBtn.classList.add('d-none');
    if (scrollUpBtn) scrollUpBtn.classList.add('d-none');
    if (scrollDownBtn) scrollDownBtn.classList.add('d-none');
    mobileArrow = 0;
    mobileArrowY = 0;
    hoverScreenX = null; hoverScreenY = null;
    leaveBag();
    shards = [];
    mushrooms = [];
    colonised = []; fruited = {};
    trees = []; litter = []; treeLife = false;
    if (slowTimer !== null) { clearTimeout(slowTimer); slowTimer = null; }
  }

  // --- Evenements --------------------------------------------------------------------
  function getRelativePos(evt) {
    // container plutot que canvas : le canvas est en d-none (rect a 0) avant le clic.
    // Coordonnees ECRAN (relatives a la boite), pas encore converties en coord. monde.
    var rect = container.getBoundingClientRect();
    var p = evt.touches ? evt.touches[0] : evt;
    return { x: p.clientX - rect.left, y: p.clientY - rect.top };
  }

  // Coordonnees monde (ajoute le decalage camera courant) : a utiliser pour toute la
  // physique/logique (pelle, tresors, tas) une fois le monde explose.
  function getWorldPos(evt) {
    var p = getRelativePos(evt);
    return { x: p.x + camX, y: p.y + camY };
  }

  container.addEventListener('click', function (evt) {
    // Le bouton, les fleches et les infobulles sont dans la boite : leurs clics ne creusent pas.
    if (evt.target.closest('#logo-explosion-rebuild, .logo-explosion-scroll, .logo-explosion-tip, .logo-explosion-tools')) return;
    var pos = getRelativePos(evt);
    if (mode === 'assembled') {
      // camX vient d'etre (re)centre par build() : + camX donne la position monde de
      // l'origine de l'explosion, coherente avec les coord. monde des facettes.
      if (imgReady && build()) explode(pos.x + camX, pos.y);
      return;
    }
    // Une fois explose, tout passe par les evenements pointer du canvas (pelle + taps).
  });

  // Pointer events : meme code pour souris, doigt et stylet.
  // Souris : la pelle suit le survol, bouton maintenu = elle ralentit (mode precis). Le
  // survol pres des bords de la boite fait aussi defiler le monde (voir cameraSpeed).
  // Doigt : le bol suit le doigt, doigt leve = il se vide puis disparait ; le defilement
  // se fait avec les fleches tactiles (pas de survol possible au doigt).
  canvas.addEventListener('pointerdown', function (evt) {
    if (mode !== 'exploded') return;
    var screenPos = getRelativePos(evt);
    var pos = { x: screenPos.x + camX, y: screenPos.y + camY };
    if (evt.pointerType === 'mouse') { hoverScreenX = screenPos.x; hoverScreenY = screenPos.y; }
    try { canvas.setPointerCapture(evt.pointerId); } catch (e) { /* pas grave */ }
    pointerDown = pos;
    dragMoved = false;
    if (tool === 'mycelium') {
      if (!bag.on) enterBag(pos);
      bag.x = pos.x; bag.y = pos.y;
      bag.pouring = true;
      startLoop();
      return;
    }
    if (tool === 'tree') return; // se plante au relachement (tap), pas d'outil traine au curseur
    if (!shovel.on) enterShovel(pos);
    shovel.gx = pos.x; shovel.gy = pos.y;
    shovel.held = evt.pointerType === 'mouse';
    shovel.pouring = false; shovel.hideWhenEmpty = false;
    startLoop();
  });

  canvas.addEventListener('pointermove', function (evt) {
    if (mode !== 'exploded') return;
    var screenPos = getRelativePos(evt);
    var pos = { x: screenPos.x + camX, y: screenPos.y + camY };
    if (evt.pointerType === 'mouse') { hoverScreenX = screenPos.x; hoverScreenY = screenPos.y; }
    if (tool === 'mycelium') {
      if (!bag.on) enterBag(pos);
      bag.x = pos.x; bag.y = pos.y;
    } else if (tool === 'shovel') {
      if (!shovel.on) enterShovel(pos);
      shovel.gx = pos.x; shovel.gy = pos.y;
    }
    if (evt.pointerType === 'mouse' && !pointerDown) {
      // Survoler un tresor deja deterre rouvre son infobulle sans avoir a cliquer.
      var hoverT = treasureNear(pos.x, pos.y);
      if (hoverT && hoverT.revealed) openTip(hoverT);
    }
    if (pointerDown && Math.hypot(pos.x - pointerDown.x, pos.y - pointerDown.y) > 6) dragMoved = true;
    startLoop();
  });

  function endPress(evt, allowTap) {
    if (!pointerDown) return;
    if (tool === 'mycelium') {
      bag.pouring = false;
      // Au sac, un tap ne creuse pas : il rouvre seulement l'infobulle d'un tresor deja sorti.
      if (allowTap && !dragMoved) {
        var wp = getWorldPos(evt), t = treasureNear(wp.x, wp.y);
        if (t && t.revealed) openTip(t); else openTip(null);
      }
      if (evt.pointerType !== 'mouse') leaveBag();
      pointerDown = null;
      startLoop();
      return;
    }
    if (tool === 'tree') {
      if (allowTap && !dragMoved) plantTree(getWorldPos(evt).x);
      pointerDown = null;
      startLoop();
      return;
    }
    shovel.held = false;
    if (allowTap && !dragMoved) handleTap(getWorldPos(evt));
    if (evt.pointerType !== 'mouse' && shovel.on) {
      shovel.pouring = true;
      shovel.hideWhenEmpty = true;
    }
    pointerDown = null;
    startLoop();
  }
  // Clic n'importe ou en dehors de la boite (ou de l'infobulle elle-meme) : la ferme.
  document.addEventListener('click', function (evt) {
    if (mode === 'exploded' && !container.contains(evt.target)) openTip(null);
  });

  canvas.addEventListener('pointerup', function (evt) { endPress(evt, true); });
  canvas.addEventListener('pointercancel', function (evt) { endPress(evt, false); });
  canvas.addEventListener('pointerleave', function (evt) {
    if (evt.pointerType === 'mouse' && !pointerDown) {
      leaveShovel();
      leaveBag();
      hoverScreenX = null; hoverScreenY = null;
    }
  });

  if (rebuildBtn) rebuildBtn.addEventListener('click', rebuild);
  for (var ti = 0; ti < toolBtns.length; ti++) {
    toolBtns[ti].addEventListener('click', function () { setTool(this.getAttribute('data-tool')); });
  }
  // Slider de debug : accelere le cycle bois/mycelium/arbres (voir vTime) pour experimenter
  // sans attendre les minutes reelles de decomposition/croissance.
  if (speedInput) {
    speedInput.addEventListener('input', function () {
      timeScale = parseFloat(this.value) || 1;
      if (speedVal) speedVal.textContent = timeScale + '×';
      startLoop();
    });
  }

  // Fleches tactiles (mobile) : maintenues, elles font defiler le monde a vitesse fixe.
  function bindScrollArrow(btn, dir, vertical) {
    if (!btn) return;
    var start = function (evt) { evt.preventDefault(); if (vertical) mobileArrowY = dir; else mobileArrow = dir; startLoop(); };
    var stop = function () { if (vertical) mobileArrowY = 0; else mobileArrow = 0; };
    btn.addEventListener('pointerdown', start);
    btn.addEventListener('pointerup', stop);
    btn.addEventListener('pointercancel', stop);
    btn.addEventListener('pointerleave', stop);
  }
  bindScrollArrow(scrollLeftBtn, -1);
  bindScrollArrow(scrollRightBtn, 1);
  bindScrollArrow(scrollUpBtn, -1, true);
  bindScrollArrow(scrollDownBtn, 1, true);

  // --- Pause hors champ / onglet cache -------------------------------------------------
  // Inutile d'animer une scene que personne ne voit : la boucle s'arrete completement
  // (rAF + slowTimer) des que la boite sort du viewport OU que l'onglet passe en arriere-plan,
  // et ne reprend que si les deux conditions redeviennent vraies.
  function pauseLoop() {
    if (paused) return;
    paused = true;
    wasRunningBeforeHide = rafId !== null || slowTimer !== null;
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    if (slowTimer !== null) { clearTimeout(slowTimer); slowTimer = null; }
  }
  function resumeLoop() {
    if (!paused) return;
    paused = false;
    lastRealNow = null; // sinon le premier delta reel (temps passe en pause) ferait sauter vTime
    if (wasRunningBeforeHide) startLoop();
  }
  function updateVisibility() {
    if (inViewport && !document.hidden) resumeLoop(); else pauseLoop();
  }
  var inViewport = true;
  if ('IntersectionObserver' in window) {
    var visibilityObserver = new IntersectionObserver(function (entries) {
      inViewport = entries[entries.length - 1].isIntersecting;
      updateVisibility();
    });
    visibilityObserver.observe(container);
  }
  document.addEventListener('visibilitychange', updateVisibility);

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
