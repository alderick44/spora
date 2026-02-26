<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sporacultus</title>
  <link
      href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css"
      rel="stylesheet"
      integrity="sha384-sRIl4kxILFvY47J16cr9ZwB07vP4J8+LH7qKQnuqkuIAvNWLzeN8tE5YBujZqJLB"
      crossorigin="anonymous"
  />
  <?php wp_head(); ?>
</head>
<body <?php body_class();?>>
    <!-- <div class="d-md-none p-5 bg-dark-subtle"></div>
    <div class="d-md-none p-5 bg-dark-subtle"></div>  -->
    <div class="bg-dark-subtle py-5"></div>
    <header class="header py-md-3 py-3 z-3">
      <div class="container">
        <div class="row justify-content-between align-items-center">
          <div class="col-md-2 col-4 d-none d-md-block">
            <a href="/">
              <img
                class="w-75 logo d-none d-md-block"
                src="<?php echo esc_url( get_theme_file_uri('assets/icons/logo-spora.svg') ); ?>"
                alt="logo sporacultus"
              />
            </a>
          </div>
          <div class="col-6 d-block d-md-none d-flex justify-content-start">
            <a href="/">
              <img
                class="w-100 logo"
                src="<?php echo esc_url( get_theme_file_uri('assets/icons/logo-spora.svg') ); ?>"
                alt="logo sporacultus"
              />
            </a>
          </div>
          <div class="col-6 dropdown basket-dropdown-wrap d-flex justify-content-end d-sm-none gap-4">
            <button
              class="nav-link px-2 d-flex align-items-center position-relative"
              type="button"
              data-bs-toggle="dropdown"
              aria-expanded="false"
              aria-label="Panier"
              title="Panier"
              data-bs-auto-close="outside"
            >
              <svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
                <use href="<?php echo esc_url( get_theme_file_uri('assets/icons/icon-basket.svg#icon-basket') ); ?>"></use>
              </svg>

              <span class="basket-badge badge rounded-pill bg-danger">
                <?php echo WC()->cart ? (int) WC()->cart->get_cart_contents_count() : 0; ?>
              </span>
            </button>

            <div class="dropdown-menu dropdown-menu-end basket-dropdown p-3 pt-5 position-relative border shadow rounded-4">
              
              <?php woocommerce_mini_cart(); ?>

              <div class="d-grid gap-2 mt-3">
                <div>
                  <label class="form-label mb-1" for="postal-code">Code postal</label>
                  <input class="form-control" type="text" id="postal-code" name="postal-code" placeholder="H2X 1Y4" />
                  <div class="small text-muted mt-1">Estimer la livraison</div>
                </div>

                <a class="btn btn-primary" href="<?php echo esc_url( wc_get_checkout_url() ); ?>">
                  Passer à la caisse
                </a>
                <a class="button wc-forward btn btn-primary" href="<?php echo esc_url( wc_get_cart_url() ); ?>">
                  <?php esc_html_e( 'View cart', 'woocommerce' ); ?>
                </a>
              </div>
            </div>


            <!-- Bouton menu mobile -->
            <button
              id="mobile-menu-toggle"
              class="btn btn-link px-2 d-flex align-items-center"
              type="button"
              aria-controls="headerMenu"
              aria-expanded="false"
              aria-label="Ouvrir le menu"
              title="Menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>


          <div class="col-md-10 col-12">
            <div class="header-nav d-flex align-items-center justify-content-between justify-content-md-end gap-3">
              <nav class="header-nav__lists" id="headerMenu">
                <ul class="nav nav-underline flex-wrap gap-3 mb-1 small header-nav__utility d-none d-md-flex">
                  <li class="nav-item">
                    <a class="nav-link px-2" href="/a-propos/"
                      >À propos</a
                    >
                  </li>
                  <li class="nav-item">
                    <a
                      class="nav-link px-2"
                      href="/guides-et-conseils"
                      >Guides et conseils</a
                    >
                  </li>
                  <li class="nav-item">
                    <a class="nav-link px-2" href="/nous-joindre/"
                      >Nous joindre</a
                    >
                  </li>
                </ul>
                <ul class="nav nav-underline flex-wrap gap-3 fs-5 fw-semibold header-nav__main justify-content-start d-grid d-md-flex">
                  <li class="nav-item">
                    <a class="nav-link px-2 pt-3 pt-sm-0" href="/producteurs/"
                      >Pour les producteurs
                    </a>
                  </li>
                  <li class="nav-item">
                    <a class="nav-link px-2" href="/shop/"
                      >Boutique</a
                    >
                  </li>
                  <li class="nav-item">
                    <a class="nav-link px-2" href="/nos-champignons/"
                      >Nos champignons</a
                    >
                  </li>
                </ul>
              </nav>



              <div class="dropdown basket-dropdown-wrap d-none d-sm-block">
                <button
                  class="nav-link px-2 d-flex align-items-center position-relative"
                  type="button"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                  aria-label="Panier"
                  title="Panier"
                  data-bs-auto-close="outside"
                >
                  <svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
                    <use href="<?php echo esc_url( get_theme_file_uri('assets/icons/icon-basket.svg#icon-basket') ); ?>"></use>
                  </svg>

                  <span class="basket-badge badge rounded-pill bg-danger">
                    <?php echo WC()->cart ? (int) WC()->cart->get_cart_contents_count() : 0; ?>
                  </span>
                </button>

                <div class="dropdown-menu dropdown-menu-end basket-dropdown p-3 pt-5 position-relative border shadow rounded-4">
                  
                  <?php woocommerce_mini_cart(); ?>

                  <div class="d-grid gap-2 mt-3">
                    <div>
                      <label class="form-label mb-1" for="postal-code">Code postal</label>
                      <input class="form-control" type="text" id="postal-code" name="postal-code" placeholder="H2X 1Y4" />
                      <div class="small text-muted mt-1">Estimer la livraison</div>
                    </div>

                    <a class="btn btn-primary" href="<?php echo esc_url( wc_get_checkout_url() ); ?>">
                      Passer à la caisse
                    </a>
                    <a class="button wc-forward btn btn-primary" href="<?php echo esc_url( wc_get_cart_url() ); ?>">
                      <?php esc_html_e( 'View cart', 'woocommerce' ); ?>
                    </a>
                  </div>
                </div>
              </div>


            </div>
          </div>
        </div>
      </div>
    </header>
<div id="compact-sentinel" aria-hidden="true"></div>