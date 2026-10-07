// Loupe : outil d'observation (ne touche a rien) ; la lentille grossit, vise un sujet et ouvre sa fiche.
import { clamp, lerp } from './utils.js';
import {
  LOUPE_R, LOUPE_ZOOM, LOUPE_LIFT, LOUPE_HIT, HAND_ZOOM_K, SPECIES, COL_W, LITTER_FLAT, CANOPY_CLUSTER_R,
  BRANCH_GROW_MS, TREE_EMBED, ROOT_GROWTH_MIN, ROOT_DEPTH_MIN, ROOT_DEPTH_MAX
} from './config.js';
import { container, canvas, ctx, partie, vue, monde, temps, toolBtns } from './etat.js';
import { poly } from './rendu.js';
import { surfaceAt } from './terrain.js';
import { treeScale } from './arbres.js';
import { buildTip, openTip, positionTreasureOverlays } from './cartes.js';

// Position ECRAN du pointeur (px logiques, comme getRelativePos) : le monde defile sous la
// lentille sans evenement pointeur, le point examine se recalcule donc a l'usage (+ camX/camY).
export var loupe = { on: false, sx: 0, sy: 0, touch: false, subject: null };

var SIDES = 16;                        // cotes de l'anneau et du verre (low-poly)
var RING = 0.16;                       // epaisseur de la monture (x rayon de la lentille)
var lastWx = 1e9, lastWy = 1e9;        // centre monde de la lentille au dernier calcul du sujet
var labelEl = null, labelText = '', labelW = 0;
var cards = {};                        // id de fiche -> carte (gardee : les photos restent chargees)

export function enterLoupe(p, touch) {
  loupe.on = true;
  loupe.sx = p.x; loupe.sy = p.y;
  loupe.touch = !!touch;
  loupe.subject = null;
  lastWx = lastWy = 1e9;
  container.classList.add('is-tool-cursor');
  startPreload(); // une seule fois : les photos des fiches arrivent en fond pendant qu'on explore
}
export function moveLoupe(p, touch) {
  loupe.sx = p.x; loupe.sy = p.y;
  if (touch !== undefined) loupe.touch = !!touch;
}
// La carte ouverte reste (voir closeLoupeCard) : au doigt la loupe disparait au relachement, pas sa fiche.
export function leaveLoupe() {
  if (!loupe.on) return;
  loupe.on = false;
  loupe.subject = null;
  container.classList.remove('is-tool-cursor');
  if (labelEl) labelEl.classList.add('d-none');
}
// Bouton de la barre d'outils signale comme nouveau (visible meme barre repliee, voir jeu.css).
export function setLoupeNew(on) {
  for (var i = 0; i < toolBtns.length; i++) {
    if (toolBtns[i].getAttribute('data-tool') === 'loupe') toolBtns[i].classList.toggle('is-new', !!on);
  }
}

// Lentille en coord. ECRAN (px logiques) : centre, rayon (grossi comme le poing de la main
// quand le jeu est dezoome), tolerance de visee. Au doigt elle flotte au-dessus pour qu'on voie
// a travers ; a la souris son centre est sur le curseur. C'est son CENTRE qui vise.
function lens() {
  var k = vue.ZOOM < 1 ? HAND_ZOOM_K : 1, r = LOUPE_R * k, y = loupe.sy;
  if (loupe.touch) y -= Math.max(LOUPE_LIFT / vue.ZOOM, r * (1 + RING) + 8); // LOUPE_LIFT est en px CSS
  return { x: loupe.sx, y: y, r: r, hit: LOUPE_HIT * k };
}

