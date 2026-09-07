# Plan d'amélioration — sporacultus.ca

Audit réalisé par exploration directe du repo (`C:\Github\spora`), de la base de
données WordPress de production (copie importée en local le 2026-09-06) et du
site live (`sporacultus.ca`), complété par une recherche concurrentielle.

**Hypothèses posées faute d'accès direct** (à valider) :
- Aucun accès à Google Search Console / Analytics → pas de données réelles de
  trafic, position de mots-clés ou taux de conversion. Les recommandations SEO
  reposent sur l'audit technique/structurel, pas sur des données de performance.
- La base de données locale utilisée pour l'audit est un instantané pris le
  2026-09-06 ; toute modification faite en prod depuis n'est pas reflétée ici.
- Aucun plugin SEO n'est installé (voir plus bas) — donc aucune donnée de
  mots-clés ciblés n'existe déjà dans le site à auditer.

---

## 1. Diagnostic actuel (forces / faiblesses)

### Forces
- **Base technique saine et légère** : un seul plugin actif (WooCommerce),
  thème maison en PHP/CSS vanilla, pas de surcharge de scripts tiers. Bon pour
  la performance et la maintenabilité par une seule personne.
- **HTTPS fonctionnel** : redirection HTTP→HTTPS et `www`→apex actives.
- **Structure d'URL propre** : permaliens en `/%postname%/`, lisibles et SEO-friendly.
- **Ton de la page d'accueil et des fiches produits déjà cohérent** : les
  descriptions de produits (ex. Mycélium en vrac, Bloc de fructification) sont
  claires, factuelles, en français correct — une bonne base à enrichir plutôt
  qu'à refaire.
- **H1 corrects sur les fiches produits** (nom du produit en `<h1>`), pas de
  structure de titres cassée détectée là où il y a du contenu.
- **Effort d'optimisation d'images déjà entamé** : plusieurs visuels ont été
  convertis en `.webp` récemment (commit "Upload new images for optimization").

### Faiblesses

**Contenu — le problème le plus grave du site**
- **5 des 6 pages principales de navigation sont vides.** À propos, Nous
  joindre, Guides et conseils, Nos champignons, et Pour les producteurs
  utilisent toutes le template `page-coming-soon.php` et n'ont **aucun
  contenu réel** en base de données — juste "Contenu à venir." Ce sont
  pourtant des liens visibles dans le menu principal du site. Un visiteur qui
  clique sur "À propos" pour connaître l'histoire de la marque tombe sur une
  page vide : c'est le plus gros trou du site, et exactement l'inverse de
  l'objectif "authentique".
- **Aucun blog/article** (0 billet publié). Aucun espace pour partager
  l'approche R&D, les données de culture, le vécu au Québec — pourtant l'angle
  le plus différenciant du projet selon le contexte fourni.
- **Tous les produits sont "Uncategorized"** — aucune catégorie WooCommerce
  assignée (spawn/grain, cultures liquides, substrats, ensembles). Nuit à la
  navigation, au filtrage et au maillage SEO interne.
- **"Faire un don" apparaît dans la grille de produits** au même titre que les
  produits vendus — un vestige probable de l'époque Etsy/communautaire qui
  détonne dans une boutique qui se veut pro.
