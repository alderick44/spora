// Jeu du logo (accueil) : point d'entree, charge par amorce.js. Lance le demarrage de chaque module.
import { clamp, easeInOut, lerp } from './utils.js';
import {
  HOLD_FOLLOW_EASE, CAMERA_EDGE_TOUCH, CAMERA_EDGE, CAMERA_MAX, CAMERA_TOP_DEADZONE, CAMERA_MAX_Y, EATEN_MS,
  WIND_STRENGTH, GRAVITY, AIR, BRANCH_LITTER_MS, LITTER_MS, COL_W, SOIL_RISE_FRAMES, FRUIT_W, MYC_READY,
  MUSHROOM_STARVE_MS, CAPTION_BEFORE, HOLD_LIFT, HOLD_MS, HOLD_HINT_MS, CAPTION_NEED_STRAIN,
  CAPTION_NEED_MONEY, CAPTION_MYC_CLOSER, CAPTION_MYC_NO_WOOD, HEADER_HOVER_LEAVE, DEPTH_MULT, SKY_EXTRA,
  DEBUG_FIELDS, getDebugVar, setDebugVar
} from './config.js';
import {
  monde, fallbackImg, canvas, partie, rebuildBtn, fullscreenBtn, speedBtn, debugToggleBtn, toolsBar,
  treasureCountEl, scrollLeftBtn, scrollRightBtn, scrollUpBtn, scrollDownBtn, vue, toolsArrow, temps,
  moneyEl, container, updateZoom, debugPanel, speedWrap, toolBtns, speedInput, speedVal, rainInput,
  droughtInput, stormInput, initEtat
} from './etat.js';
import { draw, resetTiles } from './rendu.js';
import { surfaceAt, pileRemove, restColumn, pileAdd, build, sizeCanvas, initTerrain } from './terrain.js';
import { makeSavedTrees, terrainSig, resetAllAndRebuild, initSauvegarde } from './sauvegarde.js';
import {
  weather, updateWeather, updateRainDrops, updateDroughtIndicator, stopShower, updateStormIndicator
} from './meteo.js';
import {
  makeTree, makeStartTree, stepTrees, underMatureTree, matureTrees, noWoodNear, plantTree, initArbres
} from './arbres.js';
import {
  updateGrass, stepFlowers, stepInsects, insectAt, dropHeldInsect, catchInsect, dropFertilizer, seedGrass
} from './flore.js';
import { inoculate, stepMycelium } from './mycelium.js';
import { updateMoneyUI, ensureBag } from './economie.js';
import {
  shovel, bag, hand, updateBag, updateHand, updateShovel, bowlWakePile, cutCompact, bladeField, collideBowl,
  leaveHand, leaveBag, leaveShovel, shovelHit, setTool, grabShovel, enterHand, harvestableNear, harvestAt,
  handGrabTree, pickUpHand, enterBag, releaseShovel, initOutils
} from './outils.js';
import {
  updateStrainBar, setupTreasures, stepGoldBits, reveal, clearTreasures, clearMycTip, hideDemoEnd,
  grabTreasureAt, moveTreasure, treasureNear, pickTreasureStrain, syncDemoEndTop, initTresors, initTresorsUI
} from './tresors.js';
import { treasureGlintAt, showDigTip, openTip, tipAway, hideDigTip, tapTip } from './cartes.js';
import { flushDeathAlert, msgTick, resetPatches, hideMsgs, setCaption, initMessages } from './messages.js';
import { initDefis } from './defis.js';
import { guideSet, guideFlags, initTutoriel } from './tutoriel.js';

var chBadgeEl = document.getElementById('logo-explosion-challenges');

// Effet magnetique du badge "play" : des qu'on bouge la souris sur la page, le badge
// se decale vers le curseur (jusqu'a MAGNET_MAX). Purement decoratif : pilote --mx/--my
// lus par le transform CSS du badge. Le hover/curseur reel est gere par la zone fixe
// autour de lui (.logo-explosion-play-zone dans style.css), pas par le badge lui-meme
// qui bouge — sinon le :hover papillote pendant qu'il se deplace.
var playBadge = document.querySelector('.logo-explosion-play-badge');
var lastRealNow = null;
var slowTimer = null;
var rebuildT = 0;
var paused = false, wasRunningBeforeHide = false; // en pause : hors viewport ou onglet cache

