// Amorce du jeu du logo (accueil) : ne charge le jeu que s'il peut tourner.
var container = document.getElementById('logo-explosion');
var canvas = container && container.querySelector('#logo-explosion-canvas');
var fallbackImg = container && container.querySelector('#logo-explosion-fallback');
// Mouvement reduit : le wordmark statique (deja dans le DOM) reste affiche, canvas jamais active.
var prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (canvas && fallbackImg && !prefersReducedMotion && canvas.getAttribute('data-logo-url')) {
  import('./principal.js');
}
