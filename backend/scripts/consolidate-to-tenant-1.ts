/**
 * One-off cleanup: collapse all data onto tenant 1 ("Global Organization").
 *
 * The Jotihunt API sync iterates every active tenant, creating duplicate copies
 * of areas/subscriptions/articles for each — but all real users live on tenant 1.
 * This leaves tenants 2 & 3 with stale duplicates, splits predictions across
 * "Bravo" rows that share a name but not an id, and makes per-tenant data drift.
 *
 * What this script does (atomic, single transaction):
 *   1. Deactivate tenants 2 & 3 so future API syncs stop re-creating their rows.
 *   2. Delete every row in tenant-scoped tables where tenant_id != 1 (or NULL).
 *      `areas` has ON DELETE CASCADE, so its area_locations / fox_status_history
 *      / fox_predictions for the deleted tenants drop with it.
 *   3. Print before/after counts.
 *
 * Run: `npx ts-node scripts/consolidate-to-tenant-1.ts`
 * Reversible only by restoring a DB backup — make one if you care:
 *     copy backend/database/jotihunt.db backend/database/jotihunt.db.bak
 */
import { db } from '../src/utils/database';

const KEEP_TENANT = 1;

// Tables to scrub of all rows where tenant_id is NULL or any value != KEEP_TENANT.
// areas first so its CASCADEs fire (area_locations, fox_status_history,
// fox_predictions). The rest are independent.
const SCRUB_TABLES = [
  'areas',
  'subscriptions',
  'articles',
  'fox_status_history',
  'chat_channels',
  'auth_tokens',
  'user_locations',
];

async function counts(label: string) {
  console.log(`\n--- ${label} ---`);
  for (const t of SCRUB_TABLES.concat(['fox_predictions', 'area_locations'])) {
    try {
      const rows = await db(t).select('tenant_id').count<{ tenant_id: number | null; n: number }[]>('* as n').groupBy('tenant_id');
      console.log(' ', t.padEnd(22), rows.map((r: any) => `t=${r.tenant_id}: ${r.n}`).join(', '));
    } catch {
      // skip tables that don't have tenant_id (e.g. area_locations)
      const total = await db(t).count<{ n: number }[]>('* as n').first();
      console.log(' ', t.padEnd(22), `total: ${(total as any).n}`);
    }
  }
}

async function main() {
  await counts('BEFORE');

  await db.transaction(async (trx) => {
    // 1) Deactivate other tenants so the API sync stops recreating their rows.
    const tenantsToggled = await trx('tenants').whereNot('id', KEEP_TENANT).update({ is_active: false });
    console.log(`\nDeactivated ${tenantsToggled} non-keep tenants.`);

    // 2) Scrub each tenant-scoped table. CASCADEs handle dependent rows.
    for (const t of SCRUB_TABLES) {
      const deleted = await trx(t)
        .where(function () {
          this.whereNot('tenant_id', KEEP_TENANT).orWhereNull('tenant_id');
        })
        .del();
      console.log(`  ${t.padEnd(22)} deleted ${deleted} rows`);
    }
  });

  await counts('AFTER');
  await db.destroy();
}

main().catch((e) => {
  console.error('Consolidation failed:', e);
  process.exit(1);
});
