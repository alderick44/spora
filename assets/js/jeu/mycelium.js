// Mycelium : inoculation, propagation et fructification.
import { hexToRgb } from './utils.js';
import {
  SPECIES, MYC_MUSHROOM_SCALE, MAX_MUSHROOMS, CAPTION_MYC, MYC_RANDOM_DEATH_CHECK_MS, STRAIN_STD,
  MYC_RANDOM_DEATH_P, DROUGHT_SURFACE_DEPTH, DROUGHT_KILL_P, MYC_DROUGHT_DECAY, MYC_STARVE_MS, MYC_GROW,
  MYC_DECAY, MYC_DEAD, NUTRI, MYC_SPREAD_EVERY, MYC_RADIUS, FRUIT_W, MYC_READY, MYC_SPREAD_P,
  MYC_ACTIVE_FEED_MS, FRUIT_MIN, MYC_HOLD_MAX_MS, MYC_HOLD_REACH
} from './config.js';
import { vue, temps, monde, container, partie } from './etat.js';
import { isRocky, isSubmerged, surfaceAt } from './terrain.js';
import { weather } from './meteo.js';
import { buildTip, openTip } from './cartes.js';
import { setCaption, snapshotPatches, notePatchDeath } from './messages.js';
import { startLoop } from './principal.js';

var mycNextDeathCheck = 0;
var mycBusyUntil = 0;
var mycTipShown = false;
var speciesIdx = 0;

// Espece selon la souche : strophaire = strophaire rouge vin uniquement,
// pleurote = une des pleurotes au hasard (couleurs variees), hydne = l'hydne.
function speciesForStrain(st) {
  var pool = SPECIES.filter(function (sp) {
    if (st.id === 'pleurote') return sp.pleurote;
    if (st.id === 'hydne') return sp.hydne;
    return sp.strophaire;
  });
  return pool.length ? pool[(Math.random() * pool.length) | 0] : SPECIES[speciesIdx++ % SPECIES.length];
}
export function sprout(x, fromMyc, strain) {
  var sp = fromMyc && strain ? speciesForStrain(strain) : SPECIES[speciesIdx++ % SPECIES.length];
  var n = 1 + ((Math.random() * 3) | 0);
  var mainMushroom = null;
  for (var i = 0; i < n; i++) {
    var side = i === 0 ? 0 : (i === 1 ? -1 : 1);
    var size = vue.U * 0.2 * (0.6 + Math.random() * 0.6) * (i === 0 ? 1.15 : 0.85) * (fromMyc ? MYC_MUSHROOM_SCALE : 1);
    var m = {
      x: x + side * size * 0.55, size: size,
      lean: (Math.random() - 0.5) * 0.35 + side * 0.2,
      sp: sp, t: -i * 0.25,   // t negatif = petit decalage de pousse dans la grappe
      myc: !!fromMyc, lastMycNear: temps.vTime, strain: fromMyc ? strain || null : null
    };
    monde.mushrooms.push(m);
    if (window.sporaSfx) sporaSfx.play('pop', { min: 70 });
    if (i === 0) mainMushroom = m;
  }
  var alive = monde.mushrooms.filter(function (m) { return !m.dying && !m.treasure; });
  for (i = 0; i < alive.length - MAX_MUSHROOMS; i++) alive[i].dying = true;
  // Bulle produit : seulement au tout premier champignon issu du mycelium verse par le
  // visiteur (pas les champignons plantes a la main ni les tresors), une fois par
  // chargement de page (mycTipShown ne se reinitialise jamais, meme au rebuild).
  if (fromMyc && !mycTipShown) {
    mycTipShown = true;
    monde.mycTipMushroom = mainMushroom;
    monde.mycTip = buildTip({
      title: 'Cultivez vos propres champignons avec notre mycélium!',
      url: '/product/mycelium-en-vrac',
      cta: 'Précommander'
    });
    container.appendChild(monde.mycTip);
    openTip('myc');
    setCaption(CAPTION_MYC);
  }
  startLoop();
}

