/**
 * Step 6 — local dry-run for the fox predictor. No real event data exists, so we
 * seed synthetic signals (hunt / hint / manual pin) for one area, compute a
 * prediction, and verify the trust+freshness fallback chain. All synthetic rows
 * are deleted afterwards. Run: `npx ts-node scripts/simulate-prediction.ts`
 */
import { db } from '../src/utils/database';
import { computePrediction } from '../src/services/foxPrediction';

const TENANT = 1;
const BASE = { lat: 52.10, lng: 5.90 }; // inside the placeholder play boundary

function minsAgo(m: number): Date {
  return new Date(Date.now() - m * 60000);
}

async function main() {
  const area = await db('areas').where('tenant_id', TENANT).first();
  const user = await db('users').first();
  const team = await db('teams').first();
  if (!area || !user || !team) {
    console.error('Need at least one area, user, and team in the dev DB. Aborting.');
    return;
  }
  console.log(`Using area "${area.name}" (id=${area.id}), user=${user.id}, team=${team.id}\n`);

  const ids = { hunt: [] as number[], hint: [] as number[], loc: [] as number[] };

  try {
    // Seed: hunt 20 min ago, hint 50 min ago (slightly NE), manual pin 90 min ago (SW).
    const [huntId] = await db('hunts').insert({
      hunter_user_id: user.id, hunter_team_id: null, fox_area: area.name,
      hunt_lat: BASE.lat, hunt_lng: BASE.lng, photo_url: 'sim', points_awarded: 0,
      status: 'approved', hunt_time: minsAgo(20), tenant_id: TENANT,
    });
    ids.hunt.push(huntId);

    const [hintId] = await db('hint_solutions').insert({
      team_id: team.id, user_id: user.id, article_id: null, solution: 'sim',
      fox_team: area.name, rd_x: 0, rd_y: 0, lat: BASE.lat + 0.03, lng: BASE.lng + 0.03,
      verification_status: 'confirmed', created_at: minsAgo(50), updated_at: minsAgo(50),
    });
    ids.hint.push(hintId);

    const [locId] = await db('area_locations').insert({
      area_id: area.id, lat: BASE.lat - 0.04, lng: BASE.lng - 0.02,
      recorded_at: minsAgo(90), source: 'user_report',
    });
    ids.loc.push(locId);

    const show = (label: string, r: any) =>
      console.log(
        `${label}\n  anchor=${r.anchor_source} conf=${r.confidence} ` +
        `cells=${JSON.parse(r.heatmap_geojson).features.length} ` +
        `top=${JSON.stringify(r.top_zones)}\n`
      );

    show('① all signals (expect anchor=hunt, highest confidence):',
      await computePrediction(area, TENANT));

    await db('hunts').whereIn('id', ids.hunt).del(); ids.hunt = [];
    show('② hunt removed (expect anchor=hint):', await computePrediction(area, TENANT));

    await db('hint_solutions').whereIn('id', ids.hint).del(); ids.hint = [];
    show('③ hint removed (expect anchor=manual):', await computePrediction(area, TENANT));

    await db('area_locations').whereIn('id', ids.loc).del(); ids.loc = [];
    show('④ nothing recent (expect anchor=none, conf=0):', await computePrediction(area, TENANT));
  } finally {
    if (ids.hunt.length) await db('hunts').whereIn('id', ids.hunt).del();
    if (ids.hint.length) await db('hint_solutions').whereIn('id', ids.hint).del();
    if (ids.loc.length) await db('area_locations').whereIn('id', ids.loc).del();
    await db.destroy();
  }
}

main();
