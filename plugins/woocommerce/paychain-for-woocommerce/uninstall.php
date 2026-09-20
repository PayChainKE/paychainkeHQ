<?php
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}
delete_option( 'woocommerce_paychain_settings' );
wp_clear_scheduled_hook( 'paychain_wc_check_pending_orders' );