// --- Fiches --------------------------------------------------------------------------
// Photos : noms de fichiers dans assets/img/ (ou { src, credit, credit_url }), resolus depuis ce module.
var PLEUROTE_TEXT = 'Il pousse en bouquets étagés sur le bois mort, surtout celui des feuillus. Ses lames descendent le long d’un pied court, placé sur le côté. Sa couleur va du beige au gris-bleu selon la souche, la lumière et la température. Son mycélium est aussi un prédateur : il paralyse de minuscules vers du sol, les nématodes, puis les digère, sans doute pour trouver l’azote qui manque dans le bois.';
function pleurote(imgs) {
  return { title: 'Pleurote en huître', latin: 'Pleurotus ostreatus', img: imgs, url: '/shop/', cta: 'Voir la boutique', text: PLEUROTE_TEXT };
}
var FICHES = {
  pleurote: pleurote(['produits/pleurote-huitre.jpg', 'produits/pleurote-gris.jpg']),
  pleurote_gris: pleurote(['produits/pleurote-gris.jpg', 'produits/pleurote-huitre.jpg']),
  pleurote_rose: {
    title: 'Pleurote rose', latin: 'Pleurotus djamor', img: ['produits/pleurote-rose-cutout.webp'], url: '/shop/', cta: 'Voir la boutique',
    text: 'Une espèce des régions tropicales et subtropicales, qui décompose le bois mort. Elle aime la chaleur et craint le froid. Son rose vif pâlit en vieillissant.'
  },
  hydne: {
    title: 'Hydne hérisson', latin: 'Hericium erinaceus', img: ['produits/hydne-herisson.jpg', 'banner-hydne-automne.webp'], url: '/shop/', cta: 'Voir la boutique',
    text: 'Ni chapeau ni lames : une masse blanche couverte d’aiguillons qui pendent, et c’est à leur surface que se forment les spores. Il pousse sur les feuillus, souvent sur la blessure d’un arbre vivant ou sur du bois mort, qu’il décompose. Il jaunit en vieillissant.'
  },
  shiitake: {
    title: 'Shiitake', latin: 'Lentinula edodes',
    img: [{ src: 'shiitake-buches.webp', credit: 'Sakurai Midori · CC BY-SA 3.0', credit_url: 'https://commons.wikimedia.org/wiki/File:Lentinula_edodes_shiitake.JPG' }],
    text: 'Originaire d’Asie de l’Est, il pousse sur le bois mort de feuillus comme les chênes. Son nom japonais veut dire « champignon du shii », un arbre de la même famille que le chêne. C’est l’un des champignons les plus cultivés au monde.'
  },
  strophaire: {
    title: 'Strophaire rouge vin', latin: 'Stropharia rugosoannulata',
    img: [
      'strophaire.webp',
      { src: 'strophaire-groupe.webp', credit: 'Ann F. Berger · CC BY-SA 3.0', credit_url: 'https://commons.wikimedia.org/wiki/File:2011-05-19_Stropharia_rugosoannulata_Farl._ex_Murrill_183478.jpg' }
    ],
    url: '/product/mycelium-en-vrac', cta: 'Voir le produit',
    text: 'Un champignon de jardin, aussi appelé strophaire à anneau rugueux : il décompose les copeaux de bois et la paille. On le reconnaît à son chapeau rouge vin, qui pâlit avec l’âge, à ses lames gris-violet et à l’anneau épais et strié de son pied. Son mycélium porte des cellules à pointes, les acanthocytes, capables d’immobiliser et de tuer des nématodes.',
    plus: [
      'Les acanthocytes sont des cellules hérissées de pointes, comme de petits doigts. Le mycélium du strophaire en produit en abondance.',
      'En laboratoire, sur gélose, des chercheurs ont vu ce champignon immobiliser un nématode libre (Panagrellus redivivus) en quelques minutes, et le nématode du pin (Bursaphelenchus xylophilus) en quelques heures. Les vers du premier étaient entièrement dégradés par le champignon en 24 à 48 heures.',
      'Ce sont bien ces cellules à pointes qui mènent l’attaque, et la force mécanique y joue un rôle important. Le pleurote s’y prend autrement : il paralyse les nématodes avec une toxine.',
      'Des essais dans la terre suggèrent que les acanthocytes y fonctionnent aussi.'
    ],
    source: 'Source : Luo et coll., 2006, Applied and Environmental Microbiology.'
  },
  mycelium: {
    title: 'Mycélium',
    img: [
      { src: 'mycelium-terre.webp', credit: 'Rosser1954 · CC BY-SA 4.0', credit_url: 'https://commons.wikimedia.org/wiki/File:Mycelium_growth,_Chapeltoun,_North_Ayrshire.jpg' },
      { src: 'mycelium-filaments.webp', credit: 'Lex vB · CC BY-SA 3.0', credit_url: 'https://commons.wikimedia.org/wiki/File:Mushroom%27s_roots_(myc%C3%A9lium).jpg' }
    ],
    text: 'C’est le vrai corps du champignon : un réseau de filaments très fins, les hyphes, qui s’allongent par leur pointe et se ramifient. Il digère sa nourriture à l’extérieur, en libérant des enzymes, puis absorbe ce qui est dissous. Le champignon que l’on cueille n’est que son fruit : il sert à répandre les spores.'
  },
  mycmort: {
    title: 'Mycélium desséché',
    text: 'Les hyphes sont des filaments très fins qui ont besoin d’humidité. Quand le milieu s’assèche, le mycélium cesse de croître ; si la sécheresse dure, il finit par mourir. Ses restes ne sont pas perdus : d’autres microbes les décomposent et ils enrichissent le sol.'
  },
  bois: {
    title: 'Bois mort et feuilles mortes', img: ['tas-feuilles-bois-2022.webp', 'pleurote-feuilles-2022-800.webp'],
    text: 'Le bois est surtout fait de cellulose et de lignine. La lignine est une matière très résistante : les champignons de la pourriture blanche, comme les pleurotes et l’hydne hérisson, sont parmi les rares êtres vivants capables de la décomposer. Sans les champignons, le bois mort mettrait beaucoup plus de temps à disparaître.'
  },
  nutriment: {
    title: 'Nutriments',
    img: [{ src: 'humus-hetraie.webp', credit: 'Jfponge · CC0', credit_url: 'https://commons.wikimedia.org/wiki/File:Moder_dans_une_h%C3%AAtraie.png' }],
    text: 'En décomposant le bois et les feuilles, le mycélium libère peu à peu les éléments qu’ils contenaient, comme l’azote et le phosphore. Les racines des plantes peuvent alors les absorber. La pluie en entraîne une partie en profondeur, surtout l’azote : c’est le lessivage. La vie du sol freine cette perte : le mycélium et les microbes gardent un temps une partie de ces éléments dans leurs cellules, puis les relâchent.'
  },
  arbre: {
    title: 'Arbre',
    img: [{ src: 'erable-a-sucre.webp', credit: 'Cephas · CC BY-SA 4.0', credit_url: 'https://commons.wikimedia.org/wiki/File:Acer_saccharum_UL_01.jpg' }],
    text: 'Ses racines les plus fines puisent l’eau et les minéraux du sol. En tombant, ses feuilles rendent au sol une partie de ce qu’il y a puisé. Dans la nature, la plupart des arbres s’associent aussi à des champignons dits mycorhiziens ; ceux du jeu sont des décomposeurs : ils se nourrissent de bois mort et d’autres débris végétaux.'
  }
};
// Index de SPECIES -> fiche (meme ordre que le tableau de config.js).
var FICHE_OF_SPECIES = ['pleurote_gris', 'pleurote_rose', 'hydne', 'pleurote', 'shiitake', 'strophaire'];

