// Terrain : construction du monde a partir du logo, sol, roches, lacs et tas de terre.
import { shade, hexToRgb } from './utils.js';
import {
  CAPTION_BEFORE, WORLD_MULT, DEPTH_MULT, COL_W, EARTH, CELLS_ACROSS, ROCK_COVER_MIN, LAKE_EVAP_PER_S,
  ROCK_PATCH_MIN, ROCK_PATCH_MAX, ROCK_BASIN_FRAC, ROCK_PATCH_COLS_MIN, ROCK_PATCH_COLS_MAX, ROCK_H_MIN,
  ROCK_H_MAX, ROCK_BASIN_DEPTH, LOGO_BULK, LOG_BULK, LITTER_BULK, KERNEL, REPOSE
} from './config.js';
import {
  partie, caption, logoUrl, canvas, vue, dpr, monde, updateZoom, container, fallbackImg, ctx
} from './etat.js';
import { buildHills, resetTiles, poly } from './rendu.js';
import { restoreWorld } from './sauvegarde.js';
import { weather, updateDroughtIndicator } from './meteo.js';
import { setCaption } from './messages.js';
import { camHomeY } from './principal.js';

var img = new Image();

// Toile a sa vraie resolution (px CSS x dpr) ; le style garde la taille CSS de la boite.
export function sizeCanvas() {
  canvas.width = vue.ZOOM === 1 ? vue.W * dpr : Math.round(vue.W * vue.RS);
  canvas.height = vue.ZOOM === 1 ? vue.H * dpr : Math.round(vue.H * vue.RS);
  canvas.style.width = vue.W * vue.ZOOM + 'px'; canvas.style.height = vue.H * vue.ZOOM + 'px';
}

function setupSoil(rect) {
  vue.W = rect.width / vue.ZOOM; vue.H = rect.height / vue.ZOOM;
  vue.U = vue.H * vue.ZOOM; vue.UW = vue.W * vue.ZOOM;
  sizeCanvas();
  // Le monde deborde de la boite ; la boite est centree dedans au depart.
  vue.worldW = vue.W * WORLD_MULT;
  vue.camMargin = (vue.worldW - vue.W) / 2;
  vue.camX = vue.camMargin;
  // Zoome, la fenetre (H) depasse U : le monde doit rester plus haut qu'elle (bornes de camY jamais inversees).
  vue.worldH = Math.max(vue.U + vue.U * DEPTH_MULT, vue.H + vue.U * 0.5);
  vue.groundY = vue.U - 6;
  vue.camY = camHomeY(); // 0 sans zoom ; zoome, remonte pour poser le sol au bas de l'ecran
  buildHills();
  monde.heights = new Float32Array(Math.ceil(vue.worldW / COL_W) + 1);
  monde.compactY = new Float32Array(monde.heights.length);
  monde.compactY.fill(vue.groundY);
  monde.compactNutri = [];
  monde.lakes = []; monde.lakeOf = []; monde.lakeLastT = null;
  monde.drops = [];
  monde.nextLeachAt = 0;
  weather.raining = false; weather.clouds = []; weather.lastNow = null; weather.changeAt = 0;
  weather.drought = false; weather.droughtChangeAt = 0;
  updateDroughtIndicator();

  // Profil : couche de base ondulee + bosse centrale sous le logo (au centre du monde).
  var base = vue.U * 0.07, bump = vue.U * 0.08, phase = Math.random() * 10;
  function profile(x) {
    var u = x / vue.worldW;
    var mound = Math.exp(-Math.pow((u - 0.5) / 0.3, 2));
    var wave = Math.sin(u * 9 + phase) * 0.25 + Math.sin(u * 23 + phase * 2) * 0.12;
    return base * (1 + wave) + bump * mound;
  }
  // Profil provisoire, seulement pour trier les triangles sous la crete ; la vraie
  // carte de hauteurs est ensuite reconstruite a partir des facettes gardees.
  for (var c = 0; c < monde.heights.length; c++) monde.heights[c] = profile(c * COL_W);
  monde.soilDepth = base * 1.4 + bump + 10;

  // Maillage low-poly (sommets partages et decales) sur toute la largeur du MONDE,
  // puis on ne garde que les triangles sous la crete : leurs pointes forment une
  // crete dentelee. Coordonnees x en px monde (0..worldW), pas de decalage camera ici.
  var cell = Math.max(6, vue.UW / 160);
  var rows = Math.ceil((base * 1.4 + bump + 6) / cell), cols = Math.ceil(vue.worldW / cell);
  var top = vue.U - rows * cell;
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
  monde.shards = [];
  resetTiles();
  for (j = 0; j < rows; j++) {
    for (i = 0; i < cols; i++) {
      var a = verts[j][i], b = verts[j][i + 1], cc = verts[j + 1][i + 1], d = verts[j + 1][i];
      var tris = Math.random() < 0.5 ? [[a, b, cc], [a, cc, d]] : [[a, b, d], [b, cc, d]];
      addSoilShard(tris[0]);
      addSoilShard(tris[1]);
    }
  }
  monde.heights.fill(0);
  monde.shards.forEach(pileAdd);
  monde.soilRiseT = 0;
  buildRockyPatches();

  // Gazon : couche initiale pleine partout (voir section "Gazon" plus haut). Le suivi de
  // hauteur precedente demarre APRES l'empilement pour ne pas confondre "la terre vient
  // d'etre posee" avec "la terre a ete remuee".
  monde.grassCover = new Float32Array(monde.heights.length);
  monde.grassCover.fill(1);
  for (var rc = 0; rc < monde.rocky.length; rc++) if (monde.rocky[rc]) monde.grassCover[rc] = 0;
  monde.grassPrevH = new Float32Array(monde.heights);
  monde.grassMyc = new Uint8Array(monde.heights.length);
  monde.grassLastNow = null;
  monde.grassNutriAt = 0;

  // Flore (voir section "Flore (cosmetique)" plus haut) : demarre a 0 partout, elle
  // pousse ensuite d'elle-meme pres des arbres/du mycelium au fil d'updateGrass.
  monde.floraLush = new Float32Array(monde.heights.length);
  monde.floraTarget = new Float32Array(monde.heights.length);
}

