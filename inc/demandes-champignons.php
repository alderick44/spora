<?php
// ============================================================
// Demandes de champignons : « Vous ne trouvez pas votre champignon ? »
// Formulaire public (shortcode [demande_champignon]), stockage dans une table
// dédiée, panneau admin « Demandes » et lecture JSON pour SporaFlow.
// ============================================================

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

const SPORA_DEMANDES_DB_VERSION = 1;

function spora_demandes_table() {
    global $wpdb;
    return $wpdb->prefix . 'spora_demandes';
}

// Le thème est déjà actif en production : after_switch_theme ne suffirait pas,
// d'où la vérification de version à chaque chargement de l'admin.
add_action( 'admin_init', 'spora_demandes_installer' );
add_action( 'after_switch_theme', 'spora_demandes_installer' );

function spora_demandes_installer() {
    if ( (int) get_option( 'spora_demandes_db_version' ) === SPORA_DEMANDES_DB_VERSION ) {
        return;
    }
    global $wpdb;
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    $table = spora_demandes_table();
    // espece : ce que le visiteur a tapé. espece_norm : clé sans accents ni majuscules.
    // groupe : l'espèce retenue, modifiable dans l'admin (fusion des fautes de frappe).
    dbDelta( "CREATE TABLE $table (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        espece varchar(80) NOT NULL,
        espece_norm varchar(80) NOT NULL,
        groupe varchar(80) NOT NULL,
        courriel varchar(190) DEFAULT NULL,
        cree_le datetime NOT NULL,
        PRIMARY KEY  (id),
        KEY espece_norm (espece_norm),
        KEY groupe (groupe)
    ) {$wpdb->get_charset_collate()};" );

    if ( ! get_option( 'spora_demandes_cle' ) ) {
        update_option( 'spora_demandes_cle', wp_generate_password( 40, false ), false );
    }
    update_option( 'spora_demandes_db_version', SPORA_DEMANDES_DB_VERSION, false );
}

function spora_demandes_normaliser( $texte ) {
    $texte = strtolower( remove_accents( $texte ) );
    $texte = preg_replace( '/[^a-z0-9]+/', ' ', $texte );
    return trim( $texte );
}

// ------------------------------------------------------------
// Formulaire public
// ------------------------------------------------------------

add_shortcode( 'demande_champignon', 'spora_demande_champignon_shortcode' );

function spora_demande_champignon_shortcode() {
    wp_enqueue_script(
        'spora-demande-champignon',
        get_theme_file_uri( 'assets/js/demande-champignon.js' ),
        [],
        wp_get_theme()->get( 'Version' ),
        true
    );

    $retour = isset( $_GET['demande'] ) ? sanitize_key( $_GET['demande'] ) : '';
    ob_start();
    ?>
    <section class="demande-champignon card border-0 p-4 my-5" aria-labelledby="demande-champignon-titre">
      <h2 id="demande-champignon-titre" class="h4">Vous ne trouvez pas votre champignon&nbsp;?</h2>
      <p>Dites-nous lequel, ça nous aide à choisir nos prochaines cultures.</p>

      <form class="demande-champignon-form" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" novalidate>
        <input type="hidden" name="action" value="spora_demande_champignon">
        <input type="hidden" name="retour" value="<?php echo esc_url( get_permalink() ); ?>">
        <input type="hidden" name="affiche_le" value="<?php echo time(); ?>">

        <?php // Piège à robots : invisible pour les humains, rempli par les robots. ?>
        <div class="demande-champignon-piege" aria-hidden="true">
          <label for="demande-site-web">Site web</label>
          <input type="text" id="demande-site-web" name="site_web" tabindex="-1" autocomplete="off">
        </div>

        <div class="mb-3">
          <label for="demande-espece" class="form-label">Nom du champignon</label>
          <input type="text" id="demande-espece" name="espece" class="form-control" maxlength="80" required
                 placeholder="ex. Shiitake, Pleurote rose…">
        </div>

        <div class="form-check mb-2">
          <input class="form-check-input" type="checkbox" id="demande-avertir" name="avertir" value="1">
          <label class="form-check-label" for="demande-avertir">M'avertir si ce champignon devient disponible</label>
        </div>

        <div class="mb-3 demande-champignon-courriel">
          <label for="demande-courriel" class="form-label">Courriel</label>
          <input type="email" id="demande-courriel" name="courriel" class="form-control" maxlength="190" autocomplete="email">
          <div class="form-text">Utilisé seulement pour vous avertir. Vous pouvez demander sa suppression en tout temps.</div>
        </div>

        <button type="submit" class="btn btn-primary">Envoyer</button>
        <p class="demande-champignon-message mt-3 mb-0" role="status" aria-live="polite"><?php
          if ( $retour === 'merci' ) {
              echo 'Merci&nbsp;! Votre demande a bien été reçue.';
          } elseif ( $retour === 'erreur' ) {
              echo 'Votre demande n\'a pas pu être envoyée. Vérifiez le nom du champignon et réessayez.';
          }
        ?></p>
      </form>
    </section>
    <?php
    return ob_get_clean();
}

