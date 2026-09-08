<?php
/**
* Template Name: Guides et conseils
*/
get_header();

/**
 * Habillage des cartes : 'a' (editorial sobre), 'b' (photo dominante)
 * ou 'c' (carnet d'essais). Voir template-parts/guide-card.php.
 * Changer cette seule ligne change toute la section.
 */
$card_style = 'a';

/**
 * SOURCE 1 — guides ecrits dans le theme.
 *
 * Pour en ajouter un :
 *   1. creer page-guide-<slug>.php dans le theme (copier un existant)
 *   2. ajouter une entree ici
 *   3. dans wp-admin, creer une page vide avec exactement ce slug et
 *      laisser le modele sur « par defaut » — WordPress associe seul le
 *      fichier page-<slug>.php a la page du meme slug.
 *
 * 'date' sert au tri et doit etre au format AAAA-MM-JJ.
 */
$guides_code = [
  [
    'titre'     => 'Comment les apprêter',
    'extrait'   => 'Ce qu’il faut savoir avant de les mettre dans la poêle.',
    'categorie' => 'Cuisine',
    'lien'      => '/comment-les-appreter/',
    'statut'    => 'publie',
    'date'      => '2026-09-06',
    'image'     => '',
  ],
];

/**
 * SOURCE 2 — articles rediges dans wp-admin (Articles → Ajouter).
 * Rien a faire ici : ils apparaissent des qu'ils sont publies.
 */
$guides_wp = [];

foreach ( get_posts( [ 'numberposts' => 50, 'post_status' => 'publish' ] ) as $post_item ) {
	$categories = get_the_category( $post_item->ID );
	$extrait    = has_excerpt( $post_item )
		? get_the_excerpt( $post_item )
		: wp_trim_words( wp_strip_all_tags( $post_item->post_content ), 18, '…' );

	$guides_wp[] = [
		'titre'     => get_the_title( $post_item ),
		'extrait'   => $extrait,
		'categorie' => ! empty( $categories ) ? $categories[0]->name : '',
		'lien'      => get_permalink( $post_item ),
		'statut'    => 'publie',
		'date'      => get_the_date( 'Y-m-d', $post_item ),
		'image'     => get_the_post_thumbnail_url( $post_item, 'medium_large' ) ?: '',
	];
}

// Fusion des deux sources, du plus recent au plus ancien.
$guides = array_merge( $guides_code, $guides_wp );
usort( $guides, function ( $a, $b ) {
	return strcmp( $b['date'], $a['date'] );
} );
?>
<main class="my-5">
  <div class="container">
    <div class="col-12 col-lg-8 mx-auto">

      <h1><?php the_title(); ?></h1>

      <p class="lead">Ce qu’on a appris en cultivant nos propres champignons, et en les mangeant.</p>

      <?php if ( empty( $guides ) ) : ?>
        <p>Les premiers guides arrivent bientôt.</p>
      <?php else : ?>
        <div class="row mt-4">
          <?php foreach ( $guides as $guide ) : ?>
            <?php get_template_part( 'template-parts/guide-card', null, array_merge( $guide, [ 'style' => $card_style ] ) ); ?>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>

    </div>
  </div>
</main>
<?php get_footer(); ?>
