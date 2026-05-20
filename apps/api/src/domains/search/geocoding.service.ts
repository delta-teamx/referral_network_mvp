import { env } from '../../config/env.js';

interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Geocode a US zip code using Google Maps Geocoding API.
 * Falls back to static lookup table if API key is not set or request fails.
 */
export async function geocodeZip(zip: string): Promise<LatLng | null> {
  const cleaned = zip.replace(/\D/g, '').slice(0, 5);
  if (cleaned.length < 3) return null;

  if (env.GOOGLE_MAPS_API_KEY) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${cleaned}&components=country:US&key=${env.GOOGLE_MAPS_API_KEY}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as {
          status: string;
          results: Array<{ geometry: { location: { lat: number; lng: number } } }>;
        };
        if (data.status === 'OK' && data.results.length > 0) {
          const loc = data.results[0]!.geometry.location;
          return { lat: loc.lat, lng: loc.lng };
        }
      }
    } catch {
      // Fall through to static table
    }
  }

  // Static fallback for when API key is missing or request fails
  const prefix = cleaned.slice(0, 3);
  return ZIP_PREFIX_TABLE[prefix] ?? null;
}

/**
 * Great-circle distance between two points using the Haversine formula.
 * @returns distance in miles
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

const ZIP_PREFIX_TABLE: Record<string, LatLng> = {
  '100': { lat: 40.7128, lng: -74.006 },
  '200': { lat: 38.9072, lng: -77.0369 },
  '303': { lat: 33.749, lng: -84.388 },
  '331': { lat: 25.7617, lng: -80.1918 },
  '432': { lat: 39.9612, lng: -82.9988 },
  '481': { lat: 42.3314, lng: -83.0458 },
  '527': { lat: 43.0731, lng: -89.4012 },
  '554': { lat: 44.9778, lng: -93.265 },
  '606': { lat: 41.8781, lng: -87.6298 },
  '630': { lat: 38.627, lng: -90.1994 },
  '641': { lat: 39.0997, lng: -94.5786 },
  '681': { lat: 41.2565, lng: -95.9345 },
  '730': { lat: 35.4676, lng: -97.5164 },
  '750': { lat: 32.7767, lng: -96.797 },
  '770': { lat: 29.7604, lng: -95.3698 },
  '802': { lat: 39.7392, lng: -104.9903 },
  '841': { lat: 40.7608, lng: -111.891 },
  '852': { lat: 33.4484, lng: -112.074 },
  '900': { lat: 34.0522, lng: -118.2437 },
  '941': { lat: 37.7749, lng: -122.4194 },
  '981': { lat: 47.6062, lng: -122.3321 },
};
