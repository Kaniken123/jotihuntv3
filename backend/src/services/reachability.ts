/**
 * Step 2b — reachable-area abstraction.
 *
 * v1 is a straight-line circle: how far could a fox travel from its anchor in the
 * elapsed time, at a plausible road speed. This is intentionally simple and
 * dependency-free. When self-hosted OSRM is available, replace
 * `reachableRadiusKm`'s caller with a real isochrone polygon — the prediction
 * service only needs "is this candidate point reachable?", so the swap is local.
 */

export interface ReachConfig {
  /** Assumed travel speed in km/h while moving. */
  speedKmh: number;
  /** Never predict a circle smaller than this (GPS/anchor slop). */
  minRadiusKm: number;
  /** Cap the circle so a stale anchor doesn't blanket the whole map. */
  maxRadiusKm: number;
}

export const DEFAULT_REACH: ReachConfig = {
  speedKmh: 35,
  minRadiusKm: 1,
  maxRadiusKm: 20,
};

/**
 * Straight-line reachable radius (km) given how long ago the fox was at the
 * anchor. `movingFactor` lets the caller widen/narrow based on fox status
 * (e.g. 'orange'/onderweg moves faster; just-caught flees further).
 */
export function reachableRadiusKm(
  elapsedMinutes: number,
  movingFactor = 1,
  cfg: ReachConfig = DEFAULT_REACH
): number {
  const hours = Math.max(0, elapsedMinutes) / 60;
  const raw = cfg.speedKmh * hours * movingFactor;
  return Math.min(cfg.maxRadiusKm, Math.max(cfg.minRadiusKm, raw));
}
