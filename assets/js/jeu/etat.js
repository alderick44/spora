// Etat partage du jeu : elements du DOM, zoom, et les objets modifies par plusieurs modules.
import { DEMO_KEY, ZOOM_MAX_W } from './config.js';

export var container = document.getElementById('logo-explosion');
export var DEMO_PAGE = container.classList.contains('is-demo');

export var canvas = container.querySelector('#logo-explosion-canvas');
export var fallbackImg = container.querySelector('#logo-explosion-fallback');
export var rebuildBtn = document.getElementById('logo-explosion-rebuild');
export var debugToggleBtn = document.getElementById('logo-explosion-debug-toggle');
export var debugPanel = document.getElementById('logo-explosion-debug-panel');
export var fullscreenBtn = document.getElementById('logo-explosion-fullscreen');
export var scrollLeftBtn = document.getElementById('logo-explosion-scroll-left');
export var scrollRightBtn = document.getElementById('logo-explosion-scroll-right');
export var scrollUpBtn = document.getElementById('logo-explosion-scroll-up');
export var scrollDownBtn = document.getElementById('logo-explosion-scroll-down');
export var toolsBar = document.getElementById('logo-explosion-tools');
export var toolBtns = toolsBar ? toolsBar.querySelectorAll('[data-tool]') : [];
export var speedWrap = document.getElementById('logo-explosion-speed-wrap');
export var speedInput = document.getElementById('logo-explosion-speed');
export var speedVal = document.getElementById('logo-explosion-speed-val');
export var rainInput = document.getElementById('logo-explosion-rain');
export var droughtInput = document.getElementById('logo-explosion-drought');
export var droughtIndicator = document.getElementById('logo-explosion-drought-indicator');
export var stormInput = document.getElementById('logo-explosion-storm');
export var stormIndicator = document.getElementById('logo-explosion-storm-indicator');
export var caption = document.getElementById('logo-explosion-caption');
// Essai mobile ($spora_tip_shelf dans front-page.php) : sur ecran etroit, la carte du tresor
// selectionne se range dans cette boite, sous le bouton de la boutique (voir openTip).
export var shelfEl = document.getElementById('logo-explosion-shelf');
export var shelfMq = shelfEl && window.matchMedia ? window.matchMedia('(max-width: 767.98px)') : null;
export var speedBtn = document.getElementById('logo-explosion-speed-btn');
export var toolsArrow = document.getElementById('logo-explosion-tools-arrow');
export var moneyEl = document.getElementById('logo-explosion-money');
export var moneyVal = document.getElementById('logo-explosion-money-val');
export var treasureCountEl = document.getElementById('logo-explosion-treasures');
export var strainsBar = document.getElementById('logo-explosion-strains');

export var logoUrl = canvas.getAttribute('data-logo-url');

export var ctx = canvas.getContext('2d');
export var dpr = Math.min(window.devicePixelRatio || 1, 2);
export var isMobile = window.innerWidth < 768;

// Zoom arriere sur ecran etroit : tout se dessine a MOBILE_ZOOM de sa taille, donc on voit
// environ 1/MOBILE_ZOOM fois plus de monde. Le jeu raisonne en px LOGIQUES : W/H = la fenetre
// visible (CSS / ZOOM), U = l'unite de taille des objets (hauteur CSS de la boite). A
// 768 px et plus, ZOOM vaut exactement 1 : W/H = taille CSS, U = H, RS = dpr (rien ne change).
// ?zoom=0.4 dans l'URL remplace MOBILE_ZOOM (essais, borne entre 0.3 et 1).
var MOBILE_ZOOM = 0.55;                 // le reglage : plus petit = plus de monde visible, objets plus petits
var zoomParam = /[?&]zoom=([0-9.]+)/.exec(window.location.search);
export function updateZoom() {
  vue.ZOOM = container.getBoundingClientRect().width < ZOOM_MAX_W ? MOBILE_ZOOM : 1;
  vue.RS = dpr * vue.ZOOM;
}

