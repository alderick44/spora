<?php
// "Tresors" enfouis dans la terre du logo explose : on creuse pour les deterrer.
// x = position en fraction de la largeur du MONDE explorable (pas juste du logo, le
// monde continue horizontalement au-dela de la boite) ; species = couleur du champignon
// (0 gris, 1 rose, 2 hydne, 3 huitre, 4 shiitake, voir SPECIES dans logo-explosion.js).
$spora_treasures = [
    [ 'x' => 0.12, 'species' => 3, 'title' => 'Pleurote huître', 'text' => 'Le plus facile à cultiver : il pousse même dans la paille ou le carton.', 'img' => get_theme_file_uri( 'assets/img/produits/pleurote-huitre.jpg' ), 'url' => '/shop/' ],
    [ 'x' => 0.4, 'species' => 0, 'title' => 'Mycélium en vrac', 'text' => 'Du grain colonisé à étendre dans vos copeaux ou vos feuilles.', 'img' => get_theme_file_uri( 'assets/img/produits/grain-colonising.jpg' ), 'url' => '/product/mycelium-en-vrac' ],
    [ 'x' => 0.68, 'species' => 2, 'title' => 'Hydne hérisson', 'text' => 'Texture de crabe, goût délicat. Il pousse sur le bois franc.', 'img' => get_theme_file_uri( 'assets/img/produits/hydne-herisson.jpg' ), 'url' => '/shop/' ],
    [ 'x' => 0.92, 'species' => 1, 'title' => 'Le saviez-vous ?', 'text' => 'Le mycélium décompose le bois mort et le rend au sol : c\'est lui qui nourrit la forêt.' ],
];
?>
<?php get_header(); ?>
    <main class="bg-secondary">
      <section class="logo-explosion-hero">
        <div id="logo-explosion" class="logo-explosion-inner">
          <img
            id="logo-explosion-fallback"
            src="<?php echo esc_url( get_theme_file_uri( 'assets/icons/wordmark-sporacultus.png' ) ); ?>"
            alt="Sporacultus"
          />
          <canvas
            id="logo-explosion-canvas"
            class="logo-explosion-layer d-none"
            data-logo-url="<?php echo esc_url( get_theme_file_uri( 'assets/icons/wordmark-sporacultus.png' ) ); ?>"
            data-treasures="<?php echo esc_attr( wp_json_encode( $spora_treasures ) ); ?>"
            aria-hidden="true"
          ></canvas>
          <button type="button" id="logo-explosion-rebuild" class="logo-explosion-rebuild d-none" aria-label="Reconstruire le logo" title="Reconstruire le logo">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 12a9 9 0 1 0 3-6.7"/>
              <path d="M3 4v5h5"/>
            </svg>
          </button>
          <div id="logo-explosion-tools" class="logo-explosion-tools d-none" role="group" aria-label="Outils">
            <button type="button" class="logo-explosion-tool is-active" data-tool="shovel" aria-pressed="true" aria-label="Pelle" title="Pelle">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 3l2 2"/>
                <path d="M20 4l-9 9"/>
                <path d="M13 11l-6 6a3 3 0 0 1-4-4l6-6z"/>
              </svg>
            </button>
            <button type="button" class="logo-explosion-tool" data-tool="mycelium" aria-pressed="false" aria-label="Mycélium en vrac" title="Mycélium en vrac">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 3h6l-1 3h-4z"/>
                <path d="M10 6c-4 1-5 4-5 8 0 4 3 7 7 7s7-3 7-7c0-4-1-7-5-8"/>
                <circle cx="10" cy="14" r=".6" fill="currentColor"/>
                <circle cx="14" cy="13" r=".6" fill="currentColor"/>
                <circle cx="12" cy="17" r=".6" fill="currentColor"/>
              </svg>
            </button>
            <button type="button" class="logo-explosion-tool" data-tool="tree" aria-pressed="false" aria-label="Planter un arbre" title="Planter un arbre">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 3l5 7h-3l4 6h-4v5h-4v-5H6l4-6H7z"/>
              </svg>
            </button>
          </div>
          <div id="logo-explosion-speed-wrap" class="logo-explosion-speed d-none">
            <label for="logo-explosion-speed">Vitesse <span id="logo-explosion-speed-val">1×</span></label>
            <input type="range" id="logo-explosion-speed" min="1" max="30" step="1" value="1" aria-label="Vitesse de simulation">
          </div>
          <button type="button" id="logo-explosion-scroll-left" class="logo-explosion-scroll logo-explosion-scroll-left d-none" aria-label="Défiler le monde vers la gauche">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <button type="button" id="logo-explosion-scroll-right" class="logo-explosion-scroll logo-explosion-scroll-right d-none" aria-label="Défiler le monde vers la droite">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
          <button type="button" id="logo-explosion-scroll-up" class="logo-explosion-scroll logo-explosion-scroll-up d-none" aria-label="Défiler le monde vers le haut">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 15l6-6 6 6"/>
            </svg>
          </button>
          <button type="button" id="logo-explosion-scroll-down" class="logo-explosion-scroll logo-explosion-scroll-down d-none" aria-label="Défiler le monde vers le bas (creuser plus profond)">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
        </div>
        <p id="logo-explosion-caption" class="logo-explosion-caption d-none" aria-live="polite"></p>
      </section>
      <section class="hero-viewport z-0">
        <div class="position-relative">
          <img
            class="w-100 h-100 object-fit-cover object-position-center hero-pan"
            src="<?php echo get_template_directory_uri();?>/assets/img/banner-mushroom-autumn.webp"
            alt="Pleurote qui pousse dans les feuilles"/>
          <div class="position-absolute top-50 start-50 translate-middle z-1 w-100 mt-5 pt-5">
            <div class="container mt-5">
              <a class="text-start text-light m-0 p-3 mt-5 btn btn-primary" href="/shop">
                Visitez notre boutique!
              </a>
            </div>
          </div>
        </div>
      </section>
      <div class="container pb-5">
        <section class="pt-5 mt-5">
          <h1 class=text-center>Sporacultus, culture de champignons</h1>
          <p>
            Sporacultus est un projet dédié à la culture de champignons
            comestibles et à la valorisation des ressources naturelles locales.
            Nous produisons des substrats, du mycélium et des ensembles prêts à
            l’emploi pour les jardiniers et producteurs. Notre mission : rendre
            la myciculture accessible, durable et inspirante. Cultivez vos
            propres champignons, simplement et naturellement !
          </p>
        </section>
        <section class="py-5 my-5">
          <div class="text-center d-flex flex-column align-items-center">
            <h1>Précommandez votre mycélium en vrac!</h1>
            <div class="row py-5">
              <div class="col-12 col-lg-6">
                <img
                  src="<?php echo get_template_directory_uri(); ?>/assets/img/pleurote-feuilles-2022.webp"
                  alt="Pleurotes en huître qui poussent dans un tas de feuilles"
                  class="img-fluid rounded-2"/>
                <p class="text-muted small mt-2 mb-0">Photo prise en juin 2022</p>
              </div>
              <div class="col-12 col-lg-6">
                <div class="d-flex flex-column justify-content-between h-100 p-3 p-lg-0">
                  <p class="text-lg-start py-3 py-lg-0">
                    Notre mycélium en vrac est conçu pour ceux qui veulent faire
                    pousser leurs propres champignons sans équipement
                    spécialisé. Il suffit de l’étendre dans un milieu riche en
                    copeaux de bois ou en matières organiques, puis de maintenir
                    l’humidité, le mycélium fera le reste!
                    <br>Une fois la fructification terminée, le substrat enrichi continue d’agir
                    : il améliore la structure du sol, stimule la vie
                    microbienne et transforme la matière ligneuse en nutriments
                    durables. Simple, naturel et polyvalent. Faites pousser,
                    récoltez, puis nourrissez votre jardin.
                  </p>
                  <div>
                    <a class="btn btn-primary w-50" href="/product/mycelium-en-vrac">Précommander</a>
                  </div>
                </div>
              </div>
            </div>
            <h4>Distribution à partir de mai 2027!</h4>
          </div>
        </section>
        <section class="pb-5">
          <h1 class="text-center pt-5 my-5">Pour les producteurs</h1>
          <div
            class="row align-items-center justify-content-between px-lg-5 mx-lg-5 pb-5">
            <div class="col-md-5 col-12">
              <img
                class="img-fluid rounded-2"
                src="<?php echo get_template_directory_uri(); ?>/assets/img/GSM_Hotte.webp"
                alt="Mycelium sur grain dans une hotte à flux laminaire"/>
            </div>
            <div class="col-md-5 col-12 text-md-end py-3">
              <img
                class="img-fluid d-none d-md-block rounded-2"
                src="<?php echo get_template_directory_uri(); ?>/assets/img/GSL-pack-crop.webp"
                alt="Pack de 5 sacs de mycelium sur grain"/>
            </div>
            <div class="col-12 py-4 text-center">
              <h6 class="py-4">
                Mycélium fiable et performant, adapté aux besoins des
                producteurs professionnels.
              </h6>
              <a class="btn btn-primary" href="/producteurs/">En savoir plus</a>
            </div>
            <div class="col-10 col-lg-8 pt-md-5 mx-auto">
              <img
                class="img-fluid rounded-2"
                src="<?php echo get_template_directory_uri(); ?>/assets/img/jardin.webp"
                alt="Rang d'épinard dans un jardin"/>
            </div>
          </div>
        </section>
      </div>
    </main>
    <?php get_footer(); ?>

  </body>
</html>
