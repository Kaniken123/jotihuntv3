// Hunters on the planning board are split over deelgebieden (hunt_area), and
// each deelgebied gets a one-hour timer an admin can start.
exports.up = async function (knex) {
  if (!(await knex.schema.hasColumn('planning_entries', 'hunt_area'))) {
    await knex.schema.alterTable('planning_entries', (t) => {
      t.string('hunt_area').nullable();
    });
  }
  if (!(await knex.schema.hasTable('planning_area_timers'))) {
    await knex.schema.createTable('planning_area_timers', (t) => {
      t.increments('id').primary();
      t.integer('tenant_id').notNullable();
      t.string('area').notNullable();
      t.timestamp('started_at').notNullable();
      t.integer('duration_minutes').notNullable().defaultTo(60);
      t.unique(['tenant_id', 'area']);
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('planning_area_timers');
  if (await knex.schema.hasColumn('planning_entries', 'hunt_area')) {
    await knex.schema.alterTable('planning_entries', (t) => t.dropColumn('hunt_area'));
  }
};
