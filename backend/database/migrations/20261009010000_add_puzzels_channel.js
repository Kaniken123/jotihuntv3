// Epic F follow-up — add a fourth global 'topic' channel: Puzzels. Normal posting
// (everyone can post), same as Creatief / Foto's. Separate migration because the
// first topic-channels migration has already run in every environment.
exports.up = async function (knex) {
  const existing = await knex('chat_channels')
    .where({ type: 'topic', name: 'Puzzels', tenant_id: 1 })
    .first();
  if (!existing) {
    await knex('chat_channels').insert({
      name: 'Puzzels',
      type: 'topic',
      description: 'Puzzels en denkopdrachten',
      admin_post_only: false,
      tenant_id: 1,
      is_active: true,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    });
  }
};

exports.down = async function (knex) {
  await knex('chat_channels').where({ type: 'topic', name: 'Puzzels' }).del();
};
