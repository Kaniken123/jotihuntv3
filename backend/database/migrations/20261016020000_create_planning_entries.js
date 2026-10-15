// Epic I — live planning board. One row per person on the board (either an app
// user, or a manually typed name with no account). 'activity' is the column they
// sit in. The Hunt column uses the timer fields: an admin presses "vertrokken"
// (sets timer_started_at), the server flags an overrun once the threshold passes,
// and "terug"/stop clears it. Timers are admin-driven, never GPS-driven.
exports.up = async function (knex) {
  const exists = await knex.schema.hasTable('planning_entries');
  if (!exists) {
    await knex.schema.createTable('planning_entries', (t) => {
      t.increments('id').primary();
      t.integer('tenant_id').unsigned().notNullable().defaultTo(1);
      t.integer('user_id').unsigned().nullable();       // null => manually added name
      t.string('display_name').nullable();              // used for manual entries
      t.string('activity').notNullable().defaultTo('unassigned'); // unassigned|hunt|creatief|fotos|puzzels
      t.timestamp('timer_started_at').nullable();
      t.integer('threshold_minutes').notNullable().defaultTo(180);
      t.boolean('overrun_notified').notNullable().defaultTo(false);
      t.timestamp('returned_at').nullable();
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
      t.index(['tenant_id']);
      t.index(['user_id']);
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('planning_entries');
};