// Pas de nonce : le formulaire est anonyme et les pages peuvent être en cache,
// un nonce périmé bloquerait des visiteurs légitimes. Le piège, le délai minimal
// et la limite par adresse IP font le tri.
add_action( 'admin_post_nopriv_spora_demande_champignon', 'spora_demande_champignon_recevoir' );
add_action( 'admin_post_spora_demande_champignon', 'spora_demande_champignon_recevoir' );

function spora_demande_champignon_recevoir() {
    $en_ajax = isset( $_POST['ajax'] );
    $resultat = spora_demande_champignon_traiter( wp_unslash( $_POST ) );

    if ( $en_ajax ) {
        if ( $resultat === true ) {
            wp_send_json_success( [ 'message' => 'Merci ! Votre demande a bien été reçue.' ] );
        }
        wp_send_json_error( [ 'message' => $resultat ], 400 );
    }

    $retour = isset( $_POST['retour'] ) ? wp_validate_redirect( esc_url_raw( wp_unslash( $_POST['retour'] ) ), home_url( '/' ) ) : home_url( '/' );
    $retour = add_query_arg( 'demande', $resultat === true ? 'merci' : 'erreur', $retour );
    wp_safe_redirect( $retour . '#demande-champignon-titre', 303 );
    exit;
}

// Retourne true, ou le message d'erreur à afficher.
function spora_demande_champignon_traiter( $donnees ) {
    // Robot probable : on fait semblant que tout a marché pour ne rien lui apprendre.
    $affiche_le = isset( $donnees['affiche_le'] ) ? (int) $donnees['affiche_le'] : 0;
    if ( ! empty( $donnees['site_web'] ) || ( $affiche_le && time() - $affiche_le < 3 ) ) {
        return true;
    }

    $espece = isset( $donnees['espece'] ) ? sanitize_text_field( $donnees['espece'] ) : '';
    $espece = trim( preg_replace( '/\s+/u', ' ', $espece ) );
    $norm   = spora_demandes_normaliser( $espece );
    if ( mb_strlen( $espece ) < 2 || mb_strlen( $espece ) > 80 || $norm === '' ) {
        return 'Entrez le nom du champignon.';
    }

    // Le courriel n'est gardé que si la personne a coché « M'avertir » (Loi 25 : consentement explicite).
    $courriel = null;
    if ( ! empty( $donnees['avertir'] ) ) {
        $courriel = isset( $donnees['courriel'] ) ? sanitize_email( $donnees['courriel'] ) : '';
        if ( ! is_email( $courriel ) ) {
            return 'Entrez un courriel valide pour être averti.';
        }
    }

    // Au plus 5 demandes par heure par adresse. L'IP n'est jamais stockée en clair.
    $ip  = isset( $_SERVER['REMOTE_ADDR'] ) ? $_SERVER['REMOTE_ADDR'] : '';
    $cle = 'spora_demandes_' . substr( hash_hmac( 'sha256', $ip, wp_salt() ), 0, 20 );
    $nb  = (int) get_transient( $cle );
    if ( $nb >= 5 ) {
        return 'Vous avez envoyé plusieurs demandes récemment. Réessayez plus tard.';
    }
    set_transient( $cle, $nb + 1, HOUR_IN_SECONDS );

    global $wpdb;
    $table = spora_demandes_table();
    // Une orthographe déjà fusionnée dans l'admin rejoint directement le bon groupe.
    $groupe = $wpdb->get_var( $wpdb->prepare(
        "SELECT groupe FROM $table WHERE espece_norm = %s ORDER BY id DESC LIMIT 1",
        $norm
    ) );
    if ( ! $groupe ) {
        $groupe = mb_strtoupper( mb_substr( $espece, 0, 1 ) ) . mb_substr( $espece, 1 );
    }

    $ok = $wpdb->insert( $table, [
        'espece'      => $espece,
        'espece_norm' => $norm,
        'groupe'      => $groupe,
        'courriel'    => $courriel,
        'cree_le'     => current_time( 'mysql' ),
    ] );
    return $ok ? true : 'Votre demande n\'a pas pu être enregistrée. Réessayez plus tard.';
}

