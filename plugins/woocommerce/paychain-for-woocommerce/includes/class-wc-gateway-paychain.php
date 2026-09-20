<?php
defined( 'ABSPATH' ) || exit;

/**
 * PayChain (M-PESA) payment gateway.
 *
 * Flow: checkout creates a PayChain hosted-checkout session for the order and
 * sends the customer there; the order is put on hold. PayChain then tells the
 * shop the payment succeeded, by signed webhook. Two fallbacks exist for shops
 * that have not set the webhook up or customers who never return: the order
 * thank-you page and a 10-minute cron both ask PayChain directly. The browser
 * redirect back to the shop is never trusted on its own.
 */
class WC_Gateway_PayChain extends WC_Payment_Gateway {

	public function __construct() {
		$this->id                 = 'paychain';
		$this->icon               = '';
		$this->has_fields         = false;
		$this->method_title       = __( 'PayChain (M-PESA)', 'paychain-for-woocommerce' );
		$this->method_description = __( 'Take M-PESA payments through PayChain. Customers approve the payment on their phone on a secure PayChain page.', 'paychain-for-woocommerce' );
		$this->supports           = array( 'products' );

		$this->init_form_fields();
		$this->init_settings();

		$this->title       = $this->get_option( 'title' );
		$this->description = $this->get_option( 'description' );
		$this->enabled     = $this->get_option( 'enabled' );

		add_action( 'woocommerce_update_options_payment_gateways_' . $this->id, array( $this, 'process_admin_options' ) );
		add_action( 'woocommerce_api_wc_gateway_paychain', array( $this, 'handle_webhook' ) );
		add_action( 'woocommerce_thankyou_' . $this->id, array( $this, 'thankyou_page' ) );
	}

	public function init_form_fields() {
		$this->form_fields = array(
			'enabled'        => array(
				'title'   => __( 'Enable/Disable', 'paychain-for-woocommerce' ),
				'type'    => 'checkbox',
				'label'   => __( 'Enable PayChain (M-PESA)', 'paychain-for-woocommerce' ),
				'default' => 'no',
			),
			'title'          => array(
				'title'       => __( 'Title', 'paychain-for-woocommerce' ),
				'type'        => 'text',
				'description' => __( 'What the customer sees at checkout.', 'paychain-for-woocommerce' ),
				'default'     => __( 'M-PESA (PayChain)', 'paychain-for-woocommerce' ),
				'desc_tip'    => true,
			),
			'description'    => array(
				'title'       => __( 'Description', 'paychain-for-woocommerce' ),
				'type'        => 'textarea',
				'description' => __( 'Shown under the title at checkout.', 'paychain-for-woocommerce' ),
				'default'     => __( 'Pay with M-PESA. You will be taken to a secure PayChain page to approve the payment on your phone.', 'paychain-for-woocommerce' ),
				'desc_tip'    => true,
			),
			'api_key'        => array(
				'title'       => __( 'API key', 'paychain-for-woocommerce' ),
				'type'        => 'password',
				'description' => __( 'From the PayChain developer portal. A key starting pc_test_ is the sandbox (no real money). A key starting pc_live_ takes real payments.', 'paychain-for-woocommerce' ),
				'default'     => '',
			),
			'webhook_secret' => array(
				'title'       => __( 'Webhook secret', 'paychain-for-woocommerce' ),
				'type'        => 'password',
				'description' => __( 'Register the webhook address shown above in the developer portal, then paste its secret here. This is how PayChain tells your shop, securely, that an order was paid.', 'paychain-for-woocommerce' ),
				'default'     => '',
			),
			'session_ttl'    => array(
				'title'             => __( 'Payment page expires after (minutes)', 'paychain-for-woocommerce' ),
				'type'              => 'number',
				'description'       => __( 'How long the customer has to pay on the PayChain page. Between 5 and 10080. Leave blank for the PayChain default (30).', 'paychain-for-woocommerce' ),
				'default'           => '',
				'desc_tip'          => true,
				'custom_attributes' => array(
					'min'  => 5,
					'max'  => 10080,
					'step' => 1,
				),
			),
			'api_base'       => array(
				'title'       => __( 'API address (advanced)', 'paychain-for-woocommerce' ),
				'type'        => 'text',
				'description' => __( 'Leave as is unless PayChain tells you otherwise.', 'paychain-for-woocommerce' ),
				'default'     => PayChain_WC_API::DEFAULT_BASE,
				'desc_tip'    => true,
			),
			'debug'          => array(
				'title'       => __( 'Debug log', 'paychain-for-woocommerce' ),
				'type'        => 'checkbox',
				'label'       => __( 'Log PayChain activity to WooCommerce > Status > Logs', 'paychain-for-woocommerce' ),
				'description' => __( 'Never logs your API key or secret.', 'paychain-for-woocommerce' ),
				'default'     => 'no',
			),
		);
	}

