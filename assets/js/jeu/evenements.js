// Evenements : souris et doigt, lancement du jeu, en-tete du site, plein ecran, redimensionnement.
import { clamp } from './utils.js';
import {
  CAPTION_NEED_STRAIN, CAPTION_NEED_MONEY,
  CAPTION_MYC_CLOSER, CAPTION_MYC_NO_WOOD, HEADER_HOVER_LEAVE, DEPTH_MULT, SKY_EXTRA
} from './config.js';
import {
  container, vue, partie, updateZoom, canvas, monde, rebuildBtn, debugToggleBtn, debugPanel, fullscreenBtn,
  toolBtns, speedInput, temps, speedVal, speedBtn, rainInput, droughtInput, stormInput, scrollLeftBtn,
  scrollRightBtn, scrollUpBtn, scrollDownBtn
} from './etat.js';
import { resetTiles } from './rendu.js';
import { build, sizeCanvas, whenImgReady } from './terrain.js';
import { resetAllAndRebuild } from './sauvegarde.js';
import { stopShower, weather, updateDroughtIndicator, updateStormIndicator } from './meteo.js';
import { underMatureTree, matureTrees, noWoodNear, plantTree } from './arbres.js';
import { insectAt, dropHeldInsect, catchInsect, dropFertilizer, seedGrass } from './flore.js';
import { ensureBag } from './economie.js';
import {
  shovel, shovelHit, setTool, leaveHand, grabShovel, hand, enterHand, harvestableNear, harvestAt,
  handGrabTree, pickUpHand, bag, enterBag, releaseShovel, leaveBag, leaveShovel
} from './outils.js';
import { grabTreasureAt, moveTreasure, treasureNear, pickTreasureStrain, syncDemoEndTop } from './tresors.js';
import { treasureGlintAt, showDigTip, openTip, tipAway, hideDigTip, tapTip } from './cartes.js';
import { setCaption } from './messages.js';
import { guideSet, guideFlags } from './tutoriel.js';
import { explode, startLoop, resetToLogo } from './physique.js';

// --- Evenements --------------------------------------------------------------------
export function getRelativePos(evt) {
  // container plutot que canvas : le canvas est en d-none (rect a 0) avant le clic.
  // Coordonnees ECRAN (relatives a la boite), pas encore converties en coord. monde.
  // Divisees par ZOOM : px CSS -> px logiques (meme repere que W/H).
  var rect = container.getBoundingClientRect();
  var p = evt.touches ? evt.touches[0] : evt;
  return { x: (p.clientX - rect.left) / vue.ZOOM, y: (p.clientY - rect.top) / vue.ZOOM };
}

// Coordonnees monde (ajoute le decalage camera courant) : a utiliser pour toute la
// physique/logique (pelle, tresors, tas) une fois le monde explose.
function getWorldPos(evt) {
  var p = getRelativePos(evt);
  return { x: p.x + vue.camX, y: p.y + vue.camY };
}