// ------------------------------------------------------------
// Panneau admin « Demandes »
// ------------------------------------------------------------

add_action( 'admin_menu', function() {
    $hook = add_menu_page(
        'Demandes de champignons',
        'Demandes',
        'manage_options',
        'spora-demandes',
        'spora_demandes_page',
        'dashicons-lightbulb',
        58
    );
    add_action( "admin_print_styles-$hook", function() {
        wp_enqueue_style(
            'spora-admin-demandes',
            get_theme_file_uri( 'assets/css/admin-demandes.css' ),
            [],
            wp_get_theme()->get( 'Version' )
        );
    } );
} );

function spora_demandes_url( $args = [] ) {
    return add_query_arg( array_merge( [ 'page' => 'spora-demandes' ], $args ), admin_url( 'admin.php' ) );
}

function spora_demandes_page() {
    if ( ! current_user_can( 'manage_options' ) ) {
        return;
    }
    global $wpdb;
    $table  = spora_demandes_table();
    $groupe = isset( $_GET['groupe'] ) ? sanitize_text_field( wp_unslash( $_GET['groupe'] ) ) : '';
    $avis   = isset( $_GET['avis'] ) ? sanitize_key( $_GET['avis'] ) : '';
    $avis_textes = [
        'supprimee' => 'Demande supprimée.',
        'fusionnee' => 'Les demandes ont été regroupées.',
        'erreur'    => 'Action impossible : vérifiez le nom choisi.',
    ];
    ?>
    <div class="wrap sf">
      <header class="sf-entete">
        <div>
          <p class="sf-sur-titre">SporaFlow · Site web</p>
          <h1 class="sf-titre">Demandes de champignons</h1>
        </div>
        <?php if ( $groupe ) : ?>
          <a class="sf-btn" href="<?php echo esc_url( spora_demandes_url() ); ?>">← Toutes les espèces</a>
        <?php endif; ?>
      </header>

      <?php if ( isset( $avis_textes[ $avis ] ) ) : ?>
        <p class="sf-avis <?php echo $avis === 'erreur' ? 'sf-avis-err' : 'sf-avis-ok'; ?>" role="status"><?php echo esc_html( $avis_textes[ $avis ] ); ?></p>
      <?php endif; ?>

      <?php
      if ( $groupe ) {
          spora_demandes_page_detail( $groupe );
      } else {
          spora_demandes_page_resume();
      }
      ?>
    </div>
    <?php
}

function spora_demandes_page_resume() {
    global $wpdb;
    $table   = spora_demandes_table();
    $groupes = $wpdb->get_results(
        "SELECT groupe, COUNT(*) AS nb, SUM(courriel IS NOT NULL) AS nb_courriels, MAX(cree_le) AS derniere
         FROM $table GROUP BY groupe ORDER BY nb DESC, derniere DESC"
    );
    $total    = array_sum( wp_list_pluck( $groupes, 'nb' ) );
    $courriels = array_sum( wp_list_pluck( $groupes, 'nb_courriels' ) );
    ?>
    <div class="sf-tuiles">
      <div class="sf-tuile"><span class="sf-tuile-val"><?php echo (int) $total; ?></span><span class="sf-tuile-lib"><?php echo $total > 1 ? 'demandes' : 'demande'; ?></span></div>
      <div class="sf-tuile"><span class="sf-tuile-val"><?php echo count( $groupes ); ?></span><span class="sf-tuile-lib"><?php echo count( $groupes ) > 1 ? 'espèces différentes' : 'espèce'; ?></span></div>
      <div class="sf-tuile"><span class="sf-tuile-val"><?php echo (int) $courriels; ?></span><span class="sf-tuile-lib"><?php echo $courriels > 1 ? 'personnes à avertir' : 'personne à avertir'; ?></span></div>
    </div>

    <section class="sf-carte">
      <h2 class="sf-carte-titre">Par espèce</h2>
      <?php if ( ! $groupes ) : ?>
        <p class="sf-vide">Aucune demande pour l'instant. Ajoutez <code>[demande_champignon]</code> dans la page « Nos champignons » pour afficher le formulaire.</p>
      <?php else : ?>
        <div class="sf-table-defil">
          <table class="sf-table">
            <thead><tr><th>Espèce</th><th class="sf-num">Demandes</th><th class="sf-num">À avertir</th><th>Dernière demande</th></tr></thead>
            <tbody>
              <?php $max = (int) $groupes[0]->nb; ?>
              <?php foreach ( $groupes as $g ) : ?>
                <tr>
                  <td><a href="<?php echo esc_url( spora_demandes_url( [ 'groupe' => $g->groupe ] ) ); ?>"><?php echo esc_html( $g->groupe ); ?></a></td>
                  <td class="sf-num">
                    <span class="sf-barre" style="--part: <?php echo esc_attr( round( $g->nb / $max * 100 ) ); ?>%"></span>
                    <?php echo (int) $g->nb; ?>
                  </td>
                  <td class="sf-num"><?php echo (int) $g->nb_courriels; ?></td>
                  <td class="sf-muet"><?php echo esc_html( mysql2date( 'j M Y', $g->derniere ) ); ?></td>
                </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        </div>
      <?php endif; ?>
    </section>

    <section class="sf-carte">
      <h2 class="sf-carte-titre">Lecture par SporaFlow</h2>
      <p class="sf-muet">Adresse JSON privée, à appeler avec l'en-tête <code>X-Spora-Cle</code>. Ne partagez pas cette clé.</p>
      <p><code><?php echo esc_html( rest_url( 'spora/v1/demandes' ) ); ?></code></p>
      <details><summary>Afficher la clé</summary><p><code><?php echo esc_html( get_option( 'spora_demandes_cle' ) ); ?></code></p></details>
    </section>
    <?php
}