function imgUrl(name) { return new URL('../../img/' + name, import.meta.url).href; }
function makeCard(id) {
  var f = FICHES[id];
  var imgs = (f.img || []).map(function (im) {
    return typeof im === 'string' ? imgUrl(im) : { src: imgUrl(im.src), credit: im.credit, credit_url: im.credit_url };
  });
  var card = buildTip({ title: f.title, latin: f.latin, text: f.text, img: imgs.length ? imgs : null, url: f.url, cta: f.cta });
  card.classList.add('is-loupe');
  if (f.plus) addPlus(card, f);
  // Clic sur la photo : agrandie / reduite (c'est agrandie qu'elle montre le credit de la photo).
  card.addEventListener('click', function (evt) {
    if (evt.target.tagName === 'IMG') card.classList.toggle('is-zoom');
  });
  return card;
}

// « En savoir plus » : un second texte, plus pousse, replie sous le premier (fiches qui ont `plus`).
// Pose avant le lien de la boutique ; la source reste en texte simple (un lien dans le corps de
// la carte passerait par le voile « quitter le jeu » des liens produit, voir tresors.js).
function addPlus(card, f) {
  var host = card.querySelector('.logo-explosion-tip-more > div') || card.querySelector('.logo-explosion-tip-body');
  var btn = document.createElement('button'), box = document.createElement('div');
  btn.type = 'button';
  btn.className = 'logo-explosion-tip-plus-btn';
  btn.setAttribute('aria-expanded', 'false');
  btn.textContent = 'En savoir plus';
  box.className = 'logo-explosion-tip-plus';
  f.plus.forEach(function (t) {
    var para = document.createElement('p');
    para.textContent = t;
    box.appendChild(para);
  });
  if (f.source) {
    var src = document.createElement('small');
    src.textContent = f.source;
    box.appendChild(src);
  }
  btn.addEventListener('click', function (evt) {
    evt.stopPropagation();
    var on = card.classList.toggle('is-plus');
    btn.textContent = on ? 'Réduire' : 'En savoir plus';
    btn.setAttribute('aria-expanded', on ? 'true' : 'false');
    positionTreasureOverlays(); // la carte change de hauteur : elle se replace au-dessus de la lentille
  });
  var link = host.querySelector('a');
  host.insertBefore(btn, link);
  host.insertBefore(box, link);
}

