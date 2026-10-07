// Meteo : averses, secheresses, tempetes, gouttes et nuages.
import { lerp } from './utils.js';
import {
  RAIN_DRY_MS, RAIN_SHOWER_MS, DROUGHT_MS, DROUGHT_GAP_MS, STORM_MS, STORM_GAP_MS, RAIN_CLOUDS_N,
  RAIN_CLOUD_DRIFT, RAIN_DROP_MAX, RAIN_SPAWN_MAX, STORM_SPAWN_MULT, RAIN_CLOUD_Y_FRAC, RAIN_DROP_VY, COL_W,
  LAKE_DROP_VOL, LEACH_MAX_STEPS_PER_FRAME, LEACH_INTERVAL_MS, LEAF_RAIN_MAX_DROP, WOOD_RAIN_MULT,
  LEAF_RAIN_STEP, RAIN_FADE_MS
} from './config.js';
import { temps, vue, droughtIndicator, stormIndicator, monde, ctx, partie } from './etat.js';
import { poly } from './rendu.js';
import { surfaceAt, updateLakes } from './terrain.js';
import { sinkCompactNutri, leach, decomposeDeadMyc } from './flore.js';

export var weather = {
  raining: false, changeAt: 0, startedAt: 0, clouds: [], lastNow: null,
  drought: false, droughtChangeAt: 0, storm: false, stormChangeAt: 0
};

function weatherDryMs() {
  return lerp(RAIN_DRY_MS[0], RAIN_DRY_MS[1], temps.rainLevel) * (0.6 + Math.random() * 0.8);
}
function weatherShowerMs() {
  return lerp(RAIN_SHOWER_MS[0], RAIN_SHOWER_MS[1], temps.rainLevel) * (0.7 + Math.random() * 0.6);
}
function droughtMs() {
  return lerp(DROUGHT_MS[0], DROUGHT_MS[1], temps.droughtLevel) * (0.7 + Math.random() * 0.6);
}
function droughtGapMs() {
  return lerp(DROUGHT_GAP_MS[0], DROUGHT_GAP_MS[1], temps.droughtLevel) * (0.7 + Math.random() * 0.6);
}
function stormMs() {
  return lerp(STORM_MS[0], STORM_MS[1], temps.stormLevel) * (0.7 + Math.random() * 0.6);
}
function stormGapMs() {
  return lerp(STORM_GAP_MS[0], STORM_GAP_MS[1], temps.stormLevel) * (0.7 + Math.random() * 0.6);
}

function startShower(now) {
  weather.raining = true;
  weather.startedAt = now;
  weather.changeAt = now + weatherShowerMs();
  weather.clouds = [];
  for (var i = 0; i < RAIN_CLOUDS_N; i++) {
    weather.clouds.push({
      x: (vue.worldW / RAIN_CLOUDS_N) * (i + Math.random() * 0.4),
      w: vue.U * (0.5 + Math.random() * 0.4),
      vx: (Math.random() < 0.5 ? -1 : 1) * RAIN_CLOUD_DRIFT * (0.6 + Math.random() * 0.8)
    });
  }
  // Une averse coupe net toute secheresse en cours, et repousse la prochaine : jamais les
  // deux a la fois.
  weather.drought = false;
  weather.droughtChangeAt = now + droughtGapMs();
  // La tempete est une sous-phase de l'averse (voir updateWeather) : chaque nouvelle
  // averse repart avec son propre delai avant la premiere tempete possible.
  weather.storm = false;
  weather.stormChangeAt = now + stormGapMs();
}
function startDry(now) {
  weather.raining = false;
  weather.storm = false;
  weather.clouds = [];
  weather.changeAt = now + weatherDryMs();
}
// Coupe une averse en cours quand le curseur Pluie repasse a 0 : pas de fondu, ce
// reglage reste un peu du debug plutot qu'une meteo scriptee.
export function stopShower() {
  if (!weather.raining) return;
  weather.raining = false;
  weather.storm = false;
  weather.clouds = [];
}
function startDrought(now) {
  weather.drought = true;
  weather.droughtChangeAt = now + droughtMs();
}
function endDrought(now) {
  weather.drought = false;
  weather.droughtChangeAt = now + droughtGapMs();
}
function startStorm(now) {
  if (window.sporaSfx) sporaSfx.play('thunder'); 
  weather.storm = true;
  weather.stormChangeAt = now + stormMs();
}
function endStorm(now) {
  weather.storm = false;
  weather.stormChangeAt = now + stormGapMs();
}

