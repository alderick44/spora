# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is "Spora", a WordPress theme for Sporacultus (sporacultus.ca), a French-language e-commerce site selling mushroom-cultivation products (mycelium, substrates, grow kits) via WooCommerce. There is no JS/PHP build system — the theme is plain PHP templates, hand-written CSS, and small vanilla-JS files served directly by WordPress. There is no `package.json`, `composer.json`, or test suite in this repo.

## Deployment

`.vscode/sftp.json` (gitignored, not committed) is configured with `uploadOnSave: true`, pointing directly at the production host's theme directory. There is no staging environment or CI in this repo — saving a file in an editor with this extension pushes it live immediately. Be deliberate about what you write to disk.

## Frontend stack

- Bootstrap 5.3.8 (CSS + JS bundle) is loaded from jsDelivr CDN in `header.php`/`footer.php` — it is not installed as a dependency or bundled.
- jQuery is available via WordPress/WooCommerce's own enqueued scripts (used for `wc_fragment_refresh` and `added_to_cart` events).
- Custom JS in `assets/js/` is vanilla, unbundled, and enqueued individually in `functions.php` via `wp_enqueue_script`.
- Icons are inline SVG sprites referenced with `<use href="...svg#id">` (see `assets/icons/`).

## Architecture

**Template entry points** (standard WP template hierarchy): `index.php`, `front-page.php` (homepage), `page.php`, `page-shop.php` (custom WooCommerce shop page template, selected via `Template Name: Shop (custom)`), `page-coming-soon.php`, `single-product.php` (WooCommerce single-product override — carousel gallery + add-to-cart). `header.php` and `footer.php` wrap all pages and contain the nav, mobile menu, and the mini-cart dropdown markup.

**`functions.php`** is the central hook/glue file:
- Enqueues `normalize.css` and `style.css`, and the custom JS files (`nav-compact.js`, `shop-ensembles.js`, `mini-cart-qty.js`).
- Disables WooCommerce's default stylesheet on shop pages (`woocommerce_enqueue_styles` filter) since the theme uses Bootstrap + `style.css` instead.
- Implements the AJAX endpoint `spora_update_mini_cart_qty` (wired via `wp_ajax_*`/`wp_ajax_nopriv_*`) for +/- quantity changes in the mini-cart, called from `assets/js/mini-cart-qty.js`.
- Adds the `.basket-badge` cart-count fragment via `woocommerce_add_to_cart_fragments` so the header badge updates without a full reload.
- Registers custom image sizes (`mini_cart_thumbnail`, `product`) and adds Bootstrap button classes to the WooCommerce loop add-to-cart button.

**`woocommerce/`** is a full vendored copy of the WooCommerce plugin's template override directory (~230 files). Most of these are untouched stock templates kept only so WooCommerce can find them; only a handful have actually been customized for this theme (notably `cart/mini-cart.php`, `cart/cart.php`, `content-product.php`, `content-single-product.php`). Before editing a file under `woocommerce/`, check `git log -- <path>` to see whether it's one of the customized ones or a stock copy — treat stock copies as reference/fallback, not as intentionally-authored theme code.

**Header/nav behavior** (`assets/js/nav-compact.js`): the header toggles an `is-compact` class based on scroll direction, detected via an `IntersectionObserver` watching a `#compact-sentinel` div placed right after the header. Mobile menu open/close reuses the same compact-state toggle.

**Mini-cart UX** (`assets/js/mini-cart-qty.js`, `assets/js/shop-ensembles.js`): the mini-cart is a Bootstrap dropdown, not a WooCommerce default. Adding an item (via the theme's own AJAX add-to-cart for "ensemble"/bundle products, or WooCommerce's normal `added_to_cart` jQuery event) auto-opens the dropdown by triggering the Bootstrap `Dropdown` instance on the basket toggle button.

## Notes

- All user-facing copy and most code comments are in French.
- No linter, formatter, or test runner is configured — verify PHP changes by reading them carefully and, where possible, checking against a running WP/WooCommerce install rather than assuming a check will catch mistakes.
