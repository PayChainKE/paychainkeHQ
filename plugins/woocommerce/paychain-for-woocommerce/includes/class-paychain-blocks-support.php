<?php
defined( 'ABSPATH' ) || exit;

use Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType;

/** Makes PayChain appear in the block-based checkout. */
final class PayChain_Blocks_Support extends AbstractPaymentMethodType {

	protected $name = 'paychain';

	public function initialize() {
		$this->settings = get_option( 'woocommerce_paychain_settings', array() );
	}

	public function is_active() {
		if ( ! function_exists( 'WC' ) || ! WC()->payment_gateways() ) {
			return false;
		}
		$gateways = WC()->payment_gateways()->payment_gateways();
		return isset( $gateways['paychain'] ) && $gateways['paychain']->is_available();
	}

	public function get_payment_method_script_handles() {
		wp_register_script(
			'paychain-blocks',
			PAYCHAIN_WC_URL . 'assets/js/paychain-blocks.js',
			array( 'wc-blocks-registry', 'wc-settings', 'wp-element', 'wp-html-entities' ),
			PAYCHAIN_WC_VERSION,
			true
		);
		return array( 'paychain-blocks' );
	}

	public function get_payment_method_data() {
		return array(
			'title'       => isset( $this->settings['title'] ) ? $this->settings['title'] : 'M-PESA (PayChain)',
			'description' => isset( $this->settings['description'] ) ? $this->settings['description'] : '',
			'supports'    => array( 'products' ),
		);
	}
}
