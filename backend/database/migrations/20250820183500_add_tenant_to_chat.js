exports.up = function(knex) {
  return knex.schema
    // Add tenant_id to chat_channels table
    .alterTable('chat_channels', function (table) {
      table.integer('tenant_id').unsigned().references('id').inTable('tenants').onDelete('CASCADE').defaultTo(1);
    })
    
    // Add tenant_id to team_messages table if not exists
    .then(() => {
      return knex.schema.hasColumn('team_messages', 'tenant_id').then(exists => {
        if (!exists) {
          return knex.schema.alterTable('team_messages', function (table) {
            table.integer('tenant_id').unsigned().references('id').inTable('tenants').onDelete('CASCADE').defaultTo(1);
          });
        }
      });
    })
    
    // Add tenant_id to message_reactions table if not exists  
    .then(() => {
      return knex.schema.hasColumn('message_reactions', 'tenant_id').then(exists => {
        if (!exists) {
          return knex.schema.alterTable('message_reactions', function (table) {
            table.integer('tenant_id').unsigned().references('id').inTable('tenants').onDelete('CASCADE').defaultTo(1);
          });
        }
      });
    });
};

exports.down = function(knex) {
  return knex.schema
    // Remove tenant_id from message_reactions
    .alterTable('message_reactions', function (table) {
      table.dropColumn('tenant_id');
    })
    
    // Remove tenant_id from team_messages
    .then(() => {
      return knex.schema.alterTable('team_messages', function (table) {
        table.dropColumn('tenant_id');
      });
    })
    
    // Remove tenant_id from chat_channels
    .then(() => {
      return knex.schema.alterTable('chat_channels', function (table) {
        table.dropColumn('tenant_id');
      });
    });
};