- **Vocabulaire parfois technique sans contexte pédagogique** (ex. "culture
  liquide", "grain de seigle") — correct pour un myciculteur initié, mais peut
  perdre un client débutant qui n'a pas de page "Guides" pour se rattraper.

**SEO — deuxième plus gros problème**
- **La balise `<title>` est codée en dur à "Sporacultus" dans
  [header.php](header.php)`, identique sur absolument toutes les pages**
  (accueil, boutique, fiches produits, à propos...). Vérifié en direct sur
  `/shop/` et `/a-propos/` : titre identique. C'est l'un des signaux SEO les
  plus lourds de conséquence et les moins coûteux à corriger.
- **Aucune balise meta description nulle part sur le site.**
- **Aucun plugin SEO installé** (pas de Yoast, RankMath, AIOSEO) — donc pas de
  sitemap XML géré, pas de contrôle des balises Open Graph/Twitter Card, pas
  de schema.org produit (rich snippets prix/avis dans Google absents).
- **16 images sur 17 dans la médiathèque n'ont aucun texte alternatif (alt).**
  Mauvais pour l'accessibilité et pour le SEO image.
- **Noms de fichiers image non descriptifs** (`DSC_0049`, `GSM-C`, `hwfp`) —
  aucune valeur SEO, contrairement à des noms comme `mycelium-en-vrac-jardin.webp`.
- **Zéro contenu texte indexable** sur 5 pages → Google n'a rien à indexer
  pour des requêtes comme "à propos culture de champignons Québec".

**Technique**
- Quelques images encore lourdes malgré la conversion webp en cours :
  `jardin.webp` (1.3 Mo), `banner-mushroom-autumn.webp` (676 Ko) — à
  recompresser/redimensionner.
- Seulement 3 breakpoints `@media` dans tout `style.css` — le site s'appuie
  presque entièrement sur la grille Bootstrap, ce qui est correct mais laisse
  peu de contrôle fin sur les cas limites (tablette, petits écrans).
- Aucun en-tête de sécurité détecté (`Strict-Transport-Security`,
  `X-Frame-Options`) et le header `X-Powered-By: PHP/8.2.33` expose la version
  PHP publiquement — risque mineur mais gratuit à corriger.
- Aucun plugin de cache ni de sauvegarde visible sur le site — à confirmer
  côté hébergeur (WHC gère peut-être ça en dehors de WordPress).
- (Note opérationnelle, hors scope du site lui-même : le repo git et la prod
  avaient dérivé l'un de l'autre avant cette session — déjà réglé, mais signale
  l'absence d'un processus de déploiement structuré à moyen terme.)

---

## 2. Mots-clés & positionnement concurrentiel

### Mots-clés pertinents identifiés

**Français (marché primaire QC/Canada)**
`mycélium comestible Québec` · `spawn de champignons Canada` · `acheter
mycélium en ligne` · `grain de seigle inoculé` · `culture liquide de
champignons` · `souche de champignons pleurote` · `souche de strophaire` ·
`kit de culture de champignons Québec` · `myciculture` · `substrat colonisé
mycélium` · `champignons comestibles culture maison` · `culture de
champignons extérieur jardin`

**Anglais (marché secondaire, volume de recherche souvent plus élevé)**
`mushroom grain spawn Canada` · `liquid culture mushroom Quebec` · `buy
mushroom spawn online Canada` · `sterilized grain spawn bag`

### Concurrents analysés

| Site | Positionnement observé | Ce qui fonctionne bien chez eux |
|---|---|---|
| [Violon et Champignon](https://violonetchampignon.com/) (Laurentides, QC) | "La référence en culture de champignons comestibles" — certifié biologique Écocert, formations en ligne | Se positionne en **autorité pédagogique** (formations + vente), meta description claire et orientée bénéfice |
| [Nature Lion](https://naturelion.ca/) (Brantford, ON) | Fournisseur pro, laboratoire agréé CFIA, "made fresh to order" | Meta title/description **exemplaires** : concis, mots-clés + preuve de confiance (licence, lab, livraison Canada) — la barre à atteindre pour le SEO |
| [Champignons Maison / HomeGrown Fungi](https://champignons-maison.com/en/) (Montréal) | Large catalogue gourmet + médicinal | Contre-exemple utile : leur balise `<title>` contient littéralement toute la description de l'entreprise — mauvaise pratique SEO à ne pas reproduire |
| [Spores Source Canada](https://www.sporessource.ca/en) | Dowels et cultures liquides, livraison gratuite Canada | Argument de livraison mis en avant tôt dans le parcours |

### Ce que ça révèle pour Sporacultus
- **Aucun concurrent trouvé ne met de l'avant une approche R&D/données**
  (capteurs, optimisation de culture) — c'est un espace de positionnement
  ouvert et crédible étant donné le profil réel du fondateur. C'est
  probablement l'angle le plus fort pour se différencier de Violon et
  Champignon (pédagogie généraliste) et de Nature Lion (pur fournisseur
  commercial).
- Sporacultus est actuellement **en retard sur le SEO de base** par rapport à
  Nature Lion, alors que c'est le concurrent le plus "pro" en apparence.
- La certification biologique (Écocert) de Violon et Champignon est un
  argument de confiance fort — si Sporacultus a une pratique équivalente
  (sans pesticides, etc.) mais non certifiée, il faut au moins l'affirmer en
  texte sur la page "À propos".

---

## 3. Axes d'amélioration priorisés

### 🟢 Effort rapide (heures à ~2 jours)
1. **Rendre la balise `<title>` dynamique** dans [header.php](header.php)
   (utiliser `wp_title()`/`wp_head()` correctement au lieu du texte codé en
   dur) + ajouter une meta description par page. *Impact SEO le plus élevé
   pour l'effort le plus faible sur tout le site.*
2. **Ajouter un texte alternatif descriptif** aux 17 images de la médiathèque,
   en priorité les 11 photos de produits.
3. **Assigner de vraies catégories produit** WooCommerce (ex. "Spawn sur
   grain", "Cultures liquides", "Substrats", "Ensembles", "Soutien au projet").
4. **Sortir "Faire un don" de la grille de produits standard** — le présenter
   plutôt comme un encart séparé ("Soutenez le projet") pour ne pas brouiller
   l'offre commerciale.
5. **Recompresser** `jardin.webp` et `banner-mushroom-autumn.webp` (encore
   lourds malgré la conversion webp).

### 🟡 Effort moyen (jours à ~2 semaines)
6. **Écrire le vrai contenu des 5 pages "Coming Soon"**, en commençant par
   À propos et Guides et conseils (voir section 5 — c'est LE chantier
   prioritaire du plan).
7. **Installer un plugin SEO léger** (Rank Math ou Yoast, version gratuite)
   pour gérer sitemap XML, Open Graph, et schema.org produit automatiquement
   — alternative à coder ces balises à la main dans le thème si on veut
   rester sans dépendance.
8. **Ajouter les en-têtes de sécurité de base** (HSTS, X-Frame-Options) via
   `.htaccess` ou le panneau d'hébergement WHC.
9. **Uniformiser la photographie produit** — les noms de fichiers actuels
   (`DSC_0049`, `GSM-C`) suggèrent des photos prises au fil du temps sans
   direction commune ; une séance photo cohérente (fond, lumière, cadrage)
   renforcerait immédiatement le côté "recherché".

### 🔴 Long terme (semaines et plus)
10. **Lancer un blog/journal de bord** : notes de R&D, données de capteurs,
    suivis de culture extérieure de pleurotes. C'est le levier le plus direct
    pour transformer l'angle "artisanal-scientifique" en contenu SEO récurrent
    et en preuve d'authenticité — aucun concurrent identifié ne le fait.
11. **Développer "Pour les producteurs" en vraie page B2B** (tarifs volume,
    conditions de gros) — pertinent vu l'intérêt mentionné pour des souches
    spécialisées à plus haute valeur ajoutée.
12. **Structurer le lancement des souches spécialisées** comme une ligne de
    produit à part (positionnement, prix, page dédiée), possiblement avec une
    liste d'attente pour valider la demande avant un lancement complet.

---

## 4. Mots-clés de marque additionnels

Au-delà de pro / recherché / authentique :

| Mot-clé | Pourquoi il colle à Sporacultus |
|---|---|
| **Artisanal** | Production à échelle humaine, une seule personne — à assumer plutôt qu'à cacher face aux fournisseurs plus industriels comme Nature Lion. |
| **Rigoureux** | L'angle capteurs/données/optimisation est une vraie rigueur scientifique rare chez les concurrents observés — c'est un argument de confiance différenciant, pas juste un slogan. |
| **Local / Québécois** | L'origine géographique compte pour l'acheteur type (mouvement jardinage local, achat local) — actuellement invisible sur le site. |
| **Transparent** | Montrer le vrai lieu, les vrais rendements, les vrais essais (y compris les échecs de culture) crée plus de confiance qu'un discours marketing lisse. |
| **Durable / régénératif** | Le mycélium en vrac "enrichit le sol" — un argument écologique déjà présent dans le texte de l'accueil mais sous-exploité ailleurs sur le site. |
| **Passionné** | L'histoire d'un fondateur qui cultive aussi dehors par intérêt personnel (pas juste commercial) est un ressort d'authenticité fort — à raconter sur "À propos", actuellement vide. |
| **Accessible** | Cohérent avec la phrase déjà présente en accueil ("rendre la myciculture accessible") — à garder comme fil conducteur sur tout le site, notamment les guides. |
| **Traçable / précis** | Utile pour rassurer producteurs et myciculteurs sérieux : dates de production, souche documentée, méthode reproductible. |
| **Pédagogue / curieux** | "Guides et conseils" (actuellement vide) est le véhicule naturel — Violon et Champignon a bâti une partie de sa réputation là-dessus. |
| **Résilient** | La culture extérieure de pleurotes relie le projet à une logique de permaculture/résilience alimentaire, un angle que les fournisseurs purement indoor n'occupent pas. |

---

## 5. Prochaines 3 actions concrètes

> **État (2026-09-06)** : actions 1 et 2 complétées (page À propos en ligne,
> titre/meta dynamiques déployés). Action 3 (catégories produits + alt text)
> **mise de côté volontairement** — à reprendre plus tard. Aussi fait hors
> plan : animation hero désactivée, menu mobile corrigé (nav utilitaire
> visible + icône Nous joindre).

1. **Écrire le contenu réel de la page "À propos"** — l'histoire de marque :
   qui cultive, où (Québec), pourquoi (passion + démarche scientifique),
   l'angle capteurs/données. C'est la page la plus vide et la plus porteuse
   d'authenticité ; elle devrait sortir du template "Coming Soon".
2. **Corriger la balise `<title>` pour qu'elle soit dynamique par page**
   (+ ajouter une meta description) dans [header.php](header.php) — le
   changement technique le plus rapide avec le plus gros effet SEO mesurable.
3. **Catégoriser les 11 produits existants** et ajouter un texte alternatif
   à chaque photo produit — corrige d'un coup la navigation, le maillage
   interne et le SEO image.

---

**Sources concurrentielles consultées** :
[Violon et Champignon](https://violonetchampignon.com/) ·
[Nature Lion](https://naturelion.ca/) ·
[Champignons Maison / HomeGrown Fungi](https://champignons-maison.com/en/) ·
[Spores Source Canada](https://www.sporessource.ca/en) ·
[La Botte — Boutique Urbainculteurs](https://www.boutique.urbainculteurs.org/products/mycelium-pour-jardin-de-la-botte) ·
[Les 400 Pieds de Champignon](https://les400piedsdechampignon.com/products/mycelium-pleurotes-marie-anne) ·
[Ô Champignon](https://www.ochampignon.com/boutique)
