// Rendu : decor lointain, cache des facettes du sol, dessin de la scene sur le canvas.
import { clamp, rgbStr, shade, easeInOut, lerp, easeOutBack, hexToRgb } from './utils.js';
import {
  HILL_LAYERS, TILE, BAKE_PAD, TILE_MAX, LOOSE_DRAW_SCALE, MYC, BAKE_EPS, BAKE_FRAMES, LITTER_FLAT,
  EATEN_MS, HYPHA_MAX_LINK, MYC_READY, HYPHA_W, HYPHA_COLOR, STRAIN_STD, HYPHA_DEAD_COLOR, COL_W, ROCK,
  SOIL, PEBBLE, SOIL_DARK, SOIL_CLAY, SOIL_SAND, LOOSE_INSET, LOOSE_MIN, GRASS_MAX_H_F, GRASS_EMBED,
  GRASS_MYC_HEIGHT_MULT, GRASS_COLOR, FLORA_EMBED, MOSS_THICK, MOSS_COLOR, FLORA_TUFT_H_F, TUFT_COLOR,
  FLORA_FERN_H_F, FLORA_BUSH_R_F, FLOWER_BLOOM_MS, FLOWER_WILT_MS, FLOWER_H_F, FLOWER_R_F, FLOWER_LIGHT_A,
  INSECT_SIZE_F, PLEUROTE_SIZE, HYDNE_SIZE, PLEU_CAPS
} from './config.js';
import { vue, monde, ctx, partie, canvas, temps } from './etat.js';
import { drawLakes, surfaceAt } from './terrain.js';
import { drawRain } from './meteo.js';
import { drawRoots, drawTree, drawMycHalo, shadeRgb } from './arbres.js';
import { drawShovel, drawBag, drawHand } from './outils.js';
import { drawLoupe } from './loupe.js';
import { drawNuggets, drawGoldBits, strainOrder } from './tresors.js';
import { positionTreasureOverlays } from './cartes.js';

