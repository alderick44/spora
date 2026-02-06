<?php get_header(); ?>
<main class="container my-5">
  <?php
  while (have_posts()) : the_post();
    the_content();
  endwhile;
  ?>
</main>
<?php get_footer(); ?>