export function updateWeather(now) {
  // Demo : aucune meteo (ni pluie, ni tempete, ni secheresse). L'horloge repart de zero, par
  // une periode seche, a "Continuer a jouer".
  if (partie.DEMO) { weather.lastNow = null; return; }
  if (weather.lastNow === null) {
    weather.lastNow = now;
    // Debut de partie (changeAt remis a 0 par setupSoil) : une periode seche d'abord, sinon
    // l'averse partait des l'explosion. Meme delai de grace pour la secheresse.
    weather.changeAt = now + weatherDryMs();
    weather.droughtChangeAt = now + droughtGapMs();
  }
  var dt = Math.max(0, now - weather.lastNow);
  weather.lastNow = now;
  if (temps.rainLevel <= 0) {
    if (weather.raining) stopShower();
    weather.changeAt = now; // repart a zero des que le curseur remonte
  } else if (now >= weather.changeAt) {
    if (weather.raining) startDry(now); else startShower(now);
  }
  // Le cycle de secheresse tourne independamment de la pluie (son propre curseur, sa propre
  // horloge) tant qu'il ne pleut pas ; a 0 elle est simplement coupee, comme la pluie a 0.
  if (temps.droughtLevel <= 0) {
    weather.drought = false;
    weather.droughtChangeAt = now; // repart a zero des que le curseur remonte
  } else if (!weather.raining && now >= weather.droughtChangeAt) {
    if (weather.drought) endDrought(now); else startDrought(now);
  }
  // La tempete n'existe que PENDANT une averse deja en cours (une tempete hors pluie
  // n'aurait rien a intensifier) ; a 0 elle est simplement coupee, comme la pluie et la
  // secheresse a 0.
  if (temps.stormLevel <= 0 || !weather.raining) {
    if (weather.storm) weather.storm = false;
  } else if (now >= weather.stormChangeAt) {
    if (weather.storm) endStorm(now); else startStorm(now);
  }
  for (var i = 0; i < weather.clouds.length; i++) weather.clouds[i].x += weather.clouds[i].vx * dt;
  updateDroughtIndicator();
  updateStormIndicator();
}

// Seul indicateur visuel de la secheresse (pas d'effet a l'ecran comme les nuages de pluie) :
// un badge texte dans la barre de debug, pour qu'on sache quand elle est active en testant
// le curseur Secheresse. N'ecrit dans le DOM que sur un changement d'etat.
var droughtIndicatorOn = false;
export function updateDroughtIndicator() {
  if (!droughtIndicator || weather.drought === droughtIndicatorOn) return;
  droughtIndicatorOn = weather.drought;
  droughtIndicator.classList.toggle('d-none', !droughtIndicatorOn);
}
var stormIndicatorOn = false;
export function updateStormIndicator() {
  if (!stormIndicator || weather.storm === stormIndicatorOn) return;
  stormIndicatorOn = weather.storm;
  stormIndicator.classList.toggle('d-none', !stormIndicatorOn);
}

export function updateRainDrops(now) {
  if (weather.raining && monde.drops.length < RAIN_DROP_MAX) {
    var spawnN = Math.max(1, Math.round(RAIN_SPAWN_MAX * temps.rainLevel * (weather.storm ? STORM_SPAWN_MULT : 1)));
    var cy = vue.camY + vue.H * RAIN_CLOUD_Y_FRAC;
    for (var i = 0; i < spawnN && monde.drops.length < RAIN_DROP_MAX; i++) {
      monde.drops.push({ x: vue.camX + Math.random() * vue.W, y: cy + 4, vy: lerp(RAIN_DROP_VY[0], RAIN_DROP_VY[1], Math.random()) });
    }
  }
  for (var d = monde.drops.length - 1; d >= 0; d--) {
    var dr = monde.drops[d];
    dr.y += dr.vy;
    // Une goutte qui touche une cuvette (ou son eau) y ajoute du volume (voir updateLakes).
    var dcol = Math.max(0, Math.min(monde.heights.length - 1, Math.round(dr.x / COL_W))), dl = monde.lakeOf[dcol] ? monde.lakes[monde.lakeOf[dcol] - 1] : null;
    if (dr.y >= surfaceAt(dr.x) || (dl && dcol >= dl.c0 && dcol <= dl.c1 && dr.y >= dl.level)) {
      if (dl) dl.vol += LAKE_DROP_VOL;
      monde.drops.splice(d, 1);
    }
  }
  updateLakes(now);
  // A vitesse elevee (slider debug), vTime peut sauter de bien plus qu'un
  // LEACH_INTERVAL_MS en une seule frame reelle. On compte combien de pas ont ete
  // "rates" (plafonne par LEACH_MAX_STEPS_PER_FRAME, pour eviter un calcul sans fin si le
  // saut est extreme) et on les rattrape — mais PAS en rappelant tout leach() ce nombre de
  // fois : sa recherche de voisine (descente en terre meuble) est deja plafonnee a un seul
  // pas reel par frame par leachTick (voir leach()), donc la rappeler en boucle ne faisait
  // qu'en payer le cout O(facettes^2) inutilement — a vitesse elevee ca gelait carrement
  // la simulation. Seul l'enfoncement dans le compact (sinkCompactNutri, bon marche) doit
  // vraiment suivre le nombre de pas, sinon la maturation sans pluie (NUTRI_RIPEN_MS, qui
  // suit vTime brut) finit par devancer le lessivage a vitesse elevee (voir plus haut).
  if (weather.raining) {
    var leachSteps = 0;
    while (now >= monde.nextLeachAt && leachSteps < LEACH_MAX_STEPS_PER_FRAME) {
      monde.nextLeachAt += LEACH_INTERVAL_MS;
      leachSteps++;
    }
    if (monde.nextLeachAt < now) monde.nextLeachAt = now + LEACH_INTERVAL_MS;
    if (leachSteps > 0) {
      sinkCompactNutri(leachSteps);
      leach(now);
      decomposeDeadMyc();
    }
  }
}