// Progression et drapeaux de la partie en cours.
export var partie = {
  DEMO: DEMO_PAGE,
  leachTipSeen: 0,            // bit 1 = lessivage, 2 = retenue, 4 = mort de faim, 8 = mort de secheresse, 16 = gazon arrache (persistant ; masque de restauration = 31)
  tipOpen: false,
  tipChangeAt: -1e9,
  factShown: -1,
  branchTorn: false,          // une branche a ete arrachee a la main (non persiste)
  factSeen: 0,                // bit i = saviez-vous FACTS[i] deja vu (persistant)
  explodedAt: 0,
  harvestCount: 0,
  fertDropped: false,
  pleuroteDug: false,
  patches: {},
  chHarv: [0, 0, 0],
  freeTrees: 0,
  chDone: 0,
  chPlanted: 0,
  chPending: [],
  chHoldSince: [0, 0, 0],
  tool: 'hand',                  // 'hand' | 'mycelium' | 'tree' | 'fertilizer' | 'grass'
  money: 0,
  moneyRevealed: false,
  usedFreeBag: false,
  bagGrainsLeft: 0,
  goldBits: [],                      // eclats en vol : {x, y, vx, vy, rot, vr, r, c, life}
  // "Tresors" enfouis dans le tas : un champignon + une infobulle (produit, conseil...).
  // x = position en fraction de la LARGEUR DU MONDE ; species = index dans SPECIES.
  treasureDefs: [],
  unlockedStrains: [],
  bagStrain: 'standard',
  treasures: [],
  mode: 'assembled',                 // 'assembled' | 'exploded' | 'rebuilding'
  imgReady: false,
  worldSig: null,
  worldSigPrev: null,
  worldSaveOff: false,
  restoredFound: [],   // titres deterres lus dans la sauvegarde, consommes par setupTreasures
  foundFx: {},         // titre -> position x (fraction de worldW) des tresors deterres : ils reviennent la ou ils etaient
  skippedFound: [],    // titres ecartes de la generation du monde en cours (deja deterres)
  restoredTrees: null,   // arbres lus dans la sauvegarde, consommes par explode()
  // Aide au placement du mycelium : tant que le visiteur n'a pas nourri un mycelium avec du bois
  // (mycFedOnce, voir stepTrees), un halo marque le pied des arbres matures et la fleche du
  // menu d'outils reste affichee.
  mycFedOnce: undefined,
  tipHoldUntil: 0,
  digTipHover: false,
  debugBuilt: false
};

// Fenetre visible, camera et pointeur.
export var vue = {
  ZOOM: 1,                 // RS : echelle de rendu du canvas (dpr x ZOOM)
  RS: dpr,
  camGoal: null,
  worldW: 0,
  camMargin: 0,
  camX: 0,
  worldH: 0,
  camY: 0,
  hoverScreenX: null, // position souris (coord. ecran), pour le defilement aux bords
  hoverScreenY: null,
  edgeTouch: false,                  // hoverScreenX/Y viennent d'un doigt appuye qui glisse, pas d'une souris
  mobileArrow: 0,                    // -1/0/1 : fleches tactiles mobiles maintenues (horizontal)
  mobileArrowY: 0,                   // -1/0/1 : fleches tactiles mobiles maintenues (vertical)
  // W/H : fenetre visible en px logiques. U/UW : unite de taille (hauteur/largeur CSS de la
  // boite, en px logiques) pour tout ce qui ne doit pas changer quand la fenetre s'agrandit.
  W: 0,
  H: 0,
  U: 0,
  UW: 0,
  groundY: 0,
  rafId: null,
  pointerDown: null,
  dragMoved: false,
  handCarry: [],
  heldSX: 0,              // position ecran du pointeur (le monde peut defiler)
  heldSY: 0,
  // Tresor deterre saisi a la main : son champignon, sa pepite et sa bulle suivent le curseur.
  treasureGrab: null,
  // Pointer events : meme code pour souris, doigt et stylet.
  // Souris : la pelle suit le survol, bouton maintenu = elle ralentit (mode precis). Le
  // survol pres des bords de la boite fait aussi defiler le monde (voir cameraSpeed).
  // Doigt : le bol suit le doigt, doigt leve = il se vide puis disparait. Deux facons de
  // defiler : les fleches tactiles, ou amener l'outil tenu pres d'un bord (edgeTouch,
  // voir cameraSpeed).
  pressCaught: false
};

