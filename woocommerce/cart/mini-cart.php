<?php
defined( 'ABSPATH' ) || exit;

do_action( 'woocommerce_before_mini_cart' );
?>

<div class="widget_shopping_cart_content">
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
              <div class="small text-muted d-flex align-items-center gap-1">
                Qté <span class="mini-cart-qty-value"><?php echo (int) $cart_item['quantity']; ?></span>
                <button
                  type="button"
                  class="btn btn-link p-0 text-decoration-none mini-cart-qty-btn"
                  aria-label="Augmenter la quantité"
                  data-action="plus"
                  data-cart_item_key="<?php echo esc_attr( $cart_item_key ); ?>"
                >▲</button>
                <button
                  type="button"
                  class="btn btn-link p-0 text-decoration-none mini-cart-qty-btn"
                  aria-label="Diminuer la quantité"
                  data-action="minus"
                  data-cart_item_key="<?php echo esc_attr( $cart_item_key ); ?>"
                >▼</button>
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
  <?php endif; ?>
</div>

<?php do_action( 'woocommerce_after_mini_cart' ); ?>
