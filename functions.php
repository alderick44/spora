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
    if ( ! check_ajax_referer( 'spora_mini_cart_qty', 'nonce', false ) ) {
        wp_send_json_error( [ 'message' => 'Invalid nonce' ], 403 );
    }

    if ( ! class_exists( 'WooCommerce' ) || ! WC()->cart ) {
        wp_send_json_error( [ 'message' => 'Cart not available' ] );
    }

    $cart_item_key = isset( $_POST['cart_item_key'] ) ? sanitize_text_field( wp_unslash( $_POST['cart_item_key'] ) ) : '';
    $action        = isset( $_POST['action_type'] ) ? sanitize_text_field( wp_unslash( $_POST['action_type'] ) ) : '';

    if ( ! in_array( $action, [ 'plus', 'minus', 'set' ], true ) ) {
        wp_send_json_error( [ 'message' => 'Invalid action' ] );
    }

    $cart_item = WC()->cart->get_cart_item( $cart_item_key );
    if ( ! $cart_item_key || ! $cart_item ) {
        wp_send_json_error( [ 'message' => 'Invalid cart item' ] );
    }

    $current_qty = (int) $cart_item['quantity'];
    $max_qty     = $cart_item['data']->get_max_purchase_quantity(); // -1 = pas de limite

    if ( $action === 'set' ) {
        // Quantité tapée à la main : on la ramène au stock disponible plutôt que de la refuser
        $new_qty = isset( $_POST['quantity'] ) ? max( 0, absint( $_POST['quantity'] ) ) : $current_qty;
        if ( $max_qty > 0 ) {
            $new_qty = min( $new_qty, $max_qty );
        }
    } else {
        $new_qty = $action === 'plus' ? $current_qty + 1 : $current_qty - 1;
        if ( $max_qty > 0 && $new_qty > $max_qty ) {
            wp_send_json_error( [ 'message' => 'Max quantity reached' ] );
        }
    }

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

// ============================================================
// Détection de langue à la première visite (français par défaut).
// ============================================================

// Un robot reçoit toujours l'adresse qu'il demande : jamais de redirection ni de cookie pour lui.
function spora_is_bot() {
    $ua = isset( $_SERVER['HTTP_USER_AGENT'] ) ? strtolower( $_SERVER['HTTP_USER_AGENT'] ) : '';
    if ( $ua === '' ) {
        return true;
    }
    foreach ( [ 'bot', 'spider', 'crawl', 'slurp', 'facebookexternalhit', 'headless' ] as $signature ) {
        if ( strpos( $ua, $signature ) !== false ) {
            return true;
        }
    }
    return false;
}

// Règle d'Alderick : du français n'importe où dans l'en-tête Accept-Language -> français.
// Seulement de l'anglais -> anglais. Ni l'un ni l'autre -> français.
function spora_detect_lang_from_accept_header() {
    $header = isset( $_SERVER['HTTP_ACCEPT_LANGUAGE'] ) ? $_SERVER['HTTP_ACCEPT_LANGUAGE'] : '';
    if ( ! $header ) {
        return 'fr';
    }
    $has_en = false;
    foreach ( explode( ',', $header ) as $part ) {
        $lang = strtolower( trim( explode( ';', $part )[0] ) );
        if ( strpos( $lang, 'fr' ) === 0 ) {
            return 'fr';
        }
        if ( strpos( $lang, 'en' ) === 0 ) {
            $has_en = true;
        }
    }
    return $has_en ? 'en' : 'fr';
}

// Code de langue TranslatePress pour l'anglais (ex. 'en_US'), déduit des réglages plutôt que codé en dur.
function spora_get_english_trp_code() {
    $settings = get_option( 'trp_settings' );
    if ( ! empty( $settings['publish-languages'] ) && ! empty( $settings['default-language'] ) ) {
        foreach ( $settings['publish-languages'] as $code ) {
            if ( $code !== $settings['default-language'] ) {
                return $code;
            }
        }
    }
    return 'en_US';
}

