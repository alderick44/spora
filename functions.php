<?php

add_action( 'wp_enqueue_scripts', 'spora_enqueue_styles' );
add_action('wp_enqueue_scripts', 'spora_enqueue_scripts');


add_filter('woocommerce_enqueue_styles', function ($styles) {
    if (is_shop()) {
        return false;
    }
    return $styles;
}, 100);

function spora_enqueue_scripts() {
    wp_enqueue_script(
        'spora-header-compact',
        get_theme_file_uri( 'assets/js/header-compact.js' ),
        [],
        wp_get_theme()->get( 'Version' ),
        true
    );
}

function spora_enqueue_styles() {
    wp_enqueue_style(
        'spora-normalize',
        get_theme_file_uri( 'normalize.css' ),
        [],
        wp_get_theme()->get( 'Version' )
    );

    wp_enqueue_style(
        'spora-style',
        get_theme_file_uri( 'style.css' ),
        [ 'spora-normalize'],
        wp_get_theme()->get( 'Version' )
    );
}

add_action( 'after_setup_theme', function() {
    add_theme_support( 'woocommerce' );
    add_theme_support( 'post-thumbnails' );
    add_image_size( 'mini_cart_thumbnail', 64, 64, true );
    add_image_size('product', 900, 600, true);
} );

add_action( 'wp_enqueue_scripts', function() {
    if ( ! class_exists( 'WooCommerce' ) ) {
        return;
    }


    wp_enqueue_script( 'wc-cart-fragments' );
    if ( function_exists( 'is_shop' ) && function_exists( 'is_product_taxonomy' ) ) {
        if ( is_shop() || is_product_taxonomy() ) {
            wp_enqueue_script(
                'spora-shop-ensembles',
                get_theme_file_uri( 'assets/js/shop-ensembles.js' ),
                [],
                wp_get_theme()->get( 'Version' ),
                true
            );
        }
    }
    wp_enqueue_script(
        'spora-mini-cart-qty',
        get_theme_file_uri( 'assets/js/mini-cart-qty.js' ),
        [ 'wc-cart-fragments' ],
        wp_get_theme()->get( 'Version' ),
        true
    );
    wp_localize_script( 'spora-mini-cart-qty', 'sporaMiniCart', [
        'ajaxUrl' => admin_url( 'admin-ajax.php' ),
    ] );
}, 20 );

add_filter( 'woocommerce_add_to_cart_fragments', function( $fragments ) {
    ob_start();
    ?>
    <span class="basket-badge badge rounded-pill bg-danger">
        <?php echo WC()->cart ? (int) WC()->cart->get_cart_contents_count() : 0; ?>
    </span>
    <?php
    $fragments['.basket-badge'] = ob_get_clean();
    return $fragments;
} );


add_action( 'wp_ajax_spora_update_mini_cart_qty', 'spora_update_mini_cart_qty' );
add_action( 'wp_ajax_nopriv_spora_update_mini_cart_qty', 'spora_update_mini_cart_qty' );

function spora_update_mini_cart_qty() {
    if ( ! class_exists( 'WooCommerce' ) || ! WC()->cart ) {
        wp_send_json_error( [ 'message' => 'Cart not available' ] );
    }

    $cart_item_key = isset( $_POST['cart_item_key'] ) ? sanitize_text_field( wp_unslash( $_POST['cart_item_key'] ) ) : '';
    $action        = isset( $_POST['action_type'] ) ? sanitize_text_field( wp_unslash( $_POST['action_type'] ) ) : '';

    if ( ! $cart_item_key || ! isset( WC()->cart->cart_contents[ $cart_item_key ] ) ) {
        wp_send_json_error( [ 'message' => 'Invalid cart item' ] );
    }

    $current_qty = (int) WC()->cart->cart_contents[ $cart_item_key ]['quantity'];
    $new_qty     = $action === 'plus' ? $current_qty + 1 : $current_qty - 1;

    if ( $new_qty <= 0 ) {
        WC()->cart->remove_cart_item( $cart_item_key );
    } else {
        WC()->cart->set_quantity( $cart_item_key, $new_qty, true );
    }


    WC_AJAX::get_refreshed_fragments();
}

add_filter('woocommerce_loop_add_to_cart_args', function( $args, $product ) {
    $extra = ' btn btn-primary';
    $args['class'] = isset($args['class']) ? $args['class'] . $extra : trim($extra);
    return $args;
}, 10, 2);



?>