// --- Physique ----------------------------------------------------------------------
function explode(px, py) {
  monde.grassTipFrom = performance.now() + 8000;
  if (window.sporaSfx) sporaSfx.play('thud'); 
  fallbackImg.classList.add('d-none');
  canvas.classList.remove('d-none');
  partie.mode = 'exploded';
  partie.explodedAt = performance.now();
  for (var i = 0; i < monde.shards.length; i++) {
    var s = monde.shards[i];
    if (s.soil) continue; // le lit de terre ne bouge pas, il recoit
    var dx = s.ox - px, dy = s.oy - py, d = Math.hypot(dx, dy) || 1;
    var sp = 2 + Math.random() * 5 + 40 / (d + 20);
    // Composante horizontale reduite : sinon tout s'empile contre les bords.
    s.vx = dx / d * sp * 0.45 + (Math.random() - 0.5) * 1.5;
    s.vy = dy / d * sp - 4 - Math.random() * 5;
    s.vr = (Math.random() - 0.5) * 0.35;
  }
  if (rebuildBtn) rebuildBtn.classList.remove('d-none');
  compactHeaderForGame();
  if (fullscreenBtn) fullscreenBtn.classList.remove('d-none');
  if (speedBtn) speedBtn.classList.remove('d-none');
  if (debugToggleBtn) debugToggleBtn.classList.remove('d-none');
  if (toolsBar) toolsBar.classList.remove('d-none');
  if (chBadgeEl) chBadgeEl.classList.remove('d-none');
  updateMoneyUI();
  updateStrainBar();
  // Le compteur ne vit que dans le panneau : montre seulement une fois range dedans (buildDebugPanel).
  if (treasureCountEl && partie.treasureDefs.length && partie.debugBuilt) treasureCountEl.classList.remove('d-none');
  if (scrollLeftBtn) scrollLeftBtn.classList.remove('d-none');
  if (scrollRightBtn) scrollRightBtn.classList.remove('d-none');
  if (scrollUpBtn) scrollUpBtn.classList.remove('d-none');
  if (scrollDownBtn) scrollDownBtn.classList.remove('d-none');
  setupTreasures();
  // Un arbre visible a gauche du logo, un autre plus loin a droite dans le monde.
  var savedTrees = null;
  try { if (partie.restoredTrees) savedTrees = makeSavedTrees(partie.restoredTrees); } catch (e) { savedTrees = null; }
  partie.restoredTrees = null;
  monde.trees = savedTrees && savedTrees.length ? savedTrees : [makeTree(vue.camMargin + vue.W * 0.14), makeStartTree(vue.camMargin + vue.W * 0.93, 10), makeTree(vue.camMargin + vue.W * 1.35)];
  if (savedTrees && savedTrees.length) partie.worldSig = partie.worldSigPrev = terrainSig();
  monde.litter = [];
  if (toolsArrow && partie.unlockedStrains.length) toolsArrow.classList.remove('d-none');
  startLoop();
}

// Vitesse de defilement selon la position ecran du curseur : nulle au centre, augmente
// en approchant des CAMERA_EDGE derniers % de chaque bord de la boite.
function cameraSpeed(screenX) {
  var edge = vue.W * (vue.edgeTouch ? CAMERA_EDGE_TOUCH : CAMERA_EDGE);
  if (screenX < edge) {
    var k = 1 - screenX / edge;
    return -CAMERA_MAX * k * k;
  }
  if (screenX > vue.W - edge) {
    var k2 = 1 - (vue.W - screenX) / edge;
    return CAMERA_MAX * k2 * k2;
  }
  return 0;
}

// Meme logique, axe vertical : pres du haut de la boite ca remonte (camY vers 0), pres
// du bas ca descend (camY vers worldH - H, plus profond).
function cameraSpeedY(screenY) {
  var edge = vue.H * (vue.edgeTouch ? CAMERA_EDGE_TOUCH : CAMERA_EDGE);
  var y = Math.max(0, screenY - CAMERA_TOP_DEADZONE / vue.ZOOM); // la zone cachee par le header est en px CSS
  if (y < edge) {
    var k = 1 - y / edge;
    return -CAMERA_MAX_Y * k * k;
  }
  // Le bas de la boite peut depasser l'ecran (100vh sur mobile, barre du navigateur) : la
  // zone part du bas VISIBLE, sinon le doigt ne l'atteint presque pas.
  var bottom = vue.edgeTouch ? Math.min(vue.H, (window.innerHeight - canvas.getBoundingClientRect().top) / vue.ZOOM) : vue.H;
  if (screenY > bottom - edge) {
    var k2 = Math.min(1, 1 - (bottom - screenY) / edge);
    return CAMERA_MAX_Y * k2 * k2;
  }
  return 0;
}

