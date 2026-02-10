<?php
/**
 * The Template for displaying product archives, including the main shop page which is a post type archive
 *
 * This template can be overridden by copying it to yourtheme/woocommerce/archive-product.php.
 *
 * HOWEVER, on occasion WooCommerce will need to update template files and you
 * (the theme developer) will need to copy the new files to your theme to
 * maintain compatibility. We try to do this as little as possible, but it does
 * happen. When this occurs the version of the template file will be bumped and
 * the readme will list any important changes.
 *
 * @see https://woocommerce.com/document/template-structure/
 * @package WooCommerce\Templates
 * @version 8.6.0
 */

defined( 'ABSPATH' ) || exit;

get_header( 'shop' );

/**
 * Hook: woocommerce_before_main_content.
 *
 * @hooked woocommerce_output_content_wrapper - 10 (outputs opening divs for the content)
 * @hooked woocommerce_breadcrumb - 20
 * @hooked WC_Structured_Data::generate_website_data() - 30
 */
do_action( 'woocommerce_before_main_content' );

?>

<main class="bg-secondary">
	<div class="container">
		<section class="row flex-column justify-content-center align-items-center pt-2 pb-2 pe-0 ps-0">
			<div class="col-12">
				<h1 class="text-center py-3">Bienvenu sur notre boutique!</h1>
			</div>
			<div class="col-12">
				<h4 class="text-center pb-3">Promotions en cours et produits vedettes.</h4>
			</div>

			<?php
			$featured_products = function_exists( 'wc_get_products' )
				? wc_get_products(
					[
						'status'   => 'publish',
						'limit'    => 5,
						'featured' => true,
					]
				)
				: [];
			?>

			<?php if ( ! empty( $featured_products ) ) : ?>
				<div id="carousel-accueil" class="carousel slide col-sm-8 col-12" data-bs-ride="carousel">
					<div class="carousel-indicators">
						<?php foreach ( $featured_products as $index => $product ) : ?>
							<button
								type="button"
								data-bs-target="#carousel-accueil"
								data-bs-slide-to="<?php echo esc_attr( $index ); ?>"
								class="<?php echo 0 === $index ? 'active' : ''; ?>"
								<?php echo 0 === $index ? 'aria-current="true"' : ''; ?>
								aria-label="Slide <?php echo esc_attr( $index + 1 ); ?>"
							></button>
						<?php endforeach; ?>
					</div>
					<div class="carousel-inner">
						<?php foreach ( $featured_products as $index => $product ) : ?>
							<?php
							$short_description = wp_strip_all_tags( $product->get_short_description() );
							if ( '' === $short_description ) {
								$short_description = wp_strip_all_tags( $product->get_description() );
							}
							$product_link = $product->get_permalink();
							?>
							<div class="carousel-item <?php echo 0 === $index ? 'active' : ''; ?>" data-bs-interval="3000">
								<div class="card">
									<a href="<?php echo esc_url( $product_link ); ?>">
										<?php echo $product->get_image( 'large', [ 'class' => 'card-img-top' ] ); ?>
									</a>
									<div class="card-body">
										<h4 class="card-title mb-3">
											<a href="<?php echo esc_url( $product_link ); ?>">
												<?php echo esc_html( $product->get_name() ); ?>
											</a>
										</h4>
										<h6 class="card-subtitle mb-4"><?php echo wp_kses_post( $product->get_price_html() ); ?></h6>
										<p class="card-text mb-5"><?php echo esc_html( wp_trim_words( $short_description, 28 ) ); ?></p>
									</div>
								</div>
							</div>
						<?php endforeach; ?>
					</div>
					<button class="carousel-control-prev" type="button" data-bs-target="#carousel-accueil" data-bs-slide="prev">
						<span class="carousel-control-prev-icon" aria-hidden="true"></span>
						<span class="visually-hidden">Previous</span>
					</button>
					<button class="carousel-control-next" type="button" data-bs-target="#carousel-accueil" data-bs-slide="next">
						<span class="carousel-control-next-icon" aria-hidden="true"></span>
						<span class="visually-hidden">Next</span>
					</button>
				</div>
			<?php endif; ?>
		</section>

		<section class="py-5 my-5">
			<h1 class="text-center">Tout nos produits</h1>

			<?php
			if ( woocommerce_product_loop() ) {
				/**
				 * Hook: woocommerce_before_shop_loop.
				 *
				 * @hooked woocommerce_output_all_notices - 10
				 * @hooked woocommerce_result_count - 20
				 * @hooked woocommerce_catalog_ordering - 30
				 */
				// do_action( 'woocommerce_before_shop_loop' );

				if ( wc_get_loop_prop( 'total' ) ) {
					echo '<div class="row justify-content-center">';

					while ( have_posts() ) {
						the_post();

						/**
						 * Hook: woocommerce_shop_loop.
						 */
						do_action( 'woocommerce_shop_loop' );

						global $product;
						if ( ! $product ) {
							continue;
						}

						$short_description = wp_strip_all_tags( $product->get_short_description() );
						if ( '' === $short_description ) {
							$short_description = wp_strip_all_tags( $product->get_description() );
						}

						$product_link = get_permalink();
						?>
						<div class="card border-0 col-6 col-md-4 col-lg-3 bg-light">
							<a href="<?php echo esc_url( $product_link ); ?>" class="product-title">
								<?php echo $product->get_image( 'product', [ 'class' => 'card-img-top' ] ); ?>
							</a>
							<div class="card-body">
								<h4 class="card-title mb-3">
									<a href="<?php echo esc_url( $product_link ); ?>">
										<?php echo esc_html( $product->get_name() ); ?>
									</a>
								</h4>
								<h6 class="card-subtitle mb-4"><?php echo wp_kses_post( $product->get_price_html() ); ?></h6>
								<p class="card-text mb-5"><?php echo esc_html( wp_trim_words( $short_description, 28 ) ); ?></p>
								<?php woocommerce_template_loop_add_to_cart(); ?>
							</div>
						</div>
						<?php
					}

					echo '</div>';
				}

				/**
				 * Hook: woocommerce_after_shop_loop.
				 *
				 * @hooked woocommerce_pagination - 10
				 */
				do_action( 'woocommerce_after_shop_loop' );
			} else {
				/**
				 * Hook: woocommerce_no_products_found.
				 *
				 * @hooked wc_no_products_found - 10
				 */
				do_action( 'woocommerce_no_products_found' );
			}
			?>
		</section>

		<section class="bundles py-5 my-5">
                    <div class="text-center pt-5 my-5">
                        <h4>Nos ensembles</h4>
                        <h5>Combinez et économisez</h5>
                    </div>
                    <div class="row justify-content-between">
                        <div id="ensemble-gauche" class="col-xxl-6 col-12 pe-xxl-5 py-3 m-xxl-0 text-center text-xxl-start">
                            <div class="row">
                                <div class="col-12">
                                    <h5 class="p-3">Le jardinier</h5>
                                </div>
                                <div class="col-7 mx-auto mx-xxl-0">
                                    <img class="w-100 object-fit-contain bundles-img" src="<?php echo esc_url( get_template_directory_uri() . '/assets/img/mycelium-en-vrac-fructification.jpg' ); ?>" alt="Fructification de pleurote au sol à partir de copeaux de bois">
                                </div>
                                <div class="col-12">
                                    <p class="py-5" id="texte-gauche">Le jardinier regroupe tout le nécessaire pour lancer une culture de champignons directement au jardin. Il comprend du mycélium en vrac, des granules de bois francs, du son de blé et les instructions de préparation.
                                    Pensé pour les jardiniers curieux, cet ensemble favorise à la fois la production de champignons comestibles et l’enrichissement naturel du sol.</p>
                                </div>
                                <div class="d-xxl-none d-inline col-12">
									<button class="mb-5 btn btn-primary btn-panier ">
										<?php
										global $product;
										$prev = $product;
										$product = wc_get_product(126);
										if ($product) {
										wc_get_template('loop/add-to-cart.php');
										}
										$product = $prev;
										?>
									</button>
                                </div>
                                <div class="col-6 pe-1 ps-0">
                                    <img class="w-100 object-fit-contain bundles-img" src="<?php echo esc_url( get_template_directory_uri() . '/assets/img/hwfp-crop.png' ); ?>" alt="Granules de bois dure">
                                </div>
                                <div class="col-6 pe-xxl-5 pe-0 ps-0">
									<button class="mb-5 btn btn-primary btn-panier d-none d-xxl-inline">
										<?php
										global $product;

										$prev = $product;
										$product = wc_get_product(126);

										if ($product) {
										wc_get_template('loop/add-to-cart.php');
										}
										$product = $prev;
										?>
									</button>
                                    <img class="w-100 object-fit-contain bundles-img" src="<?php echo esc_url( get_template_directory_uri() . '/assets/img/mycelium-en-vrac.png' ); ?>" alt="Sac de mycelium en vrac">
                                </div>
                            </div>
                        </div>
                        <div  id="ensemble-droite" class="col-xxl-6 col-12 ps-xxl-5 py-3 text-center text-xxl-start">
                            <div class="row">
                                <div class="col-12">
                                    <h5 class="p-3 text-xxl-end">L’apprenti myciculteur</h5>
                                </div>
                                <div class="col-7 ms-xxl-auto mx-auto me-xxl-0">
                                    <img class="w-100 object-fit-contain bundles-img" src="<?php echo esc_url( get_template_directory_uri() . '/assets/img/pleurote-exterieur-automne.JPG' ); ?>" alt="Bloc de fructification à l'extérieur">
                                </div>
                                <div class="col-12">
                                    <p class="py-5 text-xxl-end" id="texte-droite">L’apprenti myciculteur est un ensemble d’initiation complet pour apprendre les bases de la myciculture à la maison.

                                    Il comprend tout le matériel nécessaire : culture liquide, mycélium sur grain, substrat et guide d’utilisation. Idéal pour comprendre chaque étape du cycle, de l’inoculation jusqu’à la fructification.</p>
                                </div>
                                <div class="col-12">
									<button class="mb-5 btn btn-primary btn-panier d-xxl-none d-inline">
										<?php
										global $product;
										$prev = $product;
										$product = wc_get_product(126);
										if ($product) {
										wc_get_template('loop/add-to-cart.php');
										}
										$product = $prev;
										?>
									</button>
                                </div>
                                <div class="col-6 ps-xxl-5 ps-0 pe-0 text-xxl-end">
									<button class="mb-5 btn btn-primary btn-panier d-none d-xxl-inline">
										<?php
										global $product;
										$prev = $product;
										$product = wc_get_product(126);
										if ($product) {
										wc_get_template('loop/add-to-cart.php');
										}
										$product = $prev;
										?>
									</button>
                                    <img class="w-100 object-fit-contain bundles-img" src="<?php echo esc_url( get_template_directory_uri() . '/assets/img/GSM_Hotte.JPG' ); ?>" alt="Mycelium sur grain dans une hotte à flux laminaire">
                                </div>
                                <div class="col-6 ps-1 pe-0 text-xxl-end">
                                    <img class="w-100 object-fit-contain bundles-img" src="<?php echo esc_url( get_template_directory_uri() . '/assets/img/GSL-pack.JPG' ); ?>" alt="Pack de 5 sacs mycelium sur grain">
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
		</div>
	</main>
<?php

/**
 * Hook: woocommerce_after_main_content.
 *
 * @hooked woocommerce_output_content_wrapper_end - 10 (outputs closing divs for the content)
 */
do_action( 'woocommerce_after_main_content' );

/**
 * Hook: woocommerce_sidebar.
 *
 * @hooked woocommerce_get_sidebar - 10
 */
do_action( 'woocommerce_sidebar' );

get_footer( 'shop' );