var hillRidges = [];
export function buildHills() {
  hillRidges = HILL_LAYERS.map(function (L, li) {
    var xs = [], ys = [], x = -40, ph = Math.random() * 10;
    while (x < vue.worldW + 80) {
      var u = x / vue.worldW;
      var n = Math.sin(u * 13 + ph + li * 2) * 0.5 + Math.sin(u * 31 + ph * 1.7) * 0.28 + Math.random() * 0.22;
      xs.push(x);
      ys.push(vue.groundY - vue.U * (L.lift + L.amp * (0.5 + n * 0.5)));
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
  var a = easeInOut(monde.soilRiseT);
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  // Ciel : transparent en haut (se fond dans la creme de la page), a peine chaud a l'horizon.
  if (!skyGrad || skyGradY !== vue.groundY) {
    skyGrad = ctx.createLinearGradient(0, 0, 0, vue.groundY);
    skyGrad.addColorStop(0, 'rgba(246,222,182,0)');
    skyGrad.addColorStop(1, 'rgba(246,214,168,0.32)');
    skyGradY = vue.groundY;
  }
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, vue.W, vue.H);
  for (var li = 0; li < HILL_LAYERS.length; li++) {
    var L = HILL_LAYERS[li], R = hillRidges[li];
    if (!R) continue;
    var ox = vue.camX * L.f, oy = vue.camY * L.f, bottom = vue.worldH;
    for (var i = 0; i < R.xs.length - 1; i++) {
      var x0 = R.xs[i] - ox, x1 = R.xs[i + 1] - ox;
      if (x1 < -4 || x0 > vue.W + 4) continue;
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
var tiles = {}, tileList = [], tilePool = [], bakeGen = 1, bakeOid = 0, bakeStamp = 0, bakeFrame = 0;
var liveSoil = [];
// Remise a zero globale : les tuiles tombent, et bakeGen++ invalide d'un coup toutes les
// facettes cuites (s.bkG !== bakeGen), sans boucle sur shards.
export function resetTiles() {
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
  var dx0 = Math.round(col * TILE * vue.RS), dy0 = Math.round(row * TILE * vue.RS);
  var c = tilePool.pop() || document.createElement('canvas');
  c.width = Math.round((col + 1) * TILE * vue.RS) - dx0;
  c.height = Math.round((row + 1) * TILE * vue.RS) - dy0;
  var tc = c.getContext('2d');
  tc.setTransform(vue.RS, 0, 0, vue.RS, -dx0, -dy0);
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
  if (partie.mode !== 'exploded') {
    if (tileList.length) resetTiles();
    return monde.shards;
  }
  // Montee du lit : ses facettes sont cuites tout de suite, a leur place finale (sans rise),
  // et les tuiles sont copiees decalees de rise. Rien d'autre ne cuit pendant la montee.
  var rising = monde.soilRiseT < 1;
  var i, j, t, s, live = liveSoil, keep = [];
  bakeFrame++;
  var vx0 = vue.camX, vx1 = vue.camX + vue.W, vy0 = vue.camY, vy1 = vue.camY + vue.H;
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
  for (i = 0; i < monde.shards.length; i++) {
    s = monde.shards[i];
    if (s.leaf || s.branch || s.nutri) continue;
    if (s.oid === undefined) s.oid = ++bakeOid;
    var baked = s.bkG === bakeGen;
    if (baked) { s.bkF = bakeFrame; for (j = 0; j < s.bkT.length; j++) s.bkT[j].seen++; }
    var p = s.pts, sy = s.y + (s.soil && s.settled ? rise : 0);
    if (s.cullR === undefined) {
      s.cullR = Math.max(Math.abs(p[0][0]), Math.abs(p[0][1]), Math.abs(p[1][0]), Math.abs(p[1][1]), Math.abs(p[2][0]), Math.abs(p[2][1])) * 1.5;
    }
    var cm = s.cullR * Math.max(1, LOOSE_DRAW_SCALE) + vue.U * 0.06 + 4;
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
    var a0 = s.x + p[0][0] * c - p[0][1] * sn, a1 = s.y + (p[0][0] * sn + p[0][1] * c);
    var a2 = s.x + p[1][0] * c - p[1][1] * sn, a3 = s.y + (p[1][0] * sn + p[1][1] * c);
    var a4 = s.x + p[2][0] * c - p[2][1] * sn, a5 = s.y + (p[2][0] * sn + p[2][1] * c);
    var v = s.bkV;
    if (!v) { v = s.bkV = [0, 0, 0, 0, 0, 0]; s.bkN = 0; s.bkC = -1; }
    if (k !== s.bkC || Math.abs(a0 - v[0]) > BAKE_EPS || Math.abs(a1 - v[1]) > BAKE_EPS ||
        Math.abs(a2 - v[2]) > BAKE_EPS || Math.abs(a3 - v[3]) > BAKE_EPS ||
        Math.abs(a4 - v[4]) > BAKE_EPS || Math.abs(a5 - v[5]) > BAKE_EPS) {
      if (baked) { unbakeShard(s); baked = false; }
      s.bkC = k; v[0] = a0; v[1] = a1; v[2] = a2; v[3] = a3; v[4] = a4; v[5] = a5;
      s.bkN = 0;
    } else if (!baked && (rising ? s.soil && s.settled : ++s.bkN >= BAKE_FRAMES)) { baked = bakeShard(s); if (!baked) s.bkN = 0; }
    if (!baked) live.push(s);
  }
  // Repeinte avant copie, puis copie calee au px device (hors transformation monde).
  for (i = 0; i < tileList.length; i++) {
    t = tileList[i];
    if (t.dirty || t.seen !== t.n) rebuildTile(t);
  }
  var ox = Math.round(-vue.camX * vue.RS), oy = Math.round((rise - vue.camY) * vue.RS), cw = canvas.width, ch = canvas.height;
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

export function draw() {
  ctx.setTransform(vue.RS, 0, 0, vue.RS, 0, 0);
  ctx.clearRect(0, 0, vue.W, vue.H);
  drawBackdrop();
  // Tout ce qui suit est dessine en coord. MONDE ; ce translate ramene la portion
  // visible (camX..camX+W, camY..camY+H) a l'ecran. Les overlays HTML (tresors) font
  // ce -camX/-camY a la main dans positionTreasureOverlays, hors de ce contexte canvas.
  ctx.save();
  ctx.translate(-vue.camX, -vue.camY);
  // Pendant la montee du lit de terre, tout le sol est decale vers le bas.
  var rise = monde.soilRiseT < 1 ? Math.pow(1 - monde.soilRiseT, 3) * monde.soilDepth : 0;
  drawInsectsBack();
  drawSoil(rise);
  drawCompactNutri(rise);
  drawLooseBacking(rise);
  // Racines avant les facettes : cachees par le lit de triangles et la terre meuble,
  // visibles seulement sur l'aplat compact (defilement vers le bas, trou creuse).
  for (var ti = 0; ti < monde.trees.length; ti++) drawRoots(monde.trees[ti]);
  // Avant les facettes : le pied du tronc est enfoui dans la terre.
  for (ti = 0; ti < monde.trees.length; ti++) drawTree(monde.trees[ti]);
  // Deux passes : terre d'abord, puis hyphes, puis litiere (feuilles, bois, nutriments)
  // par-dessus le mycelium.
  for (var pass = 0; pass < 2; pass++) {
  if (pass === 1) drawHyphae(rise);
  // Passe 0 : les tuiles de facettes immobiles sont copiees ici (apres arbres et racines,
  // avant hyphes et litiere) ; la boucle ne dessine plus que les facettes en direct.
  var list = pass === 0 ? cacheSoil(rise) : monde.shards;
  for (var i = 0; i < list.length; i++) {
    var s = list[i], m = s.mix, p = s.pts;
    if (!!(s.leaf || s.branch || s.nutri) !== (pass === 1)) continue;
    var sy = s.y + (s.soil && s.settled ? rise : 0);
    // Hors ecran (marge = rayon max de la facette, agrandie, + demi-baton) : on saute.
    if (s.cullR === undefined) {
      s.cullR = Math.max(Math.abs(p[0][0]), Math.abs(p[0][1]), Math.abs(p[1][0]), Math.abs(p[1][1]), Math.abs(p[2][0]), Math.abs(p[2][1])) * 1.5;
    }
    var cm = s.cullR * Math.max(1, LOOSE_DRAW_SCALE) + vue.U * 0.06 + 4;
    if (s.x < vue.camX - cm || s.x > vue.camX + vue.W + cm || sy < vue.camY - cm || sy > vue.camY + vue.H + cm) continue;
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
      var k = Math.max(0, 1 - (temps.vTime - s.eaten) / EATEN_MS);
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
  for (i = 0; i < monde.mushrooms.length; i++) drawMushroom(monde.mushrooms[i]);
  drawNuggets();
  drawGoldBits();
  drawShovel();
  drawMycHalo();
  drawBag();
  drawHand();
  drawRain();
  ctx.restore();
  // Apres tout le monde (pluie comprise, que la lentille doit grossir) : la loupe se dessine en
  // coord. ECRAN, repere remis par draw() avant le translate camera.
  drawLoupe();
  positionTreasureOverlays();
}

// Baton low-poly (bois tombe) : hexagone a deux facettes, moitie haute = couleur de la
// facette, moitie basse plus sombre. Pose, il est couche et un peu enfonce dans le sol.
function drawLog(s, x, y, rot, r, g, b) {
  var L = vue.U * 0.0425, T = vue.U * 0.007, bv = T * 0.8, c = Math.cos(rot), sn = Math.sin(rot);
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
  if (c.x < vue.camX - 40 || c.x > vue.camX + vue.W + 40 || cy < vue.camY - 40 || cy > vue.camY + vue.H + 40) return;
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
  if (!monde.colonised.length && !monde.deadMyc.length) return;
  ctx.save();
  ctx.lineWidth = HYPHA_W;
  if (monde.colonised.length && !monde.tintedMyc) {
    ctx.strokeStyle = HYPHA_COLOR;
    ctx.beginPath();
    for (i = 0; i < monde.colonised.length; i++) if (monde.colonised[i].myc > 0) hyphaPath(monde.colonised[i], rise, false);
    ctx.stroke();
  } else if (monde.colonised.length) {
    // Au moins une facette teintee : un trait par souche (au plus 4), chacun sa couleur.
    for (var si = 0; si < strainOrder.length; si++) {
      var st = strainOrder[si];
      ctx.strokeStyle = st.hypha;
      ctx.beginPath();
      for (i = 0; i < monde.colonised.length; i++) {
        if (monde.colonised[i].myc > 0 && (monde.colonised[i].strain || STRAIN_STD) === st) hyphaPath(monde.colonised[i], rise, false);
      }
      ctx.stroke();
    }
  }
  if (monde.deadMyc.length) {
    ctx.strokeStyle = HYPHA_DEAD_COLOR;
    ctx.beginPath();
    for (i = 0; i < monde.deadMyc.length; i++) hyphaPath(monde.deadMyc[i], rise, true);
    ctx.stroke();
  }
  ctx.restore();
}

// Couche compacte : bande de triangles plats entre compactY et le fond du MONDE (worldH,
// pas juste le bas de la boite H : le defilement vertical doit reveler du remplissage,
// pas un trou). Jamais au-dessus du niveau d'origine, la terre meuble se dessine par-dessus. On ne dessine
// que la portion du monde visible (autour de camX/camY), pas tout le monde a chaque frame.
function drawSoil(rise) {
  var stepX = 2 * COL_W, bottom = vue.worldH, visBottom = vue.camY + vue.H;
  var x0 = Math.max(0, Math.floor((vue.camX - stepX) / stepX) * stepX);
  var x1 = Math.min(vue.worldW, vue.camX + vue.W + stepX);
  // Maillage low-poly a plusieurs rangees (pas de longues bandes verticales jusqu'au
  // fond) : la rangee 0 suit compactY exactement ; les suivantes sont plus profondes,
  // avec sommets decales (hash stable par indice absolu, donc rien ne bouge au defilement),
  // diagonales alternees et teinte qui s'assombrit avec la profondeur.
  var rowH = vue.U * 0.045, K = 1, dk = [0], k;
  var minTop = Infinity;
  for (var xx = x0; xx <= x1; xx += stepX) minTop = Math.min(minTop, monde.compactY[Math.max(0, Math.min(monde.compactY.length - 1, Math.round(Math.min(xx, vue.worldW) / COL_W)))] + rise);
  while (K < 9 && minTop + dk[K - 1] < visBottom) { dk.push(dk[K - 1] + rowH * (1 + 0.3 * K)); K++; }
  var n = Math.max(0, Math.floor((x1 - x0) / stepX)) + 2, g0 = Math.round(x0 / stepX);
  var grid = [];
  for (k = 0; k < K; k++) {
    var row = [];
    for (var i = 0; i < n; i++) {
      var gi = g0 + i, bx = Math.min(x0 + i * stepX, vue.worldW);
      var vx = bx, col = Math.max(0, Math.min(monde.compactY.length - 1, Math.round(bx / COL_W)));
      var vy;
      if (k === 0) vy = monde.compactY[col] + rise;
      else {
        vx = bx + (soilHash(gi, k, 1) - 0.5) * 0.7 * stepX;
        col = Math.max(0, Math.min(monde.compactY.length - 1, Math.round(Math.max(0, Math.min(vue.worldW, vx)) / COL_W)));
        vy = (k === K - 1 ? Math.max(bottom, monde.compactY[col] + rise + dk[k]) : monde.compactY[col] + rise + dk[k] + (soilHash(gi, k, 2) - 0.5) * 0.55 * rowH * (1 + 0.3 * k));
      }
      row.push([vx, vy, !!monde.rocky[col]]);
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
      var depthT = Math.max(0, Math.min(1, (dk[k] - rowH * 4.25) / (vue.U * 0.5)));
      var patchT = Math.max(0, Math.min(1, (dk[k] - rowH * 6) / (vue.U * 0.2)));   // le haut reste de la terre unie, les plaques/cailloux apparaissent plus bas
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
  for (var i = 0; i < monde.compactNutri.length; i++) {
    var d = monde.compactNutri[i];
    if (d.x < vue.camX - 20 || d.x > vue.camX + vue.W + 20) continue;
    var col = Math.max(0, Math.min(monde.compactY.length - 1, Math.round(d.x / COL_W)));
    if (d.y <= monde.compactY[col]) continue; // deja ramene au-dessus du plafond : plus la peine
    var y = d.y + rise, s = 5;
    ctx.fillStyle = d.color;
    poly([[d.x - s, y + s], [d.x + s, y + s], [d.x, y - s]]);
  }
}
function drawLooseBacking(rise) {
  var c0 = Math.max(0, Math.floor(vue.camX / COL_W) - 1);
  var c1 = Math.min(monde.heights.length - 1, Math.ceil((vue.camX + vue.W) / COL_W) + 1);
  ctx.fillStyle = '#5a3d28';
  ctx.beginPath();
  for (var c = c0; c <= c1; c++) {
    var h = monde.heights[c] - LOOSE_INSET;
    if (monde.heights[c] < LOOSE_MIN || h <= 0) continue;
    var x = c * COL_W, yb = monde.compactY[c] + rise;
    ctx.rect(x - COL_W / 2, yb - h, COL_W + 0.5, h + 1);
  }
  ctx.fill();
}

// Brins de gazon : quelques petits triangles pleins par colonne, hauteur proportionnelle
// a grassCover[c] (pousse visiblement au fil de la repousse). Seed stable (pas de
// Math.random() ici) pour que les brins ne scintillent pas d'une frame a l'autre.
function drawGrass(rise) {
  if (!monde.grassCover) return;
  var c0 = Math.max(0, Math.floor(vue.camX / COL_W) - 1);
  var c1 = Math.min(monde.grassCover.length - 1, Math.ceil((vue.camX + vue.W) / COL_W) + 1);
  var maxH = vue.U * GRASS_MAX_H_F;
  for (var c = c0; c <= c1; c++) {
    var cov = monde.grassCover[c];
    if (cov <= 0.03) continue;
    // +GRASS_EMBED : le terrain low-poly est irregulier, pas une ligne lisse — sans cet
    // enfoncement (meme principe que les champignons, surfaceAt(x) + 6 en drawMushroom),
    // la base des brins flotterait au-dessus des pointes de triangles de terre.
    var x = c * COL_W, y = surfaceAt(x) + rise + GRASS_EMBED;
    var bh = maxH * cov * (monde.grassMyc && monde.grassMyc[c] ? GRASS_MYC_HEIGHT_MULT : 1);
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
  if (!monde.floraLush) return;
  var c0 = Math.max(0, Math.floor(vue.camX / COL_W) - 1);
  var c1 = Math.min(monde.floraLush.length - 1, Math.ceil((vue.camX + vue.W) / COL_W) + 1);
  for (var c = c0; c <= c1; c++) {
    var lush = monde.floraLush[c];
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

// Touffe d'herbe haute : eventail de 5 brins, comme drawGrass mais plus grands et plus
// fournis — la densite (k, 0..1) grandit avec floraLush pour un effet de pousse.
function drawTuft(x, y, k, c) {
  if (k <= 0) return;
  var maxH = vue.U * FLORA_TUFT_H_F * k;
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
  var maxH = vue.U * FLORA_FERN_H_F * k;
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
  var r = vue.U * FLORA_BUSH_R_F * k;
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
  if (!monde.floraLush) return;
  var c0 = Math.max(0, Math.floor(vue.camX / COL_W) - 1);
  var c1 = Math.min(monde.floraLush.length - 1, Math.ceil((vue.camX + vue.W) / COL_W) + 1);
  for (var c = c0; c <= c1; c++) {
    var lush = monde.floraLush[c];
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
  if (f.x < vue.camX - 30 || f.x > vue.camX + vue.W + 30) return;
  var now = temps.vTime, p = clamp((now - f.born) / FLOWER_BLOOM_MS, 0, 1);
  if (p <= 0) return;
  var w = f.wilt !== null ? clamp((now - f.wilt) / FLOWER_WILT_MS, 0, 1) : 0;
  var leanSign = f.lean < 0 ? -1 : 1;
  var lean = f.lean + 0.6 * w * leanSign;
  var baseY = surfaceAt(f.x) + rise + FLORA_EMBED;
  var stemLocal = clamp(p / 0.35, 0, 1), stemG = easeOutBack(stemLocal);
  var stemH = FLOWER_H_F * vue.U * f.sizeK * stemG * (1 - 0.35 * w);
  var stemW = Math.max(1.1, vue.U * 0.0032 * f.sizeK);
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
      var budR = FLOWER_R_F * vue.U * f.sizeK * 0.55 * budG;
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
      var maxRad = FLOWER_R_F * vue.U * f.sizeK;
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
  for (var ti = 0; ti < monde.trees.length; ti++) {
    var flowers = monde.trees[ti].flowers;
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
  var size = vue.U * INSECT_SIZE_F * ins.sizeMult;
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
  for (var i = 0; i < monde.insects.length; i++) if (!monde.insects[i].nearFlower) drawInsect(monde.insects[i]);
}
// Approche finale / pose sur une fleur : devant le decor (apres drawFlowers).
function drawInsectsFront() {
  for (var i = 0; i < monde.insects.length; i++) if (monde.insects[i].nearFlower) drawInsect(monde.insects[i]);
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

export function poly(p) {
  ctx.beginPath();
  ctx.moveTo(p[0][0], p[0][1]);
  for (var i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
  ctx.closePath();
  ctx.fill();
}
