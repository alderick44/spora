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
        // get_theme_file_uri( 'assets/js/header-compact.js' ),
        get_theme_file_uri('assets/js/nav-compact.js'),
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
    add_theme_support( 'title-tag' );
    add_image_size( 'mini_cart_thumbnail', 64, 64, true );
    add_image_size('product', 900, 600, true);
} );

// Le titre du site dans Réglages > Général ("spora") n'a jamais été configuré ;
// on force donc un nom de marque propre dans le <title>, sans toucher à la DB.
add_filter( 'document_title_parts', function( $parts ) {
    if ( is_front_page() ) {
        // Sur l'accueil, WP utilise sinon le nom du site ("spora") comme titre ET comme suffixe.
        return [ 'title' => 'Sporacultus – Champignons de culture en extérieur, Québec' ];
    }
    // La page boutique s'appelle "Shop" en base : titre anglais et sans mot-clé
    // sur la page la plus commerciale du site. Google le remplaçait par le H1.
    if ( function_exists( 'is_shop' ) && is_shop() ) {
        $parts['title'] = 'Boutique — Mycélium, substrats et kits de culture';
    }
    $parts['site'] = 'Sporacultus';
    return $parts;
} );

// Meta description dynamique par page (le thème n'avait aucune balise meta description).
add_action( 'wp_head', 'spora_meta_description', 1 );
function spora_meta_description() {
    $description = '';

    if ( is_front_page() ) {
        $description = "Sporacultus cultive et vend des kits, mycélium et substrats pour la culture de champignons en extérieur au Québec — une approche écologique, simple et accessible à tous.";
    } elseif ( function_exists( 'is_shop' ) && is_shop() ) {
        $description = "La boutique Sporacultus : kits de culture, mycélium et substrats pour cultiver vos champignons chez vous, en extérieur.";
    } elseif ( is_singular( 'product' ) ) {
        global $post;
        $excerpt = has_excerpt( $post ) ? get_the_excerpt( $post ) : wp_strip_all_tags( $post->post_content );
        $description = wp_trim_words( $excerpt, 30, '…' );
    } elseif ( is_singular( 'page' ) ) {
        global $post;
        $excerpt = has_excerpt( $post ) ? get_the_excerpt( $post ) : wp_strip_all_tags( $post->post_content );
        // Les pages pas encore rédigées ("Contenu à venir.") sont trop courtes pour faire une bonne meta description.
        if ( mb_strlen( $excerpt ) >= 40 ) {
            $description = wp_trim_words( $excerpt, 30, '…' );
        }
    }

    if ( $description ) {
        printf( '<meta name="description" content="%s" />' . "\n", esc_attr( $description ) );
    }
}

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
