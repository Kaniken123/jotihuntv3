exports.up = function(knex) {
  return knex.schema
    .createTable('chat_channels', function(table) {
      table.increments('id').primary();
      table.string('name').notNullable();
      table.string('type').notNullable(); // 'team' or 'general'
      table.text('description').nullable();
      table.integer('team_id').nullable(); // null for general channels
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);
      
      // Foreign key for team channels
      table.foreign('team_id').references('teams.id').onDelete('CASCADE');
      
      // Indexes
      table.index(['type']);
      table.index(['team_id']);
      table.index(['is_active']);
    })
    .alterTable('team_messages', function(table) {
      // Add channel support to existing messages
      table.integer('channel_id').nullable();
      
      // Add foreign key
      table.foreign('channel_id').references('chat_channels.id').onDelete('CASCADE');
      table.index(['channel_id']);
    })
    .then(() => {
      // Insert general channel
      return knex('chat_channels').insert({
        name: 'General',
        type: 'general',
        description: 'General chat for all participants',
        team_id: null,
        is_active: true,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      });
    })
    .then(() => {
      // Create team channels for existing teams and migrate existing messages
      return knex('teams').select('id', 'name')
        .then(teams => {
          const channelInserts = teams.map(team => ({
            name: `Team ${team.name}`,
            type: 'team',
            description: `Private chat for ${team.name}`,
            team_id: team.id,
            is_active: true,
            created_at: knex.fn.now(),
            updated_at: knex.fn.now()
          }));
          
          return knex('chat_channels').insert(channelInserts);
        });
    })
    .then(() => {
      // Migrate existing messages to team channels
      return knex.raw(`
        UPDATE team_messages 
        SET channel_id = (
          SELECT cc.id 
          FROM chat_channels cc 
          WHERE cc.team_id = team_messages.team_id 
          AND cc.type = 'team'
        )
        WHERE team_id IS NOT NULL
      `);
    });
};

exports.down = function(knex) {
  return knex.schema
    .alterTable('team_messages', function(table) {
      table.dropColumn('channel_id');
    })
    .dropTable('chat_channels');
};