function step() {
  var camMoving = false;
  if (partie.mode === 'exploded') {
    // La souris ne bouge pas forcement pendant qu'on defile : on garde sa derniere
    // position ecran connue et on la reconvertit en coord. monde a chaque frame, pour
    // que la pelle reste sous le curseur meme quand le monde glisse dessous.
    if (vue.hoverScreenX !== null) {
      if (!shovel.released) { // pelle lachee : elle verse sur place, elle ne suit plus
        shovel.gx = vue.hoverScreenX + vue.camX;
        shovel.gy = vue.hoverScreenY + vue.camY;
      }
      bag.x = hand.x = vue.hoverScreenX + vue.camX;
      bag.y = hand.y = vue.hoverScreenY + vue.camY;
    }
    // Demo : le monde tient dans l'ecran, aucun defilement horizontal (bords, fleches, glissement).
    var camV = partie.DEMO ? 0 : vue.mobileArrow ? vue.mobileArrow * CAMERA_MAX : (vue.hoverScreenX !== null ? cameraSpeed(vue.hoverScreenX) : 0);
    if (camV) {
      var newCamX = clamp(vue.camX + camV, 0, vue.worldW - vue.W);
      if (newCamX !== vue.camX) camMoving = true;
      vue.camX = newCamX;
    }
    if (vue.camGoal) { // glissement vers une alerte ; tout defilement manuel l'annule
      if (partie.DEMO) vue.camGoal.x = vue.camX;
      if (camV || vue.mobileArrowY) vue.camGoal = null;
      else {
        var gdx = vue.camGoal.x - vue.camX, gdy = vue.camGoal.y - vue.camY;
        if (Math.abs(gdx) < 1 && Math.abs(gdy) < 1) { vue.camX = vue.camGoal.x; vue.camY = vue.camGoal.y; vue.camGoal = null; }
        else { vue.camX += gdx * 0.12; vue.camY += gdy * 0.12; }
        camMoving = true;
      }
    }
    flushDeathAlert();
    var camVY = vue.mobileArrowY ? vue.mobileArrowY * CAMERA_MAX_Y : (vue.hoverScreenY !== null ? cameraSpeedY(vue.hoverScreenY) : 0);
    if (camVY) {
      var newCamY = clamp(vue.camY + camVY, camMinY(), vue.worldH - vue.H);
      if (newCamY !== vue.camY) camMoving = true;
      vue.camY = newCamY;
    }
  }
  // Tant que la pelle est a l'ecran ou que le monde defile, la boucle tourne.
  temps.frame++;
  var realNow = performance.now();
  if (lastRealNow === null) lastRealNow = realNow;
  // Plafonne le delta reel avant de l'accelerer : sinon un long moment sans frame (onglet
  // en arriere-plan, boucle a l'arret le temps qu'on interagisse de nouveau) ferait
  // exploser vTime d'un coup une fois multiplie par timeScale. 500ms passe large au-dessus
  // du tick de la boucle lente (slowTimer, 250ms) pour ne pas la ralentir artificiellement.
  temps.vTime += Math.min(realNow - lastRealNow, 500) * temps.timeScale;
  lastRealNow = realNow;
  var now = temps.vTime;
  var active = shovel.on || bag.on || camMoving || weather.raining || monde.drops.length > 0;
  if (bag.on) updateBag();
  if (hand.on && updateHand(now)) active = true;
  if (partie.mode === 'exploded') { updateWeather(now); msgTick(); }
  updateRainDrops(now);
  if (shovel.on) {
    updateShovel();
    if (shovel.on) bowlWakePile(cutCompact()); // updateShovel peut la ranger (fin de versement au doigt)
  }
  // Balayage lent, quel que soit l'outil : une facette posee dont le sol a baisse (lessivage,
  // effondrement, pluie...) sans passer par la pelle ou le poing retombe quand meme.
  if (partie.mode === 'exploded' && temps.frame % 30 === 0) {
    for (var j = 0; j < monde.shards.length; j++) {
      var sj = monde.shards[j];
      if (sj.settled && sj.kcol &&sj.y < surfaceAt(sj.x) - 6) { pileRemove(sj); sj.settled = false; }
    }
  }
  var anyDead = false;
  for (var i = 0; i < monde.shards.length; i++) {
    var s = monde.shards[i];
    if (s.settled) continue;
    active = true;
    if (s.eaten !== undefined) {
      // Absorbee par une racine : elle retrecit sur place puis disparait.
      if (now - s.eaten > EATEN_MS) { s.dead = true; anyDead = true; }
      continue;
    }
    if (s.carried) {
      // Tenue a la main : suit le curseur, ignore la gravite tant qu'elle n'est pas
      // relachee (voir endPress, qui remet juste s.carried a false et la laisse tomber).
      s.px = s.x; s.py = s.y;
      s.x = hand.x + s.hox; s.y = hand.y + s.hoy;
      continue;
    }
    s.px = s.x; s.py = s.y;
    if (shovel.on) bladeField(s);
    // driftScale : contrairement a la pelle et aux facettes de terre (voir vTime plus
    // haut, la physique image par image ne doit PAS suivre le curseur de vitesse debug,
    // sinon la pelle deviendrait incontrolable), une feuille encore en l'air n'est
    // manipulee par personne — rien n'empeche sa chute d'accelerer avec le reste du
    // cycle. Sans ca, a vitesse elevee les feuilles se detachaient bien plus souvent
    // (vTime, voir plus haut) mais mettaient toujours le meme temps REEL a atteindre le
    // sol, ce qui les faisait sembler trainer par rapport a tout le reste.
    var driftScale = 1;
    if (s.leaf && !s.branch && !s.landed) {
      // Une feuille plane, pas encore tombee au sol une premiere fois : chute lente,
      // se balance de gauche a droite.
      // Vent : toujours un sens (qui s'inverse toutes les ~60 s), par rafales. Chaque
      // feuille a sa prise au vent (s.gust) : la plupart tombent pres, certaines partent loin.
      var wind = (Math.sin(now / 20000) >= 0 ? 1 : -1) * (0.4 + 0.3 * (1 + Math.sin(now / 1700 + s.sway))) * WIND_STRENGTH;
      s.vy += GRAVITY * 0.22 / (1 + s.gust * 0.4); s.vy *= 0.96;
      s.vx = s.vx * 0.95 + Math.sin(now / 350 + s.sway) * 0.1 + wind * (0.02 + s.gust * 0.045) * (s.wm || 1);
      driftScale = temps.timeScale;
    } else if (s.leaf && !s.branch) {
      // Une feuille deja tombee au moins une fois (relancee par la pelle) : elle ne
      // doit plus flotter comme a sa chute depuis l'arbre, mais tomber comme un debris.
      s.vy += GRAVITY * 0.6; s.vx *= AIR;
    } else if (s.leaf) {
      // Le bois (branch:true) est lourd : il tombe toujours comme un debris, meme a
      // sa toute premiere chute depuis l'arbre (pas de flottement type feuille).
      s.vy += GRAVITY * 0.75; s.vx *= AIR;
    } else {
      s.vy += GRAVITY; s.vx *= AIR; s.vy *= AIR;
      s.mix = Math.min(1, s.mix + 0.007);
    }
    s.x += s.vx * driftScale; s.y += s.vy * driftScale; s.rot += s.vr;
    if (shovel.on && collideBowl(s)) {
      s.vr *= 0.8;
      continue; // tenue par le bol : pas de contact avec le sol cette frame
    }
    if (s.x < 4) { s.x = 4; s.vx = Math.abs(s.vx) * 0.4; }
    if (s.x > vue.worldW - 4) { s.x = vue.worldW - 4; s.vx = -Math.abs(s.vx) * 0.4; }
    var floor = surfaceAt(s.x);
    if (s.grain) {
      // Un grain ne s'empile pas : il se fond dans la terre et l'inocule.
      if (s.y >= floor) { inoculate(s.x, floor, now, s.strain); s.dead = true; anyDead = true; }
      continue;
    }
    if (s.y >= floor && s.vy > 0) {
      s.y = floor;
      if (s.vy > 2.5) {
        s.vy *= -0.28; s.vx *= 0.6; s.vr *= 0.5;
      } else {
        s.settled = true; s.vx = s.vy = s.vr = 0;
        if (s.leaf) s.restRot = (Math.random() - 0.5) * (s.branch ? 0.24 : 0.3); // angle fige a plat (dessin seulement)
        // Une feuille garde sa couleur au sol et se decompose lentement (voir stepTrees).
        if (s.leaf) {
          // Une feuille/du bois deja passe par la litiere (pris a la main ou relance) garde
          // son avancement de decomposition (s.mix) au lieu de repartir de zero.
          s.landed = s.landed !== undefined ? now - s.mix * (s.branch ? BRANCH_LITTER_MS : LITTER_MS) : now;
          s.bonus = 0; s.lastNow = 0;
          if (monde.litter.indexOf(s) < 0) monde.litter.push(s);
        } else s.mix = 1;
        s.col = restColumn(s.x);
        s.x = (s.col + Math.random() - 0.5) * COL_W;
        s.y = monde.compactY[s.col] - monde.heights[s.col];
        pileAdd(s);
      }
    }
  }
  if (partie.mode === 'exploded') {
    var tl = stepTrees(now);
    var gl = updateGrass(now);
    monde.treeLife = tl > 0 || gl > 0;
    if (tl === 2) active = true;
    if (stepFlowers(now)) active = true;
    if (stepInsects(realNow)) active = true;
  }
  if (anyDead) monde.shards = monde.shards.filter(function (g) { return !g.dead; });
  if (partie.mode === 'exploded' && monde.colonised.length && stepMycelium(now)) active = true;
  if (monde.soilRiseT < 1) {
    monde.soilRiseT = Math.min(1, monde.soilRiseT + 1 / SOIL_RISE_FRAMES);
    active = true;
  }
  // Un champignon sorti du mycelium (pas plante a la main) fane si plus aucun mycelium
  // bien vivant n'est a portee pendant un moment : il ne peut pas survivre sans le
  // reseau qui l'a fait fructifier.
  var mycNearReach = vue.U * FRUIT_W;
  for (i = 0; i < monde.mushrooms.length; i++) {
    var mm = monde.mushrooms[i];
    if (!mm.myc || mm.dying || mm.treasure) continue;
    var nearMyc = false;
    for (var ci = 0; ci < monde.colonised.length; ci++) {
      if (monde.colonised[ci].myc > MYC_READY && Math.abs(monde.colonised[ci].x - mm.x) < mycNearReach) { nearMyc = true; break; }
    }
    if (nearMyc) mm.lastMycNear = now;
    else if (now - mm.lastMycNear > MUSHROOM_STARVE_MS) mm.dying = true;
  }
  for (i = 0; i < monde.mushrooms.length; i++) {
    var m = monde.mushrooms[i];
    if (m.dying) { m.t -= 0.06; active = true; }
    else if (m.t < 1) { m.t = Math.min(1, m.t + 0.025); active = true; }
  }
  monde.mushrooms = monde.mushrooms.filter(function (m) { return !(m.dying && m.t <= 0); });
  if (partie.goldBits.length && stepGoldBits()) active = true;
  // Un tresor enfoui est deterre d'office quand le fond du trou l'atteint (pas besoin de
  // "coups" en plus : sinon on pouvait creuser jusqu'a lui sans que rien ne se passe).
  if (partie.mode === 'exploded') {
    for (i = 0; i < partie.treasures.length; i++) {
      var tr = partie.treasures[i];
      if (tr.deep && !tr.revealed && tr.ready && surfaceAt(tr.x) >= tr.y - 12) { reveal(tr); active = true; }
    }
  }
  return active;
}

