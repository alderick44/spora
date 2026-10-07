<?php
$spora_treasures = spora_get_treasures();
// Mode demo : meme jeu (assets/js/jeu/), avec des outils en moins (voir .is-demo dans
// style.css), un seul tresor (la premiere souche) et un ecran de fin a la premiere recolte : boutique, ou continuer
// (le mode demo se desactive alors pour ce visiteur). false = jeu complet d'emblee.
$spora_demo = true;
// Essai mobile : sur ecran etroit, la carte du tresor selectionne s'affiche dans une boite sous le bouton
// "Visitez notre boutique!" au lieu de flotter dans le jeu (voir shelfEl dans jeu/etat.js). false = bulle partout.
$spora_tip_shelf = true;
?>
<?php get_header(); ?>
    <main class="bg-secondary">
      <section class="logo-explosion-hero">
        <div id="logo-explosion" class="logo-explosion-inner<?php echo $spora_demo ? ' is-demo' : ''; ?>">
          <div id="logo-explosion-fallback-wrap" class="logo-explosion-fallback-wrap">
            <img
              id="logo-explosion-fallback"
              src="<?php echo esc_url( get_theme_file_uri( 'assets/icons/wordmark-sporacultus.png' ) ); ?>"
              alt="Sporacultus"
            />
            <span class="logo-explosion-play-zone">
              <span class="logo-explosion-play-badge" aria-hidden="true">
                <svg class="logo-explosion-play-ring" viewBox="0 0 36 36" fill="none"><circle class="logo-explosion-play-ring-track" cx="18" cy="18" r="16"/><circle class="logo-explosion-play-ring-fill" cx="18" cy="18" r="16" pathLength="100"/></svg>
                <svg class="logo-explosion-play-icon" viewBox="0 0 24 24" width="18" height="18" fill="white"><path d="M8 5l12 7-12 7z"/></svg>
              </span>
              <span class="logo-explosion-play-hint" aria-hidden="true">Maintenez</span>
            </span>
          </div>
          <canvas
            id="logo-explosion-canvas"
            class="logo-explosion-layer d-none"
            data-logo-url="<?php echo esc_url( get_theme_file_uri( 'assets/icons/wordmark-sporacultus.png' ) ); ?>"
            data-bag-logo-url="<?php echo esc_url( get_theme_file_uri( 'assets/icons/logo-spora.svg' ) ); ?>"
            data-treasures="<?php echo esc_attr( wp_json_encode( $spora_treasures ) ); ?>"
            aria-hidden="true"
          ></canvas>
          <button type="button" id="logo-explosion-speed-btn" class="logo-explosion-speed-btn d-none" aria-label="Vitesse de simulation : normale" title="Vitesse de simulation"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path class="spd-1" d="M2 6l6 6-6 6"/><path class="spd-2" d="M9 6l6 6-6 6" style="display:none"/><path class="spd-3" d="M16 6l6 6-6 6" style="display:none"/></svg><span class="logo-explosion-speed-btn-val">×1</span></button>
          <button type="button" id="logo-explosion-fullscreen" class="logo-explosion-fullscreen d-none" aria-label="Agrandir en plein ecran" aria-pressed="false" title="Agrandir en plein ecran">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3"/>
              <path d="M16 3h3a2 2 0 0 1 2 2v3"/>
              <path d="M21 16v3a2 2 0 0 1-2 2h-3"/>
              <path d="M8 21H5a2 2 0 0 1-2-2v-3"/>
            </svg>
          </button>
          <button type="button" id="logo-explosion-rebuild" class="logo-explosion-rebuild d-none" aria-label="Tout remettre à zéro" title="Tout remettre à zéro">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 12a9 9 0 1 0 3-6.7"/>
              <path d="M3 4v5h5"/>
            </svg>
          </button>
          <button type="button" id="logo-explosion-debug-toggle" class="logo-explosion-debug-toggle d-none" aria-label="Paramètres de simulation" aria-pressed="false" title="Paramètres de simulation">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
          <div id="logo-explosion-debug-panel" class="logo-explosion-debug-panel d-none" role="group" aria-label="Paramètres de simulation"></div>
          <div id="logo-explosion-tools" class="logo-explosion-tools d-none" role="group" aria-label="Outils">
            <button type="button" class="logo-explosion-tool is-active" data-tool="hand" aria-pressed="true" aria-label="Récolter à la main" title="Récolter à la main">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 13V6a1.5 1.5 0 0 1 3 0v5"/>
                <path d="M11 11V4.5a1.5 1.5 0 0 1 3 0V11"/>
                <path d="M14 11.5V5.5a1.5 1.5 0 0 1 3 0V13"/>
                <path d="M17 8.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-2a6 6 0 0 1-5-2.7L4 13.8a1.4 1.4 0 0 1 2.2-1.7L8 14"/>
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
            <button type="button" class="logo-explosion-tool" data-tool="loupe" aria-pressed="false" aria-label="Loupe : examiner" title="Loupe : examiner">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="10.5" cy="10.5" r="6.5"/>
                <path d="M15.5 15.5L21 21"/>
              </svg>
            </button>
            <button type="button" class="logo-explosion-tool" data-tool="tree" aria-pressed="false" aria-label="Planter un arbre" title="Planter un arbre">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 3l5 7h-3l4 6h-4v5h-4v-5H6l4-6H7z"/>
              </svg>
            </button>
            <button type="button" class="logo-explosion-tool" data-tool="fertilizer" aria-pressed="false" aria-label="Fertilisant" title="Fertilisant">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 3c3 4 5 6.5 5 9a5 5 0 0 1-10 0c0-2.5 2-5 5-9z"/>
                <path d="M12 21v-4"/>
                <circle cx="6" cy="20" r=".6" fill="currentColor"/>
                <circle cx="18" cy="20" r=".6" fill="currentColor"/>
              </svg>
            </button>
            <button type="button" class="logo-explosion-tool" data-tool="grass" aria-pressed="false" aria-label="Semer du gazon" title="Semer du gazon">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 21h18"/>
                <path d="M12 21V8"/>
                <path d="M8 21c0-4-1-7-4-9"/>
                <path d="M16 21c0-4 1-7 4-9"/>
              </svg>
            </button>
            <div id="logo-explosion-money"class="logo-explosion-money d-none" aria-live="polite"><span id="logo-explosion-money-val">0</span>&nbsp;$</div>
          </div>
          <div id="logo-explosion-challenges" class="logo-explosion-challenges-badge d-none" tabindex="0" role="button" aria-label="Défis">
            <span class="logo-explosion-challenges-count"></span>
            <div class="logo-explosion-challenges-pop" role="tooltip"></div>
          </div>
          <div id="logo-explosion-strains" class="logo-explosion-strains d-none" role="group" aria-label="Souche de mycélium"></div>
          <div id="logo-explosion-treasures" class="logo-explosion-treasures d-none" aria-live="polite"></div>
          <div id="logo-explosion-speed-wrap" class="logo-explosion-speed d-none">
            <label for="logo-explosion-speed">Vitesse <span id="logo-explosion-speed-val">1×</span></label>
            <input type="range" id="logo-explosion-speed" min="1" max="30" step="1" value="1" aria-label="Vitesse de simulation">
            <label for="logo-explosion-rain">Pluie</label>
            <input type="range" id="logo-explosion-rain" min="0" max="100" step="1" value="30" aria-label="Fréquence de la pluie naturelle">
            <label for="logo-explosion-drought">Sécheresse</label>
            <input type="range" id="logo-explosion-drought" min="0" max="100" step="1" value="30" aria-label="Fréquence de la sécheresse naturelle">
            <span id="logo-explosion-drought-indicator" class="logo-explosion-drought-indicator d-none">Sécheresse en cours</span>
            <label for="logo-explosion-storm">Tempêtes</label>
            <input type="range" id="logo-explosion-storm" min="0" max="100" step="1" value="20" aria-label="Fréquence des tempêtes (averses intenses)">
            <span id="logo-explosion-storm-indicator" class="logo-explosion-storm-indicator d-none">Tempête en cours</span>
            <label for="logo-explosion-grass-nutri">Nutriments gazon</label>
            <input type="number" id="logo-explosion-grass-nutri" min="0" step="0.5" value="1" aria-label="Production de nutriments du gazon ordinaire (1 = normal, 0 = aucune)" style="width:4.5em">
            <label for="logo-explosion-grassmyc-nutri">Nutriments gazon long</label>
            <input type="number" id="logo-explosion-grassmyc-nutri" min="0" step="0.5" value="2.5" aria-label="Production de nutriments du gazon long avec champignons (1 = normal, 0 = aucune)" style="width:4.5em">
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
          <span id="logo-explosion-tools-arrow" class="logo-explosion-tools-arrow d-none" aria-hidden="true"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="#2b1d10" stroke-width="6.5"><path d="M20 12H5"/><path d="M11 6l-6 6 6 6"/></g><g stroke="#f3c94a" stroke-width="3"><path d="M20 12H5"/><path d="M11 6l-6 6 6 6"/></g></svg></span>
          <p id="logo-explosion-caption" class="logo-explosion-caption d-none" aria-live="polite"></p>
          <aside id="logo-explosion-explain" class="logo-explosion-explain" aria-live="polite" aria-hidden="true">
            <svg class="logo-explosion-explain-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3C8 8.5 6 11.5 6 15a6 6 0 0 0 12 0c0-3.5-2-6.5-6-12z"/><path d="M9.5 15.5a2.6 2.6 0 0 0 2.5 2.2"/></svg>
            <div><strong class="logo-explosion-explain-title">Dans le sol</strong><p class="logo-explosion-explain-text"></p><button type="button" class="logo-explosion-explain-ack">Compris</button><button type="button" class="logo-explosion-explain-locate" aria-label="Voir où le mycélium est mort">Voir</button></div><button type="button" class="logo-explosion-explain-close" aria-label="Fermer le message">&times;</button>
          </aside>
          <aside id="logo-explosion-fact" class="logo-explosion-fact" aria-live="polite" aria-hidden="true">
            <span class="logo-explosion-fact-badge" aria-hidden="true">?</span>
            <div><strong class="logo-explosion-fact-title">Le saviez-vous ?</strong><p class="logo-explosion-fact-text"></p></div>
            <button type="button" class="logo-explosion-fact-close" aria-label="Fermer le saviez-vous">&times;</button>
          </aside>
          <div id="logo-explosion-leave" class="logo-explosion-end d-none" role="dialog" aria-labelledby="logo-explosion-leave-title">
            <div class="logo-explosion-end-box">
              <strong id="logo-explosion-leave-title" class="logo-explosion-end-title">Quitter le jeu ?</strong>
              <p>Ouvrir la page du produit vous fera quitter la partie en cours. Vous pourrez y revenir quand vous voulez.</p>
              <div class="logo-explosion-end-actions">
                <a class="btn btn-primary" href="/shop/" data-leave-go>Voir le produit</a>
                <button type="button" class="btn btn-outline-secondary" data-leave-stay>Rester dans le jeu</button>
              </div>
            </div>
          </div>
          <?php if ( $spora_demo ) : ?>
          <div id="logo-explosion-end" class="logo-explosion-end d-none" role="dialog" aria-labelledby="logo-explosion-end-title">
            <div class="logo-explosion-end-box">
              <strong id="logo-explosion-end-title" class="logo-explosion-end-title">Démo terminée !</strong>
              <p>Le jeu est en développement : continuez pour découvrir d'autres variétés.</p>
              <div class="logo-explosion-end-actions">
                <a class="btn btn-primary" href="/shop/">Voir les produits</a>
                <button type="button" class="btn btn-outline-secondary" data-demo-continue>Continuer à jouer</button>
              </div>
            </div>
          </div>
          <?php endif; ?>
        </div>
        <h1 class="logo-explosion-tagline">Mycélium et substrats pour cultiver vos champignons</h1>
        <a class="btn btn-primary mt-3" href="/shop/">Visitez notre boutique!</a>
        <?php if ( $spora_tip_shelf ) : ?><div id="logo-explosion-shelf" class="logo-explosion-shelf"></div><?php endif; ?>
      </section>
      <div class="container pb-5">
        <section class="pt-5 mt-5">
          <h2 class="text-center h1">Sporacultus, culture de champignons</h2>
          <div class="row py-5 align-items-lg-center">
            <div class="col-12 col-lg-6">
              <p>
                Sporacultus est un projet dédié à la culture de champignons
                comestibles et à la valorisation des ressources naturelles locales.
                Nous produisons des substrats, du mycélium et des ensembles prêts à
                l’emploi pour les jardiniers et producteurs. Notre mission : rendre
                la myciculture accessible, durable et inspirante. Cultivez vos
                propres champignons, simplement et naturellement !
              </p>
            </div>
            <div class="col-12 col-lg-6">
              <img
                src="<?php echo get_template_directory_uri();?>/assets/img/banner-mushroom-autumn-1600.webp"
                srcset="<?php echo get_template_directory_uri();?>/assets/img/banner-mushroom-autumn-800.webp 800w, <?php echo get_template_directory_uri();?>/assets/img/banner-mushroom-autumn-1600.webp 1600w"
                sizes="(min-width: 992px) 50vw, 100vw"
                width="1600" height="588" loading="lazy" decoding="async"
                alt="Pleurote qui pousse dans les feuilles"
                class="img-fluid rounded-2"/>
            </div>
          </div>
        </section>
        <section class="py-5 my-5">
          <div class="text-center d-flex flex-column align-items-center">
            <h2 class="h1">Précommandez votre mycélium en vrac!</h2>
            <div class="row py-5">
              <div class="col-12 col-lg-6">
                <img
                  src="<?php echo get_template_directory_uri(); ?>/assets/img/pleurote-feuilles-2022-1600.webp"
                  srcset="<?php echo get_template_directory_uri(); ?>/assets/img/pleurote-feuilles-2022-800.webp 800w, <?php echo get_template_directory_uri(); ?>/assets/img/pleurote-feuilles-2022-1600.webp 1600w"
                  sizes="(min-width: 992px) 50vw, 100vw"
                  width="1600" height="1060" loading="lazy" decoding="async"
                  alt="Pleurotes en huître qui poussent dans un tas de feuilles"
                  class="img-fluid rounded-2"/>
                <p class="text-muted small mt-2 mb-0"><em>Pleurotus ostreatus</em> (pleurote en huître) · Photo prise en juin 2022</p>
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
          <h2 class="text-center pt-5 my-5 h1">Pour les producteurs</h2>
          <div
            class="row align-items-center justify-content-between px-lg-5 mx-lg-5 pb-5">
            <div class="col-md-5 col-12">
              <img
                class="img-fluid rounded-2"
                src="<?php echo get_template_directory_uri(); ?>/assets/img/GSM_Hotte-1600.webp"
                srcset="<?php echo get_template_directory_uri(); ?>/assets/img/GSM_Hotte-800.webp 800w, <?php echo get_template_directory_uri(); ?>/assets/img/GSM_Hotte-1600.webp 1600w"
                sizes="(min-width: 768px) 40vw, 100vw"
                width="1600" height="1060" loading="lazy" decoding="async"
                alt="Mycelium sur grain dans une hotte à flux laminaire"/>
            </div>
            <div class="col-md-5 col-12 text-md-end py-3">
              <img
                class="img-fluid d-none d-md-block rounded-2"
                src="<?php echo get_template_directory_uri(); ?>/assets/img/GSL-pack-crop-1600.webp"
                srcset="<?php echo get_template_directory_uri(); ?>/assets/img/GSL-pack-crop-800.webp 800w, <?php echo get_template_directory_uri(); ?>/assets/img/GSL-pack-crop-1600.webp 1600w"
                sizes="(min-width: 768px) 40vw, 100vw"
                width="1600" height="1060" loading="lazy" decoding="async"
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
                src="<?php echo get_template_directory_uri(); ?>/assets/img/jardin-1600.webp"
                srcset="<?php echo get_template_directory_uri(); ?>/assets/img/jardin-800.webp 800w, <?php echo get_template_directory_uri(); ?>/assets/img/jardin-1600.webp 1600w"
                sizes="(min-width: 992px) 66vw, 83vw"
                width="1600" height="1060" loading="lazy" decoding="async"
                alt="Rang d'épinard dans un jardin"/>
            </div>
          </div>
        </section>
      </div>
    </main>
    <?php get_footer(); ?>

  </body>
</html>