// Carte du sujet examine : une seule, au-dessus de la lentille (voir positionTreasureOverlays).
// Le texte est deplie d'emblee, c'est le but de la loupe.
function showCard(id, L) {
  var card = cards[id] || (cards[id] = makeCard(id));
  if (monde.loupeTip && monde.loupeTip !== card) { monde.loupeTip.classList.remove('is-open'); monde.loupeTip.remove(); }
  if (card.parentNode !== container) container.appendChild(card);
  monde.loupeTip = card;
  monde.loupeAt = { x: L.x + vue.camX, y: L.y + vue.camY, r: L.r };
  card.classList.remove('is-zoom', 'is-plus');
  var plusBtn = card.querySelector('.logo-explosion-tip-plus-btn');
  if (plusBtn) { plusBtn.textContent = 'En savoir plus'; plusBtn.setAttribute('aria-expanded', 'false'); }
  card.classList.add('is-details');
  openTip('loupe');
  positionTreasureOverlays();
}
// Changement d'outil : la carte part avec la loupe.
export function closeLoupeCard() {
  if (!monde.loupeTip) return;
  if (monde.loupeTip.classList.contains('is-open')) openTip(null);
  monde.loupeTip.remove();
  monde.loupeTip = null;
  monde.loupeAt = null;
}
// Clic ou relachement : la fiche du sujet sous la lentille ; le vide ferme toute carte.
export function examine() {
  if (!loupe.on) return;
  updateSubject(true);
  if (!loupe.subject) { openTip(null); return; }
  showCard(loupe.subject, lens());
}

// --- Visee ---------------------------------------------------------------------------
function inEllipse(dx, dy, rx, ry) { return dx * dx / (rx * rx) + dy * dy / (ry * ry) < 1; }
function segDist(px, py, ax, ay, bx, by) {
  var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  var u = l2 > 0 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
  return Math.hypot(px - (ax + dx * u), py - (ay + dy * u));
}

