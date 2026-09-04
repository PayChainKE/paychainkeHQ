import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { formatKES } from '../utils/formatCurrency';
import paychainLogo from '../../images/logo.png';
import paychainMark from '../assets/paychain-mark.png';

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// The customer-facing "storefront" screen opened by the data-paychain-checkout
// embed button — picks products/quantities, then hands off to the existing,
// already-built /pay/:linkId flow (PaymentPage.jsx) to actually pay, once a
// PaymentLink has been minted for the finalized cart total. See
// backend/controllers/transactionController.js's checkoutPageCheckout.
export default function CartCheckoutPage() {
  const { pageId } = useParams();
  const navigate = useNavigate();

  const [page, setPage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [quantities, setQuantities] = useState({});
  const [buyerName, setBuyerName] = useState('');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  useEffect(() => {
    const fetchPage = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/transactions/checkout-page/${pageId}/public`);
        if (res.data.success) setPage(res.data);
      } catch (err) {
        setError(err.response?.data?.error || 'This checkout page is not available.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchPage();
  }, [pageId]);

  const setQty = (itemId, qty, cap) => {
    const ceiling = cap == null ? 100 : Math.min(100, cap);
    setQuantities((prev) => ({ ...prev, [itemId]: Math.max(0, Math.min(ceiling, qty)) }));
  };

  const cartLines = useMemo(() => {
    if (!page) return [];
    return page.items
      .map((item) => ({ ...item, quantity: quantities[item.itemId] || 0 }))
      .filter((line) => line.quantity > 0);
  }, [page, quantities]);

  const subtotal = useMemo(
    () => cartLines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
    [cartLines]
  );

  const nameRequired = !!page?.collectBuyerName;
  const canCheckout = cartLines.length > 0 && (!nameRequired || buyerName.trim().length > 0);

  const handleCheckout = async () => {
    if (!canCheckout) return;
    setIsCheckingOut(true);
    setCheckoutError('');
    try {
      const res = await axios.post(`${API_URL}/api/transactions/checkout-page/${pageId}/checkout`, {
        items: cartLines.map((line) => ({ itemId: line.itemId, quantity: line.quantity })),
        ...(nameRequired ? { buyerName: buyerName.trim() } : {}),
      });
      if (res.data.success && res.data.linkId) {
        navigate(`/pay/${res.data.linkId}`);
      }
    } catch (err) {
      setCheckoutError(err.response?.data?.error || 'Could not start checkout. Please try again.');
      setIsCheckingOut(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="bg-white p-8 md:p-10 rounded-[32px] shadow-2xl max-w-md w-full text-center border border-outline-variant/10">
          <div className="w-20 h-20 mx-auto bg-error/10 rounded-full flex items-center justify-center text-error mb-6">
            <span className="material-symbols-outlined text-4xl">error</span>
          </div>
          <h2 className="font-headline text-2xl text-on-surface tracking-tight mb-2">Oops! Page not found</h2>
          <p className="text-on-surface-variant font-medium mb-8">{error}</p>
          <Link to="/" className="inline-block px-6 py-3 bg-primary text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:bg-primary/90 transition-all">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4 py-10">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] -mr-40 -mt-40"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[100px] -ml-40 -mb-40"></div>
      </div>

      <div className="w-full max-w-xl bg-white rounded-[40px] shadow-2xl overflow-hidden relative z-10 border border-outline-variant/10">
        <div className="p-8 md:p-10 flex flex-col items-center text-center border-b border-surface-container">
          <div className="mb-6 flex justify-center w-full">
            <img src={paychainLogo} alt="PayChain Logo" className="h-10 object-contain contrast-125 saturate-150" />
          </div>
          <h2 className="font-headline text-2xl text-on-surface mb-1">{page.title}</h2>
          {page.description && <p className="text-sm text-on-surface-variant mb-1 max-w-sm">{page.description}</p>}
          <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] opacity-70 mt-1">
            {page.merchantName} · PayChain Verified Business
          </p>
        </div>

        <div className="p-6 md:p-8 space-y-3">
          {page.items.map((item) => {
            const qty = quantities[item.itemId] || 0;
            const soldOut = item.remaining === 0;
            return (
              <div
                key={item.itemId}
                className={`flex items-center gap-4 p-4 rounded-2xl border transition-colors ${soldOut ? 'border-outline-variant/10 bg-surface-container-lowest opacity-60' : qty > 0 ? 'border-primary/30 bg-primary/[0.03]' : 'border-outline-variant/10 bg-surface-container-lowest'}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-on-surface truncate">{item.name}</p>
                  {item.description && <p className="text-xs text-on-surface-variant truncate">{item.description}</p>}
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-sm font-semibold text-primary tabular-nums">{formatKES(item.unitPrice)}</p>
                    {soldOut && <span className="text-[10px] font-black uppercase tracking-widest text-error">Sold out</span>}
                    {!soldOut && item.remaining != null && item.remaining <= 10 && (
                      <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">{item.remaining} left</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setQty(item.itemId, qty - 1, item.remaining)}
                    disabled={qty === 0}
                    className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high disabled:opacity-30 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">remove</span>
                  </button>
                  <span className="w-6 text-center font-bold tabular-nums text-on-surface">{qty}</span>
                  <button
                    type="button"
                    onClick={() => setQty(item.itemId, qty + 1, item.remaining)}
                    disabled={soldOut || (item.remaining != null && qty >= item.remaining)}
                    className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 disabled:opacity-30 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">add</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {page.collectBuyerName && (
          <div className="px-6 md:px-8 pb-2">
            <label className="text-[11px] font-black uppercase tracking-widest text-primary/60 pl-1 block text-left mb-2">
              Your Name
            </label>
            <input
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              placeholder="Full name"
              className="w-full bg-surface-container-low border border-outline-variant/10 rounded-2xl py-3.5 px-4 text-base font-medium text-on-surface focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none"
            />
          </div>
        )}

        <div className="bg-surface-container-lowest p-8 md:p-10 flex flex-col items-center border-t border-surface-container">
          <p className="text-sm font-medium text-on-surface-variant mb-2">Cart Total</p>
          <h1 className="font-headline text-5xl md:text-6xl text-primary tracking-tighter tabular-nums mb-8">
            {formatKES(subtotal)}
          </h1>

          {checkoutError && (
            <div className="w-full mb-6 p-4 bg-error/10 text-error rounded-2xl text-sm font-medium text-center border border-error/20 flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-lg">error</span>
              {checkoutError}
            </div>
          )}

          <button
            type="button"
            onClick={handleCheckout}
            disabled={!canCheckout || isCheckingOut}
            className="w-full bg-[#00351D] text-white py-5 rounded-3xl font-bold text-lg shadow-[0_10px_30px_rgba(0,53,29,0.3)] hover:shadow-[0_15px_40px_rgba(0,53,29,0.4)] active:scale-[0.98] transition-all flex items-center justify-center gap-3 border border-white/5 disabled:opacity-50 disabled:grayscale group"
          >
            {isCheckingOut ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <span className="material-symbols-outlined text-emerald-400 group-hover:scale-110 transition-transform">shopping_cart_checkout</span>
            )}
            {cartLines.length === 0 ? 'Add items to your cart' : nameRequired && !buyerName.trim() ? 'Enter your name to continue' : 'Proceed to Pay'}
          </button>

          <div className="mt-8 flex items-center gap-2 text-on-surface-variant/50">
            <img src={paychainMark} alt="" className="h-3 w-auto object-contain opacity-70" />
            <p className="text-[9px] font-black uppercase tracking-widest">Secured by PayChain</p>
          </div>
        </div>
      </div>
    </div>
  );
}