	/* ------------------------------------------------------------------ admin */

	public function webhook_url() {
		return WC()->api_request_url( 'WC_Gateway_PayChain' );
	}

	/** Trim, and refuse a key that is not a PayChain key. */
	public function validate_api_key_field( $key, $value ) {
		$value = trim( sanitize_text_field( (string) $value ) );
		if ( '' !== $value && 'unknown' === PayChain_WC_API::mode_from_key( $value ) ) {
			throw new Exception( __( 'That does not look like a PayChain API key. It should start with pc_test_ or pc_live_.', 'paychain-for-woocommerce' ) );
		}
		return $value;
	}

	public function validate_webhook_secret_field( $key, $value ) {
		return trim( sanitize_text_field( (string) $value ) );
	}

	public function validate_session_ttl_field( $key, $value ) {
		$value = trim( (string) $value );
		if ( '' === $value ) {
			return '';
		}
		$n = (int) $value;
		if ( $n < 5 || $n > 10080 ) {
			throw new Exception( __( 'The payment page expiry must be between 5 and 10080 minutes.', 'paychain-for-woocommerce' ) );
		}
		return (string) $n;
	}

	public function validate_api_base_field( $key, $value ) {
		$value = trim( esc_url_raw( (string) $value ) );
		return '' === $value ? PayChain_WC_API::DEFAULT_BASE : untrailingslashit( $value );
	}

	private function connection_status() {
		$key = trim( (string) $this->get_option( 'api_key' ) );
		if ( '' === $key ) {
			return array( 'state' => 'none' );
		}
		$cache_key = 'paychain_wc_ping_' . md5( $key . $this->get_option( 'api_base' ) );
		$cached    = get_transient( $cache_key );
		if ( false !== $cached ) {
			return $cached;
		}
		$res    = $this->api()->ping();
		$status = array( 'mode' => PayChain_WC_API::mode_from_key( $key ) );
		if ( is_wp_error( $res ) ) {
			$status['state']   = 'error';
			$status['message'] = $res->get_error_message();
		} elseif ( 200 === $res['status'] ) {
			$status['state'] = 'ok';
		} else {
			$status['state']   = 'error';
			$status['message'] = isset( $res['body']['error'] ) ? $res['body']['error'] : sprintf( 'HTTP %d', $res['status'] );
		}
		set_transient( $cache_key, $status, 60 );
		return $status;
	}

	public function admin_options() {
		echo '<h2>' . esc_html( $this->get_method_title() ) . '</h2>';

		if ( 'KES' !== get_woocommerce_currency() ) {
			echo '<div class="notice notice-error inline"><p>' . esc_html__( 'PayChain takes payments in Kenyan shillings only. Set your store currency to KES (WooCommerce > Settings > General) to use it.', 'paychain-for-woocommerce' ) . '</p></div>';
		}

		$status = $this->connection_status();
		if ( 'ok' === $status['state'] ) {
			if ( 'test' === $status['mode'] ) {
				echo '<div class="notice notice-warning inline"><p><strong>' . esc_html__( 'Connected: TEST mode.', 'paychain-for-woocommerce' ) . '</strong> ' . esc_html__( 'Payments are simulated and no real money moves. Orders will be marked paid, so do not ship goods for them. Use a pc_live_ key to take real payments.', 'paychain-for-woocommerce' ) . '</p></div>';
			} else {
				echo '<div class="notice notice-success inline"><p><strong>' . esc_html__( 'Connected: LIVE mode.', 'paychain-for-woocommerce' ) . '</strong> ' . esc_html__( 'Real M-PESA payments will be taken.', 'paychain-for-woocommerce' ) . '</p></div>';
			}
		} elseif ( 'error' === $status['state'] ) {
			echo '<div class="notice notice-error inline"><p><strong>' . esc_html__( 'Could not connect to PayChain:', 'paychain-for-woocommerce' ) . '</strong> ' . esc_html( $status['message'] ) . '</p></div>';
		}

		echo '<p>' . esc_html__( 'Webhook address to register in the PayChain developer portal (Webhooks, event: payment.collect.succeeded):', 'paychain-for-woocommerce' ) . '</p>';
		echo '<p><input type="text" class="regular-text code" readonly value="' . esc_attr( $this->webhook_url() ) . '" onfocus="this.select()" style="width:100%;max-width:520px" /></p>';

		parent::admin_options();
	}

