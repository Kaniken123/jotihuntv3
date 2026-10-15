// Location tracking is switched per person on the planning board, independent of
// which activity column they sit in. Off by default: nobody is tracked until an
// admin turns it on for them.
exports.up = async function (knex) {
  const has = await knex.schema.hasColumn('planning_entries', 'track_location');
  if (!has) {
    await knex.schema.alterTable('planning_entries', (t) => {
      t.boolean('track_location').notNullable().defaultTo(false);
    });
  }
};

exports.down = async function (knex) {
  const has = await knex.schema.hasColumn('planning_entries', 'track_location');
  if (has) {
    await knex.schema.alterTable('planning_entries', (t) => t.dropColumn('track_location'));
  }
};
