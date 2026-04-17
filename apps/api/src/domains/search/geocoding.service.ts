/**
 * Static zip-code geocoding + Haversine distance.
 *
 * Uses a lookup table of ~20 major US zip prefixes so the MVP can do
 * radius-based matching without hitting an external geocoding API.
 * Replace with PostGIS `ST_DWithin` or Google Geocoding once traffic
 * justifies the cost.
 */

interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Major US zip-prefix → approximate centroid.
 * Keys are the first 3 digits of the zip code.
 */
const ZIP_PREFIX_TABLE: Record<string, LatLng> = {
  '100': { lat: 40.7128, lng: -74.006 },   // New York, NY
  '200': { lat: 38.9072, lng: -77.0369 },  // Washington, DC
  '303': { lat: 33.749, lng: -84.388 },    // Atlanta, GA
  '331': { lat: 25.7617, lng: -80.1918 },  // Miami, FL
  '432': { lat: 39.9612, lng: -82.9988 },  // Columbus, OH
  '481': { lat: 42.3314, lng: -83.0458 },  // Detroit, MI
  '527': { lat: 43.0731, lng: -89.4012 },  // Madison, WI
  '554': { lat: 44.9778, lng: -93.265 },   // Minneapolis, MN
  '606': { lat: 41.8781, lng: -87.6298 },  // Chicago, IL
  '630': { lat: 38.627, lng: -90.1994 },   // St. Louis, MO
  '641': { lat: 39.0997, lng: -94.5786 },  // Kansas City, MO
  '681': { lat: 41.2565, lng: -95.9345 },  // Omaha, NE
  '730': { lat: 35.4676, lng: -97.5164 },  // Oklahoma City, OK
  '750': { lat: 32.7767, lng: -96.797 },   // Dallas, TX
  '770': { lat: 29.7604, lng: -95.3698 },  // Houston, TX
  '802': { lat: 39.7392, lng: -104.9903 }, // Denver, CO
  '841': { lat: 40.7608, lng: -111.891 },  // Salt Lake City, UT
  '852': { lat: 33.4484, lng: -112.074 },  // Phoenix, AZ
  '900': { lat: 34.0522, lng: -118.2437 }, // Los Angeles, CA
  '941': { lat: 37.7749, lng: -122.4194 }, // San Francisco, CA
  '981': { lat: 47.6062, lng: -122.3321 }, // Seattle, WA
};

/**
 * Look up approximate lat/lng for a US zip code using the first 3 digits.
 * Returns `null` when the prefix is not in the static table.
 */
export async function geocodeZip(zip: string): Promise<LatLng | null> {
  const cleaned = zip.replace(/\D/g, '').slice(0, 5);
  if (cleaned.length < 3) return null;
  const prefix = cleaned.slice(0, 3);
  return ZIP_PREFIX_TABLE[prefix] ?? null;
}

/**
 * Great-circle distance between two points using the Haversine formula.
 * @returns distance in **miles**
 */
export function haversineDistance(a: LatLng, b: LatLng): number {
  const EARTH_RADIUS_MILES = 3958.8;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinHalfLat = Math.sin(dLat / 2);
  const sinHalfLng = Math.sin(dLng / 2);

  const h =
    sinHalfLat * sinHalfLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinHalfLng * sinHalfLng;

  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h));
}
