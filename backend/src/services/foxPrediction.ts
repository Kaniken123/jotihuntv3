/**
 * Step 3 — fox location prediction service (v1, rules-based, no ML).
 *
 * For a fox area it gathers recent location signals (hunts, hint solutions, manual
 * pins, API coords), weights them by trust × freshness, derives a reachable radius
 * from the freshest strong anchor, then scores a grid of candidate points and
 * writes a heatmap + top zones + confidence to `fox_predictions`.
 *
 * Geometry is straight-line (see reachability.ts) and dependency-free; swap in
 * OSRM isochrones later without touching the scoring logic.
 */
import { db } from '../utils/database';
import { LatLng, distanceKm, buildGrid } from '../utils/geo';
import { isInPlayArea } from '../config/playBoundary';
import { reachableRadiusKm } from './reachability';

type AnchorSource = 'hunt' | 'hint' | 'manual' | 'api';

interface Anchor {
  lat: number;
  lng: number;
  time: Date;
  source: AnchorSource;
  trust: number; // 0..1 base trust for this kind of signal
}

interface PredictionResult {
  area_id: number;
  anchor_source: AnchorSource | 'none';
  anchor_time: Date | null;
  heatmap_geojson: string;
  top_zones: Array<{ lat: number; lng: number; label: string; score: number }>;
  confidence: number;
}

// Freshness half-life: a signal loses ~half its weight every FRESH_TAU minutes.
// First-pass re-tune (was 60): with the old half-life a hunt at trust 1.0 still
// had weight 0.5 an hour later — old hunts kept dominating newer signals. 35 lets
// fresh hints/pins overtake an aging hunt within ~30–40 min. Re-tune later
// against real event behaviour.
const FRESH_TAU_MIN = 35;
const LOOKBACK_HOURS = 24;

function freshness(time: Date, now: Date): number {
  const minutes = (now.getTime() - time.getTime()) / 60000;
  return Math.exp(-Math.max(0, minutes) / FRESH_TAU_MIN);
}

/** Gather candidate anchors for one area within the lookback window. */
async function gatherAnchors(area: any, tenantId: number, now: Date): Promise<Anchor[]> {
  const since = new Date(now.getTime() - LOOKBACK_HOURS * 3600 * 1000);
  const anchors: Anchor[] = [];

  // 1. Hunt submissions (photo-verified). Match by fox_area name.
  const hunts = await db('hunts')
    .where('fox_area', area.name)
    .where('tenant_id', tenantId)
    .whereNot('status', 'rejected')
    .where('hunt_time', '>=', since)
    .whereNotNull('hunt_lat')
    .orderBy('hunt_time', 'desc');
  for (const h of hunts) {
    if (!h.hunt_lat && !h.hunt_lng) continue;
    anchors.push({
      lat: Number(h.hunt_lat),
      lng: Number(h.hunt_lng),
      time: new Date(h.hunt_time),
      source: 'hunt',
      // First-pass re-tune (was 1.0 / 0.6): an approved hunt was crushing every
      // other signal. Still highest, but leaves room for fresh hints to compete.
      trust: h.status === 'approved' ? 0.85 : 0.5,
    });
  }

  // 2. Hint solutions (manual RD coords). Match by fox_team name.
  //    Note: hint_solutions has no tenant_id yet — query is global for v1.
  const hints = await db('hint_solutions')
    .where('fox_team', area.name)
    .whereNot('verification_status', 'rejected')
    .where('created_at', '>=', since)
    .whereNotNull('lat')
    .orderBy('created_at', 'desc');
  for (const s of hints) {
    if (s.lat == null || s.lng == null) continue;
    anchors.push({
      lat: Number(s.lat),
      lng: Number(s.lng),
      time: new Date(s.created_at),
      source: 'hint',
      // First-pass re-tune (was 0.9 / 0.4): a confirmed hint is exact coordinates
      // and deserves to be close to a hunt. Unverified guesses pulled the heatmap
      // too hard at 0.4 — drop to 0.25 so they only nudge.
      trust: s.verification_status === 'confirmed' ? 0.8 : 0.25,
    });
  }

  // 3 & 4. area_locations: manual sightings (medium) and api coords (low).
  const locs = await db('area_locations')
    .where('area_id', area.id)
    .where('recorded_at', '>=', since)
    .orderBy('recorded_at', 'desc');
  for (const l of locs) {
    if (l.lat == null || l.lng == null) continue;
    const isManual = l.source === 'user_report' || l.source === 'admin_manual';
    anchors.push({
      lat: Number(l.lat),
      lng: Number(l.lng),
      time: new Date(l.recorded_at),
      source: isManual ? 'manual' : 'api',
      // First-pass re-tune (was 0.5 / 0.25): nudged down slightly so manual pins
      // (eyewitness) stay clearly below confirmed hints, and API coords (sparse,
      // often stale) stay clearly the weakest fallback.
      trust: isManual ? 0.45 : 0.2,
    });
  }

  return anchors;
}

