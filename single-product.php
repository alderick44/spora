<?php
/**
 * The Template for displaying all single products
 *
 * This template can be overridden by copying it to yourtheme/woocommerce/single-product.php.
 *
 * HOWEVER, on occasion WooCommerce will need to update template files and you
 * (the theme developer) will need to copy the new files to your theme to
 * maintain compatibility. We try to do this as little as possible, but it does
 * happen. When this occurs the version of the template file will be bumped and
 * the readme will list any important changes.
 *
 * @see         https://woocommerce.com/document/template-structure/
 * @package     WooCommerce\Templates
 * @version     1.6.4
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

get_header( 'shop' ); ?>

	<?php
		/**
		 * woocommerce_before_main_content hook.
		 *
		 * @hooked woocommerce_output_content_wrapper - 10 (outputs opening divs for the content)
		 * @hooked woocommerce_breadcrumb - 20
		 */
		// do_action( 'woocommerce_before_main_content' );
	?>

		<?php while ( have_posts() ) : ?>
			<?php the_post(); ?>

			<h1 class="text-center p-5"><?php echo the_title()?></h1>
			<div class="row mb-4 g-1">
					<div class="col-12 col-md-7">

						<?php
						global $product;
						if ($product->get_gallery_image_ids()){ 
						$image_ids = array_merge( [$product->get_image_id()], $product->get_gallery_image_ids() );
						?>

						<div id="product-carousel" class="carousel slide" data-bs-ride="carousel">
							<div class="carousel-indicators">
								<?php foreach ( $image_ids as $index => $id ) : ?>
									<button type="button" data-bs-target="#product-carousel" data-bs-slide-to="<?= $index ?>" <?= $index === 0 ? 'class="active"' : '' ?>></button>
								<?php endforeach; ?>
							</div>
							<div class="carousel-inner">
								<?php foreach ( $image_ids as $index => $id ) : ?>
									<div class="carousel-item px-2 px-md-5 <?= $index === 0 ? 'active' : '' ?>">
										<?= wp_get_attachment_image( $id, 'large', false, ['class' => 'd-block w-100 object-fit-cover rounded-3'] ) ?>
									</div>
								<?php endforeach; ?>
							</div>
							<button class="carousel-control-prev" type="button" data-bs-target="#product-carousel" data-bs-slide="prev">
								<span class="carousel-control-prev-icon"></span>
							</button>
							<button class="carousel-control-next" type="button" data-bs-target="#product-carousel" data-bs-slide="next">
								<span class="carousel-control-next-icon"></span>
							</button>
						</div>

						<?php } else { ?>
						
						<div class="px-5">
						<img src="<?php echo the_post_thumbnail_url('product')?>" class="rounded-3">
						</div>

						<?php } ?>
					</div>
					<div class="col-12 col-md-5 pt-3 pt-md-0 px-2 pe-md-5 text-center text-md-start">
						<?php echo the_content()?>
					</div>
			</div>

			<div class="d-flex justify-content-center pb-5">
				<?php woocommerce_template_single_add_to_cart(); ?>
			</div>

		<?php endwhile; // end of the loop. ?>
	<div class="text-center pb-5">
		<a class="btn btn-primary" href="/shop">Retourner vers la boutique<a>
	</div>

	<?php
		/**
		 * woocommerce_after_main_content hook.
		 *
		 * @hooked woocommerce_output_content_wrapper_end - 10 (outputs closing divs for the content)
		 */
		do_action( 'woocommerce_after_main_content' );
	?>

	<?php
		/**
		 * woocommerce_sidebar hook.
		 *
		 * @hooked woocommerce_get_sidebar - 10
		 */
		// do_action( 'woocommerce_sidebar' );
	?>

<?php
get_footer( 'shop' );

/* Omit closing PHP tag at the end of PHP files to avoid "headers already sent" issues. */
