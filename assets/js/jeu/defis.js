// Defis : objectifs, progression et badge.
import {
  CH_TREES_GOAL, CH_STRAINS_GOAL, CH_HARVEST_GOAL, CH_MAX_SHOWN, MYC_READY, COL_W, CH_STRAIN_BIOMASS,
  CH_ZONE_REACH, CH_COLONY_PCT, CH_COLONY_HOLD_MS
} from './config.js';
import { partie, monde, vue } from './etat.js';
import { savePlayerIfChanged } from './sauvegarde.js';
import { msgBlocked, setCaption } from './messages.js';

// Defis : 11 objectifs apres les tresors, coches une seule fois et sauves avec le joueur
// (chDone = bitmask, chPlanted = arbres plantes par le joueur). Verifies a 1 Hz depuis
// msgTick ; l'annonce (setCaption) attend qu'aucun message/infobulle ne soit affiche.
// ATTENTION : ne jamais reordonner ni inserer au milieu : les bits (chDone) sont sauvegardes.
// Ajouter les nouveaux defis en fin de tableau seulement. unlocked() : condition d'affichage
// ET de validation (un defi ne se coche que s'il est debloque).
export var CHALLENGES = [
  { label: 'Arracher une branche à la main', unlocked: function () { return chIsDone(2); } },   // apres la maturite d'un arbre
  { label: 'Planter 8 arbres', unlocked: function () { return true; }, progress: function () { return Math.min(partie.chPlanted, CH_TREES_GOAL) + '/' + CH_TREES_GOAL; } },
  { label: 'Voir un arbre atteindre sa pleine maturité', unlocked: function () { return partie.chPlanted >= 1; } },
  { label: 'Avoir 3 souches de mycélium vivantes', unlocked: function () { return chIsDone(5); }, progress: function () { return chStrainsOk + '/' + CH_STRAINS_GOAL; } },
  { label: 'Réunir arbre, mycélium et gazon vivants', unlocked: function () { return chIsDone(2); } },
  { label: 'Coloniser 10 % du monde', unlocked: function () { return true; }, progress: function () { return Math.round(chPctNow * 100) + ' %'; } },
  { label: 'Coloniser 25 % du monde', unlocked: function () { return chIsDone(5); }, progress: function () { return Math.round(chPctNow * 100) + ' %'; } },
  { label: 'Coloniser 50 % du monde', unlocked: function () { return chIsDone(6); }, progress: function () { return Math.round(chPctNow * 100) + ' %'; } },
  { label: 'Récolter 10 strophaires', unlocked: function () { return true; }, progress: function () { return Math.min(partie.chHarv[0], CH_HARVEST_GOAL) + '/' + CH_HARVEST_GOAL; }, gift: true },
  { label: 'Récolter 10 pleurotes', unlocked: function () { return chIsDone(8); }, progress: function () { return Math.min(partie.chHarv[1], CH_HARVEST_GOAL) + '/' + CH_HARVEST_GOAL; }, gift: true },
  { label: 'Récolter 10 hydnes', unlocked: function () { return chIsDone(9); }, progress: function () { return Math.min(partie.chHarv[2], CH_HARVEST_GOAL) + '/' + CH_HARVEST_GOAL; }, gift: true },
  { label: 'Attraper un papillon', unlocked: function () { return true; } }   // a la main ; sans recompense
];
function chIsDone(k) { return !!(partie.chDone & (1 << k)); }
var chPctNow = 0, chStrainsOk = 0;      // valeurs courantes affichees dans la progression (mises a jour a 1 Hz)
var chListEl = null, chHeadEl = null, chDoneListEl = null, chDoneHeadEl = null;
function chCount() { var n = 0; for (var i = 0; i < CHALLENGES.length; i++) if (partie.chDone & (1 << i)) n++; return n; }
export function challengeDone(i) {
  if (partie.DEMO || partie.chDone & (1 << i)) return;
  partie.chDone |= 1 << i;
  if (CHALLENGES[i].gift) partie.freeTrees++;
  partie.chPending.push(i);
  updateChallengeUI();
  savePlayerIfChanged();
}
export function chUnlocked(i) { return CHALLENGES[i].unlocked(); }
export function updateChallengeUI() {
  // N'ecrit dans le DOM que si la valeur change : ce tick a 1 Hz faisait clignoter la liste au survol.
  var head = 'Défis ' + chCount() + '/' + CHALLENGES.length;
  if (chHeadEl && chHeadEl.textContent !== head) chHeadEl.textContent = head;
  if (!chListEl) return;
  var shown = 0;
  for (var i = 0; i < chListEl.children.length; i++) {
    var li = chListEl.children[i];
    var vis = !(partie.chDone & (1 << i)) && chUnlocked(i) && shown < CH_MAX_SHOWN;
    if (vis) shown++;
    if (li.hidden === vis) li.hidden = !vis;
    if (vis) {
      var pr = CHALLENGES[i].progress ? CHALLENGES[i].progress() : '';
      var label = CHALLENGES[i].label + (pr ? ' (' + pr + ')' : '');
      if (li.lastChild.nodeValue !== label) li.lastChild.nodeValue = label;
    }
  }
  if (chListEl.parentNode) chListEl.parentNode.classList.toggle('is-empty', shown === 0);
  if (chDoneListEl) {
    var doneKey = '', dn = 0;
    for (i = 0; i < CHALLENGES.length; i++) if (partie.chDone & (1 << i)) { doneKey += i + ','; dn++; }
    if (chDoneListEl.dataset.key !== doneKey) {
      chDoneListEl.dataset.key = doneKey;
      chDoneListEl.textContent = '';
      for (i = 0; i < CHALLENGES.length; i++) if (partie.chDone & (1 << i)) {
        var dli = document.createElement('li');
        dli.textContent = '☑ ' + CHALLENGES[i].label;
        chDoneListEl.appendChild(dli);
      }
      if (!dn) { var nli = document.createElement('li'); nli.textContent = 'Aucun pour l\'instant'; chDoneListEl.appendChild(nli); }
    }
    var dt = 'Défis réussis (' + dn + ')';
    if (chDoneHeadEl && chDoneHeadEl.textContent !== dt) chDoneHeadEl.textContent = dt;
  }
}
export function challengeTick(t) {
  if (partie.mode !== 'exploded') return;
  var i, j, c, all = CHALLENGES.length;
  updateChallengeUI(); // deblocage progressif (arbres plantes...), 1 fois par seconde
  if (partie.chPending.length && !msgBlocked(t)) {
    var k = partie.chPending.shift();
    var gift = CHALLENGES[k].gift ? ' — un arbre offert !' : '';
    setCaption(chCount() >= all && !partie.chPending.length ? 'Tous les défis sont réussis, bravo !' + gift : 'Défi réussi : ' + CHALLENGES[k].label + gift);
  }
  if (partie.chDone === (1 << all) - 1) return;
  if (!(partie.chDone & 2) && chUnlocked(1) && partie.chPlanted >= CH_TREES_GOAL) challengeDone(1);
  if (!(partie.chDone & 4) && chUnlocked(2)) {
    for (i = 0; i < monde.trees.length; i++) {
      if (monde.trees[i].growth < 1) monde.trees[i].seenGrowing = true;
      else if (monde.trees[i].seenGrowing) { challengeDone(2); break; }
    }
  }
  var need = false; // rien a verifier si les defis 3 a 7 sont faits ou verrouilles
  for (i = 3; i <= 7; i++) if (!(partie.chDone & (1 << i)) && chUnlocked(i)) { need = true; break; }
  if (!need) return;
  var bio = {}, cols = {}, nCols = monde.heights.length - 1, nAlive = 0, live = [];
  for (i = 0; i < monde.colonised.length; i++) {
    c = monde.colonised[i];
    if (!(c.myc > MYC_READY) || c.deadMyc) continue;
    live.push(c);
    var sid = c.strain || 'standard';
    bio[sid] = (bio[sid] || 0) + c.myc;
    cols[Math.max(0, Math.min(nCols - 1, Math.floor(c.x / COL_W)))] = 1;
  }
  if (!(partie.chDone & 8) && chUnlocked(3)) {
    var ok = 0;
    for (var id in bio) if (bio[id] >= CH_STRAIN_BIOMASS) ok++;
    chStrainsOk = ok;
    if (ok >= CH_STRAINS_GOAL) challengeDone(3);
  }
  if (!(partie.chDone & 16) && chUnlocked(4) && live.length && monde.trees.length) {
    var reach = vue.UW * CH_ZONE_REACH, cr = Math.ceil(reach / COL_W);
    for (i = 0; i < monde.trees.length; i++) {
      var hasMyc = false, hasGrass = false, tc = Math.floor(monde.trees[i].x / COL_W);
      for (j = 0; j < live.length; j++) if (Math.abs(live[j].x - monde.trees[i].x) < reach) { hasMyc = true; break; }
      if (!hasMyc) continue;
      for (j = Math.max(0, tc - cr); j <= Math.min(monde.grassCover.length - 1, tc + cr); j++) if (monde.grassCover[j] > 0.5) { hasGrass = true; break; }
      if (hasGrass) { challengeDone(4); break; }
    }
  }
  for (var key in cols) nAlive++;
  var pct = nCols > 0 ? nAlive / nCols : 0;
  chPctNow = pct;
  for (i = 0; i < 3; i++) {
    if ((partie.chDone & (32 << i)) || !chUnlocked(5 + i)) { partie.chHoldSince[i] = 0; continue; }
    if (pct >= CH_COLONY_PCT[i]) {
      if (!partie.chHoldSince[i]) partie.chHoldSince[i] = t;
      else if (t - partie.chHoldSince[i] >= CH_COLONY_HOLD_MS) challengeDone(5 + i);
    } else partie.chHoldSince[i] = 0;
  }
}

