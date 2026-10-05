// Jeu du logo (accueil) : point d'entree, charge par amorce.js. Lance le demarrage de chaque module.
import { initEtat } from './etat.js';
import { initTerrain } from './terrain.js';
import { initSauvegarde } from './sauvegarde.js';
import { initArbres } from './arbres.js';
import { initOutils } from './outils.js';
import { initTresors, initTresorsUI } from './tresors.js';
import { initMessages } from './messages.js';
import { initDefis } from './defis.js';
import { initTutoriel } from './tutoriel.js';
import { initDebug } from './debug.js';
import { initPhysique } from './physique.js';
import { initEvenements } from './evenements.js';

// Appeles par amorce.js : le clic et l'appui maintenu sur le logo y sont geres.
export { lancer, peutLancer } from './evenements.js';

// Demarrage : meme ordre a chaque etape du decoupage.
initEtat();
initMessages();
initDefis();
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
