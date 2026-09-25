<?php
/**
* Template Name: À propos
*/
get_header(); ?>
<main class="my-5">
  <div class="container">
    <h1><?php the_title(); ?></h1>

    <p>Le projet a pris racine quand je jardinais et que j'ai essayé de cultiver le pleurote en huître. J'ai été fasciné par la vitesse de son développement sur différents substrats. De fil en aiguille, j'ai développé une passion pour les processus de culture de champignons, le strophaire, le pleurote en huître, le pleurote rose, l'hydne hérisson...</p>

    <p>Je crois que la culture de champignons en extérieur peut être extrêmement écologique, simple et accessible à tous.</p>

    <p>J'aime la liberté de travailler en petite équipe efficace. Le projet, c'est aussi mon père qui aide à la production, ma sœur qui est microbiologiste et qui participe pour ce qui est laboratoire, conseils, achat d'équipement, et même un ami qui embarque dans certains processus.</p>

    <h2 class="mt-5">Nos valeurs</h2>
    <p>Offrir des produits fiables et adaptés à différents niveaux d'expérience. Proposer un accompagnement personnalisé à chaque client. Encourager des pratiques respectueuses de l'environnement et des ressources. Transmettre notre intérêt profond pour la nature et l'autonomie alimentaire.</p>

    <figure class="text-center my-4">
      <img src="<?php echo esc_url( get_theme_file_uri( 'assets/img/pleurote-exterieur-automne.webp' ) ); ?>" class="rounded" style="max-height: 400px; max-width: 100%;" alt="pleurotes en fructification à l'extérieur">
    </figure>

    <h2 class="mt-5">Plus à venir</h2>
    <p>Encore à ses débuts, Sporacultus est en évolution constante. Plusieurs nouvelles sortes de champignons seront disponibles pour les amateurs et les producteurs. Nous avons également d'autres projets reliés à l'horticulture à venir.</p>

    <a class="btn btn-primary" href="/shop/">Boutique</a>
  </div>
</main>
<?php get_footer(); ?>
