// Epic B — keep the RAW Jotihunt API status (green/orange/red) on the area so the
// UI can show three distinct states (actief / onderweg / inactief). areas.status
// stays the collapsed db status (active/inactive/hunted) that hunt logic relies on
// (orange = onderweg is still huntable → still maps to 'active').
exports.up = async function (knex) {
  const has = await knex.schema.hasColumn('areas', 'api_status');
  if (!has) {
    await knex.schema.alterTable('areas', (t) => {
      t.string('api_status').nullable(); // 'green' | 'orange' | 'red'
    });
  }
};

exports.down = async function (knex) {
  const has = await knex.schema.hasColumn('areas', 'api_status');
  if (has) {
    await knex.schema.alterTable('areas', (t) => t.dropColumn('api_status'));
  }
};
