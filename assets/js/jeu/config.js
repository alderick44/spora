// Reglages du jeu : toutes les constantes, plus l'acces par nom pour le panneau de debug.
import { hexToRgb, mixRgb, rgbStr } from './utils.js';

// Mode demo (accueil) : classe posee par front-page.php ; ce qui est cache l'est en CSS (.is-demo).
// "Continuer" sur l'ecran de fin (endDemo) la retire : le jeu complet se debloque, jusqu'a la
// prochaine remise a zero (fleche, resetAllAndRebuild), qui relance la demo.
export var DEMO_KEY = 'spora-demo-finie';
export var DEMO_TREASURE_X = 0.26;             // demo : position du tresor, en fraction de la largeur de l'ecran
export var ZOOM_MAX_W = 768;                   // en dessous de cette largeur (CSS) de boite, on zoome

// Legende sous la boite : indique quoi faire puis ce qui se passe, mise a jour aux
// moments cles (image prete, explosion, premier champignon issu du mycelium, rebuild).
export var CAPTION_BEFORE = ''; // au doigt, c'est l'anneau du badge "play" qui invite (voir HOLD_MS dans amorce.js)
var CAPTION_EXPLODED = 'Creusez pour trouver les trésors.';
export var CAPTION_MYC = 'Le mycélium décompose le bois mort.';
export var CAPTION_NEED_MONEY = 'Il faut 20 $ : récoltez des champignons.';
export var CAPTION_NEED_STRAIN = 'Creusez pour trouver du mycélium.';
export var CAPTION_NEED_MONEY_FERT = 'Il faut 3 $ : récoltez des champignons.';
export var CAPTION_NEED_MONEY_GRASS = 'Il faut 2 $ : récoltez des champignons.';
export var CAPTION_MYC_PLACE = 'Versez le mycélium au pied d’un arbre.';
export var CAPTION_MYC_HAND = 'Il lui faut du bois : prenez la main (✋).';
export var CAPTION_MYC_DROP = 'Déposez-le sur le mycélium.';
export var CAPTION_MYC_LEAVES = 'Arrachez des feuilles, déposez-les sur le mycélium.';
export var CAPTION_MYC_HARVEST = 'Cueillez un champignon avec la main (✋).';
export var CAPTION_MYC_GROW = 'Patientez, les champignons arrivent.';
export var CAPTION_MYC_TREE_WAIT = 'Attendez que l’arbre grandisse.';
export var CAPTION_MYC_TREE_NONE = 'Plantez un arbre pour nourrir le mycélium.';
export var CAPTION_MYC_REPOUR = 'Mycélium disparu : reversez-en près d’un arbre.';
export var CAPTION_MYC_CLOSER = 'Plus près du pied de l’arbre.';
export var CAPTION_MYC_FED = 'Bravo ! Le mycélium décompose le bois mort.';
export var CAPTION_MYC_NO_WOOD = 'Pas de bois ici : visez le pied d’un arbre.';
export var CAPTION_BAG_EMPTY = 'Sac vide : 20 $ pour un nouveau.';
export var CAPTION_LOUPE_NEW = 'Nouvel outil : la loupe. Examinez le mycélium et les champignons.';
// Message affiche dans la scene puis efface au bout de quelques secondes (sauf l'invite
// d'avant l'explosion, qui reste tant que le visiteur n'a pas touche le logo).
// Trois canaux de messages, distincts a l'ecran (zones CSS differentes) :
//  1. INSTRUCTIONS (setCaption) : banniere brune en bas, 6 s. Elles passent toujours avant :
//     si l'une arrive pendant un "saviez-vous", celui-ci se masque (et sera retente).
//  2. EXPLICATIONS (showExplain) : carte verte en haut a gauche, 8 s. Chaque explication du
//     lessivage n'apparait qu'une fois (drapeaux sauves avec le joueur, voir playerState).
//     Elle a priorite sur un "saviez-vous" (qui se masque si elle arrive).
//  3. SAVIEZ-VOUS (showFact) : note de carnet en bas a droite, 12 s ou jusqu'a la fermeture.
//     Un par joueur (bitmask factSeen sauve), choisi par msgTick selon la situation.
// Pour les canaux 2 et 3 : jamais hors mode exploded, ni pendant/juste apres (10 s) une
// infobulle de tresor, ni par-dessus une legende visible. Si les conditions ne sont pas
// reunies, le drapeau n'est pas pose : le meme evenement le redeclenchera plus tard.
export var CAPTION_LEACH = 'La pluie entraîne les nutriments vers le bas : un sol sans vie les retient moins bien.';
export var CAPTION_GRASS_LOST = 'Vous avez arraché beaucoup de gazon : replantez-en avec l\'outil de gazon.';
export var CAPTION_HELD = 'Le mycélium retient un temps une partie des nutriments dans ses filaments.';
export var LEACH_TIP_QUIET_MS = 10000, LEACH_TIP_GAP_MS = 15000;
export var EXPLAIN_MS = 20000, FACT_MS = 12000, FACT_FIRST_MS = 30000, FACT_GAP_MS = 60000, FACT_AFTER_EXPLAIN_MS = 8000;
// Alerte de mort du mycelium (chaque fois, avec bouton "Voir"). Les morts groupees sont
// fusionnees : on garde la premiere en attente, et une seule alerte part a la fois.
export var DEATH_ALERT_GAP_MS = 9000, DEATH_ALERT_SHOW_MS = 20000, DEATH_ALERT_STALE_MS = 15000;
export var DEATH_TEXTS = {
  drought: 'Un îlot de votre mycélium a séché : en surface, sans pluie, il ne survit pas à la sécheresse.',
  starve: 'Un îlot de votre mycélium est mort faute de matière : il lui faut du bois mort ou des feuilles à décomposer à portée.'
};
// Alerte PAR PATCH : un patch = facettes vivantes de la MEME souche qui se touchent (<= PATCH_LINK px).
// Chaque facette porte un pid ; snapshotPatches (1 Hz) recalcule les composantes connexes et
// reconcilie les pid (fusion = pid majoritaire, scission = la plus grosse garde le sien). Une alerte
// part quand une bonne partie d'UN patch meurt de faim/secheresse en PATCH_WINDOW_MS. Pelleter un
// patch en deux n'est jamais une mort. Le pid n'est pas sauvegarde (recalcule au 1er instantane).
export var PATCH_LINK = 14, PATCH_WINDOW_MS = 20000, PATCH_MIN_SIZE = 12, PATCH_MIN_DEATHS = 6;
export var PATCH_SHARE = 0.4, PATCH_REARM_MS = 45000, PATCH_SNAP_MS = 1000;
// Defis 9 a 11 (index 8..10) : recolte a la main par souche, enchaines ; chacun offre un arbre
// (credit freeTrees, consomme au prochain plantage a la place du prix).
export var CH_HARVEST_GOAL = 10;
export var CH_HARVEST_IDS = ['standard', 'pleurote', 'hydne'];
export var CH_TREES_GOAL = 8;
export var CH_STRAINS_GOAL = 3;                // souches (types) de mycelium distinctes vivantes en meme temps
export var CH_STRAIN_BIOMASS = 2;              // biomasse min par souche : somme des myc des facettes vivantes (myc 0..1 par facette, MYC_READY = 0.45)
export var CH_ZONE_REACH = 0.12;               // "zone vivante" : arbre, mycelium vivant et gazon dans ce rayon (x largeur ecran)
export var CH_COLONY_PCT = [0.1, 0.25, 0.5];   // paliers 6 a 8
export var CH_COLONY_HOLD_MS = 5000;           // un palier doit tenir ce temps de suite
// Affichage progressif : un defi n'apparait que quand il devient logique (paliers dans l'ordre,
// maturite apres un arbre plante...), et 5 au plus a la fois. Les defis faits ne sont plus listes
// (le compteur n/N les garde) ; un defi peut quand meme etre reussi avant d'etre affiche.
export var CH_MAX_SHOWN = 5;
export var GUIDE_KEY = 'spora-guide-v1';

