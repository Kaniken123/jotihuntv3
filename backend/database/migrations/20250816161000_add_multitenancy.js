exports.up = function(knex) {
  return knex.schema
    // Create tenants table
    .createTable('tenants', function (table) {
      table.increments('id').primary();
      table.string('name').notNullable(); // e.g., "Region North", "Company ABC"
      table.string('slug').unique().notNullable(); // e.g., "region-north", "company-abc"
      table.text('description');
      table.string('logo_url');
      table.json('settings'); // Tenant-specific configuration
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);
    })
    
    // Add tenant_id to users table and update roles
    .alterTable('users', function (table) {
      table.integer('tenant_id').unsigned().references('id').inTable('tenants').onDelete('CASCADE');
      table.dropColumn('role'); // Remove old role enum
    })
    
    // Add new roles table for flexible role management
    .createTable('user_roles', function (table) {
      table.increments('id').primary();
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
      table.integer('tenant_id').unsigned().references('id').inTable('tenants').onDelete('CASCADE').nullable();
      table.enum('role', ['super_admin', 'tenant_admin', 'user']).notNullable();
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);
      table.unique(['user_id', 'tenant_id']); // User can only have one role per tenant
    })
    
    // Add tenant_id to teams table  
    .alterTable('teams', function (table) {
      table.integer('tenant_id').unsigned().references('id').inTable('tenants').onDelete('CASCADE');
    })
    
    // Add tenant_id to areas table
    .alterTable('areas', function (table) {
      table.integer('tenant_id').unsigned().references('id').inTable('tenants').onDelete('CASCADE');
    })
    
    // Add tenant_id to hunts table
    .alterTable('hunts', function (table) {
      table.integer('tenant_id').unsigned().references('id').inTable('tenants').onDelete('CASCADE');
    })
    
    // Add tenant_id to articles table
    .alterTable('articles', function (table) {
      table.integer('tenant_id').unsigned().references('id').inTable('tenants').onDelete('CASCADE');
    })
    
    // Add tenant_id to user_locations table
    .alterTable('user_locations', function (table) {
      table.integer('tenant_id').unsigned().references('id').inTable('tenants').onDelete('CASCADE');
    })
    
    // Add tenant_id to team_messages table
    .alterTable('team_messages', function (table) {
      table.integer('tenant_id').unsigned().references('id').inTable('tenants').onDelete('CASCADE');
    });
};

exports.down = function(knex) {
  return knex.schema
    // Remove tenant_id from all tables
    .alterTable('team_messages', function (table) {
      table.dropColumn('tenant_id');
    })
    .alterTable('user_locations', function (table) {
      table.dropColumn('tenant_id');
    })
    .alterTable('articles', function (table) {
      table.dropColumn('tenant_id');
    })
    .alterTable('hunts', function (table) {
      table.dropColumn('tenant_id');
    })
    .alterTable('areas', function (table) {
      table.dropColumn('tenant_id');
    })
    .alterTable('teams', function (table) {
      table.dropColumn('tenant_id');
    })
    
    // Restore old role column in users
    .alterTable('users', function (table) {
      table.dropColumn('tenant_id');
      table.enum('role', ['admin', 'user']).defaultTo('user');
    })
    
    // Drop new tables
    .dropTableIfExists('user_roles')
    .dropTableIfExists('tenants');
};