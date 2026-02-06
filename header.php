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
<body <?php body_class(); ?>>
    <div class="d-md-none p-5 bg-dark"></div>
    <div class="d-md-none p-5 bg-dark"></div>
    <div class="bg-dark py-5"></div>
    <header class="header py-md-3 py-3 z-3">
      <div class="container">
        <div class="row justify-content-between align-items-center">
          <div class="col-md-2 col-4">
            <a href="/">
              <img
                class="w-75 logo"
                src="<?php echo esc_url( get_theme_file_uri('assets/img/logo-transparent.png') ); ?>"
                alt="logo sporacultus"
              />
            </a>
          </div>
          <div class="col-md-10 col-8">
            <div class="header-nav d-flex align-items-center justify-content-end gap-3">
              <nav class="header-nav__lists">
                <ul
                  class="nav nav-underline justify-content-end flex-wrap gap-3 mb-1 small header-nav__utility"
                >
                  <li class="nav-item">
                    <a class="nav-link px-2" href="a-propos/index.html"
                      >À propos</a
                    >
                  </li>
                  <li class="nav-item">
                    <a
                      class="nav-link px-2"
                      href="guides-et-conseils/index.html"
                      >Guides et conseils</a
                    >
                  </li>
                  <li class="nav-item">
                    <a class="nav-link px-2" href="nous-joindre/index.html"
                      >Nous joindre</a
                    >
                  </li>
                </ul>
                <ul
                  class="nav nav-underline justify-content-end flex-wrap gap-3 fs-5 fw-semibold header-nav__main"
                >
                  <li class="nav-item">
                    <a class="nav-link px-2" href="producteurs/index.html"
                      >Pour les producteurs</a
                    >
                  </li>
                  <li class="nav-item">
                    <a class="nav-link px-2" href="/shop"
                      >Boutique</a
                    >
                  </li>
                  <li class="nav-item">
                    <a class="nav-link px-2" href="nos-champignons/index.html"
                      >Nos champignons</a
                    >
                  </li>
                </ul>
              </nav>
              <div class="dropdown basket-dropdown-wrap">
                <button
                  class="nav-link px-2 d-flex align-items-center position-relative"
                  type="button"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                  aria-label="Panier"
                  title="Panier"
                >
                  <svg
                    class="nav-icon"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <use href="assets/icons/icon-basket.svg#icon-basket"></use>
                  </svg>
                  <span
                    class="basket-badge badge rounded-pill bg-danger"
                    aria-label="2 articles dans le panier"
                  >
                    2
                  </span>
                </button>
                <div
                  class="dropdown-menu dropdown-menu-end basket-dropdown p-3 pt-5 position-relative border shadow rounded-4"
                >
                  <button
                    class="btn pt-2 border-0 bg-transparent position-absolute top-0 end-0 me-2 fs-2"
                    type="button"
                    aria-label="Fermer le panier"
                    data-bs-toggle="dropdown"
                  >
                    ×
                  </button>
                  <div
                    class="d-flex align-items-start gap-3 py-2 border-bottom"
                  >
                    <img
                      class="basket-thumb rounded-2 object-fit-cover flex-shrink-0"
                      src="assets/img/mycelium-en-vrac.png"
                      alt="Mycélium en vrac"
                    />
                    <div class="flex-grow-1">
                      <div class="fw-semibold">Mycélium en vrac</div>
                      <div class="small text-muted">Qté 2</div>
                    </div>
                    <div class="d-flex flex-column align-items-end gap-1">
                      <button
                        class="btn btn-link p-0 text-danger text-decoration-none"
                        type="button"
                      >
                        ×
                      </button>
                      <div class="fw-semibold text-nowrap">24,00 $</div>
                    </div>
                  </div>
                  <div class="d-flex align-items-start gap-3 py-2">
                    <img
                      class="basket-thumb rounded-2 object-fit-cover flex-shrink-0"
                      src="assets/img/GSL-pack.JPG"
                      alt="Ensemble débutant"
                    />
                    <div class="flex-grow-1">
                      <div class="fw-semibold">Ensemble débutant</div>
                      <div class="small text-muted">Qté 1</div>
                    </div>
                    <div class="d-flex flex-column align-items-end gap-1">
                      <button
                        class="btn btn-link p-0 text-danger text-decoration-none"
                        type="button"
                      >
                        ×
                      </button>
                      <div class="fw-semibold text-nowrap">39,00 $</div>
                    </div>
                  </div>
                  <div
                    class="d-flex align-items-center justify-content-between py-3 border-top"
                  >
                    <span>Sous-total</span>
                    <strong>63,00 $</strong>
                  </div>
                  <div class="d-grid gap-2">
                    <div>
                      <label class="form-label mb-1" for="postal-code">
                        Code postal
                      </label>
                      <input
                        class="form-control"
                        type="text"
                        id="postal-code"
                        name="postal-code"
                        placeholder="H2X 1Y4"
                      />
                      <div class="small text-muted mt-1">
                        Estimer la livraison
                      </div>
                    </div>
                    <button class="btn btn-primary" type="button">
                      Passer à la caisse
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