export function startLoop() {
  if (paused) return; // hors viewport ou onglet cache : rien ne doit programmer de frame
  if (vue.rafId !== null) return;
  if (slowTimer !== null) { clearTimeout(slowTimer); slowTimer = null; }
  vue.rafId = requestAnimationFrame(function tick() {
    var active = partie.mode === 'rebuilding' ? stepRebuild() : step();
    if (partie.mode !== 'assembled') draw();
    if (active) { vue.rafId = requestAnimationFrame(tick); return; }
    vue.rafId = null;
    // Il ne reste que des feuilles qui vieillissent, ou juste le cycle meteo (pluie
    // naturelle) a surveiller pour son prochain changement d'etat : 4 images/s suffisent.
    if (partie.mode === 'exploded' && (monde.treeLife || temps.rainLevel > 0)) {
      slowTimer = setTimeout(function () { slowTimer = null; startLoop(); }, 250);
    }
  });
}

// --- Reconstruction ----------------------------------------------------------------
export function rebuild() {
  if (partie.mode !== 'exploded') return;
  partie.mode = 'rebuilding';
  rebuildT = 0;
  vue.camX = vue.camMargin; // la camera revient au centre pendant que le logo se reconstruit
  vue.camY = vue.ZOOM === 1 ? 0 : camHomeY();
  vue.mobileArrow = 0;
  vue.mobileArrowY = 0;
  leaveHand(); // ce qu'on tenait/agrippait a la main ne survit pas a la reconstruction (rend aussi s.carried a false)
  // Les grains en vol n'ont pas de place dans le logo : ils disparaissent.
  monde.shards = monde.shards.filter(function (g) { return !g.grain && !g.extra && g.eaten === undefined; });
  monde.colonised = []; monde.fruited = {}; monde.deadMyc = []; monde.tintedMyc = false; resetPatches();
  monde.trees = []; monde.litter = []; monde.treeLife = false;
  monde.insects = []; monde.heldInsect = null; monde.insectNextAt = null; monde.insectLastT = null;
  monde.compactNutri = []; monde.drops = [];
  monde.lakes = []; monde.lakeOf = []; monde.lakeLastT = null;
  weather.raining = false; weather.clouds = []; weather.lastNow = null;
  weather.drought = false;
  updateDroughtIndicator();
  leaveBag();
  for (var i = 0; i < monde.shards.length; i++) {
    var s = monde.shards[i];
    s.sx = s.x; s.sy = s.y; s.srot = s.rot; s.smix = s.mix;
    s.delay = Math.random() * 0.35;
  }
  leaveShovel();
  clearTreasures();
  clearMycTip();
  hideMsgs();
  hideDemoEnd();
  setCaption(CAPTION_BEFORE);
  if (rebuildBtn) rebuildBtn.classList.add('d-none');
  if (speedBtn) speedBtn.classList.add('d-none');
  if (debugToggleBtn) debugToggleBtn.classList.add('d-none');
  if (moneyEl) moneyEl.classList.add('d-none');
  releaseHeader();
  hideDebugPanel();
  if (toolsBar) toolsBar.classList.add('d-none');
  if (chBadgeEl) chBadgeEl.classList.add('d-none');
  updateStrainBar(); // mode 'rebuilding' : le menu des souches se cache
  if (treasureCountEl) treasureCountEl.classList.add('d-none');
  if (toolsArrow) toolsArrow.classList.add('d-none');
  if (scrollLeftBtn) scrollLeftBtn.classList.add('d-none');
  if (scrollRightBtn) scrollRightBtn.classList.add('d-none');
  if (scrollUpBtn) scrollUpBtn.classList.add('d-none');
  if (scrollDownBtn) scrollDownBtn.classList.add('d-none');
  startLoop();
}

