// Driving-route lookup for in-app navigation to a fox (mobile).
// OSRM-compatible endpoint; the public demo is fine for dev/light use but is
// rate-limited — swap OSRM_URL for a self-hosted OSRM before an event.
const OSRM_URL = 'https://router.project-osrm.org';

export interface DrivingRoute {
  coordinates: [number, number][]; // [lat, lng] pairs for Leaflet
  distanceKm: number;
  durationMin: number;
}

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
      coordinates: route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]),
      distanceKm: route.distance / 1000,
      durationMin: Math.round(route.duration / 60),
    };
  } catch (err) {
    console.error('Routing request failed:', err);
    return null;
  }
}
