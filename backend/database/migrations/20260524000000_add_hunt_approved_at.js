/**
 * Add `approved_at` to hunts so the cooldown timer starts at admin approval,
 * not at submission time. Backfilled to NULL — historical hunts won't trigger
 * cooldowns retroactively, which is fine because their hunt_time is already
 * outside any 60-min window.
 *
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  if (!(await knex.schema.hasColumn('hunts', 'approved_at'))) {
    await knex.schema.alterTable('hunts', (t) => {
      t.datetime('approved_at').nullable();
      t.index(['hunter_team_id', 'fox_area', 'approved_at']);
    });
  }
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
  if (await knex.schema.hasColumn('hunts', 'approved_at')) {
    await knex.schema.alterTable('hunts', (t) => t.dropColumn('approved_at'));
  }
};
