<?php
defined( 'ABSPATH' ) || exit;

do_action( 'woocommerce_before_mini_cart' );
?>

<?php // Le nonce est ici et non dans l'en-tête : ce bloc est rafraîchi par AJAX, donc jamais servi depuis le cache de page. L'enveloppe .widget_shopping_cart_content est dans header.php, comme le veut WooCommerce. ?>
<div class="mini-cart-body" data-qty-nonce="<?php echo esc_attr( wp_create_nonce( 'spora_mini_cart_qty' ) ); ?>">
  <?php if ( WC()->cart && ! WC()->cart->is_empty() ) : ?>
    <ul class="woocommerce-mini-cart cart_list product_list_widget <?php echo esc_attr( $args['list_class'] ); ?>">
      <?php
      do_action( 'woocommerce_before_mini_cart_contents' );

      foreach ( WC()->cart->get_cart() as $cart_item_key => $cart_item ) {
        $_product   = apply_filters( 'woocommerce_cart_item_product', $cart_item['data'], $cart_item, $cart_item_key );
        $product_id = apply_filters( 'woocommerce_cart_item_product_id', $cart_item['product_id'], $cart_item, $cart_item_key );

        if (
          ! $_product
          || ! $_product->exists()
          || $cart_item['quantity'] <= 0
          || ! apply_filters( 'woocommerce_widget_cart_item_visible', true, $cart_item, $cart_item_key )
        ) {
          continue;
        }

        $product_name      = apply_filters( 'woocommerce_cart_item_name', $_product->get_name(), $cart_item, $cart_item_key );
        $product_permalink = apply_filters( 'woocommerce_cart_item_permalink', $_product->is_visible() ? $_product->get_permalink( $cart_item ) : '', $cart_item, $cart_item_key );
        $thumbnail         = apply_filters(
          'woocommerce_cart_item_thumbnail',
          $_product->get_image( 'mini_cart_thumb', [
            'class' => 'basket-thumb rounded-2 object-fit-cover flex-shrink-0',
          ] ),
          $cart_item,
          $cart_item_key
        );
        $line_total = WC()->cart->get_product_subtotal( $_product, $cart_item['quantity'] );
        $remove_link = apply_filters(
          'woocommerce_cart_item_remove_link',
          sprintf(
            '<a role="button" href="%s" class="remove remove_from_cart_button btn btn-link p-0 text-danger text-decoration-none" aria-label="%s" data-product_id="%s" data-cart_item_key="%s" data-product_sku="%s">&times;</a>',
            esc_url( wc_get_cart_remove_url( $cart_item_key ) ),
            esc_attr( sprintf( __( 'Remove %s from cart', 'woocommerce' ), wp_strip_all_tags( $product_name ) ) ),
            esc_attr( $product_id ),
            esc_attr( $cart_item_key ),
            esc_attr( $_product->get_sku() )
          ),
          $cart_item_key
        );
        ?>
        <li class="woocommerce-mini-cart-item <?php echo esc_attr( apply_filters( 'woocommerce_mini_cart_item_class', 'mini_cart_item', $cart_item, $cart_item_key ) ); ?>">
          <div class="d-flex align-items-start gap-3 py-2 border-bottom">
            <?php if ( empty( $product_permalink ) ) : ?>
              <?php echo $thumbnail; ?>
            <?php else : ?>
              <a class="text-decoration-none" href="<?php echo esc_url( $product_permalink ); ?>">
                <?php echo $thumbnail; ?>
              </a>
            <?php endif; ?>
            <div class="flex-grow-1">
              <div class="fw-semibold">
                <?php if ( empty( $product_permalink ) ) : ?>
                  <?php echo wp_kses_post( $product_name ); ?>
                <?php else : ?>
                  <a class="text-reset text-decoration-none" href="<?php echo esc_url( $product_permalink ); ?>">
                    <?php echo wp_kses_post( $product_name ); ?>
                  </a>
                <?php endif; ?>
              </div>
              <?php
              $qty     = (int) $cart_item['quantity'];
              $max_qty = $_product->get_max_purchase_quantity(); // -1 = pas de limite
              ?>
              <div class="small text-muted d-flex align-items-center gap-1">
                <span aria-hidden="true">Qté</span>
                <button
                  type="button"
                  class="btn btn-link p-0 text-decoration-none mini-cart-qty-btn"
                  aria-label="Diminuer la quantité"
                  data-action="minus"
                  data-cart_item_key="<?php echo esc_attr( $cart_item_key ); ?>"
                >&#x25C0;&#xFE0E;</button>
                <input
                  type="number"
                  class="mini-cart-qty-input"
                  aria-label="Quantité"
                  value="<?php echo $qty; ?>"
                  min="0"
                  <?php if ( $max_qty > 0 ) : ?>max="<?php echo (int) $max_qty; ?>"<?php endif; ?>
                  step="1"
                  inputmode="numeric"
                  data-cart_item_key="<?php echo esc_attr( $cart_item_key ); ?>"
                >
                <button
                  type="button"
                  class="btn btn-link p-0 text-decoration-none mini-cart-qty-btn"
                  aria-label="Augmenter la quantité"
                  data-action="plus"
                  data-cart_item_key="<?php echo esc_attr( $cart_item_key ); ?>"
                  <?php disabled( $max_qty > 0 && $qty >= $max_qty ); ?>
                >&#x25B6;&#xFE0E;</button>
              </div>
              <?php echo wc_get_formatted_cart_item_data( $cart_item ); ?>
            </div>
            <div class="d-flex flex-column align-items-end gap-1">
              <?php echo $remove_link; ?>
              <div class="fw-semibold text-nowrap"><?php echo wp_kses_post( $line_total ); ?></div>
            </div>
          </div>
        </li>
      <?php
      }

      do_action( 'woocommerce_mini_cart_contents' );
      ?>
    </ul>
    <div class="d-flex align-items-center justify-content-between py-3 border-top">
      <span>Sous-total</span>
      <strong><?php echo wp_kses_post( WC()->cart->get_cart_subtotal() ); ?></strong>
    </div>

    <?php // Dans le gabarit et non dans header.php, pour disparaître avec le dernier article ?>
    <div class="d-grid gap-2 mt-3">
      <!-- <div>
        <label class="form-label mb-1" for="postal-code">Code postal</label>
        <input class="form-control" type="text" id="postal-code" name="postal-code" placeholder="H2X 1Y4" />
        <div class="small text-muted mt-1">Estimer la livraison</div>
      </div> -->

      <a class="btn btn-primary" href="<?php echo esc_url( wc_get_checkout_url() ); ?>">
        Passer à la caisse
      </a>
      <a class="button wc-forward btn btn-primary" href="<?php echo esc_url( wc_get_cart_url() ); ?>">
        <?php esc_html_e( 'View cart', 'woocommerce' ); ?>
      </a>
    </div>
  <?php else : ?>
    <p class="mini-cart-empty text-muted text-center my-3">Votre panier est vide.</p>
  <?php endif; ?>
</div>

<?php do_action( 'woocommerce_after_mini_cart' ); ?>
