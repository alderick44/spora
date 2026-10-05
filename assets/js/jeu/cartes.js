// Cartes des tresors : infobulles, galerie de photos et indices pour creuser.
import { easeOutBack } from './utils.js';
import { TIP_AWAY_MS, NO_HOVER, TIP_IDLE_MS, DIG_TREASURE_MSG, DIG_TIP_MS } from './config.js';
import { shelfEl, container, partie, vue, shelfMq, monde } from './etat.js';
import { surfaceAt } from './terrain.js';
import { treasureY, nuggetY, updateCompass } from './tresors.js';
import { guideCurrent } from './tutoriel.js';
import { siteHeader } from './evenements.js';

// strainLabel : nom de la souche tout juste debloquee par ce tresor (sinon null).
export function buildTip(def) {
  var tip = document.createElement('div');
  tip.className = 'logo-explosion-tip';
  var close = document.createElement('button');
  close.type = 'button';
  close.className = 'logo-explosion-tip-close';
  close.setAttribute('aria-label', 'Fermer');
  close.textContent = '×';
  close.addEventListener('click', function (evt) {
    evt.stopPropagation();
    // Carte rangee sous le jeu : elle y reste meme fermee, seule la croix la retire (retour dans le jeu, invisible).
    if (shelfEl && tip.parentNode === shelfEl) container.appendChild(tip);
    openTip(null);
  });
  tip.appendChild(close);
  // Plusieurs photos (voir tipImgs) : fleches et compteur sur la photo. Le credit de la photo
  // affichee (licence libre) est pose en pale dans son coin bas gauche.
  var imgs = tipImgs(def), credit = null;
  if (imgs.length) {
    tip.classList.add('has-img');
    var media = document.createElement('div');
    media.className = 'logo-explosion-tip-media';
    var im = document.createElement('img');
    im.alt = '';
    media.appendChild(im);
    credit = document.createElement('small');
    credit.className = 'logo-explosion-tip-credit';
    media.appendChild(credit);
    var idx = 0, count = null;
    var showImg = function () {
      var cur = imgs[idx];
      im.src = cur.src;
      if (count) count.textContent = (idx + 1) + ' / ' + imgs.length;
      credit.textContent = '';
      credit.classList.toggle('d-none', !cur.credit);
      if (!cur.credit) return;
      var by = document.createElement(cur.credit_url ? 'a' : 'span');
      if (cur.credit_url) { by.href = cur.credit_url; by.target = '_blank'; by.rel = 'noopener'; }
      by.textContent = cur.credit;
      credit.appendChild(by);
    };
    if (imgs.length > 1) {
      count = document.createElement('span');
      count.className = 'logo-explosion-tip-count';
      // Des boutons : la main ne saisit pas le tresor dessus, et le clic n'agrandit pas la carte.
      [-1, 1].forEach(function (dir) {
        var nav = document.createElement('button');
        nav.type = 'button';
        nav.className = 'logo-explosion-tip-nav ' + (dir < 0 ? 'is-prev' : 'is-next');
        nav.setAttribute('aria-label', dir < 0 ? 'Photo précédente' : 'Photo suivante');
        nav.textContent = dir < 0 ? '‹' : '›';
        nav.addEventListener('click', function (evt) {
          evt.stopPropagation();
          idx = (idx + dir + imgs.length) % imgs.length;
          showImg();
        });
        media.appendChild(nav);
      });
      media.appendChild(count);
    }
    showImg();
    tip.appendChild(media);
  }
  var body = document.createElement('div');
  body.className = 'logo-explosion-tip-body';
  var title = document.createElement('strong');
  title.textContent = def.title || '';
  body.appendChild(title);
  // Carte a image : le texte et le lien sont replies sous le titre, et se deplient au survol
  // ou au clic (.is-details, voir style.css). Sans image, tout reste visible.
  var more = body;
  if (imgs.length) {
    var fold = document.createElement('div');
    fold.className = 'logo-explosion-tip-more';
    more = document.createElement('div');
    fold.appendChild(more);
    body.appendChild(fold);
  }
  if (def.text) {
    var p = document.createElement('p');
    p.textContent = def.text;
    more.appendChild(p);
  }
  if (def.url) {
    var a = document.createElement('a');
    a.href = def.url;
    a.textContent = def.cta || 'Voir le produit';
    more.appendChild(a);
  }
  tip.appendChild(body);
  return tip;
}

