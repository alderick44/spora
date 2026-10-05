// Sauvegarde : progression du joueur et monde dans localStorage, remise a zero.
import {
  MONEY_MAX, WORLD_KEY, WORLD_VERSION, CH_HARVEST_GOAL, MYC_SAVE_MAX, TREES_SAVE_MAX, MATURE_NUTRIENTS,
  TALL_FULL, COL_W, LEAF_LIFE_MS, DEMO_KEY, STRAIN_STD
} from './config.js';
import { partie, vue, monde, temps, DEMO_PAGE, container, moneyEl } from './etat.js';
import { resetTiles } from './rendu.js';
import { surfaceAt, isRocky, isSubmerged, rebuildLakesFromRocky, pileRemove } from './terrain.js';
import {
  FACTS, CHALLENGES, updateChallengeUI, strainOrder, updateMoneyUI, makeTree, unlockedSlots, addLeaf,
  guideReset, resetPatches, refreshStrainBar, rebuild, infect, strainById
} from './principal.js';

var playerSig = null;
function knownTitle(t) { return typeof t === 'string' && partie.treasureDefs.some(function (d) { return d.title === t; }); }
export function foundList() {
  var out = partie.skippedFound.concat(partie.restoredFound);
  partie.treasures.forEach(function (t) { if (t.revealed && out.indexOf(t.def.title) === -1) out.push(t.def.title); });
  return out;
}
function playerState() {
  partie.treasures.forEach(function (t) { if (t.revealed && vue.worldW > 0) partie.foundFx[t.def.title] = Math.round(t.x / vue.worldW * 1000) / 1000; });
  return { money: Math.min(MONEY_MAX, Math.max(0, Math.floor(partie.money) || 0)), revealed: partie.moneyRevealed ? 1 : 0, freeBag: partie.usedFreeBag ? 1 : 0, strains: partie.unlockedStrains.slice(), bag: partie.bagStrain, found: foundList(), leachTips: partie.leachTipSeen, facts: partie.factSeen, ch: partie.chDone, chTrees: partie.chPlanted, chHarv: partie.chHarv.slice(), freeTrees: partie.freeTrees, fx: partie.foundFx };
}
function playerSigOf(p) { return p.money + '|' + p.revealed + '|' + p.freeBag + '|' + p.strains.join() + '|' + p.bag + '|' + p.found.join('/') + '|' + p.leachTips + '|' + p.facts + '|' + p.ch + '|' + p.chTrees + '|' + p.chHarv.join() + '|' + p.freeTrees + '|' + JSON.stringify(p.fx); }
function restorePlayer() {
  try {
    var d = JSON.parse(localStorage.getItem(WORLD_KEY)), p = d && d.v === WORLD_VERSION ? d.player : null;
    if (!p || typeof p !== 'object') return;
    if (typeof p.money === 'number' && isFinite(p.money)) partie.money = Math.min(MONEY_MAX, Math.max(0, Math.floor(p.money)));
    partie.moneyRevealed = !!p.revealed || partie.money > 0;
    partie.usedFreeBag = !!p.freeBag;
    partie.leachTipSeen = (p.leachTips | 0) & 31;
    partie.factSeen = (p.facts | 0) & ((1 << FACTS.length) - 1);
    partie.chDone = (p.ch | 0) & ((1 << CHALLENGES.length) - 1);
    partie.chPlanted = Math.max(0, Math.min(999, p.chTrees | 0));
    for (var hi = 0; hi < 3; hi++) partie.chHarv[hi] = Array.isArray(p.chHarv) ? Math.max(0, Math.min(CH_HARVEST_GOAL, p.chHarv[hi] | 0)) : 0;
    partie.freeTrees = Math.max(0, Math.min(99, p.freeTrees | 0));
    updateChallengeUI();
    if (p.fx && typeof p.fx === 'object') Object.keys(p.fx).forEach(function (k) { if (knownTitle(k) && typeof p.fx[k] === 'number' && isFinite(p.fx[k])) partie.foundFx[k] = Math.max(0, Math.min(1, p.fx[k])); });
    // Les souches suivent le NOMBRE de tresors deterres (1er = strophaire, 2e = pleurote...) : on ignore
    // la liste sauvee, qui pouvait contenir le strophaire d'office (ancienne version).
    // On ne compte que les titres CONNUS et uniques (un ancien titre, ex. 'Mycélium en vrac', decalait l'ordre).
    if (Array.isArray(p.found)) partie.restoredFound = p.found.filter(function (t, i) { return knownTitle(t) && p.found.indexOf(t) === i; });
    partie.unlockedStrains = strainOrder.slice(0, partie.restoredFound.length).map(function (st) { return st.id; });
    partie.bagStrain = partie.unlockedStrains.indexOf(p.bag) !== -1 ? p.bag : (partie.unlockedStrains[0] || 'standard');
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
    if (worldKeyHeld && localStorage.getItem(WORLD_KEY) === null) partie.worldSaveOff = true;
  } catch (e) { /* stockage indisponible */ }
  return partie.worldSaveOff;
}
export function savePlayerIfChanged() {
  if (partie.worldSaveOff || wipedElsewhere()) return;
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
// Signature bon marche de l'etat du terrain et du mycelium, pour detecter qu'il a change.
export function terrainSig() {
  var s = monde.colonised.length * 0.37 + monde.trees.length * 1.13;
  for (var c = 0; c < monde.heights.length; c++) s += monde.heights[c] * (c % 7 + 1) + monde.compactY[c] * (c % 5 + 2);
  return s;
}
// Tableau plat [x, profondeur sous la surface, myc*100, indice de souche] par facette
// posee et vivante ; les souches sont listees a part par id. Filaments, horloges, parents
// et champignons ne sont pas gardes (ils se regenerent depuis le mycelium restaure).
function saveMycelium() {
  var flat = [], strains = [];
  for (var i = 0; i < monde.colonised.length && flat.length < MYC_SAVE_MAX * 4; i++) {
    var s = monde.colonised[i];
    if (!s.settled || s.deadMyc || !(s.myc > 0)) continue;
    var id = s.strain && s.strain.id !== 'standard' ? s.strain.id : '', si = strains.indexOf(id);
    if (si < 0) si = strains.push(id) - 1;
    flat.push(Math.round(s.x), Math.round(s.y - surfaceAt(s.x)), Math.round(Math.min(1, s.myc) * 100), si);
  }
  return { myc: flat, strains: strains };
}
var worldEaten = 0;         // somme des nutriments manges a la derniere sauvegarde (croissance seule ne declenche pas la sauvegarde, sauf a la fermeture)
function eatenSum() { var n = 0; for (var i = 0; i < monde.trees.length; i++) n += monde.trees[i].eaten; return n; }
function saveTrees() {
  return monde.trees.slice(0, TREES_SAVE_MAX).map(function (t) {
    return { x: Math.round(t.x), e: Math.min(MATURE_NUTRIENTS, Math.max(0, Math.round(t.eaten) || 0)), s: Math.min(TALL_FULL, Math.max(0, Math.round(t.surplus) || 0)), p: t.planted ? 1 : 0, g: t.tuto ? 1 : 0 };
  });
}
// Colonne valide la plus proche de x (terrain restaure : roche exposee ou lac) dans un
// rayon de 15 colonnes ; null si aucune.
export function nearestTreeX(x) {
  for (var k = 0; k <= 15; k++) {
    for (var sg = -1; sg <= 1; sg += 2) {
      var cx = x + sg * k * COL_W;
      if (cx >= 0 && cx <= (monde.heights.length - 1) * COL_W && !isRocky(cx) && !isSubmerged(cx)) return cx;
    }
  }
  return null;
}
// Recree les arbres sauves ; entrees invalides ignorees. Un arbre plante par le joueur
// n'est jamais ecarte : decale a la colonne valide la plus proche, sinon garde tel quel.
export function makeSavedTrees(list) {
  var out = [];
  list.slice(0, TREES_SAVE_MAX).forEach(function (o) {
    if (!o || typeof o.x !== 'number' || !isFinite(o.x) || typeof o.e !== 'number' || !isFinite(o.e)) return;
    var x = Math.max(0, Math.min((monde.heights.length - 1) * COL_W, o.x)), planted = !!o.p;
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
    for (var k = 8; k < Math.round(unlockedSlots(t) * 0.7); k++) addLeaf(t, temps.vTime - Math.random() * LEAF_LIFE_MS[0] * 0.6);
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
  t.slots.forEach(function (sl) { if (sl.leaf && temps.vTime >= sl.leaf.born) leaves.push(sl.leaf); });
  var n = Math.min(leaves.length, Math.max(4, Math.round(4 + 4 * t.growth)));
  for (var i = 0; i < n; i++) leaves[i].born = temps.vTime - leaves[i].life * (0.8 + 0.18 * i / n);
}
export function saveWorld() {
  if (wipedElsewhere()) return;
  try {
    var n = monde.heights.length, h = new Array(n), cy = new Array(n), r = new Array(n);
    for (var c = 0; c < n; c++) {
      h[c] = Math.round(monde.heights[c] * 10) / 10;
      cy[c] = Math.round(monde.compactY[c] * 10) / 10;
      r[c] = monde.rocky[c] ? 1 : 0;
    }
    var m = saveMycelium(), p = playerState();
    localStorage.setItem(WORLD_KEY, JSON.stringify({ v: WORLD_VERSION, zoom: vue.ZOOM, cols: n, heights: h, compactY: cy, rocky: r, myc: m.myc, strains: m.strains, trees: saveTrees(), player: p }));
    worldKeyHeld = true;
    partie.worldSig = terrainSig();
    worldEaten = eatenSum();
    playerSig = playerSigOf(p);
  } catch (e) { /* stockage indisponible (mode prive, quota) : on joue sans */ }
}
// Sauve si le terrain a change depuis la derniere sauvegarde. Appelee toutes les 1,5 s :
// on attend que la signature soit stable d'un passage a l'autre (pause d'activite).
function saveWorldIfIdle(force) {
  if (partie.worldSaveOff || partie.mode !== 'exploded' || !monde.heights.length) return;
  var sig = terrainSig();
  if ((sig !== partie.worldSig && (force || sig === partie.worldSigPrev)) || (force && eatenSum() !== worldEaten)) saveWorld();
  partie.worldSigPrev = sig;
}
function saveAll(force) { saveWorldIfIdle(force); savePlayerIfChanged(); }
// Fleche de reconstruction : efface la sauvegarde ET l'etat du joueur en memoire, puis joue
// l'animation de reconstruction du logo (le prochain monde repart de zero, pas de la cle).
export function resetAllAndRebuild() {
  try { localStorage.removeItem(DEMO_KEY); } catch (e) { /* rien a effacer */ }
  partie.DEMO = DEMO_PAGE;
  container.classList.toggle('is-demo', partie.DEMO);
  try { localStorage.removeItem(WORLD_KEY); } catch (e) { /* rien a effacer */ }
  guideReset();
  worldKeyHeld = false;
  partie.money = 0; partie.moneyRevealed = false; partie.usedFreeBag = false; partie.bagGrainsLeft = 0;
  partie.unlockedStrains = []; partie.bagStrain = 'standard';
  resetPatches();
  partie.leachTipSeen = 0; monde.grassLost = 0; partie.factSeen = 0; partie.branchTorn = false; partie.chDone = 0; partie.chPlanted = 0; partie.chHarv = [0, 0, 0]; partie.freeTrees = 0; partie.chPending = []; partie.chHoldSince = [0, 0, 0];
  updateChallengeUI();
  partie.restoredFound = []; partie.skippedFound = []; partie.foundFx = {}; partie.restoredTrees = null;
  playerSig = playerSigOf(playerState());
  if (moneyEl) moneyEl.classList.add("d-none");
  updateMoneyUI();
  refreshStrainBar(); // redessine les souches verrouillees (la barre ne suit pas la liste toute seule)
  rebuild();
}
// Recolonise, a peu pres au meme endroit, les facettes du lit de terre (les seules qui
// existent a ce stade) : la plus proche du point sauve (x, profondeur sous la surface
// restauree), a 12 px au plus ; sans facette, ou sur la roche, l'entree est ignoree.
// Facettes remises a un etat neutre : horloge de faim neuve, sans parent ni champignon.
function restoreMycelium(d) {
  if (!Array.isArray(d.myc) || d.myc.length % 4) return;
  var strains = Array.isArray(d.strains) ? d.strains : [], byCol = {}, i;
  for (i = 0; i < monde.shards.length; i++) {
    var s = monde.shards[i];
    if (s.settled && s.soil) (byCol[s.col] = byCol[s.col] || []).push(s);
  }
  for (i = 0; i < d.myc.length; i += 4) {
    var x = d.myc[i], dep = d.myc[i + 1], v = d.myc[i + 2] / 100;
    if (!isFinite(x) || !isFinite(dep) || !isFinite(v)) continue;
    var col = Math.round(x / COL_W);
    if (col < 0 || col >= monde.heights.length || monde.rocky[col]) continue;
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
    infect(best, best.x, best.y, Math.max(0.05, Math.min(1, v)), temps.vTime, temps.vTime, null, strainById[id || 'standard'] || STRAIN_STD);
  }
}
// Appelee a la place de la generation des roches. Retourne true si un terrain sauve valide
// (meme version, meme nombre de colonnes) a ete applique ; sinon ne touche a rien.
export function restoreWorld() {
  resetTiles();
  var n = monde.heights.length;
  try {
    var d = JSON.parse(localStorage.getItem(WORLD_KEY));
    // Positions en px logiques : valables seulement pour le meme zoom (sans champ = ancienne sauvegarde, zoom 1).
    if (!d || d.v !== WORLD_VERSION || d.cols !== n || (d.zoom === undefined ? 1 : d.zoom) !== vue.ZOOM) return false;
    var arrs = [d.heights, d.compactY, d.rocky];
    for (var a = 0; a < 3; a++) {
      if (!Array.isArray(arrs[a]) || arrs[a].length !== n) return false;
      for (var i = 0; i < n; i++) if (typeof arrs[a][i] !== 'number' || !isFinite(arrs[a][i])) return false;
    }
    monde.rocky = new Uint8Array(n);
    for (var c = 0; c < n; c++) {
      monde.rocky[c] = d.rocky[c] ? 1 : 0;
      monde.compactY[c] = d.compactY[c];
    }
    rebuildLakesFromRocky();
    // heights n'est PAS restaure : il vient des facettes de terre fraichement recreees par
    // setupSoil (sinon de la terre fantome sans facette a ramasser). On retire donc
    // proprement (pileRemove) les facettes du lit posees sur la roche.
    monde.shards = monde.shards.filter(function (s) {
      if (s.soil && monde.rocky[s.col]) { pileRemove(s); return false; }
      return true;
    });
    // Colonnes creusees : les facettes du lit qui flottent au-dessus du sol restaure
    // retombent (meme logique que le balayage des facettes posees).
    monde.shards.forEach(function (s) {
      if (s.soil && s.settled && s.kcol && s.y < surfaceAt(s.x) - 6) { pileRemove(s); s.settled = false; }
    });
    try { restoreMycelium(d); } catch (e2) { /* mycelium illisible : le terrain reste restaure */ }
    partie.restoredTrees = Array.isArray(d.trees) && d.trees.length ? d.trees : null;
    partie.worldSig = partie.worldSigPrev = terrainSig();
    return true;
  } catch (e) {
    return false;
  }
}

// Demarrage du module : appele une seule fois par principal.js, dans un ordre fixe.
export function initSauvegarde() {
  setInterval(function () { if (!document.hidden) saveAll(false); }, 1500);
  document.addEventListener('visibilitychange', function () { if (document.hidden) saveAll(true); });
  window.addEventListener('pagehide', function () { saveAll(true); });
  restorePlayer();
  try { worldKeyHeld = localStorage.getItem(WORLD_KEY) !== null; } catch (e) { /* stockage indisponible */ }
  if (playerSig === null) playerSig = playerSigOf(playerState()); // pas de sauvegarde : l'etat de depart n'est pas un changement a ecrire
  // Un reset fait dans un autre onglet efface la cle : cet onglet arrete de sauver son ancien
  // monde (sinon il la reecrit dans la seconde qui suit) et se recharge.
  window.addEventListener('storage', function (e) {
    if (e.key === WORLD_KEY && e.newValue === null && !partie.worldSaveOff) {
      partie.worldSaveOff = true;
      location.reload();
    }
  });
  window.sporaResetWorld = function () {
    try { localStorage.removeItem(DEMO_KEY); } catch (e) { /* rien a effacer */ }
    partie.worldSaveOff = true;
    try { localStorage.removeItem(WORLD_KEY); } catch (e) { /* rien a effacer */ }
    guideReset();
    location.reload();
  };
}
