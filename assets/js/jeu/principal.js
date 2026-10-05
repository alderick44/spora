// Jeu du logo (accueil) : point d'entree, charge par amorce.js. Lance le demarrage de chaque module.
import { clamp, hexToRgb, mixRgb, rgbStr, angleDiff, shade, lerp, easeOutBack, easeInOut } from './utils.js';
import {
  MYC_READY, LEACH_TIP_QUIET_MS, LEACH_TIP_GAP_MS, DEATH_ALERT_SHOW_MS, EXPLAIN_MS, PATCH_SNAP_MS,
  PATCH_LINK, STRAIN_STD, PATCH_WINDOW_MS, PATCH_MIN_SIZE, PATCH_MIN_DEATHS, PATCH_SHARE, PATCH_REARM_MS,
  DEATH_ALERT_STALE_MS, DEATH_ALERT_GAP_MS, DEATH_TEXTS, FACT_MS, FACT_AFTER_EXPLAIN_MS, FACT_FIRST_MS,
  FACT_GAP_MS, CH_TREES_GOAL, CH_STRAINS_GOAL, CH_HARVEST_GOAL, CH_MAX_SHOWN, COL_W, CH_STRAIN_BIOMASS,
  CH_ZONE_REACH, CH_COLONY_PCT, CH_COLONY_HOLD_MS, CAPTION_BEFORE, HOLD_FOLLOW_EASE, GUIDE_KEY, TREE_EMBED,
  CAPTION_MYC_DROP, CAPTION_MYC_LEAVES, CAPTION_MYC_TREE_WAIT, CAPTION_MYC_TREE_NONE, CAPTION_MYC_REPOUR,
  CAPTION_MYC_HARVEST, CAPTION_MYC_GROW, CAPTION_MYC_PLACE, CAPTION_MYC_HAND, BAG_GRAINS, BAG_COST,
  TREE_COST_MAX_MULT, TREE_COST_STEP, MUSHROOM_PRICE, MYC, STRAIN_MIX, HYPHA_COLOR, CAMERA_EDGE_TOUCH,
  CAMERA_EDGE, CAMERA_MAX, CAMERA_TOP_DEADZONE, CAMERA_MAX_Y, EATEN_MS, WIND_STRENGTH, GRAVITY, AIR,
  BRANCH_LITTER_MS, LITTER_MS, SOIL_RISE_FRAMES, FRUIT_W, MUSHROOM_STARVE_MS, BLADE_WIDTH, BOWL_SPAN,
  BOWL_T, PLANT_LEAN, SLOW_FOLLOW, POUR_ANGLE, DIG_BITE, DIG_SPEED, DIG_SPEED_DOWN, BEDROCK_MARGIN,
  BLADE_FIELD, BLADE_PULL, BLADE_ATTRACT, DECOMPACT_BULK, EARTH, MIN_LEACH_TO_EAT, MYC_HOLD_MAX_MS,
  SHOVEL_TIP, SHOVEL_BOTTOM, HAND_RING_R, CH_HARVEST_IDS, HAND_LEAF_MARGIN, HAND_LIMB_TOL, BRANCH_GROW_MS,
  HAND_BREAK_DIST, HAND_PUSH_MIN_V, HAND_FIST_MIN_V, HAND_FIST_STEP, HAND_FIST_MAX_STRIKES, HAND_FIST_MAX_V,
  HAND_FIST_R, HAND_FIST_KICK, HAND_FIST_SPREAD, HAND_FIST_LIFT, HAND_FIST_LOOSE, HAND_FIST_MAX_UP,
  HAND_FIST_DEPTH, HAND_FIST_SIZE, HAND_FIST_SHARDS, HAND_PUSH_MAX_V, HAND_PUSH_R, HAND_PUSH_LEAF,
  HAND_PUSH_MAX_LOOSE, HAND_PUSH_DEPTH, HAND_PUSH_P, HAND_PUSH_LOOSE, HAND_ZOOM_K, HAND_FLASH_MS, HAND_SKIN,
  HAND_GRAB_MAX, HAND_PICK_R, SPECIES, MYC_MUSHROOM_SCALE, MAX_MUSHROOMS, CAPTION_MYC,
  MYC_RANDOM_DEATH_CHECK_MS, MYC_RANDOM_DEATH_P, DROUGHT_SURFACE_DEPTH, DROUGHT_KILL_P, MYC_DROUGHT_DECAY,
  MYC_STARVE_MS, MYC_GROW, MYC_DECAY, MYC_DEAD, NUTRI, MYC_SPREAD_EVERY, MYC_RADIUS, MYC_SPREAD_P,
  MYC_ACTIVE_FEED_MS, FRUIT_MIN, CAPTION_BAG_EMPTY, GRAIN, MYC_HOLD_REACH, DEMO_TREASURE_X, HINT_FIST_SVG,
  HINT_SHOVEL_SVG, DIG_HINT_MSG, COMPASS_BOTTOM_PAD, COMPASS_RISE_FRAC, COMPASS_HIDE, COMPASS_ARROW,
  COMPASS_ICON, COMPASS_MSG, COMPASS_TIP_W, DEMO_END_DELAY, DEMO_KEY, TREASURE_NEAR, DIG_TO_REVEAL,
  TIP_SWIPE_PX, TIP_REVEAL_HOLD_MS, NUGGET_R, NUGGET_COLORS, GOLD_BITS_N, GOLD_BITS_LIFE, TIP_AWAY_MS,
  NO_HOVER, TIP_IDLE_MS, DIG_TREASURE_MSG, DIG_TIP_MS, HOLD_LIFT, HOLD_MS, HOLD_HINT_MS,
  CAPTION_NEED_STRAIN, CAPTION_NEED_MONEY, CAPTION_MYC_CLOSER, CAPTION_MYC_NO_WOOD, HEADER_HOVER_LEAVE,
  DEPTH_MULT, SKY_EXTRA, DEBUG_FIELDS, getDebugVar, setDebugVar
} from './config.js';
import {
  partie, monde, caption, vue, toolsBar, strainsBar, toolsArrow, container, moneyEl, moneyVal, canvas,
  fallbackImg, rebuildBtn, fullscreenBtn, speedBtn, debugToggleBtn, treasureCountEl, scrollLeftBtn,
  scrollRightBtn, scrollUpBtn, scrollDownBtn, temps, ctx, toolBtns, shelfEl, isMobile, shelfMq, updateZoom,
  debugPanel, speedWrap, speedInput, speedVal, rainInput, droughtInput, stormInput, initEtat
} from './etat.js';
import { draw, poly, resetTiles } from './rendu.js';
import {
  surfaceAt, pileRemove, restColumn, pileAdd, triArea, isRocky, isSubmerged, build, sizeCanvas, initTerrain
} from './terrain.js';
import {
  savePlayerIfChanged, makeSavedTrees, terrainSig, foundList, resetAllAndRebuild, initSauvegarde
} from './sauvegarde.js';
import {
  weather, updateWeather, updateRainDrops, updateDroughtIndicator, stopShower, updateStormIndicator
} from './meteo.js';
import {
  matureTrees, treeScale, underMatureTree, makeTree, makeStartTree, stepTrees, demoGuard, makeLeafShard,
  makeWoodShard, shedBranchSlot, noWoodNear, plantTree, initArbres
} from './arbres.js';
import {
  updateGrass, stepFlowers, stepInsects, dropHeldInsect, insectAt, catchInsect, dropFertilizer, seedGrass
} from './flore.js';

var captionTimer = null;
var leachTipAt = -1e9;
var explainEl = document.getElementById('logo-explosion-explain');
var explainText = explainEl && explainEl.querySelector('.logo-explosion-explain-text');
var factEl = document.getElementById('logo-explosion-fact');
var factText = factEl && factEl.querySelector('.logo-explosion-fact-text');
var factClose = factEl && factEl.querySelector('.logo-explosion-fact-close');
var explainTimer = null, factTimer = null, explainEndAt = -1e9, factAt = -1e9, factShownAt = 0;
var rainSince = null, rainCount = 0, msgTickAt = 0;
export var FACTS = [
  { text: 'Un sol nu est lessivé : la pluie emporte l\'humus et ses nutriments vers les cours d\'eau.', when: function () { return rainSince !== null && performance.now() - rainSince > 20000 && !mycAlive(); } },
  { text: 'Les filaments du mycélium agrègent les particules de sol, qui résistent mieux à l\'érosion.', when: function () { return weather.raining && mycAlive(); } },
  { text: 'Le champignon que vous cueillez n\'est que le fruit : le vrai organisme, le mycélium, vit sous terre.', when: function () { return partie.harvestCount >= 1; } },
  { text: 'Le champignon apporte à la plante de l\'eau et des minéraux, surtout du phosphore, et reçoit des sucres en échange.', when: function () { return monde.trees.length > 0 && mycAlive(); } },
  { text: 'Champignons et bactéries sont les principaux décomposeurs : sans eux, le bois mort s\'accumulerait.', when: function () { return monde.litter.length > 0 && mycAlive(); } },
  { text: 'La pluie lessive surtout les nutriments solubles, comme les nitrates.', when: function () { return rainCount >= 2 || partie.fertDropped; } },
  { text: 'Un champignon libère des millions de spores, invisibles à l\'œil nu.', when: function () { return partie.harvestCount >= 1; } },
  { text: 'Le pleurote pousse sur la paille ou le marc de café : il recycle des déchets.', when: function () { return partie.pleuroteDug || partie.harvestCount >= 2; } },
  { text: 'L\'humus retient l\'eau comme une éponge et limite le ruissellement.', when: function () { return weather.raining && humusPresent(); } },
  { text: 'Un champignon n\'est ni une plante ni un animal : c\'est un règne à part, plus proche des animaux.', when: function () { return performance.now() - partie.explodedAt > 240000; } }
  ,{ text: 'Certaines espèces ne se cultivent que sur le bois dur : inoculez le bois avec de l\'hydne hérisson.', now: true, when: function () { return partie.branchTorn && partie.unlockedStrains.indexOf('hydne') !== -1; } }
];
function mycAlive() {
  for (var i = 0; i < monde.colonised.length; i++) if (monde.colonised[i].myc > MYC_READY) return true;
  return false;
}
function humusPresent() {
  for (var i = 0; i < monde.shards.length; i++) if (monde.shards[i].nutri && monde.shards[i].settled) return true;
  return false;
}
function msgBlocked(t) {
  return partie.mode !== 'exploded' || partie.tipOpen || t - partie.tipChangeAt < LEACH_TIP_QUIET_MS || (caption && caption.classList.contains('is-visible'));
}
function setCard(el, on) {
  if (!el) return;
  el.classList.toggle('is-visible', on);
  el.setAttribute('aria-hidden', on ? 'false' : 'true');
}
// ack : le conseil revient tant que le joueur n a pas clique "Compris" (sinon une seule fois).
export function leachTip(bit, text, ack) {
  if (partie.leachTipSeen & bit) return;
  var t = performance.now();
  // Pendant la demo, et tant que le tutoriel n'est pas fini : ni conseil vert ni saviez-vous (voir aussi flushDeathAlert, msgTick).
  if (!explainEl || msgBlocked(t) || t - leachTipAt < LEACH_TIP_GAP_MS || partie.DEMO || guideCurrent()) return;
  if (!ack) partie.leachTipSeen |= bit;
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
var patchSeq = 0, patchSnapAt = -1e9;
var pLive = [], pTKey = null, pTHead = null, pTMask = 0, pUf = null, pNext = null, pComp = null;
var deathPending = null, deathLocate = null, deathAlertAt = -1e9;
var explainClose = explainEl && explainEl.querySelector('.logo-explosion-explain-close');
var explainAck = explainEl && explainEl.querySelector('.logo-explosion-explain-ack');
var deathBtn = explainEl && explainEl.querySelector('.logo-explosion-explain-locate');
function makePatch(pid) {
  return (partie.patches[pid] = { alive: 0, deaths: [], alertedAt: -1e9, peak: 0, emptySince: null });
}
export function resetPatches() { partie.patches = {}; patchSeq = 0; patchSnapAt = -1e9; deathPending = null; }
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
  for (i = 0; i < monde.colonised.length; i++) { c = monde.colonised[i]; if (c.myc > 0 && !c.deadMyc) pLive.push(c); }
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
    if (best && !claimed[best] && partie.patches[best]) comp.pid = best;
    else { comp.pid = ++patchSeq; makePatch(comp.pid); } // scission (ou 1re fois) : historique vide
    claimed[comp.pid] = true;
  }
  // Fusion : les pid perdants, reclames par personne, sont absorbes par le gagnant.
  for (k = 0; k < comps.length; k++) {
    comp = comps[k];
    compEach(comp, function (v, pid) {
      if (pid === comp.pid || claimed[pid] || remap[pid] || !partie.patches[pid]) return;
      var w = partie.patches[comp.pid], l = partie.patches[pid];
      w.deaths = w.deaths.concat(l.deaths);
      w.peak += l.peak;
      w.alertedAt = Math.max(w.alertedAt, l.alertedAt);
      remap[pid] = comp.pid;
      delete partie.patches[pid];
    });
  }
  for (pid0 in partie.patches) partie.patches[pid0].alive = 0;
  for (i = 0; i < n; i++) {
    c = pLive[i];
    if (c.settled) c.pid = comps[pComp[ufFind(i)]].pid;
    else if (c.pid && remap[c.pid]) c.pid = remap[c.pid];
    if (!c.pid) continue;
    (partie.patches[c.pid] || makePatch(c.pid)).alive++;
  }
  for (pid0 in partie.patches) {
    var p = partie.patches[pid0];
    if (p.alive > p.peak) p.peak = p.alive;
    while (p.deaths.length && now - p.deaths[0].t > PATCH_WINDOW_MS) p.deaths.shift();
    if (p.alive > 0) p.emptySince = null;
    else if (p.emptySince === null) p.emptySince = now; // gardé PATCH_WINDOW_MS : "tout le patch est mort" peut encore partir
    else if (now - p.emptySince > PATCH_WINDOW_MS) delete partie.patches[pid0];
  }
}
// Appelee AVANT le splice de la facette c. Seules les morts de faim/secheresse comptent au
// numerateur ; une mort aleatoire baisse juste l'effectif du patch.
function notePatchDeath(c, cause) {
  var p = c.pid && partie.patches[c.pid];
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
  if (!explainEl || !explainText || msgBlocked(t) || t - deathAlertAt < DEATH_ALERT_GAP_MS || partie.DEMO || guideCurrent()) return;
  if (explainEl.classList.contains('is-visible')) return; // jamais empile
  var d = deathPending;
  deathPending = null;
  deathAlertAt = t;
  showExplain(DEATH_TEXTS[d.cause], { x: d.x, y: d.y });
}
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
  if (partie.factShown < 0) return;
  if (interrupted && performance.now() - factShownAt < 5000) partie.factSeen &= ~(1 << partie.factShown);
  partie.factShown = -1;
  setCard(factEl, false);
}
function showFact(i) {
  var t = performance.now();
  partie.factShown = i; factShownAt = t; factAt = t;
  partie.factSeen |= 1 << i;
  factText.textContent = FACTS[i].text;
  setCard(factEl, true);
  factTimer = setTimeout(function () { hideFact(false); }, FACT_MS);
  savePlayerIfChanged();
}
// Appele au plus une fois par seconde depuis step() : choisit un saviez-vous a afficher.
function msgTick() {
  var t = performance.now();
  if (t - msgTickAt < 1000) return;
  msgTickAt = t;
  if (weather.raining) { if (rainSince === null) { rainSince = t; rainCount++; } } else rainSince = null;
  challengeTick(t);
  if (!factEl || partie.factShown >= 0 || msgBlocked(t) || partie.DEMO || guideCurrent()) return;
  if ((explainEl && explainEl.classList.contains('is-visible')) || t - explainEndAt < FACT_AFTER_EXPLAIN_MS) return;
  var slow = t - partie.explodedAt >= FACT_FIRST_MS && t - factAt >= FACT_GAP_MS; // delais normaux ; les faits "now" les ignorent
  for (var i = 0; i < FACTS.length; i++) {
    if (!(partie.factSeen & (1 << i)) && (slow || FACTS[i].now) && FACTS[i].when()) { showFact(i); return; }
  }
}

