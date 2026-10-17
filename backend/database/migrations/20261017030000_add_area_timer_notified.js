// Marks a deelgebied timer whose "hour is up" alert has gone out, so the
// watcher sends it once.
exports.up = async function (knex) {
  if (!(await knex.schema.hasColumn('planning_area_timers', 'notified'))) {
    await knex.schema.alterTable('planning_area_timers', (t) => {
      t.boolean('notified').notNullable().defaultTo(false);
    });
  }
};

exports.down = async function (knex) {
  if (await knex.schema.hasColumn('planning_area_timers', 'notified')) {
    await knex.schema.alterTable('planning_area_timers', (t) => t.dropColumn('notified'));
  }
};