// --- Mycelium ----------------------------------------------------------------------
// lastFed : quand fourni (propagation vers une voisine), la nouvelle facette HERITE de
// l'horloge de celle qui l'a colonisee plutot que d'en recevoir une neuve - se repandre
// dans la terre ne nourrit pas, seul le bois pres d'une facette (stepTrees) la nourrit
// vraiment. Seule l'inoculation directe (grain du sac, sa propre reserve) demarre une
// horloge fraiche.
// parent : facette colonisatrice (le filament en part, voir drawHyphae) ; absent pour une
// inoculation directe. hyJ/hyTw/hyF : jitter, ramilles et duvet figes (pas de random au dessin).
// strain : souche du grain qui inocule (null = standard) ; une facette gagnee par
// propagation herite de celle de son parent, seule la teinte change (voir STRAIN_MIX).
export function infect(s, ox, oy, amount, now, lastFed, parent, strain) {
  if (s.myc || s.grain || s.nutri || s.deadMyc || isRocky(s.x) || isSubmerged(s.x)) return;
  s.myc = amount;
  s.mycParent = parent || null;
  s.strain = (parent ? parent.strain : strain) || null;
  s.pid = parent ? parent.pid || 0 : 0; // patch : herite du parent ; inoculation directe/restauration = attribue au prochain instantane
  if (s.pid && partie.patches[s.pid]) partie.patches[s.pid].alive++;
  if (s.strain) monde.tintedMyc = true;
  s.hyJ = (Math.random() - 0.5) * 8;
  s.hyTw = [Math.random() * 6.283, 3 + Math.random() * 4];
  if (Math.random() < 0.5) s.hyTw.push(Math.random() * 6.283, 3 + Math.random() * 4);
  s.hyF = [];
  for (var hi = 0; hi < 3; hi++) s.hyF.push((Math.random() - 0.5) * 8, -1.5708 + (Math.random() - 0.5) * 1.2, 2 + Math.random() * 2);
  s.mox = ox; s.moy = oy;               // point d'inoculation : borne la portee (MYC_RADIUS)
  s.mycTone = 0.7 + Math.random() * 0.2; // jamais tout a fait blanc : les facettes restent lisibles
  s.lastFed = lastFed !== undefined ? lastFed : now;
  monde.colonised.push(s);
  mycBusyUntil = temps.frame + 120;
}

export function inoculate(x, y, now, strain) {
  for (var i = 0; i < monde.shards.length; i++) {
    var s = monde.shards[i];
    if (!s.settled || Math.abs(s.x - x) > 12 || Math.abs(s.y - y) > 12) continue;
    infect(s, x, y, 0.06, now, undefined, undefined, strain);
  }
}

// Retourne true tant que quelque chose change (la boucle de rendu doit tourner).
// Sans bois a decomposer a portee (voir stepTrees, qui met a jour c.lastFed), un
// mycelium colonise finit par s'eteindre et la facette redevient de la terre normale.
export function stepMycelium(now) {
  var busy = temps.frame < mycBusyUntil;
  snapshotPatches(performance.now());
  var deathCheck = now >= mycNextDeathCheck;
  if (deathCheck) mycNextDeathCheck = now + MYC_RANDOM_DEATH_CHECK_MS;
  for (var i = monde.colonised.length - 1; i >= 0; i--) {
    var c = monde.colonised[i], droughtHit = false, starving = false, cst = c.strain || STRAIN_STD, dm = cst.decayMul;
    // La secheresse peut faner un mycelium en surface meme s'il est activement nourri :
    // elle agit sur l'exposition, pas sur la faim (voir DROUGHT_* pres de updateWeather).
    if (deathCheck && c.myc > 0 && Math.random() < MYC_RANDOM_DEATH_P * dm) {
      c.myc = 0; // mort aleatoire : meme sortie que la faim (voir plus bas)
      busy = true;
    } else if (weather.drought && c.y - surfaceAt(c.x) < DROUGHT_SURFACE_DEPTH && Math.random() < DROUGHT_KILL_P * dm) {
      c.myc -= MYC_DROUGHT_DECAY * dm;
      busy = true;
      droughtHit = true;
    } else if (c.myc < 1 && (now - c.lastFed < MYC_STARVE_MS)) { c.myc = Math.min(1, c.myc + MYC_GROW * cst.growMul); busy = true; continue; }
    else if (now - c.lastFed >= MYC_STARVE_MS) {
      c.myc -= MYC_DECAY * dm;
      busy = true;
      starving = true;
    }
    if (c.myc <= 0) {
      c.myc = 0;
      // Chaque mort est signalee (groupee, avec bouton "Voir") : voir notePatchDeath.
      notePatchDeath(c, droughtHit ? 'drought' : (starving ? 'starve' : 'random'));
      if (droughtHit) {
        // Contrairement a la mort de faim, la secheresse laisse un mycelium mort mais
        // toujours en place (deadMyc) : ni vivant ni nutriment, jusqu'a ce que la pluie le
        // decompose (voir decomposeDeadMyc).
        c.deadMyc = true;
        var deadColor = hexToRgb(MYC_DEAD[(Math.random() * MYC_DEAD.length) | 0]);
        c.from = deadColor; c.to = deadColor; c.mix = 1; c.nutri = null;
        monde.deadMyc.push(c);
      } else if (c.leaf) {
        // Le mycelium qui meurt de faim SUR DE LA LITIERE devient lui-meme un nutriment
        // (necromasse) : comme dans la vraie vie, sa propre mort nourrit encore le sol et
        // les arbres. Sur de la terre ordinaire (pas de litiere), voir le else ci-dessous :
        // la terre elle-meme n'a jamais de valeur nutritive, elle redevient juste de la
        // terre (le blanchiment disparait deja tout seul puisque le rendu suit c.myc).
        c.nutri = NUTRI[(Math.random() * NUTRI.length) | 0];
        c.nutriSince = now;
      }
      monde.colonised.splice(i, 1);
      if (!c.deadMyc) c.mycParent = null; // redevient de la terre normale (le mort garde son filament)
    }
  }
  if (temps.frame % MYC_SPREAD_EVERY === 0) spreadMycelium(now);
  return busy;
}