// Arbre sous (x, y) : tronc (la partie qui sort du sol), houppier (un bouquet par branche, comme
// drawTree les dessine) ou racines (seulement la ou on les voit : sur l'aplat compact, pas sous
// la terre meuble qui les cache).
function treeAt(x, y, hit) {
  var now = temps.vTime, col = clamp(Math.round(x / COL_W), 0, monde.compactY.length - 1);
  for (var ti = 0; ti < monde.trees.length; ti++) {
    var t = monde.trees[ti], tg = treeScale(t), by = t.by !== undefined ? t.by : surfaceAt(t.x) + TREE_EMBED;
    var h = t.h * tg, w = vue.U * 0.035 * tg, top = by - h, i, k, rt;
    if (y > top - hit && y < by - TREE_EMBED + 2 && Math.abs(x - t.x) < w * (1 - 0.65 * clamp((by - y) / h, 0, 1)) + hit * 0.5) return true;
    for (i = 0; i < t.limbs.length; i++) {
      var lm = t.limbs[i];
      if (lm.broken !== undefined || !lm.cnt) continue; // cassee, ou sans feuille : rien d'affiche
      var R = CANOPY_CLUSTER_R * vue.U * tg * (0.45 + 0.65 * Math.min(1, lm.w / Math.max(1, lm.n, lm.cnt)));
      if (inEllipse(x - (t.x + lm.dx * tg), y - (top + lm.dy * tg), R + hit * 0.5, R * 0.8 + hit * 0.5)) return true;
    }
    for (i = 0; i < t.slots.length; i++) {
      var sl = t.slots[i], lf = sl.leaf; // petit bouquet au bout d'une branche bonus
      if (!sl.branch || !sl.mj || !lf || now < lf.born) continue;
      var bg = Math.min(1, (now - sl.branchSince) / BRANCH_GROW_MS), bR = CANOPY_CLUSTER_R * vue.U * tg * 0.5 * Math.min(1, lf.dg || 0) * bg;
      if (inEllipse(x - (t.x + sl.dx * tg * bg), y - (top + sl.dy * tg * bg), bR + hit * 0.5, bR * 0.8 + hit * 0.5)) return true;
    }
    if (y < monde.compactY[col] - 2) continue;
    var rg = lerp(ROOT_GROWTH_MIN, 1, t.growth), w0 = vue.U * 0.014;
    var tipY = surfaceAt(t.x) + vue.U * lerp(ROOT_DEPTH_MIN, ROOT_DEPTH_MAX, t.growth);
    if (segDist(x, y, t.x, by, t.x, tipY) < w0 * 1.3 + hit * 0.5) return true; // racine pivot
    for (i = 0; i < t.roots.length; i++) {
      rt = t.roots[i];
      for (k = 0; k < rt.pts.length - 1; k++) {
        if (segDist(x, y, t.x + rt.pts[k][0] * rg, by + rt.pts[k][1] * rg, t.x + rt.pts[k + 1][0] * rg, by + rt.pts[k + 1][1] * rg) < w0 + hit * 0.5) return true;
      }
      for (k = 0; k < rt.fork.length - 1; k++) {
        if (segDist(x, y, t.x + rt.fork[k][0] * rg, by + rt.fork[k][1] * rg, t.x + rt.fork[k + 1][0] * rg, by + rt.fork[k + 1][1] * rg) < w0 + hit * 0.5) return true;
      }
    }
  }
  return false;
}

