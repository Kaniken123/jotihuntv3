// Epic F — three global "topic" chat channels: Creatief, Foto's, Announcement.
// They sit alongside the general + deelgebied channels and are visible to everyone.
// 'Announcement' is read-only for hunters (admin_post_only) — only admins post,
// everyone reads. Topic channels broadcast to a per-channel room (tenant-N-topic-ID).
const TOPICS = [
  { name: 'Creatief', description: 'Creatieve opdrachten', admin_post_only: false },
  { name: "Foto's", description: 'Foto-opdrachten', admin_post_only: false },
  { name: 'Aankondiging', description: 'Mededelingen van de organisatie', admin_post_only: true },
];

exports.up = async function (knex) {
  const hasCol = await knex.schema.hasColumn('chat_channels', 'admin_post_only');
  if (!hasCol) {
    await knex.schema.alterTable('chat_channels', (t) => {
      t.boolean('admin_post_only').notNullable().defaultTo(false);
    });
  }

  for (const topic of TOPICS) {
    const existing = await knex('chat_channels')
      .where({ type: 'topic', name: topic.name, tenant_id: 1 })
      .first();
    if (!existing) {
      await knex('chat_channels').insert({
        name: topic.name,
        type: 'topic',
        description: topic.description,
        admin_post_only: topic.admin_post_only,
        tenant_id: 1,
        is_active: true,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
      });
    } else {
      // Keep the post policy in sync if the channel already exists.
      await knex('chat_channels')
        .where({ id: existing.id })
        .update({ admin_post_only: topic.admin_post_only });
    }
  }
};

exports.down = async function (knex) {
  await knex('chat_channels').where('type', 'topic').del();
  const hasCol = await knex.schema.hasColumn('chat_channels', 'admin_post_only');
  if (hasCol) {
    await knex.schema.alterTable('chat_channels', (t) => t.dropColumn('admin_post_only'));
  }
};
