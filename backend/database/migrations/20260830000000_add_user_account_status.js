// Phase 2 — account states. Adds an approval lifecycle to users:
//   pending (default for new signups) -> approved / rejected / suspended
// and a scouting_group so approval decisions have real information behind them.
// Existing users are already active participants, so they are backfilled to
// 'approved'. is_active stays as the separate hard on/off kill switch.
exports.up = async function (knex) {
  await knex.schema.alterTable('users', (table) => {
    table.string('status').notNullable().defaultTo('pending');
    table.string('scouting_group');
  });

  // Everyone who already exists is an active participant — approve them so this
  // migration never locks anyone out on deploy.
  await knex('users').update({ status: 'approved' });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('status');
    table.dropColumn('scouting_group');
  });
};
