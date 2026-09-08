# Suivi prod — sporacultus.ca

Ce que le code **ne transporte pas**. Le thème part par git → SFTP ; tout ce
qui vit dans la base de données ou hors du dossier du thème doit être fait à
la main dans wp-admin. Ce fichier est le seul endroit où c'est noté.

**Chaque item est vérifié sur `sporacultus.ca`, jamais en local.** Le local
est une copie partielle et figée : trois fois déjà, un « problème » vu en
local n'existait pas sur le vrai site.

---

## Bloquant avant la demande d'indexation Google

- [x] ~~Uploader le thème en SFTP~~ — **fait le 2026-09-07**, vérifié sur la
      prod : « Bienvenue » corrigé et nouveau titre d'onglet de la boutique.

- [ ] **Page « Guides et conseils » : changer le modèle** — affiche encore
      « Contenu à venir » (vérifié le 2026-09-07).
      → *Pages → Guides et conseils → Attributs de page → Modèle →
      « Guides et conseils »*

- [ ] **Créer la page « Comment les apprêter »** — `/comment-les-appreter/`
      répond 404 (vérifié le 2026-09-07).
      → *Pages → Ajouter → titre « Comment les apprêter », permalien
      `comment-les-appreter`, modèle « Guide — Comment les apprêter »*

- [ ] **« Bloc de fructification » n'a aucun prix** — publié et visible dans
      la boutique, mais aucun bouton d'ajout au panier (vérifié le
      2026-09-07). Si c'est volontaire, le passer en brouillon plutôt que de
      le laisser sans prix.
      → *Produits → Bloc de fructification → Tarif*

## Une fois les items ci-dessus faits

- [ ] **S'inscrire à Google Search Console** — vérification de propriété par
      fichier HTML à la racine (le plus simple vu que le SFTP est déjà en
      place) ou par enregistrement DNS chez WHC.

- [ ] **Soumettre le sitemap** `https://sporacultus.ca/wp-sitemap.xml`
      Il existe déjà (généré par WordPress) et `robots.txt` le déclare
      correctement. Rien à créer.

- [ ] **Demander l'indexation** des pages clés via Inspection d'URL :
      accueil, boutique, à propos, guides et conseils.

## Améliorations, sans urgence

- [ ] **Alt « Don icon » en anglais** — seul texte alternatif fautif du
      site. Les 10 autres produits n'ont pas d'alt en base, mais WooCommerce
      utilise automatiquement le nom du produit, donc le HTML en contient un.

- [ ] **Catégories produits** — tous les produits sont « Uncategorized ».
      Reporté volontairement (peu de produits), voir
      `PLAN-AMELIORATION-SITE.md`.

## Où vit un guide

La section « Guides et conseils » lit **deux sources** et les fusionne dans
le même index, triées par date. Quand quelque chose cloche sur un guide, la
première question est : il vient d'où ?

**Source 1 — WordPress** (la voie normale, pour Aldérick)
> *Articles → Ajouter → écrire → Publier*

Rien d'autre à faire. L'article apparaît dans l'index automatiquement.
L'affichage est géré par `single.php`. Le contenu vit dans la base de
données, donc **il n'est pas versionné dans git** et s'écrit directement en
prod.

**Source 2 — le thème** (quand Claude rédige)

1. `page-guide-<slug>.php` dans le thème
2. une entrée dans `$guides_code` (tableau en haut de
   `page-guides-et-conseils.php`)
3. dans wp-admin : créer une page vide avec **exactement ce slug**, laisser
   le modèle sur « par défaut »

WordPress associe seul `page-<slug>.php` à la page du même slug — pas besoin
de choisir un modèle dans la liste. Le contenu part par SFTP avec le thème
et **est versionné dans git**.

## Déploiement du code

Le thème n'a **pas** de déploiement automatique. `uploadOnSave` est
désactivé dans `.vscode/sftp.json` (non versionné) : l'upload SFTP est une
action manuelle et délibérée, faite par Aldérick uniquement.

## Pièges connus de l'environnement local

- **`wp-content/languages/` n'a jamais été copié depuis la prod.** Le local
  affiche l'interface WooCommerce en anglais alors que **la prod est bien en
  français**. Aligné en local le 2026-09-06 avec
  `wp language plugin install woocommerce fr_CA`.

- **La base locale date du 2026-09-06** et ne bouge plus. Prix, textes
  alternatifs, statuts de produits : tout ça peut avoir changé en prod.

- **Ne jamais utiliser `perl -0777 -i -pe` sur un fichier accentué** : ça a
  cassé l'encodage UTF-8 trois fois. Utiliser `awk` avec un fichier de
  remplacement, ou réécrire le fichier au complet avec un heredoc.

- Règle générale : une anomalie vue uniquement en local doit être confirmée
  sur le vrai site avant d'être traitée comme un bug.

## Fait

- 2026-09-06 — Page « À propos » : modèle basculé vers le modèle dédié.
- 2026-09-06 — Titres et meta descriptions dynamiques. En ligne, vérifiés.
- 2026-09-07 — Upload SFTP : titre de boutique, faute « Bienvenue », prix
  sur la fiche produit, cartes de boutique égalisées, nav mobile et desktop.
