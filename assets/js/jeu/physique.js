// Physique : explosion du logo, pas de simulation, camera, boucle d'animation et retour au logo.
import { clamp, easeInOut, lerp } from './utils.js';
import {
  CAMERA_EDGE_TOUCH, CAMERA_EDGE, CAMERA_MAX, CAMERA_TOP_DEADZONE, CAMERA_MAX_Y, EATEN_MS, WIND_STRENGTH,
  GRAVITY, AIR, BRANCH_LITTER_MS, LITTER_MS, COL_W, SOIL_RISE_FRAMES, FRUIT_W, MYC_READY,
  MUSHROOM_STARVE_MS, CAPTION_BEFORE
} from './config.js';
import {
  monde, fallbackImg, canvas, partie, rebuildBtn, fullscreenBtn, speedBtn, debugToggleBtn, toolsBar,
  treasureCountEl, scrollLeftBtn, scrollRightBtn, scrollUpBtn, scrollDownBtn, vue, toolsArrow, temps,
  moneyEl, container
} from './etat.js';
import { draw, resetTiles } from './rendu.js';
import { surfaceAt, pileRemove, restColumn, pileAdd, startTreeX } from './terrain.js';
import { makeSavedTrees, terrainSig } from './sauvegarde.js';
import { weather, updateWeather, updateRainDrops, updateDroughtIndicator } from './meteo.js';
import { makeTree, makeStartTree, makeFarTree, stepTrees } from './arbres.js';
import { updateGrass, stepFlowers, stepInsects } from './flore.js';
import { inoculate, stepMycelium } from './mycelium.js';
import { updateMoneyUI } from './economie.js';
import {
  shovel, bag, hand, updateBag, updateHand, updateShovel, bowlWakePile, cutCompact, bladeField, collideBowl,
  leaveHand, leaveBag, leaveShovel
} from './outils.js';
import {
  updateStrainBar, setupTreasures, stepGoldBits, reveal, clearTreasures, clearMycTip, hideDemoEnd
} from './tresors.js';
import { flushDeathAlert, msgTick, resetPatches, hideMsgs, setCaption } from './messages.js';
import { compactHeaderForGame, camMinY, camHomeY, releaseHeader, hideDebugPanel } from './evenements.js';
import { startGuideArrow } from './tutoriel.js';
import { leaveLoupe } from './loupe.js';

var chBadgeEl = document.getElementById('logo-explosion-challenges');
var lastRealNow = null;
var slowTimer = null;
var rebuildT = 0;
var paused = false, wasRunningBeforeHide = false; // en pause : hors viewport ou onglet cache

// --- Physique ----------------------------------------------------------------------
export function explode(px, py) {
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
  if (savedTrees && savedTrees.length) monde.trees = savedTrees;
  else {
    monde.trees = [makeTree(vue.camMargin + vue.W * 0.14), makeStartTree(startTreeX(), 10)];
    if (!partie.DEMO) monde.trees.push(makeFarTree());
  }
  if (savedTrees && savedTrees.length) partie.worldSig = partie.worldSigPrev = terrainSig();
  monde.litter = [];
  if (toolsArrow && partie.unlockedStrains.length) { toolsArrow.classList.remove('d-none'); startGuideArrow(); }
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
  leaveLoupe();
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

export function resetToLogo() {
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
  leaveLoupe();
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
  startGuideArrow();
  lastRealNow = null; // sinon le premier delta reel (temps passe en pause) ferait sauter vTime
  if (wasRunningBeforeHide) startLoop();
}
export function loopPaused() { return paused; }
function updateVisibility() {
  if (inViewport && !document.hidden) resumeLoop(); else pauseLoop();
}
var inViewport = true;

// Demarrage du module : appele une seule fois par principal.js, dans un ordre fixe.
export function initPhysique() {
  if ('IntersectionObserver' in window) {
    var visibilityObserver = new IntersectionObserver(function (entries) {
      inViewport = entries[entries.length - 1].isIntersecting;
      updateVisibility();
    });
    visibilityObserver.observe(container);
  }
  document.addEventListener('visibilitychange', updateVisibility);
}