function spora_demandes_page_detail( $groupe ) {
    global $wpdb;
    $table     = spora_demandes_table();
    $demandes  = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM $table WHERE groupe = %s ORDER BY cree_le DESC", $groupe ) );
    $autres    = $wpdb->get_col( $wpdb->prepare( "SELECT DISTINCT groupe FROM $table WHERE groupe <> %s ORDER BY groupe", $groupe ) );
    $courriels = array_values( array_unique( array_filter( wp_list_pluck( $demandes, 'courriel' ) ) ) );

    if ( ! $demandes ) {
        echo '<p class="sf-vide">Aucune demande pour cette espèce.</p>';
        return;
    }
    ?>
    <section class="sf-carte">
      <h2 class="sf-carte-titre"><?php echo esc_html( $groupe ); ?> <span class="sf-pastille"><?php echo count( $demandes ); ?></span></h2>
      <div class="sf-table-defil">
        <table class="sf-table">
          <thead><tr><th>Écrit tel quel</th><th>Courriel</th><th>Date</th><th></th></tr></thead>
          <tbody>
            <?php foreach ( $demandes as $d ) : ?>
              <tr>
                <td><?php echo esc_html( $d->espece ); ?></td>
                <td><?php echo $d->courriel ? esc_html( $d->courriel ) : '<span class="sf-muet">—</span>'; ?></td>
                <td class="sf-muet"><?php echo esc_html( mysql2date( 'j M Y, H:i', $d->cree_le ) ); ?></td>
                <td class="sf-num">
                  <form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>"
                        onsubmit="return confirm('Supprimer cette demande (et son courriel) ?');">
                    <input type="hidden" name="action" value="spora_demandes_supprimer">
                    <input type="hidden" name="id" value="<?php echo (int) $d->id; ?>">
                    <?php wp_nonce_field( 'spora_demandes_supprimer_' . $d->id ); ?>
                    <button type="submit" class="sf-btn sf-btn-danger sf-btn-petit">Supprimer</button>
                  </form>
                </td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      </div>
    </section>

    <?php if ( $courriels ) : ?>
      <section class="sf-carte">
        <h2 class="sf-carte-titre">Personnes à avertir</h2>
        <p class="sf-muet">À copier dans votre logiciel de courriel (en copie cachée) quand l'espèce sera disponible.</p>
        <textarea class="sf-champ sf-courriels" readonly rows="3" onclick="this.select()"><?php echo esc_textarea( implode( ', ', $courriels ) ); ?></textarea>
      </section>
    <?php endif; ?>

    <section class="sf-carte">
      <h2 class="sf-carte-titre">Renommer ou regrouper</h2>
      <p class="sf-muet">Corrigez le nom, ou choisissez une espèce existante pour y regrouper ces demandes (ex. « Shitake » → « Shiitake »). Les prochaines demandes écrites pareil suivront automatiquement.</p>
      <form class="sf-ligne" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
        <input type="hidden" name="action" value="spora_demandes_fusionner">
        <input type="hidden" name="groupe" value="<?php echo esc_attr( $groupe ); ?>">
        <?php wp_nonce_field( 'spora_demandes_fusionner' ); ?>
        <label class="screen-reader-text" for="sf-cible">Nouveau nom</label>
        <input class="sf-champ" id="sf-cible" name="cible" list="sf-groupes" maxlength="80" required value="<?php echo esc_attr( $groupe ); ?>">
        <datalist id="sf-groupes">
          <?php foreach ( $autres as $autre ) : ?>
            <option value="<?php echo esc_attr( $autre ); ?>">
          <?php endforeach; ?>
        </datalist>
        <button type="submit" class="sf-btn sf-btn-primaire">Appliquer</button>
      </form>
    </section>
    <?php
}