// Style low-poly : uniquement des triangles a couleur pleine (pas de degrade,
// pas de flou). La variation de ton d'une facette a l'autre suffit a donner du relief.
export var CELLS_ACROSS = 110;                 // nb de facettes sur la largeur du logo
export var CELLS_ACROSS_MOBILE = 75;           // idem sur mobile (monde dezoome) : facettes de ~3 px sinon, trop nombreuses pour rien
export var SOIL_CELL_MOBILE = 9;               // maille min du lit de terre sur mobile (px logiques ; 6 ailleurs) : ~5 px a l ecran au lieu de ~3
export var GRAVITY = 0.32;
export var AIR = 0.992;
export var WIND_STRENGTH = 0.45;                // multiplicateur des rafales sur les feuilles qui tombent (voir "Vent" dans step())
export var COL_W = 6;                          // resolution de la carte de hauteurs du tas
export var EARTH = ['#6b4a30', '#7c5a3a', '#5a3d28', '#8a6239', '#4f3622'];
export var SOIL = ['#5a3d28', '#6b4a30', '#4a3220'];
export var ROCK = ['#8c8c86', '#7a7a74', '#9a9a92', '#6d6d66'];   // roche-mere affleurante : rien n'y pousse (voir "rocky")
export var ROCK_PATCH_MIN = 2, ROCK_PATCH_MAX = 4;                // nb de plaques rocheuses par monde
export var ROCK_PATCH_COLS_MIN = 10, ROCK_PATCH_COLS_MAX = 26;    // largeur d'une plaque, en colonnes (COL_W px chacune)
export var ROCK_COVER_MIN = 18;                // epaisseur de terre meuble (px) qui suffit a enterrer la roche : au-dela, on peut a nouveau y faire pousser quelque chose
export var ROCK_H_MIN = 0.06, ROCK_H_MAX = 0.13; // hauteur d'un rocher (x hauteur de la boite H) : bien au-dessus du sol, pas un simple caillou
export var ROCK_LEACH_MULT = 0.3;              // la roche est plus compacte que la terre : le lessivage (chance et enfoncement) y est multiplie par ca, meme si de la terre meuble la recouvre
export var ROCK_BASIN_DEPTH = 0.05;            // profondeur du fond d'une cuvette (lac) SOUS le niveau general du sol (x hauteur de la boite H) ; les bords, eux, restent releves comme une bosse
export var ROCK_BASIN_FRAC = 0.5;              // part des plaques rocheuses creusees en cuvette (au moins une, jamais toutes)
export var LAKE_DROP_VOL = 3;                  // volume d'eau (px2 de section) ajoute par une goutte qui tombe sur une cuvette
export var LAKE_EVAP_PER_S = 2;                // evaporation (px2 par seconde de vTime) hors pluie, x3 en secheresse ; lente, un lac ne s'asseche jamais d'un coup
export var BEDROCK_MARGIN = 40;               // marge (px) avant le fond du monde ou plus rien n'apparait (roche-mere)
export var SPECIES = [
  { cap: '#9a948c', gill: '#d9d2c5', pleurote: true },  // pleurote gris (bouquet, voir drawPleurotes)
  { cap: '#e58a9b', gill: '#f6c9d1', pleurote: true },  // pleurote rose
  { cap: '#e2cfae', gill: '#ffffff', hydne: true },  // hydne herisson (boule a dents fines, voir drawHydne)
  { cap: '#c9a27a', gill: '#efdcc2', pleurote: true },  // pleurote huitre
  { cap: '#8a5a3b', gill: '#e4cfb2' },  // shiitake
  { cap: '#8c4540', gill: '#554f5e', strophaire: true }  // strophaire rouge vin (voir drawStrophaire)
];
export var MAX_MUSHROOMS = 36;
export var MUSHROOM_STARVE_MS = 10000;         // un champignon issu du mycelium (pas plante a la main) fane sans mycelium a portee pendant ce temps

// Mycelium en vrac : le sac verse des grains qui inoculent les facettes ou ils tombent.
// Une facette colonisee blanchit peu a peu et gagne ses voisines, lentement ; quand
// assez de surface est blanche a un endroit, des champignons y sortent.
export var MYC = [243, 238, 226];              // blanc du mycelium
export var GRAIN = ['#f3eee2', '#e8dfcc', '#fbf8f0', '#d9cdb3'];
export var MYC_DEAD = ['#cfc3a1', '#c3b78f', '#d8cdb0']; // mycelium mort de secheresse : paille delavee, ni le blanc du vivant ni le noir de l'humus
export var MYC_GROW = 0.005;                   // blanchiment d'une facette par frame (~3 s pour etre pleine)
export var MYC_READY = 0.45;                   // seuil a partir duquel une facette gagne ses voisines
export var MYC_SPREAD_EVERY = 8;               // la propagation se calcule toutes les N frames
export var MYC_SPREAD_P = 1;                   // chance, par passage, de gagner une voisine
export var MYC_RADIUS = 0.4;                   // portee max depuis le point d'inoculation (x hauteur)
export var FRUIT_W = 0.22;                     // largeur d'une zone de fructification (x hauteur)
export var HYPHA_COLOR = '#fbf8f0';            // filaments du mycelium vivant (par-dessus le blanchiment des facettes)
export var HYPHA_DEAD_COLOR = '#d8cdb0';       // filaments du mycelium mort de secheresse (paille, casses)
export var HYPHA_W = 1.1;                      // epaisseur des filaments (px)
export var HYPHA_MAX_LINK = 40;                // distance max (px) entre une facette et son origine (parent ou inoculation) pour tracer le filament
export var FRUIT_MIN = 6;                      // facettes de surface colonisees pour faire sortir une grappe
// MYC_DECOMPOSE_REACH et MYC_STARVE_MS doivent rester coherents avec le rythme naturel
// de chute des feuilles (LEAF_LIFE_MS, 25-45s) : une feuille tombee dure ~21s de
// decomposition (LITTER_MS/MYC_DECOMPOSE_MULT), mais entre deux feuilles qui tombent au
// MEME endroit il peut s'ecouler largement plus que ca (elles tombent un peu partout
// sous le houppier). Un mycelium avec un rayon/delai de grace trop serres meurt de faim
// entre deux arrivees de bois, meme si le systeme produit bien assez de bois au total.
export var MYC_DECOMPOSE_REACH = 90;           // portee (px) a laquelle le mycelium decompose du bois au sol (large : couvre tout le pied du houppier, pas juste un point)
export var MYC_DECOMPOSE_MULT = 14;            // vitesse de decomposition du bois pres du mycelium vs tout seul
export var MYC_STARVE_MS = 90000;              // sans bois a portee pendant ce temps, le mycelium s'eteint (au-dela de l'ecart naturel entre deux feuilles qui tombent, 25-45s)
export var MYC_DECAY = 0.006;                  // vitesse a laquelle un mycelium affame s'eteint (par frame)
export var FEED_FRUIT_PER_S = 0.012;           // chance/s PAR morceau de bois mange qu'un champignon sorte du mycelium qui le digere
export var FEED_FRUIT_WET_MULT = 5;            // x(1+5) sous la pluie, decroit lineairement apres
export var FEED_FRUIT_WET_MS = 40000;          // duree de l'humidite residuelle apres la pluie
export var FEED_FRUIT_MAX = 12;                // max de champignons issus du mycelium vivants en meme temps
export var MYC_ACTIVE_FEED_MS = 3000;         // fenetre "activement nourri" : au-dela, une facette peut encore survivre sur sa reserve mais ne colonise plus de terre neuve
export var MYC_HOLD_REACH = 200;               // portee (px) a laquelle un mycelium bien vivant retient l'humus contre le lessivage de la pluie
// Duree max de cette retenue (voir heldByMycelium) : passe ce delai, l'humus lessive quand
// meme. Sans ca, un mycelium tres actif (MYC_DECOMPOSE_MULT) decompose le bois bien plus
// vite que les racines ne peuvent le manger (un nutriment a la fois, EAT_MS) ; comme la
// pluie ne peut alors jamais l'evacuer vers la couche compacte, l'humus non mange
// s'empile indefiniment (voir pileAdd) au lieu de circuler, et forme une butte qui ne
// fait que grossir sans jamais aider l'arbre (deja plafonne a MATURE_NUTRIENTS).
export var MYC_HOLD_MAX_MS = 600000;
// Mort aleatoire rare : meme bien nourri, un mycelium vivant peut mourir a l'occasion, pour
// que le gros bloc ne soit pas permanent (la terre vivante meurt et repousse en circulation).
// Verifiee a intervalle (pas a chaque frame), par facette : rare et etalee, jamais en masse.
// La facette suit ensuite le meme chemin que la mort de faim (necromasse sur litiere, sinon terre).
export var MYC_RANDOM_DEATH_P = 0.002;         // chance, par verification et par facette, de mourir
export var MYC_RANDOM_DEATH_CHECK_MS = 2000;   // intervalle (vTime) entre deux verifications
export var FERT_COUNT = 3;                     // nutriments deposes par clic/pas de glissement
export var FERT_COST = 3;                      // $ par depot (clic ou pas de glissement)
export var FERT_SPREAD = 10;                  // etalement horizontal (px) autour du point clique
export var FERT_MIN_MS = 90;                   // delai minimum entre deux depots pendant un glissement
export var GRASS_SEED_BOOST = 0.3;             // augmentation de couverture de gazon par semis
export var GRASS_SEED_COST = 2;                // $ par semis (clic ou pas de glissement)
export var GRASS_SEED_SPREAD = 15;             // etalement horizontal (px) autour du point clique
export var GRASS_SEED_MIN_MS = 100;            // delai minimum entre deux semis pendant un glissement

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
export var GRASS_COLOR = ['#6f9c4a', '#5c8a3f', '#82ad5b', '#537d3a'];
export var GRASS_MAX_H_F = 0.02;               // hauteur max d'un brin (x hauteur de la boite H)
export var GRASS_EMBED = 6;                    // enfoncement (px) sous surfaceAt : ancre les brins dans le terrain irregulier (comme drawMushroom)
export var GRASS_REGROW_MS = 60000;            // temps de base pour qu'une colonne voisine d'une zone gazonnee regagne sa pleine couverture
export var GRASS_SPREAD_BONUS = 3;             // multiplicateur de vitesse de cette repousse (appliquee uniquement quand une voisine est gazonnee)
export var GRASS_NEIGHBOR_MIN = 0.5;           // couverture voisine consideree "gazonnee" pour ce bonus
// La pelle ne remue jamais une colonne d'un coup sec : chaque facette bougee ne change
// heights[c] que d'un tout petit peu par frame (voir pileAdd/pileRemove). Comparer a la
// hauteur de la frame precedente ne detecterait donc presque jamais un vrai coup de
// pelle. grassPrevH suit plutot heights EN RETARD (GRASS_BASELINE_FOLLOW, comme
// TREE_BY_FOLLOW pour le pied d'un arbre) : un creusage soutenu fait grandir l'ecart
// frame apres frame jusqu'a depasser GRASS_DISTURB_EPS, meme si chaque pas est minuscule ;
// une fois la pelle partie, la reference rattrape la nouvelle forme du sol sans redeclencher.
export var GRASS_BASELINE_FOLLOW = 0.05;
export var GRASS_DISTURB_EPS = COL_W * 0.6;    // ecart (px) entre heights et sa reference au-dela duquel la colonne est consideree remuee
export var GRASS_FRUIT_MIN = 0.55;             // couverture minimale avant qu'une colonne puisse produire un nutriment
export var GRASS_NUTRI_CHECK_MS = 5000;        // frequence a laquelle on tente de faire pousser un nutriment de gazon
export var GRASS_NUTRI_P = 0.72;               // chance, par tentative, qu'UNE colonne eligible en produise un (doublee deux fois)
export var GRASS_NUTRI_AREA = 10;              // aire (px^2) d'un nutriment de gazon : minuscule, pas une feuille
// Symbiose visible : le gazon qui a du mycelium vivant juste en dessous pousse plus haut et
// produit plus de nutriments — le sol vivant doit se voir profiter au gazon aussi, pas
// seulement aux arbres. grassMyc[c] est recalcule periodiquement (pas a chaque frame, cf.
// GRASS_MYC_CHECK_EVERY) : parcourir colonised pour chaque colonne a chaque frame serait
// couteux pour un simple effet cosmetique + un leger bonus de production.
export var GRASS_MYC_REACH = 40;               // portee horizontale (px) a laquelle du mycelium sous une colonne compte comme "dessous"
export var GRASS_MYC_SURFACE_DEPTH = 18;       // le mycelium doit etre proche de la surface (comme DROUGHT_SURFACE_DEPTH) pour compter
export var GRASS_MYC_HEIGHT_MULT = 3.25;       // hauteur des brins multipliee par ceci si du mycelium est dessous
export var GRASS_MYC_NUTRI_WEIGHT = 2;         // poids dans le tirage au sort d'une colonne pour produire un nutriment (~2x plus probable)
export var GRASS_MYC_CHECK_EVERY = 20;         // frames entre deux recalculs de grassMyc (perf)
export var GRASS_LOST_TIP = 25;                // colonnes de gazon arrachees avant d'afficher le conseil de replantation

