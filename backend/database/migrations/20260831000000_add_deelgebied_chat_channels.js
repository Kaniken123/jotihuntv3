// Phase 5 — chat channels tied to deelgebieden. Adds chat_channels.deelgebied_id
// and creates one 'deelgebied' channel per deelgebied. Access is derived from
// user_deelgebied_memberships server-side. The global 'general' channel becomes
// "Hunters algemeen". No FK on deelgebied_id (SQLite alterTable can't ADD a
// constraint cleanly; app logic enforces integrity and deelgebieden are archived,
// never deleted).
exports.up = async function (knex) {
  const hasCol = await knex.schema.hasColumn('chat_channels', 'deelgebied_id');
  if (!hasCol) {
    await knex.schema.alterTable('chat_channels', (t) => {
      t.integer('deelgebied_id').unsigned().nullable();
      t.index(['deelgebied_id']);
    });
  }

  // One channel per deelgebied (idempotent).
  const deelgebieden = await knex('deelgebieden').select('id', 'name');
  for (const d of deelgebieden) {
    const existing = await knex('chat_channels')
      .where({ type: 'deelgebied', deelgebied_id: d.id })
      .first();
    if (!existing) {
      await knex('chat_channels').insert({
        name: d.name,
        type: 'deelgebied',
        description: `Chat voor deelgebied ${d.name}`,
        deelgebied_id: d.id,
        tenant_id: 1,
        is_active: true,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
      });
    }
  }

  // Ensure a single global general channel named "Hunters algemeen".
  const gen = await knex('chat_channels').where({ type: 'general', tenant_id: 1 }).first();
  if (gen) {
    await knex('chat_channels').where({ id: gen.id }).update({ name: 'Hunters algemeen' });
  } else {
    await knex('chat_channels').insert({
      name: 'Hunters algemeen',
      type: 'general',
      description: 'Algemeen kanaal voor alle hunters',
      tenant_id: 1,
      is_active: true,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    });
  }
};

exports.down = async function (knex) {
  await knex('chat_channels').where('type', 'deelgebied').del();
  const hasCol = await knex.schema.hasColumn('chat_channels', 'deelgebied_id');
  if (hasCol) {
    await knex.schema.alterTable('chat_channels', (t) => t.dropColumn('deelgebied_id'));
  }
};
