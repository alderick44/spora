// Arbres : plantation, croissance, feuilles, racines et leur dessin.
import { lerp, hexToRgb, rgbStr, easeOutBack } from './utils.js';
import {
  MYC_HALO_GROWTH, MYC_NEAR_TREE, MYC_UNDER_TREE, DEMO_GUARD_TREASURE, MYC_DECOMPOSE_REACH, CANOPY_LIMBS,
  CANOPY_CLUSTER_R, ROOT_VISUAL_REACH, CAMERA_TOP_DEADZONE, EAT_MS, LEAF_LIFE_MS, COL_W, MATURE_NUTRIENTS,
  LEAF_UNLOCK_MIN, TREE_SCALE_MIN, TREE_SCALE_MAX, TALL_SCALE_MAX, TALL_FULL, TREE_MIN_SPACING, NUTRI,
  TREE_EMBED, LEAF_AGES, TREE_BY_FOLLOW, LIMB_REGROW_MS, BONUS_BRANCH_LIFE_MS, LEAF_GROW_MS,
  SMALL_WIND_MULT, TALL_WIND_MULT, ROOT_GROWTH_MIN, ROOT_REACH, ROOT_DEPTH_MIN, ROOT_DEPTH_MAX,
  ABUNDANCE_THRESHOLD, ABUNDANCE_EAT_MULT, EATEN_MS, ABUNDANCE_LEAF_FILL, BONUS_BRANCH_COST,
  BONUS_BRANCH_MAX, TREE_STARVE_MS, TREE_SHRINK_MS, MYC_READY, CAPTION_MYC_FED, MYC_DECOMPOSE_MULT,
  FEED_FRUIT_WET_MS, FEED_FRUIT_MAX, FEED_FRUIT_PER_S, FEED_FRUIT_WET_MULT, STRAIN_STD, BRANCH_LITTER_MS,
  LITTER_MS, WOOD_NUTRI_AREA, ROOT_COLORS, LIMB_COLORS, BRANCH_GROW_MS
} from './config.js';
import { monde, partie, temps, vue, ctx } from './etat.js';
import { poly } from './rendu.js';
import { surfaceAt, isRocky, isSubmerged, pileRemove, triArea } from './terrain.js';
import { nearestTreeX, savePlayerIfChanged, saveWorld } from './sauvegarde.js';
import { weather } from './meteo.js';
import { isNutriRipe, spawnFlower, spawnNutrientShard, toEarthColor } from './flore.js';
import { sprout } from './mycelium.js';
import { nextTreeCost, updateMoneyUI } from './economie.js';
import { leafAgeOf, hand, handTension } from './outils.js';
import { guideFlags, guideCurrent, startLoop, setCaption, guideSet } from './principal.js';

