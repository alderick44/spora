<?php
/**
* Template Name: Nous joindre
*/
get_header(); ?>
<main class="my-5">
  <div class="container">
    <h1><?php the_title(); ?></h1>

    <div class="row g-4 mt-2">
      <div class="col-lg-6">
        <h2>Écrivez-nous</h2>
        <p><a href="mailto:info@sporacultus.ca">info@sporacultus.ca</a></p>

        <h2 class="mt-5">Point de cueillette</h2>
        <div class="alert alert-warning">Temporairement indisponible</div>
        <p>Chez Culture Orenda, à Trois-Rivières</p>
        <address>
          1014 Rue Albert Durand<br>
          Trois-Rivières, QC G8Z 2M7
        </address>

        <a class="btn btn-primary" href="/shop/">Boutique</a>
      </div>
      <div class="col-lg-6">
        <iframe
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d5509.155974978947!2d-72.5747493603107!3d46.33807204726356!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4cc7cf4c65339a6f%3A0x77ce72335e69326c!2sCulture%20Orenda%20-%20Oasis%20Urbaine!5e0!3m2!1sfr!2sca!4v1747000667418!5m2!1sfr!2sca"
          class="w-100 rounded"
          height="450"
          style="border:0;"
          allowfullscreen=""
          loading="lazy"
          referrerpolicy="no-referrer-when-downgrade"
        ></iframe>
      </div>
    </div>
  </div>
</main>
<?php get_footer(); ?>
