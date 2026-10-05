// Flore et faune : nutriments, gazon, lessivage, fleurs et insectes.
import { shade, hexToRgb, lerp, clamp } from './utils.js';
import {
  MIN_LEACH_TO_EAT, NUTRI_RIPEN_MS, EARTH, NUTRI, COL_W, GRASS_NUTRI_AREA, ROCK_COVER_MIN,
  GRASS_DISTURB_EPS, GRASS_LOST_TIP, CAPTION_GRASS_LOST, GRASS_BASELINE_FOLLOW, GRASS_NEIGHBOR_MIN,
  GRASS_REGROW_MS, GRASS_SPREAD_BONUS, GRASS_MYC_CHECK_EVERY, FLORA_TREE_R_MIN, FLORA_TREE_R_MAX,
  FLORA_TREE_W, FLORA_MYC_W, FLORA_SYMBIOSIS_BONUS, GRASS_NUTRI_CHECK_MS, GRASS_FRUIT_MIN,
  GRASS_MYC_NUTRI_WEIGHT, GRASS_NUTRI_P, FLORA_GROW_MS, FLORA_FADE_MS, MYC_READY, GRASS_MYC_REACH,
  GRASS_MYC_SURFACE_DEPTH, STORM_LEACH_MULT, ROCK_LEACH_MULT, BEDROCK_MARGIN, COMPACT_SINK_SPEED, LEACH_P,
  LEAF_RAIN_P, WOOD_RAIN_MULT, CAPTION_HELD, CAPTION_LEACH, DEAD_MYC_DECOMPOSE_P, FERT_MIN_MS, FERT_COST,
  CAPTION_NEED_MONEY_FERT, FERT_COUNT, FERT_SPREAD, GRASS_SEED_MIN_MS, GRASS_SEED_COST,
  CAPTION_NEED_MONEY_GRASS, GRASS_SEED_SPREAD, GRASS_SEED_BOOST, FLOWER_MAX_PER_TREE, FLOWER_MIN_SPACING,
  BRANCH_GROW_MS, FLOWER_WILT_MS, FLOWER_BLOOM_MS, FLOWER_H_F, FLORA_EMBED, BUTTERFLY_P, BUTTERFLY_MAX,
  INSECT_MAX, BUTTERFLY_SIZE_K, INSECT_SPEED, INSECT_LAND_P, INSECT_SIZE_F, FLEE_SPEED_K, FLEE_MS,
  INSECT_GAP_MIN_MS, INSECT_GAP_MAX_MS, CATCH_MAX_MS
} from './config.js';
import { monde, temps, vue, partie } from './etat.js';
import { pileAdd, isSubmergedCol, surfaceAt, pileRemove, isRocky } from './terrain.js';
import { weather, rainLeaf } from './meteo.js';
import { demoGuard, treeScale } from './arbres.js';
import {
  leachTip, heldByMycelium, setCaption, updateMoneyUI, startLoop, challengeDone, hand
} from './principal.js';

var fertLastAt = 0;                     // dernier depot de fertilisant (limite le rythme pendant un glissement)
var grassLastAt = 0;                    // dernier semis de gazon (limite le rythme pendant un glissement)

// Mangeable des qu'un des deux chemins est rempli : suffisamment lessive par la pluie
// (rapide, MIN_LEACH_TO_EAT), OU simplement mur avec le temps (lent, NUTRI_RIPEN_MS) —
// comme dans la vraie vie ou l'azote finit par devenir disponible meme sans pluie, juste
// beaucoup moins vite. Necessite s.nutriSince (voir partout ou s.nutri est pose).
export function isNutriRipe(s, now) {
  return (s.leachCount || 0) >= MIN_LEACH_TO_EAT ||
    (s.nutriSince !== undefined && now - s.nutriSince >= NUTRI_RIPEN_MS);
}

