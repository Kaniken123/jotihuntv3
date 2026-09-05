// Driving-route lookup for in-app navigation to a fox.
//
// Uses an OSRM-compatible HTTP API. Defaults to OSRM's public demo server, which
// is fine for development and light use but is rate-limited and not meant for
// production — before an event, set VITE_OSRM_URL to a self-hosted OSRM (NL road
// extract) or another OSRM-compatible endpoint for reliability.
const OSRM_URL: string =
  (import.meta as any).env?.VITE_OSRM_URL || 'https://router.project-osrm.org';

export interface DrivingRoute {
  coordinates: [number, number][]; // [lat, lng] pairs, ready for Leaflet
  distanceKm: number;
  durationMin: number;
}

/**
 * Fetch a driving route between two points. Returns null on failure so callers
 * can show a friendly message rather than throwing.
 */
export async function getDrivingRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): Promise<DrivingRoute | null> {
  try {
    const url =
      `${OSRM_URL}/route/v1/driving/` +
      `${from.lng},${from.lat};${to.lng},${to.lat}` +
      `?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route?.geometry?.coordinates?.length) return null;
    return {
      // OSRM returns [lng, lat]; Leaflet wants [lat, lng].
      coordinates: route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]),
      distanceKm: route.distance / 1000,
      durationMin: Math.round(route.duration / 60),
    };
  } catch (err) {
    console.error('Routing request failed:', err);
    return null;
  }
}