// Id de fiche du sujet sous le point monde (x, y), ou null. Priorite : champignon, bois mort ou
// feuille posee, mycelium mort, mycelium vivant, nutriment, arbre. Les zones suivent ce que le
// rendu dessine (mushrooms : meme zone que harvestableNear ; bois : drawLog ; feuille : posee a plat).
function subjectAt(x, y, hit) {
  var i, s, m, d, best = null, bestD = 1e9;
  for (i = 0; i < monde.mushrooms.length; i++) {
    m = monde.mushrooms[i];
    if (m.dying || m.t <= 0.3) continue;
    var sy = surfaceAt(m.x);
    d = Math.abs(x - m.x);
    if (d < m.size * 0.9 && y > sy - m.size * 1.6 && y < sy + 4 && d < bestD) { bestD = d; best = m; }
  }
  if (best && SPECIES.indexOf(best.sp) >= 0) return FICHE_OF_SPECIES[SPECIES.indexOf(best.sp)];
  var L = vue.U * 0.0425, T = vue.U * 0.007; // demi-longueur et demi-epaisseur d'un baton (drawLog)
  for (i = 0; i < monde.litter.length; i++) {
    s = monde.litter[i];
    if (!s.settled || s.carried || s.dead || s.eaten !== undefined) continue; // seulement ce qui est POSE
    if (s.branch) {
      if (Math.abs(x - s.x) < L + hit * 0.5 && Math.abs(y - (s.y + T * 0.66)) < T + hit) return 'bois';
    } else {
      var p = s.pts, rr = Math.max(Math.abs(p[0][0]), Math.abs(p[0][1]), Math.abs(p[1][0]), Math.abs(p[1][1]), Math.abs(p[2][0]), Math.abs(p[2][1]));
      if (Math.abs(x - s.x) < rr + hit * 0.5 && Math.abs(y - (s.y + 1)) < rr * LITTER_FLAT + hit) return 'bois';
    }
  }
  // Pendant la montee du lit de terre (debut de partie) les facettes du lit sont decalees, comme au dessin.
  var rise = monde.soilRiseT < 1 ? Math.pow(1 - monde.soilRiseT, 3) * monde.soilDepth : 0;
  for (i = 0; i < monde.deadMyc.length; i++) {
    s = monde.deadMyc[i];
    if (!s.settled || s.dead || s.eaten !== undefined) continue;
    if (Math.hypot(x - s.x, y - (s.y + (s.soil ? rise : 0))) < hit) return 'mycmort';
  }
  for (i = 0; i < monde.colonised.length; i++) {
    s = monde.colonised[i];
    if (!s.settled || s.dead || s.deadMyc || s.eaten !== undefined || !(s.myc >= 0.3)) continue;
    if (Math.hypot(x - s.x, y - (s.y + (s.soil ? rise : 0))) < hit) return 'mycelium';
  }
  for (i = 0; i < monde.shards.length; i++) {
    s = monde.shards[i];
    if (!s.nutri || !s.settled || s.dead || s.eaten !== undefined) continue;
    if (Math.hypot(x - s.x, y - (s.y + (s.soil ? rise : 0))) < hit) return 'nutriment';
  }
  return treeAt(x, y, hit) ? 'arbre' : null;
}

// Recalcule le sujet seulement si le centre monde de la lentille a bouge d'au moins 2 px (ou sur demande).
function updateSubject(force) {
  var L = lens(), wx = L.x + vue.camX, wy = L.y + vue.camY;
  if (!force && Math.abs(wx - lastWx) < 2 && Math.abs(wy - lastWy) < 2) return;
  lastWx = wx; lastWy = wy;
  var prev = loupe.subject;
  loupe.subject = subjectAt(wx, wy, L.hit);
  if (loupe.subject && loupe.subject !== prev) preloadSubject(loupe.subject);
}

// --- Prechargement des photos ----------------------------------------------------------
// Des que la loupe est prise, les photos des fiches se chargent en fond, une a la fois (la 1re
// photo de chaque fiche d'abord, les suivantes ensuite). Le sujet vise passe devant la file :
// ses photos partent tout de suite, la 1re en priorite haute, pour que la fiche s'ouvre avec sa photo.
var preQueue = null, preBusy = false, preDone = {};
function ficheImgs(id) {
  return (FICHES[id].img || []).map(function (im) { return imgUrl(typeof im === 'string' ? im : im.src); });
}
function preloadOne(url, urgent, then) {
  if (preDone[url]) { if (then) then(); return; }
  var im = new Image();
  preDone[url] = im;
  if (urgent) im.fetchPriority = 'high';
  if (then) { im.addEventListener('load', then); im.addEventListener('error', then); }
  im.src = url;
  if (im.decode) im.decode().catch(function () {});
}
function preloadNext() {
  if (preBusy) return;
  while (preQueue.length && preDone[preQueue[0]]) preQueue.shift();
  if (!preQueue.length) return;
  preBusy = true;
  preloadOne(preQueue.shift(), false, function () { preBusy = false; preloadNext(); });
}
function startPreload() {
  if (preQueue) return;
  var firsts = [], rest = [];
  Object.keys(FICHES).forEach(function (id) {
    var urls = ficheImgs(id);
    if (urls.length) firsts.push(urls[0]);
    rest = rest.concat(urls.slice(1));
  });
  preQueue = firsts.concat(rest);
  preloadNext();
}
function preloadSubject(id) {
  ficheImgs(id).forEach(function (url, i) { preloadOne(url, i === 0); });
}