// Remet une facette a une couleur de terre normale : efface le nutriment ET remplace
// from/to (une facette nee d'une feuille garde `to` = un NUTRI sombre meme mix a 1, sinon
// elle resterait visuellement de l'humus une fois le nutriment retire).
export function toEarthColor(s) {
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
export function spawnNutrientShard(x, y, col, area, now) {
  var hex = NUTRI[(Math.random() * NUTRI.length) | 0], color = hexToRgb(hex);
  var s = {
    pts: [[-2, 2], [2, 2], [0, -3]], ox: x, oy: y, x: x, y: y, vx: 0, vy: 0,
    rot: Math.random() * Math.PI, vr: 0, from: color, to: color, mix: 1,
    area: area, settled: true, col: col, nutri: hex, nutriSince: now
  };
  monde.shards.push(s);
  pileAdd(s);
}

// --- Gazon (voir section "Gazon" plus haut pour le pourquoi) ------------------------
function spawnGrassNutrient(col, now) {
  var x = (col + Math.random() - 0.5) * COL_W, y = monde.compactY[col] - monde.heights[col];
  spawnNutrientShard(x, y, col, GRASS_NUTRI_AREA, now);
}

// Met a jour la couverture (grassCover) et, occasionnellement, fait pousser un nutriment.
// Retourne un etat comme stepTrees (0 rien, >0 continuer a verifier lentement) : le gazon
// n'a jamais besoin de la pleine cadence (60 fps), juste de ne pas s'arreter completement
// (voir son usage dans step(), fondu avec treeLife).
export function updateGrass(now) {
  if (!monde.grassCover) return 0;
  var dt = monde.grassLastNow === null ? 0 : now - monde.grassLastNow;
  monde.grassLastNow = now;
  for (var c = 0; c < monde.grassCover.length; c++) {
    if ((monde.rocky[c] && monde.heights[c] < ROCK_COVER_MIN) || isSubmergedCol(c)) { monde.grassCover[c] = 0; continue; }
    var diff = monde.heights[c] - monde.grassPrevH[c];
    if (Math.abs(diff) > GRASS_DISTURB_EPS && !demoGuard(c * COL_W)) {
      if (monde.grassCover[c] > 0 && performance.now() > monde.grassTipFrom && ++monde.grassLost >= GRASS_LOST_TIP && leachTip(16, CAPTION_GRASS_LOST, true)) monde.grassLost = 0;
      monde.grassCover[c] = 0;
    }
    monde.grassPrevH[c] += diff * GRASS_BASELINE_FOLLOW;
    if (monde.grassCover[c] >= 1) continue;
    // Uniquement de la propagation : sans voisine deja gazonnee, une colonne nue ne pousse
    // pas toute seule (pas de generation spontanee), exactement comme le mycelium qui ne
    // colonise que ce qui touche deja une facette colonisee (voir spreadMycelium).
    var neighborLush = (c > 0 && monde.grassCover[c - 1] > GRASS_NEIGHBOR_MIN) ||
      (c < monde.grassCover.length - 1 && monde.grassCover[c + 1] > GRASS_NEIGHBOR_MIN);
    if (!neighborLush) continue;
    monde.grassCover[c] = Math.min(1, monde.grassCover[c] + (dt / GRASS_REGROW_MS) * GRASS_SPREAD_BONUS);
  }
  // grassMyc (symbiose visible, voir sa section plus haut) : recalcule seulement toutes
  // les GRASS_MYC_CHECK_EVERY frames, pas a chaque frame — parcourir colonised pour
  // chaque colonne a 60fps couterait cher pour un simple bonus cosmetique + production.
  if (temps.frame % GRASS_MYC_CHECK_EVERY === 0) {
    for (var gc = 0; gc < monde.grassCover.length; gc++) monde.grassMyc[gc] = grassHasMycUnder(gc * COL_W) ? 1 : 0;
    // Cible de flore (mousse/touffes/feuillage, purement cosmetique) : calculee ici, pas a
    // chaque frame, comme grassMyc juste au-dessus — meme raison, ca ne coute rien de plus
    // qu'un simple effet visuel. Plus dense pres d'un arbre bien nourri (treeInf) et
    // au-dessus d'un mycelium actif (mycInf, avec un leger lissage vers les colonnes
    // voisines pour eviter un bord dur), avec un bonus si les deux se superposent (vraie
    // mycorhize) : le sol vivant doit se voir profiter a la flore aussi, pas seulement au
    // gazon (voir GRASS_MYC_HEIGHT_MULT) ou aux arbres.
    for (var flc = 0; flc < monde.floraTarget.length; flc++) {
      var fx = flc * COL_W, treeInf = 0;
      for (var fti = 0; fti < monde.trees.length; fti++) {
        var ft = monde.trees[fti], fd = Math.abs(ft.x - fx);
        var frr = vue.U * lerp(FLORA_TREE_R_MIN, FLORA_TREE_R_MAX, ft.growth);
        if (fd >= frr) continue;
        var infl = lerp(0.4, 1, ft.growth) * (1 - fd / frr);
        if (infl > treeInf) treeInf = infl;
      }
      var mycInf = monde.grassMyc[flc] ? 1 : 0;
      if (!mycInf) {
        for (var fnb = -2; fnb <= 2; fnb++) {
          var fni = flc + fnb;
          if (fnb === 0 || fni < 0 || fni >= monde.grassMyc.length) continue;
          if (monde.grassMyc[fni]) { mycInf = 0.7; break; }
        }
      }
      var flTgt = treeInf * FLORA_TREE_W + mycInf * FLORA_MYC_W;
      if (treeInf > 0 && monde.grassMyc[flc]) flTgt += FLORA_SYMBIOSIS_BONUS;
      monde.floraTarget[flc] = Math.min(1, flTgt);
    }
  }
  if (now >= monde.grassNutriAt) {
    monde.grassNutriAt = now + GRASS_NUTRI_CHECK_MS;
    {
      var eligible = [];
      for (var cc = 0; cc < monde.grassCover.length; cc++) {
        if (monde.grassCover[cc] < GRASS_FRUIT_MIN) continue;
        eligible.push(cc);
        // Compte plusieurs fois dans le tirage au sort : ~GRASS_MYC_NUTRI_WEIGHT fois plus
        // susceptible d'etre choisie, sans changer combien de nutriments sortent d'un coup.
        if (monde.grassMyc[cc]) for (var w = 1; w < GRASS_MYC_NUTRI_WEIGHT; w++) eligible.push(cc);
      }
      if (eligible.length) {
        var pickCol = eligible[(Math.random() * eligible.length) | 0];
        // Multiplicateur de production (champs "Gazon"/"Gazon long" de la barre de reglages) :
        // 1 = comportement d'origine (chance GRASS_NUTRI_P d'un nutriment), 0 = aucun,
        // >1 = plusieurs nutriments (partie entiere + chance sur le reste).
        var nutriExpect = GRASS_NUTRI_P * (monde.grassMyc[pickCol] ? temps.grassMycNutriMult : temps.grassNutriMult);
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
  for (var fc = 0; fc < monde.floraLush.length; fc++) {
    if (monde.grassCover[fc] <= 0) { monde.floraLush[fc] = 0; continue; }
    var flTarget = Math.min(monde.floraTarget[fc], monde.grassCover[fc]);
    if (flTarget > monde.floraLush[fc]) monde.floraLush[fc] = Math.min(flTarget, monde.floraLush[fc] + dt / FLORA_GROW_MS);
    else if (flTarget < monde.floraLush[fc]) monde.floraLush[fc] = Math.max(flTarget, monde.floraLush[fc] - dt / FLORA_FADE_MS);
  }
  return 1;
}

// Vrai si un mycelium bien vivant est a portee horizontale ET proche de la surface a cette
// position (voir GRASS_MYC_REACH/GRASS_MYC_SURFACE_DEPTH) : le gazon ne profite que d'un
// reseau actif juste sous lui, pas d'un mycelium enfoui loin en profondeur.
function grassHasMycUnder(x) {
  var surf = surfaceAt(x);
  for (var i = 0; i < monde.colonised.length; i++) {
    var c = monde.colonised[i];
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
export function sinkCompactNutri(steps) {
  var stormMult = weather.storm ? STORM_LEACH_MULT : 1;
  for (var di = monde.compactNutri.length - 1; di >= 0; di--) {
    var dep = monde.compactNutri[di];
    // Sous une plaque rocheuse (plus compacte que la terre), l'enfoncement est plus lent.
    var rockMult = monde.rocky[Math.max(0, Math.min(monde.rocky.length - 1, Math.round(dep.x / COL_W)))] ? ROCK_LEACH_MULT : 1;
    dep.y = Math.min(vue.worldH - BEDROCK_MARGIN - 5, dep.y + COMPACT_SINK_SPEED * rockMult * stormMult * steps * (0.5 + Math.random()));
  }
}

export function leach(now) {
  var stormMult = weather.storm ? STORM_LEACH_MULT : 1;
  var leachP = LEACH_P * (0.5 + temps.rainLevel) * stormMult;
  var leafP = LEAF_RAIN_P * (0.5 + temps.rainLevel) * stormMult;
  for (var i = 0; i < monde.shards.length; i++) {
    var s = monde.shards[i];
    if (s.leaf && s.settled && !s.bonus && Math.random() < (s.branch ? leafP * WOOD_RAIN_MULT : leafP)) rainLeaf(s);
    if (!s.settled || !s.nutri || s.leachTick === temps.frame) continue;
    if (heldByMycelium(s.x, s.y, s.nutriSince)) {
      if (!(partie.leachTipSeen & 2) && s.x > vue.camX && s.x < vue.camX + vue.W) leachTip(2, CAPTION_HELD);
      continue;
    }
    // Sur la roche (meme recouverte de terre meuble), le lessivage est plus lent.
    if (Math.random() > (monde.rocky[Math.max(0, Math.min(monde.rocky.length - 1, Math.round(s.x / COL_W)))] ? leachP * ROCK_LEACH_MULT : leachP)) continue;
    if (!(partie.leachTipSeen & 1) && s.x > vue.camX && s.x < vue.camX + vue.W) leachTip(1, CAPTION_LEACH);
    var best = null, bestDy = Infinity;
    for (var j = 0; j < monde.shards.length; j++) {
      var o = monde.shards[j];
      if (o === s || !o.settled || o.nutri || o.myc || o.leaf || o.deadMyc) continue;
      var dx = o.x - s.x, dy = o.y - s.y;
      if (Math.abs(dx) > 8 || dy < 3 || dy > 20) continue;
      if (dy < bestDy) { bestDy = dy; best = o; }
    }
    if (best) {
      toNutriColor(best);
      best.leachCount = (s.leachCount || 0) + 1; // a fait un cran de plus vers les racines
      best.leachTick = temps.frame; // un seul cran par passage, meme si on la croise plus loin dans la boucle
      best.nutriSince = s.nutriSince; // l'age de l'humus suit le lessivage, ne repart pas a zero
      toEarthColor(s);
    } else {
      var col = Math.max(0, Math.min(monde.compactY.length - 1, Math.round(s.x / COL_W)));
      monde.compactNutri.push({ x: s.x, y: monde.compactY[col] + 5 + Math.random() * 20, color: NUTRI[(Math.random() * NUTRI.length) | 0] });
      // La facette s'enfonce dans le compact : sa matiere est desormais representee
      // UNIQUEMENT par le depot compactNutri ci-dessus. Il faut donc la retirer du tas
      // (hauteur ET facette elle-meme) plutot que la laisser en terre normale : sinon
      // chaque lessivage cree de la matiere en plus au lieu de la deplacer (le depot
      // fera pousser une feuille, en plus de la facette qui reste plantee dans le sol),
      // ce qui fait grossir les buttes indefiniment meme a fort ruissellement.
      pileRemove(s);
      monde.shards.splice(i, 1);
      i--;
    }
  }
}

// Decomposition du mycelium mort de secheresse (voir stepMycelium) : seule l'humidite d'une
// averse le fait pourrir en nutriment, comme du bois mort ordinaire. Meme cadence que leach().
export function decomposeDeadMyc() {
  for (var i = monde.deadMyc.length - 1; i >= 0; i--) {
    var c = monde.deadMyc[i];
    if (!c.settled || Math.random() > DEAD_MYC_DECOMPOSE_P) continue;
    c.deadMyc = false; c.mycParent = null;
    toNutriColor(c);
    monde.deadMyc.splice(i, 1);
  }
}

// Outil fertilisant : depose quelques nutriments en surface, a l'endroit vise.
export function dropFertilizer(x) {
  var t = Date.now();
  if (t - fertLastAt < FERT_MIN_MS) return;
  if (partie.money < FERT_COST) { setCaption(CAPTION_NEED_MONEY_FERT); return; }
  fertLastAt = t;
  partie.fertDropped = true;
  if (window.sporaSfx) sporaSfx.play('plant');
  partie.money -= FERT_COST;
  updateMoneyUI();
  for (var i = 0; i < FERT_COUNT; i++) {
    var fx = x + (Math.random() - 0.5) * FERT_SPREAD;
    var col = Math.max(0, Math.min(monde.heights.length - 1, Math.round(fx / COL_W)));
    spawnNutrientShard(fx, monde.compactY[col] - monde.heights[col], col, GRASS_NUTRI_AREA, temps.vTime);
  }
  startLoop();
}

// Outil gazon : augmente la couverture de gazon dans une zone.
export function seedGrass(x) {
  var t = Date.now();
  if (t - grassLastAt < GRASS_SEED_MIN_MS) return;
  if (partie.money < GRASS_SEED_COST) { setCaption(CAPTION_NEED_MONEY_GRASS); return; }
  grassLastAt = t;
  if (window.sporaSfx) sporaSfx.play('plant');
  partie.money -= GRASS_SEED_COST;
  updateMoneyUI();
  for (var i = 0; i < 5; i++) {
    var fx = x + (Math.random() - 0.5) * GRASS_SEED_SPREAD;
    var col = Math.max(0, Math.min(monde.grassCover.length - 1, Math.round(fx / COL_W)));
    if (monde.grassCover[col] < 1) {
      monde.grassCover[col] = Math.min(1, monde.grassCover[col] + GRASS_SEED_BOOST);
    }
  }
  startLoop();
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
export function spawnFlower(t, slot, now) {
  if (countLiveFlowers(t) >= FLOWER_MAX_PER_TREE) return;
  var R = vue.U * lerp(FLORA_TREE_R_MIN, FLORA_TREE_R_MAX, t.growth);
  var trunkW = vue.U * 0.035 * treeScale(t);
  for (var attempt = 0; attempt < 10; attempt++) {
    var side = Math.random() < 0.5 ? -1 : 1;
    var dist = lerp(trunkW * 2.5, R, Math.random());
    var x = t.x + side * dist;
    var col = Math.max(0, Math.min(monde.grassCover.length - 1, Math.round(x / COL_W)));
    if (!(monde.grassCover[col] > 0.5) || isRocky(x)) continue;
    var tooClose = false;
    for (var ti = 0; ti < monde.trees.length && !tooClose; ti++) {
      var others = monde.trees[ti].flowers;
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

// Fait vivre les fleurs cosmetiques (voir spawnFlower) : la pelle qui remue une colonne
// (grassCover retombe a 0) fait disparaitre la fleur assise dessus tout de suite, sans
// transition (la terre a litteralement bouge sous elle) ; une fleur fanee (branche tombee,
// voir stepTrees) s'efface plus doucement, sur FLOWER_WILT_MS. Retourne vrai si au moins
// une fleur est en train d'eclore ou de faner : appele depuis step(), ca force la pleine
// cadence (sinon la boucle lente a 4 img/s rendrait ces transitions saccadees).
export function stepFlowers(now) {
  var busy = false;
  for (var ti = 0; ti < monde.trees.length; ti++) {
    var t = monde.trees[ti], kept = [];
    for (var i = 0; i < t.flowers.length; i++) {
      var f = t.flowers[i];
      if (monde.grassCover[f.col] <= 0) continue;
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
  var stemH = FLOWER_H_F * vue.U * f.sizeK;
  var curveK = stemH * 0.3 * leanSign;
  var baseX = f.x, baseY = surfaceAt(f.x) + FLORA_EMBED;
  var ca = Math.cos(f.lean), sa = Math.sin(f.lean);
  var lx = curveK, ly = -stemH;
  return [baseX + lx * ca - ly * sa, baseY + lx * sa + ly * ca];
}

// Vrai si une fleur ouverte (eclosion terminee, pas fletrie) est encore visible a l'ecran.
function flowerIsOpen(f) {
  return f.wilt === null && temps.vTime - f.born >= FLOWER_BLOOM_MS;
}
// Une fleur ciblee par un insecte peut disparaitre (pelle, branche tombee) sans jamais
// etre retiree "sous nos yeux" : on revalide sa presence a chaque frame plutot que de
// se fier a une simple reference d'objet.
function flowerStillGood(f) {
  if (f.wilt !== null) return false;
  for (var ti = 0; ti < monde.trees.length; ti++) if (monde.trees[ti].flowers.indexOf(f) >= 0) return true;
  return false;
}
function flowerAlreadyTargeted(f) {
  for (var i = 0; i < monde.insects.length; i++) if (monde.insects[i].target === f) return true;
  return false;
}
// Premiere fleur ouverte, visible et pas deja visee, tous arbres confondus (meme marge
// de visibilite que drawFlower).
function pickOpenFlower() {
  for (var ti = 0; ti < monde.trees.length; ti++) {
    var fl = monde.trees[ti].flowers;
    for (var i = 0; i < fl.length; i++) {
      var f = fl[i];
      if (f.x < vue.camX - 30 || f.x > vue.camX + vue.W + 30) continue;
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
  for (var ci = 0; ci < monde.insects.length; ci++) { if (monde.insects[ci].species === 'papillon') nB++; else nBee++; }
  var species = Math.random() < BUTTERFLY_P ? 'papillon' : 'bourdon';
  if (species === 'papillon' && nB >= BUTTERFLY_MAX) species = 'bourdon';
  if (species === 'bourdon' && nBee >= INSECT_MAX) species = nB < BUTTERFLY_MAX ? 'papillon' : null;
  if (!species) return;
  var dir = Math.random() < 0.5 ? -1 : 1;
  var startX = dir > 0 ? vue.camX - 40 : vue.camX + vue.W + 40;
  var yFrac = 0.12 + Math.random() * (0.45 - 0.12);
  var sizeMult = species === 'bourdon' ? 0.7 : BUTTERFLY_SIZE_K;
  var speed = vue.U * 0.0009 * INSECT_SPEED * (species === 'bourdon' ? 1.6 : 1);
  var ins = {
    species: species, dir: dir, sizeMult: sizeMult, speed: speed, yFrac: yFrac,
    cruiseX: startX, x: startX, y: 0, age: 0,
    phaseWing: Math.random() * Math.PI * 2,
    glideSeed: Math.random() * 3000,
    wA1: vue.U * 0.02, wA2: vue.U * 0.008, wT1: species === 'bourdon' ? 850 : 1700, wT2: species === 'bourdon' ? 300 : 600,
    wPh1: Math.random() * Math.PI * 2, wPh2: Math.random() * Math.PI * 2,
    zzA: species === 'bourdon' ? vue.U * 0.01 : 0, zzT: 320 + Math.random() * 80, zzPh: Math.random() * Math.PI * 2,
    driftT: 4000 + Math.random() * 2000, driftPh: Math.random() * Math.PI * 2,
    state: 'cruise', target: null, nearFlower: false,
    landAt: 0, landDur: 0, landPh: 0
  };
  ins.y = clamp(surfaceAt(clamp(startX, 0, vue.worldW)) - vue.U * yFrac, vue.camY + 10, vue.camY + vue.H - 10);
  if (Math.random() < INSECT_LAND_P) {
    var f = pickOpenFlower();
    if (f) { ins.target = f; ins.state = 'approach'; }
  }
  monde.insects.push(ins);
}
export function insectAt(wx, wy) {
  var size = vue.U * INSECT_SIZE_F * BUTTERFLY_SIZE_K, best = null, bd = 1e9;
  for (var i = 0; i < monde.insects.length; i++) {
    var ins = monde.insects[i];
    if (ins.species !== 'papillon' || ins.caught) continue;
    var d = Math.hypot(wx - ins.x, wy - ins.y);
    if (d <= size * 0.95 + 14 && d < bd) { bd = d; best = ins; }
  }
  return best;
}
export function catchInsect(ins) {
  ins.caught = true; ins.caughtAt = ins.age;
  // Un papillon pose ou en approche est arrache a sa fleur : plus de cible pendant la prise.
  ins.target = null; ins.nearFlower = false;
  monde.heldInsect = ins;
  challengeDone(11);
}
// Libere le papillon tenu (s'il y en a un) : il s'enfuit. Sans effet sinon.
export function dropHeldInsect() {
  var ins = monde.heldInsect;
  monde.heldInsect = null;
  if (ins && ins.caught) releaseInsect(ins);
}
function releaseInsect(ins) {
  ins.caught = false; ins.target = null; ins.nearFlower = false;
  var away = (hand.on && hand.x !== undefined) ? (ins.x >= hand.x ? 1 : -1) : ins.dir;
  ins.dir = away;
  ins.state = 'flee';
  ins.fleeStart = ins.age;
  ins.fvx = 0; ins.fvy = 0;
  ins.fleeVy = -vue.U * 0.00028;             // petite montee au depart, qui s'estompe
}
function stepInsectFlee(ins, dt) {
  var t = ins.age - ins.fleeStart;
  var rate = Math.min(1, dt / 180);      // acceleration lissee : pas de saut de vitesse
  ins.fvx += (ins.dir * ins.speed * FLEE_SPEED_K - ins.fvx) * rate;
  ins.fvy += (ins.fleeVy * Math.max(0, 1 - t / 700) - ins.fvy) * rate;
  ins.x += ins.fvx * dt;
  ins.y = clamp(ins.y + ins.fvy * dt, vue.camY + 10, Math.min(vue.camY + vue.H - 10, surfaceAt(clamp(ins.x, 0, vue.worldW)) - vue.U * 0.03));
  if (t >= FLEE_MS) {
    // Retour en croisiere sans saut : cruiseX absorbe la derive courante, et l'ecart
    // vertical residuel (yOff) s'estompe ensuite dans stepInsectCruise.
    var drift = Math.sin(ins.age / ins.driftT + ins.driftPh) * vue.U * 0.006;
    ins.cruiseX = ins.x - drift;
    ins.state = 'cruise';
    ins.yOff = ins.y - cruiseY(ins);
  }
}
function cruiseY(ins) {
  var w1 = ins.wA1 * Math.sin((ins.age / ins.wT1) * Math.PI * 2 + ins.wPh1);
  var w2 = ins.wA2 * Math.sin((ins.age / ins.wT2) * Math.PI * 2 + ins.wPh2);
  var zz = ins.zzA * Math.sin((ins.age / ins.zzT) * Math.PI * 2 + ins.zzPh);
  return surfaceAt(clamp(ins.x, 0, vue.worldW)) - vue.U * ins.yFrac + w1 + w2 + zz;
}
// Croisiere : traversee de l'ecran, ondulation verticale (+ petits zigzags pour le
// bourdon) et derive horizontale legere. speedMult vaut 2 sous la pluie (fuite).
function stepInsectCruise(ins, dt, speedMult) {
  ins.cruiseX += ins.dir * ins.speed * speedMult * dt;
  var drift = Math.sin(ins.age / ins.driftT + ins.driftPh) * vue.U * 0.006;
  ins.x = ins.cruiseX + drift;
  var yo = 0;
  if (ins.yOff) { // ecart residuel apres une fuite : s'estompe en ~0,6 s
    ins.yOff *= Math.max(0, 1 - dt / 600);
    if (Math.abs(ins.yOff) < 0.5) ins.yOff = 0;
    yo = ins.yOff;
  }
  ins.y = clamp(cruiseY(ins) + yo, vue.camY + 10, vue.camY + vue.H - 10);
}
// Approche : vise un point au-dessus de la fleur qui descend progressivement vers le
// bout de la tige (courbe douce, pas une ligne droite), jusqu'a se poser.
function stepInsectApproach(ins, dt) {
  var top = flowerTopWorld(ins.target);
  var dx = top[0] - ins.x, dy = top[1] - ins.y, dist = Math.hypot(dx, dy);
  ins.nearFlower = dist < vue.U * 0.08;
  var hover = Math.min(vue.U * 0.07, dist * 0.5);
  var rate = Math.min(1, dt / 260);
  ins.x += (top[0] - ins.x) * rate;
  ins.y += (top[1] - hover - ins.y) * rate;
  ins.y += Math.sin(ins.age / 260 + ins.wPh1) * vue.U * 0.004;
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
export function stepInsects(realNow) {
  if (monde.insectLastT === null) {
    monde.insectLastT = realNow;
    monde.insectNextAt = realNow + 6000 + Math.random() * 6000; // premiere apparition, 6-12s
  }
  var dt = Math.min(realNow - monde.insectLastT, 50);
  monde.insectLastT = realNow;
  var raining = weather.raining; // averse en cours (rainLevel n'est qu'un reglage de frequence)
  if (!raining && monde.insects.length < INSECT_MAX + BUTTERFLY_MAX && realNow >= monde.insectNextAt) {
    spawnInsect();
    monde.insectNextAt = realNow + lerp(INSECT_GAP_MIN_MS, INSECT_GAP_MAX_MS, Math.random());
  }
  var speedMult = raining ? 2 : 1;
  for (var i = monde.insects.length - 1; i >= 0; i--) {
    var ins = monde.insects[i];
    ins.age += dt;
    if (ins.caught) {
      if (ins !== monde.heldInsect || partie.mode !== 'exploded' || ins.age - ins.caughtAt > CATCH_MAX_MS) {
        if (ins === monde.heldInsect) monde.heldInsect = null;
        releaseInsect(ins);
      } else {
        // Tenu : suit le pointeur (lisse, leger tremblement), jamais retire ni recycle.
        var hk = Math.min(1, dt / 18), ht = ins.age / 1000; // constante courte : colle a la main sans trainer
        ins.x += (vue.heldSX + vue.camX + Math.sin(ht * 17) * 2 - ins.x) * hk;
        ins.y += (vue.heldSY + vue.camY - vue.U * 0.02 + Math.cos(ht * 21) * 2 - ins.y) * hk;
        continue;
      }
    }
    if (raining && ins.target) { ins.cruiseX = ins.x; ins.target = null; ins.state = 'cruise'; ins.nearFlower = false; }
    if (ins.target && !flowerStillGood(ins.target)) { ins.cruiseX = ins.x; ins.target = null; ins.state = 'cruise'; ins.nearFlower = false; }
    if (ins.state === 'approach') stepInsectApproach(ins, dt);
    else if (ins.state === 'landed') stepInsectLanded(ins);
    else if (ins.state === 'flee') stepInsectFlee(ins, dt);
    else stepInsectCruise(ins, dt, speedMult);
    if ((ins.dir > 0 && ins.x > vue.camX + vue.W + 80) || (ins.dir < 0 && ins.x < vue.camX - 80) || ins.age > 180000) monde.insects.splice(i, 1);
  }
  return monde.insects.length > 0;
}