function endPress(evt, allowTap) {
  dropHeldInsect(); // meme si pointerDown a deja ete remis a zero
  if (!vue.pointerDown) return;
  if (evt.pointerType !== 'mouse') { vue.hoverScreenX = null; vue.hoverScreenY = null; }
  if (partie.tool === 'hand' && shovel.on) {
    releaseShovel();
    vue.pressCaught = false;
    vue.pointerDown = null;
    startLoop();
    return;
  }
  if (partie.tool === 'hand') {
    if (vue.treasureGrab) {
      if (allowTap && !vue.dragMoved) {
        openTip(vue.treasureGrab.t, true); pickTreasureStrain(vue.treasureGrab.t);
        if (vue.treasureGrab.fromTip) tapTip(vue.treasureGrab.t, vue.treasureGrab.onImg);
      }
      vue.treasureGrab = null;
    }
    var hadGrip = !!hand.grip;
    hand.grip = null; // relachee avant de casser : la branche revient droite, rien d'autre
    if (vue.handCarry.length) {
      // On relache la prise : la gravite fait le reste (chute et pose normales, meme
      // chemin que pour n'importe quelle facette delogee par la pelle, voir step()).
      for (var hi = 0; hi < vue.handCarry.length; hi++) vue.handCarry[hi].carried = false;
      vue.handCarry = [];
    } else if (allowTap && !vue.dragMoved && !hadGrip && !vue.pressCaught) {
      // Un tap sur le monde ferme aussi l'infobulle ouverte (tresor ou bulle mycelium).
      var handWp = getWorldPos(evt), handT = treasureNear(handWp.x, handWp.y);
      if (!(handT && handT.revealed)) openTip(null);
      harvestAt(handWp);
    }
    vue.pressCaught = false;
    vue.pointerDown = null;
    if (evt.pointerType !== 'mouse') leaveHand(); // au doigt la main n'existe que pendant l'appui
    startLoop();
    return;
  }
  if (partie.tool === 'mycelium') {
    bag.pouring = false;
    // Au sac, un tap ne creuse pas : il rouvre seulement l'infobulle d'un tresor deja sorti.
    if (allowTap && !vue.dragMoved) {
      var wp = getWorldPos(evt), t = treasureNear(wp.x, wp.y);
      if (t && t.revealed) { openTip(t, true); pickTreasureStrain(t); } else openTip(null);
    }
    if (evt.pointerType !== 'mouse') leaveBag();
    vue.pointerDown = null;
    startLoop();
    return;
  }
  if (partie.tool === 'fertilizer') {
    vue.pointerDown = null;
    startLoop();
    return;
  }
  if (partie.tool === 'tree') {
    if (allowTap && !vue.dragMoved) {
      openTip(null); // un tap plante un arbre mais ferme d'abord toute infobulle ouverte
      plantTree(getWorldPos(evt).x);
    }
    vue.pointerDown = null;
    startLoop();
    return;
  }
  vue.pointerDown = null;
  startLoop();
}
// Reutilise le mecanisme de header compact expose par nav-compact.js (voir
// window.sporaHeaderCompact) plutot que d'en refaire un. Verifie sa presence pour ne
// rien casser si ce script change ou ne s'est pas encore charge.
export var siteHeader = document.querySelector('.header');
// Le clic sur le logo compacte le header d'office (voir explode) ; ensuite toute
// interaction dans le jeu le replie s'il s'est redeplie au defilement.
var headerCompactedByGame; // sans valeur initiale : explode peut passer avant cette ligne
export function compactHeaderForGame() {
  headerCompactedByGame = true;
  if (window.sporaHeaderCompact && typeof window.sporaHeaderCompact.set === 'function') window.sporaHeaderCompact.set(true);
}
// Jeu remis a zero : on redeplie le header que le jeu avait compacte. Pas sur mobile :
// deplie, il mange trop de l'ecran ; il se redepliera tout seul au defilement.
export function releaseHeader() {
  var narrow = window.matchMedia && window.matchMedia('(max-width: 767.98px)').matches;
  if (!narrow && headerCompactedByGame && window.sporaHeaderCompact && typeof window.sporaHeaderCompact.set === 'function') window.sporaHeaderCompact.set(false);
  headerCompactedByGame = false;
  clearTimeout(headerLeaveTimer);
  headerHover = false;
}
var headerHover = false, headerLeaveTimer = 0;
function setHeaderHover(over) {
  if (over === headerHover) return;
  headerHover = over;
  clearTimeout(headerLeaveTimer);
  if (!over) headerLeaveTimer = setTimeout(function () { if (partie.mode === 'exploded') compactHeaderForGame(); }, HEADER_HOVER_LEAVE);
  else if (window.sporaHeaderCompact && typeof window.sporaHeaderCompact.set === 'function') window.sporaHeaderCompact.set(false);
}
export function hideDebugPanel() {
  if (debugToggleBtn) {
    debugToggleBtn.classList.add('d-none');
    debugToggleBtn.classList.remove('is-active');
    debugToggleBtn.setAttribute('aria-pressed', 'false');
  }
  if (debugPanel) debugPanel.classList.add('d-none');
}
// Plein ecran "sur place" (voir .is-fullscreen dans style.css) : agrandit juste la
// boite a 100vh, ne touche pas au reste de la page (pas de Fullscreen API, pas de
// position fixed) - le site reste scrollable normalement en dessous.
// Notre CSS ne change QUE la hauteur (jamais la largeur) : pas besoin de tout
// reconstruire. Le monde a deja de la profondeur generee sous la vue de depart
// (DEPTH_MULT, voir setupSoil) qui n'etait simplement pas montree ; on agrandit
// juste la fenetre de camera (H + toile de fond du canvas) pour en reveler plus,
// sans toucher au sol/trous/arbres deja en place ni reinitialiser la partie.
function resizeGameHeight() {
  if (partie.mode === 'assembled') return; // pas encore explose : build() lira la taille a jour au clic
  var rect = container.getBoundingClientRect();
  if (Math.round(rect.width) !== Math.round(vue.UW)) {
    // La largeur a aussi change (jamais le cas pour le bouton plein ecran lui-meme,
    // mais garde-fou si une barre de defilement s'en mele) : seul cas ou on doit
    // vraiment tout reconstruire, comme le fait deja le listener de resize plus bas.
    if (vue.rafId !== null) { cancelAnimationFrame(vue.rafId); vue.rafId = null; }
    resetToLogo();
    return;
  }
  var newH = rect.height;
  if (Math.round(newH) === Math.round(vue.U)) return;
  vue.H = newH / vue.ZOOM; vue.U = vue.H * vue.ZOOM;
  resetTiles();
  sizeCanvas();
  // groundY et le sol existant restent en coordonnees monde absolues, inchanges :
  // seule la fenetre visible (camY..camY+H) grandit ou retrecit.
  vue.worldH = Math.max(vue.worldH, vue.H + vue.U * DEPTH_MULT);
  // Au sommet (camY <= 0) on colle la vue sur le sol en bas d'ecran, comme au depart :
  // la place gagnee sert a montrer plus de ciel, pas plus de sous-sol.
  var atTop = vue.camY <= 0;
  vue.camY = clamp(atTop ? camHomeY() : vue.camY, camMinY(), vue.worldH - vue.H);
}
// Vue de depart : le sol au bas de l'ecran. 0 tant que la fenetre n'est pas plus haute que
// le monde de depart ; negatif en plein ecran ou en zoom arriere (H depasse groundY).
export function camHomeY() { return Math.min(0, vue.groundY - (vue.H - 6)); }
// Zoome : la vue de depart montre deja beaucoup de ciel au-dessus des arbres, pas de ciel en plus.
export function camMinY() { return vue.ZOOM === 1 ? Math.min(0, vue.groundY - (vue.H - 6)) - vue.H * SKY_EXTRA : camHomeY(); }
// Multiplicateurs de production de nutriments du gazon (voir updateGrass) : 1 = normal, 0 = aucun.
var grassNutriInput = document.getElementById('logo-explosion-grass-nutri');
var grassMycNutriInput = document.getElementById('logo-explosion-grassmyc-nutri');

