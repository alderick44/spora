<?php

    add_action( 'wp_enqueue_scripts', 'spora_enqueue_styles');

    function spora_enqueue_styles() {
        wp_enqueue_style(
            'spora-normalize',
            get_theme_file_uri( 'normalize.css' ),
            wp_get_theme()->get( 'Version')
        );

        wp_enqueue_style(
            'spora-style',
            get_theme_file_uri( 'style.css' ),
            wp_get_theme()->get( 'Version')
        );
        
    
    }

?>