function addSoilShard(tri) {
  var cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
  var cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
  var surf = surfaceAt(cx);
  if (cy < surf) return;
  // Plus sombre en profondeur : la terre "fraiche" se voit quand on creuse.
  var depth = Math.min(1, (cy - surf) / Math.max(1, vue.U - surf));
  var k = (Math.random() - 0.5) * 0.2 - depth * 0.3;
  var color = shade(hexToRgb(EARTH[(Math.random() * EARTH.length) | 0]), k);
  monde.shards.push({
    pts: tri.map(function (p) { return [p[0] - cx, p[1] - cy]; }),
    ox: cx, oy: cy, x: cx, y: cy, vx: 0, vy: 0, rot: 0, vr: 0,
    from: color, to: color, mix: 1, area: triArea(tri),
    settled: true, col: Math.round(cx / COL_W), soil: true
  });
}

export function triArea(tri) {
  return Math.abs((tri[1][0] - tri[0][0]) * (tri[2][1] - tri[0][1]) - (tri[2][0] - tri[0][0]) * (tri[1][1] - tri[0][1])) / 2;
}

// Construit au moment du clic (pas au chargement) : la boite et le fallback sont
// alors forcement mesures a leur vraie taille.
export function build() {
  updateZoom(); // avant toute mesure : tout ce qui suit est en px logiques
  var rect = container.getBoundingClientRect();
  setupSoil(rect);

  // Le logo est place exactement la ou le CSS affiche le fallback (encore visible
  // a ce moment-la) : taille et position se reglent donc uniquement dans style.css.
  // + camMargin : la boite est centree dans le monde, donc le logo aussi. + camY : zoome,
  // la vue de depart est remontee (camHomeY), sans ca le logo du jeu apparaitrait plus bas
  // que celui de la page.
  var fr = fallbackImg.getBoundingClientRect();
  var lx = (fr.left - rect.left) / vue.ZOOM + vue.camMargin, oy = (fr.top - rect.top) / vue.ZOOM + vue.camY, lw = fr.width / vue.ZOOM, lh = fr.height / vue.ZOOM;
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

  monde.mushrooms = [];
  return true;
}

