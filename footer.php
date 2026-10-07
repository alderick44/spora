  <?php wp_footer(); ?>
      <footer class="border pt-5 bg-light">
      <div class="container pb-4">
        <div class="row justify-content-evenly">
          <div class="col-6 col-sm-4 col-md-3 pb-5">
            <h4 class="pb-3">Email</h4>
            <a href="mailto:info@sporacultus.ca?subject=Demande%20d'information">info@sporacultus.ca</a>
          </div>
          <div class="col-6 col-sm-4 col-md-3 pb-5">
            <h4 class="pb-3">Pages</h4>
            <div class="d-flex flex-column gap-4">
              <a href="/">Accueil</a>
              <a href="/shop">Boutique</a>
              <a href="/guides-et-conseils/">Guides et conseils</a>
              <a href="/a-propos/">À propos</a>
              <a href="/nous-joindre/">Nous joindre</a>
            </div>
          </div>
          <div class="col-6 col-sm-4 col-md-3">
            <h4 class="pb-3">Suivez-nous</h4>
            <div class="d-flex flex-column gap-4">
              <a href="https://www.facebook.com/profile.php?id=100077639986711" target="blank_">Facebook</a>
              <!-- <a href="">Instagram</a> -->
              <!-- <a href="index.html">Twitter</a> -->
            </div>
          </div>
          <div class="col-6 col-sm-4 col-md-3">
            <h4 class="pb-3">Produits</h4>
            <div class="d-flex flex-column gap-4">
              <a href="/product/mycelium-en-vrac/">Mycélium en vrac</a>
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
              src="<?php echo get_template_directory_uri();?>/assets/icons/logo-spora.svg"
              class="w-25"
              alt="logo sporacultus"
            />
          </div>
          <p class="mt-5 mb-0 small">★ 4,8 sur 5 · <a href="https://www.etsy.com/shop/Sporacultus#reviews" data-bs-toggle="modal" data-bs-target="#modal-avis-etsy">avis sur Etsy</a></p>
          <div class="mt-3">
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
    <div class="modal fade" id="modal-avis-etsy" tabindex="-1" aria-labelledby="modal-avis-etsy-titre" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h2 class="modal-title h5" id="modal-avis-etsy-titre">Revenez sur notre site pour vos commandes</h2>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fermer"></button>
          </div>
          <div class="modal-body">
            Revenez sur notre site quand vous serez prêt à commander. C'est là que vous aurez le meilleur service.
          </div>
          <div class="modal-footer">
            <a class="btn btn-primary" href="https://www.etsy.com/shop/Sporacultus#reviews" target="_blank" rel="noopener noreferrer">Voir les avis sur Etsy</a>
          </div>
        </div>
      </div>
    </div>
    <script src="<?php echo esc_url( get_theme_file_uri( 'assets/js/bootstrap.bundle.min.js' ) ); ?>?ver=5.3.8"></script>
</body>
</html>
