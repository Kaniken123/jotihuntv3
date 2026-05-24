/**
 * Step 1 of the fox-prediction plan: make hint_solutions usable as a prediction
 * signal.
 *
 *  - article_id becomes NULLABLE so a hint location can be entered standalone,
 *    before (or without) the matching API article being synced.
 *  - verification_status replaces the meaningless auto-`is_correct` flag as the
 *    trust source: 'unverified' (default) -> 'confirmed' / 'rejected', set by an
 *    admin. The predictor weights rows by this column.
 *
 * SQLite note: changing a column's nullability requires a table rebuild, which
 * knex's alterTable handles via the sqlite3 alter shim. The FK to articles is
 * preserved (still links when an article_id is present).
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  const hasStatus = await knex.schema.hasColumn('hint_solutions', 'verification_status');

  await knex.schema.alterTable('hint_solutions', (table) => {
    // article_id: drop NOT NULL (keep the column + FK).
    table.integer('article_id').nullable().alter();

    if (!hasStatus) {
      // Trust source for the predictor.
      table.string('verification_status').notNullable().defaultTo('unverified');
      table.index(['verification_status']);
    }
  });

  // Backfill: existing rows that were auto-marked correct stay usable but are
  // treated as unverified until an admin confirms them (safe default).
  if (!hasStatus) {
    await knex('hint_solutions').update({ verification_status: 'unverified' });
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.alterTable('hint_solutions', (table) => {
    table.dropColumn('verification_status');
    // NOTE: not restoring NOT NULL on article_id — standalone rows may now exist
    // with a null article_id, so re-adding the constraint could fail.
  });
};
