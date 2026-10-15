// Membership for the activity topic channels (Creatief / Foto's / Puzzels), the
// same way deelgebieden work: an admin adds/removes people and only members see
// the channel. 'Aankondiging' stays open to everyone (announcements reach all).
// Memberships start EMPTY — nobody is a member until an admin assigns them.
const MEMBERS_ONLY = ['Creatief', "Foto's", 'Puzzels'];

exports.up = async function (knex) {
  const hasCol = await knex.schema.hasColumn('chat_channels', 'members_only');
  if (!hasCol) {
    await knex.schema.alterTable('chat_channels', (t) => {
      t.boolean('members_only').notNullable().defaultTo(false);
    });
  }

  const hasTable = await knex.schema.hasTable('user_channel_memberships');
  if (!hasTable) {
    await knex.schema.createTable('user_channel_memberships', (t) => {
      t.increments('id').primary();
      t.integer('user_id').unsigned().notNullable();
      t.integer('channel_id').unsigned().notNullable();
      t.timestamp('joined_at').defaultTo(knex.fn.now());
      t.timestamp('left_at').nullable(); // NULL = current member (history kept)
      t.index(['user_id']);
      t.index(['channel_id']);
    });
  }

  // Flag the activity channels as members-only.
  for (const name of MEMBERS_ONLY) {
    await knex('chat_channels').where({ type: 'topic', name }).update({ members_only: true });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('user_channel_memberships');
  const hasCol = await knex.schema.hasColumn('chat_channels', 'members_only');
  if (hasCol) {
    await knex.schema.alterTable('chat_channels', (t) => t.dropColumn('members_only'));
  }
};
