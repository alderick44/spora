// Tutoriel guide : fleche d'invite pilotee par une table d'etapes.
import { clamp } from './utils.js';
import {
  GUIDE_KEY, TREE_EMBED, CAPTION_MYC_DROP, CAPTION_MYC_LEAVES, CAPTION_MYC_TREE_WAIT, CAPTION_MYC_TREE_NONE,
  CAPTION_MYC_REPOUR, CAPTION_MYC_HARVEST, CAPTION_MYC_GROW, CAPTION_MYC_PLACE, CAPTION_MYC_HAND
} from './config.js';
import { partie, toolsBar, vue, monde, strainsBar, toolsArrow, caption, container } from './etat.js';
import { surfaceAt } from './terrain.js';
import { matureTrees, treeScale, underMatureTree } from './arbres.js';
import { setCaption } from './messages.js';
import { loopPaused } from './physique.js';

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

// Relance la boucle de la fleche : a appeler quand la fleche est montree (d-none retire) ou
// quand le jeu revient a l'ecran. Sans effet si elle tourne deja.
var arrowStep = null, arrowOn = false;
export function startGuideArrow() {
  if (!arrowStep || arrowOn) return;
  arrowOn = true;
  requestAnimationFrame(arrowStep);
}

// Demarrage du module : appele une seule fois par principal.js, dans un ordre fixe.
export function initTutoriel() {
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
    // La boucle ne tourne que si la fleche est affichee et le jeu a l'ecran : sinon elle
    // s'arrete, et startGuideArrow() la relance.
    arrowStep = function stepGuideArrow() {
      if (toolsArrow.classList.contains('d-none')) { arrowInit = false; arrowOn = false; return; }
      if (loopPaused()) { arrowOn = false; return; }
      requestAnimationFrame(stepGuideArrow);
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
    };
    startGuideArrow();
  }
}
