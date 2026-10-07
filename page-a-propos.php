<?php
/**
* Template Name: À propos
*/
get_header(); ?>
<main class="my-5">
  <div class="container">
    <h1><?php the_title(); ?></h1>

    <p>J'ai toujours aimé cultiver des choses vivantes, mais j'ai découvert un intérêt particulier pour la culture de champignons. La vitesse de croissance de certaines espèces, comme le pleurote en huître, m'a tout de suite impressionné. Ce champignon permet aux curieux d'essayer plein de méthodes de culture sur différents substrats. C'est la possibilité d'expérimenter rapidement plusieurs choses que j'ai beaucoup aimée. De fil en aiguille, j'ai développé une passion pour les processus de culture de champignons, le strophaire, le pleurote en huître, le pleurote rose, l'hydne hérisson...</p>

    <p>Je crois que la culture de champignons en extérieur peut être extrêmement écologique, simple et accessible à tous.</p>

    <p>La mycorémédiation, c'est-à-dire l'utilisation des champignons pour aider à nettoyer et régénérer les sols, a aussi joué un rôle dans mon projet. Un contrat réalisé avec le CEME m'a encore plus encouragé à expérimenter avec le mycélium.</p>

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
