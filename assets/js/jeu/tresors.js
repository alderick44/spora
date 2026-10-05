// Tresors : objets enfouis, boussole, souches de mycelium et fin de la demo.
import { hexToRgb, mixRgb, rgbStr, clamp } from './utils.js';
import {
  STRAIN_STD, MUSHROOM_PRICE, MYC, STRAIN_MIX, HYPHA_COLOR, COL_W, DEMO_TREASURE_X, HINT_FIST_SVG,
  HINT_SHOVEL_SVG, BEDROCK_MARGIN, DIG_HINT_MSG, COMPASS_BOTTOM_PAD, COMPASS_RISE_FRAC, COMPASS_HIDE,
  COMPASS_ARROW, COMPASS_ICON, COMPASS_MSG, COMPASS_TIP_W, DEMO_END_DELAY, DEMO_KEY, TREASURE_NEAR,
  DIG_TO_REVEAL, SPECIES, TIP_SWIPE_PX, TIP_REVEAL_HOLD_MS, NUGGET_R, NUGGET_COLORS, GOLD_BITS_N,
  GOLD_BITS_LIFE, GRAVITY, AIR
} from './config.js';
import {
  partie, canvas, monde, vue, container, treasureCountEl, shelfEl, strainsBar, isMobile, toolsArrow, ctx
} from './etat.js';
import { poly } from './rendu.js';
import { surfaceAt, pileRemove } from './terrain.js';
import { foundList, savePlayerIfChanged } from './sauvegarde.js';
import { updateMoneyUI } from './economie.js';
import { shovel, shovelPlant, setTool } from './outils.js';
import {
  tipImgs, positionTreasureOverlays, hideDigTip, buildTip, tipIdle, tapTip, openTip, tipAway
} from './cartes.js';
import { setCaption } from './messages.js';
import { updateChallengeUI } from './defis.js';
import { guideFlags, guideCurrent, guideSet } from './tutoriel.js';
import { startLoop, siteHeader, getRelativePos } from './principal.js';

var treasuresFound = 0;                 // tresors deterres depuis la derniere explosion (repart a 0 au rebuild)
export var strainById = { standard: STRAIN_STD };
export var strainOrder = [STRAIN_STD];         // ordre du menu : standard, puis dans l'ordre des tresors
export function tintCol(hex, strain) { return strain ? rgbStr(mixRgb(hexToRgb(hex), strain.tintRgb, STRAIN_MIX).map(Math.round)) : hex; }
export function currentStrain() { return strainById[partie.bagStrain] || STRAIN_STD; }

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
export function setupTreasures() {
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
export function updateCompass() {
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

export function clearTreasures() {
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
export function hideDemoEnd() {
  clearTimeout(demoEndTimer);
  if (demoEndEl) demoEndEl.classList.add('d-none');
}
// Sur l'accueil le header flotte par-dessus le haut de la boite et change de hauteur (etendu /
// compact) : le voile commence sous lui, et le suit (syncTick, defilement, redimensionnement).
export function syncDemoEndTop() {
  if (!demoEndEl || demoEndEl.classList.contains('d-none')) return;
  var hb = siteHeader ? siteHeader.getBoundingClientRect().bottom - container.getBoundingClientRect().top : 0;
  demoEndEl.style.top = Math.max(0, Math.min(hb, vue.U * 0.55)) + 'px'; // px CSS : U = hauteur CSS de la boite
}
export function queueDemoEnd() {
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
export function updateStrainBar() {
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
export function pickTreasureStrain(t) { if (t) t.tipClosed = false; if (t && t.strainId) setStrain(t.strainId); }

function unlockStrain(id) {
  if (!strainById[id] || partie.unlockedStrains.indexOf(id) !== -1) return false;
  partie.unlockedStrains.push(id);
  refreshStrainBar();
  return true;
}

// Retire juste la bulle DOM (le rebuild fait tomber le champignon qui la portait) —
// mycTipShown n'est PAS reinitialise : elle ne doit s'afficher qu'une fois par page.
export function clearMycTip() {
  if (monde.mycTip) { monde.mycTip.remove(); monde.mycTip = null; }
  monde.mycTipMushroom = null;
}

// Hauteur (y monde) du tresor non deterre : fixe s'il est enfoui profond, sinon a la surface.
export function treasureY(t) {
  return t.deep ? t.y : surfaceAt(t.x);
}
// Vrai si la surface actuelle est assez pres au-dessus du tresor pour le repérer / le
// creuser (toujours vrai pour un tresor "a la surface" ; aussi vrai si on a creuse plus bas que lui).
function treasureReachable(t) {
  return treasureY(t) - surfaceAt(t.x) < TREASURE_NEAR;
}
export function grabTreasureAt(pos) {
  var t = treasureNear(pos.x, pos.y);
  if (!t || !t.revealed || !t.mushroom) return null;
  return { t: t, dx: t.x - pos.x };
}
export function moveTreasure(t, x) {
  x = clamp(x, 30, vue.worldW - 30);
  var off = t.nx - t.x;
  t.x = x; t.mushroom.x = x; t.nx = x + off;
  t.deep = false; t.y = surfaceAt(x); // repose a la surface, comme s'il venait d'etre deterre
}
export function treasureNear(x, y) {
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
export function digAt(t) {
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

export function tryDig(t, amount) {
  if (t.revealed || t.deep || !treasureReachable(t)) return; // un tresor enfoui ne se deterre qu'en creusant jusqu'a lui (voir step)
  t.dig += amount;
  if (t.dig >= DIG_TO_REVEAL) reveal(t);
}

export function reveal(t) {
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
export function nuggetY(t) {
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

export function stepGoldBits() {
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

// Demarrage du module : appele une seule fois par principal.js, dans un ordre fixe.
export function initTresors() {
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
export function initTresorsUI() {
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
