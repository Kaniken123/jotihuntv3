/**
 * Step 2a — Jotihunt play-area boundary.
 *
 * ⚠️ PLACEHOLDER POLYGON. This is a generous bounding region over Gelderland
 * (the usual Jotihunt area) so the predictor has *a* mask to clip against. The
 * official play area changes per edition — replace `PLAY_BOUNDARY` with the real
 * polygon before the event (open question #1 in FOX_PREDICTION_PLAN.md).
 *
 * Format: outer ring as LatLng[] (no hole support needed for v1).
 */
import { LatLng, pointInPolygon } from '../utils/geo';

// Rough quadrilateral around Gelderland / Veluwe. Intentionally loose.
export const PLAY_BOUNDARY: LatLng[] = [
  { lat: 52.45, lng: 5.55 }, // NW (near Harderwijk)
  { lat: 52.45, lng: 6.45 }, // NE (near Deventer)
  { lat: 51.80, lng: 6.30 }, // SE (near Doetinchem)
  { lat: 51.80, lng: 5.55 }, // SW (near Tiel)
];

/** True if the point is inside the play area. */
export function isInPlayArea(point: LatLng): boolean {
  return pointInPolygon(point, PLAY_BOUNDARY);
}