/** How much to widen the reachable circle based on current fox status. */
async function movingFactor(areaId: number, tenantId: number): Promise<number> {
  const open = await db('fox_status_history')
    .where('area_id', areaId)
    .where('tenant_id', tenantId)
    .whereNull('ended_at')
    .orderBy('started_at', 'desc')
    .first();
  if (!open) return 1;
  if (open.api_status === 'orange') return 1.3; // onderweg — moving now
  if (open.api_status === 'red') return 1.5; // just caught — flees the area
  return 1; // green — resting/huntable
}

/** Greedy top-N picker that spreads picks apart by minSepKm. */
function pickTopZones(
  scored: Array<{ point: LatLng; score: number }>,
  n: number,
  minSepKm: number
): Array<{ lat: number; lng: number; label: string; score: number }> {
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const picked: Array<{ point: LatLng; score: number }> = [];
  for (const cand of sorted) {
    if (picked.length >= n) break;
    if (picked.every((p) => distanceKm(p.point, cand.point) >= minSepKm)) {
      picked.push(cand);
    }
  }
  return picked.map((p, i) => ({
    lat: Number(p.point.lat.toFixed(6)),
    lng: Number(p.point.lng.toFixed(6)),
    label: `Zone ${i + 1}`,
    score: Number(p.score.toFixed(3)),
  }));
}