function addShard(tri, sample, lx, oy, lw, lh) {
  var cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
  var cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
  var s = sample((cx - lx) / lw, (cy - oy) / lh);
  if (s[3] < 110) return;
  var k = (Math.random() - 0.5) * 0.22;
  var area = triArea(tri);
  monde.shards.push({
    pts: tri.map(function (p) { return [p[0] - cx, p[1] - cy]; }),
    ox: cx, oy: cy, x: cx, y: cy, vx: 0, vy: 0, rot: 0, vr: 0,
    from: shade([s[0], s[1], s[2]], k),
    to: shade(hexToRgb(EARTH[(Math.random() * EARTH.length) | 0]), k * 0.8),
    mix: 0, area: area, settled: false, col: -1
  });
}

export function surfaceAt(x) {
  var c = Math.max(0, Math.min(monde.heights.length - 1, Math.round(x / COL_W)));
  return monde.compactY[c] - monde.heights[c];
}
// Vrai tant que la roche est exposee a cette colonne (pas assez de terre meuble
// par-dessus, voir ROCK_COVER_MIN) : rien ne pousse la, mais l'empiler sous du terreau
// (a la pelle) l'enterre et la rend a nouveau fertile, comme demande.
export function isRocky(x) {
  var c = Math.max(0, Math.min(monde.rocky.length - 1, Math.round(x / COL_W)));
  return !!monde.rocky[c] && monde.heights[c] < ROCK_COVER_MIN;
}
// Vrai si la colonne c est sous l'eau d'un lac (entre les bords de sa cuvette, surface du
// sol sous le niveau de l'eau) : ni gazon, ni mycelium, ni arbre. `level` est tenu a jour
// par updateLakes ; y monde, donc "sous l'eau" = surface plus grande que le niveau.
export function isSubmergedCol(c) {
  var li = monde.lakeOf[c];
  if (!li) return false;
  var lk = monde.lakes[li - 1];
  return c >= lk.c0 && c <= lk.c1 && monde.compactY[c] - monde.heights[c] > lk.level + 0.5;
}
export function isSubmerged(x) {
  return isSubmergedCol(Math.max(0, Math.min(monde.heights.length - 1, Math.round(x / COL_W))));
}
// Volume (px2) que la cuvette contient quand l'eau monte jusqu'au niveau y.
function lakeCapacity(lk, y) {
  var v = 0;
  for (var c = lk.c0; c <= lk.c1; c++) {
    var d = monde.compactY[c] - monde.heights[c] - y;
    if (d > 0) v += d;
  }
  return v * COL_W;
}
// Deduit le niveau de chaque lac de son volume (on remplit depuis les colonnes les plus
// basses, par dichotomie) et l'evapore lentement hors pluie. Plafonne au plus bas des
// deux bords : le surplus deborde et est perdu. Recalcule a chaque frame (quelques
// dizaines de colonnes par lac), donc suit la terre ajoutee/enlevee a la pelle.
export function updateLakes(now) {
  var dt = monde.lakeLastT === null ? 0 : Math.max(0, now - monde.lakeLastT);
  monde.lakeLastT = now;
  for (var li = 0; li < monde.lakes.length; li++) {
    var lk = monde.lakes[li];
    if (!weather.raining && lk.vol > 0) lk.vol = Math.max(0, lk.vol - LAKE_EVAP_PER_S * (weather.drought ? 3 : 1) * dt / 1000);
    if (lk.vol <= 0) { lk.level = Infinity; continue; }
    // Bord le plus bas = le plus grand y des deux sommets (y monde : plus grand = plus bas).
    var rim = Math.max(monde.compactY[lk.c0] - monde.heights[lk.c0], monde.compactY[lk.c1] - monde.heights[lk.c1]);
    var cap = lakeCapacity(lk, rim);
    if (lk.vol >= cap) { lk.vol = cap; lk.level = rim; continue; }
    var lo = rim, hi = rim, c;
    for (c = lk.c0; c <= lk.c1; c++) hi = Math.max(hi, monde.compactY[c] - monde.heights[c]);
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
export function drawLakes() {
  for (var li = 0; li < monde.lakes.length; li++) {
    var lk = monde.lakes[li];
    if (lk.level === Infinity || lk.vol < 0.5) continue;
    var x0 = lk.c0 * COL_W, x1 = lk.c1 * COL_W, yw = lk.level, c, sa, sb;
    if (x1 < vue.camX - 20 || x0 > vue.camX + vue.W + 20) continue;
    ctx.fillStyle = 'rgba(58,132,190,0.55)';
    ctx.beginPath();
    ctx.moveTo(x0, yw); ctx.lineTo(x1, yw);
    for (c = lk.c1; c >= lk.c0; c--) ctx.lineTo(c * COL_W, Math.max(yw, monde.compactY[c] - monde.heights[c]));
    ctx.closePath();
    ctx.fill();
    for (c = lk.c0; c < lk.c1; c++) {
      sa = Math.max(yw, monde.compactY[c] - monde.heights[c]); sb = Math.max(yw, monde.compactY[c + 1] - monde.heights[c + 1]);
      if (sa <= yw && sb <= yw) continue;
      ctx.fillStyle = c % 2 ? 'rgba(255,255,255,0.10)' : 'rgba(0,40,90,0.12)';
      poly([[c * COL_W, yw], [(c + 1) * COL_W, yw], c % 2 ? [(c + 1) * COL_W, sb] : [c * COL_W, sa]]);
    }
    ctx.fillStyle = 'rgba(190,230,250,0.55)';
    ctx.beginPath();
    ctx.moveTo(x0, yw); ctx.lineTo(x1, yw);
    for (c = lk.c1; c >= lk.c0; c--) ctx.lineTo(c * COL_W, Math.min(yw + 3, Math.max(yw, monde.compactY[c] - monde.heights[c])));
    ctx.closePath();
    ctx.fill();
  }
}

// Recree les lacs (cuvettes vides) a partir des plaques rocheuses restaurees : une plaque
// est une cuvette si son interieur descend sous ses deux bords (comme dans buildRockyPatches).
export function rebuildLakesFromRocky() {
  monde.lakes = []; monde.lakeOf = new Uint16Array(monde.heights.length);
  var c = 0, n = monde.rocky.length;
  while (c < n) {
    if (!monde.rocky[c]) { c++; continue; }
    var start = c, k;
    while (c < n && monde.rocky[c]) c++;
    var end = c - 1, mid = (start + end) >> 1, cl = start, cr = end, low = monde.compactY[start];
    for (k = start; k <= mid; k++) if (monde.compactY[k] < monde.compactY[cl]) cl = k;
    for (k = mid; k <= end; k++) if (monde.compactY[k] < monde.compactY[cr]) cr = k;
    for (k = cl; k <= cr; k++) low = Math.max(low, monde.compactY[k]);
    if (cr - cl < 2 || low <= Math.max(monde.compactY[cl], monde.compactY[cr]) + 2) continue;
    monde.lakes.push({ p0: start, p1: end, c0: cl, c1: cr, vol: 0, level: Infinity });
    for (k = start; k <= end; k++) monde.lakeOf[k] = monde.lakes.length;
  }
}
// Quelques plaques de roche-mere affleurante, disseminees au hasard sur la largeur du
// monde : des taches ou la couche compacte elle-meme ne se creuse jamais (voir son usage
// dans cutCompact), pas juste une histoire de surface.
function buildRockyPatches() {
  if (restoreWorld()) return;
  monde.rocky = new Uint8Array(monde.heights.length);
  monde.lakes = []; monde.lakeOf = new Uint16Array(monde.heights.length);
  var n = ROCK_PATCH_MIN + ((Math.random() * (ROCK_PATCH_MAX - ROCK_PATCH_MIN + 1)) | 0);
  // Une partie des plaques (au moins une, jamais toutes s'il y en a plusieurs) sont des
  // cuvettes qui retiendront l'eau de pluie (voir updateLakes) au lieu de simples bosses.
  var nBasin = Math.max(1, Math.min(n - 1, Math.round(n * ROCK_BASIN_FRAC)));
  for (var p = 0; p < n; p++) {
    var w = ROCK_PATCH_COLS_MIN + ((Math.random() * (ROCK_PATCH_COLS_MAX - ROCK_PATCH_COLS_MIN + 1)) | 0);
    var start = (Math.random() * Math.max(1, monde.rocky.length - w)) | 0;
    // Bosse (comme le mound du profil general) : un vrai bloc qui depasse du sol, pas
    // une simple tache plate — pointe au milieu de la plaque, s'efface sur les bords.
    var peak = vue.U * (ROCK_H_MIN + Math.random() * (ROCK_H_MAX - ROCK_H_MIN));
    var basin = p < nBasin, dip = vue.U * ROCK_BASIN_DEPTH;
    for (var c = start; c < start + w && c < monde.rocky.length; c++) {
      monde.rocky[c] = 1;
      var t = (c - start) / w, edge = Math.sin(Math.PI * t);
      monde.compactY[c] -= peak * edge;
      // Cuvette : on garde la bosse (bords releves) mais on la creuse au centre par une
      // gaussienne etroite, dosee pour que le fond tombe a `dip` SOUS le sol general
      // (compactY = groundY au repos) : l'eau y tient. Pente douce (sigma ~0.16 w).
      if (basin) monde.compactY[c] += (peak + dip) * Math.exp(-Math.pow((t - 0.5) / 0.16, 2));
    }
    if (basin) {
      var end = Math.min(start + w, monde.rocky.length) - 1, mid = start + (w >> 1), cl = start, cr = end, k;
      // Les bords de la cuvette = points les plus hauts (y le plus petit) de chaque moitie.
      for (k = start; k <= mid; k++) if (monde.compactY[k] < monde.compactY[cl]) cl = k;
      for (k = mid; k <= end; k++) if (monde.compactY[k] < monde.compactY[cr]) cr = k;
      monde.lakes.push({ p0: start, p1: end, c0: cl, c1: cr, vol: 0, level: Infinity });
      for (k = start; k <= end; k++) monde.lakeOf[k] = monde.lakes.length;
    }
  }
  // Degage la terre meuble deposee par l'explosion sur ces colonnes : la roche doit
  // affleurer des le depart (sinon elle resterait cachee sous le tas initial jusqu'au
  // premier coup de pelle).
  monde.shards = monde.shards.filter(function (s) {
    if (!s.soil || !monde.rocky[s.col]) return true;
    pileRemove(s);
    return false;
  });
}
export function pileAdd(s) {
  s.dep = s.area / COL_W * (s.soil || s.extra ? 1 : LOGO_BULK);
  if (s.branch) s.dep *= LOG_BULK; else if (s.leaf) s.dep *= LITTER_BULK; // litiere a plat : kdep memorise ce qui est reellement ajoute
  s.kcol = s.kcol || [0, 0, 0, 0, 0, 0];
  s.kdep = s.kdep || [0, 0, 0, 0, 0, 0];
  for (var k = 0; k < KERNEL.length; k++) {
    var t = s.col + k - 3;
    // Hors limites, ou de l'autre cote d'un pas de compact (trou/paroi) : ce partage
    // reste sur la colonne de la facette au lieu de "traverser" le pas.
    if (t < 0 || t >= monde.heights.length || Math.abs(monde.compactY[t] - monde.compactY[s.col]) > REPOSE) t = s.col;
    var amt = s.dep * KERNEL[k];
    s.kcol[k] = t;
    s.kdep[k] = amt;
    monde.heights[t] = Math.max(0, monde.heights[t] + amt);
  }
}
export function pileRemove(s) {
  if (!s.kcol) return; // jamais empilee (ne devrait pas arriver)
  for (var k = 0; k < KERNEL.length; k++) monde.heights[s.kcol[k]] = Math.max(0, monde.heights[s.kcol[k]] - s.kdep[k]);
}

// Comme du sable : une facette qui tombe sur une pente trop raide roule vers la
// colonne voisine la plus basse, au lieu de s'empiler en aiguille.
export function restColumn(x) {
  var c = Math.max(0, Math.min(monde.heights.length - 1, Math.round(x / COL_W)));
  for (var n = 0; n < 60; n++) {
    var sc = monde.compactY[c] - monde.heights[c];
    var sl = c > 0 ? monde.compactY[c - 1] - monde.heights[c - 1] : -Infinity;
    var sr = c < monde.heights.length - 1 ? monde.compactY[c + 1] - monde.heights[c + 1] : -Infinity;
    // Surface = y monde : plus grand = plus bas. On roule vers le voisin le plus bas.
    var lowSurf = Math.max(sl, sr);
    if (lowSurf === -Infinity || lowSurf - sc <= REPOSE) break;
    c = sl > sr ? c - 1 : c + 1;
  }
  return c;
}

// Demarrage du module : appele une seule fois par principal.js, dans un ordre fixe.
export function initTerrain() {
  img.onload = function () {
    partie.imgReady = true;
    // Canvas pret : on montre la legende, cachee par defaut pour les visiteurs
    // reduced-motion / no-JS qui ne verront jamais l'animation tourner.
    setCaption(CAPTION_BEFORE);
    if (caption) caption.classList.remove('d-none');
  };
  img.src = logoUrl;
}