// Petite descente d'une feuille tombee (voir LEAF_RAIN_*) : plafonnee par averse
// (weather.startedAt), arretee par le compact ou une autre feuille juste en dessous. Une
// feuille deja mangee par du mycelium (l.bonus) ne bouge pas : elle est deja au bon endroit.
export function rainLeaf(s) {
  if (s.rainEpisode !== weather.startedAt) { s.rainEpisode = weather.startedAt; s.rainDrop = 0; }
  if (s.rainDrop >= LEAF_RAIN_MAX_DROP * (s.branch ? WOOD_RAIN_MULT : 1)) return;
  var col = Math.max(0, Math.min(monde.compactY.length - 1, Math.round(s.x / COL_W)));
  var ny = s.y + LEAF_RAIN_STEP;
  if (ny > monde.compactY[col] - 3) return;
  for (var j = 0; j < monde.shards.length; j++) {
    var o = monde.shards[j];
    if (o === s || !o.leaf || !o.settled) continue;
    if (Math.abs(o.x - s.x) < 8 && o.y > s.y && o.y - ny < 4) return;
  }
  s.y = ny;
  s.rainDrop += LEAF_RAIN_STEP;
}

// Fondu d'entree/sortie des nuages : monte pendant RAIN_FADE_MS au debut de l'averse,
// redescend pendant RAIN_FADE_MS avant sa fin programmee (weather.changeAt).
function drawClouds() {
  if (!weather.clouds.length) return;
  var now = temps.vTime;
  var alpha = Math.min(1, (now - weather.startedAt) / RAIN_FADE_MS, (weather.changeAt - now) / RAIN_FADE_MS);
  alpha = Math.max(0, Math.min(1, alpha));
  if (alpha <= 0) return;
  var CLOUD = ['#e9edf0', '#d7dee2', '#c7d0d6'];
  var cy = vue.camY + vue.H * RAIN_CLOUD_Y_FRAC, n = 5;
  ctx.save();
  ctx.globalAlpha = alpha;
  for (var ci = 0; ci < weather.clouds.length; ci++) {
    var cl = weather.clouds[ci], w = cl.w, x0base = cl.x - w / 2;
    for (var k = 0; k < n; k++) {
      var x0 = x0base + (w / n) * k, x1 = x0base + (w / n) * (k + 1);
      var bump = w * 0.18 * (0.6 + Math.sin(k * 1.7 + ci) * 0.4);
      ctx.fillStyle = CLOUD[k % CLOUD.length];
      poly([[x0, cy + 6], [x1, cy + 6], [(x0 + x1) / 2, cy - bump]]);
    }
  }
  ctx.restore();
}

export function drawRain() {
  for (var i = 0; i < monde.drops.length; i++) {
    var d = monde.drops[i];
    ctx.fillStyle = '#bfe0ef';
    poly([[d.x - 1.5, d.y - 6], [d.x + 1.5, d.y - 6], [d.x, d.y + 6]]);
  }
  drawClouds();
}
