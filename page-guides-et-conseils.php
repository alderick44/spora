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
 * Les guides. Chaque entree pointe vers une vraie page WordPress, a creer
 * une fois dans wp-admin avec le modele correspondant (comme pour A propos).
 * 'statut' => 'essai' n'est visible que dans l'habillage 'c'.
 */
$guides = [
  [
    'titre'     => 'Comment les apprêter',
    'extrait'   => 'Ce qu’il faut savoir avant de les mettre dans la poêle.',
    'categorie' => 'Cuisine',
    'lien'      => '/comment-les-appreter/',
    'statut'    => 'publie',
    'date'      => '6 septembre',
    'image'     => '',
  ],
];
?>
<main class="my-5">
  <div class="container">
    <div class="col-12 col-lg-8 mx-auto">

      <h1><?php the_title(); ?></h1>

      <p class="lead">Ce qu’on a appris en cultivant nos propres champignons, et en les mangeant.</p>

      <div class="row mt-4">
        <?php foreach ( $guides as $guide ) : ?>
          <?php get_template_part( 'template-parts/guide-card', null, array_merge( $guide, [ 'style' => $card_style ] ) ); ?>
        <?php endforeach; ?>
      </div>

    </div>
  </div>
</main>
<?php get_footer(); ?>