add_action( 'admin_post_spora_demandes_supprimer', function() {
    $id = isset( $_POST['id'] ) ? (int) $_POST['id'] : 0;
    if ( ! current_user_can( 'manage_options' ) || ! check_admin_referer( 'spora_demandes_supprimer_' . $id ) ) {
        wp_die( 'Action non autorisée.' );
    }
    global $wpdb;
    $table  = spora_demandes_table();
    $groupe = $wpdb->get_var( $wpdb->prepare( "SELECT groupe FROM $table WHERE id = %d", $id ) );
    $wpdb->delete( $table, [ 'id' => $id ], [ '%d' ] );
    $reste  = $groupe ? (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM $table WHERE groupe = %s", $groupe ) ) : 0;
    wp_safe_redirect( spora_demandes_url( $reste ? [ 'groupe' => $groupe, 'avis' => 'supprimee' ] : [ 'avis' => 'supprimee' ] ) );
    exit;
} );

add_action( 'admin_post_spora_demandes_fusionner', function() {
    if ( ! current_user_can( 'manage_options' ) || ! check_admin_referer( 'spora_demandes_fusionner' ) ) {
        wp_die( 'Action non autorisée.' );
    }
    $source = isset( $_POST['groupe'] ) ? sanitize_text_field( wp_unslash( $_POST['groupe'] ) ) : '';
    $cible  = isset( $_POST['cible'] ) ? trim( sanitize_text_field( wp_unslash( $_POST['cible'] ) ) ) : '';
    if ( $source === '' || $cible === '' || mb_strlen( $cible ) > 80 ) {
        wp_safe_redirect( spora_demandes_url( [ 'groupe' => $source, 'avis' => 'erreur' ] ) );
        exit;
    }
    global $wpdb;
    $table = spora_demandes_table();
    // Si la cible existe déjà avec une autre casse, on garde son orthographe.
    $existant = $wpdb->get_var( $wpdb->prepare( "SELECT groupe FROM $table WHERE groupe = %s AND groupe <> %s LIMIT 1", $cible, $source ) );
    $cible = $existant ? $existant : $cible;
    $wpdb->update( $table, [ 'groupe' => $cible ], [ 'groupe' => $source ] );
    wp_safe_redirect( spora_demandes_url( [ 'groupe' => $cible, 'avis' => 'fusionnee' ] ) );
    exit;
} );

// ------------------------------------------------------------
// Lecture JSON pour SporaFlow : GET /wp-json/spora/v1/demandes
// ------------------------------------------------------------

add_action( 'rest_api_init', function() {
    register_rest_route( 'spora/v1', '/demandes', [
        'methods'             => 'GET',
        'permission_callback' => function( WP_REST_Request $requete ) {
            if ( current_user_can( 'manage_options' ) ) {
                return true;
            }
            $cle    = (string) $requete->get_header( 'x_spora_cle' );
            $valide = (string) get_option( 'spora_demandes_cle' );
            return $valide !== '' && hash_equals( $valide, $cle );
        },
        'callback'            => function() {
            global $wpdb;
            $table = spora_demandes_table();
            $lignes = $wpdb->get_results( "SELECT id, espece, groupe, courriel, cree_le FROM $table ORDER BY id", ARRAY_A );
            foreach ( $lignes as &$ligne ) {
                $ligne['id']      = (int) $ligne['id'];
                $ligne['cree_le'] = mysql_to_rfc3339( $ligne['cree_le'] );
            }
            return rest_ensure_response( [ 'demandes' => $lignes ] );
        },
    ] );
} );