// Photos d'une carte, normalisees en { src, credit, credit_url } : def.img est une photo ou un
// tableau de photos, chacune une URL ou deja un objet de cette forme (voir $spora_treasures).
export function tipImgs(def) {
  return [].concat(def.img || []).map(function (im) { return typeof im === 'string' ? { src: im } : im; });
}
var tipAwayTimer = 0;
export function tipAway(away) {
  if (!away) { clearTimeout(tipAwayTimer); tipAwayTimer = 0; return; }
  if (tipAwayTimer) return;
  tipAwayTimer = setTimeout(function check() {
    var open = null;
    partie.treasures.forEach(function (t) { if (t.tip && t.tip.classList.contains('is-open')) open = t; });
    var wait = (vue.treasureGrab || (open && open.tip.matches(':hover'))) ? TIP_AWAY_MS : partie.tipHoldUntil - performance.now();
    if (open && wait > 0) { tipAwayTimer = setTimeout(check, wait); return; }
    tipAwayTimer = 0;
    if (open) openTip(null);
  }, TIP_AWAY_MS);
}
var tipIdleTimer = 0;
export function tipIdle() {
  clearTimeout(tipIdleTimer);
  if (!NO_HOVER) return;
  tipIdleTimer = setTimeout(function () {
    var open = null;
    partie.treasures.forEach(function (t) { if (t.tip && t.tip.classList.contains('is-open')) open = t; });
    if (!open) return;
    if (open.tip.classList.contains('is-zoom')) tipIdle(); else openTip(null);
  }, TIP_IDLE_MS);
}

// Tap sur la carte d'un tresor : sur la photo, agrandit / reduit la carte (le texte se deplie
// avec, voir .is-zoom ; sur ecran tactile elle prend alors toute la boite) ; ailleurs, deplie /
// replie le texte.
export function tapTip(t, onImg) {
  t.tip.classList.toggle(onImg ? 'is-zoom' : 'is-details');
}

// Une seule infobulle ouverte a la fois : les tresors (et la bulle mycelium, active
// valant la chaine 'myc') sont proches, elles se chevaucheraient.
export function openTip(active, tapped) {
  var wasOpen = !!(active && active.tip && active.tip.classList.contains('is-open'));
  partie.treasures.forEach(function (t) {
    if (!t.tip) return;
    t.tip.classList.toggle('is-open', t === active);
    if (t !== active) t.tip.classList.remove('is-details', 'is-zoom'); // se rouvre repliee
  });
  // Boite sous le jeu (ecran etroit) : elle garde la carte du dernier tresor selectionne, meme
  // "fermee" (elle n'y depend pas de .is-open, voir style.css ; sa croix la retire) ; la
  // precedente retourne dans le jeu, invisible. Ecran redevenu large : tout retourne dans le jeu.
  if (shelfEl) {
    var shelved = shelfMq && shelfMq.matches;
    if (!shelved || (active && active !== 'myc' && active.tip && active.tip.parentNode !== shelfEl)) {
      while (shelfEl.firstChild) container.appendChild(shelfEl.firstChild);
      if (shelved) shelfEl.appendChild(active.tip);
    }
    if (shelved && active && active.tip && (tapped || !wasOpen)) shelfCue(active);
  }
  if (monde.mycTip) monde.mycTip.classList.toggle('is-open', active === 'myc');
  if (!!active !== partie.tipOpen) { partie.tipOpen = !!active; partie.tipChangeAt = performance.now(); } // voir leachTip
  if (active && active !== 'myc') tipIdle(); else clearTimeout(tipIdleTimer);
}