// --- Flore (cosmetique) --------------------------------------------------------------
// Couche PUREMENT VISUELLE ajoutee par-dessus le gazon : mousse, touffes plus denses et
// petit feuillage (fougeres/buissons) autour des arbres et au-dessus du mycelium. Aucune
// incidence sur le jeu (pas de nutriments, pas d'effet sur les arbres/le mycelium) : juste
// un indice que le sol cultive est vivant. floraLush[c] (0..1, meme indexation que
// grassCover) est la densite actuellement dessinee ; floraTarget[c] est la densite visee,
// recalculee peu souvent (voir updateGrass) selon la proximite d'un arbre bien nourri et/ou
// de mycelium actif juste dessous. Jamais de Math.random() dans le dessin : les graines
// viennent d'un hash stable de l'indice de colonne (floraHash), comme pour le gazon.
export var FLORA_TREE_R_MIN = 0.12, FLORA_TREE_R_MAX = 0.3; // portee d'un arbre (x hauteur H), selon sa croissance
export var FLORA_TREE_W = 0.9, FLORA_MYC_W = 0.75;          // poids arbre / mycelium dans la cible de densite
export var FLORA_SYMBIOSIS_BONUS = 0.25;                    // bonus quand arbre ET mycelium se superposent (vraie mycorhize)
export var FLORA_GROW_MS = 12000, FLORA_FADE_MS = 6000;     // vitesse de pousse / de fanage de floraLush vers sa cible
export var FLORA_EMBED = 4;                                 // enfoncement (px) sous surfaceAt, comme GRASS_EMBED
export var MOSS_COLOR = ['#4f7a34', '#5f8f3c', '#3f6a2c', '#6e9e45'];
export var MOSS_THICK = 14;                                  // epaisseur max (px) de la bande de mousse
export var FLORA_TUFT_H_F = 0.035;                          // hauteur max d'une touffe haute (x H)
export var FLORA_FERN_H_F = 0.11;                           // hauteur max d'une fougere (x H)
export var FLORA_BUSH_R_F = 0.042;                          // rayon max d'un petit buisson (x H)

// Fleurs au pied des arbres : purement cosmetique, elles eclosent quand une branche bonus
// apparait (voir spawnFlower, appele depuis stepTrees) et fanent quand cette branche tombe,
// ou aussitot si la pelle remue leur colonne (voir stepFlowers). Une seule espece (anemone
// des bois, blanc rose), soignee plutot que variee, cf. drawFlowers plus bas. Tout l'alea
// (position, inclinaison, taille...) est tire une fois a la naissance et stocke sur la
// fleur (f.*) : le dessin ne lit jamais Math.random(), comme pour le reste de la flore.
// t.flowers vit sur l'arbre (voir makeTree) donc trees = [] (reset/rebuild) suffit a tout
// effacer, aucune structure globale a vider en plus.
export var FLOWER_MAX_PER_TREE = 8;             // fleurs vivantes (non fanees) max par arbre
export var FLOWER_MIN_SPACING = 14;             // ecart minimal (px monde) entre deux fleurs, tous arbres confondus
export var FLOWER_BLOOM_MS = 2600;              // duree totale de l'eclosion (tige + bouton + corolle)
export var FLOWER_WILT_MS = 1800;               // duree de la fanaison une fois fletrie (branche tombee)
export var FLOWER_H_F = 0.07;                  // hauteur de la tige (x hauteur de la boite H)
export var FLOWER_R_F = 0.022;                  // rayon de la corolle grande ouverte (x H)

// --- Insectes (cosmetique) ----------------------------------------------------------
// Purement decoratif, comme les fleurs ci-dessus : papillons et bourdons qui traversent
// tranquillement l'ecran d'un bord a l'autre, se posent parfois sur une fleur ouverte
// puis repartent finir leur traversee. Aucune incidence sur le jeu. Tout l'alea de vol
// (ondulation, phases, choix d'especes...) est tire a la creation de l'insecte et
// stocke sur l'objet (voir spawnInsect) ; le dessin (drawInsect et ses helpers) ne lit
// jamais Math.random(), seulement des phases qui avancent avec un temps REEL ecoule
// (voir insectLastT/age dans stepInsects) — jamais vTime, qui est accelerable par le
// slider de vitesse debug et rendrait les insectes agites a vitesse elevee.
export var INSECT_MAX = 3;                      // bourdons simultanes max
export var BUTTERFLY_MAX = 3;                   // papillons simultanes max (limite propre a l'espece)
export var BUTTERFLY_P = 0.75;                  // part des apparitions qui sont des papillons
export var BUTTERFLY_SIZE_K = 1.22;             // facteur de taille propre aux papillons (bourdons inchanges)
export var INSECT_GAP_MIN_MS = 6000;            // attente min. entre deux apparitions (temps reel)
export var INSECT_GAP_MAX_MS = 16000;           // attente max. entre deux apparitions (temps reel)
export var INSECT_SPEED = 1;                    // multiplicateur global de vitesse
export var INSECT_SIZE_F = 0.012;               // taille (x hauteur de la boite H)
export var INSECT_LAND_P = 0.55;                // chance de viser une fleur ouverte visible, s'il y en a

