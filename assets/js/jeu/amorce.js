// Amorce du jeu du logo (accueil) : le badge "play" et l'appui maintenu vivent ici, pour repondre
// tout de suite. Le jeu lui-meme (principal.js et ses modules) n'est charge qu'au repos du
// navigateur ou au premier geste, et seulement s'il peut tourner.
var container = document.getElementById('logo-explosion');
var canvas = container && container.querySelector('#logo-explosion-canvas');
var fallbackImg = container && container.querySelector('#logo-explosion-fallback');
// Mouvement reduit : le wordmark statique (deja dans le DOM) reste affiche, canvas jamais active.
var prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Au doigt, un simple tap ne lance pas le jeu (trop facile a declencher en faisant
// defiler la page) : il faut maintenir HOLD_MS, pendant que l'anneau du badge "play"
// se remplit (.is-holding dans jeu.css). La souris garde le clic simple.
var HOLD_MS = 800;
var HOLD_HINT_MS = 2000;     // duree du mot "Maintenez" apres un tap trop court
var HOLD_FOLLOW_EASE = 0.4;  // lissage du badge qui suit le doigt (voir stepMagnet)
var HOLD_LIFT = 60;          // px, le badge se tient au-dessus du doigt pour rester visible
var MAGNET_MAX = 80;         // px, decalage max du badge
var MAGNET_EASE = 0.09;      // lissage du suivi (pas de saut brusque)

if (canvas && fallbackImg && !prefersReducedMotion && canvas.getAttribute('data-logo-url')) amorcer();

function amorcer() {
  // --- Chargement du jeu -------------------------------------------------------------
  var jeu = null, chargement = null;
  function chargerJeu() {
    if (!chargement) {
      chargement = import('./principal.js').then(
        function (m) { jeu = m; return m; },
        function (err) { chargement = null; throw err; } // reseau coupe : le prochain geste reessaie
      );
    }
    return chargement;
  }
  // Lance le jeu depuis un point de l'ecran. Jeu pas encore charge (connexion lente) : il part
  // des qu'il l'est, et l'anneau du badge tourne en attendant (.is-loading dans jeu.css).
  var enAttente = false;
  function finAttente() {
    enAttente = false;
    if (holdWrap) holdWrap.classList.remove('is-loading');
  }
  function lancer(clientX, clientY) {
    if (enAttente) return; // deja demande : un seul depart, quand le jeu sera charge
    if (!jeu) {
      enAttente = true;
      if (holdWrap) holdWrap.classList.add('is-loading');
    }
    chargerJeu().then(
      function (m) { finAttente(); m.lancer(clientX, clientY); },
      finAttente // reseau coupe : l'anneau s'arrete, le prochain geste reessaie
    );
  }

  var GESTES = ['pointerdown', 'pointermove', 'keydown'];
  function auPremierGeste() {
    GESTES.forEach(function (n) { window.removeEventListener(n, auPremierGeste, true); });
    chargerJeu();
  }
  GESTES.forEach(function (n) { window.addEventListener(n, auPremierGeste, true); });
  // Sans geste : une fois la page chargee, quand le navigateur n'a plus rien a faire.
  function auRepos() {
    if ('requestIdleCallback' in window) requestIdleCallback(function () { chargerJeu(); }, { timeout: 3000 });
    else setTimeout(chargerJeu, 300);
  }
  if (document.readyState === 'complete') auRepos();
  else window.addEventListener('load', auRepos);

  // --- Badge "play" ------------------------------------------------------------------
  // Effet magnetique du badge "play" : des qu'on bouge la souris sur la page, le badge
  // se decale vers le curseur (jusqu'a MAGNET_MAX). Purement decoratif : pilote --mx/--my
  // lus par le transform CSS du badge. Le hover/curseur reel est gere par la zone fixe
  // autour de lui (.logo-explosion-play-zone dans jeu.css), pas par le badge lui-meme
  // qui bouge — sinon le :hover papillote pendant qu'il se deplace.
  var playBadge = document.querySelector('.logo-explosion-play-badge');
  var holdWrap = document.getElementById('logo-explosion-fallback-wrap');
  var holdTimer = null, holdHintTimer = null, holdTouch = false;
  var magnetTx = 0, magnetTy = 0, magnetCx = 0, magnetCy = 0, magnetOn = false;

  // La boucle ne tourne que le temps de rejoindre sa cible : wakeMagnet() la relance a chaque
  // changement de cible, elle s'arrete seule une fois le badge arrive. Au repos, --mx/--my
  // valent 0px par defaut dans jeu.css.
  function stepMagnet() {
    var ease = holdTimer ? HOLD_FOLLOW_EASE : MAGNET_EASE; // au doigt : colle de pres
    magnetCx += (magnetTx - magnetCx) * ease;
    magnetCy += (magnetTy - magnetCy) * ease;
    var arrived = !holdTimer && Math.abs(magnetTx - magnetCx) < 0.01 && Math.abs(magnetTy - magnetCy) < 0.01;
    if (arrived) { magnetCx = magnetTx; magnetCy = magnetTy; }
    playBadge.style.setProperty('--mx', magnetCx.toFixed(2) + 'px');
    playBadge.style.setProperty('--my', magnetCy.toFixed(2) + 'px');
    if (arrived) { magnetOn = false; return; }
    requestAnimationFrame(stepMagnet);
  }
  function wakeMagnet() {
    if (!playBadge || magnetOn || (magnetCx === magnetTx && magnetCy === magnetTy)) return;
    magnetOn = true;
    requestAnimationFrame(stepMagnet);
  }

  if (playBadge) {
    var badgeZone = playBadge.parentElement;

    // pointermove filtre sur la souris, pas mousemove : apres un tap, le navigateur envoie
    // un faux mousemove qui laisserait le badge decale vers l'endroit touche.
    document.addEventListener('pointermove', function (evt) {
      if (evt.pointerType !== 'mouse') return;
      var zr = badgeZone.getBoundingClientRect();
      // Badge invisible (jeu lance : le logo est en d-none, ou page defilee plus bas) : rien a animer.
      if (!zr.width || zr.bottom < 0 || zr.top > window.innerHeight) { magnetTx = 0; magnetTy = 0; wakeMagnet(); return; }
      var bx = zr.left + zr.width / 2, by = zr.top + zr.height / 2;
      var dx = evt.clientX - bx, dy = evt.clientY - by;
      var dist = Math.hypot(dx, dy);
      var radius = Math.max(window.innerWidth, 900); // couvre toute la largeur de l'ecran
      if (dist > radius) { magnetTx = 0; magnetTy = 0; wakeMagnet(); return; }
      // Vise la position reelle du curseur, bornee a MAGNET_MAX.
      var k = dist > MAGNET_MAX ? MAGNET_MAX / dist : 1;
      magnetTx = dx * k; magnetTy = dy * k;
      wakeMagnet();
    });
    document.addEventListener('mouseleave', function () { magnetTx = 0; magnetTy = 0; wakeMagnet(); });
  }

  // --- Lancement : clic a la souris, appui maintenu au doigt --------------------------
  function cancelHold() {
    clearTimeout(holdTimer);
    holdTimer = null;
    holdWrap.classList.remove('is-holding');
    if (holdTouch) { magnetTx = 0; magnetTy = 0; wakeMagnet(); } // le badge retourne a sa place
  }
  // Le badge vient sous le doigt et le suit : reutilise --mx/--my du magnetisme souris,
  // sans la borne MAGNET_MAX (le doigt peut etre sur le logo, loin de la zone du badge).
  function holdFollow(evt) {
    if (!playBadge) return;
    var zr = playBadge.parentElement.getBoundingClientRect();
    magnetTx = evt.clientX - (zr.left + zr.width / 2);
    magnetTy = evt.clientY - (zr.top + zr.height / 2) - HOLD_LIFT;
    wakeMagnet();
  }
  if (holdWrap) {
    // Seul un clic sur le logo (ou sa zone "play" juste en dessous) lance le jeu, pas le vide
    // autour : cela correspond au curseur special affiche uniquement au-dessus du logo.
    holdWrap.addEventListener('click', function (evt) {
      if (holdTouch) return; // au doigt : appui maintenu, voir plus bas
      lancer(evt.clientX, evt.clientY);
    });
    holdWrap.style.setProperty('--hold-ms', HOLD_MS + 'ms');
    holdWrap.addEventListener('pointerdown', function (evt) {
      holdTouch = evt.pointerType !== 'mouse';
      if (!holdTouch || (jeu && !jeu.peutLancer())) return;
      var x = evt.clientX, y = evt.clientY;
      cancelHold();
      clearTimeout(holdHintTimer);
      holdWrap.classList.remove('is-hint');
      holdWrap.classList.add('is-holding');
      holdFollow(evt);
      holdTimer = setTimeout(function () {
        cancelHold();
        lancer(x, y);
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
}
