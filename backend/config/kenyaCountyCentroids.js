// Approximate center-point coordinates for each of Kenya's 47 counties —
// used to plot a merchant on the admin Merchants Map from their signup-time
// county alone, when no admin has manually pin-dropped their exact business
// location (see adminController.js#getMerchantsMap). County-level precision
// only: every merchant in the same county resolves to the same point, which
// is intentional — Leaflet's marker clustering then naturally shows a count
// bubble per county, which is the actual goal (merchant density by
// location), not a precise street address.
//
// Keys must exactly match the county strings the signup forms send —
// mirrors KENYAN_COUNTIES in apps/merchant-dashboard/src/pages/Login.jsx
// and apps/mobile-app/src/pages/Login.tsx (47 counties, kept in sync per
// those files' own comments).
export const KENYA_COUNTY_CENTROIDS = {
  'Baringo':          { lat: 0.5143,  lng: 35.7395 },
  'Bomet':            { lat: -0.7813, lng: 35.3416 },
  'Bungoma':          { lat: 0.5635,  lng: 34.5606 },
  'Busia':            { lat: 0.4347,  lng: 34.2422 },
  'Elgeyo-Marakwet':  { lat: 0.8500,  lng: 35.5000 },
  'Embu':             { lat: -0.5310, lng: 37.4500 },
  'Garissa':          { lat: -0.4569, lng: 39.6583 },
  'Homa Bay':         { lat: -0.5273, lng: 34.4571 },
  'Isiolo':           { lat: 0.3546,  lng: 37.5822 },
  'Kajiado':          { lat: -2.0980, lng: 36.7820 },
  'Kakamega':         { lat: 0.2827,  lng: 34.7519 },
  'Kericho':          { lat: -0.3691, lng: 35.2861 },
  'Kiambu':           { lat: -1.0314, lng: 36.8686 },
  'Kilifi':           { lat: -3.5107, lng: 39.9093 },
  'Kirinyaga':        { lat: -0.6591, lng: 37.3800 },
  'Kisii':            { lat: -0.6773, lng: 34.7796 },
  'Kisumu':           { lat: -0.0917, lng: 34.7680 },
  'Kitui':            { lat: -1.3667, lng: 38.0167 },
  'Kwale':            { lat: -4.1743, lng: 39.4522 },
  'Laikipia':         { lat: 0.2000,  lng: 36.7833 },
  'Lamu':             { lat: -2.2717, lng: 40.9020 },
  'Machakos':         { lat: -1.5177, lng: 37.2634 },
  'Makueni':          { lat: -1.8038, lng: 37.6234 },
  'Mandera':          { lat: 3.9366,  lng: 41.8670 },
  'Marsabit':         { lat: 2.3284,  lng: 37.9899 },
  'Meru':             { lat: 0.0500,  lng: 37.6500 },
  'Migori':           { lat: -1.0634, lng: 34.4731 },
  'Mombasa':          { lat: -4.0435, lng: 39.6682 },
  "Murang'a":         { lat: -0.7833, lng: 37.1500 },
  'Nairobi':          { lat: -1.2921, lng: 36.8219 },
  'Nakuru':           { lat: -0.3031, lng: 36.0800 },
  'Nandi':            { lat: 0.1833,  lng: 35.1333 },
  'Narok':            { lat: -1.0833, lng: 35.8667 },
  'Nyamira':          { lat: -0.5633, lng: 34.9358 },
  'Nyandarua':        { lat: -0.1833, lng: 36.5333 },
  'Nyeri':            { lat: -0.4167, lng: 36.9500 },
  'Samburu':          { lat: 1.2159,  lng: 36.9585 },
  'Siaya':            { lat: 0.0607,  lng: 34.2881 },
  'Taita-Taveta':     { lat: -3.3167, lng: 38.4833 },
  'Tana River':       { lat: -1.6500, lng: 39.9500 },
  'Tharaka-Nithi':    { lat: -0.3000, lng: 37.8833 },
  'Trans Nzoia':      { lat: 1.0500,  lng: 34.9500 },
  'Turkana':          { lat: 3.1167,  lng: 35.6000 },
  'Uasin Gishu':      { lat: 0.5167,  lng: 35.2833 },
  'Vihiga':           { lat: 0.0833,  lng: 34.7167 },
  'Wajir':            { lat: 1.7471,  lng: 40.0573 },
  'West Pokot':       { lat: 1.4000,  lng: 35.1167 },
};

// Case/whitespace-tolerant lookup — signup data is free text (Merchant.js's
// county field has no enum constraint at the schema or controller level,
// only the frontend dropdown restricts it in practice), so an exact-match
// object lookup alone would silently drop merchants over a stray space or
// casing difference.
export function getCountyCentroid(county) {
  if (!county) return null;
  const key = String(county).trim();
  if (KENYA_COUNTY_CENTROIDS[key]) return KENYA_COUNTY_CENTROIDS[key];
  const lower = key.toLowerCase();
  const match = Object.keys(KENYA_COUNTY_CENTROIDS).find((k) => k.toLowerCase() === lower);
  return match ? KENYA_COUNTY_CENTROIDS[match] : null;
}
