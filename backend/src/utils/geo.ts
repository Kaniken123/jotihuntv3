/**
 * Minimal geometry helpers for the fox predictor — kept dependency-free (no Turf)
 * so v1 ships without new packages. Distance uses the Haversine helper in
 * coordinates.ts. When OSRM/Turf arrive (Step 2b), only reachability.ts changes.
 */
import { calculateDistance } from './coordinates';

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

/** Distance in kilometres between two points. */
export function distanceKm(a: LatLng, b: LatLng): number {
  return calculateDistance(a, b) / 1000;
}

/**
 * Point-in-polygon (ray casting). `polygon` is an array of [lng, lat] rings'
 * outer ring as LatLng[]. Returns true if the point is inside.
 */
export function pointInPolygon(point: LatLng, polygon: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Offset a point by north/east distances in km → new LatLng. Good enough for the
 * small grids we build (a few tens of km).
 */
export function offsetKm(origin: LatLng, northKm: number, eastKm: number): LatLng {
  const dLat = (northKm / EARTH_RADIUS_KM) * (180 / Math.PI);
  const dLng =
    (eastKm / (EARTH_RADIUS_KM * Math.cos((origin.lat * Math.PI) / 180))) *
    (180 / Math.PI);
  return { lat: origin.lat + dLat, lng: origin.lng + dLng };
}

/**
 * Build a square grid of points centred on `center`, spanning ±radiusKm, spaced
 * `stepKm` apart, keeping only points within radiusKm of the center.
 */
export function buildGrid(center: LatLng, radiusKm: number, stepKm: number): LatLng[] {
  const points: LatLng[] = [];
  for (let n = -radiusKm; n <= radiusKm; n += stepKm) {
    for (let e = -radiusKm; e <= radiusKm; e += stepKm) {
      const p = offsetKm(center, n, e);
      if (distanceKm(center, p) <= radiusKm) points.push(p);
    }
  }
  return points;
}
