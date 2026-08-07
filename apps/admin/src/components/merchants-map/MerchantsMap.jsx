import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import api from '../../api/api';
import { KENYA_CENTER, KENYA_DEFAULT_ZOOM, createMerchantIcon, createClusterIcon } from './mapIcons';
import { getMerchantMapStatus } from './merchantMapStatus';
import MerchantPopupCard from './MerchantPopupCard';
import MapFilterBar from './MapFilterBar';
import LocationPickerModal from './LocationPickerModal';

// Polling, not a WebSocket/SSE push — matches how the rest of the admin/
// merchant apps already stay "live" (e.g. merchant-dashboard's 5s balance
// poll). There's no real-time server infrastructure in this backend yet,
// and adding one is a separate, much larger piece of work than this map.
const POLL_MS = 25000;

function ResetViewControl() {
  const map = useMap();
  return (
    <button
      onClick={() => map.setView(KENYA_CENTER, KENYA_DEFAULT_ZOOM)}
      className="absolute bottom-6 left-3 z-[1000] bg-white shadow-md border border-outline-variant/20 rounded-lg px-3 py-2 text-[12px] font-semibold text-on-surface-variant/80 hover:bg-surface-container-high transition-colors flex items-center gap-1.5"
      title="Reset to Kenya view"
    >
      <span className="material-symbols-outlined text-[16px]">public</span>
      Reset view
    </button>
  );
}

function FullscreenControl({ containerRef }) {
  const [isFs, setIsFs] = useState(false);
  useEffect(() => {
    const onChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  return (
    <button
      onClick={() => {
        if (document.fullscreenElement) document.exitFullscreen();
        else containerRef.current?.requestFullscreen?.();
      }}
      className="absolute bottom-6 left-[132px] z-[1000] bg-white shadow-md border border-outline-variant/20 rounded-lg p-2 text-on-surface-variant/80 hover:bg-surface-container-high transition-colors"
      title={isFs ? 'Exit fullscreen' : 'Fullscreen'}
    >
      <span className="material-symbols-outlined text-[18px]">{isFs ? 'fullscreen_exit' : 'fullscreen'}</span>
    </button>
  );
}

export default function MerchantsMap({ onViewMerchantDetails }) {
  const [merchants, setMerchants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [editingLocation, setEditingLocation] = useState(null);
  const containerRef = useRef(null);

  const fetchMap = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/merchants/map');
      setMerchants(res.data.merchants || []);
      setError('');
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load map data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMap();
    const interval = setInterval(fetchMap, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchMap]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return merchants.filter((m) => {
      if (statusFilter !== 'all' && getMerchantMapStatus(m).key !== statusFilter) return false;
      if (!q) return true;
      return (
        m.businessName?.toLowerCase().includes(q) ||
        m.phone?.toLowerCase().includes(q) ||
        m.location?.label?.toLowerCase().includes(q)
      );
    });
  }, [merchants, search, statusFilter]);

  function handleSaved() {
    setEditingLocation(null);
    setSelected(null);
    fetchMap();
  }

  return (
    <div ref={containerRef} className="relative h-[70vh] min-h-[480px] w-full rounded-xl overflow-hidden border border-outline-variant/20 shadow-editorial bg-surface-container-lowest">
      {loading && (
        <div className="absolute inset-0 z-[1500] bg-white/70 flex items-center justify-center">
          <div className="pc-spinner" />
        </div>
      )}

      {!loading && merchants.length === 0 && !error && (
        <div className="absolute inset-0 z-[1500] bg-white flex flex-col items-center justify-center gap-2 text-center px-6">
          <span className="material-symbols-outlined text-[40px] text-on-surface-variant/25">location_off</span>
          <p className="text-[14px] font-semibold text-on-surface-variant/70">No merchants pinned yet</p>
          <p className="text-[12px] text-on-surface-variant/50 max-w-xs">
            Use "Set map location" from a merchant's menu in the list view to place them here.
          </p>
        </div>
      )}

      {error && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1500] bg-error/10 border border-error/30 text-error text-[12px] font-semibold px-3 py-1.5 rounded-lg">
          {error}
        </div>
      )}

      <MapContainer
        center={KENYA_CENTER}
        zoom={KENYA_DEFAULT_ZOOM}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <MarkerClusterGroup iconCreateFunction={createClusterIcon} chunkedLoading>
          {filtered.map((m) => (
            <Marker
              key={m._id}
              position={[m.location.lat, m.location.lng]}
              icon={createMerchantIcon({ activeRecently: m.activeRecently, locked: m.status === 'locked' })}
              eventHandlers={{ click: () => setSelected(m) }}
            />
          ))}
        </MarkerClusterGroup>
        <ResetViewControl />
        <FullscreenControl containerRef={containerRef} />
      </MapContainer>

      <MapFilterBar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        resultCount={filtered.length}
        totalCount={merchants.length}
      />

      {selected && (
        <MerchantPopupCard
          merchant={selected}
          onClose={() => setSelected(null)}
          onViewDetails={onViewMerchantDetails}
          onEditLocation={(m) => setEditingLocation(m)}
        />
      )}

      {editingLocation && (
        <LocationPickerModal
          merchant={editingLocation}
          onClose={() => setEditingLocation(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