// Grille de voisinage refaite a chaque passage : la pelle deplace les facettes.
function spreadMycelium(now) {
  var D = 14, radius = vue.U * MYC_RADIUS, grid = new Map(), i, s, b;
  for (i = 0; i < monde.shards.length; i++) {
    s = monde.shards[i];
    if (!s.settled) continue;
    var key = ((s.x / D) | 0) * 1024 + ((s.y / D) | 0);
    var cell = grid.get(key);
    if (cell) cell.push(s); else grid.set(key, [s]);
  }
  var buckets = {}, fw = vue.U * FRUIT_W;
  for (i = 0; i < monde.colonised.length; i++) {
    var c = monde.colonised[i];
    if (!c.settled || c.myc < MYC_READY) continue;
    if (c.myc > 0.9 && c.y - surfaceAt(c.x) < 18) {
      b = Math.floor(c.x / fw);
      (buckets[b] = buckets[b] || []).push(c);
    }
    if (c.mycIdle > temps.frame || Math.random() > MYC_SPREAD_P) continue;
    // Coloniser de la terre neuve demande d'etre activement nourri MAINTENANT (bois
    // vraiment a portee), pas juste "pas encore mort" : sinon une facette peut conquerir
    // toute la terre autour d'elle avant de s'eteindre, loin de tout bois.
    if (now - c.lastFed >= MYC_ACTIVE_FEED_MS) continue;
    var gx = (c.x / D) | 0, gy = (c.y / D) | 0, free = [];
    for (var ax = -1; ax <= 1; ax++) {
      for (var ay = -1; ay <= 1; ay++) {
        var list = grid.get((gx + ax) * 1024 + gy + ay);
        if (!list) continue;
        for (var k = 0; k < list.length; k++) {
          var n = list[k];
          if (n.myc || Math.hypot(n.x - c.x, n.y - c.y) > D) continue;
          if (Math.hypot(n.x - c.mox, n.y - c.moy) > radius) continue;
          free.push(n);
        }
      }
    }
    // Plus rien a gagner autour : on la laisse tranquille un moment (economise des calculs).
    if (!free.length) { c.mycIdle = temps.frame + 90; continue; }
    // Herite l'horloge de faim du parent : se repandre dans la terre ne nourrit pas.
    infect(free[(Math.random() * free.length) | 0], c.mox, c.moy, 0.02, now, c.lastFed, c);
  }
  // Une zone de surface bien blanche fructifie une fois.
  for (b in buckets) {
    var xs = buckets[b];
    if (monde.fruited[b] || xs.length < FRUIT_MIN) continue;
    monde.fruited[b] = true;
    var pick = xs[(Math.random() * xs.length) | 0];
    sprout(pick.x, true, pick.strain || STRAIN_STD);
  }
}

// Vrai si un mycelium bien vivant (myc > MYC_READY) est assez proche pour retenir cet
// humus contre le lessivage — seulement s'il ne le retient pas depuis trop longtemps
// deja (MYC_HOLD_MAX_MS), sinon un humus jamais mange resterait bloque pour toujours.
export function heldByMycelium(x, y, nutriSince) {
  if (nutriSince !== undefined && temps.vTime - nutriSince > MYC_HOLD_MAX_MS) return false;
  for (var i = 0; i < monde.colonised.length; i++) {
    var c = monde.colonised[i];
    if (c.myc > MYC_READY && Math.hypot(c.x - x, c.y - y) < MYC_HOLD_REACH) return true;
  }
  return false;
}
