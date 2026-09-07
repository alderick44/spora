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
 * Les guides. Ajouter une entree ici suffit a faire apparaitre une carte.
 * 'statut' => 'essai' n'est visible que dans l'habillage 'c'.
 */
$guides = [
  [
    'titre'     => 'Comment les apprêter',
    'extrait'   => 'Strophaire et pleurote : ce qu\'il faut savoir avant la poêle.',
    'categorie' => 'Cuisine',
    'lien'      => '#comment-les-appreter',
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

      <p class="lead">Ce qu'on apprend en cultivant et en cuisinant nos propres champignons. On commence par la cuisine — le reste s'ajoutera au fil des saisons.</p>

      <div class="row mt-4">
        <?php foreach ( $guides as $guide ) : ?>
          <?php get_template_part( 'template-parts/guide-card', null, array_merge( $guide, [ 'style' => $card_style ] ) ); ?>
        <?php endforeach; ?>
      </div>

      <article id="comment-les-appreter" class="mt-5 pt-4 border-top">

        <h2>Comment les apprêter</h2>

        <h3 class="h5 mt-4">Deux règles qui comptent plus que tout le reste</h3>

        <p>Ne les lavez pas à grande eau. Les champignons se gorgent comme des éponges, et toute cette eau finit dans votre poêle. Un coup de brosse ou un linge humide suffit.</p>

        <p>Ne les entassez pas. C'est l'erreur la plus courante. Une poêle trop pleine, les champignons se mettent à bouillir dans leur propre eau au lieu de colorer&nbsp;: ils sortent gris et caoutchouteux. Faites-les en deux fois plutôt qu'une, à feu vif, et salez à la fin — le sel les fait dégorger trop tôt.</p>

        <h3 class="h5 mt-4">Le pleurote en huître</h3>

        <p>Il cuit vite et il est fragile. Sa chair est mince, elle rend beaucoup d'eau, puis elle colore d'un coup — il faut le surveiller.</p>

        <p>Il se défait si on le noie. Dans une soupe ou une sauce, ajoutez-le à la fin plutôt que de le faire mijoter longtemps. Il se déchire naturellement dans le sens des lamelles, pas besoin de couteau.</p>

        <h3 class="h5 mt-4">Le strophaire</h3>

        <p>Plus ferme, plus charnu. C'est celui qui supporte la cuisson longue&nbsp;: braisé, mijoté, en ragoût, il tient sa forme là où le pleurote aurait disparu.</p>

        <p>Cueilli jeune, avant que le chapeau s'ouvre, il est ferme et le pied vaut le chapeau. Passé ce stade il devient spongieux. Les gros chapeaux se tranchent épais et se traitent presque comme une pièce de viande.</p>

        <p>Il doit être bien cuit. Ce n'est pas un champignon à manger cru ou saisi à peine.</p>

        <h3 class="h5 mt-4">Conservation</h3>

        <p>Ils se congèlent mieux cuits que crus. Un aller-retour dans la poêle avant de les mettre au congélateur, et ils gardent leur texture.</p>

      </article>

      <div class="mt-5 pt-4 border-top">
        <p class="mb-3">Le strophaire et le pleurote se cultivent tous les deux dehors, dans les copeaux de bois francs.</p>
        <a class="btn btn-primary" href="/shop/">Voir le mycélium en vrac</a>
      </div>

    </div>
  </div>
</main>
<?php get_footer(); ?>