// Defis : 11 objectifs apres les tresors, coches une seule fois et sauves avec le joueur
// (chDone = bitmask, chPlanted = arbres plantes par le joueur). Verifies a 1 Hz depuis
// msgTick ; l'annonce (setCaption) attend qu'aucun message/infobulle ne soit affiche.
// ATTENTION : ne jamais reordonner ni inserer au milieu : les bits (chDone) sont sauvegardes.
// Ajouter les nouveaux defis en fin de tableau seulement. unlocked() : condition d'affichage
// ET de validation (un defi ne se coche que s'il est debloque).
export var CHALLENGES = [
  { label: 'Arracher une branche à la main', unlocked: function () { return chIsDone(2); } },   // apres la maturite d'un arbre
  { label: 'Planter 8 arbres', unlocked: function () { return true; }, progress: function () { return Math.min(partie.chPlanted, CH_TREES_GOAL) + '/' + CH_TREES_GOAL; } },
  { label: 'Voir un arbre atteindre sa pleine maturité', unlocked: function () { return partie.chPlanted >= 1; } },
  { label: 'Avoir 3 souches de mycélium vivantes', unlocked: function () { return chIsDone(5); }, progress: function () { return chStrainsOk + '/' + CH_STRAINS_GOAL; } },
  { label: 'Réunir arbre, mycélium et gazon vivants', unlocked: function () { return chIsDone(2); } },
  { label: 'Coloniser 10 % du monde', unlocked: function () { return true; }, progress: function () { return Math.round(chPctNow * 100) + ' %'; } },
  { label: 'Coloniser 25 % du monde', unlocked: function () { return chIsDone(5); }, progress: function () { return Math.round(chPctNow * 100) + ' %'; } },
  { label: 'Coloniser 50 % du monde', unlocked: function () { return chIsDone(6); }, progress: function () { return Math.round(chPctNow * 100) + ' %'; } },
  { label: 'Récolter 10 strophaires', unlocked: function () { return true; }, progress: function () { return Math.min(partie.chHarv[0], CH_HARVEST_GOAL) + '/' + CH_HARVEST_GOAL; }, gift: true },
  { label: 'Récolter 10 pleurotes', unlocked: function () { return chIsDone(8); }, progress: function () { return Math.min(partie.chHarv[1], CH_HARVEST_GOAL) + '/' + CH_HARVEST_GOAL; }, gift: true },
  { label: 'Récolter 10 hydnes', unlocked: function () { return chIsDone(9); }, progress: function () { return Math.min(partie.chHarv[2], CH_HARVEST_GOAL) + '/' + CH_HARVEST_GOAL; }, gift: true },
  { label: 'Attraper un papillon', unlocked: function () { return true; } }   // a la main ; sans recompense
];
function chIsDone(k) { return !!(partie.chDone & (1 << k)); }
var chPctNow = 0, chStrainsOk = 0;      // valeurs courantes affichees dans la progression (mises a jour a 1 Hz)
var chBadgeEl = document.getElementById('logo-explosion-challenges');
var chListEl = null, chHeadEl = null, chDoneListEl = null, chDoneHeadEl = null;
function chCount() { var n = 0; for (var i = 0; i < CHALLENGES.length; i++) if (partie.chDone & (1 << i)) n++; return n; }
export function challengeDone(i) {
  if (partie.DEMO || partie.chDone & (1 << i)) return;
  partie.chDone |= 1 << i;
  if (CHALLENGES[i].gift) partie.freeTrees++;
  partie.chPending.push(i);
  updateChallengeUI();
  savePlayerIfChanged();
}
function chUnlocked(i) { return CHALLENGES[i].unlocked(); }
export function updateChallengeUI() {
  // N'ecrit dans le DOM que si la valeur change : ce tick a 1 Hz faisait clignoter la liste au survol.
  var head = 'Défis ' + chCount() + '/' + CHALLENGES.length;
  if (chHeadEl && chHeadEl.textContent !== head) chHeadEl.textContent = head;
  if (!chListEl) return;
  var shown = 0;
  for (var i = 0; i < chListEl.children.length; i++) {
    var li = chListEl.children[i];
    var vis = !(partie.chDone & (1 << i)) && chUnlocked(i) && shown < CH_MAX_SHOWN;
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
    for (i = 0; i < CHALLENGES.length; i++) if (partie.chDone & (1 << i)) { doneKey += i + ','; dn++; }
    if (chDoneListEl.dataset.key !== doneKey) {
      chDoneListEl.dataset.key = doneKey;
      chDoneListEl.textContent = '';
      for (i = 0; i < CHALLENGES.length; i++) if (partie.chDone & (1 << i)) {
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
function challengeTick(t) {
  if (partie.mode !== 'exploded') return;
  var i, j, c, all = CHALLENGES.length;
  updateChallengeUI(); // deblocage progressif (arbres plantes...), 1 fois par seconde
  if (partie.chPending.length && !msgBlocked(t)) {
    var k = partie.chPending.shift();
    var gift = CHALLENGES[k].gift ? ' — un arbre offert !' : '';
    setCaption(chCount() >= all && !partie.chPending.length ? 'Tous les défis sont réussis, bravo !' + gift : 'Défi réussi : ' + CHALLENGES[k].label + gift);
  }
  if (partie.chDone === (1 << all) - 1) return;
  if (!(partie.chDone & 2) && chUnlocked(1) && partie.chPlanted >= CH_TREES_GOAL) challengeDone(1);
  if (!(partie.chDone & 4) && chUnlocked(2)) {
    for (i = 0; i < monde.trees.length; i++) {
      if (monde.trees[i].growth < 1) monde.trees[i].seenGrowing = true;
      else if (monde.trees[i].seenGrowing) { challengeDone(2); break; }
    }
  }
  var need = false; // rien a verifier si les defis 3 a 7 sont faits ou verrouilles
  for (i = 3; i <= 7; i++) if (!(partie.chDone & (1 << i)) && chUnlocked(i)) { need = true; break; }
  if (!need) return;
  var bio = {}, cols = {}, nCols = monde.heights.length - 1, nAlive = 0, live = [];
  for (i = 0; i < monde.colonised.length; i++) {
    c = monde.colonised[i];
    if (!(c.myc > MYC_READY) || c.deadMyc) continue;
    live.push(c);
    var sid = c.strain || 'standard';
    bio[sid] = (bio[sid] || 0) + c.myc;
    cols[Math.max(0, Math.min(nCols - 1, Math.floor(c.x / COL_W)))] = 1;
  }
  if (!(partie.chDone & 8) && chUnlocked(3)) {
    var ok = 0;
    for (var id in bio) if (bio[id] >= CH_STRAIN_BIOMASS) ok++;
    chStrainsOk = ok;
    if (ok >= CH_STRAINS_GOAL) challengeDone(3);
  }
  if (!(partie.chDone & 16) && chUnlocked(4) && live.length && monde.trees.length) {
    var reach = vue.UW * CH_ZONE_REACH, cr = Math.ceil(reach / COL_W);
    for (i = 0; i < monde.trees.length; i++) {
      var hasMyc = false, hasGrass = false, tc = Math.floor(monde.trees[i].x / COL_W);
      for (j = 0; j < live.length; j++) if (Math.abs(live[j].x - monde.trees[i].x) < reach) { hasMyc = true; break; }
      if (!hasMyc) continue;
      for (j = Math.max(0, tc - cr); j <= Math.min(monde.grassCover.length - 1, tc + cr); j++) if (monde.grassCover[j] > 0.5) { hasGrass = true; break; }
      if (hasGrass) { challengeDone(4); break; }
    }
  }
  for (var key in cols) nAlive++;
  var pct = nCols > 0 ? nAlive / nCols : 0;
  chPctNow = pct;
  for (i = 0; i < 3; i++) {
    if ((partie.chDone & (32 << i)) || !chUnlocked(5 + i)) { partie.chHoldSince[i] = 0; continue; }
    if (pct >= CH_COLONY_PCT[i]) {
      if (!partie.chHoldSince[i]) partie.chHoldSince[i] = t;
      else if (t - partie.chHoldSince[i] >= CH_COLONY_HOLD_MS) challengeDone(5 + i);
    } else partie.chHoldSince[i] = 0;
  }
}
function hideMsgs() { hideExplain(); hideFact(true); }
export function setCaption(text, keepFact, sticky) {
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

// --- Tutoriel guide : fleche d'invite pilotee par une table d'etapes --------------------------
// L'etape courante est la premiere de GUIDE dont done() est faux ; la fleche, le halo et les
// messages la lisent. Ajouter une etape = ajouter une ligne. Champs : done() ; target(cr) ->
// {x,y} en px du conteneur ; dir = cote de la fleche par rapport a sa cible (right/left/up/down) ;
// magnet = la fleche se penche vers le curseur ; halo = halo au pied des arbres matures ;
// msg = legende affichee une fois a l'entree dans l'etape. Les drapeaux d'avancement sont
// gardes en localStorage : au retour, le tutoriel reprend ou on s'etait arrete.
var guideLastId = null, guideMsgShown = {}, guideStickyText = null;
export var guideFlags = { tools: false, myc: false, strain: false, poured: false, hand: false, fed: false, harvest: false };
export function guideSet(flag) {
  if (guideFlags[flag]) return;
  guideFlags[flag] = true;
  try { localStorage.setItem(GUIDE_KEY, JSON.stringify(guideFlags)); } catch (e) { /* ignore */ }
}
// Remise a zero du tutoriel (reset du jeu) : drapeaux, sauvegarde, messages deja montres.
export function guideReset() {
  for (var k in guideFlags) guideFlags[k] = false;
  partie.mycFedOnce = false;
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
function guideOff(sx) { return sx < 40 / vue.ZOOM ? -1 : sx > vue.W - 40 / vue.ZOOM ? 1 : 0; }
function guideTreeTarget(cr) {
  var list = matureTrees(), best = null, bd = Infinity, i;
  for (i = 0; i < list.length; i++) {
    var d = Math.abs(list[i].x - (vue.camX + vue.W / 2));
    if (d < bd) { bd = d; best = list[i]; }
  }
  if (!best) return null;
  return { x: clamp(best.x - vue.camX, 40 / vue.ZOOM, vue.W - 40 / vue.ZOOM) * cr.width / vue.W, y: clamp(surfaceAt(best.x) - vue.camY - 12, 90 / vue.ZOOM, vue.H - 20 / vue.ZOOM) * cr.height / vue.H, off: guideOff(best.x - vue.camX) };
}
function guideCanopyTarget(cr) {
  var list = matureTrees(), best = null, bd = Infinity, i;
  if (!list.length) list = monde.trees;
  for (i = 0; i < list.length; i++) {
    var d = Math.abs(list[i].x - (vue.camX + vue.W / 2));
    if (d < bd) { bd = d; best = list[i]; }
  }
  if (!best) return null;
  var tg = treeScale(best), by = best.by !== undefined ? best.by : surfaceAt(best.x) + TREE_EMBED;
  return { x: clamp(best.x - vue.camX, 40 / vue.ZOOM, vue.W - 40 / vue.ZOOM) * cr.width / vue.W, y: clamp(by - best.h * tg - vue.camY, 90 / vue.ZOOM, vue.H - 20 / vue.ZOOM) * cr.height / vue.H, off: guideOff(best.x - vue.camX) };
}
// Centre du mycelium vivant (la ou deposer le bois), ou null s'il n'y en a pas.
function guideMycTarget(cr) {
  var n = 0, mx = 0, my = 0;
  for (var i = 0; i < monde.colonised.length; i++) if (monde.colonised[i].myc > 0) { n++; mx += monde.colonised[i].x; my += monde.colonised[i].y; }
  if (!n) return null;
  mx /= n; my /= n;
  return { x: clamp(mx - vue.camX, 40 / vue.ZOOM, vue.W - 40 / vue.ZOOM) * cr.width / vue.W, y: clamp(my - vue.camY - 10, 90 / vue.ZOOM, vue.H - 20 / vue.ZOOM) * cr.height / vue.H, off: guideOff(mx - vue.camX) };
}
// Le bois est en main : on pointe le mycelium ; lache au mauvais endroit, on repointe l'arbre.
function guideLeavesTarget(cr) {
  return (vue.handCarry.length && guideMycTarget(cr)) || guideCanopyTarget(cr);
}
function guideLeavesHint() {
  return vue.handCarry.length ? CAPTION_MYC_DROP : CAPTION_MYC_LEAVES;
}
// Champignon mur issu du mycelium le plus proche du centre de l'ecran, ou null.
function guideMushroomTarget(cr) {
  var best = null, bd = Infinity, i;
  for (i = 0; i < monde.mushrooms.length; i++) {
    var m = monde.mushrooms[i];
    if (!m.myc || m.treasure || m.dying || m.t < 0.9) continue;
    var d = Math.abs(m.x - (vue.camX + vue.W / 2));
    if (d < bd) { bd = d; best = m; }
  }
  if (!best) return guideMycTarget(cr);
  return { x: clamp(best.x - vue.camX, 40 / vue.ZOOM, vue.W - 40 / vue.ZOOM) * cr.width / vue.W, y: clamp(surfaceAt(best.x) - best.size * 0.8 - vue.camY, 90 / vue.ZOOM, vue.H - 20 / vue.ZOOM) * cr.height / vue.H, off: guideOff(best.x - vue.camX) };
}
function guideTreeHint() {
  if (matureTrees().length) return null;
  return monde.trees.length ? CAPTION_MYC_TREE_WAIT : CAPTION_MYC_TREE_NONE;
}
function livingMyc() {
  for (var i = 0; i < monde.colonised.length; i++) if (monde.colonised[i].myc > 0) return true;
  return false;
}
function guideHarvestHint() {
  if (!livingMyc() && !monde.mushrooms.some(function (m) { return m.myc && !m.treasure && !m.dying && m.t >= 0.9; })) return CAPTION_MYC_REPOUR;
  return monde.mushrooms.some(function (m) { return m.myc && !m.treasure && !m.dying && m.t >= 0.9; }) ? CAPTION_MYC_HARVEST : CAPTION_MYC_GROW;
}
var GUIDE = [
  { id: 'tools', done: function () { return guideFlags.tools; }, magnet: true,
    target: guideElTarget(function () { return toolsBar; }) },
  { id: 'myc', done: function () { return guideFlags.myc && partie.unlockedStrains.length > 0; }, dir: 'right',
    target: guideElTarget(function () { return toolsBar.querySelector('[data-tool="mycelium"]'); }) },
  { id: 'strain', done: function () { return partie.DEMO || guideFlags.strain || guideFlags.poured; }, dir: 'down', // demo : une seule souche, menu cache
    target: guideElTarget(function () { return strainsBar && (strainsBar.querySelector('[data-strain="' + partie.bagStrain + '"]') || strainsBar.querySelector('[data-strain]')); }) },
  { id: 'tree', done: function () { return guideFlags.poured && (guideFlags.fed || livingMyc()); }, dir: 'up', magnet: true, halo: 'tree', hint: guideTreeHint,
    target: guideTreeTarget, msg: function () { return CAPTION_MYC_PLACE; } },
  { id: 'hand', done: function () { return guideFlags.hand; }, dir: 'right', hint: CAPTION_MYC_HAND,
    target: guideElTarget(function () { return toolsBar.querySelector('[data-tool="hand"]'); }) },
  { id: 'leaves', done: function () { return guideFlags.fed; }, dir: 'right', magnet: true, fadeNear: true, hint: guideLeavesHint,
    target: guideLeavesTarget },
  { id: 'harvest', done: function () { return guideFlags.harvest; }, dir: 'up', magnet: true, fadeNear: true, hint: guideHarvestHint,
    target: guideMushroomTarget }
];
export function guideCurrent() {
  for (var i = 0; i < GUIDE.length; i++) if (!GUIDE[i].done()) return GUIDE[i];
  return null;
}
var mycNextDeathCheck = 0;
var mycBusyUntil = 0;
export function updateMoneyUI() {
  if (partie.moneyRevealed && moneyEl) moneyEl.classList.remove('d-none');
  if (moneyVal) moneyVal.textContent = partie.money;
}
function earn(amount) {
  // En demo l'argent est cache (mycelium gratuit, voir ensureBag) mais s'accumule en
  // silence : le joueur le retrouve quand le jeu complet se debloque.
  partie.money += amount;
  if (!partie.DEMO && window.sporaSfx) sporaSfx.play('coin'); 
  partie.moneyRevealed = true;
  updateMoneyUI();
  savePlayerIfChanged();
}
// Assure qu'un sac est pret a verser : offre le tout premier, sinon facture BAG_COST
// si les fonds le permettent. Retourne false (et ne change rien) si on ne peut pas payer.
function ensureBag() {
  if (partie.bagGrainsLeft > 0) return true;
  if (partie.DEMO || !partie.usedFreeBag) { partie.usedFreeBag = true; partie.bagGrainsLeft = BAG_GRAINS; return true; }
  if (partie.money < BAG_COST) return false;
  partie.money -= BAG_COST;
  partie.bagGrainsLeft = BAG_GRAINS;
  updateMoneyUI();
  return true;
}
var lastRealNow = null;
export function nextTreeCost() {
  var planted = 0;
  for (var i = 0; i < monde.trees.length; i++) if (monde.trees[i].planted) planted++;
  return Math.min(planted, TREE_COST_MAX_MULT) * TREE_COST_STEP;
}
var slowTimer = null;
var treasuresFound = 0;                 // tresors deterres depuis la derniere explosion (repart a 0 au rebuild)
export var strainById = { standard: STRAIN_STD };
export var strainOrder = [STRAIN_STD];         // ordre du menu : standard, puis dans l'ordre des tresors
var mycTipShown = false;
var speciesIdx = 0;
var rebuildT = 0;
var paused = false, wasRunningBeforeHide = false; // en pause : hors viewport ou onglet cache
function tintCol(hex, strain) { return strain ? rgbStr(mixRgb(hexToRgb(hex), strain.tintRgb, STRAIN_MIX).map(Math.round)) : hex; }
function currentStrain() { return strainById[partie.bagStrain] || STRAIN_STD; }

// --- Physique ----------------------------------------------------------------------
function explode(px, py) {
  monde.grassTipFrom = performance.now() + 8000;
  if (window.sporaSfx) sporaSfx.play('thud'); 
  fallbackImg.classList.add('d-none');
  canvas.classList.remove('d-none');
  partie.mode = 'exploded';
  partie.explodedAt = performance.now();
  for (var i = 0; i < monde.shards.length; i++) {
    var s = monde.shards[i];
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
  if (treasureCountEl && partie.treasureDefs.length && partie.debugBuilt) treasureCountEl.classList.remove('d-none');
  if (scrollLeftBtn) scrollLeftBtn.classList.remove('d-none');
  if (scrollRightBtn) scrollRightBtn.classList.remove('d-none');
  if (scrollUpBtn) scrollUpBtn.classList.remove('d-none');
  if (scrollDownBtn) scrollDownBtn.classList.remove('d-none');
  setupTreasures();
  // Un arbre visible a gauche du logo, un autre plus loin a droite dans le monde.
  var savedTrees = null;
  try { if (partie.restoredTrees) savedTrees = makeSavedTrees(partie.restoredTrees); } catch (e) { savedTrees = null; }
  partie.restoredTrees = null;
  monde.trees = savedTrees && savedTrees.length ? savedTrees : [makeTree(vue.camMargin + vue.W * 0.14), makeStartTree(vue.camMargin + vue.W * 0.93, 10), makeTree(vue.camMargin + vue.W * 1.35)];
  if (savedTrees && savedTrees.length) partie.worldSig = partie.worldSigPrev = terrainSig();
  monde.litter = [];
  if (toolsArrow && partie.unlockedStrains.length) toolsArrow.classList.remove('d-none');
  startLoop();
}

// Vitesse de defilement selon la position ecran du curseur : nulle au centre, augmente
// en approchant des CAMERA_EDGE derniers % de chaque bord de la boite.
function cameraSpeed(screenX) {
  var edge = vue.W * (vue.edgeTouch ? CAMERA_EDGE_TOUCH : CAMERA_EDGE);
  if (screenX < edge) {
    var k = 1 - screenX / edge;
    return -CAMERA_MAX * k * k;
  }
  if (screenX > vue.W - edge) {
    var k2 = 1 - (vue.W - screenX) / edge;
    return CAMERA_MAX * k2 * k2;
  }
  return 0;
}

// Meme logique, axe vertical : pres du haut de la boite ca remonte (camY vers 0), pres
// du bas ca descend (camY vers worldH - H, plus profond).
function cameraSpeedY(screenY) {
  var edge = vue.H * (vue.edgeTouch ? CAMERA_EDGE_TOUCH : CAMERA_EDGE);
  var y = Math.max(0, screenY - CAMERA_TOP_DEADZONE / vue.ZOOM); // la zone cachee par le header est en px CSS
  if (y < edge) {
    var k = 1 - y / edge;
    return -CAMERA_MAX_Y * k * k;
  }
  // Le bas de la boite peut depasser l'ecran (100vh sur mobile, barre du navigateur) : la
  // zone part du bas VISIBLE, sinon le doigt ne l'atteint presque pas.
  var bottom = vue.edgeTouch ? Math.min(vue.H, (window.innerHeight - canvas.getBoundingClientRect().top) / vue.ZOOM) : vue.H;
  if (screenY > bottom - edge) {
    var k2 = Math.min(1, 1 - (bottom - screenY) / edge);
    return CAMERA_MAX_Y * k2 * k2;
  }
  return 0;
}

function step() {
  var camMoving = false;
  if (partie.mode === 'exploded') {
    // La souris ne bouge pas forcement pendant qu'on defile : on garde sa derniere
    // position ecran connue et on la reconvertit en coord. monde a chaque frame, pour
    // que la pelle reste sous le curseur meme quand le monde glisse dessous.
    if (vue.hoverScreenX !== null) {
      if (!shovel.released) { // pelle lachee : elle verse sur place, elle ne suit plus
        shovel.gx = vue.hoverScreenX + vue.camX;
        shovel.gy = vue.hoverScreenY + vue.camY;
      }
      bag.x = hand.x = vue.hoverScreenX + vue.camX;
      bag.y = hand.y = vue.hoverScreenY + vue.camY;
    }
    // Demo : le monde tient dans l'ecran, aucun defilement horizontal (bords, fleches, glissement).
    var camV = partie.DEMO ? 0 : vue.mobileArrow ? vue.mobileArrow * CAMERA_MAX : (vue.hoverScreenX !== null ? cameraSpeed(vue.hoverScreenX) : 0);
    if (camV) {
      var newCamX = clamp(vue.camX + camV, 0, vue.worldW - vue.W);
      if (newCamX !== vue.camX) camMoving = true;
      vue.camX = newCamX;
    }
    if (vue.camGoal) { // glissement vers une alerte ; tout defilement manuel l'annule
      if (partie.DEMO) vue.camGoal.x = vue.camX;
      if (camV || vue.mobileArrowY) vue.camGoal = null;
      else {
        var gdx = vue.camGoal.x - vue.camX, gdy = vue.camGoal.y - vue.camY;
        if (Math.abs(gdx) < 1 && Math.abs(gdy) < 1) { vue.camX = vue.camGoal.x; vue.camY = vue.camGoal.y; vue.camGoal = null; }
        else { vue.camX += gdx * 0.12; vue.camY += gdy * 0.12; }
        camMoving = true;
      }
    }
    flushDeathAlert();
    var camVY = vue.mobileArrowY ? vue.mobileArrowY * CAMERA_MAX_Y : (vue.hoverScreenY !== null ? cameraSpeedY(vue.hoverScreenY) : 0);
    if (camVY) {
      var newCamY = clamp(vue.camY + camVY, camMinY(), vue.worldH - vue.H);
      if (newCamY !== vue.camY) camMoving = true;
      vue.camY = newCamY;
    }
  }
  // Tant que la pelle est a l'ecran ou que le monde defile, la boucle tourne.
  temps.frame++;
  var realNow = performance.now();
  if (lastRealNow === null) lastRealNow = realNow;
  // Plafonne le delta reel avant de l'accelerer : sinon un long moment sans frame (onglet
  // en arriere-plan, boucle a l'arret le temps qu'on interagisse de nouveau) ferait
  // exploser vTime d'un coup une fois multiplie par timeScale. 500ms passe large au-dessus
  // du tick de la boucle lente (slowTimer, 250ms) pour ne pas la ralentir artificiellement.
  temps.vTime += Math.min(realNow - lastRealNow, 500) * temps.timeScale;
  lastRealNow = realNow;
  var now = temps.vTime;
  var active = shovel.on || bag.on || camMoving || weather.raining || monde.drops.length > 0;
  if (bag.on) updateBag();
  if (hand.on && updateHand(now)) active = true;
  if (partie.mode === 'exploded') { updateWeather(now); msgTick(); }
  updateRainDrops(now);
  if (shovel.on) {
    updateShovel();
    if (shovel.on) bowlWakePile(cutCompact()); // updateShovel peut la ranger (fin de versement au doigt)
  }
  // Balayage lent, quel que soit l'outil : une facette posee dont le sol a baisse (lessivage,
  // effondrement, pluie...) sans passer par la pelle ou le poing retombe quand meme.
  if (partie.mode === 'exploded' && temps.frame % 30 === 0) {
    for (var j = 0; j < monde.shards.length; j++) {
      var sj = monde.shards[j];
      if (sj.settled && sj.kcol &&sj.y < surfaceAt(sj.x) - 6) { pileRemove(sj); sj.settled = false; }
    }
  }
  var anyDead = false;
  for (var i = 0; i < monde.shards.length; i++) {
    var s = monde.shards[i];
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
      driftScale = temps.timeScale;
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
    if (s.x > vue.worldW - 4) { s.x = vue.worldW - 4; s.vx = -Math.abs(s.vx) * 0.4; }
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
          if (monde.litter.indexOf(s) < 0) monde.litter.push(s);
        } else s.mix = 1;
        s.col = restColumn(s.x);
        s.x = (s.col + Math.random() - 0.5) * COL_W;
        s.y = monde.compactY[s.col] - monde.heights[s.col];
        pileAdd(s);
      }
    }
  }
  if (partie.mode === 'exploded') {
    var tl = stepTrees(now);
    var gl = updateGrass(now);
    monde.treeLife = tl > 0 || gl > 0;
    if (tl === 2) active = true;
    if (stepFlowers(now)) active = true;
    if (stepInsects(realNow)) active = true;
  }
  if (anyDead) monde.shards = monde.shards.filter(function (g) { return !g.dead; });
  if (partie.mode === 'exploded' && monde.colonised.length && stepMycelium(now)) active = true;
  if (monde.soilRiseT < 1) {
    monde.soilRiseT = Math.min(1, monde.soilRiseT + 1 / SOIL_RISE_FRAMES);
    active = true;
  }
  // Un champignon sorti du mycelium (pas plante a la main) fane si plus aucun mycelium
  // bien vivant n'est a portee pendant un moment : il ne peut pas survivre sans le
  // reseau qui l'a fait fructifier.
  var mycNearReach = vue.U * FRUIT_W;
  for (i = 0; i < monde.mushrooms.length; i++) {
    var mm = monde.mushrooms[i];
    if (!mm.myc || mm.dying || mm.treasure) continue;
    var nearMyc = false;
    for (var ci = 0; ci < monde.colonised.length; ci++) {
      if (monde.colonised[ci].myc > MYC_READY && Math.abs(monde.colonised[ci].x - mm.x) < mycNearReach) { nearMyc = true; break; }
    }
    if (nearMyc) mm.lastMycNear = now;
    else if (now - mm.lastMycNear > MUSHROOM_STARVE_MS) mm.dying = true;
  }
  for (i = 0; i < monde.mushrooms.length; i++) {
    var m = monde.mushrooms[i];
    if (m.dying) { m.t -= 0.06; active = true; }
    else if (m.t < 1) { m.t = Math.min(1, m.t + 0.025); active = true; }
  }
  monde.mushrooms = monde.mushrooms.filter(function (m) { return !(m.dying && m.t <= 0); });
  if (partie.goldBits.length && stepGoldBits()) active = true;
  // Un tresor enfoui est deterre d'office quand le fond du trou l'atteint (pas besoin de
  // "coups" en plus : sinon on pouvait creuser jusqu'a lui sans que rien ne se passe).
  if (partie.mode === 'exploded') {
    for (i = 0; i < partie.treasures.length; i++) {
      var tr = partie.treasures[i];
      if (tr.deep && !tr.revealed && tr.ready && surfaceAt(tr.x) >= tr.y - 12) { reveal(tr); active = true; }
    }
  }
  return active;
}

export function startLoop() {
  if (paused) return; // hors viewport ou onglet cache : rien ne doit programmer de frame
  if (vue.rafId !== null) return;
  if (slowTimer !== null) { clearTimeout(slowTimer); slowTimer = null; }
  vue.rafId = requestAnimationFrame(function tick() {
    var active = partie.mode === 'rebuilding' ? stepRebuild() : step();
    if (partie.mode !== 'assembled') draw();
    if (active) { vue.rafId = requestAnimationFrame(tick); return; }
    vue.rafId = null;
    // Il ne reste que des feuilles qui vieillissent, ou juste le cycle meteo (pluie
    // naturelle) a surveiller pour son prochain changement d'etat : 4 images/s suffisent.
    if (partie.mode === 'exploded' && (monde.treeLife || temps.rainLevel > 0)) {
      slowTimer = setTimeout(function () { slowTimer = null; startLoop(); }, 250);
    }
  });
}
var shovel = {
  on: false, held: false, pouring: false, hideWhenEmpty: false, released: false,
  gx: 0, gy: 0,                         // curseur
  cx: 0, cy: 0, pcx: 0, pcy: 0,         // centre du cercle du bol, et a la frame precedente
  tilt: 0, ptilt: 0, face: 1            // face : 1 = dernier geste vers la droite, -1 = gauche
};

function bowlR() { return vue.U * BLADE_WIDTH / 2 / Math.sin(BOWL_SPAN); }
function loadDepth() { return vue.U * 0.04; } // hauteur de terre que la lame peut porter

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
  var c0 = Math.max(0, Math.floor((shovel.cx - Rc) / COL_W)), c1 = Math.min(monde.heights.length - 1, Math.ceil((shovel.cx + Rc) / COL_W));
  for (var c = c0; c <= c1; c++) {
    var bo = bladeOuterY(c * COL_W, shovel.cx, shovel.cy, shovel.tilt, Rc);
    if (bo) pen = Math.max(pen, bo.y - monde.compactY[c]);
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
function plantedX() {
  if (shovelPlant.x === null) shovelPlant.x = vue.camMargin + vue.W * 0.68; // coord. monde : dans la vue de depart, pres du tas
  // Demo : la camera ne defile pas, la pelle plantee reste donc dans la vue (voir compassGo).
  return partie.DEMO ? clamp(shovelPlant.x, vue.camX + 30, vue.camX + vue.W - 30) : clamp(shovelPlant.x, 30, vue.worldW - 30);
}
// Repere de la pelle plantee : s le long du manche (vers le haut), k en travers.
function plantFrame() {
  var x = plantedX(), bw = vue.U * BLADE_WIDTH, bl = bw;
  return {
    x: x, sy: surfaceAt(x), bw: bw, bl: bl,
    ux: Math.sin(PLANT_LEAN), uy: -Math.cos(PLANT_LEAN), nx: Math.cos(PLANT_LEAN), ny: Math.sin(PLANT_LEAN),
    sock: bw / 58 * 34, shaft: vue.U * 0.13
  };
}
function plantPt(f, s, k) { return [f.x + f.ux * s + f.nx * k, f.sy + f.uy * s + f.ny * k]; }
// Zone de saisie genereuse (surtout au doigt) autour du manche et de la partie visible de la lame.
function shovelHit(x, y, touch) {
  if (shovel.on || partie.mode !== 'exploded') return false;
  var f = plantFrame(), r = touch ? Math.max(30, vue.U * 0.06) : Math.max(14, vue.U * 0.03);
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
  var c0 = Math.max(0, Math.floor((propCx - Rc) / COL_W)), c1 = Math.min(monde.heights.length - 1, Math.ceil((propCx + Rc) / COL_W));
  var penetration = 0;
  for (var c = c0; c <= c1; c++) {
    var bo = bladeOuterY(c * COL_W, propCx, propCy, shovel.tilt, Rc);
    if (bo) penetration = Math.max(penetration, bo.y - monde.compactY[c]);
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
  newBottomY = Math.min(newBottomY, vue.worldH - BEDROCK_MARGIN);
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
  var R = bowlR(), field = vue.U * BLADE_FIELD;
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
var compactDebt = 0;                    // aire de terre meuble encore due suite a une decompaction, reportee entre frames

// Decompacte la couche compacte la ou la lame mord dedans : chaque colonne entamee voit
// son compactY descendre, et de la terre meuble en sort en proportion (avec
// foisonnement) — pas forcement une facette par colonne par frame, une dette s'accumule
// et se resorbe au fil des frames suivantes (conservation en moyenne, pas facette par
// facette). Retourne les colonnes entamees cette frame (ou null), pour que
// bowlWakePile sache reveiller ce qui devient suspendu au-dessus.
function cutCompact() {
  var R = bowlR() + BOWL_T, cut = null;
  var c0 = Math.max(0, Math.floor((shovel.cx - R) / COL_W)), c1 = Math.min(monde.compactY.length - 1, Math.ceil((shovel.cx + R) / COL_W));
  for (var c = c0; c <= c1; c++) {
    if (monde.rocky[c] || demoGuard(c * COL_W)) continue; // roche-mere : la pelle ne l'entame jamais, buree ou non
    var bo = bladeOuterY(c * COL_W, shovel.cx, shovel.cy, shovel.tilt, R);
    if (!bo || bo.y <= monde.compactY[c]) continue;
    var newTop = Math.min(bo.y, vue.worldH - BEDROCK_MARGIN);
    var removed = newTop - monde.compactY[c];
    if (removed <= 0) continue;
    monde.compactY[c] = newTop;
    compactDebt += removed * COL_W * DECOMPACT_BULK;
    if (!cut) cut = {};
    cut[c] = bo.a;
    // De l'humus lessive jusque-la par la pluie (voir leach()) redevient accessible :
    // la pelle le rend a la surface, porte par une facette meuble neuve.
    for (var ni = monde.compactNutri.length - 1; ni >= 0; ni--) {
      var dep = monde.compactNutri[ni];
      if (Math.round(dep.x / COL_W) !== c || dep.y >= newTop) continue;
      monde.compactNutri.splice(ni, 1);
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
  var size = Math.max(6, vue.UW / 160) * 1.3 * sizeK;
  var pts = [[-size * 0.55, size * 0.32], [size * 0.55, size * 0.32], [(Math.random() - 0.5) * size * 0.3, -size * 0.55]];
  // Assombrie selon la profondeur sous le niveau d'origine, comme addSoilShard : la
  // terre qui sort du compact reste de la terre normale, pas la terre sombre d'avant.
  var depth = Math.min(1, Math.max(0, y - vue.groundY) / Math.max(1, vue.worldH - vue.groundY));
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
  if (nutri) { s.nutri = nutri; s.leachCount = MIN_LEACH_TO_EAT; s.nutriSince = temps.vTime - MYC_HOLD_MAX_MS; }
  s.px = s.x; s.py = s.y;
  monde.shards.push(s);
  return area;
}

// Reveille les facettes posees restees suspendues au-dessus du sol dans les colonnes
// dirtyCols (et leurs voisines) : elles retombent. Partage par la pelle et le poing.
function wakeSuspended(dirtyCols) {
  for (var j = 0; j < monde.shards.length; j++) {
    var sj = monde.shards[j];
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
  for (var i = 0; i < monde.shards.length; i++) {
    var s = monde.shards[i];
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
  for (i = 0; i < monde.mushrooms.length; i++) {
    var mu = monde.mushrooms[i];
    if (mu.treasure || mu.dying || mu.t < 0.5) continue;
    if (Math.abs(mu.x - shovel.cx) < R * Math.sin(BOWL_SPAN) + mu.size * 0.3) breakMushroom(mu);
  }
  // Deplacer de la terre au-dessus d'un tresor le deterre peu a peu.
  for (i = 0; i < partie.treasures.length; i++) {
    var t = partie.treasures[i];
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
    monde.shards.push({
      pts: pts, x: m.x + (Math.random() - 0.5) * m.size * 0.8, y: base - Math.random() * m.size * 0.9,
      vx: (Math.random() - 0.5) * 4, vy: -2 - Math.random() * 3, rot: 0, vr: (Math.random() - 0.5) * 0.4,
      from: color, to: color, mix: 1,
      area: triArea(pts), settled: false, col: -1, extra: true
    });
  }
}
function drawShovelShape(ax, ay, dir, ox, oy) {
  var S = vue.U * BLADE_WIDTH / 58, flip = Math.cos(dir) < 0;
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
  if (partie.mode !== "exploded") return;
  var f = plantFrame(), tip = plantPt(f, -f.bw * 0.5, 0); // pointe a moitie enterree
  ctx.save();
  ctx.beginPath();
  ctx.rect(f.x - f.bw * 3, f.sy - vue.U * 2, f.bw * 6, vue.U * 2);   // tout ce qui est sous la surface est cache
  ctx.clip();
  drawShovelShape(tip[0], tip[1], Math.atan2(f.uy, f.ux), SHOVEL_TIP[0], SHOVEL_TIP[1]);
  ctx.restore();
}

export function drawShovel() {
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
  var reach = hand.touch ? HAND_RING_R / vue.ZOOM : 0, best = null, bestD = reach;
  for (var i = 0; i < monde.mushrooms.length; i++) {
    var m = monde.mushrooms[i];
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
  partie.harvestCount++;
  var hs = m.strain && m.strain.id ? m.strain.id : 'standard', hi = CH_HARVEST_IDS.indexOf(hs);
  if (hi !== -1 && !(partie.chDone & (256 << hi)) && chUnlocked(8 + hi)) {
    partie.chHarv[hi]++;
    if (partie.chHarv[hi] >= CH_HARVEST_GOAL) challengeDone(8 + hi);
    else savePlayerIfChanged();
  }
  if (window.sporaSfx) sporaSfx.play('pop'); 
  earn(m.myc && m.strain && m.strain.price ? m.strain.price : MUSHROOM_PRICE);
}
export var hand = { x: 0, y: 0, on: false, fist: 0, tilt: 0, rot: 0, lx: 0, grip: null, px: 0, py: 0, pcx: 0, pcy: 0, touch: false, flash: 0 };
var fistDist = 0;                      // distance parcourue par le poing depuis le dernier coup

function enterHand(p) {
  hand.on = true;
  hand.x = hand.lx = hand.px = p.x; hand.y = hand.py = p.y;
  hand.pcx = vue.camX; hand.pcy = vue.camY;
  hand.fist = 0; hand.tilt = 0; hand.rot = 0;
  container.classList.add('is-tool-cursor');
}
// Ne laisse jamais rien de tenu ni d'agrippe derriere : les facettes tenues retombent,
// la branche agrippee revient droite (elle n'a pas casse).
function leaveHand() {
  dropHeldInsect();
  for (var i = 0; i < vue.handCarry.length; i++) vue.handCarry[i].carried = false;
  vue.handCarry = [];
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

export function leafAgeOf(lf, now) { return clamp((now - lf.born) / lf.life, 0, 1); }

// Tente d'agripper quelque chose sur un arbre, dans l'ordre : feuille (arrachee, tenue
// dans la main), puis branche (maitresse ou bonus : agrippee, elle casse si on tire assez,
// voir updateHand). Retourne vrai si la main a pris quelque chose.
function handGrabTree(pos) {
  var now = temps.vTime, ti, i, t, tg, by, top, sl, lf;
  var bestLeaf = null, bestLeafT = null, bestLeafD = Infinity;
  for (ti = 0; ti < monde.trees.length; ti++) {
    t = monde.trees[ti]; tg = treeScale(t);
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
    monde.shards.push(sh);
    vue.handCarry.push(sh);
    return true;
  }
  // Branches : segments coudes des branches maitresses (pas les cassees) et branches
  // bonus (du tronc vers leur bout). Le tronc lui-meme n'est pas attrapable.
  var bestObj = null, bestKind = '', bestTree = null, bestD = HAND_LIMB_TOL;
  for (ti = 0; ti < monde.trees.length; ti++) {
    t = monde.trees[ti]; tg = treeScale(t);
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
    monde.shards.push(makeLeafShard(sl.leaf, t.x + sl.dx * tg, top + sl.dy * tg, leafAgeOf(sl.leaf, now)));
    sl.leaf = null;
  }
  var sx = t.x, sy = top + t.h * tg * lm.f, ex = t.x + lm.dx * tg, ey = top + lm.dy * tg;
  var wood = makeWoodShard(hand.x, hand.y, branchTri(Math.hypot(ex - sx, ey - sy) * 0.5, Math.atan2(ey - sy, ex - sx)));
  monde.shards.push(wood);
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
  vue.handCarry.push(wood);
  partie.branchTorn = true;
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
  var goal = ((vue.pointerDown && partie.tool === 'hand') || vue.handCarry.length || hand.grip) ? 1 : 0;
  hand.fist += (goal - hand.fist) * 0.35;
  if (Math.abs(goal - hand.fist) < 0.02) hand.fist = goal; else busy = true;
  var tiltGoal = clamp((hand.x - hand.lx) * 0.05, -0.4, 0.4);
  hand.lx = hand.x;
  hand.tilt += (tiltGoal - hand.tilt) * 0.2;
  if (Math.abs(tiltGoal - hand.tilt) > 0.005 || Math.abs(hand.tilt) > 0.01) busy = true;
  // Vitesse reelle du geste (monde, camera deduite), puis effleurement des facettes.
  var hvx = hand.x - hand.px - (vue.camX - hand.pcx), hvy = hand.y - hand.py - (vue.camY - hand.pcy);
  hand.px = hand.x; hand.py = hand.y; hand.pcx = vue.camX; hand.pcy = vue.camY;
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
  if (partie.mode === 'exploded' && vue.pointerDown && sp2 >= HAND_PUSH_MIN_V * HAND_PUSH_MIN_V) {
    handPush(hvx, hvy);
    busy = true;
  }
  // Poing : bouton enfonce et main en mouvement, meme avec quelque chose en main (les facettes
  // tenues sont ignorees par fistStrike).
  if (partie.mode === 'exploded' && vue.pointerDown && partie.tool === 'hand') {
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
  var R = HAND_FIST_R, limit = vue.worldH - BEDROCK_MARGIN, i, c;
  // (0) Feuilles encore accrochees aux arbres : le poing les fait sauter, elles tombent
  // (memes facettes que la chute naturelle, voir makeLeafShard) en emportant un peu du coup.
  var nowF = temps.vTime, ti, tF, tgF, topF, slF;
  for (ti = 0; ti < monde.trees.length; ti++) {
    tF = monde.trees[ti]; tgF = treeScale(tF);
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
      monde.shards.push(shF);
      slF.leaf = null; // la place redevient libre, l'arbre en repoussera une autre
    }
  }
  // (1) Terre meuble posee a portee : delogee, projetee dans le sens du geste.
  var loose = 0, cut = null;
  for (i = 0; i < monde.shards.length && loose < HAND_FIST_LOOSE; i++) {
    var s = monde.shards[i];
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
  var c0 = Math.max(0, Math.floor((hand.x - R) / COL_W)), c1 = Math.min(monde.compactY.length - 1, Math.ceil((hand.x + R) / COL_W));
  var dug = false;
  for (c = c0; c <= c1; c++) {
    if (monde.rocky[c] || demoGuard(c * COL_W)) continue; // roche-mere : le poing ne l'entame pas plus que la pelle
    var ddx = c * COL_W - hand.x;
    if (ddx > R || ddx < -R) continue;
    var bottom = hand.y + Math.sqrt(R * R - ddx * ddx);
    if (bottom <= monde.compactY[c]) continue;
    var newTop = Math.min(bottom, monde.compactY[c] + HAND_FIST_DEPTH, limit);
    var removed = newTop - monde.compactY[c];
    if (removed <= 0) continue;
    monde.compactY[c] = newTop;
    compactDebt += removed * COL_W * DECOMPACT_BULK;
    dug = true;
    if (!cut) cut = {};
    cut[c] = true;
    // Humus lessive redevenu accessible : rendu a la surface, comme la pelle.
    for (var ni = monde.compactNutri.length - 1; ni >= 0; ni--) {
      var dep = monde.compactNutri[ni];
      if (Math.round(dep.x / COL_W) !== c || dep.y >= newTop) continue;
      monde.compactNutri.splice(ni, 1);
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
    for (i = 0; i < monde.mushrooms.length; i++) {
      var mu = monde.mushrooms[i];
      if (mu.treasure || mu.dying || mu.t < 0.5) continue;
      if (Math.abs(mu.x - hand.x) < R + mu.size * 0.4) breakMushroom(mu);
    }
    // (3) Un tresor enfoui juste sous le poing se deterre peu a peu.
    for (i = 0; i < partie.treasures.length; i++) {
      var t = partie.treasures[i];
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
  var busyHand = vue.handCarry.length > 0 || hand.grip !== null || !!vue.pointerDown, loose = 0;
  for (var i = 0; i < monde.shards.length; i++) {
    var s = monde.shards[i];
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
export function handTension(t) {
  var g = hand.grip;
  if (!g || g.t !== t) return 0;
  return Math.min(1, Math.hypot(hand.x - g.gx, hand.y - g.gy) / HAND_BREAK_DIST);
}
function handPoly(p) { poly(p); ctx.stroke(); }
// Main low-poly : l'origine locale est le centre de la paume (le point du curseur), doigts
// vers le haut. Ouverte (fist = 0) : 4 doigts en eventail et pouce ecarte ; poing (fist = 1) :
// doigts raccourcis dont le bout se replie sur la paume, pouce en travers.
export function drawHand() {
  if (!hand.on) return;
  var f = hand.fist, k = clamp(vue.U / 500, 0.7, 1.3) * (vue.ZOOM < 1 ? HAND_ZOOM_K : 1), i;
  if (hand.touch) {
    // Epaisseurs en px CSS (/ ZOOM) : l'anneau garde la meme taille a l'ecran quel que soit le zoom.
    var fl = clamp(1 - (performance.now() - hand.flash) / HAND_FLASH_MS, 0, 1);
    ctx.beginPath();
    ctx.arc(hand.x, hand.y, (HAND_RING_R * (1 - 0.1 * f) + 6 * fl) / vue.ZOOM, 0, Math.PI * 2);
    ctx.lineWidth = 5 / vue.ZOOM; ctx.strokeStyle = 'rgba(43,29,16,0.35)'; ctx.stroke();
    ctx.lineWidth = 2.5 / vue.ZOOM; ctx.strokeStyle = fl > 0 ? 'rgba(243,201,74,' + (0.6 + 0.4 * fl) + ')' : 'rgba(255,248,230,0.85)'; ctx.stroke();
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
  if (vue.handCarry.length) return;         // deja les mains pleines
  // Deux passes : le bois et les feuilles d'abord (poses au sol, ils restent dans litter,
  // stepTrees ignore ce qui n'est plus settled et le chemin d'atterrissage de step() les y
  // remet en conservant leur decomposition), puis la terre pour completer la poignee.
  for (var pass = 0; pass < 2; pass++) {
    for (var i = 0; i < monde.shards.length && vue.handCarry.length < HAND_GRAB_MAX; i++) {
      var s = monde.shards[i];
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
      vue.handCarry.push(s);
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
export function sprout(x, fromMyc, strain) {
  var sp = fromMyc && strain ? speciesForStrain(strain) : SPECIES[speciesIdx++ % SPECIES.length];
  var n = 1 + ((Math.random() * 3) | 0);
  var mainMushroom = null;
  for (var i = 0; i < n; i++) {
    var side = i === 0 ? 0 : (i === 1 ? -1 : 1);
    var size = vue.U * 0.2 * (0.6 + Math.random() * 0.6) * (i === 0 ? 1.15 : 0.85) * (fromMyc ? MYC_MUSHROOM_SCALE : 1);
    var m = {
      x: x + side * size * 0.55, size: size,
      lean: (Math.random() - 0.5) * 0.35 + side * 0.2,
      sp: sp, t: -i * 0.25,   // t negatif = petit decalage de pousse dans la grappe
      myc: !!fromMyc, lastMycNear: temps.vTime, strain: fromMyc ? strain || null : null
    };
    monde.mushrooms.push(m);
    if (window.sporaSfx) sporaSfx.play('pop', { min: 70 });
    if (i === 0) mainMushroom = m;
  }
  var alive = monde.mushrooms.filter(function (m) { return !m.dying && !m.treasure; });
  for (i = 0; i < alive.length - MAX_MUSHROOMS; i++) alive[i].dying = true;
  // Bulle produit : seulement au tout premier champignon issu du mycelium verse par le
  // visiteur (pas les champignons plantes a la main ni les tresors), une fois par
  // chargement de page (mycTipShown ne se reinitialise jamais, meme au rebuild).
  if (fromMyc && !mycTipShown) {
    mycTipShown = true;
    monde.mycTipMushroom = mainMushroom;
    monde.mycTip = buildTip({
      title: 'Cultivez vos propres champignons avec notre mycélium!',
      url: '/product/mycelium-en-vrac',
      cta: 'Précommander'
    });
    container.appendChild(monde.mycTip);
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
export function infect(s, ox, oy, amount, now, lastFed, parent, strain) {
  if (s.myc || s.grain || s.nutri || s.deadMyc || isRocky(s.x) || isSubmerged(s.x)) return;
  s.myc = amount;
  s.mycParent = parent || null;
  s.strain = (parent ? parent.strain : strain) || null;
  s.pid = parent ? parent.pid || 0 : 0; // patch : herite du parent ; inoculation directe/restauration = attribue au prochain instantane
  if (s.pid && partie.patches[s.pid]) partie.patches[s.pid].alive++;
  if (s.strain) monde.tintedMyc = true;
  s.hyJ = (Math.random() - 0.5) * 8;
  s.hyTw = [Math.random() * 6.283, 3 + Math.random() * 4];
  if (Math.random() < 0.5) s.hyTw.push(Math.random() * 6.283, 3 + Math.random() * 4);
  s.hyF = [];
  for (var hi = 0; hi < 3; hi++) s.hyF.push((Math.random() - 0.5) * 8, -1.5708 + (Math.random() - 0.5) * 1.2, 2 + Math.random() * 2);
  s.mox = ox; s.moy = oy;               // point d'inoculation : borne la portee (MYC_RADIUS)
  s.mycTone = 0.7 + Math.random() * 0.2; // jamais tout a fait blanc : les facettes restent lisibles
  s.lastFed = lastFed !== undefined ? lastFed : now;
  monde.colonised.push(s);
  mycBusyUntil = temps.frame + 120;
}

function inoculate(x, y, now, strain) {
  for (var i = 0; i < monde.shards.length; i++) {
    var s = monde.shards[i];
    if (!s.settled || Math.abs(s.x - x) > 12 || Math.abs(s.y - y) > 12) continue;
    infect(s, x, y, 0.06, now, undefined, undefined, strain);
  }
}

// Retourne true tant que quelque chose change (la boucle de rendu doit tourner).
// Sans bois a decomposer a portee (voir stepTrees, qui met a jour c.lastFed), un
// mycelium colonise finit par s'eteindre et la facette redevient de la terre normale.
function stepMycelium(now) {
  var busy = temps.frame < mycBusyUntil;
  snapshotPatches(performance.now());
  var deathCheck = now >= mycNextDeathCheck;
  if (deathCheck) mycNextDeathCheck = now + MYC_RANDOM_DEATH_CHECK_MS;
  for (var i = monde.colonised.length - 1; i >= 0; i--) {
    var c = monde.colonised[i], droughtHit = false, starving = false, cst = c.strain || STRAIN_STD, dm = cst.decayMul;
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
        monde.deadMyc.push(c);
      } else if (c.leaf) {
        // Le mycelium qui meurt de faim SUR DE LA LITIERE devient lui-meme un nutriment
        // (necromasse) : comme dans la vraie vie, sa propre mort nourrit encore le sol et
        // les arbres. Sur de la terre ordinaire (pas de litiere), voir le else ci-dessous :
        // la terre elle-meme n'a jamais de valeur nutritive, elle redevient juste de la
        // terre (le blanchiment disparait deja tout seul puisque le rendu suit c.myc).
        c.nutri = NUTRI[(Math.random() * NUTRI.length) | 0];
        c.nutriSince = now;
      }
      monde.colonised.splice(i, 1);
      if (!c.deadMyc) c.mycParent = null; // redevient de la terre normale (le mort garde son filament)
    }
  }
  if (temps.frame % MYC_SPREAD_EVERY === 0) spreadMycelium(now);
  return busy;
}

// Grille de voisinage refaite a chaque passage : la pelle deplace les facettes.
function spreadMycelium(now) {
  var D = 14, radius = vue.U * MYC_RADIUS, grid = new Map(), i, s, b;
  for (i = 0; i < monde.shards.length; i++) {
    s = monde.shards[i];
    if (!s.settled) continue;
    var key = ((s.x / D) | 0) * 1024 + ((s.y / D) | 0);
    var cell = grid.get(key);
    if (cell) cell.push(s); else grid.set(key, [s]);
  }
  var buckets = {}, fw = vue.U * FRUIT_W;
  for (i = 0; i < monde.colonised.length; i++) {
    var c = monde.colonised[i];
    if (!c.settled || c.myc < MYC_READY) continue;
    if (c.myc > 0.9 && c.y - surfaceAt(c.x) < 18) {
      b = Math.floor(c.x / fw);
      (buckets[b] = buckets[b] || []).push(c);
    }
    if (c.mycIdle > temps.frame || Math.random() > MYC_SPREAD_P) continue;
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
    if (!free.length) { c.mycIdle = temps.frame + 90; continue; }
    // Herite l'horloge de faim du parent : se repandre dans la terre ne nourrit pas.
    infect(free[(Math.random() * free.length) | 0], c.mox, c.moy, 0.02, now, c.lastFed, c);
  }
  // Une zone de surface bien blanche fructifie une fois.
  for (b in buckets) {
    var xs = buckets[b];
    if (monde.fruited[b] || xs.length < FRUIT_MIN) continue;
    monde.fruited[b] = true;
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
  if (partie.bagGrainsLeft <= 0 && partie.DEMO) partie.bagGrainsLeft = BAG_GRAINS; // demo : mycelium gratuit, le sac ne se vide jamais
  if (partie.bagGrainsLeft <= 0) {
    bag.pouring = false; // sac vide : se redresse tout seul
    setCaption(CAPTION_BAG_EMPTY);
    return;
  }
  var n = Math.min(partie.bagGrainsLeft, Math.random() < 0.5 ? 2 : 1);
  partie.bagGrainsLeft -= n;
  var cs = currentStrain();
  for (var i = 0; i < n; i++) {
    var r = 1.8 + Math.random() * 1.6, a = Math.random() * Math.PI * 2;
    var color = hexToRgb(GRAIN[(Math.random() * GRAIN.length) | 0]);
    if (cs) color = mixRgb(color, cs.tintRgb, STRAIN_MIX);
    monde.shards.push({
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

export function drawBag() {
  if (!bag.on) return;
  var k = clamp(vue.U / 500, 0.7, 1.3);
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

// Vrai si un mycelium bien vivant (myc > MYC_READY) est assez proche pour retenir cet
// humus contre le lessivage — seulement s'il ne le retient pas depuis trop longtemps
// deja (MYC_HOLD_MAX_MS), sinon un humus jamais mange resterait bloque pour toujours.
export function heldByMycelium(x, y, nutriSince) {
  if (nutriSince !== undefined && temps.vTime - nutriSince > MYC_HOLD_MAX_MS) return false;
  for (var i = 0; i < monde.colonised.length; i++) {
    var c = monde.colonised[i];
    if (c.myc > MYC_READY && Math.hypot(c.x - x, c.y - y) < MYC_HOLD_REACH) return true;
  }
  return false;
}

function setTool(name) {
  if (!name || name === partie.tool) return;
  if (window.sporaSfx) sporaSfx.play('toolSwitch'); 
  leaveShovel();
  leaveBag();
  leaveHand();
  partie.tool = name;
  updateStrainBar();
  container.classList.toggle('is-planting', name === 'tree');
  if (name === 'mycelium' && partie.unlockedStrains.length) guideSet('myc'); // sans souche debloquee, prendre l'outil ne compte pas (le tutoriel resterait sur la barre)
  for (var i = 0; i < toolBtns.length; i++) {
    // Le gazon n'a pas de bouton dans la barre d'outils : le bouton mycelium (dont la barre
    // contient le bouton gazon) reste actif, sinon tous les boutons sont replies et la barre disparait.
    var on = toolBtns[i].getAttribute('data-tool') === (name === 'grass' ? 'mycelium' : name);
    toolBtns[i].classList.toggle('is-active', on);
    toolBtns[i].setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  startLoop();
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
  var c0 = Math.round(x / COL_W), span = Math.ceil(40 / COL_W), n = monde.rocky.length;
  for (var d = 0; d < n; d++) {
    for (var sg = -1; sg <= 1; sg += 2) {
      var c = c0 + sg * d;
      if (c - span < 0 || c + span >= n) continue;
      var ok = true;
      for (var k = -span; k <= span; k++) if (monde.rocky[c + k]) { ok = false; break; }
      if (ok) return c * COL_W;
    }
  }
  return x;
}
// Un tresor enfoui : sa facette doree et son repere (halo + poing ou pelle fantome, en
// alternance), pose a la surface au-dessus de lui : il montre ou creuser meme quand le
// tresor est enfoui hors de la vue.
// Un tresor deja deterre revient a sa derniere position ; sinon sa place d'origine.
function replayX(def) {
  if (partie.skippedFound.indexOf(def.title) !== -1 && partie.foundFx[def.title] !== undefined) return partie.foundFx[def.title] * vue.worldW;
  return clearOfRock(partie.DEMO ? vue.camMargin + vue.W * DEMO_TREASURE_X : def.x * vue.worldW);
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
  var ty = depth > 0 ? Math.min(vue.groundY + depth * vue.U, vue.worldH - BEDROCK_MARGIN - 20) : 0;
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
  return (partie.DEMO ? partie.treasureDefs.slice(0, 1) : partie.treasureDefs).filter(function (def) { return partie.skippedFound.indexOf(def.title) === -1; });
}
function setupTreasures() {
  clearTreasures();
  // Tresors deja deterres (sauvegarde chargee avec la page) : ni glint ni champignon, ils
  // ne reviennent pas enterres. Une seule fois : un rebuild en cours de page regenere tout.
  partie.skippedFound = partie.restoredFound;
  partie.restoredFound = [];
  treasuresFound = partie.skippedFound.length;
  updateTreasureUI();
  if (guideFlags.harvest) queueDemoEnd(); // demo deja finie avant un rechargement : l'ecran de fin revient
  partie.treasures = buriedDefs().map(buildTreasure);
  // Demo : le 1er tresor deja deterre lors d'une visite precedente reste a l'ecran, deterre
  // d'office (sinon l'accueil n'en montrerait aucun avant la fin du tutoriel).
  var replays = (partie.DEMO ? partie.treasureDefs.slice(0, 1) : partie.treasureDefs).filter(function (def) { return partie.skippedFound.indexOf(def.title) !== -1; }).map(buildTreasure);
  replays.forEach(function (r) { partie.treasures.push(r); });
  // On laisse la terre retomber avant de montrer ou creuser ; positionTreasureOverlays
  // decide ensuite, a chaque frame, si chaque repere est visible (t.ready).
  var mine = partie.treasures;
  setTimeout(function () {
    if (partie.mode !== 'exploded' || mine !== partie.treasures) return; // rebuild (ou nouvelle explosion) entre-temps
    partie.treasures.forEach(function (t) { t.ready = true; });
    if (replays.length) {
      // Restent dans skippedFound jusqu'ici pour ne pas sortir de la sauvegarde ; reveal() les recompte
      // (dans l'ordre des defs : le contenu montre suit le rang de deterrage).
      partie.skippedFound = partie.skippedFound.filter(function (ti) { return !replays.some(function (r) { return r.def.title === ti; }); });
      treasuresFound = partie.skippedFound.length;
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
function compassGo() {
  var tgt = compass && compass._target;
  if (!tgt || shovel.on || partie.mode !== 'exploded') return;
  shovelPlant.x = clamp(tgt.x - 110, 30, vue.worldW - 30);
  vue.camGoal = { x: clamp(shovelPlant.x - vue.W / 2, 0, Math.max(0, vue.worldW - vue.W)), y: vue.camY };
  compass.classList.add('is-pressed');
  setTimeout(function () { if (compass) compass.classList.remove('is-pressed'); }, 220);
  startLoop();
  setCaption(DIG_HINT_MSG);
}
function updateCompass() {
  var best = null, bd = Infinity, cx = vue.W / 2, cy = vue.H / 2, i;
  // Pas de boussole pendant le tutoriel du mycelium : elle detournerait l'attention.
  if (partie.mode === 'exploded' && !(partie.unlockedStrains.length && guideCurrent())) {
    for (i = 0; i < partie.treasures.length; i++) {
      var t = partie.treasures[i];
      if (t.revealed) continue;
      var d = Math.hypot(t.x - vue.camX - cx, treasureY(t) - vue.camY - cy);
      if (d < bd) { bd = d; best = t; }
    }
  }
  // Horizontalement le badge suit le tresor (loin a gauche -> colle au bord gauche) ; en hauteur
  // il reste dans la bande basse de l'ecran (au plus COMPASS_RISE_FRAC x H au-dessus du bas).
  // Tout ce bloc est en px CSS (ecran) : la boussole est un overlay HTML, d'ou les * ZOOM.
  var tx = 0, ty = 0, px = 0, py = 0, cssW = vue.W * vue.ZOOM, cssH = vue.H * vue.ZOOM;
  if (best) {
    tx = (best.x - vue.camX) * vue.ZOOM; ty = (treasureY(best) - vue.camY) * vue.ZOOM;
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
  partie.treasures.forEach(function (t) {
    t.glint.remove();
    if (t.tip) t.tip.remove();
    if (t.hint) t.hint.remove();
    if (t.sparks) t.sparks.forEach(function (sp) { sp.remove(); });
  });
  partie.treasures = [];
  partie.skippedFound = [];
  partie.goldBits = [];
}

// Compteur "Trésors n/N" (N = toutes les defs). Une fois tout
// trouve il devient un lien vers la boutique (pas de code promo pour l'instant).
function updateTreasureUI() {
  if (!treasureCountEl) return;
  var total = partie.treasureDefs.length, done = total > 0 && treasuresFound >= total;
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
function hideDemoEnd() {
  clearTimeout(demoEndTimer);
  if (demoEndEl) demoEndEl.classList.add('d-none');
}
// Sur l'accueil le header flotte par-dessus le haut de la boite et change de hauteur (etendu /
// compact) : le voile commence sous lui, et le suit (syncTick, defilement, redimensionnement).
function syncDemoEndTop() {
  if (!demoEndEl || demoEndEl.classList.contains('d-none')) return;
  var hb = siteHeader ? siteHeader.getBoundingClientRect().bottom - container.getBoundingClientRect().top : 0;
  demoEndEl.style.top = Math.max(0, Math.min(hb, vue.U * 0.55)) + 'px'; // px CSS : U = hauteur CSS de la boite
}
function queueDemoEnd() {
  if (!partie.DEMO || !demoEndEl) return;
  clearTimeout(demoEndTimer);
  demoEndTimer = setTimeout(function () {
    if (partie.mode !== 'exploded') return;
    demoEndEl.classList.remove('d-none');
    syncDemoEndTop();
    var link = demoEndEl.querySelector('a');
    if (link) link.focus({ preventScroll: true });
  }, DEMO_END_DELAY);
}
function endDemo() {
  hideDemoEnd();
  partie.DEMO = false;
  container.classList.remove('is-demo');
  try { localStorage.setItem(DEMO_KEY, '1'); } catch (e) { /* ignore */ }
  updateMoneyUI();
  updateChallengeUI();
  updateStrainBar();
  // Les tresors mis de cote pendant la demo (buriedDefs) sont enfouis maintenant.
  buriedDefs().forEach(function (def) {
    if (partie.treasures.some(function (t) { return t.def === def; })) return;
    var t = buildTreasure(def);
    t.ready = true;
    partie.treasures.push(t);
  });
  positionTreasureOverlays();
  updateTreasureUI();
  startLoop();
}

// Avertissement avant de quitter le jeu : le lien "Voir le produit" d'une infobulle ouvre
// d'abord ce voile (meme style que l'ecran de fin), le visiteur confirme ou reste.
// Le credit d'une photo passe par le meme voile, avec d'autres textes : il mene a un autre
// site, ouvert dans un nouvel onglet (la partie reste ouverte ici).
var leaveEl = document.getElementById('logo-explosion-leave');

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

export function refreshStrainBar() {
  if (!strainsBar) return;
  var btns = strainsBar.querySelectorAll('[data-strain]');
  for (var i = 0; i < btns.length; i++) {
    var id = btns[i].getAttribute('data-strain'), st = strainById[id];
    var open = partie.unlockedStrains.indexOf(id) !== -1, on = open && id === partie.bagStrain;
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
  if (grassBtn && monde.grassCover) {
    var avg = monde.grassCover.reduce(function (a, b) { return a + b; }, 0) / monde.grassCover.length;
    var pct = Math.round(avg * 100);
    var on = partie.tool === 'grass';
    grassBtn.setAttribute('aria-label', 'Semer du gazon : ' + pct + '%');
    grassBtn.title = 'Semer du gazon : ' + pct + '%';
    grassBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    grassBtn.classList.toggle('is-active', on || avg > 0.5);
  }
}

// Visible seulement avec l'outil mycelium ou gazon (le bouton gazon vit dans cette barre) ET le monde explose.
function updateStrainBar() {
  if (strainsBar) strainsBar.classList.toggle('d-none', !(partie.mode === 'exploded' && (partie.tool === 'mycelium' || partie.tool === 'grass')));
}

function setStrain(id) {
  if (partie.unlockedStrains.indexOf(id) === -1 || !strainById[id]) return;
  partie.bagStrain = id;
  refreshStrainBar();
  startLoop(); // le sac dessine la nouvelle teinte
}

// Retourne true si la souche vient d'etre debloquee (pas deja connue de cette page).
// Un clic sur le champignon d'un tresor selectionne sa souche pour l'outil mycelium.
function pickTreasureStrain(t) { if (t) t.tipClosed = false; if (t && t.strainId) setStrain(t.strainId); }

function unlockStrain(id) {
  if (!strainById[id] || partie.unlockedStrains.indexOf(id) !== -1) return false;
  partie.unlockedStrains.push(id);
  refreshStrainBar();
  return true;
}

// Retire juste la bulle DOM (le rebuild fait tomber le champignon qui la portait) —
// mycTipShown n'est PAS reinitialise : elle ne doit s'afficher qu'une fois par page.
function clearMycTip() {
  if (monde.mycTip) { monde.mycTip.remove(); monde.mycTip = null; }
  monde.mycTipMushroom = null;
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
function grabTreasureAt(pos) {
  var t = treasureNear(pos.x, pos.y);
  if (!t || !t.revealed || !t.mushroom) return null;
  return { t: t, dx: t.x - pos.x };
}
function moveTreasure(t, x) {
  x = clamp(x, 30, vue.worldW - 30);
  var off = t.nx - t.x;
  t.x = x; t.mushroom.x = x; t.nx = x + off;
  t.deep = false; t.y = surfaceAt(x); // repose a la surface, comme s'il venait d'etre deterre
}
function treasureNear(x, y) {
  for (var i = 0; i < partie.treasures.length; i++) {
    var t = partie.treasures[i];
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
  for (var i = 0; i < monde.shards.length; i++) {
    var s = monde.shards[i];
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
  var shown = partie.treasureDefs[Math.min(foundList().length, partie.treasureDefs.length) - 1] || t.def;
  t.glint.classList.remove('is-visible');
  if (t.hint) { t.hint.remove(); t.hint = null; }
  // Hauteur de la pepite : celle du tresor (fixe s'il est profond, sinon la surface au
  // moment du reveal). Le champignon, lui, reste dessine a surfaceAt (fond du trou ouvert).
  if (!t.deep) t.y = surfaceAt(t.x);
  digAt(t);
  // t negatif : le trou s'ouvre d'abord, le champignon sort ensuite.
  t.mushroom = { x: t.x, size: vue.U * 0.24, lean: 0, sp: SPECIES[shown.species] || SPECIES[0], t: -0.4, treasure: true };
  monde.mushrooms.push(t.mushroom);
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
  if (fresh && st.id === 'pleurote') partie.pleuroteDug = true;
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
    if (partie.mode !== 'exploded' || partie.tool !== 'hand' || t.tip.parentNode !== container) return;
    var sp = getRelativePos(evt), wp = { x: sp.x + vue.camX, y: sp.y + vue.camY };
    vue.treasureGrab = { t: t, dx: t.x - wp.x, fromTip: true, onImg: evt.target.tagName === 'IMG' };
    vue.pointerDown = wp; vue.dragMoved = false; vue.pressCaught = true; grabbed = true;
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
  if (nDug <= 1 || !guideCurrent()) { openTip(t); partie.tipHoldUntil = performance.now() + TIP_REVEAL_HOLD_MS; }
  // Souris sur la carte : elle reste ouverte ; sortie de la carte : voir tipAway.
  t.tip.addEventListener('pointerenter', function () { tipAway(false); });
  t.tip.addEventListener('pointerleave', function (evt) { if (evt.pointerType === 'mouse') tipAway(true); });
  treasuresFound++;
  updateTreasureUI();
  savePlayerIfChanged();
  var msg = fresh ? 'Nouvelle souche débloquée : ' + strainById[st.id].label + (strainById[st.id].perk ? ' — ' + strainById[st.id].perk : '') + ' (outil mycélium).' : '';
  if (partie.treasureDefs.length && treasuresFound >= partie.treasureDefs.length) msg += (msg ? ' ' : '') + 'Vous avez trouvé tous les trésors !';
  if (msg) setCaption(msg);
  startLoop();
}

// Pepite low-poly : polygone irregulier a 5-6 facettes (triangles en eventail depuis un
// point central decale), teinte selon l'orientation de chaque facette par rapport a une
// lumiere venant du haut-gauche. Points figes au reveal (pas de random au dessin).
function makeNugget() {
  var R = vue.U * NUGGET_R, n = 5 + (Math.random() < 0.5 ? 1 : 0), ang = [], rad = [], i;
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

export function drawNuggets() {
  for (var i = 0; i < partie.treasures.length; i++) {
    var t = partie.treasures[i];
    if (!t.nugget) continue;
    var y = nuggetY(t), fs = t.nugget.facets;
    if (t.nx < vue.camX - 30 || t.nx > vue.camX + vue.W + 30 || y < vue.camY - 30 || y > vue.camY + vue.H + 30) continue;
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
    partie.goldBits.push({
      x: x, y: y, vx: (Math.random() - 0.5) * 5, vy: -3 - Math.random() * 3,
      rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.4,
      r: 2.5 + Math.random() * 2.5, c: NUGGET_COLORS[(Math.random() * 3) | 0], life: GOLD_BITS_LIFE
    });
  }
}

function stepGoldBits() {
  for (var i = partie.goldBits.length - 1; i >= 0; i--) {
    var b = partie.goldBits[i];
    b.vy += GRAVITY; b.vx *= AIR;
    b.x += b.vx; b.y += b.vy; b.rot += b.vr;
    if (--b.life <= 0) partie.goldBits.splice(i, 1);
  }
  return partie.goldBits.length > 0;
}

export function drawGoldBits() {
  for (var i = 0; i < partie.goldBits.length; i++) {
    var b = partie.goldBits[i], r = b.r * Math.min(1, b.life / 15); // retrecit sur la fin
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
var tipAwayTimer = 0;
function tipAway(away) {
  if (!away) { clearTimeout(tipAwayTimer); tipAwayTimer = 0; return; }
  if (tipAwayTimer) return;
  tipAwayTimer = setTimeout(function check() {
    var open = null;
    partie.treasures.forEach(function (t) { if (t.tip && t.tip.classList.contains('is-open')) open = t; });
    var wait = (vue.treasureGrab || (open && open.tip.matches(':hover'))) ? TIP_AWAY_MS : partie.tipHoldUntil - performance.now();
    if (open && wait > 0) { tipAwayTimer = setTimeout(check, wait); return; }
    tipAwayTimer = 0;
    if (open) openTip(null);
  }, TIP_AWAY_MS);
}
var tipIdleTimer = 0;
function tipIdle() {
  clearTimeout(tipIdleTimer);
  if (!NO_HOVER) return;
  tipIdleTimer = setTimeout(function () {
    var open = null;
    partie.treasures.forEach(function (t) { if (t.tip && t.tip.classList.contains('is-open')) open = t; });
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
  partie.treasures.forEach(function (t) {
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
  if (monde.mycTip) monde.mycTip.classList.toggle('is-open', active === 'myc');
  if (!!active !== partie.tipOpen) { partie.tipOpen = !!active; partie.tipChangeAt = performance.now(); } // voir leachTip
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
  var boxW = vue.W * vue.ZOOM, top = Math.max(120, (surfaceAt(m.x) - vue.camY) * vue.ZOOM - 70);
  cue.style.left = Math.max(110, Math.min(boxW - 110, (m.x - vue.camX) * vue.ZOOM)) + 'px';
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
  var capTop = (surfaceAt(m.x) - vue.camY + 6 - m.size * g * 1.45) * vue.ZOOM;
  var half = tipEl.offsetWidth / 2;
  var mScreenX = (m.x - vue.camX) * vue.ZOOM;
  var left = Math.max(half + 8, Math.min(vue.W * vue.ZOOM - half - 8, mScreenX));
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
var digTipEl = null, digTipTarget = null, digTipTimer = 0;
function hideDigTip() {
  clearTimeout(digTipTimer);
  digTipTarget = null;
  partie.digTipHover = false;
  if (digTipEl) digTipEl.classList.remove('is-open');
}
// Tresor pas encore deterre dont le scintillement affiche est sous le pointeur (meme enfoui) :
// on compare au rectangle reel de l'element (coordonnees fenetre), pas a un calcul monde -> ecran.
function treasureGlintAt(evt) {
  var best = null, bd = 34;
  for (var i = 0; i < partie.treasures.length; i++) {
    var t = partie.treasures[i];
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
  partie.digTipHover = !!hover;
  digTipEl.classList.add('is-open');
  clearTimeout(digTipTimer);
  if (!hover) digTipTimer = setTimeout(hideDigTip, DIG_TIP_MS);
  positionDigTip();
}
function positionDigTip() {
  if (!digTipEl || !digTipTarget) return;
  if (digTipTarget.revealed) { hideDigTip(); return; }
  var sx = (digTipTarget.x - vue.camX) * vue.ZOOM, sy = (treasureY(digTipTarget) - vue.camY) * vue.ZOOM;
  var half = digTipEl.offsetWidth / 2;
  digTipEl.style.left = Math.max(half + 8, Math.min(vue.W * vue.ZOOM - half - 8, sx)) + 'px';
  digTipEl.style.top = Math.max(digTipEl.offsetHeight + 8, sy - 26) + 'px';
}

export function positionTreasureOverlays() {
  // Un seul repere a la fois : celui du tresor enfoui le plus pres du centre de l'ecran.
  var hintT = null, hintD = vue.W / 2 + 20;
  for (var h = 0; h < partie.treasures.length; h++) {
    var dh = Math.abs(partie.treasures[h].x - vue.camX - vue.W / 2);
    if (!partie.treasures[h].revealed && dh < hintD) { hintD = dh; hintT = partie.treasures[h]; }
  }
  for (var i = 0; i < partie.treasures.length; i++) {
    var t = partie.treasures[i];
    var screenX = t.x - vue.camX;
    if (!t.revealed) {
      // Toujours signale des qu'il est dans la vue, meme enfoui (il ne se creuse que
      // quand treasureReachable, voir tryDig).
      var sy = treasureY(t) - vue.camY;
      var show = t.ready && sy > -20 && sy < vue.H + 20 && screenX > -20 && screenX < vue.W + 20;
      t.glint.classList.toggle('is-visible', show);
      t.glint.style.left = screenX * vue.ZOOM + 'px';
      t.glint.style.top = (sy * vue.ZOOM - 2) + 'px';
      if (t.hint) {
        // A la surface (ou sur le tresor si on a creuse plus bas que lui). Cache pendant le
        // tutoriel du mycelium, comme la boussole : il detournerait l'attention.
        var hy = Math.min(sy, surfaceAt(t.x) - vue.camY);
        t.hint.classList.toggle('is-visible', t === hintT && t.ready && hy * vue.ZOOM > 30 && hy < vue.H + 20 && screenX > -20 && screenX < vue.W + 20 && !(partie.unlockedStrains.length && guideCurrent()));
        t.hint.style.left = screenX * vue.ZOOM + 'px';
        t.hint.style.top = (hy * vue.ZOOM - 34) + 'px';
      }
      continue;
    }
    if (t.sparks) {
      var ny = nuggetY(t) - vue.camY, nsx = t.nx - vue.camX, nr = t.nugget.r;
      t.sparks[0].style.left = (nsx - nr * 0.35) * vue.ZOOM + 'px';
      t.sparks[0].style.top = (ny - nr * 0.7) * vue.ZOOM + 'px';
      t.sparks[1].style.left = (nsx + nr * 0.5) * vue.ZOOM + 'px';
      t.sparks[1].style.top = (ny - nr * 0.2) * vue.ZOOM + 'px';
    }
    if (!t.tip) continue;
    positionTipOverMushroom(t.tip, t.mushroom);
    // Champignon sorti de l'ecran : la bulle s'efface graduellement, puis se ferme.
    var farX = t.mushroom.x - vue.camX, off = farX < 0 ? -farX : farX > vue.W ? farX - vue.W : 0, fade = 1 - off / (vue.W * 0.12);
    if (t.tip.classList.contains('is-open') && off > 0) {
      // Filet de securite : hors ecran depuis 2,5 s, elle se ferme meme si la distance ne suffit pas (bord du monde).
      if (!t.farSince) t.farSince = performance.now();
      if (fade <= 0 || performance.now() - t.farSince > 2500) { openTip(null); t.tip.style.opacity = ''; t.farSince = 0; }
      else t.tip.style.opacity = Math.min(fade, 1 - (performance.now() - t.farSince) / 2500).toFixed(2);
    } else { t.tip.style.opacity = ''; t.farSince = 0; }
  }
  if (monde.mycTip && monde.mycTipMushroom) positionTipOverMushroom(monde.mycTip, monde.mycTipMushroom);
  positionDigTip();
  updateCompass();
}

// --- Reconstruction ----------------------------------------------------------------
export function rebuild() {
  if (partie.mode !== 'exploded') return;
  partie.mode = 'rebuilding';
  rebuildT = 0;
  vue.camX = vue.camMargin; // la camera revient au centre pendant que le logo se reconstruit
  vue.camY = vue.ZOOM === 1 ? 0 : camHomeY();
  vue.mobileArrow = 0;
  vue.mobileArrowY = 0;
  leaveHand(); // ce qu'on tenait/agrippait a la main ne survit pas a la reconstruction (rend aussi s.carried a false)
  // Les grains en vol n'ont pas de place dans le logo : ils disparaissent.
  monde.shards = monde.shards.filter(function (g) { return !g.grain && !g.extra && g.eaten === undefined; });
  monde.colonised = []; monde.fruited = {}; monde.deadMyc = []; monde.tintedMyc = false; resetPatches();
  monde.trees = []; monde.litter = []; monde.treeLife = false;
  monde.insects = []; monde.heldInsect = null; monde.insectNextAt = null; monde.insectLastT = null;
  monde.compactNutri = []; monde.drops = [];
  monde.lakes = []; monde.lakeOf = []; monde.lakeLastT = null;
  weather.raining = false; weather.clouds = []; weather.lastNow = null;
  weather.drought = false;
  updateDroughtIndicator();
  leaveBag();
  for (var i = 0; i < monde.shards.length; i++) {
    var s = monde.shards[i];
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
  for (var i = 0; i < monde.heights.length; i++) {
    monde.heights[i] *= 0.9;
    monde.compactY[i] += (vue.groundY - monde.compactY[i]) * 0.1;
  }
  for (i = 0; i < monde.shards.length; i++) {
    var s = monde.shards[i];
    var t = easeInOut(Math.max(0, Math.min(1, (rebuildT - s.delay) / 0.65)));
    s.x = lerp(s.sx, s.ox, t);
    // Logo : petit arc vers le haut. Lit de terre : retour a sa place puis sous le bord.
    s.y = s.soil ? lerp(s.sy, s.oy + monde.soilDepth, t) : lerp(s.sy, s.oy, t) - Math.sin(t * Math.PI) * 40;
    s.rot = lerp(s.srot, 0, t);
    s.mix = lerp(s.smix, 0, t);
    if (s.myc) s.myc *= 0.93;
    s.nutri = null;
  }
  monde.mushrooms.forEach(function (m) { m.t -= 0.06; });
  monde.mushrooms = monde.mushrooms.filter(function (m) { return m.t > 0; });
  if (rebuildT < 1) return true;
  resetToLogo();
  return false;
}

function resetToLogo() {
  partie.mode = 'assembled';
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
  vue.mobileArrow = 0;
  vue.mobileArrowY = 0;
  vue.hoverScreenX = null; vue.hoverScreenY = null;
  leaveBag();
  leaveHand();
  weather.raining = false; weather.clouds = []; weather.lastNow = null;
  weather.drought = false;
  updateDroughtIndicator();
  monde.drops = []; monde.compactNutri = [];
  monde.lakes = []; monde.lakeOf = []; monde.lakeLastT = null;
  monde.shards = [];
  resetTiles();
  monde.mushrooms = [];
  monde.colonised = []; monde.fruited = {}; monde.deadMyc = []; monde.tintedMyc = false; resetPatches();
  partie.bagGrainsLeft = 0; // le sac se re-achete (ou se re-offre s'il n'a jamais servi) au prochain versement
  monde.trees = []; monde.litter = []; monde.treeLife = false;
  monde.insects = []; monde.heldInsect = null; monde.insectNextAt = null; monde.insectLastT = null;
  if (slowTimer !== null) { clearTimeout(slowTimer); slowTimer = null; }
}

// --- Evenements --------------------------------------------------------------------
function getRelativePos(evt) {
  // container plutot que canvas : le canvas est en d-none (rect a 0) avant le clic.
  // Coordonnees ECRAN (relatives a la boite), pas encore converties en coord. monde.
  // Divisees par ZOOM : px CSS -> px logiques (meme repere que W/H).
  var rect = container.getBoundingClientRect();
  var p = evt.touches ? evt.touches[0] : evt;
  return { x: (p.clientX - rect.left) / vue.ZOOM, y: (p.clientY - rect.top) / vue.ZOOM };
}

// Coordonnees monde (ajoute le decalage camera courant) : a utiliser pour toute la
// physique/logique (pelle, tresors, tas) une fois le monde explose.
function getWorldPos(evt) {
  var p = getRelativePos(evt);
  return { x: p.x + vue.camX, y: p.y + vue.camY };
}
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

function endPress(evt, allowTap) {
  dropHeldInsect(); // meme si pointerDown a deja ete remis a zero
  if (!vue.pointerDown) return;
  if (evt.pointerType !== 'mouse') { vue.hoverScreenX = null; vue.hoverScreenY = null; }
  if (partie.tool === 'hand' && shovel.on) {
    releaseShovel();
    vue.pressCaught = false;
    vue.pointerDown = null;
    startLoop();
    return;
  }
  if (partie.tool === 'hand') {
    if (vue.treasureGrab) {
      if (allowTap && !vue.dragMoved) {
        openTip(vue.treasureGrab.t, true); pickTreasureStrain(vue.treasureGrab.t);
        if (vue.treasureGrab.fromTip) tapTip(vue.treasureGrab.t, vue.treasureGrab.onImg);
      }
      vue.treasureGrab = null;
    }
    var hadGrip = !!hand.grip;
    hand.grip = null; // relachee avant de casser : la branche revient droite, rien d'autre
    if (vue.handCarry.length) {
      // On relache la prise : la gravite fait le reste (chute et pose normales, meme
      // chemin que pour n'importe quelle facette delogee par la pelle, voir step()).
      for (var hi = 0; hi < vue.handCarry.length; hi++) vue.handCarry[hi].carried = false;
      vue.handCarry = [];
    } else if (allowTap && !vue.dragMoved && !hadGrip && !vue.pressCaught) {
      // Un tap sur le monde ferme aussi l'infobulle ouverte (tresor ou bulle mycelium).
      var handWp = getWorldPos(evt), handT = treasureNear(handWp.x, handWp.y);
      if (!(handT && handT.revealed)) openTip(null);
      harvestAt(handWp);
    }
    vue.pressCaught = false;
    vue.pointerDown = null;
    if (evt.pointerType !== 'mouse') leaveHand(); // au doigt la main n'existe que pendant l'appui
    startLoop();
    return;
  }
  if (partie.tool === 'mycelium') {
    bag.pouring = false;
    // Au sac, un tap ne creuse pas : il rouvre seulement l'infobulle d'un tresor deja sorti.
    if (allowTap && !vue.dragMoved) {
      var wp = getWorldPos(evt), t = treasureNear(wp.x, wp.y);
      if (t && t.revealed) { openTip(t, true); pickTreasureStrain(t); } else openTip(null);
    }
    if (evt.pointerType !== 'mouse') leaveBag();
    vue.pointerDown = null;
    startLoop();
    return;
  }
  if (partie.tool === 'fertilizer') {
    vue.pointerDown = null;
    startLoop();
    return;
  }
  if (partie.tool === 'tree') {
    if (allowTap && !vue.dragMoved) {
      openTip(null); // un tap plante un arbre mais ferme d'abord toute infobulle ouverte
      plantTree(getWorldPos(evt).x);
    }
    vue.pointerDown = null;
    startLoop();
    return;
  }
  vue.pointerDown = null;
  startLoop();
}
// Reutilise le mecanisme de header compact expose par nav-compact.js (voir
// window.sporaHeaderCompact) plutot que d'en refaire un. Verifie sa presence pour ne
// rien casser si ce script change ou ne s'est pas encore charge.
var siteHeader = document.querySelector('.header');
// Le clic sur le logo compacte le header d'office (voir explode) ; ensuite toute
// interaction dans le jeu le replie s'il s'est redeplie au defilement.
var headerCompactedByGame; // sans valeur initiale : explode peut passer avant cette ligne
function compactHeaderForGame() {
  headerCompactedByGame = true;
  if (window.sporaHeaderCompact && typeof window.sporaHeaderCompact.set === 'function') window.sporaHeaderCompact.set(true);
}
// Jeu remis a zero : on redeplie le header que le jeu avait compacte. Pas sur mobile :
// deplie, il mange trop de l'ecran ; il se redepliera tout seul au defilement.
function releaseHeader() {
  var narrow = window.matchMedia && window.matchMedia('(max-width: 767.98px)').matches;
  if (!narrow && headerCompactedByGame && window.sporaHeaderCompact && typeof window.sporaHeaderCompact.set === 'function') window.sporaHeaderCompact.set(false);
  headerCompactedByGame = false;
  clearTimeout(headerLeaveTimer);
  headerHover = false;
}
var headerHover = false, headerLeaveTimer = 0;
function setHeaderHover(over) {
  if (over === headerHover) return;
  headerHover = over;
  clearTimeout(headerLeaveTimer);
  if (!over) headerLeaveTimer = setTimeout(function () { if (partie.mode === 'exploded') compactHeaderForGame(); }, HEADER_HOVER_LEAVE);
  else if (window.sporaHeaderCompact && typeof window.sporaHeaderCompact.set === 'function') window.sporaHeaderCompact.set(false);
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
  if (partie.mode === 'assembled') return; // pas encore explose : build() lira la taille a jour au clic
  var rect = container.getBoundingClientRect();
  if (Math.round(rect.width) !== Math.round(vue.UW)) {
    // La largeur a aussi change (jamais le cas pour le bouton plein ecran lui-meme,
    // mais garde-fou si une barre de defilement s'en mele) : seul cas ou on doit
    // vraiment tout reconstruire, comme le fait deja le listener de resize plus bas.
    if (vue.rafId !== null) { cancelAnimationFrame(vue.rafId); vue.rafId = null; }
    resetToLogo();
    return;
  }
  var newH = rect.height;
  if (Math.round(newH) === Math.round(vue.U)) return;
  vue.H = newH / vue.ZOOM; vue.U = vue.H * vue.ZOOM;
  resetTiles();
  sizeCanvas();
  // groundY et le sol existant restent en coordonnees monde absolues, inchanges :
  // seule la fenetre visible (camY..camY+H) grandit ou retrecit.
  vue.worldH = Math.max(vue.worldH, vue.H + vue.U * DEPTH_MULT);
  // Au sommet (camY <= 0) on colle la vue sur le sol en bas d'ecran, comme au depart :
  // la place gagnee sert a montrer plus de ciel, pas plus de sous-sol.
  var atTop = vue.camY <= 0;
  vue.camY = clamp(atTop ? camHomeY() : vue.camY, camMinY(), vue.worldH - vue.H);
}
// Vue de depart : le sol au bas de l'ecran. 0 tant que la fenetre n'est pas plus haute que
// le monde de depart ; negatif en plein ecran ou en zoom arriere (H depasse groundY).
export function camHomeY() { return Math.min(0, vue.groundY - (vue.H - 6)); }
// Zoome : la vue de depart montre deja beaucoup de ciel au-dessus des arbres, pas de ciel en plus.
function camMinY() { return vue.ZOOM === 1 ? Math.min(0, vue.groundY - (vue.H - 6)) - vue.H * SKY_EXTRA : camHomeY(); }
var debugDefaults = null;
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
  if (!debugPanel || partie.debugBuilt) return;
  partie.debugBuilt = true;
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
    if (partie.treasureDefs.length) treasureCountEl.classList.remove('d-none');
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
// Multiplicateurs de production de nutriments du gazon (voir updateGrass) : 1 = normal, 0 = aucun.
var grassNutriInput = document.getElementById('logo-explosion-grass-nutri');
var grassMycNutriInput = document.getElementById('logo-explosion-grassmyc-nutri');

// Fleches tactiles (mobile) : maintenues, elles font defiler le monde a vitesse fixe.
function bindScrollArrow(btn, dir, vertical) {
  if (!btn) return;
  var start = function (evt) { evt.preventDefault(); if (vertical) vue.mobileArrowY = dir; else vue.mobileArrow = dir; startLoop(); };
  var stop = function () { if (vertical) vue.mobileArrowY = 0; else vue.mobileArrow = 0; };
  btn.addEventListener('pointerdown', start);
  btn.addEventListener('pointerup', stop);
  btn.addEventListener('pointercancel', stop);
  btn.addEventListener('pointerleave', stop);
}

// --- Pause hors champ / onglet cache -------------------------------------------------
// Inutile d'animer une scene que personne ne voit : la boucle s'arrete completement
// (rAF + slowTimer) des que la boite sort du viewport OU que l'onglet passe en arriere-plan,
// et ne reprend que si les deux conditions redeviennent vraies.
function pauseLoop() {
  if (paused) return;
  paused = true;
  wasRunningBeforeHide = vue.rafId !== null || slowTimer !== null;
  if (vue.rafId !== null) { cancelAnimationFrame(vue.rafId); vue.rafId = null; }
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

// Toutes les positions sont en px de la taille au moment du clic : si la LARGEUR
// change (rotation, fenetre), on revient simplement au logo net. La hauteur seule
// est ignoree, elle bouge a chaque apparition de la barre d'adresse sur mobile.
var lastWidth;
var resizeTimeout = null;

// Demarrage du module : appele une seule fois par principal.js, dans un ordre fixe.
function initMessages() {
  if (explainClose) explainClose.addEventListener('click', function (evt) { evt.stopPropagation(); hideExplain(); });
  if (explainAck) explainAck.addEventListener('click', function (evt) { evt.stopPropagation(); partie.leachTipSeen |= explainAckBit; hideExplain(); });
  if (deathBtn) deathBtn.addEventListener('click', function (evt) {
    evt.stopPropagation();
    if (!deathLocate || partie.mode !== 'exploded') return;
    // Glissement doux vers la position (clampe aux bornes), gere dans step().
    vue.camGoal = { x: clamp(deathLocate.x - vue.W / 2, 0, Math.max(0, vue.worldW - vue.W)), y: clamp(deathLocate.y - vue.H / 2, camMinY(), Math.max(camMinY(), vue.worldH - vue.H)) };
    hideExplain();
    startLoop();
  });
  if (factClose) factClose.addEventListener('click', function () { hideFact(false); });
}

// Demarrage du module : appele une seule fois par principal.js, dans un ordre fixe.
function initDefis() {
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
}

var magnetTx, magnetTy, magnetCx, magnetCy;
// Demarrage du module : appele une seule fois par principal.js, dans un ordre fixe.
function initBadge() {
  if (playBadge) {
    var MAGNET_MAX = 80;     // px, decalage max du badge
    var MAGNET_EASE = 0.09;  // lissage du suivi (pas de saut brusque)
    magnetTx = 0, magnetTy = 0, magnetCx = 0, magnetCy = 0;
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
}

// Demarrage du module : appele une seule fois par principal.js, dans un ordre fixe.
function initTutoriel() {
  try {
    var savedGuide = JSON.parse(localStorage.getItem(GUIDE_KEY) || 'null');
    if (savedGuide) for (var gk in guideFlags) if (savedGuide[gk] === true) guideFlags[gk] = true;
  } catch (e) { /* stockage indisponible : on repart du debut */ }
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
      if (!guideFlags.poured) for (var pc = 0; pc < monde.colonised.length; pc++) if (monde.colonised[pc].myc > 0 && underMatureTree(monde.colonised[pc].x)) { guideSet('poured'); break; }
      if (guideFlags.poured && partie.tool === 'hand') guideSet('hand');
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
}

// Demarrage du module : appele une seule fois par principal.js, dans un ordre fixe.
function initTresors() {
  try {
    partie.treasureDefs = JSON.parse(canvas.getAttribute('data-treasures') || '[]');
  } catch (e) {
    partie.treasureDefs = [];
  }
  partie.treasureDefs.forEach(function (def) {
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
}

// Demarrage du module : appele une seule fois par principal.js, dans un ordre fixe.
function initOutils() {
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
}

// Demarrage du module : appele une seule fois par principal.js, dans un ordre fixe.
function initTresorsUI() {
  if (demoEndEl) demoEndEl.addEventListener('click', function (evt) {
    if (evt.target.closest('[data-demo-continue]')) endDemo();
  });
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
  buildStrainBar();
}

// Demarrage du module : appele une seule fois par principal.js, dans un ordre fixe.
function initEvenements() {
  container.addEventListener('click', function (evt) {
    // Le bouton, les fleches et les infobulles sont dans la boite : leurs clics ne creusent pas.
    // (bug corrige : le bouton plein ecran manquait ici, un clic
    // dessus remontait jusqu'a ce listener et redeclenchait explode()/build() en plus
    // de l'action du bouton lui-meme.)
    if (evt.target.closest('#logo-explosion-rebuild, #logo-explosion-fullscreen, .logo-explosion-scroll, .logo-explosion-tip, .logo-explosion-shelf-cue,.logo-explosion-compass, .logo-explosion-tools, .logo-explosion-strains, .logo-explosion-treasures, .logo-explosion-challenges-badge, .logo-explosion-explain-locate, .logo-explosion-explain-close, .logo-explosion-explain-ack, .logo-explosion-end')) return;
    if (partie.mode === 'assembled') updateZoom(); // le zoom du monde qui va etre construit, avant de convertir le clic
    var pos = getRelativePos(evt);
    if (partie.mode === 'assembled') {
      // Seul un clic sur le logo (ou sa zone "play" juste en dessous) declenche
      // l'explosion : avant, n'importe quel clic dans la boite (meme le vide autour)
      // le faisait, ce qui ne correspond pas au curseur special affiche uniquement
      // au-dessus du logo.
      if (!evt.target.closest('#logo-explosion-fallback-wrap')) return;
      if (holdTouch) return; // au doigt : appui maintenu, voir plus bas
      // camX vient d'etre (re)centre par build() : + camX donne la position monde de
      // l'origine de l'explosion, coherente avec les coord. monde des facettes.
      if (partie.imgReady && build()) explode(pos.x + vue.camX, pos.y + vue.camY);
      return;
    }
    // Une fois explose, tout passe par les evenements pointer du canvas (pelle + taps).
  });
  if (holdWrap) {
    holdWrap.style.setProperty('--hold-ms', HOLD_MS + 'ms');
    holdWrap.addEventListener('pointerdown', function (evt) {
      holdTouch = evt.pointerType !== 'mouse';
      if (!holdTouch || partie.mode !== 'assembled' || !partie.imgReady) return;
      updateZoom();
      var pos = getRelativePos(evt);
      cancelHold();
      clearTimeout(holdHintTimer);
      holdWrap.classList.remove('is-hint');
      holdWrap.classList.add('is-holding');
      holdFollow(evt);
      holdTimer = setTimeout(function () {
        cancelHold();
        if (partie.mode === 'assembled' && build()) explode(pos.x + vue.camX, pos.y + vue.camY);
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
  canvas.addEventListener('pointerdown', function (evt) {
    if (partie.mode !== 'exploded') return;
    vue.edgeTouch = evt.pointerType !== 'mouse';
    var screenPos = getRelativePos(evt);
    var pos = { x: screenPos.x + vue.camX, y: screenPos.y + vue.camY };
    if (evt.pointerType === 'mouse') { vue.hoverScreenX = screenPos.x; vue.hoverScreenY = screenPos.y; }
    try { canvas.setPointerCapture(evt.pointerId); } catch (e) { /* pas grave */ }
    vue.pointerDown = pos;
    vue.dragMoved = false;
    // Clic sur un tresor pas encore deterre : rappelle comment creuser.
    var hintT = treasureGlintAt(evt);
    if (hintT) showDigTip(hintT);
    // Un clic sur la pelle plantee la prend quel que soit l'outil : la main se selectionne toute seule.
    if (partie.tool !== 'hand' && !shovel.on && shovelHit(pos.x, pos.y, evt.pointerType !== 'mouse')) setTool('hand');
    if (partie.tool === 'hand') {
      // La pelle plantee est prioritaire, mais seulement si le clic tombe sur elle (voir aussi plus haut : ce clic selectionne la main).
      if (!shovel.on && shovelHit(pos.x, pos.y, evt.pointerType !== 'mouse')) {
        leaveHand();
        vue.pressCaught = true;
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
      vue.pressCaught = !!bfly;
      if (bfly) {
        dropHeldInsect(); // un seul a la fois (appui multi-pointeurs)
        vue.heldSX = screenPos.x; vue.heldSY = screenPos.y;
        catchInsect(bfly);
      } else if (harvestableNear(pos.x, pos.y)) {
        // Cueillette des l'appui (pas seulement au relachement) : maintenir le clic fait aussi sortir le champignon.
        // Avant le tresor : un champignon a cueillir devant/pres d'un tresor deterre ne doit pas etre masque par lui.
        harvestAt(pos);
        vue.pressCaught = true;
      } else if ((vue.treasureGrab = grabTreasureAt(pos))) {
        vue.pressCaught = true; // un tresor deterre se deplace a la main : le champignon et la bulle suivent
      } else if (!handGrabTree(pos)) pickUpHand(pos);
      if (vue.pressCaught) hand.flash = performance.now();
      startLoop(); // le poing se ferme, meme sans rien dans la main
      return;
    }
    if (partie.tool === 'mycelium') {
      if (!partie.unlockedStrains.length) { setCaption(CAPTION_NEED_STRAIN); return; }
      if (!ensureBag()) { setCaption(CAPTION_NEED_MONEY); return; }
      guideSet('strain');
      if (!partie.mycFedOnce) {
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
    if (partie.tool === 'tree') return; // se plante au relachement (tap), pas d'outil traine au curseur
    if (partie.tool === 'fertilizer') { openTip(null); dropFertilizer(pos.x); return; }
    if (partie.tool === 'grass') { openTip(null); seedGrass(pos.x); return; }
  });
  canvas.addEventListener('pointermove', function (evt) {
    if (partie.mode !== 'exploded') return;
    vue.edgeTouch = evt.pointerType !== 'mouse';
    var screenPos = getRelativePos(evt);
    var pos = { x: screenPos.x + vue.camX, y: screenPos.y + vue.camY };
    if (evt.pointerType === 'mouse') { vue.hoverScreenX = screenPos.x; vue.hoverScreenY = screenPos.y; }
    if (partie.tool === 'mycelium') {
      if (!bag.on) enterBag(pos);
      bag.x = pos.x; bag.y = pos.y;
    } else if (partie.tool === 'hand') {
      if (shovel.on) {
        if (!shovel.released) { shovel.gx = pos.x; shovel.gy = pos.y; }
      } else if (!hand.on && (evt.pointerType === 'mouse' || vue.pointerDown)) { enterHand(pos); hand.touch = evt.pointerType !== 'mouse'; }
      hand.x = pos.x; hand.y = pos.y;
    } else if (partie.tool === 'fertilizer' && vue.pointerDown) {
      dropFertilizer(pos.x);
    } else if (partie.tool === 'grass' && vue.pointerDown) {
      seedGrass(pos.x);
    }
    if (vue.treasureGrab && vue.pointerDown && vue.dragMoved) { moveTreasure(vue.treasureGrab.t, pos.x + vue.treasureGrab.dx); }
    if (monde.heldInsect && vue.pointerDown) { vue.heldSX = screenPos.x; vue.heldSY = screenPos.y; }
    if (evt.pointerType === 'mouse') {
      canvas.style.cursor = (!shovel.on && shovelHit(pos.x, pos.y, false)) ? 'grab'
        : (partie.tool === 'hand' && insectAt(pos.x, pos.y)) ? 'pointer' : '';
    }
    if (evt.pointerType === 'mouse' && !vue.pointerDown) {
      // Survoler un tresor deja deterre rouvre son infobulle sans avoir a cliquer.
      var hoverT = treasureNear(pos.x, pos.y);
      // Pas de survol tant qu'un saviez-vous est affiche : il ne reviendrait pas (le clic ouvre quand meme).
      var onT = !!(hoverT && hoverT.revealed);
      if (onT && !hoverT.tipClosed && partie.factShown < 0) openTip(hoverT);
      tipAway(!onT);
      // Survoler le scintillement d'un tresor enfoui ouvre la bulle "creusez..." (sans minuterie).
      var glintT = treasureGlintAt(evt);
      if (glintT) showDigTip(glintT, true); else if (partie.digTipHover) hideDigTip();
    }
    if (vue.pointerDown && Math.hypot(pos.x - vue.pointerDown.x, pos.y - vue.pointerDown.y) > 6) vue.dragMoved = true;
    // Doigt appuye qui a glisse : sa position sert au defilement pres des bords, comme le survol souris.
    if (vue.edgeTouch && vue.pointerDown && vue.dragMoved) { vue.hoverScreenX = screenPos.x; vue.hoverScreenY = screenPos.y; }
    startLoop();
  });
  canvas.addEventListener('pointerup', function (evt) { endPress(evt, true); });
  canvas.addEventListener('pointercancel', function (evt) { endPress(evt, false); });
  window.addEventListener('blur', dropHeldInsect);
  canvas.addEventListener('pointerleave', function (evt) {
    if (evt.pointerType === 'mouse') tipAway(true); // vers la carte : son pointerenter annule
    if (evt.pointerType === 'mouse' && !vue.pointerDown) {
      leaveShovel();
      leaveBag();
      leaveHand();
      vue.hoverScreenX = null; vue.hoverScreenY = null;
    }
  });
  if (rebuildBtn) rebuildBtn.addEventListener('click', resetAllAndRebuild); // la fleche remet tout a zero (sauvegarde incluse), avec l'animation
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
  container.addEventListener('pointerdown', function () {
    if (partie.mode === 'exploded') compactHeaderForGame();
  });
  if (siteHeader) {
    document.addEventListener('pointermove', function (evt) {
      // evt.buttons : pas de depliage pendant qu'on joue (outil appuye) pres du haut.
      if (evt.pointerType !== 'mouse' || evt.buttons || partie.mode !== 'exploded') return;
      var r = siteHeader.getBoundingClientRect();
      // contains : le mini-panier ouvert deborde du rectangle du header.
      setHeaderHover(siteHeader.contains(evt.target) || (evt.clientX >= r.left && evt.clientX <= r.right && evt.clientY >= r.top && evt.clientY <= r.bottom));
    });
    document.documentElement.addEventListener('mouseleave', function () {
      if (partie.mode === 'exploded') setHeaderHover(false);
    });
  }
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
  // La fleche d'invite reste tant que le mycelium n'a pas ete nourri de bois (voir mycFedOnce).
  for (var ti = 0; ti < toolBtns.length; ti++) {
    toolBtns[ti].addEventListener('click', function () { setTool(this.getAttribute('data-tool')); });
  }
  // Slider de debug : accelere le cycle bois/mycelium/arbres (voir vTime) pour experimenter
  // sans attendre les minutes reelles de decomposition/croissance.
  if (speedInput) {
    speedInput.addEventListener('input', function () {
      temps.timeScale = parseFloat(this.value) || 1;
      if (speedVal) speedVal.textContent = temps.timeScale + '×';
      startLoop();
    });
  }
  // Bouton de vitesse pour les visiteurs : boucle normal -> x3 -> x10 (meme timeScale que
  // le curseur du panneau d'options, qu'on garde synchronise).
  if (speedBtn) {
    var SPEED_LEVELS = [1, 3, 10];
    speedBtn.addEventListener('click', function () {
      var i = SPEED_LEVELS.indexOf(temps.timeScale);
      temps.timeScale = SPEED_LEVELS[(i + 1) % SPEED_LEVELS.length];
      speedBtn.querySelector('.logo-explosion-speed-btn-val').textContent = '×' + temps.timeScale;
      speedBtn.classList.toggle('is-fast', temps.timeScale > 1);
      speedBtn.setAttribute('aria-label', 'Vitesse de simulation : ' + (temps.timeScale === 1 ? 'normale' : 'x' + temps.timeScale));
      speedBtn.querySelector('.spd-2').style.display = temps.timeScale > 1 ? '' : 'none';
      speedBtn.querySelector('.spd-3').style.display = temps.timeScale === 10 ? '' : 'none';
      if (speedInput) speedInput.value = temps.timeScale;
      if (speedVal) speedVal.textContent = temps.timeScale + '×';
      startLoop();
    });
  }
  if (grassNutriInput) {
    grassNutriInput.addEventListener('input', function () {
      var v = parseFloat(this.value);
      temps.grassNutriMult = v >= 0 ? v : 0;
    });
  }
  if (grassMycNutriInput) {
    grassMycNutriInput.addEventListener('input', function () {
      var v = parseFloat(this.value);
      temps.grassMycNutriMult = v >= 0 ? v : 0;
    });
    var v = parseFloat(grassMycNutriInput.value);
    temps.grassMycNutriMult = v >= 0 ? v : 0;
  }
  // Frequence de la pluie naturelle (voir le cycle meteo pres de updateWeather) : 0 = ne
  // pleut jamais, 100 = averses longues et frequentes.
  if (rainInput) {
    rainInput.addEventListener('input', function () {
      temps.rainLevel = (parseFloat(this.value) || 0) / 100;
      if (temps.rainLevel <= 0) stopShower();
    });
  }
  // Frequence de la secheresse naturelle (voir DROUGHT_* et updateWeather) : 0 = ne seche
  // jamais, 100 = secheresses longues et frequentes. Independant du curseur Pluie ; les deux
  // restent mutuellement exclusifs cote simulation (voir startShower).
  if (droughtInput) {
    droughtInput.addEventListener('input', function () {
      temps.droughtLevel = (parseFloat(this.value) || 0) / 100;
      if (temps.droughtLevel <= 0) weather.drought = false;
      updateDroughtIndicator();
    });
  }
  // Frequence des tempetes (voir STORM_* et updateWeather) : averses normales qui
  // s'intensifient ponctuellement (lessivage x STORM_LEACH_MULT). N'existe que PENDANT une
  // averse deja en cours ; 0 = jamais de tempete, juste de la pluie normale.
  if (stormInput) {
    stormInput.addEventListener('input', function () {
      temps.stormLevel = (parseFloat(this.value) || 0) / 100;
      if (temps.stormLevel <= 0) weather.storm = false;
      updateStormIndicator();
    });
  }
  bindScrollArrow(scrollLeftBtn, -1);
  bindScrollArrow(scrollRightBtn, 1);
  bindScrollArrow(scrollUpBtn, -1, true);
  bindScrollArrow(scrollDownBtn, 1, true);
  lastWidth = container.getBoundingClientRect().width;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(function () {
      var w = container.getBoundingClientRect().width;
      if (w === lastWidth) return;
      lastWidth = w;
      if (vue.rafId !== null) { cancelAnimationFrame(vue.rafId); vue.rafId = null; }
      resetToLogo();
    }, 200);
  });
}

// Demarrage du module : appele une seule fois par principal.js, dans un ordre fixe.
function initDebug() {
  if (debugToggleBtn) {
    debugToggleBtn.addEventListener('click', function () {
      buildDebugPanel();
      var opening = debugPanel.classList.contains('d-none');
      debugPanel.classList.toggle('d-none', !opening);
      debugToggleBtn.classList.toggle('is-active', opening);
      debugToggleBtn.setAttribute('aria-pressed', opening ? 'true' : 'false');
    });
  }
}

// Demarrage du module : appele une seule fois par principal.js, dans un ordre fixe.
function initPhysique() {
  if ('IntersectionObserver' in window) {
    var visibilityObserver = new IntersectionObserver(function (entries) {
      inViewport = entries[entries.length - 1].isIntersecting;
      updateVisibility();
    });
    visibilityObserver.observe(container);
  }
  document.addEventListener('visibilitychange', updateVisibility);
}

// Demarrage : meme ordre a chaque etape du decoupage.
initEtat();
initMessages();
initDefis();
initBadge();
initTutoriel();
initTresors();
initTerrain();
initSauvegarde();
initOutils();
initArbres();
initTresorsUI();
initEvenements();
initDebug();
initPhysique();