function stepRebuild() {
  rebuildT += 1 / 70;
  // Le tas s'enfonce avec le lit de terre, qui redescend d'ou il etait monte ; le
  // compact remonte lentement vers son niveau d'origine (setupSoil le refixe de toute
  // facon au prochain build).
  for (var i = 0; i < monde.heights.length; i++) {
    monde.heights[i] *= 0.9;
    monde.compactY[i] += (vue.groundY - monde.compactY[i]) * 0.1;
  }
  for (i = 0; i < monde.shards.length; i++) {
    var s = monde.shards[i];
    var t = easeInOut(Math.max(0, Math.min(1, (rebuildT - s.delay) / 0.65)));
    s.x = lerp(s.sx, s.ox, t);
    // Logo : petit arc vers le haut. Lit de terre : retour a sa place puis sous le bord.
    s.y = s.soil ? lerp(s.sy, s.oy + monde.soilDepth, t) : lerp(s.sy, s.oy, t) - Math.sin(t * Math.PI) * 40;
    s.rot = lerp(s.srot, 0, t);
    s.mix = lerp(s.smix, 0, t);
    if (s.myc) s.myc *= 0.93;
    s.nutri = null;
  }
  monde.mushrooms.forEach(function (m) { m.t -= 0.06; });
  monde.mushrooms = monde.mushrooms.filter(function (m) { return m.t > 0; });
  if (rebuildT < 1) return true;
  resetToLogo();
  return false;
}