// --- Economie : recolter des champignons pour racheter du mycelium -----------------
// Le tout premier sac est offert (sinon impossible de demarrer, avant toute vente) ;
// les suivants coutent BAG_COST, payes des qu'on commence a verser (ensureBag). Le sac
// contient un nombre fixe de grains plutot qu'une jauge de temps : ca tient compte du
// rythme de versement du joueur, et reutilise le compteur de grains deja verses par
// updateBag. ~950 grains, au rythme actuel (~1.5 grain/frame, 60 fps), durent 10-12s.
export var BAG_COST = 20;
export var BAG_GRAINS = 950;
export var MUSHROOM_PRICE = 5;                // gain (recolte a la main) par champignon mur issu du mycelium

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
export var NUTRI = ['#2a1d14', '#1f1610', '#33241a']; // humus : terre noire, riche
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
export var ROOT_REACH = 0.3;                   // portee de recherche de nutriment une fois l'arbre mature (x largeur de la boite)
export var ROOT_VISUAL_REACH = 0.4;            // longueur des racines lat. DESSINEES une fois mature (x hauteur de la boite) ; elles plongent, donc plus courtes qu'avant
// Deux parametres separes (pas juste ROOT_DEPTH x g comme ROOT_REACH) : g (voir plus bas,
// lerp(ROOT_GROWTH_MIN, 1, t.growth)) est un ratio FIXE entre jeune et mature, donc monter
// une seule valeur de profondeur remontait les deux ages dans la meme proportion —
// impossible de creuser plus profond pour un jeune arbre sans aussi faire exploser la
// portee d'un arbre adulte. Interpole directement entre les deux a la place.
export var ROOT_DEPTH_MIN = 0.12;              // profondeur de recherche sous la surface a la naissance (x hauteur de la boite)
export var ROOT_DEPTH_MAX = 0.35;              // profondeur de recherche sous la surface une fois mature (x hauteur de la boite)
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
export var MIN_LEACH_TO_EAT = 4;
// Sans pluie du tout (secheresse prolongee ou curseur Pluie a 0), un nutriment qui n'a
// jamais lessive restait mangeable JAMAIS — la pluie etait donc un vrai interrupteur, pas
// juste un bonus de vitesse comme voulu. Un nutriment mur tout seul, mais bien plus
// lentement qu'avec la pluie (voir isNutriRipe) : le cycle continue meme sans pluie,
// juste au ralenti.
export var NUTRI_RIPEN_MS = 45000;
export var EAT_MS = 45000;                     // un nutriment absorbe au plus toutes les EAT_MS
// Abondance : si beaucoup de nutriments murs sont a portee EN MEME TEMPS (pas juste
// "plusieurs"), l'arbre mange au rythme accelere plutot que le EAT_MS normal — un sol
// vivant qui deborde de nourriture doit se sentir different d'un sol qui en a juste assez.
export var ABUNDANCE_THRESHOLD = 20;           // nb de nutriments murs a portee au-dela duquel l'arbre mange plus vite
export var ABUNDANCE_EAT_MULT = 3;             // EAT_MS est divise par ce facteur une fois le seuil depasse
export var ABUNDANCE_LEAF_FILL = 15;           // nb max de places de feuilles remplies d'un coup pendant l'abondance (avant de financer une branche)
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
export var BONUS_BRANCH_COST = 3;              // nutriments supplementaires consommes d'un coup pour former une branche
export var BONUS_BRANCH_MAX = 8;               // nb max de branches bonus simultanees par arbre
export var BONUS_BRANCH_LIFE_MS = 150000;      // duree de vie d'une branche bonus avant qu'elle tombe
export var BRANCH_LITTER_MS = 2400000;         // le bois tombe se decompose bien plus lentement qu'une feuille (LITTER_MS)
export var BRANCH_GROW_MS = 8000;              // temps pour qu'une branche bonus s'etire visuellement jusqu'a sa pleine longueur
// Une branche a coute BONUS_BRANCH_COST nutriments a fabriquer ; elle les redonne au sol,
// mais PAR PETITS BOUTS au fil de sa lente decomposition (BRANCH_LITTER_MS) plutot que
// d'un coup a la toute fin comme une feuille (qui, elle, ne vaut qu'1 nutriment de toute
// facon) — le bois reste au sol bien plus longtemps, il est normal qu'il rende sa matiere
// progressivement. Une fois le dernier bout donne, ce qui reste du bois redevient juste de
// la terre normale (voir toEarthColor), jamais un nutriment en plus.
export var WOOD_NUTRI_AREA = 10;               // aire (px^2) d'un bout de nutriment libere par du bois
// Croissance : plus un arbre a mange de nutriments (t.eaten), plus t.growth (0..1) monte,
// et plus ses racines vont chercher loin, plus il peut porter de feuilles, plus il est grand.
export var MATURE_NUTRIENTS = 12;              // nutriments manges pour atteindre la pleine croissance
export var ROOT_GROWTH_MIN = 0.15;             // longueur des racines a la naissance (fraction de leur taille mature)
export var LEAF_UNLOCK_MIN = 8;                // places de feuilles utilisables a la naissance (sur 40)
export var TREE_SCALE_MIN = 0.3;               // taille du tronc/houppier a la naissance (fraction de la taille de reference)
export var TREE_SCALE_MAX = 1.6;              // taille du tronc/houppier une fois bien nourri (fraction de la taille de reference)
// Au-dela de la maturite, chaque nutriment mange (t.surplus) fait encore monter l'arbre,
// lentement : TALL_FULL nutriments pour la hauteur max (+TALL_SCALE_MAX d'echelle). Plus
// il est haut, plus le vent emporte ses feuilles loin (TALL_WIND_MULT a la hauteur max).
// Affame, il perd d'abord cette hauteur avant de perdre sa maturite.
export var TALL_FULL = 40;
export var TALL_SCALE_MAX = 1.0;
export var TALL_WIND_MULT = 1.5;
export var SMALL_WIND_MULT = 0.3;              // vent sur les feuilles d'un arbre tout neuf : elles tombent pres du pied, donc il se nourrit et grandit (monte a 1 a maturite)
export var TREE_COST_STEP = 100;              // 1er arbre plante gratuit, puis 1x, 2x, 3x ce palier ; ensuite toujours 3x (pas de plafond de nombre)
export var TREE_COST_MAX_MULT = 3;
var START_TREES = 2;                    // arbres de depart (voir la creation du monde), non payes
// Arbre du tutoriel : toujours au meme endroit (fraction de la largeur de la boite, a droite
// du tas du logo mais bien dans l'ecran), dans une clairiere ou aucune plaque rocheuse ni lac
// n'est jamais genere (demi-largeur en px monde, voir buildRockyPatches).
export var START_TREE_X = 0.72, START_TREE_CLEAR = 120;
export var TREE_MIN_SPACING = 90;             // distance minimale (px monde) entre deux arbres plantes
export var TREE_STARVE_MS = 60000;             // sans avoir mange depuis ce delai (t.lastAte), l'arbre commence a deperir
export var TREE_SHRINK_MS = 8000;              // rythme auquel un arbre affame perd un nutriment mange (t.eaten--)
// La base de l'arbre (t.by) suit le niveau du sol SOUS elle avec un delai plutot que de
// recalculer surfaceAt(t.x) brut a chaque frame : sinon, remuer la terre pres du tronc
// (pelle) le fait sauter haut/bas tres vite. Embed un peu plus profond que l'ancien +8 :
// un arbre legerement enfonce dans le sol semble mieux ancre.
export var TREE_EMBED = 14;                    // enfoncement du pied du tronc sous la surface (px)
export var TREE_BY_FOLLOW = 0.04;              // vitesse (par frame) a laquelle t.by rattrape le niveau du sol
export var EATEN_MS = 5000;                    // duree de l'absorption (la facette retrecit)
export var LEAF_GROW_MS = 4400;
// Houppier : les feuilles sont regroupees en bouquets au bout de branches maitresses
// (t.limbs, pre-calcule dans makeTree). Purement visuel, sans effet sur le gameplay.
export var CANOPY_LIMBS = 5;                   // nb de branches maitresses / bouquets (utilise seulement a la creation de l'arbre)
export var CANOPY_CLUSTER_R = 0.065;           // rayon d'un bouquet de feuilles (fraction de H) ; sert aussi a la masse de feuillage dessinee
export var LEAF_LIFE_MS = [58000, 180000];     // duree de vie d'une feuille (min, max)
export var LITTER_BULK = 0.2;                  // une feuille posee n'ajoute que cette fraction de sa hauteur au tas (litiere a plat, pas une butte)
export var LOG_BULK = 0.4;                     // idem pour le bois tombe
export var LITTER_FLAT = 0.4;                  // ecrasement vertical d'une feuille posee (dessin seulement)
export var LITTER_MS = 300000;                 // une feuille tombee loin de tout mycelium redevient humus toute seule, tres lentement (5 min, comme dans la vraie vie) ; le mycelium a proximite accelere fortement ce delai (MYC_DECOMPOSE_MULT)
export var LEAF_AGES = [[0, [156, 204, 90]], [0.25, [86, 150, 60]], [0.65, [62, 120, 50]], [0.82, [217, 169, 46]], [1, [184, 97, 42]]];
export var DIG_TO_REVEAL = 3;                  // coups de pelle (clic/tap) pour deterrer un tresor
export var TREASURE_NEAR = 70;                 // un tresor profond (def.depth) ne se repere et ne se creuse que si la surface est a moins de ca (px) au-dessus de lui
export var NUGGET_COLORS = ['#fff4cf', '#f6d372', '#e8b94a', '#c4922a', '#9c6f1f']; // pepite doree : du plus clair (face a la lumiere) au plus sombre
export var NUGGET_R = 0.022;                   // rayon de la pepite (x hauteur de la boite)
export var GOLD_BITS_N = 9;                    // eclats dores projetes au moment du reveal
export var GOLD_BITS_LIFE = 55;                // duree de vie d'un eclat (frames)
export var STRAIN_MIX = 0.5;                   // part de la couleur de la souche melangee au blanc du mycelium (0 = blanc standard, 1 = couleur pure)

