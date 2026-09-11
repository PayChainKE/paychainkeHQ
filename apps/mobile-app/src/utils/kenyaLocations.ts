import api from '../api/config';

// Ward taxonomy for the (optional) ward picker below Area — fetched once
// rather than duplicated as another multi-hundred-entry literal (unlike
// kenyaCountyAreas.ts, which is small enough to bake in; wards are ~5x
// that). Mirrors web's identical fetch in Login.jsx. Non-critical: a
// failure just means the ward step never appears — county/area picking
// (and the rest of signup) still works fully offline of this.
export async function fetchSignupWards(): Promise<Record<string, Record<string, string[]>>> {
  try {
    const res = await api.get('/api/auth/merchant/locations');
    return res.data?.wards || {};
  } catch {
    return {};
  }
}

export type StreetSearchResult = { place_id: string | number; display_name: string };

// Public street/place search for the signup form's optional Street field —
// same OpenStreetMap Nominatim proxy web's Login.jsx uses
// (searchSignupPlaces on the backend). A free-text convenience only, never
// validated against any list.
export async function searchSignupPlaces(q: string, county: string): Promise<StreetSearchResult[]> {
  try {
    const res = await api.get('/api/auth/merchant/geocode', { params: { q, county } });
    return Array.isArray(res.data?.results) ? res.data.results : [];
  } catch {
    return [];
  }
}
