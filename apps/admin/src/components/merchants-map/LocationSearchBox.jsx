import React, { useState, useEffect, useRef } from 'react';
import api from '../../api/api';

// Proxied through our own backend (see adminController.js's geocodeSearch)
// rather than calling Nominatim directly — the public instance doesn't
// send CORS headers, so a direct browser fetch fails silently with an
// empty result set and no visible error. Restricted to Kenya server-side.
// Debounced so a normal typing cadence stays well under the backend's own
// rate limit.
const DEBOUNCE_MS = 500;
const MIN_QUERY_LEN = 3;

// Nominatim's display_name is a full verbose address ("Juja, Kiambu
// County, Central Kenya, 01000, Kenya") — trimmed to the first couple of
// segments for a usable area-label default, still fully editable after.
function shortLabel(displayName) {
  return displayName.split(',').slice(0, 2).join(',').trim();
}

export default function LocationSearchBox({ onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const abortRef = useRef(null);
  const boxRef = useRef(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY_LEN) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await api.get('/api/admin/geocode', { params: { q }, signal: controller.signal });
        setResults(Array.isArray(res.data?.results) ? res.data.results : []);
        setOpen(true);
      } catch (e) {
        if (e.code !== 'ERR_CANCELED') setResults([]);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function pick(result) {
    onSelect({
      lat: Number(result.lat),
      lng: Number(result.lon),
      label: shortLabel(result.display_name),
    });
    setQuery(result.display_name);
    setOpen(false);
    setResults([]);
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant/40 text-[18px]">search</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search a road, market, estate, or town in Kenya..."
          className="w-full pl-9 pr-8 py-2 bg-surface-container-low border border-transparent focus:border-secondary focus:ring-0 rounded-lg text-sm transition-all font-body text-on-surface"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-outline-variant/30 border-t-primary rounded-full animate-spin" />
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto bg-white rounded-lg shadow-xl border border-outline-variant/20">
          {results.map((r) => (
            <button
              key={r.place_id}
              type="button"
              onClick={() => pick(r)}
              className="w-full text-left px-3 py-2 hover:bg-surface-container-high transition-colors border-b border-outline-variant/10 last:border-0"
            >
              <p className="text-[12.5px] font-medium text-on-surface truncate">{r.display_name}</p>
              {r.type && <p className="text-[10.5px] text-on-surface-variant/50 uppercase tracking-wide">{r.type.replace(/_/g, ' ')}</p>}
            </button>
          ))}
        </div>
      )}

      {open && !loading && query.trim().length >= MIN_QUERY_LEN && results.length === 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white rounded-lg shadow-xl border border-outline-variant/20 px-3 py-2">
          <p className="text-[12px] text-on-surface-variant/50">No matches found in Kenya.</p>
        </div>
      )}
    </div>
  );
}