function resetToLogo() {
  partie.mode = 'assembled';
  canvas.classList.add('d-none');
  fallbackImg.classList.remove('d-none');
  leaveShovel();
  clearTreasures();
  clearMycTip();
  hideMsgs();
  if (rebuildBtn) rebuildBtn.classList.add('d-none');
  if (speedBtn) speedBtn.classList.add('d-none');
  if (debugToggleBtn) debugToggleBtn.classList.add('d-none');
  if (moneyEl) moneyEl.classList.add('d-none');
  releaseHeader();
  hideDebugPanel();
  if (toolsBar) toolsBar.classList.add('d-none');
  if (chBadgeEl) chBadgeEl.classList.add('d-none');
  updateStrainBar();
  if (treasureCountEl) treasureCountEl.classList.add('d-none');
  if (toolsArrow) toolsArrow.classList.add('d-none');
  if (scrollLeftBtn) scrollLeftBtn.classList.add('d-none');
  if (scrollRightBtn) scrollRightBtn.classList.add('d-none');
  if (scrollUpBtn) scrollUpBtn.classList.add('d-none');
  if (scrollDownBtn) scrollDownBtn.classList.add('d-none');
  vue.mobileArrow = 0;
  vue.mobileArrowY = 0;
  vue.hoverScreenX = null; vue.hoverScreenY = null;
  leaveBag();
  leaveHand();
  weather.raining = false; weather.clouds = []; weather.lastNow = null;
  weather.drought = false;
  updateDroughtIndicator();
  monde.drops = []; monde.compactNutri = [];
  monde.lakes = []; monde.lakeOf = []; monde.lakeLastT = null;
  monde.shards = [];
  resetTiles();
  monde.mushrooms = [];
  monde.colonised = []; monde.fruited = {}; monde.deadMyc = []; monde.tintedMyc = false; resetPatches();
  partie.bagGrainsLeft = 0; // le sac se re-achete (ou se re-offre s'il n'a jamais servi) au prochain versement
  monde.trees = []; monde.litter = []; monde.treeLife = false;
  monde.insects = []; monde.heldInsect = null; monde.insectNextAt = null; monde.insectLastT = null;
  if (slowTimer !== null) { clearTimeout(slowTimer); slowTimer = null; }
}

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
var holdWrap = document.getElementById('logo-explosion-fallback-wrap');
var holdTimer = null, holdHintTimer = null, holdTouch = false;
function cancelHold() {
  clearTimeout(holdTimer);
  holdTimer = null;
  holdWrap.classList.remove('is-holding');
  if (holdTouch) { magnetTx = 0; magnetTy = 0; } // le badge retourne a sa place
}
// Le badge vient sous le doigt et le suit : reutilise --mx/--my du magnetisme souris,
// sans la borne MAGNET_MAX (le doigt peut etre sur le logo, loin de la zone du badge).
function holdFollow(evt) {
  if (!playBadge) return;
  var zr = playBadge.parentElement.getBoundingClientRect();
  magnetTx = evt.clientX - (zr.left + zr.width / 2);
  magnetTy = evt.clientY - (zr.top + zr.height / 2) - HOLD_LIFT;
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
function compactHeaderForGame() {
  headerCompactedByGame = true;
  if (window.sporaHeaderCompact && typeof window.sporaHeaderCompact.set === 'function') window.sporaHeaderCompact.set(true);
}
// Jeu remis a zero : on redeplie le header que le jeu avait compacte. Pas sur mobile :
// deplie, il mange trop de l'ecran ; il se redepliera tout seul au defilement.
function releaseHeader() {
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
function hideDebugPanel() {
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
var debugDefaults = null;
// Section repliable du panneau d'options : en-tete bouton (aria-expanded) + corps.
var sectionSeq = 0;
function makeSection(title, open) {
  var id = 'logo-explosion-sec-' + (sectionSeq++);
  var sec = document.createElement('div');
  sec.className = 'logo-explosion-debug-section';
  var head = document.createElement('button');
  head.type = 'button';
  head.className = 'logo-explosion-debug-head';
  head.setAttribute('aria-controls', id);
  head.textContent = title;
  var body = document.createElement('div');
  body.className = 'logo-explosion-debug-body';
  body.id = id;
  function setOpen(o) {
    head.setAttribute('aria-expanded', o ? 'true' : 'false');
    body.hidden = !o;
  }
  head.addEventListener('click', function () { setOpen(body.hidden); });
  setOpen(open);
  sec.appendChild(head);
  sec.appendChild(body);
  return { sec: sec, body: body };
}
function buildDebugPanel() {
  if (!debugPanel || partie.debugBuilt) return;
  partie.debugBuilt = true;
  debugDefaults = {};
  var groups = [], byGroup = {};
  for (var i = 0; i < DEBUG_FIELDS.length; i++) {
    var f = DEBUG_FIELDS[i];
    debugDefaults[f[1]] = getDebugVar(f[1]);
    if (!byGroup[f[0]]) { byGroup[f[0]] = []; groups.push(f[0]); }
    byGroup[f[0]].push(f);
  }
  var frag = document.createDocumentFragment();
  // Compteur de tresors : plus flottant sur la scene, en tete du panneau (voir updateTreasureUI).
  if (treasureCountEl) {
    frag.appendChild(treasureCountEl);
    if (partie.treasureDefs.length) treasureCountEl.classList.remove('d-none');
  }
  // Meteo, vitesse et gazon (anciennement la barre en bas a gauche) : seule section ouverte.
  if (speedWrap) {
    var wx = makeSection('Météo et rythme', true);
    wx.body.appendChild(speedWrap);
    speedWrap.classList.remove('d-none');
    frag.appendChild(wx.sec);
  }
  groups.forEach(function (g) {
    var gs = makeSection(g, false);
    var fs = gs.body;
    byGroup[g].forEach(function (f) {
      var key = f[1], min = f[3], max = f[4], step = f[5];
      var row = document.createElement('div');
      row.className = 'logo-explosion-debug-row';
      var label = document.createElement('label');
      label.textContent = f[2];
      label.setAttribute('for', 'dbg-' + key);
      var input = document.createElement('input');
      input.type = 'range'; input.id = 'dbg-' + key;
      input.min = min; input.max = max; input.step = step;
      input.value = getDebugVar(key);
      var out = document.createElement('output');
      out.textContent = input.value;
      input.addEventListener('input', function () {
        var v = parseFloat(this.value);
        setDebugVar(key, v);
        out.textContent = v;
      });
      row.appendChild(label); row.appendChild(input); row.appendChild(out);
      fs.appendChild(row);
    });
    frag.appendChild(gs.sec);
  });
  var resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'logo-explosion-debug-reset';
  resetBtn.textContent = 'Réinitialiser les valeurs';
  resetBtn.addEventListener('click', function () {
    for (var k in debugDefaults) setDebugVar(k, debugDefaults[k]);
    var inputs = debugPanel.querySelectorAll('input[id^="dbg-"]');
    for (var j = 0; j < inputs.length; j++) {
      var inp = inputs[j], key2 = inp.id.slice(4);
      inp.value = debugDefaults[key2];
      inp.nextSibling.textContent = inp.value;
    }
  });
  frag.appendChild(resetBtn);
  debugPanel.appendChild(frag);
}
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

// --- Pause hors champ / onglet cache -------------------------------------------------
// Inutile d'animer une scene que personne ne voit : la boucle s'arrete completement
// (rAF + slowTimer) des que la boite sort du viewport OU que l'onglet passe en arriere-plan,
// et ne reprend que si les deux conditions redeviennent vraies.
function pauseLoop() {
  if (paused) return;
  paused = true;
  wasRunningBeforeHide = vue.rafId !== null || slowTimer !== null;
  if (vue.rafId !== null) { cancelAnimationFrame(vue.rafId); vue.rafId = null; }
  if (slowTimer !== null) { clearTimeout(slowTimer); slowTimer = null; }
}
function resumeLoop() {
  if (!paused) return;
  paused = false;
  lastRealNow = null; // sinon le premier delta reel (temps passe en pause) ferait sauter vTime
  if (wasRunningBeforeHide) startLoop();
}
function updateVisibility() {
  if (inViewport && !document.hidden) resumeLoop(); else pauseLoop();
}
var inViewport = true;

// Toutes les positions sont en px de la taille au moment du clic : si la LARGEUR
// change (rotation, fenetre), on revient simplement au logo net. La hauteur seule
// est ignoree, elle bouge a chaque apparition de la barre d'adresse sur mobile.
var lastWidth;
var resizeTimeout = null;

var magnetTx, magnetTy, magnetCx, magnetCy;
// Demarrage du module : appele une seule fois par principal.js, dans un ordre fixe.
function initBadge() {
  if (playBadge) {
    var MAGNET_MAX = 80;     // px, decalage max du badge
    var MAGNET_EASE = 0.09;  // lissage du suivi (pas de saut brusque)
    magnetTx = 0, magnetTy = 0, magnetCx = 0, magnetCy = 0;
    var badgeZone = playBadge.parentElement;

    // pointermove filtre sur la souris, pas mousemove : apres un tap, le navigateur envoie
    // un faux mousemove qui laisserait le badge decale vers l'endroit touche.
    document.addEventListener('pointermove', function (evt) {
      if (evt.pointerType !== 'mouse') return;
      var zr = badgeZone.getBoundingClientRect();
      var bx = zr.left + zr.width / 2, by = zr.top + zr.height / 2;
      var dx = evt.clientX - bx, dy = evt.clientY - by;
      var dist = Math.hypot(dx, dy);
      var radius = Math.max(window.innerWidth, 900); // couvre toute la largeur de l'ecran
      if (dist > radius) { magnetTx = 0; magnetTy = 0; return; }
      // Vise la position reelle du curseur, bornee a MAGNET_MAX.
      var k = dist > MAGNET_MAX ? MAGNET_MAX / dist : 1;
      magnetTx = dx * k; magnetTy = dy * k;
    });
    document.addEventListener('mouseleave', function () { magnetTx = 0; magnetTy = 0; });

    (function stepMagnet() {
      var ease = holdTimer ? HOLD_FOLLOW_EASE : MAGNET_EASE; // au doigt : colle de pres
      magnetCx += (magnetTx - magnetCx) * ease;
      magnetCy += (magnetTy - magnetCy) * ease;
      playBadge.style.setProperty('--mx', magnetCx.toFixed(2) + 'px');
      playBadge.style.setProperty('--my', magnetCy.toFixed(2) + 'px');
      requestAnimationFrame(stepMagnet);
    })();
  }
}

// Demarrage du module : appele une seule fois par principal.js, dans un ordre fixe.
function initEvenements() {
  container.addEventListener('click', function (evt) {
    // Le bouton, les fleches et les infobulles sont dans la boite : leurs clics ne creusent pas.
    // (bug corrige : le bouton plein ecran manquait ici, un clic
    // dessus remontait jusqu'a ce listener et redeclenchait explode()/build() en plus
    // de l'action du bouton lui-meme.)
    if (evt.target.closest('#logo-explosion-rebuild, #logo-explosion-fullscreen, .logo-explosion-scroll, .logo-explosion-tip, .logo-explosion-shelf-cue,.logo-explosion-compass, .logo-explosion-tools, .logo-explosion-strains, .logo-explosion-treasures, .logo-explosion-challenges-badge, .logo-explosion-explain-locate, .logo-explosion-explain-close, .logo-explosion-explain-ack, .logo-explosion-end')) return;
    if (partie.mode === 'assembled') updateZoom(); // le zoom du monde qui va etre construit, avant de convertir le clic
    var pos = getRelativePos(evt);
    if (partie.mode === 'assembled') {
      // Seul un clic sur le logo (ou sa zone "play" juste en dessous) declenche
      // l'explosion : avant, n'importe quel clic dans la boite (meme le vide autour)
      // le faisait, ce qui ne correspond pas au curseur special affiche uniquement
      // au-dessus du logo.
      if (!evt.target.closest('#logo-explosion-fallback-wrap')) return;
      if (holdTouch) return; // au doigt : appui maintenu, voir plus bas
      // camX vient d'etre (re)centre par build() : + camX donne la position monde de
      // l'origine de l'explosion, coherente avec les coord. monde des facettes.
      if (partie.imgReady && build()) explode(pos.x + vue.camX, pos.y + vue.camY);
      return;
    }
    // Une fois explose, tout passe par les evenements pointer du canvas (pelle + taps).
  });
  if (holdWrap) {
    holdWrap.style.setProperty('--hold-ms', HOLD_MS + 'ms');
    holdWrap.addEventListener('pointerdown', function (evt) {
      holdTouch = evt.pointerType !== 'mouse';
      if (!holdTouch || partie.mode !== 'assembled' || !partie.imgReady) return;
      updateZoom();
      var pos = getRelativePos(evt);
      cancelHold();
      clearTimeout(holdHintTimer);
      holdWrap.classList.remove('is-hint');
      holdWrap.classList.add('is-holding');
      holdFollow(evt);
      holdTimer = setTimeout(function () {
        cancelHold();
        if (partie.mode === 'assembled' && build()) explode(pos.x + vue.camX, pos.y + vue.camY);
      }, HOLD_MS);
    });
    holdWrap.addEventListener('pointermove', function (evt) { if (holdTimer) holdFollow(evt); });
    // Doigt releve avant la fin : on explique le geste (sursaut + "Maintenez").
    holdWrap.addEventListener('pointerup', function () {
      if (holdTimer) {
        holdWrap.classList.add('is-hint');
        clearTimeout(holdHintTimer);
        holdHintTimer = setTimeout(function () { holdWrap.classList.remove('is-hint'); }, HOLD_HINT_MS);
      }
      cancelHold();
    });
    // pointercancel : le doigt a commence a faire defiler la page, on abandonne sans rien dire.
    ['pointercancel', 'pointerleave'].forEach(function (n) {
      holdWrap.addEventListener(n, cancelHold);
    });
    // Appui long sur une image : pas de menu contextuel du navigateur.
    holdWrap.addEventListener('contextmenu', function (evt) { if (holdTouch) evt.preventDefault(); });
  }
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

// Demarrage du module : appele une seule fois par principal.js, dans un ordre fixe.
function initDebug() {
  if (debugToggleBtn) {
    debugToggleBtn.addEventListener('click', function () {
      buildDebugPanel();
      var opening = debugPanel.classList.contains('d-none');
      debugPanel.classList.toggle('d-none', !opening);
      debugToggleBtn.classList.toggle('is-active', opening);
      debugToggleBtn.setAttribute('aria-pressed', opening ? 'true' : 'false');
    });
  }
}

// Demarrage du module : appele une seule fois par principal.js, dans un ordre fixe.
function initPhysique() {
  if ('IntersectionObserver' in window) {
    var visibilityObserver = new IntersectionObserver(function (entries) {
      inViewport = entries[entries.length - 1].isIntersecting;
      updateVisibility();
    });
    visibilityObserver.observe(container);
  }
  document.addEventListener('visibilitychange', updateVisibility);
}

// Demarrage : meme ordre a chaque etape du decoupage.
initEtat();
initMessages();
initDefis();
initBadge();
initTutoriel();
initTresors();
initTerrain();
initSauvegarde();
initOutils();
initArbres();
initTresorsUI();
initEvenements();
initDebug();
initPhysique();