// "Camera" : le monde (terre + tresors) est plus large ET plus profond que la boite
// visible. camX/camY sont le decalage (en px monde) affiche a l'ecran ; tout se dessine
// translate de (-camX, -camY). Horizontal : le monde deborde des deux cotes, camX est
// centre au depart. Vertical : rien d'utile au-dessus du sol, donc camY part a 0 (vue de
// depart identique a avant) et ne descend QUE vers le bas pour reveler de la profondeur,
// ou la couche compacte se creuse vraiment (voir compactY / cutCompact plus bas).
export var WORLD_MULT = 1.5;                   // largeur du monde = WORLD_MULT x largeur de la boite
export var DEPTH_MULT = 0.75;                  // profondeur ajoutee sous la boite = DEPTH_MULT x hauteur de la boite
export var CAMERA_EDGE = 0.28;                 // fraction de la largeur/hauteur de la boite ou le defilement s'active, depuis chaque bord
export var CAMERA_MAX = 3.2;                   // vitesse max de defilement horizontal (px monde / frame)
export var CAMERA_MAX_Y = 2.4;                 // vitesse max de defilement vertical (px monde / frame)
// Sur l'accueil la boite remonte sous le header fixe (voir body.home .logo-explosion-inner
// dans style.css, meme valeur 150px) : sans ca, la zone de defilement vers le haut serait
// presque entierement cachee dessous et il faudrait y passer le curseur pour l'activer.
// On decale la detection verticale de cette hauteur pour que la remontee commence deja
// pendant que le curseur est encore visible, au-dessus de la boite.
export var CAMERA_TOP_DEADZONE = document.body.classList.contains('home') ? 150 : 0;
export var CAMERA_EDGE_TOUCH = 0.16;           // meme zone, au doigt : plus etroite (le doigt travaille partout sur l'ecran)
// Souches de mycelium : la souche "standard" (blanc d'origine) existe toujours et est
// debloquee d'office ; les autres viennent des tresors (def.strain = {id, label, tint}) et
// se debloquent au reveal. unlockedStrains et bagStrain survivent au rebuild (duree de la
// page), contrairement au compteur de tresors. La souche ne change QUE la teinte.
// Trois souches, chacune debloquee par un tresor, de plus en plus lucratives : Strophaire
// (depart, lente mais tres resistante, id interne 'standard' pour les vieilles sauvegardes),
// Pleurote (normale, plusieurs couleurs), Hydne (rapide, plus fragile). price/growMul/decayMul :
// prix de recolte, multiplicateur de MYC_GROW, multiplicateur des extinctions (faim, secheresse).
// Le prix du strophaire suit MUSHROOM_PRICE (reglage du panneau de debug).
var STRAIN_STD_TINT = hexToRgb('#b8735a');
// Mycelium et grains verses restent des teintes de gris proches du blanc : seule la pastille du menu garde la couleur vive.
export function grayOf(rgb) { var l = Math.round(0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]); return [l, l, l]; }
export var STRAIN_STD = { id: 'standard', label: 'Strophaire', perk: 'lente mais très résistante', tint: '#b8735a', tintRgb: STRAIN_STD_TINT, grayRgb: grayOf(STRAIN_STD_TINT), dot: '#b8735a',
  mycRgb: mixRgb(MYC, grayOf(STRAIN_STD_TINT), STRAIN_MIX), hypha: rgbStr(mixRgb(hexToRgb(HYPHA_COLOR), grayOf(STRAIN_STD_TINT), STRAIN_MIX).map(Math.round)),
  price: 0, growMul: 0.6, decayMul: 0.15 };

// --- Lit de terre ------------------------------------------------------------------
// Terre supplementaire qui monte du bas au moment de l'explosion : la terre du logo
// retombe dessus. Sans elle, le tas (fait seulement du logo) etait trop mince pour creuser.
export var SOIL_RISE_FRAMES = 32;

// --- Tas de terre : carte de hauteurs par colonne, posee sur la couche compacte ----
// Chaque facette posee y ajoute son aire (etalee sur quelques colonnes, sauf par-dessus
// un pas de la couche compacte, ou tout part dans sa propre colonne) et, quand on la
// souleve, retire EXACTEMENT ce qu'elle avait ajoute a chaque colonne (memorise dans
// s.kdep/s.kcol) : jamais recalcule, jamais tronque, sinon chaque coup de pelle gonfle
// le tas jusqu'a des aiguilles de terre.
export var KERNEL = [0.08, 0.17, 0.25, 0.25, 0.17, 0.08];
export var REPOSE = COL_W * 0.7;               // denivele max entre colonnes voisines (~35 deg), et pas de compact max traverse par le kernel
export var LOOSE_DRAW_SCALE = 1.2;             // agrandissement a l'affichage de la terre meuble posee (bouche les jours)
export var LOGO_BULK = 1.3;                  // la terre du logo "foisonne" un peu en retombant
// --- Sauvegarde du terrain (localStorage) ------------------------------------------
// Seuls heights, compactY et rocky sont gardes : particules, insectes, arbres, eau et
// meteo repartent de zero. Le monde n'existe qu'apres le clic sur le logo (build()).
export var WORLD_KEY = 'spora-monde', WORLD_VERSION = 1;

// Etat du joueur (champ optionnel "player" de la meme cle) : solde, sac offert, souches
// debloquees et souche choisie, tresors deterres. Sauve dans tous les modes (le solde ne
// depend pas du monde explose) et restaure au chargement du script, avant tout affichage.
// Les tresors sont identifies par leur titre (unique dans treasureDefs) ; ceux deja
// deterres ne sont pas regeneres enterres au premier setupTreasures apres le chargement.
export var MONEY_MAX = 1e9;

// Le mycelium est garde de facon approximative (voir saveMycelium) : seul le nombre de
// facettes colonisees entre dans la signature, pas leur croissance.
export var MYC_SAVE_MAX = 6000;
// Arbres, de facon approximative : colonne (x arrondi), nutriments manges (donc taille) et
// drapeau "plante par le joueur". Forme, branches et feuilles sont regenerees a la
// restauration ; feuilles au sol et branches bonus ne sont pas gardees. Les arbres ne
// meurent pas dans le jeu (ils maigrissent seulement), donc pas de cas "mort".
export var TREES_SAVE_MAX = 60;

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
export var BLADE_WIDTH = 0.17;                 // largeur de la lame (fraction de la hauteur de la zone)
export var BOWL_SPAN = 0.35;                   // demi-ouverture de l'arc (rad) : plus petit = plus plat
export var BOWL_T = 5;                         // epaisseur de la paroi (px)
export var POUR_ANGLE = 2.1;                   // bascule (rad) pour vider
export var SLOW_FOLLOW = 0.12;                 // bouton maintenu : part du chemin vers le curseur par frame
export var DIG_BITE = 2;                       // penetration (px) dans le compact tolerable sans ralentir la pelle
export var DIG_SPEED = 0.8;                    // vitesse max (px/frame) du fond de la pelle au-dela de DIG_BITE : le curseur de resistance
export var DIG_SPEED_DOWN = 0.3;               // idem, mais vers le bas seulement (creuser a la verticale)
export var BLADE_FIELD = 0.10;                 // hauteur de la zone de force au-dessus de la lame (x hauteur)
export var BLADE_PULL = 0.18;                  // part de l'ecart de vitesse rattrapee par frame (sur la lame)
export var BLADE_ATTRACT = 0.12;               // attraction vers la lame (px/frame^2, sur la lame)
export var PLANT_LEAN = 0.12;                  // legere inclinaison du manche (rad)

export var DECOMPACT_BULK = 1.2;               // la terre qui sort du compact "foisonne" (comme LOGO_BULK)

// Dessin unique de la pelle (tenue et plantee), le modele valide : petite lame en coque
// facettee, douille grise, manche en bois, poignee en T. Trace dans un repere de reference
// (lame ~58 unites de long, pointe a gauche, manche vers +x) puis pose : (ax, ay) est ou
// tombe le point (ox, oy) du modele, dir la direction du manche. Le clip eventuel (pelle
// plantee) est pose par l appelant.
export var SHOVEL_TIP = [124, 168], SHOVEL_BOTTOM = [160, 175.8]; // pointe de la lame, fond de la coque

