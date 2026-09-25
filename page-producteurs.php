<?php
/**
* Template Name: Pour les producteurs
*/
get_header(); ?>
<main class="my-5">
  <div class="container">
    <h1><?php the_title(); ?></h1>
    <p class="lead">Nous offrons un service personnalisé aux producteurs. Écrivez-nous pour discuter de vos besoins à moyenne ou grande échelle.</p>

    <div class="row row-cols-1 row-cols-md-2 g-4 mt-2">
      <div class="col">
        <div class="card h-100">
          <div class="spora-video-outer position-relative">
            <video
              class="card-img-top spora-video-fallback spora-video-lazy"
              poster="<?php echo esc_url( get_theme_file_uri( 'assets/img/produits/bloc-eryngii-fructification.jpg' ) ); ?>"
              controls muted loop playsinline preload="none"
              data-mime="video/mp4"
            >
              <source src="<?php echo esc_url( get_theme_file_uri( 'assets/videos/inoculation-gs.mp4' ) ); ?>" type="video/mp4">
            </video>
            <img src="<?php echo esc_url( get_theme_file_uri( 'assets/img/produits/bloc-eryngii-fructification.jpg' ) ); ?>" class="card-img-top spora-video-fallback-img d-none" alt="bloc de pleurotes eryngii en fructification">
            <div class="spora-video-spinner d-none"><div class="spinner-border text-light" role="status"></div></div>
          </div>
          <div class="card-body">
            <h2 class="card-title h5">Qualité commerciale</h2>
            <p class="card-text">Notre offre est adaptée à une clientèle commerciale.</p>
          </div>
        </div>
      </div>

      <div class="col">
        <div class="card h-100">
          <img src="<?php echo esc_url( get_theme_file_uri( 'assets/img/labo-hotte.jpg' ) ); ?>" class="card-img-top" alt="notre laboratoire">
          <div class="card-body">
            <h2 class="card-title h5">Notre laboratoire</h2>
            <p class="card-text">Équipement professionnel garantissant la qualité et la stérilité du produit.</p>
          </div>
        </div>
      </div>
    </div>

    <div class="text-center my-5">
      <h2>Optimisez votre production</h2>
      <div class="spora-video-outer position-relative">
        <video
          class="rounded my-3 mx-auto d-block spora-video-fallback spora-video-lazy"
          style="max-height: 400px; max-width: 100%;"
          poster="<?php echo esc_url( get_theme_file_uri( 'assets/img/jardin.webp' ) ); ?>"
          loop muted playsinline preload="none"
          data-mime="video/mp4"
        >
          <source src="<?php echo esc_url( get_theme_file_uri( 'assets/videos/timelapse-GSPI.mp4' ) ); ?>" type="video/mp4">
        </video>
        <img src="<?php echo esc_url( get_theme_file_uri( 'assets/img/jardin.webp' ) ); ?>" class="rounded my-3 mx-auto d-block d-none spora-video-fallback-img" style="max-height: 400px; max-width: 100%;" alt="jardin de production">
        <div class="spora-video-spinner d-none"><div class="spinner-border text-light" role="status"></div></div>
      </div>

      <h3 class="h5">Service personnalisé</h3>
      <p>Nous offrons un service adapté à vos besoins qui ira au-delà de vos attentes.</p>
      <a class="btn btn-primary" href="/shop/">Boutique</a>
    </div>
  </div>
</main>
<style>
.spora-video-spinner {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.25);
  pointer-events: none;
}
</style>
<script>
document.querySelectorAll( '.spora-video-fallback' ).forEach( function ( video ) {
  if ( ! video.canPlayType( video.dataset.mime ) ) {
    video.classList.add( 'd-none' );
    video.closest( '.spora-video-outer' ).querySelector( '.spora-video-fallback-img' ).classList.remove( 'd-none' );
  }
} );

var spora_video_observer = new IntersectionObserver( function ( entries ) {
  entries.forEach( function ( entry ) {
    var video = entry.target;
    var spinner = video.closest( '.spora-video-outer' ).querySelector( '.spora-video-spinner' );
    if ( entry.isIntersecting ) {
      if ( ! video.dataset.loaded ) {
        video.dataset.loaded = '1';
        video.addEventListener( 'waiting', function () { spinner.classList.remove( 'd-none' ); } );
        video.addEventListener( 'playing', function () { spinner.classList.add( 'd-none' ); } );
        spinner.classList.remove( 'd-none' );
        video.load();
      }
      video.play().catch( function () {} );
    } else {
      video.pause();
    }
  } );
}, { rootMargin: '200px' } );

document.querySelectorAll( '.spora-video-lazy' ).forEach( function ( video ) {
  spora_video_observer.observe( video );
} );
</script>
<?php get_footer(); ?>