var lastRainAt = -1e9;
export function matureTrees() {
  var out = [];
  for (var i = 0; i < monde.trees.length; i++) if (monde.trees[i].growth >= MYC_HALO_GROWTH) out.push(monde.trees[i]);
  return out;
}
export function drawMycHalo() {
  var gs = guideCurrent();
  if (!gs || !gs.halo || !partie.unlockedStrains.length) return;
  var pulse = 0.5 + 0.5 * Math.sin(temps.vTime / 420);
  var list = matureTrees();
  for (var i = 0; i < list.length; i++) {
    var hx = list[i].x, hy = surfaceAt(hx), rr = vue.U * 0.07 * (0.9 + 0.2 * pulse);
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
  for (var i = 0; i < monde.trees.length; i++) if (monde.trees[i].growth >= MYC_HALO_GROWTH && Math.abs(monde.trees[i].x - x) < MYC_NEAR_TREE) return true;
  return false;
}
export function demoGuard(x) {
  if (!partie.DEMO) return false;
  var r = Math.min(MYC_UNDER_TREE, vue.UW * 0.1), i, hit = false;
  for (i = 0; i < monde.trees.length && !hit; i++) hit = !!monde.trees[i].tuto && Math.abs(monde.trees[i].x - x) < r;
  if (!hit) return false;
  for (i = 0; i < partie.treasures.length; i++) if (!partie.treasures[i].revealed && Math.abs(partie.treasures[i].x - x) < DEMO_GUARD_TREASURE) return false;
  return true;
}
export function underMatureTree(x) {
  for (var i = 0; i < monde.trees.length; i++) if (monde.trees[i].growth >= MYC_HALO_GROWTH && Math.abs(monde.trees[i].x - x) < MYC_UNDER_TREE) return true;
  return false;
}
export function noWoodNear(x) {
  var i;
  for (i = 0; i < monde.trees.length; i++) if (monde.trees[i].growth >= MYC_HALO_GROWTH && Math.abs(monde.trees[i].x - x) < MYC_DECOMPOSE_REACH * 1.6) return false;
  for (i = 0; i < monde.litter.length; i++) if (Math.abs(monde.litter[i].x - x) < MYC_DECOMPOSE_REACH) return false;
  return true;
}

// --- Arbres -----------------------------------------------------------------------
export function makeTree(x) {
  var now = temps.vTime, slots = [], DEG = Math.PI / 180;
  var rx = vue.U * 0.2, ry = vue.U * 0.13;
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
    var sa = Math.random() * Math.PI * 2, sr = Math.sqrt(Math.random()) * CANOPY_CLUSTER_R * vue.U, lm = limbs[i % CANOPY_LIMBS];
    slots.push({ dx: lm.dx + Math.cos(sa) * sr, dy: lm.dy + Math.sin(sa) * sr * 0.8, leaf: null, limb: i % CANOPY_LIMBS });
  }
  // Racines dessinees : 6 racines laterales alternees gauche/droite, qui partent en
  // biais (20-45 deg sous l'horizontale) et plongent de plus en plus (gravitropisme),
  // chacune avec une fourche. Longueur volontairement plus courte que la portee de
  // recherche de nutriment (voir ROOT_VISUAL_REACH plus haut). Points pre-calcules ici :
  // rien ne bouge d'une frame a l'autre. Chaque racine = { pts, forkAt, fork }.
  var roots = [], reach = vue.U * ROOT_VISUAL_REACH;
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
  var t = { x: x, h: (vue.U - CAMERA_TOP_DEADZONE) * 0.42, slots: slots, limbs: limbs, roots: roots, nextEat: now + EAT_MS, eaten: 0, growth: 0, lastAte: now, flowers: [] };
  // Quelques feuilles au depart, d'ages varies : on reconnait un arbre tout de suite.
  for (i = 0; i < 8; i++) addLeaf(t, now - Math.random() * LEAF_LIFE_MS[0] * 0.6);
  return t;
}

// Arbre de depart deja bien nourri (presque mature), avec un feuillage fourni.
export function makeStartTree(x, eaten) {
  // Cherche vers la gauche (on reste au bord de l'ecran, loin du tas du logo) une zone
  // sans roche ni eau sur 4 colonnes de chaque cote.
  var maxX = (monde.heights.length - 1) * COL_W, nx = null, cx, d, ok;
  for (cx = x; cx >= x - vue.UW * 0.2 && nx === null; cx -= COL_W) {
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
  for (var k = 8; k < Math.round(unlockedSlots(t) * 0.7); k++) addLeaf(t, temps.vTime - Math.random() * LEAF_LIFE_MS[0] * 0.6);
  return t;
}

// Nombre de places de feuilles utilisables : monte de LEAF_UNLOCK_MIN a toutes les
// places (t.slots.length) a mesure que l'arbre grandit (t.growth).
export function unlockedSlots(t) {
  return Math.round(lerp(LEAF_UNLOCK_MIN, t.slots.length, t.growth));
}

// Echelle du tronc/houppier : petit a la naissance, et nettement plus grand que la
// taille de reference une fois bien nourri (TREE_SCALE_MAX > 1).
export function treeScale(t) {
  return lerp(TREE_SCALE_MIN, TREE_SCALE_MAX, t.growth) + TALL_SCALE_MAX * treeTall(t);
}
function treeTall(t) { return Math.min(1, (t.surplus || 0) / TALL_FULL); }

// Plante un nouvel arbre (TREE_COST) si on n'est pas trop pres d'un autre
// (TREE_MIN_SPACING). Pas de plafond : seul le prix limite le nombre.
export function plantTree(x) {
  if (isRocky(x) || isSubmerged(x)) return false;
  for (var i = 0; i < monde.trees.length; i++) {
    if (Math.abs(monde.trees[i].x - x) < TREE_MIN_SPACING) return false;
  }
  var cost = nextTreeCost(), useFree = cost > 0 && partie.freeTrees > 0;
  if (!useFree && partie.money < cost) { setCaption('Il faut ' + cost + ' $ pour planter un arbre — récoltez des champignons à la main.'); return false; }
  if (useFree) partie.freeTrees--; else partie.money -= cost;
  updateMoneyUI();
  var planted = makeTree(x);
  planted.planted = true;
  monde.trees.push(planted);
  partie.chPlanted++;
  savePlayerIfChanged();
  if (!partie.worldSaveOff) saveWorld(); // sauvegarde immediate : un arbre paye ne doit pas se perdre
  if (window.sporaSfx) sporaSfx.play('plant'); 
  monde.treeLife = true;
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
    monde.compactNutri.splice(monde.compactNutri.indexOf(item.ref), 1);
  }
}