// Fleches tactiles (mobile) : maintenues, elles font defiler le monde a vitesse fixe.
function bindScrollArrow(btn, dir, vertical) {
  if (!btn) return;
  var start = function (evt) { evt.preventDefault(); if (vertical) vue.mobileArrowY = dir; else vue.mobileArrow = dir; startLoop(); };
  var stop = function () { if (vertical) vue.mobileArrowY = 0; else vue.mobileArrow = 0; };
  btn.addEventListener('pointerdown', start);
  btn.addEventListener('pointerup', stop);
  btn.addEventListener('pointercancel', stop);
  btn.addEventListener('pointerleave', stop);
}

// Toutes les positions sont en px de la taille au moment du clic : si la LARGEUR
// change (rotation, fenetre), on revient simplement au logo net. La hauteur seule
// est ignoree, elle bouge a chaque apparition de la barre d'adresse sur mobile.
var lastWidth;
var resizeTimeout = null;

// Lancement du jeu, demande par amorce.js (clic a la souris ou appui maintenu au doigt sur le
// logo) : clientX/clientY = point de l'ecran d'ou part l'explosion.
export function peutLancer() { return partie.mode === 'assembled'; }
export function lancer(clientX, clientY) {
  if (partie.mode !== 'assembled') return;
  // Image du logo pas encore chargee (le jeu vient d'arriver) : le lancement l'attend.
  if (!partie.imgReady) { whenImgReady(function () { lancer(clientX, clientY); }); return; }
  updateZoom(); // le zoom du monde qui va etre construit, avant de convertir le clic
  var pos = getRelativePos({ clientX: clientX, clientY: clientY });
  // camX vient d'etre (re)centre par build() : + camX donne la position monde de
  // l'origine de l'explosion, coherente avec les coord. monde des facettes.
  if (build()) explode(pos.x + vue.camX, pos.y + vue.camY);
}

