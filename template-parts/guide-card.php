<?php
/**
 * Carte d'un guide.
 *
 * Trois habillages interchangeables, choisis via $args['style'] :
 *   'a' — editorial sobre : categorie, titre, extrait. Ne demande aucune image.
 *   'b' — photo dominante : demande une image par guide.
 *   'c' — carnet d'essais : badge de statut + date, permet d'afficher un
 *         guide en cours d'ecriture sans faire semblant qu'il est pret.
 *
 * Pour changer l'habillage de toute la section, une seule ligne a modifier
 * dans page-guides-et-conseils.php ($card_style).
 *
 * @param array $args titre, extrait, categorie, lien, image, statut, date
 */

$style     = $args['style']     ?? 'a';
$titre     = $args['titre']     ?? '';
$extrait   = $args['extrait']   ?? '';
$categorie = $args['categorie'] ?? '';
$lien      = $args['lien']      ?? '';
$image     = $args['image']     ?? '';
$statut    = $args['statut']    ?? 'publie';
$date      = $args['date']      ?? '';

$libelle_statut = ( 'essai' === $statut ) ? 'Essai en cours' : 'Publié';
?>
<div class="col-12 col-md-6 mb-3">
  <a class="guide-card guide-card--<?php echo esc_attr( $style ); ?>" href="<?php echo esc_url( $lien ); ?>">

    <?php if ( 'b' === $style ) : ?>
      <div class="guide-card__media">
        <?php if ( $image ) : ?>
          <img src="<?php echo esc_url( $image ); ?>" alt="" loading="lazy">
        <?php endif; ?>
      </div>
    <?php endif; ?>

    <div class="guide-card__body">

      <?php if ( 'c' === $style ) : ?>
        <div class="guide-card__meta">
          <span class="guide-card__badge guide-card__badge--<?php echo esc_attr( $statut ); ?>">
            <?php echo esc_html( $libelle_statut ); ?>
          </span>
          <?php if ( $date ) : ?>
            <span class="guide-card__date"><?php echo esc_html( $date ); ?></span>
          <?php endif; ?>
        </div>
      <?php elseif ( $categorie ) : ?>
        <p class="guide-card__categorie"><?php echo esc_html( $categorie ); ?></p>
      <?php endif; ?>

      <p class="guide-card__titre"><?php echo esc_html( $titre ); ?></p>

      <?php if ( $extrait && 'b' !== $style ) : ?>
        <p class="guide-card__extrait"><?php echo esc_html( $extrait ); ?></p>
      <?php endif; ?>

    </div>
  </a>
</div>