// Carte rangee sous le jeu (shelfEl), souvent hors ecran : la ou la bulle serait apparue, une
// pastille (photo + titre) surgit au-dessus du champignon puis tombe vers le bas de la boite,
// en direction de la carte (animation CSS, --drop = distance jusqu'au bas de la boite). La
// carte s'illumine a l'arrivee (.is-fresh). Un tap sur la pastille fait defiler jusqu'a elle.
var shelfCueEl = null;
function shelfCue(t) {
  if (shelfCueEl) shelfCueEl.remove();
  var m = t.mushroom, cue = document.createElement('button');
  if (!m) return;
  cue.type = 'button';
  cue.className = 'logo-explosion-shelf-cue';
  var photo = t.tip.querySelector('img'), name = t.tip.querySelector('strong');
  if (photo) {
    var thumb = document.createElement('img');
    thumb.src = photo.src;
    thumb.alt = '';
    cue.appendChild(thumb);
  }
  var label = document.createElement('span');
  label.textContent = name ? name.textContent : '';
  cue.appendChild(label);
  // Overlay HTML : px CSS, donc * ZOOM (comme positionTipOverMushroom). 120 : reste sous le header.
  var boxW = vue.W * vue.ZOOM, top = Math.max(120, (surfaceAt(m.x) - vue.camY) * vue.ZOOM - 70);
  cue.style.left = Math.max(110, Math.min(boxW - 110, (m.x - vue.camX) * vue.ZOOM)) + 'px';
  cue.style.top = top + 'px';
  cue.style.setProperty('--drop', Math.max(80, container.clientHeight - top + 60) + 'px');
  cue.addEventListener('click', function () { shelfEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  cue.addEventListener('animationend', function () {
    cue.remove();
    if (shelfCueEl === cue) shelfCueEl = null;
  });
  container.appendChild(cue);
  shelfCueEl = cue;
  t.tip.classList.remove('is-fresh');
  void t.tip.offsetWidth; // relance l'animation si la meme carte est rechoisie
  t.tip.classList.add('is-fresh');
}

// Position d'une infobulle juste au-dessus du chapeau d'un champignon (monde -> ecran,
// - camX/- camY) ; partagee par les tresors deterres et la bulle mycelium.
function positionTipOverMushroom(tipEl, m) {
  var g = easeOutBack(Math.max(0, Math.min(1, m.t)));
  // Overlay HTML : positions en px CSS, donc * ZOOM (la taille de la bulle, elle, reste en px CSS).
  var capTop = (surfaceAt(m.x) - vue.camY + 6 - m.size * g * 1.45) * vue.ZOOM;
  var half = tipEl.offsetWidth / 2;
  var mScreenX = (m.x - vue.camX) * vue.ZOOM;
  var left = Math.max(half + 8, Math.min(vue.W * vue.ZOOM - half - 8, mScreenX));
  tipEl.style.left = left + 'px';
  // Champignon sorti trop haut (terre decompactee) ou carte agrandie : la bulle reste dans l'ecran,
  // sans fleche, et sous le header qui flotte par-dessus le haut de la boite (accueil). Bornee a
  // 150px comme --game-ui-top : menu mobile ouvert, le header est tres haut.
  var hb = siteHeader ? siteHeader.getBoundingClientRect().bottom - container.getBoundingClientRect().top : 0;
  var minTop = tipEl.offsetHeight + 8 + Math.max(0, Math.min(hb, 150)), top = Math.max(capTop - 6, minTop);
  tipEl.classList.toggle('is-clamped', top !== capTop - 6);
  tipEl.style.top = top + 'px';
  tipEl.style.setProperty('--arrow-dx', (mScreenX - left) + 'px');
}

// Ces overlays sont du HTML positionne en absolu dans la boite : leurs coordonnees
// doivent etre converties de monde vers ecran (- camX, - camY), contrairement au canvas
// qui le fait via ctx.translate dans draw().
// Bulle "creusez..." a cote d'un tresor pas encore deterre (clic dessus) : une seule, qui suit
// le tresor a l'ecran et se ferme seule (DIG_TIP_MS) ou quand il est deterre.
var digTipEl = null, digTipTarget = null, digTipTimer = 0;
export function hideDigTip() {
  clearTimeout(digTipTimer);
  digTipTarget = null;
  partie.digTipHover = false;
  if (digTipEl) digTipEl.classList.remove('is-open');
}
// Tresor pas encore deterre dont le scintillement affiche est sous le pointeur (meme enfoui) :
// on compare au rectangle reel de l'element (coordonnees fenetre), pas a un calcul monde -> ecran.
export function treasureGlintAt(evt) {
  var best = null, bd = 34;
  for (var i = 0; i < partie.treasures.length; i++) {
    var t = partie.treasures[i];
    if (t.revealed || !t.glint.classList.contains('is-visible')) continue;
    var r = t.glint.getBoundingClientRect();
    var d = Math.hypot(r.left + r.width / 2 - evt.clientX, r.top + r.height / 2 - evt.clientY);
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}
export function showDigTip(t, hover) {
  if (!digTipEl) {
    digTipEl = document.createElement('div');
    digTipEl.className = 'logo-explosion-digtip';
    digTipEl.setAttribute('aria-hidden', 'true');
    digTipEl.textContent = DIG_TREASURE_MSG;
    container.appendChild(digTipEl);
  }
  digTipTarget = t;
  partie.digTipHover = !!hover;
  digTipEl.classList.add('is-open');
  clearTimeout(digTipTimer);
  if (!hover) digTipTimer = setTimeout(hideDigTip, DIG_TIP_MS);
  positionDigTip();
}
function positionDigTip() {
  if (!digTipEl || !digTipTarget) return;
  if (digTipTarget.revealed) { hideDigTip(); return; }
  var sx = (digTipTarget.x - vue.camX) * vue.ZOOM, sy = (treasureY(digTipTarget) - vue.camY) * vue.ZOOM;
  var half = digTipEl.offsetWidth / 2;
  digTipEl.style.left = Math.max(half + 8, Math.min(vue.W * vue.ZOOM - half - 8, sx)) + 'px';
  digTipEl.style.top = Math.max(digTipEl.offsetHeight + 8, sy - 26) + 'px';
}

export function positionTreasureOverlays() {
  // Un seul repere a la fois : celui du tresor enfoui le plus pres du centre de l'ecran.
  var hintT = null, hintD = vue.W / 2 + 20;
  for (var h = 0; h < partie.treasures.length; h++) {
    var dh = Math.abs(partie.treasures[h].x - vue.camX - vue.W / 2);
    if (!partie.treasures[h].revealed && dh < hintD) { hintD = dh; hintT = partie.treasures[h]; }
  }
  for (var i = 0; i < partie.treasures.length; i++) {
    var t = partie.treasures[i];
    var screenX = t.x - vue.camX;
    if (!t.revealed) {
      // Toujours signale des qu'il est dans la vue, meme enfoui (il ne se creuse que
      // quand treasureReachable, voir tryDig).
      var sy = treasureY(t) - vue.camY;
      var show = t.ready && sy > -20 && sy < vue.H + 20 && screenX > -20 && screenX < vue.W + 20;
      t.glint.classList.toggle('is-visible', show);
      t.glint.style.left = screenX * vue.ZOOM + 'px';
      t.glint.style.top = (sy * vue.ZOOM - 2) + 'px';
      if (t.hint) {
        // A la surface (ou sur le tresor si on a creuse plus bas que lui). Cache pendant le
        // tutoriel du mycelium, comme la boussole : il detournerait l'attention.
        var hy = Math.min(sy, surfaceAt(t.x) - vue.camY);
        t.hint.classList.toggle('is-visible', t === hintT && t.ready && hy * vue.ZOOM > 30 && hy < vue.H + 20 && screenX > -20 && screenX < vue.W + 20 && !(partie.unlockedStrains.length && guideCurrent()));
        t.hint.style.left = screenX * vue.ZOOM + 'px';
        t.hint.style.top = (hy * vue.ZOOM - 34) + 'px';
      }
      continue;
    }
    if (t.sparks) {
      var ny = nuggetY(t) - vue.camY, nsx = t.nx - vue.camX, nr = t.nugget.r;
      t.sparks[0].style.left = (nsx - nr * 0.35) * vue.ZOOM + 'px';
      t.sparks[0].style.top = (ny - nr * 0.7) * vue.ZOOM + 'px';
      t.sparks[1].style.left = (nsx + nr * 0.5) * vue.ZOOM + 'px';
      t.sparks[1].style.top = (ny - nr * 0.2) * vue.ZOOM + 'px';
    }
    if (!t.tip) continue;
    positionTipOverMushroom(t.tip, t.mushroom);
    // Champignon sorti de l'ecran : la bulle s'efface graduellement, puis se ferme.
    var farX = t.mushroom.x - vue.camX, off = farX < 0 ? -farX : farX > vue.W ? farX - vue.W : 0, fade = 1 - off / (vue.W * 0.12);
    if (t.tip.classList.contains('is-open') && off > 0) {
      // Filet de securite : hors ecran depuis 2,5 s, elle se ferme meme si la distance ne suffit pas (bord du monde).
      if (!t.farSince) t.farSince = performance.now();
      if (fade <= 0 || performance.now() - t.farSince > 2500) { openTip(null); t.tip.style.opacity = ''; t.farSince = 0; }
      else t.tip.style.opacity = Math.min(fade, 1 - (performance.now() - t.farSince) / 2500).toFixed(2);
    } else { t.tip.style.opacity = ''; t.farSince = 0; }
  }
  if (monde.mycTip && monde.mycTipMushroom) positionTipOverMushroom(monde.mycTip, monde.mycTipMushroom);
  positionDigTip();
  updateCompass();
}
