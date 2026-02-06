<?php
/**
 * Template Name: Shop (custom)
 * Template Post Type: page
 */

get_header();
?>

<main class="container my-5">
  <?php while (have_posts()) : the_post(); ?>

    <?php
      the_content();
    ?>
    <section class="mb-5">
      <?php
        echo do_shortcode('[products limit="12" columns="4" paginate="true" orderby="date" order="DESC"]');
      ?>
    </section>

    <section class="mt-5">

      <?php
        echo do_shortcode('[products limit="1" columns="1" orderby="date" order="DESC"]');
      ?>
    </section>

  <?php endwhile; ?>
</main>

<?php get_footer(); ?>
