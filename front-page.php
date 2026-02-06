<?php get_header(); ?>
    <main class="bg-secondary">
      <section class="hero-viewport z-0">
        <div class="position-relative">
          <img
            class="w-100 h-100 object-fit-cover object-position-center hero-pan"
            src="<?php echo get_template_directory_uri();?>/assets/img/banner-mushroom-autumn.jpg"
            alt="Pleurote qui pousse dans les feuilles"
          />
          <div
            class="position-absolute top-50 start-50 translate-middle z-1 w-100"
          >
            <div class="container">
              <h1 class="text-start text-light banner__text m-0 p-3">
                Découvrir Sporacultus
              </h1>
            </div>
          </div>
        </div>
      </section>
      <div class="container pb-5">
        <section class="pt-5 mt-5">
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
                  src="assets/img/mycelium-en-vrac.png"
                  alt="Sac de mycelium en vrac"
                  class="img-fluid"
                />
              </div>
              <div class="col-12 col-lg-6">
                <div
                  class="d-flex flex-column justify-content-between h-100 p-3 p-lg-0"
                >
                  <p class="text-lg-start py-3 py-lg-0">
                    Notre mycélium en vrac est conçu pour ceux qui veulent faire
                    pousser leurs propres champignons sans équipement
                    spécialisé. Il suffit de l’étendre dans un milieu riche en
                    copeaux de bois ou en matières organiques, puis de maintenir
                    l’humidité — le mycélium fera le reste ! 🍄 Une fois la
                    fructification terminée, le substrat enrichi continue d’agir
                    : il améliore la structure du sol, stimule la vie
                    microbienne et transforme la matière ligneuse en nutriments
                    durables. Simple, naturel et polyvalent — faites pousser,
                    récoltez, puis nourrissez votre jardin.
                  </p>
                  <div>
                    <a class="btn btn-primary w-50" href="index.html"
                      >Précommander</a
                    >
                  </div>
                </div>
              </div>
            </div>
            <h4>Distribution à partir de mai 2026!</h4>
          </div>
        </section>
        <section class="pb-5">
          <h1 class="text-center pt-5 my-5">Pour les producteurs</h1>
          <div
            class="row align-items-center justify-content-between px-lg-5 mx-lg-5 pb-5"
          >
            <div class="col-md-5 col-12">
              <img
                class="img-fluid"
                src="assets/img/GSM_Hotte.JPG"
                alt="Mycelium sur grain dans une hotte à flux laminaire"
              />
            </div>
            <div class="col-md-5 col-12 text-md-end py-3">
              <img
                class="img-fluid d-none d-md-block"
                src="assets/img/GSL-pack-crop.jpg"
                alt="Pack de 5 sacs de mycelium sur grain"
              />
            </div>
            <div class="col-12 py-4 text-center">
              <h6 class="py-4">
                Mycélium fiable et performant, adapté aux besoins des
                producteurs professionnels.
              </h6>
              <a class="btn btn-primary" href="index.html">En savoir plus</a>
            </div>
            <div class="col-10 col-lg-8 pt-md-5 mx-auto">
              <img
                class="img-fluid"
                src="assets/img/jardin.JPG"
                alt="Rang d'épinard dans un jardin"
              />
            </div>
          </div>
        </section>
      </div>
    </main>
    <footer class="border pt-5 bg-light">
      <div class="container pb-4">
        <div class="row justify-content-evenly">
          <div class="col-6 col-sm-4 col-md-3 pb-5">
            <h4 class="pb-3">Email</h4>
            <a href="index.html">info@sporacultus.ca</a>
          </div>
          <div class="col-6 col-sm-4 col-md-3 pb-5">
            <h4 class="pb-3">Pages</h4>
            <div class="d-flex flex-column gap-4">
              <a href="index.html">Accueil</a>
              <a href="boutique.html">Boutique</a>
            </div>
          </div>
          <div class="col-6 col-sm-4 col-md-3">
            <h4 class="pb-3">Suivez-nous</h4>
            <div class="d-flex flex-column gap-4">
              <a href="index.html">Facebook</a>
              <a href="index.html">Instagram</a>
              <a href="index.html">Twitter</a>
            </div>
          </div>
          <div class="col-6 col-sm-4 col-md-3">
            <h4 class="pb-3">Produits</h4>
            <div class="d-flex flex-column gap-4">
              <a href="mycelium-en-vrac.html">Mycélium en vrac</a>
            </div>
          </div>
          <div class="col-6 col-sm-4 col-md-3">
            <!--Vide-->
          </div>
          <div class="col-6 col-sm-4 col-md-3">
            <!--Vide-->
          </div>
        </div>
        <div class="d-flex flex-column text-center pt-5 mt-5">
          <div>
            <img
              src="assets/img/logo-transparent.png"
              class="w-25"
              alt="logo sporacultus"
            />
          </div>
          <div class="mt-5">
            <p>© 2026 Sporacultus. Tous droits réservés.</p>
          </div>
        </div>
        <!-- <div class="d-flex w-100 text-center justify-content-center">
                    <nav class="row g-4 m-2 w-50">
                        <a href="index.html" class="col-6 col-md-3"><img class="w-50 logo"
                                src="https://upload.wikimedia.org/wikipedia/commons/b/b9/2023_Facebook_icon.svg"
                                alt="logo facebook"></a>
                        <a href="index.html" class="col-6 col-md-3"><img class="w-50 logo"
                                src="https://cdn.freebiesupply.com/logos/large/2x/linkedin-icon-logo-png-transparent.png"
                                alt="logo linkedin"></a>
                        <a href="index.html" class="col-6 col-md-3"><img class="w-50 logo"
                                src="https://upload.wikimedia.org/wikipedia/commons/6/6f/Logo_of_Twitter.svg"
                                alt="logo twitter"></a>
                        <a href="index.html" class="col-6 col-md-3"><img class="w-50 logo"
                                src="https://upload.wikimedia.org/wikipedia/commons/e/e7/Instagram_logo_2016.svg"
                                alt="logo instagram"></a>
                    </nav>
                </div> -->
      </div>
      <div class="pt-5 bg-dark"></div>
    </footer>
    <?php get_footer(); ?>

    <script
      src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js"
      integrity="sha384-FKyoEForCGlyvwx9Hj09JcYn3nv7wiPVlz7YYwJrWVcXK/BmnVDxM+D2scQbITxI"
      crossorigin="anonymous"
    ></script>
    <script src="scripts/index.js"></script>
  </body>
</html>