// Demarrage du module : appele une seule fois par principal.js, dans un ordre fixe.
export function initDefis() {
  // Pastille "Defis n/N" dans la barre d'outils (sous l'argent) ; la liste complete sort au survol.
  (function buildChallengeBadge() {
    var badge = document.getElementById('logo-explosion-challenges');
    if (!badge) return;
    chHeadEl = badge.querySelector('.logo-explosion-challenges-count');
    var pop = badge.querySelector('.logo-explosion-challenges-pop');
    chListEl = document.createElement('ul');
    chListEl.className = 'logo-explosion-challenges';
    CHALLENGES.forEach(function (ch) {
      var li = document.createElement('li');
      var box = document.createElement('span');
      box.textContent = '☐ ';
      li.appendChild(box);
      li.appendChild(document.createTextNode(ch.label));
      chListEl.appendChild(li);
    });
    pop.appendChild(chListEl);
    // 2e temps : un chevron deplie la liste des defis reussis sous la liste en cours.
    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'logo-explosion-challenges-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    chDoneHeadEl = document.createElement('span');
    toggle.appendChild(chDoneHeadEl);
    var chev = document.createElement('span');
    chev.className = 'logo-explosion-challenges-chevron';
    chev.setAttribute('aria-hidden', 'true');
    chev.textContent = '▾';
    toggle.appendChild(chev);
    chDoneListEl = document.createElement('ul');
    chDoneListEl.className = 'logo-explosion-challenges logo-explosion-challenges-done';
    chDoneListEl.hidden = true;
    toggle.addEventListener('click', function (evt) {
      evt.stopPropagation();
      var open = chDoneListEl.hidden;
      chDoneListEl.hidden = !open;
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.classList.toggle('is-open', open);
    });
    pop.appendChild(toggle);
    pop.appendChild(chDoneListEl);
    // Ouverture au clic (plus au survol) ; se ferme en recliquant la pastille, ailleurs ou avec Echap.
    function setBadgeOpen(o) {
      badge.classList.toggle('is-open', o);
      badge.setAttribute('aria-expanded', o ? 'true' : 'false');
    }
    badge.setAttribute('aria-expanded', 'false');
    badge.addEventListener('click', function (evt) {
      if (pop.contains(evt.target)) return;
      setBadgeOpen(!badge.classList.contains('is-open'));
    });
    badge.addEventListener('keydown', function (evt) {
      if (evt.target !== badge) return;
      if (evt.key === 'Enter' || evt.key === ' ') { evt.preventDefault(); setBadgeOpen(!badge.classList.contains('is-open')); }
      else if (evt.key === 'Escape') setBadgeOpen(false);
    });
    document.addEventListener('click', function (evt) { if (!badge.contains(evt.target)) setBadgeOpen(false); });
    updateChallengeUI();
  })();
}
