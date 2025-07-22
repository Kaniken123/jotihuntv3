exports.up = function(knex) {
  return knex.schema
    .createTable('message_reactions', function(table) {
      table.increments('id').primary();
      table.integer('message_id').notNullable();
      table.integer('user_id').notNullable();
      table.string('emoji', 10).notNullable(); // Store emoji like '👍', '❤️', etc.
      table.timestamps(true, true);
      
      // Foreign keys
      table.foreign('message_id').references('team_messages.id').onDelete('CASCADE');
      table.foreign('user_id').references('users.id').onDelete('CASCADE');
      
      // Unique constraint - one reaction per user per message
      table.unique(['message_id', 'user_id', 'emoji']);
      
      // Indexes
      table.index(['message_id']);
      table.index(['user_id']);
    })
    .alterTable('team_messages', function(table) {
      // Add message status and read tracking
      table.string('status').defaultTo('sent'); // sent, delivered, read
      table.timestamp('delivered_at').nullable();
      table.timestamp('read_at').nullable();
      table.json('read_by').nullable(); // JSON array of user IDs who read the message
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTable('message_reactions')
    .alterTable('team_messages', function(table) {
      table.dropColumn('status');
      table.dropColumn('delivered_at');
      table.dropColumn('read_at');
      table.dropColumn('read_by');
    });
};