// Une place peut recevoir une feuille si elle est vide et que sa branche maitresse n'est
// pas cassee (voir breakLimb).
function slotOpen(t, sl) {
  return !sl.leaf && !(sl.limb !== undefined && t.limbs[sl.limb].broken !== undefined);
}

// Facette d'une feuille qui quitte son arbre (chute naturelle, ou arrachee a la main),
// couleur de son age (0..1) ; posee ensuite comme n'importe quelle feuille (litiere).
export function makeLeafShard(lf, x, y, age, wm) {
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
export function makeWoodShard(x, y, pts) {
  pts = pts || leafTri(vue.U * 0.05, Math.random() * Math.PI * 2);
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
export function shedBranchSlot(t, sl, now, woodPts, leafByAge) {
  var tg = treeScale(t), by = t.by !== undefined ? t.by : surfaceAt(t.x) + TREE_EMBED;
  var x = t.x + sl.dx * tg, y = by - t.h * tg + sl.dy * tg;
  // La fleur (s'il y en a une) fane avec sa branche, elle ne disparait pas d'un coup.
  if (sl.flower && sl.flower.wilt === null) sl.flower.wilt = now;
  if (sl.leaf) monde.shards.push(makeLeafShard(sl.leaf, x, y, leafByAge ? leafAgeOf(sl.leaf, now) : 1));
  sl.leaf = null;
  var wood = makeWoodShard(x, y, woodPts);
  monde.shards.push(wood);
  return wood;
}

export function addLeaf(t, born) {
  var free = t.slots.slice(0, unlockedSlots(t)).filter(function (sl) { return slotOpen(t, sl); });
  if (!free.length) return false;
  free[(Math.random() * free.length) | 0].leaf = {
    born: born, life: lerp(LEAF_LIFE_MS[0], LEAF_LIFE_MS[1], Math.random()),
    rot: Math.random() * Math.PI * 2, size: vue.U * (0.028 + Math.random() * 0.016)
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
export function stepTrees(now) {
  var state = 0, i;
  for (var ti = 0; ti < monde.trees.length; ti++) {
    var t = monde.trees[ti];
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
      monde.shards.push(makeLeafShard(lf, t.x + sl.dx * tg, by - t.h * tg + sl.dy * tg, 1, lerp(SMALL_WIND_MULT, 1, t.growth) + (TALL_WIND_MULT - 1) * treeTall(t)));
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
      var reach = vue.UW * ROOT_REACH * g, depthReach = vue.U * lerp(ROOT_DEPTH_MIN, ROOT_DEPTH_MAX, t.growth), surf = surfaceAt(t.x);
      var eligible = [];
      for (i = 0; i < monde.shards.length; i++) {
        var s = monde.shards[i];
        if (!s.nutri || !s.settled || s.y > surf + depthReach || !isNutriRipe(s, now)) continue;
        if (Math.abs(s.x - t.x) >= reach) continue;
        eligible.push({ kind: 'shard', ref: s, y: s.y });
      }
      for (var ni = 0; ni < monde.compactNutri.length; ni++) {
        var dep = monde.compactNutri[ni];
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
          var newBranch = { dx: Math.cos(ba) * vue.U * 0.2 * bdist, dy: Math.sin(ba) * vue.U * 0.13 * bdist, leaf: null, branch: true, branchSince: now };
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
  for (i = 0; i < monde.litter.length; i++) {
    var l = monde.litter[i];
    if (!l.settled) continue;
    var dt = l.lastNow ? now - l.lastNow : 0;
    l.lastNow = now;
    var fed = false, fruitCell = null;
    for (var ci = 0; ci < monde.colonised.length; ci++) {
      var c = monde.colonised[ci];
      if (Math.abs(c.x - l.x) < MYC_DECOMPOSE_REACH && Math.abs(c.y - l.y) < MYC_DECOMPOSE_REACH) {
        c.lastFed = now;
        fed = true;
        if (c.settled && c.myc >= MYC_READY && c.y - surfaceAt(c.x) < 18) fruitCell = c;
        if (!partie.mycFedOnce) { partie.mycFedOnce = true; guideSet('fed'); setCaption(CAPTION_MYC_FED); }
      }
    }
    if (fed) l.bonus = (l.bonus || 0) + dt * (MYC_DECOMPOSE_MULT - 1);
    // Fructification occasionnelle : chaque morceau de bois mange donne sa chance (donc plus
    // de bois = plus de champignons), multipliee par l'humidite (pluie en cours ou recente).
    if (fruitCell) {
      if (weather.raining) lastRainAt = now;
      var wet = weather.raining ? 1 : Math.max(0, 1 - (now - lastRainAt) / FEED_FRUIT_WET_MS);
      var nMyc = 0;
      for (var mi = 0; mi < monde.mushrooms.length; mi++) if (monde.mushrooms[mi].myc && !monde.mushrooms[mi].dying) nMyc++;
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
  monde.litter.forEach(function (l) {
    if (l.mix >= 1 && l.settled) {
      if (l.branch) toEarthColor(l); else { l.nutri = rgbStr(l.to); l.nutriSince = now; }
    }
  });
  monde.litter = monde.litter.filter(function (l) { return l.mix < 1 && monde.shards.indexOf(l) >= 0; });
  if (monde.litter.length) state = Math.max(state, 1);
  if (!state && monde.shards.some(function (x) { return x.nutri; })) state = 1;
  return state;
}

// Quadrilatere du point a vers b (demi-epaisseurs wa, wb), perpendiculaire a la direction
// du segment (pas un simple decalage vertical, qui aplatit les segments pentus).
function rootSeg(ax, ay, bx, by2, wa, wb) {
  var dx = bx - ax, dy = by2 - ay, l = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / l, ny = dx / l;
  poly([[ax + nx * wa, ay + ny * wa], [bx + nx * wb, by2 + ny * wb], [bx - nx * wb, by2 - ny * wb], [ax - nx * wa, ay - ny * wa]]);
}
export function drawRoots(t) {
  var by = t.by !== undefined ? t.by : surfaceAt(t.x) + TREE_EMBED, w0 = vue.U * 0.014;
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
  var tipY = surfaceAt(t.x) + vue.U * lerp(ROOT_DEPTH_MIN, ROOT_DEPTH_MAX, t.growth), N = 6, seed = t.x * 0.37;
  for (i = 0; i < N; i++) {
    var k0 = i / N, k1 = (i + 1) / N;
    var y0 = lerp(by, tipY, k0), y1 = lerp(by, tipY, k1);
    var x0 = t.x + Math.sin(seed + k0 * 5) * vue.U * 0.012 * k0, x1 = t.x + Math.sin(seed + k1 * 5) * vue.U * 0.012 * k1;
    var w0p = w0 * 1.3 * (1 - k0) + 0.6, w1p = w0 * 1.3 * (1 - k1) + 0.6;
    ctx.fillStyle = ROOT_COLORS[i % 2];
    poly([[x0 - w0p, y0], [x0 + w0p, y0], [x1 + w1p, y1], [x1 - w1p, y1]]);
  }
}
export function drawTree(t) {
  // Tronc/houppier petits a la naissance, pleine taille une fois l'arbre mature (t.growth).
  var now = temps.vTime, tg = treeScale(t), by = t.by !== undefined ? t.by : surfaceAt(t.x) + TREE_EMBED, h = t.h * tg, w = vue.U * 0.035 * tg, top = by - h;
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
  var shkX = shk ? Math.sin(temps.frame * 1.7) * shk : 0, shkY = shk ? Math.cos(temps.frame * 2.3) * shk * 0.6 : 0;
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
    var R = CANOPY_CLUSTER_R * vue.U * tg * (0.45 + 0.65 * Math.min(1, lm.w / Math.max(1, lm.n, lm.cnt)));
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
    var bR = CANOPY_CLUSTER_R * vue.U * tg * 0.5 * Math.min(1, lf.dg) * bgF;
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
export function shadeRgb(r, g, b, k) {
  return 'rgb(' + Math.min(255, Math.round(r * k)) + ',' + Math.min(255, Math.round(g * k)) + ',' + Math.min(255, Math.round(b * k)) + ')';
}

// Demarrage du module : appele une seule fois par principal.js, dans un ordre fixe.
export function initArbres() {
  partie.mycFedOnce = guideFlags.fed;
}
