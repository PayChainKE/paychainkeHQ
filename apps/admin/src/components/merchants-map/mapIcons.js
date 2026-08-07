import L from 'leaflet';

// Kenya-wide default view — Nairobi-centered, zoomed out enough to see most
// major towns without the admin having to pan on first load.
export const KENYA_CENTER = [-1.286389, 36.817223];
export const KENYA_DEFAULT_ZOOM = 7;

// Custom teardrop-pin divIcon (not Leaflet's default marker images, which
// need bundler asset-path workarounds) — a pulsing ring is layered on top
// for merchants active in the last 24h using Tailwind's own animate-ping,
// so it stays visually consistent with the rest of the app rather than a
// bespoke animation.
function pinSvg(fill) {
  return `
    <svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 25 15 25s15-14.5 15-25C30 6.7 23.3 0 15 0z" fill="${fill}"/>
      <circle cx="15" cy="15" r="6" fill="white" fill-opacity="0.9"/>
    </svg>
  `;
}

// className carries the active/offline distinction onto the underlying
// Leaflet marker (via its icon options) so createClusterIcon below can read
// it back off cluster.getAllChildMarkers() — Leaflet doesn't preserve
// arbitrary custom marker options, but icon.options.className survives.
const ACTIVE_CLASS = 'pc-merchant-marker pc-merchant-marker--active';
const OFFLINE_CLASS = 'pc-merchant-marker pc-merchant-marker--offline';

export function createMerchantIcon({ activeRecently, locked }) {
  const isActive = activeRecently && !locked;
  const fill = isActive ? '#10b981' /* emerald-500 */ : '#94a3b8' /* slate-400 */;
  const pulse = isActive
    ? '<span class="absolute inset-0 -m-1 rounded-full bg-emerald-400/60 animate-ping"></span>'
    : '';
  return L.divIcon({
    className: isActive ? ACTIVE_CLASS : OFFLINE_CLASS,
    html: `
      <div class="relative flex items-center justify-center" style="width:30px;height:40px;">
        ${pulse}
        <div class="relative">${pinSvg(fill)}</div>
      </div>
    `,
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -36],
  });
}

// Cluster bubble — count-in-circle, tinted by how many of its child
// markers are recently-active vs not so a dense cluster still hints at
// "is anything happening in here" before the admin zooms in.
export function createClusterIcon(cluster) {
  const count = cluster.getChildCount();
  const markers = cluster.getAllChildMarkers();
  const anyActive = markers.some((m) => m.options.icon?.options?.className === ACTIVE_CLASS);
  const bg = anyActive ? '#10b981' : '#64748b';
  const size = count < 10 ? 34 : count < 50 ? 42 : 50;
  return L.divIcon({
    html: `<div class="flex items-center justify-center rounded-full text-white font-bold shadow-lg border-2 border-white" style="width:${size}px;height:${size}px;background:${bg};font-size:${count < 100 ? 13 : 11}px;">${count}</div>`,
    className: 'pc-merchant-cluster',
    iconSize: [size, size],
  });
}
