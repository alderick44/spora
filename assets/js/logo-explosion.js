(function () {
  'use strict';

  var container = document.getElementById('logo-explosion');
  if (!container) return;

  var canvas = container.querySelector('#logo-explosion-canvas');
  var fallbackImg = container.querySelector('#logo-explosion-fallback');
  var rebuildBtn = document.getElementById('logo-explosion-rebuild');
  var headerToggleBtn = document.getElementById('logo-explosion-header-toggle');
  var debugToggleBtn = document.getElementById('logo-explosion-debug-toggle');
  var debugPanel = document.getElementById('logo-explosion-debug-panel');
  var fullscreenBtn = document.getElementById('logo-explosion-fullscreen');
  var scrollLeftBtn = document.getElementById('logo-explosion-scroll-left');
  var scrollRightBtn = document.getElementById('logo-explosion-scroll-right');
  var scrollUpBtn = document.getElementById('logo-explosion-scroll-up');
  var scrollDownBtn = document.getElementById('logo-explosion-scroll-down');
  var toolsBar = document.getElementById('logo-explosion-tools');
  var toolBtns = toolsBar ? toolsBar.querySelectorAll('[data-tool]') : [];
  var speedWrap = document.getElementById('logo-explosion-speed-wrap');
  var speedInput = document.getElementById('logo-explosion-speed');
  var speedVal = document.getElementById('logo-explosion-speed-val');
  var rainInput = document.getElementById('logo-explosion-rain');
  var droughtInput = document.getElementById('logo-explosion-drought');
  var droughtIndicator = document.getElementById('logo-explosion-drought-indicator');
  var stormInput = document.getElementById('logo-explosion-storm');
  var stormIndicator = document.getElementById('logo-explosion-storm-indicator');
  var caption = document.getElementById('logo-explosion-caption');
  var moneyEl = document.getElementById('logo-explosion-money');
  var moneyVal = document.getElementById('logo-explosion-money-val');
  if (!canvas || !fallbackImg) return;

  var prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    return; // le wordmark statique (deja dans le DOM) reste affiche, canvas jamais active
  }

  var logoUrl = canvas.getAttribute('data-logo-url');
  if (!logoUrl) return;

  var ctx = canvas.getContext('2d');
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var isMobile = window.innerWidth < 768;

  // Legende sous la boite : indique quoi faire puis ce qui se passe, mise a jour aux
  // moments cles (image prete, explosion, premier champignon issu du mycelium, rebuild).
  var CAPTION_BEFORE = isMobile ? 'Touchez le logo' : '';
  var CAPTION_EXPLODED = 'Creusez avec la pelle pour trouver les trésors, ou versez du mycélium.';
  var CAPTION_MYC = 'Le mycélium transforme le bois mort en sol vivant, et nourrit les arbres.';
  var CAPTION_NEED_MONEY = 'Il faut 20 $ pour un sac de mycélium — récoltez des champignons à la main.';
  var CAPTION_BAG_EMPTY = 'Sac vide : encore 20 $ pour un nouveau sac.';
  function setCaption(text) { if (caption) caption.textContent = text; }

  // Effet magnetique du badge "play" : des qu'on bouge la souris sur la page, le badge
  // se decale vers le curseur (jusqu'a MAGNET_MAX). Purement decoratif : pilote --mx/--my
  // lus par le transform CSS du badge. Le hover/curseur reel est gere par la zone fixe
  // autour de lui (.logo-explosion-play-zone dans style.css), pas par le badge lui-meme
  // qui bouge — sinon le :hover papillote pendant qu'il se deplace.
  var playBadge = document.querySelector('.logo-explosion-play-badge');
  if (playBadge) {
    var MAGNET_MAX = 80;     // px, decalage max du badge
    var MAGNET_EASE = 0.09;  // lissage du suivi (pas de saut brusque)
    var magnetTx = 0, magnetTy = 0, magnetCx = 0, magnetCy = 0;
    var badgeZone = playBadge.parentElement;

    document.addEventListener('mousemove', function (evt) {
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
      magnetCx += (magnetTx - magnetCx) * MAGNET_EASE;
      magnetCy += (magnetTy - magnetCy) * MAGNET_EASE;
      playBadge.style.setProperty('--mx', magnetCx.toFixed(2) + 'px');
      playBadge.style.setProperty('--my', magnetCy.toFixed(2) + 'px');
      requestAnimationFrame(stepMagnet);
    })();
  }

  // Style low-poly : uniquement des triangles a couleur pleine (pas de degrade,
  // pas de flou). La variation de ton d'une facette a l'autre suffit a donner du relief.
  var CELLS_ACROSS = 110;                 // nb de facettes sur la largeur du logo
  var GRAVITY = 0.32;
  var AIR = 0.992;
  var WIND_STRENGTH = 0.45;                // multiplicateur des rafales sur les feuilles qui tombent (voir "Vent" dans step())
  var COL_W = 6;                          // resolution de la carte de hauteurs du tas
  var EARTH = ['#6b4a30', '#7c5a3a', '#5a3d28', '#8a6239', '#4f3622'];
  var SOIL = ['#5a3d28', '#6b4a30', '#4a3220'];
  var ROCK = ['#8c8c86', '#7a7a74', '#9a9a92', '#6d6d66'];   // roche-mere affleurante : rien n'y pousse (voir "rocky")
  var ROCK_PATCH_MIN = 2, ROCK_PATCH_MAX = 4;                // nb de plaques rocheuses par monde
  var ROCK_PATCH_COLS_MIN = 10, ROCK_PATCH_COLS_MAX = 26;    // largeur d'une plaque, en colonnes (COL_W px chacune)
  var ROCK_COVER_MIN = 18;                // epaisseur de terre meuble (px) qui suffit a enterrer la roche : au-dela, on peut a nouveau y faire pousser quelque chose
  var ROCK_H_MIN = 0.06, ROCK_H_MAX = 0.13; // hauteur d'un rocher (x hauteur de la boite H) : bien au-dessus du sol, pas un simple caillou
  var BEDROCK_MARGIN = 40;                // marge (px) avant le fond du monde ou plus rien n'apparait (roche-mere)
  var SPECIES = [
    { cap: '#9a948c', gill: '#d9d2c5' },  // pleurote gris
    { cap: '#e58a9b', gill: '#f6c9d1' },  // pleurote rose
    { cap: '#f1e6d2', gill: '#ffffff' },  // hydne herisson
    { cap: '#c9a27a', gill: '#efdcc2' },  // pleurote huitre
    { cap: '#8a5a3b', gill: '#e4cfb2' }   // shiitake
  ];
  var MAX_MUSHROOMS = 36;
  var MUSHROOM_STARVE_MS = 10000;         // un champignon issu du mycelium (pas plante a la main) fane sans mycelium a portee pendant ce temps

  // Mycelium en vrac : le sac verse des grains qui inoculent les facettes ou ils tombent.
  // Une facette colonisee blanchit peu a peu et gagne ses voisines, lentement ; quand
  // assez de surface est blanche a un endroit, des champignons y sortent.
  var MYC = [243, 238, 226];              // blanc du mycelium
  var GRAIN = ['#f3eee2', '#e8dfcc', '#fbf8f0', '#d9cdb3'];
  var MYC_DEAD = ['#cfc3a1', '#c3b78f', '#d8cdb0']; // mycelium mort de secheresse : paille delavee, ni le blanc du vivant ni le noir de l'humus
  var MYC_GROW = 0.005;                   // blanchiment d'une facette par frame (~3 s pour etre pleine)
  var MYC_READY = 0.45;                   // seuil a partir duquel une facette gagne ses voisines
  var MYC_SPREAD_EVERY = 8;               // la propagation se calcule toutes les N frames
  var MYC_SPREAD_P = 1;                   // chance, par passage, de gagner une voisine
  var MYC_RADIUS = 0.4;                   // portee max depuis le point d'inoculation (x hauteur)
  var FRUIT_W = 0.22;                     // largeur d'une zone de fructification (x hauteur)
  var HYPHA_COLOR = '#fbf8f0';            // filaments du mycelium vivant (par-dessus le blanchiment des facettes)
  var HYPHA_DEAD_COLOR = '#d8cdb0';       // filaments du mycelium mort de secheresse (paille, casses)
  var HYPHA_W = 1.1;                      // epaisseur des filaments (px)
  var HYPHA_MAX_LINK = 40;                // distance max (px) entre une facette et son origine (parent ou inoculation) pour tracer le filament
  var FRUIT_MIN = 6;                      // facettes de surface colonisees pour faire sortir une grappe
  // MYC_DECOMPOSE_REACH et MYC_STARVE_MS doivent rester coherents avec le rythme naturel
  // de chute des feuilles (LEAF_LIFE_MS, 25-45s) : une feuille tombee dure ~21s de
  // decomposition (LITTER_MS/MYC_DECOMPOSE_MULT), mais entre deux feuilles qui tombent au
  // MEME endroit il peut s'ecouler largement plus que ca (elles tombent un peu partout
  // sous le houppier). Un mycelium avec un rayon/delai de grace trop serres meurt de faim
  // entre deux arrivees de bois, meme si le systeme produit bien assez de bois au total.
  var MYC_DECOMPOSE_REACH = 90;           // portee (px) a laquelle le mycelium decompose du bois au sol (large : couvre tout le pied du houppier, pas juste un point)
  var MYC_DECOMPOSE_MULT = 14;            // vitesse de decomposition du bois pres du mycelium vs tout seul
  var MYC_STARVE_MS = 90000;              // sans bois a portee pendant ce temps, le mycelium s'eteint (au-dela de l'ecart naturel entre deux feuilles qui tombent, 25-45s)
  var MYC_DECAY = 0.006;                  // vitesse a laquelle un mycelium affame s'eteint (par frame)
  var MYC_ACTIVE_FEED_MS = 3000;          // fenetre "activement nourri" : au-dela, une facette peut encore survivre sur sa reserve mais ne colonise plus de terre neuve
  var MYC_HOLD_REACH = 200;               // portee (px) a laquelle un mycelium bien vivant retient l'humus contre le lessivage de la pluie
  // Duree max de cette retenue (voir heldByMycelium) : passe ce delai, l'humus lessive quand
  // meme. Sans ca, un mycelium tres actif (MYC_DECOMPOSE_MULT) decompose le bois bien plus
  // vite que les racines ne peuvent le manger (un nutriment a la fois, EAT_MS) ; comme la
  // pluie ne peut alors jamais l'evacuer vers la couche compacte, l'humus non mange
  // s'empile indefiniment (voir pileAdd) au lieu de circuler, et forme une butte qui ne
  // fait que grossir sans jamais aider l'arbre (deja plafonne a MATURE_NUTRIENTS).
  var MYC_HOLD_MAX_MS = 600000;
  // Mort aleatoire rare : meme bien nourri, un mycelium vivant peut mourir a l'occasion, pour
  // que le gros bloc ne soit pas permanent (la terre vivante meurt et repousse en circulation).
  // Verifiee a intervalle (pas a chaque frame), par facette : rare et etalee, jamais en masse.
  // La facette suit ensuite le meme chemin que la mort de faim (necromasse sur litiere, sinon terre).
  var MYC_RANDOM_DEATH_P = 0.002;         // chance, par verification et par facette, de mourir
  var MYC_RANDOM_DEATH_CHECK_MS = 2000;   // intervalle (vTime) entre deux verifications
  var mycNextDeathCheck = 0;
  var tool = 'shovel';                    // 'hand' | 'shovel' | 'mycelium' | 'tree' | 'fertilizer'
  var grassNutriMult = 1;                 // multiplicateur de production de nutriments du gazon ordinaire (1 = normal, 0 = aucun)
  var grassMycNutriMult = 1;              // idem pour le gazon long avec champignons (grassMyc)
  var fertLastAt = 0;                     // dernier depot de fertilisant (limite le rythme pendant un glissement)
  var FERT_COUNT = 3;                     // nutriments deposes par clic/pas de glissement
  var FERT_SPREAD = 10;                   // etalement horizontal (px) autour du point clique
  var FERT_MIN_MS = 90;                   // delai minimum entre deux depots pendant un glissement
  var colonised = [], fruited = {}, frame = 0, mycBusyUntil = 0;
  // Mycelium mort de secheresse (voir stepMycelium) : contrairement a la necromasse de faim
  // (immediate, voir MYC_STARVE_MS), il reste visible tel quel — ni vivant ni nutriment —
  // jusqu'a une decomposition par l'humidite (voir decomposeDeadMyc, uniquement pendant la
  // pluie). Etape 2 (pas encore faite) : sous une pluie trop longue il pourrait plutot se
  // faire contaminer, et la contamination pourrait s'en prendre a un mycelium vivant affaibli
  // a proximite.
  var deadMyc = [];

  // --- Gazon --------------------------------------------------------------------------
  // Couche de base independante du mycelium : une petite quantite de nutriment pousse
  // toute seule en surface, comme les herbes pionnieres qui colonisent un sol pauvre dans
  // la vraie vie (voir la discussion produit : le sol ne doit jamais rester totalement mort
  // meme sans mycelium). GRASS_NUTRI_P/GRASS_NUTRI_CHECK_MS sont volontairement tres bas :
  // ca doit juste empecher un arbre sans mycelium de deperir completement, jamais lui
  // donner une croissance comparable a un arbre bien colonise (qui reste beaucoup plus
  // rapide via MYC_DECOMPOSE_MULT + la retenue contre le lessivage, MYC_HOLD_REACH).
  // grassCover[c] (0..1, par colonne, meme indexation que heights/compactY) : 1 = touffe
  // pleine, 0 = terre remuee/nue. Demarre plein partout (couche initiale). Une colonne
  // remuee (pelle, effondrement...) ne repousse QUE si une colonne voisine est deja bien
  // gazonnee (propagation en surface uniquement, jamais en profondeur, jamais spontanee) :
  // un trou assez large pour n'avoir aucune voisine gazonnee reste nu pour de bon, jusqu'a
  // ce que la propagation l'atteigne depuis plus loin.
  var GRASS_COLOR = ['#6f9c4a', '#5c8a3f', '#82ad5b', '#537d3a'];
  var GRASS_MAX_H_F = 0.02;               // hauteur max d'un brin (x hauteur de la boite H)
  var GRASS_EMBED = 6;                    // enfoncement (px) sous surfaceAt : ancre les brins dans le terrain irregulier (comme drawMushroom)
  var GRASS_REGROW_MS = 60000;            // temps de base pour qu'une colonne voisine d'une zone gazonnee regagne sa pleine couverture
  var GRASS_SPREAD_BONUS = 3;             // multiplicateur de vitesse de cette repousse (appliquee uniquement quand une voisine est gazonnee)
  var GRASS_NEIGHBOR_MIN = 0.5;           // couverture voisine consideree "gazonnee" pour ce bonus
  // La pelle ne remue jamais une colonne d'un coup sec : chaque facette bougee ne change
  // heights[c] que d'un tout petit peu par frame (voir pileAdd/pileRemove). Comparer a la
  // hauteur de la frame precedente ne detecterait donc presque jamais un vrai coup de
  // pelle. grassPrevH suit plutot heights EN RETARD (GRASS_BASELINE_FOLLOW, comme
  // TREE_BY_FOLLOW pour le pied d'un arbre) : un creusage soutenu fait grandir l'ecart
  // frame apres frame jusqu'a depasser GRASS_DISTURB_EPS, meme si chaque pas est minuscule ;
  // une fois la pelle partie, la reference rattrape la nouvelle forme du sol sans redeclencher.
  var GRASS_BASELINE_FOLLOW = 0.05;
  var GRASS_DISTURB_EPS = COL_W * 0.6;    // ecart (px) entre heights et sa reference au-dela duquel la colonne est consideree remuee
  var GRASS_FRUIT_MIN = 0.55;             // couverture minimale avant qu'une colonne puisse produire un nutriment
  var GRASS_NUTRI_CHECK_MS = 5000;        // frequence a laquelle on tente de faire pousser un nutriment de gazon
  var GRASS_NUTRI_P = 0.72;               // chance, par tentative, qu'UNE colonne eligible en produise un (doublee deux fois)
  var GRASS_NUTRI_AREA = 10;              // aire (px^2) d'un nutriment de gazon : minuscule, pas une feuille
  // Symbiose visible : le gazon qui a du mycelium vivant juste en dessous pousse plus haut et
  // produit plus de nutriments — le sol vivant doit se voir profiter au gazon aussi, pas
  // seulement aux arbres. grassMyc[c] est recalcule periodiquement (pas a chaque frame, cf.
  // GRASS_MYC_CHECK_EVERY) : parcourir colonised pour chaque colonne a chaque frame serait
  // couteux pour un simple effet cosmetique + un leger bonus de production.
  var GRASS_MYC_REACH = 40;               // portee horizontale (px) a laquelle du mycelium sous une colonne compte comme "dessous"
  var GRASS_MYC_SURFACE_DEPTH = 18;       // le mycelium doit etre proche de la surface (comme DROUGHT_SURFACE_DEPTH) pour compter
  var GRASS_MYC_HEIGHT_MULT = 3.25;       // hauteur des brins multipliee par ceci si du mycelium est dessous
  var GRASS_MYC_NUTRI_WEIGHT = 2;         // poids dans le tirage au sort d'une colonne pour produire un nutriment (~2x plus probable)
  var GRASS_MYC_CHECK_EVERY = 20;         // frames entre deux recalculs de grassMyc (perf)
  var grassCover = null, grassPrevH = null, grassMyc = null, grassLastNow = null, grassNutriAt = 0;

  // --- Flore (cosmetique) --------------------------------------------------------------
  // Couche PUREMENT VISUELLE ajoutee par-dessus le gazon : mousse, touffes plus denses et
  // petit feuillage (fougeres/buissons) autour des arbres et au-dessus du mycelium. Aucune
  // incidence sur le jeu (pas de nutriments, pas d'effet sur les arbres/le mycelium) : juste
  // un indice que le sol cultive est vivant. floraLush[c] (0..1, meme indexation que
  // grassCover) est la densite actuellement dessinee ; floraTarget[c] est la densite visee,
  // recalculee peu souvent (voir updateGrass) selon la proximite d'un arbre bien nourri et/ou
  // de mycelium actif juste dessous. Jamais de Math.random() dans le dessin : les graines
  // viennent d'un hash stable de l'indice de colonne (floraHash), comme pour le gazon.
  var FLORA_TREE_R_MIN = 0.12, FLORA_TREE_R_MAX = 0.3; // portee d'un arbre (x hauteur H), selon sa croissance
  var FLORA_TREE_W = 0.9, FLORA_MYC_W = 0.75;          // poids arbre / mycelium dans la cible de densite
  var FLORA_SYMBIOSIS_BONUS = 0.25;                    // bonus quand arbre ET mycelium se superposent (vraie mycorhize)
  var FLORA_GROW_MS = 12000, FLORA_FADE_MS = 6000;     // vitesse de pousse / de fanage de floraLush vers sa cible
  var FLORA_EMBED = 4;                                 // enfoncement (px) sous surfaceAt, comme GRASS_EMBED
  var MOSS_COLOR = ['#4f7a34', '#5f8f3c', '#3f6a2c', '#6e9e45'];
  var MOSS_THICK = 14;                                  // epaisseur max (px) de la bande de mousse
  var FLORA_TUFT_H_F = 0.035;                          // hauteur max d'une touffe haute (x H)
  var FLORA_FERN_H_F = 0.11;                           // hauteur max d'une fougere (x H)
  var FLORA_BUSH_R_F = 0.042;                          // rayon max d'un petit buisson (x H)
  var floraLush = null, floraTarget = null;

  // Fleurs au pied des arbres : purement cosmetique, elles eclosent quand une branche bonus
  // apparait (voir spawnFlower, appele depuis stepTrees) et fanent quand cette branche tombe,
  // ou aussitot si la pelle remue leur colonne (voir stepFlowers). Une seule espece (anemone
  // des bois, blanc rose), soignee plutot que variee, cf. drawFlowers plus bas. Tout l'alea
  // (position, inclinaison, taille...) est tire une fois a la naissance et stocke sur la
  // fleur (f.*) : le dessin ne lit jamais Math.random(), comme pour le reste de la flore.
  // t.flowers vit sur l'arbre (voir makeTree) donc trees = [] (reset/rebuild) suffit a tout
  // effacer, aucune structure globale a vider en plus.
  var FLOWER_MAX_PER_TREE = 8;             // fleurs vivantes (non fanees) max par arbre
  var FLOWER_MIN_SPACING = 14;             // ecart minimal (px monde) entre deux fleurs, tous arbres confondus
  var FLOWER_BLOOM_MS = 2600;              // duree totale de l'eclosion (tige + bouton + corolle)
  var FLOWER_WILT_MS = 1800;               // duree de la fanaison une fois fletrie (branche tombee)
  var FLOWER_H_F = 0.07;                  // hauteur de la tige (x hauteur de la boite H)
  var FLOWER_R_F = 0.022;                  // rayon de la corolle grande ouverte (x H)

  // --- Insectes (cosmetique) ----------------------------------------------------------
  // Purement decoratif, comme les fleurs ci-dessus : papillons et bourdons qui traversent
  // tranquillement l'ecran d'un bord a l'autre, se posent parfois sur une fleur ouverte
  // puis repartent finir leur traversee. Aucune incidence sur le jeu. Tout l'alea de vol
  // (ondulation, phases, choix d'especes...) est tire a la creation de l'insecte et
  // stocke sur l'objet (voir spawnInsect) ; le dessin (drawInsect et ses helpers) ne lit
  // jamais Math.random(), seulement des phases qui avancent avec un temps REEL ecoule
  // (voir insectLastT/age dans stepInsects) — jamais vTime, qui est accelerable par le
  // slider de vitesse debug et rendrait les insectes agites a vitesse elevee.
  var INSECT_MAX = 3;                      // insectes simultanes max
  var INSECT_GAP_MIN_MS = 10000;           // attente min. entre deux apparitions (temps reel)
  var INSECT_GAP_MAX_MS = 28000;           // attente max. entre deux apparitions (temps reel)
  var INSECT_SPEED = 1;                    // multiplicateur global de vitesse
  var INSECT_SIZE_F = 0.012;               // taille (x hauteur de la boite H)
  var INSECT_LAND_P = 0.55;                // chance de viser une fleur ouverte visible, s'il y en a
  var insects = [];
  var insectNextAt = null, insectLastT = null;

  // --- Economie : recolter des champignons pour racheter du mycelium -----------------
  // Le tout premier sac est offert (sinon impossible de demarrer, avant toute vente) ;
  // les suivants coutent BAG_COST, payes des qu'on commence a verser (ensureBag). Le sac
  // contient un nombre fixe de grains plutot qu'une jauge de temps : ca tient compte du
  // rythme de versement du joueur, et reutilise le compteur de grains deja verses par
  // updateBag. ~950 grains, au rythme actuel (~1.5 grain/frame, 60 fps), durent 10-12s.
  var BAG_COST = 20;
  var BAG_GRAINS = 950;
  var MUSHROOM_PRICE = 8;                 // gain (recolte a la main) par champignon mur issu du mycelium
  var money = 0, moneyRevealed = false, usedFreeBag = false, bagGrainsLeft = 0;
  function updateMoneyUI() {
    if (moneyRevealed && moneyEl) moneyEl.classList.remove('d-none');
    if (moneyVal) moneyVal.textContent = money;
  }
  function earn(amount) {
    money += amount;
    moneyRevealed = true;
    updateMoneyUI();
  }
  // Assure qu'un sac est pret a verser : offre le tout premier, sinon facture BAG_COST
  // si les fonds le permettent. Retourne false (et ne change rien) si on ne peut pas payer.
  function ensureBag() {
    if (bagGrainsLeft > 0) return true;
    if (!usedFreeBag) { usedFreeBag = true; bagGrainsLeft = BAG_GRAINS; return true; }
    if (money < BAG_COST) return false;
    money -= BAG_COST;
    bagGrainsLeft = BAG_GRAINS;
    updateMoneyUI();
    return true;
  }

  // Horloge virtuelle : tout le "temps reel" (ms) du cycle bois/mycelium/arbres (litiere,
  // faim du mycelium, pousse des feuilles...) passe par vTime plutot que
  // performance.now() directement, pour pouvoir l'accelerer avec le slider de debug
  // (#logo-explosion-speed) sans toucher a la physique image par image (gravite, pelle).
  var timeScale = 1, vTime = 0, lastRealNow = null;
  var rainLevel = 0.3;                    // 0..1, lu depuis le curseur Pluie ; 0 = ne pleut jamais
  var droughtLevel = 0.3;                 // 0..1, lu depuis le curseur Secheresse ; 0 = ne seche jamais
  var stormLevel = 0.2;                   // 0..1, lu depuis le curseur Tempetes ; 0 = jamais de tempete

  // Cycle des nutriments : le mycelium decompose du BOIS (feuilles tombees, voir
  // MYC_DECOMPOSE_*) ou meurt de faim et devient lui-meme nutriment (necromasse) — jamais
  // la terre elle-meme, qui n'a pas de valeur nutritive en soi. Les racines d'un arbre
  // absorbent ce nutriment et en font une feuille, qui vieillit (vert tendre -> vert ->
  // jaune -> roux), tombe et redevient du bois a decomposer. Tout ce qui est lent ici se
  // mesure en temps reel (ms), pas en frames : quand il ne reste que ca a animer, la
  // boucle ralentit a quelques images par seconde.
  // La pluie n'est pas juste un bonus de vitesse, elle est necessaire au cycle : un
  // nutriment tout frais reste hors de portee des racines (MIN_LEACH_TO_EAT) tant que la
  // pluie ne l'a pas fait descendre d'au moins un cran vers le bas, colonne par colonne
  // (voir leach()), jusque dans la couche compacte (compactNutri) ou il s'enfonce ; le
  // mycelium bien vivant a proximite le retient (MYC_HOLD_REACH). La pelle qui decompacte
  // le ramene en surface, deja mur (cutCompact/spawnDecompactShard). Les racines ne
  // plongent de toute facon que jusqu'a une profondeur limitee (ROOT_DEPTH) : un arbre qui
  // n'a plus rien a portee finit par deperir (TREE_STARVE_MS/TREE_SHRINK_MS), et sans
  // pluie du tout (curseur a 0) le cycle s'arrete net. La pluie n'est plus un outil : elle
  // est naturelle, occasionnelle (voir le cycle meteo pres de updateWeather), reglee par
  // le curseur Pluie (rainLevel).
  var NUTRI = ['#2a1d14', '#1f1610', '#33241a']; // humus : terre noire, riche
  // Portee de RECHERCHE des racines (invisible, x largeur de la boite W) : le monde est
  // bien plus large que haut, un arbre mature doit pouvoir trouver du nutriment loin de
  // lui. La longueur VISUELLE des racines dessinees est volontairement plus courte
  // (ROOT_VISUAL_REACH, x hauteur H) : les etirer jusqu'a la portee de recherche donnait
  // des barres quasi droites traversant toute la scene (repere : capture d'ecran du
  // 2026-09-25).
  // A 0.7 (couvrait 70% de la largeur de la boite), n'importe quel nutriment produit
  // n'importe ou tombait dans le rayon d'au moins un arbre : "etre hors de portee" n'arrivait
  // presque jamais, donc un sol sans mycelium n'etait jamais vraiment desavantage. Reduit
  // pour qu'il existe de vraies zones hors de portee horizontale.
  var ROOT_REACH = 0.3;                   // portee de recherche de nutriment une fois l'arbre mature (x largeur de la boite)
  var ROOT_VISUAL_REACH = 0.4;            // longueur des racines lat. DESSINEES une fois mature (x hauteur de la boite) ; elles plongent, donc plus courtes qu'avant
  // Deux parametres separes (pas juste ROOT_DEPTH x g comme ROOT_REACH) : g (voir plus bas,
  // lerp(ROOT_GROWTH_MIN, 1, t.growth)) est un ratio FIXE entre jeune et mature, donc monter
  // une seule valeur de profondeur remontait les deux ages dans la meme proportion —
  // impossible de creuser plus profond pour un jeune arbre sans aussi faire exploser la
  // portee d'un arbre adulte. Interpole directement entre les deux a la place.
  var ROOT_DEPTH_MIN = 0.12;              // profondeur de recherche sous la surface a la naissance (x hauteur de la boite)
  var ROOT_DEPTH_MAX = 0.35;              // profondeur de recherche sous la surface une fois mature (x hauteur de la boite)
  // Un nutriment frais (bois/necromasse qui vient de se decomposer, encore tout en haut du
  // tas) n'est PAS a portee des racines tant que la pluie ne l'a pas fait descendre d'au
  // moins plusieurs crans (voir leach() et s.leachCount) : sinon la pluie ne serait qu'un
  // bonus de vitesse au lieu d'etre necessaire au cycle. A 1 seul cran (valeur d'origine),
  // le tout premier passage de pluie suffisait a rendre le nutriment mangeable, bien avant
  // qu'il ait eu la chance de couler hors de portee des racines (ROOT_DEPTH) : le mycelium
  // qui le retient en surface (MYC_HOLD_REACH) n'avait alors aucun effet observable, un
  // arbre sans mycelium n'etant quasiment jamais penalise par le lessivage. Un seuil plus
  // haut laisse le temps a un nutriment non retenu de couler plus profond au fil des
  // pluies successives. Un depot lessive jusqu'au compact (compactNutri) ou ramene en
  // surface par la pelle (spawnDecompactShard) a deja fait tout ce trajet, donc compte
  // comme mur d'emblee.
  var MIN_LEACH_TO_EAT = 4;
  // Sans pluie du tout (secheresse prolongee ou curseur Pluie a 0), un nutriment qui n'a
  // jamais lessive restait mangeable JAMAIS — la pluie etait donc un vrai interrupteur, pas
  // juste un bonus de vitesse comme voulu. Un nutriment mur tout seul, mais bien plus
  // lentement qu'avec la pluie (voir isNutriRipe) : le cycle continue meme sans pluie,
  // juste au ralenti.
  var NUTRI_RIPEN_MS = 45000;
  var EAT_MS = 45000;                     // un nutriment absorbe au plus toutes les EAT_MS
  // Abondance : si beaucoup de nutriments murs sont a portee EN MEME TEMPS (pas juste
  // "plusieurs"), l'arbre mange au rythme accelere plutot que le EAT_MS normal — un sol
  // vivant qui deborde de nourriture doit se sentir different d'un sol qui en a juste assez.
  var ABUNDANCE_THRESHOLD = 20;           // nb de nutriments murs a portee au-dela duquel l'arbre mange plus vite
  var ABUNDANCE_EAT_MULT = 3;             // EAT_MS est divise par ce facteur une fois le seuil depasse
  var ABUNDANCE_LEAF_FILL = 15;           // nb max de places de feuilles remplies d'un coup pendant l'abondance (avant de financer une branche)
  // Branches bonus : coherent avec l'absorption acceleree par l'abondance (ci-dessus), un
  // arbre deja mature (t.growth>=1) qui pioche dans un sol qui deborde de nutriments forme
  // une branche EN PLUS de son repas normal — payee en nutriments supplementaires pris
  // parmi les prochains plus profonds (voir la priorite par profondeur plus haut), jamais
  // gratuite. Une branche bonus est juste une place de feuille en plus (voir t.slots,
  // ajoutee dynamiquement), positionnee un peu hors du houppier normal. Une fois vieille,
  // elle tombe pour de bon (bois, pas juste sa feuille) et redonne sa matiere a la terre en
  // se decomposant, mais bien plus lentement qu'une feuille (BRANCH_LITTER_MS) — liberant sa
  // place pour qu'une nouvelle branche puisse repousser la prochaine fois qu'il y a assez de
  // nutriments.
  var BONUS_BRANCH_COST = 3;              // nutriments supplementaires consommes d'un coup pour former une branche
  var BONUS_BRANCH_MAX = 8;               // nb max de branches bonus simultanees par arbre
  var BONUS_BRANCH_LIFE_MS = 150000;      // duree de vie d'une branche bonus avant qu'elle tombe
  var BRANCH_LITTER_MS = 2400000;         // le bois tombe se decompose bien plus lentement qu'une feuille (LITTER_MS)
  var BRANCH_GROW_MS = 8000;              // temps pour qu'une branche bonus s'etire visuellement jusqu'a sa pleine longueur
  // Une branche a coute BONUS_BRANCH_COST nutriments a fabriquer ; elle les redonne au sol,
  // mais PAR PETITS BOUTS au fil de sa lente decomposition (BRANCH_LITTER_MS) plutot que
  // d'un coup a la toute fin comme une feuille (qui, elle, ne vaut qu'1 nutriment de toute
  // facon) — le bois reste au sol bien plus longtemps, il est normal qu'il rende sa matiere
  // progressivement. Une fois le dernier bout donne, ce qui reste du bois redevient juste de
  // la terre normale (voir toEarthColor), jamais un nutriment en plus.
  var WOOD_NUTRI_AREA = 10;               // aire (px^2) d'un bout de nutriment libere par du bois
  // Croissance : plus un arbre a mange de nutriments (t.eaten), plus t.growth (0..1) monte,
  // et plus ses racines vont chercher loin, plus il peut porter de feuilles, plus il est grand.
  var MATURE_NUTRIENTS = 12;              // nutriments manges pour atteindre la pleine croissance
  var ROOT_GROWTH_MIN = 0.15;             // longueur des racines a la naissance (fraction de leur taille mature)
  var LEAF_UNLOCK_MIN = 8;                // places de feuilles utilisables a la naissance (sur 40)
  var TREE_SCALE_MIN = 0.3;               // taille du tronc/houppier a la naissance (fraction de la taille de reference)
  var TREE_SCALE_MAX = 1.6;               // taille du tronc/houppier une fois bien nourri (fraction de la taille de reference)
  var MAX_TREES = 6;                      // nombre max d'arbres (2 de depart + ceux plantes par le joueur)
  var TREE_MIN_SPACING = 90;              // distance minimale (px monde) entre deux arbres plantes
  var TREE_STARVE_MS = 60000;             // sans avoir mange depuis ce delai (t.lastAte), l'arbre commence a deperir
  var TREE_SHRINK_MS = 8000;              // rythme auquel un arbre affame perd un nutriment mange (t.eaten--)
  // La base de l'arbre (t.by) suit le niveau du sol SOUS elle avec un delai plutot que de
  // recalculer surfaceAt(t.x) brut a chaque frame : sinon, remuer la terre pres du tronc
  // (pelle) le fait sauter haut/bas tres vite. Embed un peu plus profond que l'ancien +8 :
  // un arbre legerement enfonce dans le sol semble mieux ancre.
  var TREE_EMBED = 14;                    // enfoncement du pied du tronc sous la surface (px)
  var TREE_BY_FOLLOW = 0.04;              // vitesse (par frame) a laquelle t.by rattrape le niveau du sol
  var EATEN_MS = 5000;                    // duree de l'absorption (la facette retrecit)
  var LEAF_GROW_MS = 4400;
  // Houppier : les feuilles sont regroupees en bouquets au bout de branches maitresses
  // (t.limbs, pre-calcule dans makeTree). Purement visuel, sans effet sur le gameplay.
  var CANOPY_LIMBS = 5;                   // nb de branches maitresses / bouquets (utilise seulement a la creation de l'arbre)
  var CANOPY_CLUSTER_R = 0.065;           // rayon d'un bouquet de feuilles (fraction de H) ; sert aussi a la masse de feuillage dessinee
  var LEAF_LIFE_MS = [58000, 180000];     // duree de vie d'une feuille (min, max)
  var LITTER_BULK = 0.2;                  // une feuille posee n'ajoute que cette fraction de sa hauteur au tas (litiere a plat, pas une butte)
  var LOG_BULK = 0.4;                     // idem pour le bois tombe
  var LITTER_FLAT = 0.4;                  // ecrasement vertical d'une feuille posee (dessin seulement)
  var LITTER_MS = 300000;                 // une feuille tombee loin de tout mycelium redevient humus toute seule, tres lentement (5 min, comme dans la vraie vie) ; le mycelium a proximite accelere fortement ce delai (MYC_DECOMPOSE_MULT)
  var LEAF_AGES = [[0, [156, 204, 90]], [0.25, [86, 150, 60]], [0.65, [62, 120, 50]], [0.82, [217, 169, 46]], [1, [184, 97, 42]]];
  var trees = [], litter = [], treeLife = false, slowTimer = null;
  var DIG_TO_REVEAL = 3;                  // coups de pelle (clic/tap) pour deterrer un tresor

  // "Camera" : le monde (terre + tresors) est plus large ET plus profond que la boite
  // visible. camX/camY sont le decalage (en px monde) affiche a l'ecran ; tout se dessine
  // translate de (-camX, -camY). Horizontal : le monde deborde des deux cotes, camX est
  // centre au depart. Vertical : rien d'utile au-dessus du sol, donc camY part a 0 (vue de
  // depart identique a avant) et ne descend QUE vers le bas pour reveler de la profondeur,
  // ou la couche compacte se creuse vraiment (voir compactY / cutCompact plus bas).
  var WORLD_MULT = 6;                     // largeur du monde = WORLD_MULT x largeur de la boite
  var DEPTH_MULT = 2;                     // profondeur ajoutee sous la boite = DEPTH_MULT x hauteur de la boite
  var CAMERA_EDGE = 0.28;                 // fraction de la largeur/hauteur de la boite ou le defilement s'active, depuis chaque bord
  var CAMERA_MAX = 3.2;                   // vitesse max de defilement horizontal (px monde / frame)
  var CAMERA_MAX_Y = 2.4;                 // vitesse max de defilement vertical (px monde / frame)
  // Sur l'accueil la boite remonte sous le header fixe (voir body.home .logo-explosion-inner
  // dans style.css, meme valeur 150px) : sans ca, la zone de defilement vers le haut serait
  // presque entierement cachee dessous et il faudrait y passer le curseur pour l'activer.
  // On decale la detection verticale de cette hauteur pour que la remontee commence deja
  // pendant que le curseur est encore visible, au-dessus de la boite.
  var CAMERA_TOP_DEADZONE = document.body.classList.contains('home') ? 150 : 0;
  var worldW = 0, camMargin = 0, camX = 0;
  var worldH = 0, camY = 0;
  var hoverScreenX = null, hoverScreenY = null; // position souris (coord. ecran), pour le defilement aux bords
  var mobileArrow = 0;                    // -1/0/1 : fleches tactiles mobiles maintenues (horizontal)
  var mobileArrowY = 0;                   // -1/0/1 : fleches tactiles mobiles maintenues (vertical)

  // "Tresors" enfouis dans le tas : un champignon + une infobulle (produit, conseil...).
  // x = position en fraction de la LARGEUR DU MONDE ; species = index dans SPECIES.
  var treasureDefs = [];
  try {
    treasureDefs = JSON.parse(canvas.getAttribute('data-treasures') || '[]');
  } catch (e) {
    treasureDefs = [];
  }
  treasureDefs.forEach(function (def) {
    if (def.img) new Image().src = def.img; // prechargee : l'infobulle s'affiche sans trou
  });
  var treasures = [];
  // Bulle produit sur le premier champignon issu du mycelium verse (pas un tresor : pas
  // de def.x/species, juste une infobulle qui suit ce champignon-la). Voir sprout().
  var mycTip = null, mycTipMushroom = null, mycTipShown = false;

  var W = 0, H = 0, groundY = 0;
  var shards = [], heights = [], mushrooms = [];
  // compactY[c] est le sommet (y monde) de la couche compacte a la colonne c : ne peut que
  // descendre (la pelle la decompacte, voir cutCompact), jamais remonter au-dessus du
  // niveau d'origine (groundY). heights[c] reste l'epaisseur de terre MEUBLE posee dessus
  // (son plancher a 0 ne bouge pas, voir pileAdd) ; la surface reelle d'une colonne est
  // donc compactY[c] - heights[c] (voir surfaceAt).
  var compactY = [];
  // Colonnes de roche-mere (voir buildRockyPatches) : un vrai bloc, souleve dans compactY,
  // que la pelle ne peut pas creuser (cutCompact). Ni mycelium, ni gazon, ni arbre ne s'y
  // installent tant qu'elle est exposee ; l'enterrer sous assez de terre (ROCK_COVER_MIN)
  // la rend a nouveau fertile.
  var rocky = [];
  // Depots d'humus lessives jusque dans la couche compacte (voir leach()) : chacun
  // {x, y, color}, y en coord. MONDE. Distinct de shards (facettes) pour rester leger :
  // ils ne participent a aucune physique, juste a un lent enfoncement pendant la pluie.
  var compactNutri = [];
  var mode = 'assembled';                 // 'assembled' | 'exploded' | 'rebuilding'
  var rafId = null, speciesIdx = 0, rebuildT = 0;
  var paused = false, wasRunningBeforeHide = false; // en pause : hors viewport ou onglet cache

  var img = new Image();
  var imgReady = false;
  img.onload = function () {
    imgReady = true;
    // Canvas pret : on montre la legende, cachee par defaut pour les visiteurs
    // reduced-motion / no-JS qui ne verront jamais l'animation tourner.
    setCaption(CAPTION_BEFORE);
    if (caption) caption.classList.remove('d-none');
  };
  img.src = logoUrl;

  function hexToRgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function shade(rgb, k) {
    return rgb.map(function (c) { return Math.max(0, Math.min(255, Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k)))); });
  }
  function rgbStr(c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOutBack(t) { var c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  // --- Lit de terre ------------------------------------------------------------------
  // Terre supplementaire qui monte du bas au moment de l'explosion : la terre du logo
  // retombe dessus. Sans elle, le tas (fait seulement du logo) etait trop mince pour creuser.
  var SOIL_RISE_FRAMES = 32;
  var soilRiseT = 1, soilDepth = 0;       // soilRiseT < 1 : le lit est en train de monter

  function setupSoil(rect) {
    W = rect.width; H = rect.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    // Le monde deborde de la boite ; la boite est centree dedans au depart.
    worldW = W * WORLD_MULT;
    camMargin = (worldW - W) / 2;
    camX = camMargin;
    worldH = H + H * DEPTH_MULT;
    camY = 0;
    groundY = H - 6;
    buildHills();
    heights = new Float32Array(Math.ceil(worldW / COL_W) + 1);
    compactY = new Float32Array(heights.length);
    compactY.fill(groundY);
    compactNutri = [];
    drops = [];
    nextLeachAt = 0;
    weather.raining = false; weather.clouds = []; weather.lastNow = null; weather.changeAt = 0;
    weather.drought = false; weather.droughtChangeAt = 0;
    updateDroughtIndicator();

    // Profil : couche de base ondulee + bosse centrale sous le logo (au centre du monde).
    var base = H * 0.07, bump = H * 0.08, phase = Math.random() * 10;
    function profile(x) {
      var u = x / worldW;
      var mound = Math.exp(-Math.pow((u - 0.5) / 0.3, 2));
      var wave = Math.sin(u * 9 + phase) * 0.25 + Math.sin(u * 23 + phase * 2) * 0.12;
      return base * (1 + wave) + bump * mound;
    }
    // Profil provisoire, seulement pour trier les triangles sous la crete ; la vraie
    // carte de hauteurs est ensuite reconstruite a partir des facettes gardees.
    for (var c = 0; c < heights.length; c++) heights[c] = profile(c * COL_W);
    soilDepth = base * 1.4 + bump + 10;

    // Maillage low-poly (sommets partages et decales) sur toute la largeur du MONDE,
    // puis on ne garde que les triangles sous la crete : leurs pointes forment une
    // crete dentelee. Coordonnees x en px monde (0..worldW), pas de decalage camera ici.
    var cell = Math.max(6, W / 160);
    var rows = Math.ceil((base * 1.4 + bump + 6) / cell), cols = Math.ceil(worldW / cell);
    var top = H - rows * cell;
    var verts = [];
    for (var j = 0; j <= rows; j++) {
      verts[j] = [];
      for (var i = 0; i <= cols; i++) {
        var edge = i === 0 || j === 0 || i === cols || j === rows;
        verts[j][i] = [
          i * cell + (edge ? 0 : (Math.random() - 0.5) * cell * 0.7),
          top + j * cell + (edge ? 0 : (Math.random() - 0.5) * cell * 0.7)
        ];
      }
    }
    shards = [];
    for (j = 0; j < rows; j++) {
      for (i = 0; i < cols; i++) {
        var a = verts[j][i], b = verts[j][i + 1], cc = verts[j + 1][i + 1], d = verts[j + 1][i];
        var tris = Math.random() < 0.5 ? [[a, b, cc], [a, cc, d]] : [[a, b, d], [b, cc, d]];
        addSoilShard(tris[0]);
        addSoilShard(tris[1]);
      }
    }
    heights.fill(0);
    shards.forEach(pileAdd);
    soilRiseT = 0;
    buildRockyPatches();

    // Gazon : couche initiale pleine partout (voir section "Gazon" plus haut). Le suivi de
    // hauteur precedente demarre APRES l'empilement pour ne pas confondre "la terre vient
    // d'etre posee" avec "la terre a ete remuee".
    grassCover = new Float32Array(heights.length);
    grassCover.fill(1);
    for (var rc = 0; rc < rocky.length; rc++) if (rocky[rc]) grassCover[rc] = 0;
    grassPrevH = new Float32Array(heights);
    grassMyc = new Uint8Array(heights.length);
    grassLastNow = null;
    grassNutriAt = 0;

    // Flore (voir section "Flore (cosmetique)" plus haut) : demarre a 0 partout, elle
    // pousse ensuite d'elle-meme pres des arbres/du mycelium au fil d'updateGrass.
    floraLush = new Float32Array(heights.length);
    floraTarget = new Float32Array(heights.length);
  }

  function addSoilShard(tri) {
    var cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
    var cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
    var surf = surfaceAt(cx);
    if (cy < surf) return;
    // Plus sombre en profondeur : la terre "fraiche" se voit quand on creuse.
    var depth = Math.min(1, (cy - surf) / Math.max(1, H - surf));
    var k = (Math.random() - 0.5) * 0.2 - depth * 0.3;
    var color = shade(hexToRgb(EARTH[(Math.random() * EARTH.length) | 0]), k);
    shards.push({
      pts: tri.map(function (p) { return [p[0] - cx, p[1] - cy]; }),
      ox: cx, oy: cy, x: cx, y: cy, vx: 0, vy: 0, rot: 0, vr: 0,
      from: color, to: color, mix: 1, area: triArea(tri),
      settled: true, col: Math.round(cx / COL_W), soil: true
    });
  }

  function triArea(tri) {
    return Math.abs((tri[1][0] - tri[0][0]) * (tri[2][1] - tri[0][1]) - (tri[2][0] - tri[0][0]) * (tri[1][1] - tri[0][1])) / 2;
  }

  // Construit au moment du clic (pas au chargement) : la boite et le fallback sont
  // alors forcement mesures a leur vraie taille.
  function build() {
    var rect = container.getBoundingClientRect();
    setupSoil(rect);

    // Le logo est place exactement la ou le CSS affiche le fallback (encore visible
    // a ce moment-la) : taille et position se reglent donc uniquement dans style.css.
    // + camMargin : la boite est centree dans le monde, donc le logo aussi.
    var fr = fallbackImg.getBoundingClientRect();
    var lx = fr.left - rect.left + camMargin, oy = fr.top - rect.top, lw = fr.width, lh = fr.height;
    var CELL = Math.max(5, lw / CELLS_ACROSS);
    var cols = Math.ceil(lw / CELL), rows = Math.ceil(lh / CELL);

    var off = document.createElement('canvas');
    off.width = cols * 4; off.height = rows * 4;
    var offCtx = off.getContext('2d', { willReadFrequently: true });
    offCtx.drawImage(img, 0, 0, off.width, off.height);
    var data;
    try {
      data = offCtx.getImageData(0, 0, off.width, off.height).data;
    } catch (e) {
      return false;
    }
    function sample(fx, fy) {
      var x = Math.min(off.width - 1, Math.max(0, Math.round(fx * off.width)));
      var y = Math.min(off.height - 1, Math.max(0, Math.round(fy * off.height)));
      var i = (y * off.width + x) * 4;
      return [data[i], data[i + 1], data[i + 2], data[i + 3]];
    }

    // Sommets legerement decales et PARTAGES entre cellules voisines : c'est ce
    // qui donne un vrai maillage low-poly plutot qu'une grille de carres.
    var verts = [];
    for (var j = 0; j <= rows; j++) {
      verts[j] = [];
      for (var i = 0; i <= cols; i++) {
        var edge = i === 0 || j === 0 || i === cols || j === rows;
        verts[j][i] = [
          lx + i * CELL + (edge ? 0 : (Math.random() - 0.5) * CELL * 0.7),
          oy + j * CELL + (edge ? 0 : (Math.random() - 0.5) * CELL * 0.7)
        ];
      }
    }

    for (j = 0; j < rows; j++) {
      for (i = 0; i < cols; i++) {
        var a = verts[j][i], b = verts[j][i + 1], c = verts[j + 1][i + 1], d = verts[j + 1][i];
        var tris = Math.random() < 0.5 ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]];
        addShard(tris[0], sample, lx, oy, lw, lh);
        addShard(tris[1], sample, lx, oy, lw, lh);
      }
    }

    mushrooms = [];
    return true;
  }

  function addShard(tri, sample, lx, oy, lw, lh) {
    var cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
    var cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
    var s = sample((cx - lx) / lw, (cy - oy) / lh);
    if (s[3] < 110) return;
    var k = (Math.random() - 0.5) * 0.22;
    var area = triArea(tri);
    shards.push({
      pts: tri.map(function (p) { return [p[0] - cx, p[1] - cy]; }),
      ox: cx, oy: cy, x: cx, y: cy, vx: 0, vy: 0, rot: 0, vr: 0,
      from: shade([s[0], s[1], s[2]], k),
      to: shade(hexToRgb(EARTH[(Math.random() * EARTH.length) | 0]), k * 0.8),
      mix: 0, area: area, settled: false, col: -1
    });
  }

  // --- Tas de terre : carte de hauteurs par colonne, posee sur la couche compacte ----
  // Chaque facette posee y ajoute son aire (etalee sur quelques colonnes, sauf par-dessus
  // un pas de la couche compacte, ou tout part dans sa propre colonne) et, quand on la
  // souleve, retire EXACTEMENT ce qu'elle avait ajoute a chaque colonne (memorise dans
  // s.kdep/s.kcol) : jamais recalcule, jamais tronque, sinon chaque coup de pelle gonfle
  // le tas jusqu'a des aiguilles de terre.
  var KERNEL = [0.08, 0.17, 0.25, 0.25, 0.17, 0.08];
  var REPOSE = COL_W * 0.7;               // denivele max entre colonnes voisines (~35 deg), et pas de compact max traverse par le kernel
  var LOOSE_DRAW_SCALE = 1.2;             // agrandissement a l'affichage de la terre meuble posee (bouche les jours)
  var LOGO_BULK = 1.3;                  // la terre du logo "foisonne" un peu en retombant

  function surfaceAt(x) {
    var c = Math.max(0, Math.min(heights.length - 1, Math.round(x / COL_W)));
    return compactY[c] - heights[c];
  }
  // Vrai tant que la roche est exposee a cette colonne (pas assez de terre meuble
  // par-dessus, voir ROCK_COVER_MIN) : rien ne pousse la, mais l'empiler sous du terreau
  // (a la pelle) l'enterre et la rend a nouveau fertile, comme demande.
  function isRocky(x) {
    var c = Math.max(0, Math.min(rocky.length - 1, Math.round(x / COL_W)));
    return !!rocky[c] && heights[c] < ROCK_COVER_MIN;
  }
  // Quelques plaques de roche-mere affleurante, disseminees au hasard sur la largeur du
  // monde : des taches ou la couche compacte elle-meme ne se creuse jamais (voir son usage
  // dans cutCompact), pas juste une histoire de surface.
  function buildRockyPatches() {
    rocky = new Uint8Array(heights.length);
    var n = ROCK_PATCH_MIN + ((Math.random() * (ROCK_PATCH_MAX - ROCK_PATCH_MIN + 1)) | 0);
    for (var p = 0; p < n; p++) {
      var w = ROCK_PATCH_COLS_MIN + ((Math.random() * (ROCK_PATCH_COLS_MAX - ROCK_PATCH_COLS_MIN + 1)) | 0);
      var start = (Math.random() * Math.max(1, rocky.length - w)) | 0;
      // Bosse (comme le mound du profil general) : un vrai bloc qui depasse du sol, pas
      // une simple tache plate — pointe au milieu de la plaque, s'efface sur les bords.
      var peak = H * (ROCK_H_MIN + Math.random() * (ROCK_H_MAX - ROCK_H_MIN));
      for (var c = start; c < start + w && c < rocky.length; c++) {
        rocky[c] = 1;
        var t = (c - start) / w, edge = Math.sin(Math.PI * t);
        compactY[c] -= peak * edge;
      }
    }
    // Degage la terre meuble deposee par l'explosion sur ces colonnes : la roche doit
    // affleurer des le depart (sinon elle resterait cachee sous le tas initial jusqu'au
    // premier coup de pelle).
    shards = shards.filter(function (s) {
      if (!s.soil || !rocky[s.col]) return true;
      pileRemove(s);
      return false;
    });
  }
  function pileAdd(s) {
    s.dep = s.area / COL_W * (s.soil || s.extra ? 1 : LOGO_BULK);
    if (s.branch) s.dep *= LOG_BULK; else if (s.leaf) s.dep *= LITTER_BULK; // litiere a plat : kdep memorise ce qui est reellement ajoute
    s.kcol = s.kcol || [0, 0, 0, 0, 0, 0];
    s.kdep = s.kdep || [0, 0, 0, 0, 0, 0];
    for (var k = 0; k < KERNEL.length; k++) {
      var t = s.col + k - 3;
      // Hors limites, ou de l'autre cote d'un pas de compact (trou/paroi) : ce partage
      // reste sur la colonne de la facette au lieu de "traverser" le pas.
      if (t < 0 || t >= heights.length || Math.abs(compactY[t] - compactY[s.col]) > REPOSE) t = s.col;
      var amt = s.dep * KERNEL[k];
      s.kcol[k] = t;
      s.kdep[k] = amt;
      heights[t] = Math.max(0, heights[t] + amt);
    }
  }
  function pileRemove(s) {
    if (!s.kcol) return; // jamais empilee (ne devrait pas arriver)
    for (var k = 0; k < KERNEL.length; k++) heights[s.kcol[k]] = Math.max(0, heights[s.kcol[k]] - s.kdep[k]);
  }

  // Comme du sable : une facette qui tombe sur une pente trop raide roule vers la
  // colonne voisine la plus basse, au lieu de s'empiler en aiguille.
  function restColumn(x) {
    var c = Math.max(0, Math.min(heights.length - 1, Math.round(x / COL_W)));
    for (var n = 0; n < 60; n++) {
      var sc = compactY[c] - heights[c];
      var sl = c > 0 ? compactY[c - 1] - heights[c - 1] : -Infinity;
      var sr = c < heights.length - 1 ? compactY[c + 1] - heights[c + 1] : -Infinity;
      // Surface = y monde : plus grand = plus bas. On roule vers le voisin le plus bas.
      var lowSurf = Math.max(sl, sr);
      if (lowSurf === -Infinity || lowSurf - sc <= REPOSE) break;
      c = sl > sr ? c - 1 : c + 1;
    }
    return c;
  }

  // --- Physique ----------------------------------------------------------------------
  function explode(px, py) {
    fallbackImg.classList.add('d-none');
    canvas.classList.remove('d-none');
    mode = 'exploded';
    for (var i = 0; i < shards.length; i++) {
      var s = shards[i];
      if (s.soil) continue; // le lit de terre ne bouge pas, il recoit
      var dx = s.ox - px, dy = s.oy - py, d = Math.hypot(dx, dy) || 1;
      var sp = 2 + Math.random() * 5 + 40 / (d + 20);
      // Composante horizontale reduite : sinon tout s'empile contre les bords.
      s.vx = dx / d * sp * 0.45 + (Math.random() - 0.5) * 1.5;
      s.vy = dy / d * sp - 4 - Math.random() * 5;
      s.vr = (Math.random() - 0.5) * 0.35;
    }
    if (rebuildBtn) rebuildBtn.classList.remove('d-none');
    if (headerToggleBtn) headerToggleBtn.classList.remove('d-none');
    if (fullscreenBtn) fullscreenBtn.classList.remove('d-none');
    if (debugToggleBtn) debugToggleBtn.classList.remove('d-none');
    if (toolsBar) toolsBar.classList.remove('d-none');
    if (speedWrap) speedWrap.classList.remove('d-none');
    if (scrollLeftBtn) scrollLeftBtn.classList.remove('d-none');
    if (scrollRightBtn) scrollRightBtn.classList.remove('d-none');
    if (scrollUpBtn) scrollUpBtn.classList.remove('d-none');
    if (scrollDownBtn) scrollDownBtn.classList.remove('d-none');
    setupTreasures();
    // Un arbre visible a gauche du logo, un autre plus loin a droite dans le monde.
    trees = [makeTree(camMargin + W * 0.14), makeTree(camMargin + W * 1.35)];
    litter = [];
    setCaption(CAPTION_EXPLODED);
    startLoop();
  }

  // Vitesse de defilement selon la position ecran du curseur : nulle au centre, augmente
  // en approchant des CAMERA_EDGE derniers % de chaque bord de la boite.
  function cameraSpeed(screenX) {
    var edge = W * CAMERA_EDGE;
    if (screenX < edge) {
      var k = 1 - screenX / edge;
      return -CAMERA_MAX * k * k;
    }
    if (screenX > W - edge) {
      var k2 = 1 - (W - screenX) / edge;
      return CAMERA_MAX * k2 * k2;
    }
    return 0;
  }

  // Meme logique, axe vertical : pres du haut de la boite ca remonte (camY vers 0), pres
  // du bas ca descend (camY vers worldH - H, plus profond).
  function cameraSpeedY(screenY) {
    var edge = H * CAMERA_EDGE;
    var y = Math.max(0, screenY - CAMERA_TOP_DEADZONE);
    if (y < edge) {
      var k = 1 - y / edge;
      return -CAMERA_MAX_Y * k * k;
    }
    if (screenY > H - edge) {
      var k2 = 1 - (H - screenY) / edge;
      return CAMERA_MAX_Y * k2 * k2;
    }
    return 0;
  }

  function step() {
    var camMoving = false;
    if (mode === 'exploded') {
      // La souris ne bouge pas forcement pendant qu'on defile : on garde sa derniere
      // position ecran connue et on la reconvertit en coord. monde a chaque frame, pour
      // que la pelle reste sous le curseur meme quand le monde glisse dessous.
      if (hoverScreenX !== null) {
        shovel.gx = bag.x = hand.x = hoverScreenX + camX;
        shovel.gy = bag.y = hand.y = hoverScreenY + camY;
      }
      var camV = mobileArrow ? mobileArrow * CAMERA_MAX : (hoverScreenX !== null ? cameraSpeed(hoverScreenX) : 0);
      if (camV) {
        var newCamX = clamp(camX + camV, 0, worldW - W);
        if (newCamX !== camX) camMoving = true;
        camX = newCamX;
      }
      var camVY = mobileArrowY ? mobileArrowY * CAMERA_MAX_Y : (hoverScreenY !== null ? cameraSpeedY(hoverScreenY) : 0);
      if (camVY) {
        var newCamY = clamp(camY + camVY, 0, worldH - H);
        if (newCamY !== camY) camMoving = true;
        camY = newCamY;
      }
    }
    // Tant que la pelle est a l'ecran ou que le monde defile, la boucle tourne.
    frame++;
    var realNow = performance.now();
    if (lastRealNow === null) lastRealNow = realNow;
    // Plafonne le delta reel avant de l'accelerer : sinon un long moment sans frame (onglet
    // en arriere-plan, boucle a l'arret le temps qu'on interagisse de nouveau) ferait
    // exploser vTime d'un coup une fois multiplie par timeScale. 500ms passe large au-dessus
    // du tick de la boucle lente (slowTimer, 250ms) pour ne pas la ralentir artificiellement.
    vTime += Math.min(realNow - lastRealNow, 500) * timeScale;
    lastRealNow = realNow;
    var now = vTime;
    var active = shovel.on || bag.on || camMoving || weather.raining || drops.length > 0;
    if (bag.on) updateBag();
    if (hand.on && updateHand(now)) active = true;
    if (mode === 'exploded') updateWeather(now);
    updateRainDrops(now);
    if (shovel.on) {
      updateShovel();
      if (shovel.on) bowlWakePile(cutCompact()); // updateShovel peut la ranger (fin de versement au doigt)
    }
    var anyDead = false;
    for (var i = 0; i < shards.length; i++) {
      var s = shards[i];
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
      if (s.leaf && !s.landed) {
        // Une feuille plane, pas encore tombee au sol une premiere fois : chute lente,
        // se balance de gauche a droite.
        // Vent : toujours un sens (qui s'inverse toutes les ~60 s), par rafales. Chaque
        // feuille a sa prise au vent (s.gust) : la plupart tombent pres, certaines partent loin.
        var wind = (Math.sin(now / 20000) >= 0 ? 1 : -1) * (0.4 + 0.3 * (1 + Math.sin(now / 1700 + s.sway))) * WIND_STRENGTH;
        s.vy += GRAVITY * 0.1 / (1 + s.gust * 0.4); s.vy *= 0.94;
        s.vx = s.vx * 0.95 + Math.sin(now / 350 + s.sway) * 0.1 + wind * (0.02 + s.gust * 0.045);
        driftScale = timeScale;
      } else if (s.leaf) {
        // Une feuille deja tombee au moins une fois (relancee par la pelle) : elle ne
        // doit plus flotter comme a sa chute depuis l'arbre, mais tomber comme un debris.
        s.vy += GRAVITY * 0.6; s.vx *= AIR;
      } else {
        s.vy += GRAVITY; s.vx *= AIR; s.vy *= AIR;
        s.mix = Math.min(1, s.mix + 0.012);
      }
      s.x += s.vx * driftScale; s.y += s.vy * driftScale; s.rot += s.vr;
      if (shovel.on && collideBowl(s)) {
        s.vr *= 0.8;
        continue; // tenue par le bol : pas de contact avec le sol cette frame
      }
      if (s.x < 4) { s.x = 4; s.vx = Math.abs(s.vx) * 0.4; }
      if (s.x > worldW - 4) { s.x = worldW - 4; s.vx = -Math.abs(s.vx) * 0.4; }
      var floor = surfaceAt(s.x);
      if (s.grain) {
        // Un grain ne s'empile pas : il se fond dans la terre et l'inocule.
        if (s.y >= floor) { inoculate(s.x, floor, now); s.dead = true; anyDead = true; }
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
            if (litter.indexOf(s) < 0) litter.push(s);
          } else s.mix = 1;
          s.col = restColumn(s.x);
          s.x = (s.col + Math.random() - 0.5) * COL_W;
          s.y = compactY[s.col] - heights[s.col];
          pileAdd(s);
        }
      }
    }
    if (mode === 'exploded') {
      var tl = stepTrees(now);
      var gl = updateGrass(now);
      treeLife = tl > 0 || gl > 0;
      if (tl === 2) active = true;
      if (stepFlowers(now)) active = true;
      if (stepInsects(realNow)) active = true;
    }
    if (anyDead) shards = shards.filter(function (g) { return !g.dead; });
    if (mode === 'exploded' && colonised.length && stepMycelium(now)) active = true;
    if (soilRiseT < 1) {
      soilRiseT = Math.min(1, soilRiseT + 1 / SOIL_RISE_FRAMES);
      active = true;
    }
    // Un champignon sorti du mycelium (pas plante a la main) fane si plus aucun mycelium
    // bien vivant n'est a portee pendant un moment : il ne peut pas survivre sans le
    // reseau qui l'a fait fructifier.
    var mycNearReach = H * FRUIT_W;
    for (i = 0; i < mushrooms.length; i++) {
      var mm = mushrooms[i];
      if (!mm.myc || mm.dying || mm.treasure) continue;
      var nearMyc = false;
      for (var ci = 0; ci < colonised.length; ci++) {
        if (colonised[ci].myc > MYC_READY && Math.abs(colonised[ci].x - mm.x) < mycNearReach) { nearMyc = true; break; }
      }
      if (nearMyc) mm.lastMycNear = now;
      else if (now - mm.lastMycNear > MUSHROOM_STARVE_MS) mm.dying = true;
    }
    for (i = 0; i < mushrooms.length; i++) {
      var m = mushrooms[i];
      if (m.dying) { m.t -= 0.06; active = true; }
      else if (m.t < 1) { m.t = Math.min(1, m.t + 0.025); active = true; }
    }
    mushrooms = mushrooms.filter(function (m) { return !(m.dying && m.t <= 0); });
    return active;
  }

  function startLoop() {
    if (paused) return; // hors viewport ou onglet cache : rien ne doit programmer de frame
    if (rafId !== null) return;
    if (slowTimer !== null) { clearTimeout(slowTimer); slowTimer = null; }
    rafId = requestAnimationFrame(function tick() {
      var active = mode === 'rebuilding' ? stepRebuild() : step();
      if (mode !== 'assembled') draw();
      if (active) { rafId = requestAnimationFrame(tick); return; }
      rafId = null;
      // Il ne reste que des feuilles qui vieillissent, ou juste le cycle meteo (pluie
      // naturelle) a surveiller pour son prochain changement d'etat : 4 images/s suffisent.
      if (mode === 'exploded' && (treeLife || rainLevel > 0)) {
        slowTimer = setTimeout(function () { slowTimer = null; startLoop(); }, 250);
      }
    });
  }

  // --- Pelle (bol) -------------------------------------------------------------------
  // Pas de logique "chargee / pas chargee" : la pelle est un arc de cercle (un bol) et
  // c'est sa courbe qui gere la terre. Une facette qui touche l'interieur de l'arc est
  // retenue par lui (elle glisse au fond par gravite, et deborde par le bord quand le
  // bol penche) ; celle qui touche le dos est repoussee dehors.
  // Le bol suit le curseur (le fond du bol est au curseur) et penche dans le sens du
  // geste. Bouton maintenu : la pelle ralentit (mode precis). Doigt leve (mobile) : elle verse.
  // Lame de pelle a peine courbee : une petite portion d'un grand cercle. On regle la
  // largeur de la lame et sa courbure ; le rayon du cercle en decoule. Volume d'une
  // pelletee ~ largeur x hauteur portee (0.30 x 0.04, comme 0.20 x 0.06 avant).
  var BLADE_WIDTH = 0.30;                 // largeur de la lame (fraction de la hauteur de la zone)
  var BOWL_SPAN = 0.35;                   // demi-ouverture de l'arc (rad) : plus petit = plus plat
  var BOWL_T = 5;                         // epaisseur de la paroi (px)
  var POUR_ANGLE = 2.1;                   // bascule (rad) pour vider
  var SLOW_FOLLOW = 0.12;                 // bouton maintenu : part du chemin vers le curseur par frame
  var DIG_BITE = 2;                       // penetration (px) dans le compact tolerable sans ralentir la pelle
  var DIG_SPEED = 0.8;                    // vitesse max (px/frame) du fond de la pelle au-dela de DIG_BITE : le curseur de resistance
  var DIG_SPEED_DOWN = 0.3;               // idem, mais vers le bas seulement (creuser a la verticale)
  var shovel = {
    on: false, held: false, pouring: false, hideWhenEmpty: false,
    gx: 0, gy: 0,                         // curseur
    cx: 0, cy: 0, pcx: 0, pcy: 0,         // centre du cercle du bol, et a la frame precedente
    tilt: 0, ptilt: 0, face: 1            // face : 1 = dernier geste vers la droite, -1 = gauche
  };
  var BLADE_FIELD = 0.10;                 // hauteur de la zone de force au-dessus de la lame (x hauteur)
  var BLADE_PULL = 0.18;                  // part de l'ecart de vitesse rattrapee par frame (sur la lame)
  var BLADE_ATTRACT = 0.12;               // attraction vers la lame (px/frame^2, sur la lame)
  var pointerDown = null, dragMoved = false;

  function bowlR() { return H * BLADE_WIDTH / 2 / Math.sin(BOWL_SPAN); }
  function loadDepth() { return H * 0.04; } // hauteur de terre que la lame peut porter
  function angleDiff(a, b) { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // Pour un cercle de centre (cx, cy) et de rayon Rc, penche de tilt : le point le plus
  // BAS (y le plus grand) de ce cercle a la colonne x, mais seulement sur la portion qui
  // fait vraiment partie de la lame (l'arc ouvert de BOWL_SPAN autour du fond du bol) —
  // au-dela il n'y a rien, juste de l'air. Utilise pour la resistance du compact
  // (updateShovel/enterShovel) et pour la decompaction (cutCompact). Retourne null si
  // aucun point du cercle a cette colonne n'est sur la lame.
  function bladeOuterY(x, cx, cy, tilt, Rc) {
    var dx = x - cx;
    if (Math.abs(dx) > Rc) return null;
    var dy = Math.sqrt(Rc * Rc - dx * dx), bottomDir = Math.PI / 2 - tilt;
    var cands = [cy + dy, cy - dy], bestY = null, bestA = 0;
    for (var i = 0; i < 2; i++) {
      var y = cands[i], a = Math.atan2(y - cy, dx);
      if (Math.abs(angleDiff(a, bottomDir)) > BOWL_SPAN) continue;
      if (bestY === null || y > bestY) { bestY = y; bestA = a; }
    }
    return bestY === null ? null : { y: bestY, a: bestA };
  }

  function enterShovel(p) {
    shovel.on = true;
    shovel.gx = p.x; shovel.gy = p.y;
    shovel.tilt = shovel.ptilt = 0;
    shovel.pouring = false; shovel.hideWhenEmpty = false;
    shovel.cx = shovel.pcx = p.x; shovel.cy = shovel.pcy = p.y - bowlR();
    // Si le bol entre deja dans le compact a cet endroit, on le remonte d'autant : prendre
    // l'outil ne doit jamais creuser un trou instantane.
    var Rc = bowlR() + BOWL_T, pen = 0;
    var c0 = Math.max(0, Math.floor((shovel.cx - Rc) / COL_W)), c1 = Math.min(heights.length - 1, Math.ceil((shovel.cx + Rc) / COL_W));
    for (var c = c0; c <= c1; c++) {
      var bo = bladeOuterY(c * COL_W, shovel.cx, shovel.cy, shovel.tilt, Rc);
      if (bo) pen = Math.max(pen, bo.y - compactY[c]);
    }
    if (pen > 0) { shovel.cy -= pen; shovel.pcy = shovel.cy; }
    container.classList.add('is-tool-cursor');
  }

  function leaveShovel() {
    shovel.on = false; shovel.held = false; shovel.pouring = false; shovel.hideWhenEmpty = false;
    container.classList.remove('is-tool-cursor');
  }

  function updateShovel() {
    var R = bowlR();
    shovel.pcx = shovel.cx; shovel.pcy = shovel.cy; shovel.ptilt = shovel.tilt;
    // Le fond du bol (et non son centre) est colle au curseur, sans retard.
    var bottomX = shovel.cx + Math.sin(shovel.tilt) * R, bottomY = shovel.cy + Math.cos(shovel.tilt) * R;
    var dx = shovel.gx - bottomX, dy = shovel.gy - bottomY;
    // Bouton maintenu = mode precis : la pelle rejoint le curseur lentement (et penche
    // donc moins), pour mieux controler la terre.
    if (shovel.held) { dx *= SLOW_FOLLOW; dy *= SLOW_FOLLOW; }
    if (Math.abs(dx) > 0.6) shovel.face = dx > 0 ? 1 : -1;
    // Penche dans le sens du geste (le bord avant plonge : il mord dans la terre).
    var goal = shovel.pouring ? -shovel.face * POUR_ANGLE : -clamp(dx * 0.06, -0.7, 0.7);
    shovel.tilt += (goal - shovel.tilt) * (shovel.pouring ? 0.12 : 0.2);
    var newBottomX = bottomX + dx, newBottomY = bottomY + dy;
    // Resistance de la couche compacte : y mordre (contrairement a la terre meuble, qui
    // se traverse librement) est lent. On regarde de combien la lame proposee y
    // penetrerait ; au-dela d'une tolerance (DIG_BITE), le fond de la pelle n'avance plus
    // que de DIG_SPEED par frame vers sa cible. Ressortir/remonter n'est jamais ralenti
    // (penetration <= 0 une fois le compact deja entame par cutCompact).
    var Rc = R + BOWL_T;
    var propCx = newBottomX - Math.sin(shovel.tilt) * R, propCy = newBottomY - Math.cos(shovel.tilt) * R;
    var c0 = Math.max(0, Math.floor((propCx - Rc) / COL_W)), c1 = Math.min(heights.length - 1, Math.ceil((propCx + Rc) / COL_W));
    var penetration = 0;
    for (var c = c0; c <= c1; c++) {
      var bo = bladeOuterY(c * COL_W, propCx, propCy, shovel.tilt, Rc);
      if (bo) penetration = Math.max(penetration, bo.y - compactY[c]);
    }
    if (penetration > DIG_BITE) {
      var moveLen = Math.hypot(dx, dy);
      if (moveLen > DIG_SPEED) {
        var k = DIG_SPEED / moveLen;
        newBottomX = bottomX + dx * k;
        newBottomY = bottomY + dy * k;
      }
      // Descendre a la verticale est encore plus dur que racler de cote.
      if (newBottomY - bottomY > DIG_SPEED_DOWN) newBottomY = bottomY + DIG_SPEED_DOWN;
    }
    newBottomY = Math.min(newBottomY, worldH - BEDROCK_MARGIN);
    shovel.cx = newBottomX - Math.sin(shovel.tilt) * R;
    shovel.cy = newBottomY - Math.cos(shovel.tilt) * R;
    if (shovel.pouring && Math.abs(shovel.tilt) > POUR_ANGLE * 0.9) {
      shovel.pouring = false;
      if (shovel.hideWhenEmpty) leaveShovel();
    }
  }

  // Collision d'une facette avec le bol. Retourne true si elle a ete touchee.
  function collideBowl(s) {
    var R = bowlR();
    var rx = s.x - shovel.cx, ry = s.y - shovel.cy, d = Math.hypot(rx, ry);
    if (d > R + BOWL_T + 2 || d < 0.001) return false;
    // Seulement sur l'arc : le fond est a l'oppose de l'ouverture (vers le bas a tilt 0).
    var bottomDir = Math.PI / 2 - shovel.tilt;
    if (Math.abs(angleDiff(Math.atan2(ry, rx), bottomDir)) > BOWL_SPAN) return false;
    // Chaque facette a son propre rayon de repos : elles s'empilent en tas dans le
    // bol au lieu de toutes s'aligner sur la paroi.
    if (s.stack === undefined) s.stack = Math.random();
    var depth = loadDepth();
    var rest = R - s.stack * depth;       // hauteur de repos propre a chaque facette : un petit tas
    // De quel cote de la paroi etait-elle a la frame precedente ? (dos ou creux)
    var prx = (s.px === undefined ? s.x : s.px) - shovel.pcx;
    var pry = (s.py === undefined ? s.y : s.py) - shovel.pcy;
    var wasOutside = Math.hypot(prx, pry) > R + 1;
    if (d < R - depth * 1.2) return false; // bien au-dessus de la lame : libre
    if (d < rest) return false;
    var ux = rx / d, uy = ry / d;
    var target = wasOutside ? R + BOWL_T + 2 : rest;
    s.x = shovel.cx + ux * target;
    s.y = shovel.cy + uy * target;
    // Paroi solide, sans adherence : la facette prend la vitesse de la lame a cet
    // endroit (translation + rotation), plus son glissement le long de la lame, freine.
    var w = shovel.tilt - shovel.ptilt;
    var wx = shovel.cx - shovel.pcx + w * (s.y - shovel.cy);
    var wy = shovel.cy - shovel.pcy - w * (s.x - shovel.cx);
    if (wasOutside) {
      s.vx = clamp(wx, -16, 16);
      s.vy = clamp(wy, -16, 16);
      return true;
    }
    var relx = s.vx - wx, rely = s.vy - wy;
    var along = -rely * ux + relx * uy;   // composante tangentielle (le long de la lame)
    s.vx = clamp(wx + uy * along * 0.7, -16, 16);
    s.vy = clamp(wy - ux * along * 0.7, -16, 16);
    return true;
  }

  // Force douce au-dessus de la lame (pas seulement au contact) : dans une zone de
  // BLADE_FIELD de haut, la terre tend vers la vitesse de la pelle, un peu plus a
  // chaque frame et plus fort pres de la lame, et elle est legerement attiree vers
  // elle. Un geste lent emporte la pelletee ; un geste rapide la laisse prendre du
  // retard progressivement (pas de decrochage sec).
  function bladeField(s) {
    var R = bowlR(), field = H * BLADE_FIELD;
    var rx = s.x - shovel.cx, ry = s.y - shovel.cy, d = Math.hypot(rx, ry);
    if (d > R + 1 || d < R - field) return;
    if (Math.abs(angleDiff(Math.atan2(ry, rx), Math.PI / 2 - shovel.tilt)) > BOWL_SPAN) return;
    var k = 1 - (R - d) / field;          // 1 sur la lame, 0 en haut de la zone
    var w = shovel.tilt - shovel.ptilt;
    // Plafonne comme dans collideBowl : un saut brusque de la pelle d'une frame a l'autre
    // (ex. la resistance du compact qui la freine tout a coup) ne doit pas projeter la
    // terre a des vitesses absurdes.
    var wx = clamp(shovel.cx - shovel.pcx + w * ry, -16, 16), wy = clamp(shovel.cy - shovel.pcy - w * rx, -16, 16);
    s.vx += (wx - s.vx) * BLADE_PULL * k;
    s.vy += (wy - s.vy) * BLADE_PULL * k;
    // Attraction vers la lame (vers l'exterieur du cercle, donc vers l'arc).
    s.vx += rx / d * BLADE_ATTRACT * k;
    s.vy += ry / d * BLADE_ATTRACT * k;
  }

  var DECOMPACT_BULK = 1.2;               // la terre qui sort du compact "foisonne" (comme LOGO_BULK)
  var compactDebt = 0;                    // aire de terre meuble encore due suite a une decompaction, reportee entre frames

  // Decompacte la couche compacte la ou la lame mord dedans : chaque colonne entamee voit
  // son compactY descendre, et de la terre meuble en sort en proportion (avec
  // foisonnement) — pas forcement une facette par colonne par frame, une dette s'accumule
  // et se resorbe au fil des frames suivantes (conservation en moyenne, pas facette par
  // facette). Retourne les colonnes entamees cette frame (ou null), pour que
  // bowlWakePile sache reveiller ce qui devient suspendu au-dessus.
  function cutCompact() {
    var R = bowlR() + BOWL_T, cut = null;
    var c0 = Math.max(0, Math.floor((shovel.cx - R) / COL_W)), c1 = Math.min(compactY.length - 1, Math.ceil((shovel.cx + R) / COL_W));
    for (var c = c0; c <= c1; c++) {
      if (rocky[c]) continue; // roche-mere : la pelle ne l'entame jamais, buree ou non
      var bo = bladeOuterY(c * COL_W, shovel.cx, shovel.cy, shovel.tilt, R);
      if (!bo || bo.y <= compactY[c]) continue;
      var newTop = Math.min(bo.y, worldH - BEDROCK_MARGIN);
      var removed = newTop - compactY[c];
      if (removed <= 0) continue;
      compactY[c] = newTop;
      compactDebt += removed * COL_W * DECOMPACT_BULK;
      if (!cut) cut = {};
      cut[c] = bo.a;
      // De l'humus lessive jusque-la par la pluie (voir leach()) redevient accessible :
      // la pelle le rend a la surface, porte par une facette meuble neuve.
      for (var ni = compactNutri.length - 1; ni >= 0; ni--) {
        var dep = compactNutri[ni];
        if (Math.round(dep.x / COL_W) !== c || dep.y >= newTop) continue;
        compactNutri.splice(ni, 1);
        spawnDecompactShard(bo.a, dep.color);
      }
    }
    if (!cut) return null;
    var cols = Object.keys(cut), guard = 0;
    while (compactDebt > 0 && guard++ < 40) {
      var col = cols[(Math.random() * cols.length) | 0];
      compactDebt -= spawnDecompactShard(cut[col]);
    }
    return cut;
  }

  // Une facette de terre meuble qui sort de la couche compacte, a l'angle a (sur le
  // cercle de la lame) : apparait juste au-dessus de la lame, a l'interieur du bol,
  // emportee par le mouvement de la pelle. Retourne son aire (pour la dette de cutCompact).
  function spawnDecompactShard(a, nutri) {
    var r = bowlR() - 3 - Math.random() * loadDepth() * 0.6;
    return makeDecompactShard(shovel.cx + Math.cos(a) * r, shovel.cy + Math.sin(a) * r,
      shovel.cx - shovel.pcx, shovel.cy - shovel.pcy, nutri, 1);
  }

  // Coeur commun (pelle et poing, voir fistStrike) : une facette de terre meuble neuve en
  // (x,y) a la vitesse (vx,vy), taille multipliee par sizeK. Retourne son aire.
  function makeDecompactShard(x, y, vx, vy, nutri, sizeK) {
    var size = Math.max(6, W / 160) * 1.3 * sizeK;
    var pts = [[-size * 0.55, size * 0.32], [size * 0.55, size * 0.32], [(Math.random() - 0.5) * size * 0.3, -size * 0.55]];
    // Assombrie selon la profondeur sous le niveau d'origine, comme addSoilShard : la
    // terre qui sort du compact reste de la terre normale, pas la terre sombre d'avant.
    var depth = Math.min(1, Math.max(0, y - groundY) / Math.max(1, worldH - groundY));
    var k = (Math.random() - 0.5) * 0.2 - depth * 0.3;
    var color = nutri ? hexToRgb(nutri) : shade(hexToRgb(EARTH[(Math.random() * EARTH.length) | 0]), k);
    var area = triArea(pts);
    var s = {
      pts: pts, ox: x, oy: y, x: x, y: y,
      vx: vx, vy: vy, rot: 0, vr: (Math.random() - 0.5) * 0.3,
      from: color, to: color, mix: 1, area: area,
      settled: false, col: -1, extra: true
    };
    // Un depot lessive redecouvert par la pelle : la facette qui le porte redevient de
    // l'humus (voir cutCompact) plutot que de la simple terre. Il a deja fait tout le
    // trajet vers le bas (voir MIN_LEACH_TO_EAT) : mur d'emblee, la pelle ne le "rajeunit" pas.
    // Deja fait tout le trajet de lessivage avant d'etre enfoui : pas de nouveau delai de
    // retenue mycelium, sinon la pelle pourrait re-suspendre indefiniment son lessivage.
    if (nutri) { s.nutri = nutri; s.leachCount = MIN_LEACH_TO_EAT; s.nutriSince = vTime - MYC_HOLD_MAX_MS; }
    s.px = s.x; s.py = s.y;
    shards.push(s);
    return area;
  }

  // Reveille les facettes posees restees suspendues au-dessus du sol dans les colonnes
  // dirtyCols (et leurs voisines) : elles retombent. Partage par la pelle et le poing.
  function wakeSuspended(dirtyCols) {
    for (var j = 0; j < shards.length; j++) {
      var sj = shards[j];
      if (!sj.settled) continue;
      var sjCol = Math.round(sj.x / COL_W);
      if (!(dirtyCols[sjCol] || dirtyCols[sjCol - 1] || dirtyCols[sjCol + 1])) continue;
      if (sj.y < surfaceAt(sj.x) - 6) { pileRemove(sj); sj.settled = false; }
    }
  }

  // Reveille les facettes posees que la lame touche, pour que la collision les prenne
  // en charge : la couche juste au-dessus de la lame (ce qu'elle ramasse) plus la lame
  // elle-meme. Autour, une facette restee "suspendue" au-dessus du sol (on a retire la
  // terre dessous, ou decompacte le compact sous elle) retombe : le trou se referme comme
  // du vrai sol. cutCols (colonnes decompactees cette frame par cutCompact, ou null) est
  // fusionne dans le meme scan de reveil.
  function bowlWakePile(cutCols) {
    // Remuer de la terre colonisee ne produit plus de nutriment ici : la terre en elle-
    // meme n'a pas de valeur nutritive, seul le bois decompose (ou le mycelium qui meurt
    // de faim) en donne — voir stepTrees/stepMycelium.
    var R = bowlR(), woke = [], dirtyCols = null;
    for (var i = 0; i < shards.length; i++) {
      var s = shards[i];
      if (!s.settled) continue;
      var dx = s.x - shovel.cx, dy = s.y - shovel.cy;
      var adx = Math.abs(dx);
      // La detection "suspendue" porte plus loin que la prise en main normale (2.5x) :
      // un trou creuse en profondeur laisse plus facilement des bords en surplomb qu'un
      // simple creusage de surface, et on veut les rattraper meme si le curseur n'est
      // plus exactement dessus, sans pour autant scanner tout le monde (voir le retour en
      // arriere plus haut sur le scan global).
      var touching = false;
      if (adx <= R * Math.sin(BOWL_SPAN) * 2.5) {
        var d = Math.hypot(dx, dy);
        var inBowl = d > R - loadDepth() * 1.2 && d < R + BOWL_T + 2 &&
          Math.abs(angleDiff(Math.atan2(dy, dx), Math.PI / 2 - shovel.tilt)) <= BOWL_SPAN;
        touching = inBowl;
      }
      if (!touching && adx <= R * Math.sin(BOWL_SPAN) * 6 && s.y < surfaceAt(s.x) - 6) touching = true;
      if (!touching) continue;
      // Toute matiere enlevee peut laisser quelque chose en suspens juste au-dessus, y
      // compris le maillage statique d'origine (setupSoil) qui ne bouge jamais tout seul —
      // meme quand le joueur a deja quitte l'endroit avec la pelle. On note juste la
      // colonne ici (pas cher) ; le scan qui rattrape les facettes en suspens se fait UNE
      // SEULE FOIS apres la boucle (pas a chaque facette enlevee, sinon un seul passage de
      // pelle sur de la terre meuble coutait un scan complet par facette — beaucoup trop).
      if (s.col >= 0) { if (!dirtyCols) dirtyCols = {}; dirtyCols[s.col] = true; }
      pileRemove(s);
      s.settled = false;
      s.vx = s.vy = 0;
      s.px = s.x; s.py = s.y;
      woke.push(s);
    }
    if (cutCols) {
      if (!dirtyCols) dirtyCols = {};
      for (var cc in cutCols) dirtyCols[cc] = true;
    }
    if (dirtyCols) wakeSuspended(dirtyCols);
    if (!woke.length) return;
    // La pelle qui passe sous un champignon le brise (sauf les tresors, qui portent l'infobulle).
    for (i = 0; i < mushrooms.length; i++) {
      var mu = mushrooms[i];
      if (mu.treasure || mu.dying || mu.t < 0.5) continue;
      if (Math.abs(mu.x - shovel.cx) < R * Math.sin(BOWL_SPAN) + mu.size * 0.3) breakMushroom(mu);
    }
    // Deplacer de la terre au-dessus d'un tresor le deterre peu a peu.
    for (i = 0; i < treasures.length; i++) {
      var t = treasures[i];
      if (t.revealed) continue;
      var near = woke.filter(function (m) { return Math.abs(m.x - t.x) < 30; }).length;
      if (near) tryDig(t, Math.min(0.12, near * 0.01));
    }
  }

  // Le champignon disparait d'un coup et eclate en quelques facettes a ses couleurs,
  // qui retombent et virent a la terre comme celles du logo.
  function breakMushroom(m) {
    m.dying = true; m.t = 0;
    var base = surfaceAt(m.x) + 6, cols = [hexToRgb(m.sp.cap), hexToRgb(m.sp.gill), [239, 230, 214]];
    for (var i = 0; i < 9; i++) {
      var r = m.size * (0.08 + Math.random() * 0.08), a = Math.random() * Math.PI * 2;
      var pts = [0, 1, 2].map(function (j) {
        var t = a + j * 2.1 + (Math.random() - 0.5) * 0.5;
        return [Math.cos(t) * r, Math.sin(t) * r];
      });
      shards.push({
        pts: pts, x: m.x + (Math.random() - 0.5) * m.size * 0.8, y: base - Math.random() * m.size * 0.9,
        vx: (Math.random() - 0.5) * 4, vy: -2 - Math.random() * 3, rot: 0, vr: (Math.random() - 0.5) * 0.4,
        from: cols[i % 3], to: hexToRgb(EARTH[(Math.random() * EARTH.length) | 0]), mix: 0,
        area: triArea(pts), settled: false, col: -1, extra: true
      });
    }
  }

  function drawShovel() {
    if (!shovel.on) return;
    var R = bowlR(), N = 10;
    var a0 = Math.PI / 2 - shovel.tilt - BOWL_SPAN, a1 = Math.PI / 2 - shovel.tilt + BOWL_SPAN;
    // back = extremite cote manche (a l'oppose du sens du geste), front = tranchant.
    var back = shovel.face > 0 ? a1 : a0, front = shovel.face > 0 ? a0 : a1;
    function pt(a, r) { return [shovel.cx + Math.cos(a) * r, shovel.cy + Math.sin(a) * r]; }
    // Epaisseur : forte a la douille, fine au tranchant. La face interieure reste
    // exactement sur l'arc de collision (rayon R) ; l'epaisseur est prise dessous.
    var thBack = BOWL_T * 1.6, thFront = 1.5;
    function th(t) { return thBack + (thFront - thBack) * Math.pow(t, 0.8); }

    // Manche : prolonge la courbe de la lame vers l'arriere, releve d'environ 20 deg.
    var tx = shovel.face * -Math.sin(back), ty = shovel.face * Math.cos(back);
    var dir = Math.atan2(ty, tx) + shovel.face * 0.35;
    var ux = Math.cos(dir), uy = Math.sin(dir), nx = -uy, ny = ux;
    var base = pt(back, R + thBack / 2);
    var sockLen = H * 0.035, shaftLen = H * 0.26;
    var sockEnd = [base[0] + ux * sockLen, base[1] + uy * sockLen];
    var grip = [sockEnd[0] + ux * shaftLen, sockEnd[1] + uy * shaftLen];
    function off(p, k) { return [p[0] + nx * k, p[1] + ny * k]; }
    // Manche en bois : deux facettes sur la longueur, legerement effile.
    ctx.fillStyle = '#b98352';
    poly([off(sockEnd, 3), off(grip, 2.4), grip, sockEnd]);
    ctx.fillStyle = '#8a5a30';
    poly([sockEnd, grip, off(grip, -2.4), off(sockEnd, -3)]);
    // Poignee en T.
    var g2 = [grip[0] + ux * 5, grip[1] + uy * 5];
    ctx.fillStyle = '#7a4d28';
    poly([off(grip, 7), off(g2, 7), off(g2, 0), off(grip, 0)]);
    ctx.fillStyle = '#5e3a1d';
    poly([off(grip, 0), off(g2, 0), off(g2, -7), off(grip, -7)]);
    // Douille metal (du talon de la lame vers le manche).
    ctx.fillStyle = '#6b7378';
    poly([off(base, thBack / 2 + 1), off(sockEnd, 3.2), sockEnd, base]);
    ctx.fillStyle = '#4c5256';
    poly([base, sockEnd, off(sockEnd, -3.2), off(base, -thBack / 2 - 1)]);

    // Lame : facettes du talon au tranchant. Face interieure claire (la ou la terre
    // repose), dessous plus fonce ; tons legerement alternes pour le low-poly.
    for (var i = 0; i < N; i++) {
      var t0 = i / N, t1 = (i + 1) / N;
      var aa = back + (front - back) * t0, ab = back + (front - back) * t1;
      var in0 = pt(aa, R), in1 = pt(ab, R);
      var mid0 = pt(aa, R + th(t0) * 0.45), mid1 = pt(ab, R + th(t1) * 0.45);
      var out0 = pt(aa, R + th(t0)), out1 = pt(ab, R + th(t1));
      ctx.fillStyle = i % 2 ? '#c9cfd2' : '#bcc3c7';
      poly([in0, in1, mid1, mid0]);
      ctx.fillStyle = i % 2 ? '#7d858a' : '#8a9297';
      poly([mid0, mid1, out1, out0]);
    }

    // Petit repere au curseur quand la pelle ne le suit plus (freinee par le compact) :
    // on voit ou on voulait aller.
    var bx = shovel.cx + Math.sin(shovel.tilt) * R, by = shovel.cy + Math.cos(shovel.tilt) * R;
    if (!shovel.pouring && Math.hypot(shovel.gx - bx, shovel.gy - by) > 10) {
      ctx.beginPath();
      ctx.arc(shovel.gx, shovel.gy, 6, 0, Math.PI * 2);
      ctx.moveTo(shovel.gx - 10, shovel.gy); ctx.lineTo(shovel.gx - 3, shovel.gy);
      ctx.moveTo(shovel.gx + 3, shovel.gy); ctx.lineTo(shovel.gx + 10, shovel.gy);
      ctx.moveTo(shovel.gx, shovel.gy - 10); ctx.lineTo(shovel.gx, shovel.gy - 3);
      ctx.moveTo(shovel.gx, shovel.gy + 3); ctx.lineTo(shovel.gx, shovel.gy + 10);
      // Contour fonce + trait clair : lisible sur la terre comme sur le fond clair.
      ctx.strokeStyle = 'rgba(40,25,15,0.8)'; ctx.lineWidth = 4; ctx.stroke();
      ctx.strokeStyle = '#fff7e8'; ctx.lineWidth = 2; ctx.stroke();
    }
  }

  // Clic/tap sans glisser : deterrer un tresor, rouvrir son infobulle, ou faire pousser.
  function handleTap(pos) {
    var t = treasureNear(pos.x, pos.y);
    if (t) {
      if (t.revealed) {
        openTip(t);
      } else {
        digAt(t);
        tryDig(t, 1);
      }
      return;
    }
    openTip(null);
    if (pos.y > surfaceAt(pos.x) - 40) sprout(pos.x);
  }

  // Outil main : vend un champignon mur issu du mycelium (pas les tresors, qui gardent
  // leur infobulle produit, ni les champignons plantes a la main sans valeur marchande).
  function harvestableNear(x, y) {
    for (var i = 0; i < mushrooms.length; i++) {
      var m = mushrooms[i];
      if (!m.myc || m.treasure || m.dying || m.t < 0.9) continue;
      if (Math.abs(x - m.x) < m.size * 0.9 && y > surfaceAt(m.x) - m.size * 1.6) return m;
    }
    return null;
  }
  function harvestAt(pos) {
    var m = harvestableNear(pos.x, pos.y);
    if (!m) return;
    m.dying = true;
    earn(MUSHROOM_PRICE);
  }

  // Ramasser/deposer a la main : contrairement a la pelle (qui entame la couche compacte
  // par pelletees), la main ne prend que ce qui traine deja en terre meuble, et tres peu a
  // la fois (HAND_GRAB_MAX facettes dans un rayon HAND_PICK_R) — un geste precis plutot
  // qu'un outil de terrassement. Tant qu'elles sont tenues, ces facettes suivent le curseur
  // (voir le bloc s.carried dans step()) au lieu d'obeir a la gravite ; les relacher
  // (endPress) les laisse simplement retomber et se poser normalement, comme n'importe
  // quelle facette deja delogee par la pelle (meme mecanique que bowlWakePile/pileAdd).
  var HAND_PICK_R = 14;                   // rayon de ramassage (px) : assez precis pour viser un point du tas
  var HAND_GRAB_MAX = 4;                  // une "poignee" : quelques facettes au plus, jamais une pelletee
  // Main dessinee (drawHand) : suit le curseur, ouverte en survol, poing ferme quand le
  // bouton est enfonce ou qu'elle tient quelque chose. hand.fist va de 0 (ouverte) a 1
  // (poing), hand.tilt s'incline dans le sens du geste, hand.lx sert a mesurer ce geste.
  // hand.grip = branche agrippee (voir handGrabTree), null sinon.
  var HAND_LEAF_MARGIN = 6;               // marge (px) autour d'une feuille pour l'arracher
  var HAND_LIMB_TOL = 12;                 // distance max (px) du curseur a un segment de branche pour l'agripper
  var HAND_BREAK_DIST = 40;               // ecart (px) au point de prise au-dela duquel la branche casse
  var LIMB_REGROW_MS = 120000;            // une branche maitresse cassee reapparait apres ce delai (temps de jeu, vTime)
  var hand = { x: 0, y: 0, on: false, fist: 0, tilt: 0, lx: 0, grip: null, px: 0, py: 0, pcx: 0, pcy: 0 };
  var handCarry = [];
  // Effleurement : la main qui BOUGE pousse un peu ce qu'elle frole, comme la pelle mais
  // tres doucement (voir handPush). Vitesse en px/frame, mesuree en repere monde moins le
  // defilement de la camera (une souris immobile pendant que le monde glisse ne pousse rien).
  var HAND_PUSH_R = 32;                   // rayon d'effet (px) autour de la paume, un peu > HAND_PICK_R
  var HAND_PUSH_MIN_V = 1.2;              // en dessous, le survol ne fait rien (un geste calme de souris fait ~3-10 px/frame)
  var HAND_PUSH_MAX_V = 14;               // vitesse de main retenue au plus (borne l'impulsion)
  var HAND_PUSH_LEAF = 0.4;               // part de la vitesse de la main transmise a une feuille en l'air (la chute amortit vite : 0.94-0.95/frame)
  var HAND_PUSH_LOOSE = 0.12;             // idem pour une facette posee delogee (beaucoup moins)
  var HAND_PUSH_P = 0.08;                 // chance par facette posee et par frame d'etre delogee
  var HAND_PUSH_MAX_LOOSE = 2;            // facettes posees delogees au plus par frame
  var HAND_PUSH_DEPTH = 8;                // seule la peau du tas (px sous la surface) peut bouger
  // Poing : main fermee (bouton enfonce, rien de tenu ni d'agrippe) qui BOUGE = elle brise
  // la terre sur son passage (voir fistStrike). Un "coup" tous les HAND_FIST_STEP px
  // parcourus ; chaque coup entame un peu le compact sous le poing et deloge de petits
  // blocs projetes dans le sens du geste. Il faut repasser pour creuser profond.
  var HAND_FIST_R = 13;                   // rayon du poing (px, monde)
  var HAND_FIST_MIN_V = 1.5;              // vitesse minimale (px/frame) pour compter comme geste
  var HAND_FIST_MAX_V = 14;               // vitesse retenue au plus pour la projection
  var HAND_FIST_STEP = 16;                // distance parcourue (px) entre deux coups
  var HAND_FIST_MAX_STRIKES = 2;          // coups au plus par frame (borne le cout d'un geste tres rapide)
  var HAND_FIST_DEPTH = 2.5;              // compactY descend au plus de ca (px) par colonne et par coup
  var HAND_FIST_SHARDS = 3;               // petits blocs neufs au plus par coup (sortis du compact)
  var HAND_FIST_LOOSE = 2;                // facettes posees delogees au plus par coup
  var HAND_FIST_SIZE = 0.7;               // taille d'un bloc, en fraction d'un bloc de pelle
  var HAND_FIST_KICK = 0.5;               // part de la vitesse du poing transmise aux blocs
  var HAND_FIST_SPREAD = 1.4;             // dispersion aleatoire de la vitesse (px/frame)
  var HAND_FIST_LIFT = 2.2;               // impulsion vers le haut des blocs (px/frame)
  var fistDist = 0;                       // distance parcourue par le poing depuis le dernier coup

  function enterHand(p) {
    hand.on = true;
    hand.x = hand.lx = hand.px = p.x; hand.y = hand.py = p.y;
    hand.pcx = camX; hand.pcy = camY;
    hand.fist = 0; hand.tilt = 0;
    container.classList.add('is-tool-cursor');
  }
  // Ne laisse jamais rien de tenu ni d'agrippe derriere : les facettes tenues retombent,
  // la branche agrippee revient droite (elle n'a pas casse).
  function leaveHand() {
    for (var i = 0; i < handCarry.length; i++) handCarry[i].carried = false;
    handCarry = [];
    hand.grip = null;
    hand.on = false; hand.fist = 0; hand.tilt = 0;
    container.classList.remove('is-tool-cursor');
  }

  // Distance d'un point (px,py) au segment a-b.
  function distToSeg(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    var u = l2 > 0 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
    return Math.hypot(px - (ax + dx * u), py - (ay + dy * u));
  }

  // Triangle allonge (style branche) de demi-longueur len oriente selon ang, centre sur
  // l'origine de la facette : base large d'un cote, pointe de l'autre.
  function branchTri(len, ang) {
    var c = Math.cos(ang), sn = Math.sin(ang), w = Math.max(2, len * 0.14);
    return [[-len * c - sn * w, -len * sn + c * w], [len * c, len * sn], [-len * c + sn * w, -len * sn - c * w]];
  }

  function leafAgeOf(lf, now) { return clamp((now - lf.born) / lf.life, 0, 1); }

  // Tente d'agripper quelque chose sur un arbre, dans l'ordre : feuille (arrachee, tenue
  // dans la main), puis branche (maitresse ou bonus : agrippee, elle casse si on tire assez,
  // voir updateHand). Retourne vrai si la main a pris quelque chose.
  function handGrabTree(pos) {
    var now = vTime, ti, i, t, tg, by, top, sl, lf;
    var bestLeaf = null, bestLeafT = null, bestLeafD = Infinity;
    for (ti = 0; ti < trees.length; ti++) {
      t = trees[ti]; tg = treeScale(t);
      by = t.by !== undefined ? t.by : surfaceAt(t.x) + TREE_EMBED; top = by - t.h * tg;
      for (i = 0; i < t.slots.length; i++) {
        sl = t.slots[i]; lf = sl.leaf;
        if (!lf || now < lf.born) continue;
        var d = Math.hypot(pos.x - (t.x + sl.dx * tg), pos.y - (top + sl.dy * tg));
        if (d <= lf.size * (lf.dg !== undefined ? lf.dg : 1) + HAND_LEAF_MARGIN && d < bestLeafD) {
          bestLeaf = sl; bestLeafT = t; bestLeafD = d;
        }
      }
    }
    if (bestLeaf) {
      t = bestLeafT; tg = treeScale(t); lf = bestLeaf.leaf;
      by = t.by !== undefined ? t.by : surfaceAt(t.x) + TREE_EMBED;
      var sh = makeLeafShard(lf, t.x + bestLeaf.dx * tg, by - t.h * tg + bestLeaf.dy * tg, leafAgeOf(lf, now));
      bestLeaf.leaf = null; // la place redevient libre, l'arbre en repoussera une autre
      sh.carried = true;
      sh.vx = sh.vy = 0;
      sh.hox = sh.x - pos.x; sh.hoy = sh.y - pos.y;
      shards.push(sh);
      handCarry.push(sh);
      return true;
    }
    // Branches : segments coudes des branches maitresses (pas les cassees) et branches
    // bonus (du tronc vers leur bout). Le tronc lui-meme n'est pas attrapable.
    var bestObj = null, bestKind = '', bestTree = null, bestD = HAND_LIMB_TOL;
    for (ti = 0; ti < trees.length; ti++) {
      t = trees[ti]; tg = treeScale(t);
      by = t.by !== undefined ? t.by : surfaceAt(t.x) + TREE_EMBED; top = by - t.h * tg;
      for (i = 0; i < t.limbs.length; i++) {
        var lm = t.limbs[i];
        if (lm.broken !== undefined) continue;
        var sx = t.x, sy = top + t.h * tg * lm.f, ex = t.x + lm.dx * tg, ey = top + lm.dy * tg;
        var mx = (sx + ex) / 2 - (ey - sy) * lm.bend, my = (sy + ey) / 2 + (ex - sx) * lm.bend;
        var dl = Math.min(distToSeg(pos.x, pos.y, sx, sy, mx, my), distToSeg(pos.x, pos.y, mx, my, ex, ey));
        if (dl < bestD) { bestD = dl; bestObj = lm; bestKind = 'limb'; bestTree = t; }
      }
      for (i = 0; i < t.slots.length; i++) {
        sl = t.slots[i];
        if (!sl.branch) continue;
        var bg = Math.min(1, (now - sl.branchSince) / BRANCH_GROW_MS);
        var db = distToSeg(pos.x, pos.y, t.x, top + t.h * tg * 0.12, t.x + sl.dx * tg * bg, top + sl.dy * tg * bg);
        if (db < bestD) { bestD = db; bestObj = sl; bestKind = 'bonus'; bestTree = t; }
      }
    }
    if (!bestObj) return false;
    hand.grip = { t: bestTree, obj: bestObj, kind: bestKind, gx: pos.x, gy: pos.y };
    return true;
  }

  // Branche maitresse arrachee : marquee cassee (drawTree ne la dessine plus, ses places de
  // feuilles ne recoivent plus rien jusqu'a LIMB_REGROW_MS), ses feuilles tombent, et le
  // bois devient une facette allongee que la main tient. Retourne cette facette.
  function breakLimb(t, lm, now) {
    var k = t.limbs.indexOf(lm), tg = treeScale(t);
    var by = t.by !== undefined ? t.by : surfaceAt(t.x) + TREE_EMBED, top = by - t.h * tg;
    lm.broken = now;
    for (var i = 0; i < t.slots.length; i++) {
      var sl = t.slots[i];
      if (sl.limb !== k || !sl.leaf) continue;
      shards.push(makeLeafShard(sl.leaf, t.x + sl.dx * tg, top + sl.dy * tg, leafAgeOf(sl.leaf, now)));
      sl.leaf = null;
    }
    var sx = t.x, sy = top + t.h * tg * lm.f, ex = t.x + lm.dx * tg, ey = top + lm.dy * tg;
    var wood = makeWoodShard(hand.x, hand.y, branchTri(Math.hypot(ex - sx, ey - sy) * 0.5, Math.atan2(ey - sy, ex - sx)));
    shards.push(wood);
    return wood;
  }

  // Branche bonus arrachee : meme sortie que sa chute naturelle (shedBranchSlot, voir
  // stepTrees), mais le bois est renvoye pour etre tenu.
  function breakBonusBranch(t, sl, now) {
    var tg = treeScale(t);
    var by = t.by !== undefined ? t.by : surfaceAt(t.x) + TREE_EMBED, top = by - t.h * tg;
    var bg = Math.min(1, (now - sl.branchSince) / BRANCH_GROW_MS);
    var ex = t.x + sl.dx * tg * bg, ey = top + sl.dy * tg * bg, sy = top + t.h * tg * 0.12;
    var wood = shedBranchSlot(t, sl, now, branchTri(Math.hypot(ex - t.x, ey - sy) * 0.5, Math.atan2(ey - sy, ex - t.x)), true);
    var idx = t.slots.indexOf(sl);
    if (idx >= 0) t.slots.splice(idx, 1);
    return wood;
  }

  function breakGrip(now) {
    var g = hand.grip;
    hand.grip = null;
    if (!g) return;
    var wood = g.kind === 'limb' ? breakLimb(g.t, g.obj, now) : breakBonusBranch(g.t, g.obj, now);
    wood.x = wood.px = hand.x; wood.y = wood.py = hand.y;
    wood.vx = wood.vy = wood.vr = 0;
    wood.carried = true; wood.hox = 0; wood.hoy = 0;
    handCarry.push(wood);
  }

  // Appelee par step() tant que la main est affichee : casse la branche agrippee quand on
  // tire trop loin, anime le poing et l'inclinaison. Retourne vrai si une animation continue.
  function updateHand(now) {
    var busy = false, g = hand.grip;
    if (g) {
      if (g.kind === 'bonus' && g.t.slots.indexOf(g.obj) < 0) hand.grip = null; // sa place a disparu entre-temps
      else if (Math.hypot(hand.x - g.gx, hand.y - g.gy) > HAND_BREAK_DIST) breakGrip(now);
      else busy = true;
    }
    var goal = ((pointerDown && tool === 'hand') || handCarry.length || hand.grip) ? 1 : 0;
    hand.fist += (goal - hand.fist) * 0.35;
    if (Math.abs(goal - hand.fist) < 0.02) hand.fist = goal; else busy = true;
    var tiltGoal = clamp((hand.x - hand.lx) * 0.05, -0.4, 0.4);
    hand.lx = hand.x;
    hand.tilt += (tiltGoal - hand.tilt) * 0.2;
    if (Math.abs(tiltGoal - hand.tilt) > 0.005 || Math.abs(hand.tilt) > 0.01) busy = true;
    // Vitesse reelle du geste (monde, camera deduite), puis effleurement des facettes.
    var hvx = hand.x - hand.px - (camX - hand.pcx), hvy = hand.y - hand.py - (camY - hand.pcy);
    hand.px = hand.x; hand.py = hand.y; hand.pcx = camX; hand.pcy = camY;
    var sp2 = hvx * hvx + hvy * hvy;
    if (mode === 'exploded' && sp2 >= HAND_PUSH_MIN_V * HAND_PUSH_MIN_V) {
      handPush(hvx, hvy);
      busy = true;
    }
    // Poing : bouton enfonce et rien de tenu (pickUpHand/handGrabTree n'ont rien pris).
    if (mode === 'exploded' && pointerDown && tool === 'hand' && !handCarry.length && !hand.grip) {
      if (sp2 >= HAND_FIST_MIN_V * HAND_FIST_MIN_V) {
        fistDist += Math.min(Math.sqrt(sp2), 30);
        for (var fs = 0; fistDist >= HAND_FIST_STEP && fs < HAND_FIST_MAX_STRIKES; fs++) {
          fistDist -= HAND_FIST_STEP;
          fistStrike(hvx, hvy);
        }
        if (fistDist > HAND_FIST_STEP) fistDist = HAND_FIST_STEP; // pas de rattrapage apres un geste tres rapide
        busy = true;
      }
    } else fistDist = 0;
    return busy;
  }

  // Un coup de poing en (hand.x, hand.y), geste (hvx,hvy) : (1) deloge quelques facettes
  // posees de terre meuble a portee, (2) entame le compact sous le poing (profil circulaire,
  // au plus HAND_FIST_DEPTH par colonne, jamais la roche-mere) et libere de petits blocs
  // via makeDecompactShard (meme mecanique et meme dette que la pelle, voir cutCompact),
  // (3) reveille ce qui devient suspendu et deterre un peu les tresors proches.
  function fistStrike(hvx, hvy) {
    var sp = Math.hypot(hvx, hvy);
    if (sp > HAND_FIST_MAX_V) { hvx *= HAND_FIST_MAX_V / sp; hvy *= HAND_FIST_MAX_V / sp; }
    var R = HAND_FIST_R, limit = worldH - BEDROCK_MARGIN, i, c;
    // (1) Terre meuble posee a portee : delogee, projetee dans le sens du geste.
    var loose = 0;
    for (i = 0; i < shards.length && loose < HAND_FIST_LOOSE; i++) {
      var s = shards[i];
      if (!s.settled || s.carried || s.dead || s.eaten !== undefined || s.grain) continue;
      if (s.soil || s.myc || s.nutri || s.deadMyc || !s.kcol) continue; // maillage d'origine, mycelium : jamais
      var sdx = s.x - hand.x, sdy = s.y - hand.y;
      if (sdx > R || sdx < -R || sdy > R || sdy < -R || sdx * sdx + sdy * sdy > R * R) continue;
      pileRemove(s);
      s.settled = false;
      s.vx = hvx * HAND_FIST_KICK + (Math.random() - 0.5) * HAND_FIST_SPREAD * 2;
      s.vy = hvy * HAND_FIST_KICK - HAND_FIST_LIFT * (0.4 + Math.random() * 0.6);
      s.vr = (Math.random() - 0.5) * 0.4;
      s.px = s.x; s.py = s.y;
      loose++;
    }
    // (2) Compact sous le poing.
    var c0 = Math.max(0, Math.floor((hand.x - R) / COL_W)), c1 = Math.min(compactY.length - 1, Math.ceil((hand.x + R) / COL_W));
    var cut = null;
    for (c = c0; c <= c1; c++) {
      if (rocky[c]) continue;               // roche-mere : le poing ne l'entame pas plus que la pelle
      var ddx = c * COL_W - hand.x;
      if (ddx > R || ddx < -R) continue;
      var bottom = hand.y + Math.sqrt(R * R - ddx * ddx);
      if (bottom <= compactY[c]) continue;
      var newTop = Math.min(bottom, compactY[c] + HAND_FIST_DEPTH, limit);
      var removed = newTop - compactY[c];
      if (removed <= 0) continue;
      compactY[c] = newTop;
      compactDebt += removed * COL_W * DECOMPACT_BULK;
      if (!cut) cut = {};
      cut[c] = true;
      // Humus lessive redevenu accessible : rendu a la surface, comme la pelle.
      for (var ni = compactNutri.length - 1; ni >= 0; ni--) {
        var dep = compactNutri[ni];
        if (Math.round(dep.x / COL_W) !== c || dep.y >= newTop) continue;
        compactNutri.splice(ni, 1);
        makeDecompactShard(c * COL_W, surfaceAt(c * COL_W) - 3, hvx * HAND_FIST_KICK, -HAND_FIST_LIFT, dep.color, HAND_FIST_SIZE);
      }
    }
    if (cut) {
      var cols = Object.keys(cut), made = 0, guard = 0;
      while (compactDebt > 0 && made < HAND_FIST_SHARDS && guard++ < 10) {
        var col = +cols[(Math.random() * cols.length) | 0];
        compactDebt -= makeDecompactShard(
          (col + Math.random() - 0.5) * COL_W, surfaceAt(col * COL_W) - 3,
          hvx * HAND_FIST_KICK + (Math.random() - 0.5) * HAND_FIST_SPREAD * 2,
          hvy * HAND_FIST_KICK - HAND_FIST_LIFT * (0.4 + Math.random() * 0.6),
          undefined, HAND_FIST_SIZE);
        made++;
      }
      if (compactDebt > 150) compactDebt = 150; // dette bornee : un poing ne rattrape pas une montagne
      wakeSuspended(cut);
      // (3) Un tresor enfoui juste sous le poing se deterre peu a peu.
      for (i = 0; i < treasures.length; i++) {
        var t = treasures[i];
        if (!t.revealed && Math.abs(t.x - hand.x) < R + 15) tryDig(t, 0.02);
      }
    }
  }

  // Effleurement par la main en mouvement (vitesse hvx,hvy). Feuilles en l'air : impulsion
  // dans le sens du geste, plus forte au centre de la zone. Facettes posees (terre meuble,
  // feuilles, bois) : a peine quelques-unes delogees, seulement si la main ne tient rien, et
  // sans jamais toucher a compactY ni au tas au-dela de la peau superieure.
  function handPush(hvx, hvy) {
    var sp = Math.hypot(hvx, hvy);
    if (sp > HAND_PUSH_MAX_V) { hvx *= HAND_PUSH_MAX_V / sp; hvy *= HAND_PUSH_MAX_V / sp; }
    // Bouton enfonce = poing (voir fistStrike) : l'effleurement ne deloge alors plus de terre posee.
    var busyHand = handCarry.length > 0 || hand.grip !== null || !!pointerDown, loose = 0;
    for (var i = 0; i < shards.length; i++) {
      var s = shards[i];
      if (s.carried || s.dead || s.eaten !== undefined || s.grain) continue;
      var dx = s.x - hand.x, dy = s.y - hand.y;
      if (dx > HAND_PUSH_R || dx < -HAND_PUSH_R || dy > HAND_PUSH_R || dy < -HAND_PUSH_R) continue;
      var d = Math.hypot(dx, dy);
      if (d > HAND_PUSH_R) continue;
      var k = 1 - d / HAND_PUSH_R;
      if (!s.settled) {
        if (!s.leaf) continue;            // seules les feuilles/le bois en l'air sont sensibles
        s.vx += hvx * HAND_PUSH_LEAF * k;
        s.vy += hvy * HAND_PUSH_LEAF * k;
        s.vr = clamp(s.vr + hvx * 0.01 * k, -0.4, 0.4);
        continue;
      }
      if (busyHand || loose >= HAND_PUSH_MAX_LOOSE) continue;
      if (s.soil || s.myc || s.nutri || s.deadMyc || !s.kcol) continue; // maillage d'origine, mycelium : jamais
      if (s.y > surfaceAt(s.x) + HAND_PUSH_DEPTH) continue;             // enfouie sous la peau du tas
      if (Math.random() > HAND_PUSH_P * k * 2) continue;
      pileRemove(s);
      s.settled = false;
      s.vx = hvx * HAND_PUSH_LOOSE; s.vy = Math.min(hvy * HAND_PUSH_LOOSE, 0) - 0.6 - Math.random() * 0.6;
      s.vr = (Math.random() - 0.5) * 0.2;
      s.px = s.x; s.py = s.y;
      loose++;
    }
  }

  // Tension de la branche agrippee du meme arbre, 0..1 (sert au tremblement, voir drawTree).
  function handTension(t) {
    var g = hand.grip;
    if (!g || g.t !== t) return 0;
    return Math.min(1, Math.hypot(hand.x - g.gx, hand.y - g.gy) / HAND_BREAK_DIST);
  }

  var HAND_SKIN = ['#e8b48a', '#cf9670', '#b57c58']; // clair, moyen, ombre
  function handPoly(p) { poly(p); ctx.stroke(); }
  // Main low-poly : l'origine locale est le centre de la paume (le point du curseur), doigts
  // vers le haut. Ouverte (fist = 0) : 4 doigts en eventail et pouce ecarte ; poing (fist = 1) :
  // doigts raccourcis dont le bout se replie sur la paume, pouce en travers.
  function drawHand() {
    if (!hand.on) return;
    var f = hand.fist, k = clamp(H / 500, 0.7, 1.3), i;
    ctx.save();
    ctx.translate(hand.x, hand.y);
    ctx.rotate(hand.tilt);
    ctx.scale(k, k);
    ctx.lineJoin = 'round'; ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(60,35,20,0.5)';
    // Poignet, puis paume en deux facettes.
    ctx.fillStyle = HAND_SKIN[2];
    handPoly([[-7, 13], [7, 13], [6, 27], [-6, 27]]);
    ctx.fillStyle = HAND_SKIN[0];
    handPoly([[-11, -8], [11, -8], [-9, 14]]);
    ctx.fillStyle = HAND_SKIN[1];
    handPoly([[11, -8], [9, 14], [-9, 14]]);
    // Doigts : deux facettes chacun (gauche claire, droite plus foncee), effiles.
    var spread = 1 - 0.8 * f, lenK = 1 - 0.78 * f;
    for (i = 0; i < 4; i++) {
      var a = -Math.PI / 2 + (i - 1.5) * 0.15 * spread, ux = Math.cos(a), uy = Math.sin(a), nx = uy, ny = -ux;
      var len = [14, 18, 16.5, 12][i] * lenK, bx = -8.2 + i * 5.47, by = -7.5;
      var tx = bx + ux * len, ty = by + uy * len, wb = 2.9, wt = 2.1;
      ctx.fillStyle = HAND_SKIN[0];
      handPoly([[bx + nx * wb, by + ny * wb], [tx + nx * wt, ty + ny * wt], [tx, ty], [bx, by]]);
      ctx.fillStyle = HAND_SKIN[1];
      handPoly([[bx, by], [tx, ty], [tx - nx * wt, ty - ny * wt], [bx - nx * wb, by - ny * wb]]);
      if (f > 0.05) {
        // Bout du doigt replie sur la paume (les jointures du poing).
        ctx.fillStyle = HAND_SKIN[i % 2 ? 1 : 2];
        handPoly([[tx - wt, ty], [tx + wt, ty], [tx + wt * 0.9, ty + 10 * f], [tx - wt * 0.9, ty + 10 * f]]);
      }
    }
    // Pouce : ecarte vers le haut-gauche ouvert, en travers des doigts une fois ferme.
    var ta = lerp(-Math.PI / 2 - 1.15, -0.46, f), tl = lerp(15, 13, f);
    var tux = Math.cos(ta), tuy = Math.sin(ta), tnx = tuy, tny = -tux;
    var tbx = -10, tby = 5, tex = tbx + tux * tl, tey = tby + tuy * tl;
    ctx.fillStyle = HAND_SKIN[0];
    handPoly([[tbx + tnx * 3.6, tby + tny * 3.6], [tex + tnx * 2.6, tey + tny * 2.6], [tex, tey], [tbx, tby]]);
    ctx.fillStyle = HAND_SKIN[1];
    handPoly([[tbx, tby], [tex, tey], [tex - tnx * 2.6, tey - tny * 2.6], [tbx - tnx * 3.6, tby - tny * 3.6]]);
    ctx.restore();
  }

  function pickUpHand(pos) {
    if (handCarry.length) return;         // deja les mains pleines
    for (var i = 0; i < shards.length && handCarry.length < HAND_GRAB_MAX; i++) {
      var s = shards[i];
      // Les feuilles et le bois deja poses au sol se ramassent aussi : ils restent dans
      // litter (stepTrees ignore ce qui n'est plus settled) et le chemin d'atterrissage de
      // step() les y remet en conservant leur avancement de decomposition.
      if (!s.settled || s.grain || s.myc || s.nutri || s.deadMyc) continue;
      if (Math.hypot(s.x - pos.x, s.y - pos.y) > HAND_PICK_R) continue;
      pileRemove(s);
      s.settled = false;
      s.carried = true;
      s.vx = s.vy = s.vr = 0;
      s.hox = s.x - pos.x; s.hoy = s.y - pos.y; // garde sa position relative dans la poignee
      handCarry.push(s);
    }
  }

  // fromMyc : true quand la grappe sort d'une zone de mycelium bien blanche
  // (spreadMycelium) plutot que plantee a la main (tap sur la terre nue, handleTap) —
  // seule celle-la fane si le mycelium qui l'a fait sortir disparait (voir step()).
  function sprout(x, fromMyc) {
    var sp = SPECIES[speciesIdx++ % SPECIES.length];
    var n = 1 + ((Math.random() * 3) | 0);
    var mainMushroom = null;
    for (var i = 0; i < n; i++) {
      var side = i === 0 ? 0 : (i === 1 ? -1 : 1);
      var size = H * 0.2 * (0.6 + Math.random() * 0.6) * (i === 0 ? 1.15 : 0.85);
      var m = {
        x: x + side * size * 0.55, size: size,
        lean: (Math.random() - 0.5) * 0.35 + side * 0.2,
        sp: sp, t: -i * 0.25,   // t negatif = petit decalage de pousse dans la grappe
        myc: !!fromMyc, lastMycNear: vTime
      };
      mushrooms.push(m);
      if (i === 0) mainMushroom = m;
    }
    var alive = mushrooms.filter(function (m) { return !m.dying && !m.treasure; });
    for (i = 0; i < alive.length - MAX_MUSHROOMS; i++) alive[i].dying = true;
    // Bulle produit : seulement au tout premier champignon issu du mycelium verse par le
    // visiteur (pas les champignons plantes a la main ni les tresors), une fois par
    // chargement de page (mycTipShown ne se reinitialise jamais, meme au rebuild).
    if (fromMyc && !mycTipShown) {
      mycTipShown = true;
      mycTipMushroom = mainMushroom;
      mycTip = buildTip({
        title: 'Cultivez vos propres champignons avec notre mycélium!',
        url: '/product/mycelium-en-vrac',
        cta: 'Précommander'
      });
      container.appendChild(mycTip);
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
  function infect(s, ox, oy, amount, now, lastFed, parent) {
    if (s.myc || s.grain || s.nutri || s.deadMyc || isRocky(s.x)) return;
    s.myc = amount;
    s.mycParent = parent || null;
    s.hyJ = (Math.random() - 0.5) * 8;
    s.hyTw = [Math.random() * 6.283, 3 + Math.random() * 4];
    if (Math.random() < 0.5) s.hyTw.push(Math.random() * 6.283, 3 + Math.random() * 4);
    s.hyF = [];
    for (var hi = 0; hi < 3; hi++) s.hyF.push((Math.random() - 0.5) * 8, -1.5708 + (Math.random() - 0.5) * 1.2, 2 + Math.random() * 2);
    s.mox = ox; s.moy = oy;               // point d'inoculation : borne la portee (MYC_RADIUS)
    s.mycTone = 0.7 + Math.random() * 0.2; // jamais tout a fait blanc : les facettes restent lisibles
    s.lastFed = lastFed !== undefined ? lastFed : now;
    colonised.push(s);
    mycBusyUntil = frame + 120;
  }

  function inoculate(x, y, now) {
    for (var i = 0; i < shards.length; i++) {
      var s = shards[i];
      if (!s.settled || Math.abs(s.x - x) > 12 || Math.abs(s.y - y) > 12) continue;
      infect(s, x, y, 0.06, now);
    }
  }

  // Retourne true tant que quelque chose change (la boucle de rendu doit tourner).
  // Sans bois a decomposer a portee (voir stepTrees, qui met a jour c.lastFed), un
  // mycelium colonise finit par s'eteindre et la facette redevient de la terre normale.
  function stepMycelium(now) {
    var busy = frame < mycBusyUntil;
    var deathCheck = now >= mycNextDeathCheck;
    if (deathCheck) mycNextDeathCheck = now + MYC_RANDOM_DEATH_CHECK_MS;
    for (var i = colonised.length - 1; i >= 0; i--) {
      var c = colonised[i], droughtHit = false;
      // La secheresse peut faner un mycelium en surface meme s'il est activement nourri :
      // elle agit sur l'exposition, pas sur la faim (voir DROUGHT_* pres de updateWeather).
      if (deathCheck && c.myc > 0 && Math.random() < MYC_RANDOM_DEATH_P) {
        c.myc = 0; // mort aleatoire : meme sortie que la faim (voir plus bas)
        busy = true;
      } else if (weather.drought && c.y - surfaceAt(c.x) < DROUGHT_SURFACE_DEPTH && Math.random() < DROUGHT_KILL_P) {
        c.myc -= MYC_DROUGHT_DECAY;
        busy = true;
        droughtHit = true;
      } else if (c.myc < 1 && (now - c.lastFed < MYC_STARVE_MS)) { c.myc = Math.min(1, c.myc + MYC_GROW); busy = true; continue; }
      else if (now - c.lastFed >= MYC_STARVE_MS) {
        c.myc -= MYC_DECAY;
        busy = true;
      }
      if (c.myc <= 0) {
        c.myc = 0;
        if (droughtHit) {
          // Contrairement a la mort de faim, la secheresse laisse un mycelium mort mais
          // toujours en place (deadMyc) : ni vivant ni nutriment, jusqu'a ce que la pluie le
          // decompose (voir decomposeDeadMyc).
          c.deadMyc = true;
          var deadColor = hexToRgb(MYC_DEAD[(Math.random() * MYC_DEAD.length) | 0]);
          c.from = deadColor; c.to = deadColor; c.mix = 1; c.nutri = null;
          deadMyc.push(c);
        } else if (c.leaf) {
          // Le mycelium qui meurt de faim SUR DE LA LITIERE devient lui-meme un nutriment
          // (necromasse) : comme dans la vraie vie, sa propre mort nourrit encore le sol et
          // les arbres. Sur de la terre ordinaire (pas de litiere), voir le else ci-dessous :
          // la terre elle-meme n'a jamais de valeur nutritive, elle redevient juste de la
          // terre (le blanchiment disparait deja tout seul puisque le rendu suit c.myc).
          c.nutri = NUTRI[(Math.random() * NUTRI.length) | 0];
          c.nutriSince = now;
        }
        colonised.splice(i, 1);
        if (!c.deadMyc) c.mycParent = null; // redevient de la terre normale (le mort garde son filament)
      }
    }
    if (frame % MYC_SPREAD_EVERY === 0) spreadMycelium(now);
    return busy;
  }

  // Grille de voisinage refaite a chaque passage : la pelle deplace les facettes.
  function spreadMycelium(now) {
    var D = 14, radius = H * MYC_RADIUS, grid = new Map(), i, s, b;
    for (i = 0; i < shards.length; i++) {
      s = shards[i];
      if (!s.settled) continue;
      var key = ((s.x / D) | 0) * 1024 + ((s.y / D) | 0);
      var cell = grid.get(key);
      if (cell) cell.push(s); else grid.set(key, [s]);
    }
    var buckets = {}, fw = H * FRUIT_W;
    for (i = 0; i < colonised.length; i++) {
      var c = colonised[i];
      if (!c.settled || c.myc < MYC_READY) continue;
      if (c.myc > 0.9 && c.y - surfaceAt(c.x) < 18) {
        b = Math.floor(c.x / fw);
        (buckets[b] = buckets[b] || []).push(c.x);
      }
      if (c.mycIdle > frame || Math.random() > MYC_SPREAD_P) continue;
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
      if (!free.length) { c.mycIdle = frame + 90; continue; }
      // Herite l'horloge de faim du parent : se repandre dans la terre ne nourrit pas.
      infect(free[(Math.random() * free.length) | 0], c.mox, c.moy, 0.02, now, c.lastFed, c);
    }
    // Une zone de surface bien blanche fructifie une fois.
    for (b in buckets) {
      var xs = buckets[b];
      if (fruited[b] || xs.length < FRUIT_MIN) continue;
      fruited[b] = true;
      sprout(xs[(Math.random() * xs.length) | 0], true);
    }
  }

  // --- Sac de mycelium ---------------------------------------------------------------
  // Le goulot du sac est au curseur. Bouton maintenu (ou doigt pose) : le sac bascule
  // et les grains coulent ; relache, il se redresse.
  var bag = { on: false, pouring: false, x: 0, y: 0, rot: 1.9 };

  function enterBag(p) {
    bag.on = true;
    bag.x = p.x; bag.y = p.y;
    container.classList.add('is-tool-cursor');
  }
  function leaveBag() {
    bag.on = false; bag.pouring = false;
    container.classList.remove('is-tool-cursor');
  }

  function updateBag() {
    var goal = bag.pouring ? 0.45 : 1.9;
    bag.rot += (goal - bag.rot) * 0.18;
    if (!bag.pouring || bag.rot > 1) return; // les grains coulent une fois le sac bascule
    if (bagGrainsLeft <= 0) {
      bag.pouring = false; // sac vide : se redresse tout seul
      setCaption(CAPTION_BAG_EMPTY);
      return;
    }
    var n = Math.min(bagGrainsLeft, Math.random() < 0.5 ? 2 : 1);
    bagGrainsLeft -= n;
    for (var i = 0; i < n; i++) {
      var r = 1.8 + Math.random() * 1.6, a = Math.random() * Math.PI * 2;
      var color = hexToRgb(GRAIN[(Math.random() * GRAIN.length) | 0]);
      shards.push({
        pts: [0, 1, 2].map(function (j) {
          var t = a + j * 2.1 + (Math.random() - 0.5) * 0.5;
          return [Math.cos(t) * r, Math.sin(t) * r];
        }),
        x: bag.x + (Math.random() - 0.5) * 5, y: bag.y + 2,
        vx: (Math.random() - 0.5) * 0.8, vy: 0.5 + Math.random(),
        rot: 0, vr: (Math.random() - 0.5) * 0.3,
        from: color, to: color, mix: 1, area: 0, settled: false, col: -1, grain: true
      });
    }
  }

  function drawBag() {
    if (!bag.on) return;
    var k = clamp(H / 500, 0.7, 1.3);
    ctx.save();
    ctx.translate(bag.x, bag.y);
    ctx.rotate(bag.rot);
    ctx.scale(k, k);
    // Goulot (plastique froisse), puis le corps : plastique clair autour du grain colonise.
    ctx.fillStyle = '#c9cfd0';
    poly([[-6, 0], [0, 0], [-6, -12], [-17, -12]]);
    ctx.fillStyle = '#b3babc';
    poly([[0, 0], [6, 0], [17, -12], [-6, -12]]);
    ctx.fillStyle = '#dde2e2';
    poly([[-17, -12], [17, -12], [15, -64], [-15, -64]]);
    ctx.fillStyle = '#f1ebdd';
    poly([[-14, -15], [14, -15], [-12, -40]]);
    ctx.fillStyle = '#e4dac5';
    poly([[14, -15], [12, -61], [-12, -40]]);
    ctx.fillStyle = '#f7f3ea';
    poly([[-12, -40], [12, -61], [-12, -61]]);
    // Filtre du sac.
    ctx.fillStyle = '#cbbf9f';
    poly([[-6, -50], [6, -50], [6, -58], [-6, -58]]);
    ctx.restore();
  }

  // --- Pluie naturelle -------------------------------------------------------------------
  // Plus un outil : un cycle sec/averse tourne seul en mode 'exploded' (voir updateWeather),
  // rythme par vTime (donc accelere par le slider de vitesse). Le curseur Pluie (rainLevel,
  // 0..1) regle la frequence et la duree des averses ; a 0 il ne pleut jamais. Pendant une
  // averse il pleut sur TOUTE la largeur du monde : les gouttes ne sont creees que dans la
  // vue visible (camX..camX+W, par souci de performance) mais le lessivage (voir leach())
  // s'applique sur tout le monde. Quelques nuages bas-poly derivent lentement en haut de la
  // vue pendant l'averse, avec un fondu en entree/sortie. Les gouttes vivent dans leur
  // propre tableau (pas dans shards) : bien plus nombreuses et bien plus simples qu'une
  // facette, les melanger aux shards couterait cher pour rien.
  var RAIN_CLOUD_Y_FRAC = 0.12;           // hauteur des nuages dans la vue, sous camY (x hauteur de la boite)
  var RAIN_DRY_MS = [120000, 20000];      // duree seche, lerp(min,max,rainLevel) puis x(0.6..1.4) aleatoire
  var RAIN_SHOWER_MS = [8000, 20000];     // duree d'une averse, lerp(min,max,rainLevel) puis x(0.7..1.3) aleatoire
  var RAIN_FADE_MS = 2500;                // fondu (entree et sortie) des nuages
  var RAIN_DROP_MAX = 220;                // nombre max de gouttes en vol (vue visible seulement)
  var RAIN_DROP_VY = [7, 11];             // vitesse de chute d'une goutte (px/frame, min/max)
  var RAIN_SPAWN_MAX = 5;                 // gouttes creees par frame a rainLevel = 1 (echelle avec rainLevel)
  var RAIN_CLOUDS_N = 4;                  // nombre de nuages pendant une averse, repartis sur le monde
  var RAIN_CLOUD_DRIFT = 0.006;           // vitesse de derive des nuages (px monde / ms)
  // En temps VIRTUEL (vTime), pas en frames reelles : weather.changeAt (duree d'une averse)
  // est lui aussi en vTime, donc accelere pareil par le curseur de vitesse debug
  // (timeScale). Avec un gate en frames reelles (l'ancien LEACH_EVERY), une averse deja
  // 4x plus courte en temps reel a x4 recevait EN PLUS le meme nombre de tentatives de
  // lessivage par seconde reelle qu'a x1 (le calcul de frame ne connait pas timeScale) :
  // le lessivage se retrouvait ~4x plus faible par rapport au reste du cycle (decomposition,
  // repas des racines), qui lui accelere bien avec vTime — d'ou l'absence de perte de
  // nutriments observee en testant a vitesse elevee, alors qu'a x1 l'equilibre est correct.
  var LEACH_INTERVAL_MS = 10;              // le lessivage (voir leach()) se recalcule a ce rythme
  var LEACH_MAX_STEPS_PER_FRAME = 200;     // plafond de rattrapage par frame reelle (voir updateRainDrops) : evite un gel si vTime saute enormement
  // Ne s'applique qu'au sol PAS retenu par du mycelium vivant (heldByMycelium court-circuite
  // deja les facettes protegees avant ce jet, voir leach()) : augmenter cette valeur rend
  // donc specifiquement le sol sans vie plus "qui fuit", sans toucher au sol vivant.
  // Les feuilles tombees (en attente de decomposition) descendent un peu avec la pluie, mais
  // bien moins et autrement que l'humus : un petit deplacement vers le bas, plafonne par
  // averse, pour qu'elles ne restent pas en gigantesques piles en surface et finissent par
  // atteindre le mycelium (qui les mange). Elles s'arretent sur le compact ou une autre feuille.
  var LEAF_RAIN_P = 0.08;                 // chance, par passage de lessivage (frame de pluie), qu'une feuille au sol descende d'un cran
  var LEAF_RAIN_STEP = 1.5;               // px descendus par cran
  var WOOD_RAIN_MULT = 0.35;              // le bois (branches) descend aussi avec la pluie, a cette fraction de la chance et de la descente max des feuilles
  var LEAF_RAIN_MAX_DROP = 40;           // descente max (px) par averse pour une meme feuille
  var LEACH_P = 0.4;                      // chance de base, par tick de lessivage, qu'un humus meuble descende d'un cran
  var COMPACT_SINK_SPEED = 0.08;          // vitesse (px/tick de lessivage) a laquelle un depot deja enfonce dans le compact continue de couler ; doit rester lente, sinon il sort de depthReach avant que les racines l'atteignent
  // Secheresse : meme principe qu'une averse mais inverse (voir stepMycelium) — pendant une
  // periode seche, un mycelium en surface (a portee de la fructification, DROUGHT_SURFACE_DEPTH)
  // peut secher et mourir directement, sans lien avec la faim. Jamais en meme temps qu'une
  // averse : startShower() coupe toute secheresse en cours et redemarre son delai, et le
  // cycle secheresse ne tourne que quand weather.raining est faux (voir updateWeather). Reglee
  // par son propre curseur Secheresse (droughtLevel, 0..1, independant du curseur Pluie) ; a 0
  // il ne seche jamais.
  var DROUGHT_MS = [10000, 30000];        // duree d'une secheresse, lerp(min,max,droughtLevel) puis x(0.7..1.3) aleatoire
  var DROUGHT_GAP_MS = [90000, 25000];    // duree normale (sans secheresse) entre deux, lerp(min,max,droughtLevel) puis x(0.7..1.3) aleatoire
  var DROUGHT_SURFACE_DEPTH = 18;         // "en surface" = meme seuil que la fructification (c.y - surfaceAt(c.x))
  var DROUGHT_KILL_P = 0.02;              // chance par frame qu'une facette de mycelium exposee prenne un coup de sec
  var MYC_DROUGHT_DECAY = 0.15;           // blanchiment perdu a chaque coup de sec (facette exposee) : ~5s d'exposition continue pour tuer un mycelium plein
  // Tempete : une averse normale qui s'intensifie ponctuellement (jamais hors d'une averse
  // deja en cours, voir updateWeather) — le lessivage y est multiplie par STORM_LEACH_MULT.
  // Reglee par son propre curseur Tempetes (stormLevel, 0..1, independant du curseur Pluie) ;
  // a 0 il n'y a jamais de tempete, seulement de la pluie normale.
  var STORM_MS = [4000, 12000];           // duree d'une tempete, lerp(min,max,stormLevel) puis x(0.7..1.3) aleatoire
  var STORM_GAP_MS = [60000, 15000];      // duree normale (pluie sans tempete) entre deux, lerp(min,max,stormLevel) puis x(0.7..1.3) aleatoire
  var STORM_LEACH_MULT = 5;               // multiplicateur du lessivage (LEACH_P) pendant une tempete
  var STORM_SPAWN_MULT = 2.5;             // multiplicateur du nombre de gouttes affichees pendant une tempete (visuel seulement)
  var weather = {
    raining: false, changeAt: 0, startedAt: 0, clouds: [], lastNow: null,
    drought: false, droughtChangeAt: 0, storm: false, stormChangeAt: 0
  };
  var drops = [];
  var nextLeachAt = 0;

  function weatherDryMs() {
    return lerp(RAIN_DRY_MS[0], RAIN_DRY_MS[1], rainLevel) * (0.6 + Math.random() * 0.8);
  }
  function weatherShowerMs() {
    return lerp(RAIN_SHOWER_MS[0], RAIN_SHOWER_MS[1], rainLevel) * (0.7 + Math.random() * 0.6);
  }
  function droughtMs() {
    return lerp(DROUGHT_MS[0], DROUGHT_MS[1], droughtLevel) * (0.7 + Math.random() * 0.6);
  }
  function droughtGapMs() {
    return lerp(DROUGHT_GAP_MS[0], DROUGHT_GAP_MS[1], droughtLevel) * (0.7 + Math.random() * 0.6);
  }
  function stormMs() {
    return lerp(STORM_MS[0], STORM_MS[1], stormLevel) * (0.7 + Math.random() * 0.6);
  }
  function stormGapMs() {
    return lerp(STORM_GAP_MS[0], STORM_GAP_MS[1], stormLevel) * (0.7 + Math.random() * 0.6);
  }

  function startShower(now) {
    weather.raining = true;
    weather.startedAt = now;
    weather.changeAt = now + weatherShowerMs();
    weather.clouds = [];
    for (var i = 0; i < RAIN_CLOUDS_N; i++) {
      weather.clouds.push({
        x: (worldW / RAIN_CLOUDS_N) * (i + Math.random() * 0.4),
        w: H * (0.5 + Math.random() * 0.4),
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
  function stopShower() {
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
    weather.storm = true;
    weather.stormChangeAt = now + stormMs();
  }
  function endStorm(now) {
    weather.storm = false;
    weather.stormChangeAt = now + stormGapMs();
  }

  function updateWeather(now) {
    if (weather.lastNow === null) weather.lastNow = now;
    var dt = Math.max(0, now - weather.lastNow);
    weather.lastNow = now;
    if (rainLevel <= 0) {
      if (weather.raining) stopShower();
      weather.changeAt = now; // repart a zero des que le curseur remonte
    } else if (now >= weather.changeAt) {
      if (weather.raining) startDry(now); else startShower(now);
    }
    // Le cycle de secheresse tourne independamment de la pluie (son propre curseur, sa propre
    // horloge) tant qu'il ne pleut pas ; a 0 elle est simplement coupee, comme la pluie a 0.
    if (droughtLevel <= 0) {
      weather.drought = false;
      weather.droughtChangeAt = now; // repart a zero des que le curseur remonte
    } else if (!weather.raining && now >= weather.droughtChangeAt) {
      if (weather.drought) endDrought(now); else startDrought(now);
    }
    // La tempete n'existe que PENDANT une averse deja en cours (une tempete hors pluie
    // n'aurait rien a intensifier) ; a 0 elle est simplement coupee, comme la pluie et la
    // secheresse a 0.
    if (stormLevel <= 0 || !weather.raining) {
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
  function updateDroughtIndicator() {
    if (!droughtIndicator || weather.drought === droughtIndicatorOn) return;
    droughtIndicatorOn = weather.drought;
    droughtIndicator.classList.toggle('d-none', !droughtIndicatorOn);
  }
  var stormIndicatorOn = false;
  function updateStormIndicator() {
    if (!stormIndicator || weather.storm === stormIndicatorOn) return;
    stormIndicatorOn = weather.storm;
    stormIndicator.classList.toggle('d-none', !stormIndicatorOn);
  }

  function updateRainDrops(now) {
    if (weather.raining && drops.length < RAIN_DROP_MAX) {
      var spawnN = Math.max(1, Math.round(RAIN_SPAWN_MAX * rainLevel * (weather.storm ? STORM_SPAWN_MULT : 1)));
      var cy = camY + H * RAIN_CLOUD_Y_FRAC;
      for (var i = 0; i < spawnN && drops.length < RAIN_DROP_MAX; i++) {
        drops.push({ x: camX + Math.random() * W, y: cy + 4, vy: lerp(RAIN_DROP_VY[0], RAIN_DROP_VY[1], Math.random()) });
      }
    }
    for (var d = drops.length - 1; d >= 0; d--) {
      var dr = drops[d];
      dr.y += dr.vy;
      if (dr.y >= surfaceAt(dr.x)) drops.splice(d, 1);
    }
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
      while (now >= nextLeachAt && leachSteps < LEACH_MAX_STEPS_PER_FRAME) {
        nextLeachAt += LEACH_INTERVAL_MS;
        leachSteps++;
      }
      if (nextLeachAt < now) nextLeachAt = now + LEACH_INTERVAL_MS;
      if (leachSteps > 0) {
        sinkCompactNutri(leachSteps);
        leach(now);
        decomposeDeadMyc();
      }
    }
  }

  // Vrai si un mycelium bien vivant (myc > MYC_READY) est assez proche pour retenir cet
  // humus contre le lessivage — seulement s'il ne le retient pas depuis trop longtemps
  // deja (MYC_HOLD_MAX_MS), sinon un humus jamais mange resterait bloque pour toujours.
  function heldByMycelium(x, y, nutriSince) {
    if (nutriSince !== undefined && vTime - nutriSince > MYC_HOLD_MAX_MS) return false;
    for (var i = 0; i < colonised.length; i++) {
      var c = colonised[i];
      if (c.myc > MYC_READY && Math.hypot(c.x - x, c.y - y) < MYC_HOLD_REACH) return true;
    }
    return false;
  }

  // Mangeable des qu'un des deux chemins est rempli : suffisamment lessive par la pluie
  // (rapide, MIN_LEACH_TO_EAT), OU simplement mur avec le temps (lent, NUTRI_RIPEN_MS) —
  // comme dans la vraie vie ou l'azote finit par devenir disponible meme sans pluie, juste
  // beaucoup moins vite. Necessite s.nutriSince (voir partout ou s.nutri est pose).
  function isNutriRipe(s, now) {
    return (s.leachCount || 0) >= MIN_LEACH_TO_EAT ||
      (s.nutriSince !== undefined && now - s.nutriSince >= NUTRI_RIPEN_MS);
  }

  // Remet une facette a une couleur de terre normale : efface le nutriment ET remplace
  // from/to (une facette nee d'une feuille garde `to` = un NUTRI sombre meme mix a 1, sinon
  // elle resterait visuellement de l'humus une fois le nutriment retire).
  function toEarthColor(s) {
    var color = shade(hexToRgb(EARTH[(Math.random() * EARTH.length) | 0]), (Math.random() - 0.5) * 0.2);
    s.nutri = null; s.nutriSince = undefined; s.from = color; s.to = color; s.mix = 1;
  }

  function toNutriColor(s) {
    var hex = NUTRI[(Math.random() * NUTRI.length) | 0];
    s.nutri = hex; s.from = hexToRgb(hex); s.to = hexToRgb(hex); s.mix = 1;
  }

  // Fait pousser un tout petit nutriment directement en surface d'une colonne, ex nihilo
  // (pas issu d'une feuille tombee) : minuscule, il suit ensuite exactement le meme sort
  // que n'importe quel autre nutriment (lessivage, mycelium qui le retient, racine qui le
  // mange) — seule sa taille/rarete le distingue d'une feuille decomposee. Reutilise par le
  // gazon (spawnGrassNutrient) et par le bois d'une branche qui redonne sa matiere par
  // petits bouts plutot que d'un coup (voir la boucle de litiere plus bas).
  function spawnNutrientShard(x, y, col, area, now) {
    var hex = NUTRI[(Math.random() * NUTRI.length) | 0], color = hexToRgb(hex);
    var s = {
      pts: [[-2, 2], [2, 2], [0, -3]], ox: x, oy: y, x: x, y: y, vx: 0, vy: 0,
      rot: Math.random() * Math.PI, vr: 0, from: color, to: color, mix: 1,
      area: area, settled: true, col: col, nutri: hex, nutriSince: now
    };
    shards.push(s);
    pileAdd(s);
  }

  // --- Gazon (voir section "Gazon" plus haut pour le pourquoi) ------------------------
  function spawnGrassNutrient(col, now) {
    var x = (col + Math.random() - 0.5) * COL_W, y = compactY[col] - heights[col];
    spawnNutrientShard(x, y, col, GRASS_NUTRI_AREA, now);
  }

  // Met a jour la couverture (grassCover) et, occasionnellement, fait pousser un nutriment.
  // Retourne un etat comme stepTrees (0 rien, >0 continuer a verifier lentement) : le gazon
  // n'a jamais besoin de la pleine cadence (60 fps), juste de ne pas s'arreter completement
  // (voir son usage dans step(), fondu avec treeLife).
  function updateGrass(now) {
    if (!grassCover) return 0;
    var dt = grassLastNow === null ? 0 : now - grassLastNow;
    grassLastNow = now;
    for (var c = 0; c < grassCover.length; c++) {
      if (rocky[c] && heights[c] < ROCK_COVER_MIN) { grassCover[c] = 0; continue; }
      var diff = heights[c] - grassPrevH[c];
      if (Math.abs(diff) > GRASS_DISTURB_EPS) grassCover[c] = 0;
      grassPrevH[c] += diff * GRASS_BASELINE_FOLLOW;
      if (grassCover[c] >= 1) continue;
      // Uniquement de la propagation : sans voisine deja gazonnee, une colonne nue ne pousse
      // pas toute seule (pas de generation spontanee), exactement comme le mycelium qui ne
      // colonise que ce qui touche deja une facette colonisee (voir spreadMycelium).
      var neighborLush = (c > 0 && grassCover[c - 1] > GRASS_NEIGHBOR_MIN) ||
        (c < grassCover.length - 1 && grassCover[c + 1] > GRASS_NEIGHBOR_MIN);
      if (!neighborLush) continue;
      grassCover[c] = Math.min(1, grassCover[c] + (dt / GRASS_REGROW_MS) * GRASS_SPREAD_BONUS);
    }
    // grassMyc (symbiose visible, voir sa section plus haut) : recalcule seulement toutes
    // les GRASS_MYC_CHECK_EVERY frames, pas a chaque frame — parcourir colonised pour
    // chaque colonne a 60fps couterait cher pour un simple bonus cosmetique + production.
    if (frame % GRASS_MYC_CHECK_EVERY === 0) {
      for (var gc = 0; gc < grassCover.length; gc++) grassMyc[gc] = grassHasMycUnder(gc * COL_W) ? 1 : 0;
      // Cible de flore (mousse/touffes/feuillage, purement cosmetique) : calculee ici, pas a
      // chaque frame, comme grassMyc juste au-dessus — meme raison, ca ne coute rien de plus
      // qu'un simple effet visuel. Plus dense pres d'un arbre bien nourri (treeInf) et
      // au-dessus d'un mycelium actif (mycInf, avec un leger lissage vers les colonnes
      // voisines pour eviter un bord dur), avec un bonus si les deux se superposent (vraie
      // mycorhize) : le sol vivant doit se voir profiter a la flore aussi, pas seulement au
      // gazon (voir GRASS_MYC_HEIGHT_MULT) ou aux arbres.
      for (var flc = 0; flc < floraTarget.length; flc++) {
        var fx = flc * COL_W, treeInf = 0;
        for (var fti = 0; fti < trees.length; fti++) {
          var ft = trees[fti], fd = Math.abs(ft.x - fx);
          var frr = H * lerp(FLORA_TREE_R_MIN, FLORA_TREE_R_MAX, ft.growth);
          if (fd >= frr) continue;
          var infl = lerp(0.4, 1, ft.growth) * (1 - fd / frr);
          if (infl > treeInf) treeInf = infl;
        }
        var mycInf = grassMyc[flc] ? 1 : 0;
        if (!mycInf) {
          for (var fnb = -2; fnb <= 2; fnb++) {
            var fni = flc + fnb;
            if (fnb === 0 || fni < 0 || fni >= grassMyc.length) continue;
            if (grassMyc[fni]) { mycInf = 0.7; break; }
          }
        }
        var flTgt = treeInf * FLORA_TREE_W + mycInf * FLORA_MYC_W;
        if (treeInf > 0 && grassMyc[flc]) flTgt += FLORA_SYMBIOSIS_BONUS;
        floraTarget[flc] = Math.min(1, flTgt);
      }
    }
    if (now >= grassNutriAt) {
      grassNutriAt = now + GRASS_NUTRI_CHECK_MS;
      {
        var eligible = [];
        for (var cc = 0; cc < grassCover.length; cc++) {
          if (grassCover[cc] < GRASS_FRUIT_MIN) continue;
          eligible.push(cc);
          // Compte plusieurs fois dans le tirage au sort : ~GRASS_MYC_NUTRI_WEIGHT fois plus
          // susceptible d'etre choisie, sans changer combien de nutriments sortent d'un coup.
          if (grassMyc[cc]) for (var w = 1; w < GRASS_MYC_NUTRI_WEIGHT; w++) eligible.push(cc);
        }
        if (eligible.length) {
          var pickCol = eligible[(Math.random() * eligible.length) | 0];
          // Multiplicateur de production (champs "Gazon"/"Gazon long" de la barre de reglages) :
          // 1 = comportement d'origine (chance GRASS_NUTRI_P d'un nutriment), 0 = aucun,
          // >1 = plusieurs nutriments (partie entiere + chance sur le reste).
          var nutriExpect = GRASS_NUTRI_P * (grassMyc[pickCol] ? grassMycNutriMult : grassNutriMult);
          var nutriN = Math.floor(nutriExpect);
          if (Math.random() < nutriExpect - nutriN) nutriN++;
          for (var ni = 0; ni < nutriN; ni++) spawnGrassNutrient(pickCol, now);
        }
      }
    }
    // Pousse/fanage de la flore vers sa cible, a CHAQUE appel (contrairement au calcul de
    // cible ci-dessus) : c'est une boucle separee de celle de grassCover en haut de la
    // fonction, qui saute plusieurs colonnes (rocher, deja pleine, pas de voisine) — la
    // flore, elle, doit etre mise a jour partout. Jamais au-dela de grassCover (pas de flore
    // sans herbe dessous) ; une colonne remuee a la pelle (grassCover retombe a 0 juste
    // au-dessus) perd sa flore tout de suite, comme arrachee par le coup de pelle.
    for (var fc = 0; fc < floraLush.length; fc++) {
      if (grassCover[fc] <= 0) { floraLush[fc] = 0; continue; }
      var flTarget = Math.min(floraTarget[fc], grassCover[fc]);
      if (flTarget > floraLush[fc]) floraLush[fc] = Math.min(flTarget, floraLush[fc] + dt / FLORA_GROW_MS);
      else if (flTarget < floraLush[fc]) floraLush[fc] = Math.max(flTarget, floraLush[fc] - dt / FLORA_FADE_MS);
    }
    return 1;
  }

  // Vrai si un mycelium bien vivant est a portee horizontale ET proche de la surface a cette
  // position (voir GRASS_MYC_REACH/GRASS_MYC_SURFACE_DEPTH) : le gazon ne profite que d'un
  // reseau actif juste sous lui, pas d'un mycelium enfoui loin en profondeur.
  function grassHasMycUnder(x) {
    var surf = surfaceAt(x);
    for (var i = 0; i < colonised.length; i++) {
      var c = colonised[i];
      if (c.myc > MYC_READY && Math.abs(c.x - x) < GRASS_MYC_REACH && c.y - surf < GRASS_MYC_SURFACE_DEPTH) return true;
    }
    return false;
  }

  // Lessivage : chaque humus meuble descend d'un cran (transfert vers une facette meuble
  // juste en dessous), sauf si le mycelium le retient. S'applique sur TOUTE la largeur du
  // monde (l'averse couvre tout, voir updateRainDrops) ; la probabilite grimpe avec
  // rainLevel. Arrive au fond de la couche meuble, l'humus s'enfonce dans la couche
  // compacte (compactNutri) au lieu de rester bloque contre elle.
  // Enfoncement des depots deja dans le compact : bon marche (juste compactNutri.length
  // additions), contrairement a la recherche de voisine ci-dessous (leach()). C'est la SEULE
  // partie qui doit vraiment suivre le nombre de pas de vTime ecoules (steps) — sans
  // multiplicateur, une tempete faisait descendre le nutriment jusqu'au compact plus vite
  // mais son enfoncement AU-DELA (celui qui finit par le sortir de depthReach, donc de la
  // portee des racines) restait a vitesse normale, bien trop lent pour jamais depasser cette
  // portee : rien ne se perdait vraiment, l'arbre avait toujours le temps de tout manger.
  function sinkCompactNutri(steps) {
    var stormMult = weather.storm ? STORM_LEACH_MULT : 1;
    for (var di = compactNutri.length - 1; di >= 0; di--) {
      var dep = compactNutri[di];
      dep.y = Math.min(worldH - BEDROCK_MARGIN - 5, dep.y + COMPACT_SINK_SPEED * stormMult * steps * (0.5 + Math.random()));
    }
  }

  function leach(now) {
    var stormMult = weather.storm ? STORM_LEACH_MULT : 1;
    var leachP = LEACH_P * (0.5 + rainLevel) * stormMult;
    var leafP = LEAF_RAIN_P * (0.5 + rainLevel) * stormMult;
    for (var i = 0; i < shards.length; i++) {
      var s = shards[i];
      if (s.leaf && s.settled && !s.bonus && Math.random() < (s.branch ? leafP * WOOD_RAIN_MULT : leafP)) rainLeaf(s);
      if (!s.settled || !s.nutri || s.leachTick === frame) continue;
      if (heldByMycelium(s.x, s.y, s.nutriSince)) continue;
      if (Math.random() > leachP) continue;
      var best = null, bestDy = Infinity;
      for (var j = 0; j < shards.length; j++) {
        var o = shards[j];
        if (o === s || !o.settled || o.nutri || o.myc || o.leaf || o.deadMyc) continue;
        var dx = o.x - s.x, dy = o.y - s.y;
        if (Math.abs(dx) > 8 || dy < 3 || dy > 20) continue;
        if (dy < bestDy) { bestDy = dy; best = o; }
      }
      if (best) {
        toNutriColor(best);
        best.leachCount = (s.leachCount || 0) + 1; // a fait un cran de plus vers les racines
        best.leachTick = frame; // un seul cran par passage, meme si on la croise plus loin dans la boucle
        best.nutriSince = s.nutriSince; // l'age de l'humus suit le lessivage, ne repart pas a zero
        toEarthColor(s);
      } else {
        var col = Math.max(0, Math.min(compactY.length - 1, Math.round(s.x / COL_W)));
        compactNutri.push({ x: s.x, y: compactY[col] + 5 + Math.random() * 20, color: NUTRI[(Math.random() * NUTRI.length) | 0] });
        // La facette s'enfonce dans le compact : sa matiere est desormais representee
        // UNIQUEMENT par le depot compactNutri ci-dessus. Il faut donc la retirer du tas
        // (hauteur ET facette elle-meme) plutot que la laisser en terre normale : sinon
        // chaque lessivage cree de la matiere en plus au lieu de la deplacer (le depot
        // fera pousser une feuille, en plus de la facette qui reste plantee dans le sol),
        // ce qui fait grossir les buttes indefiniment meme a fort ruissellement.
        pileRemove(s);
        shards.splice(i, 1);
        i--;
      }
    }
  }

  // Petite descente d'une feuille tombee (voir LEAF_RAIN_*) : plafonnee par averse
  // (weather.startedAt), arretee par le compact ou une autre feuille juste en dessous. Une
  // feuille deja mangee par du mycelium (l.bonus) ne bouge pas : elle est deja au bon endroit.
  function rainLeaf(s) {
    if (s.rainEpisode !== weather.startedAt) { s.rainEpisode = weather.startedAt; s.rainDrop = 0; }
    if (s.rainDrop >= LEAF_RAIN_MAX_DROP * (s.branch ? WOOD_RAIN_MULT : 1)) return;
    var col = Math.max(0, Math.min(compactY.length - 1, Math.round(s.x / COL_W)));
    var ny = s.y + LEAF_RAIN_STEP;
    if (ny > compactY[col] - 3) return;
    for (var j = 0; j < shards.length; j++) {
      var o = shards[j];
      if (o === s || !o.leaf || !o.settled) continue;
      if (Math.abs(o.x - s.x) < 8 && o.y > s.y && o.y - ny < 4) return;
    }
    s.y = ny;
    s.rainDrop += LEAF_RAIN_STEP;
  }

  var DEAD_MYC_DECOMPOSE_P = 0.01; // chance par tick de lessivage qu'un mycelium mort humide se decompose en nutriment normal (~10s d'averse en moyenne)

  // Decomposition du mycelium mort de secheresse (voir stepMycelium) : seule l'humidite d'une
  // averse le fait pourrir en nutriment, comme du bois mort ordinaire. Meme cadence que leach().
  function decomposeDeadMyc() {
    for (var i = deadMyc.length - 1; i >= 0; i--) {
      var c = deadMyc[i];
      if (!c.settled || Math.random() > DEAD_MYC_DECOMPOSE_P) continue;
      c.deadMyc = false; c.mycParent = null;
      toNutriColor(c);
      deadMyc.splice(i, 1);
    }
  }

  // Fondu d'entree/sortie des nuages : monte pendant RAIN_FADE_MS au debut de l'averse,
  // redescend pendant RAIN_FADE_MS avant sa fin programmee (weather.changeAt).
  function drawClouds() {
    if (!weather.clouds.length) return;
    var now = vTime;
    var alpha = Math.min(1, (now - weather.startedAt) / RAIN_FADE_MS, (weather.changeAt - now) / RAIN_FADE_MS);
    alpha = Math.max(0, Math.min(1, alpha));
    if (alpha <= 0) return;
    var CLOUD = ['#e9edf0', '#d7dee2', '#c7d0d6'];
    var cy = camY + H * RAIN_CLOUD_Y_FRAC, n = 5;
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

  function drawRain() {
    for (var i = 0; i < drops.length; i++) {
      var d = drops[i];
      ctx.fillStyle = '#bfe0ef';
      poly([[d.x - 1.5, d.y - 6], [d.x + 1.5, d.y - 6], [d.x, d.y + 6]]);
    }
    drawClouds();
  }

  // Outil fertilisant : depose quelques nutriments en surface, a l'endroit vise.
  function dropFertilizer(x) {
    var t = Date.now();
    if (t - fertLastAt < FERT_MIN_MS) return;
    fertLastAt = t;
    for (var i = 0; i < FERT_COUNT; i++) {
      var fx = x + (Math.random() - 0.5) * FERT_SPREAD;
      var col = Math.max(0, Math.min(heights.length - 1, Math.round(fx / COL_W)));
      spawnNutrientShard(fx, compactY[col] - heights[col], col, GRASS_NUTRI_AREA, vTime);
    }
    startLoop();
  }

  function setTool(name) {
    if (!name || name === tool) return;
    leaveShovel();
    leaveBag();
    leaveHand();
    tool = name;
    container.classList.toggle('is-planting', name === 'tree');
    for (var i = 0; i < toolBtns.length; i++) {
      var on = toolBtns[i].getAttribute('data-tool') === name;
      toolBtns[i].classList.toggle('is-active', on);
      toolBtns[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    startLoop();
  }

  // --- Arbres -----------------------------------------------------------------------
  function makeTree(x) {
    var now = vTime, slots = [], DEG = Math.PI / 180;
    var rx = H * 0.2, ry = H * 0.13;
    // Branches maitresses : bouts en eventail sur le demi-plan superieur (200-340 deg, la
    // branche du milieu pointe vers le haut), dans l'ellipse du houppier. Les branches
    // laterales partent plus bas sur le tronc. f = hauteur de depart, en fraction de h
    // depuis le sommet (suit la croissance) ; dx/dy = bout, offset depuis le sommet du
    // tronc (multiplie par treeScale au dessin, comme les slots) ; bend = coude du milieu ;
    // mj/a0 = jitter pre-calcule de la masse de feuillage (evite le scintillement).
    var limbs = [], li, j;
    for (li = 0; li < CANOPY_LIMBS; li++) {
      var la = (200 + 140 * (CANOPY_LIMBS > 1 ? li / (CANOPY_LIMBS - 1) : 0.5) + (Math.random() - 0.5) * 14) * DEG;
      var ld = 0.6 + Math.random() * 0.35;
      var lf0 = Math.max(0, Math.min(1, 0.35 + 0.65 * Math.abs(Math.cos(la)) + (Math.random() - 0.5) * 0.3));
      var mj = [];
      for (j = 0; j < 7; j++) mj.push(0.78 + Math.random() * 0.4);
      limbs.push({
        f: 0.05 + 0.25 * lf0, dx: Math.cos(la) * rx * ld, dy: Math.sin(la) * ry * ld,
        bend: (Math.random() < 0.5 ? -1 : 1) * (0.06 + Math.random() * 0.1), mj: mj, a0: Math.random() * Math.PI * 2
      });
    }
    // Places de feuilles : en round-robin sur les bouquets (les N premieres places debloquees
    // touchent donc tous les bouquets), autour du bout de leur branche (disque un peu aplati).
    for (var i = 0; i < 40; i++) {
      var sa = Math.random() * Math.PI * 2, sr = Math.sqrt(Math.random()) * CANOPY_CLUSTER_R * H, lm = limbs[i % CANOPY_LIMBS];
      slots.push({ dx: lm.dx + Math.cos(sa) * sr, dy: lm.dy + Math.sin(sa) * sr * 0.8, leaf: null, limb: i % CANOPY_LIMBS });
    }
    // Racines dessinees : 6 racines laterales alternees gauche/droite, qui partent en
    // biais (20-45 deg sous l'horizontale) et plongent de plus en plus (gravitropisme),
    // chacune avec une fourche. Longueur volontairement plus courte que la portee de
    // recherche de nutriment (voir ROOT_VISUAL_REACH plus haut). Points pre-calcules ici :
    // rien ne bouge d'une frame a l'autre. Chaque racine = { pts, forkAt, fork }.
    var roots = [], reach = H * ROOT_VISUAL_REACH;
    for (i = 0; i < 6; i++) {
      var side = i % 2 ? 1 : -1, len = (0.45 + Math.random() * 0.55) * reach, nseg = 5 + (Math.random() < 0.5 ? 1 : 0);
      var ang = (20 + Math.random() * 25) * DEG, pts = [[0, 0]], px = 0, py = 0, segL = len / nseg;
      var fk = 0.4 + Math.random() * 0.25, forkAt = -1, forkAng = 0;
      for (var k = 0; k < nseg; k++) {
        ang += (10 + Math.random() * 10) * DEG;
        var a2 = Math.min(ang + (Math.random() - 0.5) * 8 * DEG, 85 * DEG);
        px += side * Math.cos(a2) * segL; py += Math.sin(a2) * segL;
        pts.push([px, py]);
        // La fourche part du premier point situe apres fk x longueur (angle local retenu).
        if (forkAt < 0 && (k + 1) / nseg >= fk) { forkAt = k + 1; forkAng = a2; }
      }
      // Fourche : diverge de 20-35 deg, vers l'exterieur (angle moins raide) ou vers le bas.
      var dv = (20 + Math.random() * 15) * DEG, fa = Math.random() < 0.5 ? forkAng - dv : forkAng + dv;
      fa = Math.max(5 * DEG, Math.min(fa, 88 * DEG));
      var fLen = len * (1 - forkAt / nseg) * (0.4 + Math.random() * 0.2) + segL * 0.5, fx = pts[forkAt][0], fy = pts[forkAt][1], fpts = [[fx, fy]];
      for (k = 1; k <= 3; k++) {
        fa = Math.min(fa + (5 + Math.random() * 8) * DEG, 88 * DEG);
        fx += side * Math.cos(fa) * fLen / 3; fy += Math.sin(fa) * fLen / 3;
        fpts.push([fx, fy]);
      }
      roots.push({ pts: pts, forkAt: forkAt, fork: fpts });
    }
    // Hauteur relative au ciel VISIBLE (H moins la zone cachee sous le header, voir
    // CAMERA_TOP_DEADZONE) plutot qu'a H au complet : sinon un arbre bien nourri
    // (TREE_SCALE_MAX) a sa cime qui finit cachee sous le header, sans que la camera
    // puisse jamais remonter assez pour la reveler (camY ne descend jamais sous 0).
    var t = { x: x, h: (H - CAMERA_TOP_DEADZONE) * 0.42, slots: slots, limbs: limbs, roots: roots, nextEat: now + EAT_MS, eaten: 0, growth: 0, lastAte: now, flowers: [] };
    // Quelques feuilles au depart, d'ages varies : on reconnait un arbre tout de suite.
    for (i = 0; i < 8; i++) addLeaf(t, now - Math.random() * LEAF_LIFE_MS[0] * 0.6);
    return t;
  }

  // Nombre de places de feuilles utilisables : monte de LEAF_UNLOCK_MIN a toutes les
  // places (t.slots.length) a mesure que l'arbre grandit (t.growth).
  function unlockedSlots(t) {
    return Math.round(lerp(LEAF_UNLOCK_MIN, t.slots.length, t.growth));
  }

  // Echelle du tronc/houppier : petit a la naissance, et nettement plus grand que la
  // taille de reference une fois bien nourri (TREE_SCALE_MAX > 1).
  function treeScale(t) {
    return lerp(TREE_SCALE_MIN, TREE_SCALE_MAX, t.growth);
  }

  // Plante un nouvel arbre si la place ne manque pas (MAX_TREES) et qu'on n'est pas
  // trop pres d'un autre (TREE_MIN_SPACING).
  function plantTree(x) {
    if (trees.length >= MAX_TREES) return false;
    if (isRocky(x)) return false;
    for (var i = 0; i < trees.length; i++) {
      if (Math.abs(trees[i].x - x) < TREE_MIN_SPACING) return false;
    }
    trees.push(makeTree(x));
    treeLife = true;
    startLoop();
    return true;
  }

  // Retire un nutriment du monde (facette ou depot) : partage entre le repas normal et le
  // cout d'une branche bonus (voir stepTrees).
  function eatNutrient(item, now) {
    if (item.kind === 'shard') {
      pileRemove(item.ref);
      item.ref.settled = false;
      item.ref.eaten = now;
    } else {
      compactNutri.splice(compactNutri.indexOf(item.ref), 1);
    }
  }

  // Une place peut recevoir une feuille si elle est vide et que sa branche maitresse n'est
  // pas cassee (voir breakLimb).
  function slotOpen(t, sl) {
    return !sl.leaf && !(sl.limb !== undefined && t.limbs[sl.limb].broken !== undefined);
  }

  // Facette d'une feuille qui quitte son arbre (chute naturelle, ou arrachee a la main),
  // couleur de son age (0..1) ; posee ensuite comme n'importe quelle feuille (litiere).
  function makeLeafShard(lf, x, y, age) {
    var pts = leafTri(lf.size, lf.rot);
    return {
      pts: pts, x: x, y: y, vx: (Math.random() - 0.5) * 0.6, vy: 0,
      rot: 0, vr: (Math.random() - 0.5) * 0.06, from: leafColor(age),
      to: hexToRgb(NUTRI[(Math.random() * NUTRI.length) | 0]), mix: 0,
      area: triArea(pts), settled: false, col: -1, leaf: true, extra: true, sway: Math.random() * 6,
      gust: Math.pow(Math.random(), 2) * 3
    };
  }

  // Le bois d'une branche : memes chutes/litiere qu'une feuille (leaf:true), mais une
  // decomposition bien plus lente (branch:true, voir BRANCH_LITTER_MS plus bas) et une
  // couleur de bois plutot que de feuille fanee. pts : forme (triangle) ; par defaut un
  // triangle de feuille agrandi.
  function makeWoodShard(x, y, pts) {
    pts = pts || leafTri(H * 0.05, Math.random() * Math.PI * 2);
    return {
      pts: pts, x: x, y: y, vx: (Math.random() - 0.5) * 0.4, vy: 0,
      rot: 0, vr: (Math.random() - 0.5) * 0.04, from: [107, 74, 48],
      to: hexToRgb(NUTRI[(Math.random() * NUTRI.length) | 0]), mix: 0,
      area: triArea(pts), settled: false, col: -1, leaf: true, extra: true, branch: true,
      sway: Math.random() * 6, gust: Math.pow(Math.random(), 2) * 1.5
    };
  }

  // Une branche bonus quitte son arbre (vieillesse dans stepTrees, ou arrachee a la main) :
  // sa fleur fane, sa feuille (s'il y en a une) et son bois deviennent des facettes libres.
  // L'appelant retire la place de t.slots. Retourne la facette de bois. leafByAge : vrai =
  // la feuille garde la couleur de son age, faux = feuille morte (comme avant).
  function shedBranchSlot(t, sl, now, woodPts, leafByAge) {
    var tg = treeScale(t), by = t.by !== undefined ? t.by : surfaceAt(t.x) + TREE_EMBED;
    var x = t.x + sl.dx * tg, y = by - t.h * tg + sl.dy * tg;
    // La fleur (s'il y en a une) fane avec sa branche, elle ne disparait pas d'un coup.
    if (sl.flower && sl.flower.wilt === null) sl.flower.wilt = now;
    if (sl.leaf) shards.push(makeLeafShard(sl.leaf, x, y, leafByAge ? leafAgeOf(sl.leaf, now) : 1));
    sl.leaf = null;
    var wood = makeWoodShard(x, y, woodPts);
    shards.push(wood);
    return wood;
  }

  function addLeaf(t, born) {
    var free = t.slots.slice(0, unlockedSlots(t)).filter(function (sl) { return slotOpen(t, sl); });
    if (!free.length) return false;
    free[(Math.random() * free.length) | 0].leaf = {
      born: born, life: lerp(LEAF_LIFE_MS[0], LEAF_LIFE_MS[1], Math.random()),
      rot: Math.random() * Math.PI * 2, size: H * (0.028 + Math.random() * 0.016)
    };
    return true;
  }

  function leafColor(age) {
    for (var i = 1; i < LEAF_AGES.length; i++) {
      if (age <= LEAF_AGES[i][0]) {
        var a = LEAF_AGES[i - 1], b = LEAF_AGES[i], k = (age - a[0]) / (b[0] - a[0]);
        return [0, 1, 2].map(function (j) { return Math.round(lerp(a[1][j], b[1][j], k)); });
      }
    }
    return LEAF_AGES[LEAF_AGES.length - 1][1];
  }

  function leafTri(size, rot) {
    return [0, 2.3, 3.9].map(function (a, j) {
      var r = size * (j === 0 ? 1 : 0.6);
      return [Math.cos(rot + a) * r, Math.sin(rot + a) * r];
    });
  }

  // Fleurs vivantes (pas encore fanees) d'un arbre : sert au plafond FLOWER_MAX_PER_TREE.
  function countLiveFlowers(t) {
    var n = 0;
    for (var i = 0; i < t.flowers.length; i++) if (t.flowers[i].wilt === null) n++;
    return n;
  }

  // Fait eclore une fleur au pied de l'arbre pour accompagner une branche bonus qui vient de
  // naitre (voir l'appel dans stepTrees) : purement decoratif, sans le moindre effet sur le
  // jeu. Tire jusqu'a 10 positions candidates dans le rayon actuel du houppier (comme la
  // portee de la flore, FLORA_TREE_R_MIN/MAX) et retient la premiere qui tombe sur du gazon
  // bien etabli, hors roche, et assez loin de toute autre fleur (tous arbres confondus) ;
  // sinon renonce silencieusement cette fois-ci, sans jamais faire echouer la branche.
  function spawnFlower(t, slot, now) {
    if (countLiveFlowers(t) >= FLOWER_MAX_PER_TREE) return;
    var R = H * lerp(FLORA_TREE_R_MIN, FLORA_TREE_R_MAX, t.growth);
    var trunkW = H * 0.035 * treeScale(t);
    for (var attempt = 0; attempt < 10; attempt++) {
      var side = Math.random() < 0.5 ? -1 : 1;
      var dist = lerp(trunkW * 2.5, R, Math.random());
      var x = t.x + side * dist;
      var col = Math.max(0, Math.min(grassCover.length - 1, Math.round(x / COL_W)));
      if (!(grassCover[col] > 0.5) || isRocky(x)) continue;
      var tooClose = false;
      for (var ti = 0; ti < trees.length && !tooClose; ti++) {
        var others = trees[ti].flowers;
        for (var fi = 0; fi < others.length; fi++) {
          if (Math.abs(others[fi].x - x) < FLOWER_MIN_SPACING) { tooClose = true; break; }
        }
      }
      if (tooClose) continue;
      var fl = {
        x: x, col: col, born: now + BRANCH_GROW_MS, wilt: null,
        lean: (Math.random() - 0.5) * 0.36,          // inclinaison de la tige, -0.18..0.18 rad
        faceTilt: 0.35 + Math.random() * 0.2,        // ecrasement vertical (vue de trois-quarts) de la corolle
        rot: Math.random() * Math.PI * 2,            // angle de depart de l'etoile de petales
        sizeK: 0.85 + Math.random() * 0.3,           // variation de taille globale
        leafSide: Math.random() < 0.5 ? -1 : 1       // cote de la petite feuille sur la tige
      };
      t.flowers.push(fl);
      slot.flower = fl;
      return;
    }
  }

  // Retourne 2 si une animation rapide est en cours (feuille qui pousse), 1 s'il reste
  // de la vie lente (feuilles qui vieillissent, nutriments, litiere), 0 sinon.
  function stepTrees(now) {
    var state = 0, i;
    for (var ti = 0; ti < trees.length; ti++) {
      var t = trees[ti];
      // t.by suit le sol avec un delai (TREE_BY_FOLLOW) : les petites secousses (pelle
      // pres du tronc) sont lissees, mais un trou creuse durablement sous l'arbre finit
      // par le faire lentement s'enfoncer, sans sauter.
      var target = surfaceAt(t.x) + TREE_EMBED;
      t.by = t.by === undefined ? target : t.by + (target - t.by) * TREE_BY_FOLLOW;
      var by = t.by;
      var branchesFallen = null;
      // Une branche maitresse cassee a la main repousse apres LIMB_REGROW_MS (elle
      // reapparait sans feuilles, l'arbre les regarnit ensuite normalement).
      for (i = 0; i < t.limbs.length; i++) {
        var lmB = t.limbs[i];
        if (lmB.broken === undefined) continue;
        if (now - lmB.broken > LIMB_REGROW_MS) lmB.broken = undefined;
        else state = Math.max(state, 1);
      }
      for (i = 0; i < t.slots.length; i++) {
        var sl = t.slots[i], lf = sl.leaf;
        // Branche bonus devenue vieille : elle tombe pour de bon (pas juste sa feuille,
        // voir la section "Branches bonus" plus haut), liberant sa place pour qu'une
        // nouvelle puisse repousser la prochaine fois qu'il y a assez de nutriments.
        if (sl.branch && now - sl.branchSince > BONUS_BRANCH_LIFE_MS) {
          shedBranchSlot(t, sl, now, null, false);
          (branchesFallen || (branchesFallen = [])).push(i);
          state = 2;
          continue;
        }
        if (!lf) continue;
        var age = (now - lf.born) / lf.life;
        if (age < 1) {
          state = Math.max(state, now - lf.born < LEAF_GROW_MS ? 2 : 1);
          continue;
        }
        // Feuille morte : elle se detache et tombe (devient une facette du monde).
        sl.leaf = null;
        var tg = treeScale(t);
        shards.push(makeLeafShard(lf, t.x + sl.dx * tg, by - t.h * tg + sl.dy * tg, 1));
        state = 2;
      }
      if (branchesFallen) for (var bf = branchesFallen.length - 1; bf >= 0; bf--) t.slots.splice(branchesFallen[bf], 1);
      if (now >= t.nextEat) {
        // Les racines vont chercher plus loin a mesure que l'arbre grandit (t.growth), et
        // visent en priorite le nutriment le plus profond a portee (pas le plus proche
        // horizontalement) : c'est celui qui risque le plus de couler hors de depthReach au
        // prochain lessivage, donc celui qu'il vaut mieux recuperer avant d'en perdre un
        // autre. La profondeur de recherche est elle aussi limitee (ROOT_DEPTH) : un
        // nutriment lessive trop profond dans le compact (voir leach()) est hors de portee
        // tant que la pelle ne l'a pas ramene plus haut (cutCompact).
        var g = lerp(ROOT_GROWTH_MIN, 1, t.growth);
        var reach = W * ROOT_REACH * g, depthReach = H * lerp(ROOT_DEPTH_MIN, ROOT_DEPTH_MAX, t.growth), surf = surfaceAt(t.x);
        var eligible = [];
        for (i = 0; i < shards.length; i++) {
          var s = shards[i];
          if (!s.nutri || !s.settled || s.y > surf + depthReach || !isNutriRipe(s, now)) continue;
          if (Math.abs(s.x - t.x) >= reach) continue;
          eligible.push({ kind: 'shard', ref: s, y: s.y });
        }
        for (var ni = 0; ni < compactNutri.length; ni++) {
          var dep = compactNutri[ni];
          if (dep.y > surf + depthReach) continue;
          if (Math.abs(dep.x - t.x) >= reach) continue;
          eligible.push({ kind: 'deposit', ref: dep, y: dep.y });
        }
        var nearCount = eligible.length;
        eligible.sort(function (a, b) { return b.y - a.y; }); // le plus profond en premier
        t.nextEat = now + (nearCount > ABUNDANCE_THRESHOLD ? EAT_MS / ABUNDANCE_EAT_MULT : EAT_MS);
        var best = eligible.length ? eligible[0] : null;
        if (best && t.slots.slice(0, unlockedSlots(t)).some(function (x) { return slotOpen(t, x); })) {
          eatNutrient(best, now);
          addLeaf(t, now + EATEN_MS); // la feuille sort quand le nutriment a fini d'etre absorbe
          // Plus il mange de nutriments, plus il grandit : racines plus longues, plus de
          // feuilles possibles, tronc/houppier plus grands (voir drawTree/drawRoots).
          t.eaten++;
          t.growth = Math.min(1, t.eaten / MATURE_NUTRIENTS);
          t.lastAte = now;
          state = 2;
        }
        // Abondance : indice ou l'on est rendu dans eligible (0 = deja mange comme "best"
        // ci-dessus). Priorite au remplissage de feuilles AVANT de depenser pour une
        // nouvelle branche : sans ca, une branche ajoute une place vide a chaque cycle
        // abondant alors qu'une seule feuille pousse par cycle normalement — la capacite
        // grandit plus vite que le remplissage et l'arbre finit "nu" (plein de branches sans
        // feuilles) malgre un sol tres nourricier.
        var usedIdx = 1;
        if (nearCount > ABUNDANCE_THRESHOLD) {
          var freeSlots = t.slots.slice(0, unlockedSlots(t)).filter(function (x) { return slotOpen(t, x); }).length;
          var extraLeaves = Math.min(ABUNDANCE_LEAF_FILL, freeSlots, eligible.length - usedIdx);
          for (var el = 0; el < extraLeaves; el++) {
            eatNutrient(eligible[usedIdx], now);
            addLeaf(t, now + EATEN_MS);
            usedIdx++;
          }
        }
        // Branche bonus (voir sa section plus haut) : payee en nutriments pris APRES ceux
        // deja utilises pour remplir des feuilles ci-dessus, jamais avant.
        if (nearCount > ABUNDANCE_THRESHOLD && t.growth >= 1 && eligible.length - usedIdx >= BONUS_BRANCH_COST) {
          var bonusCount = 0;
          for (var bi = 0; bi < t.slots.length; bi++) if (t.slots[bi].branch) bonusCount++;
          if (bonusCount < BONUS_BRANCH_MAX) {
            for (var bc = 0; bc < BONUS_BRANCH_COST; bc++) { eatNutrient(eligible[usedIdx], now); usedIdx++; }
            var ba = Math.random() * Math.PI * 2, bdist = 1 + Math.random() * 0.25; // un peu hors du houppier normal
            var newBranch = { dx: Math.cos(ba) * H * 0.2 * bdist, dy: Math.sin(ba) * H * 0.13 * bdist, leaf: null, branch: true, branchSince: now };
            t.slots.push(newBranch);
            spawnFlower(t, newBranch, now); // fleur cosmetique au pied de l'arbre, cf. section "Flore"
            state = 2;
          }
        }
      }
      // Arbre affame : sans avoir mange depuis TREE_STARVE_MS, il perd un nutriment
      // toutes les TREE_SHRINK_MS (jamais sous l'etat du nouveau-ne). Les feuilles des
      // places qu'il perd alors tombent aussitot (litiere), ce qui rend leurs nutriments
      // au sol comme une chute normale.
      if (now - t.lastAte > TREE_STARVE_MS) {
        if (t.nextShrink === undefined) t.nextShrink = now + TREE_SHRINK_MS;
        if (now >= t.nextShrink && t.eaten > 0) {
          t.nextShrink = now + TREE_SHRINK_MS;
          t.eaten = Math.max(0, t.eaten - 1);
          t.growth = Math.min(1, t.eaten / MATURE_NUTRIENTS);
          var unlocked = unlockedSlots(t);
          for (i = unlocked; i < t.slots.length; i++) {
            var sl2 = t.slots[i];
            if (sl2.leaf) sl2.leaf.born = now - sl2.leaf.life;
          }
          state = Math.max(state, 1);
        }
      } else {
        t.nextShrink = undefined;
      }
    }
    // Du bois tombe se decompose tout seul, lentement (LITTER_MS) ; un mycelium a
    // proximite le decompose bien plus vite (MYC_DECOMPOSE_MULT) et s'en nourrit
    // (c.lastFed), ce qui le maintient en vie (voir stepMycelium).
    for (i = 0; i < litter.length; i++) {
      var l = litter[i];
      if (!l.settled) continue;
      var dt = l.lastNow ? now - l.lastNow : 0;
      l.lastNow = now;
      var fed = false;
      for (var ci = 0; ci < colonised.length; ci++) {
        var c = colonised[ci];
        if (Math.abs(c.x - l.x) < MYC_DECOMPOSE_REACH && Math.abs(c.y - l.y) < MYC_DECOMPOSE_REACH) {
          c.lastFed = now;
          fed = true;
        }
      }
      if (fed) l.bonus = (l.bonus || 0) + dt * (MYC_DECOMPOSE_MULT - 1);
      l.mix = Math.min(1, (now - l.landed + (l.bonus || 0)) / (l.branch ? BRANCH_LITTER_MS : LITTER_MS));
      // Le bois rend sa matiere par petits bouts au fil de sa decomposition (voir la section
      // "Une branche a coute..." plus haut), pas d'un coup a la fin : un nouveau petit
      // nutriment nait a chaque tranche de progression franchie (mix*BONUS_BRANCH_COST).
      if (l.branch) {
        var due = Math.floor(l.mix * BONUS_BRANCH_COST);
        while ((l.nutriGiven || 0) < due) {
          spawnNutrientShard(l.x + (Math.random() - 0.5) * 10, l.y, l.col, WOOD_NUTRI_AREA, now);
          l.nutriGiven = (l.nutriGiven || 0) + 1;
        }
      }
    }
    // Feuille tout a fait decomposee : elle devient de l'humus, que les racines peuvent
    // reprendre. Le bois, lui, a deja rendu toute sa matiere par bouts (ci-dessus) : ce qui
    // en reste redevient juste de la terre normale, jamais un nutriment en plus.
    litter.forEach(function (l) {
      if (l.mix >= 1 && l.settled) {
        if (l.branch) toEarthColor(l); else { l.nutri = rgbStr(l.to); l.nutriSince = now; }
      }
    });
    litter = litter.filter(function (l) { return l.mix < 1 && shards.indexOf(l) >= 0; });
    if (litter.length) state = Math.max(state, 1);
    if (!state && shards.some(function (x) { return x.nutri; })) state = 1;
    return state;
  }

  // Fait vivre les fleurs cosmetiques (voir spawnFlower) : la pelle qui remue une colonne
  // (grassCover retombe a 0) fait disparaitre la fleur assise dessus tout de suite, sans
  // transition (la terre a litteralement bouge sous elle) ; une fleur fanee (branche tombee,
  // voir stepTrees) s'efface plus doucement, sur FLOWER_WILT_MS. Retourne vrai si au moins
  // une fleur est en train d'eclore ou de faner : appele depuis step(), ca force la pleine
  // cadence (sinon la boucle lente a 4 img/s rendrait ces transitions saccadees).
  function stepFlowers(now) {
    var busy = false;
    for (var ti = 0; ti < trees.length; ti++) {
      var t = trees[ti], kept = [];
      for (var i = 0; i < t.flowers.length; i++) {
        var f = t.flowers[i];
        if (grassCover[f.col] <= 0) continue;
        if (f.wilt !== null && now - f.wilt > FLOWER_WILT_MS) continue;
        kept.push(f);
        if (f.wilt !== null || (now >= f.born && now - f.born < FLOWER_BLOOM_MS)) busy = true;
      }
      t.flowers = kept;
    }
    return busy;
  }

  // Position monde du bout de la tige d'une fleur grande ouverte (voir drawFlower pour la
  // meme geometrie appliquee au dessin) : sert de cible d'atterrissage aux insectes.
  function flowerTopWorld(f) {
    var leanSign = f.lean < 0 ? -1 : 1;
    var stemH = FLOWER_H_F * H * f.sizeK;
    var curveK = stemH * 0.3 * leanSign;
    var baseX = f.x, baseY = surfaceAt(f.x) + FLORA_EMBED;
    var ca = Math.cos(f.lean), sa = Math.sin(f.lean);
    var lx = curveK, ly = -stemH;
    return [baseX + lx * ca - ly * sa, baseY + lx * sa + ly * ca];
  }

  // Vrai si une fleur ouverte (eclosion terminee, pas fletrie) est encore visible a l'ecran.
  function flowerIsOpen(f) {
    return f.wilt === null && vTime - f.born >= FLOWER_BLOOM_MS;
  }
  // Une fleur ciblee par un insecte peut disparaitre (pelle, branche tombee) sans jamais
  // etre retiree "sous nos yeux" : on revalide sa presence a chaque frame plutot que de
  // se fier a une simple reference d'objet.
  function flowerStillGood(f) {
    if (f.wilt !== null) return false;
    for (var ti = 0; ti < trees.length; ti++) if (trees[ti].flowers.indexOf(f) >= 0) return true;
    return false;
  }
  function flowerAlreadyTargeted(f) {
    for (var i = 0; i < insects.length; i++) if (insects[i].target === f) return true;
    return false;
  }
  // Premiere fleur ouverte, visible et pas deja visee, tous arbres confondus (meme marge
  // de visibilite que drawFlower).
  function pickOpenFlower() {
    for (var ti = 0; ti < trees.length; ti++) {
      var fl = trees[ti].flowers;
      for (var i = 0; i < fl.length; i++) {
        var f = fl[i];
        if (f.x < camX - 30 || f.x > camX + W + 30) continue;
        if (!flowerIsOpen(f)) continue;
        if (flowerAlreadyTargeted(f)) continue;
        return f;
      }
    }
    return null;
  }

  // Fait apparaitre un insecte hors ecran, d'un cote choisi au hasard, qui va traverser
  // vers l'autre cote. Toutes les valeurs qui varient d'un individu a l'autre (ondulation,
  // phases de battement...) sont tirees ici une fois pour toutes et stockees sur l'objet :
  // le dessin (drawInsect) ne fait plus que lire ces valeurs et l'age ecoule.
  function spawnInsect() {
    var species = Math.random() < 0.6 ? 'papillon' : 'bourdon';
    var dir = Math.random() < 0.5 ? -1 : 1;
    var startX = dir > 0 ? camX - 40 : camX + W + 40;
    var yFrac = 0.12 + Math.random() * (0.45 - 0.12);
    var sizeMult = species === 'bourdon' ? 0.7 : 1;
    var speed = H * 0.0009 * INSECT_SPEED * (species === 'bourdon' ? 1.6 : 1);
    var ins = {
      species: species, dir: dir, sizeMult: sizeMult, speed: speed, yFrac: yFrac,
      cruiseX: startX, x: startX, y: 0, age: 0,
      phaseWing: Math.random() * Math.PI * 2,
      glideSeed: Math.random() * 3000,
      wA1: H * 0.02, wA2: H * 0.008, wT1: species === 'bourdon' ? 850 : 1700, wT2: species === 'bourdon' ? 300 : 600,
      wPh1: Math.random() * Math.PI * 2, wPh2: Math.random() * Math.PI * 2,
      zzA: species === 'bourdon' ? H * 0.01 : 0, zzT: 320 + Math.random() * 80, zzPh: Math.random() * Math.PI * 2,
      driftT: 4000 + Math.random() * 2000, driftPh: Math.random() * Math.PI * 2,
      state: 'cruise', target: null, nearFlower: false,
      landAt: 0, landDur: 0, landPh: 0
    };
    ins.y = clamp(surfaceAt(clamp(startX, 0, worldW)) - H * yFrac, camY + 10, camY + H - 10);
    if (Math.random() < INSECT_LAND_P) {
      var f = pickOpenFlower();
      if (f) { ins.target = f; ins.state = 'approach'; }
    }
    insects.push(ins);
  }

  // Croisiere : traversee de l'ecran, ondulation verticale (+ petits zigzags pour le
  // bourdon) et derive horizontale legere. speedMult vaut 2 sous la pluie (fuite).
  function stepInsectCruise(ins, dt, speedMult) {
    ins.cruiseX += ins.dir * ins.speed * speedMult * dt;
    var drift = Math.sin(ins.age / ins.driftT + ins.driftPh) * H * 0.006;
    ins.x = ins.cruiseX + drift;
    var w1 = ins.wA1 * Math.sin((ins.age / ins.wT1) * Math.PI * 2 + ins.wPh1);
    var w2 = ins.wA2 * Math.sin((ins.age / ins.wT2) * Math.PI * 2 + ins.wPh2);
    var zz = ins.zzA * Math.sin((ins.age / ins.zzT) * Math.PI * 2 + ins.zzPh);
    var baseY = surfaceAt(clamp(ins.x, 0, worldW)) - H * ins.yFrac;
    ins.y = clamp(baseY + w1 + w2 + zz, camY + 10, camY + H - 10);
  }
  // Approche : vise un point au-dessus de la fleur qui descend progressivement vers le
  // bout de la tige (courbe douce, pas une ligne droite), jusqu'a se poser.
  function stepInsectApproach(ins, dt) {
    var top = flowerTopWorld(ins.target);
    var dx = top[0] - ins.x, dy = top[1] - ins.y, dist = Math.hypot(dx, dy);
    ins.nearFlower = dist < H * 0.08;
    var hover = Math.min(H * 0.07, dist * 0.5);
    var rate = Math.min(1, dt / 260);
    ins.x += (top[0] - ins.x) * rate;
    ins.y += (top[1] - hover - ins.y) * rate;
    ins.y += Math.sin(ins.age / 260 + ins.wPh1) * H * 0.004;
    if (dist < 3) {
      ins.state = 'landed';
      ins.x = top[0]; ins.y = top[1];
      ins.landAt = ins.age;
      ins.landDur = 3000 + Math.random() * 4000;
      ins.landPh = Math.random() * Math.PI * 2;
      ins.nearFlower = true;
    }
  }
  // Pose : reste au bout de la tige le temps de landDur (le pietinement/battement pose est
  // purement visuel, voir drawInsect), puis repart finir sa traversee en croisiere.
  function stepInsectLanded(ins) {
    ins.nearFlower = true;
    var top = flowerTopWorld(ins.target);
    ins.x = top[0]; ins.y = top[1];
    if (ins.age - ins.landAt >= ins.landDur) {
      ins.cruiseX = ins.x; ins.target = null; ins.state = 'cruise'; ins.nearFlower = false;
    }
  }

  // Cycle de vie complet des insectes cosmetiques : apparition (delai reel aleatoire),
  // deplacement (dt REEL plafonne, jamais vTime), retrait une fois bien sorti de l'ecran.
  // Appelee depuis step() uniquement en mode 'exploded'. Retourne vrai s'il reste au moins
  // un insecte : force alors la pleine cadence (la boucle lente suffit tant qu'aucun
  // insecte n'est en vol, et continue de surveiller le prochain delai d'apparition).
  function stepInsects(realNow) {
    if (insectLastT === null) {
      insectLastT = realNow;
      insectNextAt = realNow + 6000 + Math.random() * 6000; // premiere apparition, 6-12s
    }
    var dt = Math.min(realNow - insectLastT, 50);
    insectLastT = realNow;
    var raining = weather.raining; // averse en cours (rainLevel n'est qu'un reglage de frequence)
    if (!raining && insects.length < INSECT_MAX && realNow >= insectNextAt) {
      spawnInsect();
      insectNextAt = realNow + lerp(INSECT_GAP_MIN_MS, INSECT_GAP_MAX_MS, Math.random());
    }
    var speedMult = raining ? 2 : 1;
    for (var i = insects.length - 1; i >= 0; i--) {
      var ins = insects[i];
      ins.age += dt;
      if (raining && ins.target) { ins.cruiseX = ins.x; ins.target = null; ins.state = 'cruise'; ins.nearFlower = false; }
      if (ins.target && !flowerStillGood(ins.target)) { ins.cruiseX = ins.x; ins.target = null; ins.state = 'cruise'; ins.nearFlower = false; }
      if (ins.state === 'approach') stepInsectApproach(ins, dt);
      else if (ins.state === 'landed') stepInsectLanded(ins);
      else stepInsectCruise(ins, dt, speedMult);
      if ((ins.dir > 0 && ins.x > camX + W + 80) || (ins.dir < 0 && ins.x < camX - 80)) insects.splice(i, 1);
    }
    return insects.length > 0;
  }

  // Quadrilatere du point a vers b (demi-epaisseurs wa, wb), perpendiculaire a la direction
  // du segment (pas un simple decalage vertical, qui aplatit les segments pentus).
  function rootSeg(ax, ay, bx, by2, wa, wb) {
    var dx = bx - ax, dy = by2 - ay, l = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / l, ny = dx / l;
    poly([[ax + nx * wa, ay + ny * wa], [bx + nx * wb, by2 + ny * wb], [bx - nx * wb, by2 - ny * wb], [ax - nx * wa, ay - ny * wa]]);
  }

  // Dessinees SOUS les facettes de terre (avant les shards, apres drawSoil/drawLooseBacking) :
  // le lit de triangles et la terre meuble les cachent ; elles n'apparaissent que sur l'aplat
  // de la couche compacte, en defilant vers le bas ou au fond d'un trou creuse a la pelle.
  // Brun-roux plus chaud/clair que le tronc : #6b4428 se confondait avec l'aplat #5a3d28.
  var ROOT_COLORS = ['#b8814f', '#9a6a3f'];
  function drawRoots(t) {
    var by = t.by !== undefined ? t.by : surfaceAt(t.x) + TREE_EMBED, w0 = H * 0.014;
    // Racines courtes a la naissance, elles s'etirent jusqu'a leur pleine longueur en poussant.
    var rg = lerp(ROOT_GROWTH_MIN, 1, t.growth);
    for (var r = 0; r < t.roots.length; r++) {
      var rt = t.roots[r], pts = rt.pts, n = pts.length - 1;
      for (var i = 0; i < n; i++) {
        var a = pts[i], b = pts[i + 1];
        ctx.fillStyle = ROOT_COLORS[i % 2];
        rootSeg(t.x + a[0] * rg, by + a[1] * rg, t.x + b[0] * rg, by + b[1] * rg,
          Math.max(0.6, w0 * (1 - i / n)), Math.max(0.6, w0 * (1 - (i + 1) / n)));
      }
      // Fourche : demarre a 60% de l'epaisseur locale de la racine mere, s'effile jusqu'a la pointe.
      var f = rt.fork, wf = Math.max(0.6, w0 * (1 - rt.forkAt / n)) * 0.6, fn = f.length - 1;
      for (i = 0; i < fn; i++) {
        var fa = f[i], fb = f[i + 1];
        ctx.fillStyle = ROOT_COLORS[(i + 1) % 2];
        rootSeg(t.x + fa[0] * rg, by + fa[1] * rg, t.x + fb[0] * rg, by + fb[1] * rg,
          Math.max(0.6, wf * (1 - i / fn)), Math.max(0.6, wf * (1 - (i + 1) / fn)));
      }
    }
    // Racine pivot : descend droit jusqu'a la vraie profondeur ou l'arbre va chercher
    // l'humus (meme calcul que la recherche dans stepTrees), visible en defilant vers le bas.
    var tipY = surfaceAt(t.x) + H * lerp(ROOT_DEPTH_MIN, ROOT_DEPTH_MAX, t.growth), N = 6, seed = t.x * 0.37;
    for (i = 0; i < N; i++) {
      var k0 = i / N, k1 = (i + 1) / N;
      var y0 = lerp(by, tipY, k0), y1 = lerp(by, tipY, k1);
      var x0 = t.x + Math.sin(seed + k0 * 5) * H * 0.012 * k0, x1 = t.x + Math.sin(seed + k1 * 5) * H * 0.012 * k1;
      var w0p = w0 * 1.3 * (1 - k0) + 0.6, w1p = w0 * 1.3 * (1 - k1) + 0.6;
      ctx.fillStyle = ROOT_COLORS[i % 2];
      poly([[x0 - w0p, y0], [x0 + w0p, y0], [x1 + w1p, y1], [x1 - w1p, y1]]);
    }
  }

  var LIMB_COLORS = ['#8a5a3b', '#6b4428']; // deux tons du tronc, alternes d'un segment a l'autre
  function drawTree(t) {
    // Tronc/houppier petits a la naissance, pleine taille une fois l'arbre mature (t.growth).
    var now = vTime, tg = treeScale(t), by = t.by !== undefined ? t.by : surfaceAt(t.x) + TREE_EMBED, h = t.h * tg, w = H * 0.035 * tg, top = by - h;
    // Tronc : deux facettes (lumiere a gauche), effile vers le haut.
    ctx.fillStyle = '#8a5a3b';
    poly([[t.x - w, by], [t.x, by], [t.x, top], [t.x - w * 0.35, top]]);
    ctx.fillStyle = '#6b4428';
    poly([[t.x, by], [t.x + w, by], [t.x + w * 0.35, top], [t.x, top]]);
    // Evasement du pied : 2 petits contreforts triangulaires qui elargissent la base, du
    // niveau juste sous la surface (by - TREE_EMBED + 2) jusqu'a h*0.08 au-dessus d'elle ;
    // le haut colle au bord du tronc (qui s'effile de w a 0.35w sur sa hauteur).
    var fy = by - TREE_EMBED + 2, fTop = by - TREE_EMBED - h * 0.08, fw = w * (1 - 0.65 * (by - fTop) / h);
    ctx.fillStyle = '#8a5a3b';
    poly([[t.x - w * 1.8, fy], [t.x - fw, fTop], [t.x - fw, fy]]);
    ctx.fillStyle = '#6b4428';
    poly([[t.x + w * 1.8, fy], [t.x + fw, fTop], [t.x + fw, fy]]);
    // Branches maitresses : 2 segments legerement coudes, effiles du tronc vers le bout
    // (le bouquet de feuilles est accroche a ce bout), deux tons alternes.
    var limbs = t.limbs, i, k, lm, wA = Math.max(1, w * 0.35);
    // Branche agrippee par la main : elle tremble en proportion de la tension (ecart au
    // point de prise), decalage visuel seulement (lm.shx/shy, aussi lu par le feuillage).
    var gp = hand.grip, shk = handTension(t) * 3;
    var shkX = shk ? Math.sin(frame * 1.7) * shk : 0, shkY = shk ? Math.cos(frame * 2.3) * shk * 0.6 : 0;
    for (k = 0; k < limbs.length; k++) {
      lm = limbs[k];
      lm.n = 0; lm.cnt = 0; lm.w = 0; lm.cr = 0; lm.cg = 0; lm.cb = 0; // cumuls du bouquet pour cette frame
      lm.shx = 0; lm.shy = 0;
      if (lm.broken !== undefined) continue; // cassee : ni segment ni bouquet (ses feuilles sont deja tombees)
      if (shk && gp.obj === lm) { lm.shx = shkX; lm.shy = shkY; }
      var sx = t.x, sy = top + h * lm.f, ex = t.x + lm.dx * tg + lm.shx, ey = top + lm.dy * tg + lm.shy;
      var mx = (sx + ex) / 2 - (ey - sy) * lm.bend, my = (sy + ey) / 2 + (ex - sx) * lm.bend, wM = Math.max(0.8, wA * 0.55);
      ctx.fillStyle = LIMB_COLORS[k % 2];
      rootSeg(sx, sy, mx, my, wA, wM);
      ctx.fillStyle = LIMB_COLORS[(k + 1) % 2];
      rootSeg(mx, my, ex, ey, wM, 0.6);
    }
    // Passe 1 : branches bonus (dessinees avant la masse de feuillage) et cumul des feuilles
    // affichees de chaque bouquet (nb, poids de croissance, somme des couleurs).
    var unl = unlockedSlots(t), sl, lf, g, col;
    for (i = 0; i < t.slots.length; i++) {
      sl = t.slots[i]; lf = sl.leaf;
      if (sl.limb !== undefined && i < unl) limbs[sl.limb].n++;
      if (sl.branch) {
        // Vraie branche, visible et persistante (pas juste un decor) : s'etire depuis le
        // haut du tronc jusqu'a sa place de feuille en BRANCH_GROW_MS, et reste dessinee
        // tant que la place existe (voir sa chute dans stepTrees), feuille ou pas.
        var bg = Math.min(1, (now - sl.branchSince) / BRANCH_GROW_MS);
        sl.shx = 0; sl.shy = 0;
        if (shk && gp.obj === sl) { sl.shx = shkX; sl.shy = shkY; }
        ctx.fillStyle = '#6b4428';
        rootSeg(t.x, top + h * 0.12, t.x + sl.dx * tg * bg + sl.shx, top + sl.dy * tg * bg + sl.shy, wA * 0.8, 0.6);
      }
      if (!lf || now < lf.born) continue;
      g = easeOutBack(Math.min(1, (now - lf.born) / LEAF_GROW_MS));
      col = leafColor(Math.min(1, (now - lf.born) / lf.life));
      lf.dg = g; lf.dcol = col; // caches pour la passe 2 (memes valeurs, evite de recalculer)
      if (sl.limb !== undefined) {
        lm = limbs[sl.limb];
        lm.cnt++; lm.w += g; lm.cr += col[0]; lm.cg += col[1]; lm.cb += col[2];
      }
    }
    // Masse de feuillage : eventail de 7 triangles autour du bout de chaque branche, couleur
    // moyenne des feuilles du bouquet assombrie (haut x0.85, bas x0.62). Suit la saison des
    // feuilles et se degarnit avec elles ; rien du tout tant que le bouquet n'a aucune feuille.
    for (k = 0; k < limbs.length; k++) {
      lm = limbs[k];
      if (!lm.cnt) continue;
      var inv = 1 / lm.cnt, cr = lm.cr * inv, cg = lm.cg * inv, cb = lm.cb * inv;
      var R = CANOPY_CLUSTER_R * H * tg * (0.45 + 0.65 * Math.min(1, lm.w / Math.max(1, lm.n, lm.cnt)));
      var cx = t.x + lm.dx * tg + lm.shx, cy = top + lm.dy * tg + lm.shy;
      var cUp = shadeRgb(cr, cg, cb, 0.85), cDn = shadeRgb(cr, cg, cb, 0.62);
      var qx = cx + Math.cos(lm.a0) * R * lm.mj[0], qy = cy + Math.sin(lm.a0) * R * 0.8 * lm.mj[0];
      for (var v = 1; v <= 7; v++) {
        var va = lm.a0 + v / 7 * Math.PI * 2, vr = R * lm.mj[v % 7];
        var vx = cx + Math.cos(va) * vr, vy = cy + Math.sin(va) * vr * 0.8;
        ctx.fillStyle = (qy + vy) * 0.5 < cy ? cUp : cDn;
        poly([[cx, cy], [qx, qy], [vx, vy]]);
        qx = vx; qy = vy;
      }
    }
    // Passe 2 : feuilles individuelles par-dessus la masse (ce sont elles qui tombent).
    // Eclairage par le haut : un peu plus claires dans la moitie haute du bouquet, un peu
    // plus sombres dans la moitie basse (simple facteur sur la couleur pleine).
    var px, py, lpts, shade;
    for (i = 0; i < t.slots.length; i++) {
      sl = t.slots[i]; lf = sl.leaf;
      if (!lf || now < lf.born) continue;
      col = lf.dcol;
      shade = sl.limb === undefined ? 1 : (sl.dy < limbs[sl.limb].dy ? 1.12 : 0.92);
      ctx.fillStyle = shadeRgb(col[0], col[1], col[2], shade);
      lpts = leafTri(lf.size * lf.dg, lf.rot);
      var so = sl.limb !== undefined ? limbs[sl.limb] : sl; // porte le decalage de tremblement
      px = t.x + sl.dx * tg + (so.shx || 0); py = top + sl.dy * tg + (so.shy || 0);
      poly(lpts.map(function (q) { return [px + q[0], py + q[1]]; }));
    }
  }

  // Couleur pleine 'rgb(...)' d'un rgb multiplie par un facteur d'eclairage (borne a 255).
  function shadeRgb(r, g, b, k) {
    return 'rgb(' + Math.min(255, Math.round(r * k)) + ',' + Math.min(255, Math.round(g * k)) + ',' + Math.min(255, Math.round(b * k)) + ')';
  }

  // --- Rendu -------------------------------------------------------------------------
  // --- Decor lointain : ciel + collines en parallaxe ----------------------------------
  // Dessine en coord. ECRAN (avant le translate camera). Chaque couche de collines est une
  // crete irreguliere facettee en triangles, decalee de camX/camY x facteur : plus la
  // couche est loin, moins elle bouge. Teintes melangees a la creme de la page (aerien).
  var HILL_LAYERS = [
    { f: 0.16, lift: 0.23, amp: 0.09, rgb: [201, 208, 178] },  // lointaine, tres pale
    { f: 0.38, lift: 0.15, amp: 0.07, rgb: [178, 186, 146] }   // proche, un peu plus dense
  ];
  var hillRidges = [];
  function buildHills() {
    hillRidges = HILL_LAYERS.map(function (L, li) {
      var xs = [], ys = [], x = -40, ph = Math.random() * 10;
      while (x < worldW + 80) {
        var u = x / worldW;
        var n = Math.sin(u * 13 + ph + li * 2) * 0.5 + Math.sin(u * 31 + ph * 1.7) * 0.28 + Math.random() * 0.22;
        xs.push(x);
        ys.push(groundY - H * (L.lift + L.amp * (0.5 + n * 0.5)));
        x += 28 + Math.random() * 30;
      }
      return { xs: xs, ys: ys };
    });
  }
  function drawBackdrop() {
    var a = easeInOut(soilRiseT);
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    // Ciel : transparent en haut (se fond dans la creme de la page), a peine chaud a l'horizon.
    var sky = ctx.createLinearGradient(0, 0, 0, groundY);
    sky.addColorStop(0, 'rgba(246,222,182,0)');
    sky.addColorStop(1, 'rgba(246,214,168,0.32)');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    for (var li = 0; li < HILL_LAYERS.length; li++) {
      var L = HILL_LAYERS[li], R = hillRidges[li];
      if (!R) continue;
      var ox = camX * L.f, oy = camY * L.f, bottom = worldH;
      for (var i = 0; i < R.xs.length - 1; i++) {
        var x0 = R.xs[i] - ox, x1 = R.xs[i + 1] - ox;
        if (x1 < -4 || x0 > W + 4) continue;
        var y0 = R.ys[i] - oy, y1 = R.ys[i + 1] - oy;
        // Lumiere haut-gauche : pente montante vers la droite = face eclairee.
        var k = clamp((y0 - y1) / 40, -1, 1) * 0.07;
        var lo = shade(L.rgb, k - 0.03), hi = shade(L.rgb, k + 0.03);
        ctx.fillStyle = rgbStr(hi);
        poly([[x0, y0], [x1, y1], [x0, bottom]]);
        ctx.fillStyle = rgbStr(lo);
        poly([[x1, y1], [x1, bottom], [x0, bottom]]);
      }
    }
    ctx.restore();
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    drawBackdrop();
    // Tout ce qui suit est dessine en coord. MONDE ; ce translate ramene la portion
    // visible (camX..camX+W, camY..camY+H) a l'ecran. Les overlays HTML (tresors) font
    // ce -camX/-camY a la main dans positionTreasureOverlays, hors de ce contexte canvas.
    ctx.save();
    ctx.translate(-camX, -camY);
    // Pendant la montee du lit de terre, tout le sol est decale vers le bas.
    var rise = soilRiseT < 1 ? Math.pow(1 - soilRiseT, 3) * soilDepth : 0;
    drawInsectsBack();
    drawSoil(rise);
    drawCompactNutri(rise);
    drawLooseBacking(rise);
    // Racines avant les facettes : cachees par le lit de triangles et la terre meuble,
    // visibles seulement sur l'aplat compact (defilement vers le bas, trou creuse).
    for (var ti = 0; ti < trees.length; ti++) drawRoots(trees[ti]);
    // Avant les facettes : le pied du tronc est enfoui dans la terre.
    for (ti = 0; ti < trees.length; ti++) drawTree(trees[ti]);
    for (var i = 0; i < shards.length; i++) {
      var s = shards[i], m = s.mix, p = s.pts;
      var sy = s.y + (s.soil && s.settled ? rise : 0);
      var r = lerp(s.from[0], s.to[0], m), g = lerp(s.from[1], s.to[1], m), bl = lerp(s.from[2], s.to[2], m);
      if (s.myc) {
        var w = s.myc * s.mycTone;
        r = lerp(r, MYC[0], w); g = lerp(g, MYC[1], w); bl = lerp(bl, MYC[2], w);
      }
      // Bois tombe (tant qu'il n'est pas devenu de la terre) : un petit baton, pas ses pts.
      if (s.branch && s.eaten === undefined && (!s.settled || s.mix < 1)) {
        if (s.settled && s.restRot === undefined) s.restRot = (Math.random() - 0.5) * 0.24;
        drawLog(s, s.x, sy, s.settled ? s.restRot : s.rot, r, g, bl);
        continue;
      }
      ctx.fillStyle = s.nutri || 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (bl | 0) + ')';
      // Feuille posee : couchee a plat (angle fige, hauteur ecrasee), sans toucher a s.pts.
      var flat = s.leaf && !s.branch && s.settled, fy = 1, fo = 0;
      if (flat && s.restRot === undefined) s.restRot = (Math.random() - 0.5) * 0.3;
      if (flat) fy = LITTER_FLAT, fo = 1;
      var c = Math.cos(flat ? s.restRot : s.rot), sn = Math.sin(flat ? s.restRot : s.rot);
      // Terre meuble posee : dessinee un peu plus grande pour boucher les jours entre
      // facettes empilees (le lit d'origine, deja jointif, garde sa taille).
      if (s.settled && !s.soil && !s.leaf) { c *= LOOSE_DRAW_SCALE; sn *= LOOSE_DRAW_SCALE; }
      if (s.eaten !== undefined) {
        var k = Math.max(0, 1 - (vTime - s.eaten) / EATEN_MS);
        c *= k; sn *= k;
      }
      ctx.beginPath();
      ctx.moveTo(s.x + p[0][0] * c - p[0][1] * sn, sy + fo + (p[0][0] * sn + p[0][1] * c) * fy);
      ctx.lineTo(s.x + p[1][0] * c - p[1][1] * sn, sy + fo + (p[1][0] * sn + p[1][1] * c) * fy);
      ctx.lineTo(s.x + p[2][0] * c - p[2][1] * sn, sy + fo + (p[2][0] * sn + p[2][1] * c) * fy);
      ctx.closePath();
      ctx.fill();
    }
    drawHyphae(rise);
    drawMoss(rise);
    drawGrass(rise);
    drawUnderbrush(rise);
    drawFlowers(rise);
    drawInsectsFront();
    // Apres les facettes : les champignons sortent PAR-DESSUS la terre.
    for (i = 0; i < mushrooms.length; i++) drawMushroom(mushrooms[i]);
    drawShovel();
    drawBag();
    drawHand();
    drawRain();
    ctx.restore();
    positionTreasureOverlays();
  }

  // Baton low-poly (bois tombe) : hexagone a deux facettes, moitie haute = couleur de la
  // facette, moitie basse plus sombre. Pose, il est couche et un peu enfonce dans le sol.
  function drawLog(s, x, y, rot, r, g, b) {
    var L = H * 0.0425, T = H * 0.007, bv = T * 0.8, c = Math.cos(rot), sn = Math.sin(rot);
    if (s.settled) y += T * 0.66;
    var x0 = x - L * c, y0 = y - L * sn, x1 = x + L * c, y1 = y + L * sn;   // extremites
    var ta = -L + bv, tb = L - bv;
    var ax = x + ta * c + T * sn, ay = y + ta * sn - T * c;                  // haut, cote gauche
    var bx = x + tb * c + T * sn, by = y + tb * sn - T * c;                  // haut, cote droit
    var cx = x + tb * c - T * sn, cy = y + tb * sn + T * c;                  // bas, cote droit
    var dx = x + ta * c - T * sn, dy = y + ta * sn + T * c;                  // bas, cote gauche
    ctx.fillStyle = shadeRgb(r, g, b, 1);
    poly([[x0, y0], [ax, ay], [bx, by], [x1, y1]]);
    ctx.fillStyle = shadeRgb(r, g, b, 0.72);
    poly([[x0, y0], [x1, y1], [cx, cy], [dx, dy]]);
  }

  // Filaments du mycelium (par-dessus le blanchiment des facettes) : chaque facette
  // colonisee tire un fil depuis son parent (ou le point d'inoculation), qui pousse avec
  // myc. Deux strokes par frame (vivant, mort), aucune allocation.
  function hyphaPath(c, rise, dead) {
    if (!c.settled || c.dead || c.eaten !== undefined || !c.hyF) return;
    var ro = c.soil ? rise : 0, cy = c.y + ro;
    if (c.x < camX - 40 || c.x > camX + W + 40 || cy < camY - 40 || cy > camY + H + 40) return;
    var p = c.mycParent, ox, oy;
    if (p) {
      if (!p.settled || !(p.myc > 0 || p.deadMyc)) return;
      ox = p.x; oy = p.y + (p.soil ? rise : 0);
    } else { ox = c.mox; oy = c.moy + ro; }
    var dx = c.x - ox, dy = cy - oy, d = Math.sqrt(dx * dx + dy * dy);
    if (d > HYPHA_MAX_LINK) return;
    var t = dead ? 1 : Math.min(1, c.myc / MYC_READY);
    var ex = ox + dx * t, ey = oy + dy * t, L = d * t;
    if (L > 0.5) {
      var mx = (ox + ex) / 2 - (ey - oy) / L * c.hyJ, my = (oy + ey) / 2 + (ex - ox) / L * c.hyJ;
      ctx.moveTo(ox, oy);
      ctx.lineTo(mx, my);
      if (dead) ctx.lineTo(mx + (ex - mx) * 0.1, my + (ey - my) * 0.1); // casse : 55% du fil
      else ctx.lineTo(ex, ey);
    }
    if (dead) return;
    var i, a;
    if (c.myc >= MYC_READY) {
      for (i = 0; i < c.hyTw.length; i += 2) {
        ctx.moveTo(c.x, cy);
        ctx.lineTo(c.x + Math.cos(c.hyTw[i]) * c.hyTw[i + 1], cy + Math.sin(c.hyTw[i]) * c.hyTw[i + 1]);
      }
    }
    if (c.myc > 0.6) {
      var surf = surfaceAt(c.x);
      if (c.y - surf < 6) {
        var by = Math.min(cy, surf + ro);
        for (i = 0; i < 9; i += 3) {
          var hx = c.x + c.hyF[i];
          a = c.hyF[i + 1];
          ctx.moveTo(hx, by);
          ctx.lineTo(hx + Math.cos(a) * c.hyF[i + 2], by + Math.sin(a) * c.hyF[i + 2]);
        }
      }
    }
  }
  function drawHyphae(rise) {
    var i;
    if (!colonised.length && !deadMyc.length) return;
    ctx.save();
    ctx.lineWidth = HYPHA_W;
    if (colonised.length) {
      ctx.strokeStyle = HYPHA_COLOR;
      ctx.beginPath();
      for (i = 0; i < colonised.length; i++) if (colonised[i].myc > 0) hyphaPath(colonised[i], rise, false);
      ctx.stroke();
    }
    if (deadMyc.length) {
      ctx.strokeStyle = HYPHA_DEAD_COLOR;
      ctx.beginPath();
      for (i = 0; i < deadMyc.length; i++) hyphaPath(deadMyc[i], rise, true);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Couche compacte : bande de triangles plats entre compactY et le fond du MONDE (worldH,
  // pas juste le bas de la boite H : le defilement vertical doit reveler du remplissage,
  // pas un trou). Jamais au-dessus du niveau d'origine, la terre meuble se dessine par-dessus. On ne dessine
  // que la portion du monde visible (autour de camX/camY), pas tout le monde a chaque frame.
  function drawSoil(rise) {
    var stepX = 2 * COL_W, bottom = worldH, visBottom = camY + H;
    var x0 = Math.max(0, Math.floor((camX - stepX) / stepX) * stepX);
    var x1 = Math.min(worldW, camX + W + stepX);
    var pts = [];
    for (var x = x0; x <= x1; x += stepX) {
      var cx = Math.min(x, worldW);
      var col = Math.max(0, Math.min(compactY.length - 1, Math.round(cx / COL_W)));
      pts.push([cx, compactY[col] + rise, !!rocky[col]]);
    }
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1];
      if (a[1] >= visBottom && b[1] >= visBottom) continue;
      // Un rocher affleure directement dans la couche compacte (voir buildRockyPatches) :
      // meme rendu low-poly que le reste du sol, juste teinte en gris pierre.
      var pal = (a[2] || b[2]) ? ROCK : SOIL;
      ctx.fillStyle = pal[i % pal.length];
      poly([a, b, [a[0], bottom]]);
      ctx.fillStyle = pal[(i + 1) % pal.length];
      poly([b, [b[0], bottom], [a[0], bottom]]);
    }
  }

  // Depots d'humus lessives (voir leach()) encore enfouis sous le plafond du compact : de
  // petits triangles sombres, juste assez visibles pour deviner ou la pelle va en retrouver.
  function drawCompactNutri(rise) {
    for (var i = 0; i < compactNutri.length; i++) {
      var d = compactNutri[i];
      if (d.x < camX - 20 || d.x > camX + W + 20) continue;
      var col = Math.max(0, Math.min(compactY.length - 1, Math.round(d.x / COL_W)));
      if (d.y <= compactY[col]) continue; // deja ramene au-dessus du plafond : plus la peine
      var y = d.y + rise, s = 5;
      ctx.fillStyle = d.color;
      poly([[d.x - s, y + s], [d.x + s, y + s], [d.x, y - s]]);
    }
  }

  // Fond de la terre meuble : aplat sous les facettes, entre compactY et un peu sous la
  // surface, pour qu'on ne voie pas le ciel entre les triangles empiles. Seulement la ou
  // il y a vraiment de la terre meuble (LOOSE_MIN) : au bord d'un trou, le lissage laisse
  // une fine epaisseur fantome, qu'on ne peint pas.
  var LOOSE_MIN = 4, LOOSE_INSET = 5;
  function drawLooseBacking(rise) {
    var c0 = Math.max(0, Math.floor(camX / COL_W) - 1);
    var c1 = Math.min(heights.length - 1, Math.ceil((camX + W) / COL_W) + 1);
    ctx.fillStyle = '#5a3d28';
    ctx.beginPath();
    for (var c = c0; c <= c1; c++) {
      var h = heights[c] - LOOSE_INSET;
      if (heights[c] < LOOSE_MIN || h <= 0) continue;
      var x = c * COL_W, yb = compactY[c] + rise;
      ctx.rect(x - COL_W / 2, yb - h, COL_W + 0.5, h + 1);
    }
    ctx.fill();
  }

  // Brins de gazon : quelques petits triangles pleins par colonne, hauteur proportionnelle
  // a grassCover[c] (pousse visiblement au fil de la repousse). Seed stable (pas de
  // Math.random() ici) pour que les brins ne scintillent pas d'une frame a l'autre.
  function drawGrass(rise) {
    if (!grassCover) return;
    var c0 = Math.max(0, Math.floor(camX / COL_W) - 1);
    var c1 = Math.min(grassCover.length - 1, Math.ceil((camX + W) / COL_W) + 1);
    var maxH = H * GRASS_MAX_H_F;
    for (var c = c0; c <= c1; c++) {
      var cov = grassCover[c];
      if (cov <= 0.03) continue;
      // +GRASS_EMBED : le terrain low-poly est irregulier, pas une ligne lisse — sans cet
      // enfoncement (meme principe que les champignons, surfaceAt(x) + 6 en drawMushroom),
      // la base des brins flotterait au-dessus des pointes de triangles de terre.
      var x = c * COL_W, y = surfaceAt(x) + rise + GRASS_EMBED;
      var bh = maxH * cov * (grassMyc && grassMyc[c] ? GRASS_MYC_HEIGHT_MULT : 1);
      for (var b = 0; b < 3; b++) {
        var seed = ((c * 7 + b * 3) % 11) / 11;
        var dx = (b - 1) * COL_W * 0.32, lean = (seed - 0.5) * bh * 0.5, h = bh * (0.65 + seed * 0.5);
        ctx.fillStyle = GRASS_COLOR[(c + b) % GRASS_COLOR.length];
        ctx.beginPath();
        ctx.moveTo(x + dx - 1.4, y);
        ctx.lineTo(x + dx + 1.4, y);
        ctx.lineTo(x + dx + lean, y - h);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // Hash entier stable a partir de l'indice de colonne : sert de graine pour placer la
  // mousse/le sous-bois sans jamais appeler Math.random() dans le dessin (rien ne doit
  // scintiller d'une frame a l'autre, meme principe que drawGrass ci-dessus).
  function floraHash(c) { return ((c * 2654435761) >>> 0) % 997 / 997; }

  // Mousse : fine bande collee au sol, dessinee juste avant les brins de gazon. Purement
  // cosmetique (voir section "Flore (cosmetique)") : montre que le sol cultive est vivant,
  // aucune incidence sur le jeu. Echantillonnee aux deux bords de la colonne (comme
  // GRASS_EMBED) pour suivre les bosses du terrain low-poly, decoupee en 2 triangles de
  // teintes differentes (pas de degrade).
  function drawMoss(rise) {
    if (!floraLush) return;
    var c0 = Math.max(0, Math.floor(camX / COL_W) - 1);
    var c1 = Math.min(floraLush.length - 1, Math.ceil((camX + W) / COL_W) + 1);
    for (var c = c0; c <= c1; c++) {
      var lush = floraLush[c];
      if (lush <= 0.08) continue;
      var xL = c * COL_W - COL_W / 2, xR = c * COL_W + COL_W / 2;
      var yL = surfaceAt(xL) + rise + FLORA_EMBED, yR = surfaceAt(xR) + rise + FLORA_EMBED;
      var th = MOSS_THICK * lush;
      ctx.fillStyle = MOSS_COLOR[c % MOSS_COLOR.length];
      poly([[xL, yL], [xR, yR], [xL, yL + th]]);
      ctx.fillStyle = MOSS_COLOR[(c + 2) % MOSS_COLOR.length];
      poly([[xR, yR], [xR, yR + th], [xL, yL + th]]);
      // Petit monticule plus fourni, sur environ une colonne sur trois et seulement une
      // fois la mousse bien installee : deborde un peu par-dessus la bande.
      if (lush > 0.4 && c % 3 === 0) {
        var mh = MOSS_THICK * 0.5 * lush, mw = COL_W * 2.4, mcx = c * COL_W, mcy = (yL + yR) / 2;
        ctx.fillStyle = '#7fae52';
        poly([[mcx - mw / 2, mcy], [mcx + mw / 2, mcy], [mcx, mcy - mh]]);
      }
    }
  }

  var TUFT_COLOR = ['#6f9c4a', '#82ad5b', '#5c8a3f', '#94bf62'];

  // Touffe d'herbe haute : eventail de 5 brins, comme drawGrass mais plus grands et plus
  // fournis — la densite (k, 0..1) grandit avec floraLush pour un effet de pousse.
  function drawTuft(x, y, k, c) {
    if (k <= 0) return;
    var maxH = H * FLORA_TUFT_H_F * k;
    for (var b = 0; b < 5; b++) {
      var seed = floraHash(c * 5 + b + 1);
      var lean = (-0.6 + (b / 4) * 1.2) * maxH;
      var bh = maxH * (0.7 + seed * 0.4);
      var dx = (b - 2) * 1.6;
      ctx.fillStyle = TUFT_COLOR[(b + (seed * 4 | 0)) % TUFT_COLOR.length];
      ctx.beginPath();
      ctx.moveTo(x + dx - 1.2, y);
      ctx.lineTo(x + dx + 1.2, y);
      ctx.lineTo(x + dx + lean, y - bh);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Fougere : 3-4 frondes qui partent de la base, chacune une tige effilee en 3 segments
  // courbee vers l'exterieur, avec des paires de folioles qui rapetissent vers la pointe.
  function drawFern(x, y, k, seedBase) {
    if (k <= 0) return;
    var maxH = H * FLORA_FERN_H_F * k;
    var fronds = 3 + (floraHash(seedBase + 2) < 0.5 ? 0 : 1);
    for (var fr = 0; fr < fronds; fr++) {
      var seed = floraHash(seedBase + fr + 3);
      var side = (fr % 2 === 0) ? 1 : -1;
      var curve = side * (0.18 + seed * 0.22);
      var fh = maxH * (0.75 + seed * 0.3);
      var segs = 3, pairs = 3 + (seed < 0.5 ? 0 : 1);
      var px = x, py = y, sg;
      ctx.fillStyle = '#3f7a3a';
      for (sg = 1; sg <= segs; sg++) {
        var t = sg / segs;
        var nx = x + curve * fh * t * t, ny = y - fh * t;
        var wA = 1.6 * (1 - (sg - 1) / segs), wB = 1.6 * (1 - sg / segs) + 0.3;
        poly([[px - wA, py], [px + wA, py], [nx + wB, ny], [nx - wB, ny]]);
        px = nx; py = ny;
      }
      // Folioles : paires de petits triangles le long de la tige, plus petites vers la pointe.
      for (var p = 1; p <= pairs; p++) {
        var t2 = p / (pairs + 1);
        var fx = x + curve * fh * t2 * t2, fy = y - fh * t2;
        var fs = (3 - 2 * t2) * 1.2;
        ctx.fillStyle = (p % 2) ? '#5a9a4a' : '#78b35c';
        poly([[fx, fy], [fx + fs * 2.2, fy - fs * 0.6], [fx + fs * 0.6, fy - fs * 1.4]]);
        poly([[fx, fy], [fx - fs * 2.2, fy - fs * 0.6], [fx - fs * 0.6, fy - fs * 1.4]]);
      }
    }
  }

  // Petit buisson : dome de triangles qui se chevauchent (comme l'eventail du chapeau de
  // drawMushroom), une facette claire a gauche (meme convention d'eclairage que le reste du
  // fichier), et parfois quelques minuscules baies/fleurs.
  function drawBush(x, y, k, seedBase) {
    if (k <= 0) return;
    var r = H * FLORA_BUSH_R_F * k;
    if (r <= 0) return;
    var n = 5 + (floraHash(seedBase + 4) < 0.5 ? 0 : 2);
    var colors = ['#4d7f3a', '#5f9444', '#3d6b30'];
    var cy = y - r * 0.7;
    for (var i = 0; i < n; i++) {
      var a0 = Math.PI + (i / n) * Math.PI, a1 = Math.PI + ((i + 1) / n) * Math.PI;
      ctx.fillStyle = i === 0 ? '#7cae57' : colors[i % colors.length];
      poly([[x, cy], [x + Math.cos(a0) * r, cy + Math.sin(a0) * r * 0.85], [x + Math.cos(a1) * r, cy + Math.sin(a1) * r * 0.85]]);
    }
    // Petites baies/fleurs, seulement environ une plante sur trois.
    if (floraHash(seedBase + 5) < 0.33) {
      var berry = floraHash(seedBase + 6) < 0.5 ? '#e9e2c8' : '#d9534f';
      var count = 2 + (floraHash(seedBase + 7) < 0.5 ? 0 : 1);
      ctx.fillStyle = berry;
      for (var b = 0; b < count; b++) {
        var ba = Math.PI + floraHash(seedBase + 8 + b) * Math.PI;
        var bx = x + Math.cos(ba) * r * 0.8, by = cy + Math.sin(ba) * r * 0.7;
        poly([[bx - 1, by], [bx + 1, by], [bx, by - 2]]);
      }
    }
  }

  // Sous-bois : place touffes hautes et petit feuillage (fougere ou buisson) sur des
  // colonnes choisies par graine stable, seulement au-dessus du seuil de densite de chaque
  // element ; la taille grandit avec floraLush (effet de pousse). Purement cosmetique,
  // dessine apres les racines et avant les champignons (voir draw()).
  function drawUnderbrush(rise) {
    if (!floraLush) return;
    var c0 = Math.max(0, Math.floor(camX / COL_W) - 1);
    var c1 = Math.min(floraLush.length - 1, Math.ceil((camX + W) / COL_W) + 1);
    for (var c = c0; c <= c1; c++) {
      var lush = floraLush[c];
      if (lush <= 0.25) continue;
      var h = floraHash(c);
      var baseX = c * COL_W + (h - 0.5) * COL_W * 0.8;
      var baseY = surfaceAt(baseX) + rise + FLORA_EMBED;
      // Touffe haute : environ une colonne sur deux.
      if (h < 0.5) drawTuft(baseX, baseY, Math.min(1, (lush - 0.25) / 0.75), c);
      // Petit feuillage : au plus une plante par bloc de 5 colonnes, a une place fixee par
      // le hash du bloc (~1 bloc sur 2). Ne depend ni de la camera ni des voisines, donc
      // rien n'apparait/disparait en defilant.
      if (lush > 0.5) {
        var blk = Math.floor(c / 5), hf = floraHash(blk * 31 + 7);
        if (hf < 0.5 && c === blk * 5 + Math.floor(floraHash(blk * 13 + 5) * 5)) {
          var fk = Math.min(1, (lush - 0.5) / 0.5), seedBase = c * 9;
          if (floraHash(c * 17 + 3) < 0.5) drawFern(baseX, baseY, fk, seedBase);
          else drawBush(baseX, baseY, fk, seedBase);
        }
      }
    }
  }

  // Fleurs au pied des arbres (voir spawnFlower/stepFlowers plus haut) : une seule espece
  // (anemone des bois, blanc rose), en 3 temps enchaines - tige, bouton, corolle en etoile de
  // 5 petales vue de trois-quarts (faceTilt) - puis une fanaison si sa branche est tombee.
  // Meme convention d'eclairage que le reste du fichier (haut-gauche plus clair) : chaque
  // petale recoit sa propre teinte selon son orientation face au soleil (FLOWER_LIGHT_A), en
  // plus du clair/sombre fixe entre ses deux moities (comme le tronc ou la tige). Jamais de
  // Math.random() ici : tout vient de f.* (fixe a la naissance) ou du temps (now/p/w).
  var FLOWER_LIGHT_A = -Math.PI * 0.75; // direction "haut-gauche", meme convention que shade()

  // Un petale = 2 triangles qui partagent la nervure centrale (base -> pointe), la pointe
  // etant elle-meme approximee par 2 points tres proches (tipA/tipB) plutot qu'un seul, pour
  // eviter un triangle a pointe brute. faceTilt ecrase la coordonnee "verticale" locale
  // (vue de trois-quarts) ; l'inclinaison generale (lean) est deja geree par le ctx.rotate
  // de l'appelant, pas ici.
  function drawPetal(ang, rad, faceTilt, colA, colB) {
    var ca = Math.cos(ang), sa = Math.sin(ang);
    function pt(lx, ly) { var x = ca * lx - sa * ly, y = sa * lx + ca * ly; return [x, y * faceTilt]; }
    var base = pt(0, 0), flankL = pt(rad * 0.55, -rad * 0.45), tipA = pt(rad, -rad * 0.12),
      tipB = pt(rad, rad * 0.12), flankR = pt(rad * 0.55, rad * 0.45), tipM = pt(rad * 1.04, 0);
    // Chaque moitie va jusqu'au bout de la nervure (tipM) : pas d'encoche a la pointe.
    ctx.fillStyle = colA;
    poly([base, flankL, tipA, tipM]);
    ctx.fillStyle = colB;
    poly([base, tipM, tipB, flankR]);
  }

  function drawFlower(f, rise) {
    if (f.x < camX - 30 || f.x > camX + W + 30) return;
    var now = vTime, p = clamp((now - f.born) / FLOWER_BLOOM_MS, 0, 1);
    if (p <= 0) return;
    var w = f.wilt !== null ? clamp((now - f.wilt) / FLOWER_WILT_MS, 0, 1) : 0;
    var leanSign = f.lean < 0 ? -1 : 1;
    var lean = f.lean + 0.6 * w * leanSign;
    var baseY = surfaceAt(f.x) + rise + FLORA_EMBED;
    var stemLocal = clamp(p / 0.35, 0, 1), stemG = easeOutBack(stemLocal);
    var stemH = FLOWER_H_F * H * f.sizeK * stemG * (1 - 0.35 * w);
    var stemW = Math.max(1.1, H * 0.0032 * f.sizeK);
    ctx.save();
    ctx.translate(f.x, baseY);
    ctx.rotate(lean);
    // Tige : 3 segments effiles, legerement courbes dans le sens de l'inclinaison (comme
    // les frondes de drawFern), deux facettes par segment (claire a gauche, sombre a droite).
    var curveK = stemH * 0.3 * leanSign, px = 0, py = 0, sg;
    for (sg = 1; sg <= 3; sg++) {
      var t0 = (sg - 1) / 3, t1 = sg / 3;
      var nx = curveK * t1 * t1, ny = -stemH * t1;
      var wA = stemW * (1 - t0 * 0.5), wB = stemW * (1 - t1 * 0.55);
      ctx.fillStyle = '#5f8f3c';
      poly([[px - wA, py], [px, py], [nx, ny], [nx - wB, ny]]);
      ctx.fillStyle = '#43702c';
      poly([[px, py], [px + wA, py], [nx + wB, ny], [nx, ny]]);
      px = nx; py = ny;
    }
    var tipX = px, tipY = py;
    // Feuille lanceolee a mi-hauteur, du cote f.leafSide : losange de 2 triangles partageant
    // la nervure base->pointe, qui se deploie avec la tige (echelle stemG).
    var midX = curveK * 0.25, midY = -stemH * 0.5;
    var leafLen = stemH * 0.6 * stemG, leafW = stemH * 0.24 * stemG;
    if (leafLen > 0.5) {
      var lTipX = midX + f.leafSide * leafLen, lTipY = midY - leafLen * 0.18;
      var lWx = midX + f.leafSide * leafLen * 0.42, lWTop = midY - leafW * 0.55, lWBot = midY + leafW * 0.55;
      ctx.fillStyle = '#6ea347';
      poly([[midX, midY], [lWx, lWTop], [lTipX, lTipY]]);
      ctx.fillStyle = '#4c7d33';
      poly([[midX, midY], [lTipX, lTipY], [lWx, lWBot]]);
    }
    if (p >= 0.35) {
      var budLocal = clamp((p - 0.35) / 0.2, 0, 1), budG = easeOutBack(budLocal);
      if (p < 0.55) {
        // Bouton : 2 sepales verts qui enserrent une goutte rose (3 triangles).
        var budR = FLOWER_R_F * H * f.sizeK * 0.55 * budG;
        if (budR > 0.4) {
          ctx.fillStyle = '#4c7d33';
          poly([[tipX, tipY], [tipX - budR * 0.55, tipY + budR * 0.15], [tipX - budR * 0.15, tipY - budR * 1.15]]);
          poly([[tipX, tipY], [tipX + budR * 0.55, tipY + budR * 0.15], [tipX + budR * 0.15, tipY - budR * 1.15]]);
          var budRgb = hexToRgb('#8f2530');
          ctx.fillStyle = rgbStr(budRgb);
          poly([[tipX, tipY - budR * 0.2], [tipX - budR * 0.4, tipY - budR * 0.9], [tipX, tipY - budR * 1.3]]);
          ctx.fillStyle = rgbStr(shade(budRgb, -0.15));
          poly([[tipX, tipY - budR * 0.2], [tipX, tipY - budR * 1.3], [tipX + budR * 0.4, tipY - budR * 0.9]]);
          ctx.fillStyle = rgbStr(shade(budRgb, 0.15));
          poly([[tipX - budR * 0.4, tipY - budR * 0.9], [tipX, tipY - budR * 1.3], [tipX + budR * 0.4, tipY - budR * 0.9]]);
        }
      } else {
        // Corolle : 5 petales en etoile, ouverture en easeOutBack non clampe (le petit
        // rebond final passe volontairement au-dela de la taille/angle de repos).
        // La corolle et le coeur se dessinent autour de (0,0) : on se place au bout de la tige.
        ctx.translate(tipX, tipY);
        var petalLocal = clamp((p - 0.55) / 0.45, 0, 1), og = easeOutBack(petalLocal);
        var maxRad = FLOWER_R_F * H * f.sizeK;
        var rad = maxRad * lerp(0.3, 1, og) * (1 - 0.5 * w);
        var upA = -Math.PI / 2, dropA = Math.PI / 2, i;
        var petals = [];
        for (i = 0; i < 5; i++) {
          var finalA = f.rot + i * (Math.PI * 2 / 5);
          var a = lerp(upA, finalA, og);
          if (w > 0) a = lerp(a, dropA, w);
          petals.push({ a: a, y: Math.sin(a) * rad * f.faceTilt });
        }
        petals.sort(function (p1, p2) { return p1.y - p2.y; }); // fond (haut de l'ellipse) avant devant
        var baseRgb = hexToRgb('#c8323c'), wiltRgb = hexToRgb('#7a4a3a');
        for (i = 0; i < petals.length; i++) {
          var pet = petals[i];
          // Orientation face au soleil (haut-gauche) : k borne pour ne jamais assombrir le
          // rouge sous ~'#9c2730' : assez de contraste entre faces sans virer au brun.
          var orientK = Math.cos(pet.a - FLOWER_LIGHT_A) * 0.15;
          var kA = Math.max(-0.22, orientK + 0.05), kB = Math.max(-0.22, orientK - 0.05);
          var rgbA = shade(baseRgb, kA), rgbB = shade(baseRgb, kB);
          if (w > 0) {
            rgbA = rgbA.map(function (c, j) { return Math.round(lerp(c, wiltRgb[j], w)); });
            rgbB = rgbB.map(function (c, j) { return Math.round(lerp(c, wiltRgb[j], w)); });
          }
          drawPetal(pet.a, rad, f.faceTilt, rgbStr(rgbA), rgbStr(rgbB));
        }
        // Coeur : petit disque en eventail de 6 triangles, alternant 2 tons de jaune.
        if (petalLocal > 0.15) {
          var coreR = maxRad * 0.28 * Math.min(1, petalLocal / 0.5);
          var coreCols = ['#f2c14e', '#dca32f'];
          for (i = 0; i < 6; i++) {
            var a0 = i / 6 * Math.PI * 2, a1 = (i + 1) / 6 * Math.PI * 2;
            ctx.fillStyle = coreCols[i % 2];
            poly([[0, 0], [Math.cos(a0) * coreR, Math.sin(a0) * coreR * f.faceTilt], [Math.cos(a1) * coreR, Math.sin(a1) * coreR * f.faceTilt]]);
          }
          // Etamines : minuscules triangles, seulement une fois la corolle presque grande ouverte.
          if (p > 0.85) {
            ctx.fillStyle = '#8a5a2b';
            for (i = 0; i < 5; i++) {
              var sa2 = f.rot * 1.3 + i * (Math.PI * 2 / 5);
              var ex = Math.cos(sa2) * coreR * 1.4, ey = Math.sin(sa2) * coreR * 1.4 * f.faceTilt;
              poly([[ex, ey], [ex + 1.5, ey - 1], [ex - 0.5, ey - 1.5]]);
            }
          }
        }
      }
    }
    ctx.restore();
  }

  function drawFlowers(rise) {
    for (var ti = 0; ti < trees.length; ti++) {
      var flowers = trees[ti].flowers;
      for (var i = 0; i < flowers.length; i++) drawFlower(flowers[i], rise);
    }
  }

  // Largeur des ailes du papillon (0.15..1) : bat normalement, sauf ~20% du temps (cycle
  // deterministe via age+glideSeed, jamais Math.random ici) ou il plane, ailes grandes
  // ouvertes et immobiles ; une fois pose, ouverture/fermeture lente (~1 Hz).
  function butterflyWingFactor(ins) {
    if (ins.state === 'landed') {
      var tPh = (ins.age - ins.landAt) / 1000 * Math.PI * 2;
      return Math.max(0.15, Math.abs(Math.cos(tPh)));
    }
    var gcyc = 3000, gt = ((ins.age + ins.glideSeed) % gcyc) / gcyc;
    if (gt < 0.2) return 1;
    var phase = (ins.age / 200) * Math.PI * 2 + ins.phaseWing;
    return Math.max(0.15, Math.abs(Math.cos(phase)));
  }
  // Une seule aile (anterieure ou posterieure), cote ySign (-1/1) : 2 triangles pleins
  // (face claire / face sombre), plus un bout d'aile sombre et un point creme sur les
  // anterieures seulement. La largeur (span) porte le battement, jamais la longueur.
  function drawButterflyWing(size, wf, ySign, anterior) {
    var ax = anterior ? size * 0.08 : -size * 0.32;
    var len = anterior ? size * 0.85 : size * 0.5;
    var span = (anterior ? size * 0.95 : size * 0.55) * wf;
    var pInner = [ax, 0];
    var pLead = [ax + len * 0.55, ySign * span * 0.35];
    var pOuter = [ax + len * 0.15, ySign * span];
    var pTrail = [ax - len * 0.55, ySign * span * 0.45];
    ctx.fillStyle = anterior ? '#e8923a' : '#d9812e';
    poly([pInner, pLead, pOuter]);
    ctx.fillStyle = anterior ? '#c46f22' : '#a85c1c';
    poly([pInner, pOuter, pTrail]);
    if (anterior) {
      var tip = [ax + len * 0.02, ySign * span * 1.12];
      ctx.fillStyle = '#3a2a20';
      poly([pLead, pOuter, tip]);
      var midX = (pInner[0] + pOuter[0]) / 2, midY = (pInner[1] + pOuter[1]) / 2, d = size * 0.09;
      ctx.fillStyle = '#f3e3c3';
      poly([[midX - d, midY], [midX + d, midY], [midX, midY - ySign * d]]);
    }
  }
  function drawButterfly(ins, size) {
    var wf = butterflyWingFactor(ins), s;
    for (s = -1; s <= 1; s += 2) {
      drawButterflyWing(size, wf, s, true);
      drawButterflyWing(size, wf, s, false);
    }
    var bl = size * 0.55, bw = size * 0.16;
    ctx.fillStyle = '#3a2a20';
    poly([[bl / 2, 0], [0, -bw / 2], [-bl / 2, 0], [0, bw / 2]]);
    var aLen = size * 0.4;
    poly([[bl * 0.4, -bw * 0.3], [bl * 0.4 + aLen, -bw * 1.6], [bl * 0.4 + aLen * 0.85, -bw * 1.5]]);
    poly([[bl * 0.4, bw * 0.3], [bl * 0.4 + aLen, bw * 1.6], [bl * 0.4 + aLen * 0.85, bw * 1.5]]);
  }
  // Battement du bourdon : alterne pleine largeur / largeur reduite d'une phase de 20ms a
  // l'autre (~25 Hz visuel), continue meme une fois pose.
  function beeWingFactor(ins) {
    return Math.floor(ins.age / 20) % 2 === 0 ? 1 : 0.4;
  }
  function drawBee(ins, size) {
    var wf = beeWingFactor(ins);
    var rx = size * 0.5, ry = size * 0.24, segs = 6;
    var cols = ['#f2c14e', '#3a2a20', '#dca32f', '#f2c14e', '#3a2a20', '#dca32f'];
    for (var i = 0; i < segs; i++) {
      var a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2;
      ctx.fillStyle = cols[i % cols.length];
      poly([[0, 0], [Math.cos(a0) * rx, Math.sin(a0) * ry], [Math.cos(a1) * rx, Math.sin(a1) * ry]]);
    }
    var wLen = size * 0.55 * wf;
    ctx.fillStyle = '#e6eef0';
    poly([[-size * 0.05, -ry * 0.6], [-size * 0.35, -ry * 0.6 - wLen], [-size * 0.5, -ry * 0.5]]);
    ctx.fillStyle = '#cdd9dc';
    poly([[size * 0.05, -ry * 0.6], [size * 0.05, -ry * 0.6 - wLen * 0.85], [size * 0.32, -ry * 0.55]]);
  }
  // Insecte cosmetique complet : se place et s'oriente legerement dans le sens du vol, puis
  // delegue a l'espece. Le bourdon pose ajoute un petit pietinement (+/-1.5px, purement
  // visuel, ne touche jamais ins.x/ins.y reels) tire de l'age ecoule, pas de Math.random.
  function drawInsect(ins) {
    var size = H * INSECT_SIZE_F * ins.sizeMult;
    var jx = 0, jy = 0;
    if (ins.species === 'bourdon' && ins.state === 'landed') {
      var jt = ins.age - ins.landAt;
      jx = Math.sin(jt / 220 + ins.landPh) * 1.5;
      jy = Math.cos(jt / 170 + ins.landPh * 1.3) * 0.8;
    }
    ctx.save();
    ctx.translate(ins.x + jx, ins.y + jy);
    ctx.rotate(0.14 * ins.dir);
    if (ins.species === 'papillon') drawButterfly(ins, size); else drawBee(ins, size);
    ctx.restore();
  }
  // Vol : derriere le decor (appelee juste apres le translate camera, avant drawSoil).
  function drawInsectsBack() {
    for (var i = 0; i < insects.length; i++) if (!insects[i].nearFlower) drawInsect(insects[i]);
  }
  // Approche finale / pose sur une fleur : devant le decor (apres drawFlowers).
  function drawInsectsFront() {
    for (var i = 0; i < insects.length; i++) if (insects[i].nearFlower) drawInsect(insects[i]);
  }

  function drawMushroom(m) {
    var t = Math.max(0, Math.min(1, m.t));
    if (t <= 0) return;
    var g = easeOutBack(t);
    var s = m.size * g;
    var stemH = s * 0.9, stemW = s * 0.22;
    ctx.save();
    ctx.translate(m.x, surfaceAt(m.x) + 6);
    ctx.rotate(m.lean * g);
    // pied : deux facettes (lumiere a gauche, ombre a droite)
    ctx.fillStyle = '#efe6d6';
    poly([[-stemW * 0.6, 0], [0, 0], [0, -stemH], [-stemW * 0.45, -stemH]]);
    ctx.fillStyle = '#d6c8b0';
    poly([[0, 0], [stemW * 0.6, 0], [stemW * 0.45, -stemH], [0, -stemH]]);
    // lamelles
    var capW = s * 0.95, capY = -stemH, capH = s * 0.55;
    ctx.fillStyle = m.sp.gill;
    poly([[-capW, capY], [capW, capY], [0, capY + s * 0.12]]);
    // chapeau : eventail de triangles, eclaire en haut-gauche
    var cap = hexToRgb(m.sp.cap), segs = 6;
    for (var i = 0; i < segs; i++) {
      var a0 = Math.PI + (i / segs) * Math.PI, a1 = Math.PI + ((i + 1) / segs) * Math.PI;
      ctx.fillStyle = rgbStr(shade(cap, 0.28 - (i / (segs - 1)) * 0.5));
      poly([[0, capY], [Math.cos(a0) * capW, capY + Math.sin(a0) * capH], [Math.cos(a1) * capW, capY + Math.sin(a1) * capH]]);
    }
    ctx.restore();
  }

  function poly(p) {
    ctx.beginPath();
    ctx.moveTo(p[0][0], p[0][1]);
    for (var i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
    ctx.closePath();
    ctx.fill();
  }

  // --- Tresors enfouis ---------------------------------------------------------------
  // Le reperage (petite facette qui scintille) et l'infobulle sont du HTML par-dessus
  // le canvas, pas du dessin : texte net, lien cliquable, et l'animation CSS du
  // scintillement ne force pas la boucle de rendu a tourner en continu.
  function setupTreasures() {
    clearTreasures();
    treasures = treasureDefs.map(function (def) {
      var glint = document.createElement('span');
      glint.className = 'logo-explosion-glint';
      glint.setAttribute('aria-hidden', 'true');
      container.appendChild(glint);
      // def.x est une fraction de la largeur du MONDE (pas du logo) : les tresors sont
      // repartis sur toute la zone explorable, pas seulement sous le logo.
      return { def: def, x: def.x * worldW, dig: 0, revealed: false, mushroom: null, glint: glint, tip: null, hint: null };
    });
    // Le tout premier tresor porte un repere en plus (halo + fleche) pour inciter a creuser.
    if (treasures.length) {
      var first = treasures[0];
      first.hint = document.createElement('div');
      first.hint.className = 'logo-explosion-hint';
      first.hint.setAttribute('aria-hidden', 'true');
      first.hint.innerHTML = '<span class="logo-explosion-hint-halo"></span><span class="logo-explosion-hint-arrow"></span>';
      container.appendChild(first.hint);
    }
    // On laisse la terre retomber avant de montrer ou creuser.
    setTimeout(function () {
      if (mode !== 'exploded') return;
      treasures.forEach(function (t) {
        if (!t.revealed) t.glint.classList.add('is-visible');
        if (t.hint) t.hint.classList.add('is-visible');
      });
      positionTreasureOverlays();
    }, 1600);
  }

  function clearTreasures() {
    treasures.forEach(function (t) {
      t.glint.remove();
      if (t.tip) t.tip.remove();
      if (t.hint) t.hint.remove();
    });
    treasures = [];
  }

  // Retire juste la bulle DOM (le rebuild fait tomber le champignon qui la portait) —
  // mycTipShown n'est PAS reinitialise : elle ne doit s'afficher qu'une fois par page.
  function clearMycTip() {
    if (mycTip) { mycTip.remove(); mycTip = null; }
    mycTipMushroom = null;
  }

  function treasureNear(x, y) {
    for (var i = 0; i < treasures.length; i++) {
      var t = treasures[i];
      var reach = t.revealed ? t.mushroom.size * 1.5 : 50;
      if (Math.abs(x - t.x) < 36 && y > surfaceAt(t.x) - reach) return t;
    }
    return null;
  }

  // Coup de pelle : les facettes posees autour du tresor sont projetees vers
  // l'exterieur (pas vers le haut, sinon elles retombent dans le trou).
  function digAt(t) {
    var sy = surfaceAt(t.x), R = isMobile ? 30 : 42;
    for (var i = 0; i < shards.length; i++) {
      var s = shards[i];
      if (!s.settled || Math.hypot(s.x - t.x, s.y - sy) > R) continue;
      var side = s.x === t.x ? (Math.random() < 0.5 ? -1 : 1) : (s.x < t.x ? -1 : 1);
      pileRemove(s);
      s.settled = false;
      s.vx = side * (1.5 + Math.random() * 2.5);
      s.vy = -3 - Math.random() * 3;
      s.vr = (Math.random() - 0.5) * 0.4;
    }
    startLoop();
  }

  function tryDig(t, amount) {
    if (t.revealed) return;
    t.dig += amount;
    if (t.dig >= DIG_TO_REVEAL) reveal(t);
  }

  function reveal(t) {
    t.revealed = true;
    t.glint.classList.remove('is-visible');
    if (t.hint) { t.hint.remove(); t.hint = null; }
    digAt(t);
    // t negatif : le trou s'ouvre d'abord, le champignon sort ensuite.
    t.mushroom = { x: t.x, size: H * 0.24, lean: 0, sp: SPECIES[t.def.species] || SPECIES[0], t: -0.4, treasure: true };
    mushrooms.push(t.mushroom);
    t.tip = buildTip(t.def);
    container.appendChild(t.tip);
    openTip(t);
    startLoop();
  }

  function buildTip(def) {
    var tip = document.createElement('div');
    tip.className = 'logo-explosion-tip';
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'logo-explosion-tip-close';
    close.setAttribute('aria-label', 'Fermer');
    close.textContent = '×';
    close.addEventListener('click', function (evt) {
      evt.stopPropagation();
      openTip(null);
    });
    tip.appendChild(close);
    if (def.img) {
      var im = document.createElement('img');
      im.src = def.img;
      im.alt = '';
      tip.appendChild(im);
    }
    var body = document.createElement('div');
    body.className = 'logo-explosion-tip-body';
    var title = document.createElement('strong');
    title.textContent = def.title || '';
    body.appendChild(title);
    if (def.text) {
      var p = document.createElement('p');
      p.textContent = def.text;
      body.appendChild(p);
    }
    if (def.url) {
      var a = document.createElement('a');
      a.href = def.url;
      a.textContent = def.cta || 'Voir le produit';
      body.appendChild(a);
    }
    tip.appendChild(body);
    return tip;
  }

  // Une seule infobulle ouverte a la fois : les tresors (et la bulle mycelium, active
  // valant la chaine 'myc') sont proches, elles se chevaucheraient.
  function openTip(active) {
    treasures.forEach(function (t) {
      if (t.tip) t.tip.classList.toggle('is-open', t === active);
    });
    if (mycTip) mycTip.classList.toggle('is-open', active === 'myc');
  }

  // Position d'une infobulle juste au-dessus du chapeau d'un champignon (monde -> ecran,
  // - camX/- camY) ; partagee par les tresors deterres et la bulle mycelium.
  function positionTipOverMushroom(tipEl, m) {
    var g = easeOutBack(Math.max(0, Math.min(1, m.t)));
    var capTop = surfaceAt(m.x) - camY + 6 - m.size * g * 1.45;
    var half = tipEl.offsetWidth / 2;
    var mScreenX = m.x - camX;
    var left = Math.max(half + 8, Math.min(W - half - 8, mScreenX));
    tipEl.style.left = left + 'px';
    tipEl.style.top = (capTop - 16) + 'px';
    tipEl.style.setProperty('--arrow-dx', (mScreenX - left) + 'px');
  }

  // Ces overlays sont du HTML positionne en absolu dans la boite : leurs coordonnees
  // doivent etre converties de monde vers ecran (- camX, - camY), contrairement au canvas
  // qui le fait via ctx.translate dans draw().
  function positionTreasureOverlays() {
    for (var i = 0; i < treasures.length; i++) {
      var t = treasures[i];
      var screenX = t.x - camX;
      if (!t.revealed) {
        t.glint.style.left = screenX + 'px';
        t.glint.style.top = (surfaceAt(t.x) - camY - 2) + 'px';
        if (t.hint) {
          t.hint.style.left = screenX + 'px';
          t.hint.style.top = (surfaceAt(t.x) - camY - 46) + 'px';
        }
        continue;
      }
      if (!t.tip) continue;
      positionTipOverMushroom(t.tip, t.mushroom);
    }
    if (mycTip && mycTipMushroom) positionTipOverMushroom(mycTip, mycTipMushroom);
  }

  // --- Reconstruction ----------------------------------------------------------------
  function rebuild() {
    if (mode !== 'exploded') return;
    mode = 'rebuilding';
    rebuildT = 0;
    camX = camMargin; // la camera revient au centre pendant que le logo se reconstruit
    camY = 0;
    mobileArrow = 0;
    mobileArrowY = 0;
    leaveHand(); // ce qu'on tenait/agrippait a la main ne survit pas a la reconstruction (rend aussi s.carried a false)
    // Les grains en vol n'ont pas de place dans le logo : ils disparaissent.
    shards = shards.filter(function (g) { return !g.grain && !g.extra && g.eaten === undefined; });
    colonised = []; fruited = {}; deadMyc = [];
    trees = []; litter = []; treeLife = false;
    insects = []; insectNextAt = null; insectLastT = null;
    compactNutri = []; drops = [];
    weather.raining = false; weather.clouds = []; weather.lastNow = null;
    weather.drought = false;
    updateDroughtIndicator();
    leaveBag();
    for (var i = 0; i < shards.length; i++) {
      var s = shards[i];
      s.sx = s.x; s.sy = s.y; s.srot = s.rot; s.smix = s.mix;
      s.delay = Math.random() * 0.35;
    }
    leaveShovel();
    clearTreasures();
    clearMycTip();
    setCaption(CAPTION_BEFORE);
    if (rebuildBtn) rebuildBtn.classList.add('d-none');
    hideHeaderToggle();
    hideDebugPanel();
    if (toolsBar) toolsBar.classList.add('d-none');
    if (speedWrap) speedWrap.classList.add('d-none');
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
    for (var i = 0; i < heights.length; i++) {
      heights[i] *= 0.9;
      compactY[i] += (groundY - compactY[i]) * 0.1;
    }
    for (i = 0; i < shards.length; i++) {
      var s = shards[i];
      var t = easeInOut(Math.max(0, Math.min(1, (rebuildT - s.delay) / 0.65)));
      s.x = lerp(s.sx, s.ox, t);
      // Logo : petit arc vers le haut. Lit de terre : retour a sa place puis sous le bord.
      s.y = s.soil ? lerp(s.sy, s.oy + soilDepth, t) : lerp(s.sy, s.oy, t) - Math.sin(t * Math.PI) * 40;
      s.rot = lerp(s.srot, 0, t);
      s.mix = lerp(s.smix, 0, t);
      if (s.myc) s.myc *= 0.93;
      s.nutri = null;
    }
    mushrooms.forEach(function (m) { m.t -= 0.06; });
    mushrooms = mushrooms.filter(function (m) { return m.t > 0; });
    if (rebuildT < 1) return true;
    resetToLogo();
    return false;
  }

  function resetToLogo() {
    mode = 'assembled';
    canvas.classList.add('d-none');
    fallbackImg.classList.remove('d-none');
    leaveShovel();
    clearTreasures();
    clearMycTip();
    if (rebuildBtn) rebuildBtn.classList.add('d-none');
    hideHeaderToggle();
    hideDebugPanel();
    if (toolsBar) toolsBar.classList.add('d-none');
    if (speedWrap) speedWrap.classList.add('d-none');
    if (scrollLeftBtn) scrollLeftBtn.classList.add('d-none');
    if (scrollRightBtn) scrollRightBtn.classList.add('d-none');
    if (scrollUpBtn) scrollUpBtn.classList.add('d-none');
    if (scrollDownBtn) scrollDownBtn.classList.add('d-none');
    mobileArrow = 0;
    mobileArrowY = 0;
    hoverScreenX = null; hoverScreenY = null;
    leaveBag();
    leaveHand();
    weather.raining = false; weather.clouds = []; weather.lastNow = null;
    weather.drought = false;
    updateDroughtIndicator();
    drops = []; compactNutri = [];
    shards = [];
    mushrooms = [];
    colonised = []; fruited = {}; deadMyc = [];
    bagGrainsLeft = 0; // le sac se re-achete (ou se re-offre s'il n'a jamais servi) au prochain versement
    trees = []; litter = []; treeLife = false;
    insects = []; insectNextAt = null; insectLastT = null;
    if (slowTimer !== null) { clearTimeout(slowTimer); slowTimer = null; }
  }

  // --- Evenements --------------------------------------------------------------------
  function getRelativePos(evt) {
    // container plutot que canvas : le canvas est en d-none (rect a 0) avant le clic.
    // Coordonnees ECRAN (relatives a la boite), pas encore converties en coord. monde.
    var rect = container.getBoundingClientRect();
    var p = evt.touches ? evt.touches[0] : evt;
    return { x: p.clientX - rect.left, y: p.clientY - rect.top };
  }

  // Coordonnees monde (ajoute le decalage camera courant) : a utiliser pour toute la
  // physique/logique (pelle, tresors, tas) une fois le monde explose.
  function getWorldPos(evt) {
    var p = getRelativePos(evt);
    return { x: p.x + camX, y: p.y + camY };
  }

  container.addEventListener('click', function (evt) {
    // Le bouton, les fleches et les infobulles sont dans la boite : leurs clics ne creusent pas.
    // (bug corrige : le bouton plein ecran et celui du header manquaient ici, un clic
    // dessus remontait jusqu'a ce listener et redeclenchait explode()/build() en plus
    // de l'action du bouton lui-meme.)
    if (evt.target.closest('#logo-explosion-rebuild, #logo-explosion-fullscreen, #logo-explosion-header-toggle, .logo-explosion-scroll, .logo-explosion-tip, .logo-explosion-tools')) return;
    var pos = getRelativePos(evt);
    if (mode === 'assembled') {
      // Seul un clic sur le logo (ou sa zone "play" juste en dessous) declenche
      // l'explosion : avant, n'importe quel clic dans la boite (meme le vide autour)
      // le faisait, ce qui ne correspond pas au curseur special affiche uniquement
      // au-dessus du logo.
      if (!evt.target.closest('#logo-explosion-fallback-wrap')) return;
      // camX vient d'etre (re)centre par build() : + camX donne la position monde de
      // l'origine de l'explosion, coherente avec les coord. monde des facettes.
      if (imgReady && build()) explode(pos.x + camX, pos.y);
      return;
    }
    // Une fois explose, tout passe par les evenements pointer du canvas (pelle + taps).
  });

  // Pointer events : meme code pour souris, doigt et stylet.
  // Souris : la pelle suit le survol, bouton maintenu = elle ralentit (mode precis). Le
  // survol pres des bords de la boite fait aussi defiler le monde (voir cameraSpeed).
  // Doigt : le bol suit le doigt, doigt leve = il se vide puis disparait ; le defilement
  // se fait avec les fleches tactiles (pas de survol possible au doigt).
  canvas.addEventListener('pointerdown', function (evt) {
    if (mode !== 'exploded') return;
    var screenPos = getRelativePos(evt);
    var pos = { x: screenPos.x + camX, y: screenPos.y + camY };
    if (evt.pointerType === 'mouse') { hoverScreenX = screenPos.x; hoverScreenY = screenPos.y; }
    try { canvas.setPointerCapture(evt.pointerId); } catch (e) { /* pas grave */ }
    pointerDown = pos;
    dragMoved = false;
    if (tool === 'hand') {
      if (!hand.on) enterHand(pos);
      hand.x = pos.x; hand.y = pos.y;
      // Feuille, puis branche, puis terre ; rien d'attrapable : le tap au relachement recolte comme avant.
      if (!handGrabTree(pos)) pickUpHand(pos);
      startLoop(); // le poing se ferme, meme sans rien dans la main
      return;
    }
    if (tool === 'mycelium') {
      if (!ensureBag()) { setCaption(CAPTION_NEED_MONEY); return; }
      if (!bag.on) enterBag(pos);
      bag.x = pos.x; bag.y = pos.y;
      bag.pouring = true;
      startLoop();
      return;
    }
    if (tool === 'tree') return; // se plante au relachement (tap), pas d'outil traine au curseur
    if (tool === 'fertilizer') { openTip(null); dropFertilizer(pos.x); return; }
    if (!shovel.on) enterShovel(pos);
    shovel.gx = pos.x; shovel.gy = pos.y;
    shovel.held = evt.pointerType === 'mouse';
    shovel.pouring = false; shovel.hideWhenEmpty = false;
    startLoop();
  });

  canvas.addEventListener('pointermove', function (evt) {
    if (mode !== 'exploded') return;
    var screenPos = getRelativePos(evt);
    var pos = { x: screenPos.x + camX, y: screenPos.y + camY };
    if (evt.pointerType === 'mouse') { hoverScreenX = screenPos.x; hoverScreenY = screenPos.y; }
    if (tool === 'mycelium') {
      if (!bag.on) enterBag(pos);
      bag.x = pos.x; bag.y = pos.y;
    } else if (tool === 'shovel') {
      if (!shovel.on) enterShovel(pos);
      shovel.gx = pos.x; shovel.gy = pos.y;
    } else if (tool === 'hand') {
      if (!hand.on && (evt.pointerType === 'mouse' || pointerDown)) enterHand(pos);
      hand.x = pos.x; hand.y = pos.y;
    } else if (tool === 'fertilizer' && pointerDown) {
      dropFertilizer(pos.x);
    }
    if (evt.pointerType === 'mouse' && !pointerDown) {
      // Survoler un tresor deja deterre rouvre son infobulle sans avoir a cliquer.
      var hoverT = treasureNear(pos.x, pos.y);
      if (hoverT && hoverT.revealed) openTip(hoverT);
    }
    if (pointerDown && Math.hypot(pos.x - pointerDown.x, pos.y - pointerDown.y) > 6) dragMoved = true;
    startLoop();
  });

  function endPress(evt, allowTap) {
    if (!pointerDown) return;
    if (tool === 'hand') {
      var hadGrip = !!hand.grip;
      hand.grip = null; // relachee avant de casser : la branche revient droite, rien d'autre
      if (handCarry.length) {
        // On relache la prise : la gravite fait le reste (chute et pose normales, meme
        // chemin que pour n'importe quelle facette delogee par la pelle, voir step()).
        for (var hi = 0; hi < handCarry.length; hi++) handCarry[hi].carried = false;
        handCarry = [];
      } else if (allowTap && !dragMoved && !hadGrip) {
        // Un tap sur le monde ferme aussi l'infobulle ouverte (tresor ou bulle mycelium).
        var handWp = getWorldPos(evt), handT = treasureNear(handWp.x, handWp.y);
        if (!(handT && handT.revealed)) openTip(null);
        harvestAt(handWp);
      }
      pointerDown = null;
      if (evt.pointerType !== 'mouse') leaveHand(); // au doigt la main n'existe que pendant l'appui
      startLoop();
      return;
    }
    if (tool === 'mycelium') {
      bag.pouring = false;
      // Au sac, un tap ne creuse pas : il rouvre seulement l'infobulle d'un tresor deja sorti.
      if (allowTap && !dragMoved) {
        var wp = getWorldPos(evt), t = treasureNear(wp.x, wp.y);
        if (t && t.revealed) openTip(t); else openTip(null);
      }
      if (evt.pointerType !== 'mouse') leaveBag();
      pointerDown = null;
      startLoop();
      return;
    }
    if (tool === 'fertilizer') {
      pointerDown = null;
      startLoop();
      return;
    }
    if (tool === 'tree') {
      if (allowTap && !dragMoved) {
        openTip(null); // un tap plante un arbre mais ferme d'abord toute infobulle ouverte
        plantTree(getWorldPos(evt).x);
      }
      pointerDown = null;
      startLoop();
      return;
    }
    shovel.held = false;
    if (allowTap && !dragMoved) handleTap(getWorldPos(evt));
    if (evt.pointerType !== 'mouse' && shovel.on) {
      shovel.pouring = true;
      shovel.hideWhenEmpty = true;
    }
    pointerDown = null;
    startLoop();
  }

  canvas.addEventListener('pointerup', function (evt) { endPress(evt, true); });
  canvas.addEventListener('pointercancel', function (evt) { endPress(evt, false); });
  canvas.addEventListener('pointerleave', function (evt) {
    if (evt.pointerType === 'mouse' && !pointerDown) {
      leaveShovel();
      leaveBag();
      leaveHand();
      hoverScreenX = null; hoverScreenY = null;
    }
  });

  if (rebuildBtn) rebuildBtn.addEventListener('click', rebuild);
  // Reutilise le mecanisme de header compact expose par nav-compact.js (voir
  // window.sporaHeaderCompact) plutot que d'en refaire un : simple bascule manuelle,
  // en plus de celle au scroll. Verifie sa presence pour ne rien casser si ce script
  // change ou ne s'est pas encore charge.
  if (headerToggleBtn) {
    headerToggleBtn.addEventListener('click', function () {
      if (!window.sporaHeaderCompact || typeof window.sporaHeaderCompact.set !== 'function') return;
      var next = !window.sporaHeaderCompact.isCompact();
      window.sporaHeaderCompact.set(next);
      headerToggleBtn.classList.toggle('is-active', next);
      headerToggleBtn.setAttribute('aria-pressed', next ? 'true' : 'false');
      headerToggleBtn.setAttribute('aria-label', next ? 'Déplier le menu' : 'Replier le menu');
      headerToggleBtn.setAttribute('title', next ? 'Déplier le menu' : 'Replier le menu');
    });
  }
  // Redeplie le header si la demo l'a compacte, plutot que de laisser le visiteur
  // avec un menu replie qui n'a plus de bouton visible pour le rouvrir une fois le
  // jeu remis a zero (le bouton lui-meme redevient d-none).
  function hideHeaderToggle() {
    if (!headerToggleBtn) return;
    headerToggleBtn.classList.add('d-none');
    if (headerToggleBtn.classList.contains('is-active') && window.sporaHeaderCompact && typeof window.sporaHeaderCompact.set === 'function') {
      window.sporaHeaderCompact.set(false);
    }
    headerToggleBtn.classList.remove('is-active');
    headerToggleBtn.setAttribute('aria-pressed', 'false');
    headerToggleBtn.setAttribute('aria-label', 'Replier le menu');
    headerToggleBtn.setAttribute('title', 'Replier le menu');
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
    if (mode === 'assembled') return; // pas encore explose : build() lira la taille a jour au clic
    var rect = container.getBoundingClientRect();
    if (Math.round(rect.width) !== Math.round(W)) {
      // La largeur a aussi change (jamais le cas pour le bouton plein ecran lui-meme,
      // mais garde-fou si une barre de defilement s'en mele) : seul cas ou on doit
      // vraiment tout reconstruire, comme le fait deja le listener de resize plus bas.
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      resetToLogo();
      return;
    }
    var newH = rect.height;
    if (Math.round(newH) === Math.round(H)) return;
    H = newH;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    // groundY et le sol existant restent en coordonnees monde absolues, inchanges :
    // seule la fenetre visible (camY..camY+H) grandit ou retrecit.
    worldH = Math.max(worldH, H + H * DEPTH_MULT);
    camY = clamp(camY, 0, worldH - H);
  }
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', function () {
      var next = !container.classList.contains('is-fullscreen');
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
  // --- Panneau de parametres de simulation (debug) ------------------------------------
  // Genere depuis DEBUG_FIELDS plutot qu'ecrit a la main (~90 constantes) : chaque entree
  // est [groupe, cle, etiquette, min, max, step]. getDebugVar/setDebugVar utilisent eval()
  // uniquement parce que ce theme n'a pas de build step qui permettrait de refactorer ces
  // ~90 `var` en un objet de config sans reecrire toutes leurs references dans le fichier ;
  // les noms passes a eval() viennent exclusivement de ce tableau fige ci-dessous, jamais
  // d'une entree utilisateur, donc aucun risque d'injection.
  var DEBUG_FIELDS = [
    ['Monde (reconstruire pour appliquer)', 'CELLS_ACROSS', 'Facettes du logo', 20, 300, 5],
    ['Monde (reconstruire pour appliquer)', 'COL_W', 'Resolution colonnes', 2, 20, 1],
    ['Monde (reconstruire pour appliquer)', 'BEDROCK_MARGIN', 'Marge roche-mere', 0, 200, 5],
    ['Monde (reconstruire pour appliquer)', 'WORLD_MULT', 'Largeur du monde', 1, 8, 0.5],
    ['Monde (reconstruire pour appliquer)', 'DEPTH_MULT', 'Profondeur du monde', 0.5, 6, 0.5],
    ['Monde (reconstruire pour appliquer)', 'SOIL_RISE_FRAMES', 'Frames montee du sol', 1, 120, 1],
    ['Camera', 'CAMERA_EDGE', 'Zone de defilement', 0, 1, 0.01],
    ['Camera', 'CAMERA_MAX', 'Vitesse defilement H', 0, 15, 0.1],
    ['Camera', 'CAMERA_MAX_Y', 'Vitesse defilement V', 0, 15, 0.1],
    ['Terre', 'GRAVITY', 'Gravité', 0, 2, 0.01],
    ['Terre', 'WIND_STRENGTH', 'Vent (feuilles)', 0, 3, 0.05],
    ['Terre', 'AIR', 'Frottement air', 0.9, 1, 0.001],
    ['Terre', 'REPOSE', 'Angle de repos', 0, 30, 0.5],
    ['Terre', 'LOOSE_DRAW_SCALE', 'Échelle terre meuble', 1, 3, 0.05],
    ['Terre', 'LOGO_BULK', 'Foisonnement logo', 1, 3, 0.05],
    ['Terre', 'DECOMPACT_BULK', 'Foisonnement décompact', 1, 3, 0.05],
    ['Terre', 'LOOSE_MIN', 'Seuil terre meuble', 0, 20, 1],
    ['Terre', 'LOOSE_INSET', 'Retrait terre meuble', 0, 20, 1],
    ['Pelle', 'BLADE_WIDTH', 'Largeur lame', 0.05, 1, 0.01],
    ['Pelle', 'BOWL_SPAN', 'Ouverture bol', 0.05, 1.5, 0.01],
    ['Pelle', 'BOWL_T', 'Épaisseur paroi', 1, 20, 1],
    ['Pelle', 'POUR_ANGLE', 'Angle de versement', 0.5, 3.14, 0.05],
    ['Pelle', 'SLOW_FOLLOW', 'Suivi mode précis', 0.01, 1, 0.01],
    ['Pelle', 'DIG_BITE', 'Tolérance morsure', 0, 20, 1],
    ['Pelle', 'DIG_SPEED', 'Vitesse de creusage', 0.1, 5, 0.1],
    ['Pelle', 'DIG_SPEED_DOWN', 'Vitesse verticale', 0.05, 3, 0.05],
    ['Pelle', 'BLADE_FIELD', 'Zone de force', 0.01, 0.5, 0.01],
    ['Pelle', 'BLADE_PULL', 'Rattrapage vitesse', 0.01, 1, 0.01],
    ['Pelle', 'BLADE_ATTRACT', 'Attraction lame', 0.01, 1, 0.01],
    ['Main / trésors', 'HAND_PICK_R', 'Rayon de ramassage', 2, 60, 1],
    ['Main / trésors', 'HAND_GRAB_MAX', 'Facettes par poignée', 1, 20, 1],
    ['Main / trésors', 'DIG_TO_REVEAL', 'Coups pour déterrer', 1, 10, 1],
    ['Mycélium', 'MYC_GROW', 'Vitesse de blanchiment', 0.0005, 0.05, 0.0005],
    ['Mycélium', 'MYC_READY', 'Seuil de propagation', 0, 1, 0.01],
    ['Mycélium', 'MYC_SPREAD_EVERY', 'Frames entre propagations', 1, 60, 1],
    ['Mycélium', 'MYC_SPREAD_P', 'Chance de propagation', 0, 1, 0.01],
    ['Mycélium', 'MYC_RADIUS', 'Portée depuis inoculation', 0.05, 2, 0.01],
    ['Mycélium', 'HYPHA_W', 'Épaisseur des filaments', 0.3, 4, 0.1],
    ['Mycélium', 'FRUIT_W', 'Largeur zone fructification', 0.02, 1, 0.01],
    ['Mycélium', 'FRUIT_MIN', 'Facettes pour fructifier', 1, 30, 1],
    ['Mycélium', 'MYC_DECOMPOSE_REACH', 'Portée décomposition', 10, 400, 5],
    ['Mycélium', 'MYC_DECOMPOSE_MULT', 'Vitesse décomposition', 1, 60, 1],
    ['Mycélium', 'MYC_STARVE_MS', 'Délai avant famine', 1000, 300000, 1000],
    ['Mycélium', 'MYC_DECAY', 'Vitesse extinction famine', 0.0005, 0.05, 0.0005],
    ['Mycélium', 'MYC_ACTIVE_FEED_MS', 'Fenêtre "activement nourri"', 200, 20000, 100],
    ['Mycélium', 'MYC_HOLD_REACH', 'Portée retenue lessivage', 5, 200, 5],
    ['Mycélium', 'MYC_HOLD_MAX_MS', 'Durée max retenue', 1000, 600000, 1000],
    ['Mycélium', 'MYC_RANDOM_DEATH_P', 'Mort aléatoire (par vérif.)', 0, 0.05, 0.0005],
    ['Mycélium', 'MYC_RANDOM_DEATH_CHECK_MS', 'Intervalle mort aléatoire', 200, 20000, 100],
    ['Mycélium', 'MAX_MUSHROOMS', 'Champignons max', 4, 100, 1],
    ['Mycélium', 'MUSHROOM_STARVE_MS', 'Famine d\'un champignon', 1000, 60000, 500],
    ['Gazon', 'GRASS_MAX_H_F', 'Hauteur des brins', 0.002, 0.1, 0.001],
    ['Gazon', 'GRASS_EMBED', 'Enfoncement des brins', 0, 30, 1],
    ['Gazon', 'GRASS_REGROW_MS', 'Vitesse de repousse', 2000, 300000, 1000],
    ['Gazon', 'GRASS_SPREAD_BONUS', 'Bonus voisine gazonnée', 1, 20, 0.5],
    ['Gazon', 'GRASS_NEIGHBOR_MIN', 'Seuil voisine gazonnée', 0, 1, 0.01],
    ['Gazon', 'GRASS_BASELINE_FOLLOW', 'Suivi référence perturbation', 0.001, 0.5, 0.001],
    ['Gazon', 'GRASS_DISTURB_EPS', 'Seuil de perturbation', 0.5, 30, 0.5],
    ['Gazon', 'GRASS_FRUIT_MIN', 'Couverture min. production', 0, 1, 0.01],
    ['Gazon', 'GRASS_NUTRI_CHECK_MS', 'Fréquence de production', 500, 60000, 500],
    ['Gazon', 'GRASS_NUTRI_P', 'Chance de production', 0, 1, 0.01],
    ['Gazon', 'GRASS_NUTRI_AREA', 'Taille d\'un nutriment', 1, 100, 1],
    ['Gazon', 'GRASS_MYC_REACH', 'Portée symbiose mycélium', 5, 200, 5],
    ['Gazon', 'GRASS_MYC_SURFACE_DEPTH', 'Profondeur max mycélium', 2, 100, 2],
    ['Gazon', 'GRASS_MYC_HEIGHT_MULT', 'Hauteur si mycélium dessous', 1, 4, 0.1],
    ['Gazon', 'GRASS_MYC_NUTRI_WEIGHT', 'Poids production si mycélium', 1, 6, 0.5],
    ['Flore', 'FLORA_TREE_R_MAX', 'Portée max des arbres', 0.05, 0.8, 0.01],
    ['Flore', 'FLORA_TREE_W', 'Poids des arbres', 0, 2, 0.05],
    ['Flore', 'FLORA_MYC_W', 'Poids du mycélium', 0, 2, 0.05],
    ['Flore', 'FLORA_GROW_MS', 'Vitesse de pousse', 1000, 60000, 500],
    ['Flore', 'MOSS_THICK', 'Épaisseur de la mousse', 0, 15, 0.5],
    ['Flore', 'FLORA_TUFT_H_F', 'Hauteur des touffes', 0.005, 0.1, 0.001],
    ['Flore', 'FLORA_FERN_H_F', 'Hauteur des fougères', 0.01, 0.2, 0.005],
    ['Flore', 'FLORA_BUSH_R_F', 'Rayon des buissons', 0.005, 0.1, 0.001],
    ['Fleurs', 'FLOWER_MAX_PER_TREE', 'Fleurs max par arbre', 0, 20, 1],
    ['Fleurs', 'FLOWER_BLOOM_MS', 'Vitesse d\'eclosion', 300, 10000, 100],
    ['Fleurs', 'FLOWER_H_F', 'Hauteur de la tige', 0.01, 0.15, 0.005],
    ['Fleurs', 'FLOWER_R_F', 'Rayon de la corolle', 0.004, 0.05, 0.001],
    ['Arbres / racines', 'ROOT_REACH', 'Portée horizontale', 0.02, 1, 0.01],
    ['Arbres / racines', 'ROOT_VISUAL_REACH', 'Longueur racines dessinées', 0.02, 1, 0.01],
    ['Arbres / racines', 'ROOT_DEPTH_MIN', 'Profondeur à la naissance', 0.01, 1, 0.01],
    ['Arbres / racines', 'ROOT_DEPTH_MAX', 'Profondeur à maturité', 0.02, 1, 0.01],
    ['Arbres / racines', 'MIN_LEACH_TO_EAT', 'Crans avant mangeable', 0, 20, 1],
    ['Arbres / racines', 'NUTRI_RIPEN_MS', 'Maturation sans pluie', 1000, 300000, 1000],
    ['Arbres / racines', 'EAT_MS', 'Délai entre repas', 100, 120000, 100],
    ['Arbres / racines', 'ABUNDANCE_THRESHOLD', 'Seuil d\'abondance', 1, 100, 1],
    ['Arbres / racines', 'ABUNDANCE_EAT_MULT', 'Accélération si abondance', 1, 10, 0.5],
    ['Arbres / racines', 'ABUNDANCE_LEAF_FILL', 'Feuilles remplies d\'un coup', 1, 30, 1],
    ['Arbres / racines', 'BONUS_BRANCH_COST', 'Coût d\'une branche bonus', 1, 20, 1],
    ['Arbres / racines', 'BONUS_BRANCH_MAX', 'Branches bonus max', 1, 30, 1],
    ['Arbres / racines', 'BONUS_BRANCH_LIFE_MS', 'Durée de vie d\'une branche', 5000, 600000, 5000],
    ['Arbres / racines', 'BRANCH_LITTER_MS', 'Décomposition du bois', 30000, 6000000, 30000],
    ['Arbres / racines', 'BRANCH_GROW_MS', 'Vitesse de croissance branche', 500, 60000, 500],
    ['Arbres / racines', 'MATURE_NUTRIENTS', 'Nutriments à maturité', 1, 60, 1],
    ['Arbres / racines', 'ROOT_GROWTH_MIN', 'Racines à la naissance', 0, 1, 0.01],
    ['Arbres / racines', 'LEAF_UNLOCK_MIN', 'Feuilles à la naissance', 1, 40, 1],
    ['Arbres / racines', 'TREE_SCALE_MIN', 'Taille à la naissance', 0.05, 1, 0.01],
    ['Arbres / racines', 'TREE_SCALE_MAX', 'Taille à maturité', 0.5, 4, 0.05],
    ['Arbres / racines', 'MAX_TREES', 'Arbres max', 1, 20, 1],
    ['Arbres / racines', 'TREE_MIN_SPACING', 'Espacement min. plantation', 10, 400, 5],
    ['Arbres / racines', 'TREE_STARVE_MS', 'Délai avant famine', 2000, 300000, 1000],
    ['Arbres / racines', 'TREE_SHRINK_MS', 'Rythme de rétrécissement', 500, 60000, 500],
    ['Arbres / racines', 'TREE_EMBED', 'Enfoncement du pied', 0, 60, 1],
    ['Arbres / racines', 'EATEN_MS', 'Durée d\'absorption', 50, 10000, 50],
    ['Arbres / racines', 'LEAF_GROW_MS', 'Durée de pousse', 50, 10000, 50],
    ['Arbres / racines', 'CANOPY_CLUSTER_R', 'Rayon des bouquets', 0.02, 0.15, 0.005],
    ['Arbres / racines', 'LEAF_LIFE_MS[0]', 'Durée de vie feuille (min)', 5000, 150000, 1000],
    ['Arbres / racines', 'LEAF_LIFE_MS[1]', 'Durée de vie feuille (max)', 5000, 240000, 1000],
    ['Arbres / racines', 'LITTER_MS', 'Décomposition seule', 5000, 1200000, 5000],
    ['Arbres / racines', 'LITTER_BULK', 'Hauteur litière posée', 0, 1, 0.05],
    ['Arbres / racines', 'LITTER_FLAT', 'Écrasement litière posée', 0.1, 1, 0.05],
    ['Météo / lessivage', 'STORM_MS[0]', 'Durée tempête (min)', 500, 60000, 500],
    ['Météo / lessivage', 'STORM_MS[1]', 'Durée tempête (max)', 500, 90000, 500],
    ['Météo / lessivage', 'STORM_GAP_MS[0]', 'Délai avant tempête (min)', 2000, 300000, 1000],
    ['Météo / lessivage', 'STORM_GAP_MS[1]', 'Délai avant tempête (max)', 2000, 300000, 1000],
    ['Météo / lessivage', 'STORM_LEACH_MULT', 'Multiplicateur de lessivage', 1, 20, 0.5],
    ['Météo / lessivage', 'STORM_SPAWN_MULT', 'Multiplicateur de gouttes', 1, 10, 0.5],
    ['Météo / lessivage', 'RAIN_SHOWER_MS[0]', 'Durée averse (min)', 2000, 120000, 1000],
    ['Météo / lessivage', 'RAIN_SHOWER_MS[1]', 'Durée averse (max)', 2000, 180000, 1000],
    ['Météo / lessivage', 'RAIN_DRY_MS[0]', 'Durée sec entre averses (min)', 2000, 300000, 1000],
    ['Météo / lessivage', 'RAIN_DRY_MS[1]', 'Durée sec entre averses (max)', 2000, 300000, 1000],
    ['Météo / lessivage', 'DROUGHT_MS[0]', 'Durée sécheresse (min)', 2000, 120000, 1000],
    ['Météo / lessivage', 'DROUGHT_MS[1]', 'Durée sécheresse (max)', 2000, 180000, 1000],
    ['Météo / lessivage', 'DROUGHT_GAP_MS[0]', 'Durée sans sécheresse (min)', 2000, 300000, 1000],
    ['Météo / lessivage', 'DROUGHT_GAP_MS[1]', 'Durée sans sécheresse (max)', 2000, 300000, 1000],
    ['Météo / lessivage', 'LEACH_INTERVAL_MS', 'Rythme du lessivage', 10, 2000, 10],
    ['Météo / lessivage', 'LEACH_MAX_STEPS_PER_FRAME', 'Plafond de rattrapage/frame', 10, 1000, 10],
    ['Météo / lessivage', 'LEACH_P', 'Chance de lessivage (sol nu)', 0, 1, 0.01],
    ['Météo / lessivage', 'COMPACT_SINK_SPEED', 'Enfoncement dans le compact', 0.005, 1, 0.005],
    ['Météo / lessivage', 'RAIN_FADE_MS', 'Fondu des nuages', 200, 10000, 100],
    ['Météo / lessivage', 'RAIN_DROP_MAX', 'Gouttes max', 10, 1000, 10],
    ['Météo / lessivage', 'RAIN_SPAWN_MAX', 'Gouttes par frame', 1, 30, 1],
    ['Météo / lessivage', 'RAIN_CLOUDS_N', 'Nombre de nuages', 1, 20, 1],
    ['Météo / lessivage', 'RAIN_CLOUD_DRIFT', 'Dérive des nuages', 0.0005, 0.05, 0.0005],
    ['Météo / lessivage', 'DROUGHT_SURFACE_DEPTH', 'Profondeur exposée', 2, 100, 2],
    ['Météo / lessivage', 'DROUGHT_KILL_P', 'Chance de coup de sec', 0, 0.5, 0.005],
    ['Météo / lessivage', 'MYC_DROUGHT_DECAY', 'Dégâts d\'un coup de sec', 0.01, 1, 0.01],
    ['Météo / lessivage', 'LEAF_RAIN_P', 'Descente feuilles (chance)', 0, 0.2, 0.005],
    ['Météo / lessivage', 'LEAF_RAIN_MAX_DROP', 'Descente feuilles max (px)', 0, 100, 1],
    ['Météo / lessivage', 'DEAD_MYC_DECOMPOSE_P', 'Décomposition myc. mort', 0, 0.2, 0.005],
    ['Économie', 'BAG_COST', 'Coût d\'un sac', 1, 200, 1],
    ['Économie', 'BAG_GRAINS', 'Grains par sac', 50, 5000, 50],
    ['Économie', 'MUSHROOM_PRICE', 'Prix d\'un champignon', 1, 100, 1],
    ['Insectes', 'INSECT_MAX', 'Insectes simultanes', 0, 10, 1],
    ['Insectes', 'INSECT_GAP_MIN_MS', 'Attente min. apparition', 1000, 60000, 500],
    ['Insectes', 'INSECT_GAP_MAX_MS', 'Attente max. apparition', 1000, 120000, 1000],
    ['Insectes', 'INSECT_SPEED', 'Vitesse de vol', 0.2, 3, 0.1],
    ['Insectes', 'INSECT_SIZE_F', 'Taille', 0.004, 0.04, 0.001],
    ['Insectes', 'INSECT_LAND_P', 'Chance de se poser', 0, 1, 0.05]
  ];
  function getDebugVar(name) { return eval(name); }
  function setDebugVar(name, value) { eval(name + ' = ' + value + ';'); }
  var debugDefaults = null, debugBuilt = false;
  function buildDebugPanel() {
    if (!debugPanel || debugBuilt) return;
    debugBuilt = true;
    debugDefaults = {};
    var groups = [], byGroup = {};
    for (var i = 0; i < DEBUG_FIELDS.length; i++) {
      var f = DEBUG_FIELDS[i];
      debugDefaults[f[1]] = getDebugVar(f[1]);
      if (!byGroup[f[0]]) { byGroup[f[0]] = []; groups.push(f[0]); }
      byGroup[f[0]].push(f);
    }
    var frag = document.createDocumentFragment();
    groups.forEach(function (g) {
      var fs = document.createElement('fieldset');
      var lg = document.createElement('legend');
      lg.textContent = g;
      fs.appendChild(lg);
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
      frag.appendChild(fs);
    });
    var resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'logo-explosion-debug-reset';
    resetBtn.textContent = 'Réinitialiser les valeurs';
    resetBtn.addEventListener('click', function () {
      for (var k in debugDefaults) setDebugVar(k, debugDefaults[k]);
      var inputs = debugPanel.querySelectorAll('input[type="range"]');
      for (var j = 0; j < inputs.length; j++) {
        var inp = inputs[j], key2 = inp.id.slice(4);
        inp.value = debugDefaults[key2];
        inp.nextSibling.textContent = inp.value;
      }
    });
    frag.appendChild(resetBtn);
    debugPanel.appendChild(frag);
  }
  if (debugToggleBtn) {
    debugToggleBtn.addEventListener('click', function () {
      buildDebugPanel();
      var opening = debugPanel.classList.contains('d-none');
      debugPanel.classList.toggle('d-none', !opening);
      debugToggleBtn.classList.toggle('is-active', opening);
      debugToggleBtn.setAttribute('aria-pressed', opening ? 'true' : 'false');
    });
  }
  for (var ti = 0; ti < toolBtns.length; ti++) {
    toolBtns[ti].addEventListener('click', function () { setTool(this.getAttribute('data-tool')); });
  }
  // Slider de debug : accelere le cycle bois/mycelium/arbres (voir vTime) pour experimenter
  // sans attendre les minutes reelles de decomposition/croissance.
  if (speedInput) {
    speedInput.addEventListener('input', function () {
      timeScale = parseFloat(this.value) || 1;
      if (speedVal) speedVal.textContent = timeScale + '×';
      startLoop();
    });
  }
  // Multiplicateurs de production de nutriments du gazon (voir updateGrass) : 1 = normal, 0 = aucun.
  var grassNutriInput = document.getElementById('logo-explosion-grass-nutri');
  var grassMycNutriInput = document.getElementById('logo-explosion-grassmyc-nutri');
  if (grassNutriInput) {
    grassNutriInput.addEventListener('input', function () {
      var v = parseFloat(this.value);
      grassNutriMult = v >= 0 ? v : 0;
    });
  }
  if (grassMycNutriInput) {
    grassMycNutriInput.addEventListener('input', function () {
      var v = parseFloat(this.value);
      grassMycNutriMult = v >= 0 ? v : 0;
    });
  }
  // Frequence de la pluie naturelle (voir le cycle meteo pres de updateWeather) : 0 = ne
  // pleut jamais, 100 = averses longues et frequentes.
  if (rainInput) {
    rainInput.addEventListener('input', function () {
      rainLevel = (parseFloat(this.value) || 0) / 100;
      if (rainLevel <= 0) stopShower();
    });
  }
  // Frequence de la secheresse naturelle (voir DROUGHT_* et updateWeather) : 0 = ne seche
  // jamais, 100 = secheresses longues et frequentes. Independant du curseur Pluie ; les deux
  // restent mutuellement exclusifs cote simulation (voir startShower).
  if (droughtInput) {
    droughtInput.addEventListener('input', function () {
      droughtLevel = (parseFloat(this.value) || 0) / 100;
      if (droughtLevel <= 0) weather.drought = false;
      updateDroughtIndicator();
    });
  }
  // Frequence des tempetes (voir STORM_* et updateWeather) : averses normales qui
  // s'intensifient ponctuellement (lessivage x STORM_LEACH_MULT). N'existe que PENDANT une
  // averse deja en cours ; 0 = jamais de tempete, juste de la pluie normale.
  if (stormInput) {
    stormInput.addEventListener('input', function () {
      stormLevel = (parseFloat(this.value) || 0) / 100;
      if (stormLevel <= 0) weather.storm = false;
      updateStormIndicator();
    });
  }

  // Fleches tactiles (mobile) : maintenues, elles font defiler le monde a vitesse fixe.
  function bindScrollArrow(btn, dir, vertical) {
    if (!btn) return;
    var start = function (evt) { evt.preventDefault(); if (vertical) mobileArrowY = dir; else mobileArrow = dir; startLoop(); };
    var stop = function () { if (vertical) mobileArrowY = 0; else mobileArrow = 0; };
    btn.addEventListener('pointerdown', start);
    btn.addEventListener('pointerup', stop);
    btn.addEventListener('pointercancel', stop);
    btn.addEventListener('pointerleave', stop);
  }
  bindScrollArrow(scrollLeftBtn, -1);
  bindScrollArrow(scrollRightBtn, 1);
  bindScrollArrow(scrollUpBtn, -1, true);
  bindScrollArrow(scrollDownBtn, 1, true);

  // --- Pause hors champ / onglet cache -------------------------------------------------
  // Inutile d'animer une scene que personne ne voit : la boucle s'arrete completement
  // (rAF + slowTimer) des que la boite sort du viewport OU que l'onglet passe en arriere-plan,
  // et ne reprend que si les deux conditions redeviennent vraies.
  function pauseLoop() {
    if (paused) return;
    paused = true;
    wasRunningBeforeHide = rafId !== null || slowTimer !== null;
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
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
  if ('IntersectionObserver' in window) {
    var visibilityObserver = new IntersectionObserver(function (entries) {
      inViewport = entries[entries.length - 1].isIntersecting;
      updateVisibility();
    });
    visibilityObserver.observe(container);
  }
  document.addEventListener('visibilitychange', updateVisibility);

  // Toutes les positions sont en px de la taille au moment du clic : si la LARGEUR
  // change (rotation, fenetre), on revient simplement au logo net. La hauteur seule
  // est ignoree, elle bouge a chaque apparition de la barre d'adresse sur mobile.
  var lastWidth = container.getBoundingClientRect().width;
  var resizeTimeout = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(function () {
      var w = container.getBoundingClientRect().width;
      if (w === lastWidth) return;
      lastWidth = w;
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      resetToLogo();
    }, 200);
  });

})();
