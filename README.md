# Spora

Thème WordPress sur mesure pour [Sporacultus](https://sporacultus.ca), une boutique québécoise qui vend du mycélium, des substrats et des ensembles pour cultiver des champignons à l'extérieur.

<!-- Capture d'écran à ajouter :
![Page d'accueil de Sporacultus](docs/capture-accueil.webp)
-->

Pas de thème acheté, pas de constructeur de pages. Les gabarits, le CSS et le JavaScript sont écrits à la main, par-dessus WooCommerce.

## Stack

- WordPress et WooCommerce
- PHP pour les gabarits
- Bootstrap 5.3 et une feuille de style maison
- JavaScript sans framework ni étape de build
- Développement local avec Local, déploiement par SFTP

## Ce qui est fait à la main

**Le mini-panier.** Le panier s'ouvre dans un menu déroulant de l'en-tête au lieu d'une page séparée. Les boutons + et − passent par un point d'accès AJAX (`spora_update_mini_cart_qty` dans `functions.php`) qui modifie la quantité et renvoie les fragments WooCommerce, ce qui met à jour le panier et le compteur sans recharger la page. Le menu s'ouvre tout seul quand on ajoute un produit.

**L'en-tête compact.** Sur ordinateur, l'en-tête se réduit quand on descend dans la page et revient quand on remonte. Un `IntersectionObserver` surveille un élément placé juste sous l'en-tête et compare la direction du défilement (`assets/js/nav-compact.js`). Sur mobile, l'observateur est désactivé et le même état sert à ouvrir et fermer le menu.

**Les ensembles.** Sur la page boutique, les deux ensembles s'ajoutent au panier avec `fetch` vers l'API AJAX de WooCommerce, sans quitter la page (`assets/js/shop-ensembles.js`).

**Les guides.** Un nouveau guide se publie depuis l'administration WordPress, comme un article, sans toucher au code. Quand un guide demande une mise en page sur mesure, il peut aussi être écrit en PHP dans le thème. La page « Guides et conseils » affiche les deux ensemble, du plus récent au plus ancien. Les cartes ont trois styles interchangeables, choisis par une seule variable (`page-guides-et-conseils.php`, `template-parts/guide-card.php`).

**Le référencement.** Titres d'onglet et descriptions ajustés par page avec les filtres WordPress, plutôt qu'avec une extension SEO.

## Structure

```
spora/
├── functions.php              hooks, AJAX du panier, SEO
├── header.php / footer.php    navigation et mini-panier
├── front-page.php             accueil
├── page-*.php                 pages associées à leur slug
├── single.php                 guides écrits dans WordPress
├── single-product.php         fiche produit
├── template-parts/            composants réutilisables
├── assets/
│   ├── js/                    scripts sans dépendance
│   ├── icons/                 sprites SVG
│   └── img/                   images en WebP
└── woocommerce/               gabarits WooCommerce
```

Le dossier `woocommerce/` contient une copie complète des gabarits de l'extension. La plupart sont intacts. Ceux qui ont vraiment été modifiés sont `archive-product.php` (la boutique), `cart/mini-cart.php` et les gabarits d'ajout au panier de `single-product/`.

## Installation locale

1. Créer un site WordPress avec [Local](https://localwp.com/) et installer WooCommerce.
2. Cloner ce dépôt dans `wp-content/themes/spora`, ou créer un lien vers le dossier.
3. Activer le thème **Spora** dans *Apparence → Thèmes*.

Les produits et les pages vivent dans la base de données, pas dans ce dépôt. Un site neuf affichera les gabarits sans contenu.

## Utilisation de l'IA

J'ai écrit la base du thème, le mini-panier, l'en-tête compact et les ensembles entre février et avril 2026. À ce moment-là, l'IA me servait de référence : je lui posais des questions précises, sans y prendre de gros morceaux de code.

Plus récemment, je travaille avec [Claude Code](https://claude.com/claude-code) pour bâtir des fonctionnalités plus complexes. La section des guides, les titres et descriptions de référencement ainsi que plusieurs corrections d'affichage mobile ont été écrits avec lui.