// Ramasser/deposer a la main : contrairement a la pelle (qui entame la couche compacte
// par pelletees), la main ne prend que ce qui traine deja en terre meuble, et tres peu a
// la fois (HAND_GRAB_MAX facettes dans un rayon HAND_PICK_R) — un geste precis plutot
// qu'un outil de terrassement. Tant qu'elles sont tenues, ces facettes suivent le curseur
// (voir le bloc s.carried dans step()) au lieu d'obeir a la gravite ; les relacher
// (endPress) les laisse simplement retomber et se poser normalement, comme n'importe
// quelle facette deja delogee par la pelle (meme mecanique que bowlWakePile/pileAdd).
export var HAND_PICK_R = 24;                   // rayon de ramassage (px) : assez precis pour viser un point du tas
export var HAND_GRAB_MAX = 14;                 // une "poignee" : quelques facettes au plus, jamais une pelletee
// Main dessinee (drawHand) : suit le curseur, ouverte en survol, poing ferme quand le
// bouton est enfonce ou qu'elle tient quelque chose. hand.fist va de 0 (ouverte) a 1
// (poing), hand.tilt s'incline dans le sens du geste, hand.lx sert a mesurer ce geste.
// hand.grip = branche agrippee (voir handGrabTree), null sinon.
export var HAND_LEAF_MARGIN = 6;               // marge (px) autour d'une feuille pour l'arracher
export var HAND_LIMB_TOL = 12;                 // distance max (px) du curseur a un segment de branche pour l'agripper
export var HAND_BREAK_DIST = 40;               // ecart (px) au point de prise au-dela duquel la branche casse
export var LIMB_REGROW_MS = 120000;            // une branche maitresse cassee reapparait apres ce delai (temps de jeu, vTime)
// Effleurement : la main qui BOUGE pousse un peu ce qu'elle frole, comme la pelle mais
// tres doucement (voir handPush). Vitesse en px/frame, mesuree en repere monde moins le
// defilement de la camera (une souris immobile pendant que le monde glisse ne pousse rien).
export var HAND_PUSH_R = 32;                   // rayon d'effet (px) autour de la paume, un peu > HAND_PICK_R
export var HAND_PUSH_MIN_V = 1.2;              // en dessous, le survol ne fait rien (un geste calme de souris fait ~3-10 px/frame)
export var HAND_PUSH_MAX_V = 14;               // vitesse de main retenue au plus (borne l'impulsion)
export var HAND_PUSH_LEAF = 0.4;               // part de la vitesse de la main transmise a une feuille en l'air (la chute amortit vite : 0.94-0.95/frame)
export var HAND_PUSH_LOOSE = 0.12;             // idem pour une facette posee delogee (beaucoup moins)
export var HAND_PUSH_P = 0.08;                 // chance par facette posee et par frame d'etre delogee
export var HAND_PUSH_MAX_LOOSE = 2;            // facettes posees delogees au plus par frame
export var HAND_PUSH_DEPTH = 8;                // seule la peau du tas (px sous la surface) peut bouger
// Poing : main fermee (bouton enfonce, rien de tenu ni d'agrippe) qui BOUGE = elle brise
// la terre sur son passage (voir fistStrike). Un "coup" tous les HAND_FIST_STEP px
// parcourus ; chaque coup entame un peu le compact sous le poing et deloge de petits
// blocs projetes dans le sens du geste. Il faut repasser pour creuser profond.
export var HAND_FIST_R = 26;                   // rayon du poing (px, monde)
// Au doigt, le poing est cache dessous : un anneau depasse autour du doigt et sert de portee
// de cueillette (tout champignon mur dedans est cueilli), il clignote dore quand on attrape.
export var HAND_RING_R = 38;                   // rayon de l'anneau (px CSS, donc / ZOOM en monde)
export var HAND_FLASH_MS = 300;                // duree de l'eclat dore
export var HAND_ZOOM_K = 1.45;                 // poing grossi quand le jeu est dezoome, sinon minuscule sous le doigt
// Loupe : outil d'observation, ne touche a rien. La lentille grossit ce qu'elle couvre ; son
// centre vise un sujet (champignon, mycelium...) dont elle ouvre la fiche. Elle prend aussi
// HAND_ZOOM_K quand le jeu est dezoome.
export var LOUPE_R = 34;                       // rayon de la lentille (px logiques)
export var LOUPE_ZOOM = 1.6;                   // grossissement dans la lentille (1 = aucun)
export var LOUPE_LIFT = 70;                    // au doigt, la lentille flotte de ce nombre de px CSS au-dessus du doigt
export var LOUPE_HIT = 10;                     // tolerance de visee du centre de la lentille (px logiques)
export var HAND_FIST_MIN_V = 1;              // vitesse minimale (px/frame) pour compter comme geste
export var HAND_FIST_MAX_V = 14;               // vitesse retenue au plus pour la projection
export var HAND_FIST_STEP = 14;               // distance parcourue (px) entre deux coups
export var HAND_FIST_MAX_STRIKES = 4;          // coups au plus par frame (borne le cout d'un geste tres rapide)
export var HAND_FIST_DEPTH = 1.5;             // compactY descend au plus de ca (px) par colonne et par coup
export var HAND_FIST_SHARDS = 4;              // petits blocs neufs au plus par coup (sortis du compact)
export var HAND_FIST_LOOSE = 3;                // facettes posees delogees au plus par coup
export var HAND_FIST_SIZE = 0.9;               // taille d'un bloc, en fraction d'un bloc de pelle
export var HAND_FIST_MAX_UP = 4.5;             // vitesse verticale max vers le haut des blocs (evite la fontaine)
export var HAND_FIST_KICK = 0.6;              // part de la vitesse du poing transmise aux blocs
export var HAND_FIST_SPREAD = 3.4;            // dispersion aleatoire de la vitesse (px/frame)
export var HAND_FIST_LIFT = 2.2;              // impulsion vers le haut des blocs (px/frame)

export var HAND_SKIN = ['#e8b48a', '#cf9670', '#b57c58']; // clair, moyen, ombre

// fromMyc : true quand la grappe sort d'une zone de mycelium bien blanche
// (spreadMycelium) plutot que plantee a la main (tap sur la terre nue, handleTap) —
// seule celle-la fane si le mycelium qui l'a fait sortir disparait (voir step()).
export var MYC_MUSHROOM_SCALE = 0.55;          // les grappes issues du mycelium restent petites : le tresor seul est gros

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
export var RAIN_CLOUD_Y_FRAC = 0.12;           // hauteur des nuages dans la vue, sous camY (x hauteur de la boite)
export var RAIN_DRY_MS = [120000, 20000];      // duree seche, lerp(min,max,rainLevel) puis x(0.6..1.4) aleatoire
export var RAIN_SHOWER_MS = [8000, 20000];     // duree d'une averse, lerp(min,max,rainLevel) puis x(0.7..1.3) aleatoire
export var RAIN_FADE_MS = 2500;                // fondu (entree et sortie) des nuages
export var RAIN_DROP_MAX = 220;                // nombre max de gouttes en vol (vue visible seulement)
export var RAIN_DROP_VY = [7, 11];             // vitesse de chute d'une goutte (px/frame, min/max)
export var RAIN_SPAWN_MAX = 5;                 // gouttes creees par frame a rainLevel = 1 (echelle avec rainLevel)
export var RAIN_CLOUDS_N = 4;                  // nombre de nuages pendant une averse, repartis sur le monde
export var RAIN_CLOUD_DRIFT = 0.006;           // vitesse de derive des nuages (px monde / ms)
// En temps VIRTUEL (vTime), pas en frames reelles : weather.changeAt (duree d'une averse)
// est lui aussi en vTime, donc accelere pareil par le curseur de vitesse debug
// (timeScale). Avec un gate en frames reelles (l'ancien LEACH_EVERY), une averse deja
// 4x plus courte en temps reel a x4 recevait EN PLUS le meme nombre de tentatives de
// lessivage par seconde reelle qu'a x1 (le calcul de frame ne connait pas timeScale) :
// le lessivage se retrouvait ~4x plus faible par rapport au reste du cycle (decomposition,
// repas des racines), qui lui accelere bien avec vTime — d'ou l'absence de perte de
// nutriments observee en testant a vitesse elevee, alors qu'a x1 l'equilibre est correct.
export var LEACH_INTERVAL_MS = 10;              // le lessivage (voir leach()) se recalcule a ce rythme
export var LEACH_MAX_STEPS_PER_FRAME = 200;     // plafond de rattrapage par frame reelle (voir updateRainDrops) : evite un gel si vTime saute enormement
// Ne s'applique qu'au sol PAS retenu par du mycelium vivant (heldByMycelium court-circuite
// deja les facettes protegees avant ce jet, voir leach()) : augmenter cette valeur rend
// donc specifiquement le sol sans vie plus "qui fuit", sans toucher au sol vivant.
// Les feuilles tombees (en attente de decomposition) descendent un peu avec la pluie, mais
// bien moins et autrement que l'humus : un petit deplacement vers le bas, plafonne par
// averse, pour qu'elles ne restent pas en gigantesques piles en surface et finissent par
// atteindre le mycelium (qui les mange). Elles s'arretent sur le compact ou une autre feuille.
export var LEAF_RAIN_P = 0.08;                 // chance, par passage de lessivage (frame de pluie), qu'une feuille au sol descende d'un cran
export var LEAF_RAIN_STEP = 1.5;               // px descendus par cran
export var WOOD_RAIN_MULT = 0.35;              // le bois (branches) descend aussi avec la pluie, a cette fraction de la chance et de la descente max des feuilles
export var LEAF_RAIN_MAX_DROP = 40;           // descente max (px) par averse pour une meme feuille
export var LEACH_P = 0.4;                      // chance de base, par tick de lessivage, qu'un humus meuble descende d'un cran
export var COMPACT_SINK_SPEED = 0.08;          // vitesse (px/tick de lessivage) a laquelle un depot deja enfonce dans le compact continue de couler ; doit rester lente, sinon il sort de depthReach avant que les racines l'atteignent
// Secheresse : meme principe qu'une averse mais inverse (voir stepMycelium) — pendant une
// periode seche, un mycelium en surface (a portee de la fructification, DROUGHT_SURFACE_DEPTH)
// peut secher et mourir directement, sans lien avec la faim. Jamais en meme temps qu'une
// averse : startShower() coupe toute secheresse en cours et redemarre son delai, et le
// cycle secheresse ne tourne que quand weather.raining est faux (voir updateWeather). Reglee
// par son propre curseur Secheresse (droughtLevel, 0..1, independant du curseur Pluie) ; a 0
// il ne seche jamais.
export var DROUGHT_MS = [10000, 30000];        // duree d'une secheresse, lerp(min,max,droughtLevel) puis x(0.7..1.3) aleatoire
export var DROUGHT_GAP_MS = [90000, 25000];    // duree normale (sans secheresse) entre deux, lerp(min,max,droughtLevel) puis x(0.7..1.3) aleatoire
export var DROUGHT_SURFACE_DEPTH = 18;         // "en surface" = meme seuil que la fructification (c.y - surfaceAt(c.x))
export var DROUGHT_KILL_P = 0.02;              // chance par frame qu'une facette de mycelium exposee prenne un coup de sec
export var MYC_DROUGHT_DECAY = 0.15;           // blanchiment perdu a chaque coup de sec (facette exposee) : ~5s d'exposition continue pour tuer un mycelium plein
// Tempete : une averse normale qui s'intensifie ponctuellement (jamais hors d'une averse
// deja en cours, voir updateWeather) — le lessivage y est multiplie par STORM_LEACH_MULT.
// Reglee par son propre curseur Tempetes (stormLevel, 0..1, independant du curseur Pluie) ;
// a 0 il n'y a jamais de tempete, seulement de la pluie normale.
export var STORM_MS = [4000, 12000];           // duree d'une tempete, lerp(min,max,stormLevel) puis x(0.7..1.3) aleatoire
export var STORM_GAP_MS = [60000, 15000];      // duree normale (pluie sans tempete) entre deux, lerp(min,max,stormLevel) puis x(0.7..1.3) aleatoire
export var STORM_LEACH_MULT = 5;               // multiplicateur du lessivage (LEACH_P) pendant une tempete
export var STORM_SPAWN_MULT = 2.5;             // multiplicateur du nombre de gouttes affichees pendant une tempete (visuel seulement)

