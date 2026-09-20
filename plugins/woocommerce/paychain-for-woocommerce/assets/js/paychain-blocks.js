/* Registers PayChain in the block-based checkout. No build step needed. */
( function () {
	var registry = window.wc && window.wc.wcBlocksRegistry;
	var settingsApi = window.wc && window.wc.wcSettings;
	var el = window.wp && window.wp.element;
	var html = window.wp && window.wp.htmlEntities;
	if ( ! registry || ! settingsApi || ! el || ! html ) {
		return;
	}

	var settings = settingsApi.getSetting( 'paychain_data', {} );
	var title = html.decodeEntities( settings.title || '' ) || 'M-PESA (PayChain)';
	var description = html.decodeEntities( settings.description || '' );

	var Content = function () {
		return el.createElement( 'div', null, description );
	};
	var Label = function ( props ) {
		var PaymentMethodLabel = props.components.PaymentMethodLabel;
		return el.createElement( PaymentMethodLabel, { text: title } );
	};

	registry.registerPaymentMethod( {
		name: 'paychain',
		label: el.createElement( Label, null ),
		content: el.createElement( Content, null ),
		edit: el.createElement( Content, null ),
		canMakePayment: function () {
			return true;
		},
		ariaLabel: title,
		supports: { features: settings.supports || [ 'products' ] },
	} );
} )();
