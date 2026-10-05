// Outils du joueur : pelle, main et sac de mycelium.
import { angleDiff, clamp, hexToRgb, shade, lerp, mixRgb } from './utils.js';
import {
  BLADE_WIDTH, BOWL_SPAN, BOWL_T, COL_W, PLANT_LEAN, SLOW_FOLLOW, POUR_ANGLE, DIG_BITE, DIG_SPEED,
  DIG_SPEED_DOWN, BEDROCK_MARGIN, BLADE_FIELD, BLADE_PULL, BLADE_ATTRACT, DECOMPACT_BULK, EARTH,
  MIN_LEACH_TO_EAT, MYC_HOLD_MAX_MS, SHOVEL_TIP, SHOVEL_BOTTOM, HAND_RING_R, CH_HARVEST_IDS,
  CH_HARVEST_GOAL, MUSHROOM_PRICE, TREE_EMBED, HAND_LEAF_MARGIN, HAND_LIMB_TOL, BRANCH_GROW_MS,
  HAND_BREAK_DIST, HAND_PUSH_MIN_V, HAND_FIST_MIN_V, HAND_FIST_STEP, HAND_FIST_MAX_STRIKES, HAND_FIST_MAX_V,
  HAND_FIST_R, HAND_FIST_KICK, HAND_FIST_SPREAD, HAND_FIST_LIFT, HAND_FIST_LOOSE, HAND_FIST_MAX_UP,
  HAND_FIST_DEPTH, HAND_FIST_SIZE, HAND_FIST_SHARDS, HAND_PUSH_MAX_V, HAND_PUSH_R, HAND_PUSH_LEAF,
  HAND_PUSH_MAX_LOOSE, HAND_PUSH_DEPTH, HAND_PUSH_P, HAND_PUSH_LOOSE, HAND_ZOOM_K, HAND_FLASH_MS, HAND_SKIN,
  HAND_GRAB_MAX, HAND_PICK_R, BAG_GRAINS, CAPTION_BAG_EMPTY, GRAIN, STRAIN_MIX
} from './config.js';
import { vue, monde, container, partie, temps, ctx, canvas, toolBtns } from './etat.js';
import { poly } from './rendu.js';
import { surfaceAt, triArea, pileRemove } from './terrain.js';
import { savePlayerIfChanged } from './sauvegarde.js';
import { demoGuard, treeScale, makeLeafShard, makeWoodShard, shedBranchSlot } from './arbres.js';
import { dropHeldInsect } from './flore.js';
import { sprout } from './mycelium.js';
import { earn } from './economie.js';
import {
  tryDig, treasureNear, openTip, digAt, guideSet, queueDemoEnd, chUnlocked, challengeDone, setCaption,
  currentStrain, tintCol, updateStrainBar, startLoop
} from './principal.js';

export var shovel = {
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

export function leaveShovel() {
  shovel.on = false; shovel.held = false; shovel.pouring = false; shovel.hideWhenEmpty = false; shovel.released = false;
  container.classList.remove('is-tool-cursor');
}

// --- Pelle plantee dans le sol ---------------------------------------------------------
// Au repos la pelle n'est plus un outil : elle est plantee (lame enfoncee, manche qui
// depasse) a un x fixe, et suit la surface. Sans physique tant qu'on ne l'a pas attrapee
// a la main. Relachee, elle verse ce qu'elle porte sur place puis se replante la.
export var shovelPlant = { x: null };
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
export function shovelHit(x, y, touch) {
  if (shovel.on || partie.mode !== 'exploded') return false;
  var f = plantFrame(), r = touch ? Math.max(30, vue.U * 0.06) : Math.max(14, vue.U * 0.03);
  var top = f.bl * 0.45 + f.sock + f.shaft + f.bw / 58 * 12;
  var a = plantPt(f, -f.bl * 0.1, 0), b = plantPt(f, top, 0);
  return distToSeg(x, y, a[0], a[1], b[0], b[1]) <= Math.max(r, f.bw * 0.35);
}
// Prise : le bol part du pied de la pelle plantee et rejoint le curseur.
export function grabShovel(pos, touch) {
  var f = plantFrame();
  enterShovel({ x: f.x, y: f.sy - 2 });
  shovel.gx = pos.x; shovel.gy = pos.y;
  shovel.held = !touch;
  shovel.face = pos.x >= f.x ? 1 : -1;
}
// Lacher : elle verse sur place (meme mecanique que le doigt leve), puis se replante.
export function releaseShovel() {
  if (!shovel.on || shovel.released) return;
  var R = bowlR();
  shovelPlant.x = shovel.cx + Math.sin(shovel.tilt) * R;
  shovel.gx = shovelPlant.x; shovel.gy = shovel.cy + Math.cos(shovel.tilt) * R;
  shovel.held = false; shovel.released = true;
  shovel.pouring = true; shovel.hideWhenEmpty = true;
}

export function updateShovel() {
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
export function collideBowl(s) {
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
export function bladeField(s) {
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
export function cutCompact() {
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
export function bowlWakePile(cutCols) {
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
export function harvestableNear(x, y) {
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
export function harvestAt(pos) {
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

export function enterHand(p) {
  hand.on = true;
  hand.x = hand.lx = hand.px = p.x; hand.y = hand.py = p.y;
  hand.pcx = vue.camX; hand.pcy = vue.camY;
  hand.fist = 0; hand.tilt = 0; hand.rot = 0;
  container.classList.add('is-tool-cursor');
}
// Ne laisse jamais rien de tenu ni d'agrippe derriere : les facettes tenues retombent,
// la branche agrippee revient droite (elle n'a pas casse).
export function leaveHand() {
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
export function handGrabTree(pos) {
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
export function updateHand(now) {
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

export function pickUpHand(pos) {
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

// --- Sac de mycelium ---------------------------------------------------------------
// Le goulot du sac est au curseur. Bouton maintenu (ou doigt pose) : le sac bascule
// et les grains coulent ; relache, il se redresse.
export var bag = { on: false, pouring: false, x: 0, y: 0, rot: 1.9 };

export function enterBag(p) {
  bag.on = true;
  bag.x = p.x; bag.y = p.y;
  container.classList.add('is-tool-cursor');
}
export function leaveBag() {
  bag.on = false; bag.pouring = false;
  container.classList.remove('is-tool-cursor');
}

export function updateBag() {
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

export function setTool(name) {
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

// Demarrage du module : appele une seule fois par principal.js, dans un ordre fixe.
export function initOutils() {
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
