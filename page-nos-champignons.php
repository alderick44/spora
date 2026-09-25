<?php
/**
* Template Name: Nos champignons
*/
get_header();

$champignons = [
	[
		'titre'   => 'Pleurote en huître',
		'image'   => 'pleurote-huitre.jpg',
		'texte'   => "Champignon polyvalent, au goût doux et à la texture tendre, idéal pour les débutants.",
	],
	[
		'titre'   => 'Hydne hérisson',
		'image'   => 'hydne-herisson.jpg',
		'texte'   => "Chair blanche et tendre, recouverte de petits aiguillons caractéristiques. Saveur douce, légèrement sucrée, parfois comparée à celle du crabe ou du homard. Idéal poêlé, en sauce ou dans les pâtes.",
	],
	[
		'titre'   => 'Pleurote gris',
		'image'   => 'pleurote-gris.jpg',
		'texte'   => "Variété de température froide et de croissance rapide.",
	],
	[
		'titre'   => 'Strophaire rouge-vin',
		'image'   => 'strophaire.webp',
		'texte'   => "Champignon de jardin, robuste, au chapeau rouge foncé, goût terreux et bon rendement en plein air.",
	],
	[
		'titre'   => 'Pleurote rose',
		'image'   => 'pleurote-rose.jpg',
		'texte'   => "Champignon tropical à la croissance rapide, saveur prononcée, légèrement poivrée, idéal sauté.",
	],
	[
		'titre'   => 'Pleurote Eryngii',
		'image'   => 'pleurote-eryngii.jpg',
		'texte'   => "Champignon de température froide produisant de grosses tiges tendres.",
	],
];
?>
<main class="my-5">
  <div class="container">
    <h1><?php the_title(); ?></h1>
    <p class="lead">Nos souches de qualité commerciale sont minutieusement sélectionnées pour offrir d'excellents rendements.</p>

    <div class="row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-4 mt-2">
      <?php foreach ( $champignons as $c ) :
        $is_webp = substr( $c['image'], -5 ) === '.webp';
        $img_url = $is_webp
          ? esc_url( get_theme_file_uri( 'assets/img/' . $c['image'] ) )
          : esc_url( get_theme_file_uri( 'assets/img/produits/' . $c['image'] ) );
      ?>
        <div class="col">
          <div class="card h-100">
            <img src="<?php echo $img_url; ?>" class="card-img-top" alt="<?php echo esc_attr( $c['titre'] ); ?>">
            <div class="card-body">
              <h2 class="card-title h5"><?php echo esc_html( $c['titre'] ); ?></h2>
              <p class="card-text"><?php echo esc_html( $c['texte'] ); ?></p>
              <a class="btn btn-primary" href="/shop/">Boutique</a>
            </div>
          </div>
        </div>
      <?php endforeach; ?>
    </div>

    <?php // Contenu de la page en base : le formulaire "Vous ne trouvez pas votre champignon ?" y vit via [demande_champignon] ?>
    <?php the_content(); ?>
  </div>
</main>
<?php get_footer(); ?>
