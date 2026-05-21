exports.up = async function(knex) {
  const hasColumn = await knex.schema.hasColumn('auth_tokens', 'tenant_id');
  if (!hasColumn) {
    await knex.schema.alterTable('auth_tokens', function(table) {
      table.integer('tenant_id').nullable();
    });
  }
};

exports.down = async function(knex) {
  const hasColumn = await knex.schema.hasColumn('auth_tokens', 'tenant_id');
  if (hasColumn) {
    await knex.schema.alterTable('auth_tokens', function(table) {
      table.dropColumn('tenant_id');
    });
  }
};