// Contenu du monde : sol, mycelium, arbres, flore, faune.
export var monde = {
  colonised: [],
  fruited: {},
  // Mycelium mort de secheresse (voir stepMycelium) : contrairement a la necromasse de faim
  // (immediate, voir MYC_STARVE_MS), il reste visible tel quel — ni vivant ni nutriment —
  // jusqu'a une decomposition par l'humidite (voir decomposeDeadMyc, uniquement pendant la
  // pluie). Etape 2 (pas encore faite) : sous une pluie trop longue il pourrait plutot se
  // faire contaminer, et la contamination pourrait s'en prendre a un mycelium vivant affaibli
  // a proximite.
  deadMyc: [],
  grassLost: 0,    // pas de conseil avant grassTipFrom (ms) : la chute du logo dans la terre n est pas de l arrachage
  grassTipFrom: 0,
  grassCover: null,
  grassPrevH: null,
  grassMyc: null,
  grassLastNow: null,
  grassNutriAt: 0,
  floraLush: null,
  floraTarget: null,
  insects: [],
  insectNextAt: null,
  insectLastT: null,
  trees: [],
  litter: [],
  treeLife: false,
  tintedMyc: false,                  // vrai des qu'une facette de souche non standard est colonisee (sinon drawHyphae garde son trait unique)
  // Bulle produit sur le premier champignon issu du mycelium verse (pas un tresor : pas
  // de def.x/species, juste une infobulle qui suit ce champignon-la). Voir sprout().
  mycTip: null,
  mycTipMushroom: null,
  shards: [],
  heights: [],
  mushrooms: [],
  // compactY[c] est le sommet (y monde) de la couche compacte a la colonne c : ne peut que
  // descendre (la pelle la decompacte, voir cutCompact), jamais remonter au-dessus du
  // niveau d'origine (groundY). heights[c] reste l'epaisseur de terre MEUBLE posee dessus
  // (son plancher a 0 ne bouge pas, voir pileAdd) ; la surface reelle d'une colonne est
  // donc compactY[c] - heights[c] (voir surfaceAt).
  compactY: [],
  // Colonnes de roche-mere (voir buildRockyPatches) : un vrai bloc, souleve dans compactY,
  // que la pelle ne peut pas creuser (cutCompact). Ni mycelium, ni gazon, ni arbre ne s'y
  // installent tant qu'elle est exposee ; l'enterrer sous assez de terre (ROCK_COVER_MIN)
  // la rend a nouveau fertile.
  rocky: [],
  // Lacs : une entree par cuvette rocheuse (voir buildRockyPatches) {p0,p1 (plaque entiere,
  // capte la pluie), c0,c1 (de bord a bord de la cuvette, la ou l'eau tient), vol (px2 d'eau),
  // level (y monde de la surface de l'eau, Infinity = vide)}. lakeOf[c] = index+1 du lac dont
  // la plaque couvre la colonne c (0 = aucun). Le niveau se deduit du volume a chaque frame
  // (voir updateLakes), donc suit la terre meuble ajoutee/enlevee dans la cuvette.
  lakes: [],
  lakeOf: [],
  lakeLastT: null,
  // Depots d'humus lessives jusque dans la couche compacte (voir leach()) : chacun
  // {x, y, color}, y en coord. MONDE. Distinct de shards (facettes) pour rester leger :
  // ils ne participent a aucune physique, juste a un lent enfoncement pendant la pluie.
  compactNutri: [],
  soilRiseT: 1,       // soilRiseT < 1 : le lit est en train de monter
  soilDepth: 0,
  drops: [],
  nextLeachAt: 0,
  heldInsect: null                   // un seul papillon tenu a la fois
};

// Horloge virtuelle et niveaux regles par les curseurs.
export var temps = {
  grassNutriMult: 1,                 // multiplicateur de production de nutriments du gazon ordinaire (1 = normal, 0 = aucun)
  grassMycNutriMult: 1,              // idem pour le gazon long avec champignons (grassMyc)
  frame: 0,
  // Horloge virtuelle : tout le "temps reel" (ms) du cycle bois/mycelium/arbres (litiere,
  // faim du mycelium, pousse des feuilles...) passe par vTime plutot que
  // performance.now() directement, pour pouvoir l'accelerer avec le slider de debug
  // (#logo-explosion-speed) sans toucher a la physique image par image (gravite, pelle).
  timeScale: 1,
  vTime: 0,
  rainLevel: 0.3,                    // 0..1, lu depuis le curseur Pluie ; 0 = ne pleut jamais
  droughtLevel: 0.3,                 // 0..1, lu depuis le curseur Secheresse ; 0 = ne seche jamais
  stormLevel: 0.2                   // 0..1, lu depuis le curseur Tempetes ; 0 = jamais de tempete
};

// Demarrage du module : appele une seule fois par principal.js, dans un ordre fixe.
export function initEtat() {
  try { if (partie.DEMO && localStorage.getItem(DEMO_KEY)) { partie.DEMO = false; container.classList.remove('is-demo'); } } catch (e) { /* stockage indisponible */ }
  if (zoomParam && isFinite(parseFloat(zoomParam[1]))) MOBILE_ZOOM = Math.max(0.3, Math.min(1, parseFloat(zoomParam[1])));
  updateZoom();
}
