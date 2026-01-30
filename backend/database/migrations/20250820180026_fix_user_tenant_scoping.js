exports.up = function(knex) {
  return knex.schema
    // First, drop existing unique constraints on username and email
    .alterTable('users', function (table) {
      table.dropUnique(['username']);
      table.dropUnique(['email']);
    })
    .then(() => {
      // Make tenant_id required for users (it should already be there from the multitenancy migration)
      return knex.schema.alterTable('users', function (table) {
        table.integer('tenant_id').unsigned().references('id').inTable('tenants').onDelete('CASCADE').notNullable().alter();
        
        // Create composite unique constraints: username+tenant_id and email+tenant_id
        table.unique(['username', 'tenant_id'], 'users_username_tenant_unique');
        table.unique(['email', 'tenant_id'], 'users_email_tenant_unique');
      });
    })
    .then(() => {
      // Also update teams table to have tenant-scoped unique names
      return knex.schema.alterTable('teams', function (table) {
        table.dropUnique(['name']);
        table.unique(['name', 'tenant_id'], 'teams_name_tenant_unique');
      });
    })
    .then(() => {
      // Add auth_tokens tenant isolation
      return knex.schema.alterTable('auth_tokens', function (table) {
        table.integer('tenant_id').unsigned().references('id').inTable('tenants').onDelete('CASCADE');
      });
    });
};

exports.down = function(knex) {
  return knex.schema
    // Remove tenant-scoped constraints and restore global uniqueness
    .alterTable('auth_tokens', function (table) {
      table.dropColumn('tenant_id');
    })
    .then(() => {
      return knex.schema.alterTable('teams', function (table) {
        table.dropUnique(['name', 'tenant_id']);
        table.unique(['name']);
      });
    })
    .then(() => {
      return knex.schema.alterTable('users', function (table) {
        table.dropUnique(['username', 'tenant_id']);
        table.dropUnique(['email', 'tenant_id']);
        table.unique(['username']);
        table.unique(['email']);
        table.integer('tenant_id').nullable().alter();
      });
    });
};