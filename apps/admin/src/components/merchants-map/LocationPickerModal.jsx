import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import api from '../../api/api';
import { KENYA_CENTER, KENYA_DEFAULT_ZOOM } from './mapIcons';
import LocationSearchBox from './LocationSearchBox';

// Leaflet's default marker image paths don't resolve under Vite's bundler
// (relative URLs baked into the leaflet package) — without this, the
// dropped pin renders as a broken image. A plain colored dot is enough
// here; the fancier pin styling lives in mapIcons.js for the main map.
const PICKER_ICON = L.divIcon({
  className: 'pc-picker-marker',
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#00351d;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function ClickToPlace({ onPick }) {
  useMapEvents({
    click(e) {
      onPick([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

// Leaflet computes its internal pixel size from the container at the
// moment it mounts — a map mounted inside a modal that's still settling
// its layout can end up with a stale/zero size, which silently breaks
// click-to-coordinate translation (clicks appear to do nothing). Forcing
// a resize check just after mount is the standard fix.
function InvalidateSizeOnMount() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 0);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

// MapContainer's center/zoom props only apply at initial mount — react-
// leaflet deliberately doesn't re-center on prop changes, so jumping to a
// searched place needs an imperative flyTo. `target` carries a `seq`
// counter (not just lat/lng) so selecting the same result twice in a row
// still re-triggers the fly.
function FlyToSearchResult({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 15);
  }, [target, map]);
  return null;
}

// Manual pin-drop — lets an admin set (or correct) a merchant's EXACT
// location, overriding the approximate county-centroid MerchantsMap.jsx
// otherwise falls back to (see getMerchantsMap's doc comment). `merchant`
// arrives shaped differently depending on which entry point opened this:
// the map popup passes `.location` (which may be that approximate
// fallback, not a real manual pin — excluded below), the merchant list
// view passes the raw `.mapLocation` (manual-only, no approximate concept
// there at all).
export default function LocationPickerModal({ merchant, onClose, onSaved }) {
  const manualLocation = merchant.location && !merchant.location.isApproximate ? merchant.location : null;
  const existing = manualLocation || merchant.mapLocation;
  const [pos, setPos] = useState(
    existing?.lat != null ? [existing.lat, existing.lng] : null
  );
  const [label, setLabel] = useState(existing?.label || '');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');
  const [flyTarget, setFlyTarget] = useState(null);
  const flySeqRef = useRef(0);

  function handleSearchSelect({ lat, lng, label: searchLabel }) {
    setPos([lat, lng]);
    setLabel(searchLabel);
    flySeqRef.current += 1;
    setFlyTarget({ lat, lng, seq: flySeqRef.current });
  }

  async function save() {
    if (!pos) {
      setError('Click on the map to place a pin first.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.patch(`/api/admin/merchants/${merchant._id}/location`, {
        lat: pos[0],
        lng: pos[1],
        label: label.trim(),
      });
      onSaved();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save location.');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setRemoving(true);
    setError('');
    try {
      await api.delete(`/api/admin/merchants/${merchant._id}/location`);
      onSaved();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to remove pin.');
      setRemoving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[2000] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center justify-between">
          <div>
            <h3 className="text-[16px] font-bold text-on-surface font-headline">Set map location</h3>
            <p className="text-[12px] text-on-surface-variant/60 mt-0.5">{merchant.businessName}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-container-high text-on-surface-variant/50">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="px-5 pt-4">
          <LocationSearchBox onSelect={handleSearchSelect} />
        </div>

        <div className="h-72 w-full mt-3">
          <MapContainer
            center={pos || KENYA_CENTER}
            zoom={pos ? 13 : KENYA_DEFAULT_ZOOM}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <InvalidateSizeOnMount />
            <FlyToSearchResult target={flyTarget} />
            <ClickToPlace onPick={setPos} />
            {pos && <Marker position={pos} icon={PICKER_ICON} />}
          </MapContainer>
        </div>

        <div className="px-5 py-4 space-y-3">
          {pos ? (
            <p className="text-[12px] text-on-surface-variant/60">
              Search above, or click anywhere on the map to move the pin.
            </p>
          ) : (
            <p className="text-[12px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">touch_app</span>
              No pin placed yet — search above or click anywhere on the map.
            </p>
          )}
          <div>
            <label className="text-[10.5px] font-label uppercase tracking-wide text-on-surface-variant/60">
              Area label (optional)
            </label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Gikomba, Thika Road"
              maxLength={100}
              className="mt-1 w-full px-3 py-2 bg-surface-container-low border border-transparent focus:border-secondary focus:ring-0 rounded-lg text-sm transition-all font-body text-on-surface"
            />
          </div>
          {pos && (
            <p className="text-[11px] text-on-surface-variant/50 font-mono">
              {pos[0].toFixed(5)}, {pos[1].toFixed(5)}
            </p>
          )}
          {error && <p className="text-[12px] text-error">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-outline-variant/10 flex items-center justify-between gap-3">
          {existing?.lat != null ? (
            <button
              onClick={remove}
              disabled={removing || saving}
              className="text-[12px] font-semibold text-error hover:underline disabled:opacity-50"
            >
              {removing ? 'Removing...' : 'Remove pin'}
            </button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-[13px] font-semibold text-on-surface-variant/70 hover:bg-surface-container-high transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving || removing || !pos}
              className="px-4 py-2 rounded-lg text-[13px] font-semibold bg-primary text-white hover:shadow-lg transition-all disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save location'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
