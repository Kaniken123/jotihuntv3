// Rename the 'Announcement' topic channel to Dutch 'Aankondiging'. Nothing in code
// depends on the literal name (posting rights use admin_post_only), so a rename is safe.
exports.up = async function (knex) {
  await knex('chat_channels')
    .where({ type: 'topic', name: 'Announcement' })
    .update({ name: 'Aankondiging' });
};

exports.down = async function (knex) {
  await knex('chat_channels')
    .where({ type: 'topic', name: 'Aankondiging' })
    .update({ name: 'Announcement' });
};