export var DEAD_MYC_DECOMPOSE_P = 0.01; // chance par tick de lessivage qu'un mycelium mort humide se decompose en nutriment normal (~10s d'averse en moyenne)
export var MYC_HALO_GROWTH = 0.6, MYC_NEAR_TREE = 260;
// Tutoriel : le mycelium doit etre verse au pied de l'arbre (la ou tombe le bois), pas juste a cote.
export var MYC_UNDER_TREE = 120;
// Demo : le sol au pied de l'arbre du tutoriel (makeStartTree, t.tuto) ne se creuse pas et son
// gazon ne s'arrache pas, sinon le tutoriel du mycelium peut devenir infaisable. Les abords
// d'un tresor encore enfoui restent creusables : il faut pouvoir finir la demo.
export var DEMO_GUARD_TREASURE = 45;

// Capture a la main (papillons seulement) : le papillon est TENU tant qu'on appuie (il suit
// le pointeur, grossit et bat des ailes vite), puis relache au relachement et repart en
// fuite rapide. Aucun degat, aucun gain. Plafond de securite si le pointerup est perdu.
export var CATCH_MAX_MS = 15000;
// Relachement : le papillon passe en etat 'flee' (vitesse propre integree, lissee) et
// s'eloigne de la main. Duree en temps reel (ins.age avance avec le dt reel plafonne).
export var FLEE_MS = 1400;
export var FLEE_SPEED_K = 4;                    // vitesse de fuite = vitesse de croisiere x ce facteur

// Dessinees SOUS les facettes de terre (avant les shards, apres drawSoil/drawLooseBacking) :
// le lit de triangles et la terre meuble les cachent ; elles n'apparaissent que sur l'aplat
// de la couche compacte, en defilant vers le bas ou au fond d'un trou creuse a la pelle.
// Brun-roux plus chaud/clair que le tronc : #6b4428 se confondait avec l'aplat #5a3d28.
export var ROOT_COLORS = ['#b8814f', '#9a6a3f'];

export var LIMB_COLORS = ['#8a5a3b', '#6b4428']; // deux tons du tronc, alternes d'un segment a l'autre

// --- Rendu -------------------------------------------------------------------------
// --- Decor lointain : ciel + collines en parallaxe ----------------------------------
// Dessine en coord. ECRAN (avant le translate camera). Chaque couche de collines est une
// crete irreguliere facettee en triangles, decalee de camX/camY x facteur : plus la
// couche est loin, moins elle bouge. Teintes melangees a la creme de la page (aerien).
export var HILL_LAYERS = [
  { f: 0.16, lift: 0.23, amp: 0.09, rgb: [201, 208, 178] },  // lointaine, tres pale
  { f: 0.38, lift: 0.15, amp: 0.07, rgb: [178, 186, 146] }   // proche, un peu plus dense
];

// --- Cache de rendu des facettes immobiles ------------------------------------------
// Les facettes de la passe 0 (terre) qui ne bougent plus et ne changent plus de couleur
// depuis BAKE_FRAMES frames sont peintes une fois dans des tuiles hors ecran (TILE px
// monde, cle "col,row"), recopiees d'un bloc a chaque frame. Une facette qui change est
// retiree (tuiles salies) et redessinee en direct. Une tuile dont une facette a quitte
// shards (compte vu != compte inscrit) est repeinte AVANT la copie : jamais d'image perimee.
// Coins des tuiles en px device entiers (Math.round(col*TILE*RS)) : elles se jouxtent
// exactement, et la copie est calee au px device (ecart < 0.5 px device avec le direct).
export var TILE = 256, TILE_MAX = 64, BAKE_FRAMES = 20, BAKE_EPS = 0.05, BAKE_PAD = 1.5;
export var SOIL_DARK = ['#3a2618', '#2f1e14', '#44301f'];
export var SOIL_CLAY = ['#8f5636', '#a0643f', '#7d4a30'];
export var SOIL_SAND = ['#b89c6c', '#c7ad7c', '#a98e60'];
export var PEBBLE = ['#9b9a92', '#b3b0a4', '#7f7d76', '#c4bfae'];

// Fond de la terre meuble : aplat sous les facettes, entre compactY et un peu sous la
// surface, pour qu'on ne voie pas le ciel entre les triangles empiles. Seulement la ou
// il y a vraiment de la terre meuble (LOOSE_MIN) : au bord d'un trou, le lissage laisse
// une fine epaisseur fantome, qu'on ne peint pas.
export var LOOSE_MIN = 4, LOOSE_INSET = 5;

export var TUFT_COLOR = ['#6f9c4a', '#82ad5b', '#5c8a3f', '#94bf62'];

// Fleurs au pied des arbres (voir spawnFlower/stepFlowers plus haut) : une seule espece
// (anemone des bois, blanc rose), en 3 temps enchaines - tige, bouton, corolle en etoile de
// 5 petales vue de trois-quarts (faceTilt) - puis une fanaison si sa branche est tombee.
// Meme convention d'eclairage que le reste du fichier (haut-gauche plus clair) : chaque
// petale recoit sa propre teinte selon son orientation face au soleil (FLOWER_LIGHT_A), en
// plus du clair/sombre fixe entre ses deux moities (comme le tronc ou la tige). Jamais de
// Math.random() ici : tout vient de f.* (fixe a la naissance) ou du temps (now/p/w).
export var FLOWER_LIGHT_A = -Math.PI * 0.75; // direction "haut-gauche", meme convention que shade()

// Hydne herisson : boule bosselee posee au sol (pas de pied), facettes eclairees en haut-gauche
// avec bord plus fonce, dents en fine texture (chacune avec sa petite ombre) et frange de
// poils fins en bas. Geometrie calculee une fois par champignon (unite s = 1, seed stable)
// puis dessinee a l'echelle. HYDNE_SIZE : plus petit que les autres pour que le decor
// (herbe, arbres) le detache du ciel clair.
export var HYDNE_SIZE = 0.55;

// Pleurotes en bouquet (gris, rose, huitre) : 6 chapeaux en etages comme le logo. Chaque
// chapeau = eventail de lamelles 2 tons sous un bord replie sombre, sous un dome facette
// (lumiere haut-gauche). Geometrie en unites de s, seedee sur m.x, cachee sur m._pleu.
// PLEUROTE_SIZE : un bouquet est plus large qu'un champignon seul, on le reduit un peu.
export var PLEUROTE_SIZE = 0.8;
export var PLEU_CAPS = [ // ax, ay (attache), ang (rad, 0 = haut), W, h, T, k (ton), off (decentrage du pied)
  [ 0.02, -0.60,  0.08, 0.44, 0.30, 0.17, -0.14,  0.10],
  [-0.12, -0.44, -0.42, 0.36, 0.28, 0.15, -0.08,  0.30],
  [ 0.14, -0.40,  0.48, 0.36, 0.28, 0.15, -0.05, -0.30],
  [-0.08, -0.22, -0.62, 0.28, 0.24, 0.12,  0.03,  0.25],
  [ 0.10, -0.18,  0.55, 0.27, 0.23, 0.12,  0.06, -0.25],
  [ 0.00, -0.06, -0.10, 0.20, 0.17, 0.09,  0.12,  0.15]
];

