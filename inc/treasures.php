<?php
// Donnees des tresors du jeu du logo (accueil), lues par front-page.php.
function spora_get_treasures() {
    // "Tresors" enfouis dans la terre du logo explose : on creuse pour les deterrer.
    // x = position en fraction de la largeur du MONDE explorable (pas juste du logo, le
    // monde continue horizontalement au-dela de la boite) ; species = couleur du champignon
    // (0 gris, 1 rose, 2 hydne, 3 huitre, 4 shiitake, voir SPECIES dans jeu/config.js).
    // depth (optionnel) = enfouissement, en fraction de la hauteur de la boite sous le niveau
    // d'origine du sol (0 = a la surface, se deterre au moindre passage ; borne par DEPTH_MULT). Le premier tresor
    // porte le repere (halo + fleche) : garde-le peu profond (ex. 0.06) mais pas a 0.
    // strain (optionnel) = souche de mycelium debloquee au reveal : id, label, tint (couleur hex),
    // perk (texte du trait) facultatif ; price (prix de recolte), grow / decay (multiplicateurs de croissance et d'extinction). La souche debloquee ne depend pas du tresor : le 1er deterre donne le strophaire, le 2e le pleurote, le 3e l'hydne (les strain ci-dessus ne servent qu'a definir leurs traits).
    // img = photo de la carte : une URL, ou un tableau de photos (fleches precedente / suivante sur la photo).
    // Une photo sous licence libre s'ecrit [ 'src' => URL, 'credit' => texte, 'credit_url' => source ] : le credit (court) s'affiche en pale sur la photo.
    return [
        [ 'x' => 0.12, 'depth' => 0.06, 'species' => 5, 'title' => 'Strophaire rouge vin', 'text' => 'Des copeaux de bois colonisés de strophaire, à étendre dans votre jardin.', 'img' => [ get_theme_file_uri( 'assets/img/strophaire.webp' ), [ 'src' => get_theme_file_uri( 'assets/img/strophaire-groupe.webp' ), 'credit' => 'Ann F. Berger · CC BY-SA 3.0', 'credit_url' => 'https://commons.wikimedia.org/wiki/File:2011-05-19_Stropharia_rugosoannulata_Farl._ex_Murrill_183478.jpg' ] ], 'url' => '/product/mycelium-en-vrac' ],
        [ 'x' => 0.4, 'depth' => 0.14, 'strain' => [ 'id' => 'pleurote', 'label' => 'Pleurote huître', 'tint' => '#7fa9d4', 'perk' => 'couleurs variées, croissance normale', 'price' => 8 ], 'species' => 3, 'title' => 'Pleurote huître', 'text' => 'Le plus facile à cultiver : il pousse même dans la paille ou le carton.', 'img' => [ get_theme_file_uri( 'assets/img/produits/pleurote-huitre.jpg' ), get_theme_file_uri( 'assets/img/pleurote-feuilles-2022.webp' ) ], 'url' => '/shop/' ],
        [ 'x' => 0.68, 'depth' => 0.3, 'strain' => [ 'id' => 'hydne', 'label' => 'Hydne hérisson', 'tint' => '#f0c860', 'perk' => 'pousse plus vite, moins résistante', 'price' => 12, 'grow' => 1.3, 'decay' => 1.4 ], 'species' => 2, 'title' => 'Hydne hérisson', 'text' => 'Texture de crabe, goût délicat. Il pousse sur le bois franc.', 'img' => [ get_theme_file_uri( 'assets/img/produits/hydne-herisson.jpg' ), get_theme_file_uri( 'assets/img/banner-hydne-automne.webp' ) ], 'url' => '/shop/' ],
    ];
}
