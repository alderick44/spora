<?php
/**
 * Affichage d'un article (guide redige dans wp-admin).
 *
 * Les guides peuvent venir de deux sources : les articles WordPress, qui
 * passent ici, et les fichiers page-guide-*.php ecrits dans le theme.
 * L'index (page-guides-et-conseils.php) fusionne les deux.
 */
get_header(); ?>
<main class="my-5">
  <div class="container">
    <div class="col-12 col-lg-8 mx-auto">

      <?php while ( have_posts() ) : the_post(); ?>

        <p class="mb-2">
          <a href="/guides-et-conseils/" class="text-decoration-none">← Guides et conseils</a>
        </p>

        <h1><?php the_title(); ?></h1>

        <?php
        $categories = get_the_category();
        if ( ! empty( $categories ) ) : ?>
          <p class="guide-meta mb-4"><?php echo esc_html( $categories[0]->name ); ?></p>
        <?php endif; ?>

        <?php if ( has_post_thumbnail() ) : ?>
          <div class="mb-4">
            <?php the_post_thumbnail( 'large', [ 'class' => 'img-fluid rounded-3' ] ); ?>
          </div>
        <?php endif; ?>

        <div class="guide-contenu">
          <?php the_content(); ?>
        </div>

        <div class="mt-5 pt-4 border-top">
          <a class="btn btn-primary" href="/shop/">Voir nos champignons à cultiver</a>
        </div>

        <p class="mt-4">
          <a href="/guides-et-conseils/" class="text-decoration-none">← Retour aux guides</a>
        </p>

      <?php endwhile; ?>

    </div>
  </div>
</main>
<?php get_footer(); ?>