// Code de langue TranslatePress pour le français (langue par défaut).
function spora_get_french_trp_code() {
    $settings = get_option( 'trp_settings' );
    return ! empty( $settings['default-language'] ) ? $settings['default-language'] : 'fr_CA';
}

// true si la page courante est affichée en anglais.
function spora_is_english() {
    global $TRP_LANGUAGE;
    return $TRP_LANGUAGE === spora_get_english_trp_code();
}

// Décide la langue voulue quand l'URL ne porte aucun préfixe de langue (nos pages françaises, sans /en/).
// N'agit qu'à la première visite : une fois le cookie posé (détection ou choix manuel), on ne redétecte plus.
// Note technique : TranslatePress 3.3.6 utilise son nouveau sélecteur "V2", dont la logique de décision
// de langue est privée et ne passe pas par un filtre WordPress classique (contrairement à l'ancien
// sélecteur, qui exposait 'trp_needed_language'). On se branche donc sur 'after_setup_theme' (le hook
// 'plugins_loaded' a déjà été déclenché avant que functions.php ne soit chargé — s'y accrocher depuis
// un thème ne sert à rien, le callback ne serait jamais appelé), une fois que TranslatePress (un plugin,
// donc chargé et initialisé avant le thème) a déjà résolu la langue à partir de l'URL.
add_action( 'after_setup_theme', function() {
    if ( spora_is_bot() || ! class_exists( 'TRP_Translate_Press' ) ) {
        return;
    }
    $trp = TRP_Translate_Press::get_trp_instance();
    if ( ! $trp ) {
        return;
    }
    $url_converter = $trp->get_component( 'url_converter' );
    if ( ! $url_converter || $url_converter->get_lang_from_url_string() !== null ) {
        return; // une adresse avec un préfixe de langue explicite (/en/...) n'est jamais réinterprétée
    }

    // Un clic sur notre propre sélecteur FR/EN (ou tout lien interne) amène forcément sur une
    // adresse sans préfixe quand la cible est le français (langue par défaut, sans /fr/). Il ne faut
    // alors jamais retomber sur le cookie mémorisé : ce serait annuler le clic du visiteur.
    $referer_host = ! empty( $_SERVER['HTTP_REFERER'] ) ? wp_parse_url( $_SERVER['HTTP_REFERER'], PHP_URL_HOST ) : '';
    $is_internal_navigation = $referer_host && $referer_host === ( $_SERVER['HTTP_HOST'] ?? '' );
    if ( $is_internal_navigation ) {
        return;
    }

    if ( isset( $_COOKIE['spora_lang'] ) ) {
        $wanted = $_COOKIE['spora_lang'];
    } else {
        $wanted = spora_detect_lang_from_accept_header();
        if ( ! headers_sent() ) {
            setcookie( 'spora_lang', $wanted, time() + YEAR_IN_SECONDS, '/', '', is_ssl(), true );
        }
    }

    if ( $wanted !== 'en' ) {
        return; // français = comportement par défaut de TranslatePress, rien à faire
    }

    $en_code = spora_get_english_trp_code();
    add_action( 'template_redirect', function() use ( $url_converter, $en_code ) {
        wp_safe_redirect( $url_converter->get_url_for_language( $en_code, null, '' ), 302 );
        exit;
    }, 5 );
} );

// Le choix courant (détecté ci-dessus, ou choisi à la main via le sélecteur) reste mémorisé
// pour les visites suivantes, même en changeant de page.
add_action( 'template_redirect', function() {
    if ( is_admin() || spora_is_bot() ) {
        return;
    }
    global $TRP_LANGUAGE;
    if ( empty( $TRP_LANGUAGE ) ) {
        return;
    }
    $current = ( $TRP_LANGUAGE === spora_get_english_trp_code() ) ? 'en' : 'fr';
    if ( ! headers_sent() && ( ! isset( $_COOKIE['spora_lang'] ) || $_COOKIE['spora_lang'] !== $current ) ) {
        setcookie( 'spora_lang', $current, time() + YEAR_IN_SECONDS, '/', '', is_ssl(), true );
    }
} );

?>