// --- Dessin --------------------------------------------------------------------------
function ngon(cx, cy, r) {
  var pts = [];
  for (var i = 0; i < SIDES; i++) {
    var a = i / SIDES * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}
function addPath(pts) {
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

// Etiquette HTML sous la lentille : nom du sujet vise (px CSS = px logiques * ZOOM, comme les autres overlays).
function updateLabel(L) {
  var f = loupe.subject && FICHES[loupe.subject];
  if (!f) { if (labelEl) labelEl.classList.add('d-none'); return; }
  if (!labelEl) {
    labelEl = document.createElement('div');
    labelEl.className = 'logo-explosion-loupe-label d-none';
    labelEl.setAttribute('aria-hidden', 'true');
    container.appendChild(labelEl);
  }
  if (labelText !== f.title) {
    labelEl.textContent = f.title;
    labelText = f.title;
    labelEl.classList.remove('d-none');
    labelW = labelEl.offsetWidth;
  }
  labelEl.classList.remove('d-none');
  labelEl.style.left = clamp(L.x * vue.ZOOM, labelW / 2 + 4, vue.W * vue.ZOOM - labelW / 2 - 4) + 'px';
  labelEl.style.top = ((L.y + L.r) * vue.ZOOM + 10) + 'px';
}

// Apres tout le monde, en coord. ecran : l'appelant (draw) a deja rendu le repere camera.
export function drawLoupe() {
  if (!loupe.on || partie.mode !== 'exploded') { if (labelEl) labelEl.classList.add('d-none'); return; }
  updateSubject(false);
  var L = lens(), r = L.r, cx = L.x, cy = L.y, ring = r * RING;
  ctx.save();
  // Grossissement reel : le canvas se recopie sur lui-meme, decoupe a la forme de la lentille.
  if (LOUPE_ZOOM > 1) {
    var pr = r * vue.RS, pcx = cx * vue.RS, pcy = cy * vue.RS, src = 2 * pr / LOUPE_ZOOM;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.beginPath();
    addPath(ngon(pcx, pcy, pr));
    ctx.clip();
    ctx.drawImage(canvas, pcx - src / 2, pcy - src / 2, src, src, pcx - pr, pcy - pr, 2 * pr, 2 * pr);
    ctx.restore();
    ctx.save();
  }
  ctx.setTransform(vue.RS, 0, 0, vue.RS, 0, 0);
  // Verre : voile tres leger et un reflet en haut a gauche.
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.beginPath();
  addPath(ngon(cx, cy, r));
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  poly([[cx - r * 0.72, cy - r * 0.22], [cx - r * 0.22, cy - r * 0.72], [cx - r * 0.3, cy - r * 0.3]]);
  // Manche en bois (deux tons) : vers le bas a droite a la souris, droit vers le doigt au toucher.
  var dx = loupe.touch ? 0 : Math.SQRT1_2, dy = loupe.touch ? 1 : Math.SQRT1_2, nx = -dy, ny = dx;
  var x0 = cx + dx * (r + ring / 2), y0 = cy + dy * (r + ring / 2), len = loupe.touch ? Math.max(4, loupe.sy - y0) : r * 1.15;
  var x1 = x0 + dx * len, y1 = y0 + dy * len, hw = r * 0.13, hw1 = hw * 0.85;
  ctx.fillStyle = '#8a6240';
  poly([[x0 + nx * hw, y0 + ny * hw], [x0, y0], [x1, y1], [x1 + nx * hw1, y1 + ny * hw1]]);
  ctx.fillStyle = '#6b4a2f';
  poly([[x0, y0], [x0 - nx * hw, y0 - ny * hw], [x1 - nx * hw1, y1 - ny * hw1], [x1, y1]]);
  // Monture : sombre, laiton des qu'un sujet est vise.
  ctx.fillStyle = loupe.subject ? '#d4a64a' : '#3b2f2a';
  ctx.beginPath();
  addPath(ngon(cx, cy, r + ring));
  addPath(ngon(cx, cy, r));
  ctx.fill('evenodd');
  ctx.restore();
  updateLabel(L);
}
