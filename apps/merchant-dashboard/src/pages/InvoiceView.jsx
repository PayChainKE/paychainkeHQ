import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ValidatedInput } from '../components/ValidatedInput';
import paychainLogoWhite from '../assets/paychain-logo-white.png';
import kraLogo from '../assets/kra-logo.png';
import { formatKES } from '../utils/formatCurrency';

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export default function InvoiceView() {
  const { publicToken } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [phone, setPhone] = useState('');
  const [isPaying, setIsPaying] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [justPaid, setJustPaid] = useState(false);
  const pollIntervalRef = useRef(null);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/invoices/public/${publicToken}`);
        if (res.data.success) setInvoice(res.data.invoice);
      } catch (err) {
        setError(err.response?.data?.error || 'Invoice not found.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchInvoice();
  }, [publicToken]);

  const isPaid = invoice?.status === 'paid' || invoice?.paymentLinkStatus === 'paid';
  const fmt = (n) => {
    const currency = invoice?.currency || 'KES';
    if (currency === 'KES') return formatKES(n);
    return `${currency} ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    if (!phone || !invoice?.payLinkId) return;
    setIsPaying(true);
    setPaymentError('');
    setPaymentStatus('Initiating secure STK Push...');

    try {
      const res = await axios.post(`${API_URL}/api/transactions/payment-link/${invoice.payLinkId}/pay`, { phone });
      if (res.data.success && res.data.checkoutRequestId) {
        setPaymentStatus('Awaiting M-PESA PIN on your phone...');

        let attempts = 0;
        const maxAttempts = 20 // 20 * 3s = 60s
        pollIntervalRef.current = setInterval(async () => {
          attempts++
          try {
            const statusRes = await axios.get(`${API_URL}/api/transactions/public-stk-status/${res.data.checkoutRequestId}`);
            if (statusRes.data.status === 'success') {
              clearInterval(pollIntervalRef.current);
              setPaymentStatus('');
              setIsPaying(false);
              setJustPaid(true);
            } else if (statusRes.data.status === 'failed') {
              clearInterval(pollIntervalRef.current);
              setPaymentError(statusRes.data.resultDesc || 'Payment was cancelled or declined.');
              setPaymentStatus('');
              setIsPaying(false);
            } else if (attempts >= maxAttempts) {
              clearInterval(pollIntervalRef.current);
              setPaymentError("We couldn't confirm your payment. If M-PESA deducted your money, it will still reach the merchant — check your M-PESA messages.");
              setPaymentStatus('');
              setIsPaying(false);
            }
          } catch (e) {
            console.error('STK status poll error', e);
          }
        }, 3000)
      }
    } catch (err) {
      setPaymentError(err.response?.data?.error || 'Failed to trigger payment on your phone.');
      setIsPaying(false);
      setPaymentStatus('');
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
          <h2 className="font-headline text-2xl text-on-surface tracking-tight mb-2">Invoice not found</h2>
          <p className="text-on-surface-variant font-medium mb-8">{error}</p>
          <Link to="/" className="inline-block px-6 py-3 bg-primary text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:bg-primary/90 transition-all">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4 py-12">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] -mr-40 -mt-40"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[100px] -ml-40 -mb-40"></div>
      </div>

      <div className="w-full max-w-xl bg-white rounded-[40px] shadow-2xl overflow-hidden relative z-10 border border-outline-variant/10">
        {/* Header Band */}
        <div className="bg-[#06201B] p-8 md:p-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/10 rounded-full -mr-24 -mt-24 blur-3xl pointer-events-none"></div>
          <div className="relative z-10 flex items-start justify-between mb-8">
            <img src={paychainLogoWhite} alt="PayChain" className="h-8 object-contain" />
            <div className="text-right">
              <p className="text-[9px] text-[#5EFEB3] font-black uppercase tracking-[0.3em] mb-1">Invoice</p>
              <p className="font-headline font-black text-white text-lg">#{invoice.invoiceNumber}</p>
            </div>
          </div>
          <h2 className="relative z-10 font-headline text-2xl text-white mb-1">{invoice.businessName}</h2>
          {(invoice.trader?.address || invoice.trader?.email || invoice.trader?.phone) && (
            <p className="relative z-10 text-[11px] text-white/40 font-medium mb-2">
              {[invoice.trader.address, invoice.trader.email, invoice.trader.phone].filter(Boolean).join(' · ')}
            </p>
          )}
          <p className="relative z-10 text-sm text-white/50 font-medium">Billed to {invoice.customer?.name}</p>
        </div>

        {/* Amount + Status */}
        <div className="bg-surface-container-lowest p-8 md:p-10 flex flex-col items-center border-b border-outline-variant/10">
          {isPaid ? (
            <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center text-white mb-4">
              <span className="material-symbols-outlined text-3xl">check_circle</span>
            </div>
          ) : (
            <p className="text-sm font-medium text-on-surface-variant mb-2">Amount Due</p>
          )}
          <h1 className="font-headline text-5xl md:text-6xl text-primary tracking-tighter tabular-nums mb-2">
            {fmt(invoice.total)}
          </h1>
          {isPaid ? (
            <span className="px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-widest">Paid</span>
          ) : invoice.dueDate ? (
            <p className="text-xs text-on-surface-variant font-bold uppercase tracking-widest opacity-60">
              Due {new Date(invoice.dueDate).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          ) : null}
        </div>

        {/* Line Items */}
        <div className="p-8 md:p-10 border-b border-outline-variant/10">
          <h3 className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest opacity-60 mb-4">Itemized Breakdown</h3>
          <div className="space-y-3">
            {(invoice.items || []).map((item, i) => {
              const gross = (item.qty || 0) * (item.price || 0);
              const rate = item.discountRate || 0;
              const lineDiscount = rate > 0 ? gross * (rate / 100) : 0;
              return (
              <div key={i} className="flex items-center justify-between gap-4 py-2 border-b border-outline-variant/5 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-primary truncate">
                    {item.description || '—'}
                    {invoice.etims?.status === 'signed' && item.taxTyCd && (
                      <span className="ml-1.5 text-[9px] font-black text-emerald-700/70 align-middle">[{item.taxTyCd}]</span>
                    )}
                  </p>
                  <p className="text-[11px] text-on-surface-variant opacity-60">{item.qty} × {fmt(item.price)}</p>
                  {rate > 0 && (
                    <p className="text-[11px] text-emerald-700/70 font-medium">Discount {rate}% (-{fmt(lineDiscount)})</p>
                  )}
                </div>
                <p className="text-sm font-bold text-primary shrink-0">{fmt(gross - lineDiscount)}</p>
              </div>
              );
            })}
          </div>
          <div className="pt-4 mt-2 border-t-2 border-outline-variant/10 space-y-1.5">
            {invoice.discount > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-on-surface-variant opacity-60">Subtotal</p>
                  <p className="text-sm font-bold text-primary">{fmt(invoice.subtotal)}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-on-surface-variant opacity-60">Discount</p>
                  <p className="text-sm font-bold text-primary">-{fmt(invoice.discount)}</p>
                </div>
              </>
            )}
            <div className="flex items-center justify-between">
              <p className="text-sm font-black text-primary uppercase tracking-widest">Total</p>
              <p className="font-headline text-xl font-black text-primary">{fmt(invoice.total)}</p>
            </div>
          </div>
          {invoice.notes && (
            <div className="mt-6 p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/10">
              <p className="text-[9px] text-on-surface-variant font-black uppercase tracking-widest opacity-60 mb-1.5">Notes</p>
              <p className="text-xs text-on-surface-variant whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
          {invoice.qrCodeDataUri && (
            <div className="mt-6 flex flex-col items-center gap-2">
              <div className="p-2.5 bg-white border border-outline-variant/20 rounded-2xl shadow-sm">
                <img src={invoice.qrCodeDataUri} alt="Scan to view this invoice" className="w-28 h-28 object-contain" />
              </div>
              <p className="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest opacity-40">Unique to invoice #{invoice.invoiceNumber}</p>
            </div>
          )}
        </div>

        {/* KRA eTIMS fiscal receipt — required content per the OSCU/VSCU
            Technical Specification (items 3 and 6.23): trader PIN, buyer
            PIN, tax-rate breakdown, and the SCU's own signature/QR must all
            appear on the document the buyer receives. Only rendered when
            this invoice was actually signed by KRA — untouched otherwise. */}
        {invoice.etims?.status === 'signed' && (
          <div className="p-8 md:p-10 border-b border-outline-variant/10 bg-emerald-50/40">
            <div className="flex items-center justify-center gap-2 mb-5">
              <img src={kraLogo} alt="KRA" className="h-6 w-auto object-contain" />
              <h3 className="text-xs font-black uppercase tracking-widest text-emerald-800">KRA Electronic Tax Invoice</h3>
            </div>
            <div className="space-y-1.5 text-xs text-on-surface-variant mb-4">
              <div className="flex justify-between"><span>Trader</span><span className="font-bold text-primary">{invoice.trader?.name}</span></div>
              <div className="flex justify-between"><span>Trader PIN</span><span className="font-bold text-primary">{invoice.trader?.pin}</span></div>
              {invoice.trader?.address && <div className="flex justify-between"><span>Address</span><span className="font-medium">{invoice.trader.address}</span></div>}
              {invoice.customer?.kraPin && <div className="flex justify-between"><span>Buyer PIN</span><span className="font-bold text-primary">{invoice.customer.kraPin}</span></div>}
              <div className="flex justify-between"><span>CU Invoice No.</span><span className="font-bold text-primary">{invoice.etims.cuInvoiceNumber}</span></div>
              <div className="flex justify-between"><span>Items</span><span className="font-medium">{invoice.etims.totItemCnt}</span></div>
              <div className="flex justify-between"><span>Means of Payment</span><span className="font-medium">{invoice.etims.pmtTyLabel}</span></div>
              {invoice.etims.signedAt && (
                <div className="flex justify-between"><span>Signed</span><span className="font-medium">{new Date(invoice.etims.signedAt).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'medium' })}</span></div>
              )}
            </div>
            {invoice.etims.taxBreakdown?.length > 0 && (
              <table className="w-full text-[11px] mb-4 border-t border-emerald-900/10 pt-2">
                <thead>
                  <tr className="text-emerald-900/60 font-black uppercase tracking-wider">
                    <td className="py-1">Rate</td><td className="py-1 text-right">Taxable</td><td className="py-1 text-right">Tax</td>
                  </tr>
                </thead>
                <tbody>
                  {invoice.etims.taxBreakdown.map((row) => (
                    <tr key={row.code} className="text-on-surface-variant">
                      <td className="py-0.5">{row.label}</td>
                      <td className="py-0.5 text-right">{fmt(row.taxblAmt)}</td>
                      <td className="py-0.5 text-right">{fmt(row.taxAmt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="text-[10px] text-on-surface-variant/70 leading-relaxed border-t border-emerald-900/10 pt-3 break-all">
              <div>Internal Data: {invoice.etims.formattedInternalData}</div>
              <div>Receipt Signature: {invoice.etims.formattedSignature}</div>
            </div>
            {invoice.etims.qrDataUri && (
              <div className="mt-4 flex flex-col items-center gap-1.5">
                <img src={invoice.etims.qrDataUri} alt="KRA receipt verification QR" className="w-24 h-24 object-contain bg-white p-1.5 rounded-xl border border-emerald-900/10" />
                <p className="text-[9px] text-emerald-800/60 font-bold uppercase tracking-widest">Scan to verify with KRA</p>
              </div>
            )}
          </div>
        )}

        {/* Pay */}
        {!isPaid && !justPaid && invoice.payLinkId && (
          <div className="p-8 md:p-10">
            <form onSubmit={handlePayment} className="w-full space-y-6">
              <div className="space-y-3">
                <label className="text-[11px] font-black uppercase tracking-widest text-primary/60 pl-1 block text-left">
                  Your M-PESA Number
                </label>
                <div className="relative group">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-primary/40 flex items-center justify-center">
                    <span className="material-symbols-outlined text-lg">smartphone</span>
                  </div>
                  <ValidatedInput
                    kind="phoneKE"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0712 345 678"
                    className="w-full bg-surface-container-low border border-outline-variant/5 rounded-2xl md:rounded-3xl py-4 md:py-5 pl-14 pr-6 text-xl md:text-2xl font-headline text-primary focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none"
                  />
                </div>
              </div>

              {paymentStatus && !paymentError && (
                <div className="p-4 bg-emerald-50 text-emerald-800 rounded-2xl text-sm font-medium text-center border border-emerald-100 flex flex-col items-center gap-2">
                  {isPaying && <div className="w-5 h-5 border-2 border-emerald-800/30 border-t-emerald-800 rounded-full animate-spin"></div>}
                  {paymentStatus}
                </div>
              )}

              {paymentError && (
                <div className="p-4 bg-error/10 text-error rounded-2xl text-sm font-medium text-center border border-error/20 flex flex-col items-center gap-2">
                  <span className="material-symbols-outlined text-lg">error</span>
                  {paymentError}
                </div>
              )}

              <button
                type="submit"
                disabled={isPaying || !phone}
                className="w-full bg-[#00351D] text-white py-5 rounded-3xl font-bold text-lg shadow-[0_10px_30px_rgba(0,53,29,0.3)] hover:shadow-[0_15px_40px_rgba(0,53,29,0.4)] active:scale-[0.98] transition-all flex items-center justify-center gap-3 border border-white/5 disabled:opacity-50 disabled:grayscale group"
              >
                {!isPaying && <span className="material-symbols-outlined text-emerald-400 group-hover:scale-110 transition-transform">send_to_mobile</span>}
                Pay with M-PESA
              </button>
            </form>

            <div className="mt-8 flex items-center justify-center gap-2 text-on-surface-variant/50">
              <span className="material-symbols-outlined text-[14px]">lock</span>
              <p className="text-[9px] font-black uppercase tracking-widest">Secured by PayChain</p>
            </div>
          </div>
        )}

        {justPaid && (
          <div className="p-8 md:p-10 text-center">
            <p className="text-sm font-bold text-emerald-700">Check your phone to complete the M-PESA payment.</p>
          </div>
        )}
      </div>
    </div>
  );
}
