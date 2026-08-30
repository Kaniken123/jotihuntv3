// Phase 4 — deelgebieden (hunter patrol regions) as first-class rows, plus the
// hunter<->deelgebied membership history. Deliberately NOT the `areas` table —
// those are the foxes / hunt targets. No tenant_id: prod is single-tenant and the
// multi-tenant layer is frozen (see build plan). Additive only; touches nothing
// existing.
exports.up = async function (knex) {
  await knex.schema.createTable('deelgebieden', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    // Removal archives, never deletes — messages/memberships still reference it.
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('archived_at').nullable();
    table.timestamps(true, true);
  });

  await knex.schema.createTable('user_deelgebied_memberships', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.integer('deelgebied_id').unsigned().notNullable()
      .references('id').inTable('deelgebieden').onDelete('CASCADE');
    // left_at NULL = currently a member. Keeping ended rows preserves movement
    // history (a hunter/car moving between regions during the event).
    table.timestamp('joined_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('left_at').nullable();
    table.timestamps(true, true);
    table.index(['user_id']);
    table.index(['deelgebied_id']);
    table.index(['user_id', 'deelgebied_id']);
  });

  // Default Jotihunt deelgebieden. The count changes per event — admins add/
  // archive live, so this is only a starting set.
  const defaults = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot'];
  await knex('deelgebieden').insert(defaults.map((name) => ({ name, is_active: true })));
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('user_deelgebied_memberships');
  await knex.schema.dropTableIfExists('deelgebieden');
};
