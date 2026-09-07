# Suivi prod — sporacultus.ca

Ce que le code **ne transporte pas**. Le thème part par git → SFTP ; tout ce
qui vit dans la base de données ou hors du dossier du thème doit être fait à
la main dans wp-admin. Ce fichier est le seul endroit où c'est noté.

## À faire

- [ ] **Page « Guides et conseils » : changer le template** — comme pour
      À propos, la page pointe encore sur « Coming Soon » en prod. Il faut
      la basculer sur « Guides et conseils » pour que
      `page-guides-et-conseils.php` prenne le relais.
      → *Pages → Guides et conseils → Attributs de page → Modèle*
      (fait en local le 2026-09-06, **pas encore en prod**)

- [ ] **Creer la page « Comment les apprêter »** — nouvelle page WordPress,
      slug `comment-les-appreter`, modele « Guide — Comment les apprêter ».
      C'est le premier article de la section Guides. Chaque nouvel article
      demandera la meme manip : une page + son modele.
      → *Pages → Ajouter → Attributs de page → Modèle*
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

## Pièges connus de l'environnement local

- **`wp-content/languages/` n'a jamais été copié depuis la prod.** Seul
  `uploads/` l'a été. Résultat : le local affiche l'interface WooCommerce en
  anglais (« Add to cart », « Read more ») alors que **la prod est bien en
  français**. Ne pas confondre avec un vrai défaut du site — toujours
  vérifier sur `sporacultus.ca` avant de conclure.
  Pour aligner le local : `wp language plugin install woocommerce fr_CA`
  (déjà fait le 2026-09-06).

- Règle générale : le local est une **copie partielle et figée** de la prod.
  Une anomalie vue uniquement en local doit être confirmée sur le vrai site
  avant d'être traitée comme un bug.

## Fait

- 2026-09-06 — Page « À propos » : template changé de « Coming Soon » vers
  le template par défaut, pour que `page-a-propos.php` prenne le relais.