	/* ---------------------------------------------------------------- helpers */

	private function api() {
		return new PayChain_WC_API( $this->get_option( 'api_key' ), $this->get_option( 'api_base' ) );
	}

	private function log( $level, $message ) {
		if ( 'yes' !== $this->get_option( 'debug' ) && ! in_array( $level, array( 'error', 'warning' ), true ) ) {
			return;
		}
		wc_get_logger()->log( $level, $message, array( 'source' => 'paychain' ) );
	}

	public function is_available() {
		if ( ! parent::is_available() ) {
			return false;
		}
		if ( 'KES' !== get_woocommerce_currency() ) {
			return false;
		}
		return '' !== trim( (string) $this->get_option( 'api_key' ) );
	}

	/* ---------------------------------------------------------------- payment */

	public function process_payment( $order_id ) {
		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return array( 'result' => 'failure' );
		}

		// PayChain takes whole shillings. A total with cents is rounded up.
		$amount = (int) ceil( (float) $order->get_total() );
		if ( $amount < 1 ) {
			wc_add_notice( __( 'This order total cannot be paid with M-PESA.', 'paychain-for-woocommerce' ), 'error' );
			return array( 'result' => 'failure' );
		}

		$payload = array(
			'amount'      => $amount,
			'reference'   => 'WC-' . $order->get_id(),
			/* translators: 1: order number, 2: shop name */
			'description' => sprintf( __( 'Order %1$s at %2$s', 'paychain-for-woocommerce' ), $order->get_order_number(), get_bloginfo( 'name' ) ),
		);

		$phone = preg_replace( '/[^\d+]/', '', (string) $order->get_billing_phone() );
		$customer = array();
		if ( '' !== $phone ) {
			$customer['phone'] = $phone;
		}
		$email = $order->get_billing_email();
		if ( $email ) {
			$customer['email'] = $email;
		}
		$name = trim( $order->get_billing_first_name() . ' ' . $order->get_billing_last_name() );
		if ( '' !== $name ) {
			$customer['name'] = $name;
		}
		if ( $customer ) {
			$payload['customer'] = $customer;
		}

		// PayChain only accepts an https return address; a plain-http test shop
		// just stays on the PayChain page after paying.
		$return_url = $this->get_return_url( $order );
		if ( 0 === strpos( $return_url, 'https://' ) ) {
			$payload['callbackUrl'] = $return_url;
		}

		$ttl = (int) $this->get_option( 'session_ttl' );
		if ( $ttl >= 5 && $ttl <= 10080 ) {
			$payload['expiresInMinutes'] = $ttl;
		}

		$res = $this->api()->create_checkout( $payload );
		if ( is_wp_error( $res ) ) {
			$this->log( 'error', 'Checkout request failed for order ' . $order->get_id() . ': ' . $res->get_error_message() );
		}
		$session = ( ! is_wp_error( $res ) && 201 === $res['status'] && isset( $res['body']['session'] ) ) ? $res['body']['session'] : null;

		if ( ! $session || empty( $session['checkoutUrl'] ) || empty( $session['id'] ) ) {
			if ( ! is_wp_error( $res ) ) {
				$this->log( 'error', sprintf( 'Checkout request for order %d was refused: HTTP %d %s', $order->get_id(), $res['status'], isset( $res['body']['error'] ) ? $res['body']['error'] : '' ) );
			}
			wc_add_notice( __( 'We could not start the M-PESA payment. Please try again, or choose another payment method.', 'paychain-for-woocommerce' ), 'error' );
			return array( 'result' => 'failure' );
		}

