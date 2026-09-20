<?php
/**
 * Plugin Name:       PayChain for WooCommerce
 * Plugin URI:        https://paychain.co.ke
 * Description:       Accept M-PESA payments in WooCommerce with PayChain. Customers pay on a secure PayChain page; your order is marked paid automatically.
 * Version:           1.0.0
 * Author:            PayChain KE
 * Author URI:        https://paychain.co.ke
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       paychain-for-woocommerce
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * WC requires at least: 7.0
 */

defined( 'ABSPATH' ) || exit;

define( 'PAYCHAIN_WC_VERSION', '1.0.0' );
define( 'PAYCHAIN_WC_FILE', __FILE__ );
define( 'PAYCHAIN_WC_DIR', plugin_dir_path( __FILE__ ) );
define( 'PAYCHAIN_WC_URL', plugin_dir_url( __FILE__ ) );

// Works with High-Performance Order Storage and the block-based checkout.
add_action(
	'before_woocommerce_init',
	static function () {
		if ( class_exists( '\Automattic\WooCommerce\Utilities\FeaturesUtil' ) ) {
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', PAYCHAIN_WC_FILE, true );
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'cart_checkout_blocks', PAYCHAIN_WC_FILE, true );
		}
	}
);

// Block checkout: registered when WooCommerce Blocks is ready (this hook can fire
// before plugins_loaded finishes, so it is attached at load time).
add_action( 'woocommerce_blocks_loaded', 'paychain_wc_register_blocks_support' );
function paychain_wc_register_blocks_support() {
	if ( ! class_exists( '\Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType' ) ) {
		return;
	}
	require_once PAYCHAIN_WC_DIR . 'includes/class-paychain-blocks-support.php';
	add_action(
		'woocommerce_blocks_payment_method_type_registration',
		static function ( $registry ) {
			$registry->register( new PayChain_Blocks_Support() );
		}
	);
}

add_action( 'plugins_loaded', 'paychain_wc_init', 11 );
function paychain_wc_init() {
	load_plugin_textdomain( 'paychain-for-woocommerce', false, dirname( plugin_basename( PAYCHAIN_WC_FILE ) ) . '/languages' );

	if ( ! class_exists( 'WC_Payment_Gateway' ) ) {
		add_action(
			'admin_notices',
			static function () {
				echo '<div class="notice notice-error"><p>' . esc_html__( 'PayChain for WooCommerce needs WooCommerce to be installed and active.', 'paychain-for-woocommerce' ) . '</p></div>';
			}
		);
		return;
	}

	require_once PAYCHAIN_WC_DIR . 'includes/class-paychain-api.php';
	require_once PAYCHAIN_WC_DIR . 'includes/class-wc-gateway-paychain.php';

	add_filter(
		'woocommerce_payment_gateways',
		static function ( $gateways ) {
			$gateways[] = 'WC_Gateway_PayChain';
			return $gateways;
		}
	);

	add_filter(
		'plugin_action_links_' . plugin_basename( PAYCHAIN_WC_FILE ),
		static function ( $links ) {
			$url = admin_url( 'admin.php?page=wc-settings&tab=checkout&section=paychain' );
			array_unshift( $links, '<a href="' . esc_url( $url ) . '">' . esc_html__( 'Settings', 'paychain-for-woocommerce' ) . '</a>' );
			return $links;
		}
	);
}

// Safety net for customers who pay but never come back to the shop, and for
// shops that have not set up the webhook yet: every 10 minutes, ask PayChain
// about orders still waiting.
add_filter(
	'cron_schedules',
	static function ( $schedules ) {
		$schedules['paychain_ten_minutes'] = array(
			'interval' => 600,
			'display'  => __( 'Every 10 minutes (PayChain)', 'paychain-for-woocommerce' ),
		);
		return $schedules;
	}
);
add_action( 'paychain_wc_check_pending_orders', 'paychain_wc_check_pending_orders' );
function paychain_wc_check_pending_orders() {
	if ( ! function_exists( 'WC' ) || ! WC()->payment_gateways() ) {
		return;
	}
	$gateways = WC()->payment_gateways()->payment_gateways();
	if ( isset( $gateways['paychain'] ) && method_exists( $gateways['paychain'], 'check_pending_orders' ) ) {
		$gateways['paychain']->check_pending_orders();
	}
}

register_activation_hook(
	__FILE__,
	static function () {
		if ( ! wp_next_scheduled( 'paychain_wc_check_pending_orders' ) ) {
			wp_schedule_event( time() + 600, 'paychain_ten_minutes', 'paychain_wc_check_pending_orders' );
		}
	}
);
register_deactivation_hook(
	__FILE__,
	static function () {
		wp_clear_scheduled_hook( 'paychain_wc_check_pending_orders' );
	}
);
