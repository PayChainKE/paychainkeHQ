import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/api';

// One search box across merchants, transactions and developers — jump
// straight to a record by name, email, phone, reference or account code
// instead of navigating into the right page and filtering there.
// Debounced, and a stale response arriving after a newer one can never
// clobber it (guarded by a request-sequence counter).
const GlobalSearch = () => {
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  const seq = useRef(0);
  const navigate = useNavigate();

  const runSearch = useCallback((term) => {
    const mySeq = ++seq.current;
    setLoading(true);
    api.get('/api/admin/search', { params: { q: term } })
      .then((res) => { if (seq.current === mySeq) setResults(res.data); })
      .catch(() => { if (seq.current === mySeq) setResults(null); })
      .finally(() => { if (seq.current === mySeq) setLoading(false); });
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) { setResults(null); return undefined; }
    const id = setTimeout(() => runSearch(q.trim()), 250);
    return () => clearTimeout(id);
  }, [q, runSearch]);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const go = (to) => { setOpen(false); setQ(''); setResults(null); navigate(to); };

  const hasResults = results && (results.merchants.length || results.transactions.length || results.developers.length);

  return (
    <div className="relative w-full max-w-xs" ref={ref}>
      <div className="relative">
        <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-lg text-on-surface-variant/40 pointer-events-none">search</span>
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search merchants, transactions, developers…"
          className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-outline-variant/30 bg-surface-container-low text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 top-10 z-50 w-96 max-w-[90vw] bg-white rounded-xl shadow-2xl border border-outline-variant/20 overflow-hidden">
          {loading && !results ? (
            <div className="p-5 text-center text-xs text-on-surface-variant/40">Searching…</div>
          ) : !hasResults ? (
            <div className="p-5 text-center text-xs text-on-surface-variant/40">No matches for "{q.trim()}".</div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {results.merchants.length > 0 && (
                <ResultGroup title="Merchants">
                  {results.merchants.map((m) => (
                    <ResultRow key={m.id} icon="storefront" title={m.businessName || m.email} subtitle={[m.email, m.phone].filter(Boolean).join(' · ')} onClick={() => go(`/merchants?open=${m.id}`)} />
                  ))}
                </ResultGroup>
              )}
              {results.transactions.length > 0 && (
                <ResultGroup title="Transactions">
                  {results.transactions.map((t) => (
                    <ResultRow key={t.id} icon="receipt_long" title={t.reference} subtitle={`${t.type || ''} · KES ${t.amount?.toLocaleString?.() ?? t.amount} · ${t.status}`} onClick={() => go(`/transaction-audit?q=${encodeURIComponent(t.reference)}`)} />
                  ))}
                </ResultGroup>
              )}
              {results.developers.length > 0 && (
                <ResultGroup title="Developers">
                  {results.developers.map((d) => (
                    <ResultRow key={d.id} icon="code" title={d.companyName} subtitle={d.email} onClick={() => go(`/developers?q=${encodeURIComponent(d.companyName || d.email)}`)} />
                  ))}
                </ResultGroup>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ResultGroup = ({ title, children }) => (
  <div className="py-1">
    <p className="px-4 pt-2 pb-1 text-2xs font-bold uppercase tracking-widest text-on-surface-variant/40">{title}</p>
    {children}
  </div>
);

const ResultRow = ({ icon, title, subtitle, onClick }) => (
  <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-container-low transition-colors">
    <span className="material-symbols-outlined text-lg text-on-surface-variant/50 shrink-0">{icon}</span>
    <div className="min-w-0">
      <p className="text-xs font-bold text-on-surface truncate">{title}</p>
      {subtitle && <p className="text-2xs text-on-surface-variant/50 truncate">{subtitle}</p>}
    </div>
  </button>
);

export default GlobalSearch;
