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
                    <use href="<?php echo esc_url(get_theme_file_uri('assets/icons/icon-basket.svg#icon-basket'));?>"></use>
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
<?php
/**
 * Mini-cart
 *
 * Contains the markup for the mini-cart, used by the cart widget.
 *
 * This template can be overridden by copying it to yourtheme/woocommerce/cart/mini-cart.php.
 *
 * HOWEVER, on occasion WooCommerce will need to update template files and you
 * (the theme developer) will need to copy the new files to your theme to
 * maintain compatibility. We try to do this as little as possible, but it does
 * happen. When this occurs the version of the template file will be bumped and
 * the readme will list any important changes.
 *
 * @see     https://woocommerce.com/document/template-structure/
 * @package WooCommerce\Templates
 * @version 10.0.0
 */



defined( 'ABSPATH' ) || exit;

do_action( 'woocommerce_before_mini_cart' ); ?>

	<?php if ( WC()->cart && ! WC()->cart->is_empty() ) : ?>

		<ul class="woocommerce-mini-cart cart_list product_list_widget <?php echo esc_attr( $args['list_class'] ); ?>">
			<?php
			do_action( 'woocommerce_before_mini_cart_contents' );

			foreach ( WC()->cart->get_cart() as $cart_item_key => $cart_item ) {
				$_product   = apply_filters( 'woocommerce_cart_item_product', $cart_item['data'], $cart_item, $cart_item_key );
				$product_id = apply_filters( 'woocommerce_cart_item_product_id', $cart_item['product_id'], $cart_item, $cart_item_key );

				if ( $_product && $_product->exists() && $cart_item['quantity'] > 0 && apply_filters( 'woocommerce_widget_cart_item_visible', true, $cart_item, $cart_item_key ) ) {
					/**
					 * This filter is documented in woocommerce/templates/cart/cart.php.
					 *
					 * @since 2.1.0
					 */
					$product_name      = apply_filters( 'woocommerce_cart_item_name', $_product->get_name(), $cart_item, $cart_item_key );
					$thumbnail         = apply_filters( 'woocommerce_cart_item_thumbnail', $_product->get_image('mini_cart_thumbnail'), $cart_item, $cart_item_key );
					$product_price     = apply_filters( 'woocommerce_cart_item_price', WC()->cart->get_product_price( $_product ), $cart_item, $cart_item_key );
					$product_permalink = apply_filters( 'woocommerce_cart_item_permalink', $_product->is_visible() ? $_product->get_permalink( $cart_item ) : '', $cart_item, $cart_item_key );
					?>

					<li class="woocommerce-mini-cart-item <?php echo esc_attr( apply_filters( 'woocommerce_mini_cart_item_class', 'mini_cart_item', $cart_item, $cart_item_key ) ); ?>">
						<div>
							<?php if ( empty( $product_permalink ) ) : ?>
								<?php echo $thumbnail . wp_kses_post( $product_name ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
							<?php else : ?>
								<a href="<?php echo esc_url( $product_permalink ); ?>">
									<?php echo $thumbnail . wp_kses_post( $product_name ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
								</a>
							<?php endif; ?>
						</div>
						


						<?php echo wc_get_formatted_cart_item_data( $cart_item ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
						<?php echo apply_filters( 'woocommerce_widget_cart_item_quantity', '<span class="quantity">'. sprintf( '%s &times; %s', $cart_item['quantity'], $product_price ) . '</span>', $cart_item, $cart_item_key ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
						

						<?php
						echo apply_filters( // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
							'woocommerce_cart_item_remove_link',
							sprintf(
								'<a role="button" href="%s" class="remove remove_from_cart_button" aria-label="%s" data-product_id="%s" data-cart_item_key="%s" data-product_sku="%s" data-success_message="%s">&times;</a>',
								esc_url( wc_get_cart_remove_url( $cart_item_key ) ),
								/* translators: %s is the product name */
								esc_attr( sprintf( __( 'Remove %s from cart', 'woocommerce' ), wp_strip_all_tags( $product_name ) ) ),
								esc_attr( $product_id ),
								esc_attr( $cart_item_key ),
								esc_attr( $_product->get_sku() ),
								/* translators: %s is the product name */
								esc_attr( sprintf( __( '&ldquo;%s&rdquo; has been removed from your cart', 'woocommerce' ), wp_strip_all_tags( $product_name ) ) )
							),
							$cart_item_key
						);
						?>

						
					</li>

					<?php


				}
			}

			do_action( 'woocommerce_mini_cart_contents' );
			?>
		</ul>

		<p class="woocommerce-mini-cart__total total">
			<?php
			/**
			 * Hook: woocommerce_widget_shopping_cart_total.
			 *
			 * @hooked woocommerce_widget_shopping_cart_subtotal - 10
			 */
			do_action( 'woocommerce_widget_shopping_cart_total' );
			?>
		</p>

		<?php do_action( 'woocommerce_widget_shopping_cart_before_buttons' ); ?>

		<p class="woocommerce-mini-cart__buttons buttons"><?php do_action( 'woocommerce_widget_shopping_cart_buttons' ); ?></p>

		<?php do_action( 'woocommerce_widget_shopping_cart_after_buttons' ); ?>

	<?php else : ?>


	<?php endif; ?>

	<?php do_action( 'woocommerce_after_mini_cart' ); ?>

</div>












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
                    <use href="<?php echo esc_url(get_theme_file_uri('assets/icons/icon-basket.svg#icon-basket'));?>"></use>
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


			  