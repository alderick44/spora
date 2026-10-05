(function () {
  'use strict';

  var container = document.getElementById('logo-explosion');
  if (!container) return;
  // Mode demo (accueil) : classe posee par front-page.php ; ce qui est cache l'est en CSS (.is-demo).
  // "Continuer" sur l'ecran de fin (endDemo) la retire : le jeu complet se debloque, jusqu'a la
  // prochaine remise a zero (fleche, resetAllAndRebuild), qui relance la demo.
  var DEMO_KEY = 'spora-demo-finie';
  var DEMO_TREASURE_X = 0.26;             // demo : position du tresor, en fraction de la largeur de l'ecran
  var DEMO_PAGE = container.classList.contains('is-demo'), DEMO = DEMO_PAGE;
  try { if (DEMO && localStorage.getItem(DEMO_KEY)) { DEMO = false; container.classList.remove('is-demo'); } } catch (e) { /* stockage indisponible */ }

  var canvas = container.querySelector('#logo-explosion-canvas');
  var fallbackImg = container.querySelector('#logo-explosion-fallback');
  var rebuildBtn = document.getElementById('logo-explosion-rebuild');
  var debugToggleBtn = document.getElementById('logo-explosion-debug-toggle');
  var debugPanel = document.getElementById('logo-explosion-debug-panel');
  var fullscreenBtn = document.getElementById('logo-explosion-fullscreen');
  var scrollLeftBtn = document.getElementById('logo-explosion-scroll-left');
  var scrollRightBtn = document.getElementById('logo-explosion-scroll-right');
  var scrollUpBtn = document.getElementById('logo-explosion-scroll-up');
  var scrollDownBtn = document.getElementById('logo-explosion-scroll-down');
  var toolsBar = document.getElementById('logo-explosion-tools');
  var toolBtns = toolsBar ? toolsBar.querySelectorAll('[data-tool]') : [];
  var speedWrap = document.getElementById('logo-explosion-speed-wrap');
  var speedInput = document.getElementById('logo-explosion-speed');
  var speedVal = document.getElementById('logo-explosion-speed-val');
  var rainInput = document.getElementById('logo-explosion-rain');
  var droughtInput = document.getElementById('logo-explosion-drought');
  var droughtIndicator = document.getElementById('logo-explosion-drought-indicator');
  var stormInput = document.getElementById('logo-explosion-storm');
  var stormIndicator = document.getElementById('logo-explosion-storm-indicator');
  var caption = document.getElementById('logo-explosion-caption');
  // Essai mobile ($spora_tip_shelf dans front-page.php) : sur ecran etroit, la carte du tresor
  // selectionne se range dans cette boite, sous le bouton de la boutique (voir openTip).
  var shelfEl = document.getElementById('logo-explosion-shelf');
  var shelfMq = shelfEl && window.matchMedia ? window.matchMedia('(max-width: 767.98px)') : null;
  var speedBtn = document.getElementById('logo-explosion-speed-btn');
  var toolsArrow = document.getElementById('logo-explosion-tools-arrow');
  var moneyEl = document.getElementById('logo-explosion-money');
  var moneyVal = document.getElementById('logo-explosion-money-val');
  var treasureCountEl = document.getElementById('logo-explosion-treasures');
  var strainsBar = document.getElementById('logo-explosion-strains');
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

  // Zoom arriere sur ecran etroit : tout se dessine a MOBILE_ZOOM de sa taille, donc on voit
  // environ 1/MOBILE_ZOOM fois plus de monde. Le jeu raisonne en px LOGIQUES : W/H = la fenetre
  // visible (CSS / ZOOM), U = l'unite de taille des objets (hauteur CSS de la boite). A
  // 768 px et plus, ZOOM vaut exactement 1 : W/H = taille CSS, U = H, RS = dpr (rien ne change).
  // ?zoom=0.4 dans l'URL remplace MOBILE_ZOOM (essais, borne entre 0.3 et 1).
  var MOBILE_ZOOM = 0.55;                 // le reglage : plus petit = plus de monde visible, objets plus petits
  var ZOOM_MAX_W = 768;                   // en dessous de cette largeur (CSS) de boite, on zoome
  var zoomParam = /[?&]zoom=([0-9.]+)/.exec(window.location.search);
  if (zoomParam && isFinite(parseFloat(zoomParam[1]))) MOBILE_ZOOM = Math.max(0.3, Math.min(1, parseFloat(zoomParam[1])));
  var ZOOM = 1, RS = dpr;                 // RS : echelle de rendu du canvas (dpr x ZOOM)
  function updateZoom() {
    ZOOM = container.getBoundingClientRect().width < ZOOM_MAX_W ? MOBILE_ZOOM : 1;
    RS = dpr * ZOOM;
  }
  updateZoom();

  // Legende sous la boite : indique quoi faire puis ce qui se passe, mise a jour aux
  // moments cles (image prete, explosion, premier champignon issu du mycelium, rebuild).
  var CAPTION_BEFORE = ''; // au doigt, c'est l'anneau du badge "play" qui invite (voir HOLD_MS)
  var CAPTION_EXPLODED = 'Récoltez à la main, creusez à la pelle ou martelez du poing (maintenez le clic) pour trouver les trésors, ou versez du mycélium.';
  var CAPTION_MYC = 'Le mycélium décompose le bois mort et rend ses nutriments au sol.';
  var CAPTION_NEED_MONEY = 'Il faut 20 $ pour un sac de mycélium — récoltez des champignons à la main.';
  var CAPTION_NEED_STRAIN = 'Pas encore de mycélium : creusez à la pelle ou martelez du poing pour trouver le premier trésor.';
  var CAPTION_NEED_MONEY_FERT = 'Il faut 3 $ pour du fertilisant — récoltez des champignons à la main.';
  var CAPTION_NEED_MONEY_GRASS = 'Il faut 2 $ pour des graines — récoltez des champignons à la main.';
  var CAPTION_MYC_PLACE = 'Versez le mycélium au pied d’un arbre mature : il décompose son bois mort.';
  var CAPTION_MYC_HAND = 'Il lui faut du bois : prenez la main (✋) dans la barre d’outils.';
  var CAPTION_MYC_DROP = 'Déposez-le sur le mycélium.';
  var CAPTION_MYC_LEAVES = 'Arrachez des feuilles ou des branches de l’arbre et déposez-les sur le mycélium.';
  var CAPTION_MYC_HARVEST = 'Cueillez un champignon : cliquez dessus avec la main (✋).';
  var CAPTION_MYC_GROW = 'Patientez : les champignons vont bientôt pousser sur le mycélium.';
  var CAPTION_MYC_TREE_WAIT = 'Attendez que l’arbre grandisse avant d’y verser le mycélium.';
  var CAPTION_MYC_TREE_NONE = 'Il faut un arbre pour nourrir le mycélium : plantez-en un.';
  var CAPTION_MYC_REPOUR = 'Le mycélium a disparu : reversez-en près d’un arbre.';
  var CAPTION_MYC_CLOSER = 'Plus près : versez le mycélium juste au pied de l’arbre, là où tombent les feuilles.';
  var CAPTION_MYC_FED = 'Bravo ! Le mycélium décompose le bois mort et rend ses nutriments au sol.';
  var CAPTION_MYC_NO_WOOD = 'Pas de bois à portée : le mycélium va s’éteindre. Visez le pied d’un arbre.';
  var CAPTION_BAG_EMPTY = 'Sac vide : encore 20 $ pour un nouveau sac.';
  var captionTimer = null;
  // Message affiche dans la scene puis efface au bout de quelques secondes (sauf l'invite
  // d'avant l'explosion, qui reste tant que le visiteur n'a pas touche le logo).
  // Trois canaux de messages, distincts a l'ecran (zones CSS differentes) :
  //  1. INSTRUCTIONS (setCaption) : banniere brune en bas, 6 s. Elles passent toujours avant :
  //     si l'une arrive pendant un "saviez-vous", celui-ci se masque (et sera retente).
  //  2. EXPLICATIONS (showExplain) : carte verte en haut a gauche, 8 s. Chaque explication du
  //     lessivage n'apparait qu'une fois (drapeaux sauves avec le joueur, voir playerState).
  //     Elle a priorite sur un "saviez-vous" (qui se masque si elle arrive).
  //  3. SAVIEZ-VOUS (showFact) : note de carnet en bas a droite, 12 s ou jusqu'a la fermeture.
  //     Un par joueur (bitmask factSeen sauve), choisi par msgTick selon la situation.
  // Pour les canaux 2 et 3 : jamais hors mode exploded, ni pendant/juste apres (10 s) une
  // infobulle de tresor, ni par-dessus une legende visible. Si les conditions ne sont pas
  // reunies, le drapeau n'est pas pose : le meme evenement le redeclenchera plus tard.
  var CAPTION_LEACH = 'La pluie entraîne l\'humus vers le bas : un sol sans vie retient mal ses nutriments.';
  var CAPTION_GRASS_LOST = 'Vous avez arraché beaucoup de gazon : replantez-en avec l\'outil de gazon.';
  var CAPTION_HELD = 'Le mycélium aide à retenir l\'humus contre la pluie.';
  var LEACH_TIP_QUIET_MS = 10000, LEACH_TIP_GAP_MS = 15000;
  var EXPLAIN_MS = 20000, FACT_MS = 12000, FACT_FIRST_MS = 30000, FACT_GAP_MS = 60000, FACT_AFTER_EXPLAIN_MS = 8000;
  var leachTipSeen = 0;            // bit 1 = lessivage, 2 = retenue, 4 = mort de faim, 8 = mort de secheresse, 16 = gazon arrache (persistant ; masque de restauration = 31)
  var leachTipAt = -1e9, tipOpen = false, tipChangeAt = -1e9;
  var explainEl = document.getElementById('logo-explosion-explain');
  var explainText = explainEl && explainEl.querySelector('.logo-explosion-explain-text');
  var factEl = document.getElementById('logo-explosion-fact');
  var factText = factEl && factEl.querySelector('.logo-explosion-fact-text');
  var factClose = factEl && factEl.querySelector('.logo-explosion-fact-close');
  var explainTimer = null, factTimer = null, explainEndAt = -1e9, factAt = -1e9, factShown = -1, factShownAt = 0;
  var branchTorn = false;          // une branche a ete arrachee a la main (non persiste)
  var factSeen = 0;                // bit i = saviez-vous FACTS[i] deja vu (persistant)
  var explodedAt = 0, rainSince = null, rainCount = 0, harvestCount = 0, fertDropped = false, pleuroteDug = false, msgTickAt = 0;
  var FACTS = [
    { text: 'Un sol nu est lessivé : la pluie emporte l\'humus et ses nutriments vers les cours d\'eau.', when: function () { return rainSince !== null && performance.now() - rainSince > 20000 && !mycAlive(); } },
    { text: 'Les filaments du mycélium agrègent les particules de sol, qui résistent mieux à l\'érosion.', when: function () { return weather.raining && mycAlive(); } },
    { text: 'Le champignon que vous cueillez n\'est que le fruit : le vrai organisme, le mycélium, vit sous terre.', when: function () { return harvestCount >= 1; } },
    { text: 'Le champignon apporte à la plante de l\'eau et des minéraux, surtout du phosphore, et reçoit des sucres en échange.', when: function () { return trees.length > 0 && mycAlive(); } },
    { text: 'Champignons et bactéries sont les principaux décomposeurs : sans eux, le bois mort s\'accumulerait.', when: function () { return litter.length > 0 && mycAlive(); } },
    { text: 'La pluie lessive surtout les nutriments solubles, comme les nitrates.', when: function () { return rainCount >= 2 || fertDropped; } },
    { text: 'Un champignon libère des millions de spores, invisibles à l\'œil nu.', when: function () { return harvestCount >= 1; } },
    { text: 'Le pleurote pousse sur la paille ou le marc de café : il recycle des déchets.', when: function () { return pleuroteDug || harvestCount >= 2; } },
    { text: 'L\'humus retient l\'eau comme une éponge et limite le ruissellement.', when: function () { return weather.raining && humusPresent(); } },
    { text: 'Un champignon n\'est ni une plante ni un animal : c\'est un règne à part, plus proche des animaux.', when: function () { return performance.now() - explodedAt > 240000; } }
    ,{ text: 'Certaines espèces ne se cultivent que sur le bois dur : inoculez le bois avec de l\'hydne hérisson.', now: true, when: function () { return branchTorn && unlockedStrains.indexOf('hydne') !== -1; } }
  ];
  function mycAlive() {
    for (var i = 0; i < colonised.length; i++) if (colonised[i].myc > MYC_READY) return true;
    return false;
  }
  function humusPresent() {
    for (var i = 0; i < shards.length; i++) if (shards[i].nutri && shards[i].settled) return true;
    return false;
  }
  function msgBlocked(t) {
    return mode !== 'exploded' || tipOpen || t - tipChangeAt < LEACH_TIP_QUIET_MS || (caption && caption.classList.contains('is-visible'));
  }
  function setCard(el, on) {
    if (!el) return;
    el.classList.toggle('is-visible', on);
    el.setAttribute('aria-hidden', on ? 'false' : 'true');
  }
  // ack : le conseil revient tant que le joueur n a pas clique "Compris" (sinon une seule fois).
  function leachTip(bit, text, ack) {
    if (leachTipSeen & bit) return;
    var t = performance.now();
    // Pendant la demo, et tant que le tutoriel n'est pas fini : ni conseil vert ni saviez-vous (voir aussi flushDeathAlert, msgTick).
    if (!explainEl || msgBlocked(t) || t - leachTipAt < LEACH_TIP_GAP_MS || DEMO || guideCurrent()) return;
    if (!ack) leachTipSeen |= bit;
    leachTipAt = t;
    showExplain(text, null, ack ? bit : 0);
    return true;
  }
  var explainAckBit = 0;           // bit du conseil affiche avec "Compris" (0 = pas de bouton)
  function showExplain(text, locate, ackBit) {
    hideFact(true);
    clearTimeout(explainTimer);
    explainText.textContent = text;
    deathLocate = locate || null;
    explainEl.classList.toggle('has-locate', !!locate);
    explainAckBit = ackBit || 0;
    explainEl.classList.toggle('has-ack', !!explainAckBit);
    setCard(explainEl, true);
    explainTimer = setTimeout(hideExplain, locate ? DEATH_ALERT_SHOW_MS : EXPLAIN_MS);
  }
  // Alerte de mort du mycelium (chaque fois, avec bouton "Voir"). Les morts groupees sont
  // fusionnees : on garde la premiere en attente, et une seule alerte part a la fois.
  var DEATH_ALERT_GAP_MS = 9000, DEATH_ALERT_SHOW_MS = 20000, DEATH_ALERT_STALE_MS = 15000;
  var DEATH_TEXTS = {
    drought: 'Un îlot de votre mycélium a séché : en surface, sans pluie, il ne survit pas à la sécheresse.',
    starve: 'Un îlot de votre mycélium est mort faute de matière : il lui faut du bois mort ou des feuilles à décomposer à portée.'
  };
  // Alerte PAR PATCH : un patch = facettes vivantes de la MEME souche qui se touchent (<= PATCH_LINK px).
  // Chaque facette porte un pid ; snapshotPatches (1 Hz) recalcule les composantes connexes et
  // reconcilie les pid (fusion = pid majoritaire, scission = la plus grosse garde le sien). Une alerte
  // part quand une bonne partie d'UN patch meurt de faim/secheresse en PATCH_WINDOW_MS. Pelleter un
  // patch en deux n'est jamais une mort. Le pid n'est pas sauvegarde (recalcule au 1er instantane).
  var PATCH_LINK = 14, PATCH_WINDOW_MS = 20000, PATCH_MIN_SIZE = 12, PATCH_MIN_DEATHS = 6;
  var PATCH_SHARE = 0.4, PATCH_REARM_MS = 45000, PATCH_SNAP_MS = 1000;
  var patches = {}, patchSeq = 0, patchSnapAt = -1e9;
  var pLive = [], pTKey = null, pTHead = null, pTMask = 0, pUf = null, pNext = null, pComp = null;
  var deathPending = null, deathLocate = null, deathAlertAt = -1e9, camGoal = null;
  var explainClose = explainEl && explainEl.querySelector('.logo-explosion-explain-close');
  if (explainClose) explainClose.addEventListener('click', function (evt) { evt.stopPropagation(); hideExplain(); });
  var explainAck = explainEl && explainEl.querySelector('.logo-explosion-explain-ack');
  if (explainAck) explainAck.addEventListener('click', function (evt) { evt.stopPropagation(); leachTipSeen |= explainAckBit; hideExplain(); });
  var deathBtn = explainEl && explainEl.querySelector('.logo-explosion-explain-locate');
  function makePatch(pid) {
    return (patches[pid] = { alive: 0, deaths: [], alertedAt: -1e9, peak: 0, emptySince: null });
  }
  function resetPatches() { patches = {}; patchSeq = 0; patchSnapAt = -1e9; deathPending = null; }
  function ufFind(x) {
    while (pUf[x] !== x) { pUf[x] = pUf[pUf[x]]; x = pUf[x]; }
    return x;
  }
  // Votes d'une composante : un seul pid (le cas courant) sans Map, une Map des qu'il y en a plusieurs.
  function compVote(comp, pid) {
    if (comp.p1 === 0 || comp.p1 === pid) { comp.p1 = pid; comp.n1++; return; }
    if (!comp.votes) { comp.votes = new Map(); comp.votes.set(comp.p1, comp.n1); }
    comp.votes.set(pid, (comp.votes.get(pid) || 0) + 1);
  }
  function compEach(comp, fn) {
    if (comp.votes) comp.votes.forEach(fn); else if (comp.p1) fn(comp.n1, comp.p1);
  }
  // Table de hachage ouverte (cle de cellule -> tete de liste), sans allocation par passage.
  function cellSlot(key) {
    var h = (Math.imul(key, 2654435761) >>> 8) & pTMask;
    while (pTHead[h] !== -2 && pTKey[h] !== key) h = (h + 1) & pTMask;
    return h;
  }
  function snapshotPatches(now) {
    if (now - patchSnapAt < PATCH_SNAP_MS) return;
    patchSnapAt = now;
    var i, j, k, c, o, comp, pid0, L2 = PATCH_LINK * PATCH_LINK;
    pLive.length = 0;
    for (i = 0; i < colonised.length; i++) { c = colonised[i]; if (c.myc > 0 && !c.deadMyc) pLive.push(c); }
    var n = pLive.length;
    if (!pUf || pUf.length < n) { pUf = new Int32Array(Math.max(256, n * 2)); pNext = new Int32Array(pUf.length); pComp = new Int32Array(pUf.length); }
    var tsz = 16;
    while (tsz < n * 2) tsz <<= 1;
    if (!pTHead || pTHead.length < tsz) { pTKey = new Int32Array(tsz); pTHead = new Int32Array(tsz); }
    pTMask = pTHead.length - 1;
    pTHead.fill(-2);
    for (i = 0; i < n; i++) {
      pUf[i] = i; pNext[i] = -1; pComp[i] = -1;
      c = pLive[i];
      if (!c.settled) continue; // en vol / a la pelle : aucun lien, garde son pid
      var key = (Math.floor(c.x / PATCH_LINK) + 2) * 65536 + Math.floor(c.y / PATCH_LINK) + 2, sl = cellSlot(key);
      if (pTHead[sl] !== -2) pNext[i] = pTHead[sl]; else pTKey[sl] = key;
      pTHead[sl] = i;
    }
    for (i = 0; i < n; i++) {
      c = pLive[i];
      if (!c.settled) continue;
      var cx = Math.floor(c.x / PATCH_LINK) + 2, cy = Math.floor(c.y / PATCH_LINK) + 2, sid = (c.strain || STRAIN_STD).id;
      for (var gx = cx - 1; gx <= cx + 1; gx++) for (var gy = cy - 1; gy <= cy + 1; gy++) {
        var sl2 = cellSlot(gx * 65536 + gy);
        j = pTHead[sl2];
        if (j === -2) continue;
        for (; j !== -1; j = pNext[j]) {
          if (j <= i) continue;
          o = pLive[j];
          var dx = o.x - c.x, dy = o.y - c.y;
          if (dx * dx + dy * dy > L2 || (o.strain || STRAIN_STD).id !== sid) continue;
          var ra = ufFind(i), rb = ufFind(j);
          if (ra !== rb) pUf[ra] = rb;
        }
      }
    }
    // Composantes (settled seulement) et votes, en nombre de facettes, sur les pid existants.
    var comps = [];
    for (i = 0; i < n; i++) {
      c = pLive[i];
      if (!c.settled) continue;
      var r = ufFind(i);
      if (pComp[r] < 0) { pComp[r] = comps.length; comps.push({ size: 0, p1: 0, n1: 0, votes: null, pid: 0 }); }
      comp = comps[pComp[r]];
      comp.size++;
      if (c.pid) compVote(comp, c.pid);
    }
    comps.sort(function (a, b) { return b.size - a.size; });
    var claimed = {}, remap = {};
    for (k = 0; k < comps.length; k++) {
      comp = comps[k];
      var best = 0, bv = 0;
      compEach(comp, function (v, pid) { if (v > bv) { bv = v; best = pid; } });
      if (best && !claimed[best] && patches[best]) comp.pid = best;
      else { comp.pid = ++patchSeq; makePatch(comp.pid); } // scission (ou 1re fois) : historique vide
      claimed[comp.pid] = true;
    }
    // Fusion : les pid perdants, reclames par personne, sont absorbes par le gagnant.
    for (k = 0; k < comps.length; k++) {
      comp = comps[k];
      compEach(comp, function (v, pid) {
        if (pid === comp.pid || claimed[pid] || remap[pid] || !patches[pid]) return;
        var w = patches[comp.pid], l = patches[pid];
        w.deaths = w.deaths.concat(l.deaths);
        w.peak += l.peak;
        w.alertedAt = Math.max(w.alertedAt, l.alertedAt);
        remap[pid] = comp.pid;
        delete patches[pid];
      });
    }
    for (pid0 in patches) patches[pid0].alive = 0;
    for (i = 0; i < n; i++) {
      c = pLive[i];
      if (c.settled) c.pid = comps[pComp[ufFind(i)]].pid;
      else if (c.pid && remap[c.pid]) c.pid = remap[c.pid];
      if (!c.pid) continue;
      (patches[c.pid] || makePatch(c.pid)).alive++;
    }
    for (pid0 in patches) {
      var p = patches[pid0];
      if (p.alive > p.peak) p.peak = p.alive;
      while (p.deaths.length && now - p.deaths[0].t > PATCH_WINDOW_MS) p.deaths.shift();
      if (p.alive > 0) p.emptySince = null;
      else if (p.emptySince === null) p.emptySince = now; // gardé PATCH_WINDOW_MS : "tout le patch est mort" peut encore partir
      else if (now - p.emptySince > PATCH_WINDOW_MS) delete patches[pid0];
    }
  }
  // Appelee AVANT le splice de la facette c. Seules les morts de faim/secheresse comptent au
  // numerateur ; une mort aleatoire baisse juste l'effectif du patch.
  function notePatchDeath(c, cause) {
    var p = c.pid && patches[c.pid];
    if (!p) return;
    if (p.alive > 0) p.alive--;
    if (cause !== 'drought' && cause !== 'starve') return;
    var t = performance.now(), d = p.deaths, i;
    d.push({ t: t, x: c.x, y: c.y, cause: cause });
    while (d.length && t - d[0].t > PATCH_WINDOW_MS) d.shift();
    var k = d.length, base = k + p.alive;
    if (base < PATCH_MIN_SIZE || k < PATCH_MIN_DEATHS || k < PATCH_SHARE * base || t - p.alertedAt <= PATCH_REARM_MS) return;
    var sx = 0, sy = 0, starve = 0;
    for (i = 0; i < k; i++) { sx += d[i].x; sy += d[i].y; if (d[i].cause === 'starve') starve++; }
    sx /= k; sy /= k;
    var bi = 0, bd = 1e18; // mort reelle la plus proche du centroide : un point qui existe vraiment
    for (i = 0; i < k; i++) {
      var dd = (d[i].x - sx) * (d[i].x - sx) + (d[i].y - sy) * (d[i].y - sy);
      if (dd < bd) { bd = dd; bi = i; }
    }
    p.alertedAt = t;
    var alert = { x: d[bi].x, y: d[bi].y, cause: starve * 2 >= k ? 'starve' : 'drought', k: k, t: t };
    p.deaths = [];
    // Une seule alerte a la fois : si plusieurs patchs s'effondrent, on garde le pire (plus grand k).
    if (deathPending && t - deathPending.t < DEATH_ALERT_STALE_MS && deathPending.k >= k) return;
    deathPending = alert;
  }
  function flushDeathAlert() {
    if (!deathPending) return;
    var t = performance.now();
    if (t - deathPending.t > DEATH_ALERT_STALE_MS) { deathPending = null; return; }
    if (!explainEl || !explainText || msgBlocked(t) || t - deathAlertAt < DEATH_ALERT_GAP_MS || DEMO || guideCurrent()) return;
    if (explainEl.classList.contains('is-visible')) return; // jamais empile
    var d = deathPending;
    deathPending = null;
    deathAlertAt = t;
    showExplain(DEATH_TEXTS[d.cause], { x: d.x, y: d.y });
  }
  if (deathBtn) deathBtn.addEventListener('click', function (evt) {
    evt.stopPropagation();
    if (!deathLocate || mode !== 'exploded') return;
    // Glissement doux vers la position (clampe aux bornes), gere dans step().
    camGoal = { x: clamp(deathLocate.x - W / 2, 0, Math.max(0, worldW - W)), y: clamp(deathLocate.y - H / 2, camMinY(), Math.max(camMinY(), worldH - H)) };
    hideExplain();
    startLoop();
  });
  function hideExplain() {
    clearTimeout(explainTimer);
    if (explainEl && explainEl.classList.contains('is-visible')) explainEndAt = performance.now();
    setCard(explainEl, false);
    if (explainEl) explainEl.classList.remove('has-locate', 'has-ack');
    explainAckBit = 0;
    deathLocate = null;
  }
  // interrupted : masque force par une instruction/explication/infobulle. Si le joueur
  // n'a pas eu le temps de le lire (moins de 5 s), il sera retente plus tard.
  function hideFact(interrupted) {
    clearTimeout(factTimer);
    if (factShown < 0) return;
    if (interrupted && performance.now() - factShownAt < 5000) factSeen &= ~(1 << factShown);
    factShown = -1;
    setCard(factEl, false);
  }
  function showFact(i) {
    var t = performance.now();
    factShown = i; factShownAt = t; factAt = t;
    factSeen |= 1 << i;
    factText.textContent = FACTS[i].text;
    setCard(factEl, true);
    factTimer = setTimeout(function () { hideFact(false); }, FACT_MS);
    savePlayerIfChanged();
  }
  if (factClose) factClose.addEventListener('click', function () { hideFact(false); });
  // Appele au plus une fois par seconde depuis step() : choisit un saviez-vous a afficher.
  function msgTick() {
    var t = performance.now();
    if (t - msgTickAt < 1000) return;
    msgTickAt = t;
    if (weather.raining) { if (rainSince === null) { rainSince = t; rainCount++; } } else rainSince = null;
    challengeTick(t);
    if (!factEl || factShown >= 0 || msgBlocked(t) || DEMO || guideCurrent()) return;
    if ((explainEl && explainEl.classList.contains('is-visible')) || t - explainEndAt < FACT_AFTER_EXPLAIN_MS) return;
    var slow = t - explodedAt >= FACT_FIRST_MS && t - factAt >= FACT_GAP_MS; // delais normaux ; les faits "now" les ignorent
    for (var i = 0; i < FACTS.length; i++) {
      if (!(factSeen & (1 << i)) && (slow || FACTS[i].now) && FACTS[i].when()) { showFact(i); return; }
    }
  }

  // Defis : 11 objectifs apres les tresors, coches une seule fois et sauves avec le joueur
  // (chDone = bitmask, chPlanted = arbres plantes par le joueur). Verifies a 1 Hz depuis
  // msgTick ; l'annonce (setCaption) attend qu'aucun message/infobulle ne soit affiche.
  // ATTENTION : ne jamais reordonner ni inserer au milieu : les bits (chDone) sont sauvegardes.
  // Ajouter les nouveaux defis en fin de tableau seulement. unlocked() : condition d'affichage
  // ET de validation (un defi ne se coche que s'il est debloque).
  var CHALLENGES = [
    { label: 'Arracher une branche à la main', unlocked: function () { return chIsDone(2); } },   // apres la maturite d'un arbre
    { label: 'Planter 8 arbres', unlocked: function () { return true; }, progress: function () { return Math.min(chPlanted, CH_TREES_GOAL) + '/' + CH_TREES_GOAL; } },
    { label: 'Voir un arbre atteindre sa pleine maturité', unlocked: function () { return chPlanted >= 1; } },
    { label: 'Avoir 3 souches de mycélium vivantes', unlocked: function () { return chIsDone(5); }, progress: function () { return chStrainsOk + '/' + CH_STRAINS_GOAL; } },
    { label: 'Réunir arbre, mycélium et gazon vivants', unlocked: function () { return chIsDone(2); } },
    { label: 'Coloniser 10 % du monde', unlocked: function () { return true; }, progress: function () { return Math.round(chPctNow * 100) + ' %'; } },
    { label: 'Coloniser 25 % du monde', unlocked: function () { return chIsDone(5); }, progress: function () { return Math.round(chPctNow * 100) + ' %'; } },
    { label: 'Coloniser 50 % du monde', unlocked: function () { return chIsDone(6); }, progress: function () { return Math.round(chPctNow * 100) + ' %'; } },
    { label: 'Récolter 10 strophaires', unlocked: function () { return true; }, progress: function () { return Math.min(chHarv[0], CH_HARVEST_GOAL) + '/' + CH_HARVEST_GOAL; }, gift: true },
    { label: 'Récolter 10 pleurotes', unlocked: function () { return chIsDone(8); }, progress: function () { return Math.min(chHarv[1], CH_HARVEST_GOAL) + '/' + CH_HARVEST_GOAL; }, gift: true },
    { label: 'Récolter 10 hydnes', unlocked: function () { return chIsDone(9); }, progress: function () { return Math.min(chHarv[2], CH_HARVEST_GOAL) + '/' + CH_HARVEST_GOAL; }, gift: true },
    { label: 'Attraper un papillon', unlocked: function () { return true; } }   // a la main ; sans recompense
  ];
  function chIsDone(k) { return !!(chDone & (1 << k)); }
  // Defis 9 a 11 (index 8..10) : recolte a la main par souche, enchaines ; chacun offre un arbre
  // (credit freeTrees, consomme au prochain plantage a la place du prix).
  var CH_HARVEST_GOAL = 10;
  var CH_HARVEST_IDS = ['standard', 'pleurote', 'hydne'];
  var chHarv = [0, 0, 0], freeTrees = 0;
  var chPctNow = 0, chStrainsOk = 0;      // valeurs courantes affichees dans la progression (mises a jour a 1 Hz)
  var CH_TREES_GOAL = 8;
  var CH_STRAINS_GOAL = 3;                // souches (types) de mycelium distinctes vivantes en meme temps
  var CH_STRAIN_BIOMASS = 2;              // biomasse min par souche : somme des myc des facettes vivantes (myc 0..1 par facette, MYC_READY = 0.45)
  var CH_ZONE_REACH = 0.12;               // "zone vivante" : arbre, mycelium vivant et gazon dans ce rayon (x largeur ecran)
  var CH_COLONY_PCT = [0.1, 0.25, 0.5];   // paliers 6 a 8
  var CH_COLONY_HOLD_MS = 5000;           // un palier doit tenir ce temps de suite
  var chBadgeEl = document.getElementById('logo-explosion-challenges');
  var chDone = 0, chPlanted = 0, chPending = [], chHoldSince = [0, 0, 0], chListEl = null, chHeadEl = null, chDoneListEl = null, chDoneHeadEl = null;
  function chCount() { var n = 0; for (var i = 0; i < CHALLENGES.length; i++) if (chDone & (1 << i)) n++; return n; }
  function challengeDone(i) {
    if (DEMO || chDone & (1 << i)) return;
    chDone |= 1 << i;
    if (CHALLENGES[i].gift) freeTrees++;
    chPending.push(i);
    updateChallengeUI();
    savePlayerIfChanged();
  }
  // Affichage progressif : un defi n'apparait que quand il devient logique (paliers dans l'ordre,
  // maturite apres un arbre plante...), et 5 au plus a la fois. Les defis faits ne sont plus listes
  // (le compteur n/N les garde) ; un defi peut quand meme etre reussi avant d'etre affiche.
  var CH_MAX_SHOWN = 5;
  function chUnlocked(i) { return CHALLENGES[i].unlocked(); }
  function updateChallengeUI() {
    // N'ecrit dans le DOM que si la valeur change : ce tick a 1 Hz faisait clignoter la liste au survol.
    var head = 'Défis ' + chCount() + '/' + CHALLENGES.length;
    if (chHeadEl && chHeadEl.textContent !== head) chHeadEl.textContent = head;
    if (!chListEl) return;
    var shown = 0;
    for (var i = 0; i < chListEl.children.length; i++) {
      var li = chListEl.children[i];
      var vis = !(chDone & (1 << i)) && chUnlocked(i) && shown < CH_MAX_SHOWN;
      if (vis) shown++;
      if (li.hidden === vis) li.hidden = !vis;
      if (vis) {
        var pr = CHALLENGES[i].progress ? CHALLENGES[i].progress() : '';
        var label = CHALLENGES[i].label + (pr ? ' (' + pr + ')' : '');
        if (li.lastChild.nodeValue !== label) li.lastChild.nodeValue = label;
      }
    }
    if (chListEl.parentNode) chListEl.parentNode.classList.toggle('is-empty', shown === 0);
    if (chDoneListEl) {
      var doneKey = '', dn = 0;
      for (i = 0; i < CHALLENGES.length; i++) if (chDone & (1 << i)) { doneKey += i + ','; dn++; }
      if (chDoneListEl.dataset.key !== doneKey) {
        chDoneListEl.dataset.key = doneKey;
        chDoneListEl.textContent = '';
        for (i = 0; i < CHALLENGES.length; i++) if (chDone & (1 << i)) {
          var dli = document.createElement('li');
          dli.textContent = '☑ ' + CHALLENGES[i].label;
          chDoneListEl.appendChild(dli);
        }
        if (!dn) { var nli = document.createElement('li'); nli.textContent = 'Aucun pour l\'instant'; chDoneListEl.appendChild(nli); }
      }
      var dt = 'Défis réussis (' + dn + ')';
      if (chDoneHeadEl && chDoneHeadEl.textContent !== dt) chDoneHeadEl.textContent = dt;
    }
  }
  // Pastille "Defis n/N" dans la barre d'outils (sous l'argent) ; la liste complete sort au survol.
  (function buildChallengeBadge() {
    var badge = document.getElementById('logo-explosion-challenges');
    if (!badge) return;
    chHeadEl = badge.querySelector('.logo-explosion-challenges-count');
    var pop = badge.querySelector('.logo-explosion-challenges-pop');
    chListEl = document.createElement('ul');
    chListEl.className = 'logo-explosion-challenges';
    CHALLENGES.forEach(function (ch) {
      var li = document.createElement('li');
      var box = document.createElement('span');
      box.textContent = '☐ ';
      li.appendChild(box);
      li.appendChild(document.createTextNode(ch.label));
      chListEl.appendChild(li);
    });
    pop.appendChild(chListEl);
    // 2e temps : un chevron deplie la liste des defis reussis sous la liste en cours.
    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'logo-explosion-challenges-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    chDoneHeadEl = document.createElement('span');
    toggle.appendChild(chDoneHeadEl);
    var chev = document.createElement('span');
    chev.className = 'logo-explosion-challenges-chevron';
    chev.setAttribute('aria-hidden', 'true');
    chev.textContent = '▾';
    toggle.appendChild(chev);
    chDoneListEl = document.createElement('ul');
    chDoneListEl.className = 'logo-explosion-challenges logo-explosion-challenges-done';
    chDoneListEl.hidden = true;
    toggle.addEventListener('click', function (evt) {
      evt.stopPropagation();
      var open = chDoneListEl.hidden;
      chDoneListEl.hidden = !open;
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.classList.toggle('is-open', open);
    });
    pop.appendChild(toggle);
    pop.appendChild(chDoneListEl);
    // Ouverture au clic (plus au survol) ; se ferme en recliquant la pastille, ailleurs ou avec Echap.
    function setBadgeOpen(o) {
      badge.classList.toggle('is-open', o);
      badge.setAttribute('aria-expanded', o ? 'true' : 'false');
    }
    badge.setAttribute('aria-expanded', 'false');
    badge.addEventListener('click', function (evt) {
      if (pop.contains(evt.target)) return;
      setBadgeOpen(!badge.classList.contains('is-open'));
    });
    badge.addEventListener('keydown', function (evt) {
      if (evt.target !== badge) return;
      if (evt.key === 'Enter' || evt.key === ' ') { evt.preventDefault(); setBadgeOpen(!badge.classList.contains('is-open')); }
      else if (evt.key === 'Escape') setBadgeOpen(false);
    });
    document.addEventListener('click', function (evt) { if (!badge.contains(evt.target)) setBadgeOpen(false); });
    updateChallengeUI();
  })();
  function challengeTick(t) {
    if (mode !== 'exploded') return;
    var i, j, c, all = CHALLENGES.length;
    updateChallengeUI(); // deblocage progressif (arbres plantes...), 1 fois par seconde
    if (chPending.length && !msgBlocked(t)) {
      var k = chPending.shift();
      var gift = CHALLENGES[k].gift ? ' — un arbre offert !' : '';
      setCaption(chCount() >= all && !chPending.length ? 'Tous les défis sont réussis, bravo !' + gift : 'Défi réussi : ' + CHALLENGES[k].label + gift);
    }
    if (chDone === (1 << all) - 1) return;
    if (!(chDone & 2) && chUnlocked(1) && chPlanted >= CH_TREES_GOAL) challengeDone(1);
    if (!(chDone & 4) && chUnlocked(2)) {
      for (i = 0; i < trees.length; i++) {
        if (trees[i].growth < 1) trees[i].seenGrowing = true;
        else if (trees[i].seenGrowing) { challengeDone(2); break; }
      }
    }
    var need = false; // rien a verifier si les defis 3 a 7 sont faits ou verrouilles
    for (i = 3; i <= 7; i++) if (!(chDone & (1 << i)) && chUnlocked(i)) { need = true; break; }
    if (!need) return;
    var bio = {}, cols = {}, nCols = heights.length - 1, nAlive = 0, live = [];
    for (i = 0; i < colonised.length; i++) {
      c = colonised[i];
      if (!(c.myc > MYC_READY) || c.deadMyc) continue;
      live.push(c);
      var sid = c.strain || 'standard';
      bio[sid] = (bio[sid] || 0) + c.myc;
      cols[Math.max(0, Math.min(nCols - 1, Math.floor(c.x / COL_W)))] = 1;
    }
    if (!(chDone & 8) && chUnlocked(3)) {
      var ok = 0;
      for (var id in bio) if (bio[id] >= CH_STRAIN_BIOMASS) ok++;
      chStrainsOk = ok;
      if (ok >= CH_STRAINS_GOAL) challengeDone(3);
    }
    if (!(chDone & 16) && chUnlocked(4) && live.length && trees.length) {
      var reach = UW * CH_ZONE_REACH, cr = Math.ceil(reach / COL_W);
      for (i = 0; i < trees.length; i++) {
        var hasMyc = false, hasGrass = false, tc = Math.floor(trees[i].x / COL_W);
        for (j = 0; j < live.length; j++) if (Math.abs(live[j].x - trees[i].x) < reach) { hasMyc = true; break; }
        if (!hasMyc) continue;
        for (j = Math.max(0, tc - cr); j <= Math.min(grassCover.length - 1, tc + cr); j++) if (grassCover[j] > 0.5) { hasGrass = true; break; }
        if (hasGrass) { challengeDone(4); break; }
      }
    }
    for (var key in cols) nAlive++;
    var pct = nCols > 0 ? nAlive / nCols : 0;
    chPctNow = pct;
    for (i = 0; i < 3; i++) {
      if ((chDone & (32 << i)) || !chUnlocked(5 + i)) { chHoldSince[i] = 0; continue; }
      if (pct >= CH_COLONY_PCT[i]) {
        if (!chHoldSince[i]) chHoldSince[i] = t;
        else if (t - chHoldSince[i] >= CH_COLONY_HOLD_MS) challengeDone(5 + i);
      } else chHoldSince[i] = 0;
    }
  }
  function hideMsgs() { hideExplain(); hideFact(true); }
  function setCaption(text, keepFact, sticky) {
    if (!caption) return;
    clearTimeout(captionTimer);
    if (!text) { caption.classList.remove('is-visible'); return; }
    if (text !== CAPTION_BEFORE && !keepFact) hideFact(true); // une instruction passe toujours avant
    caption.textContent = text;
    caption.classList.add('is-visible');
    if (text !== CAPTION_BEFORE && !sticky) captionTimer = setTimeout(function () { caption.classList.remove('is-visible'); }, 6000);
  }

  // Effet magnetique du badge "play" : des qu'on bouge la souris sur la page, le badge
  // se decale vers le curseur (jusqu'a MAGNET_MAX). Purement decoratif : pilote --mx/--my
  // lus par le transform CSS du badge. Le hover/curseur reel est gere par la zone fixe
  // autour de lui (.logo-explosion-play-zone dans style.css), pas par le badge lui-meme
  // qui bouge — sinon le :hover papillote pendant qu'il se deplace.
  var playBadge = document.querySelector('.logo-explosion-play-badge');
  if (playBadge) {
    var MAGNET_MAX = 80;     // px, decalage max du badge
    var MAGNET_EASE = 0.09;  // lissage du suivi (pas de saut brusque)
    var magnetTx = 0, magnetTy = 0, magnetCx = 0, magnetCy = 0;
    var badgeZone = playBadge.parentElement;

    // pointermove filtre sur la souris, pas mousemove : apres un tap, le navigateur envoie
    // un faux mousemove qui laisserait le badge decale vers l'endroit touche.
    document.addEventListener('pointermove', function (evt) {
      if (evt.pointerType !== 'mouse') return;
      var zr = badgeZone.getBoundingClientRect();
      var bx = zr.left + zr.width / 2, by = zr.top + zr.height / 2;
      var dx = evt.clientX - bx, dy = evt.clientY - by;
      var dist = Math.hypot(dx, dy);
      var radius = Math.max(window.innerWidth, 900); // couvre toute la largeur de l'ecran
      if (dist > radius) { magnetTx = 0; magnetTy = 0; return; }
      // Vise la position reelle du curseur, bornee a MAGNET_MAX.
      var k = dist > MAGNET_MAX ? MAGNET_MAX / dist : 1;
      magnetTx = dx * k; magnetTy = dy * k;
    });
    document.addEventListener('mouseleave', function () { magnetTx = 0; magnetTy = 0; });

    (function stepMagnet() {
      var ease = holdTimer ? HOLD_FOLLOW_EASE : MAGNET_EASE; // au doigt : colle de pres
      magnetCx += (magnetTx - magnetCx) * ease;
      magnetCy += (magnetTy - magnetCy) * ease;
      playBadge.style.setProperty('--mx', magnetCx.toFixed(2) + 'px');
      playBadge.style.setProperty('--my', magnetCy.toFixed(2) + 'px');
      requestAnimationFrame(stepMagnet);
    })();
  }

  // --- Tutoriel guide : fleche d'invite pilotee par une table d'etapes --------------------------
  // L'etape courante est la premiere de GUIDE dont done() est faux ; la fleche, le halo et les
  // messages la lisent. Ajouter une etape = ajouter une ligne. Champs : done() ; target(cr) ->
  // {x,y} en px du conteneur ; dir = cote de la fleche par rapport a sa cible (right/left/up/down) ;
  // magnet = la fleche se penche vers le curseur ; halo = halo au pied des arbres matures ;
  // msg = legende affichee une fois a l'entree dans l'etape. Les drapeaux d'avancement sont
  // gardes en localStorage : au retour, le tutoriel reprend ou on s'etait arrete.
  var guideLastId = null, guideMsgShown = {}, guideStickyText = null;
  var GUIDE_KEY = 'spora-guide-v1';
  var guideFlags = { tools: false, myc: false, strain: false, poured: false, hand: false, fed: false, harvest: false };
  try {
    var savedGuide = JSON.parse(localStorage.getItem(GUIDE_KEY) || 'null');
    if (savedGuide) for (var gk in guideFlags) if (savedGuide[gk] === true) guideFlags[gk] = true;
  } catch (e) { /* stockage indisponible : on repart du debut */ }
  function guideSet(flag) {
    if (guideFlags[flag]) return;
    guideFlags[flag] = true;
    try { localStorage.setItem(GUIDE_KEY, JSON.stringify(guideFlags)); } catch (e) { /* ignore */ }
  }
  // Remise a zero du tutoriel (reset du jeu) : drapeaux, sauvegarde, messages deja montres.
  function guideReset() {
    for (var k in guideFlags) guideFlags[k] = false;
    mycFedOnce = false;
    guideLastId = null; guideMsgShown = {}; guideStickyText = null;
    try { localStorage.removeItem(GUIDE_KEY); } catch (e) { /* rien a effacer */ }
  }
  function guideElTarget(getEl) {
    return function (cr) {
      var el = getEl(), r = el ? el.getBoundingClientRect() : null;
      if (r && r.width > 0) return { x: r.left - cr.left + r.width / 2, y: r.top - cr.top + r.height / 2 };
      var tb = toolsBar.getBoundingClientRect();
      return { x: tb.left - cr.left + 20, y: tb.top - cr.top + 20 };
    };
  }
  // Cibles du monde : px logiques * cr.width / W (= * ZOOM) -> px CSS ; les marges (40, 90, 20) sont en px CSS, d'ou / ZOOM.
  // -1 / 1 si la cible est hors ecran a gauche / a droite (la fleche pointe alors droit vers ce cote), sinon 0.
  function guideOff(sx) { return sx < 40 / ZOOM ? -1 : sx > W - 40 / ZOOM ? 1 : 0; }
  function guideTreeTarget(cr) {
    var list = matureTrees(), best = null, bd = Infinity, i;
    for (i = 0; i < list.length; i++) {
      var d = Math.abs(list[i].x - (camX + W / 2));
      if (d < bd) { bd = d; best = list[i]; }
    }
    if (!best) return null;
    return { x: clamp(best.x - camX, 40 / ZOOM, W - 40 / ZOOM) * cr.width / W, y: clamp(surfaceAt(best.x) - camY - 12, 90 / ZOOM, H - 20 / ZOOM) * cr.height / H, off: guideOff(best.x - camX) };
  }
  function guideCanopyTarget(cr) {
    var list = matureTrees(), best = null, bd = Infinity, i;
    if (!list.length) list = trees;
    for (i = 0; i < list.length; i++) {
      var d = Math.abs(list[i].x - (camX + W / 2));
      if (d < bd) { bd = d; best = list[i]; }
    }
    if (!best) return null;
    var tg = treeScale(best), by = best.by !== undefined ? best.by : surfaceAt(best.x) + TREE_EMBED;
    return { x: clamp(best.x - camX, 40 / ZOOM, W - 40 / ZOOM) * cr.width / W, y: clamp(by - best.h * tg - camY, 90 / ZOOM, H - 20 / ZOOM) * cr.height / H, off: guideOff(best.x - camX) };
  }
  // Centre du mycelium vivant (la ou deposer le bois), ou null s'il n'y en a pas.
  function guideMycTarget(cr) {
    var n = 0, mx = 0, my = 0;
    for (var i = 0; i < colonised.length; i++) if (colonised[i].myc > 0) { n++; mx += colonised[i].x; my += colonised[i].y; }
    if (!n) return null;
    mx /= n; my /= n;
    return { x: clamp(mx - camX, 40 / ZOOM, W - 40 / ZOOM) * cr.width / W, y: clamp(my - camY - 10, 90 / ZOOM, H - 20 / ZOOM) * cr.height / H, off: guideOff(mx - camX) };
  }
  // Le bois est en main : on pointe le mycelium ; lache au mauvais endroit, on repointe l'arbre.
  function guideLeavesTarget(cr) {
    return (handCarry.length && guideMycTarget(cr)) || guideCanopyTarget(cr);
  }
  function guideLeavesHint() {
    return handCarry.length ? CAPTION_MYC_DROP : CAPTION_MYC_LEAVES;
  }
  // Champignon mur issu du mycelium le plus proche du centre de l'ecran, ou null.
  function guideMushroomTarget(cr) {
    var best = null, bd = Infinity, i;
    for (i = 0; i < mushrooms.length; i++) {
      var m = mushrooms[i];
      if (!m.myc || m.treasure || m.dying || m.t < 0.9) continue;
      var d = Math.abs(m.x - (camX + W / 2));
      if (d < bd) { bd = d; best = m; }
    }
    if (!best) return guideMycTarget(cr);
    return { x: clamp(best.x - camX, 40 / ZOOM, W - 40 / ZOOM) * cr.width / W, y: clamp(surfaceAt(best.x) - best.size * 0.8 - camY, 90 / ZOOM, H - 20 / ZOOM) * cr.height / H, off: guideOff(best.x - camX) };
  }
  function guideTreeHint() {
    if (matureTrees().length) return null;
    return trees.length ? CAPTION_MYC_TREE_WAIT : CAPTION_MYC_TREE_NONE;
  }
  function livingMyc() {
    for (var i = 0; i < colonised.length; i++) if (colonised[i].myc > 0) return true;
    return false;
  }
  function guideHarvestHint() {
    if (!livingMyc() && !mushrooms.some(function (m) { return m.myc && !m.treasure && !m.dying && m.t >= 0.9; })) return CAPTION_MYC_REPOUR;
    return mushrooms.some(function (m) { return m.myc && !m.treasure && !m.dying && m.t >= 0.9; }) ? CAPTION_MYC_HARVEST : CAPTION_MYC_GROW;
  }
  var GUIDE = [
    { id: 'tools', done: function () { return guideFlags.tools; }, magnet: true,
      target: guideElTarget(function () { return toolsBar; }) },
    { id: 'myc', done: function () { return guideFlags.myc && unlockedStrains.length > 0; }, dir: 'right',
      target: guideElTarget(function () { return toolsBar.querySelector('[data-tool="mycelium"]'); }) },
    { id: 'strain', done: function () { return DEMO || guideFlags.strain || guideFlags.poured; }, dir: 'down', // demo : une seule souche, menu cache
      target: guideElTarget(function () { return strainsBar && (strainsBar.querySelector('[data-strain="' + bagStrain + '"]') || strainsBar.querySelector('[data-strain]')); }) },
    { id: 'tree', done: function () { return guideFlags.poured && (guideFlags.fed || livingMyc()); }, dir: 'up', magnet: true, halo: 'tree', hint: guideTreeHint,
      target: guideTreeTarget, msg: function () { return CAPTION_MYC_PLACE; } },
    { id: 'hand', done: function () { return guideFlags.hand; }, dir: 'right', hint: CAPTION_MYC_HAND,
      target: guideElTarget(function () { return toolsBar.querySelector('[data-tool="hand"]'); }) },
    { id: 'leaves', done: function () { return guideFlags.fed; }, dir: 'right', magnet: true, fadeNear: true, hint: guideLeavesHint,
      target: guideLeavesTarget },
    { id: 'harvest', done: function () { return guideFlags.harvest; }, dir: 'up', magnet: true, fadeNear: true, hint: guideHarvestHint,
      target: guideMushroomTarget }
  ];
  function guideCurrent() {
    for (var i = 0; i < GUIDE.length; i++) if (!GUIDE[i].done()) return GUIDE[i];
    return null;
  }
  if (toolsArrow && toolsBar) {
    ['mouseenter', 'focusin', 'touchstart'].forEach(function (ev) {
      toolsBar.addEventListener(ev, function () { guideSet('tools'); });
    });
    var arrowCx = 0, arrowCy = 0, arrowInit = false, ARROW_MAGNET_MAX = 70, mouseCX = null, mouseCY = null;
    document.addEventListener('mousemove', function (evt) { mouseCX = evt.clientX; mouseCY = evt.clientY; });
    (function stepGuideArrow() {
      requestAnimationFrame(stepGuideArrow);
      if (toolsArrow.classList.contains('d-none')) { arrowInit = false; return; }
      // Du mycelium vivant pres d'un arbre mature compte comme verse, meme si le clic etait un peu loin.
      if (!guideFlags.poured) for (var pc = 0; pc < colonised.length; pc++) if (colonised[pc].myc > 0 && underMatureTree(colonised[pc].x)) { guideSet('poured'); break; }
      if (guideFlags.poured && tool === 'hand') guideSet('hand');
      var st = guideCurrent();
      var ht = st && st.hint ? (typeof st.hint === 'function' ? st.hint() : st.hint) : null;
      if (ht !== guideStickyText) {
        // La legende fixe change (ou l'etape se termine) : on remplace / retire l'ancienne si elle est encore affichee.
        if (guideStickyText && caption && caption.textContent === guideStickyText) setCaption(ht || '', true, true);
        guideStickyText = ht;
      }
      if (!st) { toolsArrow.classList.add('d-none'); return; }
      if (st.id !== guideLastId) {
        guideLastId = st.id;
        if (st.msg && !guideMsgShown[st.id]) { guideMsgShown[st.id] = true; setCaption(st.msg()); }
      }
      // Legende fixe : reaffichee des qu'une autre legende disparait.
      if (ht && caption && !caption.classList.contains('is-visible')) setCaption(ht, true, true);
      var cr = container.getBoundingClientRect(), tg = st.target(cr);
      if (!tg) { toolsArrow.style.opacity = '0'; return; }
      var tx = tg.x, ty = tg.y, dir = st.dir || 'right', off = tg.off || 0;
      var ax = tx + (dir === 'right' ? 58 : dir === 'left' ? -58 : 0), ay = ty + (dir === 'up' ? -64 : dir === 'down' ? 64 : 0);
      // Cible hors ecran : la fleche se colle au bord et pointe a l'horizontale, sans angle ni aimant.
      if (off) { ax = off > 0 ? cr.width - 60 : 60; ay = ty; tx = ax + off * 100; ty = ay; }
      var baseX = toolsArrow.offsetLeft + toolsArrow.offsetWidth / 2, baseY = toolsArrow.offsetTop + toolsArrow.offsetHeight / 2;
      var gx = ax - baseX, gy = ay - baseY;
      // Aimant : la fleche se penche vers le curseur sans quitter son poste.
      if (st.magnet && !off && mouseCX !== null) {
        var mdx = mouseCX - (cr.left + ax), mdy = mouseCY - (cr.top + ay), md = Math.hypot(mdx, mdy);
        var mk = md > ARROW_MAGNET_MAX ? ARROW_MAGNET_MAX / md : 1;
        gx += mdx * mk; gy += mdy * mk;
      }
      // Etape ou l'on agit sur la cible : la fleche s'efface quand le curseur s'en approche.
      var near = st.fadeNear && mouseCX !== null && Math.hypot(mouseCX - (cr.left + ax), mouseCY - (cr.top + ay)) < 170;
      toolsArrow.style.opacity = near ? '0.12' : '';
      if (!arrowInit) { arrowCx = gx; arrowCy = gy; arrowInit = true; }
      arrowCx += (gx - arrowCx) * 0.14;
      arrowCy += (gy - arrowCy) * 0.14;
      // Le svg pointe vers la gauche (180deg) : la rotation le tourne vers la cible.
      var rot = Math.atan2(ty - (baseY + arrowCy), tx - (baseX + arrowCx)) * 180 / Math.PI - 180;
      toolsArrow.style.setProperty('--rot', rot.toFixed(1) + 'deg');
      toolsArrow.style.setProperty('--mx', arrowCx.toFixed(2) + 'px');
      toolsArrow.style.setProperty('--my', arrowCy.toFixed(2) + 'px');
    })();
  }

  // Style low-poly : uniquement des triangles a couleur pleine (pas de degrade,
  // pas de flou). La variation de ton d'une facette a l'autre suffit a donner du relief.
  var CELLS_ACROSS = 110;                 // nb de facettes sur la largeur du logo
  var GRAVITY = 0.32;
  var AIR = 0.992;
  var WIND_STRENGTH = 0.45;                // multiplicateur des rafales sur les feuilles qui tombent (voir "Vent" dans step())
  var COL_W = 6;                          // resolution de la carte de hauteurs du tas
  var EARTH = ['#6b4a30', '#7c5a3a', '#5a3d28', '#8a6239', '#4f3622'];
  var SOIL = ['#5a3d28', '#6b4a30', '#4a3220'];
  var ROCK = ['#8c8c86', '#7a7a74', '#9a9a92', '#6d6d66'];   // roche-mere affleurante : rien n'y pousse (voir "rocky")
  var ROCK_PATCH_MIN = 2, ROCK_PATCH_MAX = 4;                // nb de plaques rocheuses par monde
  var ROCK_PATCH_COLS_MIN = 10, ROCK_PATCH_COLS_MAX = 26;    // largeur d'une plaque, en colonnes (COL_W px chacune)
  var ROCK_COVER_MIN = 18;                // epaisseur de terre meuble (px) qui suffit a enterrer la roche : au-dela, on peut a nouveau y faire pousser quelque chose
  var ROCK_H_MIN = 0.06, ROCK_H_MAX = 0.13; // hauteur d'un rocher (x hauteur de la boite H) : bien au-dessus du sol, pas un simple caillou
  var ROCK_LEACH_MULT = 0.3;              // la roche est plus compacte que la terre : le lessivage (chance et enfoncement) y est multiplie par ca, meme si de la terre meuble la recouvre
  var ROCK_BASIN_DEPTH = 0.05;            // profondeur du fond d'une cuvette (lac) SOUS le niveau general du sol (x hauteur de la boite H) ; les bords, eux, restent releves comme une bosse
  var ROCK_BASIN_FRAC = 0.5;              // part des plaques rocheuses creusees en cuvette (au moins une, jamais toutes)
  var LAKE_DROP_VOL = 3;                  // volume d'eau (px2 de section) ajoute par une goutte qui tombe sur une cuvette
  var LAKE_EVAP_PER_S = 2;                // evaporation (px2 par seconde de vTime) hors pluie, x3 en secheresse ; lente, un lac ne s'asseche jamais d'un coup
  var BEDROCK_MARGIN = 40;               // marge (px) avant le fond du monde ou plus rien n'apparait (roche-mere)
  var SPECIES = [
    { cap: '#9a948c', gill: '#d9d2c5', pleurote: true },  // pleurote gris (bouquet, voir drawPleurotes)
    { cap: '#e58a9b', gill: '#f6c9d1', pleurote: true },  // pleurote rose
    { cap: '#e2cfae', gill: '#ffffff', hydne: true },  // hydne herisson (boule a dents fines, voir drawHydne)
    { cap: '#c9a27a', gill: '#efdcc2', pleurote: true },  // pleurote huitre
    { cap: '#8a5a3b', gill: '#e4cfb2' },  // shiitake
    { cap: '#8c4540', gill: '#554f5e', strophaire: true }  // strophaire rouge vin (voir drawStrophaire)
  ];
  var MAX_MUSHROOMS = 36;
  var MUSHROOM_STARVE_MS = 10000;         // un champignon issu du mycelium (pas plante a la main) fane sans mycelium a portee pendant ce temps

  // Mycelium en vrac : le sac verse des grains qui inoculent les facettes ou ils tombent.
  // Une facette colonisee blanchit peu a peu et gagne ses voisines, lentement ; quand
  // assez de surface est blanche a un endroit, des champignons y sortent.
  var MYC = [243, 238, 226];              // blanc du mycelium
  var GRAIN = ['#f3eee2', '#e8dfcc', '#fbf8f0', '#d9cdb3'];
  var MYC_DEAD = ['#cfc3a1', '#c3b78f', '#d8cdb0']; // mycelium mort de secheresse : paille delavee, ni le blanc du vivant ni le noir de l'humus
  var MYC_GROW = 0.005;                   // blanchiment d'une facette par frame (~3 s pour etre pleine)
  var MYC_READY = 0.45;                   // seuil a partir duquel une facette gagne ses voisines
  var MYC_SPREAD_EVERY = 8;               // la propagation se calcule toutes les N frames
  var MYC_SPREAD_P = 1;                   // chance, par passage, de gagner une voisine
  var MYC_RADIUS = 0.4;                   // portee max depuis le point d'inoculation (x hauteur)
  var FRUIT_W = 0.22;                     // largeur d'une zone de fructification (x hauteur)
  var HYPHA_COLOR = '#fbf8f0';            // filaments du mycelium vivant (par-dessus le blanchiment des facettes)
  var HYPHA_DEAD_COLOR = '#d8cdb0';       // filaments du mycelium mort de secheresse (paille, casses)
  var HYPHA_W = 1.1;                      // epaisseur des filaments (px)
  var HYPHA_MAX_LINK = 40;                // distance max (px) entre une facette et son origine (parent ou inoculation) pour tracer le filament
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
  var FEED_FRUIT_PER_S = 0.012;           // chance/s PAR morceau de bois mange qu'un champignon sorte du mycelium qui le digere
  var FEED_FRUIT_WET_MULT = 5;            // x(1+5) sous la pluie, decroit lineairement apres
  var FEED_FRUIT_WET_MS = 40000;          // duree de l'humidite residuelle apres la pluie
  var FEED_FRUIT_MAX = 12;                // max de champignons issus du mycelium vivants en meme temps
  var lastRainAt = -1e9;
  var MYC_ACTIVE_FEED_MS = 3000;         // fenetre "activement nourri" : au-dela, une facette peut encore survivre sur sa reserve mais ne colonise plus de terre neuve
  var MYC_HOLD_REACH = 200;               // portee (px) a laquelle un mycelium bien vivant retient l'humus contre le lessivage de la pluie
  // Duree max de cette retenue (voir heldByMycelium) : passe ce delai, l'humus lessive quand
  // meme. Sans ca, un mycelium tres actif (MYC_DECOMPOSE_MULT) decompose le bois bien plus
  // vite que les racines ne peuvent le manger (un nutriment a la fois, EAT_MS) ; comme la
  // pluie ne peut alors jamais l'evacuer vers la couche compacte, l'humus non mange
  // s'empile indefiniment (voir pileAdd) au lieu de circuler, et forme une butte qui ne
  // fait que grossir sans jamais aider l'arbre (deja plafonne a MATURE_NUTRIENTS).
  var MYC_HOLD_MAX_MS = 600000;
  // Mort aleatoire rare : meme bien nourri, un mycelium vivant peut mourir a l'occasion, pour
  // que le gros bloc ne soit pas permanent (la terre vivante meurt et repousse en circulation).
  // Verifiee a intervalle (pas a chaque frame), par facette : rare et etalee, jamais en masse.
  // La facette suit ensuite le meme chemin que la mort de faim (necromasse sur litiere, sinon terre).
  var MYC_RANDOM_DEATH_P = 0.002;         // chance, par verification et par facette, de mourir
  var MYC_RANDOM_DEATH_CHECK_MS = 2000;   // intervalle (vTime) entre deux verifications
  var mycNextDeathCheck = 0;
  var tool = 'hand';                  // 'hand' | 'mycelium' | 'tree' | 'fertilizer' | 'grass'
  var grassNutriMult = 1;                 // multiplicateur de production de nutriments du gazon ordinaire (1 = normal, 0 = aucun)
  var grassMycNutriMult = 1;              // idem pour le gazon long avec champignons (grassMyc)
  var fertLastAt = 0;                     // dernier depot de fertilisant (limite le rythme pendant un glissement)
  var FERT_COUNT = 3;                     // nutriments deposes par clic/pas de glissement
  var FERT_COST = 3;                      // $ par depot (clic ou pas de glissement)
  var FERT_SPREAD = 10;                  // etalement horizontal (px) autour du point clique
  var FERT_MIN_MS = 90;                   // delai minimum entre deux depots pendant un glissement
  var grassLastAt = 0;                    // dernier semis de gazon (limite le rythme pendant un glissement)
  var GRASS_SEED_BOOST = 0.3;             // augmentation de couverture de gazon par semis
  var GRASS_SEED_COST = 2;                // $ par semis (clic ou pas de glissement)
  var GRASS_SEED_SPREAD = 15;             // etalement horizontal (px) autour du point clique
  var GRASS_SEED_MIN_MS = 100;            // delai minimum entre deux semis pendant un glissement
  var colonised = [], fruited = {}, frame = 0, mycBusyUntil = 0;
  // Mycelium mort de secheresse (voir stepMycelium) : contrairement a la necromasse de faim
  // (immediate, voir MYC_STARVE_MS), il reste visible tel quel — ni vivant ni nutriment —
  // jusqu'a une decomposition par l'humidite (voir decomposeDeadMyc, uniquement pendant la
  // pluie). Etape 2 (pas encore faite) : sous une pluie trop longue il pourrait plutot se
  // faire contaminer, et la contamination pourrait s'en prendre a un mycelium vivant affaibli
  // a proximite.
  var deadMyc = [];

  // --- Gazon --------------------------------------------------------------------------
  // Couche de base independante du mycelium : une petite quantite de nutriment pousse
  // toute seule en surface, comme les herbes pionnieres qui colonisent un sol pauvre dans
  // la vraie vie (voir la discussion produit : le sol ne doit jamais rester totalement mort
  // meme sans mycelium). GRASS_NUTRI_P/GRASS_NUTRI_CHECK_MS sont volontairement tres bas :
  // ca doit juste empecher un arbre sans mycelium de deperir completement, jamais lui
  // donner une croissance comparable a un arbre bien colonise (qui reste beaucoup plus
  // rapide via MYC_DECOMPOSE_MULT + la retenue contre le lessivage, MYC_HOLD_REACH).
  // grassCover[c] (0..1, par colonne, meme indexation que heights/compactY) : 1 = touffe
  // pleine, 0 = terre remuee/nue. Demarre plein partout (couche initiale). Une colonne
  // remuee (pelle, effondrement...) ne repousse QUE si une colonne voisine est deja bien
  // gazonnee (propagation en surface uniquement, jamais en profondeur, jamais spontanee) :
  // un trou assez large pour n'avoir aucune voisine gazonnee reste nu pour de bon, jusqu'a
  // ce que la propagation l'atteigne depuis plus loin.
  var GRASS_COLOR = ['#6f9c4a', '#5c8a3f', '#82ad5b', '#537d3a'];
  var GRASS_MAX_H_F = 0.02;               // hauteur max d'un brin (x hauteur de la boite H)
  var GRASS_EMBED = 6;                    // enfoncement (px) sous surfaceAt : ancre les brins dans le terrain irregulier (comme drawMushroom)
  var GRASS_REGROW_MS = 60000;            // temps de base pour qu'une colonne voisine d'une zone gazonnee regagne sa pleine couverture
  var GRASS_SPREAD_BONUS = 3;             // multiplicateur de vitesse de cette repousse (appliquee uniquement quand une voisine est gazonnee)
  var GRASS_NEIGHBOR_MIN = 0.5;           // couverture voisine consideree "gazonnee" pour ce bonus
  // La pelle ne remue jamais une colonne d'un coup sec : chaque facette bougee ne change
  // heights[c] que d'un tout petit peu par frame (voir pileAdd/pileRemove). Comparer a la
  // hauteur de la frame precedente ne detecterait donc presque jamais un vrai coup de
  // pelle. grassPrevH suit plutot heights EN RETARD (GRASS_BASELINE_FOLLOW, comme
  // TREE_BY_FOLLOW pour le pied d'un arbre) : un creusage soutenu fait grandir l'ecart
  // frame apres frame jusqu'a depasser GRASS_DISTURB_EPS, meme si chaque pas est minuscule ;
  // une fois la pelle partie, la reference rattrape la nouvelle forme du sol sans redeclencher.
  var GRASS_BASELINE_FOLLOW = 0.05;
  var GRASS_DISTURB_EPS = COL_W * 0.6;    // ecart (px) entre heights et sa reference au-dela duquel la colonne est consideree remuee
  var GRASS_FRUIT_MIN = 0.55;             // couverture minimale avant qu'une colonne puisse produire un nutriment
  var GRASS_NUTRI_CHECK_MS = 5000;        // frequence a laquelle on tente de faire pousser un nutriment de gazon
  var GRASS_NUTRI_P = 0.72;               // chance, par tentative, qu'UNE colonne eligible en produise un (doublee deux fois)
  var GRASS_NUTRI_AREA = 10;              // aire (px^2) d'un nutriment de gazon : minuscule, pas une feuille
  // Symbiose visible : le gazon qui a du mycelium vivant juste en dessous pousse plus haut et
  // produit plus de nutriments — le sol vivant doit se voir profiter au gazon aussi, pas
  // seulement aux arbres. grassMyc[c] est recalcule periodiquement (pas a chaque frame, cf.
  // GRASS_MYC_CHECK_EVERY) : parcourir colonised pour chaque colonne a chaque frame serait
  // couteux pour un simple effet cosmetique + un leger bonus de production.
  var GRASS_MYC_REACH = 40;               // portee horizontale (px) a laquelle du mycelium sous une colonne compte comme "dessous"
  var GRASS_MYC_SURFACE_DEPTH = 18;       // le mycelium doit etre proche de la surface (comme DROUGHT_SURFACE_DEPTH) pour compter
  var GRASS_MYC_HEIGHT_MULT = 3.25;       // hauteur des brins multipliee par ceci si du mycelium est dessous
  var GRASS_MYC_NUTRI_WEIGHT = 2;         // poids dans le tirage au sort d'une colonne pour produire un nutriment (~2x plus probable)
  var GRASS_MYC_CHECK_EVERY = 20;         // frames entre deux recalculs de grassMyc (perf)
  var GRASS_LOST_TIP = 25;                // colonnes de gazon arrachees avant d'afficher le conseil de replantation
  var grassLost = 0, grassTipFrom = 0;    // pas de conseil avant grassTipFrom (ms) : la chute du logo dans la terre n est pas de l arrachage
  var grassCover = null, grassPrevH = null, grassMyc = null, grassLastNow = null, grassNutriAt = 0;

  // --- Flore (cosmetique) --------------------------------------------------------------
  // Couche PUREMENT VISUELLE ajoutee par-dessus le gazon : mousse, touffes plus denses et
  // petit feuillage (fougeres/buissons) autour des arbres et au-dessus du mycelium. Aucune
  // incidence sur le jeu (pas de nutriments, pas d'effet sur les arbres/le mycelium) : juste
  // un indice que le sol cultive est vivant. floraLush[c] (0..1, meme indexation que
  // grassCover) est la densite actuellement dessinee ; floraTarget[c] est la densite visee,
  // recalculee peu souvent (voir updateGrass) selon la proximite d'un arbre bien nourri et/ou
  // de mycelium actif juste dessous. Jamais de Math.random() dans le dessin : les graines
  // viennent d'un hash stable de l'indice de colonne (floraHash), comme pour le gazon.
  var FLORA_TREE_R_MIN = 0.12, FLORA_TREE_R_MAX = 0.3; // portee d'un arbre (x hauteur H), selon sa croissance
  var FLORA_TREE_W = 0.9, FLORA_MYC_W = 0.75;          // poids arbre / mycelium dans la cible de densite
  var FLORA_SYMBIOSIS_BONUS = 0.25;                    // bonus quand arbre ET mycelium se superposent (vraie mycorhize)
  var FLORA_GROW_MS = 12000, FLORA_FADE_MS = 6000;     // vitesse de pousse / de fanage de floraLush vers sa cible
  var FLORA_EMBED = 4;                                 // enfoncement (px) sous surfaceAt, comme GRASS_EMBED
  var MOSS_COLOR = ['#4f7a34', '#5f8f3c', '#3f6a2c', '#6e9e45'];
  var MOSS_THICK = 14;                                  // epaisseur max (px) de la bande de mousse
  var FLORA_TUFT_H_F = 0.035;                          // hauteur max d'une touffe haute (x H)
  var FLORA_FERN_H_F = 0.11;                           // hauteur max d'une fougere (x H)
  var FLORA_BUSH_R_F = 0.042;                          // rayon max d'un petit buisson (x H)
  var floraLush = null, floraTarget = null;

  // Fleurs au pied des arbres : purement cosmetique, elles eclosent quand une branche bonus
  // apparait (voir spawnFlower, appele depuis stepTrees) et fanent quand cette branche tombe,
  // ou aussitot si la pelle remue leur colonne (voir stepFlowers). Une seule espece (anemone
  // des bois, blanc rose), soignee plutot que variee, cf. drawFlowers plus bas. Tout l'alea
  // (position, inclinaison, taille...) est tire une fois a la naissance et stocke sur la
  // fleur (f.*) : le dessin ne lit jamais Math.random(), comme pour le reste de la flore.
  // t.flowers vit sur l'arbre (voir makeTree) donc trees = [] (reset/rebuild) suffit a tout
  // effacer, aucune structure globale a vider en plus.
  var FLOWER_MAX_PER_TREE = 8;             // fleurs vivantes (non fanees) max par arbre
  var FLOWER_MIN_SPACING = 14;             // ecart minimal (px monde) entre deux fleurs, tous arbres confondus
  var FLOWER_BLOOM_MS = 2600;              // duree totale de l'eclosion (tige + bouton + corolle)
  var FLOWER_WILT_MS = 1800;               // duree de la fanaison une fois fletrie (branche tombee)
  var FLOWER_H_F = 0.07;                  // hauteur de la tige (x hauteur de la boite H)
  var FLOWER_R_F = 0.022;                  // rayon de la corolle grande ouverte (x H)

  // --- Insectes (cosmetique) ----------------------------------------------------------
  // Purement decoratif, comme les fleurs ci-dessus : papillons et bourdons qui traversent
  // tranquillement l'ecran d'un bord a l'autre, se posent parfois sur une fleur ouverte
  // puis repartent finir leur traversee. Aucune incidence sur le jeu. Tout l'alea de vol
  // (ondulation, phases, choix d'especes...) est tire a la creation de l'insecte et
  // stocke sur l'objet (voir spawnInsect) ; le dessin (drawInsect et ses helpers) ne lit
  // jamais Math.random(), seulement des phases qui avancent avec un temps REEL ecoule
  // (voir insectLastT/age dans stepInsects) — jamais vTime, qui est accelerable par le
  // slider de vitesse debug et rendrait les insectes agites a vitesse elevee.
  var INSECT_MAX = 3;                      // bourdons simultanes max
  var BUTTERFLY_MAX = 3;                   // papillons simultanes max (limite propre a l'espece)
  var BUTTERFLY_P = 0.75;                  // part des apparitions qui sont des papillons
  var BUTTERFLY_SIZE_K = 1.22;             // facteur de taille propre aux papillons (bourdons inchanges)
  var INSECT_GAP_MIN_MS = 6000;            // attente min. entre deux apparitions (temps reel)
  var INSECT_GAP_MAX_MS = 16000;           // attente max. entre deux apparitions (temps reel)
  var INSECT_SPEED = 1;                    // multiplicateur global de vitesse
  var INSECT_SIZE_F = 0.012;               // taille (x hauteur de la boite H)
  var INSECT_LAND_P = 0.55;                // chance de viser une fleur ouverte visible, s'il y en a
  var insects = [];
  var insectNextAt = null, insectLastT = null;

  // --- Economie : recolter des champignons pour racheter du mycelium -----------------
  // Le tout premier sac est offert (sinon impossible de demarrer, avant toute vente) ;
  // les suivants coutent BAG_COST, payes des qu'on commence a verser (ensureBag). Le sac
  // contient un nombre fixe de grains plutot qu'une jauge de temps : ca tient compte du
  // rythme de versement du joueur, et reutilise le compteur de grains deja verses par
  // updateBag. ~950 grains, au rythme actuel (~1.5 grain/frame, 60 fps), durent 10-12s.
  var BAG_COST = 20;
  var BAG_GRAINS = 950;
  var MUSHROOM_PRICE = 5;                // gain (recolte a la main) par champignon mur issu du mycelium
  var money = 0, moneyRevealed = false, usedFreeBag = false, bagGrainsLeft = 0;
  function updateMoneyUI() {
    if (moneyRevealed && moneyEl) moneyEl.classList.remove('d-none');
    if (moneyVal) moneyVal.textContent = money;
  }
  function earn(amount) {
    // En demo l'argent est cache (mycelium gratuit, voir ensureBag) mais s'accumule en
    // silence : le joueur le retrouve quand le jeu complet se debloque.
    money += amount;
    if (!DEMO && window.sporaSfx) sporaSfx.play('coin'); 
    moneyRevealed = true;
    updateMoneyUI();
    savePlayerIfChanged();
  }
  // Assure qu'un sac est pret a verser : offre le tout premier, sinon facture BAG_COST
  // si les fonds le permettent. Retourne false (et ne change rien) si on ne peut pas payer.
  function ensureBag() {
    if (bagGrainsLeft > 0) return true;
    if (DEMO || !usedFreeBag) { usedFreeBag = true; bagGrainsLeft = BAG_GRAINS; return true; }
    if (money < BAG_COST) return false;
    money -= BAG_COST;
    bagGrainsLeft = BAG_GRAINS;
    updateMoneyUI();
    return true;
  }

  // Horloge virtuelle : tout le "temps reel" (ms) du cycle bois/mycelium/arbres (litiere,
  // faim du mycelium, pousse des feuilles...) passe par vTime plutot que
  // performance.now() directement, pour pouvoir l'accelerer avec le slider de debug
  // (#logo-explosion-speed) sans toucher a la physique image par image (gravite, pelle).
  var timeScale = 1, vTime = 0, lastRealNow = null;
  var rainLevel = 0.3;                    // 0..1, lu depuis le curseur Pluie ; 0 = ne pleut jamais
  var droughtLevel = 0.3;                 // 0..1, lu depuis le curseur Secheresse ; 0 = ne seche jamais
  var stormLevel = 0.2;                   // 0..1, lu depuis le curseur Tempetes ; 0 = jamais de tempete

  // Cycle des nutriments : le mycelium decompose du BOIS (feuilles tombees, voir
  // MYC_DECOMPOSE_*) ou meurt de faim et devient lui-meme nutriment (necromasse) — jamais
  // la terre elle-meme, qui n'a pas de valeur nutritive en soi. Les racines d'un arbre
  // absorbent ce nutriment et en font une feuille, qui vieillit (vert tendre -> vert ->
  // jaune -> roux), tombe et redevient du bois a decomposer. Tout ce qui est lent ici se
  // mesure en temps reel (ms), pas en frames : quand il ne reste que ca a animer, la
  // boucle ralentit a quelques images par seconde.
  // La pluie n'est pas juste un bonus de vitesse, elle est necessaire au cycle : un
  // nutriment tout frais reste hors de portee des racines (MIN_LEACH_TO_EAT) tant que la
  // pluie ne l'a pas fait descendre d'au moins un cran vers le bas, colonne par colonne
  // (voir leach()), jusque dans la couche compacte (compactNutri) ou il s'enfonce ; le
  // mycelium bien vivant a proximite le retient (MYC_HOLD_REACH). La pelle qui decompacte
  // le ramene en surface, deja mur (cutCompact/spawnDecompactShard). Les racines ne
  // plongent de toute facon que jusqu'a une profondeur limitee (ROOT_DEPTH) : un arbre qui
  // n'a plus rien a portee finit par deperir (TREE_STARVE_MS/TREE_SHRINK_MS), et sans
  // pluie du tout (curseur a 0) le cycle s'arrete net. La pluie n'est plus un outil : elle
  // est naturelle, occasionnelle (voir le cycle meteo pres de updateWeather), reglee par
  // le curseur Pluie (rainLevel).
  var NUTRI = ['#2a1d14', '#1f1610', '#33241a']; // humus : terre noire, riche
  // Portee de RECHERCHE des racines (invisible, x largeur de la boite W) : le monde est
  // bien plus large que haut, un arbre mature doit pouvoir trouver du nutriment loin de
  // lui. La longueur VISUELLE des racines dessinees est volontairement plus courte
  // (ROOT_VISUAL_REACH, x hauteur H) : les etirer jusqu'a la portee de recherche donnait
  // des barres quasi droites traversant toute la scene (repere : capture d'ecran du
  // 2026-09-25).
  // A 0.7 (couvrait 70% de la largeur de la boite), n'importe quel nutriment produit
  // n'importe ou tombait dans le rayon d'au moins un arbre : "etre hors de portee" n'arrivait
  // presque jamais, donc un sol sans mycelium n'etait jamais vraiment desavantage. Reduit
  // pour qu'il existe de vraies zones hors de portee horizontale.
  var ROOT_REACH = 0.3;                   // portee de recherche de nutriment une fois l'arbre mature (x largeur de la boite)
  var ROOT_VISUAL_REACH = 0.4;            // longueur des racines lat. DESSINEES une fois mature (x hauteur de la boite) ; elles plongent, donc plus courtes qu'avant
  // Deux parametres separes (pas juste ROOT_DEPTH x g comme ROOT_REACH) : g (voir plus bas,
  // lerp(ROOT_GROWTH_MIN, 1, t.growth)) est un ratio FIXE entre jeune et mature, donc monter
  // une seule valeur de profondeur remontait les deux ages dans la meme proportion —
  // impossible de creuser plus profond pour un jeune arbre sans aussi faire exploser la
  // portee d'un arbre adulte. Interpole directement entre les deux a la place.
  var ROOT_DEPTH_MIN = 0.12;              // profondeur de recherche sous la surface a la naissance (x hauteur de la boite)
  var ROOT_DEPTH_MAX = 0.35;              // profondeur de recherche sous la surface une fois mature (x hauteur de la boite)
  // Un nutriment frais (bois/necromasse qui vient de se decomposer, encore tout en haut du
  // tas) n'est PAS a portee des racines tant que la pluie ne l'a pas fait descendre d'au
  // moins plusieurs crans (voir leach() et s.leachCount) : sinon la pluie ne serait qu'un
  // bonus de vitesse au lieu d'etre necessaire au cycle. A 1 seul cran (valeur d'origine),
  // le tout premier passage de pluie suffisait a rendre le nutriment mangeable, bien avant
  // qu'il ait eu la chance de couler hors de portee des racines (ROOT_DEPTH) : le mycelium
  // qui le retient en surface (MYC_HOLD_REACH) n'avait alors aucun effet observable, un
  // arbre sans mycelium n'etant quasiment jamais penalise par le lessivage. Un seuil plus
  // haut laisse le temps a un nutriment non retenu de couler plus profond au fil des
  // pluies successives. Un depot lessive jusqu'au compact (compactNutri) ou ramene en
  // surface par la pelle (spawnDecompactShard) a deja fait tout ce trajet, donc compte
  // comme mur d'emblee.
  var MIN_LEACH_TO_EAT = 4;
  // Sans pluie du tout (secheresse prolongee ou curseur Pluie a 0), un nutriment qui n'a
  // jamais lessive restait mangeable JAMAIS — la pluie etait donc un vrai interrupteur, pas
  // juste un bonus de vitesse comme voulu. Un nutriment mur tout seul, mais bien plus
  // lentement qu'avec la pluie (voir isNutriRipe) : le cycle continue meme sans pluie,
  // juste au ralenti.
  var NUTRI_RIPEN_MS = 45000;
  var EAT_MS = 45000;                     // un nutriment absorbe au plus toutes les EAT_MS
  // Abondance : si beaucoup de nutriments murs sont a portee EN MEME TEMPS (pas juste
  // "plusieurs"), l'arbre mange au rythme accelere plutot que le EAT_MS normal — un sol
  // vivant qui deborde de nourriture doit se sentir different d'un sol qui en a juste assez.
  var ABUNDANCE_THRESHOLD = 20;           // nb de nutriments murs a portee au-dela duquel l'arbre mange plus vite
  var ABUNDANCE_EAT_MULT = 3;             // EAT_MS est divise par ce facteur une fois le seuil depasse
  var ABUNDANCE_LEAF_FILL = 15;           // nb max de places de feuilles remplies d'un coup pendant l'abondance (avant de financer une branche)
  // Branches bonus : coherent avec l'absorption acceleree par l'abondance (ci-dessus), un
  // arbre deja mature (t.growth>=1) qui pioche dans un sol qui deborde de nutriments forme
  // une branche EN PLUS de son repas normal — payee en nutriments supplementaires pris
  // parmi les prochains plus profonds (voir la priorite par profondeur plus haut), jamais
  // gratuite. Une branche bonus est juste une place de feuille en plus (voir t.slots,
  // ajoutee dynamiquement), positionnee un peu hors du houppier normal. Une fois vieille,
  // elle tombe pour de bon (bois, pas juste sa feuille) et redonne sa matiere a la terre en
  // se decomposant, mais bien plus lentement qu'une feuille (BRANCH_LITTER_MS) — liberant sa
  // place pour qu'une nouvelle branche puisse repousser la prochaine fois qu'il y a assez de
  // nutriments.
  var BONUS_BRANCH_COST = 3;              // nutriments supplementaires consommes d'un coup pour former une branche
  var BONUS_BRANCH_MAX = 8;               // nb max de branches bonus simultanees par arbre
  var BONUS_BRANCH_LIFE_MS = 150000;      // duree de vie d'une branche bonus avant qu'elle tombe
  var BRANCH_LITTER_MS = 2400000;         // le bois tombe se decompose bien plus lentement qu'une feuille (LITTER_MS)
  var BRANCH_GROW_MS = 8000;              // temps pour qu'une branche bonus s'etire visuellement jusqu'a sa pleine longueur
  // Une branche a coute BONUS_BRANCH_COST nutriments a fabriquer ; elle les redonne au sol,
  // mais PAR PETITS BOUTS au fil de sa lente decomposition (BRANCH_LITTER_MS) plutot que
  // d'un coup a la toute fin comme une feuille (qui, elle, ne vaut qu'1 nutriment de toute
  // facon) — le bois reste au sol bien plus longtemps, il est normal qu'il rende sa matiere
  // progressivement. Une fois le dernier bout donne, ce qui reste du bois redevient juste de
  // la terre normale (voir toEarthColor), jamais un nutriment en plus.
  var WOOD_NUTRI_AREA = 10;               // aire (px^2) d'un bout de nutriment libere par du bois
  // Croissance : plus un arbre a mange de nutriments (t.eaten), plus t.growth (0..1) monte,
  // et plus ses racines vont chercher loin, plus il peut porter de feuilles, plus il est grand.
  var MATURE_NUTRIENTS = 12;              // nutriments manges pour atteindre la pleine croissance
  var ROOT_GROWTH_MIN = 0.15;             // longueur des racines a la naissance (fraction de leur taille mature)
  var LEAF_UNLOCK_MIN = 8;                // places de feuilles utilisables a la naissance (sur 40)
  var TREE_SCALE_MIN = 0.3;               // taille du tronc/houppier a la naissance (fraction de la taille de reference)
  var TREE_SCALE_MAX = 1.6;              // taille du tronc/houppier une fois bien nourri (fraction de la taille de reference)
  // Au-dela de la maturite, chaque nutriment mange (t.surplus) fait encore monter l'arbre,
  // lentement : TALL_FULL nutriments pour la hauteur max (+TALL_SCALE_MAX d'echelle). Plus
  // il est haut, plus le vent emporte ses feuilles loin (TALL_WIND_MULT a la hauteur max).
  // Affame, il perd d'abord cette hauteur avant de perdre sa maturite.
  var TALL_FULL = 40;
  var TALL_SCALE_MAX = 1.0;
  var TALL_WIND_MULT = 1.5;
  var SMALL_WIND_MULT = 0.3;              // vent sur les feuilles d'un arbre tout neuf : elles tombent pres du pied, donc il se nourrit et grandit (monte a 1 a maturite)
  var TREE_COST_STEP = 100;              // 1er arbre plante gratuit, puis 1x, 2x, 3x ce palier ; ensuite toujours 3x (pas de plafond de nombre)
  var TREE_COST_MAX_MULT = 3;
  var START_TREES = 2;                    // arbres de depart (voir la creation du monde), non payes
  function nextTreeCost() {
    var planted = 0;
    for (var i = 0; i < trees.length; i++) if (trees[i].planted) planted++;
    return Math.min(planted, TREE_COST_MAX_MULT) * TREE_COST_STEP;
  }
  var TREE_MIN_SPACING = 90;              // distance minimale (px monde) entre deux arbres plantes
  var TREE_STARVE_MS = 60000;             // sans avoir mange depuis ce delai (t.lastAte), l'arbre commence a deperir
  var TREE_SHRINK_MS = 8000;              // rythme auquel un arbre affame perd un nutriment mange (t.eaten--)
  // La base de l'arbre (t.by) suit le niveau du sol SOUS elle avec un delai plutot que de
  // recalculer surfaceAt(t.x) brut a chaque frame : sinon, remuer la terre pres du tronc
  // (pelle) le fait sauter haut/bas tres vite. Embed un peu plus profond que l'ancien +8 :
  // un arbre legerement enfonce dans le sol semble mieux ancre.
  var TREE_EMBED = 14;                    // enfoncement du pied du tronc sous la surface (px)
  var TREE_BY_FOLLOW = 0.04;              // vitesse (par frame) a laquelle t.by rattrape le niveau du sol
  var EATEN_MS = 5000;                    // duree de l'absorption (la facette retrecit)
  var LEAF_GROW_MS = 4400;
  // Houppier : les feuilles sont regroupees en bouquets au bout de branches maitresses
  // (t.limbs, pre-calcule dans makeTree). Purement visuel, sans effet sur le gameplay.
  var CANOPY_LIMBS = 5;                   // nb de branches maitresses / bouquets (utilise seulement a la creation de l'arbre)
  var CANOPY_CLUSTER_R = 0.065;           // rayon d'un bouquet de feuilles (fraction de H) ; sert aussi a la masse de feuillage dessinee
  var LEAF_LIFE_MS = [58000, 180000];     // duree de vie d'une feuille (min, max)
  var LITTER_BULK = 0.2;                  // une feuille posee n'ajoute que cette fraction de sa hauteur au tas (litiere a plat, pas une butte)
  var LOG_BULK = 0.4;                     // idem pour le bois tombe
  var LITTER_FLAT = 0.4;                  // ecrasement vertical d'une feuille posee (dessin seulement)
  var LITTER_MS = 300000;                 // une feuille tombee loin de tout mycelium redevient humus toute seule, tres lentement (5 min, comme dans la vraie vie) ; le mycelium a proximite accelere fortement ce delai (MYC_DECOMPOSE_MULT)
  var LEAF_AGES = [[0, [156, 204, 90]], [0.25, [86, 150, 60]], [0.65, [62, 120, 50]], [0.82, [217, 169, 46]], [1, [184, 97, 42]]];
  var trees = [], litter = [], treeLife = false, slowTimer = null;
  var DIG_TO_REVEAL = 3;                  // coups de pelle (clic/tap) pour deterrer un tresor
  var TREASURE_NEAR = 70;                 // un tresor profond (def.depth) ne se repere et ne se creuse que si la surface est a moins de ca (px) au-dessus de lui
  var NUGGET_COLORS = ['#fff4cf', '#f6d372', '#e8b94a', '#c4922a', '#9c6f1f']; // pepite doree : du plus clair (face a la lumiere) au plus sombre
  var NUGGET_R = 0.022;                   // rayon de la pepite (x hauteur de la boite)
  var GOLD_BITS_N = 9;                    // eclats dores projetes au moment du reveal
  var GOLD_BITS_LIFE = 55;                // duree de vie d'un eclat (frames)
  var STRAIN_MIX = 0.5;                   // part de la couleur de la souche melangee au blanc du mycelium (0 = blanc standard, 1 = couleur pure)
  var goldBits = [];                      // eclats en vol : {x, y, vx, vy, rot, vr, r, c, life}
  var treasuresFound = 0;                 // tresors deterres depuis la derniere explosion (repart a 0 au rebuild)
  var tintedMyc = false;                  // vrai des qu'une facette de souche non standard est colonisee (sinon drawHyphae garde son trait unique)

  // "Camera" : le monde (terre + tresors) est plus large ET plus profond que la boite
  // visible. camX/camY sont le decalage (en px monde) affiche a l'ecran ; tout se dessine
  // translate de (-camX, -camY). Horizontal : le monde deborde des deux cotes, camX est
  // centre au depart. Vertical : rien d'utile au-dessus du sol, donc camY part a 0 (vue de
  // depart identique a avant) et ne descend QUE vers le bas pour reveler de la profondeur,
  // ou la couche compacte se creuse vraiment (voir compactY / cutCompact plus bas).
  var WORLD_MULT = 1.5;                   // largeur du monde = WORLD_MULT x largeur de la boite
  var DEPTH_MULT = 1.5;                   // profondeur ajoutee sous la boite = DEPTH_MULT x hauteur de la boite
  var CAMERA_EDGE = 0.28;                 // fraction de la largeur/hauteur de la boite ou le defilement s'active, depuis chaque bord
  var CAMERA_MAX = 3.2;                   // vitesse max de defilement horizontal (px monde / frame)
  var CAMERA_MAX_Y = 2.4;                 // vitesse max de defilement vertical (px monde / frame)
  // Sur l'accueil la boite remonte sous le header fixe (voir body.home .logo-explosion-inner
  // dans style.css, meme valeur 150px) : sans ca, la zone de defilement vers le haut serait
  // presque entierement cachee dessous et il faudrait y passer le curseur pour l'activer.
  // On decale la detection verticale de cette hauteur pour que la remontee commence deja
  // pendant que le curseur est encore visible, au-dessus de la boite.
  var CAMERA_TOP_DEADZONE = document.body.classList.contains('home') ? 150 : 0;
  var worldW = 0, camMargin = 0, camX = 0;
  var worldH = 0, camY = 0;
  var hoverScreenX = null, hoverScreenY = null; // position souris (coord. ecran), pour le defilement aux bords
  var CAMERA_EDGE_TOUCH = 0.16;           // meme zone, au doigt : plus etroite (le doigt travaille partout sur l'ecran)
  var edgeTouch = false;                  // hoverScreenX/Y viennent d'un doigt appuye qui glisse, pas d'une souris
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
  // Souches de mycelium : la souche "standard" (blanc d'origine) existe toujours et est
  // debloquee d'office ; les autres viennent des tresors (def.strain = {id, label, tint}) et
  // se debloquent au reveal. unlockedStrains et bagStrain survivent au rebuild (duree de la
  // page), contrairement au compteur de tresors. La souche ne change QUE la teinte.
  // Trois souches, chacune debloquee par un tresor, de plus en plus lucratives : Strophaire
  // (depart, lente mais tres resistante, id interne 'standard' pour les vieilles sauvegardes),
  // Pleurote (normale, plusieurs couleurs), Hydne (rapide, plus fragile). price/growMul/decayMul :
  // prix de recolte, multiplicateur de MYC_GROW, multiplicateur des extinctions (faim, secheresse).
  // Le prix du strophaire suit MUSHROOM_PRICE (reglage du panneau de debug).
  var STRAIN_STD_TINT = hexToRgb('#b8735a');
  var STRAIN_STD = { id: 'standard', label: 'Strophaire', perk: 'lente mais très résistante', tint: '#b8735a', tintRgb: STRAIN_STD_TINT, dot: '#b8735a',
    mycRgb: mixRgb(MYC, STRAIN_STD_TINT, STRAIN_MIX), hypha: rgbStr(mixRgb(hexToRgb(HYPHA_COLOR), STRAIN_STD_TINT, STRAIN_MIX).map(Math.round)),
    price: 0, growMul: 0.6, decayMul: 0.15 };
  var strainById = { standard: STRAIN_STD };
  var strainOrder = [STRAIN_STD];         // ordre du menu : standard, puis dans l'ordre des tresors
  var unlockedStrains = [];
  var bagStrain = 'standard';
  treasureDefs.forEach(function (def) {
    tipImgs(def).forEach(function (im) { new Image().src = im.src; }); // prechargees : l'infobulle s'affiche sans trou
    var st = def.strain;
    if (!st || !st.id || strainById[st.id] || !/^#[0-9a-f]{6}$/i.test(st.tint || '')) return;
    var tint = hexToRgb(st.tint);
    var made = {
      id: st.id, label: st.label || st.id, tint: st.tint, tintRgb: tint, dot: st.tint,
      perk: st.perk || '',                                             // texte du trait, affiche dans l'infobulle et le menu
      price: +st.price > 0 ? +st.price : MUSHROOM_PRICE,               // gain par champignon recolte
      growMul: +st.grow > 0 ? +st.grow : 1,                            // x MYC_GROW
      decayMul: +st.decay >= 0 && st.decay != null ? +st.decay : 1,    // x vitesse d'extinction (faim, secheresse)
      mycRgb: mixRgb(MYC, tint, STRAIN_MIX),                          // blanc du mycelium tire vers la teinte (facettes)
      hypha: rgbStr(mixRgb(hexToRgb(HYPHA_COLOR), tint, STRAIN_MIX).map(Math.round)) // idem pour les filaments
    };
    strainById[made.id] = made;
    strainOrder.push(made);
  });
  var treasures = [];
  // Bulle produit sur le premier champignon issu du mycelium verse (pas un tresor : pas
  // de def.x/species, juste une infobulle qui suit ce champignon-la). Voir sprout().
  var mycTip = null, mycTipMushroom = null, mycTipShown = false;

  // W/H : fenetre visible en px logiques. U/UW : unite de taille (hauteur/largeur CSS de la
  // boite, en px logiques) pour tout ce qui ne doit pas changer quand la fenetre s'agrandit.
  var W = 0, H = 0, U = 0, UW = 0, groundY = 0;
  var shards = [], heights = [], mushrooms = [];
  // compactY[c] est le sommet (y monde) de la couche compacte a la colonne c : ne peut que
  // descendre (la pelle la decompacte, voir cutCompact), jamais remonter au-dessus du
  // niveau d'origine (groundY). heights[c] reste l'epaisseur de terre MEUBLE posee dessus
  // (son plancher a 0 ne bouge pas, voir pileAdd) ; la surface reelle d'une colonne est
  // donc compactY[c] - heights[c] (voir surfaceAt).
  var compactY = [];
  // Colonnes de roche-mere (voir buildRockyPatches) : un vrai bloc, souleve dans compactY,
  // que la pelle ne peut pas creuser (cutCompact). Ni mycelium, ni gazon, ni arbre ne s'y
  // installent tant qu'elle est exposee ; l'enterrer sous assez de terre (ROCK_COVER_MIN)
  // la rend a nouveau fertile.
  var rocky = [];
  // Lacs : une entree par cuvette rocheuse (voir buildRockyPatches) {p0,p1 (plaque entiere,
  // capte la pluie), c0,c1 (de bord a bord de la cuvette, la ou l'eau tient), vol (px2 d'eau),
  // level (y monde de la surface de l'eau, Infinity = vide)}. lakeOf[c] = index+1 du lac dont
  // la plaque couvre la colonne c (0 = aucun). Le niveau se deduit du volume a chaque frame
  // (voir updateLakes), donc suit la terre meuble ajoutee/enlevee dans la cuvette.
  var lakes = [], lakeOf = [], lakeLastT = null;
  // Depots d'humus lessives jusque dans la couche compacte (voir leach()) : chacun
  // {x, y, color}, y en coord. MONDE. Distinct de shards (facettes) pour rester leger :
  // ils ne participent a aucune physique, juste a un lent enfoncement pendant la pluie.
  var compactNutri = [];
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
  // Melange partiel de deux couleurs [r,g,b] (k = part de b), et couleur hex teintee par une
  // souche (rendu du sac) ; currentStrain = souche du sac, null si standard.
  function mixRgb(a, b, k) { return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)]; }
  function tintCol(hex, strain) { return strain ? rgbStr(mixRgb(hexToRgb(hex), strain.tintRgb, STRAIN_MIX).map(Math.round)) : hex; }
  function currentStrain() { return strainById[bagStrain] || STRAIN_STD; }
  function easeOutBack(t) { var c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  // --- Lit de terre ------------------------------------------------------------------
  // Terre supplementaire qui monte du bas au moment de l'explosion : la terre du logo
  // retombe dessus. Sans elle, le tas (fait seulement du logo) etait trop mince pour creuser.
  var SOIL_RISE_FRAMES = 32;
  var soilRiseT = 1, soilDepth = 0;       // soilRiseT < 1 : le lit est en train de monter

  // Toile a sa vraie resolution (px CSS x dpr) ; le style garde la taille CSS de la boite.
  function sizeCanvas() {
    canvas.width = ZOOM === 1 ? W * dpr : Math.round(W * RS);
    canvas.height = ZOOM === 1 ? H * dpr : Math.round(H * RS);
    canvas.style.width = W * ZOOM + 'px'; canvas.style.height = H * ZOOM + 'px';
  }

  function setupSoil(rect) {
    W = rect.width / ZOOM; H = rect.height / ZOOM;
    U = H * ZOOM; UW = W * ZOOM;
    sizeCanvas();
    // Le monde deborde de la boite ; la boite est centree dedans au depart.
    worldW = W * WORLD_MULT;
    camMargin = (worldW - W) / 2;
    camX = camMargin;
    // Zoome, la fenetre (H) depasse U : le monde doit rester plus haut qu'elle (bornes de camY jamais inversees).
    worldH = Math.max(U + U * DEPTH_MULT, H + U * 0.5);
    groundY = U - 6;
    camY = camHomeY(); // 0 sans zoom ; zoome, remonte pour poser le sol au bas de l'ecran
    buildHills();
    heights = new Float32Array(Math.ceil(worldW / COL_W) + 1);
    compactY = new Float32Array(heights.length);
    compactY.fill(groundY);
    compactNutri = [];
    lakes = []; lakeOf = []; lakeLastT = null;
    drops = [];
    nextLeachAt = 0;
    weather.raining = false; weather.clouds = []; weather.lastNow = null; weather.changeAt = 0;
    weather.drought = false; weather.droughtChangeAt = 0;
    updateDroughtIndicator();

    // Profil : couche de base ondulee + bosse centrale sous le logo (au centre du monde).
    var base = U * 0.07, bump = U * 0.08, phase = Math.random() * 10;
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
    var cell = Math.max(6, UW / 160);
    var rows = Math.ceil((base * 1.4 + bump + 6) / cell), cols = Math.ceil(worldW / cell);
    var top = U - rows * cell;
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
    resetTiles();
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
    buildRockyPatches();

    // Gazon : couche initiale pleine partout (voir section "Gazon" plus haut). Le suivi de
    // hauteur precedente demarre APRES l'empilement pour ne pas confondre "la terre vient
    // d'etre posee" avec "la terre a ete remuee".
    grassCover = new Float32Array(heights.length);
    grassCover.fill(1);
    for (var rc = 0; rc < rocky.length; rc++) if (rocky[rc]) grassCover[rc] = 0;
    grassPrevH = new Float32Array(heights);
    grassMyc = new Uint8Array(heights.length);
    grassLastNow = null;
    grassNutriAt = 0;

    // Flore (voir section "Flore (cosmetique)" plus haut) : demarre a 0 partout, elle
    // pousse ensuite d'elle-meme pres des arbres/du mycelium au fil d'updateGrass.
    floraLush = new Float32Array(heights.length);
    floraTarget = new Float32Array(heights.length);
  }

  function addSoilShard(tri) {
    var cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
    var cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
    var surf = surfaceAt(cx);
    if (cy < surf) return;
    // Plus sombre en profondeur : la terre "fraiche" se voit quand on creuse.
    var depth = Math.min(1, (cy - surf) / Math.max(1, U - surf));
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
    updateZoom(); // avant toute mesure : tout ce qui suit est en px logiques
    var rect = container.getBoundingClientRect();
    setupSoil(rect);

    // Le logo est place exactement la ou le CSS affiche le fallback (encore visible
    // a ce moment-la) : taille et position se reglent donc uniquement dans style.css.
    // + camMargin : la boite est centree dans le monde, donc le logo aussi. + camY : zoome,
    // la vue de depart est remontee (camHomeY), sans ca le logo du jeu apparaitrait plus bas
    // que celui de la page.
    var fr = fallbackImg.getBoundingClientRect();
    var lx = (fr.left - rect.left) / ZOOM + camMargin, oy = (fr.top - rect.top) / ZOOM + camY, lw = fr.width / ZOOM, lh = fr.height / ZOOM;
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

  // --- Tas de terre : carte de hauteurs par colonne, posee sur la couche compacte ----
  // Chaque facette posee y ajoute son aire (etalee sur quelques colonnes, sauf par-dessus
  // un pas de la couche compacte, ou tout part dans sa propre colonne) et, quand on la
  // souleve, retire EXACTEMENT ce qu'elle avait ajoute a chaque colonne (memorise dans
  // s.kdep/s.kcol) : jamais recalcule, jamais tronque, sinon chaque coup de pelle gonfle
  // le tas jusqu'a des aiguilles de terre.
  var KERNEL = [0.08, 0.17, 0.25, 0.25, 0.17, 0.08];
  var REPOSE = COL_W * 0.7;               // denivele max entre colonnes voisines (~35 deg), et pas de compact max traverse par le kernel
  var LOOSE_DRAW_SCALE = 1.2;             // agrandissement a l'affichage de la terre meuble posee (bouche les jours)
  var LOGO_BULK = 1.3;                  // la terre du logo "foisonne" un peu en retombant

  function surfaceAt(x) {
    var c = Math.max(0, Math.min(heights.length - 1, Math.round(x / COL_W)));
    return compactY[c] - heights[c];
  }
  // Vrai tant que la roche est exposee a cette colonne (pas assez de terre meuble
  // par-dessus, voir ROCK_COVER_MIN) : rien ne pousse la, mais l'empiler sous du terreau
  // (a la pelle) l'enterre et la rend a nouveau fertile, comme demande.
  function isRocky(x) {
    var c = Math.max(0, Math.min(rocky.length - 1, Math.round(x / COL_W)));
    return !!rocky[c] && heights[c] < ROCK_COVER_MIN;
  }
  // Vrai si la colonne c est sous l'eau d'un lac (entre les bords de sa cuvette, surface du
  // sol sous le niveau de l'eau) : ni gazon, ni mycelium, ni arbre. `level` est tenu a jour
  // par updateLakes ; y monde, donc "sous l'eau" = surface plus grande que le niveau.
  function isSubmergedCol(c) {
    var li = lakeOf[c];
    if (!li) return false;
    var lk = lakes[li - 1];
    return c >= lk.c0 && c <= lk.c1 && compactY[c] - heights[c] > lk.level + 0.5;
  }
  function isSubmerged(x) {
    return isSubmergedCol(Math.max(0, Math.min(heights.length - 1, Math.round(x / COL_W))));
  }
  // Volume (px2) que la cuvette contient quand l'eau monte jusqu'au niveau y.
  function lakeCapacity(lk, y) {
    var v = 0;
    for (var c = lk.c0; c <= lk.c1; c++) {
      var d = compactY[c] - heights[c] - y;
      if (d > 0) v += d;
    }
    return v * COL_W;
  }
  // Deduit le niveau de chaque lac de son volume (on remplit depuis les colonnes les plus
  // basses, par dichotomie) et l'evapore lentement hors pluie. Plafonne au plus bas des
  // deux bords : le surplus deborde et est perdu. Recalcule a chaque frame (quelques
  // dizaines de colonnes par lac), donc suit la terre ajoutee/enlevee a la pelle.
  function updateLakes(now) {
    var dt = lakeLastT === null ? 0 : Math.max(0, now - lakeLastT);
    lakeLastT = now;
    for (var li = 0; li < lakes.length; li++) {
      var lk = lakes[li];
      if (!weather.raining && lk.vol > 0) lk.vol = Math.max(0, lk.vol - LAKE_EVAP_PER_S * (weather.drought ? 3 : 1) * dt / 1000);
      if (lk.vol <= 0) { lk.level = Infinity; continue; }
      // Bord le plus bas = le plus grand y des deux sommets (y monde : plus grand = plus bas).
      var rim = Math.max(compactY[lk.c0] - heights[lk.c0], compactY[lk.c1] - heights[lk.c1]);
      var cap = lakeCapacity(lk, rim);
      if (lk.vol >= cap) { lk.vol = cap; lk.level = rim; continue; }
      var lo = rim, hi = rim, c;
      for (c = lk.c0; c <= lk.c1; c++) hi = Math.max(hi, compactY[c] - heights[c]);
      for (var it = 0; it < 12; it++) {
        var mid = (lo + hi) / 2;
        if (lakeCapacity(lk, mid) > lk.vol) lo = mid; else hi = mid;
      }
      lk.level = (lo + hi) / 2;
    }
  }
  // Eau : un aplat translucide de bord a bord (un seul polygone, sans joints visibles), quelques
  // facettes plus claires/sombres par-dessus pour le grain low-poly, et une mince bande plus
  // claire en surface.
  function drawLakes() {
    for (var li = 0; li < lakes.length; li++) {
      var lk = lakes[li];
      if (lk.level === Infinity || lk.vol < 0.5) continue;
      var x0 = lk.c0 * COL_W, x1 = lk.c1 * COL_W, yw = lk.level, c, sa, sb;
      if (x1 < camX - 20 || x0 > camX + W + 20) continue;
      ctx.fillStyle = 'rgba(58,132,190,0.55)';
      ctx.beginPath();
      ctx.moveTo(x0, yw); ctx.lineTo(x1, yw);
      for (c = lk.c1; c >= lk.c0; c--) ctx.lineTo(c * COL_W, Math.max(yw, compactY[c] - heights[c]));
      ctx.closePath();
      ctx.fill();
      for (c = lk.c0; c < lk.c1; c++) {
        sa = Math.max(yw, compactY[c] - heights[c]); sb = Math.max(yw, compactY[c + 1] - heights[c + 1]);
        if (sa <= yw && sb <= yw) continue;
        ctx.fillStyle = c % 2 ? 'rgba(255,255,255,0.10)' : 'rgba(0,40,90,0.12)';
        poly([[c * COL_W, yw], [(c + 1) * COL_W, yw], c % 2 ? [(c + 1) * COL_W, sb] : [c * COL_W, sa]]);
      }
      ctx.fillStyle = 'rgba(190,230,250,0.55)';
      ctx.beginPath();
      ctx.moveTo(x0, yw); ctx.lineTo(x1, yw);
      for (c = lk.c1; c >= lk.c0; c--) ctx.lineTo(c * COL_W, Math.min(yw + 3, Math.max(yw, compactY[c] - heights[c])));
      ctx.closePath();
      ctx.fill();
    }
  }
  // --- Sauvegarde du terrain (localStorage) ------------------------------------------
  // Seuls heights, compactY et rocky sont gardes : particules, insectes, arbres, eau et
  // meteo repartent de zero. Le monde n'existe qu'apres le clic sur le logo (build()).
  var WORLD_KEY = 'spora-monde', WORLD_VERSION = 1;
  var worldSig = null, worldSigPrev = null, worldSaveOff = false;

  // Etat du joueur (champ optionnel "player" de la meme cle) : solde, sac offert, souches
  // debloquees et souche choisie, tresors deterres. Sauve dans tous les modes (le solde ne
  // depend pas du monde explose) et restaure au chargement du script, avant tout affichage.
  // Les tresors sont identifies par leur titre (unique dans treasureDefs) ; ceux deja
  // deterres ne sont pas regeneres enterres au premier setupTreasures apres le chargement.
  var MONEY_MAX = 1e9;
  var restoredFound = [];   // titres deterres lus dans la sauvegarde, consommes par setupTreasures
  var foundFx = {};         // titre -> position x (fraction de worldW) des tresors deterres : ils reviennent la ou ils etaient
  var skippedFound = [];    // titres ecartes de la generation du monde en cours (deja deterres)
  var playerSig = null;
  function knownTitle(t) { return typeof t === 'string' && treasureDefs.some(function (d) { return d.title === t; }); }
  function foundList() {
    var out = skippedFound.concat(restoredFound);
    treasures.forEach(function (t) { if (t.revealed && out.indexOf(t.def.title) === -1) out.push(t.def.title); });
    return out;
  }
  function playerState() {
    treasures.forEach(function (t) { if (t.revealed && worldW > 0) foundFx[t.def.title] = Math.round(t.x / worldW * 1000) / 1000; });
    return { money: Math.min(MONEY_MAX, Math.max(0, Math.floor(money) || 0)), revealed: moneyRevealed ? 1 : 0, freeBag: usedFreeBag ? 1 : 0, strains: unlockedStrains.slice(), bag: bagStrain, found: foundList(), leachTips: leachTipSeen, facts: factSeen, ch: chDone, chTrees: chPlanted, chHarv: chHarv.slice(), freeTrees: freeTrees, fx: foundFx };
  }
  function playerSigOf(p) { return p.money + '|' + p.revealed + '|' + p.freeBag + '|' + p.strains.join() + '|' + p.bag + '|' + p.found.join('/') + '|' + p.leachTips + '|' + p.facts + '|' + p.ch + '|' + p.chTrees + '|' + p.chHarv.join() + '|' + p.freeTrees + '|' + JSON.stringify(p.fx); }
  function restorePlayer() {
    try {
      var d = JSON.parse(localStorage.getItem(WORLD_KEY)), p = d && d.v === WORLD_VERSION ? d.player : null;
      if (!p || typeof p !== 'object') return;
      if (typeof p.money === 'number' && isFinite(p.money)) money = Math.min(MONEY_MAX, Math.max(0, Math.floor(p.money)));
      moneyRevealed = !!p.revealed || money > 0;
      usedFreeBag = !!p.freeBag;
      leachTipSeen = (p.leachTips | 0) & 31;
      factSeen = (p.facts | 0) & ((1 << FACTS.length) - 1);
      chDone = (p.ch | 0) & ((1 << CHALLENGES.length) - 1);
      chPlanted = Math.max(0, Math.min(999, p.chTrees | 0));
      for (var hi = 0; hi < 3; hi++) chHarv[hi] = Array.isArray(p.chHarv) ? Math.max(0, Math.min(CH_HARVEST_GOAL, p.chHarv[hi] | 0)) : 0;
      freeTrees = Math.max(0, Math.min(99, p.freeTrees | 0));
      updateChallengeUI();
      if (p.fx && typeof p.fx === 'object') Object.keys(p.fx).forEach(function (k) { if (knownTitle(k) && typeof p.fx[k] === 'number' && isFinite(p.fx[k])) foundFx[k] = Math.max(0, Math.min(1, p.fx[k])); });
      // Les souches suivent le NOMBRE de tresors deterres (1er = strophaire, 2e = pleurote...) : on ignore
      // la liste sauvee, qui pouvait contenir le strophaire d'office (ancienne version).
      // On ne compte que les titres CONNUS et uniques (un ancien titre, ex. 'Mycélium en vrac', decalait l'ordre).
      if (Array.isArray(p.found)) restoredFound = p.found.filter(function (t, i) { return knownTitle(t) && p.found.indexOf(t) === i; });
      unlockedStrains = strainOrder.slice(0, restoredFound.length).map(function (st) { return st.id; });
      bagStrain = unlockedStrains.indexOf(p.bag) !== -1 ? p.bag : (unlockedStrains[0] || 'standard');
      updateMoneyUI();
      playerSig = playerSigOf(playerState());
    } catch (e) { /* sauvegarde illisible : on repart d'un joueur neuf */ }
  }
  // Ecrit seulement l'etat du joueur, en gardant le terrain deja sauve tel quel.
  // Vrai si la cle a ete effacee par quelqu'un d'autre (reset dans un autre onglet, ou a la
  // main dans la console) depuis notre derniere ecriture : on coupe alors la sauvegarde au
  // lieu de la recreer avec notre ancien monde (sinon pagehide la reecrit avant le reload).
  var worldKeyHeld = false;
  function wipedElsewhere() {
    try {
      if (worldKeyHeld && localStorage.getItem(WORLD_KEY) === null) worldSaveOff = true;
    } catch (e) { /* stockage indisponible */ }
    return worldSaveOff;
  }
  function savePlayerIfChanged() {
    if (worldSaveOff || wipedElsewhere()) return;
    var p = playerState(), sig = playerSigOf(p);
    if (sig === playerSig) return;
    try {
      var d = null;
      try { d = JSON.parse(localStorage.getItem(WORLD_KEY)); } catch (e) { d = null; }
      if (!d || typeof d !== 'object' || d.v !== WORLD_VERSION) d = { v: WORLD_VERSION };
      d.player = p;
      localStorage.setItem(WORLD_KEY, JSON.stringify(d));
      worldKeyHeld = true;
      playerSig = sig;
    } catch (e) { /* stockage indisponible : on joue sans */ }
  }

  // Le mycelium est garde de facon approximative (voir saveMycelium) : seul le nombre de
  // facettes colonisees entre dans la signature, pas leur croissance.
  var MYC_SAVE_MAX = 6000;
  // Signature bon marche de l'etat du terrain et du mycelium, pour detecter qu'il a change.
  function terrainSig() {
    var s = colonised.length * 0.37 + trees.length * 1.13;
    for (var c = 0; c < heights.length; c++) s += heights[c] * (c % 7 + 1) + compactY[c] * (c % 5 + 2);
    return s;
  }
  // Tableau plat [x, profondeur sous la surface, myc*100, indice de souche] par facette
  // posee et vivante ; les souches sont listees a part par id. Filaments, horloges, parents
  // et champignons ne sont pas gardes (ils se regenerent depuis le mycelium restaure).
  function saveMycelium() {
    var flat = [], strains = [];
    for (var i = 0; i < colonised.length && flat.length < MYC_SAVE_MAX * 4; i++) {
      var s = colonised[i];
      if (!s.settled || s.deadMyc || !(s.myc > 0)) continue;
      var id = s.strain && s.strain.id !== 'standard' ? s.strain.id : '', si = strains.indexOf(id);
      if (si < 0) si = strains.push(id) - 1;
      flat.push(Math.round(s.x), Math.round(s.y - surfaceAt(s.x)), Math.round(Math.min(1, s.myc) * 100), si);
    }
    return { myc: flat, strains: strains };
  }
  // Arbres, de facon approximative : colonne (x arrondi), nutriments manges (donc taille) et
  // drapeau "plante par le joueur". Forme, branches et feuilles sont regenerees a la
  // restauration ; feuilles au sol et branches bonus ne sont pas gardees. Les arbres ne
  // meurent pas dans le jeu (ils maigrissent seulement), donc pas de cas "mort".
  var TREES_SAVE_MAX = 60;
  var worldEaten = 0;         // somme des nutriments manges a la derniere sauvegarde (croissance seule ne declenche pas la sauvegarde, sauf a la fermeture)
  function eatenSum() { var n = 0; for (var i = 0; i < trees.length; i++) n += trees[i].eaten; return n; }
  var restoredTrees = null;   // arbres lus dans la sauvegarde, consommes par explode()
  function saveTrees() {
    return trees.slice(0, TREES_SAVE_MAX).map(function (t) {
      return { x: Math.round(t.x), e: Math.min(MATURE_NUTRIENTS, Math.max(0, Math.round(t.eaten) || 0)), s: Math.min(TALL_FULL, Math.max(0, Math.round(t.surplus) || 0)), p: t.planted ? 1 : 0, g: t.tuto ? 1 : 0 };
    });
  }
  // Colonne valide la plus proche de x (terrain restaure : roche exposee ou lac) dans un
  // rayon de 15 colonnes ; null si aucune.
  function nearestTreeX(x) {
    for (var k = 0; k <= 15; k++) {
      for (var sg = -1; sg <= 1; sg += 2) {
        var cx = x + sg * k * COL_W;
        if (cx >= 0 && cx <= (heights.length - 1) * COL_W && !isRocky(cx) && !isSubmerged(cx)) return cx;
      }
    }
    return null;
  }
  // Recree les arbres sauves ; entrees invalides ignorees. Un arbre plante par le joueur
  // n'est jamais ecarte : decale a la colonne valide la plus proche, sinon garde tel quel.
  function makeSavedTrees(list) {
    var out = [];
    list.slice(0, TREES_SAVE_MAX).forEach(function (o) {
      if (!o || typeof o.x !== 'number' || !isFinite(o.x) || typeof o.e !== 'number' || !isFinite(o.e)) return;
      var x = Math.max(0, Math.min((heights.length - 1) * COL_W, o.x)), planted = !!o.p;
      if (isRocky(x) || isSubmerged(x)) {
        var nx = nearestTreeX(x);
        if (nx === null && !planted) return;
        if (nx !== null) x = nx;
      }
      var t = makeTree(x);
      t.planted = planted;
      t.tuto = !!o.g;
      t.eaten = Math.min(MATURE_NUTRIENTS, Math.max(0, Math.round(o.e)));
      t.growth = Math.min(1, t.eaten / MATURE_NUTRIENTS);
      t.surplus = typeof o.s === 'number' && isFinite(o.s) ? Math.min(TALL_FULL, Math.max(0, Math.round(o.s))) : 0;
      // Les 8 feuilles de depart suffiraient pour un arbre neuf ; un arbre grand en veut plus.
      for (var k = 8; k < Math.round(unlockedSlots(t) * 0.7); k++) addLeaf(t, vTime - Math.random() * LEAF_LIFE_MS[0] * 0.6);
      ageSomeLeaves(t);
      out.push(t);
    });
    return out;
  }
  // Vieillit 4 a 8 feuilles (selon la taille) dans les 20 % de vie qui precedent la chute,
  // etalees : elles tombent en quelques secondes a quelques dizaines de secondes et nourrissent
  // le mycelium restaure au pied de l'arbre, avant que sa faim (MYC_STARVE_MS) ne l'eteigne.
  function ageSomeLeaves(t) {
    var leaves = [];
    t.slots.forEach(function (sl) { if (sl.leaf && vTime >= sl.leaf.born) leaves.push(sl.leaf); });
    var n = Math.min(leaves.length, Math.max(4, Math.round(4 + 4 * t.growth)));
    for (var i = 0; i < n; i++) leaves[i].born = vTime - leaves[i].life * (0.8 + 0.18 * i / n);
  }
  function saveWorld() {
    if (wipedElsewhere()) return;
    try {
      var n = heights.length, h = new Array(n), cy = new Array(n), r = new Array(n);
      for (var c = 0; c < n; c++) {
        h[c] = Math.round(heights[c] * 10) / 10;
        cy[c] = Math.round(compactY[c] * 10) / 10;
        r[c] = rocky[c] ? 1 : 0;
      }
      var m = saveMycelium(), p = playerState();
      localStorage.setItem(WORLD_KEY, JSON.stringify({ v: WORLD_VERSION, zoom: ZOOM, cols: n, heights: h, compactY: cy, rocky: r, myc: m.myc, strains: m.strains, trees: saveTrees(), player: p }));
      worldKeyHeld = true;
      worldSig = terrainSig();
      worldEaten = eatenSum();
      playerSig = playerSigOf(p);
    } catch (e) { /* stockage indisponible (mode prive, quota) : on joue sans */ }
  }
  // Sauve si le terrain a change depuis la derniere sauvegarde. Appelee toutes les 1,5 s :
  // on attend que la signature soit stable d'un passage a l'autre (pause d'activite).
  function saveWorldIfIdle(force) {
    if (worldSaveOff || mode !== 'exploded' || !heights.length) return;
    var sig = terrainSig();
    if ((sig !== worldSig && (force || sig === worldSigPrev)) || (force && eatenSum() !== worldEaten)) saveWorld();
    worldSigPrev = sig;
  }
  function saveAll(force) { saveWorldIfIdle(force); savePlayerIfChanged(); }
  setInterval(function () { if (!document.hidden) saveAll(false); }, 1500);
  document.addEventListener('visibilitychange', function () { if (document.hidden) saveAll(true); });
  window.addEventListener('pagehide', function () { saveAll(true); });
  restorePlayer();
  try { worldKeyHeld = localStorage.getItem(WORLD_KEY) !== null; } catch (e) { /* stockage indisponible */ }
  if (playerSig === null) playerSig = playerSigOf(playerState()); // pas de sauvegarde : l'etat de depart n'est pas un changement a ecrire
  // Un reset fait dans un autre onglet efface la cle : cet onglet arrete de sauver son ancien
  // monde (sinon il la reecrit dans la seconde qui suit) et se recharge.
  window.addEventListener('storage', function (e) {
    if (e.key === WORLD_KEY && e.newValue === null && !worldSaveOff) {
      worldSaveOff = true;
      location.reload();
    }
  });
  // Fleche de reconstruction : efface la sauvegarde ET l'etat du joueur en memoire, puis joue
  // l'animation de reconstruction du logo (le prochain monde repart de zero, pas de la cle).
  function resetAllAndRebuild() {
    try { localStorage.removeItem(DEMO_KEY); } catch (e) { /* rien a effacer */ }
    DEMO = DEMO_PAGE;
    container.classList.toggle('is-demo', DEMO);
    try { localStorage.removeItem(WORLD_KEY); } catch (e) { /* rien a effacer */ }
    guideReset();
    worldKeyHeld = false;
    money = 0; moneyRevealed = false; usedFreeBag = false; bagGrainsLeft = 0;
    unlockedStrains = []; bagStrain = 'standard';
    resetPatches();
    leachTipSeen = 0; grassLost = 0; factSeen = 0; branchTorn = false; chDone = 0; chPlanted = 0; chHarv = [0, 0, 0]; freeTrees = 0; chPending = []; chHoldSince = [0, 0, 0];
    updateChallengeUI();
    restoredFound = []; skippedFound = []; foundFx = {}; restoredTrees = null;
    playerSig = playerSigOf(playerState());
    if (moneyEl) moneyEl.classList.add("d-none");
    updateMoneyUI();
    refreshStrainBar(); // redessine les souches verrouillees (la barre ne suit pas la liste toute seule)
    rebuild();
  }
  window.sporaResetWorld = function () {
    try { localStorage.removeItem(DEMO_KEY); } catch (e) { /* rien a effacer */ }
    worldSaveOff = true;
    try { localStorage.removeItem(WORLD_KEY); } catch (e) { /* rien a effacer */ }
    guideReset();
    location.reload();
  };

  // Recree les lacs (cuvettes vides) a partir des plaques rocheuses restaurees : une plaque
  // est une cuvette si son interieur descend sous ses deux bords (comme dans buildRockyPatches).
  function rebuildLakesFromRocky() {
    lakes = []; lakeOf = new Uint16Array(heights.length);
    var c = 0, n = rocky.length;
    while (c < n) {
      if (!rocky[c]) { c++; continue; }
      var start = c, k;
      while (c < n && rocky[c]) c++;
      var end = c - 1, mid = (start + end) >> 1, cl = start, cr = end, low = compactY[start];
      for (k = start; k <= mid; k++) if (compactY[k] < compactY[cl]) cl = k;
      for (k = mid; k <= end; k++) if (compactY[k] < compactY[cr]) cr = k;
      for (k = cl; k <= cr; k++) low = Math.max(low, compactY[k]);
      if (cr - cl < 2 || low <= Math.max(compactY[cl], compactY[cr]) + 2) continue;
      lakes.push({ p0: start, p1: end, c0: cl, c1: cr, vol: 0, level: Infinity });
      for (k = start; k <= end; k++) lakeOf[k] = lakes.length;
    }
  }
  // Recolonise, a peu pres au meme endroit, les facettes du lit de terre (les seules qui
  // existent a ce stade) : la plus proche du point sauve (x, profondeur sous la surface
  // restauree), a 12 px au plus ; sans facette, ou sur la roche, l'entree est ignoree.
  // Facettes remises a un etat neutre : horloge de faim neuve, sans parent ni champignon.
  function restoreMycelium(d) {
    if (!Array.isArray(d.myc) || d.myc.length % 4) return;
    var strains = Array.isArray(d.strains) ? d.strains : [], byCol = {}, i;
    for (i = 0; i < shards.length; i++) {
      var s = shards[i];
      if (s.settled && s.soil) (byCol[s.col] = byCol[s.col] || []).push(s);
    }
    for (i = 0; i < d.myc.length; i += 4) {
      var x = d.myc[i], dep = d.myc[i + 1], v = d.myc[i + 2] / 100;
      if (!isFinite(x) || !isFinite(dep) || !isFinite(v)) continue;
      var col = Math.round(x / COL_W);
      if (col < 0 || col >= heights.length || rocky[col]) continue;
      var ty = surfaceAt(x) + dep, best = null, bd = 12;
      for (var k = col - 1; k <= col + 1; k++) {
        var list = byCol[k];
        if (!list) continue;
        for (var j = 0; j < list.length; j++) {
          var dd = Math.hypot(list[j].x - x, list[j].y - ty);
          if (!list[j].myc && dd < bd) { bd = dd; best = list[j]; }
        }
      }
      if (!best) continue;
      var id = strains[d.myc[i + 3]];
      infect(best, best.x, best.y, Math.max(0.05, Math.min(1, v)), vTime, vTime, null, strainById[id || 'standard'] || STRAIN_STD);
    }
  }
  // Appelee a la place de la generation des roches. Retourne true si un terrain sauve valide
  // (meme version, meme nombre de colonnes) a ete applique ; sinon ne touche a rien.
  function restoreWorld() {
    resetTiles();
    var n = heights.length;
    try {
      var d = JSON.parse(localStorage.getItem(WORLD_KEY));
      // Positions en px logiques : valables seulement pour le meme zoom (sans champ = ancienne sauvegarde, zoom 1).
      if (!d || d.v !== WORLD_VERSION || d.cols !== n || (d.zoom === undefined ? 1 : d.zoom) !== ZOOM) return false;
      var arrs = [d.heights, d.compactY, d.rocky];
      for (var a = 0; a < 3; a++) {
        if (!Array.isArray(arrs[a]) || arrs[a].length !== n) return false;
        for (var i = 0; i < n; i++) if (typeof arrs[a][i] !== 'number' || !isFinite(arrs[a][i])) return false;
      }
      rocky = new Uint8Array(n);
      for (var c = 0; c < n; c++) {
        rocky[c] = d.rocky[c] ? 1 : 0;
        compactY[c] = d.compactY[c];
      }
      rebuildLakesFromRocky();
      // heights n'est PAS restaure : il vient des facettes de terre fraichement recreees par
      // setupSoil (sinon de la terre fantome sans facette a ramasser). On retire donc
      // proprement (pileRemove) les facettes du lit posees sur la roche.
      shards = shards.filter(function (s) {
        if (s.soil && rocky[s.col]) { pileRemove(s); return false; }
        return true;
      });
      // Colonnes creusees : les facettes du lit qui flottent au-dessus du sol restaure
      // retombent (meme logique que le balayage des facettes posees).
      shards.forEach(function (s) {
        if (s.soil && s.settled && s.kcol && s.y < surfaceAt(s.x) - 6) { pileRemove(s); s.settled = false; }
      });
      try { restoreMycelium(d); } catch (e2) { /* mycelium illisible : le terrain reste restaure */ }
      restoredTrees = Array.isArray(d.trees) && d.trees.length ? d.trees : null;
      worldSig = worldSigPrev = terrainSig();
      return true;
    } catch (e) {
      return false;
    }
  }
  // Quelques plaques de roche-mere affleurante, disseminees au hasard sur la largeur du
  // monde : des taches ou la couche compacte elle-meme ne se creuse jamais (voir son usage
  // dans cutCompact), pas juste une histoire de surface.
  function buildRockyPatches() {
    if (restoreWorld()) return;
    rocky = new Uint8Array(heights.length);
    lakes = []; lakeOf = new Uint16Array(heights.length);
    var n = ROCK_PATCH_MIN + ((Math.random() * (ROCK_PATCH_MAX - ROCK_PATCH_MIN + 1)) | 0);
    // Une partie des plaques (au moins une, jamais toutes s'il y en a plusieurs) sont des
    // cuvettes qui retiendront l'eau de pluie (voir updateLakes) au lieu de simples bosses.
    var nBasin = Math.max(1, Math.min(n - 1, Math.round(n * ROCK_BASIN_FRAC)));
    for (var p = 0; p < n; p++) {
      var w = ROCK_PATCH_COLS_MIN + ((Math.random() * (ROCK_PATCH_COLS_MAX - ROCK_PATCH_COLS_MIN + 1)) | 0);
      var start = (Math.random() * Math.max(1, rocky.length - w)) | 0;
      // Bosse (comme le mound du profil general) : un vrai bloc qui depasse du sol, pas
      // une simple tache plate — pointe au milieu de la plaque, s'efface sur les bords.
      var peak = U * (ROCK_H_MIN + Math.random() * (ROCK_H_MAX - ROCK_H_MIN));
      var basin = p < nBasin, dip = U * ROCK_BASIN_DEPTH;
      for (var c = start; c < start + w && c < rocky.length; c++) {
        rocky[c] = 1;
        var t = (c - start) / w, edge = Math.sin(Math.PI * t);
        compactY[c] -= peak * edge;
        // Cuvette : on garde la bosse (bords releves) mais on la creuse au centre par une
        // gaussienne etroite, dosee pour que le fond tombe a `dip` SOUS le sol general
        // (compactY = groundY au repos) : l'eau y tient. Pente douce (sigma ~0.16 w).
        if (basin) compactY[c] += (peak + dip) * Math.exp(-Math.pow((t - 0.5) / 0.16, 2));
      }
      if (basin) {
        var end = Math.min(start + w, rocky.length) - 1, mid = start + (w >> 1), cl = start, cr = end, k;
        // Les bords de la cuvette = points les plus hauts (y le plus petit) de chaque moitie.
        for (k = start; k <= mid; k++) if (compactY[k] < compactY[cl]) cl = k;
        for (k = mid; k <= end; k++) if (compactY[k] < compactY[cr]) cr = k;
        lakes.push({ p0: start, p1: end, c0: cl, c1: cr, vol: 0, level: Infinity });
        for (k = start; k <= end; k++) lakeOf[k] = lakes.length;
      }
    }
    // Degage la terre meuble deposee par l'explosion sur ces colonnes : la roche doit
    // affleurer des le depart (sinon elle resterait cachee sous le tas initial jusqu'au
    // premier coup de pelle).
    shards = shards.filter(function (s) {
      if (!s.soil || !rocky[s.col]) return true;
      pileRemove(s);
      return false;
    });
  }
  function pileAdd(s) {
    s.dep = s.area / COL_W * (s.soil || s.extra ? 1 : LOGO_BULK);
    if (s.branch) s.dep *= LOG_BULK; else if (s.leaf) s.dep *= LITTER_BULK; // litiere a plat : kdep memorise ce qui est reellement ajoute
    s.kcol = s.kcol || [0, 0, 0, 0, 0, 0];
    s.kdep = s.kdep || [0, 0, 0, 0, 0, 0];
    for (var k = 0; k < KERNEL.length; k++) {
      var t = s.col + k - 3;
      // Hors limites, ou de l'autre cote d'un pas de compact (trou/paroi) : ce partage
      // reste sur la colonne de la facette au lieu de "traverser" le pas.
      if (t < 0 || t >= heights.length || Math.abs(compactY[t] - compactY[s.col]) > REPOSE) t = s.col;
      var amt = s.dep * KERNEL[k];
      s.kcol[k] = t;
      s.kdep[k] = amt;
      heights[t] = Math.max(0, heights[t] + amt);
    }
  }
  function pileRemove(s) {
    if (!s.kcol) return; // jamais empilee (ne devrait pas arriver)
    for (var k = 0; k < KERNEL.length; k++) heights[s.kcol[k]] = Math.max(0, heights[s.kcol[k]] - s.kdep[k]);
  }

  // Comme du sable : une facette qui tombe sur une pente trop raide roule vers la
  // colonne voisine la plus basse, au lieu de s'empiler en aiguille.
  function restColumn(x) {
    var c = Math.max(0, Math.min(heights.length - 1, Math.round(x / COL_W)));
    for (var n = 0; n < 60; n++) {
      var sc = compactY[c] - heights[c];
      var sl = c > 0 ? compactY[c - 1] - heights[c - 1] : -Infinity;
      var sr = c < heights.length - 1 ? compactY[c + 1] - heights[c + 1] : -Infinity;
      // Surface = y monde : plus grand = plus bas. On roule vers le voisin le plus bas.
      var lowSurf = Math.max(sl, sr);
      if (lowSurf === -Infinity || lowSurf - sc <= REPOSE) break;
      c = sl > sr ? c - 1 : c + 1;
    }
    return c;
  }

  // --- Physique ----------------------------------------------------------------------
  function explode(px, py) {
    grassTipFrom = performance.now() + 8000;
    if (window.sporaSfx) sporaSfx.play('thud'); 
    fallbackImg.classList.add('d-none');
    canvas.classList.remove('d-none');
    mode = 'exploded';
    explodedAt = performance.now();
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
    compactHeaderForGame();
    if (fullscreenBtn) fullscreenBtn.classList.remove('d-none');
    if (speedBtn) speedBtn.classList.remove('d-none');
    if (debugToggleBtn) debugToggleBtn.classList.remove('d-none');
    if (toolsBar) toolsBar.classList.remove('d-none');
    if (chBadgeEl) chBadgeEl.classList.remove('d-none');
    updateMoneyUI();
    updateStrainBar();
    // Le compteur ne vit que dans le panneau : montre seulement une fois range dedans (buildDebugPanel).
    if (treasureCountEl && treasureDefs.length && debugBuilt) treasureCountEl.classList.remove('d-none');
    if (scrollLeftBtn) scrollLeftBtn.classList.remove('d-none');
    if (scrollRightBtn) scrollRightBtn.classList.remove('d-none');
    if (scrollUpBtn) scrollUpBtn.classList.remove('d-none');
    if (scrollDownBtn) scrollDownBtn.classList.remove('d-none');
    setupTreasures();
    // Un arbre visible a gauche du logo, un autre plus loin a droite dans le monde.
    var savedTrees = null;
    try { if (restoredTrees) savedTrees = makeSavedTrees(restoredTrees); } catch (e) { savedTrees = null; }
    restoredTrees = null;
    trees = savedTrees && savedTrees.length ? savedTrees : [makeTree(camMargin + W * 0.14), makeStartTree(camMargin + W * 0.93, 10), makeTree(camMargin + W * 1.35)];
    if (savedTrees && savedTrees.length) worldSig = worldSigPrev = terrainSig();
    litter = [];
    if (toolsArrow && unlockedStrains.length) toolsArrow.classList.remove('d-none');
    startLoop();
  }

  // Vitesse de defilement selon la position ecran du curseur : nulle au centre, augmente
  // en approchant des CAMERA_EDGE derniers % de chaque bord de la boite.
  function cameraSpeed(screenX) {
    var edge = W * (edgeTouch ? CAMERA_EDGE_TOUCH : CAMERA_EDGE);
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
    var edge = H * (edgeTouch ? CAMERA_EDGE_TOUCH : CAMERA_EDGE);
    var y = Math.max(0, screenY - CAMERA_TOP_DEADZONE / ZOOM); // la zone cachee par le header est en px CSS
    if (y < edge) {
      var k = 1 - y / edge;
      return -CAMERA_MAX_Y * k * k;
    }
    // Le bas de la boite peut depasser l'ecran (100vh sur mobile, barre du navigateur) : la
    // zone part du bas VISIBLE, sinon le doigt ne l'atteint presque pas.
    var bottom = edgeTouch ? Math.min(H, (window.innerHeight - canvas.getBoundingClientRect().top) / ZOOM) : H;
    if (screenY > bottom - edge) {
      var k2 = Math.min(1, 1 - (bottom - screenY) / edge);
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
        if (!shovel.released) { // pelle lachee : elle verse sur place, elle ne suit plus
          shovel.gx = hoverScreenX + camX;
          shovel.gy = hoverScreenY + camY;
        }
        bag.x = hand.x = hoverScreenX + camX;
        bag.y = hand.y = hoverScreenY + camY;
      }
      // Demo : le monde tient dans l'ecran, aucun defilement horizontal (bords, fleches, glissement).
      var camV = DEMO ? 0 : mobileArrow ? mobileArrow * CAMERA_MAX : (hoverScreenX !== null ? cameraSpeed(hoverScreenX) : 0);
      if (camV) {
        var newCamX = clamp(camX + camV, 0, worldW - W);
        if (newCamX !== camX) camMoving = true;
        camX = newCamX;
      }
      if (camGoal) { // glissement vers une alerte ; tout defilement manuel l'annule
        if (DEMO) camGoal.x = camX;
        if (camV || mobileArrowY) camGoal = null;
        else {
          var gdx = camGoal.x - camX, gdy = camGoal.y - camY;
          if (Math.abs(gdx) < 1 && Math.abs(gdy) < 1) { camX = camGoal.x; camY = camGoal.y; camGoal = null; }
          else { camX += gdx * 0.12; camY += gdy * 0.12; }
          camMoving = true;
        }
      }
      flushDeathAlert();
      var camVY = mobileArrowY ? mobileArrowY * CAMERA_MAX_Y : (hoverScreenY !== null ? cameraSpeedY(hoverScreenY) : 0);
      if (camVY) {
        var newCamY = clamp(camY + camVY, camMinY(), worldH - H);
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
    var active = shovel.on || bag.on || camMoving || weather.raining || drops.length > 0;
    if (bag.on) updateBag();
    if (hand.on && updateHand(now)) active = true;
    if (mode === 'exploded') { updateWeather(now); msgTick(); }
    updateRainDrops(now);
    if (shovel.on) {
      updateShovel();
      if (shovel.on) bowlWakePile(cutCompact()); // updateShovel peut la ranger (fin de versement au doigt)
    }
    // Balayage lent, quel que soit l'outil : une facette posee dont le sol a baisse (lessivage,
    // effondrement, pluie...) sans passer par la pelle ou le poing retombe quand meme.
    if (mode === 'exploded' && frame % 30 === 0) {
      for (var j = 0; j < shards.length; j++) {
        var sj = shards[j];
        if (sj.settled && sj.kcol &&sj.y < surfaceAt(sj.x) - 6) { pileRemove(sj); sj.settled = false; }
      }
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
      if (s.carried) {
        // Tenue a la main : suit le curseur, ignore la gravite tant qu'elle n'est pas
        // relachee (voir endPress, qui remet juste s.carried a false et la laisse tomber).
        s.px = s.x; s.py = s.y;
        s.x = hand.x + s.hox; s.y = hand.y + s.hoy;
        continue;
      }
      s.px = s.x; s.py = s.y;
      if (shovel.on) bladeField(s);
      // driftScale : contrairement a la pelle et aux facettes de terre (voir vTime plus
      // haut, la physique image par image ne doit PAS suivre le curseur de vitesse debug,
      // sinon la pelle deviendrait incontrolable), une feuille encore en l'air n'est
      // manipulee par personne — rien n'empeche sa chute d'accelerer avec le reste du
      // cycle. Sans ca, a vitesse elevee les feuilles se detachaient bien plus souvent
      // (vTime, voir plus haut) mais mettaient toujours le meme temps REEL a atteindre le
      // sol, ce qui les faisait sembler trainer par rapport a tout le reste.
      var driftScale = 1;
      if (s.leaf && !s.branch && !s.landed) {
        // Une feuille plane, pas encore tombee au sol une premiere fois : chute lente,
        // se balance de gauche a droite.
        // Vent : toujours un sens (qui s'inverse toutes les ~60 s), par rafales. Chaque
        // feuille a sa prise au vent (s.gust) : la plupart tombent pres, certaines partent loin.
        var wind = (Math.sin(now / 20000) >= 0 ? 1 : -1) * (0.4 + 0.3 * (1 + Math.sin(now / 1700 + s.sway))) * WIND_STRENGTH;
        s.vy += GRAVITY * 0.22 / (1 + s.gust * 0.4); s.vy *= 0.96;
        s.vx = s.vx * 0.95 + Math.sin(now / 350 + s.sway) * 0.1 + wind * (0.02 + s.gust * 0.045) * (s.wm || 1);
        driftScale = timeScale;
      } else if (s.leaf && !s.branch) {
        // Une feuille deja tombee au moins une fois (relancee par la pelle) : elle ne
        // doit plus flotter comme a sa chute depuis l'arbre, mais tomber comme un debris.
        s.vy += GRAVITY * 0.6; s.vx *= AIR;
      } else if (s.leaf) {
        // Le bois (branch:true) est lourd : il tombe toujours comme un debris, meme a
        // sa toute premiere chute depuis l'arbre (pas de flottement type feuille).
        s.vy += GRAVITY * 0.75; s.vx *= AIR;
      } else {
        s.vy += GRAVITY; s.vx *= AIR; s.vy *= AIR;
        s.mix = Math.min(1, s.mix + 0.007);
      }
      s.x += s.vx * driftScale; s.y += s.vy * driftScale; s.rot += s.vr;
      if (shovel.on && collideBowl(s)) {
        s.vr *= 0.8;
        continue; // tenue par le bol : pas de contact avec le sol cette frame
      }
      if (s.x < 4) { s.x = 4; s.vx = Math.abs(s.vx) * 0.4; }
      if (s.x > worldW - 4) { s.x = worldW - 4; s.vx = -Math.abs(s.vx) * 0.4; }
      var floor = surfaceAt(s.x);
      if (s.grain) {
        // Un grain ne s'empile pas : il se fond dans la terre et l'inocule.
        if (s.y >= floor) { inoculate(s.x, floor, now, s.strain); s.dead = true; anyDead = true; }
        continue;
      }
      if (s.y >= floor && s.vy > 0) {
        s.y = floor;
        if (s.vy > 2.5) {
          s.vy *= -0.28; s.vx *= 0.6; s.vr *= 0.5;
        } else {
          s.settled = true; s.vx = s.vy = s.vr = 0;
          if (s.leaf) s.restRot = (Math.random() - 0.5) * (s.branch ? 0.24 : 0.3); // angle fige a plat (dessin seulement)
          // Une feuille garde sa couleur au sol et se decompose lentement (voir stepTrees).
          if (s.leaf) {
            // Une feuille/du bois deja passe par la litiere (pris a la main ou relance) garde
            // son avancement de decomposition (s.mix) au lieu de repartir de zero.
            s.landed = s.landed !== undefined ? now - s.mix * (s.branch ? BRANCH_LITTER_MS : LITTER_MS) : now;
            s.bonus = 0; s.lastNow = 0;
            if (litter.indexOf(s) < 0) litter.push(s);
          } else s.mix = 1;
          s.col = restColumn(s.x);
          s.x = (s.col + Math.random() - 0.5) * COL_W;
          s.y = compactY[s.col] - heights[s.col];
          pileAdd(s);
        }
      }
    }
    if (mode === 'exploded') {
      var tl = stepTrees(now);
      var gl = updateGrass(now);
      treeLife = tl > 0 || gl > 0;
      if (tl === 2) active = true;
      if (stepFlowers(now)) active = true;
      if (stepInsects(realNow)) active = true;
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
    var mycNearReach = U * FRUIT_W;
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
    if (goldBits.length && stepGoldBits()) active = true;
    // Un tresor enfoui est deterre d'office quand le fond du trou l'atteint (pas besoin de
    // "coups" en plus : sinon on pouvait creuser jusqu'a lui sans que rien ne se passe).
    if (mode === 'exploded') {
      for (i = 0; i < treasures.length; i++) {
        var tr = treasures[i];
        if (tr.deep && !tr.revealed && tr.ready && surfaceAt(tr.x) >= tr.y - 12) { reveal(tr); active = true; }
      }
    }
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
      // Il ne reste que des feuilles qui vieillissent, ou juste le cycle meteo (pluie
      // naturelle) a surveiller pour son prochain changement d'etat : 4 images/s suffisent.
      if (mode === 'exploded' && (treeLife || rainLevel > 0)) {
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
  var BLADE_WIDTH = 0.17;                 // largeur de la lame (fraction de la hauteur de la zone)
  var BOWL_SPAN = 0.35;                   // demi-ouverture de l'arc (rad) : plus petit = plus plat
  var BOWL_T = 5;                         // epaisseur de la paroi (px)
  var POUR_ANGLE = 2.1;                   // bascule (rad) pour vider
  var SLOW_FOLLOW = 0.12;                 // bouton maintenu : part du chemin vers le curseur par frame
  var DIG_BITE = 2;                       // penetration (px) dans le compact tolerable sans ralentir la pelle
  var DIG_SPEED = 0.8;                    // vitesse max (px/frame) du fond de la pelle au-dela de DIG_BITE : le curseur de resistance
  var DIG_SPEED_DOWN = 0.3;               // idem, mais vers le bas seulement (creuser a la verticale)
  var shovel = {
    on: false, held: false, pouring: false, hideWhenEmpty: false, released: false,
    gx: 0, gy: 0,                         // curseur
    cx: 0, cy: 0, pcx: 0, pcy: 0,         // centre du cercle du bol, et a la frame precedente
    tilt: 0, ptilt: 0, face: 1            // face : 1 = dernier geste vers la droite, -1 = gauche
  };
  var BLADE_FIELD = 0.10;                 // hauteur de la zone de force au-dessus de la lame (x hauteur)
  var BLADE_PULL = 0.18;                  // part de l'ecart de vitesse rattrapee par frame (sur la lame)
  var BLADE_ATTRACT = 0.12;               // attraction vers la lame (px/frame^2, sur la lame)
  var pointerDown = null, dragMoved = false;

  function bowlR() { return U * BLADE_WIDTH / 2 / Math.sin(BOWL_SPAN); }
  function loadDepth() { return U * 0.04; } // hauteur de terre que la lame peut porter
  function angleDiff(a, b) { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // Pour un cercle de centre (cx, cy) et de rayon Rc, penche de tilt : le point le plus
  // BAS (y le plus grand) de ce cercle a la colonne x, mais seulement sur la portion qui
  // fait vraiment partie de la lame (l'arc ouvert de BOWL_SPAN autour du fond du bol) —
  // au-dela il n'y a rien, juste de l'air. Utilise pour la resistance du compact
  // (updateShovel/enterShovel) et pour la decompaction (cutCompact). Retourne null si
  // aucun point du cercle a cette colonne n'est sur la lame.
  function bladeOuterY(x, cx, cy, tilt, Rc) {
    var dx = x - cx;
    if (Math.abs(dx) > Rc) return null;
    var dy = Math.sqrt(Rc * Rc - dx * dx), bottomDir = Math.PI / 2 - tilt;
    var cands = [cy + dy, cy - dy], bestY = null, bestA = 0;
    for (var i = 0; i < 2; i++) {
      var y = cands[i], a = Math.atan2(y - cy, dx);
      if (Math.abs(angleDiff(a, bottomDir)) > BOWL_SPAN) continue;
      if (bestY === null || y > bestY) { bestY = y; bestA = a; }
    }
    return bestY === null ? null : { y: bestY, a: bestA };
  }

  function enterShovel(p) {
    shovel.on = true;
    shovel.gx = p.x; shovel.gy = p.y;
    shovel.tilt = shovel.ptilt = 0;
    shovel.pouring = false; shovel.hideWhenEmpty = false; shovel.released = false;
    shovel.cx = shovel.pcx = p.x; shovel.cy = shovel.pcy = p.y - bowlR();
    // Si le bol entre deja dans le compact a cet endroit, on le remonte d'autant : prendre
    // l'outil ne doit jamais creuser un trou instantane.
    var Rc = bowlR() + BOWL_T, pen = 0;
    var c0 = Math.max(0, Math.floor((shovel.cx - Rc) / COL_W)), c1 = Math.min(heights.length - 1, Math.ceil((shovel.cx + Rc) / COL_W));
    for (var c = c0; c <= c1; c++) {
      var bo = bladeOuterY(c * COL_W, shovel.cx, shovel.cy, shovel.tilt, Rc);
      if (bo) pen = Math.max(pen, bo.y - compactY[c]);
    }
    if (pen > 0) { shovel.cy -= pen; shovel.pcy = shovel.cy; }
    container.classList.add('is-tool-cursor');
  }

  function leaveShovel() {
    shovel.on = false; shovel.held = false; shovel.pouring = false; shovel.hideWhenEmpty = false; shovel.released = false;
    container.classList.remove('is-tool-cursor');
  }

  // --- Pelle plantee dans le sol ---------------------------------------------------------
  // Au repos la pelle n'est plus un outil : elle est plantee (lame enfoncee, manche qui
  // depasse) a un x fixe, et suit la surface. Sans physique tant qu'on ne l'a pas attrapee
  // a la main. Relachee, elle verse ce qu'elle porte sur place puis se replante la.
  var shovelPlant = { x: null };
  var PLANT_LEAN = 0.12;                  // legere inclinaison du manche (rad)
  function plantedX() {
    if (shovelPlant.x === null) shovelPlant.x = camMargin + W * 0.68; // coord. monde : dans la vue de depart, pres du tas
    // Demo : la camera ne defile pas, la pelle plantee reste donc dans la vue (voir compassGo).
    return DEMO ? clamp(shovelPlant.x, camX + 30, camX + W - 30) : clamp(shovelPlant.x, 30, worldW - 30);
  }
  // Repere de la pelle plantee : s le long du manche (vers le haut), k en travers.
  function plantFrame() {
    var x = plantedX(), bw = U * BLADE_WIDTH, bl = bw;
    return {
      x: x, sy: surfaceAt(x), bw: bw, bl: bl,
      ux: Math.sin(PLANT_LEAN), uy: -Math.cos(PLANT_LEAN), nx: Math.cos(PLANT_LEAN), ny: Math.sin(PLANT_LEAN),
      sock: bw / 58 * 34, shaft: U * 0.13
    };
  }
  function plantPt(f, s, k) { return [f.x + f.ux * s + f.nx * k, f.sy + f.uy * s + f.ny * k]; }
  // Zone de saisie genereuse (surtout au doigt) autour du manche et de la partie visible de la lame.
  function shovelHit(x, y, touch) {
    if (shovel.on || mode !== 'exploded') return false;
    var f = plantFrame(), r = touch ? Math.max(30, U * 0.06) : Math.max(14, U * 0.03);
    var top = f.bl * 0.45 + f.sock + f.shaft + f.bw / 58 * 12;
    var a = plantPt(f, -f.bl * 0.1, 0), b = plantPt(f, top, 0);
    return distToSeg(x, y, a[0], a[1], b[0], b[1]) <= Math.max(r, f.bw * 0.35);
  }
  // Prise : le bol part du pied de la pelle plantee et rejoint le curseur.
  function grabShovel(pos, touch) {
    var f = plantFrame();
    enterShovel({ x: f.x, y: f.sy - 2 });
    shovel.gx = pos.x; shovel.gy = pos.y;
    shovel.held = !touch;
    shovel.face = pos.x >= f.x ? 1 : -1;
  }
  // Lacher : elle verse sur place (meme mecanique que le doigt leve), puis se replante.
  function releaseShovel() {
    if (!shovel.on || shovel.released) return;
    var R = bowlR();
    shovelPlant.x = shovel.cx + Math.sin(shovel.tilt) * R;
    shovel.gx = shovelPlant.x; shovel.gy = shovel.cy + Math.cos(shovel.tilt) * R;
    shovel.held = false; shovel.released = true;
    shovel.pouring = true; shovel.hideWhenEmpty = true;
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
    var newBottomX = bottomX + dx, newBottomY = bottomY + dy;
    // Resistance de la couche compacte : y mordre (contrairement a la terre meuble, qui
    // se traverse librement) est lent. On regarde de combien la lame proposee y
    // penetrerait ; au-dela d'une tolerance (DIG_BITE), le fond de la pelle n'avance plus
    // que de DIG_SPEED par frame vers sa cible. Ressortir/remonter n'est jamais ralenti
    // (penetration <= 0 une fois le compact deja entame par cutCompact).
    var Rc = R + BOWL_T;
    var propCx = newBottomX - Math.sin(shovel.tilt) * R, propCy = newBottomY - Math.cos(shovel.tilt) * R;
    var c0 = Math.max(0, Math.floor((propCx - Rc) / COL_W)), c1 = Math.min(heights.length - 1, Math.ceil((propCx + Rc) / COL_W));
    var penetration = 0;
    for (var c = c0; c <= c1; c++) {
      var bo = bladeOuterY(c * COL_W, propCx, propCy, shovel.tilt, Rc);
      if (bo) penetration = Math.max(penetration, bo.y - compactY[c]);
    }
    if (penetration > DIG_BITE) {
      var moveLen = Math.hypot(dx, dy);
      if (moveLen > DIG_SPEED) {
        var k = DIG_SPEED / moveLen;
        newBottomX = bottomX + dx * k;
        newBottomY = bottomY + dy * k;
      }
      // Descendre a la verticale est encore plus dur que racler de cote.
      if (newBottomY - bottomY > DIG_SPEED_DOWN) newBottomY = bottomY + DIG_SPEED_DOWN;
    }
    newBottomY = Math.min(newBottomY, worldH - BEDROCK_MARGIN);
    shovel.cx = newBottomX - Math.sin(shovel.tilt) * R;
    shovel.cy = newBottomY - Math.cos(shovel.tilt) * R;
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
    var R = bowlR(), field = U * BLADE_FIELD;
    var rx = s.x - shovel.cx, ry = s.y - shovel.cy, d = Math.hypot(rx, ry);
    if (d > R + 1 || d < R - field) return;
    if (Math.abs(angleDiff(Math.atan2(ry, rx), Math.PI / 2 - shovel.tilt)) > BOWL_SPAN) return;
    var k = 1 - (R - d) / field;          // 1 sur la lame, 0 en haut de la zone
    var w = shovel.tilt - shovel.ptilt;
    // Plafonne comme dans collideBowl : un saut brusque de la pelle d'une frame a l'autre
    // (ex. la resistance du compact qui la freine tout a coup) ne doit pas projeter la
    // terre a des vitesses absurdes.
    var wx = clamp(shovel.cx - shovel.pcx + w * ry, -16, 16), wy = clamp(shovel.cy - shovel.pcy - w * rx, -16, 16);
    s.vx += (wx - s.vx) * BLADE_PULL * k;
    s.vy += (wy - s.vy) * BLADE_PULL * k;
    // Attraction vers la lame (vers l'exterieur du cercle, donc vers l'arc).
    s.vx += rx / d * BLADE_ATTRACT * k;
    s.vy += ry / d * BLADE_ATTRACT * k;
  }

  var DECOMPACT_BULK = 1.2;               // la terre qui sort du compact "foisonne" (comme LOGO_BULK)
  var compactDebt = 0;                    // aire de terre meuble encore due suite a une decompaction, reportee entre frames

  // Decompacte la couche compacte la ou la lame mord dedans : chaque colonne entamee voit
  // son compactY descendre, et de la terre meuble en sort en proportion (avec
  // foisonnement) — pas forcement une facette par colonne par frame, une dette s'accumule
  // et se resorbe au fil des frames suivantes (conservation en moyenne, pas facette par
  // facette). Retourne les colonnes entamees cette frame (ou null), pour que
  // bowlWakePile sache reveiller ce qui devient suspendu au-dessus.
  function cutCompact() {
    var R = bowlR() + BOWL_T, cut = null;
    var c0 = Math.max(0, Math.floor((shovel.cx - R) / COL_W)), c1 = Math.min(compactY.length - 1, Math.ceil((shovel.cx + R) / COL_W));
    for (var c = c0; c <= c1; c++) {
      if (rocky[c] || demoGuard(c * COL_W)) continue; // roche-mere : la pelle ne l'entame jamais, buree ou non
      var bo = bladeOuterY(c * COL_W, shovel.cx, shovel.cy, shovel.tilt, R);
      if (!bo || bo.y <= compactY[c]) continue;
      var newTop = Math.min(bo.y, worldH - BEDROCK_MARGIN);
      var removed = newTop - compactY[c];
      if (removed <= 0) continue;
      compactY[c] = newTop;
      compactDebt += removed * COL_W * DECOMPACT_BULK;
      if (!cut) cut = {};
      cut[c] = bo.a;
      // De l'humus lessive jusque-la par la pluie (voir leach()) redevient accessible :
      // la pelle le rend a la surface, porte par une facette meuble neuve.
      for (var ni = compactNutri.length - 1; ni >= 0; ni--) {
        var dep = compactNutri[ni];
        if (Math.round(dep.x / COL_W) !== c || dep.y >= newTop) continue;
        compactNutri.splice(ni, 1);
        spawnDecompactShard(bo.a, dep.color);
      }
    }
    if (!cut) return null;
    var cols = Object.keys(cut), guard = 0;
    while (compactDebt > 0 && guard++ < 40) {
      var col = cols[(Math.random() * cols.length) | 0];
      compactDebt -= spawnDecompactShard(cut[col]);
    }
    return cut;
  }

  // Une facette de terre meuble qui sort de la couche compacte, a l'angle a (sur le
  // cercle de la lame) : apparait juste au-dessus de la lame, a l'interieur du bol,
  // emportee par le mouvement de la pelle. Retourne son aire (pour la dette de cutCompact).
  function spawnDecompactShard(a, nutri) {
    var r = bowlR() - 3 - Math.random() * loadDepth() * 0.6;
    return makeDecompactShard(shovel.cx + Math.cos(a) * r, shovel.cy + Math.sin(a) * r,
      shovel.cx - shovel.pcx, shovel.cy - shovel.pcy, nutri, 1);
  }

  // Coeur commun (pelle et poing, voir fistStrike) : une facette de terre meuble neuve en
  // (x,y) a la vitesse (vx,vy), taille multipliee par sizeK. Retourne son aire.
  function makeDecompactShard(x, y, vx, vy, nutri, sizeK) {
    var size = Math.max(6, UW / 160) * 1.3 * sizeK;
    var pts = [[-size * 0.55, size * 0.32], [size * 0.55, size * 0.32], [(Math.random() - 0.5) * size * 0.3, -size * 0.55]];
    // Assombrie selon la profondeur sous le niveau d'origine, comme addSoilShard : la
    // terre qui sort du compact reste de la terre normale, pas la terre sombre d'avant.
    var depth = Math.min(1, Math.max(0, y - groundY) / Math.max(1, worldH - groundY));
    var k = (Math.random() - 0.5) * 0.2 - depth * 0.3;
    var color = nutri ? hexToRgb(nutri) : shade(hexToRgb(EARTH[(Math.random() * EARTH.length) | 0]), k);
    var area = triArea(pts);
    var s = {
      pts: pts, ox: x, oy: y, x: x, y: y,
      vx: vx, vy: vy, rot: 0, vr: (Math.random() - 0.5) * 0.3,
      from: color, to: color, mix: 1, area: area,
      settled: false, col: -1, extra: true
    };
    // Un depot lessive redecouvert par la pelle : la facette qui le porte redevient de
    // l'humus (voir cutCompact) plutot que de la simple terre. Il a deja fait tout le
    // trajet vers le bas (voir MIN_LEACH_TO_EAT) : mur d'emblee, la pelle ne le "rajeunit" pas.
    // Deja fait tout le trajet de lessivage avant d'etre enfoui : pas de nouveau delai de
    // retenue mycelium, sinon la pelle pourrait re-suspendre indefiniment son lessivage.
    if (nutri) { s.nutri = nutri; s.leachCount = MIN_LEACH_TO_EAT; s.nutriSince = vTime - MYC_HOLD_MAX_MS; }
    s.px = s.x; s.py = s.y;
    shards.push(s);
    return area;
  }

  // Reveille les facettes posees restees suspendues au-dessus du sol dans les colonnes
  // dirtyCols (et leurs voisines) : elles retombent. Partage par la pelle et le poing.
  function wakeSuspended(dirtyCols) {
    for (var j = 0; j < shards.length; j++) {
      var sj = shards[j];
      if (!sj.settled) continue;
      var sjCol = Math.round(sj.x / COL_W);
      if (!(dirtyCols[sjCol] || dirtyCols[sjCol - 1] || dirtyCols[sjCol + 1])) continue;
      if (sj.y < surfaceAt(sj.x) - 6) { pileRemove(sj); sj.settled = false; }
    }
  }

  // Reveille les facettes posees que la lame touche, pour que la collision les prenne
  // en charge : la couche juste au-dessus de la lame (ce qu'elle ramasse) plus la lame
  // elle-meme. Autour, une facette restee "suspendue" au-dessus du sol (on a retire la
  // terre dessous, ou decompacte le compact sous elle) retombe : le trou se referme comme
  // du vrai sol. cutCols (colonnes decompactees cette frame par cutCompact, ou null) est
  // fusionne dans le meme scan de reveil.
  function bowlWakePile(cutCols) {
    // Remuer de la terre colonisee ne produit plus de nutriment ici : la terre en elle-
    // meme n'a pas de valeur nutritive, seul le bois decompose (ou le mycelium qui meurt
    // de faim) en donne — voir stepTrees/stepMycelium.
    var R = bowlR(), woke = [], dirtyCols = null;
    for (var i = 0; i < shards.length; i++) {
      var s = shards[i];
      if (!s.settled) continue;
      var dx = s.x - shovel.cx, dy = s.y - shovel.cy;
      var adx = Math.abs(dx);
      // La detection "suspendue" porte plus loin que la prise en main normale (2.5x) :
      // un trou creuse en profondeur laisse plus facilement des bords en surplomb qu'un
      // simple creusage de surface, et on veut les rattraper meme si le curseur n'est
      // plus exactement dessus, sans pour autant scanner tout le monde (voir le retour en
      // arriere plus haut sur le scan global).
      var touching = false;
      if (adx <= R * Math.sin(BOWL_SPAN) * 2.5) {
        var d = Math.hypot(dx, dy);
        var inBowl = d > R - loadDepth() * 1.2 && d < R + BOWL_T + 2 &&
          Math.abs(angleDiff(Math.atan2(dy, dx), Math.PI / 2 - shovel.tilt)) <= BOWL_SPAN;
        touching = inBowl;
      }
      if (!touching && adx <= R * Math.sin(BOWL_SPAN) * 6 && s.y < surfaceAt(s.x) - 6) touching = true;
      if (!touching || demoGuard(s.x)) continue;
      // Toute matiere enlevee peut laisser quelque chose en suspens juste au-dessus, y
      // compris le maillage statique d'origine (setupSoil) qui ne bouge jamais tout seul —
      // meme quand le joueur a deja quitte l'endroit avec la pelle. On note juste la
      // colonne ici (pas cher) ; le scan qui rattrape les facettes en suspens se fait UNE
      // SEULE FOIS apres la boucle (pas a chaque facette enlevee, sinon un seul passage de
      // pelle sur de la terre meuble coutait un scan complet par facette — beaucoup trop).
      if (s.col >= 0) { if (!dirtyCols) dirtyCols = {}; dirtyCols[s.col] = true; }
      pileRemove(s);
      s.settled = false;
      s.vx = s.vy = 0;
      s.px = s.x; s.py = s.y;
      woke.push(s);
    }
    if (cutCols) {
      if (!dirtyCols) dirtyCols = {};
      for (var cc in cutCols) dirtyCols[cc] = true;
    }
    if (dirtyCols) wakeSuspended(dirtyCols);
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
    if (window.sporaSfx) sporaSfx.play('pop'); 
    m.dying = true; m.t = 0;
    var base = surfaceAt(m.x) + 6;
    for (var i = 0; i < 9; i++) {
      var r = m.size * (0.08 + Math.random() * 0.08), a = Math.random() * Math.PI * 2;
      var pts = [0, 1, 2].map(function (j) {
        var t = a + j * 2.1 + (Math.random() - 0.5) * 0.5;
        return [Math.cos(t) * r, Math.sin(t) * r];
      });
      var color = hexToRgb(EARTH[(Math.random() * EARTH.length) | 0]);
      shards.push({
        pts: pts, x: m.x + (Math.random() - 0.5) * m.size * 0.8, y: base - Math.random() * m.size * 0.9,
        vx: (Math.random() - 0.5) * 4, vy: -2 - Math.random() * 3, rot: 0, vr: (Math.random() - 0.5) * 0.4,
        from: color, to: color, mix: 1,
        area: triArea(pts), settled: false, col: -1, extra: true
      });
    }
  }

  // Dessin unique de la pelle (tenue et plantee), le modele valide : petite lame en coque
  // facettee, douille grise, manche en bois, poignee en T. Trace dans un repere de reference
  // (lame ~58 unites de long, pointe a gauche, manche vers +x) puis pose : (ax, ay) est ou
  // tombe le point (ox, oy) du modele, dir la direction du manche. Le clip eventuel (pelle
  // plantee) est pose par l appelant.
  var SHOVEL_TIP = [124, 168], SHOVEL_BOTTOM = [160, 175.8]; // pointe de la lame, fond de la coque
  function drawShovelShape(ax, ay, dir, ox, oy) {
    var S = U * BLADE_WIDTH / 58, flip = Math.cos(dir) < 0;
    ctx.save();
    ctx.translate(ax, ay);
    if (flip) ctx.scale(-1, 1);
    ctx.rotate(flip ? Math.PI - dir : dir);
    ctx.scale(S, S);
    ctx.translate(-ox, -oy);
    var xe = 262; // fin du manche : plus court que le modele, pour rester proportionne a la lame
    function y(v) { return 169 + (v - 169) * 0.7; } // manche un peu plus mince que le modele
    // Manche et poignee en T.
    ctx.fillStyle = "#b98352"; poly([[215, y(166)], [xe, y(160)], [xe, y(166)], [215, y(172)]]);
    ctx.fillStyle = "#8a5a30"; poly([[215, y(172)], [xe, y(166)], [xe, y(171)], [215, y(177)]]);
    ctx.fillStyle = "#7a4d28"; poly([[xe, y(148)], [xe + 12, y(148)], [xe + 12, y(166)], [xe, y(166)]]);
    ctx.fillStyle = "#5e3a1d"; poly([[xe, y(166)], [xe + 12, y(166)], [xe + 12, y(184)], [xe, y(184)]]);
    // Douille metal.
    ctx.fillStyle = "#6b7378"; poly([[182, 166.9], [216, 166.9], [216, 171.2], [182, 171.6]]);
    ctx.fillStyle = "#4c5256"; poly([[182, 171.6], [216, 171.2], [216, 175.4], [182, 176.4]]);
    // Lame : dessous fonce puis facettes claires du dessus. Aplatie pour que son
    // epaisseur soit proche de celle de la douille (y 166.9 a ~176), sans marche a la jonction.
    ctx.translate(0, 166.9); ctx.scale(1, 0.35); ctx.translate(0, -163);
    ctx.fillStyle = "#7d858a"; poly([[138, 180], [152, 186], [168, 189], [182, 186]]);
    ctx.fillStyle = "#5f676c"; poly([[152, 186], [168, 189], [168, 193], [152, 190]]);
    ctx.fillStyle = "#7d858a"; poly([[168, 189], [182, 186], [182, 190], [168, 193]]);
    ctx.fillStyle = "#a9b1b5"; poly([[124, 166], [138, 180], [152, 186], [140, 172]]);
    ctx.fillStyle = "#c9cfd2"; poly([[140, 172], [152, 186], [168, 189], [160, 176]]);
    ctx.fillStyle = "#bcc3c7"; poly([[160, 176], [168, 189], [182, 186], [178, 175]]);
    ctx.fillStyle = "#d6dcde"; poly([[178, 175], [182, 186], [182, 178], [182, 163]]);
    ctx.fillStyle = "#8f979b"; poly([[124, 166], [140, 172], [138, 180]]);
    ctx.fillStyle = "#d8dee0"; poly([[124, 166], [140, 172], [160, 176], [178, 175], [182, 163], [160, 166], [140, 164]]);
    ctx.fillStyle = "#e4e9ea"; poly([[124, 166], [140, 164], [140, 172]]);
    ctx.restore();
  }

  // Pelle plantee : meme dessin, lame vers le bas (rognee a la surface), manche qui depasse.
  function drawPlantedShovel() {
    if (mode !== "exploded") return;
    var f = plantFrame(), tip = plantPt(f, -f.bw * 0.5, 0); // pointe a moitie enterree
    ctx.save();
    ctx.beginPath();
    ctx.rect(f.x - f.bw * 3, f.sy - U * 2, f.bw * 6, U * 2);   // tout ce qui est sous la surface est cache
    ctx.clip();
    drawShovelShape(tip[0], tip[1], Math.atan2(f.uy, f.ux), SHOVEL_TIP[0], SHOVEL_TIP[1]);
    ctx.restore();
  }

  function drawShovel() {
    if (!shovel.on) { drawPlantedShovel(); return; }
    var R = bowlR();
    var a0 = Math.PI / 2 - shovel.tilt - BOWL_SPAN, a1 = Math.PI / 2 - shovel.tilt + BOWL_SPAN;
    // back = extremite cote manche (a l'oppose du sens du geste), front = tranchant.
    var back = shovel.face > 0 ? a1 : a0, front = shovel.face > 0 ? a0 : a1;
    // Manche : prolonge la courbe de la lame vers l'arriere, releve d'environ 20 deg.
    var dir = Math.atan2(shovel.face * Math.cos(back), shovel.face * -Math.sin(back)) + shovel.face * 0.35;
    drawShovelShape(shovel.cx + Math.sin(shovel.tilt) * R, shovel.cy + Math.cos(shovel.tilt) * R, dir, SHOVEL_BOTTOM[0], SHOVEL_BOTTOM[1]);

    // Petit repere au curseur quand la pelle ne le suit plus (freinee par le compact) :
    // on voit ou on voulait aller.
    var bx = shovel.cx + Math.sin(shovel.tilt) * R, by = shovel.cy + Math.cos(shovel.tilt) * R;
    if (!shovel.pouring && Math.hypot(shovel.gx - bx, shovel.gy - by) > 10) {
      ctx.beginPath();
      ctx.arc(shovel.gx, shovel.gy, 6, 0, Math.PI * 2);
      ctx.moveTo(shovel.gx - 10, shovel.gy); ctx.lineTo(shovel.gx - 3, shovel.gy);
      ctx.moveTo(shovel.gx + 3, shovel.gy); ctx.lineTo(shovel.gx + 10, shovel.gy);
      ctx.moveTo(shovel.gx, shovel.gy - 10); ctx.lineTo(shovel.gx, shovel.gy - 3);
      ctx.moveTo(shovel.gx, shovel.gy + 3); ctx.lineTo(shovel.gx, shovel.gy + 10);
      // Contour fonce + trait clair : lisible sur la terre comme sur le fond clair.
      ctx.strokeStyle = 'rgba(40,25,15,0.8)'; ctx.lineWidth = 4; ctx.stroke();
      ctx.strokeStyle = '#fff7e8'; ctx.lineWidth = 2; ctx.stroke();
    }
  }

  // Clic/tap sans glisser : deterrer un tresor, rouvrir son infobulle, ou faire pousser.
  function handleTap(pos) {
    var t = treasureNear(pos.x, pos.y);
    if (t) {
      if (t.revealed) {
        openTip(t, true);
      } else {
        digAt(t);
        tryDig(t, 1);
      }
      return;
    }
    openTip(null);
    if (pos.y > surfaceAt(pos.x) - 40) { if (window.sporaSfx) sporaSfx.play('plant'); sprout(pos.x); }
  }

  // Outil main : vend un champignon mur issu du mycelium (pas les tresors, qui gardent
  // leur infobulle produit, ni les champignons plantes a la main sans valeur marchande).
  function harvestableNear(x, y) {
    // Au doigt : a defaut d'etre pile dessus, le champignon mur le plus proche dans l'anneau.
    var reach = hand.touch ? HAND_RING_R / ZOOM : 0, best = null, bestD = reach;
    for (var i = 0; i < mushrooms.length; i++) {
      var m = mushrooms[i];
      if (!m.myc || m.treasure || m.dying || m.t < 0.9) continue;
      if (Math.abs(x - m.x) < m.size * 0.9 && y > surfaceAt(m.x) - m.size * 1.6) return m;
      if (reach) {
        var d = Math.hypot(x - m.x, y - (surfaceAt(m.x) - m.size * 0.8));
        if (d < bestD) { bestD = d; best = m; }
      }
    }
    return best;
  }
  function harvestAt(pos) {
    var m = harvestableNear(pos.x, pos.y);
    if (!m) return;
    m.dying = true;
    hand.flash = performance.now();
    guideSet('harvest');
    queueDemoEnd(); // la premiere recolte termine la demo
    harvestCount++;
    var hs = m.strain && m.strain.id ? m.strain.id : 'standard', hi = CH_HARVEST_IDS.indexOf(hs);
    if (hi !== -1 && !(chDone & (256 << hi)) && chUnlocked(8 + hi)) {
      chHarv[hi]++;
      if (chHarv[hi] >= CH_HARVEST_GOAL) challengeDone(8 + hi);
      else savePlayerIfChanged();
    }
    if (window.sporaSfx) sporaSfx.play('pop'); 
    earn(m.myc && m.strain && m.strain.price ? m.strain.price : MUSHROOM_PRICE);
  }

  // Ramasser/deposer a la main : contrairement a la pelle (qui entame la couche compacte
  // par pelletees), la main ne prend que ce qui traine deja en terre meuble, et tres peu a
  // la fois (HAND_GRAB_MAX facettes dans un rayon HAND_PICK_R) — un geste precis plutot
  // qu'un outil de terrassement. Tant qu'elles sont tenues, ces facettes suivent le curseur
  // (voir le bloc s.carried dans step()) au lieu d'obeir a la gravite ; les relacher
  // (endPress) les laisse simplement retomber et se poser normalement, comme n'importe
  // quelle facette deja delogee par la pelle (meme mecanique que bowlWakePile/pileAdd).
  var HAND_PICK_R = 24;                   // rayon de ramassage (px) : assez precis pour viser un point du tas
  var HAND_GRAB_MAX = 14;                 // une "poignee" : quelques facettes au plus, jamais une pelletee
  // Main dessinee (drawHand) : suit le curseur, ouverte en survol, poing ferme quand le
  // bouton est enfonce ou qu'elle tient quelque chose. hand.fist va de 0 (ouverte) a 1
  // (poing), hand.tilt s'incline dans le sens du geste, hand.lx sert a mesurer ce geste.
  // hand.grip = branche agrippee (voir handGrabTree), null sinon.
  var HAND_LEAF_MARGIN = 6;               // marge (px) autour d'une feuille pour l'arracher
  var HAND_LIMB_TOL = 12;                 // distance max (px) du curseur a un segment de branche pour l'agripper
  var HAND_BREAK_DIST = 40;               // ecart (px) au point de prise au-dela duquel la branche casse
  var LIMB_REGROW_MS = 120000;            // une branche maitresse cassee reapparait apres ce delai (temps de jeu, vTime)
  var hand = { x: 0, y: 0, on: false, fist: 0, tilt: 0, rot: 0, lx: 0, grip: null, px: 0, py: 0, pcx: 0, pcy: 0, touch: false, flash: 0 };
  var handCarry = [];
  // Effleurement : la main qui BOUGE pousse un peu ce qu'elle frole, comme la pelle mais
  // tres doucement (voir handPush). Vitesse en px/frame, mesuree en repere monde moins le
  // defilement de la camera (une souris immobile pendant que le monde glisse ne pousse rien).
  var HAND_PUSH_R = 32;                   // rayon d'effet (px) autour de la paume, un peu > HAND_PICK_R
  var HAND_PUSH_MIN_V = 1.2;              // en dessous, le survol ne fait rien (un geste calme de souris fait ~3-10 px/frame)
  var HAND_PUSH_MAX_V = 14;               // vitesse de main retenue au plus (borne l'impulsion)
  var HAND_PUSH_LEAF = 0.4;               // part de la vitesse de la main transmise a une feuille en l'air (la chute amortit vite : 0.94-0.95/frame)
  var HAND_PUSH_LOOSE = 0.12;             // idem pour une facette posee delogee (beaucoup moins)
  var HAND_PUSH_P = 0.08;                 // chance par facette posee et par frame d'etre delogee
  var HAND_PUSH_MAX_LOOSE = 2;            // facettes posees delogees au plus par frame
  var HAND_PUSH_DEPTH = 8;                // seule la peau du tas (px sous la surface) peut bouger
  // Poing : main fermee (bouton enfonce, rien de tenu ni d'agrippe) qui BOUGE = elle brise
  // la terre sur son passage (voir fistStrike). Un "coup" tous les HAND_FIST_STEP px
  // parcourus ; chaque coup entame un peu le compact sous le poing et deloge de petits
  // blocs projetes dans le sens du geste. Il faut repasser pour creuser profond.
  var HAND_FIST_R = 26;                   // rayon du poing (px, monde)
  // Au doigt, le poing est cache dessous : un anneau depasse autour du doigt et sert de portee
  // de cueillette (tout champignon mur dedans est cueilli), il clignote dore quand on attrape.
  var HAND_RING_R = 38;                   // rayon de l'anneau (px CSS, donc / ZOOM en monde)
  var HAND_FLASH_MS = 300;                // duree de l'eclat dore
  var HAND_ZOOM_K = 1.45;                 // poing grossi quand le jeu est dezoome, sinon minuscule sous le doigt
  var HAND_FIST_MIN_V = 1;              // vitesse minimale (px/frame) pour compter comme geste
  var HAND_FIST_MAX_V = 14;               // vitesse retenue au plus pour la projection
  var HAND_FIST_STEP = 14;               // distance parcourue (px) entre deux coups
  var HAND_FIST_MAX_STRIKES = 4;          // coups au plus par frame (borne le cout d'un geste tres rapide)
  var HAND_FIST_DEPTH = 1.5;             // compactY descend au plus de ca (px) par colonne et par coup
  var HAND_FIST_SHARDS = 4;              // petits blocs neufs au plus par coup (sortis du compact)
  var HAND_FIST_LOOSE = 3;                // facettes posees delogees au plus par coup
  var HAND_FIST_SIZE = 0.9;               // taille d'un bloc, en fraction d'un bloc de pelle
  var HAND_FIST_MAX_UP = 4.5;             // vitesse verticale max vers le haut des blocs (evite la fontaine)
  var HAND_FIST_KICK = 0.6;              // part de la vitesse du poing transmise aux blocs
  var HAND_FIST_SPREAD = 3.4;            // dispersion aleatoire de la vitesse (px/frame)
  var HAND_FIST_LIFT = 2.2;              // impulsion vers le haut des blocs (px/frame)
  var fistDist = 0;                      // distance parcourue par le poing depuis le dernier coup

  function enterHand(p) {
    hand.on = true;
    hand.x = hand.lx = hand.px = p.x; hand.y = hand.py = p.y;
    hand.pcx = camX; hand.pcy = camY;
    hand.fist = 0; hand.tilt = 0; hand.rot = 0;
    container.classList.add('is-tool-cursor');
  }
  // Ne laisse jamais rien de tenu ni d'agrippe derriere : les facettes tenues retombent,
  // la branche agrippee revient droite (elle n'a pas casse).
  function leaveHand() {
    dropHeldInsect();
    for (var i = 0; i < handCarry.length; i++) handCarry[i].carried = false;
    handCarry = [];
    hand.grip = null;
    hand.on = false; hand.fist = 0; hand.tilt = 0; hand.rot = 0;
    container.classList.remove('is-tool-cursor');
  }

  // Distance d'un point (px,py) au segment a-b.
  function distToSeg(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    var u = l2 > 0 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
    return Math.hypot(px - (ax + dx * u), py - (ay + dy * u));
  }

  // Triangle allonge (style branche) de demi-longueur len oriente selon ang, centre sur
  // l'origine de la facette : base large d'un cote, pointe de l'autre.
  function branchTri(len, ang) {
    var c = Math.cos(ang), sn = Math.sin(ang), w = Math.max(2, len * 0.14);
    return [[-len * c - sn * w, -len * sn + c * w], [len * c, len * sn], [-len * c + sn * w, -len * sn - c * w]];
  }

  function leafAgeOf(lf, now) { return clamp((now - lf.born) / lf.life, 0, 1); }

  // Tente d'agripper quelque chose sur un arbre, dans l'ordre : feuille (arrachee, tenue
  // dans la main), puis branche (maitresse ou bonus : agrippee, elle casse si on tire assez,
  // voir updateHand). Retourne vrai si la main a pris quelque chose.
  function handGrabTree(pos) {
    var now = vTime, ti, i, t, tg, by, top, sl, lf;
    var bestLeaf = null, bestLeafT = null, bestLeafD = Infinity;
    for (ti = 0; ti < trees.length; ti++) {
      t = trees[ti]; tg = treeScale(t);
      by = t.by !== undefined ? t.by : surfaceAt(t.x) + TREE_EMBED; top = by - t.h * tg;
      for (i = 0; i < t.slots.length; i++) {
        sl = t.slots[i]; lf = sl.leaf;
        if (!lf || now < lf.born) continue;
        var d = Math.hypot(pos.x - (t.x + sl.dx * tg), pos.y - (top + sl.dy * tg));
        if (d <= lf.size * (lf.dg !== undefined ? lf.dg : 1) + HAND_LEAF_MARGIN && d < bestLeafD) {
          bestLeaf = sl; bestLeafT = t; bestLeafD = d;
        }
      }
    }
    if (bestLeaf) {
      t = bestLeafT; tg = treeScale(t); lf = bestLeaf.leaf;
      by = t.by !== undefined ? t.by : surfaceAt(t.x) + TREE_EMBED;
      var sh = makeLeafShard(lf, t.x + bestLeaf.dx * tg, by - t.h * tg + bestLeaf.dy * tg, leafAgeOf(lf, now));
      bestLeaf.leaf = null; // la place redevient libre, l'arbre en repoussera une autre
      sh.carried = true;
      sh.vx = sh.vy = 0;
      sh.hox = sh.x - pos.x; sh.hoy = sh.y - pos.y;
      shards.push(sh);
      handCarry.push(sh);
      return true;
    }
    // Branches : segments coudes des branches maitresses (pas les cassees) et branches
    // bonus (du tronc vers leur bout). Le tronc lui-meme n'est pas attrapable.
    var bestObj = null, bestKind = '', bestTree = null, bestD = HAND_LIMB_TOL;
    for (ti = 0; ti < trees.length; ti++) {
      t = trees[ti]; tg = treeScale(t);
      by = t.by !== undefined ? t.by : surfaceAt(t.x) + TREE_EMBED; top = by - t.h * tg;
      for (i = 0; i < t.limbs.length; i++) {
        var lm = t.limbs[i];
        if (lm.broken !== undefined) continue;
        var sx = t.x, sy = top + t.h * tg * lm.f, ex = t.x + lm.dx * tg, ey = top + lm.dy * tg;
        var mx = (sx + ex) / 2 - (ey - sy) * lm.bend, my = (sy + ey) / 2 + (ex - sx) * lm.bend;
        var dl = Math.min(distToSeg(pos.x, pos.y, sx, sy, mx, my), distToSeg(pos.x, pos.y, mx, my, ex, ey));
        if (dl < bestD) { bestD = dl; bestObj = lm; bestKind = 'limb'; bestTree = t; }
      }
      for (i = 0; i < t.slots.length; i++) {
        sl = t.slots[i];
        if (!sl.branch) continue;
        var bg = Math.min(1, (now - sl.branchSince) / BRANCH_GROW_MS);
        var db = distToSeg(pos.x, pos.y, t.x, top + t.h * tg * 0.12, t.x + sl.dx * tg * bg, top + sl.dy * tg * bg);
        if (db < bestD) { bestD = db; bestObj = sl; bestKind = 'bonus'; bestTree = t; }
      }
    }
    if (!bestObj) return false;
    hand.grip = { t: bestTree, obj: bestObj, kind: bestKind, gx: pos.x, gy: pos.y };
    return true;
  }

  // Branche maitresse arrachee : marquee cassee (drawTree ne la dessine plus, ses places de
  // feuilles ne recoivent plus rien jusqu'a LIMB_REGROW_MS), ses feuilles tombent, et le
  // bois devient une facette allongee que la main tient. Retourne cette facette.
  function breakLimb(t, lm, now) {
    var k = t.limbs.indexOf(lm), tg = treeScale(t);
    var by = t.by !== undefined ? t.by : surfaceAt(t.x) + TREE_EMBED, top = by - t.h * tg;
    lm.broken = now;
    for (var i = 0; i < t.slots.length; i++) {
      var sl = t.slots[i];
      if (sl.limb !== k || !sl.leaf) continue;
      shards.push(makeLeafShard(sl.leaf, t.x + sl.dx * tg, top + sl.dy * tg, leafAgeOf(sl.leaf, now)));
      sl.leaf = null;
    }
    var sx = t.x, sy = top + t.h * tg * lm.f, ex = t.x + lm.dx * tg, ey = top + lm.dy * tg;
    var wood = makeWoodShard(hand.x, hand.y, branchTri(Math.hypot(ex - sx, ey - sy) * 0.5, Math.atan2(ey - sy, ex - sx)));
    shards.push(wood);
    return wood;
  }

  // Branche bonus arrachee : meme sortie que sa chute naturelle (shedBranchSlot, voir
  // stepTrees), mais le bois est renvoye pour etre tenu.
  function breakBonusBranch(t, sl, now) {
    var tg = treeScale(t);
    var by = t.by !== undefined ? t.by : surfaceAt(t.x) + TREE_EMBED, top = by - t.h * tg;
    var bg = Math.min(1, (now - sl.branchSince) / BRANCH_GROW_MS);
    var ex = t.x + sl.dx * tg * bg, ey = top + sl.dy * tg * bg, sy = top + t.h * tg * 0.12;
    var wood = shedBranchSlot(t, sl, now, branchTri(Math.hypot(ex - t.x, ey - sy) * 0.5, Math.atan2(ey - sy, ex - t.x)), true);
    var idx = t.slots.indexOf(sl);
    if (idx >= 0) t.slots.splice(idx, 1);
    return wood;
  }

  function breakGrip(now) {
    var g = hand.grip;
    hand.grip = null;
    if (!g) return;
    var wood = g.kind === 'limb' ? breakLimb(g.t, g.obj, now) : breakBonusBranch(g.t, g.obj, now);
    wood.x = wood.px = hand.x; wood.y = wood.py = hand.y;
    wood.vx = wood.vy = wood.vr = 0;
    wood.carried = true; wood.hox = 0; wood.hoy = 0;
    handCarry.push(wood);
    branchTorn = true;
    if (chUnlocked(0)) challengeDone(0);
  }

  // Appelee par step() tant que la main est affichee : casse la branche agrippee quand on
  // tire trop loin, anime le poing et l'inclinaison. Retourne vrai si une animation continue.
  function updateHand(now) {
    var busy = false, g = hand.grip;
    if (g) {
      if (g.kind === 'bonus' && g.t.slots.indexOf(g.obj) < 0) hand.grip = null; // sa place a disparu entre-temps
      else if (Math.hypot(hand.x - g.gx, hand.y - g.gy) > HAND_BREAK_DIST) breakGrip(now);
      else busy = true;
    }
    var goal = ((pointerDown && tool === 'hand') || handCarry.length || hand.grip) ? 1 : 0;
    hand.fist += (goal - hand.fist) * 0.35;
    if (Math.abs(goal - hand.fist) < 0.02) hand.fist = goal; else busy = true;
    var tiltGoal = clamp((hand.x - hand.lx) * 0.05, -0.4, 0.4);
    hand.lx = hand.x;
    hand.tilt += (tiltGoal - hand.tilt) * 0.2;
    if (Math.abs(tiltGoal - hand.tilt) > 0.005 || Math.abs(hand.tilt) > 0.01) busy = true;
    // Vitesse reelle du geste (monde, camera deduite), puis effleurement des facettes.
    var hvx = hand.x - hand.px - (camX - hand.pcx), hvy = hand.y - hand.py - (camY - hand.pcy);
    hand.px = hand.x; hand.py = hand.y; hand.pcx = camX; hand.pcy = camY;
    var sp2 = hvx * hvx + hvy * hvy;
    // Poing ferme : la main pivote dans toutes les directions, doigts vers ou elle va (avec un
    // peu de retard, comme une traine). Ouverte ou immobile, elle garde l'inclinaison douce.
    var rotGoal = hand.rot;
    if (hand.fist < 0.6) rotGoal = hand.tilt;
    else if (sp2 > 4) rotGoal = Math.atan2(hvy, hvx) + Math.PI / 2;
    var dRot = rotGoal - hand.rot;
    dRot -= Math.round(dRot / (2 * Math.PI)) * 2 * Math.PI;
    hand.rot += dRot * 0.18;
    if (Math.abs(dRot) > 0.01) busy = true;
    if (mode === 'exploded' && pointerDown && sp2 >= HAND_PUSH_MIN_V * HAND_PUSH_MIN_V) {
      handPush(hvx, hvy);
      busy = true;
    }
    // Poing : bouton enfonce et main en mouvement, meme avec quelque chose en main (les facettes
    // tenues sont ignorees par fistStrike).
    if (mode === 'exploded' && pointerDown && tool === 'hand') {
      if (sp2 >= HAND_FIST_MIN_V * HAND_FIST_MIN_V) {
        fistDist += Math.min(Math.sqrt(sp2), 30);
        for (var fs = 0; fistDist >= HAND_FIST_STEP && fs < HAND_FIST_MAX_STRIKES; fs++) {
          fistDist -= HAND_FIST_STEP;
          fistStrike(hvx, hvy);
        }
        if (fistDist > HAND_FIST_STEP) fistDist = HAND_FIST_STEP; // pas de rattrapage apres un geste tres rapide
        busy = true;
      }
    } else fistDist = 0;
    return busy;
  }

  // Un coup de poing en (hand.x, hand.y), geste (hvx,hvy) : (1) deloge quelques facettes
  // posees de terre meuble a portee, (2) entame le compact sous le poing (profil circulaire,
  // au plus HAND_FIST_DEPTH par colonne, jamais la roche-mere) et libere de petits blocs
  // via makeDecompactShard (meme mecanique et meme dette que la pelle, voir cutCompact),
  // (3) reveille ce qui devient suspendu et deterre un peu les tresors proches.
  function fistStrike(hvx, hvy) {
    var sp = Math.hypot(hvx, hvy);
    if (sp > HAND_FIST_MAX_V) { hvx *= HAND_FIST_MAX_V / sp; hvy *= HAND_FIST_MAX_V / sp; }
    var R = HAND_FIST_R, limit = worldH - BEDROCK_MARGIN, i, c;
    // (0) Feuilles encore accrochees aux arbres : le poing les fait sauter, elles tombent
    // (memes facettes que la chute naturelle, voir makeLeafShard) en emportant un peu du coup.
    var nowF = vTime, ti, tF, tgF, topF, slF;
    for (ti = 0; ti < trees.length; ti++) {
      tF = trees[ti]; tgF = treeScale(tF);
      topF = (tF.by !== undefined ? tF.by : surfaceAt(tF.x) + TREE_EMBED) - tF.h * tgF;
      for (i = 0; i < tF.slots.length; i++) {
        slF = tF.slots[i];
        if (!slF.leaf || nowF < slF.leaf.born) continue;
        var lxF = tF.x + slF.dx * tgF, lyF = topF + slF.dy * tgF;
        if (Math.abs(lxF - hand.x) > R + slF.leaf.size || Math.abs(lyF - hand.y) > R + slF.leaf.size) continue;
        if (Math.hypot(lxF - hand.x, lyF - hand.y) > R + slF.leaf.size) continue;
        var shF = makeLeafShard(slF.leaf, lxF, lyF, leafAgeOf(slF.leaf, nowF));
        shF.vx = hvx * HAND_FIST_KICK + (Math.random() - 0.5) * HAND_FIST_SPREAD;
        shF.vy = hvy * HAND_FIST_KICK - Math.random() * HAND_FIST_LIFT * 0.5;
        shF.vr = (Math.random() - 0.5) * 0.3;
        shards.push(shF);
        slF.leaf = null; // la place redevient libre, l'arbre en repoussera une autre
      }
    }
    // (1) Terre meuble posee a portee : delogee, projetee dans le sens du geste.
    var loose = 0, cut = null;
    for (i = 0; i < shards.length && loose < HAND_FIST_LOOSE; i++) {
      var s = shards[i];
      if (!s.settled || s.carried || s.dead || s.eaten !== undefined || s.grain) continue;
      if (s.myc || s.nutri || s.deadMyc || !s.kcol) continue; // mycelium : jamais (le maillage de terre, lui, se brise comme sous la pelle)
      var sdx = s.x - hand.x, sdy = s.y - hand.y;
      if (sdx > R || sdx < -R || sdy > R || sdy < -R || sdx * sdx + sdy * sdy > R * R || demoGuard(s.x)) continue;
      if (s.col >= 0) { if (!cut) cut = {}; cut[s.col] = true; } // ce qui reposait dessus doit retomber
      pileRemove(s);
      s.settled = false;
      s.vx = hvx * HAND_FIST_KICK + (Math.random() - 0.5) * HAND_FIST_SPREAD * 2;
      s.vy = Math.max(-HAND_FIST_MAX_UP, hvy * HAND_FIST_KICK - HAND_FIST_LIFT * (0.4 + Math.random() * 0.6));
      s.vr = (Math.random() - 0.5) * 0.4;
      s.px = s.x; s.py = s.y;
      loose++;
    }
    // (2) Compact sous le poing.
    var c0 = Math.max(0, Math.floor((hand.x - R) / COL_W)), c1 = Math.min(compactY.length - 1, Math.ceil((hand.x + R) / COL_W));
    var dug = false;
    for (c = c0; c <= c1; c++) {
      if (rocky[c] || demoGuard(c * COL_W)) continue; // roche-mere : le poing ne l'entame pas plus que la pelle
      var ddx = c * COL_W - hand.x;
      if (ddx > R || ddx < -R) continue;
      var bottom = hand.y + Math.sqrt(R * R - ddx * ddx);
      if (bottom <= compactY[c]) continue;
      var newTop = Math.min(bottom, compactY[c] + HAND_FIST_DEPTH, limit);
      var removed = newTop - compactY[c];
      if (removed <= 0) continue;
      compactY[c] = newTop;
      compactDebt += removed * COL_W * DECOMPACT_BULK;
      dug = true;
      if (!cut) cut = {};
      cut[c] = true;
      // Humus lessive redevenu accessible : rendu a la surface, comme la pelle.
      for (var ni = compactNutri.length - 1; ni >= 0; ni--) {
        var dep = compactNutri[ni];
        if (Math.round(dep.x / COL_W) !== c || dep.y >= newTop) continue;
        compactNutri.splice(ni, 1);
        makeDecompactShard(c * COL_W, surfaceAt(c * COL_W) - 3, hvx * HAND_FIST_KICK, -HAND_FIST_LIFT, dep.color, HAND_FIST_SIZE);
      }
    }
    if (cut && !dug) wakeSuspended(cut); // pas de compact entame : juste des facettes deloges
    if (dug) {
      var cols = Object.keys(cut), made = 0, guard = 0;
      while (compactDebt > 0 && made < HAND_FIST_SHARDS && guard++ < 10) {
        var col = +cols[(Math.random() * cols.length) | 0];
        compactDebt -= makeDecompactShard(
          hand.x + (Math.random() * 2 - 1) * R * 1.6, surfaceAt(hand.x) - 3 - Math.random() * 6,
          hvx * HAND_FIST_KICK + (Math.random() - 0.5) * HAND_FIST_SPREAD * 2,
          Math.max(-HAND_FIST_MAX_UP, hvy * HAND_FIST_KICK - HAND_FIST_LIFT * (0.4 + Math.random() * 0.6)),
          undefined, HAND_FIST_SIZE);
        made++;
      }
      if (compactDebt > 400) compactDebt = 400; // dette bornee : un poing ne rattrape pas une montagne
      wakeSuspended(cut);
      // Le poing brise aussi les champignons a portee (sauf les tresors, qui portent l'infobulle).
      for (i = 0; i < mushrooms.length; i++) {
        var mu = mushrooms[i];
        if (mu.treasure || mu.dying || mu.t < 0.5) continue;
        if (Math.abs(mu.x - hand.x) < R + mu.size * 0.4) breakMushroom(mu);
      }
      // (3) Un tresor enfoui juste sous le poing se deterre peu a peu.
      for (i = 0; i < treasures.length; i++) {
        var t = treasures[i];
        if (!t.revealed && Math.abs(t.x - hand.x) < R + 15) tryDig(t, 0.02);
      }
    }
  }

  // Effleurement par la main en mouvement (vitesse hvx,hvy). Feuilles en l'air : impulsion
  // dans le sens du geste, plus forte au centre de la zone. Facettes posees (terre meuble,
  // feuilles, bois) : a peine quelques-unes delogees, seulement si la main ne tient rien, et
  // sans jamais toucher a compactY ni au tas au-dela de la peau superieure.
  function handPush(hvx, hvy) {
    var sp = Math.hypot(hvx, hvy);
    if (sp > HAND_PUSH_MAX_V) { hvx *= HAND_PUSH_MAX_V / sp; hvy *= HAND_PUSH_MAX_V / sp; }
    // Bouton enfonce = poing (voir fistStrike) : l'effleurement ne deloge alors plus de terre posee.
    var busyHand = handCarry.length > 0 || hand.grip !== null || !!pointerDown, loose = 0;
    for (var i = 0; i < shards.length; i++) {
      var s = shards[i];
      if (s.carried || s.dead || s.eaten !== undefined || s.grain) continue;
      var dx = s.x - hand.x, dy = s.y - hand.y;
      if (dx > HAND_PUSH_R || dx < -HAND_PUSH_R || dy > HAND_PUSH_R || dy < -HAND_PUSH_R) continue;
      var d = Math.hypot(dx, dy);
      if (d > HAND_PUSH_R) continue;
      var k = 1 - d / HAND_PUSH_R;
      if (!s.settled) {
        if (!s.leaf) continue;            // seules les feuilles/le bois en l'air sont sensibles
        s.vx += hvx * HAND_PUSH_LEAF * k;
        s.vy += hvy * HAND_PUSH_LEAF * k;
        s.vr = clamp(s.vr + hvx * 0.01 * k, -0.4, 0.4);
        continue;
      }
      if (busyHand || loose >= HAND_PUSH_MAX_LOOSE) continue;
      if (s.soil || s.myc || s.nutri || s.deadMyc || !s.kcol) continue; // maillage d'origine, mycelium : jamais
      if (s.y > surfaceAt(s.x) + HAND_PUSH_DEPTH) continue;             // enfouie sous la peau du tas
      if (Math.random() > HAND_PUSH_P * k * 2 || demoGuard(s.x)) continue;
      pileRemove(s);
      s.settled = false;
      s.vx = hvx * HAND_PUSH_LOOSE; s.vy = Math.min(hvy * HAND_PUSH_LOOSE, 0) - 0.6 - Math.random() * 0.6;
      s.vr = (Math.random() - 0.5) * 0.2;
      s.px = s.x; s.py = s.y;
      loose++;
    }
  }

  // Tension de la branche agrippee du meme arbre, 0..1 (sert au tremblement, voir drawTree).
  function handTension(t) {
    var g = hand.grip;
    if (!g || g.t !== t) return 0;
    return Math.min(1, Math.hypot(hand.x - g.gx, hand.y - g.gy) / HAND_BREAK_DIST);
  }

  var HAND_SKIN = ['#e8b48a', '#cf9670', '#b57c58']; // clair, moyen, ombre
  function handPoly(p) { poly(p); ctx.stroke(); }
  // Main low-poly : l'origine locale est le centre de la paume (le point du curseur), doigts
  // vers le haut. Ouverte (fist = 0) : 4 doigts en eventail et pouce ecarte ; poing (fist = 1) :
  // doigts raccourcis dont le bout se replie sur la paume, pouce en travers.
  function drawHand() {
    if (!hand.on) return;
    var f = hand.fist, k = clamp(U / 500, 0.7, 1.3) * (ZOOM < 1 ? HAND_ZOOM_K : 1), i;
    if (hand.touch) {
      // Epaisseurs en px CSS (/ ZOOM) : l'anneau garde la meme taille a l'ecran quel que soit le zoom.
      var fl = clamp(1 - (performance.now() - hand.flash) / HAND_FLASH_MS, 0, 1);
      ctx.beginPath();
      ctx.arc(hand.x, hand.y, (HAND_RING_R * (1 - 0.1 * f) + 6 * fl) / ZOOM, 0, Math.PI * 2);
      ctx.lineWidth = 5 / ZOOM; ctx.strokeStyle = 'rgba(43,29,16,0.35)'; ctx.stroke();
      ctx.lineWidth = 2.5 / ZOOM; ctx.strokeStyle = fl > 0 ? 'rgba(243,201,74,' + (0.6 + 0.4 * fl) + ')' : 'rgba(255,248,230,0.85)'; ctx.stroke();
    }
    ctx.save();
    ctx.translate(hand.x, hand.y);
    ctx.rotate(hand.rot);
    ctx.scale(k, k);
    ctx.lineJoin = 'round'; ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(60,35,20,0.5)';
    // Poignet, puis paume en deux facettes.
    ctx.fillStyle = HAND_SKIN[2];
    handPoly([[-7, 13], [7, 13], [6, 27], [-6, 27]]);
    ctx.fillStyle = HAND_SKIN[0];
    handPoly([[-11, -8], [11, -8], [-9, 14]]);
    ctx.fillStyle = HAND_SKIN[1];
    handPoly([[11, -8], [9, 14], [-9, 14]]);
    // Doigts : deux facettes chacun (gauche claire, droite plus foncee), effiles.
    var spread = 1 - 0.8 * f, lenK = 1 - 0.78 * f;
    for (i = 0; i < 4; i++) {
      var a = -Math.PI / 2 + (i - 1.5) * 0.15 * spread, ux = Math.cos(a), uy = Math.sin(a), nx = uy, ny = -ux;
      var len = [14, 18, 16.5, 12][i] * lenK, bx = -8.2 + i * 5.47, by = -7.5;
      var tx = bx + ux * len, ty = by + uy * len, wb = 2.9, wt = 2.1;
      ctx.fillStyle = HAND_SKIN[0];
      handPoly([[bx + nx * wb, by + ny * wb], [tx + nx * wt, ty + ny * wt], [tx, ty], [bx, by]]);
      ctx.fillStyle = HAND_SKIN[1];
      handPoly([[bx, by], [tx, ty], [tx - nx * wt, ty - ny * wt], [bx - nx * wb, by - ny * wb]]);
      if (f > 0.05) {
        // Bout du doigt replie sur la paume (les jointures du poing).
        ctx.fillStyle = HAND_SKIN[i % 2 ? 1 : 2];
        handPoly([[tx - wt, ty], [tx + wt, ty], [tx + wt * 0.9, ty + 10 * f], [tx - wt * 0.9, ty + 10 * f]]);
      }
    }
    // Pouce : ecarte vers le haut-gauche ouvert, en travers des doigts une fois ferme.
    var ta = lerp(-Math.PI / 2 - 1.15, -0.46, f), tl = lerp(15, 13, f);
    var tux = Math.cos(ta), tuy = Math.sin(ta), tnx = tuy, tny = -tux;
    var tbx = -10, tby = 5, tex = tbx + tux * tl, tey = tby + tuy * tl;
    ctx.fillStyle = HAND_SKIN[0];
    handPoly([[tbx + tnx * 3.6, tby + tny * 3.6], [tex + tnx * 2.6, tey + tny * 2.6], [tex, tey], [tbx, tby]]);
    ctx.fillStyle = HAND_SKIN[1];
    handPoly([[tbx, tby], [tex, tey], [tex - tnx * 2.6, tey - tny * 2.6], [tbx - tnx * 3.6, tby - tny * 3.6]]);
    ctx.restore();
  }

  function pickUpHand(pos) {
    if (handCarry.length) return;         // deja les mains pleines
    // Deux passes : le bois et les feuilles d'abord (poses au sol, ils restent dans litter,
    // stepTrees ignore ce qui n'est plus settled et le chemin d'atterrissage de step() les y
    // remet en conservant leur decomposition), puis la terre pour completer la poignee.
    for (var pass = 0; pass < 2; pass++) {
      for (var i = 0; i < shards.length && handCarry.length < HAND_GRAB_MAX; i++) {
        var s = shards[i];
        if (s.carried || s.dead || s.eaten !== undefined || s.grain || s.myc || s.nutri || s.deadMyc) continue;
        // Une feuille ou un bout de bois encore en l air (non pose) s attrape aussi, avec une
        // zone un peu plus large : elle bouge, il faut pardonner la visee.
        var flying = !s.settled;
        if (flying && !s.leaf) continue;
        if (!!s.leaf !== (pass === 0)) continue;
        if (Math.hypot(s.x - pos.x, s.y - pos.y) > (flying ? HAND_PICK_R * 1.5 : HAND_PICK_R)) continue;
        if (!s.leaf && demoGuard(s.x)) continue; // la terre seulement : le bois et les feuilles se ramassent toujours
        if (!flying) pileRemove(s);
        s.settled = false;
        s.carried = true;
        s.vx = s.vy = s.vr = 0;
        s.hox = s.x - pos.x; s.hoy = s.y - pos.y; // garde sa position relative dans la poignee
        handCarry.push(s);
      }
    }
  }

  // Espece selon la souche : strophaire = strophaire rouge vin uniquement,
  // pleurote = une des pleurotes au hasard (couleurs variees), hydne = l'hydne.
  function speciesForStrain(st) {
    var pool = SPECIES.filter(function (sp) {
      if (st.id === 'pleurote') return sp.pleurote;
      if (st.id === 'hydne') return sp.hydne;
      return sp.strophaire;
    });
    return pool.length ? pool[(Math.random() * pool.length) | 0] : SPECIES[speciesIdx++ % SPECIES.length];
  }

  // fromMyc : true quand la grappe sort d'une zone de mycelium bien blanche
  // (spreadMycelium) plutot que plantee a la main (tap sur la terre nue, handleTap) —
  // seule celle-la fane si le mycelium qui l'a fait sortir disparait (voir step()).
  var MYC_MUSHROOM_SCALE = 0.55;          // les grappes issues du mycelium restent petites : le tresor seul est gros
  function sprout(x, fromMyc, strain) {
    var sp = fromMyc && strain ? speciesForStrain(strain) : SPECIES[speciesIdx++ % SPECIES.length];
    var n = 1 + ((Math.random() * 3) | 0);
    var mainMushroom = null;
    for (var i = 0; i < n; i++) {
      var side = i === 0 ? 0 : (i === 1 ? -1 : 1);
      var size = U * 0.2 * (0.6 + Math.random() * 0.6) * (i === 0 ? 1.15 : 0.85) * (fromMyc ? MYC_MUSHROOM_SCALE : 1);
      var m = {
        x: x + side * size * 0.55, size: size,
        lean: (Math.random() - 0.5) * 0.35 + side * 0.2,
        sp: sp, t: -i * 0.25,   // t negatif = petit decalage de pousse dans la grappe
        myc: !!fromMyc, lastMycNear: vTime, strain: fromMyc ? strain || null : null
      };
      mushrooms.push(m);
      if (window.sporaSfx) sporaSfx.play('pop', { min: 70 });
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
        title: 'Cultivez vos propres champignons avec notre mycélium!',
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
  // parent : facette colonisatrice (le filament en part, voir drawHyphae) ; absent pour une
  // inoculation directe. hyJ/hyTw/hyF : jitter, ramilles et duvet figes (pas de random au dessin).
  // strain : souche du grain qui inocule (null = standard) ; une facette gagnee par
  // propagation herite de celle de son parent, seule la teinte change (voir STRAIN_MIX).
  function infect(s, ox, oy, amount, now, lastFed, parent, strain) {
    if (s.myc || s.grain || s.nutri || s.deadMyc || isRocky(s.x) || isSubmerged(s.x)) return;
    s.myc = amount;
    s.mycParent = parent || null;
    s.strain = (parent ? parent.strain : strain) || null;
    s.pid = parent ? parent.pid || 0 : 0; // patch : herite du parent ; inoculation directe/restauration = attribue au prochain instantane
    if (s.pid && patches[s.pid]) patches[s.pid].alive++;
    if (s.strain) tintedMyc = true;
    s.hyJ = (Math.random() - 0.5) * 8;
    s.hyTw = [Math.random() * 6.283, 3 + Math.random() * 4];
    if (Math.random() < 0.5) s.hyTw.push(Math.random() * 6.283, 3 + Math.random() * 4);
    s.hyF = [];
    for (var hi = 0; hi < 3; hi++) s.hyF.push((Math.random() - 0.5) * 8, -1.5708 + (Math.random() - 0.5) * 1.2, 2 + Math.random() * 2);
    s.mox = ox; s.moy = oy;               // point d'inoculation : borne la portee (MYC_RADIUS)
    s.mycTone = 0.7 + Math.random() * 0.2; // jamais tout a fait blanc : les facettes restent lisibles
    s.lastFed = lastFed !== undefined ? lastFed : now;
    colonised.push(s);
    mycBusyUntil = frame + 120;
  }

  function inoculate(x, y, now, strain) {
    for (var i = 0; i < shards.length; i++) {
      var s = shards[i];
      if (!s.settled || Math.abs(s.x - x) > 12 || Math.abs(s.y - y) > 12) continue;
      infect(s, x, y, 0.06, now, undefined, undefined, strain);
    }
  }

  // Retourne true tant que quelque chose change (la boucle de rendu doit tourner).
  // Sans bois a decomposer a portee (voir stepTrees, qui met a jour c.lastFed), un
  // mycelium colonise finit par s'eteindre et la facette redevient de la terre normale.
  function stepMycelium(now) {
    var busy = frame < mycBusyUntil;
    snapshotPatches(performance.now());
    var deathCheck = now >= mycNextDeathCheck;
    if (deathCheck) mycNextDeathCheck = now + MYC_RANDOM_DEATH_CHECK_MS;
    for (var i = colonised.length - 1; i >= 0; i--) {
      var c = colonised[i], droughtHit = false, starving = false, cst = c.strain || STRAIN_STD, dm = cst.decayMul;
      // La secheresse peut faner un mycelium en surface meme s'il est activement nourri :
      // elle agit sur l'exposition, pas sur la faim (voir DROUGHT_* pres de updateWeather).
      if (deathCheck && c.myc > 0 && Math.random() < MYC_RANDOM_DEATH_P * dm) {
        c.myc = 0; // mort aleatoire : meme sortie que la faim (voir plus bas)
        busy = true;
      } else if (weather.drought && c.y - surfaceAt(c.x) < DROUGHT_SURFACE_DEPTH && Math.random() < DROUGHT_KILL_P * dm) {
        c.myc -= MYC_DROUGHT_DECAY * dm;
        busy = true;
        droughtHit = true;
      } else if (c.myc < 1 && (now - c.lastFed < MYC_STARVE_MS)) { c.myc = Math.min(1, c.myc + MYC_GROW * cst.growMul); busy = true; continue; }
      else if (now - c.lastFed >= MYC_STARVE_MS) {
        c.myc -= MYC_DECAY * dm;
        busy = true;
        starving = true;
      }
      if (c.myc <= 0) {
        c.myc = 0;
        // Chaque mort est signalee (groupee, avec bouton "Voir") : voir notePatchDeath.
        notePatchDeath(c, droughtHit ? 'drought' : (starving ? 'starve' : 'random'));
        if (droughtHit) {
          // Contrairement a la mort de faim, la secheresse laisse un mycelium mort mais
          // toujours en place (deadMyc) : ni vivant ni nutriment, jusqu'a ce que la pluie le
          // decompose (voir decomposeDeadMyc).
          c.deadMyc = true;
          var deadColor = hexToRgb(MYC_DEAD[(Math.random() * MYC_DEAD.length) | 0]);
          c.from = deadColor; c.to = deadColor; c.mix = 1; c.nutri = null;
          deadMyc.push(c);
        } else if (c.leaf) {
          // Le mycelium qui meurt de faim SUR DE LA LITIERE devient lui-meme un nutriment
          // (necromasse) : comme dans la vraie vie, sa propre mort nourrit encore le sol et
          // les arbres. Sur de la terre ordinaire (pas de litiere), voir le else ci-dessous :
          // la terre elle-meme n'a jamais de valeur nutritive, elle redevient juste de la
          // terre (le blanchiment disparait deja tout seul puisque le rendu suit c.myc).
          c.nutri = NUTRI[(Math.random() * NUTRI.length) | 0];
          c.nutriSince = now;
        }
        colonised.splice(i, 1);
        if (!c.deadMyc) c.mycParent = null; // redevient de la terre normale (le mort garde son filament)
      }
    }
    if (frame % MYC_SPREAD_EVERY === 0) spreadMycelium(now);
    return busy;
  }

  // Grille de voisinage refaite a chaque passage : la pelle deplace les facettes.
  function spreadMycelium(now) {
    var D = 14, radius = U * MYC_RADIUS, grid = new Map(), i, s, b;
    for (i = 0; i < shards.length; i++) {
      s = shards[i];
      if (!s.settled) continue;
      var key = ((s.x / D) | 0) * 1024 + ((s.y / D) | 0);
      var cell = grid.get(key);
      if (cell) cell.push(s); else grid.set(key, [s]);
    }
    var buckets = {}, fw = U * FRUIT_W;
    for (i = 0; i < colonised.length; i++) {
      var c = colonised[i];
      if (!c.settled || c.myc < MYC_READY) continue;
      if (c.myc > 0.9 && c.y - surfaceAt(c.x) < 18) {
        b = Math.floor(c.x / fw);
        (buckets[b] = buckets[b] || []).push(c);
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
      infect(free[(Math.random() * free.length) | 0], c.mox, c.moy, 0.02, now, c.lastFed, c);
    }
    // Une zone de surface bien blanche fructifie une fois.
    for (b in buckets) {
      var xs = buckets[b];
      if (fruited[b] || xs.length < FRUIT_MIN) continue;
      fruited[b] = true;
      var pick = xs[(Math.random() * xs.length) | 0];
      sprout(pick.x, true, pick.strain || STRAIN_STD);
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
    if (bagGrainsLeft <= 0 && DEMO) bagGrainsLeft = BAG_GRAINS; // demo : mycelium gratuit, le sac ne se vide jamais
    if (bagGrainsLeft <= 0) {
      bag.pouring = false; // sac vide : se redresse tout seul
      setCaption(CAPTION_BAG_EMPTY);
      return;
    }
    var n = Math.min(bagGrainsLeft, Math.random() < 0.5 ? 2 : 1);
    bagGrainsLeft -= n;
    var cs = currentStrain();
    for (var i = 0; i < n; i++) {
      var r = 1.8 + Math.random() * 1.6, a = Math.random() * Math.PI * 2;
      var color = hexToRgb(GRAIN[(Math.random() * GRAIN.length) | 0]);
      if (cs) color = mixRgb(color, cs.tintRgb, STRAIN_MIX);
      shards.push({
        pts: [0, 1, 2].map(function (j) {
          var t = a + j * 2.1 + (Math.random() - 0.5) * 0.5;
          return [Math.cos(t) * r, Math.sin(t) * r];
        }),
        x: bag.x + (Math.random() - 0.5) * 5, y: bag.y + 2,
        vx: (Math.random() - 0.5) * 0.8, vy: 0.5 + Math.random(),
        rot: 0, vr: (Math.random() - 0.5) * 0.3,
        from: color, to: color, mix: 1, area: 0, settled: false, col: -1, grain: true, strain: cs
      });
    }
  }

  // Logo de l'etiquette : rasterise une seule fois dans un petit canvas (redessiner le SVG a
  // chaque frame, avec une rotation qui change, couterait cher).
  var bagLogo = null;
  (function () {
    var url = canvas.getAttribute('data-bag-logo-url');
    if (!url) return;
    var im = new Image();
    im.onload = function () {
      var c = document.createElement('canvas');
      c.width = 200;
      c.height = Math.round(200 * im.naturalHeight / im.naturalWidth) || 162;
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      bagLogo = c;
    };
    im.src = url;
  })();

  function drawBag() {
    if (!bag.on) return;
    var k = clamp(U / 500, 0.7, 1.3);
    ctx.save();
    ctx.translate(bag.x, bag.y);
    ctx.rotate(bag.rot);
    ctx.scale(k, k);
    // Sachet blanc opaque, comme le produit vendu. Il verse par un coin coupe, pose sur le
    // curseur ; le logo se lit a l'endroit quand le sac verse.
    var cs = currentStrain();
    ctx.fillStyle = '#f5f3ee';
    poly([[-39, 3], [-4, 3], [3, -4], [3, -73], [1, -75], [-37, -75], [-39, -73]]);
    // Reflet a gauche.
    ctx.fillStyle = '#fdfcfa';
    poly([[-39, 3], [-39, -71], [-31, -71]]);
    // Soudure du haut.
    ctx.fillStyle = '#dcd9d0';
    poly([[-39, -71], [3, -71], [3, -73], [1, -75], [-37, -75], [-39, -73]]);
    // Pastille filtrante.
    ctx.fillStyle = '#e4e2da';
    poly([[-22, -59], [-14, -59], [-14, -67], [-22, -67]]);
    ctx.fillStyle = '#d3d0c6';
    poly([[-22, -59], [-14, -59], [-14, -67]]);
    // Logo imprime sur le sac.
    if (bagLogo) ctx.drawImage(bagLogo, -34, -56, 32, 32 * bagLogo.height / bagLogo.width);
    // Bande a la couleur de la souche choisie (le sac opaque ne montre plus le mycelium).
    ctx.fillStyle = cs.tint || '#b8735a';
    poly([[-39, -22], [3, -22], [3, -15], [-39, -15]]);
    // Ombre du cote droit et du fond, pour le volume.
    ctx.fillStyle = 'rgba(40, 30, 10, 0.08)';
    poly([[3, -4], [3, -73], [1, -75], [-7, -75]]);
    poly([[-39, 3], [-4, 3], [-39, -6]]);
    // Coin coupe : on y voit le grain colonise.
    ctx.fillStyle = tintCol('#e4dac5', cs);
    poly([[-4, 3], [3, -4], [0.5, -6.5], [-6.5, 0.5]]);
    ctx.restore();
  }

  // --- Pluie naturelle -------------------------------------------------------------------
  // Plus un outil : un cycle sec/averse tourne seul en mode 'exploded' (voir updateWeather),
  // rythme par vTime (donc accelere par le slider de vitesse). Le curseur Pluie (rainLevel,
  // 0..1) regle la frequence et la duree des averses ; a 0 il ne pleut jamais. Pendant une
  // averse il pleut sur TOUTE la largeur du monde : les gouttes ne sont creees que dans la
  // vue visible (camX..camX+W, par souci de performance) mais le lessivage (voir leach())
  // s'applique sur tout le monde. Quelques nuages bas-poly derivent lentement en haut de la
  // vue pendant l'averse, avec un fondu en entree/sortie. Les gouttes vivent dans leur
  // propre tableau (pas dans shards) : bien plus nombreuses et bien plus simples qu'une
  // facette, les melanger aux shards couterait cher pour rien.
  var RAIN_CLOUD_Y_FRAC = 0.12;           // hauteur des nuages dans la vue, sous camY (x hauteur de la boite)
  var RAIN_DRY_MS = [120000, 20000];      // duree seche, lerp(min,max,rainLevel) puis x(0.6..1.4) aleatoire
  var RAIN_SHOWER_MS = [8000, 20000];     // duree d'une averse, lerp(min,max,rainLevel) puis x(0.7..1.3) aleatoire
  var RAIN_FADE_MS = 2500;                // fondu (entree et sortie) des nuages
  var RAIN_DROP_MAX = 220;                // nombre max de gouttes en vol (vue visible seulement)
  var RAIN_DROP_VY = [7, 11];             // vitesse de chute d'une goutte (px/frame, min/max)
  var RAIN_SPAWN_MAX = 5;                 // gouttes creees par frame a rainLevel = 1 (echelle avec rainLevel)
  var RAIN_CLOUDS_N = 4;                  // nombre de nuages pendant une averse, repartis sur le monde
  var RAIN_CLOUD_DRIFT = 0.006;           // vitesse de derive des nuages (px monde / ms)
  // En temps VIRTUEL (vTime), pas en frames reelles : weather.changeAt (duree d'une averse)
  // est lui aussi en vTime, donc accelere pareil par le curseur de vitesse debug
  // (timeScale). Avec un gate en frames reelles (l'ancien LEACH_EVERY), une averse deja
  // 4x plus courte en temps reel a x4 recevait EN PLUS le meme nombre de tentatives de
  // lessivage par seconde reelle qu'a x1 (le calcul de frame ne connait pas timeScale) :
  // le lessivage se retrouvait ~4x plus faible par rapport au reste du cycle (decomposition,
  // repas des racines), qui lui accelere bien avec vTime — d'ou l'absence de perte de
  // nutriments observee en testant a vitesse elevee, alors qu'a x1 l'equilibre est correct.
  var LEACH_INTERVAL_MS = 10;              // le lessivage (voir leach()) se recalcule a ce rythme
  var LEACH_MAX_STEPS_PER_FRAME = 200;     // plafond de rattrapage par frame reelle (voir updateRainDrops) : evite un gel si vTime saute enormement
  // Ne s'applique qu'au sol PAS retenu par du mycelium vivant (heldByMycelium court-circuite
  // deja les facettes protegees avant ce jet, voir leach()) : augmenter cette valeur rend
  // donc specifiquement le sol sans vie plus "qui fuit", sans toucher au sol vivant.
  // Les feuilles tombees (en attente de decomposition) descendent un peu avec la pluie, mais
  // bien moins et autrement que l'humus : un petit deplacement vers le bas, plafonne par
  // averse, pour qu'elles ne restent pas en gigantesques piles en surface et finissent par
  // atteindre le mycelium (qui les mange). Elles s'arretent sur le compact ou une autre feuille.
  var LEAF_RAIN_P = 0.08;                 // chance, par passage de lessivage (frame de pluie), qu'une feuille au sol descende d'un cran
  var LEAF_RAIN_STEP = 1.5;               // px descendus par cran
  var WOOD_RAIN_MULT = 0.35;              // le bois (branches) descend aussi avec la pluie, a cette fraction de la chance et de la descente max des feuilles
  var LEAF_RAIN_MAX_DROP = 40;           // descente max (px) par averse pour une meme feuille
  var LEACH_P = 0.4;                      // chance de base, par tick de lessivage, qu'un humus meuble descende d'un cran
  var COMPACT_SINK_SPEED = 0.08;          // vitesse (px/tick de lessivage) a laquelle un depot deja enfonce dans le compact continue de couler ; doit rester lente, sinon il sort de depthReach avant que les racines l'atteignent
  // Secheresse : meme principe qu'une averse mais inverse (voir stepMycelium) — pendant une
  // periode seche, un mycelium en surface (a portee de la fructification, DROUGHT_SURFACE_DEPTH)
  // peut secher et mourir directement, sans lien avec la faim. Jamais en meme temps qu'une
  // averse : startShower() coupe toute secheresse en cours et redemarre son delai, et le
  // cycle secheresse ne tourne que quand weather.raining est faux (voir updateWeather). Reglee
  // par son propre curseur Secheresse (droughtLevel, 0..1, independant du curseur Pluie) ; a 0
  // il ne seche jamais.
  var DROUGHT_MS = [10000, 30000];        // duree d'une secheresse, lerp(min,max,droughtLevel) puis x(0.7..1.3) aleatoire
  var DROUGHT_GAP_MS = [90000, 25000];    // duree normale (sans secheresse) entre deux, lerp(min,max,droughtLevel) puis x(0.7..1.3) aleatoire
  var DROUGHT_SURFACE_DEPTH = 18;         // "en surface" = meme seuil que la fructification (c.y - surfaceAt(c.x))
  var DROUGHT_KILL_P = 0.02;              // chance par frame qu'une facette de mycelium exposee prenne un coup de sec
  var MYC_DROUGHT_DECAY = 0.15;           // blanchiment perdu a chaque coup de sec (facette exposee) : ~5s d'exposition continue pour tuer un mycelium plein
  // Tempete : une averse normale qui s'intensifie ponctuellement (jamais hors d'une averse
  // deja en cours, voir updateWeather) — le lessivage y est multiplie par STORM_LEACH_MULT.
  // Reglee par son propre curseur Tempetes (stormLevel, 0..1, independant du curseur Pluie) ;
  // a 0 il n'y a jamais de tempete, seulement de la pluie normale.
  var STORM_MS = [4000, 12000];           // duree d'une tempete, lerp(min,max,stormLevel) puis x(0.7..1.3) aleatoire
  var STORM_GAP_MS = [60000, 15000];      // duree normale (pluie sans tempete) entre deux, lerp(min,max,stormLevel) puis x(0.7..1.3) aleatoire
  var STORM_LEACH_MULT = 5;               // multiplicateur du lessivage (LEACH_P) pendant une tempete
  var STORM_SPAWN_MULT = 2.5;             // multiplicateur du nombre de gouttes affichees pendant une tempete (visuel seulement)
  var weather = {
    raining: false, changeAt: 0, startedAt: 0, clouds: [], lastNow: null,
    drought: false, droughtChangeAt: 0, storm: false, stormChangeAt: 0
  };
  var drops = [];
  var nextLeachAt = 0;

  function weatherDryMs() {
    return lerp(RAIN_DRY_MS[0], RAIN_DRY_MS[1], rainLevel) * (0.6 + Math.random() * 0.8);
  }
  function weatherShowerMs() {
    return lerp(RAIN_SHOWER_MS[0], RAIN_SHOWER_MS[1], rainLevel) * (0.7 + Math.random() * 0.6);
  }
  function droughtMs() {
    return lerp(DROUGHT_MS[0], DROUGHT_MS[1], droughtLevel) * (0.7 + Math.random() * 0.6);
  }
  function droughtGapMs() {
    return lerp(DROUGHT_GAP_MS[0], DROUGHT_GAP_MS[1], droughtLevel) * (0.7 + Math.random() * 0.6);
  }
  function stormMs() {
    return lerp(STORM_MS[0], STORM_MS[1], stormLevel) * (0.7 + Math.random() * 0.6);
  }
  function stormGapMs() {
    return lerp(STORM_GAP_MS[0], STORM_GAP_MS[1], stormLevel) * (0.7 + Math.random() * 0.6);
  }

  function startShower(now) {
    weather.raining = true;
    weather.startedAt = now;
    weather.changeAt = now + weatherShowerMs();
    weather.clouds = [];
    for (var i = 0; i < RAIN_CLOUDS_N; i++) {
      weather.clouds.push({
        x: (worldW / RAIN_CLOUDS_N) * (i + Math.random() * 0.4),
        w: U * (0.5 + Math.random() * 0.4),
        vx: (Math.random() < 0.5 ? -1 : 1) * RAIN_CLOUD_DRIFT * (0.6 + Math.random() * 0.8)
      });
    }
    // Une averse coupe net toute secheresse en cours, et repousse la prochaine : jamais les
    // deux a la fois.
    weather.drought = false;
    weather.droughtChangeAt = now + droughtGapMs();
    // La tempete est une sous-phase de l'averse (voir updateWeather) : chaque nouvelle
    // averse repart avec son propre delai avant la premiere tempete possible.
    weather.storm = false;
    weather.stormChangeAt = now + stormGapMs();
  }
  function startDry(now) {
    weather.raining = false;
    weather.storm = false;
    weather.clouds = [];
    weather.changeAt = now + weatherDryMs();
  }
  // Coupe une averse en cours quand le curseur Pluie repasse a 0 : pas de fondu, ce
  // reglage reste un peu du debug plutot qu'une meteo scriptee.
  function stopShower() {
    if (!weather.raining) return;
    weather.raining = false;
    weather.storm = false;
    weather.clouds = [];
  }
  function startDrought(now) {
    weather.drought = true;
    weather.droughtChangeAt = now + droughtMs();
  }
  function endDrought(now) {
    weather.drought = false;
    weather.droughtChangeAt = now + droughtGapMs();
  }
  function startStorm(now) {
    if (window.sporaSfx) sporaSfx.play('thunder'); 
    weather.storm = true;
    weather.stormChangeAt = now + stormMs();
  }
  function endStorm(now) {
    weather.storm = false;
    weather.stormChangeAt = now + stormGapMs();
  }

  function updateWeather(now) {
    if (weather.lastNow === null) weather.lastNow = now;
    var dt = Math.max(0, now - weather.lastNow);
    weather.lastNow = now;
    if (rainLevel <= 0) {
      if (weather.raining) stopShower();
      weather.changeAt = now; // repart a zero des que le curseur remonte
    } else if (now >= weather.changeAt) {
      if (weather.raining) startDry(now); else startShower(now);
    }
    // Le cycle de secheresse tourne independamment de la pluie (son propre curseur, sa propre
    // horloge) tant qu'il ne pleut pas ; a 0 elle est simplement coupee, comme la pluie a 0.
    if (droughtLevel <= 0) {
      weather.drought = false;
      weather.droughtChangeAt = now; // repart a zero des que le curseur remonte
    } else if (!weather.raining && now >= weather.droughtChangeAt) {
      if (weather.drought) endDrought(now); else startDrought(now);
    }
    // La tempete n'existe que PENDANT une averse deja en cours (une tempete hors pluie
    // n'aurait rien a intensifier) ; a 0 elle est simplement coupee, comme la pluie et la
    // secheresse a 0.
    if (stormLevel <= 0 || !weather.raining) {
      if (weather.storm) weather.storm = false;
    } else if (now >= weather.stormChangeAt) {
      if (weather.storm) endStorm(now); else startStorm(now);
    }
    for (var i = 0; i < weather.clouds.length; i++) weather.clouds[i].x += weather.clouds[i].vx * dt;
    updateDroughtIndicator();
    updateStormIndicator();
  }

  // Seul indicateur visuel de la secheresse (pas d'effet a l'ecran comme les nuages de pluie) :
  // un badge texte dans la barre de debug, pour qu'on sache quand elle est active en testant
  // le curseur Secheresse. N'ecrit dans le DOM que sur un changement d'etat.
  var droughtIndicatorOn = false;
  function updateDroughtIndicator() {
    if (!droughtIndicator || weather.drought === droughtIndicatorOn) return;
    droughtIndicatorOn = weather.drought;
    droughtIndicator.classList.toggle('d-none', !droughtIndicatorOn);
  }
  var stormIndicatorOn = false;
  function updateStormIndicator() {
    if (!stormIndicator || weather.storm === stormIndicatorOn) return;
    stormIndicatorOn = weather.storm;
    stormIndicator.classList.toggle('d-none', !stormIndicatorOn);
  }

  function updateRainDrops(now) {
    if (weather.raining && drops.length < RAIN_DROP_MAX) {
      var spawnN = Math.max(1, Math.round(RAIN_SPAWN_MAX * rainLevel * (weather.storm ? STORM_SPAWN_MULT : 1)));
      var cy = camY + H * RAIN_CLOUD_Y_FRAC;
      for (var i = 0; i < spawnN && drops.length < RAIN_DROP_MAX; i++) {
        drops.push({ x: camX + Math.random() * W, y: cy + 4, vy: lerp(RAIN_DROP_VY[0], RAIN_DROP_VY[1], Math.random()) });
      }
    }
    for (var d = drops.length - 1; d >= 0; d--) {
      var dr = drops[d];
      dr.y += dr.vy;
      // Une goutte qui touche une cuvette (ou son eau) y ajoute du volume (voir updateLakes).
      var dcol = Math.max(0, Math.min(heights.length - 1, Math.round(dr.x / COL_W))), dl = lakeOf[dcol] ? lakes[lakeOf[dcol] - 1] : null;
      if (dr.y >= surfaceAt(dr.x) || (dl && dcol >= dl.c0 && dcol <= dl.c1 && dr.y >= dl.level)) {
        if (dl) dl.vol += LAKE_DROP_VOL;
        drops.splice(d, 1);
      }
    }
    updateLakes(now);
    // A vitesse elevee (slider debug), vTime peut sauter de bien plus qu'un
    // LEACH_INTERVAL_MS en une seule frame reelle. On compte combien de pas ont ete
    // "rates" (plafonne par LEACH_MAX_STEPS_PER_FRAME, pour eviter un calcul sans fin si le
    // saut est extreme) et on les rattrape — mais PAS en rappelant tout leach() ce nombre de
    // fois : sa recherche de voisine (descente en terre meuble) est deja plafonnee a un seul
    // pas reel par frame par leachTick (voir leach()), donc la rappeler en boucle ne faisait
    // qu'en payer le cout O(facettes^2) inutilement — a vitesse elevee ca gelait carrement
    // la simulation. Seul l'enfoncement dans le compact (sinkCompactNutri, bon marche) doit
    // vraiment suivre le nombre de pas, sinon la maturation sans pluie (NUTRI_RIPEN_MS, qui
    // suit vTime brut) finit par devancer le lessivage a vitesse elevee (voir plus haut).
    if (weather.raining) {
      var leachSteps = 0;
      while (now >= nextLeachAt && leachSteps < LEACH_MAX_STEPS_PER_FRAME) {
        nextLeachAt += LEACH_INTERVAL_MS;
        leachSteps++;
      }
      if (nextLeachAt < now) nextLeachAt = now + LEACH_INTERVAL_MS;
      if (leachSteps > 0) {
        sinkCompactNutri(leachSteps);
        leach(now);
        decomposeDeadMyc();
      }
    }
  }

  // Vrai si un mycelium bien vivant (myc > MYC_READY) est assez proche pour retenir cet
  // humus contre le lessivage — seulement s'il ne le retient pas depuis trop longtemps
  // deja (MYC_HOLD_MAX_MS), sinon un humus jamais mange resterait bloque pour toujours.
  function heldByMycelium(x, y, nutriSince) {
    if (nutriSince !== undefined && vTime - nutriSince > MYC_HOLD_MAX_MS) return false;
    for (var i = 0; i < colonised.length; i++) {
      var c = colonised[i];
      if (c.myc > MYC_READY && Math.hypot(c.x - x, c.y - y) < MYC_HOLD_REACH) return true;
    }
    return false;
  }

  // Mangeable des qu'un des deux chemins est rempli : suffisamment lessive par la pluie
  // (rapide, MIN_LEACH_TO_EAT), OU simplement mur avec le temps (lent, NUTRI_RIPEN_MS) —
  // comme dans la vraie vie ou l'azote finit par devenir disponible meme sans pluie, juste
  // beaucoup moins vite. Necessite s.nutriSince (voir partout ou s.nutri est pose).
  function isNutriRipe(s, now) {
    return (s.leachCount || 0) >= MIN_LEACH_TO_EAT ||
      (s.nutriSince !== undefined && now - s.nutriSince >= NUTRI_RIPEN_MS);
  }

  // Remet une facette a une couleur de terre normale : efface le nutriment ET remplace
  // from/to (une facette nee d'une feuille garde `to` = un NUTRI sombre meme mix a 1, sinon
  // elle resterait visuellement de l'humus une fois le nutriment retire).
  function toEarthColor(s) {
    var color = shade(hexToRgb(EARTH[(Math.random() * EARTH.length) | 0]), (Math.random() - 0.5) * 0.2);
    s.nutri = null; s.nutriSince = undefined; s.from = color; s.to = color; s.mix = 1;
  }

  function toNutriColor(s) {
    var hex = NUTRI[(Math.random() * NUTRI.length) | 0];
    s.nutri = hex; s.from = hexToRgb(hex); s.to = hexToRgb(hex); s.mix = 1;
  }

  // Fait pousser un tout petit nutriment directement en surface d'une colonne, ex nihilo
  // (pas issu d'une feuille tombee) : minuscule, il suit ensuite exactement le meme sort
  // que n'importe quel autre nutriment (lessivage, mycelium qui le retient, racine qui le
  // mange) — seule sa taille/rarete le distingue d'une feuille decomposee. Reutilise par le
  // gazon (spawnGrassNutrient) et par le bois d'une branche qui redonne sa matiere par
  // petits bouts plutot que d'un coup (voir la boucle de litiere plus bas).
  function spawnNutrientShard(x, y, col, area, now) {
    var hex = NUTRI[(Math.random() * NUTRI.length) | 0], color = hexToRgb(hex);
    var s = {
      pts: [[-2, 2], [2, 2], [0, -3]], ox: x, oy: y, x: x, y: y, vx: 0, vy: 0,
      rot: Math.random() * Math.PI, vr: 0, from: color, to: color, mix: 1,
      area: area, settled: true, col: col, nutri: hex, nutriSince: now
    };
    shards.push(s);
    pileAdd(s);
  }

  // --- Gazon (voir section "Gazon" plus haut pour le pourquoi) ------------------------
  function spawnGrassNutrient(col, now) {
    var x = (col + Math.random() - 0.5) * COL_W, y = compactY[col] - heights[col];
    spawnNutrientShard(x, y, col, GRASS_NUTRI_AREA, now);
  }

  // Met a jour la couverture (grassCover) et, occasionnellement, fait pousser un nutriment.
  // Retourne un etat comme stepTrees (0 rien, >0 continuer a verifier lentement) : le gazon
  // n'a jamais besoin de la pleine cadence (60 fps), juste de ne pas s'arreter completement
  // (voir son usage dans step(), fondu avec treeLife).
  function updateGrass(now) {
    if (!grassCover) return 0;
    var dt = grassLastNow === null ? 0 : now - grassLastNow;
    grassLastNow = now;
    for (var c = 0; c < grassCover.length; c++) {
      if ((rocky[c] && heights[c] < ROCK_COVER_MIN) || isSubmergedCol(c)) { grassCover[c] = 0; continue; }
      var diff = heights[c] - grassPrevH[c];
      if (Math.abs(diff) > GRASS_DISTURB_EPS && !demoGuard(c * COL_W)) {
        if (grassCover[c] > 0 && performance.now() > grassTipFrom && ++grassLost >= GRASS_LOST_TIP && leachTip(16, CAPTION_GRASS_LOST, true)) grassLost = 0;
        grassCover[c] = 0;
      }
      grassPrevH[c] += diff * GRASS_BASELINE_FOLLOW;
      if (grassCover[c] >= 1) continue;
      // Uniquement de la propagation : sans voisine deja gazonnee, une colonne nue ne pousse
      // pas toute seule (pas de generation spontanee), exactement comme le mycelium qui ne
      // colonise que ce qui touche deja une facette colonisee (voir spreadMycelium).
      var neighborLush = (c > 0 && grassCover[c - 1] > GRASS_NEIGHBOR_MIN) ||
        (c < grassCover.length - 1 && grassCover[c + 1] > GRASS_NEIGHBOR_MIN);
      if (!neighborLush) continue;
      grassCover[c] = Math.min(1, grassCover[c] + (dt / GRASS_REGROW_MS) * GRASS_SPREAD_BONUS);
    }
    // grassMyc (symbiose visible, voir sa section plus haut) : recalcule seulement toutes
    // les GRASS_MYC_CHECK_EVERY frames, pas a chaque frame — parcourir colonised pour
    // chaque colonne a 60fps couterait cher pour un simple bonus cosmetique + production.
    if (frame % GRASS_MYC_CHECK_EVERY === 0) {
      for (var gc = 0; gc < grassCover.length; gc++) grassMyc[gc] = grassHasMycUnder(gc * COL_W) ? 1 : 0;
      // Cible de flore (mousse/touffes/feuillage, purement cosmetique) : calculee ici, pas a
      // chaque frame, comme grassMyc juste au-dessus — meme raison, ca ne coute rien de plus
      // qu'un simple effet visuel. Plus dense pres d'un arbre bien nourri (treeInf) et
      // au-dessus d'un mycelium actif (mycInf, avec un leger lissage vers les colonnes
      // voisines pour eviter un bord dur), avec un bonus si les deux se superposent (vraie
      // mycorhize) : le sol vivant doit se voir profiter a la flore aussi, pas seulement au
      // gazon (voir GRASS_MYC_HEIGHT_MULT) ou aux arbres.
      for (var flc = 0; flc < floraTarget.length; flc++) {
        var fx = flc * COL_W, treeInf = 0;
        for (var fti = 0; fti < trees.length; fti++) {
          var ft = trees[fti], fd = Math.abs(ft.x - fx);
          var frr = U * lerp(FLORA_TREE_R_MIN, FLORA_TREE_R_MAX, ft.growth);
          if (fd >= frr) continue;
          var infl = lerp(0.4, 1, ft.growth) * (1 - fd / frr);
          if (infl > treeInf) treeInf = infl;
        }
        var mycInf = grassMyc[flc] ? 1 : 0;
        if (!mycInf) {
          for (var fnb = -2; fnb <= 2; fnb++) {
            var fni = flc + fnb;
            if (fnb === 0 || fni < 0 || fni >= grassMyc.length) continue;
            if (grassMyc[fni]) { mycInf = 0.7; break; }
          }
        }
        var flTgt = treeInf * FLORA_TREE_W + mycInf * FLORA_MYC_W;
        if (treeInf > 0 && grassMyc[flc]) flTgt += FLORA_SYMBIOSIS_BONUS;
        floraTarget[flc] = Math.min(1, flTgt);
      }
    }
    if (now >= grassNutriAt) {
      grassNutriAt = now + GRASS_NUTRI_CHECK_MS;
      {
        var eligible = [];
        for (var cc = 0; cc < grassCover.length; cc++) {
          if (grassCover[cc] < GRASS_FRUIT_MIN) continue;
          eligible.push(cc);
          // Compte plusieurs fois dans le tirage au sort : ~GRASS_MYC_NUTRI_WEIGHT fois plus
          // susceptible d'etre choisie, sans changer combien de nutriments sortent d'un coup.
          if (grassMyc[cc]) for (var w = 1; w < GRASS_MYC_NUTRI_WEIGHT; w++) eligible.push(cc);
        }
        if (eligible.length) {
          var pickCol = eligible[(Math.random() * eligible.length) | 0];
          // Multiplicateur de production (champs "Gazon"/"Gazon long" de la barre de reglages) :
          // 1 = comportement d'origine (chance GRASS_NUTRI_P d'un nutriment), 0 = aucun,
          // >1 = plusieurs nutriments (partie entiere + chance sur le reste).
          var nutriExpect = GRASS_NUTRI_P * (grassMyc[pickCol] ? grassMycNutriMult : grassNutriMult);
          var nutriN = Math.floor(nutriExpect);
          if (Math.random() < nutriExpect - nutriN) nutriN++;
          for (var ni = 0; ni < nutriN; ni++) spawnGrassNutrient(pickCol, now);
        }
      }
    }
    // Pousse/fanage de la flore vers sa cible, a CHAQUE appel (contrairement au calcul de
    // cible ci-dessus) : c'est une boucle separee de celle de grassCover en haut de la
    // fonction, qui saute plusieurs colonnes (rocher, deja pleine, pas de voisine) — la
    // flore, elle, doit etre mise a jour partout. Jamais au-dela de grassCover (pas de flore
    // sans herbe dessous) ; une colonne remuee a la pelle (grassCover retombe a 0 juste
    // au-dessus) perd sa flore tout de suite, comme arrachee par le coup de pelle.
    for (var fc = 0; fc < floraLush.length; fc++) {
      if (grassCover[fc] <= 0) { floraLush[fc] = 0; continue; }
      var flTarget = Math.min(floraTarget[fc], grassCover[fc]);
      if (flTarget > floraLush[fc]) floraLush[fc] = Math.min(flTarget, floraLush[fc] + dt / FLORA_GROW_MS);
      else if (flTarget < floraLush[fc]) floraLush[fc] = Math.max(flTarget, floraLush[fc] - dt / FLORA_FADE_MS);
    }
    return 1;
  }

  // Vrai si un mycelium bien vivant est a portee horizontale ET proche de la surface a cette
  // position (voir GRASS_MYC_REACH/GRASS_MYC_SURFACE_DEPTH) : le gazon ne profite que d'un
  // reseau actif juste sous lui, pas d'un mycelium enfoui loin en profondeur.
  function grassHasMycUnder(x) {
    var surf = surfaceAt(x);
    for (var i = 0; i < colonised.length; i++) {
      var c = colonised[i];
      if (c.myc > MYC_READY && Math.abs(c.x - x) < GRASS_MYC_REACH && c.y - surf < GRASS_MYC_SURFACE_DEPTH) return true;
    }
    return false;
  }

  // Lessivage : chaque humus meuble descend d'un cran (transfert vers une facette meuble
  // juste en dessous), sauf si le mycelium le retient. S'applique sur TOUTE la largeur du
  // monde (l'averse couvre tout, voir updateRainDrops) ; la probabilite grimpe avec
  // rainLevel. Arrive au fond de la couche meuble, l'humus s'enfonce dans la couche
  // compacte (compactNutri) au lieu de rester bloque contre elle.
  // Enfoncement des depots deja dans le compact : bon marche (juste compactNutri.length
  // additions), contrairement a la recherche de voisine ci-dessous (leach()). C'est la SEULE
  // partie qui doit vraiment suivre le nombre de pas de vTime ecoules (steps) — sans
  // multiplicateur, une tempete faisait descendre le nutriment jusqu'au compact plus vite
  // mais son enfoncement AU-DELA (celui qui finit par le sortir de depthReach, donc de la
  // portee des racines) restait a vitesse normale, bien trop lent pour jamais depasser cette
  // portee : rien ne se perdait vraiment, l'arbre avait toujours le temps de tout manger.
  function sinkCompactNutri(steps) {
    var stormMult = weather.storm ? STORM_LEACH_MULT : 1;
    for (var di = compactNutri.length - 1; di >= 0; di--) {
      var dep = compactNutri[di];
      // Sous une plaque rocheuse (plus compacte que la terre), l'enfoncement est plus lent.
      var rockMult = rocky[Math.max(0, Math.min(rocky.length - 1, Math.round(dep.x / COL_W)))] ? ROCK_LEACH_MULT : 1;
      dep.y = Math.min(worldH - BEDROCK_MARGIN - 5, dep.y + COMPACT_SINK_SPEED * rockMult * stormMult * steps * (0.5 + Math.random()));
    }
  }

  function leach(now) {
    var stormMult = weather.storm ? STORM_LEACH_MULT : 1;
    var leachP = LEACH_P * (0.5 + rainLevel) * stormMult;
    var leafP = LEAF_RAIN_P * (0.5 + rainLevel) * stormMult;
    for (var i = 0; i < shards.length; i++) {
      var s = shards[i];
      if (s.leaf && s.settled && !s.bonus && Math.random() < (s.branch ? leafP * WOOD_RAIN_MULT : leafP)) rainLeaf(s);
      if (!s.settled || !s.nutri || s.leachTick === frame) continue;
      if (heldByMycelium(s.x, s.y, s.nutriSince)) {
        if (!(leachTipSeen & 2) && s.x > camX && s.x < camX + W) leachTip(2, CAPTION_HELD);
        continue;
      }
      // Sur la roche (meme recouverte de terre meuble), le lessivage est plus lent.
      if (Math.random() > (rocky[Math.max(0, Math.min(rocky.length - 1, Math.round(s.x / COL_W)))] ? leachP * ROCK_LEACH_MULT : leachP)) continue;
      if (!(leachTipSeen & 1) && s.x > camX && s.x < camX + W) leachTip(1, CAPTION_LEACH);
      var best = null, bestDy = Infinity;
      for (var j = 0; j < shards.length; j++) {
        var o = shards[j];
        if (o === s || !o.settled || o.nutri || o.myc || o.leaf || o.deadMyc) continue;
        var dx = o.x - s.x, dy = o.y - s.y;
        if (Math.abs(dx) > 8 || dy < 3 || dy > 20) continue;
        if (dy < bestDy) { bestDy = dy; best = o; }
      }
      if (best) {
        toNutriColor(best);
        best.leachCount = (s.leachCount || 0) + 1; // a fait un cran de plus vers les racines
        best.leachTick = frame; // un seul cran par passage, meme si on la croise plus loin dans la boucle
        best.nutriSince = s.nutriSince; // l'age de l'humus suit le lessivage, ne repart pas a zero
        toEarthColor(s);
      } else {
        var col = Math.max(0, Math.min(compactY.length - 1, Math.round(s.x / COL_W)));
        compactNutri.push({ x: s.x, y: compactY[col] + 5 + Math.random() * 20, color: NUTRI[(Math.random() * NUTRI.length) | 0] });
        // La facette s'enfonce dans le compact : sa matiere est desormais representee
        // UNIQUEMENT par le depot compactNutri ci-dessus. Il faut donc la retirer du tas
        // (hauteur ET facette elle-meme) plutot que la laisser en terre normale : sinon
        // chaque lessivage cree de la matiere en plus au lieu de la deplacer (le depot
        // fera pousser une feuille, en plus de la facette qui reste plantee dans le sol),
        // ce qui fait grossir les buttes indefiniment meme a fort ruissellement.
        pileRemove(s);
        shards.splice(i, 1);
        i--;
      }
    }
  }

  // Petite descente d'une feuille tombee (voir LEAF_RAIN_*) : plafonnee par averse
  // (weather.startedAt), arretee par le compact ou une autre feuille juste en dessous. Une
  // feuille deja mangee par du mycelium (l.bonus) ne bouge pas : elle est deja au bon endroit.
  function rainLeaf(s) {
    if (s.rainEpisode !== weather.startedAt) { s.rainEpisode = weather.startedAt; s.rainDrop = 0; }
    if (s.rainDrop >= LEAF_RAIN_MAX_DROP * (s.branch ? WOOD_RAIN_MULT : 1)) return;
    var col = Math.max(0, Math.min(compactY.length - 1, Math.round(s.x / COL_W)));
    var ny = s.y + LEAF_RAIN_STEP;
    if (ny > compactY[col] - 3) return;
    for (var j = 0; j < shards.length; j++) {
      var o = shards[j];
      if (o === s || !o.leaf || !o.settled) continue;
      if (Math.abs(o.x - s.x) < 8 && o.y > s.y && o.y - ny < 4) return;
    }
    s.y = ny;
    s.rainDrop += LEAF_RAIN_STEP;
  }

  var DEAD_MYC_DECOMPOSE_P = 0.01; // chance par tick de lessivage qu'un mycelium mort humide se decompose en nutriment normal (~10s d'averse en moyenne)

  // Decomposition du mycelium mort de secheresse (voir stepMycelium) : seule l'humidite d'une
  // averse le fait pourrir en nutriment, comme du bois mort ordinaire. Meme cadence que leach().
  function decomposeDeadMyc() {
    for (var i = deadMyc.length - 1; i >= 0; i--) {
      var c = deadMyc[i];
      if (!c.settled || Math.random() > DEAD_MYC_DECOMPOSE_P) continue;
      c.deadMyc = false; c.mycParent = null;
      toNutriColor(c);
      deadMyc.splice(i, 1);
    }
  }

  // Fondu d'entree/sortie des nuages : monte pendant RAIN_FADE_MS au debut de l'averse,
  // redescend pendant RAIN_FADE_MS avant sa fin programmee (weather.changeAt).
  function drawClouds() {
    if (!weather.clouds.length) return;
    var now = vTime;
    var alpha = Math.min(1, (now - weather.startedAt) / RAIN_FADE_MS, (weather.changeAt - now) / RAIN_FADE_MS);
    alpha = Math.max(0, Math.min(1, alpha));
    if (alpha <= 0) return;
    var CLOUD = ['#e9edf0', '#d7dee2', '#c7d0d6'];
    var cy = camY + H * RAIN_CLOUD_Y_FRAC, n = 5;
    ctx.save();
    ctx.globalAlpha = alpha;
    for (var ci = 0; ci < weather.clouds.length; ci++) {
      var cl = weather.clouds[ci], w = cl.w, x0base = cl.x - w / 2;
      for (var k = 0; k < n; k++) {
        var x0 = x0base + (w / n) * k, x1 = x0base + (w / n) * (k + 1);
        var bump = w * 0.18 * (0.6 + Math.sin(k * 1.7 + ci) * 0.4);
        ctx.fillStyle = CLOUD[k % CLOUD.length];
        poly([[x0, cy + 6], [x1, cy + 6], [(x0 + x1) / 2, cy - bump]]);
      }
    }
    ctx.restore();
  }

  function drawRain() {
    for (var i = 0; i < drops.length; i++) {
      var d = drops[i];
      ctx.fillStyle = '#bfe0ef';
      poly([[d.x - 1.5, d.y - 6], [d.x + 1.5, d.y - 6], [d.x, d.y + 6]]);
    }
    drawClouds();
  }

  // Outil fertilisant : depose quelques nutriments en surface, a l'endroit vise.
  function dropFertilizer(x) {
    var t = Date.now();
    if (t - fertLastAt < FERT_MIN_MS) return;
    if (money < FERT_COST) { setCaption(CAPTION_NEED_MONEY_FERT); return; }
    fertLastAt = t;
    fertDropped = true;
    if (window.sporaSfx) sporaSfx.play('plant');
    money -= FERT_COST;
    updateMoneyUI();
    for (var i = 0; i < FERT_COUNT; i++) {
      var fx = x + (Math.random() - 0.5) * FERT_SPREAD;
      var col = Math.max(0, Math.min(heights.length - 1, Math.round(fx / COL_W)));
      spawnNutrientShard(fx, compactY[col] - heights[col], col, GRASS_NUTRI_AREA, vTime);
    }
    startLoop();
  }

  // Outil gazon : augmente la couverture de gazon dans une zone.
  function seedGrass(x) {
    var t = Date.now();
    if (t - grassLastAt < GRASS_SEED_MIN_MS) return;
    if (money < GRASS_SEED_COST) { setCaption(CAPTION_NEED_MONEY_GRASS); return; }
    grassLastAt = t;
    if (window.sporaSfx) sporaSfx.play('plant');
    money -= GRASS_SEED_COST;
    updateMoneyUI();
    for (var i = 0; i < 5; i++) {
      var fx = x + (Math.random() - 0.5) * GRASS_SEED_SPREAD;
      var col = Math.max(0, Math.min(grassCover.length - 1, Math.round(fx / COL_W)));
      if (grassCover[col] < 1) {
        grassCover[col] = Math.min(1, grassCover[col] + GRASS_SEED_BOOST);
      }
    }
    startLoop();
  }

  // Aide au placement du mycelium : tant que le visiteur n'a pas nourri un mycelium avec du bois
  // (mycFedOnce, voir stepTrees), un halo marque le pied des arbres matures et la fleche du
  // menu d'outils reste affichee.
  var mycFedOnce = guideFlags.fed, MYC_HALO_GROWTH = 0.6, MYC_NEAR_TREE = 260;
  function matureTrees() {
    var out = [];
    for (var i = 0; i < trees.length; i++) if (trees[i].growth >= MYC_HALO_GROWTH) out.push(trees[i]);
    return out;
  }
  function drawMycHalo() {
    var gs = guideCurrent();
    if (!gs || !gs.halo || !unlockedStrains.length) return;
    var pulse = 0.5 + 0.5 * Math.sin(vTime / 420);
    var list = matureTrees();
    for (var i = 0; i < list.length; i++) {
      var hx = list[i].x, hy = surfaceAt(hx), rr = U * 0.07 * (0.9 + 0.2 * pulse);
      ctx.save();
      ctx.translate(hx, hy);
      ctx.scale(1, 0.32);
      ctx.beginPath();
      ctx.arc(0, 0, rr, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(243,201,74,' + (0.16 + 0.12 * pulse).toFixed(3) + ')';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(243,201,74,' + (0.55 + 0.35 * pulse).toFixed(3) + ')';
      ctx.stroke();
      ctx.restore();
    }
    if (list.length) startLoop();
  }
  // Vrai si aucun arbre mature ni bois au sol n'est a portee de x : le mycelium verse la
  // va s'eteindre faute de nourriture.
  function nearMatureTree(x) {
    for (var i = 0; i < trees.length; i++) if (trees[i].growth >= MYC_HALO_GROWTH && Math.abs(trees[i].x - x) < MYC_NEAR_TREE) return true;
    return false;
  }
  // Tutoriel : le mycelium doit etre verse au pied de l'arbre (la ou tombe le bois), pas juste a cote.
  var MYC_UNDER_TREE = 120;
  // Demo : le sol au pied de l'arbre du tutoriel (makeStartTree, t.tuto) ne se creuse pas et son
  // gazon ne s'arrache pas, sinon le tutoriel du mycelium peut devenir infaisable. Les abords
  // d'un tresor encore enfoui restent creusables : il faut pouvoir finir la demo.
  var DEMO_GUARD_TREASURE = 45;
  function demoGuard(x) {
    if (!DEMO) return false;
    var r = Math.min(MYC_UNDER_TREE, UW * 0.1), i, hit = false;
    for (i = 0; i < trees.length && !hit; i++) hit = !!trees[i].tuto && Math.abs(trees[i].x - x) < r;
    if (!hit) return false;
    for (i = 0; i < treasures.length; i++) if (!treasures[i].revealed && Math.abs(treasures[i].x - x) < DEMO_GUARD_TREASURE) return false;
    return true;
  }
  function underMatureTree(x) {
    for (var i = 0; i < trees.length; i++) if (trees[i].growth >= MYC_HALO_GROWTH && Math.abs(trees[i].x - x) < MYC_UNDER_TREE) return true;
    return false;
  }
  function noWoodNear(x) {
    var i;
    for (i = 0; i < trees.length; i++) if (trees[i].growth >= MYC_HALO_GROWTH && Math.abs(trees[i].x - x) < MYC_DECOMPOSE_REACH * 1.6) return false;
    for (i = 0; i < litter.length; i++) if (Math.abs(litter[i].x - x) < MYC_DECOMPOSE_REACH) return false;
    return true;
  }

  function setTool(name) {
    if (!name || name === tool) return;
    if (window.sporaSfx) sporaSfx.play('toolSwitch'); 
    leaveShovel();
    leaveBag();
    leaveHand();
    tool = name;
    updateStrainBar();
    container.classList.toggle('is-planting', name === 'tree');
    if (name === 'mycelium' && unlockedStrains.length) guideSet('myc'); // sans souche debloquee, prendre l'outil ne compte pas (le tutoriel resterait sur la barre)
    for (var i = 0; i < toolBtns.length; i++) {
      // Le gazon n'a pas de bouton dans la barre d'outils : le bouton mycelium (dont la barre
      // contient le bouton gazon) reste actif, sinon tous les boutons sont replies et la barre disparait.
      var on = toolBtns[i].getAttribute('data-tool') === (name === 'grass' ? 'mycelium' : name);
      toolBtns[i].classList.toggle('is-active', on);
      toolBtns[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    startLoop();
  }

  // --- Arbres -----------------------------------------------------------------------
  function makeTree(x) {
    var now = vTime, slots = [], DEG = Math.PI / 180;
    var rx = U * 0.2, ry = U * 0.13;
    // Branches maitresses : bouts en eventail sur le demi-plan superieur (200-340 deg, la
    // branche du milieu pointe vers le haut), dans l'ellipse du houppier. Les branches
    // laterales partent plus bas sur le tronc. f = hauteur de depart, en fraction de h
    // depuis le sommet (suit la croissance) ; dx/dy = bout, offset depuis le sommet du
    // tronc (multiplie par treeScale au dessin, comme les slots) ; bend = coude du milieu ;
    // mj/a0 = jitter pre-calcule de la masse de feuillage (evite le scintillement).
    var limbs = [], li, j;
    for (li = 0; li < CANOPY_LIMBS; li++) {
      var la = (200 + 140 * (CANOPY_LIMBS > 1 ? li / (CANOPY_LIMBS - 1) : 0.5) + (Math.random() - 0.5) * 14) * DEG;
      var ld = 0.6 + Math.random() * 0.35;
      var lf0 = Math.max(0, Math.min(1, 0.35 + 0.65 * Math.abs(Math.cos(la)) + (Math.random() - 0.5) * 0.3));
      var mj = [];
      for (j = 0; j < 7; j++) mj.push(0.78 + Math.random() * 0.4);
      limbs.push({
        f: 0.05 + 0.25 * lf0, dx: Math.cos(la) * rx * ld, dy: Math.sin(la) * ry * ld,
        bend: (Math.random() < 0.5 ? -1 : 1) * (0.06 + Math.random() * 0.1), mj: mj, a0: Math.random() * Math.PI * 2
      });
    }
    // Places de feuilles : en round-robin sur les bouquets (les N premieres places debloquees
    // touchent donc tous les bouquets), autour du bout de leur branche (disque un peu aplati).
    for (var i = 0; i < 40; i++) {
      var sa = Math.random() * Math.PI * 2, sr = Math.sqrt(Math.random()) * CANOPY_CLUSTER_R * U, lm = limbs[i % CANOPY_LIMBS];
      slots.push({ dx: lm.dx + Math.cos(sa) * sr, dy: lm.dy + Math.sin(sa) * sr * 0.8, leaf: null, limb: i % CANOPY_LIMBS });
    }
    // Racines dessinees : 6 racines laterales alternees gauche/droite, qui partent en
    // biais (20-45 deg sous l'horizontale) et plongent de plus en plus (gravitropisme),
    // chacune avec une fourche. Longueur volontairement plus courte que la portee de
    // recherche de nutriment (voir ROOT_VISUAL_REACH plus haut). Points pre-calcules ici :
    // rien ne bouge d'une frame a l'autre. Chaque racine = { pts, forkAt, fork }.
    var roots = [], reach = U * ROOT_VISUAL_REACH;
    for (i = 0; i < 6; i++) {
      var side = i % 2 ? 1 : -1, len = (0.45 + Math.random() * 0.55) * reach, nseg = 5 + (Math.random() < 0.5 ? 1 : 0);
      var ang = (20 + Math.random() * 25) * DEG, pts = [[0, 0]], px = 0, py = 0, segL = len / nseg;
      var fk = 0.4 + Math.random() * 0.25, forkAt = -1, forkAng = 0;
      for (var k = 0; k < nseg; k++) {
        ang += (10 + Math.random() * 10) * DEG;
        var a2 = Math.min(ang + (Math.random() - 0.5) * 8 * DEG, 85 * DEG);
        px += side * Math.cos(a2) * segL; py += Math.sin(a2) * segL;
        pts.push([px, py]);
        // La fourche part du premier point situe apres fk x longueur (angle local retenu).
        if (forkAt < 0 && (k + 1) / nseg >= fk) { forkAt = k + 1; forkAng = a2; }
      }
      // Fourche : diverge de 20-35 deg, vers l'exterieur (angle moins raide) ou vers le bas.
      var dv = (20 + Math.random() * 15) * DEG, fa = Math.random() < 0.5 ? forkAng - dv : forkAng + dv;
      fa = Math.max(5 * DEG, Math.min(fa, 88 * DEG));
      var fLen = len * (1 - forkAt / nseg) * (0.4 + Math.random() * 0.2) + segL * 0.5, fx = pts[forkAt][0], fy = pts[forkAt][1], fpts = [[fx, fy]];
      for (k = 1; k <= 3; k++) {
        fa = Math.min(fa + (5 + Math.random() * 8) * DEG, 88 * DEG);
        fx += side * Math.cos(fa) * fLen / 3; fy += Math.sin(fa) * fLen / 3;
        fpts.push([fx, fy]);
      }
      roots.push({ pts: pts, forkAt: forkAt, fork: fpts });
    }
    // Hauteur relative au ciel VISIBLE (H moins la zone cachee sous le header, voir
    // CAMERA_TOP_DEADZONE) plutot qu'a H au complet : sinon un arbre bien nourri
    // (TREE_SCALE_MAX) a sa cime qui finit cachee sous le header, sans que la camera
    // puisse jamais remonter assez pour la reveler (camY ne descend jamais sous 0).
    var t = { x: x, h: (U - CAMERA_TOP_DEADZONE) * 0.42, slots: slots, limbs: limbs, roots: roots, nextEat: now + EAT_MS, eaten: 0, growth: 0, lastAte: now, flowers: [] };
    // Quelques feuilles au depart, d'ages varies : on reconnait un arbre tout de suite.
    for (i = 0; i < 8; i++) addLeaf(t, now - Math.random() * LEAF_LIFE_MS[0] * 0.6);
    return t;
  }

  // Arbre de depart deja bien nourri (presque mature), avec un feuillage fourni.
  function makeStartTree(x, eaten) {
    // Cherche vers la gauche (on reste au bord de l'ecran, loin du tas du logo) une zone
    // sans roche ni eau sur 4 colonnes de chaque cote.
    var maxX = (heights.length - 1) * COL_W, nx = null, cx, d, ok;
    for (cx = x; cx >= x - UW * 0.2 && nx === null; cx -= COL_W) {
      ok = true;
      for (d = -4; d <= 4 && ok; d++) {
        var px = cx + d * COL_W;
        if (px < 0 || px > maxX || isRocky(px) || isSubmerged(px)) ok = false;
      }
      if (ok) nx = cx;
    }
    if (nx === null) nx = nearestTreeX(x);
    var t = makeTree(nx === null ? x : nx);
    t.tuto = true; // l'arbre du tutoriel : son pied est protege en demo (demoGuard)
    t.eaten = Math.min(MATURE_NUTRIENTS, eaten);
    t.growth = Math.min(1, t.eaten / MATURE_NUTRIENTS);
    for (var k = 8; k < Math.round(unlockedSlots(t) * 0.7); k++) addLeaf(t, vTime - Math.random() * LEAF_LIFE_MS[0] * 0.6);
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
    return lerp(TREE_SCALE_MIN, TREE_SCALE_MAX, t.growth) + TALL_SCALE_MAX * treeTall(t);
  }
  function treeTall(t) { return Math.min(1, (t.surplus || 0) / TALL_FULL); }

  // Plante un nouvel arbre (TREE_COST) si on n'est pas trop pres d'un autre
  // (TREE_MIN_SPACING). Pas de plafond : seul le prix limite le nombre.
  function plantTree(x) {
    if (isRocky(x) || isSubmerged(x)) return false;
    for (var i = 0; i < trees.length; i++) {
      if (Math.abs(trees[i].x - x) < TREE_MIN_SPACING) return false;
    }
    var cost = nextTreeCost(), useFree = cost > 0 && freeTrees > 0;
    if (!useFree && money < cost) { setCaption('Il faut ' + cost + ' $ pour planter un arbre — récoltez des champignons à la main.'); return false; }
    if (useFree) freeTrees--; else money -= cost;
    updateMoneyUI();
    var planted = makeTree(x);
    planted.planted = true;
    trees.push(planted);
    chPlanted++;
    savePlayerIfChanged();
    if (!worldSaveOff) saveWorld(); // sauvegarde immediate : un arbre paye ne doit pas se perdre
    if (window.sporaSfx) sporaSfx.play('plant'); 
    treeLife = true;
    startLoop();
    return true;
  }

  // Retire un nutriment du monde (facette ou depot) : partage entre le repas normal et le
  // cout d'une branche bonus (voir stepTrees).
  function eatNutrient(item, now) {
    if (item.kind === 'shard') {
      pileRemove(item.ref);
      item.ref.settled = false;
      item.ref.eaten = now;
    } else {
      compactNutri.splice(compactNutri.indexOf(item.ref), 1);
    }
  }

  // Une place peut recevoir une feuille si elle est vide et que sa branche maitresse n'est
  // pas cassee (voir breakLimb).
  function slotOpen(t, sl) {
    return !sl.leaf && !(sl.limb !== undefined && t.limbs[sl.limb].broken !== undefined);
  }

  // Facette d'une feuille qui quitte son arbre (chute naturelle, ou arrachee a la main),
  // couleur de son age (0..1) ; posee ensuite comme n'importe quelle feuille (litiere).
  function makeLeafShard(lf, x, y, age, wm) {
    var pts = leafTri(lf.size, lf.rot);
    return {
      wm: wm || 1,
      pts: pts, x: x, y: y, vx: (Math.random() - 0.5) * 0.6, vy: 0,
      rot: 0, vr: (Math.random() - 0.5) * 0.06, from: leafColor(age),
      to: hexToRgb(NUTRI[(Math.random() * NUTRI.length) | 0]), mix: 0,
      area: triArea(pts), settled: false, col: -1, leaf: true, extra: true, sway: Math.random() * 6,
      gust: Math.pow(Math.random(), 2) * 3
    };
  }

  // Le bois d'une branche : memes chutes/litiere qu'une feuille (leaf:true), mais une
  // decomposition bien plus lente (branch:true, voir BRANCH_LITTER_MS plus bas) et une
  // couleur de bois plutot que de feuille fanee. pts : forme (triangle) ; par defaut un
  // triangle de feuille agrandi.
  function makeWoodShard(x, y, pts) {
    pts = pts || leafTri(U * 0.05, Math.random() * Math.PI * 2);
    return {
      pts: pts, x: x, y: y, vx: (Math.random() - 0.5) * 0.4, vy: 0,
      rot: 0, vr: (Math.random() - 0.5) * 0.04, from: [107, 74, 48],
      to: hexToRgb(NUTRI[(Math.random() * NUTRI.length) | 0]), mix: 0,
      area: triArea(pts), settled: false, col: -1, leaf: true, extra: true, branch: true,
      sway: Math.random() * 6, gust: Math.pow(Math.random(), 2) * 1.5
    };
  }

  // Une branche bonus quitte son arbre (vieillesse dans stepTrees, ou arrachee a la main) :
  // sa fleur fane, sa feuille (s'il y en a une) et son bois deviennent des facettes libres.
  // L'appelant retire la place de t.slots. Retourne la facette de bois. leafByAge : vrai =
  // la feuille garde la couleur de son age, faux = feuille morte (comme avant).
  function shedBranchSlot(t, sl, now, woodPts, leafByAge) {
    var tg = treeScale(t), by = t.by !== undefined ? t.by : surfaceAt(t.x) + TREE_EMBED;
    var x = t.x + sl.dx * tg, y = by - t.h * tg + sl.dy * tg;
    // La fleur (s'il y en a une) fane avec sa branche, elle ne disparait pas d'un coup.
    if (sl.flower && sl.flower.wilt === null) sl.flower.wilt = now;
    if (sl.leaf) shards.push(makeLeafShard(sl.leaf, x, y, leafByAge ? leafAgeOf(sl.leaf, now) : 1));
    sl.leaf = null;
    var wood = makeWoodShard(x, y, woodPts);
    shards.push(wood);
    return wood;
  }

  function addLeaf(t, born) {
    var free = t.slots.slice(0, unlockedSlots(t)).filter(function (sl) { return slotOpen(t, sl); });
    if (!free.length) return false;
    free[(Math.random() * free.length) | 0].leaf = {
      born: born, life: lerp(LEAF_LIFE_MS[0], LEAF_LIFE_MS[1], Math.random()),
      rot: Math.random() * Math.PI * 2, size: U * (0.028 + Math.random() * 0.016)
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

  // Fleurs vivantes (pas encore fanees) d'un arbre : sert au plafond FLOWER_MAX_PER_TREE.
  function countLiveFlowers(t) {
    var n = 0;
    for (var i = 0; i < t.flowers.length; i++) if (t.flowers[i].wilt === null) n++;
    return n;
  }

  // Fait eclore une fleur au pied de l'arbre pour accompagner une branche bonus qui vient de
  // naitre (voir l'appel dans stepTrees) : purement decoratif, sans le moindre effet sur le
  // jeu. Tire jusqu'a 10 positions candidates dans le rayon actuel du houppier (comme la
  // portee de la flore, FLORA_TREE_R_MIN/MAX) et retient la premiere qui tombe sur du gazon
  // bien etabli, hors roche, et assez loin de toute autre fleur (tous arbres confondus) ;
  // sinon renonce silencieusement cette fois-ci, sans jamais faire echouer la branche.
  function spawnFlower(t, slot, now) {
    if (countLiveFlowers(t) >= FLOWER_MAX_PER_TREE) return;
    var R = U * lerp(FLORA_TREE_R_MIN, FLORA_TREE_R_MAX, t.growth);
    var trunkW = U * 0.035 * treeScale(t);
    for (var attempt = 0; attempt < 10; attempt++) {
      var side = Math.random() < 0.5 ? -1 : 1;
      var dist = lerp(trunkW * 2.5, R, Math.random());
      var x = t.x + side * dist;
      var col = Math.max(0, Math.min(grassCover.length - 1, Math.round(x / COL_W)));
      if (!(grassCover[col] > 0.5) || isRocky(x)) continue;
      var tooClose = false;
      for (var ti = 0; ti < trees.length && !tooClose; ti++) {
        var others = trees[ti].flowers;
        for (var fi = 0; fi < others.length; fi++) {
          if (Math.abs(others[fi].x - x) < FLOWER_MIN_SPACING) { tooClose = true; break; }
        }
      }
      if (tooClose) continue;
      var fl = {
        x: x, col: col, born: now + BRANCH_GROW_MS, wilt: null,
        lean: (Math.random() - 0.5) * 0.36,          // inclinaison de la tige, -0.18..0.18 rad
        faceTilt: 0.35 + Math.random() * 0.2,        // ecrasement vertical (vue de trois-quarts) de la corolle
        rot: Math.random() * Math.PI * 2,            // angle de depart de l'etoile de petales
        sizeK: 0.85 + Math.random() * 0.3,           // variation de taille globale
        leafSide: Math.random() < 0.5 ? -1 : 1       // cote de la petite feuille sur la tige
      };
      t.flowers.push(fl);
      slot.flower = fl;
      return;
    }
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
      var branchesFallen = null;
      // Une branche maitresse cassee a la main repousse apres LIMB_REGROW_MS (elle
      // reapparait sans feuilles, l'arbre les regarnit ensuite normalement).
      for (i = 0; i < t.limbs.length; i++) {
        var lmB = t.limbs[i];
        if (lmB.broken === undefined) continue;
        if (now - lmB.broken > LIMB_REGROW_MS) lmB.broken = undefined;
        else state = Math.max(state, 1);
      }
      for (i = 0; i < t.slots.length; i++) {
        var sl = t.slots[i], lf = sl.leaf;
        // Branche bonus devenue vieille : elle tombe pour de bon (pas juste sa feuille,
        // voir la section "Branches bonus" plus haut), liberant sa place pour qu'une
        // nouvelle puisse repousser la prochaine fois qu'il y a assez de nutriments.
        if (sl.branch && now - sl.branchSince > BONUS_BRANCH_LIFE_MS) {
          shedBranchSlot(t, sl, now, null, false);
          (branchesFallen || (branchesFallen = [])).push(i);
          state = 2;
          continue;
        }
        if (!lf) continue;
        var age = (now - lf.born) / lf.life;
        if (age < 1) {
          state = Math.max(state, now - lf.born < LEAF_GROW_MS ? 2 : 1);
          continue;
        }
        // Feuille morte : elle se detache et tombe (devient une facette du monde).
        sl.leaf = null;
        var tg = treeScale(t);
        shards.push(makeLeafShard(lf, t.x + sl.dx * tg, by - t.h * tg + sl.dy * tg, 1, lerp(SMALL_WIND_MULT, 1, t.growth) + (TALL_WIND_MULT - 1) * treeTall(t)));
        state = 2;
      }
      if (branchesFallen) for (var bf = branchesFallen.length - 1; bf >= 0; bf--) t.slots.splice(branchesFallen[bf], 1);
      if (now >= t.nextEat) {
        // Les racines vont chercher plus loin a mesure que l'arbre grandit (t.growth), et
        // visent en priorite le nutriment le plus profond a portee (pas le plus proche
        // horizontalement) : c'est celui qui risque le plus de couler hors de depthReach au
        // prochain lessivage, donc celui qu'il vaut mieux recuperer avant d'en perdre un
        // autre. La profondeur de recherche est elle aussi limitee (ROOT_DEPTH) : un
        // nutriment lessive trop profond dans le compact (voir leach()) est hors de portee
        // tant que la pelle ne l'a pas ramene plus haut (cutCompact).
        var g = lerp(ROOT_GROWTH_MIN, 1, t.growth);
        var reach = UW * ROOT_REACH * g, depthReach = U * lerp(ROOT_DEPTH_MIN, ROOT_DEPTH_MAX, t.growth), surf = surfaceAt(t.x);
        var eligible = [];
        for (i = 0; i < shards.length; i++) {
          var s = shards[i];
          if (!s.nutri || !s.settled || s.y > surf + depthReach || !isNutriRipe(s, now)) continue;
          if (Math.abs(s.x - t.x) >= reach) continue;
          eligible.push({ kind: 'shard', ref: s, y: s.y });
        }
        for (var ni = 0; ni < compactNutri.length; ni++) {
          var dep = compactNutri[ni];
          if (dep.y > surf + depthReach) continue;
          if (Math.abs(dep.x - t.x) >= reach) continue;
          eligible.push({ kind: 'deposit', ref: dep, y: dep.y });
        }
        var nearCount = eligible.length;
        eligible.sort(function (a, b) { return b.y - a.y; }); // le plus profond en premier
        t.nextEat = now + (nearCount > ABUNDANCE_THRESHOLD ? EAT_MS / ABUNDANCE_EAT_MULT : EAT_MS);
        var best = eligible.length ? eligible[0] : null;
        if (best && t.slots.slice(0, unlockedSlots(t)).some(function (x) { return slotOpen(t, x); })) {
          eatNutrient(best, now);
          addLeaf(t, now + EATEN_MS); // la feuille sort quand le nutriment a fini d'etre absorbe
          // Plus il mange de nutriments, plus il grandit : racines plus longues, plus de
          // feuilles possibles, tronc/houppier plus grands (voir drawTree/drawRoots).
          if (t.growth >= 1) t.surplus = (t.surplus || 0) + 1;
          t.eaten++;
          t.growth = Math.min(1, t.eaten / MATURE_NUTRIENTS);
          t.lastAte = now;
          state = 2;
        }
        // Abondance : indice ou l'on est rendu dans eligible (0 = deja mange comme "best"
        // ci-dessus). Priorite au remplissage de feuilles AVANT de depenser pour une
        // nouvelle branche : sans ca, une branche ajoute une place vide a chaque cycle
        // abondant alors qu'une seule feuille pousse par cycle normalement — la capacite
        // grandit plus vite que le remplissage et l'arbre finit "nu" (plein de branches sans
        // feuilles) malgre un sol tres nourricier.
        var usedIdx = 1;
        if (nearCount > ABUNDANCE_THRESHOLD) {
          var freeSlots = t.slots.slice(0, unlockedSlots(t)).filter(function (x) { return slotOpen(t, x); }).length;
          var extraLeaves = Math.min(ABUNDANCE_LEAF_FILL, freeSlots, eligible.length - usedIdx);
          for (var el = 0; el < extraLeaves; el++) {
            eatNutrient(eligible[usedIdx], now);
            addLeaf(t, now + EATEN_MS);
            if (t.growth >= 1) t.surplus = (t.surplus || 0) + 1;
            usedIdx++;
          }
        }
        // Branche bonus (voir sa section plus haut) : payee en nutriments pris APRES ceux
        // deja utilises pour remplir des feuilles ci-dessus, jamais avant.
        if (nearCount > ABUNDANCE_THRESHOLD && t.growth >= 1 && eligible.length - usedIdx >= BONUS_BRANCH_COST) {
          var bonusCount = 0;
          for (var bi = 0; bi < t.slots.length; bi++) if (t.slots[bi].branch) bonusCount++;
          if (bonusCount < BONUS_BRANCH_MAX) {
            for (var bc = 0; bc < BONUS_BRANCH_COST; bc++) { eatNutrient(eligible[usedIdx], now); usedIdx++; }
            var ba = Math.random() * Math.PI * 2, bdist = 1 + Math.random() * 0.25; // un peu hors du houppier normal
            var newBranch = { dx: Math.cos(ba) * U * 0.2 * bdist, dy: Math.sin(ba) * U * 0.13 * bdist, leaf: null, branch: true, branchSince: now };
            t.slots.push(newBranch);
            spawnFlower(t, newBranch, now); // fleur cosmetique au pied de l'arbre, cf. section "Flore"
            state = 2;
          }
        }
      }
      // Arbre affame : sans avoir mange depuis TREE_STARVE_MS, il perd un nutriment
      // toutes les TREE_SHRINK_MS (jamais sous l'etat du nouveau-ne). Les feuilles des
      // places qu'il perd alors tombent aussitot (litiere), ce qui rend leurs nutriments
      // au sol comme une chute normale.
      if (now - t.lastAte > TREE_STARVE_MS) {
        if (t.nextShrink === undefined) t.nextShrink = now + TREE_SHRINK_MS;
        if (now >= t.nextShrink && t.surplus > 0) {
          t.nextShrink = now + TREE_SHRINK_MS;
          t.surplus = Math.max(0, t.surplus - 1);
          state = Math.max(state, 1);
        } else if (now >= t.nextShrink && t.eaten > 0) {
          t.nextShrink = now + TREE_SHRINK_MS;
          t.eaten = Math.max(0, t.eaten - 1);
          t.growth = Math.min(1, t.eaten / MATURE_NUTRIENTS);
          var unlocked = unlockedSlots(t);
          for (i = unlocked; i < t.slots.length; i++) {
            var sl2 = t.slots[i];
            if (sl2.leaf) sl2.leaf.born = now - sl2.leaf.life;
          }
          state = Math.max(state, 1);
        }
      } else {
        t.nextShrink = undefined;
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
      var fed = false, fruitCell = null;
      for (var ci = 0; ci < colonised.length; ci++) {
        var c = colonised[ci];
        if (Math.abs(c.x - l.x) < MYC_DECOMPOSE_REACH && Math.abs(c.y - l.y) < MYC_DECOMPOSE_REACH) {
          c.lastFed = now;
          fed = true;
          if (c.settled && c.myc >= MYC_READY && c.y - surfaceAt(c.x) < 18) fruitCell = c;
          if (!mycFedOnce) { mycFedOnce = true; guideSet('fed'); setCaption(CAPTION_MYC_FED); }
        }
      }
      if (fed) l.bonus = (l.bonus || 0) + dt * (MYC_DECOMPOSE_MULT - 1);
      // Fructification occasionnelle : chaque morceau de bois mange donne sa chance (donc plus
      // de bois = plus de champignons), multipliee par l'humidite (pluie en cours ou recente).
      if (fruitCell) {
        if (weather.raining) lastRainAt = now;
        var wet = weather.raining ? 1 : Math.max(0, 1 - (now - lastRainAt) / FEED_FRUIT_WET_MS);
        var nMyc = 0;
        for (var mi = 0; mi < mushrooms.length; mi++) if (mushrooms[mi].myc && !mushrooms[mi].dying) nMyc++;
        if (nMyc < FEED_FRUIT_MAX && Math.random() < dt / 1000 * FEED_FRUIT_PER_S * (1 + FEED_FRUIT_WET_MULT * wet)) {
          sprout(fruitCell.x, true, fruitCell.strain || STRAIN_STD);
        }
      }
      l.mix = Math.min(1, (now - l.landed + (l.bonus || 0)) / (l.branch ? BRANCH_LITTER_MS : LITTER_MS));
      // Le bois rend sa matiere par petits bouts au fil de sa decomposition (voir la section
      // "Une branche a coute..." plus haut), pas d'un coup a la fin : un nouveau petit
      // nutriment nait a chaque tranche de progression franchie (mix*BONUS_BRANCH_COST).
      if (l.branch) {
        var due = Math.floor(l.mix * BONUS_BRANCH_COST);
        while ((l.nutriGiven || 0) < due) {
          spawnNutrientShard(l.x + (Math.random() - 0.5) * 10, l.y, l.col, WOOD_NUTRI_AREA, now);
          l.nutriGiven = (l.nutriGiven || 0) + 1;
        }
      }
    }
    // Feuille tout a fait decomposee : elle devient de l'humus, que les racines peuvent
    // reprendre. Le bois, lui, a deja rendu toute sa matiere par bouts (ci-dessus) : ce qui
    // en reste redevient juste de la terre normale, jamais un nutriment en plus.
    litter.forEach(function (l) {
      if (l.mix >= 1 && l.settled) {
        if (l.branch) toEarthColor(l); else { l.nutri = rgbStr(l.to); l.nutriSince = now; }
      }
    });
    litter = litter.filter(function (l) { return l.mix < 1 && shards.indexOf(l) >= 0; });
    if (litter.length) state = Math.max(state, 1);
    if (!state && shards.some(function (x) { return x.nutri; })) state = 1;
    return state;
  }

  // Fait vivre les fleurs cosmetiques (voir spawnFlower) : la pelle qui remue une colonne
  // (grassCover retombe a 0) fait disparaitre la fleur assise dessus tout de suite, sans
  // transition (la terre a litteralement bouge sous elle) ; une fleur fanee (branche tombee,
  // voir stepTrees) s'efface plus doucement, sur FLOWER_WILT_MS. Retourne vrai si au moins
  // une fleur est en train d'eclore ou de faner : appele depuis step(), ca force la pleine
  // cadence (sinon la boucle lente a 4 img/s rendrait ces transitions saccadees).
  function stepFlowers(now) {
    var busy = false;
    for (var ti = 0; ti < trees.length; ti++) {
      var t = trees[ti], kept = [];
      for (var i = 0; i < t.flowers.length; i++) {
        var f = t.flowers[i];
        if (grassCover[f.col] <= 0) continue;
        if (f.wilt !== null && now - f.wilt > FLOWER_WILT_MS) continue;
        kept.push(f);
        if (f.wilt !== null || (now >= f.born && now - f.born < FLOWER_BLOOM_MS)) busy = true;
      }
      t.flowers = kept;
    }
    return busy;
  }

  // Position monde du bout de la tige d'une fleur grande ouverte (voir drawFlower pour la
  // meme geometrie appliquee au dessin) : sert de cible d'atterrissage aux insectes.
  function flowerTopWorld(f) {
    var leanSign = f.lean < 0 ? -1 : 1;
    var stemH = FLOWER_H_F * U * f.sizeK;
    var curveK = stemH * 0.3 * leanSign;
    var baseX = f.x, baseY = surfaceAt(f.x) + FLORA_EMBED;
    var ca = Math.cos(f.lean), sa = Math.sin(f.lean);
    var lx = curveK, ly = -stemH;
    return [baseX + lx * ca - ly * sa, baseY + lx * sa + ly * ca];
  }

  // Vrai si une fleur ouverte (eclosion terminee, pas fletrie) est encore visible a l'ecran.
  function flowerIsOpen(f) {
    return f.wilt === null && vTime - f.born >= FLOWER_BLOOM_MS;
  }
  // Une fleur ciblee par un insecte peut disparaitre (pelle, branche tombee) sans jamais
  // etre retiree "sous nos yeux" : on revalide sa presence a chaque frame plutot que de
  // se fier a une simple reference d'objet.
  function flowerStillGood(f) {
    if (f.wilt !== null) return false;
    for (var ti = 0; ti < trees.length; ti++) if (trees[ti].flowers.indexOf(f) >= 0) return true;
    return false;
  }
  function flowerAlreadyTargeted(f) {
    for (var i = 0; i < insects.length; i++) if (insects[i].target === f) return true;
    return false;
  }
  // Premiere fleur ouverte, visible et pas deja visee, tous arbres confondus (meme marge
  // de visibilite que drawFlower).
  function pickOpenFlower() {
    for (var ti = 0; ti < trees.length; ti++) {
      var fl = trees[ti].flowers;
      for (var i = 0; i < fl.length; i++) {
        var f = fl[i];
        if (f.x < camX - 30 || f.x > camX + W + 30) continue;
        if (!flowerIsOpen(f)) continue;
        if (flowerAlreadyTargeted(f)) continue;
        return f;
      }
    }
    return null;
  }

  // Fait apparaitre un insecte hors ecran, d'un cote choisi au hasard, qui va traverser
  // vers l'autre cote. Toutes les valeurs qui varient d'un individu a l'autre (ondulation,
  // phases de battement...) sont tirees ici une fois pour toutes et stockees sur l'objet :
  // le dessin (drawInsect) ne fait plus que lire ces valeurs et l'age ecoule.
  function spawnInsect() {
    var nB = 0, nBee = 0;
    for (var ci = 0; ci < insects.length; ci++) { if (insects[ci].species === 'papillon') nB++; else nBee++; }
    var species = Math.random() < BUTTERFLY_P ? 'papillon' : 'bourdon';
    if (species === 'papillon' && nB >= BUTTERFLY_MAX) species = 'bourdon';
    if (species === 'bourdon' && nBee >= INSECT_MAX) species = nB < BUTTERFLY_MAX ? 'papillon' : null;
    if (!species) return;
    var dir = Math.random() < 0.5 ? -1 : 1;
    var startX = dir > 0 ? camX - 40 : camX + W + 40;
    var yFrac = 0.12 + Math.random() * (0.45 - 0.12);
    var sizeMult = species === 'bourdon' ? 0.7 : BUTTERFLY_SIZE_K;
    var speed = U * 0.0009 * INSECT_SPEED * (species === 'bourdon' ? 1.6 : 1);
    var ins = {
      species: species, dir: dir, sizeMult: sizeMult, speed: speed, yFrac: yFrac,
      cruiseX: startX, x: startX, y: 0, age: 0,
      phaseWing: Math.random() * Math.PI * 2,
      glideSeed: Math.random() * 3000,
      wA1: U * 0.02, wA2: U * 0.008, wT1: species === 'bourdon' ? 850 : 1700, wT2: species === 'bourdon' ? 300 : 600,
      wPh1: Math.random() * Math.PI * 2, wPh2: Math.random() * Math.PI * 2,
      zzA: species === 'bourdon' ? U * 0.01 : 0, zzT: 320 + Math.random() * 80, zzPh: Math.random() * Math.PI * 2,
      driftT: 4000 + Math.random() * 2000, driftPh: Math.random() * Math.PI * 2,
      state: 'cruise', target: null, nearFlower: false,
      landAt: 0, landDur: 0, landPh: 0
    };
    ins.y = clamp(surfaceAt(clamp(startX, 0, worldW)) - U * yFrac, camY + 10, camY + H - 10);
    if (Math.random() < INSECT_LAND_P) {
      var f = pickOpenFlower();
      if (f) { ins.target = f; ins.state = 'approach'; }
    }
    insects.push(ins);
  }

  // Capture a la main (papillons seulement) : le papillon est TENU tant qu'on appuie (il suit
  // le pointeur, grossit et bat des ailes vite), puis relache au relachement et repart en
  // fuite rapide. Aucun degat, aucun gain. Plafond de securite si le pointerup est perdu.
  var CATCH_MAX_MS = 15000;
  var heldInsect = null;                   // un seul papillon tenu a la fois
  var heldSX = 0, heldSY = 0;              // position ecran du pointeur (le monde peut defiler)
  function insectAt(wx, wy) {
    var size = U * INSECT_SIZE_F * BUTTERFLY_SIZE_K, best = null, bd = 1e9;
    for (var i = 0; i < insects.length; i++) {
      var ins = insects[i];
      if (ins.species !== 'papillon' || ins.caught) continue;
      var d = Math.hypot(wx - ins.x, wy - ins.y);
      if (d <= size * 0.95 + 14 && d < bd) { bd = d; best = ins; }
    }
    return best;
  }
  function catchInsect(ins) {
    ins.caught = true; ins.caughtAt = ins.age;
    // Un papillon pose ou en approche est arrache a sa fleur : plus de cible pendant la prise.
    ins.target = null; ins.nearFlower = false;
    heldInsect = ins;
    challengeDone(11);
  }
  // Libere le papillon tenu (s'il y en a un) : il s'enfuit. Sans effet sinon.
  function dropHeldInsect() {
    var ins = heldInsect;
    heldInsect = null;
    if (ins && ins.caught) releaseInsect(ins);
  }
  // Relachement : le papillon passe en etat 'flee' (vitesse propre integree, lissee) et
  // s'eloigne de la main. Duree en temps reel (ins.age avance avec le dt reel plafonne).
  var FLEE_MS = 1400;
  var FLEE_SPEED_K = 4;                    // vitesse de fuite = vitesse de croisiere x ce facteur
  function releaseInsect(ins) {
    ins.caught = false; ins.target = null; ins.nearFlower = false;
    var away = (hand.on && hand.x !== undefined) ? (ins.x >= hand.x ? 1 : -1) : ins.dir;
    ins.dir = away;
    ins.state = 'flee';
    ins.fleeStart = ins.age;
    ins.fvx = 0; ins.fvy = 0;
    ins.fleeVy = -U * 0.00028;             // petite montee au depart, qui s'estompe
  }
  function stepInsectFlee(ins, dt) {
    var t = ins.age - ins.fleeStart;
    var rate = Math.min(1, dt / 180);      // acceleration lissee : pas de saut de vitesse
    ins.fvx += (ins.dir * ins.speed * FLEE_SPEED_K - ins.fvx) * rate;
    ins.fvy += (ins.fleeVy * Math.max(0, 1 - t / 700) - ins.fvy) * rate;
    ins.x += ins.fvx * dt;
    ins.y = clamp(ins.y + ins.fvy * dt, camY + 10, Math.min(camY + H - 10, surfaceAt(clamp(ins.x, 0, worldW)) - U * 0.03));
    if (t >= FLEE_MS) {
      // Retour en croisiere sans saut : cruiseX absorbe la derive courante, et l'ecart
      // vertical residuel (yOff) s'estompe ensuite dans stepInsectCruise.
      var drift = Math.sin(ins.age / ins.driftT + ins.driftPh) * U * 0.006;
      ins.cruiseX = ins.x - drift;
      ins.state = 'cruise';
      ins.yOff = ins.y - cruiseY(ins);
    }
  }
  function cruiseY(ins) {
    var w1 = ins.wA1 * Math.sin((ins.age / ins.wT1) * Math.PI * 2 + ins.wPh1);
    var w2 = ins.wA2 * Math.sin((ins.age / ins.wT2) * Math.PI * 2 + ins.wPh2);
    var zz = ins.zzA * Math.sin((ins.age / ins.zzT) * Math.PI * 2 + ins.zzPh);
    return surfaceAt(clamp(ins.x, 0, worldW)) - U * ins.yFrac + w1 + w2 + zz;
  }
  // Croisiere : traversee de l'ecran, ondulation verticale (+ petits zigzags pour le
  // bourdon) et derive horizontale legere. speedMult vaut 2 sous la pluie (fuite).
  function stepInsectCruise(ins, dt, speedMult) {
    ins.cruiseX += ins.dir * ins.speed * speedMult * dt;
    var drift = Math.sin(ins.age / ins.driftT + ins.driftPh) * U * 0.006;
    ins.x = ins.cruiseX + drift;
    var yo = 0;
    if (ins.yOff) { // ecart residuel apres une fuite : s'estompe en ~0,6 s
      ins.yOff *= Math.max(0, 1 - dt / 600);
      if (Math.abs(ins.yOff) < 0.5) ins.yOff = 0;
      yo = ins.yOff;
    }
    ins.y = clamp(cruiseY(ins) + yo, camY + 10, camY + H - 10);
  }
  // Approche : vise un point au-dessus de la fleur qui descend progressivement vers le
  // bout de la tige (courbe douce, pas une ligne droite), jusqu'a se poser.
  function stepInsectApproach(ins, dt) {
    var top = flowerTopWorld(ins.target);
    var dx = top[0] - ins.x, dy = top[1] - ins.y, dist = Math.hypot(dx, dy);
    ins.nearFlower = dist < U * 0.08;
    var hover = Math.min(U * 0.07, dist * 0.5);
    var rate = Math.min(1, dt / 260);
    ins.x += (top[0] - ins.x) * rate;
    ins.y += (top[1] - hover - ins.y) * rate;
    ins.y += Math.sin(ins.age / 260 + ins.wPh1) * U * 0.004;
    if (dist < 3) {
      ins.state = 'landed';
      ins.x = top[0]; ins.y = top[1];
      ins.landAt = ins.age;
      ins.landDur = 3000 + Math.random() * 4000;
      ins.landPh = Math.random() * Math.PI * 2;
      ins.nearFlower = true;
    }
  }
  // Pose : reste au bout de la tige le temps de landDur (le pietinement/battement pose est
  // purement visuel, voir drawInsect), puis repart finir sa traversee en croisiere.
  function stepInsectLanded(ins) {
    ins.nearFlower = true;
    var top = flowerTopWorld(ins.target);
    ins.x = top[0]; ins.y = top[1];
    if (ins.age - ins.landAt >= ins.landDur) {
      ins.cruiseX = ins.x; ins.target = null; ins.state = 'cruise'; ins.nearFlower = false;
    }
  }

  // Cycle de vie complet des insectes cosmetiques : apparition (delai reel aleatoire),
  // deplacement (dt REEL plafonne, jamais vTime), retrait une fois bien sorti de l'ecran.
  // Appelee depuis step() uniquement en mode 'exploded'. Retourne vrai s'il reste au moins
  // un insecte : force alors la pleine cadence (la boucle lente suffit tant qu'aucun
  // insecte n'est en vol, et continue de surveiller le prochain delai d'apparition).
  function stepInsects(realNow) {
    if (insectLastT === null) {
      insectLastT = realNow;
      insectNextAt = realNow + 6000 + Math.random() * 6000; // premiere apparition, 6-12s
    }
    var dt = Math.min(realNow - insectLastT, 50);
    insectLastT = realNow;
    var raining = weather.raining; // averse en cours (rainLevel n'est qu'un reglage de frequence)
    if (!raining && insects.length < INSECT_MAX + BUTTERFLY_MAX && realNow >= insectNextAt) {
      spawnInsect();
      insectNextAt = realNow + lerp(INSECT_GAP_MIN_MS, INSECT_GAP_MAX_MS, Math.random());
    }
    var speedMult = raining ? 2 : 1;
    for (var i = insects.length - 1; i >= 0; i--) {
      var ins = insects[i];
      ins.age += dt;
      if (ins.caught) {
        if (ins !== heldInsect || mode !== 'exploded' || ins.age - ins.caughtAt > CATCH_MAX_MS) {
          if (ins === heldInsect) heldInsect = null;
          releaseInsect(ins);
        } else {
          // Tenu : suit le pointeur (lisse, leger tremblement), jamais retire ni recycle.
          var hk = Math.min(1, dt / 18), ht = ins.age / 1000; // constante courte : colle a la main sans trainer
          ins.x += (heldSX + camX + Math.sin(ht * 17) * 2 - ins.x) * hk;
          ins.y += (heldSY + camY - U * 0.02 + Math.cos(ht * 21) * 2 - ins.y) * hk;
          continue;
        }
      }
      if (raining && ins.target) { ins.cruiseX = ins.x; ins.target = null; ins.state = 'cruise'; ins.nearFlower = false; }
      if (ins.target && !flowerStillGood(ins.target)) { ins.cruiseX = ins.x; ins.target = null; ins.state = 'cruise'; ins.nearFlower = false; }
      if (ins.state === 'approach') stepInsectApproach(ins, dt);
      else if (ins.state === 'landed') stepInsectLanded(ins);
      else if (ins.state === 'flee') stepInsectFlee(ins, dt);
      else stepInsectCruise(ins, dt, speedMult);
      if ((ins.dir > 0 && ins.x > camX + W + 80) || (ins.dir < 0 && ins.x < camX - 80) || ins.age > 180000) insects.splice(i, 1);
    }
    return insects.length > 0;
  }

  // Quadrilatere du point a vers b (demi-epaisseurs wa, wb), perpendiculaire a la direction
  // du segment (pas un simple decalage vertical, qui aplatit les segments pentus).
  function rootSeg(ax, ay, bx, by2, wa, wb) {
    var dx = bx - ax, dy = by2 - ay, l = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / l, ny = dx / l;
    poly([[ax + nx * wa, ay + ny * wa], [bx + nx * wb, by2 + ny * wb], [bx - nx * wb, by2 - ny * wb], [ax - nx * wa, ay - ny * wa]]);
  }

  // Dessinees SOUS les facettes de terre (avant les shards, apres drawSoil/drawLooseBacking) :
  // le lit de triangles et la terre meuble les cachent ; elles n'apparaissent que sur l'aplat
  // de la couche compacte, en defilant vers le bas ou au fond d'un trou creuse a la pelle.
  // Brun-roux plus chaud/clair que le tronc : #6b4428 se confondait avec l'aplat #5a3d28.
  var ROOT_COLORS = ['#b8814f', '#9a6a3f'];
  function drawRoots(t) {
    var by = t.by !== undefined ? t.by : surfaceAt(t.x) + TREE_EMBED, w0 = U * 0.014;
    // Racines courtes a la naissance, elles s'etirent jusqu'a leur pleine longueur en poussant.
    var rg = lerp(ROOT_GROWTH_MIN, 1, t.growth);
    for (var r = 0; r < t.roots.length; r++) {
      var rt = t.roots[r], pts = rt.pts, n = pts.length - 1;
      for (var i = 0; i < n; i++) {
        var a = pts[i], b = pts[i + 1];
        ctx.fillStyle = ROOT_COLORS[i % 2];
        rootSeg(t.x + a[0] * rg, by + a[1] * rg, t.x + b[0] * rg, by + b[1] * rg,
          Math.max(0.6, w0 * (1 - i / n)), Math.max(0.6, w0 * (1 - (i + 1) / n)));
      }
      // Fourche : demarre a 60% de l'epaisseur locale de la racine mere, s'effile jusqu'a la pointe.
      var f = rt.fork, wf = Math.max(0.6, w0 * (1 - rt.forkAt / n)) * 0.6, fn = f.length - 1;
      for (i = 0; i < fn; i++) {
        var fa = f[i], fb = f[i + 1];
        ctx.fillStyle = ROOT_COLORS[(i + 1) % 2];
        rootSeg(t.x + fa[0] * rg, by + fa[1] * rg, t.x + fb[0] * rg, by + fb[1] * rg,
          Math.max(0.6, wf * (1 - i / fn)), Math.max(0.6, wf * (1 - (i + 1) / fn)));
      }
    }
    // Racine pivot : descend droit jusqu'a la vraie profondeur ou l'arbre va chercher
    // l'humus (meme calcul que la recherche dans stepTrees), visible en defilant vers le bas.
    var tipY = surfaceAt(t.x) + U * lerp(ROOT_DEPTH_MIN, ROOT_DEPTH_MAX, t.growth), N = 6, seed = t.x * 0.37;
    for (i = 0; i < N; i++) {
      var k0 = i / N, k1 = (i + 1) / N;
      var y0 = lerp(by, tipY, k0), y1 = lerp(by, tipY, k1);
      var x0 = t.x + Math.sin(seed + k0 * 5) * U * 0.012 * k0, x1 = t.x + Math.sin(seed + k1 * 5) * U * 0.012 * k1;
      var w0p = w0 * 1.3 * (1 - k0) + 0.6, w1p = w0 * 1.3 * (1 - k1) + 0.6;
      ctx.fillStyle = ROOT_COLORS[i % 2];
      poly([[x0 - w0p, y0], [x0 + w0p, y0], [x1 + w1p, y1], [x1 - w1p, y1]]);
    }
  }

  var LIMB_COLORS = ['#8a5a3b', '#6b4428']; // deux tons du tronc, alternes d'un segment a l'autre
  function drawTree(t) {
    // Tronc/houppier petits a la naissance, pleine taille une fois l'arbre mature (t.growth).
    var now = vTime, tg = treeScale(t), by = t.by !== undefined ? t.by : surfaceAt(t.x) + TREE_EMBED, h = t.h * tg, w = U * 0.035 * tg, top = by - h;
    // Tronc : deux facettes (lumiere a gauche), effile vers le haut.
    ctx.fillStyle = '#8a5a3b';
    poly([[t.x - w, by], [t.x, by], [t.x, top], [t.x - w * 0.35, top]]);
    ctx.fillStyle = '#6b4428';
    poly([[t.x, by], [t.x + w, by], [t.x + w * 0.35, top], [t.x, top]]);
    // Evasement du pied : 2 petits contreforts triangulaires qui elargissent la base, du
    // niveau juste sous la surface (by - TREE_EMBED + 2) jusqu'a h*0.08 au-dessus d'elle ;
    // le haut colle au bord du tronc (qui s'effile de w a 0.35w sur sa hauteur).
    var fy = by - TREE_EMBED + 2, fTop = by - TREE_EMBED - h * 0.08, fw = w * (1 - 0.65 * (by - fTop) / h);
    ctx.fillStyle = '#8a5a3b';
    poly([[t.x - w * 1.8, fy], [t.x - fw, fTop], [t.x - fw, fy]]);
    ctx.fillStyle = '#6b4428';
    poly([[t.x + w * 1.8, fy], [t.x + fw, fTop], [t.x + fw, fy]]);
    // Branches maitresses : 2 segments legerement coudes, effiles du tronc vers le bout
    // (le bouquet de feuilles est accroche a ce bout), deux tons alternes.
    var limbs = t.limbs, i, k, lm, wA = Math.max(1, w * 0.35);
    // Branche agrippee par la main : elle tremble en proportion de la tension (ecart au
    // point de prise), decalage visuel seulement (lm.shx/shy, aussi lu par le feuillage).
    var gp = hand.grip, shk = handTension(t) * 3;
    var shkX = shk ? Math.sin(frame * 1.7) * shk : 0, shkY = shk ? Math.cos(frame * 2.3) * shk * 0.6 : 0;
    for (k = 0; k < limbs.length; k++) {
      lm = limbs[k];
      lm.n = 0; lm.cnt = 0; lm.w = 0; lm.cr = 0; lm.cg = 0; lm.cb = 0; // cumuls du bouquet pour cette frame
      lm.shx = 0; lm.shy = 0;
      if (lm.broken !== undefined) continue; // cassee : ni segment ni bouquet (ses feuilles sont deja tombees)
      if (shk && gp.obj === lm) { lm.shx = shkX; lm.shy = shkY; }
      var sx = t.x, sy = top + h * lm.f, ex = t.x + lm.dx * tg + lm.shx, ey = top + lm.dy * tg + lm.shy;
      var mx = (sx + ex) / 2 - (ey - sy) * lm.bend, my = (sy + ey) / 2 + (ex - sx) * lm.bend, wM = Math.max(0.8, wA * 0.55);
      ctx.fillStyle = LIMB_COLORS[k % 2];
      rootSeg(sx, sy, mx, my, wA, wM);
      ctx.fillStyle = LIMB_COLORS[(k + 1) % 2];
      rootSeg(mx, my, ex, ey, wM, 0.6);
    }
    // Passe 1 : branches bonus (dessinees avant la masse de feuillage) et cumul des feuilles
    // affichees de chaque bouquet (nb, poids de croissance, somme des couleurs).
    var unl = unlockedSlots(t), sl, lf, g, col;
    for (i = 0; i < t.slots.length; i++) {
      sl = t.slots[i]; lf = sl.leaf;
      if (sl.limb !== undefined && i < unl) limbs[sl.limb].n++;
      if (sl.branch) {
        // Vraie branche, visible et persistante (pas juste un decor) : s'etire depuis le
        // haut du tronc jusqu'a sa place de feuille en BRANCH_GROW_MS, et reste dessinee
        // tant que la place existe (voir sa chute dans stepTrees), feuille ou pas.
        var bg = Math.min(1, (now - sl.branchSince) / BRANCH_GROW_MS);
        sl.shx = 0; sl.shy = 0;
        if (shk && gp.obj === sl) { sl.shx = shkX; sl.shy = shkY; }
        // Meme dessin que les branches maitresses : 2 segments coudes, deux tons, effiles.
        if (!sl.mj) {
          sl.mj = [];
          for (k = 0; k < 7; k++) sl.mj.push(0.78 + Math.random() * 0.4);
          sl.a0 = Math.random() * Math.PI * 2;
          sl.bend = (Math.random() < 0.5 ? -1 : 1) * (0.06 + Math.random() * 0.1);
        }
        var bsx = t.x, bsy = top + h * 0.12, bex = t.x + sl.dx * tg * bg + sl.shx, bey = top + sl.dy * tg * bg + sl.shy;
        var bmx = (bsx + bex) / 2 - (bey - bsy) * sl.bend, bmy = (bsy + bey) / 2 + (bex - bsx) * sl.bend, bwM = Math.max(0.8, wA * 0.8 * 0.55);
        ctx.fillStyle = LIMB_COLORS[i % 2];
        rootSeg(bsx, bsy, bmx, bmy, wA * 0.8, bwM);
        ctx.fillStyle = LIMB_COLORS[(i + 1) % 2];
        rootSeg(bmx, bmy, bex, bey, bwM, 0.6);
      }
      if (!lf || now < lf.born) continue;
      g = easeOutBack(Math.min(1, (now - lf.born) / LEAF_GROW_MS));
      col = leafColor(Math.min(1, (now - lf.born) / lf.life));
      lf.dg = g; lf.dcol = col; // caches pour la passe 2 (memes valeurs, evite de recalculer)
      if (sl.limb !== undefined) {
        lm = limbs[sl.limb];
        lm.cnt++; lm.w += g; lm.cr += col[0]; lm.cg += col[1]; lm.cb += col[2];
      }
    }
    // Masse de feuillage : eventail de 7 triangles autour du bout de chaque branche, couleur
    // moyenne des feuilles du bouquet assombrie (haut x0.85, bas x0.62). Suit la saison des
    // feuilles et se degarnit avec elles ; rien du tout tant que le bouquet n'a aucune feuille.
    for (k = 0; k < limbs.length; k++) {
      lm = limbs[k];
      if (!lm.cnt) continue;
      var inv = 1 / lm.cnt, cr = lm.cr * inv, cg = lm.cg * inv, cb = lm.cb * inv;
      var R = CANOPY_CLUSTER_R * U * tg * (0.45 + 0.65 * Math.min(1, lm.w / Math.max(1, lm.n, lm.cnt)));
      var cx = t.x + lm.dx * tg + lm.shx, cy = top + lm.dy * tg + lm.shy;
      var cUp = shadeRgb(cr, cg, cb, 0.85), cDn = shadeRgb(cr, cg, cb, 0.62);
      var qx = cx + Math.cos(lm.a0) * R * lm.mj[0], qy = cy + Math.sin(lm.a0) * R * 0.8 * lm.mj[0];
      for (var v = 1; v <= 7; v++) {
        var va = lm.a0 + v / 7 * Math.PI * 2, vr = R * lm.mj[v % 7];
        var vx = cx + Math.cos(va) * vr, vy = cy + Math.sin(va) * vr * 0.8;
        ctx.fillStyle = (qy + vy) * 0.5 < cy ? cUp : cDn;
        poly([[cx, cy], [qx, qy], [vx, vy]]);
        qx = vx; qy = vy;
      }
    }
    // Petit bouquet au bout de chaque branche bonus qui porte une feuille, comme les maitresses.
    for (i = 0; i < t.slots.length; i++) {
      sl = t.slots[i]; lf = sl.leaf;
      if (!sl.branch || !sl.mj || !lf || now < lf.born) continue;
      var bgF = Math.min(1, (now - sl.branchSince) / BRANCH_GROW_MS);
      var bR = CANOPY_CLUSTER_R * U * tg * 0.5 * Math.min(1, lf.dg) * bgF;
      var bcx = t.x + sl.dx * tg * bgF + (sl.shx || 0), bcy = top + sl.dy * tg * bgF + (sl.shy || 0);
      var bUp = shadeRgb(lf.dcol[0], lf.dcol[1], lf.dcol[2], 0.85), bDn = shadeRgb(lf.dcol[0], lf.dcol[1], lf.dcol[2], 0.62);
      var bqx = bcx + Math.cos(sl.a0) * bR * sl.mj[0], bqy = bcy + Math.sin(sl.a0) * bR * 0.8 * sl.mj[0];
      for (var bv = 1; bv <= 7; bv++) {
        var bva = sl.a0 + bv / 7 * Math.PI * 2, bvr = bR * sl.mj[bv % 7];
        var bvx = bcx + Math.cos(bva) * bvr, bvy = bcy + Math.sin(bva) * bvr * 0.8;
        ctx.fillStyle = (bqy + bvy) * 0.5 < bcy ? bUp : bDn;
        poly([[bcx, bcy], [bqx, bqy], [bvx, bvy]]);
        bqx = bvx; bqy = bvy;
      }
    }
    // Passe 2 : feuilles individuelles par-dessus la masse (ce sont elles qui tombent).
    // Eclairage par le haut : un peu plus claires dans la moitie haute du bouquet, un peu
    // plus sombres dans la moitie basse (simple facteur sur la couleur pleine).
    var px, py, lpts, shade;
    for (i = 0; i < t.slots.length; i++) {
      sl = t.slots[i]; lf = sl.leaf;
      if (!lf || now < lf.born) continue;
      col = lf.dcol;
      shade = sl.limb === undefined ? 1 : (sl.dy < limbs[sl.limb].dy ? 1.12 : 0.92);
      ctx.fillStyle = shadeRgb(col[0], col[1], col[2], shade);
      lpts = leafTri(lf.size * lf.dg, lf.rot);
      var so = sl.limb !== undefined ? limbs[sl.limb] : sl; // porte le decalage de tremblement
      px = t.x + sl.dx * tg + (so.shx || 0); py = top + sl.dy * tg + (so.shy || 0);
      poly(lpts.map(function (q) { return [px + q[0], py + q[1]]; }));
    }
  }

  // Couleur pleine 'rgb(...)' d'un rgb multiplie par un facteur d'eclairage (borne a 255).
  function shadeRgb(r, g, b, k) {
    return 'rgb(' + Math.min(255, Math.round(r * k)) + ',' + Math.min(255, Math.round(g * k)) + ',' + Math.min(255, Math.round(b * k)) + ')';
  }

  // --- Rendu -------------------------------------------------------------------------
  // --- Decor lointain : ciel + collines en parallaxe ----------------------------------
  // Dessine en coord. ECRAN (avant le translate camera). Chaque couche de collines est une
  // crete irreguliere facettee en triangles, decalee de camX/camY x facteur : plus la
  // couche est loin, moins elle bouge. Teintes melangees a la creme de la page (aerien).
  var HILL_LAYERS = [
    { f: 0.16, lift: 0.23, amp: 0.09, rgb: [201, 208, 178] },  // lointaine, tres pale
    { f: 0.38, lift: 0.15, amp: 0.07, rgb: [178, 186, 146] }   // proche, un peu plus dense
  ];
  var hillRidges = [];
  function buildHills() {
    hillRidges = HILL_LAYERS.map(function (L, li) {
      var xs = [], ys = [], x = -40, ph = Math.random() * 10;
      while (x < worldW + 80) {
        var u = x / worldW;
        var n = Math.sin(u * 13 + ph + li * 2) * 0.5 + Math.sin(u * 31 + ph * 1.7) * 0.28 + Math.random() * 0.22;
        xs.push(x);
        ys.push(groundY - U * (L.lift + L.amp * (0.5 + n * 0.5)));
        x += 28 + Math.random() * 30;
      }
      // Couleurs par facette, precalculees : elles ne dependent que de la pente (y0 - y1).
      var his = [], los = [];
      for (var i = 0; i < xs.length - 1; i++) {
        var kk = clamp((ys[i] - ys[i + 1]) / 40, -1, 1) * 0.07;
        los.push(rgbStr(shade(L.rgb, kk - 0.03)));
        his.push(rgbStr(shade(L.rgb, kk + 0.03)));
      }
      return { xs: xs, ys: ys, hi: his, lo: los };
    });
  }
  var skyGrad = null, skyGradY = -1;   // degrade du ciel, recree seulement si groundY change
  function drawBackdrop() {
    var a = easeInOut(soilRiseT);
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    // Ciel : transparent en haut (se fond dans la creme de la page), a peine chaud a l'horizon.
    if (!skyGrad || skyGradY !== groundY) {
      skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
      skyGrad.addColorStop(0, 'rgba(246,222,182,0)');
      skyGrad.addColorStop(1, 'rgba(246,214,168,0.32)');
      skyGradY = groundY;
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);
    for (var li = 0; li < HILL_LAYERS.length; li++) {
      var L = HILL_LAYERS[li], R = hillRidges[li];
      if (!R) continue;
      var ox = camX * L.f, oy = camY * L.f, bottom = worldH;
      for (var i = 0; i < R.xs.length - 1; i++) {
        var x0 = R.xs[i] - ox, x1 = R.xs[i + 1] - ox;
        if (x1 < -4 || x0 > W + 4) continue;
        var y0 = R.ys[i] - oy, y1 = R.ys[i + 1] - oy;
        // Lumiere haut-gauche : pente montante vers la droite = face eclairee (couleurs
        // precalculees dans buildHills).
        ctx.fillStyle = R.hi[i];
        ctx.beginPath();
        ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x0, bottom);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = R.lo[i];
        ctx.beginPath();
        ctx.moveTo(x1, y1); ctx.lineTo(x1, bottom); ctx.lineTo(x0, bottom);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // --- Cache de rendu des facettes immobiles ------------------------------------------
  // Les facettes de la passe 0 (terre) qui ne bougent plus et ne changent plus de couleur
  // depuis BAKE_FRAMES frames sont peintes une fois dans des tuiles hors ecran (TILE px
  // monde, cle "col,row"), recopiees d'un bloc a chaque frame. Une facette qui change est
  // retiree (tuiles salies) et redessinee en direct. Une tuile dont une facette a quitte
  // shards (compte vu != compte inscrit) est repeinte AVANT la copie : jamais d'image perimee.
  // Coins des tuiles en px device entiers (Math.round(col*TILE*RS)) : elles se jouxtent
  // exactement, et la copie est calee au px device (ecart < 0.5 px device avec le direct).
  var TILE = 256, TILE_MAX = 64, BAKE_FRAMES = 20, BAKE_EPS = 0.05, BAKE_PAD = 1.5;
  var tiles = {}, tileList = [], tilePool = [], bakeGen = 1, bakeOid = 0, bakeStamp = 0, bakeFrame = 0;
  var liveSoil = [];
  // Remise a zero globale : les tuiles tombent, et bakeGen++ invalide d'un coup toutes les
  // facettes cuites (s.bkG !== bakeGen), sans boucle sur shards.
  function resetTiles() {
    for (var i = 0; i < tileList.length; i++) {
      if (tilePool.length < 8) tilePool.push(tileList[i].c);
      else tileList[i].c.width = 0;
    }
    tiles = {}; tileList = [];
    bakeGen++;
  }
  function getTile(col, row) {
    var key = col + ',' + row, t = tiles[key];
    if (t) return t;
    var dx0 = Math.round(col * TILE * RS), dy0 = Math.round(row * TILE * RS);
    var c = tilePool.pop() || document.createElement('canvas');
    c.width = Math.round((col + 1) * TILE * RS) - dx0;
    c.height = Math.round((row + 1) * TILE * RS) - dy0;
    var tc = c.getContext('2d');
    tc.setTransform(RS, 0, 0, RS, -dx0, -dy0);
    t = { key: key, col: col, row: row, c: c, tc: tc, dx0: dx0, dy0: dy0, list: [], n: 0, seen: 0, dirty: false, maxOid: 0 };
    tiles[key] = t; tileList.push(t);
    return t;
  }
  function bakeFill(tc, s) {
    var v = s.bkV, k = s.bkC;
    tc.fillStyle = 'rgb(' + (k >> 16) + ',' + ((k >> 8) & 255) + ',' + (k & 255) + ')';
    tc.beginPath();
    tc.moveTo(v[0], v[1]); tc.lineTo(v[2], v[3]); tc.lineTo(v[4], v[5]);
    tc.closePath();
    tc.fill();
  }
  // Peint la facette dans chaque tuile touchee par sa bbox (+ marge anticrenelage).
  // Refuse (false) si ca depasserait TILE_MAX tuiles : la facette reste en direct.
  function bakeShard(s) {
    var v = s.bkV, r, c, t;
    var c0 = Math.floor((Math.min(v[0], v[2], v[4]) - BAKE_PAD) / TILE), c1 = Math.floor((Math.max(v[0], v[2], v[4]) + BAKE_PAD) / TILE);
    var r0 = Math.floor((Math.min(v[1], v[3], v[5]) - BAKE_PAD) / TILE), r1 = Math.floor((Math.max(v[1], v[3], v[5]) + BAKE_PAD) / TILE);
    var missing = 0;
    for (r = r0; r <= r1; r++) for (c = c0; c <= c1; c++) if (!tiles[c + ',' + r]) missing++;
    if (tileList.length + missing > TILE_MAX) return false;
    var ts = s.bkT || (s.bkT = []);
    ts.length = 0;
    for (r = r0; r <= r1; r++) {
      for (c = c0; c <= c1; c++) {
        t = getTile(c, r);
        t.list.push(s);
        ts.push(t);
        // Ordre de dessin = ordre d'arrivee dans shards (oid) : une facette plus ancienne
        // qu'une deja peinte force une repeinte triee plutot que de passer par-dessus.
        if (t.dirty || t.maxOid > s.oid) t.dirty = true;
        else { bakeFill(t.tc, s); t.n++; t.seen++; t.maxOid = s.oid; }
      }
    }
    s.bkG = bakeGen; s.bkF = bakeFrame;
    return true;
  }
  function unbakeShard(s) {
    s.bkG = 0;
    for (var i = 0; i < s.bkT.length; i++) s.bkT[i].dirty = true;
  }
  function rebuildTile(t) {
    var st = ++bakeStamp, L = t.list, out = [], i, s;
    for (i = 0; i < L.length; i++) {
      s = L[i];
      // bkF : vue dans shards a cette frame ; une facette retiree du jeu reste bkG === bakeGen.
      if (s.bkG === bakeGen && s.bkF === bakeFrame && s.bkS !== st && s.bkT.indexOf(t) >= 0) { s.bkS = st; out.push(s); }
    }
    out.sort(function (a, b) { return a.oid - b.oid; });
    t.tc.save();
    t.tc.setTransform(1, 0, 0, 1, 0, 0);
    t.tc.clearRect(0, 0, t.c.width, t.c.height);
    t.tc.restore();
    for (i = 0; i < out.length; i++) bakeFill(t.tc, out[i]);
    t.list = out; t.n = out.length; t.seen = out.length;
    t.maxOid = out.length ? out[out.length - 1].oid : 0;
    t.dirty = false;
  }
  // Passe 0 : detection des changements, cuisson, repeinte et copie des tuiles (contexte
  // deja en coord. monde). Renvoie les facettes a dessiner en direct.
  function cacheSoil(rise) {
    if (mode !== 'exploded' || soilRiseT < 1) {
      if (tileList.length) resetTiles();
      return shards;
    }
    var i, j, t, s, live = liveSoil, keep = [];
    bakeFrame++;
    var vx0 = camX, vx1 = camX + W, vy0 = camY, vy1 = camY + H;
    live.length = 0;
    // Tuiles a plus d'une tuile de la vue : liberees (leurs facettes repassent en direct).
    for (i = 0; i < tileList.length; i++) {
      t = tileList[i];
      var tx = t.col * TILE, ty = t.row * TILE;
      if (tx + TILE < vx0 - TILE || tx > vx1 + TILE || ty + TILE < vy0 - TILE || ty > vy1 + TILE) {
        for (j = 0; j < t.list.length; j++) {
          s = t.list[j];
          if (s.bkG === bakeGen && s.bkT.indexOf(t) >= 0) unbakeShard(s);
        }
        delete tiles[t.key];
        if (tilePool.length < 8) tilePool.push(t.c); else t.c.width = 0;
      } else { t.seen = 0; keep.push(t); }
    }
    tileList = keep;
    for (i = 0; i < shards.length; i++) {
      s = shards[i];
      if (s.leaf || s.branch || s.nutri) continue;
      if (s.oid === undefined) s.oid = ++bakeOid;
      var baked = s.bkG === bakeGen;
      if (baked) { s.bkF = bakeFrame; for (j = 0; j < s.bkT.length; j++) s.bkT[j].seen++; }
      var p = s.pts, sy = s.y + (s.soil && s.settled ? rise : 0);
      if (s.cullR === undefined) {
        s.cullR = Math.max(Math.abs(p[0][0]), Math.abs(p[0][1]), Math.abs(p[1][0]), Math.abs(p[1][1]), Math.abs(p[2][0]), Math.abs(p[2][1])) * 1.5;
      }
      var cm = s.cullR * Math.max(1, LOOSE_DRAW_SCALE) + U * 0.06 + 4;
      if (s.x < vx0 - cm || s.x > vx1 + cm || sy < vy0 - cm || sy > vy1 + cm) continue;
      if (s.eaten !== undefined) {
        if (baked) unbakeShard(s);
        s.bkN = 0; s.bkC = -1;
        live.push(s);
        continue;
      }
      // Memes calculs que la boucle de draw() (passe 0 : jamais a plat, jamais mangee).
      var m = s.mix, r = lerp(s.from[0], s.to[0], m), g = lerp(s.from[1], s.to[1], m), bl = lerp(s.from[2], s.to[2], m);
      if (s.myc) {
        var w = s.myc * s.mycTone, mc = s.strain ? s.strain.mycRgb : MYC;
        r = lerp(r, mc[0], w); g = lerp(g, mc[1], w); bl = lerp(bl, mc[2], w);
      }
      var k = ((r | 0) << 16) | ((g | 0) << 8) | (bl | 0);
      var c = Math.cos(s.rot), sn = Math.sin(s.rot);
      if (s.settled && !s.soil && !s.leaf) { c *= LOOSE_DRAW_SCALE; sn *= LOOSE_DRAW_SCALE; }
      var a0 = s.x + p[0][0] * c - p[0][1] * sn, a1 = sy + (p[0][0] * sn + p[0][1] * c);
      var a2 = s.x + p[1][0] * c - p[1][1] * sn, a3 = sy + (p[1][0] * sn + p[1][1] * c);
      var a4 = s.x + p[2][0] * c - p[2][1] * sn, a5 = sy + (p[2][0] * sn + p[2][1] * c);
      var v = s.bkV;
      if (!v) { v = s.bkV = [0, 0, 0, 0, 0, 0]; s.bkN = 0; s.bkC = -1; }
      if (k !== s.bkC || Math.abs(a0 - v[0]) > BAKE_EPS || Math.abs(a1 - v[1]) > BAKE_EPS ||
          Math.abs(a2 - v[2]) > BAKE_EPS || Math.abs(a3 - v[3]) > BAKE_EPS ||
          Math.abs(a4 - v[4]) > BAKE_EPS || Math.abs(a5 - v[5]) > BAKE_EPS) {
        if (baked) { unbakeShard(s); baked = false; }
        s.bkC = k; v[0] = a0; v[1] = a1; v[2] = a2; v[3] = a3; v[4] = a4; v[5] = a5;
        s.bkN = 0;
      } else if (!baked && ++s.bkN >= BAKE_FRAMES) { baked = bakeShard(s); if (!baked) s.bkN = 0; }
      if (!baked) live.push(s);
    }
    // Repeinte avant copie, puis copie calee au px device (hors transformation monde).
    for (i = 0; i < tileList.length; i++) {
      t = tileList[i];
      if (t.dirty || t.seen !== t.n) rebuildTile(t);
    }
    var ox = Math.round(-camX * RS), oy = Math.round(-camY * RS), cw = canvas.width, ch = canvas.height;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (i = 0; i < tileList.length; i++) {
      t = tileList[i];
      if (!t.n) continue;
      var px = ox + t.dx0, py = oy + t.dy0;
      if (px >= cw || py >= ch || px + t.c.width <= 0 || py + t.c.height <= 0) continue;
      ctx.drawImage(t.c, px, py);
    }
    ctx.restore();
    return live;
  }

  function draw() {
    ctx.setTransform(RS, 0, 0, RS, 0, 0);
    ctx.clearRect(0, 0, W, H);
    drawBackdrop();
    // Tout ce qui suit est dessine en coord. MONDE ; ce translate ramene la portion
    // visible (camX..camX+W, camY..camY+H) a l'ecran. Les overlays HTML (tresors) font
    // ce -camX/-camY a la main dans positionTreasureOverlays, hors de ce contexte canvas.
    ctx.save();
    ctx.translate(-camX, -camY);
    // Pendant la montee du lit de terre, tout le sol est decale vers le bas.
    var rise = soilRiseT < 1 ? Math.pow(1 - soilRiseT, 3) * soilDepth : 0;
    drawInsectsBack();
    drawSoil(rise);
    drawCompactNutri(rise);
    drawLooseBacking(rise);
    // Racines avant les facettes : cachees par le lit de triangles et la terre meuble,
    // visibles seulement sur l'aplat compact (defilement vers le bas, trou creuse).
    for (var ti = 0; ti < trees.length; ti++) drawRoots(trees[ti]);
    // Avant les facettes : le pied du tronc est enfoui dans la terre.
    for (ti = 0; ti < trees.length; ti++) drawTree(trees[ti]);
    // Deux passes : terre d'abord, puis hyphes, puis litiere (feuilles, bois, nutriments)
    // par-dessus le mycelium.
    for (var pass = 0; pass < 2; pass++) {
    if (pass === 1) drawHyphae(rise);
    // Passe 0 : les tuiles de facettes immobiles sont copiees ici (apres arbres et racines,
    // avant hyphes et litiere) ; la boucle ne dessine plus que les facettes en direct.
    var list = pass === 0 ? cacheSoil(rise) : shards;
    for (var i = 0; i < list.length; i++) {
      var s = list[i], m = s.mix, p = s.pts;
      if (!!(s.leaf || s.branch || s.nutri) !== (pass === 1)) continue;
      var sy = s.y + (s.soil && s.settled ? rise : 0);
      // Hors ecran (marge = rayon max de la facette, agrandie, + demi-baton) : on saute.
      if (s.cullR === undefined) {
        s.cullR = Math.max(Math.abs(p[0][0]), Math.abs(p[0][1]), Math.abs(p[1][0]), Math.abs(p[1][1]), Math.abs(p[2][0]), Math.abs(p[2][1])) * 1.5;
      }
      var cm = s.cullR * Math.max(1, LOOSE_DRAW_SCALE) + U * 0.06 + 4;
      if (s.x < camX - cm || s.x > camX + W + cm || sy < camY - cm || sy > camY + H + cm) continue;
      var r = lerp(s.from[0], s.to[0], m), g = lerp(s.from[1], s.to[1], m), bl = lerp(s.from[2], s.to[2], m);
      if (s.myc) {
        var w = s.myc * s.mycTone, mc = s.strain ? s.strain.mycRgb : MYC;
        r = lerp(r, mc[0], w); g = lerp(g, mc[1], w); bl = lerp(bl, mc[2], w);
      }
      // Bois tombe (tant qu'il n'est pas devenu de la terre) : un petit baton, pas ses pts.
      if (s.branch && s.eaten === undefined && (!s.settled || s.mix < 1)) {
        if (s.settled && s.restRot === undefined) s.restRot = (Math.random() - 0.5) * 0.24;
        drawLog(s, s.x, sy, s.settled ? s.restRot : s.rot, r, g, bl);
        continue;
      }
      ctx.fillStyle = s.nutri || 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (bl | 0) + ')';
      // Feuille posee : couchee a plat (angle fige, hauteur ecrasee), sans toucher a s.pts.
      var flat = s.leaf && !s.branch && s.settled, fy = 1, fo = 0;
      if (flat && s.restRot === undefined) s.restRot = (Math.random() - 0.5) * 0.3;
      if (flat) fy = LITTER_FLAT, fo = 1;
      var c = Math.cos(flat ? s.restRot : s.rot), sn = Math.sin(flat ? s.restRot : s.rot);
      // Terre meuble posee : dessinee un peu plus grande pour boucher les jours entre
      // facettes empilees (le lit d'origine, deja jointif, garde sa taille).
      if (s.settled && !s.soil && !s.leaf) { c *= LOOSE_DRAW_SCALE; sn *= LOOSE_DRAW_SCALE; }
      if (s.eaten !== undefined) {
        var k = Math.max(0, 1 - (vTime - s.eaten) / EATEN_MS);
        c *= k; sn *= k;
      }
      ctx.beginPath();
      ctx.moveTo(s.x + p[0][0] * c - p[0][1] * sn, sy + fo + (p[0][0] * sn + p[0][1] * c) * fy);
      ctx.lineTo(s.x + p[1][0] * c - p[1][1] * sn, sy + fo + (p[1][0] * sn + p[1][1] * c) * fy);
      ctx.lineTo(s.x + p[2][0] * c - p[2][1] * sn, sy + fo + (p[2][0] * sn + p[2][1] * c) * fy);
      ctx.closePath();
      ctx.fill();
    }
    }
    drawLakes();
    drawMoss(rise);
    drawGrass(rise);
    drawUnderbrush(rise);
    drawFlowers(rise);
    drawInsectsFront();
    // Apres les facettes : les champignons sortent PAR-DESSUS la terre.
    for (i = 0; i < mushrooms.length; i++) drawMushroom(mushrooms[i]);
    drawNuggets();
    drawGoldBits();
    drawShovel();
    drawMycHalo();
    drawBag();
    drawHand();
    drawRain();
    ctx.restore();
    positionTreasureOverlays();
  }

  // Baton low-poly (bois tombe) : hexagone a deux facettes, moitie haute = couleur de la
  // facette, moitie basse plus sombre. Pose, il est couche et un peu enfonce dans le sol.
  function drawLog(s, x, y, rot, r, g, b) {
    var L = U * 0.0425, T = U * 0.007, bv = T * 0.8, c = Math.cos(rot), sn = Math.sin(rot);
    if (s.settled) y += T * 0.66;
    var x0 = x - L * c, y0 = y - L * sn, x1 = x + L * c, y1 = y + L * sn;   // extremites
    var ta = -L + bv, tb = L - bv;
    var ax = x + ta * c + T * sn, ay = y + ta * sn - T * c;                  // haut, cote gauche
    var bx = x + tb * c + T * sn, by = y + tb * sn - T * c;                  // haut, cote droit
    var cx = x + tb * c - T * sn, cy = y + tb * sn + T * c;                  // bas, cote droit
    var dx = x + ta * c - T * sn, dy = y + ta * sn + T * c;                  // bas, cote gauche
    ctx.fillStyle = shadeRgb(r, g, b, 1);
    ctx.beginPath();
    ctx.moveTo(x0, y0); ctx.lineTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(x1, y1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = shadeRgb(r, g, b, 0.72);
    ctx.beginPath();
    ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(cx, cy); ctx.lineTo(dx, dy);
    ctx.closePath();
    ctx.fill();
  }

  // Filaments du mycelium (par-dessus le blanchiment des facettes) : chaque facette
  // colonisee tire un fil depuis son parent (ou le point d'inoculation), qui pousse avec
  // myc. Deux strokes par frame (vivant, mort), aucune allocation.
  function hyphaPath(c, rise, dead) {
    if (!c.settled || c.dead || c.eaten !== undefined || !c.hyF) return;
    var ro = c.soil ? rise : 0, cy = c.y + ro;
    if (c.x < camX - 40 || c.x > camX + W + 40 || cy < camY - 40 || cy > camY + H + 40) return;
    var p = c.mycParent, ox, oy;
    if (p) {
      if (!p.settled || !(p.myc > 0 || p.deadMyc)) return;
      ox = p.x; oy = p.y + (p.soil ? rise : 0);
    } else { ox = c.mox; oy = c.moy + ro; }
    var dx = c.x - ox, dy = cy - oy, d = Math.sqrt(dx * dx + dy * dy);
    if (d > HYPHA_MAX_LINK) return;
    var t = dead ? 1 : Math.min(1, c.myc / MYC_READY);
    var ex = ox + dx * t, ey = oy + dy * t, L = d * t;
    if (L > 0.5) {
      var mx = (ox + ex) / 2 - (ey - oy) / L * c.hyJ, my = (oy + ey) / 2 + (ex - ox) / L * c.hyJ;
      ctx.moveTo(ox, oy);
      ctx.lineTo(mx, my);
      if (dead) ctx.lineTo(mx + (ex - mx) * 0.1, my + (ey - my) * 0.1); // casse : 55% du fil
      else ctx.lineTo(ex, ey);
    }
    if (dead) return;
    var i, a;
    if (c.myc >= MYC_READY) {
      for (i = 0; i < c.hyTw.length; i += 2) {
        ctx.moveTo(c.x, cy);
        ctx.lineTo(c.x + Math.cos(c.hyTw[i]) * c.hyTw[i + 1], cy + Math.sin(c.hyTw[i]) * c.hyTw[i + 1]);
      }
    }
    if (c.myc > 0.6) {
      var surf = surfaceAt(c.x);
      if (c.y - surf < 6) {
        var by = Math.min(cy, surf + ro);
        for (i = 0; i < 9; i += 3) {
          var hx = c.x + c.hyF[i];
          a = c.hyF[i + 1];
          ctx.moveTo(hx, by);
          ctx.lineTo(hx + Math.cos(a) * c.hyF[i + 2], by + Math.sin(a) * c.hyF[i + 2]);
        }
      }
    }
  }
  function drawHyphae(rise) {
    var i;
    if (!colonised.length && !deadMyc.length) return;
    ctx.save();
    ctx.lineWidth = HYPHA_W;
    if (colonised.length && !tintedMyc) {
      ctx.strokeStyle = HYPHA_COLOR;
      ctx.beginPath();
      for (i = 0; i < colonised.length; i++) if (colonised[i].myc > 0) hyphaPath(colonised[i], rise, false);
      ctx.stroke();
    } else if (colonised.length) {
      // Au moins une facette teintee : un trait par souche (au plus 4), chacun sa couleur.
      for (var si = 0; si < strainOrder.length; si++) {
        var st = strainOrder[si];
        ctx.strokeStyle = st.hypha;
        ctx.beginPath();
        for (i = 0; i < colonised.length; i++) {
          if (colonised[i].myc > 0 && (colonised[i].strain || STRAIN_STD) === st) hyphaPath(colonised[i], rise, false);
        }
        ctx.stroke();
      }
    }
    if (deadMyc.length) {
      ctx.strokeStyle = HYPHA_DEAD_COLOR;
      ctx.beginPath();
      for (i = 0; i < deadMyc.length; i++) hyphaPath(deadMyc[i], rise, true);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Couche compacte : bande de triangles plats entre compactY et le fond du MONDE (worldH,
  // pas juste le bas de la boite H : le defilement vertical doit reveler du remplissage,
  // pas un trou). Jamais au-dessus du niveau d'origine, la terre meuble se dessine par-dessus. On ne dessine
  // que la portion du monde visible (autour de camX/camY), pas tout le monde a chaque frame.
  function drawSoil(rise) {
    var stepX = 2 * COL_W, bottom = worldH, visBottom = camY + H;
    var x0 = Math.max(0, Math.floor((camX - stepX) / stepX) * stepX);
    var x1 = Math.min(worldW, camX + W + stepX);
    // Maillage low-poly a plusieurs rangees (pas de longues bandes verticales jusqu'au
    // fond) : la rangee 0 suit compactY exactement ; les suivantes sont plus profondes,
    // avec sommets decales (hash stable par indice absolu, donc rien ne bouge au defilement),
    // diagonales alternees et teinte qui s'assombrit avec la profondeur.
    var rowH = U * 0.045, K = 1, dk = [0], k;
    var minTop = Infinity;
    for (var xx = x0; xx <= x1; xx += stepX) minTop = Math.min(minTop, compactY[Math.max(0, Math.min(compactY.length - 1, Math.round(Math.min(xx, worldW) / COL_W)))] + rise);
    while (K < 9 && minTop + dk[K - 1] < visBottom) { dk.push(dk[K - 1] + rowH * (1 + 0.3 * K)); K++; }
    var n = Math.max(0, Math.floor((x1 - x0) / stepX)) + 2, g0 = Math.round(x0 / stepX);
    var grid = [];
    for (k = 0; k < K; k++) {
      var row = [];
      for (var i = 0; i < n; i++) {
        var gi = g0 + i, bx = Math.min(x0 + i * stepX, worldW);
        var vx = bx, col = Math.max(0, Math.min(compactY.length - 1, Math.round(bx / COL_W)));
        var vy;
        if (k === 0) vy = compactY[col] + rise;
        else {
          vx = bx + (soilHash(gi, k, 1) - 0.5) * 0.7 * stepX;
          col = Math.max(0, Math.min(compactY.length - 1, Math.round(Math.max(0, Math.min(worldW, vx)) / COL_W)));
          vy = (k === K - 1 ? Math.max(bottom, compactY[col] + rise + dk[k]) : compactY[col] + rise + dk[k] + (soilHash(gi, k, 2) - 0.5) * 0.55 * rowH * (1 + 0.3 * k));
        }
        row.push([vx, vy, !!rocky[col]]);
      }
      grid.push(row);
    }
    for (k = 0; k < K - 1; k++) {
      var shade = 1 - 0.07 * k;
      for (var j = 0; j < n - 1; j++) {
        var A = grid[k][j], B = grid[k][j + 1], C = grid[k + 1][j], D = grid[k + 1][j + 1];
        if (A[1] >= visBottom && B[1] >= visBottom && k > 0) continue;
        // Plus on descend, plus de triangles de pierre (et la terre restante vire au gris-brun).
        // Sol varie : plaques de terre foncee, argile, sable (groupees par bruit grossier) et,
        // plus on descend, de plus en plus de pierre ; quelques cailloux poses par-dessus.
        var rk = A[2] || B[2] || C[2] || D[2], gj = g0 + j;
        var depthT = Math.max(0, Math.min(1, (dk[k] - rowH * 4.25) / (U * 0.5)));
        var patchT = Math.max(0, Math.min(1, (dk[k] - rowH * 6) / (U * 0.2)));   // le haut reste de la terre unie, les plaques/cailloux apparaissent plus bas
        var dA = (gj + k) & 1;
        var t1 = dA ? [A, B, C] : [A, B, D], t2 = dA ? [B, D, C] : [A, D, C];
        for (var q = 0; q < 2; q++) {
          var tri = q ? t2 : t1, sl = 3 + q * 2;
          var stone = rk || soilHash(gj, k, 7 + q) < depthT * 0.95;
          var pal = stone ? ROCK : (soilHash(gj, k, 50 + q) < patchT ? soilPatchPal(gj, k, q) : SOIL);
          ctx.fillStyle = soilShade(pal[Math.floor(soilHash(gj, k, sl) * pal.length)], shade * (0.92 + 0.16 * soilHash(gj, k, sl + 1)), !stone && pal === SOIL ? depthT * 0.5 : 0);
          poly(tri);
          // Petit caillou : polygone clair pose au centre du triangle.
          if (!stone && soilHash(gj, k, 20 + q) < 0.16 * patchT) {
            var cx0 = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, cy0 = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
            var pr = stepX * (0.07 + 0.09 * soilHash(gj, k, 22 + q)), pa = soilHash(gj, k, 24 + q) * 6.28;
            ctx.fillStyle = soilShade(PEBBLE[Math.floor(soilHash(gj, k, 26 + q) * PEBBLE.length)], shade, 0);
            poly([[cx0 + Math.cos(pa) * pr, cy0 + Math.sin(pa) * pr * 0.75], [cx0 + Math.cos(pa + 2.2) * pr, cy0 + Math.sin(pa + 2.2) * pr * 0.75], [cx0 + Math.cos(pa + 4.1) * pr, cy0 + Math.sin(pa + 4.1) * pr * 0.75]]);
          }
        }
      }
    }
  }
  var SOIL_DARK = ['#3a2618', '#2f1e14', '#44301f'];
  var SOIL_CLAY = ['#8f5636', '#a0643f', '#7d4a30'];
  var SOIL_SAND = ['#b89c6c', '#c7ad7c', '#a98e60'];
  var PEBBLE = ['#9b9a92', '#b3b0a4', '#7f7d76', '#c4bfae'];
  // Type de terre par plaque (cellules d'environ 2 colonnes x 2 rangees), avec un peu de bruit par triangle.
  function soilPatchPal(gj, k, q) {
    var r = soilHash((gj >> 1) + 500, k >> 1, 40);
    if (soilHash(gj, k, 41 + q) < 0.18) r = soilHash(gj, k, 43 + q);
    if (r < 0.40) return SOIL;
    if (r < 0.58) return SOIL_DARK;
    if (r < 0.77) return SOIL_CLAY;
    return SOIL_SAND;
  }
  function soilHash(i, k, s) {
    var v = Math.sin(i * 127.1 + k * 311.7 + s * 74.7) * 43758.5453;
    return v - Math.floor(v);
  }
  var soilShadeCache = {};
  function soilShade(hex, m, gray) {
    gray = Math.round((gray || 0) * 10) / 10;
    var key = hex + Math.round(m * 50) + '|' + gray, c = soilShadeCache[key];
    if (c) return c;
    var v = parseInt(hex.slice(1), 16), r = v >> 16, g = (v >> 8) & 255, b = v & 255;
    if (gray) { r += (125 - r) * gray; g += (122 - g) * gray; b += (116 - b) * gray; }   // vers la pierre
    return (soilShadeCache[key] = shadeRgb(r, g, b, Math.round(m * 50) / 50));
  }

  // Depots d'humus lessives (voir leach()) encore enfouis sous le plafond du compact : de
  // petits triangles sombres, juste assez visibles pour deviner ou la pelle va en retrouver.
  function drawCompactNutri(rise) {
    for (var i = 0; i < compactNutri.length; i++) {
      var d = compactNutri[i];
      if (d.x < camX - 20 || d.x > camX + W + 20) continue;
      var col = Math.max(0, Math.min(compactY.length - 1, Math.round(d.x / COL_W)));
      if (d.y <= compactY[col]) continue; // deja ramene au-dessus du plafond : plus la peine
      var y = d.y + rise, s = 5;
      ctx.fillStyle = d.color;
      poly([[d.x - s, y + s], [d.x + s, y + s], [d.x, y - s]]);
    }
  }

  // Fond de la terre meuble : aplat sous les facettes, entre compactY et un peu sous la
  // surface, pour qu'on ne voie pas le ciel entre les triangles empiles. Seulement la ou
  // il y a vraiment de la terre meuble (LOOSE_MIN) : au bord d'un trou, le lissage laisse
  // une fine epaisseur fantome, qu'on ne peint pas.
  var LOOSE_MIN = 4, LOOSE_INSET = 5;
  function drawLooseBacking(rise) {
    var c0 = Math.max(0, Math.floor(camX / COL_W) - 1);
    var c1 = Math.min(heights.length - 1, Math.ceil((camX + W) / COL_W) + 1);
    ctx.fillStyle = '#5a3d28';
    ctx.beginPath();
    for (var c = c0; c <= c1; c++) {
      var h = heights[c] - LOOSE_INSET;
      if (heights[c] < LOOSE_MIN || h <= 0) continue;
      var x = c * COL_W, yb = compactY[c] + rise;
      ctx.rect(x - COL_W / 2, yb - h, COL_W + 0.5, h + 1);
    }
    ctx.fill();
  }

  // Brins de gazon : quelques petits triangles pleins par colonne, hauteur proportionnelle
  // a grassCover[c] (pousse visiblement au fil de la repousse). Seed stable (pas de
  // Math.random() ici) pour que les brins ne scintillent pas d'une frame a l'autre.
  function drawGrass(rise) {
    if (!grassCover) return;
    var c0 = Math.max(0, Math.floor(camX / COL_W) - 1);
    var c1 = Math.min(grassCover.length - 1, Math.ceil((camX + W) / COL_W) + 1);
    var maxH = U * GRASS_MAX_H_F;
    for (var c = c0; c <= c1; c++) {
      var cov = grassCover[c];
      if (cov <= 0.03) continue;
      // +GRASS_EMBED : le terrain low-poly est irregulier, pas une ligne lisse — sans cet
      // enfoncement (meme principe que les champignons, surfaceAt(x) + 6 en drawMushroom),
      // la base des brins flotterait au-dessus des pointes de triangles de terre.
      var x = c * COL_W, y = surfaceAt(x) + rise + GRASS_EMBED;
      var bh = maxH * cov * (grassMyc && grassMyc[c] ? GRASS_MYC_HEIGHT_MULT : 1);
      for (var b = 0; b < 3; b++) {
        var seed = ((c * 7 + b * 3) % 11) / 11;
        var dx = (b - 1) * COL_W * 0.32, lean = (seed - 0.5) * bh * 0.5, h = bh * (0.65 + seed * 0.5);
        ctx.fillStyle = GRASS_COLOR[(c + b) % GRASS_COLOR.length];
        ctx.beginPath();
        ctx.moveTo(x + dx - 1.4, y);
        ctx.lineTo(x + dx + 1.4, y);
        ctx.lineTo(x + dx + lean, y - h);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // Hash entier stable a partir de l'indice de colonne : sert de graine pour placer la
  // mousse/le sous-bois sans jamais appeler Math.random() dans le dessin (rien ne doit
  // scintiller d'une frame a l'autre, meme principe que drawGrass ci-dessus).
  function floraHash(c) { return ((c * 2654435761) >>> 0) % 997 / 997; }

  // Mousse : fine bande collee au sol, dessinee juste avant les brins de gazon. Purement
  // cosmetique (voir section "Flore (cosmetique)") : montre que le sol cultive est vivant,
  // aucune incidence sur le jeu. Echantillonnee aux deux bords de la colonne (comme
  // GRASS_EMBED) pour suivre les bosses du terrain low-poly, decoupee en 2 triangles de
  // teintes differentes (pas de degrade).
  function drawMoss(rise) {
    if (!floraLush) return;
    var c0 = Math.max(0, Math.floor(camX / COL_W) - 1);
    var c1 = Math.min(floraLush.length - 1, Math.ceil((camX + W) / COL_W) + 1);
    for (var c = c0; c <= c1; c++) {
      var lush = floraLush[c];
      if (lush <= 0.08) continue;
      var xL = c * COL_W - COL_W / 2, xR = c * COL_W + COL_W / 2;
      var yL = surfaceAt(xL) + rise + FLORA_EMBED, yR = surfaceAt(xR) + rise + FLORA_EMBED;
      var th = MOSS_THICK * lush;
      ctx.fillStyle = MOSS_COLOR[c % MOSS_COLOR.length];
      poly([[xL, yL], [xR, yR], [xL, yL + th]]);
      ctx.fillStyle = MOSS_COLOR[(c + 2) % MOSS_COLOR.length];
      poly([[xR, yR], [xR, yR + th], [xL, yL + th]]);
      // Petit monticule plus fourni, sur environ une colonne sur trois et seulement une
      // fois la mousse bien installee : deborde un peu par-dessus la bande.
      if (lush > 0.4 && c % 3 === 0) {
        var mh = MOSS_THICK * 0.5 * lush, mw = COL_W * 2.4, mcx = c * COL_W, mcy = (yL + yR) / 2;
        ctx.fillStyle = '#7fae52';
        poly([[mcx - mw / 2, mcy], [mcx + mw / 2, mcy], [mcx, mcy - mh]]);
      }
    }
  }

  var TUFT_COLOR = ['#6f9c4a', '#82ad5b', '#5c8a3f', '#94bf62'];

  // Touffe d'herbe haute : eventail de 5 brins, comme drawGrass mais plus grands et plus
  // fournis — la densite (k, 0..1) grandit avec floraLush pour un effet de pousse.
  function drawTuft(x, y, k, c) {
    if (k <= 0) return;
    var maxH = U * FLORA_TUFT_H_F * k;
    for (var b = 0; b < 5; b++) {
      var seed = floraHash(c * 5 + b + 1);
      var lean = (-0.6 + (b / 4) * 1.2) * maxH;
      var bh = maxH * (0.7 + seed * 0.4);
      var dx = (b - 2) * 1.6;
      ctx.fillStyle = TUFT_COLOR[(b + (seed * 4 | 0)) % TUFT_COLOR.length];
      ctx.beginPath();
      ctx.moveTo(x + dx - 1.2, y);
      ctx.lineTo(x + dx + 1.2, y);
      ctx.lineTo(x + dx + lean, y - bh);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Fougere : 3-4 frondes qui partent de la base, chacune une tige effilee en 3 segments
  // courbee vers l'exterieur, avec des paires de folioles qui rapetissent vers la pointe.
  function drawFern(x, y, k, seedBase) {
    if (k <= 0) return;
    var maxH = U * FLORA_FERN_H_F * k;
    var fronds = 3 + (floraHash(seedBase + 2) < 0.5 ? 0 : 1);
    for (var fr = 0; fr < fronds; fr++) {
      var seed = floraHash(seedBase + fr + 3);
      var side = (fr % 2 === 0) ? 1 : -1;
      var curve = side * (0.18 + seed * 0.22);
      var fh = maxH * (0.75 + seed * 0.3);
      var segs = 3, pairs = 3 + (seed < 0.5 ? 0 : 1);
      var px = x, py = y, sg;
      ctx.fillStyle = '#3f7a3a';
      for (sg = 1; sg <= segs; sg++) {
        var t = sg / segs;
        var nx = x + curve * fh * t * t, ny = y - fh * t;
        var wA = 1.6 * (1 - (sg - 1) / segs), wB = 1.6 * (1 - sg / segs) + 0.3;
        poly([[px - wA, py], [px + wA, py], [nx + wB, ny], [nx - wB, ny]]);
        px = nx; py = ny;
      }
      // Folioles : paires de petits triangles le long de la tige, plus petites vers la pointe.
      for (var p = 1; p <= pairs; p++) {
        var t2 = p / (pairs + 1);
        var fx = x + curve * fh * t2 * t2, fy = y - fh * t2;
        var fs = (3 - 2 * t2) * 1.2;
        ctx.fillStyle = (p % 2) ? '#5a9a4a' : '#78b35c';
        poly([[fx, fy], [fx + fs * 2.2, fy - fs * 0.6], [fx + fs * 0.6, fy - fs * 1.4]]);
        poly([[fx, fy], [fx - fs * 2.2, fy - fs * 0.6], [fx - fs * 0.6, fy - fs * 1.4]]);
      }
    }
  }

  // Petit buisson : dome de triangles qui se chevauchent (comme l'eventail du chapeau de
  // drawMushroom), une facette claire a gauche (meme convention d'eclairage que le reste du
  // fichier), et parfois quelques minuscules baies/fleurs.
  function drawBush(x, y, k, seedBase) {
    if (k <= 0) return;
    var r = U * FLORA_BUSH_R_F * k;
    if (r <= 0) return;
    var n = 5 + (floraHash(seedBase + 4) < 0.5 ? 0 : 2);
    var colors = ['#4d7f3a', '#5f9444', '#3d6b30'];
    var cy = y - r * 0.7;
    for (var i = 0; i < n; i++) {
      var a0 = Math.PI + (i / n) * Math.PI, a1 = Math.PI + ((i + 1) / n) * Math.PI;
      ctx.fillStyle = i === 0 ? '#7cae57' : colors[i % colors.length];
      poly([[x, cy], [x + Math.cos(a0) * r, cy + Math.sin(a0) * r * 0.85], [x + Math.cos(a1) * r, cy + Math.sin(a1) * r * 0.85]]);
    }
    // Petites baies/fleurs, seulement environ une plante sur trois.
    if (floraHash(seedBase + 5) < 0.33) {
      var berry = floraHash(seedBase + 6) < 0.5 ? '#e9e2c8' : '#d9534f';
      var count = 2 + (floraHash(seedBase + 7) < 0.5 ? 0 : 1);
      ctx.fillStyle = berry;
      for (var b = 0; b < count; b++) {
        var ba = Math.PI + floraHash(seedBase + 8 + b) * Math.PI;
        var bx = x + Math.cos(ba) * r * 0.8, by = cy + Math.sin(ba) * r * 0.7;
        poly([[bx - 1, by], [bx + 1, by], [bx, by - 2]]);
      }
    }
  }

  // Sous-bois : place touffes hautes et petit feuillage (fougere ou buisson) sur des
  // colonnes choisies par graine stable, seulement au-dessus du seuil de densite de chaque
  // element ; la taille grandit avec floraLush (effet de pousse). Purement cosmetique,
  // dessine apres les racines et avant les champignons (voir draw()).
  function drawUnderbrush(rise) {
    if (!floraLush) return;
    var c0 = Math.max(0, Math.floor(camX / COL_W) - 1);
    var c1 = Math.min(floraLush.length - 1, Math.ceil((camX + W) / COL_W) + 1);
    for (var c = c0; c <= c1; c++) {
      var lush = floraLush[c];
      if (lush <= 0.25) continue;
      var h = floraHash(c);
      var baseX = c * COL_W + (h - 0.5) * COL_W * 0.8;
      var baseY = surfaceAt(baseX) + rise + FLORA_EMBED;
      // Touffe haute : environ une colonne sur deux.
      if (h < 0.5) drawTuft(baseX, baseY, Math.min(1, (lush - 0.25) / 0.75), c);
      // Petit feuillage : au plus une plante par bloc de 5 colonnes, a une place fixee par
      // le hash du bloc (~1 bloc sur 2). Ne depend ni de la camera ni des voisines, donc
      // rien n'apparait/disparait en defilant.
      if (lush > 0.5) {
        var blk = Math.floor(c / 5), hf = floraHash(blk * 31 + 7);
        if (hf < 0.5 && c === blk * 5 + Math.floor(floraHash(blk * 13 + 5) * 5)) {
          var fk = Math.min(1, (lush - 0.5) / 0.5), seedBase = c * 9;
          if (floraHash(c * 17 + 3) < 0.5) drawFern(baseX, baseY, fk, seedBase);
          else drawBush(baseX, baseY, fk, seedBase);
        }
      }
    }
  }

  // Fleurs au pied des arbres (voir spawnFlower/stepFlowers plus haut) : une seule espece
  // (anemone des bois, blanc rose), en 3 temps enchaines - tige, bouton, corolle en etoile de
  // 5 petales vue de trois-quarts (faceTilt) - puis une fanaison si sa branche est tombee.
  // Meme convention d'eclairage que le reste du fichier (haut-gauche plus clair) : chaque
  // petale recoit sa propre teinte selon son orientation face au soleil (FLOWER_LIGHT_A), en
  // plus du clair/sombre fixe entre ses deux moities (comme le tronc ou la tige). Jamais de
  // Math.random() ici : tout vient de f.* (fixe a la naissance) ou du temps (now/p/w).
  var FLOWER_LIGHT_A = -Math.PI * 0.75; // direction "haut-gauche", meme convention que shade()

  // Un petale = 2 triangles qui partagent la nervure centrale (base -> pointe), la pointe
  // etant elle-meme approximee par 2 points tres proches (tipA/tipB) plutot qu'un seul, pour
  // eviter un triangle a pointe brute. faceTilt ecrase la coordonnee "verticale" locale
  // (vue de trois-quarts) ; l'inclinaison generale (lean) est deja geree par le ctx.rotate
  // de l'appelant, pas ici.
  function drawPetal(ang, rad, faceTilt, colA, colB) {
    var ca = Math.cos(ang), sa = Math.sin(ang);
    function pt(lx, ly) { var x = ca * lx - sa * ly, y = sa * lx + ca * ly; return [x, y * faceTilt]; }
    var base = pt(0, 0), flankL = pt(rad * 0.55, -rad * 0.45), tipA = pt(rad, -rad * 0.12),
      tipB = pt(rad, rad * 0.12), flankR = pt(rad * 0.55, rad * 0.45), tipM = pt(rad * 1.04, 0);
    // Chaque moitie va jusqu'au bout de la nervure (tipM) : pas d'encoche a la pointe.
    ctx.fillStyle = colA;
    poly([base, flankL, tipA, tipM]);
    ctx.fillStyle = colB;
    poly([base, tipM, tipB, flankR]);
  }

  function drawFlower(f, rise) {
    if (f.x < camX - 30 || f.x > camX + W + 30) return;
    var now = vTime, p = clamp((now - f.born) / FLOWER_BLOOM_MS, 0, 1);
    if (p <= 0) return;
    var w = f.wilt !== null ? clamp((now - f.wilt) / FLOWER_WILT_MS, 0, 1) : 0;
    var leanSign = f.lean < 0 ? -1 : 1;
    var lean = f.lean + 0.6 * w * leanSign;
    var baseY = surfaceAt(f.x) + rise + FLORA_EMBED;
    var stemLocal = clamp(p / 0.35, 0, 1), stemG = easeOutBack(stemLocal);
    var stemH = FLOWER_H_F * U * f.sizeK * stemG * (1 - 0.35 * w);
    var stemW = Math.max(1.1, U * 0.0032 * f.sizeK);
    ctx.save();
    ctx.translate(f.x, baseY);
    ctx.rotate(lean);
    // Tige : 3 segments effiles, legerement courbes dans le sens de l'inclinaison (comme
    // les frondes de drawFern), deux facettes par segment (claire a gauche, sombre a droite).
    var curveK = stemH * 0.3 * leanSign, px = 0, py = 0, sg;
    for (sg = 1; sg <= 3; sg++) {
      var t0 = (sg - 1) / 3, t1 = sg / 3;
      var nx = curveK * t1 * t1, ny = -stemH * t1;
      var wA = stemW * (1 - t0 * 0.5), wB = stemW * (1 - t1 * 0.55);
      ctx.fillStyle = '#5f8f3c';
      poly([[px - wA, py], [px, py], [nx, ny], [nx - wB, ny]]);
      ctx.fillStyle = '#43702c';
      poly([[px, py], [px + wA, py], [nx + wB, ny], [nx, ny]]);
      px = nx; py = ny;
    }
    var tipX = px, tipY = py;
    // Feuille lanceolee a mi-hauteur, du cote f.leafSide : losange de 2 triangles partageant
    // la nervure base->pointe, qui se deploie avec la tige (echelle stemG).
    var midX = curveK * 0.25, midY = -stemH * 0.5;
    var leafLen = stemH * 0.6 * stemG, leafW = stemH * 0.24 * stemG;
    if (leafLen > 0.5) {
      var lTipX = midX + f.leafSide * leafLen, lTipY = midY - leafLen * 0.18;
      var lWx = midX + f.leafSide * leafLen * 0.42, lWTop = midY - leafW * 0.55, lWBot = midY + leafW * 0.55;
      ctx.fillStyle = '#6ea347';
      poly([[midX, midY], [lWx, lWTop], [lTipX, lTipY]]);
      ctx.fillStyle = '#4c7d33';
      poly([[midX, midY], [lTipX, lTipY], [lWx, lWBot]]);
    }
    if (p >= 0.35) {
      var budLocal = clamp((p - 0.35) / 0.2, 0, 1), budG = easeOutBack(budLocal);
      if (p < 0.55) {
        // Bouton : 2 sepales verts qui enserrent une goutte rose (3 triangles).
        var budR = FLOWER_R_F * U * f.sizeK * 0.55 * budG;
        if (budR > 0.4) {
          ctx.fillStyle = '#4c7d33';
          poly([[tipX, tipY], [tipX - budR * 0.55, tipY + budR * 0.15], [tipX - budR * 0.15, tipY - budR * 1.15]]);
          poly([[tipX, tipY], [tipX + budR * 0.55, tipY + budR * 0.15], [tipX + budR * 0.15, tipY - budR * 1.15]]);
          var budRgb = hexToRgb('#8f2530');
          ctx.fillStyle = rgbStr(budRgb);
          poly([[tipX, tipY - budR * 0.2], [tipX - budR * 0.4, tipY - budR * 0.9], [tipX, tipY - budR * 1.3]]);
          ctx.fillStyle = rgbStr(shade(budRgb, -0.15));
          poly([[tipX, tipY - budR * 0.2], [tipX, tipY - budR * 1.3], [tipX + budR * 0.4, tipY - budR * 0.9]]);
          ctx.fillStyle = rgbStr(shade(budRgb, 0.15));
          poly([[tipX - budR * 0.4, tipY - budR * 0.9], [tipX, tipY - budR * 1.3], [tipX + budR * 0.4, tipY - budR * 0.9]]);
        }
      } else {
        // Corolle : 5 petales en etoile, ouverture en easeOutBack non clampe (le petit
        // rebond final passe volontairement au-dela de la taille/angle de repos).
        // La corolle et le coeur se dessinent autour de (0,0) : on se place au bout de la tige.
        ctx.translate(tipX, tipY);
        var petalLocal = clamp((p - 0.55) / 0.45, 0, 1), og = easeOutBack(petalLocal);
        var maxRad = FLOWER_R_F * U * f.sizeK;
        var rad = maxRad * lerp(0.3, 1, og) * (1 - 0.5 * w);
        var upA = -Math.PI / 2, dropA = Math.PI / 2, i;
        var petals = [];
        for (i = 0; i < 5; i++) {
          var finalA = f.rot + i * (Math.PI * 2 / 5);
          var a = lerp(upA, finalA, og);
          if (w > 0) a = lerp(a, dropA, w);
          petals.push({ a: a, y: Math.sin(a) * rad * f.faceTilt });
        }
        petals.sort(function (p1, p2) { return p1.y - p2.y; }); // fond (haut de l'ellipse) avant devant
        var baseRgb = hexToRgb('#c8323c'), wiltRgb = hexToRgb('#7a4a3a');
        for (i = 0; i < petals.length; i++) {
          var pet = petals[i];
          // Orientation face au soleil (haut-gauche) : k borne pour ne jamais assombrir le
          // rouge sous ~'#9c2730' : assez de contraste entre faces sans virer au brun.
          var orientK = Math.cos(pet.a - FLOWER_LIGHT_A) * 0.15;
          var kA = Math.max(-0.22, orientK + 0.05), kB = Math.max(-0.22, orientK - 0.05);
          var rgbA = shade(baseRgb, kA), rgbB = shade(baseRgb, kB);
          if (w > 0) {
            rgbA = rgbA.map(function (c, j) { return Math.round(lerp(c, wiltRgb[j], w)); });
            rgbB = rgbB.map(function (c, j) { return Math.round(lerp(c, wiltRgb[j], w)); });
          }
          drawPetal(pet.a, rad, f.faceTilt, rgbStr(rgbA), rgbStr(rgbB));
        }
        // Coeur : petit disque en eventail de 6 triangles, alternant 2 tons de jaune.
        if (petalLocal > 0.15) {
          var coreR = maxRad * 0.28 * Math.min(1, petalLocal / 0.5);
          var coreCols = ['#f2c14e', '#dca32f'];
          for (i = 0; i < 6; i++) {
            var a0 = i / 6 * Math.PI * 2, a1 = (i + 1) / 6 * Math.PI * 2;
            ctx.fillStyle = coreCols[i % 2];
            poly([[0, 0], [Math.cos(a0) * coreR, Math.sin(a0) * coreR * f.faceTilt], [Math.cos(a1) * coreR, Math.sin(a1) * coreR * f.faceTilt]]);
          }
          // Etamines : minuscules triangles, seulement une fois la corolle presque grande ouverte.
          if (p > 0.85) {
            ctx.fillStyle = '#8a5a2b';
            for (i = 0; i < 5; i++) {
              var sa2 = f.rot * 1.3 + i * (Math.PI * 2 / 5);
              var ex = Math.cos(sa2) * coreR * 1.4, ey = Math.sin(sa2) * coreR * 1.4 * f.faceTilt;
              poly([[ex, ey], [ex + 1.5, ey - 1], [ex - 0.5, ey - 1.5]]);
            }
          }
        }
      }
    }
    ctx.restore();
  }

  function drawFlowers(rise) {
    for (var ti = 0; ti < trees.length; ti++) {
      var flowers = trees[ti].flowers;
      for (var i = 0; i < flowers.length; i++) drawFlower(flowers[i], rise);
    }
  }

  // Largeur des ailes du papillon (0.15..1) : bat normalement, sauf ~20% du temps (cycle
  // deterministe via age+glideSeed, jamais Math.random ici) ou il plane, ailes grandes
  // ouvertes et immobiles ; une fois pose, ouverture/fermeture lente (~1 Hz).
  function butterflyWingFactor(ins) {
    if (ins.caught) return Math.max(0.15, Math.abs(Math.cos(ins.age / 45 + ins.phaseWing))); // ailes agitees
    if (ins.state === 'landed') {
      var tPh = (ins.age - ins.landAt) / 1000 * Math.PI * 2;
      return Math.max(0.15, Math.abs(Math.cos(tPh)));
    }
    var gcyc = 3000, gt = ((ins.age + ins.glideSeed) % gcyc) / gcyc;
    if (gt < 0.2) return 1;
    var phase = (ins.age / 200) * Math.PI * 2 + ins.phaseWing;
    return Math.max(0.15, Math.abs(Math.cos(phase)));
  }
  // Une seule aile (anterieure ou posterieure), cote ySign (-1/1) : 2 triangles pleins
  // (face claire / face sombre), plus un bout d'aile sombre et un point creme sur les
  // anterieures seulement. La largeur (span) porte le battement, jamais la longueur.
  function drawButterflyWing(size, wf, ySign, anterior) {
    var ax = anterior ? size * 0.08 : -size * 0.32;
    var len = anterior ? size * 0.85 : size * 0.5;
    var span = (anterior ? size * 0.95 : size * 0.55) * wf;
    var pInner = [ax, 0];
    var pLead = [ax + len * 0.55, ySign * span * 0.35];
    var pOuter = [ax + len * 0.15, ySign * span];
    var pTrail = [ax - len * 0.55, ySign * span * 0.45];
    ctx.fillStyle = anterior ? '#e8923a' : '#d9812e';
    poly([pInner, pLead, pOuter]);
    ctx.fillStyle = anterior ? '#c46f22' : '#a85c1c';
    poly([pInner, pOuter, pTrail]);
    if (anterior) {
      var tip = [ax + len * 0.02, ySign * span * 1.12];
      ctx.fillStyle = '#3a2a20';
      poly([pLead, pOuter, tip]);
      var midX = (pInner[0] + pOuter[0]) / 2, midY = (pInner[1] + pOuter[1]) / 2, d = size * 0.09;
      ctx.fillStyle = '#f3e3c3';
      poly([[midX - d, midY], [midX + d, midY], [midX, midY - ySign * d]]);
    }
  }
  function drawButterfly(ins, size) {
    var wf = butterflyWingFactor(ins), s;
    for (s = -1; s <= 1; s += 2) {
      drawButterflyWing(size, wf, s, true);
      drawButterflyWing(size, wf, s, false);
    }
    var bl = size * 0.55, bw = size * 0.16;
    ctx.fillStyle = '#3a2a20';
    poly([[bl / 2, 0], [0, -bw / 2], [-bl / 2, 0], [0, bw / 2]]);
    var aLen = size * 0.4;
    poly([[bl * 0.4, -bw * 0.3], [bl * 0.4 + aLen, -bw * 1.6], [bl * 0.4 + aLen * 0.85, -bw * 1.5]]);
    poly([[bl * 0.4, bw * 0.3], [bl * 0.4 + aLen, bw * 1.6], [bl * 0.4 + aLen * 0.85, bw * 1.5]]);
  }
  // Battement du bourdon : alterne pleine largeur / largeur reduite d'une phase de 20ms a
  // l'autre (~25 Hz visuel), continue meme une fois pose.
  function beeWingFactor(ins) {
    return Math.floor(ins.age / 20) % 2 === 0 ? 1 : 0.4;
  }
  function drawBee(ins, size) {
    var wf = beeWingFactor(ins);
    var rx = size * 0.5, ry = size * 0.24, segs = 6;
    var cols = ['#f2c14e', '#3a2a20', '#dca32f', '#f2c14e', '#3a2a20', '#dca32f'];
    for (var i = 0; i < segs; i++) {
      var a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2;
      ctx.fillStyle = cols[i % cols.length];
      poly([[0, 0], [Math.cos(a0) * rx, Math.sin(a0) * ry], [Math.cos(a1) * rx, Math.sin(a1) * ry]]);
    }
    var wLen = size * 0.55 * wf;
    ctx.fillStyle = '#e6eef0';
    poly([[-size * 0.05, -ry * 0.6], [-size * 0.35, -ry * 0.6 - wLen], [-size * 0.5, -ry * 0.5]]);
    ctx.fillStyle = '#cdd9dc';
    poly([[size * 0.05, -ry * 0.6], [size * 0.05, -ry * 0.6 - wLen * 0.85], [size * 0.32, -ry * 0.55]]);
  }
  // Insecte cosmetique complet : se place et s'oriente legerement dans le sens du vol, puis
  // delegue a l'espece. Le bourdon pose ajoute un petit pietinement (+/-1.5px, purement
  // visuel, ne touche jamais ins.x/ins.y reels) tire de l'age ecoule, pas de Math.random.
  function drawInsect(ins) {
    var size = U * INSECT_SIZE_F * ins.sizeMult;
    var jx = 0, jy = 0;
    if (ins.species === 'bourdon' && ins.state === 'landed') {
      var jt = ins.age - ins.landAt;
      jx = Math.sin(jt / 220 + ins.landPh) * 1.5;
      jy = Math.cos(jt / 170 + ins.landPh * 1.3) * 0.8;
    }
    ctx.save();
    ctx.translate(ins.x + jx, ins.y + jy);
    ctx.rotate(0.14 * ins.dir);
    if (ins.caught) { var cp = Math.min(1, (ins.age - ins.caughtAt) / 150); ctx.scale(1 + 0.4 * cp, 1 + 0.4 * cp); }
    if (ins.species === 'papillon') drawButterfly(ins, size); else drawBee(ins, size);
    ctx.restore();
  }
  // Vol : derriere le decor (appelee juste apres le translate camera, avant drawSoil).
  function drawInsectsBack() {
    for (var i = 0; i < insects.length; i++) if (!insects[i].nearFlower) drawInsect(insects[i]);
  }
  // Approche finale / pose sur une fleur : devant le decor (apres drawFlowers).
  function drawInsectsFront() {
    for (var i = 0; i < insects.length; i++) if (insects[i].nearFlower) drawInsect(insects[i]);
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
    if (m.sp.hydne) { drawHydne(m, s); ctx.restore(); return; }
    if (m.sp.strophaire) { drawStrophaire(m, s); ctx.restore(); return; }
    if (m.sp.pleurote) { drawPleurotes(m, m.sp.cap, m.sp.gill, s * PLEUROTE_SIZE); ctx.restore(); return; }
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

  // Hydne herisson : boule bosselee posee au sol (pas de pied), facettes eclairees en haut-gauche
  // avec bord plus fonce, dents en fine texture (chacune avec sa petite ombre) et frange de
  // poils fins en bas. Geometrie calculee une fois par champignon (unite s = 1, seed stable)
  // puis dessinee a l'echelle. HYDNE_SIZE : plus petit que les autres pour que le decor
  // (herbe, arbres) le detache du ciel clair.
  var HYDNE_SIZE = 0.55;
  function hydRnd(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function hydneGeo(m) {
    var seed = (Math.abs(m.x) % 97) * 0.13, cap = hexToRgb(m.sp.cap);
    var R = 0.62, cy = -R * 0.86, N = 18, TAU = Math.PI * 2, i, a0, a1, am;
    function rad(a) { return R * (1 + 0.15 * Math.sin(2 * a + seed) + 0.1 * Math.sin(3 * a + seed * 2) + 0.06 * Math.sin(5 * a + seed * 3) + 0.03 * Math.sin(9 * a + seed)); }
    function pt(a, f) { var r = rad(a) * f, sy = Math.sin(a); return [Math.cos(a) * r * 1.08, cy + sy * r * (sy > 0 ? 0.72 : 0.92)]; }
    // eclairage selon la position (haut-gauche clair) ; f = distance au centre, le bord s'assombrit
    function tone(x, y, f) {
      var t = -((x / (R * 1.1)) * 0.6 + ((y - cy) / (R * 0.95)) * 0.8) * 0.39 - 0.06;
      if (f > 0.8) t -= (f - 0.8) * 0.9;
      return t;
    }
    function tri(p, k) { return { p: p, c: rgbStr(shade(cap, k)) }; }
    var facets = [], teeth = [], fringe = [], rings = [1, 0.72, 0.42], r, f0, f1, j0, j1, A, B, C, D;
    for (r = 0; r < 2; r++) {
      for (i = 0; i < N; i++) {
        a0 = i / N * TAU; a1 = (i + 1) / N * TAU;
        f0 = rings[r]; f1 = rings[r + 1];
        j0 = 0.05 * (hydRnd(i + r * 30 + seed) - 0.5); j1 = 0.05 * (hydRnd(i + 1 + r * 30 + seed) - 0.5);
        A = pt(a0, f0); B = pt(a1, f0); C = pt(a1 + 0.06, f1 + j1); D = pt(a0 + 0.06, f1 + j0);
        facets.push(tri([A, B, C], tone((A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3, (2 * f0 + f1) / 3)));
        facets.push(tri([A, C, D], tone((A[0] + C[0] + D[0]) / 3, (A[1] + C[1] + D[1]) / 3, (f0 + 2 * f1) / 3) + 0.02));
      }
    }
    for (i = 0; i < N; i++) {
      a0 = i / N * TAU; a1 = (i + 1) / N * TAU;
      var q0 = pt(a0 + 0.06, 0.42), q1 = pt(a1 + 0.06, 0.42);
      facets.push(tri([[0, cy], q0, q1], tone((q0[0] + q1[0]) / 2, (q0[1] + q1[1]) / 2, 0.42)));
    }
    // dents : ordre aleatoire, on n'en dessine qu'un prefixe selon la taille. Orientees
    // le long de la surface (vers le bas, vers l'exterieur pres du bord), ombre decalee dessous.
    for (i = 0; i < 420; i++) {
      var a = hydRnd(i * 3 + seed) * TAU, f = Math.sqrt(hydRnd(i * 5 + 1 + seed)) * 0.95, p = pt(a, f);
      var dx = Math.cos(a) * 0.55 * f, dy = 0.75 + Math.sin(a) * 0.35 * f, L = Math.hypot(dx, dy);
      dx /= L; dy /= L;
      var len = 0.05 * (0.7 + 0.6 * hydRnd(i * 7 + 2)), w = 0.02 * (1.1 - 0.4 * f), nx = -dy, ny = dx;
      var t = tone(p[0], p[1], f), tip = [p[0] + dx * len, p[1] + dy * len];
      teeth.push(tri([[p[0] - nx * w + 0.008, p[1] - ny * w + 0.012], [p[0] + nx * w + 0.008, p[1] + ny * w + 0.012], [tip[0] + 0.008, tip[1] + 0.012]], t - 0.24));
      teeth.push(tri([[p[0] - nx * w, p[1] - ny * w], [p[0] + nx * w, p[1] + ny * w], tip], t + (hydRnd(i * 11 + 3) - 0.35) * 0.14));
    }
    // frange : poils fins (base etroite, legerement courbes), plus longs vers le bas
    var K = N * 8;
    for (i = 0; i < K; i++) {
      am = (i + hydRnd(i + seed) * 0.6) / K * TAU;
      var d = Math.sin(am);
      if (d < -0.05) continue;
      var b = pt(am, 0.985), hl = 0.07 * (0.6 + 0.7 * hydRnd(i * 3 + seed)) * (d + 0.35), hw = 0.006 * (0.8 + 0.5 * hydRnd(i * 5 + seed));
      var lean = (hydRnd(i * 7 + seed) - 0.5) * 0.02 + Math.cos(am) * 0.012;
      fringe.push(tri([[b[0] - hw, b[1]], [b[0] + hw, b[1]], [b[0] + lean * 0.6 + hw * 0.5, b[1] + hl * 0.55], [b[0] + lean, b[1] + hl]],
        tone(b[0], b[1], 1) - 0.04 + (hydRnd(i * 11) - 0.5) * 0.14));
    }
    return { facets: facets, teeth: teeth, fringe: fringe };
  }
  function drawHydne(m, s) {
    var g = m.hydGeo || (m.hydGeo = hydneGeo(m)), i;
    s *= HYDNE_SIZE;
    var dens = Math.max(60, Math.min(420, Math.round(s * 3))) * 2; // 2 triangles par dent (ombre + dent)
    ctx.scale(s, s);
    for (i = 0; i < g.facets.length; i++) { ctx.fillStyle = g.facets[i].c; poly(g.facets[i].p); }
    for (i = 0; i < dens; i++) { ctx.fillStyle = g.teeth[i].c; poly(g.teeth[i].p); }
    for (i = 0; i < g.fringe.length; i++) { ctx.fillStyle = g.fringe[i].c; poly(g.fringe[i].p); }
  }

  // Pleurotes en bouquet (gris, rose, huitre) : 6 chapeaux en etages comme le logo. Chaque
  // chapeau = eventail de lamelles 2 tons sous un bord replie sombre, sous un dome facette
  // (lumiere haut-gauche). Geometrie en unites de s, seedee sur m.x, cachee sur m._pleu.
  // PLEUROTE_SIZE : un bouquet est plus large qu'un champignon seul, on le reduit un peu.
  var PLEUROTE_SIZE = 0.8;
  var PLEU_CAPS = [ // ax, ay (attache), ang (rad, 0 = haut), W, h, T, k (ton), off (decentrage du pied)
    [ 0.02, -0.60,  0.08, 0.44, 0.30, 0.17, -0.14,  0.10],
    [-0.12, -0.44, -0.42, 0.36, 0.28, 0.15, -0.08,  0.30],
    [ 0.14, -0.40,  0.48, 0.36, 0.28, 0.15, -0.05, -0.30],
    [-0.08, -0.22, -0.62, 0.28, 0.24, 0.12,  0.03,  0.25],
    [ 0.10, -0.18,  0.55, 0.27, 0.23, 0.12,  0.06, -0.25],
    [ 0.00, -0.06, -0.10, 0.20, 0.17, 0.09,  0.12,  0.15]
  ];
  function pleuroteGeom(m) {
    var r = Math.floor(Math.abs(m.x) * 7) % 2147483646 + 1;
    function rnd() { r = (r * 16807) % 2147483647; return r / 2147483647; }
    var caps = [], N = 7, c, i;
    function mk(P, ang) {
      var ca = Math.cos(ang), sa = Math.sin(ang);
      return function (x, y) { return [P[0] + x * ca - y * sa, P[1] + x * sa + y * ca]; };
    }
    for (c = 0; c < PLEU_CAPS.length; c++) {
      var P = PLEU_CAPS[c], tr = mk(P, P[2] + (rnd() - 0.5) * 0.12);
      var rim = [], top = [], lip = [];
      for (i = 0; i <= N; i++) {
        var u = -1 + 2 * i / N, wave = (i % 2 ? 0.035 : -0.02) * P[3] + (rnd() - 0.5) * 0.02;
        var rx = (u + P[7] * 0.4) * P[3], ry = -P[4] + 0.10 * P[3] * u * u + wave;  // bord : arc qui retombe aux extremites
        rim.push(tr(rx, ry));
        lip.push(tr(rx * 0.96, ry + 0.045));                                          // bord replie sous le bord
        top.push(tr(rx * 0.97, ry - P[5] * Math.sqrt(Math.max(0, 1 - u * u * 0.92))));
      }
      caps.push({ a: tr(0, 0), rim: rim, top: top, lip: lip, k: P[6], foot: [P[0] * 0.4, 0] });
    }
    return caps;
  }
  function drawPleurotes(m, capHex, gillHex, s) {
    var caps = m._pleu || (m._pleu = pleuroteGeom(m)), cap = hexToRgb(capHex), gill = hexToRgb(gillHex), i, c, j;
    function S(p) { return [p[0] * s, p[1] * s]; }
    // pieds : courts, tous issus de la base commune
    for (i = 0; i < caps.length; i++) {
      c = caps[i];
      var a = S(c.a), f = S(c.foot), w = s * 0.035;
      ctx.fillStyle = rgbStr(shade(gill, -0.05)); poly([[f[0] - w, f[1]], [f[0], f[1]], [a[0], a[1]], [a[0] - w * 0.7, a[1] + w]]);
      ctx.fillStyle = rgbStr(shade(gill, -0.25)); poly([[f[0], f[1]], [f[0] + w, f[1]], [a[0] + w * 0.7, a[1] + w], [a[0], a[1]]]);
    }
    // chapeaux, de l'arriere (haut) vers l'avant (bas)
    for (i = 0; i < caps.length; i++) {
      c = caps[i];
      var capC = shade(cap, c.k), gl = shade(gill, c.k * 0.5), a2 = S(c.a), n = c.rim.length;
      // lamelles : eventail vers le bord, deux tons alternes, plus sombres au centre (entonnoir)
      for (j = 0; j < n - 1; j++) {
        var mid = Math.abs((j + 0.5) / (n - 1) - 0.5) * 2;
        ctx.fillStyle = rgbStr(shade(gl, (j % 2 ? -0.14 : 0) - 0.12 * (1 - mid)));
        poly([a2, S(c.lip[j]), S(c.lip[j + 1])]);
      }
      // bord replie : bande sombre entre lamelles et dessus
      for (j = 0; j < n - 1; j++) {
        ctx.fillStyle = rgbStr(shade(capC, -0.28 - (j / (n - 1)) * 0.08));
        poly([S(c.rim[j]), S(c.rim[j + 1]), S(c.lip[j + 1]), S(c.lip[j])]);
      }
      // dessus : facettes du bord vers le sommet, eclairees a gauche
      for (j = 0; j < n - 1; j++) {
        ctx.fillStyle = rgbStr(shade(capC, 0.22 - 0.42 * j / (n - 2)));
        poly([S(c.rim[j]), S(c.top[j]), S(c.top[j + 1]), S(c.rim[j + 1])]);
      }
    }
  }

  // Strophaire rouge vin : dome facette, pied crème trapu avec anneau crenele. Environ 1 individu
  // sur 4 est "renverse" (penche fort) et montre ses lamelles gris-violet, comme sur la photo.
  // Geometrie en unites de s, seedee sur m.x, cachee sur m.strGeo.
  function strophaireGeo(m) {
    var seed = Math.floor(Math.abs(m.x) * 7) % 233280 + 49297;
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    var N = 9, capW = 0.42 + rnd() * 0.05, capH = 0.36 + rnd() * 0.05, capY = -0.46 - rnd() * 0.06, i;
    var j = [], teeth = [];
    for (i = 0; i <= N; i++) j.push([(rnd() - 0.5) * 0.02, (rnd() - 0.5) * 0.03]);
    for (i = 0; i < 7; i++) teeth.push(0.035 + rnd() * 0.03);
    var gills = rnd() < 0.25;
    return {
      N: N, capW: capW, capH: capH, capY: capY, j: j, teeth: teeth, gills: gills,
      tilt: gills ? (rnd() < 0.5 ? -0.55 : 0.55) : 0,   // le champignon aux lamelles visibles est bascule
      CAP: hexToRgb('#8c4540'), STEM: hexToRgb('#eee3c4'), RING: hexToRgb('#f0dc9a'), GILL: hexToRgb('#554f5e')
    };
  }
  function drawStrophaire(m, s) {
    var g = m.strGeo || (m.strGeo = strophaireGeo(m)), N = g.N, i, b, a0, a1;
    var CAP = g.CAP, STEM = g.STEM, RING = g.RING, GILL = g.GILL;
    function col(c, k) { ctx.fillStyle = rgbStr(shade(c, k)); }
    function P(x, y) { return [x * s, y * s]; }
    var cy = g.capY, cw = g.capW, ch = g.capH;
    if (g.tilt) ctx.rotate(g.tilt);
    // pied : large en bas, deux facettes (gauche claire) + base terreuse
    var bw = 0.17, tw = 0.12, top = cy + 0.02;
    col(STEM, 0.12); poly([P(-bw, 0), P(-0.01, 0), P(-0.005, top), P(-tw, top)]);
    col(STEM, -0.12); poly([P(-0.01, 0), P(bw, 0), P(tw, top), P(-0.005, top)]);
    col(STEM, -0.3); poly([P(-bw, 0), P(bw, 0), P(bw * 0.8, -0.04), P(-bw * 0.8, -0.04)]);
    if (g.gills) {
      // dessous : bord pale (voile) + eventail de lamelles gris-violet + pied au centre
      var M = 10, ury = 0.2, r = 0.84;
      for (i = 0; i < M; i++) {
        a0 = Math.PI * i / M; a1 = Math.PI * (i + 1) / M;
        var o0 = [Math.cos(a0) * cw, cy + Math.sin(a0) * ury], o1 = [Math.cos(a1) * cw, cy + Math.sin(a1) * ury];
        var n0 = [o0[0] * r, cy + (o0[1] - cy) * r], n1 = [o1[0] * r, cy + (o1[1] - cy) * r];
        col(STEM, 0.2 - i * 0.02); poly([P(o0[0], o0[1]), P(o1[0], o1[1]), P(n1[0], n1[1]), P(n0[0], n0[1])]);
        col(GILL, (i % 2 ? -0.28 : 0.08) - i * 0.015);
        poly([P(n0[0], n0[1]), P(n1[0], n1[1]), P(0, cy + 0.01)]);
      }
      col(STEM, 0.2);
      var hex = [];
      for (i = 0; i < 6; i++) { var a = Math.PI * 2 * i / 6; hex.push(P(Math.cos(a) * 0.075, cy + 0.035 + Math.sin(a) * 0.075 * 0.55)); }
      poly(hex);
    } else {
      // anneau crenele, sous le chapeau
      var ry = cy + 0.1, rw0 = tw * 1.05, rw1 = tw * 1.75, rh = 0.075, T = g.teeth.length;
      col(RING, 0.1); poly([P(-rw0, ry), P(0, ry), P(0, ry + rh), P(-rw1, ry + rh)]);
      col(RING, -0.15); poly([P(0, ry), P(rw0, ry), P(rw1, ry + rh), P(0, ry + rh)]);
      for (i = 0; i < T; i++) {
        var x0 = -rw1 + 2 * rw1 * i / T, x1 = -rw1 + 2 * rw1 * (i + 1) / T;
        col(RING, (i < T / 2 ? 0.05 : -0.22) - (i % 2) * 0.08);
        poly([P(x0, ry + rh - 0.005), P(x1, ry + rh - 0.005), P((x0 + x1) / 2, ry + rh + g.teeth[i])]);
      }
    }
    // chapeau en dome : bandeau sombre sous le bord, 2 couronnes de facettes, calotte, reflet
    var L = [[1, 0], [0.9, 0.55], [0.55, 0.9]];
    function light(k, band) { return -Math.cos(Math.PI * (k + 0.5) / N) * 0.16 + band * 0.02 - 0.02 * (k % 2); }
    function cp(k, rr, h) { var a = Math.PI * k / N, jj = g.j[k]; return P(Math.cos(a) * cw * rr + jj[0], cy - ch * h + jj[1] * (1 - h)); }
    col(CAP, -0.3);
    poly([P(-cw, cy), P(cw, cy), P(cw * 0.9, cy + 0.045), P(-cw * 0.9, cy + 0.045)]);
    for (b = 0; b < 2; b++) {
      for (i = 0; i < N; i++) {
        col(CAP, light(i, b) + (b === 0 ? 0.04 : 0));
        poly([cp(i, L[b][0], L[b][1]), cp(i + 1, L[b][0], L[b][1]), cp(i + 1, L[b + 1][0], L[b + 1][1]), cp(i, L[b + 1][0], L[b + 1][1])]);
      }
    }
    for (i = 0; i < N; i++) {
      a0 = Math.PI * i / N; a1 = Math.PI * (i + 1) / N;
      col(CAP, light(i, 1) - 0.22);
      poly([P(Math.cos(a0) * cw * 0.55 + g.j[i][0], cy - ch * 0.9), P(Math.cos(a1) * cw * 0.55 + g.j[i + 1][0], cy - ch * 0.9), P(-0.03, cy - ch)]);
    }
    col(CAP, 0.28);
    poly([P(-cw * 0.62, cy - ch * 0.62), P(-cw * 0.4, cy - ch * 0.84), P(-cw * 0.3, cy - ch * 0.74)]);
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
  // def.depth (fraction de H sous le niveau d'origine du sol, groundY) : un tresor profond est
  // enfoui a une hauteur FIXE t.y ; sans depth (0) il reste comme avant "a la surface", donc
  // sa hauteur suit surfaceAt (voir treasureY). Le repere n'apparait, et les coups de pelle
  // ne comptent, que quand la surface est descendue pres de lui (treasureReachable).
  // Decale x vers la colonne la plus proche dont tout le voisinage (+- 40 px) est de la terre
  // creusable : la roche-mere ne se creuse pas, un tresor dedans serait introuvable.
  function clearOfRock(x) {
    var c0 = Math.round(x / COL_W), span = Math.ceil(40 / COL_W), n = rocky.length;
    for (var d = 0; d < n; d++) {
      for (var sg = -1; sg <= 1; sg += 2) {
        var c = c0 + sg * d;
        if (c - span < 0 || c + span >= n) continue;
        var ok = true;
        for (var k = -span; k <= span; k++) if (rocky[c + k]) { ok = false; break; }
        if (ok) return c * COL_W;
      }
    }
    return x;
  }

  // Poing fantome du repere : memes facettes que le poing ferme de drawHand (fist = 1), en SVG
  // pour etre anime en CSS (.logo-explosion-hint-hand) sans faire tourner la boucle de rendu.
  var HINT_FIST_SVG = '<svg viewBox="-13 -13 26 41" stroke="rgba(60,35,20,.5)" stroke-width=".7" stroke-linejoin="round">' +
    '<polygon fill="#b57c58" points="-7,13 7,13 6,27 -6,27"/>' +
    '<polygon fill="#e8b48a" points="-11,-8 11,-8 -9,14"/>' +
    '<polygon fill="#cf9670" points="11,-8 9,14 -9,14"/>' +
    '<polygon fill="#b57c58" points="-10.4,-10.6 -6.2,-10.6 -6.4,-0.6 -10.2,-0.6"/>' +
    '<polygon fill="#cf9670" points="-4.9,-11.5 -0.7,-11.5 -0.9,-1.5 -4.7,-1.5"/>' +
    '<polygon fill="#b57c58" points="0.7,-11.1 4.9,-11.1 4.7,-1.1 0.9,-1.1"/>' +
    '<polygon fill="#cf9670" points="6.2,-10.1 10.4,-10.1 10.2,-0.1 6.4,-0.1"/>' +
    '<polygon fill="#e8b48a" points="-11.6,1.8 0.5,-3.1 1.65,-0.8 -10,5"/>' +
    '<polygon fill="#cf9670" points="-10,5 1.65,-0.8 2.8,1.6 -8.4,8.2"/>' +
    '</svg>';
  // Pelle fantome : memes facettes que drawShovelShape (pointe a gauche, manche vers +x), alterne avec le poing.
  var HINT_SHOVEL_SVG = '<svg viewBox="122 152 154 30">' +
    '<polygon fill="#b98352" points="215,166.9 262,162.7 262,166.9 215,171.1"/>' +
    '<polygon fill="#8a5a30" points="215,171.1 262,166.9 262,170.4 215,174.6"/>' +
    '<polygon fill="#7a4d28" points="262,154.3 274,154.3 274,166.9 262,166.9"/>' +
    '<polygon fill="#5e3a1d" points="262,166.9 274,166.9 274,179.5 262,179.5"/>' +
    '<polygon fill="#6b7378" points="182,166.9 216,166.9 216,171.2 182,171.6"/>' +
    '<polygon fill="#4c5256" points="182,171.6 216,171.2 216,175.4 182,176.4"/>' +
    '<g transform="translate(0 166.9) scale(1 .35) translate(0 -163)">' +
    '<polygon fill="#7d858a" points="138,180 152,186 168,189 182,186"/>' +
    '<polygon fill="#5f676c" points="152,186 168,189 168,193 152,190"/>' +
    '<polygon fill="#7d858a" points="168,189 182,186 182,190 168,193"/>' +
    '<polygon fill="#a9b1b5" points="124,166 138,180 152,186 140,172"/>' +
    '<polygon fill="#c9cfd2" points="140,172 152,186 168,189 160,176"/>' +
    '<polygon fill="#bcc3c7" points="160,176 168,189 182,186 178,175"/>' +
    '<polygon fill="#d6dcde" points="178,175 182,186 182,178 182,163"/>' +
    '<polygon fill="#8f979b" points="124,166 140,172 138,180"/>' +
    '<polygon fill="#d8dee0" points="124,166 140,172 160,176 178,175 182,163 160,166 140,164"/>' +
    '<polygon fill="#e4e9ea" points="124,166 140,164 140,172"/>' +
    '</g></svg>';
  // Un tresor enfoui : sa facette doree et son repere (halo + poing ou pelle fantome, en
  // alternance), pose a la surface au-dessus de lui : il montre ou creuser meme quand le
  // tresor est enfoui hors de la vue.
  // Un tresor deja deterre revient a sa derniere position ; sinon sa place d'origine.
  function replayX(def) {
    if (skippedFound.indexOf(def.title) !== -1 && foundFx[def.title] !== undefined) return foundFx[def.title] * worldW;
    return clearOfRock(DEMO ? camMargin + W * DEMO_TREASURE_X : def.x * worldW);
  }
  function buildTreasure(def) {
    var glint = document.createElement('span');
    glint.className = 'logo-explosion-glint';
    glint.setAttribute('aria-hidden', 'true');
    container.appendChild(glint);
    var hint = document.createElement('div');
    hint.className = 'logo-explosion-hint';
    hint.setAttribute('aria-hidden', 'true');
    hint.innerHTML = '<span class="logo-explosion-hint-halo"></span><span class="logo-explosion-hint-hand">' + HINT_FIST_SVG + '</span><span class="logo-explosion-hint-shovel">' + HINT_SHOVEL_SVG + '</span>';
    container.appendChild(hint);
    var depth = Math.max(0, parseFloat(def.depth) || 0);
    // Borne : un DEPTH_MULT reduit (panneau de debug) ne doit pas laisser le tresor sous le fond du monde.
    var ty = depth > 0 ? Math.min(groundY + depth * U, worldH - BEDROCK_MARGIN - 20) : 0;
    // def.x est une fraction de la largeur du MONDE (pas du logo) : les tresors sont
    // repartis sur toute la zone explorable, pas seulement sous le logo.
    // Demo : la camera ne defile pas, le tresor est donc place dans la vue de depart.
    return {
      def: def, x: replayX(def), y: ty, deep: depth > 0, dig: 0, revealed: false, ready: false,
      mushroom: null, glint: glint, tip: null, hint: hint, nugget: null, nx: 0, sparks: null
    };
  }
  // Demo : un seul tresor (la premiere souche), les autres attendent le jeu complet (endDemo).
  function buriedDefs() {
    return (DEMO ? treasureDefs.slice(0, 1) : treasureDefs).filter(function (def) { return skippedFound.indexOf(def.title) === -1; });
  }
  function setupTreasures() {
    clearTreasures();
    // Tresors deja deterres (sauvegarde chargee avec la page) : ni glint ni champignon, ils
    // ne reviennent pas enterres. Une seule fois : un rebuild en cours de page regenere tout.
    skippedFound = restoredFound;
    restoredFound = [];
    treasuresFound = skippedFound.length;
    updateTreasureUI();
    if (guideFlags.harvest) queueDemoEnd(); // demo deja finie avant un rechargement : l'ecran de fin revient
    treasures = buriedDefs().map(buildTreasure);
    // Demo : le 1er tresor deja deterre lors d'une visite precedente reste a l'ecran, deterre
    // d'office (sinon l'accueil n'en montrerait aucun avant la fin du tutoriel).
    var replays = (DEMO ? treasureDefs.slice(0, 1) : treasureDefs).filter(function (def) { return skippedFound.indexOf(def.title) !== -1; }).map(buildTreasure);
    replays.forEach(function (r) { treasures.push(r); });
    // On laisse la terre retomber avant de montrer ou creuser ; positionTreasureOverlays
    // decide ensuite, a chaque frame, si chaque repere est visible (t.ready).
    var mine = treasures;
    setTimeout(function () {
      if (mode !== 'exploded' || mine !== treasures) return; // rebuild (ou nouvelle explosion) entre-temps
      treasures.forEach(function (t) { t.ready = true; });
      if (replays.length) {
        // Restent dans skippedFound jusqu'ici pour ne pas sortir de la sauvegarde ; reveal() les recompte
        // (dans l'ordre des defs : le contenu montre suit le rang de deterrage).
        skippedFound = skippedFound.filter(function (ti) { return !replays.some(function (r) { return r.def.title === ti; }); });
        treasuresFound = skippedFound.length;
        replays.forEach(reveal);
      }
      positionTreasureOverlays();
    }, 1600);
  }

  // Boussole des tresors : badge dore (pelle) avec fleche exterieure qui pointe vaguement vers
  // le tresor non trouve le plus proche (distance bridee : on sent la direction, pas la position).
  // Un clic teleporte la pelle pres du tresor. Disparait quand on est tres pres.
  // Element HTML cree a la demande, comme les reperes.
  var compass = null, compassTipShown = false;
  var DIG_HINT_MSG = 'Creusez à la pelle ou martelez du poing (maintenez le clic).';
  var DIG_TREASURE_MSG = 'Creusez à la pelle ou martelez du poing (maintenez le clic) pour découvrir le trésor.';
  var COMPASS_MSG ='Trésor enfoui par là : creusez à la pelle ou martelez du poing.';
  var COMPASS_HIDE = 90;    // px ecran : quand le badge est a moins de ca du tresor, il disparait
  var COMPASS_RISE_FRAC = 0.25;  // le badge peut monter au plus de cette fraction de H depuis le bas
  var COMPASS_BOTTOM_PAD = 70;  // marge (px) au bas de l'ecran
  var COMPASS_TIP_W = 190;  // largeur de la bulle (px)
  var COMPASS_ICON = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M7 8.5a5 5 0 1 1 7.2 4.5c-1.6.8-2.2 1.7-2.2 3.2" fill="none" stroke="#f3c94a" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="21" r="2.4" fill="#f3c94a"/></svg>';
  var COMPASS_ARROW = '<svg viewBox="0 0 22 22" width="18" height="18" aria-hidden="true"><path d="M2 2l18 9-18 9 5-9z" fill="#f3c94a" stroke="#2b1d10" stroke-width="2" stroke-linejoin="round"/></svg>';
  function compassGo() {
    var tgt = compass && compass._target;
    if (!tgt || shovel.on || mode !== 'exploded') return;
    shovelPlant.x = clamp(tgt.x - 110, 30, worldW - 30);
    camGoal = { x: clamp(shovelPlant.x - W / 2, 0, Math.max(0, worldW - W)), y: camY };
    compass.classList.add('is-pressed');
    setTimeout(function () { if (compass) compass.classList.remove('is-pressed'); }, 220);
    startLoop();
    setCaption(DIG_HINT_MSG);
  }
  function updateCompass() {
    var best = null, bd = Infinity, cx = W / 2, cy = H / 2, i;
    // Pas de boussole pendant le tutoriel du mycelium : elle detournerait l'attention.
    if (mode === 'exploded' && !(unlockedStrains.length && guideCurrent())) {
      for (i = 0; i < treasures.length; i++) {
        var t = treasures[i];
        if (t.revealed) continue;
        var d = Math.hypot(t.x - camX - cx, treasureY(t) - camY - cy);
        if (d < bd) { bd = d; best = t; }
      }
    }
    // Horizontalement le badge suit le tresor (loin a gauche -> colle au bord gauche) ; en hauteur
    // il reste dans la bande basse de l'ecran (au plus COMPASS_RISE_FRAC x H au-dessus du bas).
    // Tout ce bloc est en px CSS (ecran) : la boussole est un overlay HTML, d'ou les * ZOOM.
    var tx = 0, ty = 0, px = 0, py = 0, cssW = W * ZOOM, cssH = H * ZOOM;
    if (best) {
      tx = (best.x - camX) * ZOOM; ty = (treasureY(best) - camY) * ZOOM;
      px = clamp(tx, 30, cssW - 30);
      var pyMax = cssH - COMPASS_BOTTOM_PAD, pyMin = Math.min(cssH * (1 - COMPASS_RISE_FRAC), pyMax);
      py = clamp(ty, pyMin, pyMax);
    }
    // Disparait quand le badge est tres pres du tresor.
    if (!best || Math.hypot(tx - px, ty - py) < COMPASS_HIDE) {
      if (compass) { compass.classList.remove('is-visible'); compass.tabIndex = -1; }
      return;
    }
    if (!compass) {
      compass = document.createElement('span');
      compass.className = 'logo-explosion-compass';
      compass.setAttribute('role', 'button');
      compass.setAttribute('tabindex', '0');
      compass.setAttribute('aria-label', 'Aller vers le trésor le plus proche');
      compass.innerHTML = '<span class="logo-explosion-compass-wave"></span>' +
        '<span class="logo-explosion-compass-arrow">' + COMPASS_ARROW + '</span>' +
        '<span class="logo-explosion-compass-badge"><span class="logo-explosion-compass-core">' + COMPASS_ICON + '</span></span>' +
        '<span class="logo-explosion-compass-tip"></span>';
      compass.lastChild.textContent = COMPASS_MSG;
      // Clic ou Entree/Espace : la pelle plantee se teleporte pres du tresor vise.
      compass.addEventListener('click', function (evt) {
        evt.stopPropagation();
        compassGo();
      });
      compass.addEventListener('keydown', function (evt) {
        if (evt.key !== 'Enter' && evt.key !== ' ') return;
        evt.preventDefault();
        evt.stopPropagation();
        compassGo();
      });
      container.appendChild(compass);
      // Toute premiere apparition de la session : la bulle s'affiche seule ~5 s.
      if (!compassTipShown) {
        compassTipShown = true;
        compass.classList.add('show-tip');
        var c0 = compass;
        setTimeout(function () { c0.classList.remove('show-tip'); }, 5000);
      }
    }
    compass._target = best;
    var ang = Math.atan2(ty - py, tx - px);   // la pointe vise le tresor depuis la position reelle du badge
    compass.style.left = px + 'px';
    compass.style.top = py + 'px';
    compass.style.setProperty('--ang', ang + 'rad');
    // Bulle au-dessus, sauf si elle sortirait par le haut ; decalee pour rester dans l'ecran.
    compass.classList.toggle('is-below', py < 110);
    var half = COMPASS_TIP_W / 2;
    compass.style.setProperty('--lx', (clamp(px, half + 6, cssW - half - 6) - px) + 'px');
    compass.tabIndex = 0;
    compass.classList.add('is-visible');
  }

  function clearTreasures() {
    if (compass) { compass.remove(); compass = null; }
    hideDigTip();
    treasures.forEach(function (t) {
      t.glint.remove();
      if (t.tip) t.tip.remove();
      if (t.hint) t.hint.remove();
      if (t.sparks) t.sparks.forEach(function (sp) { sp.remove(); });
    });
    treasures = [];
    skippedFound = [];
    goldBits = [];
  }

  // Compteur "Trésors n/N" (N = toutes les defs). Une fois tout
  // trouve il devient un lien vers la boutique (pas de code promo pour l'instant).
  function updateTreasureUI() {
    if (!treasureCountEl) return;
    var total = treasureDefs.length, done = total > 0 && treasuresFound >= total;
    treasureCountEl.classList.toggle('is-complete', done);
    treasureCountEl.textContent = '';
    if (!done) { treasureCountEl.textContent = 'Trésors ' + treasuresFound + '/' + total; return; }
    var a = document.createElement('a');
    a.href = '/shop/';
    a.textContent = 'Vous avez trouvé tous les trésors ! Voir la boutique';
    treasureCountEl.appendChild(a);
  }

  // Ecran de fin de la demo (present seulement en mode demo, voir front-page.php) : sort a la
  // premiere recolte (harvestAt), un peu apres pour laisser voir le champignon cueilli.
  // "Continuer" debloque le jeu complet (endDemo) et enfouit les autres tresors.
  var demoEndEl = document.getElementById('logo-explosion-end'), demoEndTimer = 0;
  var DEMO_END_DELAY = 400;
  function hideDemoEnd() {
    clearTimeout(demoEndTimer);
    if (demoEndEl) demoEndEl.classList.add('d-none');
  }
  // Sur l'accueil le header flotte par-dessus le haut de la boite et change de hauteur (etendu /
  // compact) : le voile commence sous lui, et le suit (syncTick, defilement, redimensionnement).
  function syncDemoEndTop() {
    if (!demoEndEl || demoEndEl.classList.contains('d-none')) return;
    var hb = siteHeader ? siteHeader.getBoundingClientRect().bottom - container.getBoundingClientRect().top : 0;
    demoEndEl.style.top = Math.max(0, Math.min(hb, U * 0.55)) + 'px'; // px CSS : U = hauteur CSS de la boite
  }
  function queueDemoEnd() {
    if (!DEMO || !demoEndEl) return;
    clearTimeout(demoEndTimer);
    demoEndTimer = setTimeout(function () {
      if (mode !== 'exploded') return;
      demoEndEl.classList.remove('d-none');
      syncDemoEndTop();
      var link = demoEndEl.querySelector('a');
      if (link) link.focus({ preventScroll: true });
    }, DEMO_END_DELAY);
  }
  function endDemo() {
    hideDemoEnd();
    DEMO = false;
    container.classList.remove('is-demo');
    try { localStorage.setItem(DEMO_KEY, '1'); } catch (e) { /* ignore */ }
    updateMoneyUI();
    updateChallengeUI();
    updateStrainBar();
    // Les tresors mis de cote pendant la demo (buriedDefs) sont enfouis maintenant.
    buriedDefs().forEach(function (def) {
      if (treasures.some(function (t) { return t.def === def; })) return;
      var t = buildTreasure(def);
      t.ready = true;
      treasures.push(t);
    });
    positionTreasureOverlays();
    updateTreasureUI();
    startLoop();
  }
  if (demoEndEl) demoEndEl.addEventListener('click', function (evt) {
    if (evt.target.closest('[data-demo-continue]')) endDemo();
  });

  // Avertissement avant de quitter le jeu : le lien "Voir le produit" d'une infobulle ouvre
  // d'abord ce voile (meme style que l'ecran de fin), le visiteur confirme ou reste.
  // Le credit d'une photo passe par le meme voile, avec d'autres textes : il mene a un autre
  // site, ouvert dans un nouvel onglet (la partie reste ouverte ici).
  var leaveEl = document.getElementById('logo-explosion-leave');
  if (leaveEl) {
    var leaveGo = leaveEl.querySelector('[data-leave-go]');
    var leaveTitle = leaveEl.querySelector('.logo-explosion-end-title'), leaveText = leaveEl.querySelector('p');
    // Textes du lien produit : ceux du HTML, remis en place apres un passage par le credit.
    var leaveCopy = [leaveTitle.textContent, leaveText.textContent, leaveGo.textContent];
    document.addEventListener('click', function (evt) {
      var a = evt.target.closest && evt.target.closest('.logo-explosion-tip-body a, .logo-explosion-tip-credit a');
      // Carte rangee sous le jeu (shelfEl) : memes liens, meme voile (il s'affiche dans la boite du jeu).
      var shelved = !!(a && shelfEl && shelfEl.contains(a));
      if (!a || !(shelved || container.contains(a))) return;
      evt.preventDefault();
      var ext = !!a.closest('.logo-explosion-tip-credit');
      var copy = ext ? ['Quitter le site ?', 'La page d’origine de la photo s’ouvre sur un autre site (' + a.hostname + '), dans un nouvel onglet. Votre partie reste ouverte ici.', 'Ouvrir la page'] : leaveCopy;
      leaveTitle.textContent = copy[0]; leaveText.textContent = copy[1]; leaveGo.textContent = copy[2];
      leaveGo.href = a.href;
      if (ext) { leaveGo.target = '_blank'; leaveGo.rel = 'noopener'; }
      else { leaveGo.removeAttribute('target'); leaveGo.removeAttribute('rel'); }
      leaveEl.classList.remove('d-none');
      if (shelved) leaveEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); // la boite du jeu peut etre en partie hors ecran
      leaveEl.querySelector('[data-leave-stay]').focus({ preventScroll: true });
    }, true);
    leaveEl.addEventListener('click', function (evt) {
      // Nouvel onglet : le jeu reste affiche, le voile n'a plus de raison de rester.
      if (evt.target.closest('[data-leave-stay]') || (leaveGo.target === '_blank' && evt.target.closest('[data-leave-go]'))) leaveEl.classList.add('d-none');
    });
  }

  // Souches : le menu (boutons crees une fois, etat rafraichi apres chaque deblocage/choix).
  function buildStrainBar() {
    if (!strainsBar) return;
    strainOrder.forEach(function (st) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'logo-explosion-strain';
      b.setAttribute('data-strain', st.id);
      var dot = document.createElement('span');
      dot.className = 'logo-explosion-strain-dot';
      dot.setAttribute('aria-hidden', 'true');
      b.appendChild(dot);
      b.addEventListener('click', function () { guideSet('strain'); setStrain(st.id); });
      strainsBar.appendChild(b);
    });
    var grassBtn = document.createElement('button');
    grassBtn.type = 'button';
    grassBtn.className = 'logo-explosion-grass';
    grassBtn.id = 'logo-explosion-grass-btn';
    grassBtn.setAttribute('aria-label', 'Semer du gazon');
    grassBtn.setAttribute('title', 'Semer du gazon');
    grassBtn.textContent = '🌱';
    grassBtn.addEventListener('click', function () { setTool('grass'); });
    strainsBar.appendChild(grassBtn);
    refreshStrainBar();
  }

  function refreshStrainBar() {
    if (!strainsBar) return;
    var btns = strainsBar.querySelectorAll('[data-strain]');
    for (var i = 0; i < btns.length; i++) {
      var id = btns[i].getAttribute('data-strain'), st = strainById[id];
      var open = unlockedStrains.indexOf(id) !== -1, on = open && id === bagStrain;
      var label = open ? 'Souche : ' + st.label + (st.perk ? ' (' + st.perk + ')' : '') : 'Souche à débloquer';
      var dot = btns[i].firstChild;
      btns[i].disabled = !open;
      btns[i].classList.toggle('is-locked', !open);
      btns[i].classList.toggle('is-active', on);
      btns[i].setAttribute('aria-pressed', on ? 'true' : 'false');
      btns[i].setAttribute('aria-label', label);
      btns[i].title = label;
      dot.style.background = open ? st.dot : '';
      dot.textContent = open ? '' : '?';
    }
    var grassBtn = document.getElementById('logo-explosion-grass-btn');
    if (grassBtn && grassCover) {
      var avg = grassCover.reduce(function (a, b) { return a + b; }, 0) / grassCover.length;
      var pct = Math.round(avg * 100);
      var on = tool === 'grass';
      grassBtn.setAttribute('aria-label', 'Semer du gazon : ' + pct + '%');
      grassBtn.title = 'Semer du gazon : ' + pct + '%';
      grassBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      grassBtn.classList.toggle('is-active', on || avg > 0.5);
    }
  }

  // Visible seulement avec l'outil mycelium ou gazon (le bouton gazon vit dans cette barre) ET le monde explose.
  function updateStrainBar() {
    if (strainsBar) strainsBar.classList.toggle('d-none', !(mode === 'exploded' && (tool === 'mycelium' || tool === 'grass')));
  }

  function setStrain(id) {
    if (unlockedStrains.indexOf(id) === -1 || !strainById[id]) return;
    bagStrain = id;
    refreshStrainBar();
    startLoop(); // le sac dessine la nouvelle teinte
  }

  // Retourne true si la souche vient d'etre debloquee (pas deja connue de cette page).
  // Un clic sur le champignon d'un tresor selectionne sa souche pour l'outil mycelium.
  function pickTreasureStrain(t) { if (t) t.tipClosed = false; if (t && t.strainId) setStrain(t.strainId); }

  function unlockStrain(id) {
    if (!strainById[id] || unlockedStrains.indexOf(id) !== -1) return false;
    unlockedStrains.push(id);
    refreshStrainBar();
    return true;
  }
  buildStrainBar();

  // Retire juste la bulle DOM (le rebuild fait tomber le champignon qui la portait) —
  // mycTipShown n'est PAS reinitialise : elle ne doit s'afficher qu'une fois par page.
  function clearMycTip() {
    if (mycTip) { mycTip.remove(); mycTip = null; }
    mycTipMushroom = null;
  }

  // Hauteur (y monde) du tresor non deterre : fixe s'il est enfoui profond, sinon a la surface.
  function treasureY(t) {
    return t.deep ? t.y : surfaceAt(t.x);
  }
  // Vrai si la surface actuelle est assez pres au-dessus du tresor pour le repérer / le
  // creuser (toujours vrai pour un tresor "a la surface" ; aussi vrai si on a creuse plus bas que lui).
  function treasureReachable(t) {
    return treasureY(t) - surfaceAt(t.x) < TREASURE_NEAR;
  }

  // Tresor deterre saisi a la main : son champignon, sa pepite et sa bulle suivent le curseur.
  var treasureGrab = null;
  function grabTreasureAt(pos) {
    var t = treasureNear(pos.x, pos.y);
    if (!t || !t.revealed || !t.mushroom) return null;
    return { t: t, dx: t.x - pos.x };
  }
  function moveTreasure(t, x) {
    x = clamp(x, 30, worldW - 30);
    var off = t.nx - t.x;
    t.x = x; t.mushroom.x = x; t.nx = x + off;
    t.deep = false; t.y = surfaceAt(x); // repose a la surface, comme s'il venait d'etre deterre
  }
  function treasureNear(x, y) {
    for (var i = 0; i < treasures.length; i++) {
      var t = treasures[i];
      if (!t.revealed && !treasureReachable(t)) continue; // trop profond : un tap ici plante juste un champignon
      var reach = t.revealed ? t.mushroom.size * 1.5 : 50;
      if (Math.abs(x - t.x) < 36 && y > surfaceAt(t.x) - reach) return t;
    }
    return null;
  }

  // Coup de pelle : les facettes posees autour du tresor sont projetees vers
  // l'exterieur (pas vers le haut, sinon elles retombent dans le trou).
  function digAt(t) {
    if (window.sporaSfx) sporaSfx.play('dig', { min: 120 }); 
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
    if (t.revealed || t.deep || !treasureReachable(t)) return; // un tresor enfoui ne se deterre qu'en creusant jusqu'a lui (voir step)
    t.dig += amount;
    if (t.dig >= DIG_TO_REVEAL) reveal(t);
  }

  function reveal(t) {
    t.revealed = true;
    // Le contenu montre (champignon, infobulle) suit l'ordre de deterrage, pas le tresor :
    // le 1er deterre est toujours le strophaire, puis pleurote, puis hydne.
    var shown = treasureDefs[Math.min(foundList().length, treasureDefs.length) - 1] || t.def;
    t.glint.classList.remove('is-visible');
    if (t.hint) { t.hint.remove(); t.hint = null; }
    // Hauteur de la pepite : celle du tresor (fixe s'il est profond, sinon la surface au
    // moment du reveal). Le champignon, lui, reste dessine a surfaceAt (fond du trou ouvert).
    if (!t.deep) t.y = surfaceAt(t.x);
    digAt(t);
    // t negatif : le trou s'ouvre d'abord, le champignon sort ensuite.
    t.mushroom = { x: t.x, size: U * 0.24, lean: 0, sp: SPECIES[shown.species] || SPECIES[0], t: -0.4, treasure: true };
    mushrooms.push(t.mushroom);
    if (window.sporaSfx) sporaSfx.play('pop', { min: 70 });
    // Pepite au pied du champignon (decalee de son pied), avec deux eclats qui pulsent en CSS.
    t.nx = t.x + t.mushroom.size * 0.24;
    t.nugget = makeNugget();
    t.sparks = [0, 1].map(function () {
      var sp = document.createElement('span');
      sp.className = 'logo-explosion-spark';
      sp.setAttribute('aria-hidden', 'true');
      container.appendChild(sp);
      return sp;
    });
    spawnGoldBits(t.nx, nuggetY(t));
    // Une souche debloquee est annoncee dans la legende du bas (seulement si nouvelle pour la page).
    // Peu importe quel tresor : la souche debloquee suit l'ordre strophaire, pleurote, hydne.
    // Source unique : le rang de ce tresor parmi les tresors deterres (t.revealed est deja vrai).
    var nDug = foundList().length, st = strainOrder[nDug - 1], fresh = false;
    for (var sk = 0; sk < nDug && sk < strainOrder.length; sk++) {
      if (unlockStrain(strainOrder[sk].id) && strainOrder[sk] === st) fresh = true;
    }
    t.strainId = strainOrder[nDug - 1] ? strainOrder[nDug - 1].id : null;
    if (!fresh) st = null;
    if (fresh && toolsArrow && guideCurrent()) toolsArrow.classList.remove('d-none');
    if (fresh && st.id === 'pleurote') pleuroteDug = true;
    t.tip = buildTip(shown);
    container.appendChild(t.tip);
    // La main peut aussi deplacer le tresor en le saisissant par sa bulle (hors lien / bouton).
    t.tip.style.touchAction = 'none';
    t.tip.classList.add('is-reveal');
    setTimeout(function () { if (t.tip) t.tip.classList.remove('is-reveal'); }, 1500);
    // Bulle fermee avec la croix : le survol ne la rouvre plus, seul un clic sur le champignon le fait.
    t.tip.querySelector('.logo-explosion-tip-close').addEventListener('click', function () { t.tipClosed = true; });
    var grabbed = false, swipe = null, swiped = false;
    t.tip.addEventListener('pointerdown', function (evt) {
      grabbed = false; swipe = null; swiped = false;
      tipIdle(); // un doigt sur la carte repousse sa fermeture d'office
      if (evt.target.closest('a, button')) return;
      // Au doigt, glisser sur la photo change de photo au lieu de deplacer le tresor (voir pointerup) ;
      // carte en grand (.is-zoom), plus rien ne se deplace : tout glisser change de photo.
      if (evt.pointerType !== 'mouse' && (t.tip.classList.contains('is-zoom') ||
          (evt.target.tagName === 'IMG' && t.tip.querySelector('.logo-explosion-tip-nav')))) {
        swipe = { x: evt.clientX, id: evt.pointerId };
        return;
      }
      // Carte rangee sous le jeu (shelfEl) : elle ne sert pas de poignee au tresor.
      if (mode !== 'exploded' || tool !== 'hand' || t.tip.parentNode !== container) return;
      var sp = getRelativePos(evt), wp = { x: sp.x + camX, y: sp.y + camY };
      treasureGrab = { t: t, dx: t.x - wp.x, fromTip: true, onImg: evt.target.tagName === 'IMG' };
      pointerDown = wp; dragMoved = false; pressCaught = true; grabbed = true;
      try { canvas.setPointerCapture(evt.pointerId); } catch (e) { /* pas grave */ }
      evt.preventDefault();
    });
    t.tip.addEventListener('pointerup', function (evt) {
      if (!swipe || swipe.id !== evt.pointerId) return;
      var dx = evt.clientX - swipe.x;
      swipe = null;
      if (Math.abs(dx) < TIP_SWIPE_PX) return; // simple tap : le clic ci-dessous s'en charge
      swiped = true;
      var nav = t.tip.querySelector(dx < 0 ? '.is-next' : '.is-prev');
      if (nav) nav.click();
    });
    // Clic sur la carte (voir tapTip). Tresor saisi par la main : le pointeur est capture par le
    // canvas ci-dessus, c'est endPress qui bascule (tap sans glisser), pas ce clic.
    t.tip.addEventListener('click', function (evt) {
      if (grabbed || swiped || evt.target.closest('a, button')) return;
      tapTip(t, evt.target.tagName === 'IMG');
    });
    // Pendant le tutoriel du mycelium, la bulle des tresors suivants ne s'ouvre pas seule (elle reste ouvrable au clic).
    if (nDug <= 1 || !guideCurrent()) { openTip(t); tipHoldUntil = performance.now() + TIP_REVEAL_HOLD_MS; }
    // Souris sur la carte : elle reste ouverte ; sortie de la carte : voir tipAway.
    t.tip.addEventListener('pointerenter', function () { tipAway(false); });
    t.tip.addEventListener('pointerleave', function (evt) { if (evt.pointerType === 'mouse') tipAway(true); });
    treasuresFound++;
    updateTreasureUI();
    savePlayerIfChanged();
    var msg = fresh ? 'Nouvelle souche débloquée : ' + strainById[st.id].label + (strainById[st.id].perk ? ' — ' + strainById[st.id].perk : '') + ' (outil mycélium).' : '';
    if (treasureDefs.length && treasuresFound >= treasureDefs.length) msg += (msg ? ' ' : '') + 'Vous avez trouvé tous les trésors !';
    if (msg) setCaption(msg);
    startLoop();
  }

  // Pepite low-poly : polygone irregulier a 5-6 facettes (triangles en eventail depuis un
  // point central decale), teinte selon l'orientation de chaque facette par rapport a une
  // lumiere venant du haut-gauche. Points figes au reveal (pas de random au dessin).
  function makeNugget() {
    var R = U * NUGGET_R, n = 5 + (Math.random() < 0.5 ? 1 : 0), ang = [], rad = [], i;
    for (i = 0; i < n; i++) {
      ang.push((i + (Math.random() - 0.5) * 0.4) / n * Math.PI * 2);
      rad.push(R * (0.8 + Math.random() * 0.4));
    }
    var cx = (Math.random() - 0.5) * R * 0.3, cy = (Math.random() - 0.5) * R * 0.2, facets = [];
    for (i = 0; i < n; i++) {
      var j = (i + 1) % n, a1 = ang[j] + (j === 0 ? Math.PI * 2 : 0), am = (ang[i] + a1) / 2;
      var lit = -0.6 * Math.cos(am) - 0.8 * Math.sin(am); // 1 = plein face a la lumiere, -1 = a l'oppose
      facets.push({
        p: [[cx, cy], [Math.cos(ang[i]) * rad[i], Math.sin(ang[i]) * rad[i] * 0.78], [Math.cos(ang[j]) * rad[j], Math.sin(ang[j]) * rad[j] * 0.78]],
        c: NUGGET_COLORS[clamp(Math.floor((1 - lit) * 2.5), 0, NUGGET_COLORS.length - 1)]
      });
    }
    return { r: R, facets: facets };
  }

  // Centre de la pepite : elle repose au fond du trou. Si on a creuse plus bas que le tresor
  // elle suit le fond ; si de la terre comble le trou elle reste a sa hauteur d'origine (dessinee par-dessus).
  function nuggetY(t) {
    return Math.max(t.y, surfaceAt(t.x) + 2) - t.nugget.r * 0.15;
  }

  function drawNuggets() {
    for (var i = 0; i < treasures.length; i++) {
      var t = treasures[i];
      if (!t.nugget) continue;
      var y = nuggetY(t), fs = t.nugget.facets;
      if (t.nx < camX - 30 || t.nx > camX + W + 30 || y < camY - 30 || y > camY + H + 30) continue;
      for (var f = 0; f < fs.length; f++) {
        var p = fs[f].p;
        ctx.fillStyle = fs[f].c;
        ctx.beginPath();
        ctx.moveTo(t.nx + p[0][0], y + p[0][1]);
        ctx.lineTo(t.nx + p[1][0], y + p[1][1]);
        ctx.lineTo(t.nx + p[2][0], y + p[2][1]);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // Petite gerbe d'eclats dores (triangles pleins) : jaillissent puis retombent, sans
  // toucher au systeme de facettes de terre. Comptes comme "actifs" par step().
  function spawnGoldBits(x, y) {
    for (var i = 0; i < GOLD_BITS_N; i++) {
      goldBits.push({
        x: x, y: y, vx: (Math.random() - 0.5) * 5, vy: -3 - Math.random() * 3,
        rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.4,
        r: 2.5 + Math.random() * 2.5, c: NUGGET_COLORS[(Math.random() * 3) | 0], life: GOLD_BITS_LIFE
      });
    }
  }

  function stepGoldBits() {
    for (var i = goldBits.length - 1; i >= 0; i--) {
      var b = goldBits[i];
      b.vy += GRAVITY; b.vx *= AIR;
      b.x += b.vx; b.y += b.vy; b.rot += b.vr;
      if (--b.life <= 0) goldBits.splice(i, 1);
    }
    return goldBits.length > 0;
  }

  function drawGoldBits() {
    for (var i = 0; i < goldBits.length; i++) {
      var b = goldBits[i], r = b.r * Math.min(1, b.life / 15); // retrecit sur la fin
      ctx.fillStyle = b.c;
      poly([
        [b.x + Math.cos(b.rot) * r, b.y + Math.sin(b.rot) * r],
        [b.x + Math.cos(b.rot + 2.3) * r, b.y + Math.sin(b.rot + 2.3) * r],
        [b.x + Math.cos(b.rot + 4.1) * r, b.y + Math.sin(b.rot + 4.1) * r]
      ]);
    }
  }

  // strainLabel : nom de la souche tout juste debloquee par ce tresor (sinon null).
  function buildTip(def) {
    var tip = document.createElement('div');
    tip.className = 'logo-explosion-tip';
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'logo-explosion-tip-close';
    close.setAttribute('aria-label', 'Fermer');
    close.textContent = '×';
    close.addEventListener('click', function (evt) {
      evt.stopPropagation();
      // Carte rangee sous le jeu : elle y reste meme fermee, seule la croix la retire (retour dans le jeu, invisible).
      if (shelfEl && tip.parentNode === shelfEl) container.appendChild(tip);
      openTip(null);
    });
    tip.appendChild(close);
    // Plusieurs photos (voir tipImgs) : fleches et compteur sur la photo. Le credit de la photo
    // affichee (licence libre) est pose en pale dans son coin bas gauche.
    var imgs = tipImgs(def), credit = null;
    if (imgs.length) {
      tip.classList.add('has-img');
      var media = document.createElement('div');
      media.className = 'logo-explosion-tip-media';
      var im = document.createElement('img');
      im.alt = '';
      media.appendChild(im);
      credit = document.createElement('small');
      credit.className = 'logo-explosion-tip-credit';
      media.appendChild(credit);
      var idx = 0, count = null;
      var showImg = function () {
        var cur = imgs[idx];
        im.src = cur.src;
        if (count) count.textContent = (idx + 1) + ' / ' + imgs.length;
        credit.textContent = '';
        credit.classList.toggle('d-none', !cur.credit);
        if (!cur.credit) return;
        var by = document.createElement(cur.credit_url ? 'a' : 'span');
        if (cur.credit_url) { by.href = cur.credit_url; by.target = '_blank'; by.rel = 'noopener'; }
        by.textContent = cur.credit;
        credit.appendChild(by);
      };
      if (imgs.length > 1) {
        count = document.createElement('span');
        count.className = 'logo-explosion-tip-count';
        // Des boutons : la main ne saisit pas le tresor dessus, et le clic n'agrandit pas la carte.
        [-1, 1].forEach(function (dir) {
          var nav = document.createElement('button');
          nav.type = 'button';
          nav.className = 'logo-explosion-tip-nav ' + (dir < 0 ? 'is-prev' : 'is-next');
          nav.setAttribute('aria-label', dir < 0 ? 'Photo précédente' : 'Photo suivante');
          nav.textContent = dir < 0 ? '‹' : '›';
          nav.addEventListener('click', function (evt) {
            evt.stopPropagation();
            idx = (idx + dir + imgs.length) % imgs.length;
            showImg();
          });
          media.appendChild(nav);
        });
        media.appendChild(count);
      }
      showImg();
      tip.appendChild(media);
    }
    var body = document.createElement('div');
    body.className = 'logo-explosion-tip-body';
    var title = document.createElement('strong');
    title.textContent = def.title || '';
    body.appendChild(title);
    // Carte a image : le texte et le lien sont replies sous le titre, et se deplient au survol
    // ou au clic (.is-details, voir style.css). Sans image, tout reste visible.
    var more = body;
    if (imgs.length) {
      var fold = document.createElement('div');
      fold.className = 'logo-explosion-tip-more';
      more = document.createElement('div');
      fold.appendChild(more);
      body.appendChild(fold);
    }
    if (def.text) {
      var p = document.createElement('p');
      p.textContent = def.text;
      more.appendChild(p);
    }
    if (def.url) {
      var a = document.createElement('a');
      a.href = def.url;
      a.textContent = def.cta || 'Voir le produit';
      more.appendChild(a);
    }
    tip.appendChild(body);
    return tip;
  }

  // Photos d'une carte, normalisees en { src, credit, credit_url } : def.img est une photo ou un
  // tableau de photos, chacune une URL ou deja un objet de cette forme (voir $spora_treasures).
  function tipImgs(def) {
    return [].concat(def.img || []).map(function (im) { return typeof im === 'string' ? { src: im } : im; });
  }

  // Souris partie du champignon et de sa carte (away) : la carte d'un tresor se ferme apres
  // TIP_AWAY_MS. Elle attend la fin d'un deplacement du tresor (la capture du pointeur fait
  // "sortir" la souris de la carte) et laisse le temps de la voir juste apres le deterrage
  // (tipHoldUntil). Souris seulement : au doigt, un tap ailleurs la ferme deja.
  var TIP_AWAY_MS = 800, TIP_REVEAL_HOLD_MS = 4000, tipAwayTimer = 0, tipHoldUntil = 0;
  function tipAway(away) {
    if (!away) { clearTimeout(tipAwayTimer); tipAwayTimer = 0; return; }
    if (tipAwayTimer) return;
    tipAwayTimer = setTimeout(function check() {
      var open = null;
      treasures.forEach(function (t) { if (t.tip && t.tip.classList.contains('is-open')) open = t; });
      var wait = (treasureGrab || (open && open.tip.matches(':hover'))) ? TIP_AWAY_MS : tipHoldUntil - performance.now();
      if (open && wait > 0) { tipAwayTimer = setTimeout(check, wait); return; }
      tipAwayTimer = 0;
      if (open) openTip(null);
    }, TIP_AWAY_MS);
  }

  // Ecran tactile (pas de survol) : la carte ouverte se ferme d'office apres TIP_IDLE_MS sans
  // qu'on y touche, sauf en grand (.is-zoom : on regarde la photo). Rearmee par openTip et par
  // tout appui sur la carte. A la souris c'est tipAway qui ferme.
  var TIP_IDLE_MS = 8000, TIP_SWIPE_PX = 30, tipIdleTimer = 0;
  var NO_HOVER = !!(window.matchMedia && window.matchMedia('(hover: none)').matches);
  function tipIdle() {
    clearTimeout(tipIdleTimer);
    if (!NO_HOVER) return;
    tipIdleTimer = setTimeout(function () {
      var open = null;
      treasures.forEach(function (t) { if (t.tip && t.tip.classList.contains('is-open')) open = t; });
      if (!open) return;
      if (open.tip.classList.contains('is-zoom')) tipIdle(); else openTip(null);
    }, TIP_IDLE_MS);
  }

  // Tap sur la carte d'un tresor : sur la photo, agrandit / reduit la carte (le texte se deplie
  // avec, voir .is-zoom ; sur ecran tactile elle prend alors toute la boite) ; ailleurs, deplie /
  // replie le texte.
  function tapTip(t, onImg) {
    t.tip.classList.toggle(onImg ? 'is-zoom' : 'is-details');
  }

  // Une seule infobulle ouverte a la fois : les tresors (et la bulle mycelium, active
  // valant la chaine 'myc') sont proches, elles se chevaucheraient.
  function openTip(active, tapped) {
    var wasOpen = !!(active && active.tip && active.tip.classList.contains('is-open'));
    treasures.forEach(function (t) {
      if (!t.tip) return;
      t.tip.classList.toggle('is-open', t === active);
      if (t !== active) t.tip.classList.remove('is-details', 'is-zoom'); // se rouvre repliee
    });
    // Boite sous le jeu (ecran etroit) : elle garde la carte du dernier tresor selectionne, meme
    // "fermee" (elle n'y depend pas de .is-open, voir style.css ; sa croix la retire) ; la
    // precedente retourne dans le jeu, invisible. Ecran redevenu large : tout retourne dans le jeu.
    if (shelfEl) {
      var shelved = shelfMq && shelfMq.matches;
      if (!shelved || (active && active !== 'myc' && active.tip && active.tip.parentNode !== shelfEl)) {
        while (shelfEl.firstChild) container.appendChild(shelfEl.firstChild);
        if (shelved) shelfEl.appendChild(active.tip);
      }
      if (shelved && active && active.tip && (tapped || !wasOpen)) shelfCue(active);
    }
    if (mycTip) mycTip.classList.toggle('is-open', active === 'myc');
    if (!!active !== tipOpen) { tipOpen = !!active; tipChangeAt = performance.now(); } // voir leachTip
    if (active && active !== 'myc') tipIdle(); else clearTimeout(tipIdleTimer);
  }

  // Carte rangee sous le jeu (shelfEl), souvent hors ecran : la ou la bulle serait apparue, une
  // pastille (photo + titre) surgit au-dessus du champignon puis tombe vers le bas de la boite,
  // en direction de la carte (animation CSS, --drop = distance jusqu'au bas de la boite). La
  // carte s'illumine a l'arrivee (.is-fresh). Un tap sur la pastille fait defiler jusqu'a elle.
  var shelfCueEl = null;
  function shelfCue(t) {
    if (shelfCueEl) shelfCueEl.remove();
    var m = t.mushroom, cue = document.createElement('button');
    if (!m) return;
    cue.type = 'button';
    cue.className = 'logo-explosion-shelf-cue';
    var photo = t.tip.querySelector('img'), name = t.tip.querySelector('strong');
    if (photo) {
      var thumb = document.createElement('img');
      thumb.src = photo.src;
      thumb.alt = '';
      cue.appendChild(thumb);
    }
    var label = document.createElement('span');
    label.textContent = name ? name.textContent : '';
    cue.appendChild(label);
    // Overlay HTML : px CSS, donc * ZOOM (comme positionTipOverMushroom). 120 : reste sous le header.
    var boxW = W * ZOOM, top = Math.max(120, (surfaceAt(m.x) - camY) * ZOOM - 70);
    cue.style.left = Math.max(110, Math.min(boxW - 110, (m.x - camX) * ZOOM)) + 'px';
    cue.style.top = top + 'px';
    cue.style.setProperty('--drop', Math.max(80, container.clientHeight - top + 60) + 'px');
    cue.addEventListener('click', function () { shelfEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
    cue.addEventListener('animationend', function () {
      cue.remove();
      if (shelfCueEl === cue) shelfCueEl = null;
    });
    container.appendChild(cue);
    shelfCueEl = cue;
    t.tip.classList.remove('is-fresh');
    void t.tip.offsetWidth; // relance l'animation si la meme carte est rechoisie
    t.tip.classList.add('is-fresh');
  }

  // Position d'une infobulle juste au-dessus du chapeau d'un champignon (monde -> ecran,
  // - camX/- camY) ; partagee par les tresors deterres et la bulle mycelium.
  function positionTipOverMushroom(tipEl, m) {
    var g = easeOutBack(Math.max(0, Math.min(1, m.t)));
    // Overlay HTML : positions en px CSS, donc * ZOOM (la taille de la bulle, elle, reste en px CSS).
    var capTop = (surfaceAt(m.x) - camY + 6 - m.size * g * 1.45) * ZOOM;
    var half = tipEl.offsetWidth / 2;
    var mScreenX = (m.x - camX) * ZOOM;
    var left = Math.max(half + 8, Math.min(W * ZOOM - half - 8, mScreenX));
    tipEl.style.left = left + 'px';
    // Champignon sorti trop haut (terre decompactee) ou carte agrandie : la bulle reste dans l'ecran,
    // sans fleche, et sous le header qui flotte par-dessus le haut de la boite (accueil). Bornee a
    // 150px comme --game-ui-top : menu mobile ouvert, le header est tres haut.
    var hb = siteHeader ? siteHeader.getBoundingClientRect().bottom - container.getBoundingClientRect().top : 0;
    var minTop = tipEl.offsetHeight + 8 + Math.max(0, Math.min(hb, 150)), top = Math.max(capTop - 6, minTop);
    tipEl.classList.toggle('is-clamped', top !== capTop - 6);
    tipEl.style.top = top + 'px';
    tipEl.style.setProperty('--arrow-dx', (mScreenX - left) + 'px');
  }

  // Ces overlays sont du HTML positionne en absolu dans la boite : leurs coordonnees
  // doivent etre converties de monde vers ecran (- camX, - camY), contrairement au canvas
  // qui le fait via ctx.translate dans draw().
  // Bulle "creusez..." a cote d'un tresor pas encore deterre (clic dessus) : une seule, qui suit
  // le tresor a l'ecran et se ferme seule (DIG_TIP_MS) ou quand il est deterre.
  var digTipEl = null, digTipTarget = null, digTipTimer = 0, DIG_TIP_MS = 5000;
  function hideDigTip() {
    clearTimeout(digTipTimer);
    digTipTarget = null;
    digTipHover = false;
    if (digTipEl) digTipEl.classList.remove('is-open');
  }
  var digTipHover = false;
  // Tresor pas encore deterre dont le scintillement affiche est sous le pointeur (meme enfoui) :
  // on compare au rectangle reel de l'element (coordonnees fenetre), pas a un calcul monde -> ecran.
  function treasureGlintAt(evt) {
    var best = null, bd = 34;
    for (var i = 0; i < treasures.length; i++) {
      var t = treasures[i];
      if (t.revealed || !t.glint.classList.contains('is-visible')) continue;
      var r = t.glint.getBoundingClientRect();
      var d = Math.hypot(r.left + r.width / 2 - evt.clientX, r.top + r.height / 2 - evt.clientY);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }
  function showDigTip(t, hover) {
    if (!digTipEl) {
      digTipEl = document.createElement('div');
      digTipEl.className = 'logo-explosion-digtip';
      digTipEl.setAttribute('aria-hidden', 'true');
      digTipEl.textContent = DIG_TREASURE_MSG;
      container.appendChild(digTipEl);
    }
    digTipTarget = t;
    digTipHover = !!hover;
    digTipEl.classList.add('is-open');
    clearTimeout(digTipTimer);
    if (!hover) digTipTimer = setTimeout(hideDigTip, DIG_TIP_MS);
    positionDigTip();
  }
  function positionDigTip() {
    if (!digTipEl || !digTipTarget) return;
    if (digTipTarget.revealed) { hideDigTip(); return; }
    var sx = (digTipTarget.x - camX) * ZOOM, sy = (treasureY(digTipTarget) - camY) * ZOOM;
    var half = digTipEl.offsetWidth / 2;
    digTipEl.style.left = Math.max(half + 8, Math.min(W * ZOOM - half - 8, sx)) + 'px';
    digTipEl.style.top = Math.max(digTipEl.offsetHeight + 8, sy - 26) + 'px';
  }

  function positionTreasureOverlays() {
    // Un seul repere a la fois : celui du tresor enfoui le plus pres du centre de l'ecran.
    var hintT = null, hintD = W / 2 + 20;
    for (var h = 0; h < treasures.length; h++) {
      var dh = Math.abs(treasures[h].x - camX - W / 2);
      if (!treasures[h].revealed && dh < hintD) { hintD = dh; hintT = treasures[h]; }
    }
    for (var i = 0; i < treasures.length; i++) {
      var t = treasures[i];
      var screenX = t.x - camX;
      if (!t.revealed) {
        // Toujours signale des qu'il est dans la vue, meme enfoui (il ne se creuse que
        // quand treasureReachable, voir tryDig).
        var sy = treasureY(t) - camY;
        var show = t.ready && sy > -20 && sy < H + 20 && screenX > -20 && screenX < W + 20;
        t.glint.classList.toggle('is-visible', show);
        t.glint.style.left = screenX * ZOOM + 'px';
        t.glint.style.top = (sy * ZOOM - 2) + 'px';
        if (t.hint) {
          // A la surface (ou sur le tresor si on a creuse plus bas que lui). Cache pendant le
          // tutoriel du mycelium, comme la boussole : il detournerait l'attention.
          var hy = Math.min(sy, surfaceAt(t.x) - camY);
          t.hint.classList.toggle('is-visible', t === hintT && t.ready && hy * ZOOM > 30 && hy < H + 20 && screenX > -20 && screenX < W + 20 && !(unlockedStrains.length && guideCurrent()));
          t.hint.style.left = screenX * ZOOM + 'px';
          t.hint.style.top = (hy * ZOOM - 34) + 'px';
        }
        continue;
      }
      if (t.sparks) {
        var ny = nuggetY(t) - camY, nsx = t.nx - camX, nr = t.nugget.r;
        t.sparks[0].style.left = (nsx - nr * 0.35) * ZOOM + 'px';
        t.sparks[0].style.top = (ny - nr * 0.7) * ZOOM + 'px';
        t.sparks[1].style.left = (nsx + nr * 0.5) * ZOOM + 'px';
        t.sparks[1].style.top = (ny - nr * 0.2) * ZOOM + 'px';
      }
      if (!t.tip) continue;
      positionTipOverMushroom(t.tip, t.mushroom);
      // Champignon sorti de l'ecran : la bulle s'efface graduellement, puis se ferme.
      var farX = t.mushroom.x - camX, off = farX < 0 ? -farX : farX > W ? farX - W : 0, fade = 1 - off / (W * 0.12);
      if (t.tip.classList.contains('is-open') && off > 0) {
        // Filet de securite : hors ecran depuis 2,5 s, elle se ferme meme si la distance ne suffit pas (bord du monde).
        if (!t.farSince) t.farSince = performance.now();
        if (fade <= 0 || performance.now() - t.farSince > 2500) { openTip(null); t.tip.style.opacity = ''; t.farSince = 0; }
        else t.tip.style.opacity = Math.min(fade, 1 - (performance.now() - t.farSince) / 2500).toFixed(2);
      } else { t.tip.style.opacity = ''; t.farSince = 0; }
    }
    if (mycTip && mycTipMushroom) positionTipOverMushroom(mycTip, mycTipMushroom);
    positionDigTip();
    updateCompass();
  }

  // --- Reconstruction ----------------------------------------------------------------
  function rebuild() {
    if (mode !== 'exploded') return;
    mode = 'rebuilding';
    rebuildT = 0;
    camX = camMargin; // la camera revient au centre pendant que le logo se reconstruit
    camY = ZOOM === 1 ? 0 : camHomeY();
    mobileArrow = 0;
    mobileArrowY = 0;
    leaveHand(); // ce qu'on tenait/agrippait a la main ne survit pas a la reconstruction (rend aussi s.carried a false)
    // Les grains en vol n'ont pas de place dans le logo : ils disparaissent.
    shards = shards.filter(function (g) { return !g.grain && !g.extra && g.eaten === undefined; });
    colonised = []; fruited = {}; deadMyc = []; tintedMyc = false; resetPatches();
    trees = []; litter = []; treeLife = false;
    insects = []; heldInsect = null; insectNextAt = null; insectLastT = null;
    compactNutri = []; drops = [];
    lakes = []; lakeOf = []; lakeLastT = null;
    weather.raining = false; weather.clouds = []; weather.lastNow = null;
    weather.drought = false;
    updateDroughtIndicator();
    leaveBag();
    for (var i = 0; i < shards.length; i++) {
      var s = shards[i];
      s.sx = s.x; s.sy = s.y; s.srot = s.rot; s.smix = s.mix;
      s.delay = Math.random() * 0.35;
    }
    leaveShovel();
    clearTreasures();
    clearMycTip();
    hideMsgs();
    hideDemoEnd();
    setCaption(CAPTION_BEFORE);
    if (rebuildBtn) rebuildBtn.classList.add('d-none');
    if (speedBtn) speedBtn.classList.add('d-none');
    if (debugToggleBtn) debugToggleBtn.classList.add('d-none');
    if (moneyEl) moneyEl.classList.add('d-none');
    releaseHeader();
    hideDebugPanel();
    if (toolsBar) toolsBar.classList.add('d-none');
    if (chBadgeEl) chBadgeEl.classList.add('d-none');
    updateStrainBar(); // mode 'rebuilding' : le menu des souches se cache
    if (treasureCountEl) treasureCountEl.classList.add('d-none');
    if (toolsArrow) toolsArrow.classList.add('d-none');
    if (scrollLeftBtn) scrollLeftBtn.classList.add('d-none');
    if (scrollRightBtn) scrollRightBtn.classList.add('d-none');
    if (scrollUpBtn) scrollUpBtn.classList.add('d-none');
    if (scrollDownBtn) scrollDownBtn.classList.add('d-none');
    startLoop();
  }

  function stepRebuild() {
    rebuildT += 1 / 70;
    // Le tas s'enfonce avec le lit de terre, qui redescend d'ou il etait monte ; le
    // compact remonte lentement vers son niveau d'origine (setupSoil le refixe de toute
    // facon au prochain build).
    for (var i = 0; i < heights.length; i++) {
      heights[i] *= 0.9;
      compactY[i] += (groundY - compactY[i]) * 0.1;
    }
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
    hideMsgs();
    if (rebuildBtn) rebuildBtn.classList.add('d-none');
    if (speedBtn) speedBtn.classList.add('d-none');
    if (debugToggleBtn) debugToggleBtn.classList.add('d-none');
    if (moneyEl) moneyEl.classList.add('d-none');
    releaseHeader();
    hideDebugPanel();
    if (toolsBar) toolsBar.classList.add('d-none');
    if (chBadgeEl) chBadgeEl.classList.add('d-none');
    updateStrainBar();
    if (treasureCountEl) treasureCountEl.classList.add('d-none');
    if (toolsArrow) toolsArrow.classList.add('d-none');
    if (scrollLeftBtn) scrollLeftBtn.classList.add('d-none');
    if (scrollRightBtn) scrollRightBtn.classList.add('d-none');
    if (scrollUpBtn) scrollUpBtn.classList.add('d-none');
    if (scrollDownBtn) scrollDownBtn.classList.add('d-none');
    mobileArrow = 0;
    mobileArrowY = 0;
    hoverScreenX = null; hoverScreenY = null;
    leaveBag();
    leaveHand();
    weather.raining = false; weather.clouds = []; weather.lastNow = null;
    weather.drought = false;
    updateDroughtIndicator();
    drops = []; compactNutri = [];
    lakes = []; lakeOf = []; lakeLastT = null;
    shards = [];
    resetTiles();
    mushrooms = [];
    colonised = []; fruited = {}; deadMyc = []; tintedMyc = false; resetPatches();
    bagGrainsLeft = 0; // le sac se re-achete (ou se re-offre s'il n'a jamais servi) au prochain versement
    trees = []; litter = []; treeLife = false;
    insects = []; heldInsect = null; insectNextAt = null; insectLastT = null;
    if (slowTimer !== null) { clearTimeout(slowTimer); slowTimer = null; }
  }

  // --- Evenements --------------------------------------------------------------------
  function getRelativePos(evt) {
    // container plutot que canvas : le canvas est en d-none (rect a 0) avant le clic.
    // Coordonnees ECRAN (relatives a la boite), pas encore converties en coord. monde.
    // Divisees par ZOOM : px CSS -> px logiques (meme repere que W/H).
    var rect = container.getBoundingClientRect();
    var p = evt.touches ? evt.touches[0] : evt;
    return { x: (p.clientX - rect.left) / ZOOM, y: (p.clientY - rect.top) / ZOOM };
  }

  // Coordonnees monde (ajoute le decalage camera courant) : a utiliser pour toute la
  // physique/logique (pelle, tresors, tas) une fois le monde explose.
  function getWorldPos(evt) {
    var p = getRelativePos(evt);
    return { x: p.x + camX, y: p.y + camY };
  }

  container.addEventListener('click', function (evt) {
    // Le bouton, les fleches et les infobulles sont dans la boite : leurs clics ne creusent pas.
    // (bug corrige : le bouton plein ecran manquait ici, un clic
    // dessus remontait jusqu'a ce listener et redeclenchait explode()/build() en plus
    // de l'action du bouton lui-meme.)
    if (evt.target.closest('#logo-explosion-rebuild, #logo-explosion-fullscreen, .logo-explosion-scroll, .logo-explosion-tip, .logo-explosion-shelf-cue,.logo-explosion-compass, .logo-explosion-tools, .logo-explosion-strains, .logo-explosion-treasures, .logo-explosion-challenges-badge, .logo-explosion-explain-locate, .logo-explosion-explain-close, .logo-explosion-explain-ack, .logo-explosion-end')) return;
    if (mode === 'assembled') updateZoom(); // le zoom du monde qui va etre construit, avant de convertir le clic
    var pos = getRelativePos(evt);
    if (mode === 'assembled') {
      // Seul un clic sur le logo (ou sa zone "play" juste en dessous) declenche
      // l'explosion : avant, n'importe quel clic dans la boite (meme le vide autour)
      // le faisait, ce qui ne correspond pas au curseur special affiche uniquement
      // au-dessus du logo.
      if (!evt.target.closest('#logo-explosion-fallback-wrap')) return;
      if (holdTouch) return; // au doigt : appui maintenu, voir plus bas
      // camX vient d'etre (re)centre par build() : + camX donne la position monde de
      // l'origine de l'explosion, coherente avec les coord. monde des facettes.
      if (imgReady && build()) explode(pos.x + camX, pos.y + camY);
      return;
    }
    // Une fois explose, tout passe par les evenements pointer du canvas (pelle + taps).
  });

  // Au doigt, un simple tap ne lance pas le jeu (trop facile a declencher en faisant
  // defiler la page) : il faut maintenir HOLD_MS, pendant que l'anneau du badge "play"
  // se remplit (.is-holding dans style.css). La souris garde le clic simple ci-dessus.
  var HOLD_MS = 800;
  var HOLD_HINT_MS = 2000; // duree du mot "Maintenez" apres un tap trop court
  var HOLD_FOLLOW_EASE = 0.4; // lissage du badge qui suit le doigt (voir stepMagnet)
  var HOLD_LIFT = 60;       // px, le badge se tient au-dessus du doigt pour rester visible
  var holdWrap = document.getElementById('logo-explosion-fallback-wrap');
  var holdTimer = null, holdHintTimer = null, holdTouch = false;
  function cancelHold() {
    clearTimeout(holdTimer);
    holdTimer = null;
    holdWrap.classList.remove('is-holding');
    if (holdTouch) { magnetTx = 0; magnetTy = 0; } // le badge retourne a sa place
  }
  // Le badge vient sous le doigt et le suit : reutilise --mx/--my du magnetisme souris,
  // sans la borne MAGNET_MAX (le doigt peut etre sur le logo, loin de la zone du badge).
  function holdFollow(evt) {
    if (!playBadge) return;
    var zr = playBadge.parentElement.getBoundingClientRect();
    magnetTx = evt.clientX - (zr.left + zr.width / 2);
    magnetTy = evt.clientY - (zr.top + zr.height / 2) - HOLD_LIFT;
  }
  if (holdWrap) {
    holdWrap.style.setProperty('--hold-ms', HOLD_MS + 'ms');
    holdWrap.addEventListener('pointerdown', function (evt) {
      holdTouch = evt.pointerType !== 'mouse';
      if (!holdTouch || mode !== 'assembled' || !imgReady) return;
      updateZoom();
      var pos = getRelativePos(evt);
      cancelHold();
      clearTimeout(holdHintTimer);
      holdWrap.classList.remove('is-hint');
      holdWrap.classList.add('is-holding');
      holdFollow(evt);
      holdTimer = setTimeout(function () {
        cancelHold();
        if (mode === 'assembled' && build()) explode(pos.x + camX, pos.y + camY);
      }, HOLD_MS);
    });
    holdWrap.addEventListener('pointermove', function (evt) { if (holdTimer) holdFollow(evt); });
    // Doigt releve avant la fin : on explique le geste (sursaut + "Maintenez").
    holdWrap.addEventListener('pointerup', function () {
      if (holdTimer) {
        holdWrap.classList.add('is-hint');
        clearTimeout(holdHintTimer);
        holdHintTimer = setTimeout(function () { holdWrap.classList.remove('is-hint'); }, HOLD_HINT_MS);
      }
      cancelHold();
    });
    // pointercancel : le doigt a commence a faire defiler la page, on abandonne sans rien dire.
    ['pointercancel', 'pointerleave'].forEach(function (n) {
      holdWrap.addEventListener(n, cancelHold);
    });
    // Appui long sur une image : pas de menu contextuel du navigateur.
    holdWrap.addEventListener('contextmenu', function (evt) { if (holdTouch) evt.preventDefault(); });
  }

  // Pointer events : meme code pour souris, doigt et stylet.
  // Souris : la pelle suit le survol, bouton maintenu = elle ralentit (mode precis). Le
  // survol pres des bords de la boite fait aussi defiler le monde (voir cameraSpeed).
  // Doigt : le bol suit le doigt, doigt leve = il se vide puis disparait. Deux facons de
  // defiler : les fleches tactiles, ou amener l'outil tenu pres d'un bord (edgeTouch,
  // voir cameraSpeed).
  var pressCaught = false;
  canvas.addEventListener('pointerdown', function (evt) {
    if (mode !== 'exploded') return;
    edgeTouch = evt.pointerType !== 'mouse';
    var screenPos = getRelativePos(evt);
    var pos = { x: screenPos.x + camX, y: screenPos.y + camY };
    if (evt.pointerType === 'mouse') { hoverScreenX = screenPos.x; hoverScreenY = screenPos.y; }
    try { canvas.setPointerCapture(evt.pointerId); } catch (e) { /* pas grave */ }
    pointerDown = pos;
    dragMoved = false;
    // Clic sur un tresor pas encore deterre : rappelle comment creuser.
    var hintT = treasureGlintAt(evt);
    if (hintT) showDigTip(hintT);
    // Un clic sur la pelle plantee la prend quel que soit l'outil : la main se selectionne toute seule.
    if (tool !== 'hand' && !shovel.on && shovelHit(pos.x, pos.y, evt.pointerType !== 'mouse')) setTool('hand');
    if (tool === 'hand') {
      // La pelle plantee est prioritaire, mais seulement si le clic tombe sur elle (voir aussi plus haut : ce clic selectionne la main).
      if (!shovel.on && shovelHit(pos.x, pos.y, evt.pointerType !== 'mouse')) {
        leaveHand();
        pressCaught = true;
        openTip(null);
        grabShovel(pos, evt.pointerType !== 'mouse');
        canvas.style.cursor = '';
        startLoop();
        return;
      }
      if (!hand.on) enterHand(pos);
      hand.touch = evt.pointerType !== 'mouse';
      hand.x = pos.x; hand.y = pos.y;
      // Un champignon a recolter sous le curseur est prioritaire sur tout : on ne saisit rien
      // derriere lui, le tap au relachement le recolte (harvestAt). Sinon feuille, branche, terre.
      // Un papillon sous le curseur est prioritaire : on l'attrape, rien d'autre (ni au tap).
      var bfly = insectAt(pos.x, pos.y);
      pressCaught = !!bfly;
      if (bfly) {
        dropHeldInsect(); // un seul a la fois (appui multi-pointeurs)
        heldSX = screenPos.x; heldSY = screenPos.y;
        catchInsect(bfly);
      } else if (harvestableNear(pos.x, pos.y)) {
        // Cueillette des l'appui (pas seulement au relachement) : maintenir le clic fait aussi sortir le champignon.
        // Avant le tresor : un champignon a cueillir devant/pres d'un tresor deterre ne doit pas etre masque par lui.
        harvestAt(pos);
        pressCaught = true;
      } else if ((treasureGrab = grabTreasureAt(pos))) {
        pressCaught = true; // un tresor deterre se deplace a la main : le champignon et la bulle suivent
      } else if (!handGrabTree(pos)) pickUpHand(pos);
      if (pressCaught) hand.flash = performance.now();
      startLoop(); // le poing se ferme, meme sans rien dans la main
      return;
    }
    if (tool === 'mycelium') {
      if (!unlockedStrains.length) { setCaption(CAPTION_NEED_STRAIN); return; }
      if (!ensureBag()) { setCaption(CAPTION_NEED_MONEY); return; }
      guideSet('strain');
      if (!mycFedOnce) {
        if (underMatureTree(pos.x)) guideSet('poured');
        else if (matureTrees().length && !guideFlags.poured) setCaption(CAPTION_MYC_CLOSER);
        else if (noWoodNear(pos.x)) setCaption(CAPTION_MYC_NO_WOOD);
      }
      if (!bag.on) enterBag(pos);
      bag.x = pos.x; bag.y = pos.y;
      bag.pouring = true;
      startLoop();
      return;
    }
    if (tool === 'tree') return; // se plante au relachement (tap), pas d'outil traine au curseur
    if (tool === 'fertilizer') { openTip(null); dropFertilizer(pos.x); return; }
    if (tool === 'grass') { openTip(null); seedGrass(pos.x); return; }
  });

  canvas.addEventListener('pointermove', function (evt) {
    if (mode !== 'exploded') return;
    edgeTouch = evt.pointerType !== 'mouse';
    var screenPos = getRelativePos(evt);
    var pos = { x: screenPos.x + camX, y: screenPos.y + camY };
    if (evt.pointerType === 'mouse') { hoverScreenX = screenPos.x; hoverScreenY = screenPos.y; }
    if (tool === 'mycelium') {
      if (!bag.on) enterBag(pos);
      bag.x = pos.x; bag.y = pos.y;
    } else if (tool === 'hand') {
      if (shovel.on) {
        if (!shovel.released) { shovel.gx = pos.x; shovel.gy = pos.y; }
      } else if (!hand.on && (evt.pointerType === 'mouse' || pointerDown)) { enterHand(pos); hand.touch = evt.pointerType !== 'mouse'; }
      hand.x = pos.x; hand.y = pos.y;
    } else if (tool === 'fertilizer' && pointerDown) {
      dropFertilizer(pos.x);
    } else if (tool === 'grass' && pointerDown) {
      seedGrass(pos.x);
    }
    if (treasureGrab && pointerDown && dragMoved) { moveTreasure(treasureGrab.t, pos.x + treasureGrab.dx); }
    if (heldInsect && pointerDown) { heldSX = screenPos.x; heldSY = screenPos.y; }
    if (evt.pointerType === 'mouse') {
      canvas.style.cursor = (!shovel.on && shovelHit(pos.x, pos.y, false)) ? 'grab'
        : (tool === 'hand' && insectAt(pos.x, pos.y)) ? 'pointer' : '';
    }
    if (evt.pointerType === 'mouse' && !pointerDown) {
      // Survoler un tresor deja deterre rouvre son infobulle sans avoir a cliquer.
      var hoverT = treasureNear(pos.x, pos.y);
      // Pas de survol tant qu'un saviez-vous est affiche : il ne reviendrait pas (le clic ouvre quand meme).
      var onT = !!(hoverT && hoverT.revealed);
      if (onT && !hoverT.tipClosed && factShown < 0) openTip(hoverT);
      tipAway(!onT);
      // Survoler le scintillement d'un tresor enfoui ouvre la bulle "creusez..." (sans minuterie).
      var glintT = treasureGlintAt(evt);
      if (glintT) showDigTip(glintT, true); else if (digTipHover) hideDigTip();
    }
    if (pointerDown && Math.hypot(pos.x - pointerDown.x, pos.y - pointerDown.y) > 6) dragMoved = true;
    // Doigt appuye qui a glisse : sa position sert au defilement pres des bords, comme le survol souris.
    if (edgeTouch && pointerDown && dragMoved) { hoverScreenX = screenPos.x; hoverScreenY = screenPos.y; }
    startLoop();
  });

  function endPress(evt, allowTap) {
    dropHeldInsect(); // meme si pointerDown a deja ete remis a zero
    if (!pointerDown) return;
    if (evt.pointerType !== 'mouse') { hoverScreenX = null; hoverScreenY = null; }
    if (tool === 'hand' && shovel.on) {
      releaseShovel();
      pressCaught = false;
      pointerDown = null;
      startLoop();
      return;
    }
    if (tool === 'hand') {
      if (treasureGrab) {
        if (allowTap && !dragMoved) {
          openTip(treasureGrab.t, true); pickTreasureStrain(treasureGrab.t);
          if (treasureGrab.fromTip) tapTip(treasureGrab.t, treasureGrab.onImg);
        }
        treasureGrab = null;
      }
      var hadGrip = !!hand.grip;
      hand.grip = null; // relachee avant de casser : la branche revient droite, rien d'autre
      if (handCarry.length) {
        // On relache la prise : la gravite fait le reste (chute et pose normales, meme
        // chemin que pour n'importe quelle facette delogee par la pelle, voir step()).
        for (var hi = 0; hi < handCarry.length; hi++) handCarry[hi].carried = false;
        handCarry = [];
      } else if (allowTap && !dragMoved && !hadGrip && !pressCaught) {
        // Un tap sur le monde ferme aussi l'infobulle ouverte (tresor ou bulle mycelium).
        var handWp = getWorldPos(evt), handT = treasureNear(handWp.x, handWp.y);
        if (!(handT && handT.revealed)) openTip(null);
        harvestAt(handWp);
      }
      pressCaught = false;
      pointerDown = null;
      if (evt.pointerType !== 'mouse') leaveHand(); // au doigt la main n'existe que pendant l'appui
      startLoop();
      return;
    }
    if (tool === 'mycelium') {
      bag.pouring = false;
      // Au sac, un tap ne creuse pas : il rouvre seulement l'infobulle d'un tresor deja sorti.
      if (allowTap && !dragMoved) {
        var wp = getWorldPos(evt), t = treasureNear(wp.x, wp.y);
        if (t && t.revealed) { openTip(t, true); pickTreasureStrain(t); } else openTip(null);
      }
      if (evt.pointerType !== 'mouse') leaveBag();
      pointerDown = null;
      startLoop();
      return;
    }
    if (tool === 'fertilizer') {
      pointerDown = null;
      startLoop();
      return;
    }
    if (tool === 'tree') {
      if (allowTap && !dragMoved) {
        openTip(null); // un tap plante un arbre mais ferme d'abord toute infobulle ouverte
        plantTree(getWorldPos(evt).x);
      }
      pointerDown = null;
      startLoop();
      return;
    }
    pointerDown = null;
    startLoop();
  }

  canvas.addEventListener('pointerup', function (evt) { endPress(evt, true); });
  canvas.addEventListener('pointercancel', function (evt) { endPress(evt, false); });
  window.addEventListener('blur', dropHeldInsect);
  canvas.addEventListener('pointerleave', function (evt) {
    if (evt.pointerType === 'mouse') tipAway(true); // vers la carte : son pointerenter annule
    if (evt.pointerType === 'mouse' && !pointerDown) {
      leaveShovel();
      leaveBag();
      leaveHand();
      hoverScreenX = null; hoverScreenY = null;
    }
  });

  if (rebuildBtn) rebuildBtn.addEventListener('click', resetAllAndRebuild); // la fleche remet tout a zero (sauvegarde incluse), avec l'animation
  // Reutilise le mecanisme de header compact expose par nav-compact.js (voir
  // window.sporaHeaderCompact) plutot que d'en refaire un. Verifie sa presence pour ne
  // rien casser si ce script change ou ne s'est pas encore charge.
  var siteHeader = document.querySelector('.header');
  // Le header change de hauteur en mode compact (padding en transition 0.2s) : l'ecran de
  // fin de demo le suit image par image pendant la transition.
  if (siteHeader) {
    // Bas du header replie, mesure depuis le haut de la boite du jeu (page en haut), pour
    // caler les controles du haut sur mobile (--game-ui-top, lu seulement dans la media
    // query mobile de style.css). La boite ne commence pas tout en haut de la page (padding
    // du hero) : on retire ce decalage, sinon les controles restent trop bas. Bornee a
    // 150px : menu mobile ouvert, le header est tres haut et les pousserait hors de la boite.
    var syncUiTop = function () {
      var boxTop = container.getBoundingClientRect().top + window.scrollY;
      var hb = siteHeader.getBoundingClientRect().height - boxTop;
      container.style.setProperty('--game-ui-top', Math.round(Math.max(0, Math.min(hb, 150))) + 'px');
      // Fleche "monter" (40px de haut) centree dans la bande du header replie, sur mobile.
      container.style.setProperty('--game-arrow-top', Math.round(Math.max(0, hb - (hb + boxTop) / 2 - 20)) + 'px');
    };
    syncUiTop();
    window.addEventListener('resize', syncUiTop);
    window.addEventListener('load', syncUiTop); // le logo du header charge : sa hauteur change
    var syncUntil = 0;
    var syncTick = function () {
      syncDemoEndTop();
      syncUiTop();
      if (performance.now() < syncUntil) requestAnimationFrame(syncTick);
    };
    new MutationObserver(function () {
      syncUntil = performance.now() + 450;
      requestAnimationFrame(syncTick);
    }).observe(siteHeader, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', syncDemoEndTop);
    window.addEventListener('scroll', syncDemoEndTop, { passive: true });
  }
  // Le clic sur le logo compacte le header d'office (voir explode) ; ensuite toute
  // interaction dans le jeu le replie s'il s'est redeplie au defilement.
  var headerCompactedByGame; // sans valeur initiale : explode peut passer avant cette ligne
  function compactHeaderForGame() {
    headerCompactedByGame = true;
    if (window.sporaHeaderCompact && typeof window.sporaHeaderCompact.set === 'function') window.sporaHeaderCompact.set(true);
  }
  container.addEventListener('pointerdown', function () {
    if (mode === 'exploded') compactHeaderForGame();
  });
  // Jeu remis a zero : on redeplie le header que le jeu avait compacte. Pas sur mobile :
  // deplie, il mange trop de l'ecran ; il se redepliera tout seul au defilement.
  function releaseHeader() {
    var narrow = window.matchMedia && window.matchMedia('(max-width: 767.98px)').matches;
    if (!narrow && headerCompactedByGame && window.sporaHeaderCompact && typeof window.sporaHeaderCompact.set === 'function') window.sporaHeaderCompact.set(false);
    headerCompactedByGame = false;
    clearTimeout(headerLeaveTimer);
    headerHover = false;
  }
  // Jeu actif : le header se deplie au survol (souris seulement) et se replie peu apres
  // que la souris en sort. On mesure le rectangle plutot que d'ecouter mouseenter : le
  // header de l'accueil est en pointer-events:none hors de ses liens.
  var HEADER_HOVER_LEAVE = 250;           // delai (ms) avant de replier une fois la souris sortie
  var headerHover = false, headerLeaveTimer = 0;
  function setHeaderHover(over) {
    if (over === headerHover) return;
    headerHover = over;
    clearTimeout(headerLeaveTimer);
    if (!over) headerLeaveTimer = setTimeout(function () { if (mode === 'exploded') compactHeaderForGame(); }, HEADER_HOVER_LEAVE);
    else if (window.sporaHeaderCompact && typeof window.sporaHeaderCompact.set === 'function') window.sporaHeaderCompact.set(false);
  }
  if (siteHeader) {
    document.addEventListener('pointermove', function (evt) {
      // evt.buttons : pas de depliage pendant qu'on joue (outil appuye) pres du haut.
      if (evt.pointerType !== 'mouse' || evt.buttons || mode !== 'exploded') return;
      var r = siteHeader.getBoundingClientRect();
      // contains : le mini-panier ouvert deborde du rectangle du header.
      setHeaderHover(siteHeader.contains(evt.target) || (evt.clientX >= r.left && evt.clientX <= r.right && evt.clientY >= r.top && evt.clientY <= r.bottom));
    });
    document.documentElement.addEventListener('mouseleave', function () {
      if (mode === 'exploded') setHeaderHover(false);
    });
  }
  function hideDebugPanel() {
    if (debugToggleBtn) {
      debugToggleBtn.classList.add('d-none');
      debugToggleBtn.classList.remove('is-active');
      debugToggleBtn.setAttribute('aria-pressed', 'false');
    }
    if (debugPanel) debugPanel.classList.add('d-none');
  }
  // Plein ecran "sur place" (voir .is-fullscreen dans style.css) : agrandit juste la
  // boite a 100vh, ne touche pas au reste de la page (pas de Fullscreen API, pas de
  // position fixed) - le site reste scrollable normalement en dessous.
  // Notre CSS ne change QUE la hauteur (jamais la largeur) : pas besoin de tout
  // reconstruire. Le monde a deja de la profondeur generee sous la vue de depart
  // (DEPTH_MULT, voir setupSoil) qui n'etait simplement pas montree ; on agrandit
  // juste la fenetre de camera (H + toile de fond du canvas) pour en reveler plus,
  // sans toucher au sol/trous/arbres deja en place ni reinitialiser la partie.
  function resizeGameHeight() {
    if (mode === 'assembled') return; // pas encore explose : build() lira la taille a jour au clic
    var rect = container.getBoundingClientRect();
    if (Math.round(rect.width) !== Math.round(UW)) {
      // La largeur a aussi change (jamais le cas pour le bouton plein ecran lui-meme,
      // mais garde-fou si une barre de defilement s'en mele) : seul cas ou on doit
      // vraiment tout reconstruire, comme le fait deja le listener de resize plus bas.
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      resetToLogo();
      return;
    }
    var newH = rect.height;
    if (Math.round(newH) === Math.round(U)) return;
    H = newH / ZOOM; U = H * ZOOM;
    resetTiles();
    sizeCanvas();
    // groundY et le sol existant restent en coordonnees monde absolues, inchanges :
    // seule la fenetre visible (camY..camY+H) grandit ou retrecit.
    worldH = Math.max(worldH, H + U * DEPTH_MULT);
    // Au sommet (camY <= 0) on colle la vue sur le sol en bas d'ecran, comme au depart :
    // la place gagnee sert a montrer plus de ciel, pas plus de sous-sol.
    var atTop = camY <= 0;
    camY = clamp(atTop ? camHomeY() : camY, camMinY(), worldH - H);
  }
  // Vue de depart : le sol au bas de l'ecran. 0 tant que la fenetre n'est pas plus haute que
  // le monde de depart ; negatif en plein ecran ou en zoom arriere (H depasse groundY).
  function camHomeY() { return Math.min(0, groundY - (H - 6)); }
  // Plus haut que 0 : en plein ecran H grandit mais groundY reste fixe, donc il faut pouvoir
  // remonter (camY negatif) jusqu'a ce que le sol soit de nouveau au bas de l'ecran.
  // SKY_EXTRA : ciel en plus au-dessus, pour voir en entier les arbres tres hauts (TALL_SCALE_MAX).
  var SKY_EXTRA = 0.5;
  // Zoome : la vue de depart montre deja beaucoup de ciel au-dessus des arbres, pas de ciel en plus.
  function camMinY() { return ZOOM === 1 ? Math.min(0, groundY - (H - 6)) - H * SKY_EXTRA : camHomeY(); }
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', function () {
      var next = !container.classList.contains('is-fullscreen');
      if (window.sporaSfx) sporaSfx.play('whoosh');
      container.classList.toggle('is-fullscreen', next);
      fullscreenBtn.classList.toggle('is-active', next);
      fullscreenBtn.setAttribute('aria-pressed', next ? 'true' : 'false');
      fullscreenBtn.setAttribute('aria-label', next ? 'Quitter le plein ecran' : 'Agrandir en plein ecran');
      fullscreenBtn.setAttribute('title', next ? 'Quitter le plein ecran' : 'Agrandir en plein ecran');
      resizeGameHeight();
      // Evite un reset en double si la barre de defilement (dis)parait et change
      // aussi la largeur : le listener de resize plus bas compare a cette valeur.
      lastWidth = container.getBoundingClientRect().width;
    });
  }
  // --- Panneau de parametres de simulation (debug) ------------------------------------
  // Genere depuis DEBUG_FIELDS plutot qu'ecrit a la main (~90 constantes) : chaque entree
  // est [groupe, cle, etiquette, min, max, step]. getDebugVar/setDebugVar utilisent eval()
  // uniquement parce que ce theme n'a pas de build step qui permettrait de refactorer ces
  // ~90 `var` en un objet de config sans reecrire toutes leurs references dans le fichier ;
  // les noms passes a eval() viennent exclusivement de ce tableau fige ci-dessous, jamais
  // d'une entree utilisateur, donc aucun risque d'injection.
  var DEBUG_FIELDS = [
    ['Monde (reconstruire pour appliquer)', 'CELLS_ACROSS', 'Facettes du logo', 20, 300, 5],
    ['Monde (reconstruire pour appliquer)', 'COL_W', 'Resolution colonnes', 2, 20, 1],
    ['Monde (reconstruire pour appliquer)', 'BEDROCK_MARGIN', 'Marge roche-mere', 0, 200, 5],
    ['Monde (reconstruire pour appliquer)', 'WORLD_MULT', 'Largeur du monde', 1, 8, 0.5],
    ['Monde (reconstruire pour appliquer)', 'DEPTH_MULT', 'Profondeur du monde', 0.5, 6, 0.5],
    ['Monde (reconstruire pour appliquer)', 'SOIL_RISE_FRAMES', 'Frames montee du sol', 1, 120, 1],
    ['Camera', 'CAMERA_EDGE', 'Zone de defilement', 0, 1, 0.01],
    ['Camera', 'CAMERA_MAX', 'Vitesse defilement H', 0, 15, 0.1],
    ['Camera', 'CAMERA_MAX_Y', 'Vitesse defilement V', 0, 15, 0.1],
    ['Terre', 'GRAVITY', 'Gravité', 0, 2, 0.01],
    ['Terre', 'WIND_STRENGTH', 'Vent (feuilles)', 0, 3, 0.05],
    ['Terre', 'AIR', 'Frottement air', 0.9, 1, 0.001],
    ['Terre', 'REPOSE', 'Angle de repos', 0, 30, 0.5],
    ['Terre', 'LOOSE_DRAW_SCALE', 'Échelle terre meuble', 1, 3, 0.05],
    ['Terre', 'LOGO_BULK', 'Foisonnement logo', 1, 3, 0.05],
    ['Terre', 'DECOMPACT_BULK', 'Foisonnement décompact', 1, 3, 0.05],
    ['Terre', 'LOOSE_MIN', 'Seuil terre meuble', 0, 20, 1],
    ['Terre', 'LOOSE_INSET', 'Retrait terre meuble', 0, 20, 1],
    ['Pelle', 'BLADE_WIDTH', 'Largeur lame', 0.05, 1, 0.01],
    ['Pelle', 'BOWL_SPAN', 'Ouverture bol', 0.05, 1.5, 0.01],
    ['Pelle', 'BOWL_T', 'Épaisseur paroi', 1, 20, 1],
    ['Pelle', 'POUR_ANGLE', 'Angle de versement', 0.5, 3.14, 0.05],
    ['Pelle', 'SLOW_FOLLOW', 'Suivi mode précis', 0.01, 1, 0.01],
    ['Pelle', 'DIG_BITE', 'Tolérance morsure', 0, 20, 1],
    ['Pelle', 'DIG_SPEED', 'Vitesse de creusage', 0.1, 5, 0.1],
    ['Pelle', 'DIG_SPEED_DOWN', 'Vitesse verticale', 0.05, 3, 0.05],
    ['Pelle', 'BLADE_FIELD', 'Zone de force', 0.01, 0.5, 0.01],
    ['Pelle', 'BLADE_PULL', 'Rattrapage vitesse', 0.01, 1, 0.01],
    ['Pelle', 'BLADE_ATTRACT', 'Attraction lame', 0.01, 1, 0.01],
    ['Main / trésors', 'HAND_PICK_R', 'Rayon de ramassage', 2, 60, 1],
    ['Main / trésors', 'HAND_GRAB_MAX', 'Facettes par poignée', 1, 20, 1],
    ['Main / trésors', 'DIG_TO_REVEAL', 'Coups pour déterrer', 1, 10, 1],
    ['Mycélium', 'MYC_GROW', 'Vitesse de blanchiment', 0.0005, 0.05, 0.0005],
    ['Mycélium', 'MYC_READY', 'Seuil de propagation', 0, 1, 0.01],
    ['Mycélium', 'MYC_SPREAD_EVERY', 'Frames entre propagations', 1, 60, 1],
    ['Mycélium', 'MYC_SPREAD_P', 'Chance de propagation', 0, 1, 0.01],
    ['Mycélium', 'MYC_RADIUS', 'Portée depuis inoculation', 0.05, 2, 0.01],
    ['Mycélium', 'HYPHA_W', 'Épaisseur des filaments', 0.3, 4, 0.1],
    ['Mycélium', 'FRUIT_W', 'Largeur zone fructification', 0.02, 1, 0.01],
    ['Mycélium', 'FRUIT_MIN', 'Facettes pour fructifier', 1, 30, 1],
    ['Mycélium', 'MYC_DECOMPOSE_REACH', 'Portée décomposition', 10, 400, 5],
    ['Mycélium', 'MYC_DECOMPOSE_MULT', 'Vitesse décomposition', 1, 60, 1],
    ['Mycélium', 'MYC_STARVE_MS', 'Délai avant famine', 1000, 300000, 1000],
    ['Mycélium', 'MYC_DECAY', 'Vitesse extinction famine', 0.0005, 0.05, 0.0005],
    ['Mycélium', 'MYC_ACTIVE_FEED_MS', 'Fenêtre "activement nourri"', 200, 20000, 100],
    ['Mycélium', 'MYC_HOLD_REACH', 'Portée retenue lessivage', 5, 200, 5],
    ['Mycélium', 'MYC_HOLD_MAX_MS', 'Durée max retenue', 1000, 600000, 1000],
    ['Mycélium', 'MYC_RANDOM_DEATH_P', 'Mort aléatoire (par vérif.)', 0, 0.05, 0.0005],
    ['Mycélium', 'MYC_RANDOM_DEATH_CHECK_MS', 'Intervalle mort aléatoire', 200, 20000, 100],
    ['Mycélium', 'MAX_MUSHROOMS', 'Champignons max', 4, 100, 1],
    ['Mycélium', 'MUSHROOM_STARVE_MS', 'Famine d\'un champignon', 1000, 60000, 500],
    ['Gazon', 'GRASS_MAX_H_F', 'Hauteur des brins', 0.002, 0.1, 0.001],
    ['Gazon', 'GRASS_EMBED', 'Enfoncement des brins', 0, 30, 1],
    ['Gazon', 'GRASS_REGROW_MS', 'Vitesse de repousse', 2000, 300000, 1000],
    ['Gazon', 'GRASS_SPREAD_BONUS', 'Bonus voisine gazonnée', 1, 20, 0.5],
    ['Gazon', 'GRASS_NEIGHBOR_MIN', 'Seuil voisine gazonnée', 0, 1, 0.01],
    ['Gazon', 'GRASS_BASELINE_FOLLOW', 'Suivi référence perturbation', 0.001, 0.5, 0.001],
    ['Gazon', 'GRASS_DISTURB_EPS', 'Seuil de perturbation', 0.5, 30, 0.5],
    ['Gazon', 'GRASS_FRUIT_MIN', 'Couverture min. production', 0, 1, 0.01],
    ['Gazon', 'GRASS_NUTRI_CHECK_MS', 'Fréquence de production', 500, 60000, 500],
    ['Gazon', 'GRASS_NUTRI_P', 'Chance de production', 0, 1, 0.01],
    ['Gazon', 'GRASS_NUTRI_AREA', 'Taille d\'un nutriment', 1, 100, 1],
    ['Gazon', 'GRASS_MYC_REACH', 'Portée symbiose mycélium', 5, 200, 5],
    ['Gazon', 'GRASS_MYC_SURFACE_DEPTH', 'Profondeur max mycélium', 2, 100, 2],
    ['Gazon', 'GRASS_MYC_HEIGHT_MULT', 'Hauteur si mycélium dessous', 1, 4, 0.1],
    ['Gazon', 'GRASS_MYC_NUTRI_WEIGHT', 'Poids production si mycélium', 1, 6, 0.5],
    ['Flore', 'FLORA_TREE_R_MAX', 'Portée max des arbres', 0.05, 0.8, 0.01],
    ['Flore', 'FLORA_TREE_W', 'Poids des arbres', 0, 2, 0.05],
    ['Flore', 'FLORA_MYC_W', 'Poids du mycélium', 0, 2, 0.05],
    ['Flore', 'FLORA_GROW_MS', 'Vitesse de pousse', 1000, 60000, 500],
    ['Flore', 'MOSS_THICK', 'Épaisseur de la mousse', 0, 15, 0.5],
    ['Flore', 'FLORA_TUFT_H_F', 'Hauteur des touffes', 0.005, 0.1, 0.001],
    ['Flore', 'FLORA_FERN_H_F', 'Hauteur des fougères', 0.01, 0.2, 0.005],
    ['Flore', 'FLORA_BUSH_R_F', 'Rayon des buissons', 0.005, 0.1, 0.001],
    ['Fleurs', 'FLOWER_MAX_PER_TREE', 'Fleurs max par arbre', 0, 20, 1],
    ['Fleurs', 'FLOWER_BLOOM_MS', 'Vitesse d\'eclosion', 300, 10000, 100],
    ['Fleurs', 'FLOWER_H_F', 'Hauteur de la tige', 0.01, 0.15, 0.005],
    ['Fleurs', 'FLOWER_R_F', 'Rayon de la corolle', 0.004, 0.05, 0.001],
    ['Arbres / racines', 'ROOT_REACH', 'Portée horizontale', 0.02, 1, 0.01],
    ['Arbres / racines', 'ROOT_VISUAL_REACH', 'Longueur racines dessinées', 0.02, 1, 0.01],
    ['Arbres / racines', 'ROOT_DEPTH_MIN', 'Profondeur à la naissance', 0.01, 1, 0.01],
    ['Arbres / racines', 'ROOT_DEPTH_MAX', 'Profondeur à maturité', 0.02, 1, 0.01],
    ['Arbres / racines', 'MIN_LEACH_TO_EAT', 'Crans avant mangeable', 0, 20, 1],
    ['Arbres / racines', 'NUTRI_RIPEN_MS', 'Maturation sans pluie', 1000, 300000, 1000],
    ['Arbres / racines', 'EAT_MS', 'Délai entre repas', 100, 120000, 100],
    ['Arbres / racines', 'ABUNDANCE_THRESHOLD', 'Seuil d\'abondance', 1, 100, 1],
    ['Arbres / racines', 'ABUNDANCE_EAT_MULT', 'Accélération si abondance', 1, 10, 0.5],
    ['Arbres / racines', 'ABUNDANCE_LEAF_FILL', 'Feuilles remplies d\'un coup', 1, 30, 1],
    ['Arbres / racines', 'BONUS_BRANCH_COST', 'Coût d\'une branche bonus', 1, 20, 1],
    ['Arbres / racines', 'BONUS_BRANCH_MAX', 'Branches bonus max', 1, 30, 1],
    ['Arbres / racines', 'BONUS_BRANCH_LIFE_MS', 'Durée de vie d\'une branche', 5000, 600000, 5000],
    ['Arbres / racines', 'BRANCH_LITTER_MS', 'Décomposition du bois', 30000, 6000000, 30000],
    ['Arbres / racines', 'BRANCH_GROW_MS', 'Vitesse de croissance branche', 500, 60000, 500],
    ['Arbres / racines', 'MATURE_NUTRIENTS', 'Nutriments à maturité', 1, 60, 1],
    ['Arbres / racines', 'ROOT_GROWTH_MIN', 'Racines à la naissance', 0, 1, 0.01],
    ['Arbres / racines', 'LEAF_UNLOCK_MIN', 'Feuilles à la naissance', 1, 40, 1],
    ['Arbres / racines', 'TREE_SCALE_MIN', 'Taille à la naissance', 0.05, 1, 0.01],
    ['Arbres / racines', 'TREE_SCALE_MAX', 'Taille à maturité', 0.5, 4, 0.05],
    ['Arbres / racines', 'TALL_FULL', 'Nutriments pour hauteur max', 5, 200, 1],
    ['Arbres / racines', 'TALL_SCALE_MAX', 'Hauteur bonus max', 0, 1, 0.05],
    ['Arbres / racines', 'SMALL_WIND_MULT', 'Vent sur feuilles (petit arbre)', 0, 1, 0.05],
    ['Arbres / racines', 'TALL_WIND_MULT', 'Vent sur feuilles (arbre haut)', 1, 4, 0.1],
    ['Arbres / racines', 'TREE_COST_STEP', 'Palier de coût d\'un arbre', 0, 500, 10],
    ['Arbres / racines', 'TREE_MIN_SPACING', 'Espacement min. plantation', 10, 400, 5],
    ['Arbres / racines', 'TREE_STARVE_MS', 'Délai avant famine', 2000, 300000, 1000],
    ['Arbres / racines', 'TREE_SHRINK_MS', 'Rythme de rétrécissement', 500, 60000, 500],
    ['Arbres / racines', 'TREE_EMBED', 'Enfoncement du pied', 0, 60, 1],
    ['Arbres / racines', 'EATEN_MS', 'Durée d\'absorption', 50, 10000, 50],
    ['Arbres / racines', 'LEAF_GROW_MS', 'Durée de pousse', 50, 10000, 50],
    ['Arbres / racines', 'CANOPY_CLUSTER_R', 'Rayon des bouquets', 0.02, 0.15, 0.005],
    ['Arbres / racines', 'LEAF_LIFE_MS[0]', 'Durée de vie feuille (min)', 5000, 150000, 1000],
    ['Arbres / racines', 'LEAF_LIFE_MS[1]', 'Durée de vie feuille (max)', 5000, 240000, 1000],
    ['Arbres / racines', 'LITTER_MS', 'Décomposition seule', 5000, 1200000, 5000],
    ['Arbres / racines', 'LITTER_BULK', 'Hauteur litière posée', 0, 1, 0.05],
    ['Arbres / racines', 'LITTER_FLAT', 'Écrasement litière posée', 0.1, 1, 0.05],
    ['Météo / lessivage', 'STORM_MS[0]', 'Durée tempête (min)', 500, 60000, 500],
    ['Météo / lessivage', 'STORM_MS[1]', 'Durée tempête (max)', 500, 90000, 500],
    ['Météo / lessivage', 'STORM_GAP_MS[0]', 'Délai avant tempête (min)', 2000, 300000, 1000],
    ['Météo / lessivage', 'STORM_GAP_MS[1]', 'Délai avant tempête (max)', 2000, 300000, 1000],
    ['Météo / lessivage', 'STORM_LEACH_MULT', 'Multiplicateur de lessivage', 1, 20, 0.5],
    ['Météo / lessivage', 'STORM_SPAWN_MULT', 'Multiplicateur de gouttes', 1, 10, 0.5],
    ['Météo / lessivage', 'RAIN_SHOWER_MS[0]', 'Durée averse (min)', 2000, 120000, 1000],
    ['Météo / lessivage', 'RAIN_SHOWER_MS[1]', 'Durée averse (max)', 2000, 180000, 1000],
    ['Météo / lessivage', 'RAIN_DRY_MS[0]', 'Durée sec entre averses (min)', 2000, 300000, 1000],
    ['Météo / lessivage', 'RAIN_DRY_MS[1]', 'Durée sec entre averses (max)', 2000, 300000, 1000],
    ['Météo / lessivage', 'DROUGHT_MS[0]', 'Durée sécheresse (min)', 2000, 120000, 1000],
    ['Météo / lessivage', 'DROUGHT_MS[1]', 'Durée sécheresse (max)', 2000, 180000, 1000],
    ['Météo / lessivage', 'DROUGHT_GAP_MS[0]', 'Durée sans sécheresse (min)', 2000, 300000, 1000],
    ['Météo / lessivage', 'DROUGHT_GAP_MS[1]', 'Durée sans sécheresse (max)', 2000, 300000, 1000],
    ['Météo / lessivage', 'LEACH_INTERVAL_MS', 'Rythme du lessivage', 10, 2000, 10],
    ['Météo / lessivage', 'LEACH_MAX_STEPS_PER_FRAME', 'Plafond de rattrapage/frame', 10, 1000, 10],
    ['Météo / lessivage', 'LEACH_P', 'Chance de lessivage (sol nu)', 0, 1, 0.01],
    ['Météo / lessivage', 'COMPACT_SINK_SPEED', 'Enfoncement dans le compact', 0.005, 1, 0.005],
    ['Météo / lessivage', 'RAIN_FADE_MS', 'Fondu des nuages', 200, 10000, 100],
    ['Météo / lessivage', 'RAIN_DROP_MAX', 'Gouttes max', 10, 1000, 10],
    ['Météo / lessivage', 'RAIN_SPAWN_MAX', 'Gouttes par frame', 1, 30, 1],
    ['Météo / lessivage', 'RAIN_CLOUDS_N', 'Nombre de nuages', 1, 20, 1],
    ['Météo / lessivage', 'RAIN_CLOUD_DRIFT', 'Dérive des nuages', 0.0005, 0.05, 0.0005],
    ['Météo / lessivage', 'DROUGHT_SURFACE_DEPTH', 'Profondeur exposée', 2, 100, 2],
    ['Météo / lessivage', 'DROUGHT_KILL_P', 'Chance de coup de sec', 0, 0.5, 0.005],
    ['Météo / lessivage', 'MYC_DROUGHT_DECAY', 'Dégâts d\'un coup de sec', 0.01, 1, 0.01],
    ['Météo / lessivage', 'LEAF_RAIN_P', 'Descente feuilles (chance)', 0, 0.2, 0.005],
    ['Météo / lessivage', 'LEAF_RAIN_MAX_DROP', 'Descente feuilles max (px)', 0, 100, 1],
    ['Météo / lessivage', 'DEAD_MYC_DECOMPOSE_P', 'Décomposition myc. mort', 0, 0.2, 0.005],
    ['Économie', 'BAG_COST', 'Coût d\'un sac', 1, 200, 1],
    ['Économie', 'FERT_COST', 'Coût du fertilisant', 0, 20, 1],
    ['Économie', 'BAG_GRAINS', 'Grains par sac', 50, 5000, 50],
    ['Économie', 'MUSHROOM_PRICE', 'Prix d\'un champignon', 1, 100, 1],
    ['Insectes', 'INSECT_MAX', 'Insectes simultanes', 0, 10, 1],
    ['Insectes', 'INSECT_GAP_MIN_MS', 'Attente min. apparition', 1000, 60000, 500],
    ['Insectes', 'INSECT_GAP_MAX_MS', 'Attente max. apparition', 1000, 120000, 1000],
    ['Insectes', 'INSECT_SPEED', 'Vitesse de vol', 0.2, 3, 0.1],
    ['Insectes', 'INSECT_SIZE_F', 'Taille', 0.004, 0.04, 0.001],
    ['Insectes', 'INSECT_LAND_P', 'Chance de se poser', 0, 1, 0.05]
  ];
  function getDebugVar(name) { return eval(name); }
  function setDebugVar(name, value) { eval(name + ' = ' + value + ';'); }
  var debugDefaults = null, debugBuilt = false;
  // Section repliable du panneau d'options : en-tete bouton (aria-expanded) + corps.
  var sectionSeq = 0;
  function makeSection(title, open) {
    var id = 'logo-explosion-sec-' + (sectionSeq++);
    var sec = document.createElement('div');
    sec.className = 'logo-explosion-debug-section';
    var head = document.createElement('button');
    head.type = 'button';
    head.className = 'logo-explosion-debug-head';
    head.setAttribute('aria-controls', id);
    head.textContent = title;
    var body = document.createElement('div');
    body.className = 'logo-explosion-debug-body';
    body.id = id;
    function setOpen(o) {
      head.setAttribute('aria-expanded', o ? 'true' : 'false');
      body.hidden = !o;
    }
    head.addEventListener('click', function () { setOpen(body.hidden); });
    setOpen(open);
    sec.appendChild(head);
    sec.appendChild(body);
    return { sec: sec, body: body };
  }
  function buildDebugPanel() {
    if (!debugPanel || debugBuilt) return;
    debugBuilt = true;
    debugDefaults = {};
    var groups = [], byGroup = {};
    for (var i = 0; i < DEBUG_FIELDS.length; i++) {
      var f = DEBUG_FIELDS[i];
      debugDefaults[f[1]] = getDebugVar(f[1]);
      if (!byGroup[f[0]]) { byGroup[f[0]] = []; groups.push(f[0]); }
      byGroup[f[0]].push(f);
    }
    var frag = document.createDocumentFragment();
    // Compteur de tresors : plus flottant sur la scene, en tete du panneau (voir updateTreasureUI).
    if (treasureCountEl) {
      frag.appendChild(treasureCountEl);
      if (treasureDefs.length) treasureCountEl.classList.remove('d-none');
    }
    // Meteo, vitesse et gazon (anciennement la barre en bas a gauche) : seule section ouverte.
    if (speedWrap) {
      var wx = makeSection('Météo et rythme', true);
      wx.body.appendChild(speedWrap);
      speedWrap.classList.remove('d-none');
      frag.appendChild(wx.sec);
    }
    groups.forEach(function (g) {
      var gs = makeSection(g, false);
      var fs = gs.body;
      byGroup[g].forEach(function (f) {
        var key = f[1], min = f[3], max = f[4], step = f[5];
        var row = document.createElement('div');
        row.className = 'logo-explosion-debug-row';
        var label = document.createElement('label');
        label.textContent = f[2];
        label.setAttribute('for', 'dbg-' + key);
        var input = document.createElement('input');
        input.type = 'range'; input.id = 'dbg-' + key;
        input.min = min; input.max = max; input.step = step;
        input.value = getDebugVar(key);
        var out = document.createElement('output');
        out.textContent = input.value;
        input.addEventListener('input', function () {
          var v = parseFloat(this.value);
          setDebugVar(key, v);
          out.textContent = v;
        });
        row.appendChild(label); row.appendChild(input); row.appendChild(out);
        fs.appendChild(row);
      });
      frag.appendChild(gs.sec);
    });
    var resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'logo-explosion-debug-reset';
    resetBtn.textContent = 'Réinitialiser les valeurs';
    resetBtn.addEventListener('click', function () {
      for (var k in debugDefaults) setDebugVar(k, debugDefaults[k]);
      var inputs = debugPanel.querySelectorAll('input[id^="dbg-"]');
      for (var j = 0; j < inputs.length; j++) {
        var inp = inputs[j], key2 = inp.id.slice(4);
        inp.value = debugDefaults[key2];
        inp.nextSibling.textContent = inp.value;
      }
    });
    frag.appendChild(resetBtn);
    debugPanel.appendChild(frag);
  }
  if (debugToggleBtn) {
    debugToggleBtn.addEventListener('click', function () {
      buildDebugPanel();
      var opening = debugPanel.classList.contains('d-none');
      debugPanel.classList.toggle('d-none', !opening);
      debugToggleBtn.classList.toggle('is-active', opening);
      debugToggleBtn.setAttribute('aria-pressed', opening ? 'true' : 'false');
    });
  }
  // La fleche d'invite reste tant que le mycelium n'a pas ete nourri de bois (voir mycFedOnce).
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
  // Bouton de vitesse pour les visiteurs : boucle normal -> x3 -> x10 (meme timeScale que
  // le curseur du panneau d'options, qu'on garde synchronise).
  if (speedBtn) {
    var SPEED_LEVELS = [1, 3, 10];
    speedBtn.addEventListener('click', function () {
      var i = SPEED_LEVELS.indexOf(timeScale);
      timeScale = SPEED_LEVELS[(i + 1) % SPEED_LEVELS.length];
      speedBtn.querySelector('.logo-explosion-speed-btn-val').textContent = '×' + timeScale;
      speedBtn.classList.toggle('is-fast', timeScale > 1);
      speedBtn.setAttribute('aria-label', 'Vitesse de simulation : ' + (timeScale === 1 ? 'normale' : 'x' + timeScale));
      speedBtn.querySelector('.spd-2').style.display = timeScale > 1 ? '' : 'none';
      speedBtn.querySelector('.spd-3').style.display = timeScale === 10 ? '' : 'none';
      if (speedInput) speedInput.value = timeScale;
      if (speedVal) speedVal.textContent = timeScale + '×';
      startLoop();
    });
  }
  // Multiplicateurs de production de nutriments du gazon (voir updateGrass) : 1 = normal, 0 = aucun.
  var grassNutriInput = document.getElementById('logo-explosion-grass-nutri');
  var grassMycNutriInput = document.getElementById('logo-explosion-grassmyc-nutri');
  if (grassNutriInput) {
    grassNutriInput.addEventListener('input', function () {
      var v = parseFloat(this.value);
      grassNutriMult = v >= 0 ? v : 0;
    });
  }
  if (grassMycNutriInput) {
    grassMycNutriInput.addEventListener('input', function () {
      var v = parseFloat(this.value);
      grassMycNutriMult = v >= 0 ? v : 0;
    });
    var v = parseFloat(grassMycNutriInput.value);
    grassMycNutriMult = v >= 0 ? v : 0;
  }
  // Frequence de la pluie naturelle (voir le cycle meteo pres de updateWeather) : 0 = ne
  // pleut jamais, 100 = averses longues et frequentes.
  if (rainInput) {
    rainInput.addEventListener('input', function () {
      rainLevel = (parseFloat(this.value) || 0) / 100;
      if (rainLevel <= 0) stopShower();
    });
  }
  // Frequence de la secheresse naturelle (voir DROUGHT_* et updateWeather) : 0 = ne seche
  // jamais, 100 = secheresses longues et frequentes. Independant du curseur Pluie ; les deux
  // restent mutuellement exclusifs cote simulation (voir startShower).
  if (droughtInput) {
    droughtInput.addEventListener('input', function () {
      droughtLevel = (parseFloat(this.value) || 0) / 100;
      if (droughtLevel <= 0) weather.drought = false;
      updateDroughtIndicator();
    });
  }
  // Frequence des tempetes (voir STORM_* et updateWeather) : averses normales qui
  // s'intensifient ponctuellement (lessivage x STORM_LEACH_MULT). N'existe que PENDANT une
  // averse deja en cours ; 0 = jamais de tempete, juste de la pluie normale.
  if (stormInput) {
    stormInput.addEventListener('input', function () {
      stormLevel = (parseFloat(this.value) || 0) / 100;
      if (stormLevel <= 0) weather.storm = false;
      updateStormIndicator();
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
