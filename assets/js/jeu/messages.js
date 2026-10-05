// Messages au joueur : legende, conseils, saviez-vous et alertes de colonie.
import { clamp } from './utils.js';
import {
  MYC_READY, LEACH_TIP_QUIET_MS, LEACH_TIP_GAP_MS, DEATH_ALERT_SHOW_MS, EXPLAIN_MS, PATCH_SNAP_MS,
  PATCH_LINK, STRAIN_STD, PATCH_WINDOW_MS, PATCH_MIN_SIZE, PATCH_MIN_DEATHS, PATCH_SHARE, PATCH_REARM_MS,
  DEATH_ALERT_STALE_MS, DEATH_ALERT_GAP_MS, DEATH_TEXTS, FACT_MS, FACT_AFTER_EXPLAIN_MS, FACT_FIRST_MS,
  FACT_GAP_MS, CAPTION_BEFORE
} from './config.js';
import { partie, monde, caption, vue } from './etat.js';
import { savePlayerIfChanged } from './sauvegarde.js';
import { weather } from './meteo.js';
import { challengeTick } from './defis.js';
import { guideCurrent } from './tutoriel.js';
import { startLoop } from './physique.js';
import { camMinY } from './principal.js';

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
export function msgBlocked(t) {
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
export function snapshotPatches(now) {
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
export function notePatchDeath(c, cause) {
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
export function flushDeathAlert() {
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
export function msgTick() {
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
export function hideMsgs() { hideExplain(); hideFact(true); }
export function setCaption(text, keepFact, sticky) {
  if (!caption) return;
  clearTimeout(captionTimer);
  if (!text) { caption.classList.remove('is-visible'); return; }
  if (text !== CAPTION_BEFORE && !keepFact) hideFact(true); // une instruction passe toujours avant
  caption.textContent = text;
  caption.classList.add('is-visible');
  if (text !== CAPTION_BEFORE && !sticky) captionTimer = setTimeout(function () { caption.classList.remove('is-visible'); }, 6000);
}

// Demarrage du module : appele une seule fois par principal.js, dans un ordre fixe.
export function initMessages() {
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
