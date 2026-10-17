// One shared notepad per tenant, shown beside the planning board.
exports.up = async function (knex) {
  if (!(await knex.schema.hasTable('planning_notes'))) {
    await knex.schema.createTable('planning_notes', (t) => {
      t.increments('id').primary();
      t.integer('tenant_id').notNullable().unique();
      t.text('content').notNullable().defaultTo('');
      t.integer('updated_by');
      t.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('planning_notes');
};
