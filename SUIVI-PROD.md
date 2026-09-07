# Suivi prod — sporacultus.ca

Ce que le code **ne transporte pas**. Le thème part par git → SFTP ; tout ce
qui vit dans la base de données ou hors du dossier du thème doit être fait à
la main dans wp-admin. Ce fichier est le seul endroit où c'est noté.

## À faire

- [ ] **Traductions WooCommerce** — installer le paquet `fr_CA` du plugin.
      Sans ça, la boutique affiche « Add to cart », « Read more »,
      « Available on backorder » en anglais.
      → *Tableau de bord → Mises à jour → « Mettre à jour les traductions »*
      (fait en local le 2026-09-06, **pas encore en prod**)

- [ ] **« Bloc de fructification » n'a aucun prix** — le produit est publié
      et visible dans la boutique, mais impossible à acheter : le bouton
      affiche « Continuer la lecture » au lieu d'« Ajouter au panier ».
      Oubli ou volontaire ? Si volontaire, le passer en brouillon ou en
      « hors stock » plutôt que de le laisser sans prix.
      → *Produits → Bloc de fructification → Tarif*

- [ ] **Texte alternatif des images produits** — 10 produits sur 11 n'en ont
      aucun. Seul « Faire un don » en a un, et il est en anglais
      (« Don icon »). Mauvais pour l'accessibilité et le SEO image.
      → *Médias → chaque image → champ « Texte alternatif »*

- [ ] **Catégories produits** — tous les produits sont « Uncategorized ».
      Reporté volontairement (peu de produits pour l'instant), voir
      `PLAN-AMELIORATION-SITE.md`.

## Déploiement du code

Le thème n'a **pas** de déploiement automatique. `uploadOnSave` est
désactivé dans `.vscode/sftp.json` (non versionné) : l'upload SFTP est une
action manuelle et délibérée, faite par Aldérick uniquement.

Commits en attente d'upload : voir `git log origin/dev..dev`.

## Fait

- 2026-09-06 — Page « À propos » : template changé de « Coming Soon » vers
  le template par défaut, pour que `page-a-propos.php` prenne le relais.
