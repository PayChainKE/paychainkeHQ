import React from 'react';
import { getMerchantMapStatus, relativeTimeShort } from './merchantMapStatus';

// Slide-over detail card shown when a marker is clicked. A tiny Leaflet
// popup bubble can't comfortably fit a status badge + activity line +
// action button, so this renders as a fixed panel instead of an in-map
// popup — same information the spec asked for, just laid out where it's
// actually readable.
export default function MerchantPopupCard({ merchant, onClose, onViewDetails, onEditLocation }) {
  if (!merchant) return null;
  const status = getMerchantMapStatus(merchant);

  return (
    <div className="absolute top-0 right-0 h-full w-full sm:w-[340px] z-[1000] bg-white border-l border-outline-variant/20 shadow-2xl flex flex-col animate-[slide-in_0.18s_ease-out]">
      <div className="flex items-start justify-between px-5 py-4 border-b border-outline-variant/10">
        <div className="min-w-0">
          <h3 className="text-[16px] font-bold text-on-surface font-headline truncate">{merchant.businessName}</h3>
          {merchant.location?.label && (
            <p className="text-[12px] text-on-surface-variant/70 mt-0.5 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">location_on</span>
              {merchant.location.label}
            </p>
          )}
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-container-high text-on-surface-variant/50 hover:text-on-surface transition-colors shrink-0">
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide border ${status.pill}`}>
            {status.label}
          </span>
          {merchant.activeRecently && (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide border bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Transacting
            </span>
          )}
        </div>

        <div className="space-y-3 text-[13px]">
          <Field label="Business type" value={merchant.businessType || 'Not specified'} />
          <Field label="Phone" value={merchant.phone || '—'} />
          <Field label="Last transaction" value={relativeTimeShort(merchant.lastTxnAt)} />
        </div>
      </div>

      <div className="px-5 py-4 border-t border-outline-variant/10 space-y-2">
        <button
          onClick={() => onViewDetails(merchant._id)}
          className="w-full bg-primary text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:shadow-lg transition-all active:scale-95 font-label uppercase tracking-widest flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">visibility</span>
          View Merchant Details
        </button>
        <button
          onClick={() => onEditLocation(merchant)}
          className="w-full px-4 py-2 rounded-lg text-[12px] font-semibold text-on-surface-variant/70 hover:text-on-surface hover:bg-surface-container-high transition-colors flex items-center justify-center gap-1.5"
        >
          <span className="material-symbols-outlined text-[16px]">edit_location_alt</span>
          Move or remove pin
        </button>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-on-surface-variant/60 font-label uppercase tracking-wide text-[10.5px]">{label}</span>
      <span className="text-on-surface font-medium text-right truncate">{value}</span>
    </div>
  );
}
