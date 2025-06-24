exports.up = function(knex) {
  return knex.schema
    .createTable('team_messages', function (table) {
      table.increments('id').primary();
      table.integer('team_id').unsigned().references('id').inTable('teams').onDelete('CASCADE');
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
      table.text('message').notNullable();
      table.string('attachment_url');
      table.string('attachment_type'); // image, file, etc.
      table.boolean('is_edited').defaultTo(false);
      table.timestamp('edited_at');
      table.timestamps(true, true);
      table.index(['team_id', 'created_at']);
    })
    .createTable('hunts', function (table) {
      table.increments('id').primary();
      table.integer('hunter_team_id').unsigned().references('id').inTable('teams').onDelete('CASCADE');
      table.integer('hunter_user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
      table.string('fox_area').notNullable(); // Alpha, Bravo, etc.
      table.decimal('hunt_lat', 10, 8).notNullable();
      table.decimal('hunt_lng', 11, 8).notNullable();
      table.string('photo_url').notNullable();
      table.integer('points_awarded').defaultTo(0);
      table.enum('status', ['pending', 'approved', 'rejected']).defaultTo('pending');
      table.text('rejection_reason');
      table.timestamp('hunt_time').defaultTo(knex.fn.now());
      table.timestamps(true, true);
    })
    .createTable('api_cache', function (table) {
      table.increments('id').primary();
      table.string('cache_key').unique().notNullable();
      table.text('data');
      table.timestamp('last_sync').defaultTo(knex.fn.now());
      table.timestamp('expires_at');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('api_cache')
    .dropTableIfExists('hunts')
    .dropTableIfExists('team_messages');
};