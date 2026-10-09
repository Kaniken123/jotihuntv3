// Epic D (mobile) — device push tokens for FCM remote notifications. One row per
// device token; a token is unique and re-registration updates its owner/last_seen.
exports.up = async function (knex) {
  const exists = await knex.schema.hasTable('push_tokens');
  if (!exists) {
    await knex.schema.createTable('push_tokens', (t) => {
      t.increments('id').primary();
      t.integer('user_id').unsigned().notNullable();
      t.text('token').notNullable().unique();
      t.string('platform').notNullable().defaultTo('android'); // android | ios
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
      t.index(['user_id']);
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('push_tokens');
};
