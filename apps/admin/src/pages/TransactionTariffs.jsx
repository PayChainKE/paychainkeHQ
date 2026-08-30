import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/layout/Layout';
import api from '../api/api';
import { formatKES } from '../utils/formatCurrency';

const Th = ({ children, className = '' }) => (
  <th className={`px-3 py-3 text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60 ${className}`}>{children}</th>
);

const RAIL_ICONS = {
  rtgs: 'account_balance',
  pesalink: 'bolt',
  mobile_withdrawal: 'smartphone',
  lipa_na_mpesa: 'point_of_sale',
  kplc_postpaid: 'electric_bolt',
  kplc_prepaid: 'electric_bolt',
  ncwsc: 'water_drop',
  internet: 'wifi',
  rent: 'home_work',
};

// Every fee tariff currently live on the platform — read straight from the
// backend's own config files (see controllers/tariffController.js), so this
// page can never show a stale or hand-copied number. Grouped exactly like
// the platform's own money-in / invoices / money-out / flat-stream split.
const TransactionTariffs = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchTariffs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/admin/tariffs');
      if (res.data?.success) setData(res.data.data);
      else setError(res.data?.error || 'Could not load tariffs.');
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not load tariffs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTariffs(); }, [fetchTariffs]);

  return (
    <Layout>
      <div className="space-y-8 pb-12">
        <div className="relative overflow-hidden rounded-3xl bg-[#0B0F1A] border border-[#1E2536] shadow-[0_30px_80px_-20px_rgba(6,10,20,0.8)] p-6 md:p-10">
          <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[100px]"></div>
          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <span className="material-symbols-outlined text-emerald-400 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>request_quote</span>
              <p className="text-2xs font-bold uppercase tracking-[0.3em] text-emerald-300">Transaction Tariffs · Live Rate Card</p>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tighter font-headline leading-tight">
              Every fee, on every rail, right now
            </h2>
            <p className="text-xs md:text-sm text-emerald-100/60 mt-2 max-w-2xl font-body">
              Read directly from the platform's own pricing config — PayChain's kept margin next to the real NCBA/Safaricom cost on every rail, so this can never drift from what's actually charged.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-40 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 animate-pulse" />)}
          </div>
        ) : error ? (
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-10 text-center text-error text-sm">{error}</div>
        ) : data && (
          <>
            {/* ── Money In ──────────────────────────────────────────── */}
            <Section title="Money In" subtitle="STK Push · QR · Payment Links · Self-funded wallet top-ups" icon="south_west" accent="emerald">
              <p className="px-5 pt-4 text-2xs text-on-surface-variant/60 leading-relaxed">{data.moneyIn.note}</p>
              <div className="p-5 pt-3">
                <BandTable
                  rows={data.moneyIn.bands}
                  columns={[
                    { key: 'safaricomFee', label: "Safaricom Fee (customer, pass-through)" },
                    { key: 'paychainFee', label: 'PayChain Fee (customer, revenue)', accent: true },
                  ]}
                />
                <p className="text-2xs text-on-surface-variant/50 mt-3">Raw Paybill deposits / generic NCBA collections: <span className="font-bold text-on-surface">KES 0</span> to everyone — no PayChain fee tracked on this rail.</p>
              </div>
            </Section>

            {/* ── Invoices ──────────────────────────────────────────── */}
            <Section title="Invoices" subtitle="The one dual-charge product" icon="receipt_long" accent="violet">
              <p className="px-5 pt-4 text-2xs text-on-surface-variant/60 leading-relaxed">{data.invoices.note}</p>
              <div className="px-5 pt-3">
                <div className="inline-flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-xl px-4 py-2.5">
                  <span className="material-symbols-outlined text-violet-600 text-lg">storefront</span>
                  <span className="text-xs font-bold text-violet-800">Merchant fee: flat {formatKES(data.invoices.merchantFlatFee)} on every invoice</span>
                </div>
              </div>
              <div className="p-5 pt-3">
                <BandTable
                  rows={data.invoices.customerMarkupBands}
                  columns={[{ key: 'fee', label: 'Customer Markup', accent: true }]}
                />
              </div>
            </Section>

            {/* ── Money Out ─────────────────────────────────────────── */}
            <Section title="Money Out" subtitle="Merchant pays real third-party cost + PayChain's margin, on every rail" icon="north_east" accent="blue">
              <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
                {data.moneyOut.rails.map((rail) => (
                  <div key={rail.id} className={`rounded-xl border overflow-hidden ${rail.dormant ? 'border-outline-variant/20 opacity-60' : 'border-outline-variant/20'}`}>
                    <div className="flex items-center gap-2 px-4 py-3 bg-surface-container-low/60 border-b border-outline-variant/10">
                      <span className="material-symbols-outlined text-blue-600 text-lg">{RAIL_ICONS[rail.id] || 'payments'}</span>
                      <span className="text-xs font-bold text-on-surface">{rail.label}</span>
                      {rail.dormant && <span className="ml-auto text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50 bg-surface-container px-2 py-0.5 rounded-full">Not yet live</span>}
                    </div>
                    {rail.shape === 'flat' ? (
                      <div className="p-4 grid grid-cols-3 gap-2 text-center">
                        <FlatStat label="3rd-Party" value={rail.baseCost} />
                        <FlatStat label="PayChain" value={rail.serviceFee} accent />
                        <FlatStat label="Total" value={rail.totalFee} bold />
                      </div>
                    ) : (
                      <div className="p-2">
                        <BandTable
                          dense
                          rows={rail.bands}
                          columns={[
                            { key: 'baseCost', label: '3rd-Party' },
                            { key: 'serviceFee', label: 'PayChain', accent: true },
                            { key: 'totalFee', label: 'Total', bold: true },
                          ]}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>

            {/* ── Flat Streams ──────────────────────────────────────── */}
            <Section title="Flat Streams" subtitle="Flat PayChain margins, not tied to a tiered cost sheet" icon="toll" accent="amber">
              <p className="px-5 pt-4 text-2xs text-on-surface-variant/60 leading-relaxed">{data.flatStreams.note}</p>
              <div className="p-5 pt-3 space-y-2">
                {data.flatStreams.streams.map((s) => (
                  <div key={s.id} className="flex items-center justify-between bg-surface-container-low/60 rounded-lg px-4 py-3">
                    <span className="text-xs font-bold text-on-surface">{s.label}</span>
                    <span className="text-sm font-bold text-emerald-700 tabular-nums">{formatKES(s.flatFee)}</span>
                  </div>
                ))}
              </div>
            </Section>
          </>
        )}
      </div>
    </Layout>
  );
};

const ACCENT = {
  emerald: { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-600' },
  violet: { text: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200', icon: 'text-violet-600' },
  blue: { text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-600' },
  amber: { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-600' },
};

const Section = ({ title, subtitle, icon, accent, children }) => {
  const a = ACCENT[accent] || ACCENT.emerald;
  return (
    <section className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 overflow-hidden shadow-editorial">
      <div className="flex items-center gap-3 px-5 pt-5">
        <div className={`w-9 h-9 rounded-lg ${a.bg} ${a.border} border flex items-center justify-center shrink-0`}>
          <span className={`material-symbols-outlined text-lg ${a.icon}`}>{icon}</span>
        </div>
        <div>
          <h3 className="text-base font-bold text-on-surface tracking-tight font-headline">{title}</h3>
          <p className="text-2xs text-on-surface-variant/60">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
};

const BandTable = ({ rows, columns, dense }) => (
  <div className="overflow-x-auto custom-scrollbar rounded-lg border border-outline-variant/10">
    <table className="w-full text-left font-body">
      <thead>
        <tr className="bg-surface-container-low/50">
          <Th>Amount (KES)</Th>
          {columns.map((c) => <Th key={c.key} className="text-right">{c.label}</Th>)}
        </tr>
      </thead>
      <tbody className="text-xs">
        {rows.map((r, i) => (
          <tr key={i} className={i % 2 === 1 ? 'bg-surface-container-low/20' : ''}>
            <td className={`px-3 ${dense ? 'py-1.5' : 'py-2'} border-b border-outline-variant/5 font-mono text-on-surface-variant/80 whitespace-nowrap`}>{r.label}</td>
            {columns.map((c) => (
              <td key={c.key} className={`px-3 ${dense ? 'py-1.5' : 'py-2'} border-b border-outline-variant/5 text-right tabular-nums ${c.accent ? 'font-bold text-emerald-700' : c.bold ? 'font-bold text-on-surface' : 'text-on-surface-variant/80'}`}>
                {formatKES(r[c.key] ?? 0)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const FlatStat = ({ label, value, accent, bold }) => (
  <div>
    <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50 mb-1">{label}</p>
    <p className={`text-sm tabular-nums ${accent ? 'font-bold text-emerald-700' : bold ? 'font-bold text-on-surface' : 'text-on-surface-variant/80'}`}>{formatKES(value)}</p>
  </div>
);

export default TransactionTariffs;