/** Compute (but do not store) a prediction for one area. */
export async function computePrediction(
  area: any,
  tenantId: number,
  now: Date = new Date()
): Promise<PredictionResult> {
  const anchors = await gatherAnchors(area, tenantId, now);

  if (anchors.length === 0) {
    return {
      area_id: area.id,
      anchor_source: 'none',
      anchor_time: null,
      heatmap_geojson: JSON.stringify({ type: 'FeatureCollection', features: [] }),
      top_zones: [],
      confidence: 0,
    };
  }

  // Weight = base trust × freshness. Primary anchor = highest weight.
  const weighted = anchors.map((a) => ({ a, w: a.trust * freshness(a.time, now) }));
  weighted.sort((x, y) => y.w - x.w);
  const primary = weighted[0];

  const elapsedMin = (now.getTime() - primary.a.time.getTime()) / 60000;
  const factor = await movingFactor(area.id, tenantId);
  const radiusKm = reachableRadiusKm(elapsedMin, factor);
  const center: LatLng = { lat: primary.a.lat, lng: primary.a.lng };

  // Grid resolution scales with radius (keep cell count bounded).
  const stepKm = Math.min(1, Math.max(0.3, radiusKm / 15));
  const decayScale = Math.max(radiusKm / 2, 1);

  // Boundary mask: only useful when the anchor itself is inside the play area.
  // If a test/manual hunt was placed outside the (currently placeholder) polygon,
  // masking would wipe every grid cell and the fox would render as empty. In
  // that case we trust the anchor and skip the mask. When the real polygon is
  // in place this branch effectively never fires.
  const anchorInside = isInPlayArea(center);
  const rawGrid = buildGrid(center, radiusKm, stepKm);
  let grid = anchorInside ? rawGrid.filter(isInPlayArea) : rawGrid;

  // Defensive fallback: if grid still ends up empty (degenerate config), at
  // least keep the anchor itself so the fox renders.
  if (grid.length === 0) grid = [center];

  const scored = grid.map((point) => {
    // Sum contributions from every anchor (kernel density), each weighted by
    // trust × freshness and a Gaussian distance decay.
    let score = 0;
    for (const { a, w } of weighted) {
      const d = distanceKm(point, { lat: a.lat, lng: a.lng });
      score += w * Math.exp(-((d / decayScale) ** 2));
    }
    return { point, score };
  });

  const maxScore = scored.reduce((m, s) => Math.max(m, s.score), 0) || 1;
  const normalized = scored.map((s) => ({ point: s.point, score: s.score / maxScore }));

  const features = normalized.map((s) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [s.point.lng, s.point.lat] },
    properties: { weight: Number(s.score.toFixed(3)) },
  }));

  const topZones = pickTopZones(normalized, 3, Math.max(radiusKm / 3, 0.5));

  // Confidence: strength of the best anchor, dampened when the circle is large.
  const radiusPenalty = 1 - 0.5 * (radiusKm / 20);
  const confidence = Math.max(0, Math.min(1, primary.w * radiusPenalty));

  return {
    area_id: area.id,
    anchor_source: primary.a.source,
    anchor_time: primary.a.time,
    heatmap_geojson: JSON.stringify({ type: 'FeatureCollection', features }),
    top_zones: topZones,
    confidence: Number(confidence.toFixed(3)),
  };
}

/** Compute and persist a prediction for one area. Returns the stored row's id. */
export async function predictAndStore(
  areaId: number,
  tenantId: number,
  now: Date = new Date()
): Promise<number | null> {
  const area = await db('areas').where('id', areaId).where('tenant_id', tenantId).first();
  if (!area) return null;

  const result = await computePrediction(area, tenantId, now);

  const [id] = await db('fox_predictions').insert({
    area_id: result.area_id,
    tenant_id: tenantId,
    generated_at: now,
    anchor_source: result.anchor_source,
    anchor_time: result.anchor_time,
    heatmap_geojson: result.heatmap_geojson,
    top_zones: JSON.stringify(result.top_zones),
    confidence: result.confidence,
  });
  return id;
}

/**
 * Fire-and-forget trigger: recompute one fox's prediction after a new signal.
 * Never rejects into the caller's request path — failures are logged only.
 */
export function triggerPrediction(areaId: number, tenantId: number): void {
  predictAndStore(areaId, tenantId).catch((err) =>
    console.error(`Prediction trigger failed for area ${areaId}:`, err?.message ?? err)
  );
}

/** Recompute predictions for every active area of a tenant. */
export async function predictAllForTenant(tenantId: number, now: Date = new Date()): Promise<number> {
  const areas = await db('areas').where('tenant_id', tenantId);
  let count = 0;
  for (const area of areas) {
    await predictAndStore(area.id, tenantId, now);
    count++;
  }
  return count;
}

/** Latest stored prediction for an area (for the API/frontend). */
export async function getLatestPrediction(areaId: number, tenantId: number) {
  const row = await db('fox_predictions')
    .where('area_id', areaId)
    .where('tenant_id', tenantId)
    .orderBy('generated_at', 'desc')
    .first();
  if (!row) return null;
  return {
    ...row,
    top_zones: JSON.parse(row.top_zones || '[]'),
    heatmap_geojson: JSON.parse(row.heatmap_geojson || '{"type":"FeatureCollection","features":[]}'),
  };
}
