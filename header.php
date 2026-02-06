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

              <?php woocommerce_mini_cart(); ?>

            </div>
          </div>
        </div>
      </div>
    </header>
