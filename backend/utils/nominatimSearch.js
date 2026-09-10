// Shared by adminController.js's geocodeSearch (Merchants Map location
// picker) and the public merchant-signup street search (authController
// callers) — both proxy the same OpenStreetMap Nominatim place search, just
// gated differently (admin auth vs public rate limit). Server-side because
// Nominatim's public instance doesn't send CORS headers (a direct browser
// fetch fails silently with nothing readable), and their usage policy asks
// programmatic callers to identify themselves via a real User-Agent, which a
// browser can't set anyway.
export async function searchKenyaPlaces(q, { userAgent } = {}) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=ke&limit=8&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': userAgent || 'PayChain/1.0 (support@paychain.co.ke)',
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`Nominatim responded ${res.status}`);
  }
  const data = await res.json();
  return (Array.isArray(data) ? data : []).map((r) => ({
    place_id: r.place_id,
    display_name: r.display_name,
    type: r.type,
    lat: r.lat,
    lon: r.lon,
  }));
}