// Poing fantome du repere : memes facettes que le poing ferme de drawHand (fist = 1), en SVG
// pour etre anime en CSS (.logo-explosion-hint-hand) sans faire tourner la boucle de rendu.
export var HINT_FIST_SVG = '<svg viewBox="-13 -13 26 41" stroke="rgba(60,35,20,.5)" stroke-width=".7" stroke-linejoin="round">' +
  '<polygon fill="#b57c58" points="-7,13 7,13 6,27 -6,27"/>' +
  '<polygon fill="#e8b48a" points="-11,-8 11,-8 -9,14"/>' +
  '<polygon fill="#cf9670" points="11,-8 9,14 -9,14"/>' +
  '<polygon fill="#b57c58" points="-10.4,-10.6 -6.2,-10.6 -6.4,-0.6 -10.2,-0.6"/>' +
  '<polygon fill="#cf9670" points="-4.9,-11.5 -0.7,-11.5 -0.9,-1.5 -4.7,-1.5"/>' +
  '<polygon fill="#b57c58" points="0.7,-11.1 4.9,-11.1 4.7,-1.1 0.9,-1.1"/>' +
  '<polygon fill="#cf9670" points="6.2,-10.1 10.4,-10.1 10.2,-0.1 6.4,-0.1"/>' +
  '<polygon fill="#e8b48a" points="-11.6,1.8 0.5,-3.1 1.65,-0.8 -10,5"/>' +
  '<polygon fill="#cf9670" points="-10,5 1.65,-0.8 2.8,1.6 -8.4,8.2"/>' +
  '</svg>';
// Pelle fantome : memes facettes que drawShovelShape (pointe a gauche, manche vers +x), alterne avec le poing.
export var HINT_SHOVEL_SVG = '<svg viewBox="122 152 154 30">' +
  '<polygon fill="#b98352" points="215,166.9 262,162.7 262,166.9 215,171.1"/>' +
  '<polygon fill="#8a5a30" points="215,171.1 262,166.9 262,170.4 215,174.6"/>' +
  '<polygon fill="#7a4d28" points="262,154.3 274,154.3 274,166.9 262,166.9"/>' +
  '<polygon fill="#5e3a1d" points="262,166.9 274,166.9 274,179.5 262,179.5"/>' +
  '<polygon fill="#6b7378" points="182,166.9 216,166.9 216,171.2 182,171.6"/>' +
  '<polygon fill="#4c5256" points="182,171.6 216,171.2 216,175.4 182,176.4"/>' +
  '<g transform="translate(0 166.9) scale(1 .35) translate(0 -163)">' +
  '<polygon fill="#7d858a" points="138,180 152,186 168,189 182,186"/>' +
  '<polygon fill="#5f676c" points="152,186 168,189 168,193 152,190"/>' +
  '<polygon fill="#7d858a" points="168,189 182,186 182,190 168,193"/>' +
  '<polygon fill="#a9b1b5" points="124,166 138,180 152,186 140,172"/>' +
  '<polygon fill="#c9cfd2" points="140,172 152,186 168,189 160,176"/>' +
  '<polygon fill="#bcc3c7" points="160,176 168,189 182,186 178,175"/>' +
  '<polygon fill="#d6dcde" points="178,175 182,186 182,178 182,163"/>' +
  '<polygon fill="#8f979b" points="124,166 140,172 138,180"/>' +
  '<polygon fill="#d8dee0" points="124,166 140,172 160,176 178,175 182,163 160,166 140,164"/>' +
  '<polygon fill="#e4e9ea" points="124,166 140,164 140,172"/>' +
  '</g></svg>';
export var DIG_HINT_MSG = 'Creusez à la pelle ou au poing.';
export var DIG_TREASURE_MSG = 'Creusez ici pour découvrir le trésor.';
export var COMPASS_MSG ='Trésor enfoui par là : creusez à la pelle ou martelez du poing.';
export var COMPASS_HIDE = 90;    // px ecran : quand le badge est a moins de ca du tresor, il disparait
export var COMPASS_RISE_FRAC = 0.25;  // le badge peut monter au plus de cette fraction de H depuis le bas
export var COMPASS_BOTTOM_PAD = 70;  // marge (px) au bas de l'ecran
export var COMPASS_TIP_W = 190;  // largeur de la bulle (px)
export var COMPASS_ICON = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M7 8.5a5 5 0 1 1 7.2 4.5c-1.6.8-2.2 1.7-2.2 3.2" fill="none" stroke="#f3c94a" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="21" r="2.4" fill="#f3c94a"/></svg>';
export var COMPASS_ARROW = '<svg viewBox="0 0 22 22" width="18" height="18" aria-hidden="true"><path d="M2 2l18 9-18 9 5-9z" fill="#f3c94a" stroke="#2b1d10" stroke-width="2" stroke-linejoin="round"/></svg>';
export var DEMO_END_DELAY = 400;

// Souris partie du champignon et de sa carte (away) : la carte d'un tresor se ferme apres
// TIP_AWAY_MS. Elle attend la fin d'un deplacement du tresor (la capture du pointeur fait
// "sortir" la souris de la carte) et laisse le temps de la voir juste apres le deterrage
// (tipHoldUntil). Souris seulement : au doigt, un tap ailleurs la ferme deja.
export var TIP_AWAY_MS = 800, TIP_REVEAL_HOLD_MS = 4000;

// Ecran tactile (pas de survol) : la carte ouverte se ferme d'office apres TIP_IDLE_MS sans
// qu'on y touche, sauf en grand (.is-zoom : on regarde la photo). Rearmee par openTip et par
// tout appui sur la carte. A la souris c'est tipAway qui ferme.
export var TIP_IDLE_MS = 8000, TIP_SWIPE_PX = 30;
export var NO_HOVER = !!(window.matchMedia && window.matchMedia('(hover: none)').matches);
export var DIG_TIP_MS = 5000;

// Jeu actif : le header se deplie au survol (souris seulement) et se replie peu apres
// que la souris en sort. On mesure le rectangle plutot que d'ecouter mouseenter : le
// header de l'accueil est en pointer-events:none hors de ses liens.
export var HEADER_HOVER_LEAVE = 250;           // delai (ms) avant de replier une fois la souris sortie
// Plus haut que 0 : en plein ecran H grandit mais groundY reste fixe, donc il faut pouvoir
// remonter (camY negatif) jusqu'a ce que le sol soit de nouveau au bas de l'ecran.
// SKY_EXTRA : ciel en plus au-dessus, pour voir en entier les arbres tres hauts (TALL_SCALE_MAX).
export var SKY_EXTRA = 0.5;
// --- Panneau de parametres de simulation (debug) ------------------------------------
// Genere depuis DEBUG_FIELDS plutot qu'ecrit a la main (~90 constantes) : chaque entree
// est [groupe, cle, etiquette, min, max, step]. getDebugVar/setDebugVar utilisent eval()
// uniquement parce que ce theme n'a pas de build step qui permettrait de refactorer ces
// ~90 `var` en un objet de config sans reecrire toutes leurs references dans le fichier ;
// les noms passes a eval() viennent exclusivement de ce tableau fige ci-dessous, jamais
// d'une entree utilisateur, donc aucun risque d'injection.
export var DEBUG_FIELDS = [
  ['Monde (reconstruire pour appliquer)', 'CELLS_ACROSS', 'Facettes du logo', 20, 300, 5],
  ['Monde (reconstruire pour appliquer)', 'COL_W', 'Resolution colonnes', 2, 20, 1],
  ['Monde (reconstruire pour appliquer)', 'BEDROCK_MARGIN', 'Marge roche-mere', 0, 200, 5],
  ['Monde (reconstruire pour appliquer)', 'WORLD_MULT', 'Largeur du monde', 1, 8, 0.5],
  ['Monde (reconstruire pour appliquer)', 'DEPTH_MULT', 'Profondeur du monde', 0.5, 6, 0.25],
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
  ['Arbres / racines', 'TALL_FULL', 'Nutriments pour hauteur max', 5, 200, 1],
  ['Arbres / racines', 'TALL_SCALE_MAX', 'Hauteur bonus max', 0, 1, 0.05],
  ['Arbres / racines', 'SMALL_WIND_MULT', 'Vent sur feuilles (petit arbre)', 0, 1, 0.05],
  ['Arbres / racines', 'TALL_WIND_MULT', 'Vent sur feuilles (arbre haut)', 1, 4, 0.1],
  ['Arbres / racines', 'TREE_COST_STEP', 'Palier de coût d\'un arbre', 0, 500, 10],
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
  ['Économie', 'FERT_COST', 'Coût du fertilisant', 0, 20, 1],
  ['Économie', 'BAG_GRAINS', 'Grains par sac', 50, 5000, 50],
  ['Économie', 'MUSHROOM_PRICE', 'Prix d\'un champignon', 1, 100, 1],
  ['Insectes', 'INSECT_MAX', 'Insectes simultanes', 0, 10, 1],
  ['Insectes', 'INSECT_GAP_MIN_MS', 'Attente min. apparition', 1000, 60000, 500],
  ['Insectes', 'INSECT_GAP_MAX_MS', 'Attente max. apparition', 1000, 120000, 1000],
  ['Insectes', 'INSECT_SPEED', 'Vitesse de vol', 0.2, 3, 0.1],
  ['Insectes', 'INSECT_SIZE_F', 'Taille', 0.004, 0.04, 0.001],
  ['Insectes', 'INSECT_LAND_P', 'Chance de se poser', 0, 1, 0.05]
];
export function getDebugVar(name) { return eval(name); }
export function setDebugVar(name, value) { eval(name + ' = ' + value + ';'); }
