/**
 * Reality fix: the live `hint_solutions` table uses WIDE per-area columns
 * (alpha_lat, bravo_lat, ... — only 6 areas, no Golf/Hotel) which the migration
 * history doesn't reflect. The fox-prediction plan standardised on "one row per
 * revealed fox" (supports all 8 areas, clean per-fox queries).
 *
 * This adds the long-format columns the new `POST /hints/solutions` writes and the
 * predictor reads. The legacy wide columns are left in place (unused) to avoid a
 * destructive rebuild; they can be dropped later once nothing reads them.
 *
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  const add = async (name, fn) => {
    if (!(await knex.schema.hasColumn('hint_solutions', name))) {
      await knex.schema.alterTable('hint_solutions', fn);
    }
  };
  // Add fox_team (+ its index) only if missing.
  if (!(await knex.schema.hasColumn('hint_solutions', 'fox_team'))) {
    await knex.schema.alterTable('hint_solutions', (t) => {
      t.string('fox_team');
      t.index(['fox_team']);
    });
  }
  await add('rd_x', (t) => t.decimal('rd_x', 10, 2));
  await add('rd_y', (t) => t.decimal('rd_y', 10, 2));
  await add('lat', (t) => t.decimal('lat', 10, 6));
  await add('lng', (t) => t.decimal('lng', 10, 6));
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
  await knex.schema.alterTable('hint_solutions', (t) => {
    t.dropColumn('fox_team');
    t.dropColumn('rd_x');
    t.dropColumn('rd_y');
    t.dropColumn('lat');
    t.dropColumn('lng');
  });
};
