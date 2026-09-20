<?php
defined( 'ABSPATH' ) || exit;

/**
 * Small client for the PayChain Developer API. Server to server only: the API
 * key is never sent to a browser.
 */
class PayChain_WC_API {

	const DEFAULT_BASE = 'https://api.paychain.co.ke';

	/** @var string */
	private $key;

	/** @var string */
	private $base;

	public function __construct( $key, $base = '' ) {
		$this->key  = trim( (string) $key );
		$base       = trim( (string) $base );
		$this->base = untrailingslashit( '' !== $base ? $base : self::DEFAULT_BASE );
		$this->base = apply_filters( 'paychain_wc_api_base', $this->base );
	}

	/** 'live', 'test' or 'unknown', from the key prefix. */
	public static function mode_from_key( $key ) {
		$key = trim( (string) $key );
		if ( 0 === strpos( $key, 'pc_live_' ) ) {
			return 'live';
		}
		if ( 0 === strpos( $key, 'pc_test_' ) ) {
			return 'test';
		}
		return 'unknown';
	}

	/**
	 * @return array{status:int, body:array|null}|WP_Error
	 */
	public function request( $method, $path, $body = null, $headers = array() ) {
		if ( '' === $this->key ) {
			return new WP_Error( 'paychain_no_key', __( 'No PayChain API key is set.', 'paychain-for-woocommerce' ) );
		}
		$host = wp_parse_url( $this->base, PHP_URL_HOST );
		$is_local = in_array( $host, array( 'localhost', '127.0.0.1' ), true );
		if ( 0 !== strpos( $this->base, 'https://' ) && ! $is_local ) {
			return new WP_Error( 'paychain_insecure_base', __( 'The PayChain API address must use https.', 'paychain-for-woocommerce' ) );
		}

		$args = array(
			'method'  => $method,
			'timeout' => 30,
			'headers' => array_merge(
				array(
					'Authorization' => 'Bearer ' . $this->key,
					'Content-Type'  => 'application/json',
					'Accept'        => 'application/json',
					'User-Agent'    => 'PayChain-WooCommerce/' . PAYCHAIN_WC_VERSION . '; ' . home_url(),
				),
				$headers
			),
		);
		if ( null !== $body ) {
			$args['body'] = wp_json_encode( $body );
		}

		$response = wp_remote_request( $this->base . $path, $args );
		if ( is_wp_error( $response ) ) {
			return $response;
		}
		$decoded = json_decode( wp_remote_retrieve_body( $response ), true );
		return array(
			'status' => (int) wp_remote_retrieve_response_code( $response ),
			'body'   => is_array( $decoded ) ? $decoded : null,
		);
	}

	public function ping() {
		return $this->request( 'GET', '/api/v1/developer/ping' );
	}

	/** Creates a hosted checkout session for one order. */
	public function create_checkout( array $args ) {
		return $this->request( 'POST', '/api/v1/developer/checkout', $args );
	}

	public function get_checkout( $session_id ) {
		return $this->request( 'GET', '/api/v1/developer/checkout/' . rawurlencode( (string) $session_id ) );
	}
}
