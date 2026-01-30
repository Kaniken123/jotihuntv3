exports.up = function(knex) {
  return knex.schema
    // Add tenant_id to subscriptions table
    .alterTable('subscriptions', function (table) {
      table.integer('tenant_id').unsigned().references('id').inTable('tenants').onDelete('CASCADE').defaultTo(1);
      // Update the unique constraint to include tenant_id
      table.unique(['external_id', 'tenant_id'], 'subscriptions_external_tenant_unique');
    })
    
    // Fix articles table constraints if needed
    .then(() => {
      // First check if the constraint already exists, if not add it
      return knex.raw(`
        CREATE UNIQUE INDEX IF NOT EXISTS articles_external_tenant_unique 
        ON articles(external_id, tenant_id)
      `);
    })
    
    // Update areas table to be tenant-scoped
    .then(() => {
      return knex.schema.alterTable('areas', function (table) {
        // Drop the old unique constraint on name
        table.dropUnique(['name']);
        // Add new composite unique constraint with tenant_id
        table.unique(['name', 'tenant_id'], 'areas_name_tenant_unique');
      });
    });
};

exports.down = function(knex) {
  return knex.schema
    // Restore areas table
    .alterTable('areas', function (table) {
      table.dropUnique(['name', 'tenant_id']);
      table.unique(['name']);
    })
    
    // Remove articles index
    .then(() => {
      return knex.raw('DROP INDEX IF EXISTS articles_external_tenant_unique');
    })
    
    // Restore subscriptions table
    .then(() => {
      return knex.schema.alterTable('subscriptions', function (table) {
        table.dropUnique(['external_id', 'tenant_id']);
        table.dropColumn('tenant_id');
      });
    });
};