// Demarrage du module : appele une seule fois par principal.js, dans un ordre fixe.
export function initEvenements() {
  canvas.addEventListener('pointerdown', function (evt) {
    if (partie.mode !== 'exploded') return;
    vue.edgeTouch = evt.pointerType !== 'mouse';
    var screenPos = getRelativePos(evt);
    var pos = { x: screenPos.x + vue.camX, y: screenPos.y + vue.camY };
    if (evt.pointerType === 'mouse') { vue.hoverScreenX = screenPos.x; vue.hoverScreenY = screenPos.y; }
    try { canvas.setPointerCapture(evt.pointerId); } catch (e) { /* pas grave */ }
    vue.pointerDown = pos;
    vue.dragMoved = false;
    // Clic sur un tresor pas encore deterre : rappelle comment creuser.
    var hintT = treasureGlintAt(evt);
    if (hintT) showDigTip(hintT);
    // Un clic sur la pelle plantee la prend quel que soit l'outil : la main se selectionne toute seule.
    if (partie.tool !== 'hand' && !shovel.on && shovelHit(pos.x, pos.y, evt.pointerType !== 'mouse')) setTool('hand');
    if (partie.tool === 'hand') {
      // La pelle plantee est prioritaire, mais seulement si le clic tombe sur elle (voir aussi plus haut : ce clic selectionne la main).
      if (!shovel.on && shovelHit(pos.x, pos.y, evt.pointerType !== 'mouse')) {
        leaveHand();
        vue.pressCaught = true;
        openTip(null);
        grabShovel(pos, evt.pointerType !== 'mouse');
        canvas.style.cursor = '';
        startLoop();
        return;
      }
      if (!hand.on) enterHand(pos);
      hand.touch = evt.pointerType !== 'mouse';
      hand.x = pos.x; hand.y = pos.y;
      // Un champignon a recolter sous le curseur est prioritaire sur tout : on ne saisit rien
      // derriere lui, le tap au relachement le recolte (harvestAt). Sinon feuille, branche, terre.
      // Un papillon sous le curseur est prioritaire : on l'attrape, rien d'autre (ni au tap).
      var bfly = insectAt(pos.x, pos.y);
      vue.pressCaught = !!bfly;
      if (bfly) {
        dropHeldInsect(); // un seul a la fois (appui multi-pointeurs)
        vue.heldSX = screenPos.x; vue.heldSY = screenPos.y;
        catchInsect(bfly);
      } else if (harvestableNear(pos.x, pos.y)) {
        // Cueillette des l'appui (pas seulement au relachement) : maintenir le clic fait aussi sortir le champignon.
        // Avant le tresor : un champignon a cueillir devant/pres d'un tresor deterre ne doit pas etre masque par lui.
        harvestAt(pos);
        vue.pressCaught = true;
      } else if ((vue.treasureGrab = grabTreasureAt(pos))) {
        vue.pressCaught = true; // un tresor deterre se deplace a la main : le champignon et la bulle suivent
      } else if (!handGrabTree(pos)) pickUpHand(pos);
      if (vue.pressCaught) hand.flash = performance.now();
      startLoop(); // le poing se ferme, meme sans rien dans la main
      return;
    }
    if (partie.tool === 'mycelium') {
      if (!partie.unlockedStrains.length) { setCaption(CAPTION_NEED_STRAIN); return; }
      if (!ensureBag()) { setCaption(CAPTION_NEED_MONEY); return; }
      guideSet('strain');
      if (!partie.mycFedOnce) {
        if (underMatureTree(pos.x)) guideSet('poured');
        else if (matureTrees().length && !guideFlags.poured) setCaption(CAPTION_MYC_CLOSER);
        else if (noWoodNear(pos.x)) setCaption(CAPTION_MYC_NO_WOOD);
      }
      if (!bag.on) enterBag(pos);
      bag.x = pos.x; bag.y = pos.y;
      bag.pouring = true;
      startLoop();
      return;
    }
    if (partie.tool === 'tree') return; // se plante au relachement (tap), pas d'outil traine au curseur
    if (partie.tool === 'fertilizer') { openTip(null); dropFertilizer(pos.x); return; }
    if (partie.tool === 'grass') { openTip(null); seedGrass(pos.x); return; }
  });
  canvas.addEventListener('pointermove', function (evt) {
    if (partie.mode !== 'exploded') return;
    vue.edgeTouch = evt.pointerType !== 'mouse';
    var screenPos = getRelativePos(evt);
    var pos = { x: screenPos.x + vue.camX, y: screenPos.y + vue.camY };
    if (evt.pointerType === 'mouse') { vue.hoverScreenX = screenPos.x; vue.hoverScreenY = screenPos.y; }
    if (partie.tool === 'mycelium') {
      if (!bag.on) enterBag(pos);
      bag.x = pos.x; bag.y = pos.y;
    } else if (partie.tool === 'hand') {
      if (shovel.on) {
        if (!shovel.released) { shovel.gx = pos.x; shovel.gy = pos.y; }
      } else if (!hand.on && (evt.pointerType === 'mouse' || vue.pointerDown)) { enterHand(pos); hand.touch = evt.pointerType !== 'mouse'; }
      hand.x = pos.x; hand.y = pos.y;
    } else if (partie.tool === 'fertilizer' && vue.pointerDown) {
      dropFertilizer(pos.x);
    } else if (partie.tool === 'grass' && vue.pointerDown) {
      seedGrass(pos.x);
    }
    if (vue.treasureGrab && vue.pointerDown && vue.dragMoved) { moveTreasure(vue.treasureGrab.t, pos.x + vue.treasureGrab.dx); }
    if (monde.heldInsect && vue.pointerDown) { vue.heldSX = screenPos.x; vue.heldSY = screenPos.y; }
    if (evt.pointerType === 'mouse') {
      canvas.style.cursor = (!shovel.on && shovelHit(pos.x, pos.y, false)) ? 'grab'
        : (partie.tool === 'hand' && insectAt(pos.x, pos.y)) ? 'pointer' : '';
    }
    if (evt.pointerType === 'mouse' && !vue.pointerDown) {
      // Survoler un tresor deja deterre rouvre son infobulle sans avoir a cliquer.
      var hoverT = treasureNear(pos.x, pos.y);
      // Pas de survol tant qu'un saviez-vous est affiche : il ne reviendrait pas (le clic ouvre quand meme).
      var onT = !!(hoverT && hoverT.revealed);
      if (onT && !hoverT.tipClosed && partie.factShown < 0) openTip(hoverT);
      tipAway(!onT);
      // Survoler le scintillement d'un tresor enfoui ouvre la bulle "creusez..." (sans minuterie).
      var glintT = treasureGlintAt(evt);
      if (glintT) showDigTip(glintT, true); else if (partie.digTipHover) hideDigTip();
    }
    if (vue.pointerDown && Math.hypot(pos.x - vue.pointerDown.x, pos.y - vue.pointerDown.y) > 6) vue.dragMoved = true;
    // Doigt appuye qui a glisse : sa position sert au defilement pres des bords, comme le survol souris.
    if (vue.edgeTouch && vue.pointerDown && vue.dragMoved) { vue.hoverScreenX = screenPos.x; vue.hoverScreenY = screenPos.y; }
    startLoop();
  });
  canvas.addEventListener('pointerup', function (evt) { endPress(evt, true); });
  canvas.addEventListener('pointercancel', function (evt) { endPress(evt, false); });
  window.addEventListener('blur', dropHeldInsect);
  canvas.addEventListener('pointerleave', function (evt) {
    if (evt.pointerType === 'mouse') tipAway(true); // vers la carte : son pointerenter annule
    if (evt.pointerType === 'mouse' && !vue.pointerDown) {
      leaveShovel();
      leaveBag();
      leaveHand();
      vue.hoverScreenX = null; vue.hoverScreenY = null;
    }
  });
  if (rebuildBtn) rebuildBtn.addEventListener('click', resetAllAndRebuild); // la fleche remet tout a zero (sauvegarde incluse), avec l'animation
  // Le header change de hauteur en mode compact (padding en transition 0.2s) : l'ecran de
  // fin de demo le suit image par image pendant la transition.
  if (siteHeader) {
    // Bas du header replie, mesure depuis le haut de la boite du jeu (page en haut), pour
    // caler les controles du haut sur mobile (--game-ui-top, lu seulement dans la media
    // query mobile de style.css). La boite ne commence pas tout en haut de la page (padding
    // du hero) : on retire ce decalage, sinon les controles restent trop bas. Bornee a
    // 150px : menu mobile ouvert, le header est tres haut et les pousserait hors de la boite.
    var syncUiTop = function () {
      var boxTop = container.getBoundingClientRect().top + window.scrollY;
      var hb = siteHeader.getBoundingClientRect().height - boxTop;
      container.style.setProperty('--game-ui-top', Math.round(Math.max(0, Math.min(hb, 150))) + 'px');
      // Fleche "monter" (40px de haut) centree dans la bande du header replie, sur mobile.
      container.style.setProperty('--game-arrow-top', Math.round(Math.max(0, hb - (hb + boxTop) / 2 - 20)) + 'px');
    };
    syncUiTop();
    window.addEventListener('resize', syncUiTop);
    window.addEventListener('load', syncUiTop); // le logo du header charge : sa hauteur change
    var syncUntil = 0;
    var syncTick = function () {
      syncDemoEndTop();
      syncUiTop();
      if (performance.now() < syncUntil) requestAnimationFrame(syncTick);
    };
    new MutationObserver(function () {
      syncUntil = performance.now() + 450;
      requestAnimationFrame(syncTick);
    }).observe(siteHeader, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', syncDemoEndTop);
    window.addEventListener('scroll', syncDemoEndTop, { passive: true });
  }
  container.addEventListener('pointerdown', function () {
    if (partie.mode === 'exploded') compactHeaderForGame();
  });
  if (siteHeader) {
    document.addEventListener('pointermove', function (evt) {
      // evt.buttons : pas de depliage pendant qu'on joue (outil appuye) pres du haut.
      if (evt.pointerType !== 'mouse' || evt.buttons || partie.mode !== 'exploded') return;
      var r = siteHeader.getBoundingClientRect();
      // contains : le mini-panier ouvert deborde du rectangle du header.
      setHeaderHover(siteHeader.contains(evt.target) || (evt.clientX >= r.left && evt.clientX <= r.right && evt.clientY >= r.top && evt.clientY <= r.bottom));
    });
    document.documentElement.addEventListener('mouseleave', function () {
      if (partie.mode === 'exploded') setHeaderHover(false);
    });
  }
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', function () {
      var next = !container.classList.contains('is-fullscreen');
      if (window.sporaSfx) sporaSfx.play('whoosh');
      container.classList.toggle('is-fullscreen', next);
      fullscreenBtn.classList.toggle('is-active', next);
      fullscreenBtn.setAttribute('aria-pressed', next ? 'true' : 'false');
      fullscreenBtn.setAttribute('aria-label', next ? 'Quitter le plein ecran' : 'Agrandir en plein ecran');
      fullscreenBtn.setAttribute('title', next ? 'Quitter le plein ecran' : 'Agrandir en plein ecran');
      resizeGameHeight();
      // Evite un reset en double si la barre de defilement (dis)parait et change
      // aussi la largeur : le listener de resize plus bas compare a cette valeur.
      lastWidth = container.getBoundingClientRect().width;
    });
  }
  // La fleche d'invite reste tant que le mycelium n'a pas ete nourri de bois (voir mycFedOnce).
  for (var ti = 0; ti < toolBtns.length; ti++) {
    toolBtns[ti].addEventListener('click', function () { setTool(this.getAttribute('data-tool')); });
  }
  // Slider de debug : accelere le cycle bois/mycelium/arbres (voir vTime) pour experimenter
  // sans attendre les minutes reelles de decomposition/croissance.
  if (speedInput) {
    speedInput.addEventListener('input', function () {
      temps.timeScale = parseFloat(this.value) || 1;
      if (speedVal) speedVal.textContent = temps.timeScale + '×';
      startLoop();
    });
  }
  // Bouton de vitesse pour les visiteurs : boucle normal -> x3 -> x10 (meme timeScale que
  // le curseur du panneau d'options, qu'on garde synchronise).
  if (speedBtn) {
    var SPEED_LEVELS = [1, 3, 10];
    speedBtn.addEventListener('click', function () {
      var i = SPEED_LEVELS.indexOf(temps.timeScale);
      temps.timeScale = SPEED_LEVELS[(i + 1) % SPEED_LEVELS.length];
      speedBtn.querySelector('.logo-explosion-speed-btn-val').textContent = '×' + temps.timeScale;
      speedBtn.classList.toggle('is-fast', temps.timeScale > 1);
      speedBtn.setAttribute('aria-label', 'Vitesse de simulation : ' + (temps.timeScale === 1 ? 'normale' : 'x' + temps.timeScale));
      speedBtn.querySelector('.spd-2').style.display = temps.timeScale > 1 ? '' : 'none';
      speedBtn.querySelector('.spd-3').style.display = temps.timeScale === 10 ? '' : 'none';
      if (speedInput) speedInput.value = temps.timeScale;
      if (speedVal) speedVal.textContent = temps.timeScale + '×';
      startLoop();
    });
  }
  if (grassNutriInput) {
    grassNutriInput.addEventListener('input', function () {
      var v = parseFloat(this.value);
      temps.grassNutriMult = v >= 0 ? v : 0;
    });
  }
  if (grassMycNutriInput) {
    grassMycNutriInput.addEventListener('input', function () {
      var v = parseFloat(this.value);
      temps.grassMycNutriMult = v >= 0 ? v : 0;
    });
    var v = parseFloat(grassMycNutriInput.value);
    temps.grassMycNutriMult = v >= 0 ? v : 0;
  }
  // Frequence de la pluie naturelle (voir le cycle meteo pres de updateWeather) : 0 = ne
  // pleut jamais, 100 = averses longues et frequentes.
  if (rainInput) {
    rainInput.addEventListener('input', function () {
      temps.rainLevel = (parseFloat(this.value) || 0) / 100;
      if (temps.rainLevel <= 0) stopShower();
    });
  }
  // Frequence de la secheresse naturelle (voir DROUGHT_* et updateWeather) : 0 = ne seche
  // jamais, 100 = secheresses longues et frequentes. Independant du curseur Pluie ; les deux
  // restent mutuellement exclusifs cote simulation (voir startShower).
  if (droughtInput) {
    droughtInput.addEventListener('input', function () {
      temps.droughtLevel = (parseFloat(this.value) || 0) / 100;
      if (temps.droughtLevel <= 0) weather.drought = false;
      updateDroughtIndicator();
    });
  }
  // Frequence des tempetes (voir STORM_* et updateWeather) : averses normales qui
  // s'intensifient ponctuellement (lessivage x STORM_LEACH_MULT). N'existe que PENDANT une
  // averse deja en cours ; 0 = jamais de tempete, juste de la pluie normale.
  if (stormInput) {
    stormInput.addEventListener('input', function () {
      temps.stormLevel = (parseFloat(this.value) || 0) / 100;
      if (temps.stormLevel <= 0) weather.storm = false;
      updateStormIndicator();
    });
  }
  bindScrollArrow(scrollLeftBtn, -1);
  bindScrollArrow(scrollRightBtn, 1);
  bindScrollArrow(scrollUpBtn, -1, true);
  bindScrollArrow(scrollDownBtn, 1, true);
  lastWidth = container.getBoundingClientRect().width;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(function () {
      var w = container.getBoundingClientRect().width;
      if (w === lastWidth) return;
      lastWidth = w;
      if (vue.rafId !== null) { cancelAnimationFrame(vue.rafId); vue.rafId = null; }
      resetToLogo();
    }, 200);
  });
}