		$order->update_meta_data( '_paychain_session_id', (string) $session['id'] );
		$order->update_meta_data( '_paychain_mode', isset( $session['mode'] ) ? (string) $session['mode'] : '' );
		$order->save();
		$order->update_status( 'on-hold', __( 'Waiting for the customer to pay with M-PESA on the PayChain page.', 'paychain-for-woocommerce' ) );
		if ( abs( $amount - (float) $order->get_total() ) > 0.004 ) {
			$order->add_order_note( sprintf( /* translators: 1: order total, 2: rounded amount */ __( 'Order total %1$s was rounded up to whole shillings: the customer pays KES %2$d.', 'paychain-for-woocommerce' ), $order->get_total(), $amount ) );
		}
		$this->log( 'info', sprintf( 'Order %d sent to PayChain checkout %s', $order->get_id(), $session['id'] ) );

		if ( function_exists( 'WC' ) && WC()->cart ) {
			WC()->cart->empty_cart();
		}

		return array(
			'result'   => 'success',
			'redirect' => $session['checkoutUrl'],
		);
	}

	/**
	 * Marks the order paid, once, after checking the amount. Called from the
	 * webhook and from the status checks.
	 *
	 * @param WC_Order $order
	 * @param array    $payment id, amount, currency, mode
	 * @param string   $source  Where the confirmation came from, for the order note.
	 */
	public function complete_order( $order, array $payment, $source ) {
		$order = wc_get_order( $order->get_id() ); // fresh copy: a webhook and a status check can race.
		if ( ! $order || $order->is_paid() ) {
			return true;
		}
		if ( 'KES' !== $order->get_currency() ) {
			return false;
		}
		$expected = (int) ceil( (float) $order->get_total() );
		$amount   = (int) round( (float) ( isset( $payment['amount'] ) ? $payment['amount'] : 0 ) );
		if ( $amount < $expected ) {
			$order->add_order_note( sprintf( /* translators: 1: paid amount, 2: expected amount */ __( 'PayChain reports KES %1$d paid, but this order needs KES %2$d. Not marked paid; check it manually.', 'paychain-for-woocommerce' ), $amount, $expected ) );
			$this->log( 'warning', sprintf( 'Underpayment on order %d: paid %d, expected %d', $order->get_id(), $amount, $expected ) );
			return false;
		}

		$txn = isset( $payment['id'] ) ? (string) $payment['id'] : '';
		$order->payment_complete( $txn );
		$note = sprintf( /* translators: 1: amount, 2: source of confirmation, 3: transaction id */ __( 'PayChain payment received: KES %1$s (%2$s). Payment %3$s.', 'paychain-for-woocommerce' ), number_format_i18n( $amount ), $source, $txn );
		if ( isset( $payment['mode'] ) && 'test' === $payment['mode'] ) {
			$note .= ' ' . __( 'TEST MODE: no real money moved. Do not ship.', 'paychain-for-woocommerce' );
		}
		$order->add_order_note( $note );
		$this->log( 'info', sprintf( 'Order %d marked paid (%s)', $order->get_id(), $source ) );
		return true;
	}

	/** Asks PayChain about an order's checkout session, and completes the order if it was paid. */
	public function sync_order_from_api( $order ) {
		$session_id = $order->get_meta( '_paychain_session_id' );
		if ( ! $session_id ) {
			return false;
		}
		$res = $this->api()->get_checkout( $session_id );
		if ( is_wp_error( $res ) || 200 !== $res['status'] || ! isset( $res['body']['session'] ) ) {
			return false;
		}
		$session = $res['body']['session'];
		if ( ! isset( $session['status'] ) || 'success' !== $session['status'] ) {
			return false;
		}
		if ( ! isset( $session['reference'] ) || 'WC-' . $order->get_id() !== $session['reference'] ) {
			$this->log( 'warning', 'Session reference mismatch for order ' . $order->get_id() );
			return false;
		}
		return $this->complete_order(
			$order,
			array(
				'id'       => $session_id,
				'amount'   => isset( $session['amount'] ) ? $session['amount'] : 0,
				'currency' => isset( $session['currency'] ) ? $session['currency'] : 'KES',
				'mode'     => isset( $session['mode'] ) ? $session['mode'] : '',
			),
			__( 'status check', 'paychain-for-woocommerce' )
		);
	}

	/** Runs every 10 minutes: orders still waiting are checked directly. */
	public function check_pending_orders() {
		if ( '' === trim( (string) $this->get_option( 'api_key' ) ) ) {
			return;
		}
		$orders = wc_get_orders(
			array(
				'status'         => array( 'on-hold' ),
				'payment_method' => $this->id,
				'limit'          => 25,
				'orderby'        => 'date',
				'order'          => 'ASC',
				'date_created'   => '>' . ( time() - 3 * DAY_IN_SECONDS ),
			)
		);
		foreach ( $orders as $order ) {
			$this->sync_order_from_api( $order );
		}
	}

	public function thankyou_page( $order_id ) {
		$order = wc_get_order( $order_id );
		if ( ! $order || $order->is_paid() ) {
			return;
		}
		$this->sync_order_from_api( $order );
		$order = wc_get_order( $order_id );
		if ( $order && ! $order->is_paid() ) {
			echo '<p class="woocommerce-info">' . esc_html__( 'We have not received your M-PESA payment confirmation yet. If you have approved the payment on your phone, this order will update automatically in a moment.', 'paychain-for-woocommerce' ) . '</p>';
		}
	}

	/* ---------------------------------------------------------------- webhook */

	public function handle_webhook() {
		$raw    = (string) file_get_contents( 'php://input' );
		$secret = trim( (string) $this->get_option( 'webhook_secret' ) );
		if ( '' === $secret ) {
			$this->log( 'warning', 'Webhook received but no webhook secret is set in the plugin settings.' );
			$this->respond( 503, 'webhook secret not configured' );
		}

		$sent = isset( $_SERVER['HTTP_X_PAYCHAIN_SIGNATURE'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_X_PAYCHAIN_SIGNATURE'] ) ) : '';
		if ( '' === $sent || ! hash_equals( hash_hmac( 'sha256', $raw, $secret ), $sent ) ) {
			$this->log( 'warning', 'Webhook rejected: invalid signature.' );
			$this->respond( 401, 'invalid signature' );
		}

		$event = json_decode( $raw, true );
		if ( ! is_array( $event ) || empty( $event['event'] ) ) {
			$this->respond( 400, 'bad payload' );
		}
		$name    = (string) $event['event'];
		$payment = isset( $event['data']['payment'] ) && is_array( $event['data']['payment'] ) ? $event['data']['payment'] : null;

		if ( 'webhook.test' === $name ) {
			$this->respond( 200, 'ok' );
		}
		if ( ! $payment || 0 !== strpos( $name, 'payment.collect.' ) ) {
			$this->respond( 200, 'ignored' );
		}
		// A small test payment PayChain staff made from their dashboard.
		if ( isset( $payment['origin'] ) && 'admin_test' === $payment['origin'] ) {
			$this->respond( 200, 'ignored' );
		}

		$reference = isset( $payment['reference'] ) ? (string) $payment['reference'] : '';
		if ( ! preg_match( '/^WC-(\d+)$/', $reference, $m ) ) {
			$this->respond( 200, 'ignored' ); // not one of this shop's orders
		}
		$order = wc_get_order( (int) $m[1] );
		if ( ! $order || $order->get_payment_method() !== $this->id ) {
			$this->respond( 200, 'ignored' );
		}

		if ( 'payment.collect.succeeded' === $name ) {
			if ( isset( $payment['status'] ) && 'success' === $payment['status'] ) {
				$this->complete_order( $order, $payment, __( 'webhook', 'paychain-for-woocommerce' ) );
			}
		} elseif ( 'payment.collect.failed' === $name ) {
			$reason = isset( $payment['failureReason'] ) && $payment['failureReason'] ? (string) $payment['failureReason'] : __( 'the prompt was cancelled or timed out', 'paychain-for-woocommerce' );
			$order->add_order_note( sprintf( /* translators: %s: reason */ __( 'A PayChain payment attempt failed: %s. The customer can try again on the payment page.', 'paychain-for-woocommerce' ), $reason ) );
		}
		$this->respond( 200, 'ok' );
	}

	private function respond( $status, $message ) {
		status_header( $status );
		echo esc_html( $message );
		exit;
	}
}
